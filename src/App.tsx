import React, { useState, useEffect } from 'react';
import { 
  storage, 
  syncChannel,
  broadcastSync,
  DEFAULT_PUBLIC_SPACE,
  DEFAULT_LOCAL_USER
} from './storage';
import { 
  User, 
  Space, 
  Message, 
  TaskItem, 
  FriendRequest, 
  Friendship, 
  Attachment,
  DriveFileType,
  DrivePermission,
  MessageReplyContext
} from './types';
import { GoogleChatSidebar } from './components/GoogleChatSidebar';
import { GoogleChatMain } from './components/GoogleChatMain';
import { ThreadPanel, SideBySideDocEditor, TasksPanel } from './components/RightPanels';
import { SnowFall } from './components/SnowFall';
import { CosmicSky } from './components/CosmicSky';
import { 
  DrivePickerModal, 
  CalendarEventModal, 
  FriendManagementModal, 
  CreateSpaceModal,
  UserProfileModal,
  SpaceSettingsModal
} from './components/GoogleChatModals';
import { MeetRoomModal } from './components/MeetRoomModal';
import { ContactsModal } from './components/ContactsModal';
import { InviteBell, InviteToasts } from './components/InviteCenter';
import { Invite, subscribeInvites, createInvite, respondToInvite } from './services/inviteService';
import { YouTubePlayerProvider } from './components/YouTubePlayerLayer';
import { MeetingRoom, createNewMeetingRoom, joinMeetingRoom } from './services/meetingService';
import {
  Contact,
  loadContacts,
  adoptContactsForOwner,
  upsertContact,
  renameContact,
  removeContact,
  subscribeCloudContacts,
  contactNameOf,
  normalizeEmail,
} from './services/contactsService';
import { SearchModal } from './components/SearchModal';
import { AuthView } from './components/AuthView';
import { GoogleWorkspaceHubModal } from './components/GoogleWorkspaceHubModal';
import { GeminiAIPanel } from './components/GeminiAIPanel';
import { GoogleDriveExplorer } from './components/GoogleDriveExplorer';
import { YouTubeInPageView } from './components/YouTubeInPageView';
import { InAppGmailHub } from './components/InAppGmailHub';
import { GoogleWorkspaceEditor } from './components/GoogleWorkspaceEditor';
import { SettingsModal } from './components/SettingsModal';
import { Mail, FileText, HardDrive, MessageSquare, ChevronRight, Layout, Maximize2, Columns, Table, Presentation, X } from 'lucide-react';
import { notificationService, InAppNotification } from './services/notificationService';
import { grantDrivePermissionsToSpaceMembers } from './services/googleWorkspace';
import { queryGeminiAssistant } from './services/geminiService';
import { 
  observeFirebaseAuth, 
  signInWithGoogleAccount, 
  signOutGoogle, 
  auth, 
  saveCloudChatMessage, 
  deleteCloudChatMessage,
  subscribeToCloudChatMessages,
  saveUserProfileToFirestore,
  subscribeToCloudUsers,
  saveFriendRequestToFirestore,
  updateFriendRequestStatusInFirestore,
  subscribeToFriendRequests,
  isGoogleSignedIn
} from './services/googleWorkspace';
import { isFirebaseConfigured, onSettingsChanged } from './services/appConfig';
import {
  completeRedirectSignIn,
  createRealCalendarEvent,
  describeAuthError,
  getAccessToken,
  getLastAuthErrorCode,
  syncTaskToGoogle,
  updateGoogleTaskStatus,
} from './services/googleWorkspace';
import type { User as FirebaseUser } from 'firebase/auth';
import { avatarSrc, handleAvatarError } from './components/UserAvatar';

/** 사이드바 모션 길이(ms). 열림·닫힘·접힘이 같은 리듬을 쓰도록 한 곳에서 관리합니다. */
const SIDEBAR_MOTION_MS = 420;
/** 가속 후 끝에서 부드럽게 감속하는 애플 스타일 커브. */
const NX_EASE_OUT = 'cubic-bezier(0.22, 1, 0.36, 1)';
const SIDEBAR_TRANSITION = `width ${SIDEBAR_MOTION_MS}ms ${NX_EASE_OUT}, translate ${SIDEBAR_MOTION_MS}ms ${NX_EASE_OUT}, opacity ${Math.round(
  SIDEBAR_MOTION_MS * 0.7,
)}ms ${NX_EASE_OUT}`;
const BACKDROP_TRANSITION = `opacity ${Math.round(SIDEBAR_MOTION_MS * 0.8)}ms ${NX_EASE_OUT}`;

export default function App() {
  return (
    <YouTubePlayerProvider>
      <WorkspaceApp />
    </YouTubePlayerProvider>
  );
}

