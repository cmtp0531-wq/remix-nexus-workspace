import { 
  User, 
  Space, 
  Message, 
  TaskItem, 
  FriendRequest, 
  Friendship, 
  DriveDocument, 
  CalendarEvent, 
  Reaction, 
  ThreadReply, 
  UserStatus, 
  CustomStatus 
} from '../types';
import { storage } from '../storage';

export interface RealtimeCallbacks {
  onBootstrap?: (data: {
    users: User[];
    spaces: Space[];
    messages: Record<string, Message[]>;
    tasks: TaskItem[];
    friendRequests: FriendRequest[];
    friendships: Friendship[];
    driveDocs: DriveDocument[];
    calendarEvents: CalendarEvent[];
  }) => void;
  onNewMessage?: (spaceId: string, message: Message) => void;
  onUserUpdated?: (user: User, allUsers: User[]) => void;
  onPresenceUpdated?: (userId: string, status: UserStatus, customStatus?: CustomStatus) => void;
  onSpaceUpdated?: (space: Space, spaces: Space[]) => void;
  onTaskUpdated?: (task: TaskItem, tasks: TaskItem[]) => void;
  onReactionUpdated?: (spaceId: string, messageId: string, reactions: Reaction[]) => void;
  onMessageReplied?: (spaceId: string, parentMessageId: string, reply: ThreadReply, parentMsg: Message) => void;
  onFriendUpdated?: (data: any) => void;
  onTyping?: (spaceId: string, userId: string, userName: string, isTyping: boolean) => void;
  onDriveUpdated?: (doc: DriveDocument, driveDocs: DriveDocument[]) => void;
  onCalendarUpdated?: (event: CalendarEvent, calendarEvents: CalendarEvent[]) => void;
  onConnectionChange?: (connected: boolean) => void;
}

class RealtimeClient {
  private eventSource: EventSource | null = null;
  private callbacks: RealtimeCallbacks = {};
  private reconnectTimeout: any = null;
  private presenceInterval: any = null;
  private currentUserId: string | null = null;
  private isConnecting: boolean = false;
  private isConnected: boolean = false;

  public init(callbacks: RealtimeCallbacks) {
    this.callbacks = callbacks;
    this.bootstrap();
    this.connectStream();
  }

  public setPresenceUser(userId: string | null) {
    this.currentUserId = userId;
    if (this.presenceInterval) {
      clearInterval(this.presenceInterval);
      this.presenceInterval = null;
    }

    if (userId) {
      // Send initial presence ping
      this.sendPresence(userId, 'online');
      // Keep presence alive every 25 seconds
      this.presenceInterval = setInterval(() => {
        this.sendPresence(userId, 'online');
      }, 25000);
    }
  }

  public async bootstrap() {
    try {
      const res = await fetch('/api/realtime/bootstrap');
      if (res.ok) {
        const data = await res.json();
        // Update local caches
        if (data.users) storage.saveUsers(data.users);
        if (data.spaces) storage.saveSpaces(data.spaces);
        if (data.messages) storage.saveMessages(data.messages);
        if (data.tasks) storage.saveTasks(data.tasks);
        if (data.friendRequests) storage.saveFriendRequests(data.friendRequests);
        if (data.friendships) storage.saveFriendships(data.friendships);
        if (data.driveDocs) storage.saveDriveDocuments(data.driveDocs);
        if (data.calendarEvents) storage.saveCalendarEvents(data.calendarEvents);

        this.callbacks.onBootstrap?.(data);
      }
    } catch (err) {
      console.warn('[RealtimeClient] Bootstrap fetch failed, using local storage cache', err);
    }
  }

