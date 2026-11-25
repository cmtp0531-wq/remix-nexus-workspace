import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  Send, 
  Smile, 
  MessageSquare, 
  Star, 
  Hash, 
  Video, 
  Calendar as CalendarIcon, 
  HardDrive, 
  FileText, 
  Table, 
  Split, 
  PanelRightOpen, 
  Menu, 
  Users, 
  Image as ImageIcon, 
  Paperclip, 
  File as FileIcon, 
  Download, 
  Maximize2, 
  X, 
  Settings,
  Headphones,
  Mic,
  MicOff,  MapPin,
  Pin,
  PinOff,
  Trash2,
  Bold,
  Italic,
  Strikethrough,
  List,
  Sparkles,
  Bot,
  Play,
  Pause,
  ExternalLink,
  EyeOff,
  Navigation,
  Edit3,
  CheckCircle2,
  Vote,
  Bookmark,
  FileCode,
  BookOpen,
  Zap,
  Clock,
  Check,
  MoreHorizontal,
  Share2,
  Copy,
  Monitor,
  Youtube,
  LogOut,
  Reply,
  Bell,
  PanelLeftOpen,
  PanelLeftClose,
  Languages
} from 'lucide-react';
import { 
  Space, 
  Message, 
  User, 
  Attachment, 
  DriveAttachment, 
  MeetAttachment, 
  CalendarAttachment, 
  ImageAttachment, 
  FileAttachment,
  VoiceNoteAttachment,
  LocationAttachment,
  PollAttachment,
  PollOption,
  YouTubeAttachment,
  MessageReplyContext
} from '../types';
import { 
  getSmartComposeSuggestion, 
  getSmartReplies, 
  summarizeConversationWithGemini, 
  queryGeminiAssistant,
  searchYouTubeVideos
} from '../services/geminiService';
import { storage } from '../storage';
import { contrastText } from '../theme';
import { LocationPickerModal } from './LocationPickerModal';
import { YouTubeHubModal } from './YouTubeHubModal';
import { avatarSrc, handleAvatarError } from './UserAvatar';
import { RichText } from './RichText';
import { MessageTranslateModal, TranslatedBlock, MessageTranslationState } from './MessageTranslate';
import { Contact } from '../services/contactsService';
import { contactNameOf } from '../services/contactsService';
import { InviteBell } from './InviteCenter';
import type { Invite } from '../services/inviteService';

interface GoogleChatMainProps {
  space: Space;
  messages: Message[];
  currentUser: User;
  allUsers: User[];
  activeTab: 'chat' | 'tasks';
  onTabChange: (tab: 'chat' | 'tasks') => void;
  onSendMessage: (content: string, attachments?: Attachment[], replyTo?: MessageReplyContext) => void;
  onOpenThread: (message: Message) => void;
  onToggleReaction: (messageId: string, emoji: string) => void;
  onToggleStarSpace: (spaceId: string) => void;
  onToggleStarMessage: (messageId: string) => void;
  onOpenMeetModal: () => void;
  onOpenCalendarModal: () => void;
  onOpenDrivePicker: () => void;
  onOpenDocEditor: (fileId: string, fileName: string, fileType: string) => void;
  onOpenMeetRoom: (link: string, title: string) => void;
  onRsvpCalendar: (messageId: string, status: 'accepted' | 'tentative' | 'declined') => void;
  onOpenSpaceSettings?: () => void;
  onToggleRightPanel: () => void;
  onToggleMobileSidebar: () => void;
  onPinMessage?: (messageId: string, text: string) => void;
  onUnpinMessage?: () => void;
  onDeleteMessageTracedFree?: (messageId: string) => void;
  onEditMessage?: (messageId: string, newContent: string) => void;
  onVotePoll?: (messageId: string, optionId: string) => void;
  onUpdateSpaceCanvas?: (spaceId: string, content: string) => void;
  onOpenWorkspaceHub?: () => void;
  onLogout?: () => void;
  onOpenSettings?: () => void;
  isGeminiPanelOpen?: boolean;
  onToggleGeminiPanel?: (prefilledQuery?: string) => void;
  isSidebarCollapsed?: boolean;
  onToggleCollapseSidebar?: () => void;
  deviceType?: 'mobile' | 'tablet' | 'desktop';
  notificationsEnabled?: boolean;
  onToggleNotifications?: () => void;
  onOpenDriveView?: () => void;
  onOpenYouTubeView?: () => void;
  onCreateTask?: (title: string) => void;
  onCreateReminder?: (text: string, minutes: number) => void;
  /** 연락처(별명) 목록 — 저장한 이름으로 대화 상대를 표시합니다 */
  contacts?: Contact[];
  onOpenContacts?: () => void;
  /** 허들: 진행 중인 회의가 있으면 같은 방으로, 없으면 새 회의를 만들어 링크를 올립니다 */
  onOpenHuddle?: () => void;
  invites?: Invite[];
  onAcceptInvite?: (invite: Invite) => void;
  onDeclineInvite?: (invite: Invite) => void;
}

const CAFE_EMOJIS = ['👍', '❤️', '☕', '🥐', '🌿', '🍰', '🥨', '💡', '🎉'];

const EMOJI_PICKER_LIST = [
  '😀', '😄', '😊', '🥰', '😂', '🤣', '😉', '😍',
  '🤔', '😅', '😭', '😮', '😴', '😎', '🙃', '🤗',
  '👍', '👏', '🙏', '💪', '🙌', '👀', '👋', '🤝',
  '❤️', '💙', '💚', '💜', '🧡', '💛', '🤍', '✨',
  '🔥', '💡', '✅', '❌', '⭐', '🎯', '💯', '🎉',
  '🚀', '📌', '📎', '📈', '📉', '📝', '⏰', '🔔',
  '☕', '🍰', '🥐', '🌿', '🍔', '🍜', '🍎', '🎂',
  '🌞', '🌱', '🏠', '💬', '📚', '🎮', '🎵', '🧑‍💻',
];

const REACTION_EMOJI_PALETTE = [
  '👍', '❤️', '☕', '🎉', '🚀', '👀', '🥐', '👏',
  '🔥', '😂', '💡', '✅', '💯', '🙏', '🙌', '✨',
  '💪', '🍰', '🥨', '🌿'
];

const SLASH_COMMANDS = [
  { cmd: '/poll', desc: '실시간 즉석 투표 생성', placeholder: '/poll 점심 메뉴 뭐 먹을까요? [파스타, 샌드위치, 비빔밥]' },
  { cmd: '/meet', desc: 'Google Meet 화상 회의 즉시 생성', placeholder: '/meet 주간 팀 싱크' },
  { cmd: '/youtube', desc: 'YouTube 영상 공유 및 인앱 재생', placeholder: '/youtube https://youtu.be/...' },
  { cmd: '/task', desc: '할 일 목록에 추가 (Google Tasks 연동 시 함께 동기화)', placeholder: '/task 디자인 시안 검토하기' },
  { cmd: '/canvas', desc: '스페이스 실시간 공유 캔버스 열기', placeholder: '/canvas' },
  { cmd: '/location', desc: '실시간 내 GPS 위치 공유', placeholder: '/location' },
  { cmd: '/remind', desc: '리마인더 알림 예약', placeholder: '/remind 30분 뒤 회의 준비' },
  { cmd: '/delete', desc: '내가 보낸 최근 메시지 흔적 없이 삭제', placeholder: '/delete' },
  { cmd: '/clear', desc: '입력창 비우기', placeholder: '/clear' },
  { cmd: '/shrug', desc: '¯\\_(ツ)_/¯ 이모티콘 전송', placeholder: '/shrug' },
];

const VoiceNotePlayer: React.FC<{ voice: VoiceNoteAttachment }> = ({ voice }) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [total, setTotal] = useState(voice.durationSec || 0);
  const [failed, setFailed] = useState(false);
  const bars = [5, 13, 8, 17, 10, 19, 14, 8, 12, 7, 15, 10, 6, 13, 9, 16];

  const fmt = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;
  const toggle = () => {
    const el = audioRef.current;
    if (!el) return;
    if (playing) {
      el.pause();
      return;
    }
    el.play().catch(() => setFailed(true));
  };
  const seekTo = (ratio: number) => {
    const el = audioRef.current;
    if (!el) return;
    const duration = Number.isFinite(el.duration) ? el.duration : total;
    if (!duration) return;
    el.currentTime = Math.max(0, Math.min(1, ratio)) * duration;
    setProgress(el.currentTime);
  };

  return (
    <div className="mt-2.5 p-3 rounded-2xl bg-[#FDFBF7] border border-[#EBE5DA] cafe-shadow flex items-center gap-3 w-[min(21rem,74vw)]">
      <audio
        ref={audioRef}
        src={voice.audioUrl}
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false);
          setProgress(0);
        }}
        onTimeUpdate={(e) => setProgress(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => {
          const duration = e.currentTarget.duration;
          if (Number.isFinite(duration) && duration > 0) setTotal(duration);
        }}
        onError={() => setFailed(true)}
      />
      <button
        onClick={toggle}
        data-testid="voice-play-button"
        aria-label={playing ? '음성 메시지 일시정지' : '음성 메시지 재생'}
        className="w-9 h-9 rounded-xl bg-[#3E2723] hover:bg-[#2C2520] text-white flex items-center justify-center flex-shrink-0 transition-transform active:scale-95 shadow-xs"
      >
        {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
      </button>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between text-[11px] font-semibold text-[#2C2520] mb-1">
          <span>음성 메모</span>
          <span className="font-mono text-[10px] text-[#7A6A5C]">
            {playing ? `${fmt(progress)} / ` : ''}
            {fmt(total || voice.durationSec)}
          </span>
        </div>
        <div
          className="flex items-center gap-[3px] h-5 cursor-pointer"
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            seekTo((e.clientX - rect.left) / rect.width);
          }}
        >
          {bars.map((h, idx) => {
            const reached = !failed && total > 0 && progress / total >= (idx + 0.5) / bars.length;
            return (
              <div
                key={idx}
                style={{ height: `${h}px` }}
                className={`w-1 rounded-full transition-colors ${
                  playing && reached ? 'bg-[#C18C5D] voice-bar-anim' : reached ? 'bg-[#C18C5D]' : 'bg-[#DCD3C5]'
                }`}
              />
            );
          })}
        </div>
        {failed && <p className="text-[9.5px] text-[#DC2626] mt-1">이 기기에서 재생할 수 없는 형식입니다.</p>}
      </div>
    </div>
  );
};

