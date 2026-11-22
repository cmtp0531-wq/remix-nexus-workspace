import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Check,
  Copy,
  Download,
  Layers,
  Lock,
  Unlock,
  Maximize2,
  Minimize2,
  Play,
  Plus,
  Printer,
  Redo,
  Save,
  Trash2,
  Type,
  Undo,
  Upload,
  X,
  Image as ImageIcon,
  Palette,
  Shapes,
  Layout,
  Square,
  Circle,
  Star,
  ArrowRight,
  Minus,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Bold,
  Italic,
  Underline,
  MoveUp,
  MoveDown,
  BringToFront,
  SendToBack,
  ChevronUp,
  Sparkles,
  Presentation,
  Timer,
  RotateCw,
  StickyNote,
  Sliders,
  GripVertical,
} from 'lucide-react';
import { fetchRealDocContent, saveRealDocContent } from '../services/googleWorkspace';

// ============================================================
// TYPES
// ============================================================
export type SlideElementType =
  | 'text'
  | 'rect'
  | 'roundRect'
  | 'circle'
  | 'triangle'
  | 'star'
  | 'arrow'
  | 'line'
  | 'badge'
  | 'image';

export interface SlideElement {
  id: string;
  type: SlideElementType;
  x: number;
  y: number;
  w: number;
  h: number;
  rotation: number;
  opacity: number;
  locked?: boolean;
  text?: string;
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: number;
  italic?: boolean;
  underline?: boolean;
  color?: string;
  align?: 'left' | 'center' | 'right';
  lineHeight?: number;
  letterSpacing?: number;
  highlight?: string;
  verticalAlign?: 'top' | 'middle' | 'bottom';
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  radius?: number;
  shadow?: boolean;
  imageUrl?: string;
}

export interface SlideBackground {
  type: 'solid' | 'gradient' | 'image';
  color?: string;
  gradient?: string;
  imageUrl?: string;
}

export interface Slide {
  id: string;
  name?: string;
  background: SlideBackground;
  elements: SlideElement[];
  notes: string;
  transition: 'none' | 'fade' | 'slide';
}

interface SlideEditorProps {
  fileId: string;
  fileName: string;
  fileType: string;
  currentUser?: unknown;
  initialContent?: string;
  onSave: (fileId: string, content: string, title?: string) => void;
  onClose?: () => void;
  onShareToChat?: (content: string) => void;
}

// ============================================================
// CONSTANTS
// ============================================================
export const SLIDE_W = 1280;
export const SLIDE_H = 720;

const FONT_OPTIONS = [
  { value: "'Pretendard', 'Noto Sans KR', sans-serif", label: '프리텐다드 (모던)' },
  { value: "'Noto Sans KR', sans-serif", label: '노토 산스 (기본)' },
  { value: "'Nanum Myeongjo', serif", label: '나눔명조 (세리프)' },
  { value: "'Black Han Sans', sans-serif", label: '검은고딕 (임팩트)' },
  { value: "'D2Coding', monospace", label: 'D2코딩 (모노)' },
];

interface PaletteDef {
  id: string;
  name: string;
  bg: string;
  surface: string;
  accent: string;
  text: string;
  muted: string;
}

const PALETTES: PaletteDef[] = [
  { id: 'sand', name: '샌드 베이지', bg: '#FAF7F2', surface: '#FFFFFF', accent: '#C18C5D', text: '#2C2520', muted: '#8B7A69' },
  { id: 'ocean', name: '오션 블루', bg: '#0B1F33', surface: '#12314F', accent: '#38BDF8', text: '#EAF4FF', muted: '#9DB8CE' },
  { id: 'forest', name: '딥 포레스트', bg: '#08211A', surface: '#123D2C', accent: '#4ADE80', text: '#EAFBF1', muted: '#93B8A4' },
  { id: 'sunset', name: '선셋 코랄', bg: '#FFF4EC', surface: '#FFE3D3', accent: '#F97316', text: '#3B1D0F', muted: '#9A6B4F' },
  { id: 'violet', name: '라벤더', bg: '#F5F1FF', surface: '#E9E1FF', accent: '#7C3AED', text: '#241B3B', muted: '#7A6C93' },
  { id: 'mono', name: '모노 블랙', bg: '#111827', surface: '#1F2937', accent: '#FACC15', text: '#F9FAFB', muted: '#9CA3AF' },
];

const GRADIENTS = [
  { id: 'dawn', value: 'linear-gradient(135deg, #FAF7F2 0%, #EFE3D2 100%)' },
  { id: 'midnight', value: 'linear-gradient(135deg, #1E293B 0%, #0F172A 100%)' },
  { id: 'lagoon', value: 'linear-gradient(135deg, #0EA5E9 0%, #0369A1 100%)' },
  { id: 'peach', value: 'linear-gradient(135deg, #FDE68A 0%, #FB7185 100%)' },
  { id: 'aurora', value: 'linear-gradient(135deg, #4ADE80 0%, #2563EB 100%)' },
  { id: 'plum', value: 'linear-gradient(135deg, #9333EA 0%, #4C1D95 100%)' },
];

const sampleImage = (label: string, hue: number): string => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 360"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="hsl(${hue}, 34%, 92%)"/><stop offset="100%" stop-color="hsl(${hue + 28}, 32%, 66%)"/></linearGradient></defs><rect width="640" height="360" fill="url(#g)"/><circle cx="520" cy="90" r="46" fill="hsl(${hue}, 40%, 86%)" opacity="0.8"/><path d="M0 300 L180 190 L320 280 L470 170 L640 300 L640 360 L0 360 Z" fill="hsl(${hue + 12}, 30%, 74%)" opacity="0.85"/><text x="36" y="340" font-family="sans-serif" font-size="22" fill="#3E3229" opacity="0.8">${label}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
};

const SAMPLE_IMAGES = [
  { label: '도시 야경', url: sampleImage('CITY', 220) },
  { label: '자연', url: sampleImage('NATURE', 120) },
  { label: '오피스', url: sampleImage('OFFICE', 32) },
  { label: '추상', url: sampleImage('ABSTRACT', 280) },
];

let idCounter = 0;
const uid = (prefix = 'el') => `${prefix}_${Date.now().toString(36)}_${(idCounter++).toString(36)}`;

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));

// ============================================================
// LEGACY (고정 레이아웃) 슬라이드 마이그레이션
// ============================================================
interface LegacySlide {
  id?: string;
  layout?: string;
  title?: string;
  subtitle?: string;
  bullets?: string[];
  col1Text?: string;
  col2Text?: string;
  metricNumber?: string;
  metricLabel?: string;
  quoteAuthor?: string;
  imageUrl?: string;
  bgTheme?: string;
  notes?: string;
  elements?: SlideElement[];
  background?: SlideBackground;
  transition?: 'none' | 'fade' | 'slide';
  name?: string;
}

const themeToBackground = (theme?: string): SlideBackground => {
  switch (theme) {
    case 'dark':
      return { type: 'gradient', gradient: 'linear-gradient(135deg, #1E293B 0%, #0F172A 100%)' };
    case 'blue':
      return { type: 'gradient', gradient: 'linear-gradient(135deg, #1A73E8 0%, #1557B0 100%)' };
    case 'emerald':
      return { type: 'gradient', gradient: 'linear-gradient(135deg, #064E3B 0%, #022C22 100%)' };
    case 'sunset':
      return { type: 'gradient', gradient: 'linear-gradient(135deg, #9A3412 0%, #431407 100%)' };
    case 'white':
      return { type: 'solid', color: '#FFFFFF' };
    default:
      return { type: 'gradient', gradient: 'linear-gradient(135deg, #FAF7F2 0%, #EFE8DC 100%)' };
  }
};

const themeTextColor = (theme?: string) =>
  ['dark', 'blue', 'emerald', 'sunset'].includes(theme || '') ? '#FFFFFF' : '#2C2520';

const migrateLegacySlide = (legacy: LegacySlide): Slide => {
  const accent =
    legacy.bgTheme === 'blue' ? '#F4B450' : legacy.bgTheme === 'emerald' ? '#34D399' : legacy.bgTheme === 'sunset' ? '#FB923C' : '#C18C5D';
  const color = themeTextColor(legacy.bgTheme);
  const base = (over: Partial<SlideElement>): SlideElement => ({
    id: uid(),
    type: 'text',
    x: 96,
    y: 96,
    w: 600,
    h: 80,
    rotation: 0,
    opacity: 1,
    fontFamily: "'Pretendard', 'Noto Sans KR', sans-serif",
    fontSize: 28,
    fontWeight: 400,
    color,
    align: 'left',
    lineHeight: 1.35,
    ...over,
  });
  const elements: SlideElement[] = [];

  elements.push(
    base({
      text: legacy.title || '제목 없는 슬라이드',
      x: 96,
      y: 120,
      w: 1088,
      h: 140,
      fontSize: legacy.layout === 'title' ? 68 : 52,
      fontWeight: 800,
      lineHeight: 1.15,
    })
  );
  if (legacy.subtitle) {
    elements.push(
      base({
        text: legacy.subtitle,
        x: 96,
        y: 270,
        w: 980,
        h: 70,
        fontSize: 26,
        color: legacy.bgTheme && themeTextColor(legacy.bgTheme) === '#FFFFFF' ? 'rgba(255,255,255,0.82)' : '#6B5B4E',
      })
    );
  }
  if (legacy.layout === 'metric' && legacy.metricNumber) {
    elements.push(base({ text: legacy.metricNumber, x: 96, y: 330, w: 700, h: 190, fontSize: 130, fontWeight: 800, color: accent }));
    elements.push(base({ text: legacy.metricLabel || '', x: 96, y: 530, w: 800, h: 60, fontSize: 24 }));
  } else if (legacy.layout === 'two-column') {
    elements.push(base({ text: legacy.col1Text || '', x: 96, y: 360, w: 500, h: 260, fontSize: 20, lineHeight: 1.7 }));
    elements.push(base({ text: legacy.col2Text || '', x: 660, y: 360, w: 500, h: 260, fontSize: 20, lineHeight: 1.7 }));
  } else if (legacy.layout === 'quote') {
    elements.push(base({ text: `“${legacy.title || ''}”`, x: 140, y: 250, w: 1000, h: 200, fontSize: 52, fontWeight: 700, align: 'center' }));
    elements.push(base({ text: legacy.quoteAuthor || legacy.subtitle || '', x: 140, y: 470, w: 1000, h: 60, fontSize: 22, align: 'center', color: accent }));
  } else if (legacy.layout === 'showcase' && legacy.imageUrl) {
    elements.push({
      ...base({}),
      type: 'image',
      x: 660,
      y: 300,
      w: 520,
      h: 300,
      imageUrl: legacy.imageUrl,
      radius: 20,
    });
    elements.push(base({ text: (legacy.bullets || []).join('\n'), x: 96, y: 350, w: 520, h: 250, fontSize: 20, lineHeight: 1.8 }));
  } else if (legacy.bullets && legacy.bullets.length > 0) {
    elements.push(
      base({
        text: legacy.bullets.map((b) => `•  ${b}`).join('\n'),
        x: 96,
        y: 360,
        w: 1000,
        h: 260,
        fontSize: 24,
        lineHeight: 1.9,
      })
    );
  } else if (legacy.imageUrl) {
    elements.push({ ...base({}), type: 'image', x: 700, y: 340, w: 480, h: 280, imageUrl: legacy.imageUrl, radius: 18 });
  }

  return {
    id: legacy.id || uid('slide'),
    name: legacy.title,
    background: themeToBackground(legacy.bgTheme),
    elements,
    notes: legacy.notes || '',
    transition: legacy.transition || 'fade',
  };
};

const parseSlides = (raw?: string): Slide[] => {
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      const list: LegacySlide[] = Array.isArray(parsed) ? parsed : parsed?.slides;
      if (Array.isArray(list) && list.length > 0) {
        return list.map((item) =>
          item.background && Array.isArray(item.elements)
            ? {
                id: item.id || uid('slide'),
                name: item.name,
                background: item.background,
                elements: (item.elements || []).map((el) => ({
                  ...el,
                  rotation: el.rotation ?? 0,
                  opacity: el.opacity ?? 1,
                })),
                notes: item.notes || '',
                transition: item.transition || 'fade',
              }
            : migrateLegacySlide(item)
        );
      }
    } catch {
      /* 비어 있는 슬라이드로 시작 */
    }
  }
  return [blankSlide(0)];
};

// ============================================================
// 기본 슬라이드 / 템플릿
// ============================================================
const textEl = (over: Partial<SlideElement>): SlideElement => ({
  id: uid(),
  type: 'text',
  x: 0,
  y: 0,
  w: 400,
  h: 80,
  rotation: 0,
  opacity: 1,
  text: '',
  fontFamily: "'Pretendard', 'Noto Sans KR', sans-serif",
  fontSize: 28,
  fontWeight: 400,
  color: '#2C2520',
  align: 'left',
  lineHeight: 1.35,
  verticalAlign: 'top',
  ...over,
});

