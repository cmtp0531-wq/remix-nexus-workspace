// ============================================================
// 연락처(주소록) 서비스
// - 사용자가 상대방의 표시 이름(별명)을 마음대로 정해 저장할 수 있습니다.
// - 저장 위치: localStorage(즉시 반영) + Firestore users/{uid}/contacts (로그인 시 동기화)
// - 중복 방지: 사용자 ID 또는 이메일(소문자 정규화) 기준으로 원천 차단
// ============================================================

import {
  deleteContactFromFirestore,
  saveContactToFirestore,
  subscribeToCloudContacts,
} from './googleWorkspace';

export interface Contact {
  id: string;
  userId?: string;
  email: string;
  displayName: string;
  originalName?: string;
  note?: string;
  avatar?: string;
  createdAt: string;
  updatedAt: string;
}

const KEY_PREFIX = 'nexus_contacts_v1_';
export const CONTACTS_EVENT = 'nexus-contacts-changed';

const storageKey = (ownerId: string) => `${KEY_PREFIX}${ownerId || 'guest'}`;

export const normalizeEmail = (email: string): string => (email || '').trim().toLowerCase();

export const contactKeyOf = (userId?: string, email?: string): string => {
  if (userId && userId.trim()) return `u:${userId.trim()}`;
  return `e:${normalizeEmail(email || '')}`;
};

const notify = () => {
  try {
    window.dispatchEvent(new CustomEvent(CONTACTS_EVENT));
  } catch {
    /* noop */
  }
};

export const loadContacts = (ownerId: string): Contact[] => {
  try {
    const raw = localStorage.getItem(storageKey(ownerId));
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((c: Contact) => c && typeof c.displayName === 'string')
      .map((c: Contact) => ({ ...c, email: normalizeEmail(c.email) }));
  } catch {
    return [];
  }
};

export const saveContacts = (ownerId: string, contacts: Contact[]) => {
  try {
    localStorage.setItem(storageKey(ownerId), JSON.stringify(contacts));
  } catch {
    /* noop */
  }
  notify();
};

export interface UpsertContactInput {
  userId?: string;
  email?: string;
  displayName: string;
  originalName?: string;
  note?: string;
  avatar?: string;
}

export interface UpsertContactResult {
  contact: Contact | null;
  duplicate: boolean;
  reason?: string;
}

