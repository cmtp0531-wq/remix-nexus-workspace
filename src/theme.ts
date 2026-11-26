import { scopedGet, scopedSet, scopedRemove, scopedKey } from './services/accountScope';
// ============================================================
// Nexus 테마팩 (카카오톡 테마처럼 색 · 모서리 · 패턴이 함께 바뀜)
// - 오리지널 미니멀 SVG 패턴만 사용 (저작권 이슈 없음)
// ============================================================
export interface ThemePreset {
  id: string;
  name: string;
  desc: string;
  swatch: [string, string, string];
}

const svgUrl = (svg: string) => `url("data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}")`;

// 강아지 스케치 (오리지널): 둥근 머리 + 귀 + 코 + 발자국
const PUPPY_PATTERN = svgUrl(
  `<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180' viewBox='0 0 180 180'>
     <g fill='none' stroke='#B08968' stroke-width='2' stroke-linecap='round' opacity='0.16'>
       <circle cx='44' cy='50' r='14'/>
       <path d='M32 40c-4-8-1-14 4-14s7 5 6 11'/>
       <path d='M56 40c4-8 1-14-4-14s-7 5-6 11'/>
       <circle cx='39' cy='49' r='1.6' fill='#B08968'/>
       <circle cx='49' cy='49' r='1.6' fill='#B08968'/>
       <path d='M42 56c1.5 2 3.5 2 5 0'/>
       <circle cx='128' cy='118' r='6'/>
       <circle cx='140' cy='112' r='3'/>
       <circle cx='146' cy='122' r='3'/>
       <circle cx='136' cy='130' r='3'/>
     </g>
   </svg>`
);

// 눈결정 (오리지널, 6갈래)
const SNOW_PATTERN = svgUrl(
  `<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120' viewBox='0 0 120 120'>
     <g stroke='#7FB4FF' stroke-width='1.6' stroke-linecap='round' opacity='0.35'>
       <g transform='translate(30 30)'>
         <path d='M0 -14V14M-12 -7L12 7M-12 7L12 -7'/>
         <path d='M0 -14l-4 4M0 -14l4 4M0 14l-4-4M0 14l4-4'/>
       </g>
       <g transform='translate(88 82) scale(0.75)'>
         <path d='M0 -14V14M-12 -7L12 7M-12 7L12 -7'/>
         <path d='M0 -14l-4 4M0 -14l4 4M0 14l-4-4M0 14l4-4'/>
       </g>
     </g>
   </svg>`
);

// 크리스마스: 트리 + 별 + 눈송이 (오리지널)
const XMAS_PATTERN = svgUrl(
  `<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200' viewBox='0 0 200 200'>
     <g fill='none' stroke-linecap='round' stroke-linejoin='round'>
       <g stroke='#8FD3B6' stroke-width='1.8' opacity='0.28'>
         <path d='M52 96l16-26 16 26z'/><path d='M56 82l12-20 12 20z'/>
         <path d='M68 96v10'/>
       </g>
       <g stroke='#F3C969' stroke-width='1.8' opacity='0.4'>
         <path d='M150 46l3 7 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z'/>
       </g>
       <g stroke='#DDE9F5' stroke-width='1.4' opacity='0.35'>
         <circle cx='30' cy='40' r='2'/><circle cx='120' cy='120' r='2.4'/><circle cx='172' cy='150' r='1.8'/>
         <circle cx='96' cy='30' r='1.8'/><circle cx='20' cy='160' r='2'/>
       </g>
     </g>
   </svg>`
);

// 부드러운 파스텔 물방울 (오리지널 블롭)
const BUBBLE_PATTERN = svgUrl(
  `<svg xmlns='http://www.w3.org/2000/svg' width='220' height='220' viewBox='0 0 220 220'>
     <g fill='#FFB6CD' opacity='0.16'>
       <circle cx='50' cy='60' r='26'/><circle cx='120' cy='30' r='12'/>
       <circle cx='170' cy='120' r='30'/><circle cx='60' cy='160' r='16'/>
       <circle cx='150' cy='196' r='10'/>
     </g>
   </svg>`
);