export const GoogleChatMain: React.FC<GoogleChatMainProps> = ({
  space,
  messages,
  currentUser,
  allUsers,
  activeTab,
  onTabChange,
  onSendMessage,
  onOpenThread,
  onToggleReaction,
  onToggleStarSpace,
  onToggleStarMessage,
  onOpenMeetModal,
  onOpenCalendarModal,
  onOpenDrivePicker,
  onOpenDocEditor,
  onOpenMeetRoom,
  onRsvpCalendar,
  onOpenSpaceSettings,
  onToggleRightPanel,
  onToggleMobileSidebar,
  onPinMessage,
  onUnpinMessage,
  onDeleteMessageTracedFree,
  onEditMessage,
  onVotePoll,
  onUpdateSpaceCanvas,
  onOpenWorkspaceHub,
  onLogout,
  onOpenSettings,
  isGeminiPanelOpen,
  onToggleGeminiPanel,
  isSidebarCollapsed = false,
  onToggleCollapseSidebar,
  deviceType = 'desktop',
  notificationsEnabled = true,
  onToggleNotifications,
  onOpenDriveView,
  onOpenYouTubeView,
  onCreateTask,
  onCreateReminder,
  contacts = [],
  onOpenContacts,
  onOpenHuddle,
  invites = [],
  onAcceptInvite,
  onDeclineInvite,
}) => {
  const [text, setText] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showFormatBar, setShowFormatBar] = useState(false);
  const [pendingAttachments, setPendingAttachments] = useState<Attachment[]>([]);
  const [lightboxImage, setLightboxImage] = useState<{ url: string; name: string } | null>(null);

  // Message Inline Editing (Slack Feature)
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');

  // Audio Huddles (음성 통화)
  const [isHuddleActive, setIsHuddleActive] = useState(false);
  const [isHuddleMuted, setIsHuddleMuted] = useState(false);
  const [isHuddleScreenSharing, setIsHuddleScreenSharing] = useState(false);
  const huddleMediaStreamRef = useRef<MediaStream | null>(null);
  const huddleScreenStreamRef = useRef<MediaStream | null>(null);

  // YouTube In-App Player Modal
  const [isYouTubeModalOpen, setIsYouTubeModalOpen] = useState(false);
  const [youtubeInputUrl, setYoutubeInputUrl] = useState('');

  // Real Geolocation Modal
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);

  // Voice Note Recording
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [voiceRecordSeconds, setVoiceRecordSeconds] = useState(0);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const voiceTimerRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const voiceChunksRef = useRef<Blob[]>([]);
  const voiceStreamRef = useRef<MediaStream | null>(null);
  const voiceCancelRef = useRef(false);
  const voiceElapsedRef = useRef(0);

  // Voice Player playback
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);

  // 말풍선 색 (설정에서 커스텀, localStorage 저장)
  const [bubbleColors, setBubbleColors] = useState(() => storage.getBubbleColors());
  useEffect(() => {
    const sync = () => setBubbleColors(storage.getBubbleColors());
    window.addEventListener('nexus-bubble-colors', sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener('nexus-bubble-colors', sync);
      window.removeEventListener('storage', sync);
    };
  }, []);
  const mineTextColor = bubbleColors.mineText || contrastText(bubbleColors.mine);
  const otherTextColor = bubbleColors.otherText || contrastText(bubbleColors.other);

  // 내 화면에서만 가린 메시지 목록 (사용자별 localStorage 저장)
  const [hiddenMessageIds, setHiddenMessageIds] = useState<string[]>(() => storage.getHiddenMessageIds(currentUser.id));
  useEffect(() => {
    setHiddenMessageIds(storage.getHiddenMessageIds(currentUser.id));
  }, [currentUser.id, messages.length]);

  // Sinusoidal 3-dots typing indicator
  const [isPeerTyping, setIsPeerTyping] = useState(false);
  const [typingPeerUser, setTypingPeerUser] = useState<User | null>(null);

  // Gemini AI Modals
  const [isGeminiSummaryOpen, setIsGeminiSummaryOpen] = useState(false);
  const [geminiSummaryLines, setGeminiSummaryLines] = useState<string[]>([]);
  const [isSummaryLoading, setIsSummaryLoading] = useState(false);
  const [isGeminiSearchOpen, setIsGeminiSearchOpen] = useState(false);
  const [geminiSearchQuery, setGeminiSearchQuery] = useState('');
  const [geminiSearchResult, setGeminiSearchResult] = useState<string | null>(null);
  const [isSearchingGemini, setIsSearchingGemini] = useState(false);

  // Space Canvas Drawer (Slack Canvas Feature)
  const [isCanvasOpen, setIsCanvasOpen] = useState(false);
  const [canvasText, setCanvasText] = useState(space.canvasContent || '');
  const [canvasSavedToast, setCanvasSavedToast] = useState(false);

  // Quick Poll Modal
  const [isPollModalOpen, setIsPollModalOpen] = useState(false);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState(['', '', '']);

  // Jump to message highlight
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);

  // Filter Bookmarks
  const [showOnlyBookmarks, setShowOnlyBookmarks] = useState(false);

  // Trace-free Delete with Undo
  const [lastDeletedMessage, setLastDeletedMessage] = useState<Message | null>(null);
  const [deleteToast, setDeleteToast] = useState<{ message: string; undoable: boolean } | null>(null);

  // In-line Quote Reply target (답글 작성)
  const [activeReplyTarget, setActiveReplyTarget] = useState<Message | null>(null);

  // Emoji Reaction Picker Popover target message ID (이모티콘 반응 팝오버)
  const [activeEmojiPickerMessageId, setActiveEmojiPickerMessageId] = useState<string | null>(null);
  const emojiButtonRef = useRef<HTMLButtonElement | null>(null);
  const emojiPanelRef = useRef<HTMLDivElement | null>(null);
  const [emojiPanelPos, setEmojiPanelPos] = useState<{ left: number; bottom: number }>({ left: 12, bottom: 96 });
  const [reactionPanelPos, setReactionPanelPos] = useState<{ left: number; top: number }>({ left: 12, top: 120 });
  const reactionPanelRef = useRef<HTMLDivElement | null>(null);

  const toggleEmojiPicker = () => {
    const btn = emojiButtonRef.current;
    if (btn) {
      const rect = btn.getBoundingClientRect();
      const width = 288;
      setEmojiPanelPos({
        left: Math.max(8, Math.min(rect.left, window.innerWidth - width - 8)),
        bottom: Math.max(8, window.innerHeight - rect.top + 10),
      });
    }
    setShowEmojiPicker((prev) => !prev);
  };

  const insertEmoji = (emoji: string) => {
    const node = textareaRef.current;
    if (node && typeof node.selectionStart === 'number') {
      const start = node.selectionStart;
      const end = node.selectionEnd ?? start;
      const next = `${text.slice(0, start)}${emoji}${text.slice(end)}`;
      setText(next);
      window.requestAnimationFrame(() => {
        node.focus();
        const caret = start + emoji.length;
        node.setSelectionRange(caret, caret);
      });
    } else {
      setText((prev) => prev + emoji);
    }
    setShowEmojiPicker(false);
  };

  useEffect(() => {
    if (!showEmojiPicker && !activeEmojiPickerMessageId) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (emojiPanelRef.current?.contains(target) || emojiButtonRef.current?.contains(target)) return;
      if (reactionPanelRef.current?.contains(target)) return;
      setShowEmojiPicker(false);
      setActiveEmojiPickerMessageId(null);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowEmojiPicker(false);
        setActiveEmojiPickerMessageId(null);
      }
    };
    const onViewportChange = () => {
      setShowEmojiPicker(false);
      setActiveEmojiPickerMessageId(null);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    window.addEventListener('resize', onViewportChange);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('resize', onViewportChange);
    };
  }, [showEmojiPicker, activeEmojiPickerMessageId]);

  // Message translation (per message language + original/translation toggle)
  const [translations, setTranslations] = useState<Record<string, MessageTranslationState>>({});
  const [translateTargetMessage, setTranslateTargetMessage] = useState<Message | null>(null);

  // Slack Features: Message Reminders & Forwarding & 3-dots Context Menu
  const [activeMenuMessageId, setActiveMenuMessageId] = useState<string | null>(null);
  const [reminderToast, setReminderToast] = useState<{ messageId: string; content: string } | null>(null);
  const [forwardingMessage, setForwardingMessage] = useState<Message | null>(null);
  const [forwardSuccessToast, setForwardSuccessToast] = useState<string | null>(null);
  const [slashHint, setSlashHint] = useState<string | null>(null);
  const showSlashHint = (message: string) => {
    setSlashHint(message);
    window.setTimeout(() => setSlashHint(null), 3500);
  };

  const imageInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  useEffect(() => {
    setCanvasText(space.canvasContent || `# #${space.name} 실시간 협업 캔버스\n\n- 팀 목표 및 회의 안건\n- 참고 링크 및 리소스\n- 빠른 메모를 기록해보세요!`);
  }, [space.id, space.canvasContent]);

  // No simulated peer typing - real interactions only
  useEffect(() => {
    setIsPeerTyping(false);
  }, [space.id]);

  const spaceMembers = space.type === 'dm'
    ? allUsers.filter((u) => space.memberIds.includes(u.id))
    : allUsers.filter((u) => space.id === 'space_general' || space.memberIds.includes(u.id));

  // Smart Compose ghost suggestion
  const smartComposeGhost = getSmartComposeSuggestion(text);
  const lastNonSystemMessage = [...messages].reverse().find((m) => !m.isSystemMessage);
  const smartReplies = getSmartReplies(lastNonSystemMessage?.content);

  // Filtered messages list (supports bookmarks filter + locally hidden messages)
  const baseDisplayed = showOnlyBookmarks
    ? messages.filter((m) => m.isStarred || m.isBookmarked)
    : messages;
  const displayedMessages = baseDisplayed.map((m) =>
    hiddenMessageIds.includes(m.id)
      ? { ...m, content: '삭제된 메시지', attachments: [], reactions: [], isPinned: false, repliesCount: 0, isStarred: false }
      : m
  );

  // Slash commands filter
  const isSlashCommandMode = text.startsWith('/');
  const matchedSlashCommands = isSlashCommandMode
    ? SLASH_COMMANDS.filter((c) => c.cmd.startsWith(text.toLowerCase()) || text.toLowerCase().startsWith(c.cmd))
    : [];

  const handleSend = () => {
    const clean = text.trim();
    if (!clean && pendingAttachments.length === 0) return;

    // Process Slash Commands
    if (clean === '/shrug') {
      onSendMessage('¯\\_(ツ)_/¯');
      setText('');
      return;
    }
    if (clean === '/meet') {
      onOpenMeetModal();
      setText('');
      return;
    }
    if (clean.startsWith('/youtube')) {
      const urlPart = clean.replace('/youtube', '').trim();
      if (urlPart) {
        handleShareYouTube(urlPart);
      } else {
        setIsYouTubeModalOpen(true);
      }
      setText('');
      return;
    }
    if (clean === '/delete' || clean === '/del') {
      const myMsgs = [...messages].reverse().filter((m) => m.senderId === currentUser.id && !m.isSystemMessage);
      if (myMsgs.length > 0 && onDeleteMessageTracedFree) {
        handleDeleteMessage(myMsgs[0].id);
      }
      setText('');
      return;
    }
    if (clean === '/location') {
      setIsLocationModalOpen(true);
      setText('');
      return;
    }
    if (clean === '/canvas') {
      setIsCanvasOpen(true);
      setText('');
      return;
    }
    if (clean === '/poll') {
      setIsPollModalOpen(true);
      setText('');
      return;
    }
    if (clean === '/clear') {
      setText('');
      return;
    }
    if (clean.startsWith('/task')) {
      const title = clean.replace('/task', '').trim();
      if (!title) {
        setText('/task ');
        showSlashHint('할 일 제목을 입력하세요. 예: /task 보고서 초안 작성');
        return;
      }
      onCreateTask?.(title);
      onSendMessage(`✅ 할 일을 추가했습니다: **${title}**`);
      setText('');
      return;
    }
    if (clean.startsWith('/remind')) {
      const rest = clean.replace('/remind', '').trim();
      const match = rest.match(/^(\d+)\s*(분|시간|초)\s*(?:뒤|후)?\s*(.*)$/);
      if (!rest || !match) {
        setText('/remind ');
        showSlashHint('형식: /remind 30분 뒤 회의 준비  (분/시간/초 지원)');
        return;
      }
      const amount = Number(match[1]);
      const unit = match[2];
      const minutes = unit === '시간' ? amount * 60 : unit === '초' ? amount / 60 : amount;
      const label = match[3]?.trim() || '리마인더';
      if (!onCreateReminder) {
        showSlashHint('이 환경에서는 리마인더를 예약할 수 없습니다.');
        setText('');
        return;
      }
      onCreateReminder(label, minutes);
      onSendMessage(`⏰ ${amount}${unit} 뒤에 알려드릴게요: **${label}**`);
      setText('');
      return;
    }

    // Auto-detect YouTube links inside message
    const ytVidId = getYouTubeVideoId(clean);
    let finalAttachments = pendingAttachments.length > 0 ? [...pendingAttachments] : [];
    if (ytVidId && !finalAttachments.some((a) => a.type === 'youtube')) {
      finalAttachments.push({
        type: 'youtube',
        videoId: ytVidId,
        url: clean,
        title: 'YouTube 동영상',
      });
    }

    onSendMessage(
      clean,
      finalAttachments.length > 0 ? finalAttachments : undefined,
      activeReplyTarget ? {
        messageId: activeReplyTarget.id,
        senderName: activeReplyTarget.senderName,
        content: activeReplyTarget.content,
      } : undefined
    );
    setText('');
    setPendingAttachments([]);
    setShowEmojiPicker(false);
    setActiveReplyTarget(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Smart Compose: Tab key completes sentence
    if (e.key === 'Tab' && smartComposeGhost) {
      e.preventDefault();
      setText((prev) => prev + smartComposeGhost);
      return;
    }

    // Ctrl+B / Cmd+B: Bold
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
      e.preventDefault();
      applyFormatting('**');
      return;
    }

    // Ctrl+I / Cmd+I: Italic
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'i') {
      e.preventDefault();
      applyFormatting('*');
      return;
    }

    // Up Arrow key: Edit last own message (Slack Feature)
    if (e.key === 'ArrowUp' && !text.trim()) {
      const myMsgs = [...messages].reverse().filter((m) => m.senderId === currentUser.id && !m.isSystemMessage);
      if (myMsgs.length > 0) {
        e.preventDefault();
        setEditingMessageId(myMsgs[0].id);
        setEditingText(myMsgs[0].content);
        return;
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const applyFormatting = (wrapper: string) => {
    if (!textareaRef.current) return;
    const start = textareaRef.current.selectionStart;
    const end = textareaRef.current.selectionEnd;
    const selected = text.substring(start, end);

    if (selected) {
      const newText = text.substring(0, start) + wrapper + selected + wrapper + text.substring(end);
      setText(newText);
    } else {
      const placeholder = wrapper === '• ' ? '• 항목' : '텍스트';
      const insert = wrapper === '• ' ? `\n• ` : `${wrapper}${placeholder}${wrapper}`;
      setText((prev) => prev + insert);
    }
  };

  // Immediate Trace-free Delete without window.confirm with Instant Undo
  const handleDeleteMessage = (messageId: string) => {
    const found = messages.find((m) => m.id === messageId);
    const isMine = !!found && found.senderId === currentUser.id;

    // 남의 메시지: 서버는 건드리지 않고 내 화면에서만 '삭제된 메시지'로 가린다.
    if (found && !isMine) {
      storage.hideMessageForUser(currentUser.id, messageId);
      setHiddenMessageIds((prev) => (prev.includes(messageId) ? prev : [...prev, messageId]));
      setDeleteToast({ message: '내 화면에서만 가렸습니다. 상대방에게는 그대로 보입니다.', undoable: false });
      setTimeout(() => setDeleteToast(null), 4000);
      return;
    }

    if (onDeleteMessageTracedFree) {
      onDeleteMessageTracedFree(messageId);
      if (found) {
        setLastDeletedMessage(found);
        setDeleteToast({ message: '메시지가 흔적 없이 완전히 삭제되었습니다.', undoable: true });
      } else {
        setDeleteToast({ message: '메시지가 삭제되었습니다.', undoable: false });
      }
      setTimeout(() => {
        setDeleteToast((prev) => (prev?.undoable ? prev : null));
      }, 5000);
    }
  };

  const handleUndoDelete = () => {
    if (lastDeletedMessage) {
      onSendMessage(lastDeletedMessage.content, lastDeletedMessage.attachments);
      setLastDeletedMessage(null);
      setDeleteToast(null);
    }
  };

  // Slack Feature: Message Reminder
  const handleSetReminder = (msg: Message, delaySeconds: number, label: string) => {
    setActiveMenuMessageId(null);
    setDeleteToast({ message: `⏰ "${label}" 뒤에 리마인더 알림이 도착합니다.`, undoable: false });
    setTimeout(() => {
      setDeleteToast(null);
    }, 3000);

    setTimeout(() => {
      setReminderToast({ messageId: msg.id, content: msg.content });
    }, delaySeconds * 1000);
  };

  // Slack Feature: Forward Message to another Space or DM
  const handleConfirmForward = (targetSpaceId: string) => {
    if (!forwardingMessage) return;
    const allSpaces = storage.getSpaces();
    const targetSpace = allSpaces.find((s) => s.id === targetSpaceId);
    const allMsgs = storage.getMessages();
    const targetChannelMsgs = allMsgs[targetSpaceId] || [];

    const forwardedMsg: Message = {
      id: `msg_${Date.now()}`,
      spaceId: targetSpaceId,
      senderId: currentUser.id,
      senderName: currentUser.name,
      senderAvatar: currentUser.avatar,
      content: `[↗️ ${space.name} 채널의 ${forwardingMessage.senderName}님으로부터 전달됨]\n${forwardingMessage.content}`,
      timestamp: '방금 전',
      reactions: [],
      attachments: forwardingMessage.attachments,
      forwardedFrom: {
        spaceName: space.name,
        originalSender: forwardingMessage.senderName,
      },
    };

    const nextMsgs = {
      ...allMsgs,
      [targetSpaceId]: [...targetChannelMsgs, forwardedMsg],
    };
    storage.saveMessages(nextMsgs);
    setForwardingMessage(null);
    setForwardSuccessToast(`✓ "${targetSpace?.name || '선택한 채널'}"로 메시지가 성공적으로 전달되었습니다.`);
    setTimeout(() => setForwardSuccessToast(null), 3000);
  };

  // Save Inline Edit
  const handleSaveEdit = (messageId: string) => {
    if (onEditMessage && editingText.trim()) {
      onEditMessage(messageId, editingText.trim());
      setEditingMessageId(null);
      setEditingText('');
    }
  };

  // Voice Note Recording (실제 MediaRecorder → base64 Data URL 저장으로 새로고침 후에도 재생)
  const pickAudioMime = () => {
    if (typeof MediaRecorder === 'undefined') return '';
    const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus', 'audio/ogg'];
    try {
      return candidates.find((type) => MediaRecorder.isTypeSupported?.(type)) || '';
    } catch {
      return '';
    }
  };

  const cleanupVoiceStream = () => {
    if (voiceTimerRef.current) window.clearInterval(voiceTimerRef.current);
    voiceTimerRef.current = null;
    if (voiceStreamRef.current) {
      voiceStreamRef.current.getTracks().forEach((track) => track.stop());
      voiceStreamRef.current = null;
    }
  };

  const blobToDataUrl = (blob: Blob) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });

  const finalizeVoiceRecording = async () => {
    const cancelled = voiceCancelRef.current;
    const duration = Math.max(1, voiceElapsedRef.current);
    const chunks = voiceChunksRef.current;
    voiceChunksRef.current = [];
    mediaRecorderRef.current = null;
    cleanupVoiceStream();
    setIsRecordingVoice(false);
    setVoiceRecordSeconds(0);
    voiceElapsedRef.current = 0;
    if (cancelled) return;
    if (!chunks.length) {
      setVoiceError('녹음된 소리가 없습니다. 마이크에 대고 다시 말해 주세요.');
      return;
    }
    const blob = new Blob(chunks, { type: chunks[0].type || 'audio/webm' });
    if (blob.size > 900 * 1024) {
      setVoiceError('녹음이 너무 깁니다. 1분 이내로 녹음해 주세요.');
      return;
    }
    try {
      const dataUrl = await blobToDataUrl(blob);
      const voiceAtt: VoiceNoteAttachment = {
        type: 'voice',
        audioUrl: dataUrl,
        durationSec: duration,
        mimeType: blob.type || 'audio/webm',
        sizeBytes: blob.size,
      };
      onSendMessage(`음성 메시지 (${duration}초)`, [voiceAtt]);
      setVoiceError(null);
    } catch {
      setVoiceError('녹음 파일을 저장하지 못했습니다. 다시 시도해 주세요.');
    }
  };

  const startVoiceRecording = async () => {
    if (isRecordingVoice) return;
    setVoiceError(null);
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setVoiceError('이 브라우저는 음성 녹음을 지원하지 않습니다. Chrome·Edge·Safari 최신 버전을 사용해 주세요.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      voiceStreamRef.current = stream;
      voiceChunksRef.current = [];
      voiceCancelRef.current = false;
      voiceElapsedRef.current = 0;
      const mimeType = pickAudioMime();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType, audioBitsPerSecond: 32000 } : { audioBitsPerSecond: 32000 });
      recorder.ondataavailable = (ev: BlobEvent) => {
        if (ev.data && ev.data.size > 0) voiceChunksRef.current.push(ev.data);
      };
      recorder.onstop = () => {
        void finalizeVoiceRecording();
      };
      recorder.onerror = () => {
        setVoiceError('녹음 중 오류가 발생했습니다. 다시 시도해 주세요.');
        cleanupVoiceStream();
        setIsRecordingVoice(false);
      };
      mediaRecorderRef.current = recorder;
      recorder.start(250);
      setIsRecordingVoice(true);
      setVoiceRecordSeconds(0);
      voiceTimerRef.current = window.setInterval(() => {
        voiceElapsedRef.current += 1;
        setVoiceRecordSeconds(voiceElapsedRef.current);
        if (voiceElapsedRef.current >= 60) stopVoiceRecordingAndSend();
      }, 1000);
    } catch (err: any) {
      const name = String(err?.name || '');
      cleanupVoiceStream();
      setIsRecordingVoice(false);
      setVoiceError(
        name === 'NotAllowedError' || name === 'SecurityError'
          ? '마이크 권한이 거부되었습니다. 주소창의 자물쇠(사이트 설정)에서 마이크를 허용한 뒤 다시 시도해 주세요.'
          : name === 'NotFoundError' || name === 'DevicesNotFoundError'
          ? '마이크를 찾을 수 없습니다. 기기에 마이크가 연결되어 있는지 확인해 주세요.'
          : '마이크를 시작하지 못했습니다. 잠시 후 다시 시도해 주세요.'
      );
    }
  };

  const stopVoiceRecordingAndSend = () => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === 'inactive') {
      cleanupVoiceStream();
      setIsRecordingVoice(false);
      return;
    }
    try {
      recorder.requestData?.();
    } catch {
      /* 사파리 일부 버전은 requestData 미지원 */
    }
    recorder.stop();
  };

  const cancelVoiceRecording = () => {
    voiceCancelRef.current = true;
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      recorder.stop();
    } else {
      cleanupVoiceStream();
      setIsRecordingVoice(false);
      setVoiceRecordSeconds(0);
      voiceElapsedRef.current = 0;
    }
  };

  // Audio Huddle Chimes & Real Controls
  const playHuddleTone = (type: 'join' | 'leave') => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      gain.gain.setValueAtTime(0.06, ctx.currentTime);
      if (type === 'join') {
        osc.frequency.setValueAtTime(440, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.28);
      } else {
        osc.frequency.setValueAtTime(660, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(330, ctx.currentTime + 0.15);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.28);
      }
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.28);
    } catch (e) {}
  };

  const handleStartHuddle = async () => {
    playHuddleTone('join');
    setIsHuddleActive(true);
    setIsHuddleMuted(false);
    try {
      if (navigator.mediaDevices?.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        huddleMediaStreamRef.current = stream;
      }
    } catch (e) {
      console.warn('Microphone permission fallback', e);
    }
  };

  const handleStopHuddle = () => {
    playHuddleTone('leave');
    setIsHuddleActive(false);
    if (huddleMediaStreamRef.current) {
      huddleMediaStreamRef.current.getTracks().forEach((t) => t.stop());
      huddleMediaStreamRef.current = null;
    }
    if (huddleScreenStreamRef.current) {
      huddleScreenStreamRef.current.getTracks().forEach((t) => t.stop());
      huddleScreenStreamRef.current = null;
    }
    setIsHuddleScreenSharing(false);
  };

  const handleToggleScreenShare = async () => {
    if (isHuddleScreenSharing) {
      if (huddleScreenStreamRef.current) {
        huddleScreenStreamRef.current.getTracks().forEach((t) => t.stop());
        huddleScreenStreamRef.current = null;
      }
      setIsHuddleScreenSharing(false);
    } else {
      try {
        if (navigator.mediaDevices?.getDisplayMedia) {
          const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
          huddleScreenStreamRef.current = stream;
          setIsHuddleScreenSharing(true);
          stream.getVideoTracks()[0].onended = () => {
            setIsHuddleScreenSharing(false);
            huddleScreenStreamRef.current = null;
          };
        }
      } catch (e) {
        console.warn('Display media cancelled', e);
      }
    }
  };

  // Universal YouTube URL extraction helper (shorts, live, embed, mobile, standard)
  const getYouTubeVideoId = (url: string): string | null => {
    if (!url) return null;
    const clean = url.trim();
    if (/^[a-zA-Z0-9_-]{11}$/.test(clean)) return clean;
    const patterns = [
      /(?:youtu\.be\/|v\/|embed\/|shorts\/|live\/)([a-zA-Z0-9_-]{11})/i,
      /(?:youtube\.com|m\.youtube\.com)\/(?:watch\?.*v=|embed\/|v\/|shorts\/|live\/)([a-zA-Z0-9_-]{11})/i,
      /[?&]v=([a-zA-Z0-9_-]{11})/i,
    ];
    for (const regex of patterns) {
      const match = clean.match(regex);
      if (match && match[1] && match[1].length === 11) {
        return match[1];
      }
    }
    return null;
  };

  const handleShareYouTube = async (urlOrQuery?: string) => {
    const target = (urlOrQuery || youtubeInputUrl).trim();
    if (!target) return;
    const vidId = getYouTubeVideoId(target);
    if (vidId) {
      const ytAtt: YouTubeAttachment = {
        type: 'youtube',
        videoId: vidId,
        url: target,
        title: 'YouTube 동영상',
      };

      onSendMessage(`YouTube 영상 함께 보기: ${target}`, [ytAtt]);
      setIsYouTubeModalOpen(false);
      setYoutubeInputUrl('');
    } else {
      // It is a search keyword!
      try {
        const results = await searchYouTubeVideos(target);
        if (results && results.length > 0) {
          const top = results[0];
          const ytAtt: YouTubeAttachment = {
            type: 'youtube',
            videoId: top.id,
            url: `https://www.youtube.com/watch?v=${top.id}`,
            title: top.title,
          };
          onSendMessage(`YouTube 검색 공유 [${target}]: ${top.title}\nhttps://www.youtube.com/watch?v=${top.id}`, [ytAtt]);
          setIsYouTubeModalOpen(false);
          setYoutubeInputUrl('');
        }
      } catch (err) {
        console.warn('YouTube search share failed:', err);
      }
    }
  };

  // Location Shared from LocationPickerModal
  const handleLocationReceived = (loc: LocationAttachment) => {
    onSendMessage(`실시간 위치 공유: ${loc.address}`, [loc]);
  };

  // Jump to pinned message
  const handleJumpToMessage = (messageId: string) => {
    setHighlightedMessageId(messageId);
    const el = document.getElementById(`msg-${messageId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    setTimeout(() => setHighlightedMessageId(null), 3000);
  };

  // Gemini 3-Line Summary
  const handleOpenGeminiSummary = async () => {
    setIsGeminiSummaryOpen(true);
    setIsSummaryLoading(true);
    const lines = await summarizeConversationWithGemini(messages);
    setGeminiSummaryLines(lines);
    setIsSummaryLoading(false);
  };

  // Gemini Workspace Search
  const handleExecuteGeminiSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!geminiSearchQuery.trim()) return;
    setIsSearchingGemini(true);
    const result = await queryGeminiAssistant(geminiSearchQuery, {
      messages,
      driveDocs: storage.getDriveDocuments(),
      events: storage.getCalendarEvents(),
      tasks: storage.getTasks(),
    });
    setGeminiSearchResult(result);
    setIsSearchingGemini(false);
  };

  // Create Quick Poll
  const handleCreatePoll = () => {
    if (!pollQuestion.trim()) return;
    const validOptions = pollOptions.filter((o) => o.trim().length > 0);
    if (validOptions.length < 2) return;

    const pollAtt: PollAttachment = {
      type: 'poll',
      question: pollQuestion.trim(),
      creatorName: currentUser.name,
      options: validOptions.map((text, idx) => ({
        id: `opt_${Date.now()}_${idx}`,
        text,
        voterIds: [],
      })),
    };

    onSendMessage(`[실시간 투표] ${pollQuestion.trim()}`, [pollAtt]);
    setIsPollModalOpen(false);
    setPollQuestion('');
    setPollOptions(['옵션 1', '옵션 2', '옵션 3']);
  };

  // Vote on Poll Option
  const handleOptionVote = (messageId: string, optionId: string) => {
    if (onVotePoll) {
      onVotePoll(messageId, optionId);
    }
  };

  // Save Space Canvas Scratchpad
  const handleSaveCanvas = () => {
    if (onUpdateSpaceCanvas) {
      onUpdateSpaceCanvas(space.id, canvasText);
      setCanvasSavedToast(true);
      setTimeout(() => setCanvasSavedToast(false), 2000);
    }
  };

  // Image Upload
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          const sizeKb = (file.size / 1024).toFixed(1);
          const sizeStr = file.size > 1024 * 1024 ? `${(file.size / (1024 * 1024)).toFixed(1)} MB` : `${sizeKb} KB`;
          const imgAtt: ImageAttachment = {
            type: 'image',
            url: event.target.result as string,
            name: file.name,
            size: sizeStr,
          };
          setPendingAttachments((prev) => [...prev, imgAtt]);
        }
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };

  // File Upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          const ext = file.name.split('.').pop() || '';
          const sizeKb = (file.size / 1024).toFixed(1);
          const sizeStr = file.size > 1024 * 1024 ? `${(file.size / (1024 * 1024)).toFixed(1)} MB` : `${sizeKb} KB`;
          const fileAtt: FileAttachment = {
            type: 'file',
            url: event.target.result as string,
            name: file.name,
            size: sizeStr,
            fileExtension: ext,
          };
          setPendingAttachments((prev) => [...prev, fileAtt]);
        }
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };

  const renderAttachment = (att: Attachment, messageId: string) => {
    // 1. Google Drive with In-App Split Screen
    if (att.type === 'drive') {
      const drive = att as DriveAttachment;
      return (
        <div
          key={drive.fileId}
          className="mt-2.5 p-3.5 rounded-2xl bg-[#FDFBF7] border border-[#EBE5DA] cafe-shadow flex flex-col gap-2.5 max-w-md"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5 truncate">
              <div className="p-2 rounded-xl bg-[#E6DCD0] text-[#3E2723]">
                {drive.fileType === 'sheet' ? (
                  <Table className="w-4 h-4 text-[#2E7D32]" />
                ) : (
                  <FileText className="w-4 h-4 text-[#1565C0]" />
                )}
              </div>
              <div className="truncate">
                <div className="text-xs font-bold text-[#2C2520] truncate">{drive.fileName}</div>
                <div className="text-[10px] text-[#7A6A5C] flex items-center gap-1.5 mt-0.5">
                  <span>소유자: {drive.ownerName}</span>
                  <span>•</span>
                  <span>{drive.fileSize}</span>
                  <span>•</span>
                  <span className="text-[#2E7D32] font-semibold">✓ 전원 편집 권한 자동 부여됨</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1 border-t border-[#EBE5DA]">
            <button
              onClick={() => onOpenDocEditor(drive.fileId, drive.fileName, drive.fileType)}
              className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-xl bg-[#3E2723] hover:bg-[#2C2520] text-white text-xs font-bold transition-all shadow-xs"
            >
              <Split className="w-3.5 h-3.5" />
              <span>화면 분할 인앱 편집 (Side-by-Side)</span>
            </button>
          </div>
        </div>
      );
    }

    // 2. Google Meet Meeting Card
    if (att.type === 'meet') {
      const meet = att as MeetAttachment;
      return (
        <div
          key={meet.meetCode}
          className="mt-2.5 p-3.5 rounded-2xl bg-[#F0FDF4] border border-[#BBF7D0] cafe-shadow flex flex-col gap-2.5 max-w-md"
        >
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-xl bg-[#DCFCE7] text-[#15803D]">
              <Video className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-bold text-[#14532D]">{meet.meetingTitle}</div>
              <div className="text-[11px] text-[#15803D] font-mono mt-0.5">
                코드: {meet.meetCode} (개설: {meet.hostName})
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2 border-t border-[#BBF7D0]">
            <button
              onClick={() => onOpenMeetRoom(meet.meetLink, meet.meetingTitle)}
              className="flex-1 py-1.5 rounded-xl bg-[#15803D] hover:bg-[#166534] text-white text-xs font-bold shadow-xs transition-colors"
            >
              비디오 룸 즉시 입장
            </button>
            <a
              href={meet.meetLink}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 rounded-xl bg-white hover:bg-[#F0FDF4] border border-[#86EFAC] text-xs font-semibold text-[#15803D] flex items-center gap-1 transition-colors"
            >
              <span>공식 Meet 열기</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      );
    }

    // 3. Google Calendar Card
    if (att.type === 'calendar') {
      const cal = att as CalendarAttachment;
      const userRsvp = cal.rsvps?.[currentUser.id] || 'tentative';

      return (
        <div
          key={cal.eventTitle + cal.dateStr}
          className="mt-2.5 p-3.5 rounded-2xl bg-[#FFFBF0] border border-[#FDE68A] cafe-shadow flex flex-col gap-2 max-w-md"
        >
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-xl bg-[#FEF3C7] text-[#B45309]">
              <CalendarIcon className="w-5 h-5" />
            </div>
            <div className="truncate">
              <div className="text-xs font-bold text-[#78350F]">{cal.eventTitle}</div>
              <div className="text-[11px] text-[#92400E] mt-0.5">
                일시: {cal.dateStr} {cal.timeStr} · 장소: {cal.location || 'Google Meet'}
              </div>
            </div>
          </div>

          <div className="pt-2 border-t border-[#FDE68A] flex items-center justify-between gap-1.5">
            <span className="text-[11px] text-[#78350F] font-medium">참석 여부 투표:</span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => onRsvpCalendar(messageId, 'accepted')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                  userRsvp === 'accepted' ? 'bg-[#15803D] text-white shadow-xs' : 'bg-white text-[#15803D] border border-[#BBF7D0]'
                }`}
              >
                수락
              </button>
              <button
                onClick={() => onRsvpCalendar(messageId, 'tentative')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                  userRsvp === 'tentative' ? 'bg-[#B45309] text-white shadow-xs' : 'bg-white text-[#B45309] border border-[#FDE68A]'
                }`}
              >
                미정
              </button>
              <button
                onClick={() => onRsvpCalendar(messageId, 'declined')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                  userRsvp === 'declined' ? 'bg-[#DC2626] text-white shadow-xs' : 'bg-white text-[#DC2626] border border-[#FECACA]'
                }`}
              >
                거절
              </button>
            </div>
          </div>
        </div>
      );
    }

    // 4. Interactive Quick Poll (Slack Killer Feature)
    if (att.type === 'poll') {
      const poll = att as PollAttachment;
      const totalVotes = poll.options.reduce((sum, opt) => sum + opt.voterIds.length, 0);

      return (
        <div
          key={messageId + 'poll'}
          className="mt-2.5 p-4 rounded-2xl bg-[#FDFBF7] border border-[#EBE5DA] cafe-shadow max-w-md space-y-3"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-[#E6DCD0] text-[#3E2723]">
                <Vote className="w-4 h-4 text-[#C18C5D]" />
              </div>
              <h4 className="text-xs font-bold text-[#2C2520]">{poll.question}</h4>
            </div>
            <span className="text-[10px] text-[#7A6A5C] font-semibold">총 {totalVotes}명 참여</span>
          </div>

          <div className="space-y-2">
            {poll.options.map((opt) => {
              const hasVoted = opt.voterIds.includes(currentUser.id);
              const percentage = totalVotes > 0 ? Math.round((opt.voterIds.length / totalVotes) * 100) : 0;

              return (
                <div key={opt.id} className="relative">
                  <button
                    onClick={() => handleOptionVote(messageId, opt.id)}
                    className={`w-full p-2.5 rounded-xl border text-left text-xs transition-all relative overflow-hidden flex items-center justify-between z-10 ${
                      hasVoted
                        ? 'border-[#C18C5D] font-bold text-[#3E2723]'
                        : 'border-[#EBE5DA] hover:border-[#C18C5D] text-[#2C2520]'
                    }`}
                  >
                    <div className="flex items-center gap-2 z-10">
                      <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${hasVoted ? 'border-[#3E2723] bg-[#3E2723]' : 'border-[#A89A8E]'}`}>
                        {hasVoted && <Check className="w-2.5 h-2.5 text-white" />}
                      </div>
                      <span>{opt.text}</span>
                    </div>

                    <span className="text-[11px] font-mono text-[#7A6A5C] z-10">
                      {opt.voterIds.length}표 ({percentage}%)
                    </span>

                    {/* Progress Bar background */}
                    <div
                      style={{ width: `${percentage}%` }}
                      className={`absolute inset-y-0 left-0 opacity-20 transition-all duration-300 ${
                        hasVoted ? 'bg-[#C18C5D]' : 'bg-[#DCD3C5]'
                      }`}
                    />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      );
    }

    // 5. Voice Note Audio Message (실제 저장된 오디오 재생)
    if (att.type === 'voice') {
      const voice = att as VoiceNoteAttachment;
      if (!voice.audioUrl) return null;
      return <VoiceNotePlayer key={messageId + 'voice'} voice={voice} />;
    }

    // 6. Real Geolocation Sharing
    if (att.type === 'location') {
      const loc = att as LocationAttachment;
      return (
        <div
          key={loc.address + messageId}
          className="mt-2.5 p-3.5 rounded-2xl bg-[#FDFBF7] border border-[#EBE5DA] cafe-shadow max-w-sm flex flex-col gap-2"
        >
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-[#EA4335] flex-shrink-0" />
            <div className="truncate">
              <span className="text-xs font-bold text-[#2C2520] block truncate">{loc.address}</span>
              {loc.accuracyMeters && (
                <span className="text-[10px] text-[#137333] font-semibold">✓ GPS 측정 정확도 ±{loc.accuracyMeters}m</span>
              )}
            </div>
          </div>
          <div className="aspect-video w-full rounded-xl overflow-hidden border border-[#EBE5DA] bg-[#F4EFE6] relative">
            <iframe
              title="Loc preview"
              src={`https://www.openstreetmap.org/export/embed.html?bbox=${loc.lng - 0.005}%2C${loc.lat - 0.003}%2C${loc.lng + 0.005}%2C${loc.lat + 0.003}&layer=mapnik&marker=${loc.lat}%2C${loc.lng}`}
              className="w-full h-full border-none pointer-events-none"
              loading="lazy"
            />
          </div>
          <a
            href={`https://maps.google.com/?q=${loc.lat},${loc.lng}`}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full py-1.5 rounded-xl bg-white border border-[#DCD3C5] hover:bg-[#FDFBF7] text-[#3E2723] text-xs font-bold flex items-center justify-center gap-1 shadow-xs transition-colors"
          >
            <span>Google 지도에서 길찾기 열기</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      );
    }

    // 7. Image
    if (att.type === 'image') {
      const img = att as ImageAttachment;
      return (
        <div
          key={img.url.slice(0, 32)}
          className="mt-2 max-w-xs rounded-2xl overflow-hidden border border-[#EBE5DA] cafe-shadow"
        >
          <img
            src={img.url}
            alt={img.name}
            onClick={() => setLightboxImage({ url: img.url, name: img.name })}
            className="w-full max-h-56 object-cover cursor-pointer hover:opacity-95 transition-opacity"
          />
        </div>
      );
    }

    // 8. Generic File
    if (att.type === 'file') {
      const f = att as FileAttachment;
      return (
        <div
          key={f.name}
          className="mt-2 p-2.5 rounded-xl bg-[#FDFBF7] border border-[#EBE5DA] flex items-center justify-between gap-3 max-w-xs cafe-shadow"
        >
          <div className="flex items-center gap-2 truncate">
            <FileIcon className="w-4 h-4 text-[#7A6A5C]" />
            <span className="text-xs font-medium text-[#2C2520] truncate">{f.name}</span>
          </div>
          <a
            href={f.url}
            download={f.name}
            className="p-1 rounded-lg hover:bg-[#EBE5DA] text-[#3E2723]"
          >
            <Download className="w-3.5 h-3.5" />
          </a>
        </div>
      );
    }

    // 9. YouTube In-App Video Player
    if (att.type === 'youtube') {
      const yt = att as any;
      return (
        <div
          key={messageId + yt.videoId}
          className="mt-2.5 max-w-md w-full rounded-2xl overflow-hidden border border-[#EBE5DA] cafe-shadow bg-[#2C2520]"
        >
          <div className="px-3.5 py-2 bg-[#2C2520] text-white flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 font-bold">
              <span className="w-2.5 h-2.5 rounded-full bg-[#EA4335] animate-pulse" />
              <span className="text-[#FDFBF7]">YouTube 인앱 플레이어</span>
            </div>
            <a
              href={`https://www.youtube.com/watch?v=${yt.videoId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] text-[#A89A8E] hover:text-white flex items-center gap-1 transition-colors"
            >
              <span>새 탭에서 보기</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
          <div className="relative aspect-video w-full">
            <iframe
              src={`https://www.youtube.com/embed/${yt.videoId}?autoplay=0&rel=0&enablejsapi=1`}
              title="YouTube video player"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              referrerPolicy="strict-origin-when-cross-origin"
              allowFullScreen
              className="w-full h-full border-none"
            />
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#FDFBF7] text-[#2C2520] select-none relative">
      {slashHint && (
        <div className="absolute bottom-28 left-1/2 -translate-x-1/2 z-40 px-3.5 py-2 rounded-xl bg-[#2C2520] text-white text-[11px] font-semibold shadow-xl animate-in fade-in max-w-[90%] text-center">
          {slashHint}
        </div>
      )}
      
      {/* HEADER in Cafe Beige */}
      <header className="h-15 sm:h-16 px-3 sm:px-5 border-b border-[#EBE5DA] bg-[#FDFBF7] flex items-center justify-between z-10 cafe-shadow min-w-0">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          {/* 서랍 통합 토글: 왼쪽/오른쪽 서랍을 하나의 컨트롤로 */}
          <div className="flex items-center rounded-xl border border-[#EBE5DA] bg-white p-0.5 shrink-0 shadow-2xs" data-testid="drawer-toggle">
            <button
              onClick={() => {
                if (typeof window !== 'undefined' && window.innerWidth < 768) onToggleMobileSidebar();
                else onToggleCollapseSidebar?.();
              }}
              className="p-1.5 rounded-lg hover:bg-[#F4EFE6] text-[#7A6A5C] hover:text-[#2C2520] transition-colors cursor-pointer"
              title={isSidebarCollapsed ? '왼쪽 서랍 열기 (채팅 목록)' : '왼쪽 서랍 닫기 (채팅 목록)'}
              aria-label="왼쪽 서랍 토글"
            >
              {isSidebarCollapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
            </button>
            <button
              onClick={onToggleRightPanel}
              className="p-1.5 rounded-lg hover:bg-[#F4EFE6] text-[#7A6A5C] hover:text-[#2C2520] transition-colors cursor-pointer"
              title="오른쪽 서랍 열기/닫기 (할 일·스레드·도구)"
              aria-label="오른쪽 서랍 토글"
            >
              <PanelRightOpen className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-[#E6DCD0] border border-[#DCD3C5] flex items-center justify-center text-[#3E2723] font-bold shrink-0">
              {space.isSelfNotes ? <FileText className="w-4 h-4" /> : space.type === 'dm' ? <MessageSquare className="w-4 h-4" /> : <Hash className="w-4 h-4" />}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <h2 className="text-xs sm:text-sm font-bold text-[#2C2520] tracking-tight truncate">
                  {space.isSelfNotes ? '나의 메모장' : space.name}
                </h2>
                <button
                  onClick={() => onToggleStarSpace(space.id)}
                  className={`p-0.5 rounded-lg shrink-0 ${
                    space.isStarred ? 'text-[#ECC94B]' : 'text-[#A89A8E] hover:text-[#ECC94B]'
                  }`}
                >
                  <Star className="w-3 h-3 sm:w-3.5 sm:h-3.5 fill-current" />
                </button>
                <span className="hidden lg:inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#F4EFE6] text-[#7A6A5C] border border-[#EBE5DA] shrink-0">
                  {deviceType === 'mobile' ? '모바일' : deviceType === 'tablet' ? '태블릿' : 'PC'}
                </span>
              </div>
              <p className="text-[10px] sm:text-[11px] text-[#7A6A5C] truncate max-w-[140px] sm:max-w-xs md:max-w-md">
                {space.topic || '함께 나누는 공간'}
              </p>
            </div>
          </div>
        </div>

        {/* Right Header Controls - Consolidated, Zero Duplicate Buttons */}
        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
          {/* 초대 알림 센터 (벨 + 배지) */}
          {onAcceptInvite && onDeclineInvite && (
            <InviteBell invites={invites} onAccept={onAcceptInvite} onDecline={onDeclineInvite} />
          )}
          {/* Notification Status Toggle (Real Native & Audio Notification) */}
          {onToggleNotifications && (
            <button
              onClick={onToggleNotifications}
              className={`flex items-center gap-1 px-2 sm:px-2.5 py-1.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                notificationsEnabled
                  ? 'bg-[#E6F4EA] text-[#137333] border-[#A8DAB5]'
                  : 'bg-[#F4EFE6] text-[#7A6A5C] border-[#DCD3C5]'
              }`}
              title={notificationsEnabled ? "시스템 알림 켜짐 (클릭하여 끄기)" : "시스템 알림 꺼짐 (클릭하여 켜기)"}
            >
              <Bell className="w-3.5 h-3.5" />
              <span className="hidden sm:inline text-[11px] font-bold">{notificationsEnabled ? '알림 ON' : '알림 OFF'}</span>
            </button>
          )}

          {/* Gemini AI Assistant Toggle */}
          <button
            onClick={() => onToggleGeminiPanel?.()}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl border text-xs font-bold transition-all shadow-xs cursor-pointer ${
              isGeminiPanelOpen
                ? 'bg-[#3E2723] text-white border-[#3E2723]'
                : 'bg-white hover:bg-[#FAF7F2] text-[#3E2723] border-[#C18C5D]'
            }`}
            title="제미나이 3.7 AI 비서 열기 (대화 전체 및 첨부파일 기반)"
          >
            <Sparkles className="w-3.5 h-3.5 text-[#C18C5D]" />
            <span className="hidden sm:inline font-bold">Gemini AI</span>
          </button>

          {/* 새 회의 시작 (링크는 채팅방에 자동으로 올라갑니다) */}
          <button
            onClick={onOpenMeetModal}
            data-testid="start-meeting"
            className="flex items-center gap-1 px-2 sm:px-2.5 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer bg-[#EAF7EF] hover:bg-[#DCFCE7] text-[#15803D] border-[#BBF7D0]"
            title="새 회의를 만들고 링크를 채팅방에 자동으로 올립니다 (모두 같은 회의로 입장)"
          >
            <Video className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">회의</span>
          </button>

          {/* Audio Huddle (Voice Call) */}
          <button
            onClick={() => {
              if (onOpenHuddle) onOpenHuddle();
              else setIsHuddleActive(!isHuddleActive);
            }}
            className={`flex items-center gap-1 px-2 sm:px-2.5 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
              isHuddleActive
                ? 'bg-[#15803D] text-white border-[#15803D] shadow-xs animate-pulse'
                : 'bg-[#F4EFE6] hover:bg-[#EBE5DA] text-[#3E2723] border-[#DCD3C5]'
            }`}
            title="실시간 음성 허들 (Audio Call)"
          >
            <Headphones className="w-3.5 h-3.5" />
            <span className="hidden md:inline">{isHuddleActive ? '통화 중' : '음성 허들'}</span>
          </button>

          {/* Right Auxiliary Panel Toggle is merged into the unified drawer control above */}

          {/* User pill & Direct Logout */}
          <div className="flex items-center gap-1 sm:gap-1.5 pl-1.5 border-l border-[#EBE5DA]">
            <img
              src={avatarSrc(currentUser.avatar)} onError={handleAvatarError}
              alt={currentUser.name}
              className="w-7 h-7 rounded-lg object-cover border border-[#EBE5DA] hidden sm:block shrink-0"
            />
            <span className="text-xs font-bold text-[#2C2520] truncate max-w-[70px] hidden lg:inline">{currentUser.name}</span>
            {onOpenSettings && (
              <button
                type="button"
                onClick={onOpenSettings}
                className="p-1.5 rounded-lg text-[#7A6A5C] hover:text-[#2C2520] hover:bg-[#F4EFE6] transition-colors cursor-pointer shrink-0"
                title="설정 (Gemini 키 · Google 연동 · 데이터)"
                aria-label="설정 열기"
              >
                <Settings className="w-4 h-4" />
              </button>
            )}
            {onLogout && (
              <button
                type="button"
                onClick={onLogout}
                className="flex items-center gap-1 px-2 py-1 rounded-lg text-[#DC2626] hover:bg-[#FFF5F5] border border-transparent hover:border-[#FEB2B2] text-xs font-semibold transition-colors cursor-pointer shrink-0"
                title="로그아웃"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="text-[11px] font-bold hidden sm:inline">로그아웃</span>
              </button>
            )}
          </div>
        </div>
      </header>




      {/* Delete / Action Toast with Undo */}
      {deleteToast && (
        <div className="bg-[#3E2723] text-white text-xs px-4 py-2.5 font-medium flex items-center justify-between z-20 animate-in slide-in-from-top-1 shadow-md">
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-[#C18C5D]" />
            <span>{deleteToast.message}</span>
          </div>
          <div className="flex items-center gap-2">
            {deleteToast.undoable && lastDeletedMessage && (
              <button
                onClick={handleUndoDelete}
                className="px-2.5 py-1 rounded-lg bg-[#C18C5D] hover:bg-[#A87448] text-white text-xs font-bold transition-colors"
              >
                실행 취소 (Undo)
              </button>
            )}
            <button onClick={() => setDeleteToast(null)} className="p-1 hover:bg-white/20 rounded">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Slack Feature: Reminder Alert Toast */}
      {reminderToast && (
        <div className="bg-[#FEFCBF] border-b border-[#F6E05E] text-[#744210] text-xs px-4 py-2.5 font-medium flex items-center justify-between z-20 animate-in slide-in-from-top-2 shadow-sm">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-[#B7791F] animate-bounce flex-shrink-0" />
            <span>
              <strong>⏰ 예약된 리마인더:</strong> "{reminderToast.content.slice(0, 35)}..."
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                handleJumpToMessage(reminderToast.messageId);
                setReminderToast(null);
              }}
              className="px-2.5 py-1 rounded-lg bg-[#D69E2E] hover:bg-[#B7791F] text-white font-bold text-xs"
            >
              해당 메시지로 이동
            </button>
            <button onClick={() => setReminderToast(null)} className="p-1 hover:bg-black/10 rounded">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Forward Success Toast */}
      {forwardSuccessToast && (
        <div className="bg-[#15803D] text-white text-xs px-4 py-2 font-bold flex items-center justify-between z-20 animate-in slide-in-from-top-1 shadow-md">
          <span>{forwardSuccessToast}</span>
          <button onClick={() => setForwardSuccessToast(null)} className="p-0.5 hover:bg-white/20 rounded">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Audio Huddle Live Ribbon */}
      {isHuddleActive && (
        <div className="px-4 py-2.5 bg-[#F0FDF4] border-b border-[#BBF7D0] flex items-center justify-between z-10 cafe-shadow animate-in slide-in-from-top-2 duration-150">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#15803D] animate-ping" />
              <span className="text-xs font-bold text-[#14532D]">내 마이크 테스트 중</span>
              <span className="hidden sm:inline text-[10px] text-[#3F6212]">
                · 다른 사람과 실제 통화는 Google Meet로 연결하세요
              </span>
            </div>
            <div className="flex items-center gap-0.5 h-3">
              {[6, 12, 18, 10, 16, 8].map((h, i) => (
                <div key={i} className={`w-0.5 bg-[#15803D] rounded-full ${!isHuddleMuted ? 'voice-bar-anim' : 'h-1'}`} />
              ))}
            </div>
            <div className="flex items-center -space-x-1.5" title="이 기기에서 마이크만 확인 중입니다">
              <img src={avatarSrc(currentUser.avatar)} onError={handleAvatarError} alt="user" className="w-5 h-5 rounded-full border border-white object-cover ring-2 ring-emerald-500" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsHuddleMuted(!isHuddleMuted)}
              className={`p-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors ${
                isHuddleMuted ? 'bg-[#FEE2E2] text-[#DC2626] border border-[#FECACA]' : 'bg-white text-[#15803D] border border-[#BBF7D0]'
              }`}
            >
              {isHuddleMuted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
              <span>{isHuddleMuted ? '음소거 됨' : '마이크 켜짐'}</span>
            </button>
            <button
              onClick={onOpenMeetModal}
              className="px-2.5 py-1 rounded-lg bg-[#2F855A] hover:bg-[#276749] text-white text-xs font-bold flex items-center gap-1"
              title="실제 참여자와 통화할 Google Meet 회의를 만듭니다"
            >
              <Video className="w-3 h-3" />
              Meet로 통화
            </button>
            <button
              onClick={() => setIsHuddleActive(false)}
              className="px-2.5 py-1 rounded-lg bg-[#DC2626] hover:bg-[#B91C1C] text-white text-xs font-bold"
            >
              종료
            </button>
          </div>
        </div>
      )}

      {/* Pinned Announcement Bar */}
      {space.pinnedMessageText && (
        <div className="px-4 py-2 bg-[#FFFDF9] border-b border-[#EBE5DA] flex items-center justify-between text-xs text-[#3E2723] z-10 cafe-shadow">
          <div className="flex items-center gap-2 truncate flex-1 mr-2">
            <span className="p-1 rounded-md bg-[#E6DCD0] text-[#3E2723] flex-shrink-0">
              <Pin className="w-3 h-3" />
            </span>
            <span className="font-bold text-[11px] text-[#C18C5D] flex-shrink-0">상단 공지:</span>
            <span className="truncate text-[#2C2520]">{space.pinnedMessageText}</span>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {space.pinnedMessageId && (
              <button
                onClick={() => handleJumpToMessage(space.pinnedMessageId!)}
                className="text-[11px] font-bold text-[#C18C5D] hover:underline"
              >
                메시지로 이동
              </button>
            )}
            {onUnpinMessage && (
              <button
                onClick={onUnpinMessage}
                className="p-1 rounded-lg text-[#A89A8E] hover:text-[#DC2626] transition-colors"
                title="공지 고정 해제"
              >
                <PinOff className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Bookmarks filter notice */}
      {showOnlyBookmarks && (
        <div className="px-4 py-1.5 bg-[#FEFCBF] border-b border-[#F6E05E] text-xs text-[#744210] flex items-center justify-between">
          <div className="flex items-center gap-1.5 font-bold">
            <Bookmark className="w-3.5 h-3.5" />
            <span>북마크 및 중요 보관 메시지만 표시 중입니다.</span>
          </div>
          <button onClick={() => setShowOnlyBookmarks(false)} className="text-xs underline font-semibold">
            전체 메시지 보기
          </button>
        </div>
      )}

      {/* MAIN LAYOUT: Messages View & Space Canvas Drawer */}
      <div className="flex-1 flex overflow-hidden">
        {/* Messages Scroll Area */}
        <div className="nx-chat-bg flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {displayedMessages.length === 0 && (
            <div className="h-full min-h-[240px] flex flex-col items-center justify-center text-center gap-2 py-10">
              <div className="w-12 h-12 rounded-2xl bg-[#F4EFE6] flex items-center justify-center">
                <MessageSquare className="w-6 h-6 text-[#C18C5D]" />
              </div>
              <p className="text-sm font-bold text-[#3E2723]">아직 메시지가 없습니다</p>
              <p className="text-[11px] text-[#7A6A5C] leading-relaxed">
                첫 메시지를 보내 대화를 시작하세요.<br />회의 버튼을 누르면 새 회의 링크가 이 채팅방에 자동으로 올라갑니다.
              </p>
            </div>
          )}
          {displayedMessages.map((msg) => {
            if (msg.isSystemMessage) {
              return (
                <div
                  key={msg.id}
                  id={`msg-${msg.id}`}
                  className="my-3 mx-auto max-w-md p-2 rounded-xl bg-[#F4EFE6] border border-[#EBE5DA] text-center text-xs text-[#7A6A5C] font-medium"
                >
                  {msg.content}
                </div>
              );
            }

            const isMine = msg.senderId === currentUser.id;
            const isRedacted = hiddenMessageIds.includes(msg.id);
            const isHighlighted = highlightedMessageId === msg.id;
            const isEditing = editingMessageId === msg.id;
            const senderLabel = isMine
              ? msg.senderName
              : contactNameOf(contacts, msg.senderId, '', msg.senderName);

            return (
              <div
                key={msg.id}
                id={`msg-${msg.id}`}
                className={`group flex items-start gap-3 transition-colors rounded-2xl p-2 -mx-2 ${
                  isMine ? 'flex-row-reverse' : ''
                } ${
                  isHighlighted ? 'bg-[#FFF9F2] ring-2 ring-[#C18C5D]' : 'hover:bg-[#FDFBF7]/60'
                }`}
              >
                <img
                  src={avatarSrc(msg.senderAvatar, msg.senderName)}
                  onError={handleAvatarError}
                  alt={msg.senderName}
                  className="w-9 h-9 rounded-xl object-cover bg-white border border-[#EBE5DA] shadow-xs flex-shrink-0 mt-0.5"
                />

                <div className={`flex-1 min-w-0 ${isMine ? 'flex flex-col items-end' : ''}`}>
                  <div className={`flex items-baseline gap-2 mb-1 ${isMine ? 'flex-row-reverse text-right' : ''}`}>
                    <span className={`text-xs font-bold ${isMine ? 'text-[#1A73E8]' : 'text-[#2C2520]'}`}>
                      {senderLabel}{isMine ? ' (나)' : ''}
                    </span>
                    {msg.senderRole && <span className="text-[10px] text-[#A89A8E] hidden sm:inline">{msg.senderRole}</span>}
                    <span className="text-[10px] text-[#A89A8E] font-mono">{msg.timestamp}</span>
                    {msg.isEdited && <span className="text-[10px] text-[#A89A8E] italic">(수정됨)</span>}
                    {msg.isPinned && (
                      <span className="text-[10px] text-[#C18C5D] font-bold flex items-center gap-0.5">
                        <Pin className="w-2.5 h-2.5" /> 고정됨
                      </span>
                    )}
                  </div>

                  {/* Inline Message Edit Mode */}
                  {isEditing ? (
                    <div className="p-2.5 rounded-2xl bg-white border border-[#C18C5D] cafe-shadow space-y-2 max-w-xl">
                      <textarea
                        value={editingText}
                        onChange={(e) => setEditingText(e.target.value)}
                        className="w-full text-xs text-[#2C2520] bg-[#FDFBF7] p-2 rounded-xl border border-[#EBE5DA] focus:outline-none resize-none"
                        rows={3}
                        autoFocus
                      />
                      <div className="flex justify-end gap-1.5">
                        <button
                          onClick={() => setEditingMessageId(null)}
                          className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-[#F4EFE6] text-[#7A6A5C]"
                        >
                          취소
                        </button>
                        <button
                          onClick={() => handleSaveEdit(msg.id)}
                          className="px-3 py-1 rounded-lg text-xs font-bold bg-[#3E2723] text-white shadow-xs"
                        >
                          수정 저장
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* Normal Speech Bubble: Distinct Google Blue on Right for user, White on Left for others */
                    <div
                      className={`nx-bubble-in relative inline-block max-w-[85%] sm:max-w-[75%] rounded-2xl p-3 text-xs leading-relaxed break-words shadow-sm ${
                        isMine
                          ? 'border border-[#1765CC] rounded-tr-xs shadow-md'
                          : 'bg-[#FFFFFF] border border-[#EBE5DA] rounded-tl-xs shadow-xs'
                      } ${isRedacted ? 'italic opacity-70' : ''}`}
                      style={{
                        background: isMine ? bubbleColors.mine : bubbleColors.other,
                        color: isMine ? mineTextColor : otherTextColor,
                        borderColor: isRedacted ? undefined : isMine ? bubbleColors.mine : bubbleColors.other,
                      }}
                    >
                      {/* In-line Reply Citation if this message is a reply */}
                      {msg.replyTo && (
                        <div
                          onClick={() => {
                            const el = document.getElementById(`msg-${msg.replyTo!.messageId}`);
                            if (el) {
                              el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                              el.classList.add('bg-[#FFF3E0]');
                              setTimeout(() => el.classList.remove('bg-[#FFF3E0]'), 2000);
                            }
                          }}
                          className="mb-2 px-2.5 py-1.5 rounded-xl bg-black/5 hover:bg-black/10 text-[11px] border-l-2 border-[#C18C5D] cursor-pointer transition-colors flex items-center gap-1.5 group/reply"
                          title="원래 메시지로 이동"
                        >
                          <Reply className="w-3.5 h-3.5 text-[#C18C5D] flex-shrink-0 group-hover/reply:scale-110 transition-transform" />
                          <span className="font-bold text-[#3E2723] flex-shrink-0">@{msg.replyTo.senderName}:</span>
                          <span className="truncate text-[#7A6A5C]">{msg.replyTo.content || '(첨부파일)'}</span>
                        </div>
                      )}

                      {/* Forward citation if any */}
                      {msg.forwardedFrom && (
                        <div className="text-[10px] text-[#8C7A6B] font-medium mb-1.5 pb-1 border-b border-black/5 flex items-center gap-1">
                          <Share2 className="w-3 h-3 text-[#C18C5D]" />
                          <span>#{msg.forwardedFrom.spaceName} 채널의 {msg.forwardedFrom.originalSender}님으로부터 전달됨</span>
                        </div>
                      )}

                      {/* Content with code blocks & markdown */}
                      {msg.content.includes('```') ? (
                        <div className="space-y-1.5">
                          {msg.content.split('```').map((part, idx) => {
                            if (idx % 2 === 1) {
                              return (
                                <div key={idx} className="my-1.5 p-2.5 rounded-xl bg-[#2C2520] text-[#FDFBF7] font-mono text-[11px] overflow-x-auto relative group">
                                  <div className="flex items-center justify-between pb-1 mb-1 border-b border-white/10 text-[9px] text-[#A89A8E]">
                                    <span>코드 블록 (CODE)</span>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        navigator.clipboard.writeText(part.trim());
                                        setDeleteToast({ message: '코드가 클립보드에 복사되었습니다.', undoable: false });
                                        setTimeout(() => setDeleteToast(null), 2500);
                                      }}
                                      className="px-1.5 py-0.5 rounded bg-white/10 hover:bg-white/20 text-white text-[9px] transition-colors"
                                    >
                                      복사
                                    </button>
                                  </div>
                                  <pre className="whitespace-pre">{part.trim()}</pre>
                                </div>
                              );
                            }
                            return (
                              <div key={idx} className="whitespace-pre-wrap">
                                <RichText text={part} isMine={isMine} />
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="whitespace-pre-wrap font-medium">
                          <RichText text={msg.content} isMine={isMine} />
                        </div>
                      )}

                      {/* Translated view (메시지 번역 결과) */}
                      {translations[msg.id] && (
                        <TranslatedBlock
                          state={translations[msg.id]}
                          isMine={isMine}
                          onToggle={() =>
                            setTranslations((prev) => ({
                              ...prev,
                              [msg.id]: {
                                ...prev[msg.id],
                                show: prev[msg.id].show === 'translation' ? 'original' : 'translation',
                              },
                            }))
                          }
                          onRetranslate={() => setTranslateTargetMessage(msg)}
                        />
                      )}

                      {/* Fallback Auto-Player if message text contains a YouTube URL without explicit attachment */}
                      {!msg.attachments?.some((a) => a.type === 'youtube') && (() => {
                        const directYtId = getYouTubeVideoId(msg.content);
                        if (!directYtId) return null;
                        return (
                          <div className="mt-2.5 max-w-md w-full rounded-2xl overflow-hidden border border-[#EBE5DA] cafe-shadow bg-[#2C2520]">
                            <div className="px-3.5 py-2 bg-[#2C2520] text-white flex items-center justify-between text-xs">
                              <div className="flex items-center gap-2 font-bold">
                                <span className="w-2.5 h-2.5 rounded-full bg-[#EA4335] animate-pulse" />
                                <span className="text-[#FDFBF7]">YouTube 인앱 플레이어</span>
                              </div>
                              <a
                                href={`https://www.youtube.com/watch?v=${directYtId}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[10px] text-[#A89A8E] hover:text-white flex items-center gap-1 transition-colors"
                              >
                                <span>새 탭에서 보기</span>
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            </div>
                            <div className="relative aspect-video w-full">
                              <iframe
                                src={`https://www.youtube.com/embed/${directYtId}?autoplay=0&rel=0&enablejsapi=1`}
                                title="YouTube video player"
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                                referrerPolicy="strict-origin-when-cross-origin"
                                allowFullScreen
                                className="w-full h-full border-none"
                              />
                            </div>
                          </div>
                        );
                      })()}

                      {msg.attachments && msg.attachments.length > 0 && (
                        <div className="mt-1 space-y-2">
                          {msg.attachments.map((att) => renderAttachment(att, msg.id))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Reactions with 1-Click Toggle & Add Emoji Popover */}
                  <div className={`flex flex-wrap items-center gap-1.5 mt-1.5 relative ${isMine ? 'justify-end' : ''}`}>
                    {msg.reactions && msg.reactions.map((r) => {
                      const hasReacted = r.userIds.includes(currentUser.id);
                      const userNames = r.userIds.map((uid) => allUsers.find((u) => u.id === uid)?.name || uid).join(', ');
                      return (
                        <button
                          key={r.emoji}
                          type="button"
                          onClick={() => onToggleReaction(msg.id, r.emoji)}
                          title={`${userNames} 님이 반응함 (클릭하여 토글)`}
                          className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] border transition-all cursor-pointer ${
                            hasReacted
                              ? 'bg-[#E6DCD0] border-[#C18C5D] text-[#3E2723] font-bold shadow-xs'
                              : 'bg-white border-[#EBE5DA] text-[#7A6A5C] hover:bg-[#FDFBF7] hover:border-[#C18C5D]'
                          }`}
                        >
                          <span>{r.emoji}</span>
                          <span>{r.count}</span>
                        </button>
                      );
                    })}

                    {/* Inline + Button to add emoji reaction */}
                    <button
                      type="button"
                      onClick={() => setActiveEmojiPickerMessageId(activeEmojiPickerMessageId === msg.id ? null : msg.id)}
                      className="flex items-center justify-center w-6 h-5 rounded-full text-xs border border-dashed border-[#DCD3C5] text-[#7A6A5C] hover:text-[#3E2723] hover:border-[#C18C5D] hover:bg-[#F4EFE6] transition-all cursor-pointer"
                      title="이모티콘 반응 추가"
                    >
                      <Smile className="w-3 h-3" />
                    </button>

                    {/* Emoji Reaction Popover Palette - Portal로 표시해 스크롤 영역에 잘리지 않음 */}
                    <button
                      type="button"
                      onClick={(e) => {
                        if (activeEmojiPickerMessageId === msg.id) {
                          setActiveEmojiPickerMessageId(null);
                          return;
                        }
                        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                        const width = 252;
                        setReactionPanelPos({
                          left: Math.max(8, Math.min(rect.left, window.innerWidth - width - 8)),
                          top: Math.max(8, Math.min(rect.bottom + 8, window.innerHeight - 190)),
                        });
                        setActiveEmojiPickerMessageId(msg.id);
                      }}
                      data-testid={`reaction-picker-${msg.id}`}
                      className="flex items-center justify-center w-6 h-5 rounded-full text-xs border border-dashed border-[#DCD3C5] text-[#7A6A5C] hover:text-[#3E2723] hover:border-[#C18C5D] hover:bg-[#F4EFE6] transition-all cursor-pointer"
                      title="이모티콘 반응 추가"
                    >
                      <Smile className="w-3 h-3" />
                    </button>
                  </div>

                  {/* Thread summary */}
                  {msg.repliesCount && msg.repliesCount > 0 ? (
                    <button
                      onClick={() => onOpenThread(msg)}
                      className="flex items-center gap-1.5 mt-2 text-[11px] font-bold text-[#C18C5D] hover:underline cursor-pointer"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span>답글 {msg.repliesCount}개 보기 (스레드 열기)</span>
                    </button>
                  ) : null}
                </div>

                {/* Message Hover Actions Toolbar (Desktop) */}
                <div style={isRedacted ? { display: 'none' } : undefined} className="opacity-0 group-hover:opacity-100 sm:flex hidden items-center gap-0.5 bg-white border border-[#EBE5DA] p-1 rounded-xl cafe-shadow transition-opacity flex-shrink-0 relative">
                  {/* Quick Emojis */}
                  {REACTION_EMOJI_PALETTE.slice(0, 3).map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => onToggleReaction(msg.id, emoji)}
                      className="p-1 hover:bg-[#F4EFE6] rounded-lg text-xs cursor-pointer"
                      title={`${emoji} 반응 남기기`}
                    >
                      {emoji}
                    </button>
                  ))}

                  {/* Emoji Picker Button */}
                  <button
                    type="button"
                    onClick={() => setActiveEmojiPickerMessageId(activeEmojiPickerMessageId === msg.id ? null : msg.id)}
                    className="p-1 hover:bg-[#F4EFE6] rounded-lg text-[#7A6A5C] hover:text-[#3E2723] cursor-pointer"
                    title="이모티콘 반응 선택"
                  >
                    <Smile className="w-3.5 h-3.5" />
                  </button>

                  {/* In-line Reply Button */}
                  <button
                    type="button"
                    onClick={() => {
                      setActiveReplyTarget(msg);
                      textareaRef.current?.focus();
                    }}
                    className="p-1 hover:bg-[#F4EFE6] rounded-lg text-[#7A6A5C] hover:text-[#C18C5D] cursor-pointer"
                    title="답글 달기"
                  >
                    <Reply className="w-3.5 h-3.5" />
                  </button>

                  {/* Translate Button */}
                  <button
                    type="button"
                    onClick={() => setTranslateTargetMessage(msg)}
                    className="p-1 hover:bg-[#F4EFE6] rounded-lg text-[#7A6A5C] hover:text-[#0369A1] cursor-pointer"
                    title="메시지 번역 (모든 언어)"
                  >
                    <Languages className="w-3.5 h-3.5" />
                  </button>

                  {/* Thread Panel Button */}
                  <button
                    type="button"
                    onClick={() => onOpenThread(msg)}
                    className="p-1 hover:bg-[#F4EFE6] rounded-lg text-[#7A6A5C] hover:text-[#2C2520] cursor-pointer"
                    title="스레드 답글 패널"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                  </button>

                  {/* Bookmark Message */}
                  <button
                    type="button"
                    onClick={() => onToggleStarMessage(msg.id)}
                    className={`p-1 hover:bg-[#F4EFE6] rounded-lg cursor-pointer ${
                      msg.isStarred ? 'text-[#ECC94B]' : 'text-[#7A6A5C]'
                    }`}
                    title="북마크 / 중요 보관"
                  >
                    <Bookmark className="w-3.5 h-3.5 fill-current" />
                  </button>

                  {/* Forward Message */}
                  <button
                    type="button"
                    onClick={() => setForwardingMessage(msg)}
                    className="p-1 hover:bg-[#F4EFE6] rounded-lg text-[#7A6A5C] hover:text-[#2C2520] cursor-pointer"
                    title="다른 채널로 메시지 전달"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                  </button>

                  {onPinMessage && (
                    <button
                      type="button"
                      onClick={() => onPinMessage(msg.id, msg.content)}
                      className="p-1 hover:bg-[#F4EFE6] rounded-lg text-[#7A6A5C] hover:text-[#C18C5D] cursor-pointer"
                      title="상단 공지로 고정"
                    >
                      <Pin className="w-3.5 h-3.5" />
                    </button>
                  )}

                  {/* Edit Message (if Mine) */}
                  {isMine && onEditMessage && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingMessageId(msg.id);
                        setEditingText(msg.content);
                      }}
                      className="p-1 hover:bg-[#F4EFE6] rounded-lg text-[#7A6A5C] hover:text-[#2C2520] cursor-pointer"
                      title="메시지 수정 (ArrowUp)"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                  )}

                  {/* Delete Message Button — 내 메시지: 서버 영구 삭제 / 남의 메시지: 내 화면에서 가리기 */}
                  {onDeleteMessageTracedFree && (
                    <button
                      type="button"
                      onClick={() => handleDeleteMessage(msg.id)}
                      className={`p-1 rounded-lg transition-colors cursor-pointer ${
                        isMine ? 'hover:bg-[#FEE2E2] text-[#DC2626] hover:text-[#B91C1C]' : 'hover:bg-[#F4EFE6] text-[#7A6A5C]'
                      }`}
                      title={isMine ? '메시지 영구 삭제 (서버에서도 삭제)' : '내 화면에서만 가리기'}
                      data-testid={`msg-${isMine ? 'delete' : 'hide'}-${msg.id}`}
                    >
                      {isMine ? <Trash2 className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                    </button>
                  )}

                  {/* More Menu (...) */}
                  <button
                    type="button"
                    onClick={() => setActiveMenuMessageId(activeMenuMessageId === msg.id ? null : msg.id)}
                    className="p-1 hover:bg-[#F4EFE6] rounded-lg text-[#7A6A5C] hover:text-[#2C2520] cursor-pointer"
                    title="더보기"
                  >
                    <MoreHorizontal className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Mobile Touch Action Buttons (모바일 전용 간편 버튼) */}
                <div style={isRedacted ? { display: 'none' } : undefined} className="sm:hidden flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setTranslateTargetMessage(msg)}
                    className="p-1 text-[#0369A1] hover:bg-[#E0F2FE] rounded-lg cursor-pointer"
                    title="메시지 번역"
                  >
                    <Languages className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveReplyTarget(msg);
                      textareaRef.current?.focus();
                    }}
                    className="p-1 text-[#7A6A5C] hover:text-[#C18C5D] hover:bg-[#F4EFE6] rounded-lg cursor-pointer"
                    title="답글 달기"
                  >
                    <Reply className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveEmojiPickerMessageId(activeEmojiPickerMessageId === msg.id ? null : msg.id)}
                    className="p-1 text-[#7A6A5C] hover:bg-[#F4EFE6] rounded-lg cursor-pointer"
                    title="이모티콘 반응"
                  >
                    <Smile className="w-3.5 h-3.5" />
                  </button>
                  {onDeleteMessageTracedFree && (
                    <button
                      type="button"
                      onClick={() => handleDeleteMessage(msg.id)}
                      className={`p-1 rounded-lg cursor-pointer ${isMine ? 'text-[#DC2626] hover:bg-[#FEE2E2]' : 'text-[#7A6A5C] hover:bg-[#F4EFE6]'}`}
                      title={isMine ? '메시지 삭제' : '내 화면에서만 가리기'}
                    >
                      {isMine ? <Trash2 className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setActiveMenuMessageId(activeMenuMessageId === msg.id ? null : msg.id)}
                    className="p-1.5 rounded-lg text-[#A89A8E] hover:text-[#2C2520] hover:bg-[#F4EFE6] cursor-pointer"
                    title="더보기"
                  >
                    <MoreHorizontal className="w-4 h-4" />
                  </button>
                </div>

                {/* 3-dots Dropdown Menu (Slack Style Actions) */}
                {activeMenuMessageId === msg.id && (
                  <div className="absolute top-8 right-2 z-30 bg-white border border-[#EBE5DA] rounded-2xl cafe-shadow-lg p-1.5 min-w-[200px] text-xs animate-in fade-in zoom-in-95">
                    <button
                      type="button"
                      onClick={() => {
                        setActiveReplyTarget(msg);
                        setActiveMenuMessageId(null);
                        textareaRef.current?.focus();
                      }}
                      className="w-full flex items-center gap-2 px-2.5 py-1.5 hover:bg-[#F4EFE6] rounded-xl text-left text-[#2C2520] cursor-pointer font-medium"
                    >
                      <Reply className="w-3.5 h-3.5 text-[#C18C5D]" />
                      <span>답글 달기</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        onOpenThread(msg);
                        setActiveMenuMessageId(null);
                      }}
                      className="w-full flex items-center gap-2 px-2.5 py-1.5 hover:bg-[#F4EFE6] rounded-xl text-left text-[#2C2520] cursor-pointer"
                    >
                      <MessageSquare className="w-3.5 h-3.5 text-[#7A6A5C]" />
                      <span>스레드 패널 열기</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setActiveEmojiPickerMessageId(msg.id);
                        setActiveMenuMessageId(null);
                      }}
                      className="w-full flex items-center gap-2 px-2.5 py-1.5 hover:bg-[#F4EFE6] rounded-xl text-left text-[#2C2520] cursor-pointer"
                    >
                      <Smile className="w-3.5 h-3.5 text-[#C18C5D]" />
                      <span>이모티콘 반응 추가</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(msg.content);
                        setActiveMenuMessageId(null);
                        setDeleteToast({ message: '텍스트가 클립보드에 복사되었습니다.', undoable: false });
                        setTimeout(() => setDeleteToast(null), 2500);
                      }}
                      className="w-full flex items-center gap-2 px-2.5 py-1.5 hover:bg-[#F4EFE6] rounded-xl text-left text-[#2C2520] cursor-pointer"
                    >
                      <Copy className="w-3.5 h-3.5 text-[#7A6A5C]" />
                      <span>텍스트 복사</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleSetReminder(msg, 10, '10초')}
                      className="w-full flex items-center gap-2 px-2.5 py-1.5 hover:bg-[#F4EFE6] rounded-xl text-left text-[#2C2520] cursor-pointer"
                    >
                      <Clock className="w-3.5 h-3.5 text-[#C18C5D]" />
                      <span>리마인더 알림 (10초 후 테스트)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setForwardingMessage(msg);
                        setActiveMenuMessageId(null);
                      }}
                      className="w-full flex items-center gap-2 px-2.5 py-1.5 hover:bg-[#F4EFE6] rounded-xl text-left text-[#2C2520] cursor-pointer"
                    >
                      <Share2 className="w-3.5 h-3.5 text-[#7A6A5C]" />
                      <span>다른 채널로 전달</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        onToggleStarMessage(msg.id);
                        setActiveMenuMessageId(null);
                      }}
                      className="w-full flex items-center gap-2 px-2.5 py-1.5 hover:bg-[#F4EFE6] rounded-xl text-left text-[#2C2520] cursor-pointer"
                    >
                      <Bookmark className="w-3.5 h-3.5 text-[#ECC94B]" />
                      <span>{msg.isStarred ? '북마크 해제' : '나중에 볼 항목에 보관'}</span>
                    </button>

                    {onPinMessage && (
                      <button
                        type="button"
                        onClick={() => {
                          onPinMessage(msg.id, msg.content);
                          setActiveMenuMessageId(null);
                        }}
                        className="w-full flex items-center gap-2 px-2.5 py-1.5 hover:bg-[#F4EFE6] rounded-xl text-left text-[#2C2520] cursor-pointer"
                      >
                        <Pin className="w-3.5 h-3.5 text-[#C18C5D]" />
                        <span>상단 공지로 고정</span>
                      </button>
                    )}

                    {onDeleteMessageTracedFree && (
                      <div className="pt-1 mt-1 border-t border-[#EBE5DA]">
                        <button
                          type="button"
                          onClick={() => {
                            setActiveMenuMessageId(null);
                            handleDeleteMessage(msg.id);
                          }}
                          className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-left font-bold cursor-pointer ${
                            isMine ? 'hover:bg-[#FEE2E2] text-[#DC2626]' : 'hover:bg-[#F4EFE6] text-[#5C5046]'
                          }`}
                        >
                          {isMine ? <Trash2 className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                          <span>{isMine ? '메시지 영구 삭제' : '내 화면에서만 가리기'}</span>
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {/* Sinusoidal 3-dots typing indicator */}
          {isPeerTyping && typingPeerUser && (
            <div className="flex items-center gap-3 p-2 animate-in fade-in duration-200">
              <img
                src={avatarSrc(typingPeerUser.avatar)} onError={handleAvatarError}
                alt={typingPeerUser.name}
                className="w-8 h-8 rounded-xl object-cover bg-white border border-[#EBE5DA] shadow-xs"
              />
              <div className="flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-white border border-[#EBE5DA] cafe-shadow">
                <span className="text-[11px] font-semibold text-[#7A6A5C]">{typingPeerUser.name}님이 입력 중</span>
                <div className="flex items-center gap-1 ml-1 h-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#3E2723] typing-dot-1" />
                  <span className="w-1.5 h-1.5 rounded-full bg-[#3E2723] typing-dot-2" />
                  <span className="w-1.5 h-1.5 rounded-full bg-[#3E2723] typing-dot-3" />
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Space Collaborative Canvas Scratchpad (Slack Canvas Killer Feature) */}
        {isCanvasOpen && (
          <aside className="w-80 md:w-96 flex-shrink-0 bg-[#FDFBF7] border-l border-[#EBE5DA] flex flex-col justify-between z-20 cafe-shadow animate-in slide-in-from-right duration-200">
            <div className="h-14 px-4 border-b border-[#EBE5DA] flex items-center justify-between bg-[#FDFBF7]">
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-[#C18C5D]" />
                <h3 className="text-sm font-bold text-[#2C2520]">스페이스 공유 캔버스</h3>
              </div>
              <button onClick={() => setIsCanvasOpen(false)} className="p-1 rounded-lg text-[#7A6A5C]">
                <X className="w-4 h-4" />
              </button>
            </div>

            {canvasSavedToast && (
              <div className="p-2 mx-3 mt-2 rounded-xl bg-[#F0FFF4] text-[11px] text-[#276749] font-bold text-center border border-[#9AE6B4]">
                ✓ 캔버스가 저장되었습니다!
              </div>
            )}

            <div className="flex-1 p-3 overflow-y-auto">
              <textarea
                value={canvasText}
                onChange={(e) => setCanvasText(e.target.value)}
                className="w-full h-full p-3 bg-white border border-[#EBE5DA] rounded-xl text-xs font-mono text-[#2C2520] focus:outline-none focus:border-[#C18C5D] resize-none leading-relaxed"
                placeholder="팀원들과 공유할 메모, 목표, 링크를 작성하세요..."
              />
            </div>

            <div className="p-3 border-t border-[#EBE5DA] bg-white flex justify-end">
              <button
                onClick={handleSaveCanvas}
                className="px-4 py-1.5 rounded-xl bg-[#3E2723] text-white text-xs font-bold hover:bg-[#2C2520] shadow-xs"
              >
                캔버스 저장
              </button>
            </div>
          </aside>
        )}
      </div>

      {/* SMART REPLIES CHIPS */}
      <div className="px-4 sm:px-6 py-1.5 flex items-center gap-2 overflow-x-auto">
        <span className="text-[10px] text-[#A89A8E] font-medium flex-shrink-0 flex items-center gap-1">
          <Sparkles className="w-3 h-3 text-[#C18C5D]" />
          <span>스마트 답장:</span>
        </span>
        {smartReplies.map((reply, idx) => (
          <button
            key={idx}
            onClick={() => onSendMessage(reply)}
            className="px-2.5 py-1 rounded-full bg-[#FFFFFF] hover:bg-[#F4EFE6] border border-[#EBE5DA] text-[11px] font-medium text-[#3E2723] transition-all cafe-shadow whitespace-nowrap cursor-pointer"
          >
            {reply}
          </button>
        ))}
      </div>

      {/* INPUT CONTAINER */}
      <div className="p-3 sm:p-4 bg-[#FDFBF7] border-t border-[#EBE5DA] relative">
        {/* Floating Slash Command Palette (Slack Feature) */}
        {isSlashCommandMode && matchedSlashCommands.length > 0 && (
          <div className="absolute bottom-full left-4 right-4 mb-2 bg-white border border-[#EBE5DA] rounded-2xl cafe-shadow-lg p-2 max-h-48 overflow-y-auto z-30">
            <div className="text-[10px] font-bold text-[#A89A8E] px-2 py-1 uppercase">슬래시 커맨드 (Slash Commands)</div>
            {matchedSlashCommands.map((c) => (
              <button
                key={c.cmd}
                onClick={() => {
                  setText(c.cmd + ' ');
                  textareaRef.current?.focus();
                }}
                className="w-full flex items-center justify-between p-2 rounded-xl hover:bg-[#F4EFE6] text-left text-xs transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-[#3E2723]">{c.cmd}</span>
                  <span className="text-[#7A6A5C]">{c.desc}</span>
                </div>
                <span className="text-[10px] text-[#A89A8E] font-mono">{c.placeholder}</span>
              </button>
            ))}
          </div>
        )}

        {/* Pending attachments drawer */}
        {pendingAttachments.length > 0 && (
          <div className="mb-2 p-2 rounded-xl bg-[#F4EFE6] border border-[#EBE5DA] flex items-center gap-2 overflow-x-auto">
            {pendingAttachments.map((att, i) => (
              <div
                key={i}
                className="flex items-center gap-1.5 bg-white px-2 py-1 rounded-lg border border-[#DCD3C5] text-xs"
              >
                <Paperclip className="w-3 h-3 text-[#7A6A5C]" />
                <span className="truncate max-w-[120px]">
                  {'fileName' in att ? (att as any).fileName : (att as any).name || '첨부파일'}
                </span>
                <button
                  onClick={() => setPendingAttachments((prev) => prev.filter((_, idx) => idx !== i))}
                  className="p-0.5 text-[#A89A8E] hover:text-[#DC2626]"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Text formatting bar (A button toolbar) */}
        {showFormatBar && (
          <div className="mb-2 p-1.5 rounded-xl bg-[#F4EFE6] border border-[#EBE5DA] flex items-center gap-1 text-xs">
            <button onClick={() => applyFormatting('**')} className="p-1 rounded-lg hover:bg-white text-[#3E2723]" title="굵게 (Ctrl+B)">
              <Bold className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => applyFormatting('*')} className="p-1 rounded-lg hover:bg-white text-[#3E2723]" title="기울임 (Ctrl+I)">
              <Italic className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => applyFormatting('~~')} className="p-1 rounded-lg hover:bg-white text-[#3E2723]" title="취소선">
              <Strikethrough className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => applyFormatting('• ')} className="p-1 rounded-lg hover:bg-white text-[#3E2723]" title="글머리 기호 (•)">
              <List className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Voice Recording In-Progress Banner */}
        {isRecordingVoice ? (
          <div className="flex flex-col gap-2 p-3 rounded-2xl bg-[#FFF5F5] border border-[#FEB2B2]" data-testid="voice-recording-banner">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-bold text-[#C53030] min-w-0">
                <span className="w-2.5 h-2.5 rounded-full bg-[#E53E3E] animate-pulse shrink-0" />
                <span className="truncate">
                  녹음 중 · {String(Math.floor(voiceRecordSeconds / 60)).padStart(2, '0')}:
                  {String(voiceRecordSeconds % 60).padStart(2, '0')}
                </span>
                <span className="hidden sm:inline text-[10px] font-medium text-[#B91C1C]/70">최대 60초</span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={cancelVoiceRecording}
                  data-testid="voice-cancel"
                  className="px-3 py-1.5 rounded-lg bg-white border border-[#FEB2B2] text-[11px] font-semibold text-[#7A6A5C] active:scale-95 transition-transform"
                >
                  취소
                </button>
                <button
                  onClick={stopVoiceRecordingAndSend}
                  data-testid="voice-send"
                  className="px-3 py-1.5 rounded-lg bg-[#E53E3E] text-white text-[11px] font-bold shadow-xs active:scale-95 transition-transform"
                >
                  완료 및 전송
                </button>
              </div>
            </div>
            <div className="flex items-center gap-[3px] h-6">
              {Array.from({ length: 40 }).map((_, idx) => (
                <div
                  key={idx}
                  className="w-1 rounded-full bg-[#F87171] voice-bar-anim"
                  style={{ animationDelay: `${(idx % 10) * 0.08}s`, height: `${6 + ((idx * 7) % 16)}px` }}
                />
              ))}
            </div>
          </div>
        ) : (
          <>
          {voiceError && (
            <div className="mb-2 px-3 py-2 rounded-xl bg-[#FEF2F2] border border-[#FCA5A5] text-[11px] text-[#B91C1C] flex items-start gap-2" data-testid="voice-error">
              <span className="shrink-0">⚠️</span>
              <span className="flex-1 leading-relaxed">{voiceError}</span>
              <button onClick={() => setVoiceError(null)} className="shrink-0 hover:text-[#7F1D1D]" aria-label="오류 닫기">
                <X className="w-3 h-3" />
              </button>
            </div>
          )}
          <div className="rounded-2xl border border-[#EBE5DA] bg-white focus-within:border-[#C18C5D] transition-all cafe-shadow">
            {/* Active Reply Banner */}
            {activeReplyTarget && (
              <div className="flex items-center justify-between px-3 py-2 bg-[#FAF7F2] border-b border-[#EBE5DA] rounded-t-2xl text-xs text-[#5C5046] animate-in fade-in">
                <div className="flex items-center gap-2 truncate">
                  <Reply className="w-3.5 h-3.5 text-[#C18C5D] flex-shrink-0" />
                  <span className="font-bold text-[#3E2723]">@{activeReplyTarget.senderName}</span>
                  <span className="text-[11px] text-[#7A6A5C]">님에게 답글 작성 중:</span>
                  <span className="truncate text-[#7A6A5C] max-w-xs sm:max-w-md">{activeReplyTarget.content || '(첨부파일)'}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveReplyTarget(null)}
                  className="p-1 text-[#A89A8E] hover:text-[#DC2626] rounded-md transition-colors cursor-pointer"
                  title="답글 취소"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Input textarea with Smart Compose Ghost Text */}
            <div className="relative p-3 pb-1">
              <textarea
                ref={textareaRef}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="메시지 입력... (/ 로 슬래시 커맨드, Enter 전송, ↑ 이전 메시지 수정)"
                rows={2}
                className="w-full bg-transparent text-xs text-[#2C2520] placeholder-[#A89A8E] focus:outline-none resize-none leading-relaxed"
              />

              {smartComposeGhost && text.trim().length > 0 && (
                <div className="text-[11px] text-[#A89A8E] font-medium mt-0.5 flex items-center gap-1">
                  <span>추천 문장:</span>
                  <span className="text-[#3E2723] font-semibold">{smartComposeGhost}</span>
                  <kbd className="px-1.5 py-0.2 bg-[#F4EFE6] border border-[#EBE5DA] rounded text-[10px] text-[#7A6A5C] font-mono ml-1">
                    Tab으로 자동 완성
                  </kbd>
                </div>
              )}
            </div>

            {/* Bottom Toolbar inside input */}
            <div className="px-2 sm:px-3 py-2 flex items-center justify-between gap-1.5 border-t border-[#F4EFE6]">
              <div className="flex items-center gap-0.5 sm:gap-1 text-[#7A6A5C] flex-1 min-w-0 overflow-x-auto scrollbar-none">
                <button
                  type="button"
                  onClick={() => setShowFormatBar(!showFormatBar)}
                  className={`p-1.5 rounded-lg text-xs font-bold transition-colors ${
                    showFormatBar ? 'bg-[#F4EFE6] text-[#3E2723]' : 'hover:bg-[#FDFBF7]'
                  }`}
                  title="서식 도구함 (A)"
                >
                  <span className="font-serif underline text-sm leading-none">A</span>
                </button>

                <button
                  type="button"
                  onClick={onOpenDrivePicker}
                  className="p-1.5 rounded-lg hover:bg-[#F4EFE6] hover:text-[#3E2723]"
                  title="Google Drive 파일 공유"
                >
                  <HardDrive className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={onOpenCalendarModal}
                  className="p-1.5 rounded-lg hover:bg-[#F4EFE6] hover:text-[#3E2723]"
                  title="Google 캘린더 일정 잡기"
                >
                  <CalendarIcon className="w-4 h-4" />
                </button>

                {/* Quick Poll Creator Button (Slack Feature) */}
                <button
                  type="button"
                  onClick={() => setIsPollModalOpen(true)}
                  className="p-1.5 rounded-lg hover:bg-[#F4EFE6] hover:text-[#3E2723]"
                  title="실시간 즉석 투표 만들기 (/poll)"
                >
                  <Vote className="w-4 h-4" />
                </button>

                {/* Real GPS Location Picker */}
                <button
                  type="button"
                  onClick={() => setIsLocationModalOpen(true)}
                  className="p-1.5 rounded-lg hover:bg-[#F4EFE6] hover:text-[#3E2723]"
                  title="실시간 사용자 GPS 위치 추적 & 공유"
                >
                  <MapPin className="w-4 h-4" />
                </button>

                {/* YouTube In-App Player & Share */}
                <button
                  type="button"
                  onClick={onOpenYouTubeView || (() => setIsYouTubeModalOpen(true))}
                  className="p-1.5 rounded-lg hover:bg-[#F4EFE6] hover:text-[#3E2723]"
                  title="YouTube 인앱 미디어 센터 및 동영상 공유"
                >
                  <Youtube className="w-4 h-4" />
                </button>

                {/* Voice Note Recording */}
                <button
                  type="button"
                  onClick={startVoiceRecording}
                  className="p-1.5 rounded-lg hover:bg-[#F4EFE6] hover:text-[#3E2723]"
                  title="음성 메시지 녹음"
                >
                  <Mic className="w-4 h-4" />
                </button>

                {/* Image Upload */}
                <button
                  type="button"
                  onClick={() => imageInputRef.current?.click()}
                  className="p-1.5 rounded-lg text-[#5C5046] hover:bg-[#F4EFE6]"
                  title="이미지 첨부"
                >
                  <ImageIcon className="w-4 h-4" />
                </button>
                <input ref={imageInputRef} type="file" accept="image/*" multiple onChange={handleImageUpload} className="hidden" />

                {/* File Upload */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="p-1.5 rounded-lg text-[#5C5046] hover:bg-[#F4EFE6]"
                  title="파일 첨부"
                >
                  <Paperclip className="w-4 h-4" />
                </button>
                <input ref={fileInputRef} type="file" multiple onChange={handleFileUpload} className="hidden" />

                {/* Emoji Palette Picker - Portal so no scroll container can clip it */}
                <div className="relative">
                  <button
                    ref={emojiButtonRef}
                    type="button"
                    onClick={toggleEmojiPicker}
                    className="p-1.5 rounded-lg hover:bg-[#FDFBF7] text-[#7A6A5C] hover:text-[#3E2723] transition-colors cursor-pointer"
                    title="이모티콘 선택"
                    data-testid="emoji-picker-button"
                    aria-expanded={showEmojiPicker}
                  >
                    <Smile className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">

                {/* Send Button */}
                <button
                  type="button"
                  onClick={handleSend}
                  disabled={!text.trim() && pendingAttachments.length === 0}
                  className={`px-3.5 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all shadow-xs cursor-pointer ${
                    text.trim() || pendingAttachments.length > 0
                      ? 'bg-[#3E2723] hover:bg-[#2C2520] text-white'
                      : 'bg-[#EBE5DA] text-[#A89A8E] cursor-not-allowed'
                  }`}
                >
                  <span>전송</span>
                  <Send className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
          </>
        )}
      </div>

      {/* 이모티콘 피커 (Portal: 어떤 스크롤/오버플로 영역에도 잘리지 않음) */}
      {showEmojiPicker &&
        createPortal(
          <div
            ref={emojiPanelRef}
            data-testid="emoji-picker-panel"
            style={{ position: 'fixed', left: emojiPanelPos.left, bottom: emojiPanelPos.bottom }}
            className="w-72 max-w-[calc(100vw-16px)] bg-white border border-[#EBE5DA] rounded-2xl p-2.5 shadow-2xl z-[120] animate-in fade-in zoom-in-95"
          >
            <div className="pb-1.5 mb-1.5 border-b border-[#EBE5DA] flex items-center justify-between text-[11px] font-bold text-[#5C5046]">
              <span>이모티콘</span>
              <button type="button" onClick={() => setShowEmojiPicker(false)} className="p-0.5 rounded hover:bg-[#F4EFE6] text-[#A89A8E]" aria-label="이모티콘 닫기">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="grid grid-cols-8 gap-0.5">
              {EMOJI_PICKER_LIST.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => insertEmoji(emoji)}
                  data-testid={`emoji-option-${emoji}`}
                  className="w-8 h-8 rounded-lg hover:bg-[#F4EFE6] active:scale-90 text-base flex items-center justify-center transition-transform"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>,
          document.body
        )}

      {/* 반응 이모지 피커 (Portal) */}
      {activeEmojiPickerMessageId &&
        createPortal(
          <div
            ref={reactionPanelRef}
            data-testid="reaction-picker-panel"
            style={{ position: 'fixed', left: reactionPanelPos.left, top: reactionPanelPos.top }}
            className="w-64 max-w-[calc(100vw-16px)] bg-white border border-[#EBE5DA] rounded-2xl p-2.5 shadow-2xl z-[120] animate-in fade-in zoom-in-95"
          >
            <div className="pb-1.5 mb-1.5 border-b border-[#EBE5DA] flex items-center justify-between text-[10px] font-bold text-[#5C5046]">
              <span>반응 남기기</span>
              <button type="button" onClick={() => setActiveEmojiPickerMessageId(null)} className="p-0.5 rounded hover:bg-[#F4EFE6] text-[#A89A8E]" aria-label="반응 피커 닫기">
                <X className="w-3 h-3" />
              </button>
            </div>
            <div className="grid grid-cols-5 gap-1">
              {REACTION_EMOJI_PALETTE.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => {
                    onToggleReaction(activeEmojiPickerMessageId, emoji);
                    setActiveEmojiPickerMessageId(null);
                  }}
                  data-testid={`reaction-option-${emoji}`}
                  className="w-9 h-9 rounded-xl hover:bg-[#F4EFE6] active:scale-90 text-base flex items-center justify-center transition-transform"
                  title={emoji}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>,
          document.body
        )}

      {/* REAL YOUTUBE HUB MODAL */}
      <YouTubeHubModal
        isOpen={isYouTubeModalOpen}
        onClose={() => setIsYouTubeModalOpen(false)}
        onShareToChat={(videoUrl, title, videoId) => {
          const ytAtt: YouTubeAttachment = {
            type: 'youtube',
            videoId,
            url: videoUrl,
            title,
          };
          onSendMessage(`YouTube 공유: ${title}\n${videoUrl}`, [ytAtt]);
          setIsYouTubeModalOpen(false);
        }}
      />

      {/* LOCATION PICKER MODAL with REAL GPS */}
      <LocationPickerModal
        isOpen={isLocationModalOpen}
        onClose={() => setIsLocationModalOpen(false)}
        onShareLocation={handleLocationReceived}
      />

      {/* QUICK POLL CREATOR MODAL (Slack Feature) */}
      {isPollModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs select-none animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-2xl bg-white border border-[#EBE5DA] p-5 sm:p-6 cafe-shadow-lg text-[#2C2520] space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-[#EBE5DA]">
              <div className="flex items-center gap-2">
                <Vote className="w-4 h-4 text-[#C18C5D]" />
                <h3 className="text-sm font-bold text-[#2C2520]">실시간 즉석 투표 만들기</h3>
              </div>
              <button onClick={() => setIsPollModalOpen(false)} className="p-1 text-[#7A6A5C]">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="text-xs font-semibold text-[#5C5046] block mb-1">투표 질문</label>
              <input
                type="text"
                value={pollQuestion}
                onChange={(e) => setPollQuestion(e.target.value)}
                placeholder="예: 오늘 점심 메뉴 뭐 먹을까요?"
                className="w-full bg-[#FDFBF7] border border-[#EBE5DA] rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#C18C5D]"
                autoFocus
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#5C5046] block">선택지 (최소 2개)</label>
              {pollOptions.map((opt, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <input
                    type="text"
                    value={opt}
                    onChange={(e) => {
                      const updated = [...pollOptions];
                      updated[i] = e.target.value;
                      setPollOptions(updated);
                    }}
                    placeholder={`옵션 ${i + 1}`}
                    className="flex-1 bg-[#FDFBF7] border border-[#EBE5DA] rounded-xl px-3 py-1.5 text-xs focus:outline-none"
                  />
                  {pollOptions.length > 2 && (
                    <button
                      onClick={() => setPollOptions(pollOptions.filter((_, idx) => idx !== i))}
                      className="p-1 text-[#A89A8E] hover:text-[#DC2626]"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
              {pollOptions.length < 5 && (
                <button
                  type="button"
                  onClick={() => setPollOptions([...pollOptions, `옵션 ${pollOptions.length + 1}`])}
                  className="text-xs text-[#C18C5D] font-bold hover:underline"
                >
                  + 선택지 추가
                </button>
              )}
            </div>

            <div className="pt-3 border-t border-[#EBE5DA] flex justify-end gap-2">
              <button
                onClick={() => setIsPollModalOpen(false)}
                className="px-3 py-1.5 rounded-xl bg-[#F4EFE6] text-xs font-semibold"
              >
                취소
              </button>
              <button
                onClick={handleCreatePoll}
                disabled={!pollQuestion.trim()}
                className="px-4 py-1.5 rounded-xl bg-[#3E2723] text-white text-xs font-bold disabled:opacity-50"
              >
                투표 게시
              </button>
            </div>
          </div>
        </div>
      )}

      {/* GEMINI 3-LINE SUMMARY MODAL */}
      {isGeminiSummaryOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs select-none animate-in fade-in duration-150">
          <div className="w-full max-w-lg rounded-2xl bg-white border border-[#EBE5DA] p-6 cafe-shadow-lg">
            <div className="flex items-center justify-between pb-3 border-b border-[#EBE5DA] mb-4">
              <div className="flex items-center gap-2 font-bold text-sm text-[#3E2723]">
                <Sparkles className="w-4 h-4 text-[#C18C5D]" />
                <span>Gemini AI 대화 3줄 핵심 요약</span>
              </div>
              <button onClick={() => setIsGeminiSummaryOpen(false)} className="p-1 rounded-lg text-[#7A6A5C]">
                <X className="w-4 h-4" />
              </button>
            </div>

            {isSummaryLoading ? (
              <div className="py-8 text-center text-xs text-[#7A6A5C] space-y-2">
                <Sparkles className="w-6 h-6 text-[#C18C5D] animate-spin mx-auto" />
                <p>Gemini AI가 방 안의 대화를 3줄로 정리하고 있습니다...</p>
              </div>
            ) : (
              <div className="space-y-3">
                {geminiSummaryLines.map((line, i) => (
                  <div key={i} className="p-3 rounded-xl bg-[#FDFBF7] border border-[#EBE5DA] text-xs text-[#2C2520] font-medium leading-relaxed">
                    {line}
                  </div>
                ))}
              </div>
            )}

            <div className="pt-4 border-t border-[#EBE5DA] mt-4 flex justify-end">
              <button onClick={() => setIsGeminiSummaryOpen(false)} className="px-4 py-2 rounded-xl bg-[#3E2723] text-white text-xs font-bold">
                확인 완료
              </button>
            </div>
          </div>
        </div>
      )}

      {/* GEMINI WORKSPACE AI SEARCH MODAL */}
      {isGeminiSearchOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs select-none animate-in fade-in duration-150">
          <div className="w-full max-w-lg rounded-2xl bg-white border border-[#EBE5DA] p-6 cafe-shadow-lg">
            <div className="flex items-center justify-between pb-3 border-b border-[#EBE5DA] mb-4">
              <div className="flex items-center gap-2 font-bold text-sm text-[#3E2723]">
                <Bot className="w-4 h-4 text-[#C18C5D]" />
                <span>Gemini 워크스페이스 비서에게 질문하기</span>
              </div>
              <button onClick={() => setIsGeminiSearchOpen(false)} className="p-1 rounded-lg text-[#7A6A5C]">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleExecuteGeminiSearch} className="space-y-3">
              <div className="flex items-center gap-2 bg-[#FDFBF7] border border-[#EBE5DA] rounded-xl px-3 py-2">
                <input
                  type="text"
                  value={geminiSearchQuery}
                  onChange={(e) => setGeminiSearchQuery(e.target.value)}
                  placeholder="예: 지난주 보낸 파일 찾아줘 / 내일 회의 일정 알려줘"
                  className="flex-1 bg-transparent text-xs text-[#2C2520] focus:outline-none"
                  autoFocus
                />
                <button
                  type="submit"
                  disabled={isSearchingGemini || !geminiSearchQuery.trim()}
                  className="px-3 py-1.5 rounded-lg bg-[#3E2723] text-white text-xs font-bold"
                >
                  {isSearchingGemini ? '검색 중...' : '검색'}
                </button>
              </div>

              {geminiSearchResult && (
                <div className="p-3.5 rounded-xl bg-[#FDFBF7] border border-[#C18C5D] text-xs text-[#2C2520] leading-relaxed">
                  <div className="font-bold text-[#3E2723] mb-1 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-[#C18C5D]" />
                    <span>Gemini 비서의 답변:</span>
                  </div>
                  <p>{geminiSearchResult}</p>
                </div>
              )}
            </form>
          </div>
        </div>
      )}

      {/* Forward Message Modal (Slack Feature) */}
      {forwardingMessage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs select-none animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-2xl bg-white border border-[#EBE5DA] p-5 cafe-shadow-lg text-[#2C2520] space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-[#EBE5DA]">
              <div className="flex items-center gap-2">
                <Share2 className="w-4 h-4 text-[#C18C5D]" />
                <h3 className="text-sm font-bold text-[#2C2520]">다른 채널로 메시지 전달</h3>
              </div>
              <button onClick={() => setForwardingMessage(null)} className="p-1 text-[#7A6A5C]">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 rounded-xl bg-[#FDFBF7] border border-[#EBE5DA] text-xs">
              <span className="text-[10px] text-[#A89A8E] block mb-1">전달할 메시지 미리보기:</span>
              <p className="line-clamp-2 text-[#2C2520] italic">"{forwardingMessage.content}"</p>
            </div>

            <div>
              <label className="text-xs font-semibold text-[#5C5046] block mb-1.5">
                전달할 대상 스페이스/채널 선택:
              </label>
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {storage.getSpaces().filter((s) => s.id !== space.id).map((s) => (
                  <button
                    key={s.id}
                    onClick={() => handleConfirmForward(s.id)}
                    className="w-full flex items-center justify-between p-2.5 rounded-xl border border-[#EBE5DA] hover:bg-[#F4EFE6] hover:border-[#C18C5D] text-xs text-left transition-all"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <Hash className="w-3.5 h-3.5 text-[#C18C5D]" />
                      <span className="font-bold text-[#2C2520] truncate">{s.name}</span>
                    </div>
                    <span className="text-[10px] text-[#A89A8E]">전달하기 →</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-2 border-t border-[#EBE5DA] flex justify-end">
              <button
                onClick={() => setForwardingMessage(null)}
                className="px-4 py-1.5 rounded-xl bg-[#F4EFE6] text-xs font-semibold text-[#5C5046]"
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Message translation modal (모든 언어) */}
      <MessageTranslateModal
        open={!!translateTargetMessage}
        messageId={translateTargetMessage?.id || ''}
        originalText={translateTargetMessage?.content || ''}
        onClose={() => setTranslateTargetMessage(null)}
        onTranslated={(state) => {
          setTranslations((prev) => ({ ...prev, [state.messageId]: state }));
          setTranslateTargetMessage(null);
        }}
      />

      {/* Image Lightbox */}
      {lightboxImage && (
        <div
          onClick={() => setLightboxImage(null)}
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-xs"
        >
          <img
            src={lightboxImage.url}
            alt={lightboxImage.name}
            className="max-w-full max-h-[90vh] object-contain rounded-2xl shadow-2xl"
          />
        </div>
      )}
    </div>
  );
};