const shapeEl = (type: SlideElementType, over: Partial<SlideElement>): SlideElement => ({
  id: uid(),
  type,
  x: 0,
  y: 0,
  w: 200,
  h: 120,
  rotation: 0,
  opacity: 1,
  fill: '#C18C5D',
  stroke: 'transparent',
  strokeWidth: 0,
  radius: type === 'roundRect' ? 24 : 0,
  shadow: false,
  ...over,
});

function blankSlide(index: number): Slide {
  return {
    id: uid('slide'),
    background: { type: 'gradient', gradient: 'linear-gradient(135deg, #FAF7F2 0%, #EFE8DC 100%)' },
    elements: [],
    notes: '',
    transition: 'fade',
    name: `${index + 1}번 슬라이드`,
  };
}

type TemplateId = 'pitch' | 'kpi' | 'compare' | 'timeline' | 'showcase' | 'quote' | 'checklist' | 'process';

const TEMPLATE_META: { id: TemplateId; name: string; desc: string }[] = [
  { id: 'pitch', name: '피치덱 표지', desc: '임팩트 있는 타이틀' },
  { id: 'kpi', name: 'KPI 성과', desc: '숫자 강조 대시보드' },
  { id: 'compare', name: '2열 비교', desc: 'Before / After' },
  { id: 'timeline', name: '타임라인', desc: '4단계 로드맵' },
  { id: 'showcase', name: '이미지 쇼케이스', desc: '사진 중심 레이아웃' },
  { id: 'quote', name: '인용구', desc: '한 문장 메시지' },
  { id: 'checklist', name: '체크리스트', desc: '핵심 항목 정리' },
  { id: 'process', name: '3단계 프로세스', desc: '절차 설명' },
];

const buildTemplate = (id: TemplateId, palette: PaletteDef, index = 0): Slide => {
  const p = palette;
  const baseBackground: SlideBackground = { type: 'solid', color: p.bg };
  let elements: SlideElement[] = [];

  if (id === 'pitch') {
    elements = [
      shapeEl('badge', { x: 96, y: 96, w: 300, h: 46, fill: p.accent, text: '2026  PITCH  DECK', color: p.bg, fontSize: 15, fontWeight: 700 }),
      textEl({ x: 96, y: 180, w: 1000, h: 190, text: '차세대 비즈니스\n로드맵', fontSize: 84, fontWeight: 800, color: p.text, lineHeight: 1.08 }),
      textEl({ x: 96, y: 400, w: 820, h: 90, text: '구글 워크스페이스 · AI 자동화 기반 업무 혁신 전략', fontSize: 26, color: p.muted }),
      shapeEl('rect', { x: 96, y: 520, w: 140, h: 8, fill: p.accent, radius: 999 }),
      textEl({ x: 96, y: 560, w: 700, h: 60, text: '2026. 11.  ·  Product Team', fontSize: 20, color: p.muted }),
      shapeEl('circle', { x: 980, y: 150, w: 210, h: 210, fill: p.accent, opacity: 0.18 }),
    ];
  } else if (id === 'kpi') {
    elements = [
      textEl({ x: 96, y: 84, w: 800, h: 50, text: '2026년 4분기 핵심 성과', fontSize: 24, color: p.muted, letterSpacing: 1 }),
      textEl({ x: 96, y: 140, w: 900, h: 90, text: '목표를 140% 초과 달성했습니다', fontSize: 46, fontWeight: 800, color: p.text }),
      textEl({ x: 96, y: 270, w: 700, h: 200, text: '99.4%', fontSize: 150, fontWeight: 800, color: p.accent }),
      textEl({ x: 96, y: 470, w: 640, h: 50, text: '고객 만족도 및 프로젝트 완수율', fontSize: 22, color: p.muted }),
      shapeEl('roundRect', { x: 760, y: 140, w: 200, h: 130, fill: p.surface, radius: 22, shadow: true }),
      textEl({ x: 790, y: 165, w: 160, h: 40, text: '전분기 대비', fontSize: 16, color: p.muted }),
      textEl({ x: 790, y: 200, w: 160, h: 60, text: '+32%', fontSize: 40, fontWeight: 800, color: p.text }),
      shapeEl('roundRect', { x: 985, y: 140, w: 200, h: 130, fill: p.surface, radius: 22, shadow: true }),
      textEl({ x: 1015, y: 165, w: 160, h: 40, text: '신규 고객', fontSize: 16, color: p.muted }),
      textEl({ x: 1015, y: 200, w: 160, h: 60, text: '1,284', fontSize: 40, fontWeight: 800, color: p.text }),
      shapeEl('roundRect', { x: 760, y: 300, w: 425, h: 210, fill: p.accent, radius: 24, opacity: 0.9 }),
      textEl({ x: 790, y: 330, w: 360, h: 40, text: 'NPS', fontSize: 18, color: p.bg }),
      textEl({ x: 790, y: 370, w: 360, h: 110, text: '78', fontSize: 92, fontWeight: 800, color: p.bg }),
    ];
  } else if (id === 'compare') {
    elements = [
      textEl({ x: 96, y: 72, w: 1000, h: 70, text: '도입 전후 업무 프로세스 비교', fontSize: 44, fontWeight: 800, color: p.text }),
      shapeEl('roundRect', { x: 96, y: 180, w: 520, h: 430, fill: p.surface, radius: 26, shadow: true }),
      textEl({ x: 136, y: 210, w: 420, h: 46, text: 'BEFORE', fontSize: 18, letterSpacing: 2, color: p.muted }),
      textEl({ x: 136, y: 260, w: 420, h: 60, text: '파편화된 수동 업무', fontSize: 32, fontWeight: 700, color: p.text }),
      textEl({
        x: 136,
        y: 340,
        w: 440,
        h: 240,
        text: '• 이메일 · 메신저 분산\n• 수동 파일 버전 관리\n• 응답 지연 평균 4.5시간\n• 반복 작업 비중 62%',
        fontSize: 20,
        lineHeight: 2,
        color: p.text,
      }),
      shapeEl('roundRect', { x: 664, y: 180, w: 520, h: 430, fill: p.accent, radius: 26, shadow: true }),
      textEl({ x: 704, y: 210, w: 420, h: 46, text: 'AFTER', fontSize: 18, letterSpacing: 2, color: p.bg }),
      textEl({ x: 704, y: 260, w: 420, h: 60, text: '올인원 자동화', fontSize: 32, fontWeight: 700, color: p.bg }),
      textEl({
        x: 704,
        y: 340,
        w: 440,
        h: 240,
        text: '• 실시간 통합 협업\n• 드라이브 자동 동기화\n• 즉각 알림 · 자동 저장\n• 업무 처리 속도 80% 단축',
        fontSize: 20,
        lineHeight: 2,
        color: p.bg,
      }),
    ];
  } else if (id === 'timeline') {
    elements = [
      textEl({ x: 96, y: 80, w: 900, h: 70, text: '2026 로드맵', fontSize: 46, fontWeight: 800, color: p.text }),
      textEl({ x: 96, y: 148, w: 800, h: 44, text: '분기별 핵심 마일스톤', fontSize: 20, color: p.muted }),
      shapeEl('rect', { x: 120, y: 360, w: 1040, h: 4, fill: p.muted, opacity: 0.45 }),
    ];
    ['Q1', 'Q2', 'Q3', 'Q4'].forEach((q, i) => {
      const x = 150 + i * 270;
      elements.push(shapeEl('circle', { x, y: 340, w: 44, h: 44, fill: i === 0 ? p.accent : p.surface, stroke: p.accent, strokeWidth: 3 }));
      elements.push(textEl({ x, y: 390, w: 220, h: 40, text: q, fontSize: 24, fontWeight: 800, color: p.accent }));
      elements.push(
        textEl({
          x,
          y: 430,
          w: 220,
          h: 110,
          text: ['리서치 · 문제 정의', '프로토타입 공개', '정식 런칭', '글로벌 확장'][i],
          fontSize: 19,
          lineHeight: 1.6,
          color: p.text,
        })
      );
    });
  } else if (id === 'showcase') {
    elements = [
      textEl({ x: 96, y: 110, w: 520, h: 160, text: '공간이\n브랜드가 됩니다', fontSize: 58, fontWeight: 800, color: p.text, lineHeight: 1.15 }),
      textEl({ x: 96, y: 300, w: 500, h: 90, text: '현장의 분위기를 그대로 담아낸 이미지 중심 레이아웃', fontSize: 21, color: p.muted }),
      {
        id: uid(),
        type: 'image',
        x: 660,
        y: 90,
        w: 520,
        h: 540,
        rotation: 0,
        opacity: 1,
        imageUrl: SAMPLE_IMAGES[0].url,
        radius: 26,
        shadow: true,
      },
      textEl({ x: 96, y: 560, w: 400, h: 40, text: 'STUDIO NEXUS', fontSize: 16, letterSpacing: 3, color: p.accent }),
    ];
  } else if (id === 'quote') {
    elements = [
      textEl({ x: 96, y: 90, w: 160, h: 160, text: '“', fontSize: 170, fontWeight: 800, color: p.accent, lineHeight: 1 }),
      textEl({
        x: 160,
        y: 230,
        w: 960,
        h: 230,
        text: '우리가 만드는 것은 화면이 아니라\n사람이 매일 쓰고 싶은 경험입니다.',
        fontSize: 50,
        fontWeight: 700,
        align: 'center',
        color: p.text,
        lineHeight: 1.45,
      }),
      textEl({ x: 160, y: 500, w: 960, h: 50, text: '— Product Team, Nexus', fontSize: 22, align: 'center', color: p.muted }),
    ];
  } else if (id === 'checklist') {
    elements = [
      textEl({ x: 96, y: 80, w: 900, h: 70, text: '이번 주 반드시 끝낼 것', fontSize: 44, fontWeight: 800, color: p.text }),
      textEl({ x: 96, y: 150, w: 800, h: 40, text: '우선순위가 높은 항목부터 정리했습니다', fontSize: 19, color: p.muted }),
    ];
    ['디자인 시안 확정', 'API 연동 테스트', '사용자 인터뷰 5건', '런칭 공지 작성'].forEach((item, i) => {
      const y = 230 + i * 100;
      elements.push(shapeEl('roundRect', { x: 96, y, w: 1088, h: 78, fill: p.surface, radius: 18, shadow: i === 0 }));
      elements.push(shapeEl('circle', { x: 120, y: y + 19, w: 40, h: 40, fill: i < 2 ? p.accent : 'transparent', stroke: p.accent, strokeWidth: 3 }));
      elements.push(textEl({ x: 182, y: y + 22, w: 900, h: 40, text: item, fontSize: 24, color: p.text, fontWeight: 600 }));
    });
  } else if (id === 'process') {
    elements = [
      textEl({ x: 96, y: 90, w: 900, h: 80, text: '3단계로 끝내는 협업', fontSize: 46, fontWeight: 800, color: p.text }),
      textEl({ x: 96, y: 170, w: 900, h: 44, text: '기획부터 공유까지 한 화면에서', fontSize: 20, color: p.muted }),
    ];
    ['01', '02', '03'].forEach((num, i) => {
      const x = 96 + i * 380;
      elements.push(shapeEl('roundRect', { x, y: 270, w: 320, h: 300, fill: i === 1 ? p.accent : p.surface, radius: 26, shadow: true }));
      elements.push(textEl({ x: x + 28, y: 300, w: 120, h: 60, text: num, fontSize: 40, fontWeight: 800, color: i === 1 ? p.bg : p.accent }));
      elements.push(
        textEl({
          x: x + 28,
          y: 375,
          w: 264,
          h: 60,
          text: ['정리하기', '공유하기', '발표하기'][i],
          fontSize: 28,
          fontWeight: 700,
          color: i === 1 ? p.bg : p.text,
        })
      );
      elements.push(
        textEl({
          x: x + 28,
          y: 440,
          w: 264,
          h: 110,
          text: ['흩어진 자료를 한 곳에', '링크 하나로 실시간 공유', '전체화면으로 바로 발표'][i],
          fontSize: 18,
          lineHeight: 1.6,
          color: i === 1 ? p.bg : p.muted,
        })
      );
    });
  }

  return {
    id: uid('slide'),
    name: TEMPLATE_META.find((t) => t.id === id)?.name || `슬라이드 ${index + 1}`,
    background: baseBackground,
    elements,
    notes: '',
    transition: 'fade',
  };
};

