// ============================================================
// 계정별 설정(테마·글씨체·말풍선 색·눈 효과·Gemini 모델) 동기화
// - 로컬: accountScope 로 계정(uid)마다 분리 저장 (theme.ts / appConfig.ts)
// - 클라우드: users/{uid}.settings 에 같은 값을 저장해 다른 기기에서도 이어집니다.
// ============================================================
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, firestore } from './googleWorkspace';
import { getGeminiModel, getGeminiApiKey, saveGeminiModel } from './appConfig';
import { applyFont, applyTheme, getFont, getTheme, isSnowEnabled, setSnowEnabled } from '../theme';
import { storage } from '../storage';

export interface UserSettings {
  theme?: string;
  font?: string;
  bubbleColors?: { mine: string; other: string; mineText?: string; otherText?: string };
  snow?: boolean;
  geminiModel?: string;
  updatedAt?: number;
}

const isSignedInFor = (uid: string) => Boolean(auth?.currentUser && auth.currentUser.uid === uid);

/** 계정에 저장된 설정을 이 기기에 적용합니다(로그인 직후). */
export const applyRemoteSettings = (settings: UserSettings): void => {
  if (!settings) return;
  try {
    if (settings.theme && settings.theme !== getTheme()) applyTheme(settings.theme);
    if (settings.font && settings.font !== getFont()) applyFont(settings.font);
    if (settings.bubbleColors && settings.bubbleColors.mine && settings.bubbleColors.other) {
      storage.saveBubbleColors(settings.bubbleColors);
      window.dispatchEvent(new CustomEvent('nexus-bubble-colors'));
    }
    if (typeof settings.snow === 'boolean' && settings.snow !== isSnowEnabled()) setSnowEnabled(settings.snow);
    if (typeof settings.geminiModel === 'string' && settings.geminiModel) saveGeminiModel(settings.geminiModel);
  } catch (error) {
    console.warn('[Settings] 원격 설정 적용 실패:', error);
  }
};

export const collectLocalSettings = (): UserSettings => ({
  theme: getTheme(),
  font: getFont(),
  bubbleColors: storage.getBubbleColors(),
  snow: isSnowEnabled(),
  geminiModel: getGeminiModel() || '',
  updatedAt: Date.now(),
});

/** 이 기기의 설정을 계정 문서(users/{uid}.settings)에 저장 (다른 필드는 건드리지 않음) */
export const pushUserSettings = async (uid: string): Promise<void> => {
  if (!firestore || !isSignedInFor(uid)) return;
  try {
    const settings = collectLocalSettings();
    await setDoc(doc(firestore, 'users', uid), { settings }, { merge: true });
  } catch (error) {
    console.warn('[Settings] cloud sync skipped:', error);
  }
};

/** 계정에 저장된 설정 읽기 */
export const pullUserSettings = async (uid: string): Promise<UserSettings | null> => {
  if (!firestore || !isSignedInFor(uid)) return null;
  try {
    const snapshot = await getDoc(doc(firestore, 'users', uid));
    const settings = snapshot.data()?.settings;
    return settings && typeof settings === 'object' ? (settings as UserSettings) : null;
  } catch (error) {
    console.warn('[Settings] cloud read skipped:', error);
    return null;
  }
};

// ------------------------------------------------------------
// 로컬 설정이 바뀔 때마다(디바운스) 계정 문서로 올립니다.
// ------------------------------------------------------------
const PUSH_EVENTS = ['nexus-theme-changed', 'nexus-font-changed', 'nexus-bubble-colors', 'nexus-snow-changed', 'workchat-settings-changed'];
let syncingUid = '';
let debounceTimer = 0;
let listenersAttached = false;

const schedulePush = () => {
  if (!syncingUid) return;
  window.clearTimeout(debounceTimer);
  debounceTimer = window.setTimeout(() => {
    void pushUserSettings(syncingUid);
  }, 1500);
};

export const startUserSettingsSync = (uid: string): void => {
  syncingUid = uid;
  if (!listenersAttached && typeof window !== 'undefined') {
    PUSH_EVENTS.forEach((event) => window.addEventListener(event, schedulePush));
    listenersAttached = true;
  }
  // 로그인 직후 한 번, 이 기기 설정을 계정에도 반영합니다.
  schedulePush();
  void getGeminiApiKey();
};

export const stopUserSettingsSync = (): void => {
  syncingUid = '';
  window.clearTimeout(debounceTimer);
  if (listenersAttached && typeof window !== 'undefined') {
    PUSH_EVENTS.forEach((event) => window.removeEventListener(event, schedulePush));
    listenersAttached = false;
  }
};
