import express from 'express';
import fs from 'fs';
import path from 'path';
import { User, Space, Message, TaskItem, FriendRequest, Friendship, DriveDocument, CalendarEvent } from './src/types';

const DATA_DIR = path.resolve('data');
const DATA_FILE = path.join(DATA_DIR, 'workspace_data.json');

const DEFAULT_PUBLIC_SPACE: Space = {
  id: 'space_general',
  name: '전체-라운지',
  type: 'space',
  creatorId: 'system',
  memberIds: [],
  topic: '전체 구성원이 자유롭게 소통하는 공용 스페이스입니다.',
  description: '모든 멤버가 참여할 수 있는 기본 채널',
  isStarred: true,
};

const INITIAL_MESSAGES: Record<string, Message[]> = {
  space_general: [
    {
      id: 'msg_welcome',
      spaceId: 'space_general',
      senderId: 'system',
      senderName: '워크챗 시스템',
      senderAvatar: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=150&auto=format&fit=crop&q=80',
      senderRole: '시스템 안내',
      content: '전체 라운지 채널에 오신 것을 환영합니다! 다른 사용자와 실시간으로 대화하고 협업을 시작하세요.',
      timestamp: '오늘 09:00',
      reactions: [],
      repliesCount: 0,
      replies: [],
    },
  ],
};

const INITIAL_DRIVE_DOCS: DriveDocument[] = [
  {
    id: 'doc_recent_1',
    title: '2026 Q1 팀 OKR 및 예산 계획서.gdoc',
    type: 'doc',
    content: `# 2026년 1분기 팀 OKR 및 예산 계획서\n\n## 1. 목적\n본 문서는 Google Workspace 기반 실시간 협업 체계 구축 및 2026년 1분기 핵심 목표(OKR)를 정의합니다.\n\n## 2. 주요 OKR\n- O1: 전사 커뮤니케이션 지연 시간 50% 단축\n  - KR1: WorkChat 인앱 실시간 다자간 채팅 일상화\n  - KR2: 실시간 문서 공동 편집 기능 도입\n- O2: 업무 생산성 향상 및 자동화\n  - KR1: Gemini AI 비서 활용한 회의록 자동 요약\n  - KR2: 구글 드라이브 통합 파일 관리`,
    ownerId: 'system',
    ownerName: '김지민 팀장',
    updatedAt: '10분 전',
    size: '14.2 KB',
    permission: 'editor',
  },
  {
    id: 'doc_recent_2',
    title: '신제품 런칭 마케팅 스프레드시트.gsheet',
    type: 'sheet',
    content: `채널,담당자,예산(원),진행상태,성과지표\nGoogle Ads,김민수,500000,진행중,CTR 3.5%\nYouTube 인플루언서,이서연,800000,완료,조회수 45k\n블로그 마케팅,박준호,300000,검토중,방문자 12k`,
    ownerId: 'system',
    ownerName: '박준호 마케터',
    updatedAt: '1시간 전',
    size: '28.5 KB',
    permission: 'editor',
  },
];

interface WorkspaceStore {
  users: User[];
  spaces: Space[];
  messages: Record<string, Message[]>;
  tasks: TaskItem[];
  friendRequests: FriendRequest[];
  friendships: Friendship[];
  driveDocs: DriveDocument[];
  calendarEvents: CalendarEvent[];
}

let store: WorkspaceStore = {
  users: [],
  spaces: [DEFAULT_PUBLIC_SPACE],
  messages: INITIAL_MESSAGES,
  tasks: [],
  friendRequests: [],
  friendships: [],
  driveDocs: INITIAL_DRIVE_DOCS,
  calendarEvents: [],
};

// Load persistent data from disk if exists
try {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (fs.existsSync(DATA_FILE)) {
    const raw = fs.readFileSync(DATA_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    store = {
      users: parsed.users || [],
      spaces: parsed.spaces && parsed.spaces.length > 0 ? parsed.spaces : [DEFAULT_PUBLIC_SPACE],
      messages: parsed.messages || INITIAL_MESSAGES,
      tasks: parsed.tasks || [],
      friendRequests: parsed.friendRequests || [],
      friendships: parsed.friendships || [],
      driveDocs: parsed.driveDocs || INITIAL_DRIVE_DOCS,
      calendarEvents: parsed.calendarEvents || [],
    };
    // Ensure default public space is present
    if (!store.spaces.some((s) => s.id === DEFAULT_PUBLIC_SPACE.id)) {
      store.spaces.unshift(DEFAULT_PUBLIC_SPACE);
    }
  }
} catch (e) {
  console.warn('[Realtime] Failed to load data file, starting with defaults', e);
}

function persistStore() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(DATA_FILE, JSON.stringify(store, null, 2), 'utf-8');
  } catch (e) {
    console.error('[Realtime] Failed to save store', e);
  }
}

// Active SSE client streams
const sseClients: Set<express.Response> = new Set();

export function broadcastEvent(event: string, data: any) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const client of sseClients) {
    try {
      client.write(payload);
    } catch {
      sseClients.delete(client);
    }
  }
}

