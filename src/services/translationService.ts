// ============================================================
// 메시지 번역 서비스
// - Gemini API 키가 설정되어 있으면 Gemini 로 번역 (품질 우선)
// - 키가 없거나 실패하면 Google 공개 번역 엔드포인트로 즉시 폴백 (키 불필요)
// - 번역 결과는 localStorage 에 캐시해 같은 문장을 다시 번역하지 않습니다.
// ============================================================

import { GoogleGenAI } from '@google/genai';
import { getGeminiApiKey } from './appConfig';

export interface LanguageOption {
  code: string;
  label: string;
  englishName: string;
}

/** 주요 언어 + 전 세계 언어(ISO 639-1) 목록. 직접 코드 입력도 지원합니다. */
export const LANGUAGES: LanguageOption[] = [
  { code: 'ko', label: '한국어', englishName: 'Korean' },
  { code: 'en', label: '영어', englishName: 'English' },
  { code: 'ja', label: '일본어', englishName: 'Japanese' },
  { code: 'zh-CN', label: '중국어(간체)', englishName: 'Simplified Chinese' },
  { code: 'zh-TW', label: '중국어(번체)', englishName: 'Traditional Chinese' },
  { code: 'es', label: '스페인어', englishName: 'Spanish' },
  { code: 'fr', label: '프랑스어', englishName: 'French' },
  { code: 'de', label: '독일어', englishName: 'German' },
  { code: 'ru', label: '러시아어', englishName: 'Russian' },
  { code: 'ar', label: '아랍어', englishName: 'Arabic' },
  { code: 'vi', label: '베트남어', englishName: 'Vietnamese' },
  { code: 'th', label: '태국어', englishName: 'Thai' },
  { code: 'id', label: '인도네시아어', englishName: 'Indonesian' },
  { code: 'pt', label: '포르투갈어', englishName: 'Portuguese' },
  { code: 'it', label: '이탈리아어', englishName: 'Italian' },
  { code: 'nl', label: '네덜란드어', englishName: 'Dutch' },
  { code: 'pl', label: '폴란드어', englishName: 'Polish' },
  { code: 'tr', label: '터키어', englishName: 'Turkish' },
  { code: 'uk', label: '우크라이나어', englishName: 'Ukrainian' },
  { code: 'cs', label: '체코어', englishName: 'Czech' },
  { code: 'sv', label: '스웨덴어', englishName: 'Swedish' },
  { code: 'da', label: '덴마크어', englishName: 'Danish' },
  { code: 'fi', label: '핀란드어', englishName: 'Finnish' },
  { code: 'no', label: '노르웨이어', englishName: 'Norwegian' },
  { code: 'el', label: '그리스어', englishName: 'Greek' },
  { code: 'hu', label: '헝가리어', englishName: 'Hungarian' },
  { code: 'ro', label: '루마니아어', englishName: 'Romanian' },
  { code: 'bg', label: '불가리아어', englishName: 'Bulgarian' },
  { code: 'he', label: '히브리어', englishName: 'Hebrew' },
  { code: 'fa', label: '페르시아어', englishName: 'Persian' },
  { code: 'hi', label: '힌디어', englishName: 'Hindi' },
  { code: 'bn', label: '벵골어', englishName: 'Bengali' },
  { code: 'ur', label: '우르두어', englishName: 'Urdu' },
  { code: 'ta', label: '타밀어', englishName: 'Tamil' },
  { code: 'te', label: '텔루구어', englishName: 'Telugu' },
  { code: 'mr', label: '마라티어', englishName: 'Marathi' },
  { code: 'gu', label: '구자라트어', englishName: 'Gujarati' },
  { code: 'pa', label: '펀자브어', englishName: 'Punjabi' },
  { code: 'ne', label: '네팔어', englishName: 'Nepali' },
  { code: 'si', label: '싱할라어', englishName: 'Sinhala' },
  { code: 'my', label: '미얀마어', englishName: 'Burmese' },
  { code: 'km', label: '크메르어', englishName: 'Khmer' },
  { code: 'lo', label: '라오어', englishName: 'Lao' },
  { code: 'ms', label: '말레이어', englishName: 'Malay' },
  { code: 'tl', label: '필리핀어', englishName: 'Filipino' },
  { code: 'sw', label: '스와힐리어', englishName: 'Swahili' },
  { code: 'am', label: '암하라어', englishName: 'Amharic' },
  { code: 'yo', label: '요루바어', englishName: 'Yoruba' },
  { code: 'ha', label: '하우사어', englishName: 'Hausa' },
  { code: 'zu', label: '줄루어', englishName: 'Zulu' },
  { code: 'af', label: '아프리칸스어', englishName: 'Afrikaans' },
  { code: 'sq', label: '알바니아어', englishName: 'Albanian' },
  { code: 'hy', label: '아르메니아어', englishName: 'Armenian' },
  { code: 'az', label: '아제르바이잔어', englishName: 'Azerbaijani' },
  { code: 'ka', label: '조지아어', englishName: 'Georgian' },
  { code: 'kk', label: '카자흐어', englishName: 'Kazakh' },
  { code: 'uz', label: '우즈베크어', englishName: 'Uzbek' },
  { code: 'mn', label: '몽골어', englishName: 'Mongolian' },
  { code: 'sr', label: '세르비아어', englishName: 'Serbian' },
  { code: 'hr', label: '크로아티아어', englishName: 'Croatian' },
  { code: 'sk', label: '슬로바키아어', englishName: 'Slovak' },
  { code: 'sl', label: '슬로베니아어', englishName: 'Slovenian' },
  { code: 'lt', label: '리투아니아어', englishName: 'Lithuanian' },
  { code: 'lv', label: '라트비아어', englishName: 'Latvian' },
  { code: 'et', label: '에스토니아어', englishName: 'Estonian' },
  { code: 'is', label: '아이슬란드어', englishName: 'Icelandic' },
  { code: 'ga', label: '아일랜드어', englishName: 'Irish' },
  { code: 'cy', label: '웨일스어', englishName: 'Welsh' },
  { code: 'ca', label: '카탈로니아어', englishName: 'Catalan' },
  { code: 'eu', label: '바스크어', englishName: 'Basque' },
  { code: 'gl', label: '갈리시아어', englishName: 'Galician' },
  { code: 'mt', label: '몰타어', englishName: 'Maltese' },
  { code: 'la', label: '라틴어', englishName: 'Latin' },
  { code: 'eo', label: '에스페란토', englishName: 'Esperanto' },
  { code: 'jv', label: '자바어', englishName: 'Javanese' },
  { code: 'su', label: '순다어', englishName: 'Sundanese' },
  { code: 'ceb', label: '세부아노어', englishName: 'Cebuano' },
  { code: 'haw', label: '하와이어', englishName: 'Hawaiian' },
  { code: 'mi', label: '마오리어', englishName: 'Maori' },
  { code: 'sm', label: '사모아어', englishName: 'Samoan' },
  { code: 'tg', label: '타지크어', englishName: 'Tajik' },
  { code: 'ky', label: '키르기스어', englishName: 'Kyrgyz' },
  { code: 'ps', label: '파슈토어', englishName: 'Pashto' },
  { code: 'ku', label: '쿠르드어', englishName: 'Kurdish' },
  { code: 'so', label: '소말리어', englishName: 'Somali' },
  { code: 'rw', label: '키냐르완다어', englishName: 'Kinyarwanda' },
  { code: 'sn', label: '쇼나어', englishName: 'Shona' },
  { code: 'ny', label: '치체와어', englishName: 'Chichewa' },
];

