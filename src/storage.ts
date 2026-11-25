import { User, Space, Message, TaskItem, FriendRequest, Friendship, DriveDocument, CalendarEvent } from './types';

// 기본 공용 라운지: 예시 메시지·가짜 멤버 없이 '빈 상태'로 시작합니다.
export const DEFAULT_PUBLIC_SPACE: Space = {
  id: 'space_general',
  name: '전체 라운지',
  type: 'space',
  creatorId: 'system',
  memberIds: ['user_local_owner'],
  description: '모든 멤버가 참여할 수 있는 기본 채널',
  isStarred: true
};

export const DEFAULT_LOCAL_USER: User = {
  id: 'user_local_owner',
  name: '나 (게스트)',
  email: '',
  avatar: '',
  status: 'online',
  role: '게스트 모드',
  department: '로컬 워크스페이스',
  googleConnected: false,
};

const DEFAULT_SEED_USERS: User[] = [DEFAULT_LOCAL_USER];

// 예시/샘플 메시지는 두지 않습니다. 채팅은 항상 빈 상태에서 시작합니다.
const INITIAL_MESSAGES: Record<string, Message[]> = {};
const USERS_KEY = 'workchat_users_v6';
const CURRENT_USER_KEY = 'workchat_current_user_v6';
const SPACES_KEY = 'workchat_spaces_v6';
const MESSAGES_KEY = 'workchat_messages_v6';
const TASKS_KEY = 'workchat_tasks_v6';
const REQUESTS_KEY = 'gchat_real_requests_v6';
const FRIENDSHIPS_KEY = 'gchat_real_friendships_v6';
const DRIVE_DOCS_KEY = 'gchat_real_drive_docs_v6';
const CALENDAR_EVENTS_KEY = 'gchat_real_calendar_events_v6';
const THEME_KEY = 'nexus_theme_v1';
const BUBBLE_COLORS_KEY = 'nexus_bubble_colors_v1';
const HIDDEN_MESSAGES_KEY = 'nexus_hidden_messages_v1';

// Completely empty: No fake mock docs! Real Google Drive files are loaded via Google API.
const INITIAL_DRIVE_DOCS: DriveDocument[] = [];

// Real-time broadcast channel for live multi-tab & cross-window synchronization
export const syncChannel = typeof window !== 'undefined' && 'BroadcastChannel' in window
  ? new BroadcastChannel('google_chat_online_sync')
  : null;

export const broadcastSync = (type: string, payload?: any) => {
  if (syncChannel) {
    try {
      syncChannel.postMessage({ type, payload, timestamp: Date.now() });
    } catch (e) {
      console.warn('Broadcast failed', e);
    }
  }
};

