import { GoogleGenAI } from '@google/genai';
import { Message, DriveDocument, CalendarEvent, TaskItem } from '../types';
import { getGeminiApiKey, getGeminiModel, getYouTubeApiKey } from './appConfig';
import { getModelCandidates, normalizeModelId } from './geminiModels';

export interface GeminiFileAttachment {
  name: string;
  mimeType: string;
  base64Data: string;
}

// ==========================================
// Gemini 호출 계층
// 1) 설정에 저장된 사용자의 Gemini API 키가 있으면 → 브라우저에서 직접 호출 (정적 호스팅에서도 동작)
// 2) 키가 없으면 → 같은 오리진의 서버 API(/api/gemini/*) 사용 (server.ts 로 실행할 때)
// 3) 둘 다 없으면 → 무엇을 하면 되는지 알려주는 안내 문구 반환
// ==========================================

/** 사용자가 설정에서 고른 모델이 항상 첫 후보가 됩니다. */
const modelCandidates = (): string[] => getModelCandidates(getGeminiModel());

export const MISSING_KEY_MESSAGE =
  'Gemini API 키가 아직 없습니다. 오른쪽 위 설정(⚙) → AI 탭에서 Google AI Studio에서 발급받은 API 키를 저장하면 바로 대화할 수 있습니다.';

let cachedClient: GoogleGenAI | null = null;
let cachedKey = '';

const getClient = (): GoogleGenAI | null => {
  const key = getGeminiApiKey();
  if (!key) {
    cachedClient = null;
    cachedKey = '';
    return null;
  }
  if (!cachedClient || cachedKey !== key) {
    cachedClient = new GoogleGenAI({ apiKey: key });
    cachedKey = key;
  }
  return cachedClient;
};

export const hasGeminiApiKey = (): boolean => Boolean(getGeminiApiKey());

const isModelNotFound = (error: any): boolean => {
  const msg = String(error?.message || error || '');
  return /not found|NOT_FOUND|is not supported|unsupported model|does not exist|404/i.test(msg);
};

const isAuthError = (error: any): boolean => {
  const msg = String(error?.message || error || '');
  return /API key|API_KEY|PERMISSION_DENIED|UNAUTHENTICATED|invalid.*key|403|401/i.test(msg);
};

interface ClientGenerateParams {
  prompt: string;
  systemInstruction?: string;
  attachments?: GeminiFileAttachment[];
}

/** 브라우저에서 사용자 키로 Gemini 를 직접 호출합니다. 키가 없으면 null */
const generateWithClientKey = async ({ prompt, systemInstruction, attachments }: ClientGenerateParams): Promise<string | null> => {
  const ai = getClient();
  if (!ai) return null;

  const parts: any[] = [{ text: prompt }];
  (attachments || []).forEach((file) => {
    if (!file?.base64Data) return;
    parts.push({
      inlineData: {
        mimeType: file.mimeType || 'application/octet-stream',
        data: file.base64Data.replace(/^data:[^;]+;base64,/, ''),
      },
    });
    parts.push({ text: `(첨부 파일: ${file.name})` });
  });

  let lastError: any = null;
  for (const model of modelCandidates()) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: [{ role: 'user', parts }],
        config: systemInstruction ? { systemInstruction } : undefined,
      });
      const text = (response as any)?.text || '';
      if (text) return text;
      lastError = new Error('빈 응답을 받았습니다.');
    } catch (error: any) {
      lastError = error;
      if (isModelNotFound(error)) continue;
      break;
    }
  }

  if (lastError) {
    if (isAuthError(lastError)) {
      return '[Gemini 오류] API 키가 올바르지 않거나 권한이 없습니다. 설정(⚙) → AI 탭에서 키를 다시 확인해 주세요.';
    }
    return `[Gemini 오류] ${lastError?.message || '답변을 불러오지 못했습니다. 다시 시도해 주세요.'}`;
  }
  return null;
};

/** 서버 프록시 호출 (server.ts 로 실행 중일 때만 동작)
 *  정적 호스팅에서는 /api 가 없으므로, 한 번 확인되면 이후 요청은 건너뜁니다. */
let serverApiAvailable: boolean | null = null;

