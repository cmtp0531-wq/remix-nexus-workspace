// ============================================================
// 계정(스코프)별 로컬 저장소
// - 테마·글씨체·말풍선 색·알림·Gemini 키/모델·대화·문서 등 사용자 데이터를
//   계정(Google uid, 게스트는 'guest')마다 완전히 분리해 저장합니다.
// - 저장 키 형태:  "workchat_messages_v6::<uid>"  /  "nexus_theme_v1::guest"
// - 예전(전역 키) 데이터는 스코프를 처음 만들 때 한 번 복사해 잃지 않게 합니다.
// ============================================================

export const GUEST_SCOPE = 'guest';

const ACTIVE_SCOPE_KEY = 'workchat_active_scope_v1';
const SEEDED_MARK = 'nexus_scope_seeded';

/** 예전 버전이 전역 키로 저장하던 값들 (스코프 분리 전 데이터) */
const LEGACY_KEYS = [
  'workchat_users_v6',
  'workchat_current_user_v6',
  'workchat_spaces_v6',
  'workchat_messages_v6',
  'workchat_tasks_v6',
  'gchat_real_requests_v6',
  'gchat_real_friendships_v6',
  'gchat_real_drive_docs_v6',
  'gchat_real_calendar_events_v6',
  'nexus_hidden_messages_v1',
  'nexus_theme_v1',
  'nexus_bubble_colors_v1',
  'nexus_bubble_custom_v1',
  'nexus_font_v1',
  'nexus_snow_v1',
  'workchat_gemini_api_key_v1',
  'workchat_gemini_model_v1',
  'workchat_reminders_v1',
  'workchat_notifications_enabled_v1',
  'workchat_guest_banner_dismissed',
];

const canUseStorage = () => typeof window !== 'undefined' && Boolean(window.localStorage);

const readActiveScope = (): string => {
  try {
    return localStorage.getItem(ACTIVE_SCOPE_KEY) || GUEST_SCOPE;
  } catch {
    return GUEST_SCOPE;
  }
};

let activeScope = canUseStorage() ? readActiveScope() : GUEST_SCOPE;

/** 지금 화면이 사용 중인 계정 스코프 ('guest' 또는 Google uid) */
export const getAccountScope = (): string => activeScope || GUEST_SCOPE;

/** 계정 스코프를 바꿉니다. (로그인·로그아웃·계정 전환 시) */
export const setAccountScope = (scope: string): string => {
  const next = (scope || GUEST_SCOPE).trim() || GUEST_SCOPE;
  activeScope = next;
  if (canUseStorage()) {
    try {
      localStorage.setItem(ACTIVE_SCOPE_KEY, next);
    } catch {
      /* 저장 실패해도 이번 세션은 새 스코프로 동작 */
    }
  }
  ensureScopeSeeded(next);
  return next;
};

/** 계정별 저장 키 */
export const scopedKey = (base: string, scope?: string): string => `${base}::${scope || getAccountScope()}`;

/** 계정별 값 읽기 (없으면 null) */
export const scopedGet = (base: string, scope?: string): string | null => {
  if (!canUseStorage()) return null;
  try {
    return localStorage.getItem(scopedKey(base, scope));
  } catch {
    return null;
  }
};

/** 계정별 값 쓰기 */
export const scopedSet = (base: string, value: string, scope?: string): void => {
  if (!canUseStorage()) return;
  try {
    localStorage.setItem(scopedKey(base, scope), value);
  } catch {
    /* ignore */
  }
};

/** 계정별 값 지우기 */
export const scopedRemove = (base: string, scope?: string): void => {
  if (!canUseStorage()) return;
  try {
    localStorage.removeItem(scopedKey(base, scope));
  } catch {
    /* ignore */
  }
};

/**
 * 스코프를 처음 만들 때 예전 전역 데이터를 한 번 복사합니다.
 * (계정을 분리해도 기존 대화·설정이 사라져 보이지 않게)
 */
export const ensureScopeSeeded = (scope?: string): void => {
  if (!canUseStorage()) return;
  const target = scope || getAccountScope();
  const markKey = `${SEEDED_MARK}::${target}`;
  try {
    if (localStorage.getItem(markKey) === '1') return;
    LEGACY_KEYS.forEach((base) => {
      const legacy = localStorage.getItem(base);
      if (legacy === null) return;
      if (localStorage.getItem(`${base}::${target}`) === null) {
        localStorage.setItem(`${base}::${target}`, legacy);
      }
    });
    localStorage.setItem(markKey, '1');
  } catch {
    /* ignore */
  }
};

/** 이 계정에 저장된 모든 항목 삭제 (로그아웃 시 개인정보를 기기에 남기지 않음) */
export const clearScope = (scope?: string): void => {
  if (!canUseStorage()) return;
  const target = scope || getAccountScope();
  const suffix = `::${target}`;
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (key && key.endsWith(suffix)) keys.push(key);
    }
    keys.forEach((key) => localStorage.removeItem(key));
    localStorage.removeItem(`${SEEDED_MARK}::${target}`);
  } catch {
    /* ignore */
  }
};

/** 현재 스코프에서 저장된 키 목록 (백업/복원용) */
export const listScopeKeys = (scope?: string): string[] => {
  if (!canUseStorage()) return [];
  const suffix = `::${scope || getAccountScope()}`;
  const keys: string[] = [];
  try {
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (key && key.endsWith(suffix)) keys.push(key);
    }
  } catch {
    /* ignore */
  }
  return keys;
};

// 앱 시작 시 현재 스코프가 예전 데이터를 이어받도록 합니다.
ensureScopeSeeded();
