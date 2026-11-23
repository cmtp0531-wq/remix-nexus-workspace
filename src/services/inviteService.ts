// ============================================================
// 초대(Invite) 서비스
// - 스페이스/1:1 대화/회의/연락처 초대를 Firestore + localStorage 양쪽에 기록합니다.
// - 받는 사람은 앱 안에서 즉시 알림(토스트 + 알림 센터)으로 확인하고 바로 수락/거절할 수 있습니다.
// ============================================================

import { collection, doc, onSnapshot, query, setDoc, where } from 'firebase/firestore';
import { auth, firestore } from './googleWorkspace';

export type InviteType = 'space' | 'dm' | 'meeting' | 'contact';
export type InviteStatus = 'pending' | 'accepted' | 'declined';

export interface Invite {
  id: string;
  type: InviteType;
  toUserId: string;
  toEmail?: string;
  fromUserId: string;
  fromUserName: string;
  fromUserAvatar?: string;
  spaceId?: string;
  spaceName?: string;
  meetLink?: string;
  meetTitle?: string;
  message?: string;
  createdAt: string;
  status: InviteStatus;
}

const KEY = 'nexus_invites_v1';
export const INVITES_EVENT = 'nexus-invites-changed';

const readAll = (): Invite[] => {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as Invite[]) : [];
  } catch {
    return [];
  }
};

const writeAll = (invites: Invite[]) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(invites.slice(0, 200)));
  } catch {
    /* noop */
  }
  try {
    window.dispatchEvent(new CustomEvent(INVITES_EVENT));
  } catch {
    /* noop */
  }
};

export const loadInvitesFor = (userId: string): Invite[] => {
  const email = (auth?.currentUser as any)?.email as string | undefined;
  return readAll().filter(
    (invite) =>
      invite &&
      invite.status === 'pending' &&
      (invite.toUserId === userId || (email && invite.toEmail && invite.toEmail.toLowerCase() === email.toLowerCase()))
  );
};

export const createInvite = (input: Omit<Invite, 'id' | 'createdAt' | 'status'>): Invite => {
  const invite: Invite = {
    ...input,
    id: `inv_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    createdAt: new Date().toISOString(),
    status: 'pending',
  };

  writeAll([invite, ...readAll()]);

  // Firestore 에도 기록 (다른 기기/사용자에게 실시간 전달)
  if (auth?.currentUser && firestore && invite.toUserId !== auth.currentUser.uid) {
    const safe = JSON.parse(JSON.stringify(invite));
    setDoc(doc(firestore, 'invites', invite.id), safe).catch((error) => {
      console.warn('[Invite] Firestore 초대 저장 실패 (로컬 알림으로 대체):', error);
    });
  }

  return invite;
};

export const respondToInvite = (inviteId: string, status: 'accepted' | 'declined') => {
  const next = readAll().map((invite) => (invite.id === inviteId ? { ...invite, status } : invite));
  writeAll(next);
  if (auth?.currentUser && firestore) {
    setDoc(doc(firestore, 'invites', inviteId), { status }, { merge: true }).catch(() => {
      /* 오프라인/권한 이슈 시 로컬 상태만 반영 */
    });
  }
};

/** 로그인 사용자에게 오는 초대를 실시간 구독합니다 (Firestore + 로컬). */
export const subscribeInvites = (
  userId: string,
  onInvites: (invites: Invite[]) => void,
  onNewInvite?: (invite: Invite) => void
) => {
  let cloudInvites: Invite[] = [];

  const emit = () => {
    const local = loadInvitesFor(userId);
    const merged = new Map<string, Invite>();
    [...cloudInvites.filter((i) => i.status === 'pending'), ...local].forEach((invite) => {
      const key = invite.id;
      if (!merged.has(key)) merged.set(key, invite);
    });
    onInvites(Array.from(merged.values()).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)));
  };

  const onLocalChange = () => emit();
  window.addEventListener('storage', onLocalChange);
  window.addEventListener(INVITES_EVENT, onLocalChange);

  let unsubCloud = () => {};
  const seen = new Set<string>();
  if (firestore && auth?.currentUser?.uid === userId) {
    try {
      const invitesQuery = query(collection(firestore, 'invites'), where('toUserId', '==', userId));
      unsubCloud = onSnapshot(
        invitesQuery,
        (snapshot) => {
          cloudInvites = snapshot.docs.map((item) => item.data() as Invite);
          cloudInvites.forEach((invite) => {
            if (invite.status === 'pending' && !seen.has(invite.id)) {
              seen.add(invite.id);
              onNewInvite?.(invite);
            }
          });
          emit();
        },
        (error) => {
          console.warn('[Invite] 실시간 구독 실패:', error);
          emit();
        }
      );
    } catch (error) {
      console.warn('[Invite] 구독 초기화 실패:', error);
    }
  }

  // 로컬에서 새로 도착한 초대도 알림
  readAll()
    .filter((invite) => invite.status === 'pending' && invite.toUserId === userId && !seen.has(invite.id))
    .forEach((invite) => {
      seen.add(invite.id);
      onNewInvite?.(invite);
    });
  emit();

  return () => {
    unsubCloud();
    window.removeEventListener('storage', onLocalChange);
    window.removeEventListener(INVITES_EVENT, onLocalChange);
  };
};