const postToServer = async (path: string, body: any): Promise<any | null> => {
  if (serverApiAvailable === false) return null;
  try {
    const res = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      if (res.status === 404 || res.status === 405 || res.status === 501) serverApiAvailable = false;
      return null;
    }
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      serverApiAvailable = false;
      return null;
    }
    serverApiAvailable = true;
    return await res.json();
  } catch {
    serverApiAvailable = false;
    return null;
  }
};

const SYSTEM_INSTRUCTION =
  '당신은 워크챗(WorkChat) 워크스페이스의 Gemini AI 협업 비서입니다. 항상 자연스러운 한국어로, 간결하고 실행 가능한 답변을 제공합니다.';

// 1. Gemini 채팅 (채팅방 맥락 + 첨부 파일)
export const callGeminiServerChat = async (params: {
  message?: string;
  fullChatContext?: string;
  attachments?: GeminiFileAttachment[];
  model?: string;
}): Promise<string> => {
  const message = (params.message || '').trim();
  const context = params.fullChatContext?.trim();

  const prompt = [
    context ? `[워크스페이스 실시간 맥락]\n${context}` : '',
    message || '첨부한 내용을 정리해 주세요.',
  ]
    .filter(Boolean)
    .join('\n\n');

  const clientAnswer = await generateWithClientKey({
    prompt,
    systemInstruction: SYSTEM_INSTRUCTION,
    attachments: params.attachments,
  });
  if (clientAnswer) return clientAnswer;

  const serverData = await postToServer('/api/gemini/chat', {
    message: params.message,
    fullChatContext: params.fullChatContext,
    attachments: params.attachments,
    model: normalizeModelId(params.model || getGeminiModel() || 'gemini-2.5-flash'),
  });
  if (serverData?.reply) return serverData.reply as string;

  return MISSING_KEY_MESSAGE;
};

// 2. 대화 3줄 요약
export const summarizeConversationWithGemini = async (messages: Message[]): Promise<string[]> => {
  const recent = messages.slice(-25).filter((m) => !m.isSystemMessage);
  if (recent.length === 0) {
    return [
      '아직 요약할 대화 내용이 없습니다.',
      '대화방에 메시지를 작성해 보세요.',
      '대화가 쌓이면 Gemini가 핵심을 3줄로 요약해 드립니다.',
    ];
  }

  const chatContext = recent.map((m) => `[${m.senderName} (${m.timestamp})]: ${m.content}`).join('\n');

  const answer = await callGeminiServerChat({
    message:
      '아래 대화의 핵심 사항을 차분하고 명확한 한국어로 딱 3줄로 요약해 주세요. 각 줄은 "• "로 시작하고 다른 설명은 붙이지 마세요.',
    fullChatContext: chatContext,
    model: getGeminiModel() || 'gemini-2.5-flash',
  });

  const lines = answer
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith('#') && !l.startsWith('['))
    .slice(0, 3);

  if (lines.length >= 1 && !answer.startsWith('[Gemini 오류]') && answer !== MISSING_KEY_MESSAGE) {
    return lines;
  }

  return [
    `• 총 ${recent.length}개의 최신 대화 기록이 이 기기에 저장되어 있습니다.`,
    '• Gemini API 키를 설정 탭에서 저장하면 실제 AI 요약이 표시됩니다.',
    '• 주요 안건과 파일 공유 내역은 새로고침해도 유지됩니다.',
  ];
};

// 3. 문서/시트/슬라이드 AI 지원
const DOC_ACTION_PROMPT: Record<string, string> = {
  expand: '아래 문서 내용을 자연스럽게 확장해서 완성도 있는 문서로 다시 작성해 주세요. 원문의 언어(한국어)와 형식을 유지하세요.',
  summarize: '아래 문서 내용을 핵심만 3~5개 항목으로 요약해 주세요.',
  polish: '아래 문서의 맞춤법, 문장 흐름, 어조를 매끄럽게 다듬어 주세요. 내용은 바꾸지 마세요.',
  outline: '아래 문서의 주제에 맞는 개요(목차)를 만들어 주세요.',
  custom: '아래 문서에 대해 다음 요청을 반영해 주세요.',
};

