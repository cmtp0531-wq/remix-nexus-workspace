// ==========================================
// WorkChat 클라이언트 설정 저장소
// - 앱에 내장된 기본 Firebase 설정을 항상 사용합니다 (설정에서 덮어쓸 수 있음).
// - Gemini API 키 / YouTube API 키는 브라우저 localStorage 에만 저장됩니다.
// ==========================================

import { DEFAULT_FIREBASE_CONFIG, DEFAULT_YOUTUBE_API_KEY } from '../config/firebase';

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
const YOUTUBE_KEY = 'workchat_youtube_api_key_v1';
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

/* ---------------- Firebase ---------------- */

const normalizeConfig = (parsed: any): FirebaseAppConfig | null => {
  if (!parsed || !parsed.apiKey || !parsed.projectId) return null;
  return {
    projectId: String(parsed.projectId),
    apiKey: String(parsed.apiKey),
    authDomain: String(parsed.authDomain || `${parsed.projectId}.firebaseapp.com`),
    appId: String(parsed.appId || ''),
    firestoreDatabaseId: parsed.firestoreDatabaseId ? String(parsed.firestoreDatabaseId) : '(default)',
    storageBucket: parsed.storageBucket ? String(parsed.storageBucket) : undefined,
    messagingSenderId: parsed.messagingSenderId ? String(parsed.messagingSenderId) : undefined,
    oAuthClientId: parsed.oAuthClientId ? String(parsed.oAuthClientId) : undefined,
  };
};

/** 사용자가 설정에서 직접 입력한 Firebase 설정 (없으면 null) */
export const getCustomFirebaseConfig = (): FirebaseAppConfig | null => {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(FIREBASE_KEY);
  if (!raw) return null;
  try {
    return normalizeConfig(JSON.parse(raw));
  } catch {
    return null;
  }
};

/** 실제로 앱이 사용하는 Firebase 설정: 사용자 설정 → 내장 기본값 */
export const getStoredFirebaseConfig = (): FirebaseAppConfig =>
  getCustomFirebaseConfig() || normalizeConfig(DEFAULT_FIREBASE_CONFIG)!;

export const getFirebaseConfigSource = (): 'custom' | 'default' =>
  getCustomFirebaseConfig() ? 'custom' : 'default';

export const saveStoredFirebaseConfig = (config: FirebaseAppConfig | null) => {
  if (typeof window === 'undefined') return;
  if (config) localStorage.setItem(FIREBASE_KEY, JSON.stringify(config));
  else localStorage.removeItem(FIREBASE_KEY);
  notify();
};

/** 앱에는 항상 내장 Firebase 설정이 있으므로 항상 true */
export const isFirebaseConfigured = (): boolean => true;

/** Firebase 콘솔에서 복사한 설정 스니펫(JSON)을 파싱합니다. */
export const parseFirebaseConfigText = (text: string): FirebaseAppConfig | null => {
  const trimmed = text.trim();
  if (!trimmed) return null;

  // 1) 순수 JSON 형태
  try {
    const parsed = normalizeConfig(JSON.parse(trimmed));
    if (parsed) return parsed;
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
  return normalizeConfig({
    apiKey,
    projectId,
    authDomain: pick('authDomain') || `${projectId}.firebaseapp.com`,
    appId: pick('appId') || '',
    firestoreDatabaseId: pick('firestoreDatabaseId'),
    storageBucket: pick('storageBucket'),
    messagingSenderId: pick('messagingSenderId'),
    oAuthClientId: pick('oAuthClientId'),
  });
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

export const hasGeminiApiKey = (): boolean => Boolean(getGeminiApiKey());

/* ---------------- YouTube API 키 ---------------- */

export const getYouTubeApiKey = (): string => {
  if (typeof window === 'undefined') return DEFAULT_YOUTUBE_API_KEY;
  const custom = (localStorage.getItem(YOUTUBE_KEY) || '').trim();
  return custom || DEFAULT_YOUTUBE_API_KEY;
};

export const saveYouTubeApiKey = (key: string) => {
  if (typeof window === 'undefined') return;
  const trimmed = (key || '').trim();
  if (trimmed) localStorage.setItem(YOUTUBE_KEY, trimmed);
  else localStorage.removeItem(YOUTUBE_KEY);
  notify();
};

export const maskSecret = (value: string): string => {
  if (!value) return '';
  if (value.length <= 8) return '••••';
  return `${value.slice(0, 4)}••••${value.slice(-4)}`;
};
