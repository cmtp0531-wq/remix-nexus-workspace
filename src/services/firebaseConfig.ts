// Flexible Firebase Configuration & Local Mode Switcher
// Runs 100% Free in Local Mode without requiring any Google Cloud billing.
// When user connects their Firebase domain or custom config, it dynamically activates Cloud sync.

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

const LOCAL_STORAGE_KEY = 'workchat_custom_firebase_config';

export const getStoredFirebaseConfig = (): FirebaseAppConfig | null => {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

export const saveStoredFirebaseConfig = (config: FirebaseAppConfig | null) => {
  if (typeof window === 'undefined') return;
  if (config) {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(config));
  } else {
    localStorage.removeItem(LOCAL_STORAGE_KEY);
  }
};

export const isFirebaseConfigured = (): boolean => {
  return getStoredFirebaseConfig() !== null;
};