  private connectStream() {
    if (this.isConnecting || (this.eventSource && this.eventSource.readyState === EventSource.OPEN)) {
      return;
    }
    this.isConnecting = true;

    try {
      if (this.eventSource) {
        this.eventSource.close();
      }

      this.eventSource = new EventSource('/api/realtime/stream');

      this.eventSource.onopen = () => {
        this.isConnecting = false;
        this.isConnected = true;
        this.callbacks.onConnectionChange?.(true);
      };

      this.eventSource.addEventListener('connected', () => {
        this.isConnected = true;
        this.callbacks.onConnectionChange?.(true);
      });

      this.eventSource.addEventListener('NEW_MESSAGE', (e) => {
        try {
          const { spaceId, message } = JSON.parse(e.data);
          const current = storage.getMessages();
          const msgs = current[spaceId] || [];
          if (!msgs.some((m) => m.id === message.id)) {
            current[spaceId] = [...msgs, message];
            storage.saveMessages(current);
          }
          this.callbacks.onNewMessage?.(spaceId, message);
        } catch (err) {
          console.error('[RealtimeClient] Failed to parse NEW_MESSAGE', err);
        }
      });

      this.eventSource.addEventListener('USER_UPDATED', (e) => {
        try {
          const { user, allUsers } = JSON.parse(e.data);
          storage.saveUsers(allUsers);
          this.callbacks.onUserUpdated?.(user, allUsers);
        } catch (err) {
          console.error('[RealtimeClient] Failed to parse USER_UPDATED', err);
        }
      });

      this.eventSource.addEventListener('PRESENCE_UPDATED', (e) => {
        try {
          const { userId, status, customStatus } = JSON.parse(e.data);
          this.callbacks.onPresenceUpdated?.(userId, status, customStatus);
        } catch (err) {
          console.error('[RealtimeClient] Failed to parse PRESENCE_UPDATED', err);
        }
      });

      this.eventSource.addEventListener('SPACE_UPDATED', (e) => {
        try {
          const { space, spaces } = JSON.parse(e.data);
          storage.saveSpaces(spaces);
          this.callbacks.onSpaceUpdated?.(space, spaces);
        } catch (err) {
          console.error('[RealtimeClient] Failed to parse SPACE_UPDATED', err);
        }
      });

      this.eventSource.addEventListener('TASK_UPDATED', (e) => {
        try {
          const { task, tasks } = JSON.parse(e.data);
          storage.saveTasks(tasks);
          this.callbacks.onTaskUpdated?.(task, tasks);
        } catch (err) {
          console.error('[RealtimeClient] Failed to parse TASK_UPDATED', err);
        }
      });

      this.eventSource.addEventListener('REACTION_UPDATED', (e) => {
        try {
          const { spaceId, messageId, reactions } = JSON.parse(e.data);
          const current = storage.getMessages();
          const msgs = current[spaceId] || [];
          const updated = msgs.map((m) => (m.id === messageId ? { ...m, reactions } : m));
          current[spaceId] = updated;
          storage.saveMessages(current);
          this.callbacks.onReactionUpdated?.(spaceId, messageId, reactions);
        } catch (err) {
          console.error('[RealtimeClient] Failed to parse REACTION_UPDATED', err);
        }
      });

      this.eventSource.addEventListener('MESSAGE_REPLIED', (e) => {
        try {
          const { spaceId, parentMessageId, reply, parentMsg } = JSON.parse(e.data);
          const current = storage.getMessages();
          const msgs = current[spaceId] || [];
          current[spaceId] = msgs.map((m) => (m.id === parentMessageId ? parentMsg : m));
          storage.saveMessages(current);
          this.callbacks.onMessageReplied?.(spaceId, parentMessageId, reply, parentMsg);
        } catch (err) {
          console.error('[RealtimeClient] Failed to parse MESSAGE_REPLIED', err);
        }
      });

      this.eventSource.addEventListener('FRIEND_REQUEST', (e) => {
        try {
          const data = JSON.parse(e.data);
          this.callbacks.onFriendUpdated?.(data);
        } catch (err) {
          console.error('[RealtimeClient] Failed to parse FRIEND_REQUEST', err);
        }
      });

      this.eventSource.addEventListener('FRIEND_ACCEPTED', (e) => {
        try {
          const data = JSON.parse(e.data);
          this.callbacks.onFriendUpdated?.(data);
        } catch (err) {
          console.error('[RealtimeClient] Failed to parse FRIEND_ACCEPTED', err);
        }
      });

      this.eventSource.addEventListener('TYPING_UPDATED', (e) => {
        try {
          const { spaceId, userId, userName, isTyping } = JSON.parse(e.data);
          this.callbacks.onTyping?.(spaceId, userId, userName, isTyping);
        } catch (err) {
          console.error('[RealtimeClient] Failed to parse TYPING_UPDATED', err);
        }
      });

      this.eventSource.addEventListener('DRIVE_UPDATED', (e) => {
        try {
          const { doc, driveDocs } = JSON.parse(e.data);
          storage.saveDriveDocuments(driveDocs);
          this.callbacks.onDriveUpdated?.(doc, driveDocs);
        } catch (err) {
          console.error('[RealtimeClient] Failed to parse DRIVE_UPDATED', err);
        }
      });

      this.eventSource.addEventListener('CALENDAR_UPDATED', (e) => {
        try {
          const { event, calendarEvents } = JSON.parse(e.data);
          storage.saveCalendarEvents(calendarEvents);
          this.callbacks.onCalendarUpdated?.(event, calendarEvents);
        } catch (err) {
          console.error('[RealtimeClient] Failed to parse CALENDAR_UPDATED', err);
        }
      });

      this.eventSource.onerror = () => {
        this.isConnecting = false;
        this.isConnected = false;
        this.callbacks.onConnectionChange?.(false);
        if (this.eventSource) {
          this.eventSource.close();
          this.eventSource = null;
        }
        // Auto-reconnect after 3 seconds
        if (!this.reconnectTimeout) {
          this.reconnectTimeout = setTimeout(() => {
            this.reconnectTimeout = null;
            this.connectStream();
          }, 3000);
        }
      };
    } catch (err) {
      this.isConnecting = false;
      this.isConnected = false;
      console.warn('[RealtimeClient] Connection error, will retry...', err);
      if (!this.reconnectTimeout) {
        this.reconnectTimeout = setTimeout(() => {
          this.reconnectTimeout = null;
          this.connectStream();
        }, 3000);
      }
    }
  }