export const assistDocumentWithGemini = async (params: {
  action: 'expand' | 'summarize' | 'polish' | 'outline' | 'custom';
  docTitle: string;
  currentContent: string;
  userInstruction?: string;
}): Promise<string> => {
  const instruction = DOC_ACTION_PROMPT[params.action] || DOC_ACTION_PROMPT.custom;
  const prompt = [
    `문서 제목: ${params.docTitle}`,
    `요청: ${instruction}${params.action === 'custom' && params.userInstruction ? ` (${params.userInstruction})` : ''}`,
    '결과는 문서에 바로 붙여넣을 수 있는 본문만 출력하고, 설명이나 인사말은 쓰지 마세요.',
    '[문서 내용]',
    params.currentContent || '(아직 내용이 없습니다. 제목에 맞는 새 문서를 작성해 주세요.)',
  ].join('\n');

  const answer = await generateWithClientKey({ prompt, systemInstruction: SYSTEM_INSTRUCTION });
  if (answer) return answer;

  const serverData = await postToServer('/api/gemini/docs-assist', params);
  if (serverData?.result) return serverData.result as string;

  return MISSING_KEY_MESSAGE;
};

// 4. YouTube 검색 — 서버 없이 브라우저에서 직접 동작
export interface YouTubeVideoItem {
  id: string;
  title: string;
  channel: string;
  duration?: string;
  category?: string;
  description?: string;
  publishedAt?: string;
  views?: number;
}

export interface YouTubeSearchResult {
  items: YouTubeVideoItem[];
  source: 'google' | 'piped' | 'invidious' | 'none';
  error?: string;
}

const YOUTUBE_QUERY_CACHE = new Map<string, YouTubeSearchResult>();

const formatDuration = (totalSeconds?: number | string): string | undefined => {
  const seconds = typeof totalSeconds === 'string' ? Number(totalSeconds) : totalSeconds;
  if (!seconds || !Number.isFinite(seconds) || seconds <= 0) return undefined;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    : `${m}:${String(s).padStart(2, '0')}`;
};

const parseIsoDuration = (iso?: string): number | undefined => {
  if (!iso) return undefined;
  const match = iso.match(/PT(?:([\d.]+)H)?(?:([\d.]+)M)?(?:([\d.]+)S)?/);
  if (!match) return undefined;
  const [, h, m, s] = match;
  return (Number(h || 0) * 3600) + (Number(m || 0) * 60) + Number(s || 0);
};

const withTimeout = async (url: string, init?: RequestInit, ms = 8000): Promise<Response> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
};

/** 1순위: YouTube Data API v3 (프로젝트 내장 키, 리퍼러 제한됨) */
export const searchYouTubeWithDataApi = async (
  query: string,
  maxResults = 20,
  order: 'relevance' | 'viewCount' | 'date' = 'relevance'
): Promise<YouTubeVideoItem[]> => {
  const key = getYouTubeApiKey();
  if (!key) return [];
  const url =
    'https://www.googleapis.com/youtube/v3/search' +
    `?part=snippet&type=video&maxResults=${maxResults}&order=${order}&regionCode=KR` +
    `&q=${encodeURIComponent(query)}&key=${key}`;
  const res = await withTimeout(url);
  if (!res.ok) throw new Error(`YouTube Data API 오류 (HTTP ${res.status})`);
  const data = await res.json();
  const items: any[] = Array.isArray(data?.items) ? data.items : [];
  const ids = items.map((it) => it?.id?.videoId).filter(Boolean);

  let durations: Record<string, string | undefined> = {};
  if (ids.length > 0) {
    try {
      const detailUrl =
        'https://www.googleapis.com/youtube/v3/videos' +
        `?part=contentDetails,statistics&id=${ids.join(',')}&key=${key}`;
      const detailRes = await withTimeout(detailUrl);
      if (detailRes.ok) {
        const detailData = await detailRes.json();
        (detailData?.items || []).forEach((v: any) => {
          durations[v.id] = formatDuration(parseIsoDuration(v?.contentDetails?.duration));
        });
      }
    } catch {
      /* 길이 정보는 없어도 됨 */
    }
  }

  return items
    .map((it) => ({
      id: String(it?.id?.videoId || ''),
      title: String(it?.snippet?.title || ''),
      channel: String(it?.snippet?.channelTitle || ''),
      description: String(it?.snippet?.description || ''),
      publishedAt: it?.snippet?.publishedAt,
      duration: durations[it?.id?.videoId],
    }))
    .filter((v) => v.id && v.title);
};