function WorkspaceApp() {
  // 로그인 게이트 없이 바로 워크스페이스를 사용합니다.
  // - 저장된 로컬 사용자가 있으면 그 사용자로, 없으면 게스트(로컬) 사용자로 시작
  // - 설정에서 Firebase 를 연결하고 구글 로그인을 하면 그 계정으로 전환됩니다.
  const [currentUser, setCurrentUser] = useState<User | null>(() => storage.getCurrentUser());
  const [isGuest, setIsGuest] = useState<boolean>(() => !isGoogleSignedIn());
  // 로그인 게이트를 기다리지 않습니다. 저장된 로컬 사용자(또는 게스트)로 즉시 화면을 렌더하고
  // Firebase 세션 복원·Firestore 동기화는 백그라운드에서 이어집니다.
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');
  const [showGuestBanner, setShowGuestBanner] = useState<boolean>(() => {
    try {
      return localStorage.getItem('workchat_guest_banner_dismissed') !== '1';
    } catch {
      return true;
    }
  });

  // 게스트 안내 배너는 잠시 후 자동으로 사라져 대화 내용을 가리지 않게 합니다.
  useEffect(() => {
    if (!showGuestBanner) return;
    const timer = window.setTimeout(() => setShowGuestBanner(false), 12000);
    return () => window.clearTimeout(timer);
  }, [showGuestBanner]);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [firebaseReady, setFirebaseReady] = useState(() => isFirebaseConfigured());
  const [allUsers, setAllUsers] = useState<User[]>(() => storage.getUsers());
  const [spaces, setSpaces] = useState<Space[]>(() => storage.getSpaces());
  const [messagesMap, setMessagesMap] = useState<Record<string, Message[]>>(() => storage.getMessages());
  const [tasks, setTasks] = useState<TaskItem[]>(() => storage.getTasks());
  const [friendRequests, setFriendRequests] = useState<FriendRequest[]>(() => storage.getFriendRequests());
  const [friendships, setFriendships] = useState<Friendship[]>(() => storage.getFriendships());

  // Active space (defaults to first available space or default public space)
  const [activeSpaceId, setActiveSpaceId] = useState<string>(() => {
    const loaded = storage.getSpaces();
    return loaded[0]?.id || DEFAULT_PUBLIC_SPACE.id;
  });
  const [activeTab, setActiveTab] = useState<'chat' | 'tasks' | 'drive' | 'youtube' | 'gmail'>('chat');
  const [focusMode, setFocusMode] = useState<'chat' | 'work' | 'split'>('chat');

  // Right Side Panel state (Thread, Doc Editor, Tasks, Drive, YouTube)
  const [activeThreadMessage, setActiveThreadMessage] = useState<Message | null>(null);
  const [activeDocEditor, setActiveDocEditor] = useState<{
    fileId: string;
    fileName: string;
    fileType: string;
    initialContent?: string;
  } | null>(null);
  const [isTasksPanelOpen, setIsTasksPanelOpen] = useState(false);
  const [isDriveSplitOpen, setIsDriveSplitOpen] = useState(false);
  const [isYouTubeSplitOpen, setIsYouTubeSplitOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // 네트워크 상태: 오프라인이면 전송 실패를 숨기지 않고 표시합니다.
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine
  );
  useEffect(() => {
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  // Device type detection ('mobile' | 'tablet' | 'desktop')
  const [deviceType, setDeviceType] = useState<'mobile' | 'tablet' | 'desktop'>('desktop');

  // System notifications state
  const [notificationsEnabled, setNotificationsEnabled] = useState(() => notificationService.getIsEnabled());
  const [inAppNotifs, setInAppNotifs] = useState<InAppNotification[]>([]);

  // Modals
  const [isMeetModalOpen, setIsMeetModalOpen] = useState(false);
  const [meetingRoom, setMeetingRoom] = useState<MeetingRoom | null>(null);
  const [isMeetingOpen, setIsMeetingOpen] = useState(false);
  const [meetingBusy, setMeetingBusy] = useState(false);
  const [contacts, setContacts] = useState<Contact[]>(() => loadContacts(storage.getCurrentUser()?.id || 'guest'));
  const [isContactsOpen, setIsContactsOpen] = useState(false);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [inviteToasts, setInviteToasts] = useState<Invite[]>([]);
  const [isDrivePickerOpen, setIsDrivePickerOpen] = useState(false);
  const [isCalendarModalOpen, setIsCalendarModalOpen] = useState(false);
  const [isFriendModalOpen, setIsFriendModalOpen] = useState(false);
  const [isCreateSpaceModalOpen, setIsCreateSpaceModalOpen] = useState(false);
  const [isSpaceSettingsOpen, setIsSpaceSettingsOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [isWorkspaceHubOpen, setIsWorkspaceHubOpen] = useState(false);
  const [isGeminiPanelOpen, setIsGeminiPanelOpen] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  // 닫힐 때도 미끄러져 들어가도록, 닫힘 애니메이션이 끝날 때까지는 DOM 에 남겨둡니다.
  const [isMobileSidebarMounted, setIsMobileSidebarMounted] = useState(false);
  // 열림 상태와 실제 표시 상태를 분리해, DOM 에 처음 붙는 프레임은 '닫힌 위치'로 그린 뒤
  // 다음 프레임에 '열린 위치'로 바꿔야 슬라이드 모션이 끊기지 않고 재생됩니다.
  const [isMobileSidebarVisible, setIsMobileSidebarVisible] = useState(false);
  useEffect(() => {
    if (isMobileSidebarOpen) {
      setIsMobileSidebarMounted(true);
      let second = 0;
      const first = window.requestAnimationFrame(() => {
        second = window.requestAnimationFrame(() => setIsMobileSidebarVisible(true));
      });
      return () => {
        window.cancelAnimationFrame(first);
        window.cancelAnimationFrame(second);
      };
    }
    setIsMobileSidebarVisible(false);
    const timer = window.setTimeout(() => setIsMobileSidebarMounted(false), SIDEBAR_MOTION_MS + 40);
    return () => window.clearTimeout(timer);
  }, [isMobileSidebarOpen]);

  // 연락처: 계정이 바뀌면 그 계정의 연락처를 불러오고, 로그인 상태면 Firestore 와 동기화합니다.
  useEffect(() => {
    const ownerId = currentUser?.id || 'guest';
    // 게스트로 저장한 연락처가 로그인 후 사라지지 않도록 주체가 바뀔 때 옮겨 담습니다.
    setContacts(adoptContactsForOwner(ownerId));
    if (!auth?.currentUser || auth.currentUser.uid !== ownerId) return;
    return subscribeCloudContacts(ownerId, (next) => setContacts(next));
  }, [currentUser?.id]);

  // 친구 요청: 서버에 저장된 요청을 실시간으로 받아와 로컬 목록과 합칩니다.
  useEffect(() => {
    if (!auth?.currentUser || auth.currentUser.uid !== currentUser?.id) return;
    const mergeCloudRequest = (cloud: any) =>
      setFriendRequests((prev) => {
        if (!cloud?.id) return prev;
        const nextStatus =
          cloud.status === 'accepted' || cloud.status === 'rejected' ? cloud.status : 'pending';
        const existing = prev.find((r) => r.id === String(cloud.id));
        let next: FriendRequest[];
        if (!existing) {
          next = [{ ...(cloud as FriendRequest), id: String(cloud.id), status: nextStatus }, ...prev];
        } else if (existing.status !== nextStatus) {
          next = prev.map((r) => (r.id === existing.id ? { ...r, status: nextStatus } : r));
        } else {
          return prev;
        }
        storage.saveFriendRequests(next);
        return next;
      });

    const toUserId = currentUser.id;
    const unsubscribeIncoming = subscribeToFriendRequests(currentUser.id, 'toUserId', (list) => {
      list.forEach(mergeCloudRequest);
    });
    const unsubscribeOutgoing = subscribeToFriendRequests(toUserId, 'fromUserId', (list) => {
      list.forEach(mergeCloudRequest);
    });
    return () => {
      unsubscribeIncoming();
      unsubscribeOutgoing();
    };
  }, [currentUser?.id]);

  // 상대가 요청을 수락하면 보낸 사람 쪽에도 친구 관계가 만들어집니다.
  useEffect(() => {
    if (!currentUser) return;
    const accepted = friendRequests.filter(
      (r) => r.status === 'accepted' && (r.fromUserId === currentUser.id || r.toUserId === currentUser.id)
    );
    if (accepted.length === 0) return;
    const missing = accepted.filter(
      (r) =>
        !friendships.some(
          (f) =>
            (f.user1Id === r.fromUserId && f.user2Id === r.toUserId) ||
            (f.user1Id === r.toUserId && f.user2Id === r.fromUserId)
        )
    );
    if (missing.length === 0) return;
    const next = [
      ...friendships,
      ...missing.map((r) => ({
        id: `friendship_${r.id}`,
        user1Id: r.fromUserId,
        user2Id: r.toUserId,
        createdAt: new Date().toISOString(),
      })),
    ];
    storage.saveFriendships(next);
    setFriendships(next);
  }, [friendRequests, friendships, currentUser]);

  // /remind 명령: 브라우저 알림 리마인더 예약 (새로고침해도 유지)
  const [reminders, setReminders] = useState<Array<{ id: string; text: string; at: number }>>(() => {
    try {
      const raw = localStorage.getItem('workchat_reminders_v1');
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    const now = Date.now();
    const timers = reminders
      .filter((reminder) => reminder.at > now)
      .map((reminder) =>
        window.setTimeout(
          () => {
            notificationService.notify({ title: '⏰ 리마인더', body: reminder.text });
            setReminders((prev) => {
              const next = prev.filter((item) => item.id !== reminder.id);
              try {
                localStorage.setItem('workchat_reminders_v1', JSON.stringify(next));
              } catch {
                /* noop */
              }
              return next;
            });
          },
          Math.min(reminder.at - now, 2 ** 31 - 1)
        )
      );
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [reminders]);

  const handleCreateReminder = (text: string, minutes: number) => {
    const reminder = { id: `rem_${Date.now()}`, text, at: Date.now() + Math.max(1, minutes) * 60_000 };
    const next = [...reminders, reminder];
    setReminders(next);
    try {
      localStorage.setItem('workchat_reminders_v1', JSON.stringify(next));
    } catch {
      /* noop */
    }
  };


  // Device detection listener
  useEffect(() => {
    const checkDevice = () => {
      const w = window.innerWidth;
      if (w < 768) setDeviceType('mobile');
      else if (w < 1024) setDeviceType('tablet');
      else setDeviceType('desktop');
    };
    checkDevice();
    window.addEventListener('resize', checkDevice);
    return () => window.removeEventListener('resize', checkDevice);
  }, []);

  // 리다이렉트 로그인 결과 복원은 첫 화면이 그려진 뒤 백그라운드에서 처리합니다.
  useEffect(() => {
    const idle =
      typeof (window as any).requestIdleCallback === 'function'
        ? (window as any).requestIdleCallback(() => void completeRedirectSignIn(), { timeout: 2500 })
        : window.setTimeout(() => void completeRedirectSignIn(), 900);
    return () => {
      if (typeof (window as any).cancelIdleCallback === 'function') (window as any).cancelIdleCallback(idle);
      window.clearTimeout(idle);
    };
  }, []);

  /** Firebase 사용자 → 앱 프로필 반영 (동기 작업만 수행해 즉시 반영) */
  const applyFirebaseUser = React.useCallback((firebaseUser: FirebaseUser) => {
    const existing = storage.getUsers().find((u) => u.id === firebaseUser.uid);
    const user: User = {
      id: firebaseUser.uid,
      name: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'Google 사용자',
      email: firebaseUser.email || '',
      avatar: firebaseUser.photoURL || existing?.avatar || '',
      status: 'online',
      role: existing?.role || '팀원',
      department: existing?.department || '협업팀',
      googleConnected: true,
    };
    const users = storage.getUsers();
    storage.saveUsers(users.some((u) => u.id === user.id) ? users.map((u) => (u.id === user.id ? { ...u, ...user } : u)) : [...users, user]);
    storage.setCurrentUser(user);
    setAllUsers(storage.getUsers());
    setCurrentUser(user);
    setIsGuest(false);
    // Firestore 프로필 저장은 화면 렌더를 막지 않도록 백그라운드로 보냅니다.
    void saveUserProfileToFirestore(user);
  }, []);

  // Firebase Authentication restores the real Google account on refresh.
  // 저장된 세션이 있으면 onAuthStateChanged 첫 콜백을 기다리지 않고 즉시 복원합니다.
  useEffect(() => {
    const cachedFirebaseUser = auth?.currentUser;
    if (cachedFirebaseUser) {
      applyFirebaseUser(cachedFirebaseUser);
    } else if (!storage.getCurrentUser()) {
      storage.setCurrentUser(DEFAULT_LOCAL_USER);
      setCurrentUser(DEFAULT_LOCAL_USER);
      setIsGuest(true);
    }

    const unsubscribe = observeFirebaseAuth((firebaseUser: FirebaseUser | null) => {
      if (!firebaseUser) {
        const local = storage.getCurrentUser() || DEFAULT_LOCAL_USER;
        if (!storage.getCurrentUser()) storage.setCurrentUser(local);
        setCurrentUser((prev) => prev ?? local);
        setIsGuest(true);
        return;
      }
      applyFirebaseUser(firebaseUser);
    });
    return unsubscribe;
  }, [applyFirebaseUser]);

  // 설정(Firebase/Gemini 키) 변경을 감지합니다.
  useEffect(() => onSettingsChanged(() => {
    setFirebaseReady(isFirebaseConfigured());
  }), []);

  // Synchronize users across all clients and devices worldwide via Firestore
  useEffect(() => {
    if (!currentUser || !auth || auth.currentUser?.uid !== currentUser.id) return;
    return subscribeToCloudUsers((cloudUsers) => {
      if (!cloudUsers || cloudUsers.length === 0) return;
      setAllUsers((prev) => {
        const cloudUserMap = new Map<string, User>();
        cloudUsers.forEach((cu: any) => {
          if (cu?.id) {
            cloudUserMap.set(cu.id, {
              id: cu.id,
              name: cu.name || 'Google 사용자',
              email: cu.email || '',
              avatar: cu.avatar || '',
              status: (cu.status as any) || 'online',
              role: cu.role || '팀원',
              department: cu.department || '협업팀',
              googleConnected: true,
            });
          }
        });
        const mergedUsers = [...prev];
        cloudUserMap.forEach((u, id) => {
          const idx = mergedUsers.findIndex((mu) => mu.id === id);
          if (idx >= 0) {
            mergedUsers[idx] = { ...mergedUsers[idx], ...u };
          } else {
            mergedUsers.push(u);
          }
        });
        storage.saveUsers(mergedUsers);
        return mergedUsers;
      });
    });
  }, [currentUser?.id]);

  const handleGoogleSignIn = async () => {
    setAuthError('');
    setAuthLoading(true);
    try {
      const firebaseUser = await signInWithGoogleAccount();
      // 인증이 끝난 즉시 프로필을 반영해 워크스페이스로 바로 진입합니다.
      if (firebaseUser) applyFirebaseUser(firebaseUser);
    } catch (error: any) {
      console.error('Google sign-in failed:', error);
      const code = String(error?.code || '') || getLastAuthErrorCode();
      const message =
        code.includes('popup-blocked') || code.includes('cancelled-popup-request')
          ? '로그인 창이 차단되어 리다이렉트로 전환합니다. 잠시 후 자동으로 이어집니다.'
          : describeAuthError(code);
      setAuthError(message);
      notificationService.notify({ title: 'Google 로그인', body: message });
    } finally {
      setAuthLoading(false);
    }
  };

  // Realtime cloud chat: messages are shared between signed-in users, not only this browser.
  useEffect(() => {
    if (!currentUser || !auth || auth.currentUser?.uid !== currentUser.id) return;
    return subscribeToCloudChatMessages(activeSpaceId, (cloudMessages) => {
      setMessagesMap((previous) => {
        const localMessages = previous[activeSpaceId] || [];
        const cloudIds = new Set(cloudMessages.map((m: Message) => m.id));
        const localOnly = localMessages.filter((m) => m.senderId === 'system' || (m.senderId === currentUser.id && !cloudIds.has(m.id)));
        const merged: Message[] = [...(cloudMessages as Message[]), ...localOnly].sort((a, b) => {
          const ta = Number((a as any).createdAt || 0);
          const tb = Number((b as any).createdAt || 0);
          return ta - tb;
        });
        const next = { ...previous, [activeSpaceId]: merged };
        storage.saveMessages(next);
        return next;
      });
    }, (error) => {
      console.warn('Cloud chat subscription error:', error.message);
    });
  }, [activeSpaceId, currentUser?.id]);

  // In-app notifications listener
  useEffect(() => {
    const unsubscribe = notificationService.subscribe((notif) => {
      setInAppNotifs((prev) => [notif, ...prev.slice(0, 2)]);
      setTimeout(() => {
        setInAppNotifs((prev) => prev.filter((n) => n.id !== notif.id));
      }, 4000);
    });
    return unsubscribe;
  }, []);

  // Real-time synchronization across browser tabs and windows
  useEffect(() => {
    const handleSync = () => {
      setAllUsers(storage.getUsers());
      setSpaces(storage.getSpaces());
      setMessagesMap(storage.getMessages());
      setTasks(storage.getTasks());
      setFriendRequests(storage.getFriendRequests());
      setFriendships(storage.getFriendships());
    };

    if (syncChannel) {
      syncChannel.onmessage = () => {
        handleSync();
      };
    }

    window.addEventListener('storage', handleSync);
    return () => {
      window.removeEventListener('storage', handleSync);
    };
  }, []);

  // Keyboard shortcut for Cmd+K search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsSearchModalOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Sync active thread message if new replies arrive in realtime
  useEffect(() => {
    if (activeThreadMessage) {
      const currentMsgs = messagesMap[activeSpaceId] || [];
      const updated = currentMsgs.find((m) => m.id === activeThreadMessage.id);
      if (updated) setActiveThreadMessage(updated);
    }
  }, [messagesMap, activeSpaceId]);

  // LOGIN / SIGNUP HANDLERS
  const handleLogin = (user: User) => {
    if (auth?.currentUser && user.id !== auth.currentUser.uid) return;
    storage.setCurrentUser(user);
    setCurrentUser(user);
    
    // Refresh storage data cleanly
    const freshUsers = storage.getUsers();
    setAllUsers(freshUsers);
    const freshSpaces = storage.getSpaces();
    setSpaces(freshSpaces);
    const freshMessages = storage.getMessages();
    setMessagesMap(freshMessages);

    // Reset panel states
    setActiveThreadMessage(null);
    setActiveDocEditor(null);
    setIsTasksPanelOpen(false);
    setIsMobileSidebarOpen(false);

    // Ensure active space exists
    if (!freshSpaces.find((s) => s.id === activeSpaceId)) {
      setActiveSpaceId(freshSpaces[0]?.id || DEFAULT_PUBLIC_SPACE.id);
    }
  };

  const handleSignUp = (newUser: User) => {
    const updatedUsers = [...allUsers, newUser];
    storage.saveUsers(updatedUsers);
    setAllUsers(updatedUsers);

    storage.setCurrentUser(newUser);
    setCurrentUser(newUser);

    // Also ensure the default space has the user registered
    const currentSpaces = storage.getSpaces();
    const updatedSpaces = currentSpaces.map((s) => {
      if (s.id === DEFAULT_PUBLIC_SPACE.id && !s.memberIds.includes(newUser.id)) {
        return { ...s, memberIds: [...s.memberIds, newUser.id] };
      }
      return s;
    });
    storage.saveSpaces(updatedSpaces);
    setSpaces(updatedSpaces);

    setActiveThreadMessage(null);
    setActiveDocEditor(null);
    setIsTasksPanelOpen(false);
    setIsMobileSidebarOpen(false);

    setActiveSpaceId(DEFAULT_PUBLIC_SPACE.id);
  };

  const handleLogout = () => {
    void signOutGoogle();
    // 로그아웃해도 막히지 않고 게스트(로컬) 사용자로 계속 사용할 수 있습니다.
    const guestUser = DEFAULT_LOCAL_USER;
    storage.setCurrentUser(guestUser);
    setCurrentUser(guestUser);
    setIsGuest(true);
    setIsProfileModalOpen(false);
    setActiveThreadMessage(null);
    setActiveDocEditor(null);
    setIsTasksPanelOpen(false);
    setIsMobileSidebarOpen(false);
    setIsWorkspaceHubOpen(false);
  };

  // Keep the selected space valid without placing hooks after the login guard.
  useEffect(() => {
    if (spaces.length > 0 && !spaces.some((space) => space.id === activeSpaceId)) {
      setActiveSpaceId(spaces[0].id);
    }
  }, [spaces, activeSpaceId]);

  // 시작 화면: 저장된 사용자로 즉시 진입하므로 로딩 대기가 없습니다.
  if (!currentUser) {
    return (
      <div className="h-[100dvh] w-full flex flex-col items-center justify-center gap-3 bg-[#FDFBF7] text-[#2C2520]">
        <div className="flex items-end gap-1.5 h-8">
          <span className="w-2 h-4 rounded-full bg-[#8D5B4C] animate-bounce" />
          <span className="w-2 h-7 rounded-full bg-[#3E2723] animate-bounce [animation-delay:120ms]" />
          <span className="w-2 h-5 rounded-full bg-[#C18C5D] animate-bounce [animation-delay:240ms]" />
        </div>
        <p className="text-sm text-[#7A6A5C]">워크스페이스를 불러오는 중입니다…</p>
      </div>
    );
  }

  // Active space resolution (accessible spaces only)
  const accessibleSpaces = spaces.filter(
    (s) =>
      s.id === DEFAULT_PUBLIC_SPACE.id ||
      s.memberIds.includes(currentUser.id)
  );
  const activeSpace =
    accessibleSpaces.find((s) => s.id === activeSpaceId) ||
    accessibleSpaces[0] ||
    DEFAULT_PUBLIC_SPACE;
  const activeSpaceMembers = allUsers.filter(
    (u) =>
      activeSpace.id === DEFAULT_PUBLIC_SPACE.id ||
      activeSpace.memberIds.includes(u.id)
  );

  const activeMessages = messagesMap[activeSpace.id] || [];

  const pendingRequestsCount = friendRequests.filter(
    (r) => r.toUserId === currentUser.id && r.status === 'pending'
  ).length;

  const handleSelectSpace = (id: string) => {
    setActiveSpaceId(id);
    setIsMobileSidebarOpen(false);
    setActiveThreadMessage(null);
    setActiveDocEditor(null);
  };

  const handleToggleStarSpace = (id: string) => {
    const updated = spaces.map((s) => (s.id === id ? { ...s, isStarred: !s.isStarred } : s));
    storage.saveSpaces(updated);
    setSpaces(updated);
  };

  // SEND MESSAGE
  /** 메시지 1건의 전송 상태만 갈아끼웁니다 (localStorage + 화면 상태 동시 반영). */
  const patchMessage = (spaceId: string, messageId: string, patch: Partial<Message>) => {
    const current = storage.getMessages();
    const list = current[spaceId] || [];
    if (!list.some((m) => m.id === messageId)) return;
    const nextMap = {
      ...current,
      [spaceId]: list.map((m) => (m.id === messageId ? { ...m, ...patch } : m)),
    };
    storage.saveMessages(nextMap);
    setMessagesMap(nextMap);
  };

  /** 서버 전송을 다시 시도합니다 (오프라인/전송 실패 메시지). */
  const handleRetryMessage = async (messageId: string) => {
    const target = (storage.getMessages()[activeSpaceId] || []).find((m) => m.id === messageId);
    if (!target) return;
    const online = typeof navigator === 'undefined' ? true : navigator.onLine;
    const signedIn = Boolean(auth?.currentUser && auth.currentUser.uid === currentUser.id);

    if (!online) {
      patchMessage(activeSpaceId, messageId, {
        deliveryStatus: 'failed',
        deliveryError: '아직 오프라인입니다. 연결되면 다시 시도해 주세요.',
      });
      return;
    }

    if (!signedIn) {
      // 게스트 모드는 기기에만 저장됩니다. 연결이 돌아오면 더 보낼 곳이 없으므로 로컬 전송 완료로 정리합니다.
      patchMessage(activeSpaceId, messageId, { deliveryStatus: 'sent', deliveryError: undefined });
      return;
    }

    patchMessage(activeSpaceId, messageId, { deliveryStatus: 'sending', deliveryError: undefined });
    try {
      await saveCloudChatMessage(activeSpaceId, target);
      patchMessage(activeSpaceId, messageId, { deliveryStatus: 'sent', deliveryError: undefined });
    } catch (error) {
      console.error('재전송 실패:', error);
      patchMessage(activeSpaceId, messageId, {
        deliveryStatus: 'failed',
        deliveryError: '서버 전송에 실패했습니다.',
      });
    }
  };

  /** 전송 실패한 메시지를 이 기기에서 버립니다. */
  const handleDiscardMessage = (messageId: string) => {
    const current = storage.getMessages();
    const list = current[activeSpaceId] || [];
    const nextMap = { ...current, [activeSpaceId]: list.filter((m) => m.id !== messageId) };
    storage.saveMessages(nextMap);
    setMessagesMap(nextMap);
  };

  const handleSendMessage = (content: string, attachments?: Attachment[], replyTo?: MessageReplyContext) => {
    const now = new Date();
    const timeStr = `${now.getHours() >= 12 ? '오후' : '오전'} ${(now.getHours() % 12 || 12)
      .toString()
      .padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    const online = typeof navigator === 'undefined' ? true : navigator.onLine;
    const signedIn = Boolean(auth?.currentUser && auth.currentUser.uid === currentUser.id);

    const newMsg: Message = {
      id: `msg_${Date.now()}`,
      spaceId: activeSpaceId,
      senderId: currentUser.id,
      senderName: currentUser.name,
      senderAvatar: currentUser.avatar,
      senderRole: currentUser.role,
      content,
      timestamp: timeStr,
      reactions: [],
      attachments,
      repliesCount: 0,
      replies: [],
      replyTo,
      createdAt: now.getTime(),
      deliveryStatus: online ? (signedIn ? 'sending' : 'sent') : 'failed',
      deliveryError: online ? undefined : '오프라인 상태라 전송되지 않았습니다.',
    };

    const nextMessages = {
      ...messagesMap,
      [activeSpaceId]: [...(messagesMap[activeSpaceId] || []), newMsg],
    };

    storage.saveMessages(nextMessages);
    setMessagesMap(nextMessages);
    if (!online) {
      console.warn('[전송 실패] 오프라인 상태입니다. 연결되면 재전송할 수 있습니다.');
    } else if (signedIn) {
      void saveCloudChatMessage(activeSpaceId, newMsg)
        .then(() => patchMessage(activeSpaceId, newMsg.id, { deliveryStatus: 'sent', deliveryError: undefined }))
        .catch((error) => {
          console.error('Could not send chat message to Firestore:', error);
          patchMessage(activeSpaceId, newMsg.id, {
            deliveryStatus: 'failed',
            deliveryError: '서버 전송에 실패했습니다.',
          });
        });
    }

    // Real Gemini AI Assistant in-chat reply
    if (/@(Gemini|gemini|제미나이|AI|ai)|\/ai\b/i.test(content)) {
      const aiQuery = content.replace(/@(Gemini|gemini|제미나이|AI|ai)|\/ai\b/gi, '').trim() || '안녕하세요! 무엇을 도와드릴까요?';
      setTimeout(async () => {
        const aiAnswer = await queryGeminiAssistant(aiQuery, {
          messages: [...(storage.getMessages()[activeSpaceId] || []), newMsg],
          driveDocs: storage.getDriveDocuments(),
          events: storage.getCalendarEvents(),
          tasks: storage.getTasks(),
        });

        const aiMsg: Message = {
          id: `msg_gemini_${Date.now()}`,
          spaceId: activeSpaceId,
          senderId: 'gemini_ai_bot',
          senderName: 'Gemini 3.7 AI 비서',
          senderAvatar: '',
          senderRole: 'AI 협업 비서',
          content: aiAnswer,
          timestamp: '방금 전',
          reactions: [{ emoji: '✨', count: 1, userIds: ['system'] }],
          repliesCount: 0,
        };

        const currentMap = storage.getMessages();
        const withAiMsgs = {
          ...currentMap,
          [activeSpaceId]: [...(currentMap[activeSpaceId] || []), aiMsg],
        };
        storage.saveMessages(withAiMsgs);
        setMessagesMap(withAiMsgs);
        notificationService.notify({
          title: 'Gemini 3.7 AI 비서 ✨',
          body: aiAnswer.length > 70 ? aiAnswer.substring(0, 70) + '...' : aiAnswer,
        });
      }, 700);
    }
  };

  // THREAD REPLY
  const handleSendThreadReply = (messageId: string, replyContent: string) => {
    const now = new Date();
    const timeStr = `${now.getHours() >= 12 ? '오후' : '오전'} ${(now.getHours() % 12 || 12)
      .toString()
      .padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

    const newReply = {
      id: `reply_${Date.now()}`,
      messageId,
      senderId: currentUser.id,
      senderName: currentUser.name,
      senderAvatar: currentUser.avatar,
      content: replyContent,
      timestamp: timeStr,
    };

    const channelMsgs = messagesMap[activeSpaceId] || [];
    const updatedMsgs = channelMsgs.map((msg) => {
      if (msg.id !== messageId) return msg;
      const currentReplies = msg.replies || [];
      const nextReplies = [...currentReplies, newReply];
      return {
        ...msg,
        replies: nextReplies,
        repliesCount: nextReplies.length,
      };
    });

    const nextMap = {
      ...messagesMap,
      [activeSpaceId]: updatedMsgs,
    };

    storage.saveMessages(nextMap);
    setMessagesMap(nextMap);
  };

  // TOGGLE REACTION
  const handleToggleReaction = (messageId: string, emoji: string) => {
    const channelMsgs = messagesMap[activeSpaceId] || [];
    const updatedMsgs = channelMsgs.map((msg) => {
      if (msg.id !== messageId) return msg;

      const existingReaction = msg.reactions.find((r) => r.emoji === emoji);
      let updatedReactions;

      if (existingReaction) {
        if (existingReaction.userIds.includes(currentUser.id)) {
          const newUserIds = existingReaction.userIds.filter((id) => id !== currentUser.id);
          if (newUserIds.length === 0) {
            updatedReactions = msg.reactions.filter((r) => r.emoji !== emoji);
          } else {
            updatedReactions = msg.reactions.map((r) =>
              r.emoji === emoji ? { ...r, count: r.count - 1, userIds: newUserIds } : r
            );
          }
        } else {
          updatedReactions = msg.reactions.map((r) =>
            r.emoji === emoji
              ? { ...r, count: r.count + 1, userIds: [...r.userIds, currentUser.id] }
              : r
          );
        }
      } else {
        updatedReactions = [
          ...msg.reactions,
          { emoji, count: 1, userIds: [currentUser.id] },
        ];
      }

      return { ...msg, reactions: updatedReactions };
    });

    const nextMap = {
      ...messagesMap,
      [activeSpaceId]: updatedMsgs,
    };

    storage.saveMessages(nextMap);
    setMessagesMap(nextMap);
  };

  const handleToggleStarMessage = (messageId: string) => {
    const channelMsgs = messagesMap[activeSpaceId] || [];
    const updated = channelMsgs.map((msg) =>
      msg.id === messageId ? { ...msg, isStarred: !msg.isStarred } : msg
    );
    const nextMap = { ...messagesMap, [activeSpaceId]: updated };
    storage.saveMessages(nextMap);
    setMessagesMap(nextMap);
  };

  // GOOGLE MEET / HUDDLE — 회의 링크를 현재 채팅방에 자동 전송
  const postMeetingCard = (room: MeetingRoom) => {
    handleSendMessage(`🎥 새 회의가 시작되었습니다: **${room.title}**\n같은 회의에 참여하려면 아래 카드를 눌러 주세요.`, [
      {
        type: 'meet',
        meetingTitle: room.title,
        meetLink: room.link,
        meetCode: room.code,
        hostName: currentUser.name,
        activeParticipantsCount: 1,
      },
    ]);
  };

  const handleShareMeetToChat = (meetingTitle: string, meetLink: string, code: string) => {
    const room = meetingRoom && meetingRoom.link === meetLink
      ? meetingRoom
      : joinMeetingRoom(meetLink, meetingTitle, code);
    postMeetingCard(room);
  };

  /** 새 회의 시작: 매번 고유한 새 회의를 만들고, 링크를 채팅방에 자동으로 올립니다. */
  const handleStartMeeting = async (title?: string) => {
    if (meetingBusy) return;
    setIsMobileSidebarOpen(false);
    setMeetingBusy(true);
    try {
      const room = await createNewMeetingRoom(title || `${activeSpace.name} 회의`, activeSpace.id);
      const updated = spaces.map((s) =>
        s.id === activeSpace.id
          ? {
              ...s,
              activeMeetLink: room.link,
              activeMeetCode: room.code,
              activeMeetTitle: room.title,
              activeMeetProvider: room.provider,
              activeMeetStartedAt: room.createdAt,
              isHuddleActive: true,
            }
          : s
      );
      storage.saveSpaces(updated);
      setSpaces(updated);
      setMeetingRoom(room);
      setIsMeetingOpen(true);
      // 생성 즉시 채팅방 메시지(참여 카드)로 자동 전송
      postMeetingCard(room);
      // 같은 스페이스 멤버에게 회의 초대 알림 전송
      allUsers
        .filter((member) => member.id !== currentUser.id && activeSpace.memberIds.includes(member.id))
        .forEach((member) => {
          createInvite({
            type: 'meeting',
            toUserId: member.id,
            toEmail: member.email,
            fromUserId: currentUser.id,
            fromUserName: currentUser.name,
            fromUserAvatar: currentUser.avatar,
            spaceId: activeSpace.id,
            spaceName: activeSpace.name,
            meetLink: room.link,
            meetTitle: room.title,
            message: '회의가 시작되었습니다. 같은 링크로 입장하세요.',
          });
        });
      notificationService.notify({
        title: '🎥 회의가 시작되었습니다',
        body: `${room.title} · 회의 링크가 #${activeSpace.name} 채팅방에 올라갔습니다.`,
      });
    } finally {
      setMeetingBusy(false);
    }
  };

  /** 이미 올라온 회의 링크로 같은 회의실에 입장 */
  const handleJoinMeeting = (link: string, title?: string, code?: string) => {
    if (!link) return;
    const room = joinMeetingRoom(link, title, code);
    setMeetingRoom(room);
    setIsMeetingOpen(true);
  };

  /** 허들: 진행 중인 방이 있으면 그 방으로, 없으면 새 회의를 만들어 링크를 올립니다. */
  const handleHuddleClick = () => {
    if (activeSpace.activeMeetLink) {
      handleJoinMeeting(activeSpace.activeMeetLink, activeSpace.activeMeetTitle, activeSpace.activeMeetCode);
    } else {
      void handleStartMeeting(`${activeSpace.name} 허들`);
    }
  };

  const handleEndMeeting = () => {
    setIsMeetingOpen(false);
    setMeetingRoom(null);
    const updated = spaces.map((s) =>
      s.id === activeSpace.id
        ? {
            ...s,
            activeMeetLink: undefined,
            activeMeetCode: undefined,
            activeMeetTitle: undefined,
            activeMeetProvider: undefined,
            activeMeetStartedAt: undefined,
            isHuddleActive: false,
          }
        : s
    );
    storage.saveSpaces(updated);
    setSpaces(updated);
  };

  // 초대 수신: 인앱 토스트 + 알림 센터 + (권한 시) 브라우저 알림
  useEffect(() => {
    if (!currentUser) return;
    const unsubscribe = subscribeInvites(
      currentUser.id,
      (list) => setInvites(list),
      (invite) => {
        setInviteToasts((prev) => (prev.some((item) => item.id === invite.id) ? prev : [invite, ...prev].slice(0, 3)));
        const label =
          invite.type === 'meeting' ? '회의 초대' : invite.type === 'space' ? '스페이스 초대' : invite.type === 'dm' ? '1:1 대화 초대' : '연락처 초대';
        notificationService.notify({
          title: `📨 ${label}`,
          body: `${invite.fromUserName}님이 초대했습니다${invite.spaceName ? ` · #${invite.spaceName}` : ''}`,
        });
        window.setTimeout(() => {
          setInviteToasts((prev) => prev.filter((item) => item.id !== invite.id));
        }, 15000);
      }
    );
    return unsubscribe;
  }, [currentUser?.id]);

  const handleAcceptInvite = (invite: Invite) => {
    respondToInvite(invite.id, 'accepted');
    setInviteToasts((prev) => prev.filter((item) => item.id !== invite.id));
    if (invite.type === 'meeting' && invite.meetLink) {
      handleJoinMeeting(invite.meetLink, invite.meetTitle || invite.spaceName, invite.meetLink.split('/').pop());
      return;
    }
    if (invite.spaceId) {
      const updated = spaces.map((s) =>
        s.id === invite.spaceId && !s.memberIds.includes(currentUser.id)
          ? { ...s, memberIds: [...s.memberIds, currentUser.id] }
          : s
      );
      storage.saveSpaces(updated);
      setSpaces(updated);
      setActiveSpaceId(invite.spaceId);
      setFocusMode('chat');
      return;
    }
    notificationService.notify({ title: '초대 수락', body: '초대를 수락했습니다.' });
  };

  const handleDeclineInvite = (invite: Invite) => {
    respondToInvite(invite.id, 'declined');
    setInviteToasts((prev) => prev.filter((item) => item.id !== invite.id));
    setInvites((prev) => prev.filter((item) => item.id !== invite.id));
  };

  // CONTACTS — 이름을 원하는 대로 저장 (중복 등록 방지)
  const handleAddContact = (input: { displayName: string; email?: string; userId?: string; note?: string }) => {
    const ownerId = currentUser.id || 'guest';
    const result = upsertContact(ownerId, input);
    setContacts(loadContacts(ownerId));
    return {
      ok: Boolean(result.contact),
      message: result.reason || `${result.contact?.displayName} 님을 연락처에 저장했습니다.`,
    };
  };

  const handleRenameContact = (contactId: string, displayName: string) => {
    const ownerId = currentUser.id || 'guest';
    renameContact(ownerId, contactId, displayName);
    setContacts(loadContacts(ownerId));
  };

  const handleRemoveContact = (contactId: string) => {
    const ownerId = currentUser.id || 'guest';
    removeContact(ownerId, contactId);
    setContacts(loadContacts(ownerId));
  };

  // GOOGLE DRIVE SHARING (자동 권한 부여 연동)
  const handleShareDriveFile = async (file: {
    fileId: string;
    fileName: string;
    fileType: DriveFileType;
    fileSize: string;
    permission: DrivePermission;
    ownerName: string;
    updatedAt: string;
  }) => {
    // 1. Google Drive API: Automatically grant write/read permissions to all space members
    const memberEmails = activeSpaceMembers.map((m) => m.email).filter(Boolean);
    if (memberEmails.length > 0) {
      grantDrivePermissionsToSpaceMembers(file.fileId, memberEmails);
    }

    handleSendMessage(`Google Drive 파일 **${file.fileName}**을(를) 공유했습니다. (스페이스 참여 멤버 ${activeSpaceMembers.length}명 전원 편집 권한 자동 부여됨)`, [
      {
        type: 'drive',
        ...file,
      },
    ]);
  };

  // 1. PIN & UNPIN MESSAGE (진짜 상단 공지 고정 바)
  const handlePinMessage = (messageId: string, content: string) => {
    const updated = spaces.map((s) =>
      s.id === activeSpaceId ? { ...s, pinnedMessageId: messageId, pinnedMessageText: content } : s
    );
    storage.saveSpaces(updated);
    setSpaces(updated);

    const msgs = messagesMap[activeSpaceId] || [];
    const updatedMsgs = msgs.map((m) => ({
      ...m,
      isPinned: m.id === messageId,
    }));
    const nextMap = { ...messagesMap, [activeSpaceId]: updatedMsgs };
    storage.saveMessages(nextMap);
    setMessagesMap(nextMap);
  };

  const handleUnpinMessage = () => {
    const updated = spaces.map((s) =>
      s.id === activeSpaceId ? { ...s, pinnedMessageId: undefined, pinnedMessageText: undefined } : s
    );
    storage.saveSpaces(updated);
    setSpaces(updated);

    const msgs = messagesMap[activeSpaceId] || [];
    const updatedMsgs = msgs.map((m) => ({ ...m, isPinned: false }));
    const nextMap = { ...messagesMap, [activeSpaceId]: updatedMsgs };
    storage.saveMessages(nextMap);
    setMessagesMap(nextMap);
  };

  // 2. MESSAGE DELETE — 내 메시지는 서버에서 영구 삭제, 남의 메시지는 내 화면에서만 감추기
  const handleDeleteMessageTracedFree = (messageId: string) => {
    const msgs = messagesMap[activeSpaceId] || [];
    const target = msgs.find((m) => m.id === messageId);
    const isMine = !target || target.senderId === currentUser.id;

    if (!isMine) {
      // 상대 메시지: 서버는 그대로 두고, 나에게만 보이지 않게 저장
      storage.hideMessageForUser(currentUser.id, messageId);
      return;
    }

    const nextMsgs = msgs.filter((m) => m.id !== messageId);
    const nextMap = { ...messagesMap, [activeSpaceId]: nextMsgs };
    storage.saveMessages(nextMap);
    setMessagesMap(nextMap);

    // 서버(Firestore)에서도 영구 삭제 — 본인 메시지만 규칙상 허용됨
    if (auth?.currentUser?.uid === currentUser.id && !activeSpaceId.startsWith('notes_')) {
      void deleteCloudChatMessage(activeSpaceId, messageId).catch((error) => {
        console.error('Could not delete chat message from Firestore:', error);
      });
    }

    // If deleted message was pinned, clear pin
    if (activeSpace.pinnedMessageId === messageId) {
      handleUnpinMessage();
    }
    // If deleted message was open in thread panel, close thread
    if (activeThreadMessage?.id === messageId) {
      setActiveThreadMessage(null);
    }
  };

  // 3. 직관적인 '나와 대화하기' (나의 메모장)
  const handleSelectSelfNotes = () => {
    const notesId = `notes_${currentUser.id}`;
    const exists = spaces.find((s) => s.id === notesId);
    if (!exists) {
      const selfNotesSpace: Space = {
        id: notesId,
        name: '나의 메모장',
        type: 'space',
        creatorId: currentUser.id,
        memberIds: [currentUser.id],
        topic: '나만의 프라이빗 메모, 업무 링크, 드라이브 파일 보관소',
        description: '오직 나에게만 보이는 안전한 단독 메모장 공간입니다.',
        isSelfNotes: true,
        isStarred: true,
      };
      const nextSpaces = [...spaces, selfNotesSpace];
      storage.saveSpaces(nextSpaces);
      setSpaces(nextSpaces);

      const welcomeMsg: Message = {
        id: `msg_${Date.now()}`,
        spaceId: notesId,
        senderId: currentUser.id,
        senderName: currentUser.name,
        senderAvatar: currentUser.avatar,
        content: `📝 나의 메모장 (나와 대화하기)에 오신 것을 환영합니다!\n개인적인 아이디어, 나중에 볼 링크, 초안 메모, 드라이브 파일들을 자유롭게 남겨보세요. 다른 사용자에게는 일체 노출되지 않는 프라이빗 공간입니다.`,
        timestamp: '방금 전',
        reactions: [{ emoji: '☕', count: 1, userIds: [currentUser.id] }],
        isSystemMessage: true,
      };
      const nextMsgs = {
        ...messagesMap,
        [notesId]: [welcomeMsg],
      };
      storage.saveMessages(nextMsgs);
      setMessagesMap(nextMsgs);
    }
    setActiveSpaceId(notesId);
  };

  // 4. EDIT MESSAGE (슬랙 메시지 실시간 인라인 수정)
  const handleEditMessage = (messageId: string, newContent: string) => {
    const channelMsgs = messagesMap[activeSpaceId] || [];
    const updated = channelMsgs.map((m) =>
      m.id === messageId
        ? { ...m, content: newContent, isEdited: true, editedAt: '방금 전' }
        : m
    );
    const nextMap = { ...messagesMap, [activeSpaceId]: updated };
    storage.saveMessages(nextMap);
    setMessagesMap(nextMap);
  };

  // 5. INTERACTIVE POLL VOTE (실시간 즉석 투표)
  const handleVotePoll = (messageId: string, optionId: string) => {
    const channelMsgs = messagesMap[activeSpaceId] || [];
    const updated = channelMsgs.map((msg) => {
      if (msg.id !== messageId || !msg.attachments) return msg;

      const updatedAttachments = msg.attachments.map((att) => {
        if (att.type === 'poll') {
          const poll = att as any;
          const updatedOptions = poll.options.map((opt: any) => {
            const hasVoted = opt.voterIds.includes(currentUser.id);
            if (opt.id === optionId) {
              return {
                ...opt,
                voterIds: hasVoted
                  ? opt.voterIds.filter((id: string) => id !== currentUser.id)
                  : [...opt.voterIds, currentUser.id],
              };
            } else {
              // Single choice vote: remove vote from other options
              return {
                ...opt,
                voterIds: opt.voterIds.filter((id: string) => id !== currentUser.id),
              };
            }
          });
          return { ...poll, options: updatedOptions };
        }
        return att;
      });

      return { ...msg, attachments: updatedAttachments };
    });

    const nextMap = { ...messagesMap, [activeSpaceId]: updated };
    storage.saveMessages(nextMap);
    setMessagesMap(nextMap);
  };

  // 6. SPACE CANVAS SCRATCHPAD (스페이스 실시간 공유 캔버스)
  const handleUpdateSpaceCanvas = (spaceId: string, content: string) => {
    const updated = spaces.map((s) => (s.id === spaceId ? { ...s, canvasContent: content } : s));
    storage.saveSpaces(updated);
    setSpaces(updated);
  };

  // GOOGLE CALENDAR SHARING
  const handleSaveCalendarEvent = (event: {
    eventTitle: string;
    dateStr: string;
    timeStr: string;
    location: string;
    attendees: string[];
    meetLink?: string;
  }) => {
    handleSendMessage(`새로운 캘린더 일정이 등록되었습니다: **${event.eventTitle}**`, [
      {
        type: 'calendar',
        ...event,
        rsvps: { [currentUser.id]: 'accepted' },
      },
    ]);

    // Google Calendar 권한이 연결되어 있으면 실제 캘린더에도 일정을 만듭니다.
    const [startTime, endTime] = (event.timeStr || '').split('-').map((part) => part.trim());
    if (startTime && endTime) {
      void (async () => {
        const token = await getAccessToken();
        if (!token) return;
        const attendeeEmails = allUsers
          .filter((user) => event.attendees.includes(user.name) && user.email)
          .map((user) => user.email);
        const result = await createRealCalendarEvent({
          title: event.eventTitle,
          dateStr: event.dateStr,
          startTime,
          endTime,
          location: event.location,
          description: event.meetLink ? `Google Meet: ${event.meetLink}` : undefined,
          attendeeEmails,
        });
        if (result.success) {
          notificationService.notify({ title: 'Google Calendar', body: '일정이 내 캘린더에도 등록되었습니다.' });
        } else if (result.error && result.error !== 'no-token') {
          notificationService.notify({
            title: 'Google Calendar',
            body: '내 캘린더에는 등록하지 못했습니다. Workspace 권한을 다시 연결해 주세요.',
          });
        }
      })();
    }
  };

  const handleRsvpCalendar = (
    messageId: string,
    status: 'accepted' | 'tentative' | 'declined'
  ) => {
    const channelMsgs = messagesMap[activeSpaceId] || [];
    const updated = channelMsgs.map((msg) => {
      if (msg.id !== messageId || !msg.attachments) return msg;
      const updatedAttachments = msg.attachments.map((att) => {
        if (att.type === 'calendar') {
          return {
            ...att,
            rsvps: { ...att.rsvps, [currentUser.id]: status },
          };
        }
        return att;
      });
      return { ...msg, attachments: updatedAttachments };
    });

    const nextMap = { ...messagesMap, [activeSpaceId]: updated };
    storage.saveMessages(nextMap);
    setMessagesMap(nextMap);
  };

  // FRIEND REQUEST FLOW
  const handleSendFriendRequest = (toUser: User, message: string) => {
    const newReq: FriendRequest = {
      id: `freq_${Date.now()}`,
      fromUserId: currentUser.id,
      fromUserName: currentUser.name,
      fromUserAvatar: currentUser.avatar,
      toUserId: toUser.id,
      toUserName: toUser.name,
      status: 'pending',
      message: message.trim() || '친구 요청을 보냅니다 👋',
      timestamp: '방금 전',
    };

    const nextRequests = [
      newReq,
      ...friendRequests.filter(
        (r) => !(r.fromUserId === newReq.fromUserId && r.toUserId === newReq.toUserId && r.status === 'pending')
      ),
    ];
    storage.saveFriendRequests(nextRequests);
    setFriendRequests(nextRequests);
    // 다른 기기/상대 계정에도 저장되도록 서버에도 남깁니다.
    void saveFriendRequestToFirestore(newReq as unknown as Record<string, unknown>);
  };

  const handleAcceptFriendRequest = (request: FriendRequest) => {
    // 1. Update request status
    const updatedRequests = friendRequests.map((r) =>
      r.id === request.id ? { ...r, status: 'accepted' as const } : r
    );
    storage.saveFriendRequests(updatedRequests);
    setFriendRequests(updatedRequests);
    void updateFriendRequestStatusInFirestore(request.id, 'accepted');

    // 2. Add friendship record
    const newFriendship: Friendship = {
      id: `friendship_${Date.now()}`,
      user1Id: request.fromUserId,
      user2Id: request.toUserId,
      createdAt: new Date().toISOString(),
    };
    const updatedFriendships = [...friendships, newFriendship];
    storage.saveFriendships(updatedFriendships);
    setFriendships(updatedFriendships);

    // 3. Create or find 1:1 DM space
    const otherUserId = request.fromUserId;
    const otherUser = allUsers.find((u) => u.id === otherUserId);
    const sortedIds = [currentUser.id, otherUserId].sort();
    const dmId = `dm_${sortedIds[0]}_${sortedIds[1]}`;
    const existingDm = spaces.find((s) => s.id === dmId);

    if (!existingDm) {
      const newDm: Space = {
        id: dmId,
        name: otherUser?.name || '친구 1:1 대화',
        type: 'dm',
        creatorId: currentUser.id,
        memberIds: [currentUser.id, otherUserId],
        dmWithUserId: otherUserId,
        topic: `${otherUser?.name}님과의 1:1 대화방`,
        isStarred: true,
      };

      const nextSpaces = [...spaces, newDm];
      storage.saveSpaces(nextSpaces);
      setSpaces(nextSpaces);

      const welcomeMsg: Message = {
        id: `msg_${Date.now()}`,
        spaceId: dmId,
        senderId: currentUser.id,
        senderName: currentUser.name,
        senderAvatar: currentUser.avatar,
        content: `✨ ${request.fromUserName}님과의 친구 요청이 수락되었습니다! 1:1 대화를 시작해보세요.`,
        timestamp: '방금 전',
        reactions: [{ emoji: '🎉', count: 1, userIds: [currentUser.id] }],
        isSystemMessage: true,
      };

      const nextMsgs = {
        ...messagesMap,
        [dmId]: [welcomeMsg],
      };
      storage.saveMessages(nextMsgs);
      setMessagesMap(nextMsgs);
    }

    if (dmId) setActiveSpaceId(dmId);
  };

  const handleRejectFriendRequest = (request: FriendRequest) => {
    const updatedRequests = friendRequests.map((r) =>
      r.id === request.id ? { ...r, status: 'rejected' as const } : r
    );
    storage.saveFriendRequests(updatedRequests);
    setFriendRequests(updatedRequests);
    void updateFriendRequestStatusInFirestore(request.id, 'rejected');
  };

  const handleStartDmWithFriend = (friendUser: User) => {
    const sortedIds = [currentUser.id, friendUser.id].sort();
    const dmId = `dm_${sortedIds[0]}_${sortedIds[1]}`;
    const existingDm = spaces.find((s) => s.id === dmId);

    if (existingDm) {
      setActiveSpaceId(existingDm.id);
      return;
    }

    const newDm: Space = {
      id: dmId,
      name: friendUser.name,
      type: 'dm',
      creatorId: currentUser.id,
      memberIds: [currentUser.id, friendUser.id],
      dmWithUserId: friendUser.id,
      topic: `${friendUser.name}님과의 1:1 대화방`,
      isStarred: true,
    };

    const nextSpaces = [...spaces, newDm];
    storage.saveSpaces(nextSpaces);
    setSpaces(nextSpaces);

    setActiveSpaceId(dmId);
  };

  // CREATE SPACE
  const handleCreateSpace = (name: string, topic: string, description: string, memberIds: string[]) => {
    const spaceId = `space_${Date.now()}`;
    const newSpace: Space = {
      id: spaceId,
      name,
      type: 'space',
      creatorId: currentUser.id,
      memberIds: Array.from(new Set([currentUser.id, ...memberIds])),
      topic,
      description,
      isStarred: false,
    };

    const nextSpaces = [...spaces, newSpace];
    storage.saveSpaces(nextSpaces);
    setSpaces(nextSpaces);

    // 초대받은 멤버에게 즉시 초대 알림 전송
    memberIds
      .filter((id) => id !== currentUser.id)
      .forEach((id) => {
        const member = allUsers.find((u) => u.id === id);
        if (!member) return;
        createInvite({
          type: 'space',
          toUserId: member.id,
          toEmail: member.email,
          fromUserId: currentUser.id,
          fromUserName: currentUser.name,
          fromUserAvatar: currentUser.avatar,
          spaceId,
          spaceName: name,
          message: `#${name} 스페이스에 초대했습니다.`,
        });
      });

    const welcomeMsg: Message = {
      id: `msg_${Date.now()}`,
      spaceId,
      senderId: currentUser.id,
      senderName: currentUser.name,
      senderAvatar: currentUser.avatar,
      content: `✨ ${currentUser.name}님이 새로운 스페이스 #${name}을(를) 생성했습니다.`,
      timestamp: '방금 전',
      reactions: [],
      isSystemMessage: true,
    };

    const nextMsgs = {
      ...messagesMap,
      [spaceId]: [welcomeMsg],
    };
    storage.saveMessages(nextMsgs);
    setMessagesMap(nextMsgs);

    setActiveSpaceId(spaceId);
  };

  // SPACE SETTINGS & MEMBERS MANAGEMENT
  const handleUpdateSpace = (spaceId: string, updates: Partial<Space>) => {
    const updated = spaces.map((s) => (s.id === spaceId ? { ...s, ...updates } : s));
    storage.saveSpaces(updated);
    setSpaces(updated);
  };

  const handleAddMemberToSpace = (spaceId: string, userId: string) => {
    const targetUser = allUsers.find((u) => u.id === userId);
    if (!targetUser) return;

    const updated = spaces.map((s) => {
      if (s.id === spaceId && !s.memberIds.includes(userId)) {
        return { ...s, memberIds: [...s.memberIds, userId] };
      }
      return s;
    });
    storage.saveSpaces(updated);
    setSpaces(updated);

    const inviteMsg: Message = {
      id: `msg_${Date.now()}`,
      spaceId,
      senderId: currentUser.id,
      senderName: currentUser.name,
      senderAvatar: currentUser.avatar,
      content: `👋 ${currentUser.name}님이 ${targetUser.name}님을 스페이스에 초대했습니다.`,
      timestamp: '방금 전',
      reactions: [],
      isSystemMessage: true,
    };
    const nextMsgs = {
      ...messagesMap,
      [spaceId]: [...(messagesMap[spaceId] || []), inviteMsg],
    };
    storage.saveMessages(nextMsgs);
    setMessagesMap(nextMsgs);
  };

  const handleRemoveMemberFromSpace = (spaceId: string, userId: string) => {
    const targetUser = allUsers.find((u) => u.id === userId);
    const updated = spaces.map((s) => {
      if (s.id === spaceId) {
        return { ...s, memberIds: s.memberIds.filter((id) => id !== userId) };
      }
      return s;
    });
    storage.saveSpaces(updated);
    setSpaces(updated);

    const removeMsg: Message = {
      id: `msg_${Date.now()}`,
      spaceId,
      senderId: currentUser.id,
      senderName: currentUser.name,
      senderAvatar: currentUser.avatar,
      content: `🚪 ${currentUser.name}님이 ${targetUser?.name || '멤버'}님을 스페이스에서 내보냈습니다.`,
      timestamp: '방금 전',
      reactions: [],
      isSystemMessage: true,
    };
    const nextMsgs = {
      ...messagesMap,
      [spaceId]: [...(messagesMap[spaceId] || []), removeMsg],
    };
    storage.saveMessages(nextMsgs);
    setMessagesMap(nextMsgs);

    if (userId === currentUser.id) {
      setActiveSpaceId(DEFAULT_PUBLIC_SPACE.id);
    }
  };

  const handleLeaveSpace = (spaceId: string) => {
    handleRemoveMemberFromSpace(spaceId, currentUser.id);
    setActiveSpaceId(DEFAULT_PUBLIC_SPACE.id);
  };

  const handleDeleteSpace = (spaceId: string) => {
    const updated = spaces.filter((s) => s.id !== spaceId);
    storage.saveSpaces(updated);
    setSpaces(updated);

    const nextMsgs = { ...messagesMap };
    delete nextMsgs[spaceId];
    storage.saveMessages(nextMsgs);
    setMessagesMap(nextMsgs);

    setActiveSpaceId(DEFAULT_PUBLIC_SPACE.id);
  };

  // TASKS MANAGEMENT
  const handleAddTask = (newTaskData: Omit<TaskItem, 'id'>) => {
    const newTask: TaskItem = { ...newTaskData, id: `task_${Date.now()}` };
    const nextTasks = [newTask, ...tasks];
    storage.saveTasks(nextTasks);
    setTasks(nextTasks);

    // Google Workspace 권한이 있으면 Google Tasks 에도 동기화합니다.
    void (async () => {
      const token = await getAccessToken();
      if (!token) return;
      const result = await syncTaskToGoogle({
        title: newTask.title,
        dueDate: newTask.dueDate || undefined,
        notes: `WorkChat · ${newTask.assigneeName}`,
      });
      if (result.success && result.googleTaskId) {
        setTasks((prev) => {
          const synced = prev.map((item) =>
            item.id === newTask.id
              ? { ...item, googleTaskId: result.googleTaskId, syncedToGoogleTasks: true }
              : item
          );
          storage.saveTasks(synced);
          return synced;
        });
      }
    })();
  };

  // /task 명령: 채팅에서 만든 할 일을 목록에 추가 (Google Tasks 연동 시 함께 동기화)
  const handleCreateTaskFromChat = (title: string) => {
    if (!currentUser) return;
    const task: Omit<TaskItem, 'id'> = {
      spaceId: activeSpaceId,
      title,
      assigneeId: currentUser.id,
      assigneeName: currentUser.name,
      assigneeAvatar: currentUser.avatar || '',
      dueDate: '',
      completed: false,
      priority: 'medium',
    };
    handleAddTask(task);
  };

  const handleToggleTask = (taskId: string) => {
    const nextTasks = tasks.map((t) => (t.id === taskId ? { ...t, completed: !t.completed } : t));
    storage.saveTasks(nextTasks);
    setTasks(nextTasks);

    const changed = nextTasks.find((task) => task.id === taskId);
    if (changed?.googleTaskId) {
      void updateGoogleTaskStatus(changed.googleTaskId, changed.completed);
    }
  };

  const handleDeleteTask = (taskId: string) => {
    const nextTasks = tasks.filter((t) => t.id !== taskId);
    storage.saveTasks(nextTasks);
    setTasks(nextTasks);
  };

  // Open Doc Editor and switch to work focus
  const handleOpenDocEditor = (fileId: string, fileName: string, fileType: string, initialContent?: string) => {
    const actualId = fileId && fileId !== 'doc_new' ? fileId : `doc_${Date.now()}`;
    let contentToLoad = initialContent;
    if (contentToLoad === undefined) {
      const localDoc = storage.getDriveDocuments().find((d) => d.id === actualId);
      if (localDoc && localDoc.content !== undefined) {
        contentToLoad = localDoc.content;
      }
    }
    setActiveDocEditor({ fileId: actualId, fileName, fileType, initialContent: contentToLoad });
    setIsMobileSidebarOpen(false);
    setActiveThreadMessage(null);
    setIsTasksPanelOpen(false);
    setIsGeminiPanelOpen(false);
    setIsDriveSplitOpen(false);
    setIsYouTubeSplitOpen(false);
    setIsSidebarCollapsed(true);
    setFocusMode('work');
  };

  // Open In-App Gmail and switch to work focus
  const handleOpenGmail = () => {
    setActiveTab('gmail');
    setIsMobileSidebarOpen(false);
    setActiveDocEditor(null);
    setActiveThreadMessage(null);
    setIsTasksPanelOpen(false);
    setIsGeminiPanelOpen(false);
    setIsDriveSplitOpen(false);
    setIsYouTubeSplitOpen(false);
    setIsSidebarCollapsed(true);
    setFocusMode('work');
  };

  // Toggle Gemini AI and automatically collapse left sidebar
  const handleToggleGeminiPanel = (prefilledQuery?: string) => {
    if (isGeminiPanelOpen) {
      setIsGeminiPanelOpen(false);
    } else {
      setIsGeminiPanelOpen(true);
      setActiveDocEditor(null);
      setActiveThreadMessage(null);
      setIsTasksPanelOpen(false);
      setIsDriveSplitOpen(false);
      setIsYouTubeSplitOpen(false);
      setIsSidebarCollapsed(true);
    }
  };

  // Open Google Drive split view and switch to work focus
  const handleOpenDriveSplit = () => {
    setActiveTab('drive');
    setIsMobileSidebarOpen(false);
    setActiveDocEditor(null);
    setActiveThreadMessage(null);
    setIsTasksPanelOpen(false);
    setIsGeminiPanelOpen(false);
    setIsYouTubeSplitOpen(false);
    setIsSidebarCollapsed(true);
    setFocusMode('work');
  };

  // Open YouTube in-page media center split view
  const handleOpenYouTubeSplit = () => {
    setActiveTab('youtube');
    setIsMobileSidebarOpen(false);
    setActiveDocEditor(null);
    setActiveThreadMessage(null);
    setIsTasksPanelOpen(false);
    setIsGeminiPanelOpen(false);
    setIsDriveSplitOpen(false);
    setIsSidebarCollapsed(true);
    setFocusMode('work');
  };

  const handleToggleRightPanel = () => {
    if (activeThreadMessage || activeDocEditor || isTasksPanelOpen || isDriveSplitOpen || isYouTubeSplitOpen || isGeminiPanelOpen) {
      setActiveThreadMessage(null);
      setActiveDocEditor(null);
      setIsTasksPanelOpen(false);
      setIsDriveSplitOpen(false);
      setIsYouTubeSplitOpen(false);
      setIsGeminiPanelOpen(false);
    } else {
      setIsTasksPanelOpen(true);
      setIsSidebarCollapsed(true);
    }
  };

  const handleToggleNotifications = async () => {
    if (!notificationsEnabled) {
      await notificationService.requestPermission();
      notificationService.setIsEnabled(true);
      setNotificationsEnabled(true);
      notificationService.notify({
        title: '워크챗 실시간 시스템 알림 켜짐 🔔',
        body: '기기(노트북, 태블릿, 스마트폰)에서 새 메시지 수신 시 알림이 뜹니다.',
      });
    } else {
      notificationService.setIsEnabled(false);
      setNotificationsEnabled(false);
    }
  };

  const latestMessage = activeMessages.length > 0 ? activeMessages[activeMessages.length - 1] : null;
  const hasActiveWork = Boolean(activeDocEditor || activeTab === 'gmail' || activeTab === 'drive' || activeTab === 'tasks');
  const activeWorkName = activeDocEditor
    ? `문서: ${activeDocEditor.fileName}`
    : activeTab === 'gmail'
    ? 'Gmail 수신함'
    : activeTab === 'drive'
    ? '내 구글 드라이브'
    : activeTab === 'tasks'
    ? '스페이스 할 일'
    : '작업 창';

  const renderSegmentedLayoutControl = () => (
    <div className="inline-flex items-center p-0.5 rounded-xl bg-[#EBE5DA]/80 border border-[#DDD5C7] text-xs font-semibold backdrop-blur-sm shadow-2xs">
      <button
        onClick={() => setFocusMode('chat')}
        className={`px-2.5 py-1 rounded-lg transition-all duration-200 cursor-pointer flex items-center gap-1.5 ${
          focusMode === 'chat'
            ? 'bg-white text-[#2C2520] shadow-xs font-bold'
            : 'text-[#7A6A5C] hover:text-[#2C2520]'
        }`}
        title="대화창 전체화면"
      >
        <MessageSquare className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">대화</span>
      </button>
      <button
        onClick={() => setFocusMode('split')}
        className={`px-2.5 py-1 rounded-lg transition-all duration-200 cursor-pointer flex items-center gap-1.5 ${
          focusMode === 'split'
            ? 'bg-white text-[#2C2520] shadow-xs font-bold'
            : 'text-[#7A6A5C] hover:text-[#2C2520]'
        }`}
        title="50:50 분할 보기"
      >
        <Columns className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">분할</span>
      </button>
      <button
        onClick={() => setFocusMode('work')}
        className={`px-2.5 py-1 rounded-lg transition-all duration-200 cursor-pointer flex items-center gap-1.5 ${
          focusMode === 'work'
            ? 'bg-white text-[#2C2520] shadow-xs font-bold'
            : 'text-[#7A6A5C] hover:text-[#2C2520]'
        }`}
        title="작업실 전체화면"
      >
        <FileText className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">작업실</span>
      </button>
    </div>
  );

  const renderChatMain = () => (
    <GoogleChatMain
      space={activeSpace}
      messages={activeMessages}
      currentUser={currentUser}
      allUsers={allUsers}
      activeTab={activeTab === 'tasks' ? 'tasks' : 'chat'}
      onTabChange={setActiveTab}
      onSendMessage={handleSendMessage}
      isOnline={isOnline}
      onRetryMessage={handleRetryMessage}
      onDiscardMessage={handleDiscardMessage}
      onOpenThread={(msg) => {
        setActiveThreadMessage(msg);
        setActiveDocEditor(null);
        setIsTasksPanelOpen(false);
        setIsSidebarCollapsed(true);
      }}
      onToggleReaction={handleToggleReaction}
      onToggleStarSpace={handleToggleStarSpace}
      onToggleStarMessage={handleToggleStarMessage}
      onOpenMeetModal={() => void handleStartMeeting()}
      onOpenCalendarModal={() => setIsCalendarModalOpen(true)}
      onOpenDrivePicker={() => setIsDrivePickerOpen(true)}
      onOpenDocEditor={handleOpenDocEditor}
      onOpenMeetRoom={(link, title) => handleJoinMeeting(link, title)}
      onRsvpCalendar={handleRsvpCalendar}
      onOpenSpaceSettings={() => setIsSpaceSettingsOpen(true)}
      onToggleRightPanel={handleToggleRightPanel}
      onToggleMobileSidebar={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
      onPinMessage={handlePinMessage}
      onUnpinMessage={handleUnpinMessage}
      onDeleteMessageTracedFree={handleDeleteMessageTracedFree}
      onEditMessage={handleEditMessage}
      onVotePoll={handleVotePoll}
      onUpdateSpaceCanvas={handleUpdateSpaceCanvas}
      onOpenWorkspaceHub={() => setIsWorkspaceHubOpen(true)}
      onLogout={handleLogout}
      onOpenSettings={() => setIsSettingsOpen(true)}
      isGeminiPanelOpen={isGeminiPanelOpen}
      onToggleGeminiPanel={handleToggleGeminiPanel}
      isSidebarCollapsed={isSidebarCollapsed}
      onToggleCollapseSidebar={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
      deviceType={deviceType}
      notificationsEnabled={notificationsEnabled}
      onToggleNotifications={handleToggleNotifications}
      onOpenDriveView={handleOpenDriveSplit}
      onOpenYouTubeView={handleOpenYouTubeSplit}
      onCreateTask={handleCreateTaskFromChat}
      onCreateReminder={handleCreateReminder}
      contacts={contacts}
      onOpenContacts={() => setIsContactsOpen(true)}
      onOpenHuddle={handleHuddleClick}
      invites={invites}
      onAcceptInvite={handleAcceptInvite}
      onDeclineInvite={handleDeclineInvite}
    />
  );

  const renderWorkContent = () => {
    if (activeDocEditor) {
      return (
        <GoogleWorkspaceEditor
          key={activeDocEditor.fileId}
          fileId={activeDocEditor.fileId}
          fileName={activeDocEditor.fileName}
          fileType={activeDocEditor.fileType}
          currentUser={currentUser}
          initialContent={activeDocEditor.initialContent}
          onSave={(fid, content, title) => {
            const savedTitle = title || activeDocEditor.fileName;
            storage.updateDriveDocument(fid, { 
              content, 
              title: savedTitle,
              type: (activeDocEditor.fileType as any) || 'doc'
            });
          }}
          onClose={() => {
            setActiveDocEditor(null);
            setActiveTab('chat');
            setFocusMode('chat');
            setIsSidebarCollapsed(false);
          }}
          onShareToChat={(content) => handleSendMessage(content)}
        />
      );
    }

    if (activeTab === 'gmail') {
      return (
        <InAppGmailHub
          currentUser={currentUser}
          onClose={() => {
            setActiveTab('chat');
            setFocusMode('chat');
          }}
          onShareToChat={(content: string) => {
            handleSendMessage(content);
          }}
        />
      );
    }

    if (activeTab === 'drive') {
      return (
        <GoogleDriveExplorer
          currentUser={currentUser}
          onOpenDocEditor={handleOpenDocEditor}
          onShareDocToChat={(doc) => {
            handleShareDriveFile({
              fileId: doc.id,
              fileName: doc.title,
              fileType: doc.type,
              fileSize: doc.size,
              permission: doc.permission,
              ownerName: doc.ownerName,
              updatedAt: doc.updatedAt,
            });
          }}
          onBackToChat={() => {
            setActiveTab('chat');
            setFocusMode('chat');
          }}
        />
      );
    }

    if (activeTab === 'youtube') {
      return (
        <YouTubeInPageView
          onShareToChat={(videoUrl, title, videoId) => {
            handleSendMessage(`🎬 YouTube 공유: ${title}\n${videoUrl}`, [
              { type: 'youtube', videoId, url: videoUrl, title },
            ]);
            setActiveTab('chat');
            setFocusMode('chat');
          }}
          onBackToChat={() => {
            setActiveTab('chat');
            setFocusMode('chat');
          }}
        />
      );
    }

    return (
      <div className="flex-1 flex flex-col h-full bg-[#FDFBF7] overflow-hidden">
        <header className="h-14 px-4 border-b border-[#EBE5DA] bg-[#FDFBF7] flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-xs text-[#2C2520]">
            <span>#{activeSpace.name} 할 일 및 캘린더 대시보드</span>
          </div>
          <button
            onClick={() => {
              setActiveTab('chat');
              setFocusMode('chat');
            }}
            className="px-3 py-1 rounded-xl bg-[#F4EFE6] hover:bg-[#EBE5DA] text-xs font-semibold text-[#3E2723] cursor-pointer"
          >
            대화로 돌아가기
          </button>
        </header>
        <div className="flex-1 overflow-hidden">
          <TasksPanel
            tasks={tasks}
            teamMembers={allUsers}
            spaceId={activeSpaceId}
            onAddTask={handleAddTask}
            onToggleTask={handleToggleTask}
            onDeleteTask={handleDeleteTask}
            onClose={() => {
              setIsTasksPanelOpen(false);
              setActiveTab('chat');
              setFocusMode('chat');
            }}
          />
        </div>
      </div>
    );
  };

  return (
    <div className="nx-app-bg flex h-[100dvh] w-full max-w-full overflow-hidden bg-[#FDFBF7] text-[#2C2520] font-sans antialiased selection:bg-[#E6DCD0] selection:text-[#3E2723] relative">
      {/* 겨울 감성 · 크리스마스 테마의 눈 내리는 모션 (클릭 방해 없음) */}
      <SnowFall />
      {/* 우주 · 오로라 테마의 배경 모션 (유성우·오로라) */}
      <CosmicSky />
      {/* Real Floating Notification Toasts (Works on Tablet, Phone, Laptop) */}
      <div className="fixed top-3 right-3 z-50 flex flex-col gap-2 max-w-sm pointer-events-none">
        {inAppNotifs.map((notif) => (
          <div
            key={notif.id}
            className="pointer-events-auto p-3 bg-white/95 backdrop-blur-md border border-[#EBE5DA] rounded-2xl cafe-shadow-lg flex items-center gap-2.5 animate-in slide-in-from-top-2 duration-200"
          >
            {notif.icon ? (
              <img src={notif.icon} alt="" className="w-8 h-8 rounded-xl object-cover border border-[#EBE5DA] shrink-0" />
            ) : (
              <div className="w-8 h-8 rounded-xl bg-[#3E2723] text-white flex items-center justify-center text-xs shrink-0 font-bold">
                💬
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="text-xs font-bold text-[#2C2520] truncate">{notif.title}</div>
              <div className="text-[11px] text-[#7A6A5C] truncate">{notif.body}</div>
            </div>
          </div>
        ))}
      </div>

      {/* 초대 도착 알림 (인앱 토스트) */}
      <InviteToasts
        invites={inviteToasts}
        onAccept={handleAcceptInvite}
        onDecline={handleDeclineInvite}
        onDismiss={(invite) => setInviteToasts((prev) => prev.filter((item) => item.id !== invite.id))}
      />

      {/* Google 로그인 오류 / 게스트 안내 배너 (화면 상단 고정) */}
      <div className="nx-guest-banner fixed bottom-[7.75rem] sm:bottom-28 left-0 right-0 z-[60] flex flex-col items-center gap-2 px-2 pointer-events-none">
        {authError && (
          <div className="pointer-events-auto w-full max-w-md px-4 py-2.5 rounded-xl bg-[#FEF2F2] border border-[#FCA5A5] text-[#991B1B] text-xs font-semibold flex items-start gap-2 shadow-lg nx-fade-in">
            <span className="flex-1 leading-relaxed">{authError}</span>
            <button
              type="button"
              onClick={() => setAuthError('')}
              className="text-[#991B1B] hover:text-[#7F1D1D] font-bold cursor-pointer"
              aria-label="오류 안내 닫기"
            >
              ✕
            </button>
          </div>
        )}
        {isGuest && !authError && showGuestBanner && !isMobileSidebarOpen && (
          <div className="pointer-events-auto w-full max-w-md px-3 py-2 rounded-xl bg-white/95 border border-[#EBE5DA] text-[11px] text-[#5C5046] flex items-center gap-2 shadow-md nx-fade-in">
            <span className="flex-1 leading-relaxed">
              <strong className="text-[#2C2520]">게스트 모드</strong> — Google로 로그인하면 대화·할 일·문서가 내 계정에 안전하게 동기화됩니다.
            </span>
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={authLoading}
              className="px-2.5 py-1.5 rounded-lg bg-[#3E2723] hover:bg-[#2C2520] text-white text-[11px] font-bold cursor-pointer disabled:opacity-60 flex-shrink-0"
            >
              {authLoading ? '로그인 중…' : 'Google로 로그인'}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowGuestBanner(false);
                try {
                  localStorage.setItem('workchat_guest_banner_dismissed', '1');
                } catch {
                  /* noop */
                }
              }}
              className="text-[#A89A8E] hover:text-[#5C5046] font-bold cursor-pointer flex-shrink-0"
              aria-label="안내 닫기"
            >
              ✕
            </button>
          </div>
        )}
      </div>

      {/* 1. Left Sidebar (Google Chat in Cafe Beige theme) - Collapsible on demand */}
      <div
        className={`fixed inset-y-0 left-0 z-50 flex w-[86vw] max-w-[320px] md:static md:z-auto md:max-w-none md:overflow-hidden ${
          isMobileSidebarVisible
            ? 'translate-x-0 opacity-100 shadow-2xl md:shadow-none'
            : '-translate-x-full opacity-0 pointer-events-none md:translate-x-0 md:opacity-100'
        } ${
          isSidebarCollapsed
            ? 'md:w-0 md:pointer-events-none'
            : 'md:w-72 md:pointer-events-auto'
        }`}
        style={{ transition: SIDEBAR_TRANSITION, willChange: 'width, translate, opacity' }}
        aria-hidden={deviceType === 'mobile' ? !isMobileSidebarVisible : isSidebarCollapsed}
      >
        <div
          className={`w-72 flex-shrink-0 h-full flex transition-opacity duration-300 ${
            isSidebarCollapsed ? 'md:opacity-0 md:pointer-events-none' : 'md:opacity-100'
          }`}
          aria-hidden={isSidebarCollapsed || undefined}
        >
        <GoogleChatSidebar
          currentUser={currentUser}
          spaces={spaces}
          activeSpaceId={activeSpaceId}
          onSelectSpace={(spaceId) => {
            handleSelectSpace(spaceId);
            setIsMobileSidebarOpen(false);
          }}
          pendingRequestsCount={pendingRequestsCount}
          onOpenFriendModal={() => {
            setIsFriendModalOpen(true);
            setIsMobileSidebarOpen(false);
          }}
          onOpenCreateSpaceModal={() => {
            setIsCreateSpaceModalOpen(true);
            setIsMobileSidebarOpen(false);
          }}
          onOpenProfileModal={() => setIsProfileModalOpen(true)}
          onOpenSearchModal={() => {
            setIsSearchModalOpen(true);
            setIsMobileSidebarOpen(false);
          }}
          onSelectSelfNotes={() => {
            handleSelectSelfNotes();
            setIsMobileSidebarOpen(false);
          }}
          allUsers={allUsers}
          onOpenWorkspaceHub={() => {
            setIsWorkspaceHubOpen(true);
            setIsMobileSidebarOpen(false);
          }}
          onOpenGmail={handleOpenGmail}
          onOpenDrive={handleOpenDriveSplit}
          onLogout={handleLogout}
          onSwitchUser={handleLogin}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onGoogleSignIn={handleGoogleSignIn}
          authLoading={authLoading}
          onToggleCollapse={() => setIsSidebarCollapsed(true)}
          contacts={contacts}
          onOpenContacts={() => {
            setIsContactsOpen(true);
            setIsMobileSidebarOpen(false);
          }}
        />
        </div>
      </div>

      {/* Backdrop for mobile drawer */}
      {isMobileSidebarMounted && (
        <div
          onClick={() => setIsMobileSidebarOpen(false)}
          aria-hidden
          className={`md:hidden fixed inset-0 bg-black/40 backdrop-blur-xs z-30 ${isMobileSidebarVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
          style={{ transition: BACKDROP_TRANSITION }}
        />
      )}

      {/* 2. Main Viewport - Apple-style Focus Modes */}
      {/* 2.1 Full Chat Mode */}
      {focusMode === 'chat' && (
        <main className="nx-view-enter flex-1 flex flex-col h-full overflow-hidden min-w-0">
          {/* Top minimal status bar if work item is active */}
          {hasActiveWork && (
            <div className="h-9 px-4 bg-[#FAF7F0] border-b border-[#EBE5DA] flex items-center justify-between text-xs shrink-0 select-none">
              <div className="flex items-center gap-2 truncate">
                <span className="w-2 h-2 rounded-full bg-[#1A73E8] animate-pulse" />
                <span className="font-bold text-[#3E2723] truncate">{activeWorkName}</span>
                <span className="hidden sm:inline text-[#7A6A5C] text-[11px]">작업창이 열려 있습니다</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {renderSegmentedLayoutControl()}
              </div>
            </div>
          )}

          <div className="flex-1 min-h-0 overflow-hidden">
            {/* 진행 중인 회의 배너: 같은 채팅방 사람들이 같은 회의로 입장 */}
            {activeSpace.activeMeetLink && (
              <div className="px-3 py-1.5 bg-[#14532D] text-white flex items-center gap-2 text-[11px] shrink-0">
                <span className="w-2 h-2 rounded-full bg-[#4ADE80] animate-pulse shrink-0" />
                <span className="font-bold truncate">
                  회의 진행 중 · {activeSpace.activeMeetTitle || '회의'}
                </span>
                <span className="hidden sm:inline text-white/60 truncate flex-1">
                  {activeSpace.activeMeetProvider === 'google' ? 'Google Meet' : '즉시 회의실'} · 모두 같은 링크로 입장합니다
                </span>
                <button
                  onClick={() => handleJoinMeeting(activeSpace.activeMeetLink!, activeSpace.activeMeetTitle, activeSpace.activeMeetCode)}
                  className="ml-auto px-2.5 py-1 rounded-lg bg-[#22C55E] hover:bg-[#16A34A] text-[10.5px] font-bold shrink-0"
                >
                  회의 참여
                </button>
                <button
                  onClick={() => void handleStartMeeting()}
                  className="px-2 py-1 rounded-lg bg-white/15 hover:bg-white/25 text-[10.5px] font-semibold shrink-0"
                  title="완전히 새로운 회의를 만듭니다"
                >
                  새 회의
                </button>
                <button
                  onClick={handleEndMeeting}
                  className="px-2 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-[10.5px] font-semibold shrink-0"
                >
                  종료
                </button>
              </div>
            )}
            {renderChatMain()}
          </div>
        </main>
      )}

      {/* 2.2 Split Dual Mode (50:50) */}
      {focusMode === 'split' && (
        <main className="nx-view-enter flex-1 flex flex-col md:flex-row h-full overflow-hidden min-w-0">
          {/* Left: Chat Pane (50%) */}
          <div className="w-full md:w-1/2 h-full flex flex-col border-r border-[#EBE5DA] overflow-hidden min-w-0 relative">
            {/* Apple macOS style Pane Header */}
            <div className="h-9 px-3.5 bg-[#FAF7F0] border-b border-[#EBE5DA] flex items-center justify-between text-xs shrink-0 select-none">
              <div className="flex items-center gap-2 font-bold text-[#3E2723]">
                <MessageSquare className="w-3.5 h-3.5 text-[#8D5B4C]" />
                <span>대화방</span>
              </div>
              <button
                onClick={() => setFocusMode('chat')}
                className="flex items-center gap-1 text-[11px] font-semibold text-[#7A6A5C] hover:text-[#2C2520] px-2 py-0.5 rounded-lg hover:bg-[#EAE4D9] transition-colors cursor-pointer"
                title="대화창 전체화면"
              >
                <span>전체화면</span>
                <Maximize2 className="w-3 h-3" />
              </button>
            </div>
            <div className="flex-1 min-h-0 overflow-hidden">
              {renderChatMain()}
            </div>
          </div>

          {/* Right: Work Pane (50%) */}
          <div className="w-full md:w-1/2 h-full flex flex-col overflow-hidden min-w-0 relative bg-[#FDFBF7]">
            {/* Apple macOS style Pane Header */}
            <div className="h-9 px-3.5 bg-[#FAF7F0] border-b border-[#EBE5DA] flex items-center justify-between text-xs shrink-0 select-none">
              <div className="flex items-center gap-2 font-bold text-[#3E2723] truncate">
                <FileText className="w-3.5 h-3.5 text-[#1A73E8]" />
                <span className="truncate">{activeWorkName}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {renderSegmentedLayoutControl()}
                <button
                  onClick={() => setFocusMode('work')}
                  className="flex items-center gap-1 text-[11px] font-semibold text-[#7A6A5C] hover:text-[#2C2520] px-2 py-0.5 rounded-lg hover:bg-[#EAE4D9] transition-colors cursor-pointer"
                  title="작업실 전체화면"
                >
                  <Maximize2 className="w-3 h-3" />
                </button>
              </div>
            </div>

            {/* Quick switcher inside work header */}
            <div className="h-9 px-3 bg-[#F4EFE6]/50 border-b border-[#EBE5DA] flex items-center justify-between shrink-0 select-none text-xs">
              <div className="flex items-center gap-1.5 truncate">
                <button
                  onClick={() => {
                    if (!activeDocEditor || activeDocEditor.fileType !== 'doc') {
                      handleOpenDocEditor(`doc_${Date.now()}`, '새 문서.gdoc', 'doc');
                    }
                  }}
                  className={`px-2 py-0.5 rounded-md text-[11px] font-bold cursor-pointer transition-colors ${
                    activeDocEditor && activeDocEditor.fileType === 'doc'
                      ? 'bg-white text-[#1A73E8] shadow-xs'
                      : 'text-[#7A6A5C] hover:text-[#2C2520]'
                  }`}
                >
                  📄 독스
                </button>
                <button
                  onClick={() => {
                    if (!activeDocEditor || activeDocEditor.fileType !== 'sheet') {
                      handleOpenDocEditor(`sheet_${Date.now()}`, '새 스프레드시트.gsheet', 'sheet');
                    }
                  }}
                  className={`px-2 py-0.5 rounded-md text-[11px] font-bold cursor-pointer transition-colors ${
                    activeDocEditor && activeDocEditor.fileType === 'sheet'
                      ? 'bg-white text-[#0F9D58] shadow-xs'
                      : 'text-[#7A6A5C] hover:text-[#0F9D58]'
                  }`}
                >
                  📊 시트
                </button>
                <button
                  onClick={() => {
                    if (!activeDocEditor || activeDocEditor.fileType !== 'slide') {
                      handleOpenDocEditor(`slide_${Date.now()}`, '새 프레젠테이션.gslides', 'slide');
                    }
                  }}
                  className={`px-2 py-0.5 rounded-md text-[11px] font-bold cursor-pointer transition-colors ${
                    activeDocEditor && activeDocEditor.fileType === 'slide'
                      ? 'bg-white text-[#F4B400] shadow-xs'
                      : 'text-[#7A6A5C] hover:text-[#F4B400]'
                  }`}
                >
                  🎯 슬라이드
                </button>
                <button
                  onClick={handleOpenGmail}
                  className={`px-2 py-0.5 rounded-md text-[11px] font-bold cursor-pointer transition-colors ${
                    activeTab === 'gmail' && !activeDocEditor ? 'bg-white text-[#EA4335] shadow-xs' : 'text-[#7A6A5C] hover:text-[#2C2520]'
                  }`}
                >
                  ✉️ Gmail
                </button>
                <button
                  onClick={handleOpenDriveSplit}
                  className={`px-2 py-0.5 rounded-md text-[11px] font-bold cursor-pointer transition-colors ${
                    activeTab === 'drive' && !activeDocEditor ? 'bg-white text-[#15803D] shadow-xs' : 'text-[#7A6A5C] hover:text-[#2C2520]'
                  }`}
                >
                  📁 드라이브
                </button>
              </div>
              <button
                onClick={() => {
                  setActiveDocEditor(null);
                  setActiveTab('chat');
                  setFocusMode('chat');
                }}
                className="text-[11px] text-[#A89A8E] hover:text-[#E53E3E] font-medium px-2 py-0.5 rounded-md hover:bg-red-50 transition-colors cursor-pointer"
              >
                닫기
              </button>
            </div>

            <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
              {renderWorkContent()}
            </div>
          </div>
        </main>
      )}

      {/* 2.3 Full Work Mode with Side Ambient Chat Notification Strip */}
      {focusMode === 'work' && (
        <main className="nx-view-enter flex-1 flex h-full overflow-hidden min-w-0">
          {/* Main Full-Width Work Area */}
          <div className="flex-1 flex flex-col h-full overflow-hidden min-w-0 bg-[#FDFBF7]">
            {/* Top Work Controls (모바일에서는 각 화면의 자체 헤더를 사용) */}
            <header className="hidden sm:flex h-12 px-4 bg-[#F4EFE6]/70 border-b border-[#EBE5DA] items-center justify-between shrink-0 select-none">
              <div className="flex items-center gap-1.5 overflow-x-auto py-1">
                <button
                  onClick={() => {
                    if (!activeDocEditor || activeDocEditor.fileType !== 'doc') {
                      handleOpenDocEditor(`doc_${Date.now()}`, '새 문서.gdoc', 'doc');
                    }
                  }}
                  className={`flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    activeDocEditor && activeDocEditor.fileType === 'doc'
                      ? 'bg-white text-[#1A73E8] shadow-xs border border-[#EBE5DA]'
                      : 'text-[#7A6A5C] hover:text-[#2C2520] hover:bg-white/60'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5 text-[#1A73E8]" />
                  <span>구글 독스</span>
                </button>

                <button
                  onClick={() => {
                    if (!activeDocEditor || activeDocEditor.fileType !== 'sheet') {
                      handleOpenDocEditor(`sheet_${Date.now()}`, '새 스프레드시트.gsheet', 'sheet');
                    }
                  }}
                  className={`flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    activeDocEditor && activeDocEditor.fileType === 'sheet'
                      ? 'bg-white text-[#0F9D58] shadow-xs border border-[#EBE5DA]'
                      : 'text-[#7A6A5C] hover:text-[#2C2520] hover:bg-white/60'
                  }`}
                >
                  <Table className="w-3.5 h-3.5 text-[#0F9D58]" />
                  <span>구글 시트</span>
                </button>

                <button
                  onClick={() => {
                    if (!activeDocEditor || activeDocEditor.fileType !== 'slide') {
                      handleOpenDocEditor(`slide_${Date.now()}`, '새 프레젠테이션.gslides', 'slide');
                    }
                  }}
                  className={`flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    activeDocEditor && activeDocEditor.fileType === 'slide'
                      ? 'bg-white text-[#F4B400] shadow-xs border border-[#EBE5DA]'
                      : 'text-[#7A6A5C] hover:text-[#2C2520] hover:bg-white/60'
                  }`}
                >
                  <Presentation className="w-3.5 h-3.5 text-[#F4B400]" />
                  <span>구글 슬라이드</span>
                </button>

                <button
                  onClick={handleOpenGmail}
                  className={`flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    activeTab === 'gmail' && !activeDocEditor
                      ? 'bg-white text-[#EA4335] shadow-xs border border-[#EBE5DA]'
                      : 'text-[#7A6A5C] hover:text-[#2C2520] hover:bg-white/60'
                  }`}
                >
                  <Mail className="w-3.5 h-3.5 text-[#EA4335]" />
                  <span>Gmail 실시간 편지함</span>
                </button>

                <button
                  onClick={handleOpenDriveSplit}
                  className={`flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    activeTab === 'drive' && !activeDocEditor
                      ? 'bg-white text-[#15803D] shadow-xs border border-[#EBE5DA]'
                      : 'text-[#7A6A5C] hover:text-[#2C2520] hover:bg-white/60'
                  }`}
                >
                  <HardDrive className="w-3.5 h-3.5 text-[#15803D]" />
                  <span>내 드라이브</span>
                </button>
              </div>

              {/* Layout Mode Segmented Control & Close Workspace */}
              <div className="flex items-center gap-2">
                {renderSegmentedLayoutControl()}
                <button
                  onClick={() => {
                    setActiveDocEditor(null);
                    setActiveTab('chat');
                    setFocusMode('chat');
                    setIsSidebarCollapsed(false);
                  }}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-white hover:bg-red-50 border border-[#EBE5DA] hover:border-red-200 text-xs font-semibold text-[#7A6A5C] hover:text-red-600 transition-all cursor-pointer shadow-2xs"
                  title="작업실을 닫고 대화창으로 돌아갑니다"
                >
                  <X className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">작업 닫기</span>
                </button>
              </div>
            </header>

            {/* Work Content */}
            <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
              {renderWorkContent()}
            </div>
          </div>

          {/* Chat Ambient Notification Strip on the Side */}
          <aside
            onClick={() => setFocusMode('chat')}
            className="hidden sm:flex w-16 md:w-20 hover:w-72 transition-all duration-300 bg-[#F4EFE6] border-l border-[#EBE5DA] flex-col justify-between p-2.5 md:p-3 select-none cursor-pointer z-30 group shadow-sm shrink-0 overflow-hidden relative"
            title="터치하여 대화창 전체화면으로 전환"
          >
            <div className="flex flex-col items-center group-hover:items-start transition-all w-full">
              {/* Header Icon with Live Pulse Indicator */}
              <div className="flex items-center gap-2 mb-3 w-full justify-center group-hover:justify-start">
                <div className="relative">
                  <div className="w-10 h-10 rounded-xl bg-[#3E2723] text-white flex items-center justify-center font-bold text-sm shadow-xs group-hover:scale-105 transition-transform">
                    <MessageSquare className="w-5 h-5 text-white" />
                  </div>
                  <span className="absolute -top-1 -right-1 w-3 h-3 bg-[#48BB78] rounded-full ring-2 ring-[#F4EFE6] animate-pulse" />
                </div>
                <div className="hidden group-hover:block transition-all min-w-0">
                  <div className="text-xs font-bold text-[#2C2520] truncate flex items-center gap-1">
                    <span>실시간 대화</span>
                    <span className="text-[10px] bg-[#E6DCD0] px-1.5 py-0.2 rounded-full text-[#3E2723] font-bold">
                      알림
                    </span>
                  </div>
                  <div className="text-[10px] text-[#7A6A5C] truncate">#{activeSpace.name}</div>
                </div>
              </div>

              {/* Latest Message Preview Card */}
              {latestMessage ? (
                <div className="w-full bg-white/95 rounded-xl p-2.5 border border-[#EBE5DA] shadow-xs group-hover:block transition-all">
                  <div className="flex items-center gap-2 mb-1.5">
                    <img
                      src={avatarSrc(latestMessage.senderAvatar, latestMessage.senderName)}
                      onError={handleAvatarError}
                      alt=""
                      className="w-5 h-5 rounded-md object-cover border border-[#EBE5DA]"
                    />
                    <span className="text-[11px] font-bold text-[#2C2520] truncate">{latestMessage.senderName}</span>
                  </div>
                  <p className="text-[11px] text-[#5C5046] line-clamp-2 leading-relaxed">
                    {latestMessage.content}
                  </p>
                  <span className="text-[9px] text-[#A89A8E] block mt-1 text-right">
                    {latestMessage.timestamp}
                  </span>
                </div>
              ) : (
                <div className="hidden group-hover:block p-2 text-center text-[11px] text-[#7A6A5C]">
                  새로운 대화가 도착하면 여기에 실시간 알림이 표시됩니다.
                </div>
              )}
            </div>

            {/* Bottom Touch prompt button */}
            <div className="w-full text-center">
              <div className="p-2 rounded-xl bg-[#E6DCD0] group-hover:bg-[#3E2723] group-hover:text-white text-[#3E2723] text-[11px] font-bold transition-colors shadow-xs flex items-center justify-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5" />
                <span className="hidden group-hover:inline">대화창으로 전환</span>
              </div>
            </div>
          </aside>
        </main>
      )}

      {/* 3. Right Thread Side Panel */}
      {activeThreadMessage && (
        <ThreadPanel
          message={activeThreadMessage}
          currentUser={currentUser}
          onClose={() => setActiveThreadMessage(null)}
          onSendReply={handleSendThreadReply}
        />
      )}

      {/* 3.1 Dedicated Gemini AI Side Panel */}
      {isGeminiPanelOpen && (
        <GeminiAIPanel
          isOpen={isGeminiPanelOpen}
          onClose={() => setIsGeminiPanelOpen(false)}
          messages={activeMessages}
          spaceName={activeSpace.name}
          currentUser={currentUser}
        />
      )}

      {/* 4. Modals */}
      <MeetRoomModal
        isOpen={isMeetingOpen}
        onClose={() => setIsMeetingOpen(false)}
        room={meetingRoom}
        spaceName={activeSpace.name}
        members={activeSpaceMembers}
        currentUser={currentUser}
        onStartNewMeeting={() => handleStartMeeting()}
        onShareToChat={(room) => postMeetingCard(room)}
        onCreateRoomForSpace={async () => null}
      />

      <ContactsModal
        isOpen={isContactsOpen}
        onClose={() => setIsContactsOpen(false)}
        contacts={contacts}
        onAdd={handleAddContact}
        onRename={handleRenameContact}
        onRemove={handleRemoveContact}
        currentUserId={currentUser.id}
        onStartDm={(contact) => {
          const target = allUsers.find(
            (u) => (contact.userId && u.id === contact.userId) || (contact.email && normalizeEmail(u.email) === normalizeEmail(contact.email))
          );
          if (target) {
            handleStartDmWithFriend(target);
            setIsContactsOpen(false);
            setFocusMode('chat');
          } else {
            notificationService.notify({
              title: '연락처',
              body: '이 연락처는 아직 워크스페이스에 참여하지 않아 1:1 대화를 열 수 없습니다.',
            });
          }
        }}
      />
      <DrivePickerModal
        isOpen={isDrivePickerOpen}
        onClose={() => setIsDrivePickerOpen(false)}
        currentUser={currentUser}
        onShareDriveFile={handleShareDriveFile}
      />

      <CalendarEventModal
        isOpen={isCalendarModalOpen}
        onClose={() => setIsCalendarModalOpen(false)}
        currentUser={currentUser}
        spaceMembers={activeSpaceMembers}
        onSaveCalendarEvent={handleSaveCalendarEvent}
      />

      <FriendManagementModal
        isOpen={isFriendModalOpen}
        onClose={() => setIsFriendModalOpen(false)}
        currentUser={currentUser}
        allUsers={allUsers}
        friendRequests={friendRequests}
        friendships={friendships}
        onSendRequest={handleSendFriendRequest}
        onAcceptRequest={handleAcceptFriendRequest}
        onRejectRequest={handleRejectFriendRequest}
        onStartDmWithFriend={handleStartDmWithFriend}
      />

      <CreateSpaceModal
        isOpen={isCreateSpaceModalOpen}
        onClose={() => setIsCreateSpaceModalOpen(false)}
        currentUser={currentUser}
        allUsers={allUsers}
        onCreateSpace={handleCreateSpace}
      />

      <SpaceSettingsModal
        isOpen={isSpaceSettingsOpen}
        onClose={() => setIsSpaceSettingsOpen(false)}
        space={activeSpace}
        currentUser={currentUser}
        allUsers={allUsers}
        onUpdateSpace={handleUpdateSpace}
        onAddMember={handleAddMemberToSpace}
        onRemoveMember={handleRemoveMemberFromSpace}
        onLeaveSpace={handleLeaveSpace}
        onDeleteSpace={handleDeleteSpace}
      />

      <UserProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        currentUser={currentUser}
        allUsers={allUsers}
        onUpdateUser={(updated) => {
          storage.setCurrentUser(updated);
          setCurrentUser(updated);
          const nextUsers = allUsers.map((u) => (u.id === updated.id ? updated : u));
          storage.saveUsers(nextUsers);
          setAllUsers(nextUsers);
        }}
        onLogout={handleLogout}
        onSwitchUser={handleLogin}
      />

      {currentUser && (
        <SettingsModal
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          currentUser={currentUser}
          isGuest={isGuest}
          authLoading={authLoading}
          authError={authError}
          onGoogleSignIn={async () => {
            setIsSettingsOpen(false);
            await handleGoogleSignIn();
          }}
          onSignOut={handleLogout}
          notificationsEnabled={notificationsEnabled}
          onToggleNotifications={handleToggleNotifications}
        />
      )}

      <SearchModal
        isOpen={isSearchModalOpen}
        onClose={() => setIsSearchModalOpen(false)}
        messages={Object.values(messagesMap).flat()}
        spaces={spaces}
        allUsers={allUsers}
        onSelectSpace={handleSelectSpace}
        onOpenWorkspaceHub={() => setIsWorkspaceHubOpen(true)}
        onSelectSelfNotes={handleSelectSelfNotes}
      />

      {currentUser && (
        <GoogleWorkspaceHubModal
          isOpen={isWorkspaceHubOpen}
          onClose={() => setIsWorkspaceHubOpen(false)}
          currentUser={currentUser}
          onUpdateCurrentUser={(updated) => {
            storage.setCurrentUser(updated);
            setCurrentUser(updated);
          }}
          space={activeSpace}
          spaceMembers={activeSpaceMembers}
          onOpenDocEditor={(fileId, fileName, fileType) => {
            handleOpenDocEditor(fileId, fileName, fileType);
            setIsWorkspaceHubOpen(false);
          }}
          onOpenGmail={() => {
            setIsWorkspaceHubOpen(false);
            handleOpenGmail();
          }}
          onOpenDrive={() => {
            setIsWorkspaceHubOpen(false);
            handleOpenDriveSplit();
          }}
          onOpenCalendarModal={() => {
            setIsCalendarModalOpen(true);
            setIsWorkspaceHubOpen(false);
          }}
          onShareToChat={(content) => handleSendMessage(content)}
        />
      )}
    </div>
  );
}