/** 연락처 추가/이름 변경. 같은 사람(ID 또는 이메일)이 이미 있으면 새로 만들지 않습니다. */
export const upsertContact = (ownerId: string, input: UpsertContactInput): UpsertContactResult => {
  const name = (input.displayName || '').trim();
  const email = normalizeEmail(input.email || '');
  const userId = (input.userId || '').trim() || undefined;

  if (!name) return { contact: null, duplicate: false, reason: '이름을 입력해 주세요.' };
  if (!email && !userId) return { contact: null, duplicate: false, reason: '이메일 또는 사용자 ID가 필요합니다.' };

  const contacts = loadContacts(ownerId);
  const existing = contacts.find((c) => {
    if (userId && c.userId && c.userId === userId) return true;
    if (email && normalizeEmail(c.email) === email) return true;
    return false;
  });

  const now = new Date().toISOString();

  if (existing) {
    // 중복 등록 대신 기존 항목의 이름/정보만 갱신합니다.
    const updated: Contact = {
      ...existing,
      displayName: name,
      email: email || existing.email,
      userId: userId || existing.userId,
      originalName: input.originalName ?? existing.originalName,
      note: input.note ?? existing.note,
      avatar: input.avatar ?? existing.avatar,
      updatedAt: now,
    };
    const next = contacts.map((c) => (c.id === existing.id ? updated : c));
    saveContacts(ownerId, next);
    void saveContactToFirestore(ownerId, updated as unknown as Record<string, unknown>);
    return { contact: updated, duplicate: true, reason: `${name} 은(는) 이미 연락처에 있어 이름만 업데이트했습니다.` };
  }

  const contact: Contact = {
    id: `contact_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    userId,
    email,
    displayName: name,
    originalName: input.originalName,
    note: input.note,
    avatar: input.avatar,
    createdAt: now,
    updatedAt: now,
  };
  const next = [contact, ...contacts];
  saveContacts(ownerId, next);
  void saveContactToFirestore(ownerId, contact as unknown as Record<string, unknown>);
  return { contact, duplicate: false };
};

export const renameContact = (ownerId: string, contactId: string, displayName: string): Contact | null => {
  const name = displayName.trim();
  if (!name) return null;
  const contacts = loadContacts(ownerId);
  let changed: Contact | null = null;
  const next = contacts.map((c) => {
    if (c.id !== contactId) return c;
    changed = { ...c, displayName: name, updatedAt: new Date().toISOString() };
    return changed;
  });
  if (!changed) return null;
  saveContacts(ownerId, next);
  void saveContactToFirestore(ownerId, changed as unknown as Record<string, unknown>);
  return changed;
};

export const removeContact = (ownerId: string, contactId: string) => {
  const contacts = loadContacts(ownerId);
  const next = contacts.filter((c) => c.id !== contactId);
  saveContacts(ownerId, next);
  void deleteContactFromFirestore(ownerId, contactId);
};

/**
 * 계정 주체가 바뀌어도(게스트 ↔ 구글 로그인) 연락처를 잃지 않도록 옮겨 담습니다.
 * - 새 주체의 목록이 비어 있을 때만, 게스트/로컬 사본에서만 가져옵니다.
 * - 다른 구글 계정(uid)의 목록을 가져오지는 않습니다(계정 간 유출 방지).
 */
export const adoptContactsForOwner = (ownerId: string): Contact[] => {
  const own = loadContacts(ownerId);
  if (own.length > 0) return own;
  const key = ownerId || 'guest';
  if (key === 'guest') return own;

  const localKeys = ['guest', 'user_local_owner'];
  const collected: Contact[] = [];
  localKeys.forEach((legacy) => {
    if (legacy === key) return;
    loadContacts(legacy).forEach((contact) => {
      const exists = collected.some(
        (c) =>
          (contact.userId && c.userId === contact.userId) ||
          (contact.email && normalizeEmail(c.email) === normalizeEmail(contact.email))
      );
      if (!exists) collected.push(contact);
    });
  });

  if (collected.length === 0) return own;
  saveContacts(ownerId, collected);
  return collected;
};

/** 로그인 사용자라면 Firestore 연락처를 병합합니다 (중복은 이름만 최신 값으로) */
export const mergeCloudContacts = (ownerId: string, cloudContacts: any[]): Contact[] => {
  if (!Array.isArray(cloudContacts) || cloudContacts.length === 0) return loadContacts(ownerId);
  const local = loadContacts(ownerId);
  const merged = [...local];
  cloudContacts.forEach((raw) => {
    if (!raw || !raw.id) return;
    const candidate: Contact = {
      id: String(raw.id),
      userId: raw.userId ? String(raw.userId) : undefined,
      email: normalizeEmail(raw.email || ''),
      displayName: String(raw.displayName || raw.originalName || raw.email || '이름 없음'),
      originalName: raw.originalName,
      note: raw.note,
      avatar: raw.avatar,
      createdAt: raw.createdAt || new Date().toISOString(),
      updatedAt: raw.updatedAt || new Date().toISOString(),
    };
    const idx = merged.findIndex(
      (c) =>
        c.id === candidate.id ||
        (candidate.userId && c.userId === candidate.userId) ||
        (candidate.email && normalizeEmail(c.email) === candidate.email)
    );
    if (idx >= 0) {
      const prev = merged[idx];
      if (!prev.updatedAt || new Date(candidate.updatedAt) >= new Date(prev.updatedAt)) merged[idx] = candidate;
    } else {
      merged.push(candidate);
    }
  });
  saveContacts(ownerId, merged);
  return merged;
};

export const subscribeCloudContacts = (ownerId: string, onChange: (contacts: Contact[]) => void) => {
  return subscribeToCloudContacts(ownerId, (cloud) => {
    onChange(mergeCloudContacts(ownerId, cloud));
  });
};

/** 연락처에 저장된 사용자 정의 이름을 찾습니다 (없으면 원래 이름). */
export const contactNameOf = (contacts: Contact[], userId?: string, email?: string, fallback?: string): string => {
  if (userId) {
    const byId = contacts.find((c) => c.userId && c.userId === userId);
    if (byId?.displayName) return byId.displayName;
  }
  const normalized = normalizeEmail(email || '');
  if (normalized) {
    const byEmail = contacts.find((c) => normalizeEmail(c.email) === normalized);
    if (byEmail?.displayName) return byEmail.displayName;
  }
  return fallback || '';
};