export const THEME_PRESETS: ThemePreset[] = [
  { id: 'cream', name: '카페 크림', desc: '따뜻한 기본 베이지', swatch: ['#FDFBF7', '#F4EFE6', '#C18C5D'] },
  { id: 'silver', name: '애플 실버', desc: '깔끔한 기본 라이트', swatch: ['#F5F5F7', '#FFFFFF', '#0071E3'] },
  { id: 'chic', name: '시크 블랙', desc: '각진 모서리 · 모노톤', swatch: ['#0A0A0B', '#17181B', '#C9CDD4'] },
  { id: 'bubble', name: '동글동글 파스텔', desc: '알약 버튼 · 말랑 말풍선', swatch: ['#FFF1F6', '#FFFFFF', '#FF8FB1'] },
  { id: 'puppy', name: '귀여운 강아지', desc: '크림톤 · 강아지 스케치', swatch: ['#FFFBF2', '#FFFFFF', '#B08968'] },
  { id: 'xmas', name: '크리스마스', desc: '딥그린 · 레드 포인트', swatch: ['#0B3B2E', '#12503E', '#E5484D'] },
  { id: 'winter', name: '겨울 감성', desc: '아이스 블루 · 눈결정', swatch: ['#F2F8FF', '#FFFFFF', '#4C8DFF'] },
  { id: 'lavender', name: '라벤더', desc: '부드러운 보라빛', swatch: ['#F7F4FF', '#EDE7FF', '#7C5CFF'] },
  { id: 'midnight', name: '미드나잇 블루', desc: '깊은 밤의 네이비', swatch: ['#0B132B', '#16213E', '#5B8DEF'] },
  { id: 'forest', name: '포레스트 그린', desc: '차분한 숲의 초록', swatch: ['#0C1A14', '#14291F', '#3FBF7F'] },
  { id: 'sunset', name: '선셋', desc: '따뜻한 코랄 오렌지', swatch: ['#FFF6F0', '#FFE7D8', '#F97316'] },
  { id: 'dark', name: '다크', desc: '눈이 편한 순수 다크', swatch: ['#0E0F12', '#181A1F', '#4F8CFF'] },
  { id: 'space', name: '우주 (코스모스)', desc: '별이 흐르는 밤하늘 · 유성우', swatch: ['#070B1A', '#101A33', '#8FA8FF'] },
  { id: 'aurora', name: '오로라', desc: '은은하게 일렁이는 오로라', swatch: ['#06121A', '#0D2029', '#67E8C3'] },
  { id: 'cat', name: '고양이', desc: '말랑한 크림톤 · 고양이 낙서', swatch: ['#FFF8F3', '#FFFFFF', '#D08A5A'] },
  { id: 'astro', name: '우주비행사', desc: '달과 별 · 맑은 하늘색', swatch: ['#F4F7FC', '#FFFFFF', '#5C7CFA'] },
  { id: 'city', name: '노을 도시', desc: '건물 사이로 지는 붉은 노을', swatch: ['#2B1B2E', '#3D2033', '#FF8A5B'] },
];

/** 테마별 기본 말풍선 색 (사용자가 직접 고른 색이 있으면 그 색이 우선) */
export const THEME_BUBBLE_DEFAULTS: Record<string, { mine: string; other: string }> = {
  cream: { mine: '#1A73E8', other: '#FFFFFF' },
  silver: { mine: '#0071E3', other: '#FFFFFF' },
  chic: { mine: '#2A2B2F', other: '#F2F2F3' },
  bubble: { mine: '#FFB6CD', other: '#FFFFFF' },
  puppy: { mine: '#B08968', other: '#FFF9EE' },
  xmas: { mine: '#C8353B', other: '#EAF6EF' },
  winter: { mine: '#4C8DFF', other: '#FFFFFF' },
  lavender: { mine: '#7C5CFF', other: '#FFFFFF' },
  midnight: { mine: '#3B6FE0', other: '#F0F4FF' },
  forest: { mine: '#1E7A50', other: '#F2FBF6' },
  sunset: { mine: '#F97316', other: '#FFF7F1' },
  dark: { mine: '#2F6FE4', other: '#22252C' },
  space: { mine: '#4F6BFF', other: '#16213F' },
  aurora: { mine: '#2FB79A', other: '#10303A' },
  cat: { mine: '#E2A075', other: '#FFFFFF' },
  astro: { mine: '#5C7CFA', other: '#FFFFFF' },
  city: { mine: '#F97362', other: '#FFF4EE' },
};

