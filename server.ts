import express from 'express';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 3000);

app.use(express.json({ limit: '25mb' }));

// Safe Gemini client initialization with process.env.GEMINI_API_KEY
const geminiApiKey = process.env.GEMINI_API_KEY || '';
let aiClient: GoogleGenAI | null = null;
if (geminiApiKey && geminiApiKey !== 'MY_GEMINI_API_KEY') {
  try {
    aiClient = new GoogleGenAI({
      apiKey: geminiApiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  } catch (e) {
    console.warn('[Server] Failed to initialize GoogleGenAI client', e);
  }
}

// Resilient helper to execute Gemini with automatic fallback on 503 or overload
async function generateWithFallback(options: {
  contents: any;
  preferredModel?: string;
  systemInstruction?: string;
}) {
  if (!aiClient) {
    throw new Error('Gemini API 키가 서버에 설정되지 않았습니다.');
  }

  const modelsToTry = [
    options.preferredModel || 'gemini-3.7-flash',
    'gemini-3.5-flash',
    'gemini-flash-latest',
    'gemini-3.8-flash',
  ];

  let lastError: any = null;
  for (const modelName of modelsToTry) {
    try {
      const response = await aiClient.models.generateContent({
        model: modelName,
        contents: options.contents,
        ...(options.systemInstruction
          ? { config: { systemInstruction: options.systemInstruction } }
          : {}),
      });
      const text = response.text;
      if (text) {
        return { text, model: modelName };
      }
    } catch (err: any) {
      console.warn(`[Gemini] Model ${modelName} failed, trying next...`, err?.message || err);
      lastError = err;
    }
  }

  throw lastError || new Error('답변을 생성하지 못했습니다.');
}

// 1. POST /api/gemini/chat
app.post('/api/gemini/chat', async (req, res) => {
  try {
    const { message, fullChatContext, attachments, model: reqModel } = req.body;

    if (!message && !fullChatContext) {
      return res.status(400).json({ error: 'Message or context is required.' });
    }

    let contentsParts: any[] = [];
    const systemInstruction = `당신은 Google Gemini 3.7 AI 스마트 협업 비서입니다.
- 사용자가 복잡한 프롬프트를 쓰지 않아도 첨부된 대화 기록과 파일의 맥락을 깊이 이해하고, 자연스럽고 명쾌한 한국어로 바로 핵심을 답변하세요.
- 판에 박힌 기계적인 인사말이나 형식적인 반복 문구를 지양하고, 사용자의 질문 의도에 딱 맞게 정밀하고 똑똑하게 설명하세요.
- 첨부된 대화 내용이나 문서/파일이 있다면 그 세부 정보를 꼼꼼히 대조하여 실질적인 해결책과 요약을 제공하세요.
- 가독성이 좋은 깔끔한 마크다운(강조, 불릿, 표, 코드 블록 등)을 적절히 활용하세요.`;

    let userPrompt = '';
    if (fullChatContext) {
      userPrompt += `[대화방 내용]:\n${fullChatContext}\n\n`;
    }
    userPrompt += message ? message : '위 첨부된 대화 및 파일의 핵심 내용을 파악하고 간결하게 정리해 주세요.';

    contentsParts.push({ text: userPrompt });

    if (attachments && Array.isArray(attachments)) {
      for (const att of attachments) {
        if (att.mimeType && att.base64Data) {
          contentsParts.push({
            inlineData: {
              mimeType: att.mimeType,
              data: att.base64Data,
            },
          });
        }
      }
    }

    const result = await generateWithFallback({
      contents: contentsParts,
      preferredModel: reqModel || 'gemini-3.7-flash',
      systemInstruction,
    });

    return res.json({ reply: result.text, model: result.model });
  } catch (error: any) {
    console.error('[Server] Gemini Chat error:', error);
    return res.status(500).json({
      error: error?.message || 'Gemini API 호출 중 오류가 발생했습니다.',
    });
  }
});

// 2. POST /api/gemini/summarize (실시간 3줄 대화 요약)
app.post('/api/gemini/summarize', async (req, res) => {
  try {
    const { chatContext } = req.body;
    if (!chatContext) {
      return res.status(400).json({ error: 'chatContext is required' });
    }

    const prompt = `다음 대화 내용의 핵심 논의 사항과 결정된 내용을 차분하고 정확한 한국어로 딱 3줄로 요약해 주세요.
반드시 각 줄은 "• "로 시작해야 하며, 서두나 맺음말 없이 3개 줄만 출력하세요:

${chatContext}`;

    const result = await generateWithFallback({
      contents: prompt,
      preferredModel: 'gemini-3.7-flash',
      systemInstruction: '당신은 대화 요약 전문가입니다. 정확히 3개의 불릿 포인트만 반환하세요.',
    });

    const lines = result.text
      .split('\n')
      .map((l: string) => l.trim())
      .filter((l: string) => l.length > 0 && !l.startsWith('#'))
      .slice(0, 3);

    return res.json({ lines, model: result.model });
  } catch (err: any) {
    console.error('[Server] Summarize error:', err);
    return res.status(500).json({ error: err?.message || '요약 생성 실패' });
  }
});

// 3. POST /api/gemini/docs-assist (Google Docs & Sheets AI 도우미)
app.post('/api/gemini/docs-assist', async (req, res) => {
  try {
    const { action, docTitle, currentContent, userInstruction } = req.body;
    const prompt = `[문서 제목]: ${docTitle || '제목 없는 문서'}
[작업 유형]: ${action || '글 다듬기'}
[사용자 추가 지시사항]: ${userInstruction || '내용을 더 풍부하고 전문성 있게 보완해 줘'}
[현재 문서 내용]:
${currentContent || '(내용 없음)'}

위 문서를 바탕으로 요청된 작업을 수행하여, 바로 문서에 반영할 수 있는 고품질의 한국어 결과물(마크다운 형식)을 생성해 주세요. 부가적인 인사말은 생략하고 문서 내용 자체만 반환하세요.`;

    const result = await generateWithFallback({
      contents: prompt,
      preferredModel: 'gemini-3.8-flash',
      systemInstruction: '당신은 Google Docs 및 업무 문서 전문 최고 에디터입니다.',
    });

    return res.json({ result: result.text, model: result.model });
  } catch (err: any) {
    console.error('[Server] Docs assist error:', err);
    return res.status(500).json({ error: err?.message || '문서 AI 지원 실패' });
  }
});

// 4. POST /api/gemini/generate-image (Gemini & Imagen AI 이미지 실시간 생성)
app.post('/api/gemini/generate-image', async (req, res) => {
  try {
    const { prompt, aspectRatio } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    if (!aiClient) {
      return res.status(500).json({ error: 'Gemini API 키가 서버에 설정되지 않았습니다.' });
    }

    // Try Imagen 3 first
    try {
      const imagenRes = await (aiClient.models as any).generateImages({
        model: 'imagen-3.0-generate-002',
        prompt,
        config: {
          numberOfImages: 1,
          outputMimeType: 'image/jpeg',
          aspectRatio: aspectRatio || '1:1',
        },
      });
      const imgBase64 = imagenRes.generatedImages?.[0]?.image?.imageBytes;
      if (imgBase64) {
        return res.json({
          imageUrl: `data:image/jpeg;base64,${imgBase64}`,
          prompt,
          source: 'imagen-3.0-generate-002',
        });
      }
    } catch (imagenErr) {
      console.warn('[Server] Imagen 3 failed, trying gemini-3.1-flash-lite-image...', (imagenErr as any)?.message || imagenErr);
    }

    // Fallback: gemini-3.1-flash-lite-image
    try {
      const response = await aiClient.models.generateContent({
        model: 'gemini-3.1-flash-lite-image',
        contents: prompt,
        config: {
          imageConfig: {
            aspectRatio: aspectRatio || '1:1',
          },
        } as any,
      });

      for (const part of (response as any).candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
          const { mimeType, data } = part.inlineData;
          return res.json({
            imageUrl: `data:${mimeType};base64,${data}`,
            prompt,
            source: 'gemini-3.1-flash-lite-image',
          });
        }
      }
    } catch (geminiImgErr) {
      console.warn('[Server] gemini-3.1-flash-lite-image failed...', (geminiImgErr as any)?.message || geminiImgErr);
    }

    return res.status(500).json({ error: '이미지 생성 모델 응답을 가져오지 못했습니다.' });
  } catch (err: any) {
    console.error('[Server] Generate image error:', err);
    return res.status(500).json({ error: err?.message || '이미지 생성 중 오류가 발생했습니다.' });
  }
});

// 5. POST /api/gemini/create-artifact (Gemini 기반 프레젠테이션, 스프레드시트, 문서 자동 제작)
app.post('/api/gemini/create-artifact', async (req, res) => {
  try {
    const { type, prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: 'Prompt is required' });

    let systemInstruction = '';
    let queryPrompt = '';

    if (type === 'slide') {
      systemInstruction = `당신은 프레젠테이션 기획 전문가입니다.
사용자 요청에 맞춰 4~6개의 고품질 슬라이드를 기획하여, 반드시 아래 형식의 유효한 JSON 배열 문자열만 반환하세요 (어떠한 마크다운 코드블록이나 서두/결말 없이 오직 순수 JSON만 출력):
[
  {
    "id": "s1",
    "title": "슬라이드 제목",
    "subtitle": "부제목",
    "bullets": ["핵심 요점 1", "핵심 요점 2", "핵심 요점 3"],
    "bg": "from-[#3E2723] to-[#2C2520]"
  }
]`;
      queryPrompt = `주제: "${prompt}"에 대한 전문 슬라이드 덱을 작성해 주세요.`;
    } else if (type === 'sheet') {
      systemInstruction = `당신은 데이터 분석 및 스프레드시트 기획 전문가입니다.
첫 행에 컬럼 헤더를 두고, 5~10행의 유용한 한국어 데이터를 포함한 순수 CSV 문자열(쉼표 구분)만 출력하세요. 마크다운 코드블록이나 설명 없이 CSV 데이터만 반환하세요.`;
      queryPrompt = `주제: "${prompt}"에 적합한 스프레드시트 데이터를 작성해 주세요.`;
    } else {
      systemInstruction = `당신은 전문 문서 작성 에디터입니다.
가독성 높은 한국어 마크다운(# 대제목, ## 중제목, 불릿 목록, 요약 표 등)으로 구성된 완성도 높은 업무 문서를 작성하세요.`;
      queryPrompt = `주제: "${prompt}"에 대한 상세한 문서를 작성해 주세요.`;
    }

    const result = await generateWithFallback({
      contents: queryPrompt,
      preferredModel: 'gemini-3.7-flash',
      systemInstruction,
    });

    let raw = result.text.trim();
    // Clean code blocks if present
    if (raw.startsWith('```json')) raw = raw.replace(/^```json\s*/, '').replace(/```\s*$/, '').trim();
    else if (raw.startsWith('```csv')) raw = raw.replace(/^```csv\s*/, '').replace(/```\s*$/, '').trim();
    else if (raw.startsWith('```')) raw = raw.replace(/^```[a-z]*\s*/, '').replace(/```\s*$/, '').trim();

    return res.json({
      type,
      content: raw,
      prompt,
      model: result.model,
    });
  } catch (err: any) {
    console.error('[Server] Create artifact error:', err);
    return res.status(500).json({ error: err?.message || '파일 생성 중 오류가 발생했습니다.' });
  }
});