const applyPaletteToSlide = (slide: Slide, palette: PaletteDef): Slide => {
  const elements = slide.elements.map((el, idx) => {
    if (el.type === 'image') return el;
    if (el.type === 'text') {
      const isMuted = el.color === '#6B5B4E' || el.color === '#8B7A69' || el.fontSize !== undefined && el.fontSize <= 22;
      return { ...el, color: isMuted ? palette.muted : palette.text };
    }
    if (el.type === 'badge') return { ...el, fill: palette.accent, color: palette.bg };
    if (idx % 3 === 0) return { ...el, fill: palette.surface };
    return { ...el, fill: el.opacity !== undefined && el.opacity < 1 ? palette.accent : palette.accent };
  });
  return { ...slide, background: { type: 'solid', color: palette.bg }, elements };
};

// ============================================================
// ELEMENT RENDERER (캔버스 / 썸네일 / 발표 / 인쇄 공용)
// ============================================================
const STAR_POINTS = '50,3 61,37 97,37 68,58 79,93 50,72 21,93 32,58 3,37 39,37';
const ARROW_POINTS = '0,36 58,36 58,10 100,50 58,90 58,64 0,64';
const TRIANGLE_POINTS = '50,4 97,96 3,96';

const ElementVisual: React.FC<{ el: SlideElement }> = ({ el }) => {
  const common: React.CSSProperties = { width: '100%', height: '100%', boxSizing: 'border-box' };

  if (el.type === 'image') {
    return (
      <img
        src={el.imageUrl}
        alt=""
        draggable={false}
        style={{ ...common, objectFit: 'cover', borderRadius: el.radius ?? 0, display: 'block', pointerEvents: 'none' }}
      />
    );
  }

  if (el.type === 'triangle' || el.type === 'star' || el.type === 'arrow') {
    const points = el.type === 'triangle' ? TRIANGLE_POINTS : el.type === 'star' ? STAR_POINTS : ARROW_POINTS;
    return (
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={common}>
        <polygon
          points={points}
          fill={el.fill || '#C18C5D'}
          stroke={el.stroke && el.stroke !== 'transparent' ? el.stroke : 'none'}
          strokeWidth={el.strokeWidth || 0}
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    );
  }

  if (el.type === 'line') {
    return (
      <div style={{ ...common, display: 'flex', alignItems: 'center' }}>
        <div
          style={{
            width: '100%',
            height: Math.max(2, el.strokeWidth || 4),
            background: el.stroke && el.stroke !== 'transparent' ? el.stroke : el.fill || '#C18C5D',
            borderRadius: 999,
          }}
        />
      </div>
    );
  }

  if (el.type === 'rect' || el.type === 'roundRect' || el.type === 'circle') {
    return (
      <div
        style={{
          ...common,
          background: el.fill || 'transparent',
          borderRadius: el.type === 'circle' ? '50%' : el.radius ?? (el.type === 'roundRect' ? 24 : 0),
          border: el.strokeWidth && el.stroke && el.stroke !== 'transparent' ? `${el.strokeWidth}px solid ${el.stroke}` : undefined,
          boxShadow: el.shadow ? '0 18px 42px rgba(15, 23, 42, 0.18)' : undefined,
        }}
      />
    );
  }

  if (el.type === 'badge') {
    return (
      <div
        style={{
          ...common,
          background: el.fill || '#C18C5D',
          borderRadius: 999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: el.color || '#FFFFFF',
          fontFamily: el.fontFamily || "'Pretendard', sans-serif",
          fontSize: el.fontSize || 16,
          fontWeight: el.fontWeight || 700,
          letterSpacing: 1,
          padding: '0 12px',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
        }}
      >
        {el.text}
      </div>
    );
  }

  // text
  return (
    <div
      style={{
        ...common,
        display: 'flex',
        flexDirection: 'column',
        justifyContent:
          el.verticalAlign === 'middle' ? 'center' : el.verticalAlign === 'bottom' ? 'flex-end' : 'flex-start',
        color: el.color || '#2C2520',
        fontFamily: el.fontFamily || "'Pretendard', 'Noto Sans KR', sans-serif",
        fontSize: el.fontSize || 28,
        fontWeight: el.fontWeight || 400,
        fontStyle: el.italic ? 'italic' : 'normal',
        textDecoration: el.underline ? 'underline' : 'none',
        textAlign: el.align || 'left',
        lineHeight: el.lineHeight ?? 1.35,
        letterSpacing: el.letterSpacing ? `${el.letterSpacing}px` : '-0.01em',
        whiteSpace: 'pre-wrap',
        wordBreak: 'keep-all',
        overflowWrap: 'break-word',
        background: el.highlight || 'transparent',
        padding: el.highlight ? '6px 12px' : '2px 2px',
        borderRadius: el.highlight ? 10 : 0,
      }}
    >
      {el.text}
    </div>
  );
};

