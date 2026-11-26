// ============================================================
// 실시간 상태(타이핑 인디케이터 · 읽음 시각) 서비스
// - 로그인 상태: Firestore 의 spaces/{spaceId}/typing/{uid}, spaces/{spaceId}/reads/{uid}
// - 게스트/오프라인: localStorage + BroadcastChannel 로 같은 브라우저의 탭끼리 공유
// - 두 경로를 합쳐서 화면에는 "지금 입력 중인 다른 사람" 과 "멤버별 마지막 읽은 시각" 만 전달합니다.
// ============================================================

import {
  clearTypingState,
  isGoogleSignedIn,
  publishReadState,
  publishTypingState,
  subscribeToReadStates,
  subscribeToTypingStates,
} from './googleWorkspace';

export const TYPING_TTL_MS = 6000;
const TYPING_KEY = (spaceId: string) => `nexus_typing_v1_${spaceId}`;
const READS_KEY = (spaceId: string) => `nexus_reads_v1_${spaceId}`;
const PRESENCE_EVENT = 'nexus-live-presence';
const CHANNEL_NAME = 'nexus_live_presence_v1';

export interface TypingPeer {
  uid: string;
  name: string;
  at: number;
}

export type ReadMap = Record<string, { name?: string; at: number }>;

type LocalTyping = TypingPeer[];

const canUseStorage = (() => {
  try {
    return typeof window !== 'undefined' && !!window.localStorage;
  } catch {
    return false;
  }
})();

let channel: BroadcastChannel | null = null;
try {
  if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
    channel = new BroadcastChannel(CHANNEL_NAME);
  }
} catch {
  channel = null;
}

const readJson = <T,>(key: string, fallback: T): T => {
  if (!canUseStorage) return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
};

const writeJson = (key: string, value: unknown) => {
  if (!canUseStorage) return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* 저장 실패는 조용히 무시 (세션 내 동작은 유지) */
  }
};

const notify = (spaceId: string) => {
  channel?.postMessage({ spaceId, at: Date.now() });
  try {
    window.dispatchEvent(new CustomEvent(PRESENCE_EVENT, { detail: { spaceId } }));
  } catch {
    /* noop */
  }
};

/** 내 타이핑 상태를 기록/해제합니다. */
export const setMyTyping = (spaceId: string, user: { id: string; name: string }, typing: boolean) => {
  const list = readJson<LocalTyping>(TYPING_KEY(spaceId), []);
  const next = typing
    ? [...list.filter((entry) => entry.uid !== user.id), { uid: user.id, name: user.name, at: Date.now() }]
    : list.filter((entry) => entry.uid !== user.id);
  writeJson(TYPING_KEY(spaceId), next);
  notify(spaceId);

  if (!isGoogleSignedIn()) return;
  if (typing) void publishTypingState(spaceId, user.id, user.name);
  else void clearTypingState(spaceId, user.id);
};

/** 마지막 읽은 시각을 기록합니다. */
export const markSpaceRead = (spaceId: string, user: { id: string; name: string }, at = Date.now()) => {
  const map = readJson<ReadMap>(READS_KEY(spaceId), {});
  const prev = map[user.id];
  if (prev && prev.at >= at) return;
  map[user.id] = { name: user.name, at };
  writeJson(READS_KEY(spaceId), map);
  notify(spaceId);
  if (isGoogleSignedIn()) void publishReadState(spaceId, user.id, user.name, at);
};

/**
 * 타이핑 중인 다른 멤버를 구독합니다.
 * - Firestore(다른 기기) + localStorage/탭 간(같은 브라우저) 을 합칩니다.
 * - 1.5초마다 만료된 항목을 정리해 점 3개가 저절로 사라지게 합니다.
 */
export const subscribeTypingPeers = (
  spaceId: string,
  selfId: string,
  onChange: (peers: TypingPeer[]) => void
) => {
  let cloud: TypingPeer[] = [];
  let disposed = false;

  const emit = () => {
    if (disposed) return;
    const now = Date.now();
    const local = readJson<LocalTyping>(TYPING_KEY(spaceId), []).filter((entry) => now - entry.at < TYPING_TTL_MS);
    const merged = new Map<string, TypingPeer>();
    [...local, ...cloud].forEach((entry) => {
      if (!entry || !entry.uid || entry.uid === selfId) return;
      const prev = merged.get(entry.uid);
      if (!prev || entry.at >= prev.at) merged.set(entry.uid, entry);
    });
    onChange(Array.from(merged.values()).filter((entry) => now - entry.at < TYPING_TTL_MS));
  };

  const unsubCloud = subscribeToTypingStates(spaceId, (entries) => {
    cloud = entries
      .filter((entry) => entry.uid && entry.uid !== selfId)
      .map((entry) => ({ uid: entry.uid, name: entry.name || '팀원', at: entry.at || Date.now() }));
    emit();
  });

  const onLocal = () => emit();
  window.addEventListener(PRESENCE_EVENT, onLocal);
  window.addEventListener('storage', onLocal);
  const onChannel = (event: MessageEvent) => {
    if (event.data?.spaceId === spaceId) emit();
  };
  channel?.addEventListener('message', onChannel);

  const timer = window.setInterval(emit, 1500);
  emit();

  return () => {
    disposed = true;
    window.clearInterval(timer);
    window.removeEventListener(PRESENCE_EVENT, onLocal);
    window.removeEventListener('storage', onLocal);
    channel?.removeEventListener('message', onChannel);
    unsubCloud?.();
  };
};

/** 멤버별 마지막 읽은 시각을 구독합니다. (없는 멤버는 항목이 없습니다) */
export const subscribeReadMap = (spaceId: string, onChange: (map: ReadMap) => void) => {
  let cloud: ReadMap = {};
  let disposed = false;

  const emit = () => {
    if (disposed) return;
    const local = readJson<ReadMap>(READS_KEY(spaceId), {});
    const merged: ReadMap = { ...local };
    Object.entries(cloud).forEach(([uid, entry]) => {
      const prev = merged[uid];
      if (!prev || (entry.at || 0) >= (prev.at || 0)) merged[uid] = entry;
    });
    onChange(merged);
  };

  const unsubCloud = subscribeToReadStates(spaceId, (entries) => {
    cloud = entries;
    emit();
  });

  const onLocal = () => emit();
  window.addEventListener(PRESENCE_EVENT, onLocal);
  window.addEventListener('storage', onLocal);
  const onChannel = (event: MessageEvent) => {
    if (event.data?.spaceId === spaceId) emit();
  };
  channel?.addEventListener('message', onChannel);

  emit();

  return () => {
    disposed = true;
    window.removeEventListener(PRESENCE_EVENT, onLocal);
    window.removeEventListener('storage', onLocal);
    channel?.removeEventListener('message', onChannel);
    unsubCloud?.();
  };
};

export const getReadMap = (spaceId: string): ReadMap => readJson<ReadMap>(READS_KEY(spaceId), {});
