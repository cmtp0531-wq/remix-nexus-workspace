import React, { useState } from 'react';
import { 
  Hash, 
  MessageSquare, 
  Plus, 
  Search, 
  ChevronDown, 
  ChevronRight, 
  UserPlus, 
  SlidersHorizontal, 
  Bookmark, 
  Pin, 
  CheckCircle2, 
  LogOut, 
  Users, 
  Check, 
  ChevronUp, 
  PanelLeftClose,
  Mail,
  HardDrive,
  Settings,
  NotebookPen,
  ContactRound,
  MessageSquarePlus,
  UserCog
} from 'lucide-react';
import { Space, User } from '../types';
import { avatarSrc, handleAvatarError } from './UserAvatar';
import { isWorkspaceConnected } from '../services/googleWorkspace';
import { Contact, contactNameOf } from '../services/contactsService';

interface GoogleChatSidebarProps {
  currentUser: User;
  spaces: Space[];
  activeSpaceId: string;
  onSelectSpace: (spaceId: string) => void;
  pendingRequestsCount: number;
  onOpenFriendModal: () => void;
  onOpenCreateSpaceModal: () => void;
  onOpenProfileModal: () => void;
  onOpenSearchModal: () => void;
  onSelectSelfNotes: () => void;
  allUsers: User[];
  onOpenWorkspaceHub?: () => void;
  onOpenGmail?: () => void;
  onOpenDrive?: () => void;
  onLogout?: () => void;
  onOpenSettings?: () => void;
  onSwitchUser?: (user: User) => void;
  onToggleCollapse?: () => void;
  onGoogleSignIn?: () => void;
  authLoading?: boolean;
  contacts?: Contact[];
  onOpenContacts?: () => void;
}

