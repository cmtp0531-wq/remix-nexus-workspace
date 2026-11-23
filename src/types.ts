export type UserStatus = 'online' | 'away' | 'dnd' | 'offline';

export interface CustomStatus {
  emoji: string;
  text: string;
  duration?: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  password?: string;
  avatar: string;
  status: UserStatus;
  customStatus?: CustomStatus;
  role: string;
  department?: string;
  googleConnected?: boolean;
}

export type SpaceType = 'space' | 'dm';

export interface Space {
  id: string;
  name: string;
  type: SpaceType;
  creatorId: string;
  memberIds: string[];
  topic?: string;
  description?: string;
  isStarred?: boolean;
  dmWithUserId?: string;
  unreadCount?: number;
  pinnedMessageId?: string;
  pinnedMessageText?: string;
  isSelfNotes?: boolean;
  isHuddleActive?: boolean;
  huddleMembers?: string[];
  canvasContent?: string;
  /** 이 채팅방에서 마지막으로 시작된 회의 (모두 같은 회의로 입장) */
  activeMeetLink?: string;
  activeMeetCode?: string;
  activeMeetTitle?: string;
  activeMeetProvider?: 'google' | 'instant';
  activeMeetStartedAt?: string;
}

export interface Reaction {
  emoji: string;
  count: number;
  userIds: string[];
}

export type DriveFileType = 'doc' | 'sheet' | 'slide' | 'pdf' | 'file';
export type DrivePermission = 'viewer' | 'commenter' | 'editor';

export interface DriveDocument {
  id: string;
  title: string;
  type: DriveFileType;
  content: string;
  ownerId: string;
  ownerName: string;
  updatedAt: string;
  size: string;
  permission: DrivePermission;
  mimeType?: string;
  webViewLink?: string;
  isRealDrive?: boolean;
}

export interface DriveAttachment {
  type: 'drive';
  fileType: DriveFileType;
  fileId: string;
  fileName: string;
  fileSize: string;
  ownerName: string;
  permission: DrivePermission;
  updatedAt: string;
  contentSnippet?: string;
}

export interface MeetAttachment {
  type: 'meet';
  meetingTitle: string;
  meetLink: string;
  meetCode: string;
  hostName: string;
  activeParticipantsCount: number;
}

export interface CalendarEvent {
  id: string;
  spaceId?: string;
  creatorId: string;
  creatorName: string;
  title: string;
  description?: string;
  dateStr: string;
  startTime: string;
  endTime: string;
  location?: string;
  hasMeetVideo: boolean;
  meetLink?: string;
  attendeeIds: string[];
  attendeeNames: string[];
  rsvps: Record<string, 'accepted' | 'tentative' | 'declined'>;
  createdAt: string;
}

export interface CalendarAttachment {
  type: 'calendar';
  eventId?: string;
  eventTitle: string;
  dateStr: string;
  timeStr: string;
  location?: string;
  meetLink?: string;
  attendees: string[];
  rsvps: Record<string, 'accepted' | 'tentative' | 'declined'>;
}

export interface ImageAttachment {
  type: 'image';
  url: string;
  name: string;
  size?: string;
}

export interface FileAttachment {
  type: 'file';
  url: string;
  name: string;
  size: string;
  fileExtension?: string;
}

export interface VoiceNoteAttachment {
  type: 'voice';
  audioUrl: string;
  durationSec: number;
}

export interface LocationAttachment {
  type: 'location';
  name?: string;
  address: string;
  lat: number;
  lng: number;
  accuracyMeters?: number;
}

export interface PollOption {
  id: string;
  text: string;
  voterIds: string[];
}

export interface PollAttachment {
  type: 'poll';
  question: string;
  options: PollOption[];
  creatorName: string;
  isClosed?: boolean;
}

export interface YouTubeAttachment {
  type: 'youtube';
  videoId: string;
  url: string;
  title?: string;
}

export type Attachment = 
  | DriveAttachment 
  | MeetAttachment 
  | CalendarAttachment 
  | ImageAttachment 
  | FileAttachment
  | VoiceNoteAttachment
  | LocationAttachment
  | PollAttachment
  | YouTubeAttachment;

export interface ThreadReply {
  id: string;
  messageId: string;
  senderId: string;
  senderName: string;
  senderAvatar: string;
  content: string;
  timestamp: string;
}

export interface CustomEmoji {
  id: string;
  name: string;
  url: string;
}

export interface MessageReplyContext {
  messageId: string;
  senderName: string;
  content: string;
}

export interface Message {
  id: string;
  spaceId: string;
  senderId: string;
  senderName: string;
  senderAvatar: string;
  senderRole?: string;
  content: string;
  timestamp: string;
  reactions: Reaction[];
  attachments?: Attachment[];
  repliesCount?: number;
  replies?: ThreadReply[];
  replyTo?: MessageReplyContext;
  isStarred?: boolean;
  isPinned?: boolean;
  isBookmarked?: boolean;
  isEdited?: boolean;
  editedAt?: string;
  isSystemMessage?: boolean;
  reminderTime?: string;
  forwardedFrom?: { spaceName: string; originalSender: string };
}

export interface TaskItem {
  id: string;
  spaceId: string;
  title: string;
  assigneeId: string;
  assigneeName: string;
  assigneeAvatar: string;
  dueDate: string;
  completed: boolean;
  priority: 'low' | 'medium' | 'high';
  googleTaskId?: string;
  syncedToGoogleTasks?: boolean;
  syncedToGoogleCalendar?: boolean;
}

export type FriendRequestStatus = 'pending' | 'accepted' | 'rejected';

export interface FriendRequest {
  id: string;
  fromUserId: string;
  toUserId: string;
  fromUserName: string;
  fromUserAvatar: string;
  toUserName: string;
  status: FriendRequestStatus;
  message: string;
  timestamp: string;
}

export interface Friendship {
  id: string;
  user1Id: string;
  user2Id: string;
  createdAt: string;
}

export interface GmailMessageSummary {
  id: string;
  threadId: string;
  subject: string;
  from: string;
  fromEmail: string;
  to: string;
  date: string;
  snippet: string;
  isUnread: boolean;
  isStarred: boolean;
  labels: string[];
}

export interface GmailMessageDetail extends GmailMessageSummary {
  bodyText: string;
  bodyHtml?: string;
  attachments?: { filename: string; mimeType: string; size: number; attachmentId?: string }[];
}

export type AppFocusMode = 'chat' | 'work' | 'split';
