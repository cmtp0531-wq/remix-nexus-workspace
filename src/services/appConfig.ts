// ==========================================
// WorkChat 클라이언트 설정 저장소
// - Gemini API 키 (브라우저에서 직접 Gemini 호출)
// - (선택) 사용자 본인의 Firebase 설정 (입력하면 구글 로그인 + Firestore 동기화 활성화)
// - 값은 모두 이 브라우저의 localStorage 에만 저장됩니다.
// ==========================================

export interface FirebaseAppConfig {
  projectId: string;
  appId: string;
  apiKey: string;
  authDomain: string;
  firestoreDatabaseId?: string;
  storageBucket?: string;
  messagingSenderId?: string;
  oAuthClientId?: string;
}

const FIREBASE_KEY = 'workchat_custom_firebase_config';
const GEMINI_KEY = 'workchat_gemini_api_key_v1';
export const SETTINGS_EVENT = 'workchat-settings-changed';

const notify = () => {
  if (typeof window === 'undefined') return;
  try {
    window.dispatchEvent(new CustomEvent(SETTINGS_EVENT));
  } catch {
    /* noop */
  }
};

export const onSettingsChanged = (listener: () => void): (() => void) => {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener(SETTINGS_EVENT, listener);
  return () => window.removeEventListener(SETTINGS_EVENT, listener);
};

/* ---------------- Firebase (선택) ---------------- */

export const getStoredFirebaseConfig = (): FirebaseAppConfig | null => {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(FIREBASE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as FirebaseAppConfig;
    if (!parsed || !parsed.apiKey || !parsed.projectId) return null;
    return parsed;
  } catch {
    return null;
  }
};

export const saveStoredFirebaseConfig = (config: FirebaseAppConfig | null) => {
  if (typeof window === 'undefined') return;
  if (config) localStorage.setItem(FIREBASE_KEY, JSON.stringify(config));
  else localStorage.removeItem(FIREBASE_KEY);
  notify();
};

export const isFirebaseConfigured = (): boolean => getStoredFirebaseConfig() !== null;

/** Firebase 콘솔에서 복사한 설정 스니펫(JSON)을 파싱합니다. */
export const parseFirebaseConfigText = (text: string): FirebaseAppConfig | null => {
  const trimmed = text.trim();
  if (!trimmed) return null;

  // 1) 순수 JSON 형태
  try {
    const parsed = JSON.parse(trimmed);
    if (parsed?.apiKey && parsed?.projectId) {
      return {
        projectId: String(parsed.projectId),
        apiKey: String(parsed.apiKey),
        authDomain: String(parsed.authDomain || `${parsed.projectId}.firebaseapp.com`),
        appId: String(parsed.appId || ''),
        firestoreDatabaseId: parsed.firestoreDatabaseId ? String(parsed.firestoreDatabaseId) : undefined,
        storageBucket: parsed.storageBucket ? String(parsed.storageBucket) : undefined,
        messagingSenderId: parsed.messagingSenderId ? String(parsed.messagingSenderId) : undefined,
        oAuthClientId: parsed.oAuthClientId ? String(parsed.oAuthClientId) : undefined,
      };
    }
  } catch {
    /* fall through: JS 객체 스니펫 */
  }

  // 2) firebaseConfig = { apiKey: "...", ... } 자바스크립트 스니펫
  const pick = (key: string): string | undefined => {
    const m = trimmed.match(new RegExp(`${key}\\s*:\\s*["'\`]([^"'\`]+)["'\`]`));
    return m ? m[1] : undefined;
  };
  const apiKey = pick('apiKey');
  const projectId = pick('projectId');
  if (!apiKey || !projectId) return null;
  return {
    apiKey,
    projectId,
    authDomain: pick('authDomain') || `${projectId}.firebaseapp.com`,
    appId: pick('appId') || '',
    firestoreDatabaseId: pick('firestoreDatabaseId'),
    storageBucket: pick('storageBucket'),
    messagingSenderId: pick('messagingSenderId'),
    oAuthClientId: pick('oAuthClientId'),
  };
};

/* ---------------- Gemini API 키 ---------------- */

export const getGeminiApiKey = (): string => {
  if (typeof window === 'undefined') return '';
  return (localStorage.getItem(GEMINI_KEY) || '').trim();
};

export const saveGeminiApiKey = (key: string) => {
  if (typeof window === 'undefined') return;
  const trimmed = (key || '').trim();
  if (trimmed) localStorage.setItem(GEMINI_KEY, trimmed);
  else localStorage.removeItem(GEMINI_KEY);
  notify();
};

export const maskSecret = (value: string): string => {
  if (!value) return '';
  if (value.length <= 8) return '••••';
  return `${value.slice(0, 4)}••••${value.slice(-4)}`;
};
