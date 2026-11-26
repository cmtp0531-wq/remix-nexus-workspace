// ============================================================
// 테마별 버튼 아이콘 매핑
// - 테마(우주비행사·고양이·크리스마스 …)를 고르면 앱 안의 주요 버튼 아이콘도
//   그 테마의 컨셉 아이콘으로 바뀝니다. (예: 우주비행사 → 전송 = 로켓)
// - 매핑은 이 파일 한 곳에서만 관리합니다.
// ============================================================
import React from 'react';
import {
  Bell,
  BellRing,
  Bone,
  BookOpen,
  Calendar,
  CalendarClock,
  CalendarDays,
  Cat,
  Compass,
  Dog,
  Fish,
  Flame,
  Gift,
  Globe,
  HardDrive,
  Heart,
  Leaf,
  ListChecks,
  MapPin,
  Mic,
  Moon,
  Orbit,
  Package,
  Palette,
  Plane,
  Paperclip,
  PawPrint,
  Play,
  Radio,
  Rocket,
  Satellite,
  Search,
  Send,
  Settings,
  Settings2,
  Smile,
  Snowflake,
  CloudSnow,
  Sparkles,
  Star,
  StickyNote,
  Telescope,
  TreePine,
  Tv,
  Users,
  Video,
  Vote,
  Waves,
  Youtube,
  type LucideIcon,
} from 'lucide-react';
import { getTheme } from './theme';

export type ThemeIconKey =
  | 'send'
  | 'poll'
  | 'calendar'
  | 'tasks'
  | 'location'
  | 'youtube'
  | 'mic'
  | 'attach'
  | 'emoji'
  | 'search'
  | 'settings'
  | 'notify'
  | 'canvas'
  | 'meet'
  | 'drive'
  | 'ai'
  | 'theme'
  | 'contacts'
  | 'star';

/** 어떤 테마에서도 쓰이는 기본 아이콘 */
export const BASE_THEME_ICONS: Record<ThemeIconKey, LucideIcon> = {
  send: Send,
  poll: Vote,
  calendar: Calendar,
  tasks: ListChecks,
  location: MapPin,
  youtube: Youtube,
  mic: Mic,
  attach: Paperclip,
  emoji: Smile,
  search: Search,
  settings: Settings,
  notify: Bell,
  canvas: BookOpen,
  meet: Video,
  drive: HardDrive,
  ai: Sparkles,
  theme: Palette,
  contacts: Users,
  star: Star,
};