  // API Call Helpers
  public async sendUser(user: User) {
    try {
      const res = await fetch('/api/realtime/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(user),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  public async sendPresence(userId: string, status: UserStatus, customStatus?: CustomStatus) {
    try {
      await fetch('/api/realtime/presence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, status, customStatus }),
      });
    } catch {
      // ignore transient failures
    }
  }

  public async sendMessage(message: Message) {
    try {
      const res = await fetch('/api/realtime/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(message),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  public async sendReply(spaceId: string, parentMessageId: string, reply: ThreadReply) {
    try {
      const res = await fetch('/api/realtime/messages/reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ spaceId, parentMessageId, reply }),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  public async toggleReaction(spaceId: string, messageId: string, emoji: string, userId: string) {
    try {
      const res = await fetch('/api/realtime/reactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ spaceId, messageId, emoji, userId }),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  public async sendSpace(space: Space) {
    try {
      const res = await fetch('/api/realtime/spaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(space),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  public async sendTask(task: TaskItem) {
    try {
      const res = await fetch('/api/realtime/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(task),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  public async sendTyping(spaceId: string, userId: string, userName: string, isTyping: boolean) {
    try {
      await fetch('/api/realtime/typing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ spaceId, userId, userName, isTyping }),
      });
    } catch {
      // ignore
    }
  }

  public async sendFriendRequest(request: FriendRequest) {
    try {
      const res = await fetch('/api/realtime/friends', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'send', request }),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  public async acceptFriendRequest(requestId: string) {
    try {
      const res = await fetch('/api/realtime/friends', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'accept', requestId }),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  public async sendDriveDoc(doc: DriveDocument) {
    try {
      const res = await fetch('/api/realtime/drive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(doc),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  public async sendCalendarEvent(event: CalendarEvent) {
    try {
      const res = await fetch('/api/realtime/calendar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(event),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  public async sendCalendarRsvp(eventId: string, userId: string, status: string) {
    try {
      const res = await fetch('/api/realtime/calendar/rsvp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId, userId, status }),
      });
      return res.ok;
    } catch {
      return false;
    }
  }
}

export const realtimeClient = new RealtimeClient();