export function setupRealtimeSync(app: express.Express) {
  // 1. SSE Realtime Stream Endpoint
  app.get('/api/realtime/stream', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();

    sseClients.add(res);

    // Initial greeting and connection confirmation
    res.write(`event: connected\ndata: ${JSON.stringify({ ok: true, clients: sseClients.size })}\n\n`);

    // Heartbeat ping every 15s to keep proxy connections alive
    const pingInterval = setInterval(() => {
      try {
        res.write(`: ping\n\n`);
      } catch {
        clearInterval(pingInterval);
        sseClients.delete(res);
      }
    }, 15000);

    req.on('close', () => {
      clearInterval(pingInterval);
      sseClients.delete(res);
    });
  });

  // 2. Full Bootstrap Data (All clients call this on load)
  app.get('/api/realtime/bootstrap', (req, res) => {
    res.json(store);
  });

  // 3. Register or Update User
  app.post('/api/realtime/users', (req, res) => {
    const user: User = req.body;
    if (!user || !user.id || !user.name || !user.email) {
      return res.status(400).json({ error: '유효한 사용자 정보가 필요합니다.' });
    }

    const idx = store.users.findIndex((u) => u.id === user.id || u.email.toLowerCase() === user.email.toLowerCase());
    if (idx >= 0) {
      store.users[idx] = { ...store.users[idx], ...user, status: user.status || 'online' };
    } else {
      store.users.push({ ...user, status: user.status || 'online' });
    }

    // Ensure user is in default public space
    const pubSpace = store.spaces.find((s) => s.id === DEFAULT_PUBLIC_SPACE.id);
    if (pubSpace && !pubSpace.memberIds.includes(user.id)) {
      pubSpace.memberIds.push(user.id);
    }

    persistStore();
    broadcastEvent('USER_UPDATED', { user, allUsers: store.users });
    res.json({ success: true, user, allUsers: store.users });
  });

  // 4. Update Presence (online / away / dnd / offline)
  app.post('/api/realtime/presence', (req, res) => {
    const { userId, status, customStatus } = req.body;
    if (!userId) return res.status(400).json({ error: 'userId is required' });

    const user = store.users.find((u) => u.id === userId);
    if (user) {
      user.status = status || 'online';
      if (customStatus !== undefined) user.customStatus = customStatus;
      broadcastEvent('PRESENCE_UPDATED', { userId, status: user.status, customStatus: user.customStatus });
    }
    res.json({ success: true });
  });

  // 5. Send Message (Instantly broadcasted to all users in real time)
  app.post('/api/realtime/messages', (req, res) => {
    const message: Message = req.body;
    if (!message || !message.id || !message.spaceId || !message.content) {
      return res.status(400).json({ error: '유효한 메시지 내용이 필요합니다.' });
    }

    if (!store.messages[message.spaceId]) {
      store.messages[message.spaceId] = [];
    }

    // Avoid duplicates
    const existingIdx = store.messages[message.spaceId].findIndex((m) => m.id === message.id);
    if (existingIdx >= 0) {
      store.messages[message.spaceId][existingIdx] = message;
    } else {
      store.messages[message.spaceId].push(message);
    }

    persistStore();

    // Broadcast instantly to all connected clients!
    broadcastEvent('NEW_MESSAGE', { spaceId: message.spaceId, message });
    res.json({ success: true, message });
  });

  // 6. Thread Reply
  app.post('/api/realtime/messages/reply', (req, res) => {
    const { spaceId, parentMessageId, reply } = req.body;
    if (!spaceId || !parentMessageId || !reply) {
      return res.status(400).json({ error: 'spaceId, parentMessageId, and reply are required' });
    }

    const spaceMsgs = store.messages[spaceId] || [];
    const parentMsg = spaceMsgs.find((m) => m.id === parentMessageId);
    if (!parentMsg) {
      return res.status(404).json({ error: 'Parent message not found' });
    }

    if (!parentMsg.replies) parentMsg.replies = [];
    parentMsg.replies.push(reply);
    parentMsg.repliesCount = parentMsg.replies.length;

    persistStore();
    broadcastEvent('MESSAGE_REPLIED', { spaceId, parentMessageId, reply, parentMsg });
    res.json({ success: true, parentMsg });
  });

  // 7. Toggle Reaction
  app.post('/api/realtime/reactions', (req, res) => {
    const { spaceId, messageId, emoji, userId } = req.body;
    if (!spaceId || !messageId || !emoji || !userId) {
      return res.status(400).json({ error: 'Missing parameters' });
    }

    const spaceMsgs = store.messages[spaceId] || [];
    const msg = spaceMsgs.find((m) => m.id === messageId);
    if (!msg) return res.status(404).json({ error: 'Message not found' });

    if (!msg.reactions) msg.reactions = [];
    const existingReact = msg.reactions.find((r) => r.emoji === emoji);

    if (existingReact) {
      if (existingReact.userIds.includes(userId)) {
        existingReact.userIds = existingReact.userIds.filter((id) => id !== userId);
        existingReact.count = existingReact.userIds.length;
      } else {
        existingReact.userIds.push(userId);
        existingReact.count = existingReact.userIds.length;
      }
      msg.reactions = msg.reactions.filter((r) => r.count > 0);
    } else {
      msg.reactions.push({ emoji, count: 1, userIds: [userId] });
    }

    persistStore();
    broadcastEvent('REACTION_UPDATED', { spaceId, messageId, reactions: msg.reactions });
    res.json({ success: true, reactions: msg.reactions });
  });

  // 8. Create or Update Space / DM
  app.post('/api/realtime/spaces', (req, res) => {
    const space: Space = req.body;
    if (!space || !space.id || !space.name) {
      return res.status(400).json({ error: 'Invalid space' });
    }

    const idx = store.spaces.findIndex((s) => s.id === space.id);
    if (idx >= 0) {
      store.spaces[idx] = { ...store.spaces[idx], ...space };
    } else {
      store.spaces.push(space);
    }

    persistStore();
    broadcastEvent('SPACE_UPDATED', { space, spaces: store.spaces });
    res.json({ success: true, space, spaces: store.spaces });
  });

  // 9. Tasks Create / Update
  app.post('/api/realtime/tasks', (req, res) => {
    const task: TaskItem = req.body;
    if (!task || !task.id || !task.title) {
      return res.status(400).json({ error: 'Invalid task' });
    }

    const idx = store.tasks.findIndex((t) => t.id === task.id);
    if (idx >= 0) {
      store.tasks[idx] = { ...store.tasks[idx], ...task };
    } else {
      store.tasks.push(task);
    }

    persistStore();
    broadcastEvent('TASK_UPDATED', { task, tasks: store.tasks });
    res.json({ success: true, task, tasks: store.tasks });
  });

  // 10. Friend Requests
  app.post('/api/realtime/friends', (req, res) => {
    const { action, request, requestId } = req.body;

    if (action === 'send' && request) {
      store.friendRequests.push(request);
      persistStore();
      broadcastEvent('FRIEND_REQUEST', { request });
      return res.json({ success: true, request });
    }

    if (action === 'accept' && requestId) {
      const reqItem = store.friendRequests.find((r) => r.id === requestId);
      if (reqItem) {
        reqItem.status = 'accepted';
        const newFriendship: Friendship = {
          id: `friend_${Date.now()}`,
          user1Id: reqItem.fromUserId,
          user2Id: reqItem.toUserId,
          createdAt: new Date().toISOString(),
        };
        store.friendships.push(newFriendship);
        persistStore();
        broadcastEvent('FRIEND_ACCEPTED', { request: reqItem, friendship: newFriendship });
        return res.json({ success: true, request: reqItem, friendship: newFriendship });
      }
    }

    res.status(400).json({ error: 'Invalid friend action' });
  });

  // 11. Typing indicator
  app.post('/api/realtime/typing', (req, res) => {
    const { spaceId, userId, userName, isTyping } = req.body;
    broadcastEvent('TYPING_UPDATED', { spaceId, userId, userName, isTyping });
    res.json({ success: true });
  });

  // 12. Drive Docs Create / Update
  app.post('/api/realtime/drive', (req, res) => {
    const doc: DriveDocument = req.body;
    if (!doc || !doc.id) return res.status(400).json({ error: 'Invalid doc' });

    const idx = store.driveDocs.findIndex((d) => d.id === doc.id);
    if (idx >= 0) {
      store.driveDocs[idx] = { ...store.driveDocs[idx], ...doc, updatedAt: '방금 전' };
    } else {
      store.driveDocs.unshift(doc);
    }

    persistStore();
    broadcastEvent('DRIVE_UPDATED', { doc, driveDocs: store.driveDocs });
    res.json({ success: true, doc, driveDocs: store.driveDocs });
  });

  // 13. Calendar Events Create / Update
  app.post('/api/realtime/calendar', (req, res) => {
    const event: CalendarEvent = req.body;
    if (!event || !event.id) return res.status(400).json({ error: 'Invalid event' });

    const idx = store.calendarEvents.findIndex((e) => e.id === event.id);
    if (idx >= 0) {
      store.calendarEvents[idx] = { ...store.calendarEvents[idx], ...event };
    } else {
      store.calendarEvents.push(event);
    }

    persistStore();
    broadcastEvent('CALENDAR_UPDATED', { event, calendarEvents: store.calendarEvents });
    res.json({ success: true, event, calendarEvents: store.calendarEvents });
  });

  // 14. Calendar RSVP
  app.post('/api/realtime/calendar/rsvp', (req, res) => {
    const { eventId, userId, status } = req.body;
    const ev = store.calendarEvents.find((e) => e.id === eventId);
    if (ev) {
      ev.rsvps[userId] = status;
      persistStore();
      broadcastEvent('CALENDAR_UPDATED', { event: ev, calendarEvents: store.calendarEvents });
      return res.json({ success: true, event: ev });
    }
    res.status(404).json({ error: 'Event not found' });
  });
}
