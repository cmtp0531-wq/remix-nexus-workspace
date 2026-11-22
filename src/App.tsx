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
import { 
  GoogleMeetModal, 
  DrivePickerModal, 
  CalendarEventModal, 
  FriendManagementModal, 
  CreateSpaceModal, 
  UserProfileModal,
  SpaceSettingsModal
} from './components/GoogleChatModals';
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
  subscribeToCloudChatMessages,
  saveUserProfileToFirestore,
  subscribeToCloudUsers,
  isGoogleSignedIn
} from './services/googleWorkspace';
import { isFirebaseConfigured, onSettingsChanged } from './services/appConfig';
import type { User as FirebaseUser } from 'firebase/auth';

export default function App() {
  // 로그인 게이트 없이 바로 워크스페이스를 사용합니다.
  // - 저장된 로컬 사용자가 있으면 그 사용자로, 없으면 게스트(로컬) 사용자로 시작
  // - 설정에서 Firebase 를 연결하고 구글 로그인을 하면 그 계정으로 전환됩니다.
  const [currentUser, setCurrentUser] = useState<User | null>(() => storage.getCurrentUser());
  const [isGuest, setIsGuest] = useState<boolean>(() => !isGoogleSignedIn());
  const [authReady, setAuthReady] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');
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

  // Device type detection ('mobile' | 'tablet' | 'desktop')
  const [deviceType, setDeviceType] = useState<'mobile' | 'tablet' | 'desktop'>('desktop');

  // System notifications state
  const [notificationsEnabled, setNotificationsEnabled] = useState(() => notificationService.getIsEnabled());
  const [inAppNotifs, setInAppNotifs] = useState<InAppNotification[]>([]);

  // Modals
  const [isMeetModalOpen, setIsMeetModalOpen] = useState(false);
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

  // Firebase Authentication restores the real Google account on refresh.
  // Firebase 미설정/비로그인 상태에서는 게스트(로컬) 사용자로 그대로 진입합니다.
  useEffect(() => {
    const unsubscribe = observeFirebaseAuth((firebaseUser: FirebaseUser | null) => {
      if (!firebaseUser) {
        const local = storage.getCurrentUser() || DEFAULT_LOCAL_USER;
        if (!storage.getCurrentUser()) storage.setCurrentUser(local);
        setCurrentUser((prev) => prev ?? local);
        setIsGuest(true);
        setAuthReady(true);
        return;
      }
      const existing = storage.getUsers().find((u) => u.id === firebaseUser.uid);
      const user: User = {
        id: firebaseUser.uid,
        name: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'Google 사용자',
        email: firebaseUser.email || '',
        avatar: firebaseUser.photoURL || existing?.avatar || 'https://www.gravatar.com/avatar/?d=mp',
        status: 'online',
        role: existing?.role || '팀원',
        department: existing?.department || '협업팀',
        googleConnected: true,
      };
      const users = storage.getUsers();
      storage.saveUsers(users.some((u) => u.id === user.id) ? users.map((u) => u.id === user.id ? { ...u, ...user } : u) : [...users, user]);
      storage.setCurrentUser(user);
      setAllUsers(storage.getUsers());
      setCurrentUser(user);
      setIsGuest(false);
      setAuthReady(true);
      void saveUserProfileToFirestore(user);
    });
    return unsubscribe;
  }, []);

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
              avatar: cu.avatar || 'https://www.gravatar.com/avatar/?d=mp',
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
      await signInWithGoogleAccount();
      // onAuthStateChanged above creates the local profile.
    } catch (error: any) {
      console.error('Google sign-in failed:', error);
      const code = String(error?.code || '');
      if (code.includes('unauthorized-domain')) {
        setAuthError('이 사이트 주소가 Firebase 인증 허용 도메인에 없습니다. Firebase Console → Authentication → Settings → Authorized domains에 배포 주소를 추가하세요.');
      } else if (code.includes('popup')) {
        setAuthError('Google 로그인 창이 차단되었습니다. 브라우저에서 팝업을 허용한 뒤 다시 시도하세요.');
      } else if (code.includes('operation-not-allowed')) {
        setAuthError('Firebase Console에서 Authentication의 Google 로그인 제공자를 활성화해야 합니다.');
      } else {
        setAuthError('Google 로그인에 실패했습니다. Firebase 설정과 허용 도메인을 확인한 뒤 다시 시도하세요.');
      }
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

  // 시작 시 잠깐 보여주는 로딩 화면 (로그인 게이트가 아닙니다)
  if (!authReady || !currentUser) {
    return (
      <div className="h-[100vh] w-full flex flex-col items-center justify-center gap-3 bg-[#FDFBF7] text-[#2C2520]">
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
  const handleSendMessage = (content: string, attachments?: Attachment[], replyTo?: MessageReplyContext) => {
    const now = new Date();
    const timeStr = `${now.getHours() >= 12 ? '오후' : '오전'} ${(now.getHours() % 12 || 12)
      .toString()
      .padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

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
    };

    const nextMessages = {
      ...messagesMap,
      [activeSpaceId]: [...(messagesMap[activeSpaceId] || []), newMsg],
    };

    storage.saveMessages(nextMessages);
    setMessagesMap(nextMessages);
    if (auth?.currentUser?.uid === currentUser.id) {
      void saveCloudChatMessage(activeSpaceId, newMsg).catch((error) => {
        console.error('Could not send chat message to Firestore:', error);
        console.warn('메시지는 이 기기에 남아 있지만, Firestore 권한 또는 연결 문제로 다른 사용자에게 전송되지 않았을 수 있습니다.');
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
          senderAvatar: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=150&auto=format&fit=crop&q=80',
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
          icon: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=150&auto=format&fit=crop&q=80',
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

  // GOOGLE MEET SHARING
  const handleShareMeetToChat = (meetingTitle: string, meetLink: string, code: string) => {
    handleSendMessage(`Google Meet 화상 회의가 생성되었습니다: **${meetingTitle}**`, [
      {
        type: 'meet',
        meetingTitle,
        meetLink,
        meetCode: code,
        hostName: currentUser.name,
        activeParticipantsCount: 1,
      },
    ]);
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

  // 2. TRACE-FREE MESSAGE DELETE (흔적 없는 완전 삭제)
  const handleDeleteMessageTracedFree = (messageId: string) => {
    const msgs = messagesMap[activeSpaceId] || [];
    const nextMsgs = msgs.filter((m) => m.id !== messageId);
    const nextMap = { ...messagesMap, [activeSpaceId]: nextMsgs };
    storage.saveMessages(nextMap);
    setMessagesMap(nextMap);

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
  }) => {
    handleSendMessage(`새로운 캘린더 일정이 등록되었습니다: **${event.eventTitle}**`, [
      {
        type: 'calendar',
        ...event,
        rsvps: { [currentUser.id]: 'accepted' },
      },
    ]);
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

    const nextRequests = [newReq, ...friendRequests];
    storage.saveFriendRequests(nextRequests);
    setFriendRequests(nextRequests);
  };

  const handleAcceptFriendRequest = (request: FriendRequest) => {
    // 1. Update request status
    const updatedRequests = friendRequests.map((r) =>
      r.id === request.id ? { ...r, status: 'accepted' as const } : r
    );
    storage.saveFriendRequests(updatedRequests);
    setFriendRequests(updatedRequests);

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
  };

  const handleToggleTask = (taskId: string) => {
    const nextTasks = tasks.map((t) => (t.id === taskId ? { ...t, completed: !t.completed } : t));
    storage.saveTasks(nextTasks);
    setTasks(nextTasks);
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
      onOpenThread={(msg) => {
        setActiveThreadMessage(msg);
        setActiveDocEditor(null);
        setIsTasksPanelOpen(false);
        setIsSidebarCollapsed(true);
      }}
      onToggleReaction={handleToggleReaction}
      onToggleStarSpace={handleToggleStarSpace}
      onToggleStarMessage={handleToggleStarMessage}
      onOpenMeetModal={() => setIsMeetModalOpen(true)}
      onOpenCalendarModal={() => setIsCalendarModalOpen(true)}
      onOpenDrivePicker={() => setIsDrivePickerOpen(true)}
      onOpenDocEditor={handleOpenDocEditor}
      onOpenMeetRoom={(link, title) => {
        setIsMeetModalOpen(true);
      }}
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
    <div className="flex h-[100vh] w-full max-w-full overflow-hidden bg-[#FDFBF7] text-[#2C2520] font-sans antialiased selection:bg-[#E6DCD0] selection:text-[#3E2723] relative">
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

      {/* 1. Left Sidebar (Google Chat in Cafe Beige theme) - Collapsible on demand */}
      <div
        className={`${
          isMobileSidebarOpen
            ? 'absolute inset-y-0 left-0 z-40 flex shadow-2xl animate-in slide-in-from-left duration-200'
            : isSidebarCollapsed
            ? 'hidden'
            : 'hidden md:flex'
        }`}
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
          onOpenFriendModal={() => setIsFriendModalOpen(true)}
          onOpenCreateSpaceModal={() => setIsCreateSpaceModalOpen(true)}
          onOpenProfileModal={() => setIsProfileModalOpen(true)}
          onOpenSearchModal={() => setIsSearchModalOpen(true)}
          onSelectSelfNotes={() => {
            handleSelectSelfNotes();
            setIsMobileSidebarOpen(false);
          }}
          allUsers={allUsers}
          onOpenWorkspaceHub={() => setIsWorkspaceHubOpen(true)}
          onOpenGmail={handleOpenGmail}
          onOpenDrive={handleOpenDriveSplit}
          onLogout={handleLogout}
          onSwitchUser={handleLogin}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onToggleCollapse={() => setIsSidebarCollapsed(true)}
        />
      </div>

      {/* Backdrop for mobile drawer */}
      {isMobileSidebarOpen && (
        <div
          onClick={() => setIsMobileSidebarOpen(false)}
          className="md:hidden fixed inset-0 bg-black/40 backdrop-blur-xs z-30"
        />
      )}

      {/* 2. Main Viewport - Apple-style Focus Modes */}
      {/* 2.1 Full Chat Mode */}
      {focusMode === 'chat' && (
        <main className="flex-1 flex flex-col h-full overflow-hidden min-w-0">
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
            {renderChatMain()}
          </div>
        </main>
      )}

      {/* 2.2 Split Dual Mode (50:50) */}
      {focusMode === 'split' && (
        <main className="flex-1 flex flex-col md:flex-row h-full overflow-hidden min-w-0">
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
        <main className="flex-1 flex h-full overflow-hidden min-w-0">
          {/* Main Full-Width Work Area */}
          <div className="flex-1 flex flex-col h-full overflow-hidden min-w-0 bg-[#FDFBF7]">
            {/* Top Work Controls */}
            <header className="h-12 px-4 bg-[#F4EFE6]/70 border-b border-[#EBE5DA] flex items-center justify-between shrink-0 select-none">
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
            className="w-16 md:w-20 hover:w-72 transition-all duration-300 bg-[#F4EFE6] border-l border-[#EBE5DA] flex flex-col justify-between p-2.5 md:p-3 select-none cursor-pointer z-30 group shadow-sm shrink-0 overflow-hidden relative"
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
                      src={latestMessage.senderAvatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80'}
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
      <GoogleMeetModal
        isOpen={isMeetModalOpen}
        onClose={() => setIsMeetModalOpen(false)}
        currentUser={currentUser}
        spaceMembers={activeSpaceMembers}
        allUsers={allUsers}
        onShareToChat={handleShareMeetToChat}
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