export const BUBBLE_PRESETS = [
  '#1A73E8', '#0071E3', '#0EA5E9', '#10B981', '#F59E0B', '#EF4444',
  '#8B5CF6', '#EC4899', '#FFB6CD', '#B08968', '#3E2723', '#111827',
  '#FFFFFF', '#F4EFE6', '#E0F2FE', '#DCFCE7', '#FEF3C7', '#FCE7F3',
];

const THEME_KEY = 'nexus_theme_v1';
const BUBBLE_KEY = 'nexus_bubble_colors_v1';
const BUBBLE_CUSTOM_KEY = 'nexus_bubble_custom_v1';
const FONT_KEY = 'nexus_font_v1';

export const getTheme = (): string => {
  try {
    const stored = scopedGet(THEME_KEY);
    if (stored) return stored;
  } catch {
    /* ignore */
  }
  return 'cream';
};

export const isBubbleCustomized = () => {
  try {
    return scopedGet(BUBBLE_CUSTOM_KEY) === '1';
  } catch {
    return false;
  }
};

const dispatchBubbleChange = () => window.dispatchEvent(new CustomEvent('nexus-bubble-colors'));

export const applyTheme = (themeId: string) => {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.theme = themeId;
  try {
    scopedSet(THEME_KEY, themeId);
    // 사용자가 말풍선 색을 직접 고르지 않았다면 테마 기본 말풍선 색을 따른다.
    if (!isBubbleCustomized()) {
      const defaults = THEME_BUBBLE_DEFAULTS[themeId];
      if (defaults) {
        scopedSet(BUBBLE_KEY, JSON.stringify(defaults));
        dispatchBubbleChange();
      }
    }
  } catch {
    /* ignore */
  }
  applyWallpaper(themeId);
  window.dispatchEvent(new CustomEvent('nexus-theme-changed', { detail: themeId }));
};

export const initTheme = () => {
  applyTheme(getTheme());
};

const parseColor = (color: string): [number, number, number] | null => {
  if (!color) return null;
  const value = color.trim();
  const hex = value.replace('#', '');
  if (/^[0-9a-f]{6}$/i.test(hex)) {
    return [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16)];
  }
  if (/^[0-9a-f]{3}$/i.test(hex)) {
    return [parseInt(hex[0] + hex[0], 16), parseInt(hex[1] + hex[1], 16), parseInt(hex[2] + hex[2], 16)];
  }
  const match = value.match(/rgba?\(([^)]+)\)/i);
  if (match) {
    const parts = match[1].split(',').map((p) => parseFloat(p));
    if (parts.length >= 3) return [parts[0], parts[1], parts[2]];
  }
  return null;
};