export const storage = {
  getUsers: (): User[] => {
    try {
      const data = localStorage.getItem(USERS_KEY);
      if (!data) {
        localStorage.setItem(USERS_KEY, JSON.stringify(DEFAULT_SEED_USERS));
        return DEFAULT_SEED_USERS;
      }
      const parsed = JSON.parse(data);
      return parsed.length > 0 ? parsed : DEFAULT_SEED_USERS;
    } catch {
      return DEFAULT_SEED_USERS;
    }
  },
  saveUsers: (users: User[]) => {
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
    broadcastSync('USERS_UPDATED');
  },

  getCurrentUser: (): User | null => {
    try {
      const data = localStorage.getItem(CURRENT_USER_KEY);
      return data ? JSON.parse(data) : DEFAULT_LOCAL_USER;
    } catch {
      return DEFAULT_LOCAL_USER;
    }
  },
  setCurrentUser: (user: User | null) => {
    if (!user) localStorage.removeItem(CURRENT_USER_KEY);
    else localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
  },

  getSpaces: (): Space[] => {
    try {
      const data = localStorage.getItem(SPACES_KEY);
      if (!data) {
        localStorage.setItem(SPACES_KEY, JSON.stringify([DEFAULT_PUBLIC_SPACE]));
        return [DEFAULT_PUBLIC_SPACE];
      }
      const parsed: Space[] = JSON.parse(data);
      if (parsed.length === 0) {
        return [DEFAULT_PUBLIC_SPACE];
      }
      return parsed;
    } catch {
      return [DEFAULT_PUBLIC_SPACE];
    }
  },
  saveSpaces: (spaces: Space[]) => {
    localStorage.setItem(SPACES_KEY, JSON.stringify(spaces));
    broadcastSync('SPACES_UPDATED');
  },

  getMessages: (): Record<string, Message[]> => {
    try {
      const data = localStorage.getItem(MESSAGES_KEY);
      if (!data) {
        localStorage.setItem(MESSAGES_KEY, JSON.stringify(INITIAL_MESSAGES));
        return INITIAL_MESSAGES;
      }
      const parsed = JSON.parse(data);
      // 과거 버전에서 자동으로 들어가 있던 예시/환영 메시지를 제거합니다.
      const cleaned: Record<string, Message[]> = {};
      Object.entries(parsed || {}).forEach(([spaceId, list]) => {
        if (!Array.isArray(list)) return;
        cleaned[spaceId] = (list as Message[]).filter(
          (msg) => msg && msg.id !== 'msg_welcome'
        );
      });
      return cleaned;
    } catch {
      return INITIAL_MESSAGES;
    }
  },
  saveMessages: (messages: Record<string, Message[]>) => {
    localStorage.setItem(MESSAGES_KEY, JSON.stringify(messages));
    broadcastSync('MESSAGES_UPDATED');
  },

  getTasks: (): TaskItem[] => {
    try {
      const data = localStorage.getItem(TASKS_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },
  saveTasks: (tasks: TaskItem[]) => {
    localStorage.setItem(TASKS_KEY, JSON.stringify(tasks));
    broadcastSync('TASKS_UPDATED');
  },

  getFriendRequests: (): FriendRequest[] => {
    try {
      const data = localStorage.getItem(REQUESTS_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },
  saveFriendRequests: (requests: FriendRequest[]) => {
    localStorage.setItem(REQUESTS_KEY, JSON.stringify(requests));
    broadcastSync('REQUESTS_UPDATED');
  },

  getFriendships: (): Friendship[] => {
    try {
      const data = localStorage.getItem(FRIENDSHIPS_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },
  saveFriendships: (friendships: Friendship[]) => {
    localStorage.setItem(FRIENDSHIPS_KEY, JSON.stringify(friendships));
    broadcastSync('FRIENDSHIPS_UPDATED');
  },

  getDriveDocuments: (): DriveDocument[] => {
    try {
      const data = localStorage.getItem(DRIVE_DOCS_KEY);
      if (!data) {
        return [];
      }
      const parsed: DriveDocument[] = JSON.parse(data);
      // Filter out any legacy fake mock docs
      const realOnly = parsed.filter((d) => !d.id.startsWith('doc_recent_'));
      return realOnly;
    } catch {
      return [];
    }
  },
  saveDriveDocuments: (docs: DriveDocument[]) => {
    localStorage.setItem(DRIVE_DOCS_KEY, JSON.stringify(docs));
    broadcastSync('DRIVE_DOCS_UPDATED');
  },
  updateDriveDocument: (id: string, updates: Partial<DriveDocument>) => {
    try {
      const current = storage.getDriveDocuments();
      const existingIdx = current.findIndex((d) => d.id === id);
      let next: DriveDocument[];
      if (existingIdx >= 0) {
        next = current.map((d) => (d.id === id ? { ...d, ...updates, updatedAt: '방금 전' } : d));
      } else {
        const newDoc: DriveDocument = {
          id,
          title: updates.title || (updates.type === 'sheet' ? '새 스프레드시트.gsheet' : updates.type === 'slide' ? '새 프레젠테이션.gslides' : '새 문서.gdoc'),
          type: updates.type || 'doc',
          content: updates.content || '',
          ownerId: updates.ownerId || 'user',
          ownerName: updates.ownerName || '사용자',
          updatedAt: '방금 전',
          size: `${Math.max(0.1, ((updates.content?.length || 0) / 1024)).toFixed(1)} KB`,
          permission: 'editor',
          ...updates,
        };
        next = [newDoc, ...current];
      }
      storage.saveDriveDocuments(next);
      return next;
    } catch {
      return [];
    }
  },

  /** 나에게만 메시지를 가리기(상대 메시지 숨김) — 사용자별 목록으로 저장 */
  getHiddenMessageIds: (userId: string): string[] => {
    try {
      const raw = localStorage.getItem(HIDDEN_MESSAGES_KEY);
      const map = raw ? JSON.parse(raw) : {};
      const list = map?.[userId];
      return Array.isArray(list) ? list : [];
    } catch {
      return [];
    }
  },
  hideMessageForUser: (userId: string, messageId: string) => {
    try {
      const raw = localStorage.getItem(HIDDEN_MESSAGES_KEY);
      const map = raw ? JSON.parse(raw) : {};
      const list: string[] = Array.isArray(map[userId]) ? map[userId] : [];
      if (!list.includes(messageId)) list.push(messageId);
      map[userId] = list;
      localStorage.setItem(HIDDEN_MESSAGES_KEY, JSON.stringify(map));
      broadcastSync('MESSAGES_UPDATED');
    } catch {
      /* 저장 실패 시 세션 내 상태만 반영 */
    }
  },
  getTheme: (): string => {
    try {
      return localStorage.getItem(THEME_KEY) || 'cream';
    } catch {
      return 'cream';
    }
  },
  saveTheme: (theme: string) => {
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      /* ignore */
    }
  },
  getBubbleColors: (): { mine: string; other: string; mineText?: string; otherText?: string } => {
    try {
      const raw = localStorage.getItem(BUBBLE_COLORS_KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      return {
        mine: parsed?.mine || '#1A73E8',
        other: parsed?.other || '#FFFFFF',
        mineText: parsed?.mineText,
        otherText: parsed?.otherText,
      };
    } catch {
      return { mine: '#1A73E8', other: '#FFFFFF' };
    }
  },
  saveBubbleColors: (colors: { mine: string; other: string; mineText?: string; otherText?: string }) => {
    try {
      localStorage.setItem(BUBBLE_COLORS_KEY, JSON.stringify(colors));
      broadcastSync('MESSAGES_UPDATED');
    } catch {
      /* ignore */
    }
  },

  getCalendarEvents: (): CalendarEvent[] => {
    try {
      const data = localStorage.getItem(CALENDAR_EVENTS_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },
  saveCalendarEvents: (events: CalendarEvent[]) => {
    localStorage.setItem(CALENDAR_EVENTS_KEY, JSON.stringify(events));
    broadcastSync('CALENDAR_EVENTS_UPDATED');
  },
  updateCalendarEventRsvp: (eventId: string, userId: string, status: 'accepted' | 'tentative' | 'declined') => {
    try {
      const current = storage.getCalendarEvents();
      const next = current.map((ev) => {
        if (ev.id === eventId) {
          return {
            ...ev,
            rsvps: { ...ev.rsvps, [userId]: status },
          };
        }
        return ev;
      });
      storage.saveCalendarEvents(next);
      return next;
    } catch {
      return [];
    }
  }
};
