// ============================================================
// Gemini 모델 목록
// - 기본 대표 모델 목록을 항상 제공하고,
//   사용자가 API 키를 넣으면 그 키에서 실제로 쓸 수 있는 모델만 조회해 보여줍니다.
//   (Google Generative Language API: GET /v1beta/models?key=...)
// ============================================================

export interface GeminiModelOption {
  id: string;
  label: string;
  desc: string;
  /** Google API 가 알려준 표시 이름 (있으면 우선 사용) */
  displayName?: string;
  source: 'default' | 'key';
}

/** 대표 모델 (키가 없거나 조회에 실패해도 항상 선택할 수 있는 목록) */
export const DEFAULT_GEMINI_MODELS: GeminiModelOption[] = [
  { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', desc: '빠르고 균형 잡힌 기본 모델', source: 'default' },
  { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro', desc: '가장 똑똑한 추론 · 긴 문서 분석', source: 'default' },
  { id: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash Lite', desc: '가장 빠르고 가벼움 · 무료 한도 큼', source: 'default' },
  { id: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash', desc: '안정적인 2.0 세대 모델', source: 'default' },
  { id: 'gemini-2.0-flash-lite', label: 'Gemini 2.0 Flash Lite', desc: '2.0 경량 모델', source: 'default' },
  { id: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash', desc: '구형 · 호환용', source: 'default' },
  { id: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro', desc: '구형 · 긴 문맥 호환용', source: 'default' },
];

export const DEFAULT_GEMINI_MODEL = DEFAULT_GEMINI_MODELS[0].id;

const LABEL_HINTS: { match: RegExp; desc: string }[] = [
  { match: /2\.5-pro|2\.0-pro|1\.5-pro/i, desc: '고성능 · 복잡한 추론' },
  { match: /flash-lite/i, desc: '경량 · 빠른 응답' },
  { match: /flash/i, desc: '빠르고 균형 잡힌 모델' },
  { match: /pro/i, desc: '고성능 모델' },
  { match: /embedding/i, desc: '임베딩 전용' },
  { match: /image/i, desc: '이미지 생성' },
  { match: /tts/i, desc: '음성 합성' },
];

const describeModel = (id: string): string => {
  const hint = LABEL_HINTS.find((item) => item.match.test(id));
  return hint?.desc || '사용 가능한 모델';
};

const prettyLabel = (id: string): string =>
  id
    .split('-')
    .map((part) => (part.length <= 3 && /^[0-9.]+$/.test(part) ? part : part.charAt(0).toUpperCase() + part.slice(1)))
    .join(' ');

/** 모델 id 정규화: "models/gemini-2.5-flash" → "gemini-2.5-flash" */
export const normalizeModelId = (value: string): string => (value || '').replace(/^models\//, '').trim();

interface ApiModel {
  name?: string;
  displayName?: string;
  description?: string;
  supportedGenerationMethods?: string[];
}

/**
 * API 키로 실제 사용 가능한 모델을 조회합니다.
 * 실패(네트워크·키 오류·권한)하면 null 을 돌려주고 호출부가 기본 목록으로 폴백합니다.
 */
export const fetchAvailableGeminiModels = async (apiKey: string): Promise<GeminiModelOption[] | null> => {
  const key = (apiKey || '').trim();
  if (!key) return null;
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(key)}&pageSize=1000`;
    const response = await fetch(url, { headers: { accept: 'application/json' } });
    if (!response.ok) return null;
    const data = (await response.json()) as { models?: ApiModel[] };
    const models = (data.models || [])
      .filter((model) => {
        const id = normalizeModelId(model.name || '');
        if (!id) return false;
        if (!/^gemini/i.test(id)) return false; // Gemini 텍스트 모델만 (임베딩·이미지·TTS 제외)
        if (/embedding|aqa|image|tts|audio|vision-latest/i.test(id)) return false;
        const methods = model.supportedGenerationMethods || ['generateContent'];
        return methods.includes('generateContent');
      })
      .map((model) => {
        const id = normalizeModelId(model.name || '');
        return {
          id,
          label: model.displayName || prettyLabel(id),
          desc: describeModel(id),
          displayName: model.displayName,
          source: 'key' as const,
        };
      });

    if (models.length === 0) return null;
    // 최신·대표 모델이 위에 오도록 정렬
    const rank = (id: string) => {
      if (id === 'gemini-2.5-flash') return 0;
      if (id === 'gemini-2.5-pro') return 1;
      if (id === 'gemini-2.5-flash-lite') return 2;
      if (id.startsWith('gemini-3')) return 3;
      if (id.startsWith('gemini-2.5')) return 4;
      if (id.startsWith('gemini-2.0')) return 5;
      if (id.startsWith('gemini-1.5')) return 6;
      return 7;
    };
    return models.sort((a, b) => rank(a.id) - rank(b.id) || a.id.localeCompare(b.id));
  } catch (error) {
    console.warn('[Gemini] 모델 목록을 불러오지 못했습니다:', error);
    return null;
  }
};

/** 선택한 모델 + 기본 후보를 합친 호출 순서 (실패 시 다음 후보로 자동 재시도) */
export const getModelCandidates = (selected?: string): string[] => {
  const ids = [normalizeModelId(selected || ''), 'gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.0-flash', 'gemini-1.5-flash'].filter(
    Boolean
  );
  return Array.from(new Set(ids));
};