// 4. POST /api/youtube/search (실시간 YouTube 비디오 검색 및 추천)
app.post('/api/youtube/search', async (req, res) => {
  try {
    const { query } = req.body;
    const cleanQuery = (query || '').trim();

    // Curated high quality videos map for instant matching
    const curatedDatabase = [
      { id: 'jfKfPfyJRdk', title: 'lofi hip hop radio - beats to relax/study to', channel: 'Lofi Girl', duration: 'LIVE', category: '음악/집중' },
      { id: '5qap5aO4i9A', title: '비 오는 날 창가 카페 집중 BGM | 잔잔한 피아노와 빗소리', channel: 'Cafe Music BGM', duration: '3:24:10', category: '카페/휴식' },
      { id: 'k1BneeJTDcU', title: 'Google Workspace 200% 활용 꿀팁 총정리 (Docs, Sheets, Drive)', channel: 'Google Workspace Korea', duration: '14:20', category: '업무생산성' },
      { id: 'DWcJFNfaw9c', title: 'NewJeans (뉴진스) "Supernatural" Official MV', channel: 'HYBE LABELS', duration: '3:30', category: 'K-POP' },
      { id: 'V9PVRfjEBTI', title: 'React 19 & Next.js 완전 정복 강의 1편', channel: '개발하는 정대리', duration: '45:12', category: '개발/코딩' },
      { id: '2Vv-BfVoq4g', title: 'Ed Sheeran - Perfect (Official Music Video)', channel: 'Ed Sheeran', duration: '4:40', category: '음악' },
      { id: 'fJ9rUzIMcZQ', title: 'Queen - Bohemian Rhapsody (Official Video)', channel: 'Queen Official', duration: '6:00', category: '음악' },
      { id: 'kJQP7kiw5Fk', title: 'Luis Fonsi - Despacito ft. Daddy Yankee', channel: 'Luis Fonsi', duration: '4:42', category: '음악' },
      { id: 'L_LUpnjgPso', title: '구글 Gemini 3.8 & 차세대 AI 모델 시연 및 활용법', channel: 'Google Developers', duration: '18:35', category: '인공지능' },
      { id: '3JZ_D3ELwOQ', title: 'TED: How great leaders inspire action | Simon Sinek', channel: 'TED', duration: '18:04', category: '동기부여' },
    ];

    if (!cleanQuery) {
      return res.json({ results: curatedDatabase.slice(0, 6) });
    }

    // 1. Try Live YouTube Search scraping for 100% genuine, currently available videos
    try {
      const ytUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(cleanQuery)}`;
      const fetchRes = await fetch(ytUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
        },
      });
      if (fetchRes.ok) {
        const html = await fetchRes.text();
        const jsonMatch = html.match(/ytInitialData\s*=\s*({.+?});<\/script>/);
        if (jsonMatch) {
          const data = JSON.parse(jsonMatch[1]);
          const realVideos: Array<{ id: string; title: string; channel: string; duration?: string; category?: string }> = [];
          const contents = data?.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents?.[0]?.itemSectionRenderer?.contents || [];
          for (const c of contents) {
            const vr = c.videoRenderer;
            if (vr && vr.videoId && vr.title) {
              const titleText = vr.title?.runs?.[0]?.text || vr.title?.accessibility?.accessibilityData?.label || '동영상';
              const channelText = vr.ownerText?.runs?.[0]?.text || 'YouTube';
              const durationText = vr.lengthText?.simpleText || '';
              realVideos.push({
                id: vr.videoId,
                title: titleText,
                channel: channelText,
                duration: durationText,
                category: 'YouTube 실시간',
              });
              if (realVideos.length >= 8) break;
            }
          }
          if (realVideos.length > 0) {
            return res.json({ results: realVideos });
          }
        }

        // Secondary fallback: regex match video IDs directly from HTML
        const idMatches = [...html.matchAll(/"videoId":"([a-zA-Z0-9_-]{11})"/g)].map((m) => m[1]);
        const uniqueIds = Array.from(new Set(idMatches));
        if (uniqueIds.length > 0) {
          const fallbackResults = uniqueIds.slice(0, 8).map((vidId) => ({
            id: vidId,
            title: `YouTube 검색 결과: ${cleanQuery}`,
            channel: 'YouTube',
            duration: '',
            category: 'YouTube 실시간',
          }));
          return res.json({ results: fallbackResults });
        }
      }
    } catch (scrapErr) {
      console.warn('[Server] Live YouTube query fallback:', scrapErr);
    }

    // 2. Filter matching curated videos if live search is not available
    const qLower = cleanQuery.toLowerCase();
    const matched = curatedDatabase.filter(
      (v) => v.title.toLowerCase().includes(qLower) || v.channel.toLowerCase().includes(qLower) || v.category.toLowerCase().includes(qLower)
    );

    if (matched.length > 0) {
      return res.json({ results: matched });
    }

    // 3. Fallback to top curated videos
    return res.json({
      results: curatedDatabase.slice(0, 6),
    });
  } catch (err: any) {
    console.error('[Server] YouTube search error:', err);
    return res.status(500).json({ error: 'YouTube 검색 실패' });
  }
});


// 2. Health check route
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'WorkChat (워크챗)',
    geminiConfigured: !!aiClient,
  });
});

async function startServer() {
  // Mount Vite middlewares in development
  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve('dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve('dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[WorkChat] Server running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