/** 2순위: Piped 공개 API (키 없이 동작, CORS 허용) */
const PIPED_INSTANCES = [
  'https://pipedapi.kavin.rocks',
  'https://pipedapi.adminforge.de',
  'https://pipedapi.leptons.xyz',
];

const searchWithPiped = async (query: string): Promise<YouTubeVideoItem[]> => {
  for (const base of PIPED_INSTANCES) {
    try {
      const res = await withTimeout(`${base}/search?q=${encodeURIComponent(query)}&filter=videos`, undefined, 6000);
      if (!res.ok) continue;
      const data = await res.json();
      const items: any[] = Array.isArray(data?.items) ? data.items : [];
      const parsed = items
        .map((it) => {
          const id = String(it?.url || '').replace(/^.*v=/, '');
          return {
            id,
            title: String(it?.title || ''),
            channel: String(it?.uploaderName || ''),
            duration: formatDuration(it?.duration),
            views: typeof it?.views === 'number' ? it.views : undefined,
          };
        })
        .filter((v) => /^[a-zA-Z0-9_-]{11}$/.test(v.id) && v.title);
      if (parsed.length > 0) return parsed;
    } catch {
      /* 다음 인스턴스 시도 */
    }
  }
  return [];
};

/** 3순위: Invidious 공개 API */
const INVIDIOUS_INSTANCES = [
  'https://inv.nadeko.net',
  'https://invidious.nerdvpn.de',
  'https://yewtu.be',
];

const searchWithInvidious = async (query: string): Promise<YouTubeVideoItem[]> => {
  for (const base of INVIDIOUS_INSTANCES) {
    try {
      const res = await withTimeout(
        `${base}/api/v1/search?q=${encodeURIComponent(query)}&type=video&region=KR`,
        undefined,
        6000
      );
      if (!res.ok) continue;
      const data = await res.json();
      const items: any[] = Array.isArray(data) ? data : [];
      const parsed = items
        .filter((it) => it?.videoId)
        .map((it) => ({
          id: String(it.videoId),
          title: String(it.title || ''),
          channel: String(it.author || ''),
          duration: formatDuration(it.lengthSeconds),
          views: typeof it.viewCount === 'number' ? it.viewCount : undefined,
        }))
        .filter((v) => v.title);
      if (parsed.length > 0) return parsed;
    } catch {
      /* 다음 인스턴스 시도 */
    }
  }
  return [];
};

/**
 * 실제 YouTube 검색: Data API → Piped → Invidious 순으로 시도합니다.
 * 모두 실패하면 빈 목록과 안내 문구를 돌려줍니다(가짜 결과를 보여주지 않음).
 */
export const searchYouTubeVideosDetailed = async (query: string): Promise<YouTubeSearchResult> => {
  const clean = (query || '').trim();
  if (!clean) return { items: [], source: 'none' };
  const cached = YOUTUBE_QUERY_CACHE.get(clean);
  if (cached) return cached;

  let apiError = '';
  try {
    const items = await searchYouTubeWithDataApi(clean);
    if (items.length > 0) {
      const result: YouTubeSearchResult = { items, source: 'google' };
      YOUTUBE_QUERY_CACHE.set(clean, result);
      return result;
    }
    apiError = 'YouTube Data API가 결과를 반환하지 않았습니다.';
  } catch (error: any) {
    apiError = String(error?.message || error);
  }

  const piped = await searchWithPiped(clean);
  if (piped.length > 0) {
    const result: YouTubeSearchResult = { items: piped, source: 'piped' };
    YOUTUBE_QUERY_CACHE.set(clean, result);
    return result;
  }

  const invidious = await searchWithInvidious(clean);
  if (invidious.length > 0) {
    const result: YouTubeSearchResult = { items: invidious, source: 'invidious' };
    YOUTUBE_QUERY_CACHE.set(clean, result);
    return result;
  }

  return {
    items: [],
    source: 'none',
    error:
      apiError ||
      '검색 서버에 연결하지 못했습니다. 잠시 후 다시 시도하거나 아래에 유튜브 링크를 직접 붙여넣어 주세요.',
  };
};