export const GoogleChatSidebar: React.FC<GoogleChatSidebarProps> = ({
  currentUser,
  spaces,
  activeSpaceId,
  onSelectSpace,
  pendingRequestsCount,
  onOpenFriendModal,
  onOpenCreateSpaceModal,
  onOpenProfileModal,
  onOpenSearchModal,
  onSelectSelfNotes,
  allUsers,
  onOpenWorkspaceHub,
  onOpenGmail,
  onOpenDrive,
  onLogout,
  onOpenSettings,
  onSwitchUser,
  onToggleCollapse,
  onGoogleSignIn,
  authLoading = false,
  contacts = [],
  onOpenContacts,
}) => {
  const [spacesCollapsed, setSpacesCollapsed] = useState(false);
  const [dmsCollapsed, setDmsCollapsed] = useState(false);
  const [isAccountSwitcherOpen, setIsAccountSwitcherOpen] = useState(false);

  const selfNotesId = `notes_${currentUser.id}`;
  const isNotesActive = activeSpaceId === selfNotesId;

  // Only display spaces where current user is a member (excluding self-notes), or default public lounge
  const spaceList = (spaces || []).filter(
    (s) =>
      s.type === 'space' &&
      !s.isSelfNotes &&
      (s.id === 'space_general' || (s.memberIds || []).includes(currentUser.id))
  );

  // Only display DMs where current user is a participant
  const dmList = (spaces || []).filter(
    (s) => s.type === 'dm' && !s.isSelfNotes && (s.memberIds || []).includes(currentUser.id)
  );

  const getStatusDot = (status: User['status']) => {
    switch (status) {
      case 'online': return 'bg-[#48BB78] ring-2 ring-[#F4EFE6]';
      case 'dnd': return 'bg-[#E53E3E] ring-2 ring-[#F4EFE6]';
      case 'away': return 'bg-[#ED8936] ring-2 ring-[#F4EFE6]';
      default: return 'bg-[#A0AEC0] ring-2 ring-[#F4EFE6]';
    }
  };

  const getDmFriend = (dm: Space) => {
    if (!dm.dmWithUserId) return null;
    return allUsers.find((u) => u.id === dm.dmWithUserId);
  };
  return (
    <aside className="w-72 flex-shrink-0 bg-[#F4EFE6] border-r border-[#EBE5DA] flex flex-col justify-between select-none">
      <div>
        {/* Top Google Chat Brand in Cafe Beige */}
        <div className="p-4 border-b border-[#EBE5DA] flex items-center justify-between bg-[#FDFBF7]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#3E2723] flex items-center justify-center text-white shadow-xs font-bold text-xs">
              <MessageSquare className="w-4 h-4 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-black text-[#2C2520] tracking-tight">
                  워크챗
                </span>
                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-[#E6DCD0] text-[#3E2723] border border-[#DCD3C5]">
                  WorkChat
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={onOpenProfileModal}
              className="p-1.5 rounded-lg text-[#7A6A5C] hover:text-[#2C2520] hover:bg-[#EBE5DA] transition-colors cursor-pointer"
              title="내 프로필 및 워크스페이스 설정"
            >
              <SlidersHorizontal className="w-4 h-4" />
            </button>
            {onToggleCollapse && (
              <button
                onClick={onToggleCollapse}
                className="p-1.5 rounded-lg text-[#7A6A5C] hover:text-[#2C2520] hover:bg-[#EBE5DA] transition-colors cursor-pointer"
                title="사이드바 접기"
              >
                <PanelLeftClose className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Global Search Button */}
        <div className="p-3">
          <button
            onClick={onOpenSearchModal}
            className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-[#FFFFFF] hover:bg-[#FDFBF7] text-[#7A6A5C] hover:text-[#2C2520] text-xs transition-all border border-[#EBE5DA] cafe-shadow"
          >
            <div className="flex items-center gap-2">
              <Search className="w-3.5 h-3.5 text-[#A89A8E]" />
              <span>대화, 드라이브, 일정 검색...</span>
            </div>
            <kbd className="text-[10px] bg-[#F4EFE6] px-1.5 py-0.5 rounded border border-[#EBE5DA] text-[#7A6A5C] font-mono">
              ⌘K
            </kbd>
          </button>
        </div>

        {/* 1. 직관적인 '나와 대화하기' / 나의 메모장 단독 탭 */}
        <div className="px-3 pb-2">
          <button
            onClick={onSelectSelfNotes}
            className={`w-full flex items-center justify-between p-2.5 rounded-xl border transition-all text-xs font-bold ${
              isNotesActive
                ? 'bg-[#E6DCD0] border-[#C18C5D] text-[#3E2723] shadow-xs'
                : 'bg-[#FFFFFF] hover:bg-[#FDFBF7] border-[#EBE5DA] text-[#2C2520]'
            }`}
          >
            <div className="flex items-center gap-2.5 truncate">
              <div className="w-6 h-6 rounded-lg bg-[#E6DCD0] flex items-center justify-center text-[#3E2723] flex-shrink-0">
                <NotebookPen className="w-3.5 h-3.5" />
              </div>
              <div className="text-left truncate">
                <div className="truncate font-bold">나의 메모장 (나와 대화하기)</div>
                <div className="text-[10px] text-[#7A6A5C] font-normal truncate">개인 링크, 파일, 할 일 보관</div>
              </div>
            </div>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#F4EFE6] text-[#7A6A5C]">
              개인
            </span>
          </button>
        </div>

        {/* 연락처 · 팀원 (한 줄로 통합) */}
        <div className="px-3 pb-2 grid grid-cols-2 gap-1.5">
          {onOpenContacts && (
            <button
              onClick={onOpenContacts}
              className="flex items-center justify-center gap-1.5 p-2 rounded-xl bg-[#FDFBF7] hover:bg-[#FFFFFF] border border-[#EBE5DA] transition-all text-[11px] font-semibold text-[#5C5046]"
              title="연락처 별명 관리"
            >
              <ContactRound className="w-3.5 h-3.5 text-[#C18C5D]" />
              <span className="truncate">연락처{contacts.length > 0 ? ` ${contacts.length}` : ''}</span>
            </button>
          )}
          <button
            onClick={onOpenFriendModal}
            className={`relative flex items-center justify-center gap-1.5 p-2 rounded-xl border transition-all text-[11px] font-semibold ${
              pendingRequestsCount > 0
                ? 'bg-[#FFF5EB] border-[#FBD38D] text-[#C05621]'
                : 'bg-[#FDFBF7] hover:bg-[#FFFFFF] border-[#EBE5DA] text-[#5C5046]'
            }`}
            title="팀원 초대 · 친구 관리"
          >
            <UserPlus className="w-3.5 h-3.5 text-[#C18C5D]" />
            <span className="truncate">팀원 · 초대</span>
            {pendingRequestsCount > 0 && (
              <span className="absolute -top-1 -right-1 px-1.5 rounded-full bg-[#ED8936] text-white text-[9px] font-bold">
                {pendingRequestsCount}
              </span>
            )}
          </button>
        </div>

        {/* Google Workspace 100% Integration Hub Pill */}
        {onOpenWorkspaceHub && (
          <div className="px-3 pb-2 space-y-1.5">
            <button
              onClick={onOpenWorkspaceHub}
              className="w-full flex items-center justify-between p-2 rounded-xl bg-white hover:bg-[#FDFBF7] border border-[#EBE5DA] transition-all text-xs shadow-xs cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-[#15803D] animate-ping" />
                <span className="font-bold text-[#2C2520]">Google Workspace</span>
              </div>
              <span className="px-2 py-0.5 rounded-full bg-[#E6F4EA] text-[#137333] text-[10px] font-bold">
                {isWorkspaceConnected() ? 'Workspace 연동됨' : currentUser.googleConnected ? '로그인됨' : '연동 허브'}
              </span>
            </button>

            {/* Workspace 허브 하나로 Gmail · 드라이브 · 문서 · 시트 · 슬라이드 모두 들어갑니다
                (중복되던 Gmail 수신함 / 내 드라이브 바로가기 버튼은 허브로 통합했습니다) */}
          </div>
        )}

        {/* Navigation Section: Spaces & DMs */}
        <div className="px-2 py-1 space-y-4 max-h-[calc(100vh-275px)] overflow-y-auto">
          {/* SPACES */}
          <div>
            <div className="flex items-center justify-between px-2.5 py-1 text-[#7A6A5C] text-xs font-semibold uppercase tracking-wider">
              <button
                onClick={() => setSpacesCollapsed(!spacesCollapsed)}
                className="flex items-center gap-1 hover:text-[#2C2520] transition-colors"
              >
                {spacesCollapsed ? (
                  <ChevronRight className="w-3.5 h-3.5" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5" />
                )}
                <span>스페이스 ({spaceList.length})</span>
              </button>
              <button
                onClick={onOpenCreateSpaceModal}
                className="p-1 rounded-lg hover:bg-[#EBE5DA] text-[#5C5046] hover:text-[#2C2520] transition-colors"
                title="새 스페이스 만들기 (선택적 팀원 초대)"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>

            {!spacesCollapsed && (
              <div className="mt-1 space-y-0.5">
                {spaceList.map((space) => {
                  const isActive = space.id === activeSpaceId;
                  return (
                    <div
                      key={space.id}
                      onClick={() => onSelectSpace(space.id)}
                      className={`group flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-medium cursor-pointer transition-all ${
                        isActive
                          ? 'bg-[#E6DCD0] text-[#3E2723] font-bold border-l-4 border-[#C18C5D] shadow-xs'
                          : 'text-[#4A3E34] hover:bg-[#FDFBF7] hover:text-[#2C2520]'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <Hash className={`w-3.5 h-3.5 flex-shrink-0 ${isActive ? 'text-[#C18C5D]' : 'text-[#A89A8E]'}`} />
                        <span className="truncate">{space.name}</span>
                      </div>

                      <div className="flex items-center gap-1">
                        {space.isHuddleActive && (
                          <span className="w-2 h-2 rounded-full bg-[#48BB78] animate-ping" title="음성 허들 진행 중" />
                        )}
                        {space.pinnedMessageText && (
                          <Pin className="w-2.5 h-2.5 text-[#C18C5D]" />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* DIRECT MESSAGES */}
          <div>
            <div className="flex items-center justify-between px-2.5 py-1 text-[#7A6A5C] text-xs font-semibold uppercase tracking-wider">
              <button
                onClick={() => setDmsCollapsed(!dmsCollapsed)}
                className="flex items-center gap-1 hover:text-[#2C2520] transition-colors"
              >
                {dmsCollapsed ? (
                  <ChevronRight className="w-3.5 h-3.5" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5" />
                )}
                <span>1:1 다이렉트 메시지 ({dmList.length})</span>
              </button>
              <button
                onClick={onOpenFriendModal}
                className="p-1 rounded-lg hover:bg-[#EBE5DA] text-[#5C5046] hover:text-[#2C2520] transition-colors"
                title="친구와 새 대화 시작"
              >
                <MessageSquarePlus className="w-3.5 h-3.5" />
              </button>
            </div>

            {!dmsCollapsed && (
              <div className="mt-1 space-y-0.5">
                {dmList.length === 0 ? (
                  <div className="px-2.5 py-2 text-[11px] text-[#A89A8E]">
                    친구를 추가하여 1:1 대화를 시작해보세요.
                  </div>
                ) : (
                  dmList.map((dm) => {
                    const isActive = dm.id === activeSpaceId;
                    const friend = getDmFriend(dm);

                    return (
                      <div
                        key={dm.id}
                        onClick={() => onSelectSpace(dm.id)}
                        className={`group flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-medium cursor-pointer transition-all ${
                          isActive
                            ? 'bg-[#E6DCD0] text-[#3E2723] font-bold border-l-4 border-[#C18C5D] shadow-xs'
                            : 'text-[#4A3E34] hover:bg-[#FDFBF7] hover:text-[#2C2520]'
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <div className="relative flex-shrink-0">
                            <img
                              src={avatarSrc(friend?.avatar, friend?.name)} onError={handleAvatarError}
                              alt={dm.name}
                              className="w-5 h-5 rounded-md object-cover bg-white border border-[#EBE5DA]"
                            />
                            {friend && (
                              <span
                                className={`absolute -bottom-0.5 -right-0.5 w-1.5 h-1.5 rounded-full ${getStatusDot(
                                  friend.status
                                )}`}
                              />
                            )}
                          </div>
                          <span className="truncate">
                            {contactNameOf(contacts, friend?.id || dm.dmWithUserId, friend?.email, dm.name)}
                          </span>
                        </div>

                        {friend?.customStatus?.emoji && (
                          <span className="text-[11px] opacity-75">
                            {friend.customStatus.emoji}
                          </span>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Profile Pill with 1-Click Logout & Account Switch */}
      <div className="p-3 border-t border-[#EBE5DA] bg-[#FDFBF7] relative">
        {/* Quick Account Switcher Popup */}
        {isAccountSwitcherOpen && (
          <div className="absolute bottom-full left-3 right-3 mb-2 bg-white border border-[#EBE5DA] rounded-2xl cafe-shadow-lg p-2.5 z-30 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#F4EFE6] text-[11px] font-bold text-[#5C5046]">
              <span className="flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-[#C18C5D]" />
                <span>팀원 계정 즉시 전환 (새로고침 X)</span>
              </span>
              <button
                type="button"
                onClick={() => setIsAccountSwitcherOpen(false)}
                className="text-[#A89A8E] hover:text-[#2C2520] p-0.5"
              >
                ✕
              </button>
            </div>
            
            <div className="space-y-1 max-h-48 overflow-y-auto pr-0.5">
              {allUsers.map((u) => {
                const isCurrent = u.id === currentUser.id;
                return (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => {
                      setIsAccountSwitcherOpen(false);
                      if (!isCurrent && onSwitchUser) {
                        onSwitchUser(u);
                      }
                    }}
                    className={`w-full flex items-center justify-between p-2 rounded-xl text-left text-xs transition-all ${
                      isCurrent
                        ? 'bg-[#F4EFE6] text-[#3E2723] font-bold border border-[#EBE5DA]'
                        : 'hover:bg-[#FAF7F2] text-[#2C2520]'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <img
                        src={avatarSrc(u.avatar)} onError={handleAvatarError}
                        alt={u.name}
                        className="w-6 h-6 rounded-lg object-cover border border-[#EBE5DA]"
                      />
                      <div className="truncate">
                        <div className="text-xs truncate">{u.name}</div>
                        <div className="text-[10px] text-[#A89A8E] truncate">{u.role}</div>
                      </div>
                    </div>
                    {isCurrent && <Check className="w-3.5 h-3.5 text-[#C18C5D] flex-shrink-0" />}
                  </button>
                );
              })}
            </div>

            {onLogout && (
              <div className="pt-2 mt-2 border-t border-[#F4EFE6]">
                <button
                  type="button"
                  onClick={() => {
                    setIsAccountSwitcherOpen(false);
                    onLogout();
                  }}
                  className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-xl text-xs font-bold text-[#DC2626] hover:bg-[#FFF5F5] transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>로그아웃 (게스트로 전환)</span>
                </button>
              </div>
            )}
          </div>
        )}

        {!currentUser.googleConnected && onGoogleSignIn && (
          <button
            type="button"
            onClick={onGoogleSignIn}
            disabled={authLoading}
            className="w-full mb-2 px-3 py-2 rounded-xl bg-[#3E2723] hover:bg-[#2C2520] text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-60"
            title="Google 계정으로 로그인하면 대화와 파일이 계정에 저장됩니다"
          >
            <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" aria-hidden="true">
              <path fill="#fff" d="M21.6 12.23c0-.68-.06-1.36-.17-2.02H12v3.83h5.4a4.62 4.62 0 0 1-2 3.03v2.52h3.23c1.89-1.74 2.97-4.3 2.97-7.36Z" />
              <path fill="#fff" opacity=".85" d="M12 22c2.7 0 4.96-.9 6.62-2.42l-3.23-2.52c-.9.6-2.05.96-3.39.96-2.6 0-4.8-1.76-5.59-4.12H3.07v2.6A10 10 0 0 0 12 22Z" />
              <path fill="#fff" opacity=".7" d="M6.41 13.9a5.99 5.99 0 0 1 0-3.8V7.5H3.07a10 10 0 0 0 0 9l3.34-2.6Z" />
              <path fill="#fff" opacity=".55" d="M12 5.98c1.47 0 2.79.51 3.83 1.5l2.86-2.86A9.6 9.6 0 0 0 12 2a10 10 0 0 0-8.93 5.5l3.34 2.6C7.2 7.74 9.4 5.98 12 5.98Z" />
            </svg>
            <span>{authLoading ? 'Google 로그인 중…' : 'Google로 로그인'}</span>
          </button>
        )}

        <div className="flex items-center justify-between gap-1.5">
          <div
            onClick={onOpenProfileModal}
            className="flex-1 flex items-center gap-2 p-1.5 rounded-xl hover:bg-[#F4EFE6] cursor-pointer transition-colors group truncate"
            title="프로필 및 상태 설정 열기"
          >
            <div className="relative flex-shrink-0">
              <img
                src={avatarSrc(currentUser.avatar)} onError={handleAvatarError}
                alt={currentUser.name}
                className="w-8 h-8 rounded-lg bg-white border border-[#DCD3C5] object-cover"
              />
              <span
                className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full ${getStatusDot(
                  currentUser.status
                )}`}
              />
            </div>
            <div className="truncate">
              <div className="text-xs font-bold text-[#2C2520] group-hover:text-[#3E2723] transition-colors truncate">
                {currentUser.name}
              </div>
              <div className="text-[10px] text-[#7A6A5C] truncate flex items-center gap-1">
                {currentUser.googleConnected ? (
                  <span className="text-[#38A169] font-bold">
                    {isWorkspaceConnected() ? 'Google Workspace 연동' : 'Google 로그인됨'}
                  </span>
                ) : (
                  <span>{currentUser.role}</span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1 flex-shrink-0">
            {/* 설정 (Gemini 키 · Google 연동 · 데이터) */}
            {onOpenSettings && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenSettings();
                }}
                className="p-1.5 rounded-xl text-[#7A6A5C] hover:text-[#3E2723] hover:bg-[#F4EFE6] transition-colors"
                title="설정 (테마·글씨체 · Gemini 키 · Google 연동 · 데이터)"
                aria-label="설정 열기"
              >
                <Settings className="w-3.5 h-3.5" />
              </button>
            )}

            {/* Quick Account Switcher Button */}
            <button
              type="button"
              onClick={() => setIsAccountSwitcherOpen(!isAccountSwitcherOpen)}
              className="p-1.5 rounded-xl text-[#7A6A5C] hover:text-[#3E2723] hover:bg-[#F4EFE6] transition-colors"
              title="계정 1초 전환 (새로고침 불필요)"
            >
              <UserCog className="w-3.5 h-3.5" />
            </button>

            {/* Direct Instant Logout */}
            {onLogout && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onLogout();
                }}
                className="p-1.5 rounded-xl text-[#A89A8E] hover:text-[#DC2626] hover:bg-[#FFF5F5] transition-colors"
                title="로그아웃 (새로고침 없이 즉시 전환)"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </aside>
  );
};