export const languageLabel = (code: string): string => {
  const found = LANGUAGES.find((l) => l.code.toLowerCase() === code.toLowerCase());
  return found ? found.label : code;
};

export const languageEnglishName = (code: string): string => {
  const found = LANGUAGES.find((l) => l.code.toLowerCase() === code.toLowerCase());
  return found ? found.englishName : code;
};

export type TranslationProvider = 'gemini' | 'google' | 'none';

export interface TranslationResult {
  text: string;
  provider: TranslationProvider;
  target: string;
  error?: string;
}

const CACHE_KEY = 'nexus_translation_cache_v1';
const CACHE_LIMIT = 400;

type CacheMap = Record<string, { text: string; provider: TranslationProvider }>;

const readCache = (): CacheMap => {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as CacheMap) : {};
  } catch {
    return {};
  }
};

const writeCache = (cache: CacheMap) => {
  try {
    const keys = Object.keys(cache);
    if (keys.length > CACHE_LIMIT) {
      keys.slice(0, keys.length - CACHE_LIMIT).forEach((k) => delete cache[k]);
    }
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    /* 저장 공간 부족 시 무시 */
  }
};

const cacheKey = (text: string, target: string) => `${target}::${text}`;

let geminiClient: GoogleGenAI | null = null;
let geminiKeyUsed = '';

const getGemini = (): GoogleGenAI | null => {
  const key = getGeminiApiKey();
  if (!key) return null;
  if (!geminiClient || geminiKeyUsed !== key) {
    geminiClient = new GoogleGenAI({ apiKey: key });
    geminiKeyUsed = key;
  }
  return geminiClient;
};

const translateWithGemini = async (text: string, target: string): Promise<string | null> => {
  const ai = getGemini();
  if (!ai) return null;
  const targetName = `${languageEnglishName(target)} (${target})`;
  try {
    const models = ['gemini-2.5-flash', 'gemini-flash-latest', 'gemini-2.0-flash'];
    for (const model of models) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents: [
            {
              role: 'user',
              parts: [
                {
                  text: `Translate the chat message below into ${targetName}. Keep emoji, mentions (@name), URLs and code fences unchanged. Reply with the translation only, no explanation, no quotes.\n\n---\n${text}`,
                },
              ],
            },
          ],
        });
        const out = (response.text || '').trim();
        if (out) return out;
      } catch (err) {
        const msg = String((err as any)?.message || err);
        if (!/not found|404|unsupported|does not exist/i.test(msg)) throw err;
      }
    }
    return null;
  } catch (error) {
    console.warn('[translate] Gemini translation failed, falling back to public endpoint.', error);
    return null;
  }
};