/** 테마별로 바뀌는 아이콘만 지정 (나머지는 기본값 유지) */
export const THEME_ICON_OVERRIDES: Record<string, Partial<Record<ThemeIconKey, LucideIcon>>> = {
  // ── 우주비행사: 로켓·궤도·위성·망원경 ──
  astro: {
    send: Rocket,
    poll: Orbit,
    calendar: Orbit,
    tasks: ListChecks,
    location: Globe,
    youtube: Tv,
    mic: Radio,
    attach: Package,
    emoji: Sparkles,
    search: Telescope,
    settings: Settings2,
    notify: Star,
    canvas: BookOpen,
    meet: Satellite,
    drive: Package,
    ai: Sparkles,
    theme: Palette,
    star: Star,
  },
  // ── 우주(코스모스): 별·혜성·유성우 ──
  space: {
    send: Rocket,
    poll: Star,
    calendar: Orbit,
    tasks: Star,
    location: Globe,
    youtube: Tv,
    mic: Radio,
    attach: Package,
    emoji: Sparkles,
    search: Telescope,
    settings: Settings2,
    notify: Star,
    canvas: BookOpen,
    meet: Satellite,
    star: Star,
  },
  // ── 오로라: 별빛·나침반·물결 ──
  aurora: {
    send: Send,
    poll: Star,
    calendar: CalendarClock,
    tasks: Star,
    location: Compass,
    youtube: Play,
    mic: Waves,
    attach: Paperclip,
    emoji: Sparkles,
    search: Search,
    settings: Settings2,
    notify: Bell,
    star: Star,
  },
  // ── 고양이: 물고기·발바닥·실타래 ──
  cat: {
    send: Fish,
    poll: PawPrint,
    calendar: CalendarDays,
    tasks: ListChecks,
    location: MapPin,
    youtube: Play,
    mic: Mic,
    attach: Paperclip,
    emoji: Cat,
    search: Search,
    settings: Settings,
    notify: Bell,
    canvas: StickyNote,
    star: Heart,
  },
  // ── 강아지: 뼈다귀·발자국 ──
  puppy: {
    send: Bone,
    poll: PawPrint,
    calendar: CalendarDays,
    tasks: ListChecks,
    location: MapPin,
    youtube: Play,
    mic: Mic,
    attach: Paperclip,
    emoji: Dog,
    search: Search,
    settings: Settings,
    notify: Bell,
    star: Heart,
  },
  // ── 크리스마스: 선물·눈사람·트리·방울 ──
  xmas: {
    send: Gift,
    poll: Gift,
    calendar: CalendarDays,
    tasks: ListChecks,
    location: MapPin,
    youtube: Play,
    mic: Mic,
    attach: Gift,
    emoji: CloudSnow,
    search: Search,
    settings: Settings,
    notify: BellRing,
    canvas: TreePine,
    star: Star,
  },
  // ── 겨울: 눈결정 ──
  winter: {
    send: Snowflake,
    poll: Snowflake,
    calendar: CalendarDays,
    tasks: ListChecks,
    location: MapPin,
    youtube: Tv,
    mic: Mic,
    attach: Paperclip,
    emoji: Snowflake,
    search: Search,
    settings: Settings,
    notify: Bell,
    star: Snowflake,
  },
  // ── 동글 파스텔: 종이비행기·하트 ──
  bubble: {
    send: Plane,
    poll: Heart,
    calendar: CalendarDays,
    tasks: ListChecks,
    location: MapPin,
    youtube: Play,
    mic: Mic,
    attach: Paperclip,
    emoji: Smile,
    search: Search,
    settings: Settings,
    notify: Bell,
    star: Heart,
  },
  // ── 라벤더: 하트 포인트 ──
  lavender: {
    send: Send,
    poll: Heart,
    emoji: Smile,
    star: Heart,
  },
  // ── 선셋: 불꽃 ──
  sunset: {
    send: Flame,
    poll: Flame,
    star: Star,
  },
  // ── 포레스트: 나뭇잎 ──
  forest: {
    send: Leaf,
    poll: Leaf,
    star: Star,
  },
  // ── 미드나잇: 달 ──
  midnight: {
    send: Moon,
    poll: Star,
    notify: Moon,
    star: Star,
  },
  // ── 노을 도시: 따뜻한 노을 포인트 ──
  city: {
    send: Send,
    poll: Star,
    calendar: CalendarDays,
    location: MapPin,
    youtube: Play,
    emoji: Smile,
    notify: Bell,
    star: Star,
  },
  // ── 시크 블랙·다크·기본: 모던 기본 세트 그대로 ──
  chic: { send: Send, emoji: Smile, star: Star },
  dark: { send: Send, emoji: Smile, star: Star },
  cream: { send: Send, emoji: Smile, star: Star },
  silver: { send: Send, emoji: Smile, star: Star },
};

export const getThemeIcons = (themeId?: string): Record<ThemeIconKey, LucideIcon> => {
  const id = themeId || getTheme();
  const overrides = THEME_ICON_OVERRIDES[id] || {};
  return { ...BASE_THEME_ICONS, ...overrides };
};

/** 테마가 바뀌면 자동으로 다시 계산되는 아이콘 세트 */
export const useThemeIcons = (): Record<ThemeIconKey, LucideIcon> => {
  const [theme, setTheme] = React.useState<string>(() => getTheme());
  React.useEffect(() => {
    const sync = () => setTheme(getTheme());
    window.addEventListener('nexus-theme-changed', sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener('nexus-theme-changed', sync);
      window.removeEventListener('storage', sync);
    };
  }, []);
  return React.useMemo(() => getThemeIcons(theme), [theme]);
};