/** 하위 호환: 목록만 필요한 곳에서 사용 */
export const searchYouTubeVideos = async (query: string): Promise<YouTubeVideoItem[]> => {
  const result = await searchYouTubeVideosDetailed(query);
  return result.items;
};

/** 실시간 인기 영상 (첫 화면용) */
export const fetchYouTubeTrending = async (maxResults = 12): Promise<YouTubeVideoItem[]> => {
  const key = getYouTubeApiKey();
  if (!key) return [];
  try {
    const url =
      'https://www.googleapis.com/youtube/v3/videos' +
      `?part=snippet,contentDetails&chart=mostPopular&maxResults=${maxResults}&regionCode=KR&key=${key}`;
    const res = await withTimeout(url);
    if (!res.ok) return [];
    const data = await res.json();
    return (data?.items || [])
      .map((it: any) => ({
        id: String(it.id),
        title: String(it?.snippet?.title || ''),
        channel: String(it?.snippet?.channelTitle || ''),
        duration: formatDuration(parseIsoDuration(it?.contentDetails?.duration)),
        publishedAt: it?.snippet?.publishedAt,
      }))
      .filter((v: YouTubeVideoItem) => v.id && v.title);
  } catch {
    return [];
  }
};

// 5. 스마트 컴포즈 추천
export const getSmartComposeSuggestion = (inputText: string): string => {
  const clean = inputText.trim();
  if (!clean || clean.length < 2) return '';

  const completions: Record<string, string> = {
    안녕: '하세요. 오늘 요청주신 내용 확인했습니다.',
    확인: '했습니다. 지금 바로 처리해서 공유해 드리겠습니다.',
    회의: '일정을 구글 캘린더에 등록해 두었으니 확인 부탁드립니다.',
    자료: '링크를 구글 드라이브에 공유해 드렸습니다. 함께 검토해 주세요.',
    수고: '많으셨습니다. 좋은 하루 보내세요.',
    감사: '합니다. 빠르게 피드백 반영하겠습니다.',
    검토: '부탁드립니다. 수정 필요한 부분은 편하게 말씀해 주세요.',
    파일: '업로드 완료했습니다. 실시간 화면 분할로 바로 확인 가능합니다.',
    스케줄: '확인 후 캘린더에 미팅 초대장 전송해 드리겠습니다.',
    오늘: '중으로 완료하여 보고드리겠습니다.',
  };

  for (const [key, val] of Object.entries(completions)) {
    if (clean.endsWith(key) || key.startsWith(clean)) {
      return val;
    }
  }

  if (clean.endsWith('네 ')) return '알겠습니다. 바로 확인해 보겠습니다.';
  if (clean.endsWith('지금 ')) return '처리 중이며 곧 공유드리겠습니다.';
  if (clean.endsWith('링크 ')) return '클릭 시 분할 화면으로 바로 공동 작업 가능합니다.';

  return '';
};

// 6. 스마트 답장 추천
export const getSmartReplies = (lastMessageContent?: string): string[] => {
  if (!lastMessageContent) {
    return ['네, 확인했습니다.', '지금 검토 중입니다.', '좋은 제안입니다.'];
  }

  const content = lastMessageContent.toLowerCase();

  if (content.includes('회의') || content.includes('미팅') || content.includes('meet') || content.includes('캘린더')) {
    return ['미팅 참석 가능합니다.', 'Google Meet 링크로 입장하겠습니다.', '일정 등록 확인했습니다.'];
  }
  if (content.includes('자료') || content.includes('문서') || content.includes('파일') || content.includes('드라이브')) {
    return ['문서 확인했습니다.', '분할 화면으로 함께 검토하겠습니다.', '피드백 바로 남겨두겠습니다.'];
  }
  if (content.includes('부탁') || content.includes('해주세요') || content.includes('요청')) {
    return ['네, 바로 진행하겠습니다.', '확인 후 공유해 드리겠습니다.', '조금만 기다려 주세요.'];
  }
  if (content.includes('감사') || content.includes('수고')) {
    return ['수고 많으셨습니다.', '감사합니다.', '좋은 시간 보내세요.'];
  }

  return ['네, 확인했습니다.', '지금 살펴보고 공유해 드리겠습니다.', '좋습니다, 그렇게 진행하시죠.'];
};