const SlideView: React.FC<{ slide: Slide; className?: string; showElements?: boolean }> = ({ slide, className, showElements = true }) => {
  const bgStyle: React.CSSProperties =
    slide.background.type === 'image' && slide.background.imageUrl
      ? { backgroundImage: `url(${slide.background.imageUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }
      : slide.background.type === 'gradient'
      ? { background: slide.background.gradient || '#FAF7F2' }
      : { background: slide.background.color || '#FAF7F2' };

  return (
    <div className={className} style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', ...bgStyle }}>
      {showElements && slide.elements.map((el) => (
        <div
          key={el.id}
          style={{
            position: 'absolute',
            left: el.x,
            top: el.y,
            width: el.w,
            height: el.h,
            transform: `rotate(${el.rotation || 0}deg)`,
            opacity: el.opacity ?? 1,
          }}
        >
          <ElementVisual el={el} />
        </div>
      ))}
    </div>
  );
};

// ============================================================
// MAIN EDITOR
// ============================================================
type HandleKey = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

const HANDLES: { key: HandleKey; x: number; y: number; cursor: string }[] = [
  { key: 'nw', x: 0, y: 0, cursor: 'nwse-resize' },
  { key: 'n', x: 0.5, y: 0, cursor: 'ns-resize' },
  { key: 'ne', x: 1, y: 0, cursor: 'nesw-resize' },
  { key: 'e', x: 1, y: 0.5, cursor: 'ew-resize' },
  { key: 'se', x: 1, y: 1, cursor: 'nwse-resize' },
  { key: 's', x: 0.5, y: 1, cursor: 'ns-resize' },
  { key: 'sw', x: 0, y: 1, cursor: 'nesw-resize' },
  { key: 'w', x: 0, y: 0.5, cursor: 'ew-resize' },
];

export const SlideEditor: React.FC<SlideEditorProps> = ({
  fileId,
  fileName,
  initialContent,
  onSave,
  onClose,
  onShareToChat,
}) => {
  const [title, setTitle] = useState(fileName || '제목 없는 프레젠테이션');
  const [slides, setSlides] = useState<Slide[]>(() => parseSlides(initialContent));
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [panelTab, setPanelTab] = useState<'design' | 'elements' | 'text' | 'images' | 'background'>('design');
  const [panelOpen, setPanelOpen] = useState(true);
  const [zoom, setZoom] = useState(62);
  const [guides, setGuides] = useState<{ v: number[]; h: number[] }>({ v: [], h: [] });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [palette, setPalette] = useState<PaletteDef>(PALETTES[0]);
  const [presenting, setPresenting] = useState(false);
  const [presentIndex, setPresentIndex] = useState(0);
  const [presentScale, setPresentScale] = useState(0.7);
  const [showNotes, setShowNotes] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'dirty'>('saved');
  const [lastSavedTime, setLastSavedTime] = useState('방금 전');
  const [toast, setToast] = useState<string | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const canvasRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const bgInputRef = useRef<HTMLInputElement>(null);
  const replaceImageInputRef = useRef<HTMLInputElement>(null);
  const undoRef = useRef<Slide[][]>([]);
  const redoRef = useRef<Slide[][]>([]);
  const lastPushRef = useRef({ key: '', at: 0 });

  const slide = slides[Math.min(currentIndex, slides.length - 1)] || slides[0];
  const scale = zoom / 100;

  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2200);
  };

  // ---------------- history ----------------
  const pushHistory = (coalesceKey?: string) => {
    const now = Date.now();
    if (coalesceKey && lastPushRef.current.key === coalesceKey && now - lastPushRef.current.at < 900) {
      lastPushRef.current = { key: coalesceKey, at: now };
      return;
    }
    lastPushRef.current = { key: coalesceKey || '', at: now };
    undoRef.current.push(clone(slides));
    if (undoRef.current.length > 50) undoRef.current.shift();
    redoRef.current = [];
  };

  const handleUndo = () => {
    const prev = undoRef.current.pop();
    if (!prev) return;
    redoRef.current.push(clone(slides));
    setSlides(prev);
    setEditingId(null);
    setSelectedIds([]);
    setDirty();
  };

  const handleRedo = () => {
    const next = redoRef.current.pop();
    if (!next) return;
    undoRef.current.push(clone(slides));
    setSlides(next);
    setDirty();
  };

  const setDirty = () => setSaveStatus('dirty');

  const updateSlide = (updater: (s: Slide) => Slide, options?: { history?: boolean; key?: string }) => {
    if (options?.history !== false) pushHistory(options?.key);
    setSlides((prev) => prev.map((s, i) => (i === currentIndex ? updater(s) : s)));
    setDirty();
  };

  const updateElements = (updater: (el: SlideElement) => SlideElement, ids?: string[]) => {
    const targetIds = ids || selectedIds;
    updateSlide(
      (s) => ({
        ...s,
        elements: s.elements.map((el) => (targetIds.includes(el.id) ? updater(el) : el)),
      }),
      { history: false }
    );
  };

  const patchElement = (id: string, patch: Partial<SlideElement>, options?: { history?: boolean }) => {
    updateSlide(
      (s) => ({ ...s, elements: s.elements.map((el) => (el.id === id ? { ...el, ...patch } : el)) }),
      options
    );
  };

  const addElement = (el: SlideElement, select = true) => {
    updateSlide((s) => ({ ...s, elements: [...s.elements, el] }));
    if (select) setSelectedIds([el.id]);
  };

  const removeSelected = () => {
    if (selectedIds.length === 0) return;
    updateSlide((s) => ({ ...s, elements: s.elements.filter((el) => !selectedIds.includes(el.id) || el.locked) }));
    setSelectedIds([]);
    setEditingId(null);
  };

  const duplicateSelected = () => {
    if (!slide || selectedIds.length === 0) return;
    pushHistory();
    const copies = slide.elements
      .filter((el) => selectedIds.includes(el.id))
      .map((el) => ({ ...clone(el), id: uid(), x: el.x + 24, y: el.y + 24 }));
    updateSlide((s) => ({ ...s, elements: [...s.elements, ...copies] }), { history: false });
    setSelectedIds(copies.map((c) => c.id));
    showToast('✓ 요소를 복제했습니다.');
  };

  const reorderElement = (dir: 'front' | 'back' | 'forward' | 'backward') => {
    if (!slide || selectedIds.length === 0) return;
    const primary = selectedIds[0];
    const list = [...slide.elements];
    const idx = list.findIndex((el) => el.id === primary);
    if (idx < 0) return;
    const [item] = list.splice(idx, 1);
    if (dir === 'front') list.push(item);
    else if (dir === 'back') list.unshift(item);
    else if (dir === 'forward') list.splice(Math.min(list.length, idx + 1), 0, item);
    else list.splice(Math.max(0, idx - 1), 0, item);
    updateSlide((s) => ({ ...s, elements: list }));
  };

  const selectedElement = slide?.elements.find((el) => el.id === selectedIds[0]) || null;

  // ---------------- drag / resize / rotate ----------------
  const beginElementDrag = (e: React.MouseEvent, el: SlideElement) => {
    e.stopPropagation();
    const isSelected = selectedIds.includes(el.id);
    const nextSelection = e.shiftKey
      ? isSelected
        ? selectedIds.filter((id) => id !== el.id)
        : [...selectedIds, el.id]
      : isSelected
      ? selectedIds
      : [el.id];
    setSelectedIds(nextSelection);
    if (el.locked) return;

    const ids = nextSelection.length > 0 ? nextSelection : [el.id];
    const originals = slide.elements.filter((x) => ids.includes(x.id)).map((x) => ({ id: x.id, x: x.x, y: x.y }));
    const startX = e.clientX;
    const startY = e.clientY;
    let started = false;

    const move = (ev: MouseEvent) => {
      let dx = (ev.clientX - startX) / scale;
      let dy = (ev.clientY - startY) / scale;
      if (!started) {
        if (Math.abs(dx) < 2 && Math.abs(dy) < 2) return;
        started = true;
        pushHistory();
      }
      if (originals.length === 1) {
        const snap = computeSnap(el, dx, dy, ids);
        dx = snap.dx;
        dy = snap.dy;
        setGuides(snap.guides);
      }
      const map = new Map(originals.map((o) => [o.id, o]));
      updateSlide(
        (s) => ({
          ...s,
          elements: s.elements.map((item) => {
            const origin = map.get(item.id);
            if (!origin) return item;
            return { ...item, x: Math.round(origin.x + dx), y: Math.round(origin.y + dy) };
          }),
        }),
        { history: false }
      );
    };
    const up = () => {
      setGuides({ v: [], h: [] });
      document.removeEventListener('mousemove', move);
      document.removeEventListener('mouseup', up);
    };
    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', up);
  };

  const computeSnap = (el: SlideElement, dx: number, dy: number, excludeIds: string[]) => {
    const threshold = 8 / Math.max(scale, 0.2);
    const others = slide.elements.filter((o) => !excludeIds.includes(o.id));
    const box = { x: el.x + dx, y: el.y + dy, w: el.w, h: el.h };
    const vLines: number[] = [0, SLIDE_W / 2, SLIDE_W];
    const hLines: number[] = [0, SLIDE_H / 2, SLIDE_H];
    others.forEach((o) => {
      vLines.push(o.x, o.x + o.w / 2, o.x + o.w);
      hLines.push(o.y, o.y + o.h / 2, o.y + o.h);
    });
    const vCandidates = [
      { pos: box.x, offset: 0 },
      { pos: box.x + box.w / 2, offset: box.w / 2 },
      { pos: box.x + box.w, offset: box.w },
    ];
    const hCandidates = [
      { pos: box.y, offset: 0 },
      { pos: box.y + box.h / 2, offset: box.h / 2 },
      { pos: box.y + box.h, offset: box.h },
    ];
    let bestV: { delta: number; line: number } | null = null;
    vCandidates.forEach((cand) => {
      vLines.forEach((line) => {
        const delta = line - cand.pos;
        if (Math.abs(delta) <= threshold && (!bestV || Math.abs(delta) < Math.abs(bestV.delta))) {
          bestV = { delta, line };
        }
      });
    });
    let bestH: { delta: number; line: number } | null = null;
    hCandidates.forEach((cand) => {
      hLines.forEach((line) => {
        const delta = line - cand.pos;
        if (Math.abs(delta) <= threshold && (!bestH || Math.abs(delta) < Math.abs(bestH.delta))) {
          bestH = { delta, line };
        }
      });
    });
    return {
      dx: dx + (bestV ? (bestV as { delta: number }).delta : 0),
      dy: dy + (bestH ? (bestH as { delta: number }).delta : 0),
      guides: {
        v: bestV ? [(bestV as { line: number }).line] : [],
        h: bestH ? [(bestH as { line: number }).line] : [],
      } as { v: number[]; h: number[] },
    };
  };

  const beginResize = (e: React.MouseEvent, el: SlideElement, handle: HandleKey) => {
    e.stopPropagation();
    e.preventDefault();
    const startX = e.clientX;
    const startY = e.clientY;
    const startW = el.w;
    const startH = el.h;
    const startCx = el.x + el.w / 2;
    const startCy = el.y + el.h / 2;
    const rad = ((el.rotation || 0) * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const signX = handle.includes('e') ? 1 : handle.includes('w') ? -1 : 0;
    const signY = handle.includes('s') ? 1 : handle.includes('n') ? -1 : 0;
    let started = false;

    const move = (ev: MouseEvent) => {
      if (!started) {
        started = true;
        pushHistory();
      }
      const dx = (ev.clientX - startX) / scale;
      const dy = (ev.clientY - startY) / scale;
      const localDx = dx * cos + dy * sin;
      const localDy = -dx * sin + dy * cos;
      let w = Math.max(24, startW + signX * localDx);
      let h = Math.max(24, startH + signY * localDy);
      if (ev.shiftKey && signX !== 0 && signY !== 0) {
        const ratio = startW / startH;
        if (w / h > ratio) w = h * ratio;
        else h = w / ratio;
      }
      const dW = w - startW;
      const dH = h - startH;
      const shiftLocalX = (signX * dW) / 2;
      const shiftLocalY = (signY * dH) / 2;
      const cx = startCx + (shiftLocalX * cos - shiftLocalY * sin);
      const cy = startCy + (shiftLocalX * sin + shiftLocalY * cos);
      updateSlide(
        (s) => ({
          ...s,
          elements: s.elements.map((item) =>
            item.id === el.id
              ? {
                  ...item,
                  x: Math.round(cx - w / 2),
                  y: Math.round(cy - h / 2),
                  w: Math.round(w),
                  h: Math.round(h),
                }
              : item
          ),
        }),
        { history: false }
      );
    };
    const up = () => {
      document.removeEventListener('mousemove', move);
      document.removeEventListener('mouseup', up);
    };
    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', up);
  };

  const beginRotate = (e: React.MouseEvent, el: SlideElement) => {
    e.stopPropagation();
    e.preventDefault();
    const canvasRect = canvasRef.current?.getBoundingClientRect();
    if (!canvasRect) return;
    const cx = el.x + el.w / 2;
    const cy = el.y + el.h / 2;
    let started = false;
    const move = (ev: MouseEvent) => {
      if (!started) {
        started = true;
        pushHistory();
      }
      const mx = (ev.clientX - canvasRect.left) / scale;
      const my = (ev.clientY - canvasRect.top) / scale;
      let angle = (Math.atan2(my - cy, mx - cx) * 180) / Math.PI + 90;
      if (ev.shiftKey) angle = Math.round(angle / 15) * 15;
      angle = ((angle % 360) + 360) % 360;
      updateSlide(
        (s) => ({ ...s, elements: s.elements.map((item) => (item.id === el.id ? { ...item, rotation: Math.round(angle) } : item)) }),
        { history: false }
      );
    };
    const up = () => {
      document.removeEventListener('mousemove', move);
      document.removeEventListener('mouseup', up);
    };
    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', up);
  };

  const dragSlideThumb = useRef<number | null>(null);
  const reorderSlide = (from: number, to: number) => {
    if (from === to || to < 0 || to >= slides.length) return;
    pushHistory();
    setSlides((prev) => {
      const next = [...prev];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
    setCurrentIndex(to);
    setDirty();
  };

  // ---------------- slides ----------------
  const addSlide = () => {
    pushHistory();
    const next = blankSlide(slides.length);
    next.background = clone(slide.background);
    setSlides((prev) => [...prev, next]);
    setCurrentIndex(slides.length);
    setSelectedIds([]);
    setDirty();
    showToast('✓ 새 슬라이드를 추가했습니다.');
  };

  const duplicateSlide = () => {
    pushHistory();
    const copy = { ...clone(slide), id: uid('slide'), name: `${slide.name || '슬라이드'} 사본` };
    copy.elements = copy.elements.map((el) => ({ ...el, id: uid() }));
    setSlides((prev) => [...prev.slice(0, currentIndex + 1), copy, ...prev.slice(currentIndex + 1)]);
    setCurrentIndex(currentIndex + 1);
    setSelectedIds([]);
    setDirty();
    showToast('✓ 슬라이드를 복제했습니다.');
  };

  const deleteSlide = (index: number) => {
    if (slides.length <= 1) {
      showToast('슬라이드가 하나뿐이라 삭제할 수 없습니다.');
      return;
    }
    pushHistory();
    setSlides((prev) => prev.filter((_, i) => i !== index));
    setCurrentIndex(Math.max(0, Math.min(index, slides.length - 2)));
    setSelectedIds([]);
    setDirty();
  };

  const applyTemplate = (id: TemplateId) => {
    pushHistory();
    const built = buildTemplate(id, palette, currentIndex);
    setSlides((prev) =>
      prev.map((s, i) =>
        i === currentIndex
          ? { ...s, background: built.background, elements: built.elements, name: built.name, transition: s.transition }
          : s
      )
    );
    setSelectedIds([]);
    setDirty();
    showToast('✓ 템플릿을 적용했습니다.');
  };

  const applyPalette = (p: PaletteDef) => {
    setPalette(p);
    pushHistory();
    setSlides((prev) => prev.map((s, i) => (i === currentIndex ? applyPaletteToSlide(s, p) : s)));
    setDirty();
    showToast(`✓ ${p.name} 팔레트를 적용했습니다.`);
  };

  // ---------------- element factories ----------------
  const addText = (kind: 'title' | 'subtitle' | 'body') => {
    const preset =
      kind === 'title'
        ? { text: '제목을 입력하세요', fontSize: 56, fontWeight: 800, h: 100, w: 900 }
        : kind === 'subtitle'
        ? { text: '부제목을 입력하세요', fontSize: 28, fontWeight: 500, h: 60, w: 800 }
        : { text: '본문을 입력하세요.\n두 번째 줄도 자유롭게 적을 수 있어요.', fontSize: 22, fontWeight: 400, h: 150, w: 700 };
    const el = textEl({
      ...preset,
      x: Math.round((SLIDE_W - preset.w) / 2),
      y: kind === 'title' ? 260 : kind === 'subtitle' ? 390 : 300,
      color: palette.text,
    });
    addElement(el);
    setEditingId(el.id);
  };

  const addShape = (type: SlideElementType, over?: Partial<SlideElement>) => {
    const size = type === 'line' ? { w: 420, h: 24 } : type === 'badge' ? { w: 220, h: 48 } : { w: 260, h: 180 };
    const el = shapeEl(type, {
      ...size,
      x: Math.round((SLIDE_W - size.w) / 2),
      y: Math.round((SLIDE_H - size.h) / 2),
      fill: type === 'line' ? 'transparent' : palette.accent,
      stroke: type === 'line' ? palette.text : 'transparent',
      strokeWidth: type === 'line' ? 4 : 0,
      text: type === 'badge' ? 'BADGE' : undefined,
      color: palette.bg,
      fontSize: 16,
      ...over,
    });
    addElement(el);
  };

  const addImage = (url: string) => {
    const el: SlideElement = {
      id: uid(),
      type: 'image',
      x: Math.round((SLIDE_W - 520) / 2),
      y: Math.round((SLIDE_H - 300) / 2),
      w: 520,
      h: 300,
      rotation: 0,
      opacity: 1,
      imageUrl: url,
      radius: 18,
      shadow: true,
    };
    addElement(el);
    showToast('✓ 이미지를 추가했습니다.');
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) {
      showToast('⚠️ 4MB 이하 이미지를 사용해 주세요.');
      e.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => addImage(reader.result as string);
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleBackgroundImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      updateSlide((s) => ({ ...s, background: { type: 'image', imageUrl: reader.result as string } }));
      showToast('✓ 배경 이미지를 적용했습니다.');
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleReplaceImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedElement) return;
    const reader = new FileReader();
    reader.onload = () => patchElement(selectedElement.id, { imageUrl: reader.result as string });
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // ---------------- selection & keyboard ----------------
  const nudge = (dx: number, dy: number) => {
    if (selectedIds.length === 0) return;
    pushHistory(`nudge_${selectedIds[0]}`);
    updateElements((el) => ({ ...el, x: el.x + dx, y: el.y + dy }));
  };

  const selectAll = () => setSelectedIds(slide.elements.filter((el) => !el.locked).map((el) => el.id));

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
      const mod = e.ctrlKey || e.metaKey;
      if (presenting) return;

      if (mod && e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleManualSave();
        return;
      }
      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) handleRedo();
        else handleUndo();
        return;
      }
      if (mod && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedo();
        return;
      }
      if (mod && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        duplicateSelected();
        return;
      }
      if (mod && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        selectAll();
        return;
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedIds.length > 0) {
          e.preventDefault();
          removeSelected();
        }
        return;
      }
      if (e.key === 'Escape') {
        setSelectedIds([]);
        setEditingId(null);
        return;
      }
      if (e.key.startsWith('Arrow')) {
        if (selectedIds.length === 0) return;
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        if (e.key === 'ArrowUp') nudge(0, -step);
        if (e.key === 'ArrowDown') nudge(0, step);
        if (e.key === 'ArrowLeft') nudge(-step, 0);
        if (e.key === 'ArrowRight') nudge(step, 0);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  });

  // 실제 Google Drive 프레젠테이션을 열었을 때 내용 불러오기
  useEffect(() => {
    if (initialContent) return;
    if (!fileId || /^(slide_|doc_|upload_)/.test(fileId)) return;
    let cancelled = false;
    fetchRealDocContent(fileId, 'application/vnd.google-apps.presentation').then((content) => {
      if (cancelled || !content || !content.trim()) return;
      try {
        const parsed = JSON.parse(content);
        const list = Array.isArray(parsed) ? parsed : parsed?.slides;
        if (Array.isArray(list) && list.length > 0) {
          setSlides(parseSlides(content));
        }
      } catch {
        /* Drive 슬라이드는 JSON 직렬화본만 복원 가능 */
      }
    });
    return () => {
      cancelled = true;
    };
  }, [fileId, initialContent]);

  // ---------------- save ----------------
  const serialize = () => JSON.stringify({ v: 2, slides, activeIndex: currentIndex });
  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;
  const titleRef = useRef(title);
  titleRef.current = title;
  const serializeRef = useRef(serialize);
  serializeRef.current = serialize;
  const slidesRef = useRef(slides);
  slidesRef.current = slides;

  useEffect(() => {
    if (saveStatus !== 'dirty') return;
    const timer = window.setTimeout(async () => {
      setSaveStatus('saving');
      onSaveRef.current(fileId, serializeRef.current(), titleRef.current);
      if (!fileId.startsWith('slide_') && !fileId.startsWith('doc_') && !fileId.startsWith('upload_')) {
        try {
          await saveRealDocContent(fileId, serializeRef.current(), titleRef.current);
        } catch {
          /* 로컬 저장 완료 */
        }
      }
      setLastSavedTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      setSaveStatus('saved');
    }, 600);
    return () => window.clearTimeout(timer);
  }, [slides, title, saveStatus, fileId, currentIndex]);

  useEffect(() => {
    const flush = () => {
      if (saveStatus === 'dirty') onSaveRef.current(fileId, serializeRef.current(), titleRef.current);
    };
    window.addEventListener('beforeunload', flush);
    return () => {
      window.removeEventListener('beforeunload', flush);
      flush();
    };
  }, [fileId]);

  const handleManualSave = async () => {
    setSaveStatus('saving');
    onSave(fileId, serialize(), title);
    if (!fileId.startsWith('slide_') && !fileId.startsWith('doc_') && !fileId.startsWith('upload_')) {
      await saveRealDocContent(fileId, serialize(), title);
    }
    setLastSavedTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    setSaveStatus('saved');
    showToast('✓ 저장했습니다.');
  };

  // ---------------- presentation ----------------
  useEffect(() => {
    const updateScale = () => setPresentScale(Math.min(window.innerWidth / SLIDE_W, window.innerHeight / SLIDE_H));
    updateScale();
    window.addEventListener('resize', updateScale);
    return () => window.removeEventListener('resize', updateScale);
  }, []);

  useEffect(() => {
    if (!presenting) {
      setElapsed(0);
      return;
    }
    setPresentIndex(currentIndex);
    const timer = window.setInterval(() => setElapsed((v) => v + 1), 1000);
    return () => window.clearInterval(timer);
  }, [presenting, currentIndex]);

  useEffect(() => {
    if (!presenting) return;
    const handler = (e: KeyboardEvent) => {
      if (['ArrowRight', 'ArrowDown', ' ', 'PageDown', 'Enter'].includes(e.key)) {
        e.preventDefault();
        setPresentIndex((i) => Math.min(slides.length - 1, i + 1));
      } else if (['ArrowLeft', 'ArrowUp', 'PageUp', 'Backspace'].includes(e.key)) {
        e.preventDefault();
        setPresentIndex((i) => Math.max(0, i - 1));
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setPresenting(false);
      } else if (e.key.toLowerCase() === 'n') {
        setShowNotes((v) => !v);
      }
    };
    window.addEventListener('keydown', handler);
    const el = document.getElementById('nexus-presentation');
    if (el && el.requestFullscreen) el.requestFullscreen().catch(() => {});
    return () => {
      window.removeEventListener('keydown', handler);
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    };
  }, [presenting, slides.length]);

  const startPresentation = () => {
    setPresenting(true);
    setPresentIndex(currentIndex);
    (scrollAreaRef.current as HTMLElement | null)?.blur?.();
  };

  const printSlides = () => {
    window.print();
  };

  // ---------------- derived ----------------
  const currentSlideForPresent = slides[Math.min(presentIndex, slides.length - 1)] || slides[0];

  const textColorChoices = useMemo(
    () => ['#2C2520', '#FFFFFF', '#0F172A', '#C18C5D', '#F97316', '#0EA5E9', '#7C3AED', '#16A34A', '#DC2626', palette.accent, palette.text, palette.muted],
    [palette]
  );
  const fillChoices = useMemo(
    () => ['#FFFFFF', '#F4EFE6', '#E9E1FF', '#FDE68A', '#FECACA', '#BFDBFE', '#BBF7D0', '#1F2937', palette.bg, palette.surface, palette.accent, palette.muted],
    [palette]
  );

  const fontSets = [
    { name: '모던 산세리프', title: "'Pretendard', 'Noto Sans KR', sans-serif", body: "'Pretendard', 'Noto Sans KR', sans-serif" },
    { name: '에디토리얼 세리프', title: "'Nanum Myeongjo', serif", body: "'Pretendard', 'Noto Sans KR', sans-serif" },
    { name: '임팩트 디스플레이', title: "'Black Han Sans', sans-serif", body: "'Pretendard', sans-serif" },
    { name: '테크 모노', title: "'D2Coding', monospace", body: "'Pretendard', sans-serif" },
  ];

  const applyFontSet = (set: { title: string; body: string }) => {
    pushHistory();
    updateSlide((s) => ({
      ...s,
      elements: s.elements.map((el) => {
        if (el.type !== 'text' && el.type !== 'badge') return el;
        const isTitle = (el.fontSize || 0) >= 34;
        const isTarget = selectedIds.length > 0 ? selectedIds.includes(el.id) : true;
        if (!isTarget) return el;
        return { ...el, fontFamily: isTitle ? set.title : set.body };
      }),
    }), { history: false });
    showToast('✓ 폰트 조합을 적용했습니다.');
  };

  // ============================================================
  // RENDER
  // ============================================================
  return (
    <div className="flex flex-col h-full bg-[#FDFBF7] text-[#2C2520] font-sans relative overflow-hidden select-none">
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[60] bg-[#2C2520] text-white text-xs px-4 py-2 rounded-2xl shadow-xl flex items-center gap-2 pointer-events-none">
          <Check className="w-4 h-4 text-[#48BB78]" />
          <span className="font-medium">{toast}</span>
        </div>
      )}

      <input type="file" ref={imageInputRef} accept="image/*" className="hidden" onChange={handleImageUpload} />
      <input type="file" ref={bgInputRef} accept="image/*" className="hidden" onChange={handleBackgroundImage} />
      <input type="file" ref={replaceImageInputRef} accept="image/*" className="hidden" onChange={handleReplaceImage} />

      {/* HEADER */}
      <header className="h-14 bg-white border-b border-[#EBE5DA] px-3 sm:px-4 flex items-center justify-between shrink-0 shadow-2xs z-30">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white shadow-xs shrink-0 bg-[#F4B400]">
            <Presentation className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex flex-col justify-center">
            <input
              type="text"
              data-testid="doc-title"
              aria-label="문서 제목"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                setDirty();
              }}
              className="text-xs sm:text-sm font-bold text-[#2C2520] bg-transparent hover:bg-[#F4EFE6] px-1.5 py-0.5 rounded-lg border border-transparent hover:border-[#EBE5DA] focus:border-[#F4B400] focus:bg-white focus:outline-none truncate max-w-[150px] sm:max-w-xs"
            />
            <div className="flex items-center gap-2 text-[10px] text-[#7A6A5C] px-1.5">
              <span className="font-semibold">Canva 스타일 스튜디오</span>
              <span>•</span>
              <span
                className={`flex items-center gap-1 font-bold ${
                  saveStatus === 'saved' ? 'text-[#0F9D58]' : saveStatus === 'saving' ? 'text-[#E67E22]' : 'text-[#EA4335]'
                }`}
              >
                {saveStatus === 'saved' && <Check className="w-3 h-3" />}
                {saveStatus === 'saving' && <Check className="w-3 h-3 animate-pulse" />}
                {saveStatus === 'saved' ? `저장 완료 (${lastSavedTime})` : saveStatus === 'saving' ? '저장 중...' : '저장 대기'}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={() => {
              setPanelOpen((v) => !v);
            }}
            className={`hidden lg:flex items-center gap-1 px-2 py-1.5 rounded-xl border text-[11px] font-semibold ${
              panelOpen ? 'bg-[#F4EFE6] border-[#EBE5DA] text-[#3E2723]' : 'border-[#EBE5DA] text-[#7A6A5C]'
            }`}
            title="사이드 패널 접기/펼치기"
          >
            <Sliders className="w-3.5 h-3.5" />
            패널
          </button>
          <button
            onClick={startPresentation}
            data-testid="present-btn"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-[#F4B400] to-[#F97316] text-white text-xs font-bold shadow-xs"
            title="전체화면 발표 (슬라이드 쇼)"
          >
            <Play className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">발표</span>
          </button>
          <button onClick={printSlides} className="p-1.5 rounded-xl hover:bg-[#F4EFE6] text-[#5C5046] border border-[#EBE5DA]" title="인쇄 / PDF 저장">
            <Printer className="w-4 h-4" />
          </button>
          {onShareToChat && (
            <button
              onClick={() =>
                onShareToChat(
                  `🎞️ ${title}\n\n${slides
                    .map((s, i) => `${i + 1}. ${(s.elements.find((e) => e.type === 'text')?.text || s.name || '').slice(0, 60)}`)
                    .join('\n')}`
                )
              }
              className="p-1.5 rounded-xl hover:bg-[#F4EFE6] text-[#5C5046] border border-[#EBE5DA] hidden sm:flex"
              title="대화방에 프레젠테이션 개요 공유"
            >
              <Sparkles className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={handleManualSave}
            data-testid="slide-save"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-xs ${
              saveStatus === 'saved' ? 'bg-white border border-[#EBE5DA] text-[#2C2520]' : 'bg-[#3E2723] text-white'
            }`}
          >
            <Save className="w-3.5 h-3.5" />
            <span>저장</span>
          </button>
          {onClose && (
            <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-[#FEE2E2] text-[#7A6A5C] hover:text-[#DC2626] border border-[#EBE5DA] ml-1" title="에디터 닫기">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </header>

      {/* TOOLBAR */}
      <div className="h-11 bg-[#FAF7F2] border-b border-[#EBE5DA] px-3 flex items-center gap-1 text-xs shrink-0 overflow-x-auto z-20">
        <button onClick={handleUndo} className="p-1.5 rounded-lg hover:bg-white text-[#5C5046]" title="실행 취소 (Ctrl+Z)">
          <Undo className="w-4 h-4" />
        </button>
        <button onClick={handleRedo} className="p-1.5 rounded-lg hover:bg-white text-[#5C5046]" title="다시 실행 (Ctrl+Y)">
          <Redo className="w-4 h-4" />
        </button>
        <div className="w-px h-5 bg-[#EBE5DA] mx-1" />
        <button onClick={() => setZoom((z) => Math.max(25, z - 10))} className="px-1.5 py-1 rounded-lg hover:bg-white text-[#5C5046]" title="축소">
          <Minimize2 className="w-3.5 h-3.5" />
        </button>
        <span className="font-mono font-bold text-[11px] w-10 text-center text-[#5C5046]">{zoom}%</span>
        <button onClick={() => setZoom((z) => Math.min(160, z + 10))} className="px-1.5 py-1 rounded-lg hover:bg-white text-[#5C5046]" title="확대">
          <Maximize2 className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => {
            const area = scrollAreaRef.current;
            if (!area) return;
            const fit = Math.min((area.clientWidth - 70) / SLIDE_W, (area.clientHeight - 70) / SLIDE_H);
            setZoom(Math.max(25, Math.min(140, Math.floor(fit * 100))));
          }}
          className="px-2 py-1 rounded-lg hover:bg-white text-[11px] font-semibold text-[#5C5046] ml-1"
        >
          화면 맞춤
        </button>

        <div className="w-px h-5 bg-[#EBE5DA] mx-1" />
        <button onClick={duplicateSelected} disabled={selectedIds.length === 0} className="p-1.5 rounded-lg hover:bg-white text-[#5C5046] disabled:opacity-30" title="복제 (Ctrl+D)">
          <Copy className="w-4 h-4" />
        </button>
        <button onClick={removeSelected} disabled={selectedIds.length === 0} className="p-1.5 rounded-lg hover:bg-[#FEE2E2] text-[#DC2626] disabled:opacity-30" title="삭제 (Delete)">
          <Trash2 className="w-4 h-4" />
        </button>
        <button onClick={() => reorderElement('front')} disabled={!selectedElement} className="p-1.5 rounded-lg hover:bg-white text-[#5C5046] disabled:opacity-30" title="맨 앞으로">
          <BringToFront className="w-4 h-4" />
        </button>
        <button onClick={() => reorderElement('back')} disabled={!selectedElement} className="p-1.5 rounded-lg hover:bg-white text-[#5C5046] disabled:opacity-30" title="맨 뒤로">
          <SendToBack className="w-4 h-4" />
        </button>
        {selectedElement && (
          <button
            onClick={() => patchElement(selectedElement.id, { locked: !selectedElement.locked })}
            className={`p-1.5 rounded-lg hover:bg-white ${selectedElement.locked ? 'text-[#DC2626]' : 'text-[#5C5046]'}`}
            title={selectedElement.locked ? '잠금 해제' : '요소 잠금'}
          >
            {selectedElement.locked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
          </button>
        )}

        <div className="w-px h-5 bg-[#EBE5DA] mx-1" />
        <select
          value={slide.transition}
          onChange={(e) => updateSlide((s) => ({ ...s, transition: e.target.value as Slide['transition'] }))}
          className="bg-white border border-[#EBE5DA] rounded-lg px-2 py-1 text-[11px] font-semibold text-[#5C5046] focus:outline-none"
          title="슬라이드 전환 효과"
          data-testid="transition-select"
        >
          <option value="none">전환 없음</option>
          <option value="fade">페이드</option>
          <option value="slide">슬라이드</option>
        </select>
        <button
          onClick={() => setNotesOpen((v) => !v)}
          className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold border ${
            notesOpen ? 'bg-white border-[#C18C5D] text-[#3E2723]' : 'border-transparent text-[#7A6A5C] hover:bg-white'
          }`}
          data-testid="notes-toggle"
        >
          <StickyNote className="w-3.5 h-3.5" />
          발표자 노트
        </button>

        <div className="ml-auto flex items-center gap-1 pl-2 text-[11px] text-[#7A6A5C]">
          <span className="font-semibold">
            {currentIndex + 1} / {slides.length} 슬라이드
          </span>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* LEFT RAIL */}
        <div className="w-14 bg-white border-r border-[#EBE5DA] flex flex-col items-center py-2 gap-1 shrink-0">
          {[
            { id: 'design', icon: Layout, label: '디자인' },
            { id: 'elements', icon: Shapes, label: '요소' },
            { id: 'text', icon: Type, label: '텍스트' },
            { id: 'images', icon: ImageIcon, label: '사진' },
            { id: 'background', icon: Palette, label: '배경' },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => {
                setPanelTab(item.id as typeof panelTab);
                setPanelOpen(true);
              }}
              data-testid={`panel-${item.id}`}
              className={`w-12 py-2 rounded-xl flex flex-col items-center gap-0.5 text-[9px] font-bold transition-colors ${
                panelTab === item.id && panelOpen ? 'bg-[#F4EFE6] text-[#3E2723]' : 'text-[#7A6A5C] hover:bg-[#FAF7F2]'
              }`}
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </button>
          ))}
        </div>

        {/* PANEL */}
        {panelOpen && (
          <div className="w-72 bg-white border-r border-[#EBE5DA] overflow-y-auto shrink-0 hidden sm:block">
            {panelTab === 'design' && (
              <div className="p-3">
                <h3 className="text-[11px] font-bold uppercase tracking-wide text-[#7A6A5C] mb-2">템플릿</h3>
                <div className="grid grid-cols-2 gap-2">
                  {TEMPLATE_META.map((tpl) => {
                    const preview = buildTemplate(tpl.id, palette);
                    return (
                      <button
                        key={tpl.id}
                        onClick={() => applyTemplate(tpl.id)}
                        data-testid={`template-${tpl.id}`}
                        className="group text-left rounded-xl border border-[#EBE5DA] hover:border-[#C18C5D] hover:shadow-md transition-all overflow-hidden bg-white"
                      >
                        <div className="relative w-full overflow-hidden" style={{ aspectRatio: '16 / 9' }}>
                          <div style={{ width: SLIDE_W, height: SLIDE_H, transform: 'scale(0.104)', transformOrigin: 'top left' }}>
                            <SlideView slide={preview} />
                          </div>
                        </div>
                        <div className="px-2 py-1.5">
                          <p className="text-[10.5px] font-bold text-[#2C2520] leading-tight">{tpl.name}</p>
                          <p className="text-[9px] text-[#A89A8E] leading-tight">{tpl.desc}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>

                <h3 className="text-[11px] font-bold uppercase tracking-wide text-[#7A6A5C] mt-4 mb-2">컬러 팔레트</h3>
                <div className="grid grid-cols-2 gap-1.5">
                  {PALETTES.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => applyPalette(p)}
                      className={`flex items-center gap-1.5 p-1.5 rounded-lg border text-[10px] font-semibold ${
                        palette.id === p.id ? 'border-[#C18C5D] bg-[#FDFBF7]' : 'border-[#EBE5DA] hover:bg-[#FAF7F2]'
                      }`}
                    >
                      <span className="flex">
                        <span className="w-3 h-6 rounded-l" style={{ background: p.bg }} />
                        <span className="w-3 h-6" style={{ background: p.surface }} />
                        <span className="w-3 h-6 rounded-r" style={{ background: p.accent }} />
                      </span>
                      <span className="text-[#3E2723]">{p.name}</span>
                    </button>
                  ))}
                </div>

                <h3 className="text-[11px] font-bold uppercase tracking-wide text-[#7A6A5C] mt-4 mb-2">무드 프리셋</h3>
                <p className="text-[10px] text-[#A89A8E] leading-relaxed">
                  템플릿을 고르면 현재 팔레트 색상으로 새 슬라이드가 만들어집니다. 캔버스의 요소는 언제든 드래그로 옮기고 크기를 바꿀 수 있어요.
                </p>
              </div>
            )}

            {panelTab === 'elements' && (
              <div className="p-3">
                <h3 className="text-[11px] font-bold uppercase tracking-wide text-[#7A6A5C] mb-2">도형</h3>
                <div className="grid grid-cols-4 gap-1.5">
                  {[
                    { type: 'rect' as SlideElementType, icon: Square, label: '사각형' },
                    { type: 'roundRect' as SlideElementType, icon: Square, label: '둥근' },
                    { type: 'circle' as SlideElementType, icon: Circle, label: '원' },
                    { type: 'triangle' as SlideElementType, icon: Shapes, label: '삼각' },
                    { type: 'star' as SlideElementType, icon: Star, label: '별' },
                    { type: 'arrow' as SlideElementType, icon: ArrowRight, label: '화살표' },
                    { type: 'line' as SlideElementType, icon: Minus, label: '직선' },
                    { type: 'badge' as SlideElementType, icon: Type, label: '배지' },
                  ].map((shape) => (
                    <button
                      key={shape.type}
                      onClick={() => addShape(shape.type)}
                      data-testid={shape.type === 'rect' ? 'element-rect' : undefined}
                      className="flex flex-col items-center gap-1 py-2 rounded-lg border border-[#EBE5DA] hover:border-[#C18C5D] hover:bg-[#FAF7F2] text-[9px] text-[#5C5046] font-semibold"
                      title={`${shape.label} 추가`}
                    >
                      <shape.icon className="w-4 h-4" />
                      {shape.label}
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-1.5 mt-2">
                  <button
                    onClick={() => addShape('roundRect', { w: 300, h: 150, fill: palette.surface, shadow: true })}
                    className="py-2 rounded-lg border border-[#EBE5DA] text-[10px] font-semibold hover:bg-[#FAF7F2]"
                  >
                    카드
                  </button>
                  <button
                    onClick={() =>
                      addShape('roundRect', {
                        w: 760,
                        h: 120,
                        fill: palette.surface,
                        shadow: false,
                        text: '한 줄 강조 문장을 적어보세요',
                      })
                    }
                    className="py-2 rounded-lg border border-[#EBE5DA] text-[10px] font-semibold hover:bg-[#FAF7F2]"
                  >
                    인용 박스
                  </button>
                </div>

                {selectedElement && selectedElement.type !== 'text' && selectedElement.type !== 'image' && (
                  <div className="mt-4 space-y-3 border-t border-[#EBE5DA] pt-3">
                    <h3 className="text-[11px] font-bold uppercase tracking-wide text-[#7A6A5C]">도형 스타일</h3>
                    <div>
                      <p className="text-[10px] text-[#7A6A5C] mb-1">채우기 색</p>
                      <div className="flex flex-wrap gap-1">
                        {fillChoices.map((color) => (
                          <button
                            key={color}
                            onClick={() => patchElement(selectedElement.id, { fill: color })}
                            className="w-6 h-6 rounded-md border border-[#D9D2C6]"
                            style={{ background: color }}
                          />
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-[10px] text-[#7A6A5C] mb-1">테두리 색</p>
                      <div className="flex flex-wrap gap-1">
                        {textColorChoices.map((color) => (
                          <button
                            key={color}
                            onClick={() => patchElement(selectedElement.id, { stroke: color })}
                            className="w-6 h-6 rounded-md border border-[#D9D2C6]"
                            style={{ background: color }}
                          />
                        ))}
                      </div>
                    </div>
                    <label className="block text-[10px] text-[#7A6A5C]">
                      테두리 두께 {selectedElement.strokeWidth || 0}px
                      <input
                        type="range"
                        min={0}
                        max={12}
                        value={selectedElement.strokeWidth || 0}
                        onChange={(e) => patchElement(selectedElement.id, { strokeWidth: Number(e.target.value) }, { history: false })}
                        className="w-full accent-[#C18C5D]"
                      />
                    </label>
                    <label className="block text-[10px] text-[#7A6A5C]">
                      모서리 둥글기 {selectedElement.radius || 0}px
                      <input
                        type="range"
                        min={0}
                        max={120}
                        value={selectedElement.radius || 0}
                        onChange={(e) => patchElement(selectedElement.id, { radius: Number(e.target.value) }, { history: false })}
                        className="w-full accent-[#C18C5D]"
                      />
                    </label>
                    <label className="flex items-center justify-between text-[10px] font-semibold text-[#5C5046]">
                      그림자
                      <input
                        type="checkbox"
                        checked={!!selectedElement.shadow}
                        onChange={(e) => patchElement(selectedElement.id, { shadow: e.target.checked })}
                      />
                    </label>
                  </div>
                )}
              </div>
            )}

            {panelTab === 'text' && (
              <div className="p-3">
                <h3 className="text-[11px] font-bold uppercase tracking-wide text-[#7A6A5C] mb-2">텍스트 추가</h3>
                <div className="grid grid-cols-3 gap-1.5">
                  {[
                    { kind: 'title' as const, label: '제목', cls: 'text-lg font-bold' },
                    { kind: 'subtitle' as const, label: '부제목', cls: 'text-sm font-semibold' },
                    { kind: 'body' as const, label: '본문', cls: 'text-xs' },
                  ].map((item) => (
                    <button
                      key={item.kind}
                      onClick={() => addText(item.kind)}
                      className="py-3 rounded-lg border border-[#EBE5DA] hover:border-[#C18C5D] hover:bg-[#FAF7F2] flex flex-col items-center gap-1"
                    >
                      <Type className="w-4 h-4 text-[#5C5046]" />
                      <span className={item.cls}>{item.label}</span>
                    </button>
                  ))}
                </div>

                <h3 className="text-[11px] font-bold uppercase tracking-wide text-[#7A6A5C] mt-4 mb-2">폰트 조합 세트</h3>
                <div className="space-y-1.5">
                  {fontSets.map((set) => (
                    <button
                      key={set.name}
                      onClick={() => applyFontSet(set)}
                      className="w-full text-left px-2.5 py-2 rounded-lg border border-[#EBE5DA] hover:border-[#C18C5D] hover:bg-[#FAF7F2]"
                    >
                      <p className="text-[12px] font-bold text-[#2C2520]" style={{ fontFamily: set.title }}>
                        {set.name}
                      </p>
                      <p className="text-[10px] text-[#A89A8E]" style={{ fontFamily: set.body }}>
                        제목과 본문이 어울리는 조합
                      </p>
                    </button>
                  ))}
                </div>

                {selectedElement && selectedElement.type === 'text' && (
                  <div className="mt-4 space-y-3 border-t border-[#EBE5DA] pt-3">
                    <select
                      value={selectedElement.fontFamily}
                      onChange={(e) => patchElement(selectedElement.id, { fontFamily: e.target.value })}
                      className="w-full bg-white border border-[#EBE5DA] rounded-lg px-2 py-1.5 text-[11px]"
                    >
                      {FONT_OPTIONS.map((f) => (
                        <option key={f.label} value={f.value}>
                          {f.label}
                        </option>
                      ))}
                    </select>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        value={selectedElement.fontSize || 28}
                        onChange={(e) => patchElement(selectedElement.id, { fontSize: Number(e.target.value) }, { history: false })}
                        className="w-16 border border-[#EBE5DA] rounded-lg px-2 py-1 text-[11px]"
                      />
                      <button
                        onClick={() => patchElement(selectedElement.id, { fontWeight: (selectedElement.fontWeight || 400) >= 700 ? 400 : 800 })}
                        className={`p-1.5 rounded-lg border ${(selectedElement.fontWeight || 400) >= 700 ? 'bg-[#F4EFE6] border-[#C18C5D]' : 'border-[#EBE5DA]'}`}
                      >
                        <Bold className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => patchElement(selectedElement.id, { italic: !selectedElement.italic })}
                        className={`p-1.5 rounded-lg border ${selectedElement.italic ? 'bg-[#F4EFE6] border-[#C18C5D]' : 'border-[#EBE5DA]'}`}
                      >
                        <Italic className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => patchElement(selectedElement.id, { underline: !selectedElement.underline })}
                        className={`p-1.5 rounded-lg border ${selectedElement.underline ? 'bg-[#F4EFE6] border-[#C18C5D]' : 'border-[#EBE5DA]'}`}
                      >
                        <Underline className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="flex items-center gap-1">
                      {[
                        { v: 'left' as const, icon: AlignLeft },
                        { v: 'center' as const, icon: AlignCenter },
                        { v: 'right' as const, icon: AlignRight },
                      ].map((a) => (
                        <button
                          key={a.v}
                          onClick={() => patchElement(selectedElement.id, { align: a.v })}
                          className={`p-1.5 rounded-lg border ${selectedElement.align === a.v ? 'bg-[#F4EFE6] border-[#C18C5D]' : 'border-[#EBE5DA]'}`}
                        >
                          <a.icon className="w-3.5 h-3.5" />
                        </button>
                      ))}
                    </div>
                    <div>
                      <p className="text-[10px] text-[#7A6A5C] mb-1">글자색</p>
                      <div className="flex flex-wrap gap-1">
                        {textColorChoices.map((color) => (
                          <button
                            key={color}
                            onClick={() => patchElement(selectedElement.id, { color })}
                            className="w-6 h-6 rounded-md border border-[#D9D2C6]"
                            style={{ background: color }}
                          />
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-[10px] text-[#7A6A5C] mb-1">배경 하이라이트</p>
                      <div className="flex flex-wrap gap-1">
                        <button
                          onClick={() => patchElement(selectedElement.id, { highlight: undefined })}
                          className="px-2 h-6 rounded-md border border-[#D9D2C6] text-[9px]"
                        >
                          없음
                        </button>
                        {fillChoices.map((color) => (
                          <button
                            key={color}
                            onClick={() => patchElement(selectedElement.id, { highlight: color })}
                            className="w-6 h-6 rounded-md border border-[#D9D2C6]"
                            style={{ background: color }}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {panelTab === 'images' && (
              <div className="p-3">
                <h3 className="text-[11px] font-bold uppercase tracking-wide text-[#7A6A5C] mb-2">업로드</h3>
                <button
                  onClick={() => imageInputRef.current?.click()}
                  className="w-full border-2 border-dashed border-[#D9D2C6] rounded-xl py-6 flex flex-col items-center gap-1 hover:border-[#C18C5D] hover:bg-[#FAF7F2]"
                  data-testid="image-upload"
                >
                  <Upload className="w-5 h-5 text-[#C18C5D]" />
                  <span className="text-[11px] font-bold text-[#3E2723]">내 컴퓨터에서 업로드</span>
                  <span className="text-[9px] text-[#A89A8E]">PNG · JPG · SVG (4MB 이하)</span>
                </button>

                <h3 className="text-[11px] font-bold uppercase tracking-wide text-[#7A6A5C] mt-4 mb-2">샘플 이미지</h3>
                <div className="grid grid-cols-2 gap-2">
                  {SAMPLE_IMAGES.map((img) => (
                    <button key={img.label} onClick={() => addImage(img.url)} className="rounded-lg overflow-hidden border border-[#EBE5DA] hover:border-[#C18C5D]">
                      <img src={img.url} alt={img.label} className="w-full h-16 object-cover" />
                      <p className="text-[9px] text-[#5C5046] py-1">{img.label}</p>
                    </button>
                  ))}
                </div>

                {selectedElement?.type === 'image' && (
                  <div className="mt-4 space-y-3 border-t border-[#EBE5DA] pt-3">
                    <h3 className="text-[11px] font-bold uppercase tracking-wide text-[#7A6A5C]">이미지 조정</h3>
                    <label className="block text-[10px] text-[#7A6A5C]">
                      투명도 {Math.round((selectedElement.opacity ?? 1) * 100)}%
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={Math.round((selectedElement.opacity ?? 1) * 100)}
                        onChange={(e) => patchElement(selectedElement.id, { opacity: Number(e.target.value) / 100 }, { history: false })}
                        className="w-full accent-[#C18C5D]"
                      />
                    </label>
                    <label className="block text-[10px] text-[#7A6A5C]">
                      모서리 둥글기 {selectedElement.radius || 0}px
                      <input
                        type="range"
                        min={0}
                        max={200}
                        value={selectedElement.radius || 0}
                        onChange={(e) => patchElement(selectedElement.id, { radius: Number(e.target.value) }, { history: false })}
                        className="w-full accent-[#C18C5D]"
                      />
                    </label>
                    <button
                      onClick={() => replaceImageInputRef.current?.click()}
                      className="w-full py-1.5 rounded-lg border border-[#EBE5DA] text-[10.5px] font-semibold hover:bg-[#FAF7F2]"
                    >
                      다른 이미지로 교체
                    </button>
                  </div>
                )}
              </div>
            )}

            {panelTab === 'background' && (
              <div className="p-3">
                <h3 className="text-[11px] font-bold uppercase tracking-wide text-[#7A6A5C] mb-2">단색</h3>
                <div className="grid grid-cols-6 gap-1.5">
                  {[...PALETTES.map((p) => p.bg), '#FFFFFF', '#111827', '#FDF2F8', '#ECFDF5', '#FEF3C7', '#E0F2FE'].map((color) => (
                    <button
                      key={color}
                      onClick={() => updateSlide((s) => ({ ...s, background: { type: 'solid', color } }))}
                      className="h-7 rounded-md border border-[#D9D2C6]"
                      style={{ background: color }}
                    />
                  ))}
                </div>

                <h3 className="text-[11px] font-bold uppercase tracking-wide text-[#7A6A5C] mt-4 mb-2">그라데이션</h3>
                <div className="grid grid-cols-3 gap-1.5">
                  {GRADIENTS.map((g) => (
                    <button
                      key={g.id}
                      onClick={() => updateSlide((s) => ({ ...s, background: { type: 'gradient', gradient: g.value } }))}
                      className="h-12 rounded-lg border border-[#D9D2C6]"
                      style={{ background: g.value }}
                    />
                  ))}
                </div>

                <h3 className="text-[11px] font-bold uppercase tracking-wide text-[#7A6A5C] mt-4 mb-2">이미지 배경</h3>
                <button
                  onClick={() => bgInputRef.current?.click()}
                  className="w-full py-2 rounded-lg border border-dashed border-[#D9D2C6] text-[10.5px] font-semibold text-[#5C5046] hover:border-[#C18C5D]"
                >
                  배경 이미지 업로드
                </button>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  {SAMPLE_IMAGES.map((img) => (
                    <button
                      key={img.label}
                      onClick={() => updateSlide((s) => ({ ...s, background: { type: 'image', imageUrl: img.url } }))}
                      className="rounded-lg overflow-hidden border border-[#EBE5DA]"
                    >
                      <img src={img.url} alt={img.label} className="w-full h-12 object-cover" />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* CANVAS + THUMBNAILS */}
        <div className="flex-1 flex flex-col min-w-0">
          <div
            ref={scrollAreaRef}
            className="flex-1 overflow-auto bg-[#EDE7DC] flex items-center justify-center p-6"
            onMouseDown={() => {
              setSelectedIds([]);
              setEditingId(null);
            }}
          >
            <div style={{ width: SLIDE_W * scale, height: SLIDE_H * scale, flex: '0 0 auto' }} className="relative shadow-2xl">
              <div
                ref={canvasRef}
                data-testid="slide-canvas"
                style={{
                  width: SLIDE_W,
                  height: SLIDE_H,
                  transform: `scale(${scale})`,
                  transformOrigin: 'top left',
                  position: 'relative',
                  overflow: 'hidden',
                }}
                className="rounded-sm"
              >
                <SlideView slide={slide} showElements={false} />

                {/* interactive element layers */}
                {slide.elements.map((el) => (
                  <div
                    key={el.id}
                    data-elid={el.id}
                    onMouseDown={(e) => beginElementDrag(e, el)}
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      if (el.type === 'text' || el.type === 'badge') {
                        setSelectedIds([el.id]);
                        setEditingId(el.id);
                      }
                    }}
                    style={{
                      position: 'absolute',
                      left: el.x,
                      top: el.y,
                      width: el.w,
                      height: el.h,
                      transform: `rotate(${el.rotation || 0}deg)`,
                      opacity: el.opacity ?? 1,
                      cursor: el.locked ? 'default' : 'move',
                    }}
                  >
                    <ElementVisual el={el} />
                  </div>
                ))}

                {/* selection outlines & handles */}
                {slide.elements
                  .filter((el) => selectedIds.includes(el.id))
                  .map((el) => {
                    const isPrimary = el.id === selectedIds[0];
                    return (
                      <div
                        key={`sel_${el.id}`}
                        style={{
                          position: 'absolute',
                          left: el.x,
                          top: el.y,
                          width: el.w,
                          height: el.h,
                          transform: `rotate(${el.rotation || 0}deg)`,
                          pointerEvents: 'none',
                          zIndex: 40,
                        }}
                      >
                        <div
                          style={{
                            position: 'absolute',
                            inset: 0,
                            border: `2px solid #0EA5E9`,
                            borderRadius: 2,
                            boxShadow: '0 0 0 1px rgba(255,255,255,0.7) inset',
                          }}
                        />
                        {isPrimary && !el.locked && (
                          <>
                            <div
                              onMouseDown={(e) => beginRotate(e, el)}
                              style={{
                                position: 'absolute',
                                left: '50%',
                                top: -36,
                                width: 16,
                                height: 16,
                                marginLeft: -8,
                                borderRadius: '50%',
                                background: '#FFFFFF',
                                border: '2px solid #0EA5E9',
                                cursor: 'grab',
                                pointerEvents: 'auto',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                              title="회전"
                            >
                              <RotateCw style={{ width: 9, height: 9, color: '#0EA5E9' }} />
                            </div>
                            {HANDLES.map((h) => (
                              <div
                                key={h.key}
                                data-handle={h.key}
                                onMouseDown={(e) => beginResize(e, el, h.key)}
                                style={{
                                  position: 'absolute',
                                  left: `${h.x * 100}%`,
                                  top: `${h.y * 100}%`,
                                  width: 11,
                                  height: 11,
                                  marginLeft: -6,
                                  marginTop: -6,
                                  background: '#FFFFFF',
                                  border: '2px solid #0EA5E9',
                                  borderRadius: 2,
                                  cursor: h.cursor,
                                  pointerEvents: 'auto',
                                }}
                              />
                            ))}
                          </>
                        )}
                      </div>
                    );
                  })}

                {/* alignment guides */}
                {guides.v.map((x, i) => (
                  <div key={`gv${i}`} style={{ position: 'absolute', left: x, top: 0, width: 1, height: SLIDE_H, background: '#F43F5E', zIndex: 45, pointerEvents: 'none' }} />
                ))}
                {guides.h.map((y, i) => (
                  <div key={`gh${i}`} style={{ position: 'absolute', top: y, left: 0, height: 1, width: SLIDE_W, background: '#F43F5E', zIndex: 45, pointerEvents: 'none' }} />
                ))}

                {/* inline text editing */}
                {editingId &&
                  (() => {
                    const el = slide.elements.find((item) => item.id === editingId);
                    if (!el) return null;
                    return (
                      <textarea
                        data-testid="slide-text-editor"
                        autoFocus
                        value={el.text || ''}
                        onChange={(e) => patchElement(el.id, { text: e.target.value }, { history: false })}
                        onBlur={() => setEditingId(null)}
                        onMouseDown={(e) => e.stopPropagation()}
                        style={{
                          position: 'absolute',
                          left: el.x,
                          top: el.y,
                          width: el.w,
                          height: el.h,
                          transform: `rotate(${el.rotation || 0}deg)`,
                          color: el.color,
                          fontFamily: el.fontFamily,
                          fontSize: el.fontSize,
                          fontWeight: el.fontWeight,
                          fontStyle: el.italic ? 'italic' : 'normal',
                          textDecoration: el.underline ? 'underline' : 'none',
                          textAlign: el.align,
                          lineHeight: el.lineHeight,
                          background: 'rgba(255,255,255,0.06)',
                          outline: '2px dashed #0EA5E9',
                          resize: 'none',
                          padding: 4,
                          zIndex: 50,
                        }}
                      />
                    );
                  })()}
              </div>
            </div>
          </div>

          {/* NOTES */}
          {notesOpen && (
            <div className="h-24 bg-white border-t border-[#EBE5DA] px-3 py-2 flex gap-2 shrink-0">
              <div className="flex items-center gap-1 text-[10px] font-bold text-[#7A6A5C] w-24 shrink-0">
                <StickyNote className="w-3.5 h-3.5" />
                발표자 노트
              </div>
              <textarea
                value={slide.notes}
                onChange={(e) => updateSlide((s) => ({ ...s, notes: e.target.value }), { history: false, key: `notes_${slide.id}` })}
                placeholder="이 슬라이드에서 말할 내용을 적어두세요. 발표 중 N 키로 확인할 수 있습니다."
                className="flex-1 resize-none text-[11px] text-[#3E2723] bg-[#FAF7F2] border border-[#EBE5DA] rounded-lg px-2 py-1.5 outline-none focus:border-[#C18C5D]"
              />
            </div>
          )}

          {/* THUMBNAIL STRIP */}
          <div className="h-32 bg-[#F7F3EC] border-t border-[#EBE5DA] flex items-center gap-2 px-3 overflow-x-auto shrink-0">
            <button
              onClick={addSlide}
              data-testid="add-slide"
              className="w-16 h-20 shrink-0 rounded-lg border-2 border-dashed border-[#C9BFAF] flex flex-col items-center justify-center gap-1 text-[9px] font-bold text-[#7A6A5C] hover:border-[#F4B400] hover:text-[#F4B400]"
            >
              <Plus className="w-4 h-4" />
              추가
            </button>
            {slides.map((s, i) => (
              <div
                key={s.id}
                draggable
                onDragStart={() => {
                  dragSlideThumb.current = i;
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOverIndex(i);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  if (dragSlideThumb.current !== null) reorderSlide(dragSlideThumb.current, i);
                  dragSlideThumb.current = null;
                  setDragOverIndex(null);
                }}
                onDragEnd={() => {
                  dragSlideThumb.current = null;
                  setDragOverIndex(null);
                }}
                onClick={() => {
                  setCurrentIndex(i);
                  setSelectedIds([]);
                  setEditingId(null);
                }}
                className={`relative group shrink-0 rounded-lg overflow-hidden border-2 transition-all cursor-pointer ${
                  i === currentIndex ? 'border-[#F4B400] shadow-md' : dragOverIndex === i ? 'border-[#0EA5E9]' : 'border-[#DDD5C7] hover:border-[#C18C5D]'
                }`}
                style={{ width: 112, height: 63 }}
                data-testid={`slide-thumb-${i}`}
              >
                <div style={{ width: SLIDE_W, height: SLIDE_H, transform: 'scale(0.0875)', transformOrigin: 'top left', pointerEvents: 'none' }}>
                  <SlideView slide={s} />
                </div>
                <span className="absolute bottom-0.5 left-1 text-[8px] font-bold text-white bg-black/45 px-1 rounded">{i + 1}</span>
                <div className="absolute top-0.5 right-0.5 flex gap-0.5 opacity-0 group-hover:opacity-100">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      reorderSlide(i, i - 1);
                    }}
                    className="p-0.5 rounded bg-white/90 text-[#5C5046]"
                    title="앞으로"
                  >
                    <ChevronLeft className="w-2.5 h-2.5" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      reorderSlide(i, i + 1);
                    }}
                    className="p-0.5 rounded bg-white/90 text-[#5C5046]"
                    title="뒤로"
                  >
                    <ChevronRight className="w-2.5 h-2.5" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteSlide(i);
                    }}
                    className="p-0.5 rounded bg-white/90 text-[#DC2626]"
                    title="삭제"
                  >
                    <Trash2 className="w-2.5 h-2.5" />
                  </button>
                </div>
              </div>
            ))}
            <div className="shrink-0 flex flex-col gap-1 ml-1">
              <button onClick={duplicateSlide} className="px-2 py-1 rounded-lg bg-white border border-[#EBE5DA] text-[9px] font-semibold text-[#5C5046]" title="현재 슬라이드 복제">
                복제
              </button>
              <button onClick={addSlide} className="px-2 py-1 rounded-lg bg-white border border-[#EBE5DA] text-[9px] font-semibold text-[#5C5046]">
                새 슬라이드
              </button>
            </div>
          </div>
        </div>

        {/* INSPECTOR — 항상 자리를 차지해 요소 선택 시 캔버스가 밀리지 않게 한다 */}
        <div className="w-56 bg-white border-l border-[#EBE5DA] overflow-y-auto shrink-0 hidden xl:block p-3">
          {!selectedElement && (
            <div className="text-[10px] text-[#A89A8E] leading-relaxed">
              <h3 className="text-[11px] font-bold uppercase tracking-wide text-[#7A6A5C] mb-2">요소 속성</h3>
              캔버스에서 요소를 선택하면 위치·크기·회전·레이어를 여기서 조정할 수 있습니다.
              <div className="mt-3 p-2 rounded-lg bg-[#FAF7F2] border border-[#EBE5DA]">
                <p className="font-bold text-[#5C5046] mb-1">빠른 조작</p>
                드래그 이동 · 핸들 크기 조절 · 상단 핸들 회전
                <br />
                Ctrl+D 복제 · Delete 삭제 · Ctrl+Z 되돌리기
              </div>
            </div>
          )}
          {selectedElement && (
            <>
            <h3 className="text-[11px] font-bold uppercase tracking-wide text-[#7A6A5C] mb-2">요소 속성</h3>
            <div className="grid grid-cols-2 gap-1.5">
              {[
                { label: 'X', key: 'x' as const },
                { label: 'Y', key: 'y' as const },
                { label: 'W', key: 'w' as const },
                { label: 'H', key: 'h' as const },
              ].map((field) => (
                <label key={field.key} className="text-[9px] text-[#A89A8E]">
                  {field.label}
                  <input
                    type="number"
                    value={Math.round(selectedElement[field.key])}
                    onChange={(e) => patchElement(selectedElement.id, { [field.key]: Number(e.target.value) } as Partial<SlideElement>, { history: false })}
                    className="w-full border border-[#EBE5DA] rounded-md px-1.5 py-1 text-[10px] text-[#2C2520]"
                  />
                </label>
              ))}
            </div>
            <label className="block text-[9px] text-[#A89A8E] mt-2">
              회전 {Math.round(selectedElement.rotation || 0)}°
              <input
                type="range"
                min={0}
                max={359}
                value={Math.round(selectedElement.rotation || 0)}
                onChange={(e) => patchElement(selectedElement.id, { rotation: Number(e.target.value) }, { history: false })}
                className="w-full accent-[#C18C5D]"
              />
            </label>
            <label className="block text-[9px] text-[#A89A8E] mt-2">
              투명도 {Math.round((selectedElement.opacity ?? 1) * 100)}%
              <input
                type="range"
                min={0}
                max={100}
                value={Math.round((selectedElement.opacity ?? 1) * 100)}
                onChange={(e) => patchElement(selectedElement.id, { opacity: Number(e.target.value) / 100 }, { history: false })}
                className="w-full accent-[#C18C5D]"
              />
            </label>

            <h3 className="text-[11px] font-bold uppercase tracking-wide text-[#7A6A5C] mt-4 mb-2">레이어</h3>
            <div className="grid grid-cols-2 gap-1.5">
              <button onClick={() => reorderElement('front')} className="flex items-center gap-1 px-2 py-1.5 rounded-lg border border-[#EBE5DA] text-[9.5px] font-semibold hover:bg-[#FAF7F2]">
                <BringToFront className="w-3 h-3" /> 맨 앞
              </button>
              <button onClick={() => reorderElement('forward')} className="flex items-center gap-1 px-2 py-1.5 rounded-lg border border-[#EBE5DA] text-[9.5px] font-semibold hover:bg-[#FAF7F2]">
                <MoveUp className="w-3 h-3" /> 앞으로
              </button>
              <button onClick={() => reorderElement('backward')} className="flex items-center gap-1 px-2 py-1.5 rounded-lg border border-[#EBE5DA] text-[9.5px] font-semibold hover:bg-[#FAF7F2]">
                <MoveDown className="w-3 h-3" /> 뒤로
              </button>
              <button onClick={() => reorderElement('back')} className="flex items-center gap-1 px-2 py-1.5 rounded-lg border border-[#EBE5DA] text-[9.5px] font-semibold hover:bg-[#FAF7F2]">
                <SendToBack className="w-3 h-3" /> 맨 뒤
              </button>
            </div>
            <div className="grid grid-cols-2 gap-1.5 mt-2">
              <button onClick={duplicateSelected} className="flex items-center gap-1 px-2 py-1.5 rounded-lg border border-[#EBE5DA] text-[9.5px] font-semibold hover:bg-[#FAF7F2]">
                <Copy className="w-3 h-3" /> 복제
              </button>
              <button onClick={removeSelected} className="flex items-center gap-1 px-2 py-1.5 rounded-lg border border-[#FCA5A5] text-[9.5px] font-semibold text-[#DC2626] hover:bg-[#FEF2F2]">
                <Trash2 className="w-3 h-3" /> 삭제
              </button>
            </div>
            <button
              onClick={() => patchElement(selectedElement.id, { locked: !selectedElement.locked })}
              className="w-full mt-2 flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg border border-[#EBE5DA] text-[9.5px] font-semibold hover:bg-[#FAF7F2]"
            >
              {selectedElement.locked ? <Unlock className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
              {selectedElement.locked ? '잠금 해제' : '요소 잠금'}
            </button>
            <p className="text-[9px] text-[#A89A8E] mt-3 leading-relaxed">
              더블클릭으로 텍스트 편집 · Delete 삭제 · Ctrl+D 복제 · 화살표 미세 이동
            </p>
            </>
          )}
        </div>
      </div>

      {/* PRESENTATION */}
      {presenting && (
        <div
          id="nexus-presentation"
          data-testid="presentation"
          className="fixed inset-0 z-[70] bg-black flex items-center justify-center"
          onClick={(e) => {
            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
            if (e.clientX - rect.left > rect.width / 2) setPresentIndex((i) => Math.min(slides.length - 1, i + 1));
            else setPresentIndex((i) => Math.max(0, i - 1));
          }}
        >
          <div
            key={`${currentSlideForPresent.id}_${presentIndex}`}
            className={
              currentSlideForPresent.transition === 'fade'
                ? 'slide-anim-fade'
                : currentSlideForPresent.transition === 'slide'
                ? 'slide-anim-push'
                : ''
            }
            style={{ width: SLIDE_W * presentScale, height: SLIDE_H * presentScale }}
          >
            <div style={{ width: SLIDE_W, height: SLIDE_H, transform: `scale(${presentScale})`, transformOrigin: 'top left' }}>
              <SlideView slide={currentSlideForPresent} />
            </div>
          </div>

          <div className="absolute top-4 left-4 flex items-center gap-3 text-white/80 text-xs font-semibold">
            <span className="flex items-center gap-1 bg-white/10 px-2.5 py-1 rounded-full">
              <Timer className="w-3.5 h-3.5" />
              {String(Math.floor(elapsed / 60)).padStart(2, '0')}:{String(elapsed % 60).padStart(2, '0')}
            </span>
            <span className="bg-white/10 px-2.5 py-1 rounded-full">
              {presentIndex + 1} / {slides.length}
            </span>
          </div>

          {showNotes && (
            <div className="absolute bottom-16 left-1/2 -translate-x-1/2 max-w-3xl w-[80%] bg-black/70 backdrop-blur text-white text-xs p-3 rounded-xl whitespace-pre-wrap">
              {currentSlideForPresent.notes || '이 슬라이드에 저장된 발표자 노트가 없습니다.'}
            </div>
          )}

          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setPresentIndex((i) => Math.max(0, i - 1))}
              className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={() => setShowNotes((v) => !v)}
              className="px-3 py-2 rounded-full bg-white/10 hover:bg-white/20 text-white text-[11px] font-semibold"
            >
              노트 (N)
            </button>
            <button
              onClick={() => setPresentIndex((i) => Math.min(slides.length - 1, i + 1))}
              className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
            <button onClick={() => setPresenting(false)} className="ml-2 p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white" title="종료 (Esc)">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* PRINT ROOT (인쇄/PDF) */}
      <div id="nexus-slide-print">
        {slides.map((s) => (
          <div key={`print_${s.id}`} className="print-slide">
            <div className="print-canvas">
              <SlideView slide={s} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
