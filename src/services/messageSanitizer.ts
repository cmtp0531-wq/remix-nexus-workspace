// ============================================================
// 메시지 데이터 방어(sanitize)
// - Firestore·localStorage 에 예전 버전이 남긴 메시지/투표 데이터가 일부 비어 있거나
//   타입이 어긋나도 채팅 화면이 통째로 죽지 않도록, 화면에 넘기기 전에 모양을 맞춥니다.
// - 특히 투표(options/voterIds), 반응(reactions/userIds), 스레드(replies) 는
//   배열이 아닌 값이 들어오면 렌더 중 예외가 나 채팅 전체가 가려질 수 있습니다.
// ============================================================

import type { Attachment, Message, Reaction, ThreadReply } from '../types';

const isObject = (value: unknown): value is Record<string, any> =>
  Boolean(value) && typeof value === 'object';

const toArray = <T,>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : []);

const toText = (value: unknown, fallback = ''): string =>
  typeof value === 'string' ? value : value === null || value === undefined ? fallback : String(value);

const toNumber = (value: unknown, fallback = 0): number => {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const sanitizeReaction = (raw: unknown): Reaction | null => {
  if (!isObject(raw)) return null;
  const emoji = toText(raw.emoji, '');
  if (!emoji) return null;
  const userIds = toArray<unknown>(raw.userIds).map((id) => toText(id, '')).filter(Boolean);
  return {
    emoji,
    count: Math.max(toNumber(raw.count, userIds.length), userIds.length),
    userIds,
  } as Reaction;
};

const sanitizeReply = (raw: unknown, index: number, messageId: string): ThreadReply | null => {
  if (!isObject(raw)) return null;
  const content = toText(raw.content, '');
  if (!content && !raw.id) return null;
  return {
    id: toText(raw.id, `reply_${messageId}_${index}`),
    messageId: toText(raw.messageId, messageId),
    senderId: toText(raw.senderId, 'unknown'),
    senderName: toText(raw.senderName, '참여자'),
    senderAvatar: toText(raw.senderAvatar, ''),
    content,
    timestamp: toText(raw.timestamp, ''),
  } as ThreadReply;
};

/** 첨부(투표·일정·유튜브 등)를 화면이 믿고 그릴 수 있는 모양으로 맞춥니다. */
export const sanitizeAttachment = (raw: unknown, index: number): Attachment | null => {
  if (!isObject(raw)) return null;
  const type = toText(raw.type, 'file');

  if (type === 'poll') {
    const options = toArray<unknown>(raw.options)
      .slice(0, 50)
      .map((option, optionIndex) => {
        if (!isObject(option)) return null;
        return {
          id: toText(option.id, `opt_${index}_${optionIndex}`),
          text: toText(option.text, `옵션 ${optionIndex + 1}`),
          voterIds: toArray<unknown>(option.voterIds).map((id) => toText(id, '')).filter(Boolean),
        };
      })
      .filter(Boolean);
    return {
      ...raw,
      type: 'poll',
      question: toText(raw.question, '투표'),
      creatorName: toText(raw.creatorName, ''),
      options,
    } as Attachment;
  }

  if (type === 'calendar') {
    return {
      ...raw,
      type: 'calendar',
      eventTitle: toText(raw.eventTitle, '일정'),
      dateStr: toText(raw.dateStr, ''),
      timeStr: toText(raw.timeStr, ''),
      location: toText(raw.location, ''),
      attendees: toArray<unknown>(raw.attendees).map((name) => toText(name, '')).filter(Boolean),
      rsvps: isObject(raw.rsvps) ? { ...raw.rsvps } : {},
    } as Attachment;
  }

  // 화면에 그대로 문자열로 찍히는 값이 객체(Firestore Timestamp 등)면
  // React 가 "Objects are not valid as a React child" 로 채팅 전체를 무너뜨립니다.
  if (type === 'drive') {
    return {
      ...raw,
      type,
      fileId: toText(raw.fileId, ''),
      fileName: toText(raw.fileName, '문서'),
      fileType: toText(raw.fileType, 'doc'),
      ownerName: toText(raw.ownerName, ''),
      fileSize: toText(raw.fileSize, ''),
    } as Attachment;
  }

  if (type === 'meet') {
    return {
      ...raw,
      type,
      meetingTitle: toText(raw.meetingTitle, '회의'),
      meetCode: toText(raw.meetCode, ''),
      hostName: toText(raw.hostName, ''),
      meetLink: toText(raw.meetLink, ''),
    } as Attachment;
  }

  if (type === 'image' || type === 'file') {
    return {
      ...raw,
      type,
      url: toText(raw.url, ''),
      name: toText(raw.name, '첨부파일'),
      size: toText(raw.size, ''),
    } as Attachment;
  }

  if (type === 'voice') {
    return {
      ...raw,
      type,
      audioUrl: toText(raw.audioUrl, ''),
      durationSec: toNumber(raw.durationSec, 0),
    } as Attachment;
  }

  if (type === 'location') {
    return {
      ...raw,
      type,
      address: toText(raw.address, '공유된 위치'),
      name: toText(raw.name, ''),
      lat: toNumber(raw.lat, 0),
      lng: toNumber(raw.lng, 0),
    } as Attachment;
  }

  if (type === 'youtube') {
    return {
      ...raw,
      type,
      videoId: toText(raw.videoId, ''),
      url: toText(raw.url, ''),
      title: toText(raw.title, 'YouTube 동영상'),
    } as Attachment;
  }

  return { ...raw, type } as Attachment;
};

/** 메시지 한 건을 방어적으로 정리합니다. 쓸 수 없는 항목이면 null. */
export const sanitizeMessage = (raw: unknown, spaceId: string, index = 0): Message | null => {
  if (!isObject(raw)) return null;
  const id = toText(raw.id, '') || `msg_recovered_${index}_${Date.now()}`;
  const content = toText(raw.content, '');

  const attachments = raw.attachments === undefined
    ? undefined
    : toArray<unknown>(raw.attachments)
        .map((attachment, attachmentIndex) => sanitizeAttachment(attachment, attachmentIndex))
        .filter((attachment): attachment is Attachment => Boolean(attachment));

  const reactions = toArray<unknown>(raw.reactions)
    .map((reaction) => sanitizeReaction(reaction))
    .filter((reaction): reaction is Reaction => Boolean(reaction));

  const replies = toArray<unknown>(raw.replies)
    .map((reply, replyIndex) => sanitizeReply(reply, replyIndex, id))
    .filter((reply): reply is ThreadReply => Boolean(reply));

  return {
    ...raw,
    id,
    spaceId: toText(raw.spaceId, spaceId),
    senderId: toText(raw.senderId, 'unknown'),
    senderName: toText(raw.senderName, '참여자'),
    senderAvatar: toText(raw.senderAvatar, ''),
    content,
    timestamp: toText(raw.timestamp, ''),
    reactions,
    attachments,
    replyTo: isObject(raw.replyTo)
      ? {
          messageId: toText(raw.replyTo.messageId, ''),
          senderName: toText(raw.replyTo.senderName, ''),
          content: toText(raw.replyTo.content, ''),
        }
      : undefined,
    forwardedFrom: isObject(raw.forwardedFrom)
      ? { spaceName: toText(raw.forwardedFrom.spaceName, ''), originalSender: toText(raw.forwardedFrom.originalSender, '') }
      : undefined,
    replies: raw.replies === undefined && replies.length === 0 ? undefined : replies,
    repliesCount: Math.max(toNumber(raw.repliesCount, replies.length), 0),
    createdAt: toNumber(raw.createdAt, 0) || undefined,
  } as Message;
};

/** 스페이스별 메시지 목록 전체를 정리합니다. */
export const sanitizeMessages = (list: unknown, spaceId = ''): Message[] =>
  toArray<unknown>(list)
    .map((message, index) => sanitizeMessage(message, spaceId, index))
    .filter((message): message is Message => Boolean(message));

/** 스페이스 → 메시지 목록 맵 전체를 정리합니다. */
export const sanitizeMessagesMap = (map: unknown): Record<string, Message[]> => {
  if (!isObject(map)) return {};
  const next: Record<string, Message[]> = {};
  Object.entries(map).forEach(([spaceId, list]) => {
    next[spaceId] = sanitizeMessages(list, spaceId);
  });
  return next;
};

/**
 * 메시지 안의 투표에 내 표를 반영한 새 메시지를 돌려줍니다.
 * (서버 스냅샷이 내 표를 잠시 덮어써도 화면에서 표가 사라지지 않게 할 때 사용)
 */
export const applyPollVoteToMessage = (
  message: Message,
  userId: string,
  optionId: string | null
): Message => {
  if (!Array.isArray(message.attachments)) return message;
  let changed = false;
  const attachments = message.attachments.map((attachment) => {
    if (!attachment || attachment.type !== 'poll') return attachment;
    const poll = attachment as any;
    const options = toArray<any>(poll.options).map((option) => {
      const voterIds = toArray<unknown>(option?.voterIds).map((id) => toText(id, '')).filter(Boolean);
      const withoutMine = voterIds.filter((id) => id !== userId);
      if (optionId && option?.id === optionId && !withoutMine.includes(userId)) {
        changed = true;
        return { ...option, voterIds: [...withoutMine, userId] };
      }
      if (withoutMine.length !== voterIds.length) changed = true;
      return { ...option, voterIds: withoutMine };
    });
    return { ...poll, options };
  });
  return changed ? { ...message, attachments } : message;
};