// 7. 워크스페이스 맥락을 반영한 Gemini 비서 응답
export const queryGeminiAssistant = async (
  query: string,
  context: {
    messages: Message[];
    driveDocs: DriveDocument[];
    events: CalendarEvent[];
    tasks: TaskItem[];
  }
): Promise<string> => {
  const fullContextText = `
[최근 대화 (${context.messages.length}건)]:
${context.messages.slice(-15).map((m) => `[${m.senderName} (${m.timestamp})]: ${m.content}`).join('\n')}

[Google Drive 공유 문서 (${context.driveDocs.length}개)]:
${context.driveDocs.map((d) => `• [${d.type.toUpperCase()}] ${d.title} (소유자: ${d.ownerName}, 최근 수정: ${d.updatedAt})`).join('\n')}

[캘린더 일정 (${context.events.length}건)]:
${context.events.map((e) => `• ${e.title} (${e.dateStr} ${e.startTime}~${e.endTime}, 위치: ${e.location || 'Google Meet'})`).join('\n')}

[할 일 Tasks (${context.tasks.length}개)]:
${context.tasks.map((t) => `• ${t.title} (담당자: ${t.assigneeName}, 상태: ${t.completed ? '완료' : '진행 중'})`).join('\n')}
`;

  return callGeminiServerChat({
    message: query,
    fullChatContext: fullContextText,
    model: getGeminiModel() || 'gemini-2.5-flash',
  });
};

// 8. 이미지 생성 (Imagen / Gemini 이미지 모델)
export const generateImageWithGemini = async (
  prompt: string,
  aspectRatio?: string
): Promise<{ imageUrl: string; prompt: string } | null> => {
  const ai = getClient();
  if (ai) {
    try {
      const response: any = await (ai.models as any).generateImages({
        model: 'imagen-3.0-generate-002',
        prompt,
        config: { numberOfImages: 1, aspectRatio: aspectRatio || '1:1' },
      });
      const generated = response?.generatedImages?.[0];
      const bytes = generated?.image?.imageBytes;
      if (bytes) {
        return { imageUrl: `data:image/png;base64,${bytes}`, prompt };
      }
    } catch (error) {
      console.warn('[GeminiService] Client image generation failed:', error);
    }
  }

  const serverData = await postToServer('/api/gemini/generate-image', {
    prompt,
    aspectRatio: aspectRatio || '1:1',
  });
  if (serverData?.imageUrl) return serverData;

  return null;
};

// 9. AI 로 문서/시트/슬라이드 초안 생성
export const createArtifactWithGemini = async (
  type: 'doc' | 'sheet' | 'slide',
  prompt: string
): Promise<{ type: string; content: string; prompt: string } | null> => {
  const formatGuide =
    type === 'sheet'
      ? '쉼표(,)로 구분된 CSV 형식으로만 출력하세요. 첫 줄은 헤더입니다. 다른 설명은 쓰지 마세요.'
      : type === 'slide'
      ? 'JSON 배열 형식으로만 출력하세요. 각 항목은 {"title": "...", "subtitle": "...", "bullets": ["..."]} 형태입니다.'
      : '문서 본문만 출력하세요. 마크다운 없이 읽기 쉬운 문단으로 작성하세요.';

  const answer = await generateWithClientKey({
    prompt: `다음 요청으로 ${type === 'sheet' ? '스프레드시트' : type === 'slide' ? '프레젠테이션' : '문서'} 초안을 만들어 주세요.\n요청: ${prompt}\n형식: ${formatGuide}`,
    systemInstruction: SYSTEM_INSTRUCTION,
  });
  if (answer) return { type, content: answer.trim(), prompt };

  const serverData = await postToServer('/api/gemini/create-artifact', { type, prompt });
  if (serverData?.content) return serverData;

  return null;
};