/** WCAG 상대 휘도 (0=검정, 1=흰색) */
export const relativeLuminance = (color: string): number | null => {
  const rgb = parseColor(color);
  if (!rgb) return null;
  const [r, g, b] = rgb.map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

/** 두 색의 WCAG 대비비 (1 ~ 21) */
export const contrastRatio = (a: string, b: string): number => {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  if (la === null || lb === null) return 0;
  const light = Math.max(la, lb);
  const dark = Math.min(la, lb);
  return (light + 0.05) / (dark + 0.05);
};

const INK = '#111827';
const PAPER = '#FFFFFF';

/**
 * 배경색 위에서 가장 선명하게 읽히는 글자색을 고른다.
 * 흰색과 잉크색 중 실제 대비비가 더 높은 쪽을 사용하므로,
 * 어떤 커스텀 말풍선 색을 골라도 글자가 묻히지 않는다.
 */
export const contrastText = (color: string): string => {
  const luminance = relativeLuminance(color);
  if (luminance === null) return PAPER;
  const withWhite = 1.05 / (luminance + 0.05);
  const withInk = (luminance + 0.05) / (relativeLuminance(INK)! + 0.05);
  return withWhite >= withInk ? PAPER : INK;
};

const mixWith = (color: string, target: [number, number, number], ratio: number): string => {
  const rgb = parseColor(color);
  if (!rgb) return `rgba(${target[0]}, ${target[1]}, ${target[2]}, ${ratio})`;
  const mixed = rgb.map((v, i) => Math.round(v * (1 - ratio) + target[i] * ratio));
  return `#${mixed.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
};

/**
 * 말풍선 테두리색: 말풍선 배경과 같은 색 테두리를 쓰면 배경에 묻히므로,
 * 밝은 색은 어둡게, 어두운 색은 밝게 섞어 항상 윤곽이 보이게 한다.
 */
export const bubbleBorderColor = (color: string): string => {
  const luminance = relativeLuminance(color);
  if (luminance === null) return 'rgba(0, 0, 0, 0.18)';
  return luminance > 0.35 ? mixWith(color, [0, 0, 0], 0.24) : mixWith(color, [255, 255, 255], 0.34);
};

/* ============================================================
   글씨체(폰트) 팩 — 한글을 지원하는 Google Fonts 12종
   ============================================================ */
export interface FontPreset {
  id: string;
  name: string;
  desc: string;
  /** 글씨체 버튼 자체에 미리보기로 쓸 짧은 문구 */
  sample: string;
  stack: string;
}

const notoFallback = "'Noto Sans KR', 'Apple SD Gothic Neo', 'Malgun Gothic', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

export const FONT_PRESETS: FontPreset[] = [
  { id: 'noto', name: '노토 산스', desc: '기본 고딕', sample: '가나다 Aa', stack: notoFallback },
  { id: 'plex', name: 'IBM 플렉스', desc: '단정한 사무용', sample: '가나다 Aa', stack: `'IBM Plex Sans KR', ${notoFallback}` },
  { id: 'nanum', name: '나눔 고딕', desc: '익숙한 고딕', sample: '가나다 Aa', stack: `'Nanum Gothic', ${notoFallback}` },
  { id: 'gowun-dodum', name: '고운돋움', desc: '부드러운 손글씨', sample: '가나다 Aa', stack: `'Gowun Dodum', ${notoFallback}` },
  { id: 'jua', name: '주아', desc: '둥글 귀여움', sample: '가나다 Aa', stack: `'Jua', ${notoFallback}` },
  { id: 'dongle', name: '동글', desc: '말랑 동글동글', sample: '가나다 Aa', stack: `'Dongle', ${notoFallback}` },
  { id: 'gaegu', name: '개구', desc: '연필 손글씨', sample: '가나다 Aa', stack: `'Gaegu', ${notoFallback}` },
  { id: 'dohyeon', name: '도현', desc: '힘찬 제목체', sample: '가나다 Aa', stack: `'Do Hyeon', ${notoFallback}` },
  { id: 'sunflower', name: '해바라기', desc: '산뜻한 라운드', sample: '가나다 Aa', stack: `'Sunflower', ${notoFallback}` },
  { id: 'noto-serif', name: '노토 명조', desc: '감성 명조', sample: '가나다 Aa', stack: `'Noto Serif KR', 'Nanum Myeongjo', serif` },
  { id: 'gowun-batang', name: '고운바탕', desc: '차분한 바탕체', sample: '가나다 Aa', stack: `'Gowun Batang', 'Noto Serif KR', serif` },
  { id: 'nanum-myeongjo', name: '나눔 명조', desc: '클래식 명조', sample: '가나다 Aa', stack: `'Nanum Myeongjo', 'Noto Serif KR', serif` },
];

export const getFont = (): string => {
  try {
    const stored = scopedGet(FONT_KEY);
    if (stored && FONT_PRESETS.some((f) => f.id === stored)) return stored;
  } catch {
    /* ignore */
  }
  return FONT_PRESETS[0].id;
};

export const applyFont = (fontId: string) => {
  if (typeof document === 'undefined') return;
  const preset = FONT_PRESETS.find((f) => f.id === fontId) || FONT_PRESETS[0];
  const root = document.documentElement;
  root.dataset.font = preset.id;
  root.style.setProperty('--nx-font-sans', preset.stack);
  // Tailwind 의 font-sans 유틸리티도 같은 글씨체를 쓰게 한다.
  root.style.setProperty('--font-sans', preset.stack);
  try {
    scopedSet(FONT_KEY, preset.id);
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new CustomEvent('nexus-font-changed', { detail: preset.id }));
};

export const initFont = () => applyFont(getFont());

/* 눈 내리는 효과 on/off (겨울 감성 · 크리스마스 테마에서 표시) */
const SNOW_KEY = 'nexus_snow_v1';

export const isSnowEnabled = (): boolean => {
  try {
    return scopedGet(SNOW_KEY) !== '0';
  } catch {
    return true;
  }
};

export const setSnowEnabled = (on: boolean) => {
  try {
    scopedSet(SNOW_KEY, on ? '1' : '0');
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new CustomEvent('nexus-snow-changed'));
};

export const markBubbleCustomized = (custom: boolean) => {
  try {
    if (custom) scopedSet(BUBBLE_CUSTOM_KEY, '1');
    else scopedRemove(BUBBLE_CUSTOM_KEY);
  } catch {
    /* ignore */
  }
};

/* ============================================================
   테마별 배경화면 (public/wallpapers · 앱에 직접 제작해 번들)
   - 이모티콘이 아니라 감성 배경 일러스트입니다.
   - 말풍선 가독성을 위해 배경 위에 테마 배경색을 덮는 정도(dim)를 조절할 수 있습니다.
   ============================================================ */
export interface ThemeWallpaper {
  /** public/wallpapers/<id>.jpg */
  id: string;
  name: string;
  /** 기본 덮개 농도 (0 = 배경 그대로, 1 = 완전히 가림) */
  dim: number;
  /** 밝은 배경인지 (말풍선 대비 계산용) */
  light: boolean;
}

/** 배경화면 라이브러리 (앱에 직접 제작해 넣은 원본 일러스트 16종) */
export const WALLPAPER_LIBRARY: ThemeWallpaper[] = [
  { id: 'cream', name: '카페 크림', dim: 0.62, light: true },
  { id: 'silver', name: '애플 실버', dim: 0.72, light: true },
  { id: 'chic', name: '시크 블랙', dim: 0.62, light: false },
  { id: 'pastel', name: '동글 파스텔', dim: 0.5, light: true },
  { id: 'puppy', name: '강아지', dim: 0.42, light: true },
  { id: 'cat', name: '고양이', dim: 0.4, light: true },
  { id: 'xmas', name: '크리스마스', dim: 0.58, light: false },
  { id: 'winter', name: '겨울', dim: 0.55, light: true },
  { id: 'lavender', name: '라벤더', dim: 0.55, light: true },
  { id: 'midnight', name: '미드나잇', dim: 0.55, light: false },
  { id: 'forest', name: '포레스트', dim: 0.6, light: false },
  { id: 'sunset', name: '선셋', dim: 0.5, light: true },
  { id: 'sunset-city', name: '노을 도시', dim: 0.42, light: false },
  { id: 'space', name: '우주', dim: 0.5, light: false },
  { id: 'aurora', name: '오로라', dim: 0.45, light: false },
  { id: 'astro', name: '우주비행사', dim: 0.46, light: true },
];

/** 테마별 기본 배경화면 */
export const THEME_WALLPAPERS: Record<string, ThemeWallpaper> = {
  cream: { id: 'cream', name: '카페 크림', dim: 0.62, light: true },
  silver: { id: 'silver', name: '애플 실버', dim: 0.72, light: true },
  chic: { id: 'chic', name: '시크 블랙', dim: 0.62, light: false },
  dark: { id: 'chic', name: '다크', dim: 0.52, light: false },
  bubble: { id: 'pastel', name: '동글 파스텔', dim: 0.5, light: true },
  puppy: { id: 'puppy', name: '강아지', dim: 0.42, light: true },
  cat: { id: 'cat', name: '고양이', dim: 0.4, light: true },
  xmas: { id: 'xmas', name: '크리스마스', dim: 0.58, light: false },
  winter: { id: 'winter', name: '겨울', dim: 0.55, light: true },
  lavender: { id: 'lavender', name: '라벤더', dim: 0.55, light: true },
  midnight: { id: 'midnight', name: '미드나잇', dim: 0.55, light: false },
  forest: { id: 'forest', name: '포레스트', dim: 0.6, light: false },
  sunset: { id: 'sunset', name: '선셋', dim: 0.5, light: true },
  city: { id: 'sunset-city', name: '노을 도시', dim: 0.42, light: false },
  space: { id: 'space', name: '우주', dim: 0.5, light: false },
  aurora: { id: 'aurora', name: '오로라', dim: 0.45, light: false },
  astro: { id: 'astro', name: '우주비행사', dim: 0.46, light: true },
};

const WALLPAPER_ID_KEY = 'nexus_wallpaper_id_v1';

const WALLPAPER_DIM_KEY = 'nexus_wallpaper_dim_v1';
const WALLPAPER_BLUR_KEY = 'nexus_wallpaper_blur_v1';

const wallpaperBase = (): string => {
  if (typeof document === 'undefined') return '/';
  try {
    return new URL('.', document.baseURI).href;
  } catch {
    return '/';
  }
};

export const wallpaperUrl = (id: string, thumb = false): string =>
  `${wallpaperBase()}wallpapers/${id}${thumb ? '-thumb' : ''}.jpg`;

/** 사용자가 직접 고른 배경화면 id (계정별) */
export const getChosenWallpaperId = (): string | null => scopedGet(WALLPAPER_ID_KEY) || null;

export const setChosenWallpaper = (wallpaperId: string | null) => {
  if (wallpaperId) scopedSet(WALLPAPER_ID_KEY, wallpaperId);
  else scopedRemove(WALLPAPER_ID_KEY);
  applyWallpaper();
  window.dispatchEvent(new CustomEvent('nexus-theme-changed', { detail: getTheme() }));
};

export const getThemeWallpaper = (themeId?: string): ThemeWallpaper => {
  const chosen = getChosenWallpaperId();
  if (chosen) {
    const found = WALLPAPER_LIBRARY.find((item) => item.id === chosen);
    if (found) return found;
  }
  return THEME_WALLPAPERS[themeId || getTheme()] || THEME_WALLPAPERS.cream;
};

export const getThemeWallpaperId = (themeId?: string): string => getThemeWallpaper(themeId).id;

/** 사용자가 조절한 덮개 농도 (0~1). 없으면 테마 기본값 */
export const getWallpaperDim = (): number => {
  const raw = scopedGet(WALLPAPER_DIM_KEY);
  if (raw === null) return getThemeWallpaper().dim;
  const value = Number(raw);
  return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : getThemeWallpaper().dim;
};

export const setWallpaperDim = (value: number) => {
  const clamped = Math.min(1, Math.max(0, value));
  scopedSet(WALLPAPER_DIM_KEY, String(clamped));
  applyWallpaper();
};

export const isWallpaperBlurred = (): boolean => scopedGet(WALLPAPER_BLUR_KEY) === '1';

export const setWallpaperBlurred = (on: boolean) => {
  if (on) scopedSet(WALLPAPER_BLUR_KEY, '1');
  else scopedRemove(WALLPAPER_BLUR_KEY);
  applyWallpaper();
};

/** 현재 테마의 배경화면을 CSS 변수로 적용합니다. */
export const applyWallpaper = (themeId?: string) => {
  if (typeof document === 'undefined') return;
  const wallpaper = getThemeWallpaper(themeId);
  const root = document.documentElement;
  root.style.setProperty('--nx-wallpaper', `url("${wallpaperUrl(wallpaper.id)}")`);
  root.style.setProperty('--nx-wallpaper-dim', `${Math.round(getWallpaperDim() * 100)}%`);
  root.style.setProperty('--nx-wallpaper-blur', isWallpaperBlurred() ? '7px' : '0px');
};

/* ============================================================
   테마별 버튼 스타일 토큰 (index.css 와 같은 값을 화면에서도 보여줄 때 사용)
   ============================================================ */
export interface ThemeButtonStyle {
  radius: string;
  radiusLabel: string;
  texture: 'paper' | 'flat' | 'soft' | 'glass' | 'cozy';
  description: string;
}

export const THEME_BUTTON_STYLE: Record<string, ThemeButtonStyle> = {
  cream: { radius: '0.75rem', radiusLabel: '12px · 둥근 사각', texture: 'paper', description: '종이 질감 + 옅은 보더' },
  silver: { radius: '0.75rem', radiusLabel: '12px · 둥근 사각', texture: 'flat', description: '무광 알루미늄 그레이' },
  chic: { radius: '0.3rem', radiusLabel: '5px · 샤프한 각', texture: 'flat', description: '각진 모서리 + 1px 절제된 보더' },
  dark: { radius: '0.375rem', radiusLabel: '6px · 각진 편', texture: 'flat', description: '눈이 편한 무광 다크' },
  bubble: { radius: '9999px', radiusLabel: '알약형 · 완전 둥글게', texture: 'soft', description: '말랑 그림자 + 핑크 보더' },
  puppy: { radius: '1.125rem', radiusLabel: '18px · 폭신 라운드', texture: 'soft', description: '크림 보더 + 푹신한 그림자' },
  cat: { radius: '1.125rem', radiusLabel: '18px · 폭신 라운드', texture: 'soft', description: '살구빛 보더 + 말랑 그림자' },
  xmas: { radius: '1rem', radiusLabel: '16px · 포근 라운드', texture: 'cozy', description: '레드 포인트 테두리 + 초록 그림자' },
  winter: { radius: '1rem', radiusLabel: '16px · 포근 라운드', texture: 'cozy', description: '아이스 블루 보더 + 서리 질감' },
  lavender: { radius: '1rem', radiusLabel: '16px · 부드러운 라운드', texture: 'soft', description: '보라빛 그림자' },
  midnight: { radius: '0.875rem', radiusLabel: '14px · 라운드', texture: 'glass', description: '네이비 글래스 + 달빛 보더' },
  forest: { radius: '0.875rem', radiusLabel: '14px · 라운드', texture: 'soft', description: '초록 그림자 + 잎빛 보더' },
  sunset: { radius: '1rem', radiusLabel: '16px · 부드러운 라운드', texture: 'soft', description: '코랄 그림자' },
  space: { radius: '0.875rem', radiusLabel: '14px · 글래스', texture: 'glass', description: '반투명 글래스 + 별빛 네온 보더' },
  aurora: { radius: '0.875rem', radiusLabel: '14px · 글래스', texture: 'glass', description: '오로라 글래스 + 민트 글로우' },
  astro: { radius: '0.875rem', radiusLabel: '14px · 글래스', texture: 'glass', description: '반투명 글래스 + 스타 글로우' },
  city: { radius: '0.9rem', radiusLabel: '14px · 글래스', texture: 'glass', description: '노을빛 글래스 + 코랄 글로우' },
};

export const getThemeButtonStyle = (themeId?: string): ThemeButtonStyle =>
  THEME_BUTTON_STYLE[themeId || getTheme()] || THEME_BUTTON_STYLE.cream;

export const THEME_PATTERNS = {
  puppy: PUPPY_PATTERN,
  xmas: XMAS_PATTERN,
  winter: SNOW_PATTERN,
  bubble: BUBBLE_PATTERN,
};