const splitForPublicEndpoint = (text: string, max = 1200): string[] => {
  if (text.length <= max) return [text];
  const chunks: string[] = [];
  let rest = text;
  while (rest.length > max) {
    let cut = rest.lastIndexOf('\n', max);
    if (cut < max * 0.5) cut = rest.lastIndexOf(' ', max);
    if (cut < max * 0.5) cut = max;
    chunks.push(rest.slice(0, cut));
    rest = rest.slice(cut);
  }
  if (rest) chunks.push(rest);
  return chunks;
};

const parseGoogleTranslateResponse = (data: any): string => {
  if (!data) return '';
  if (Array.isArray(data) && Array.isArray(data[0])) {
    return (data[0] as any[])
      .map((segment) => (Array.isArray(segment) ? segment[0] : ''))
      .filter(Boolean)
      .join('');
  }
  if (typeof data === 'string') return data;
  return '';
};

const translateWithPublicEndpoint = async (text: string, target: string): Promise<string | null> => {
  const chunks = splitForPublicEndpoint(text);
  const translated: string[] = [];

  for (const chunk of chunks) {
    let ok = false;
    // 1) translate_a/single (gtx client) — 공개 엔드포인트, 키 불필요
    try {
      const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${encodeURIComponent(
        target
      )}&dt=t&q=${encodeURIComponent(chunk)}`;
      const res = await fetch(url, { method: 'GET' });
      if (res.ok) {
        const parsed = parseGoogleTranslateResponse(await res.json());
        if (parsed) {
          translated.push(parsed);
          ok = true;
        }
      }
    } catch {
      /* 다음 폴백 시도 */
    }

    // 2) clients5 dict-chrome-ex 폴백
    if (!ok) {
      try {
        const url = `https://clients5.google.com/translate_a/t?client=dict-chrome-ex&sl=auto&tl=${encodeURIComponent(
          target
        )}&q=${encodeURIComponent(chunk)}`;
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          const parsed = Array.isArray(data) && Array.isArray(data[0]) ? data[0].join('') : parseGoogleTranslateResponse(data);
          if (parsed) {
            translated.push(parsed);
            ok = true;
          }
        }
      } catch {
        /* 실패 */
      }
    }

    // 3) MyMemory 공개 API 폴백 (키 불필요)
    if (!ok) {
      try {
        const pair = `auto|${target.split('-')[0]}`;
        const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(chunk.slice(0, 480))}&langpair=${encodeURIComponent(pair)}`;
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          const parsed = data?.responseData?.translatedText;
          if (parsed && !/INVALID|QUERY LENGTH LIMIT/i.test(String(parsed))) {
            translated.push(String(parsed));
            ok = true;
          }
        }
      } catch {
        /* 실패 */
      }
    }

    // 4) Lingva 공개 인스턴스 폴백
    if (!ok) {
      try {
        const url = `https://lingva.ml/api/v1/auto/${encodeURIComponent(target.split('-')[0])}/${encodeURIComponent(chunk)}`;
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          if (data?.translation) {
            translated.push(String(data.translation));
            ok = true;
          }
        }
      } catch {
        /* 실패 */
      }
    }

    if (!ok) return null;
  }

  return translated.join('');
};

export const translateMessageText = async (
  text: string,
  target: string,
  options?: { skipCache?: boolean }
): Promise<TranslationResult> => {
  const clean = (text || '').trim();
  if (!clean) return { text: '', provider: 'none', target };
  if (LANGUAGES.find((l) => l.code.toLowerCase() === target.toLowerCase())?.code === 'ko') {
    // 한국어 요청도 실제 번역을 수행합니다 (원문이 외국어일 수 있음).
  }

  const key = cacheKey(clean, target);
  if (!options?.skipCache) {
    const cached = readCache()[key];
    if (cached) return { text: cached.text, provider: cached.provider, target };
  }

  const viaGemini = await translateWithGemini(clean, target);
  if (viaGemini) {
    const cache = readCache();
    cache[key] = { text: viaGemini, provider: 'gemini' };
    writeCache(cache);
    return { text: viaGemini, provider: 'gemini', target };
  }

  const viaPublic = await translateWithPublicEndpoint(clean, target);
  if (viaPublic) {
    const cache = readCache();
    cache[key] = { text: viaPublic, provider: 'google' };
    writeCache(cache);
    return { text: viaPublic, provider: 'google', target };
  }

  return {
    text: '',
    provider: 'none',
    target,
    error: '번역 서버에 연결하지 못했습니다. 네트워크 상태를 확인한 뒤 다시 시도해 주세요.',
  };
};
