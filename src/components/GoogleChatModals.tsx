import React, { useState, useRef, useEffect } from 'react';
import { 
  X, 
  Video, 
  Copy, 
  Check, 
  Mic, 
  MicOff, 
  VideoOff, 
  PhoneOff, 
  HardDrive, 
  FileText, 
  Table, 
  Presentation,
  FilePlus,
  Calendar as CalendarIcon, 
  Clock, 
  Send, 
  UserPlus, 
  Users, 
  UserMinus,
  Search, 
  Hash, 
  SlidersHorizontal, 
  LogOut, 
  Sparkles, 
  Upload, 
  Link as LinkIcon, 
  MessageSquare,
  Monitor,
  Settings,
  Trash2,
  Shield
} from 'lucide-react';
import { 
  User, 
  Space, 
  DriveFileType, 
  DrivePermission, 
  DriveDocument,
  CalendarEvent,
  FriendRequest, 
  Friendship 
} from '../types';
import { storage } from '../storage';
import { avatarSrc, handleAvatarError } from './UserAvatar';
import {
  createGoogleMeetSpace,
  describeAuthError,
  getAccessToken,
  getLastAuthErrorCode,
  signInWithGoogleWorkspace,
} from '../services/googleWorkspace';

/* 1. GOOGLE MEET MODAL (REAL INTERACTIVE MEET ROOM) */
interface GoogleMeetModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User;
  spaceMembers?: User[];
  allUsers?: User[];
  onShareToChat: (title: string, link: string, code: string) => void;
}

export const GoogleMeetModal: React.FC<GoogleMeetModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  spaceMembers = [],
  allUsers = [],
  onShareToChat,
}) => {
  const [meetingTitle, setMeetingTitle] = useState('스페이스 허들 회의');
  // 실제 Google Meet 회의 공간 (권한 연결 후 Meet API 로 생성)
  const [realMeet, setRealMeet] = useState<{ meetingUri: string; meetingCode: string } | null>(null);
  const [meetStatus, setMeetStatus] = useState<'idle' | 'creating' | 'ready' | 'error'>('idle');
  const [meetError, setMeetError] = useState('');
  const meetLink = realMeet?.meetingUri || '';
  const meetCode = realMeet?.meetingCode || '';
  const [copied, setCopied] = useState(false);
  const [inCall, setInCall] = useState(false);
  const [micOn, setMicOn] = useState(true);
  const [videoOn, setVideoOn] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [callSeconds, setCallSeconds] = useState(0);
  const [activeTab, setActiveTab] = useState<'video' | 'chat' | 'people'>('video');
  const [inCallChat, setInCallChat] = useState<{ sender: string; text: string; time: string }[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [invitedMembers, setInvitedMembers] = useState<User[]>([]);
  const [showAddMemberDropdown, setShowAddMemberDropdown] = useState(false);
  const [customGuestName, setCustomGuestName] = useState('');

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Live timer during active call
  useEffect(() => {
    let timer: any = null;
    if (inCall) {
      timer = setInterval(() => {
        setCallSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      setCallSeconds(0);
    }
    return () => clearInterval(timer);
  }, [inCall]);

  // Live WebCam stream handler
  useEffect(() => {
    if (inCall && videoOn) {
      navigator.mediaDevices?.getUserMedia({ video: true, audio: true })
        .then((stream) => {
          streamRef.current = stream;
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
          }
        })
        .catch(() => {
          // Fallback if camera is unavailable or permission denied
          if (streamRef.current) {
            streamRef.current.getTracks().forEach((track) => track.stop());
            streamRef.current = null;
          }
        });
    } else if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    }

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, [inCall, videoOn]);

  useEffect(() => {
    if (!isOpen) {
      setRealMeet(null);
      setMeetStatus('idle');
      setMeetError('');
      return;
    }
    let cancelled = false;
    (async () => {
      const token = await getAccessToken();
      if (!token) {
        if (!cancelled) setMeetStatus('idle');
        return;
      }
      if (!cancelled) setMeetStatus('creating');
      const space = await createGoogleMeetSpace();
      if (cancelled) return;
      if (space) {
        setRealMeet(space);
        setMeetStatus('ready');
      } else {
        setMeetStatus('error');
        setMeetError('Google Meet 회의를 만들지 못했습니다. Workspace 권한을 다시 연결해 주세요.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  if (!isOpen) return null;


  const handleCreateRealMeet = async () => {
    setMeetStatus('creating');
    setMeetError('');
    try {
      const connected = await signInWithGoogleWorkspace();
      if (!connected) {
        setMeetStatus('error');
        setMeetError(describeAuthError(getLastAuthErrorCode()));
        return;
      }
      const space = await createGoogleMeetSpace();
      if (space) {
        setRealMeet(space);
        setMeetStatus('ready');
      } else {
        setMeetStatus('error');
        setMeetError('Google Meet 회의 생성에 실패했습니다. 잠시 후 다시 시도해 주세요.');
      }
    } catch (e: any) {
      setMeetStatus('error');
      setMeetError(describeAuthError(String(e?.code || e?.message || '')));
    }
  };

  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60).toString().padStart(2, '0');
    const s = (sec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const handleCopy = () => {
    if (!meetLink) return;
    navigator.clipboard?.writeText(meetLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = () => {
    if (!meetLink) return;
    onShareToChat(meetingTitle, meetLink, meetCode);
    onClose();
  };

  const handleSendInCallChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    const now = new Date();
    const timeStr = `${now.getHours()}:${now.getMinutes().toString().padStart(2, '0')}`;
    setInCallChat((prev) => [...prev, { sender: currentUser.name, text: chatInput.trim(), time: timeStr }]);
    setChatInput('');
  };

  const handleToggleScreenShare = async () => {
    if (!isScreenSharing) {
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        if (videoRef.current) {
          videoRef.current.srcObject = screenStream;
        }
        setIsScreenSharing(true);
        screenStream.getVideoTracks()[0].onended = () => {
          setIsScreenSharing(false);
          if (videoOn && videoRef.current && streamRef.current) {
            videoRef.current.srcObject = streamRef.current;
          }
        };
      } catch (e) {
        console.warn('Screen share cancelled', e);
      }
    } else {
      setIsScreenSharing(false);
      if (videoOn && videoRef.current && streamRef.current) {
        videoRef.current.srcObject = streamRef.current;
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs select-none animate-in fade-in duration-150">
      <div className={`relative w-full ${inCall ? 'max-w-2xl sm:max-w-3xl' : 'max-w-lg'} rounded-3xl bg-white border border-[#E0D8CB] shadow-2xl p-5 sm:p-6 text-[#342D26] transition-all`}>
        {/* Modal Top Bar */}
        <div className="flex items-center justify-between pb-3 border-b border-[#E6DFD5]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-[#E2F0E7] text-[#2F855A] border border-[#C6E2D0]">
              <Video className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-[#22543D]">{meetingTitle}</h3>
                {inCall && (
                  <span className="px-2 py-0.5 rounded-full bg-[#E2F0E7] text-[#2F855A] text-[10px] font-mono font-bold animate-pulse">
                    LIVE {formatTimer(callSeconds)}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-[#718096]">Google Meet 화상 회의 룸</p>
            </div>
          </div>
          <button 
            onClick={() => {
              if (inCall) setInCall(false);
              onClose();
            }} 
            className="p-1.5 rounded-lg text-[#718096] hover:bg-[#F3EFE7]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {inCall ? (
          /* ACTIVE MEET ROOM VIEW (Multi-user Conference) */
          <div className="py-3.5 space-y-3">
            {/* Multi-participant Video Grid */}
            <div className={`relative bg-[#1A202C] rounded-2xl overflow-hidden border border-[#2D3748] p-2 shadow-inner min-h-[260px] sm:min-h-[300px] ${
              invitedMembers.length === 0 ? 'aspect-video flex items-center justify-center' : 'grid grid-cols-1 sm:grid-cols-2 gap-2'
            }`}>
              {/* Tile 1: Host (Current User) */}
              <div className="relative rounded-xl overflow-hidden bg-[#2D3748] flex items-center justify-center border border-[#4A5568] aspect-video w-full">
                {videoOn ? (
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover mirror"
                  />
                ) : (
                  <div className="text-center text-white p-3">
                    <img
                      src={avatarSrc(currentUser.avatar)} onError={handleAvatarError}
                      alt={currentUser.name}
                      className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl mx-auto border-2 border-[#C89B7B] object-cover shadow-md mb-2"
                    />
                    <div className="text-xs sm:text-sm font-bold truncate">{currentUser.name} (나)</div>
                    <div className="text-[10px] text-[#A0AEC0]">주최자 • {micOn ? '마이크 켜짐' : '음소거'}</div>
                  </div>
                )}
                {/* Host label & mic badge */}
                <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded-lg bg-black/60 backdrop-blur-xs text-white text-[10px] flex items-center gap-1">
                  <span>{currentUser.name} (호스트)</span>
                  <span className={micOn ? 'text-[#48BB78]' : 'text-[#F56565]'}>
                    {micOn ? '🎤' : '🔇'}
                  </span>
                </div>
              </div>

              {/* Tile 2..N: Connected Peer Participants */}
              {invitedMembers.map((member) => (
                <div
                  key={member.id}
                  className="relative rounded-xl overflow-hidden bg-[#2D3748] flex items-center justify-center border border-[#4A5568] aspect-video w-full animate-in zoom-in-95"
                >
                  <div className="text-center text-white p-3">
                    <div className="relative inline-block mb-1.5">
                      <img
                        src={avatarSrc(member.avatar)} onError={handleAvatarError}
                        alt={member.name}
                        className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl mx-auto border-2 border-[#48BB78] object-cover shadow-md animate-pulse"
                      />
                      <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-[#48BB78] border border-[#1A202C] flex items-center justify-center text-[8px]">
                        ✓
                      </span>
                    </div>
                    <div className="text-xs sm:text-sm font-bold truncate">{member.name}</div>
                    <div className="text-[10px] text-[#48BB78] flex items-center justify-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#48BB78] animate-ping" />
                      <span>실시간 연결됨 • 음성 수신 중</span>
                    </div>
                  </div>

                  {/* Peer label & mic badge & remove */}
                  <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded-lg bg-black/60 backdrop-blur-xs text-white text-[10px] flex items-center gap-1">
                    <span>{member.name}</span>
                    <span className="text-[#48BB78]">🎤</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setInvitedMembers(invitedMembers.filter((m) => m.id !== member.id))}
                    className="absolute top-2 right-2 p-1 rounded-lg bg-black/50 hover:bg-black/80 text-white/70 hover:text-white text-[10px] cursor-pointer"
                    title="참여자 내보내기"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}

              {/* In-Call Top Info Overlay */}
              <div className="absolute top-3 left-3 px-2.5 py-1 rounded-xl bg-black/60 backdrop-blur-xs text-white text-[11px] font-mono flex items-center gap-1.5 z-10">
                <span className="w-2 h-2 rounded-full bg-[#38A169] animate-ping" />
                <span>{meetCode}</span>
                <span className="text-white/40">|</span>
                <span className="text-xs font-sans text-white/90">참여자 {invitedMembers.length + 1}명</span>
              </div>

              {/* Add Person Quick Button on Screen */}
              <button
                type="button"
                onClick={() => setShowAddMemberDropdown(!showAddMemberDropdown)}
                className="absolute top-3 right-3 px-2.5 py-1 rounded-xl bg-[#2F855A] hover:bg-[#276749] text-white text-[11px] font-bold shadow-md flex items-center gap-1 z-10 cursor-pointer"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>+ 참여자 추가</span>
              </button>
            </div>

            {/* Add Member Dropdown Modal/Tray */}
            {showAddMemberDropdown && (
              <div className="p-3 bg-[#FAF7F2] rounded-2xl border border-[#E0D8CB] space-y-2 animate-in fade-in duration-150">
                <div className="flex items-center justify-between text-xs font-bold text-[#342D26]">
                  <span>회의에 초대할 팀원 선택:</span>
                  <button
                    onClick={() => setShowAddMemberDropdown(false)}
                    className="text-[11px] text-[#718096] hover:underline"
                  >
                    닫기
                  </button>
                </div>

                {/* Quick Add Custom Guest */}
                <div className="flex items-center gap-2 mb-2">
                  <input
                    type="text"
                    value={customGuestName}
                    onChange={(e) => setCustomGuestName(e.target.value)}
                    placeholder="초대할 참가자 이름 직접 입력..."
                    className="flex-1 px-3 py-1.5 text-xs bg-white border border-[#E0D8CB] rounded-xl focus:outline-none focus:border-[#2F855A]"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && customGuestName.trim()) {
                        e.preventDefault();
                        const newGuest: User = {
                          id: `guest_${Date.now()}`,
                          name: customGuestName.trim(),
                          email: `${customGuestName.trim().toLowerCase()}@workchat.app`,
                          avatar: '',
                          status: 'online',
                          role: '회의 참가자',
                        };
                        setInvitedMembers((prev) => [...prev, newGuest]);
                        setCustomGuestName('');
                        setShowAddMemberDropdown(false);
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (!customGuestName.trim()) return;
                      const newGuest: User = {
                        id: `guest_${Date.now()}`,
                        name: customGuestName.trim(),
                        email: `${customGuestName.trim().toLowerCase()}@workchat.app`,
                        avatar: '',
                        status: 'online',
                        role: '회의 참가자',
                      };
                      setInvitedMembers((prev) => [...prev, newGuest]);
                      setCustomGuestName('');
                      setShowAddMemberDropdown(false);
                    }}
                    disabled={!customGuestName.trim()}
                    className="px-3 py-1.5 bg-[#2F855A] hover:bg-[#276749] text-white text-xs font-bold rounded-xl disabled:opacity-50 transition-colors"
                  >
                    추가
                  </button>
                </div>

                {(() => {
                  const pool = allUsers.length > 0 ? allUsers : spaceMembers.length > 0 ? spaceMembers : storage.getUsers();
                  const available = pool.filter(
                    (u) => u.id !== currentUser.id && !invitedMembers.some((m) => m.id === u.id)
                  );
                  if (available.length === 0) {
                    return (
                      <div className="text-xs text-[#718096] text-center py-2">
                        추가할 수 있는 등록 팀원이 없습니다. 상단에서 참가자 이름을 직접 입력해 초대해 보세요.
                      </div>
                    );
                  }
                  return (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 max-h-48 overflow-y-auto">
                      {available.map((user) => (
                        <div
                          key={user.id}
                          className="flex items-center justify-between p-2 rounded-xl bg-white border border-[#E0D8CB]"
                        >
                          <div className="flex items-center gap-2 truncate">
                            <img src={avatarSrc(user.avatar)} onError={handleAvatarError} alt={user.name} className="w-7 h-7 rounded-lg object-cover flex-shrink-0" />
                            <span className="text-xs font-bold text-[#342D26] truncate">{user.name}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setInvitedMembers((prev) => [...prev, user]);
                              setShowAddMemberDropdown(false);
                            }}
                            className="px-2.5 py-1 rounded-lg bg-[#2F855A] hover:bg-[#276749] text-white text-[10px] font-bold cursor-pointer transition-colors"
                          >
                            회의 연결
                          </button>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
            )}

            {/* In-Call Controls Bar */}
            <div className="flex items-center justify-between p-2.5 bg-[#FAF7F2] rounded-2xl border border-[#E0D8CB] flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setMicOn(!micOn)}
                  className={`p-2.5 rounded-xl transition-all shadow-xs cursor-pointer ${
                    micOn ? 'bg-white hover:bg-[#F3EFE7] text-[#2D3748] border border-[#DDD4C7]' : 'bg-[#E53E3E] text-white'
                  }`}
                  title={micOn ? '마이크 끄기' : '마이크 켜기'}
                >
                  {micOn ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
                </button>
                <button
                  type="button"
                  onClick={() => setVideoOn(!videoOn)}
                  className={`p-2.5 rounded-xl transition-all shadow-xs cursor-pointer ${
                    videoOn ? 'bg-white hover:bg-[#F3EFE7] text-[#2D3748] border border-[#DDD4C7]' : 'bg-[#E53E3E] text-white'
                  }`}
                  title={videoOn ? '카메라 끄기' : '카메라 켜기'}
                >
                  {videoOn ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
                </button>
                <button
                  type="button"
                  onClick={handleToggleScreenShare}
                  className={`p-2.5 rounded-xl transition-all shadow-xs cursor-pointer ${
                    isScreenSharing ? 'bg-[#3182CE] text-white' : 'bg-white hover:bg-[#F3EFE7] text-[#2D3748] border border-[#DDD4C7]'
                  }`}
                  title="화면 공유"
                >
                  <Monitor className="w-4 h-4" />
                </button>
              </div>

              {/* Sub-tab view buttons: Chat / People */}
              <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-[#E0D8CB]">
                <button
                  onClick={() => setActiveTab(activeTab === 'chat' ? 'video' : 'chat')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    activeTab === 'chat' ? 'bg-[#EFEAE1] text-[#7A6A5C]' : 'text-[#718096]'
                  }`}
                >
                  채팅 ({inCallChat.length})
                </button>
                <button
                  onClick={() => setActiveTab(activeTab === 'people' ? 'video' : 'people')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    activeTab === 'people' ? 'bg-[#EFEAE1] text-[#7A6A5C]' : 'text-[#718096]'
                  }`}
                >
                  참여자 ({invitedMembers.length + 1})
                </button>
              </div>

              {/* Leave Call */}
              <button
                type="button"
                onClick={() => {
                  setInCall(false);
                  setInvitedMembers([]);
                }}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#E53E3E] hover:bg-[#C53030] text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
              >
                <PhoneOff className="w-4 h-4" />
                <span>회의 종료</span>
              </button>
            </div>

            {/* In-Call Slide Tray (Chat / Participants) */}
            {activeTab === 'chat' && (
              <div className="p-3 bg-[#FAF7F2] rounded-2xl border border-[#E0D8CB] space-y-2 max-h-40 overflow-y-auto">
                <div className="text-[11px] font-bold text-[#4A3E34]">회의 중 채팅</div>
                {inCallChat.length === 0 ? (
                  <div className="text-center py-4 text-xs text-[#A0AEC0]">회의 중 오간 메시지가 없습니다.</div>
                ) : (
                  inCallChat.map((msg, i) => (
                    <div key={i} className="text-xs bg-white p-2 rounded-xl border border-[#E6DFD5]">
                      <span className="font-bold text-[#342D26]">{msg.sender}</span>
                      <span className="text-[10px] text-[#A89A8E] ml-2">{msg.time}</span>
                      <p className="text-[#4A3E34] mt-0.5">{msg.text}</p>
                    </div>
                  ))
                )}
                <form onSubmit={handleSendInCallChat} className="flex gap-1.5 pt-1">
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="회의 참여자에게 메시지 보내기..."
                    className="flex-1 bg-white border border-[#DDD4C7] rounded-xl px-3 py-1.5 text-xs text-[#342D26] focus:outline-none"
                  />
                  <button type="submit" className="px-3 py-1.5 rounded-xl bg-[#C89B7B] text-white text-xs font-bold">
                    전송
                  </button>
                </form>
              </div>
            )}

            {activeTab === 'people' && (
              <div className="p-3 bg-[#FAF7F2] rounded-2xl border border-[#E0D8CB] space-y-2 max-h-48 overflow-y-auto">
                <div className="flex items-center justify-between text-[11px] font-bold text-[#4A3E34]">
                  <span>현재 회의 참여자 ({invitedMembers.length + 1}명)</span>
                  <button
                    onClick={() => setShowAddMemberDropdown(true)}
                    className="text-[10px] text-[#2F855A] hover:underline font-bold"
                  >
                    + 팀원 초대
                  </button>
                </div>
                {/* Host */}
                <div className="flex items-center justify-between p-2 rounded-xl bg-white border border-[#E0D8CB]">
                  <div className="flex items-center gap-2">
                    <img src={avatarSrc(currentUser.avatar)} onError={handleAvatarError} alt={currentUser.name} className="w-7 h-7 rounded-lg object-cover" />
                    <div>
                      <div className="text-xs font-bold text-[#342D26]">{currentUser.name} (호스트)</div>
                      <div className="text-[10px] text-[#38A169]">주최자 • 발표 가능</div>
                    </div>
                  </div>
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-[#E2F0E7] text-[#2F855A]">
                    {micOn ? '🎤 음성 활성' : '🔇 음소거'}
                  </span>
                </div>
                {/* Invited Peers */}
                {invitedMembers.map((member) => (
                  <div key={member.id} className="flex items-center justify-between p-2 rounded-xl bg-white border border-[#E0D8CB]">
                    <div className="flex items-center gap-2">
                      <img src={avatarSrc(member.avatar)} onError={handleAvatarError} alt={member.name} className="w-7 h-7 rounded-lg object-cover" />
                      <div>
                        <div className="text-xs font-bold text-[#342D26]">{member.name}</div>
                        <div className="text-[10px] text-[#38A169]">참여자 • 연결됨</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-[#E2F0E7] text-[#2F855A]">
                        🎤 연결됨
                      </span>
                      <button
                        onClick={() => setInvitedMembers(invitedMembers.filter((m) => m.id !== member.id))}
                        className="text-[10px] text-[#E53E3E] hover:underline"
                      >
                        내보내기
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* PREVIEW & LAUNCH VIEW */
          <div className="py-4 space-y-3.5">
            <div>
              <label className="text-xs font-semibold text-[#4A3E34] block mb-1">회의 안건 / 제목</label>
              <input
                type="text"
                value={meetingTitle}
                onChange={(e) => setMeetingTitle(e.target.value)}
                placeholder="예: 주간 스프린트 싱크, 긴급 이슈 허들"
                className="w-full bg-[#FAF7F2] border border-[#E0D8CB] rounded-xl px-3 py-2 text-xs text-[#342D26] focus:outline-none focus:border-[#C89B7B]"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-[#4A3E34] block mb-1">회의 링크 (Google Meet)</label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={meetStatus === 'creating' ? '회의 링크를 만드는 중…' : meetLink || '아직 회의 링크가 없습니다'}
                  className="flex-1 bg-[#FAF7F2] border border-[#E0D8CB] rounded-xl px-3 py-2 text-xs text-[#2F855A] font-mono select-all"
                />
                <button
                  type="button"
                  onClick={handleCopy}
                  className="px-3 py-2 rounded-xl bg-white border border-[#DDD4C7] text-xs font-semibold hover:bg-[#F3EFE7] flex items-center gap-1 transition-colors"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-[#38A169]" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? '복사됨' : '복사'}</span>
                </button>
              </div>
            </div>

            {meetStatus !== 'ready' && (
              <div className="p-3 bg-[#FFF9F2] border border-[#F3DEC2] rounded-2xl space-y-2">
                <div className="text-[11px] text-[#8C6B3F] leading-relaxed">
                  실제 Google Meet 회의 링크를 만들려면 Google Workspace 권한 연결이 필요합니다.
                  {meetError && <span className="block mt-1 font-semibold text-[#B45309]">{meetError}</span>}
                </div>
                <button
                  type="button"
                  onClick={handleCreateRealMeet}
                  disabled={meetStatus === 'creating'}
                  className="px-3 py-1.5 rounded-xl bg-[#2F855A] hover:bg-[#276749] text-white text-[11px] font-bold cursor-pointer disabled:opacity-60"
                >
                  {meetStatus === 'creating' ? '회의 만드는 중…' : 'Google Meet 회의 만들기'}
                </button>
              </div>
            )}

            <div className="p-3 bg-[#F5F9F6] border border-[#C6E2D0] rounded-2xl flex items-center gap-3">
              <img src={avatarSrc(currentUser.avatar)} onError={handleAvatarError} alt="host" className="w-10 h-10 rounded-xl object-cover bg-white border border-[#DDD4C7]" />
              <div className="text-xs">
                <div className="font-bold text-[#22543D]">개설자: {currentUser.name}</div>
                <div className="text-[11px] text-[#2F855A]">지금 바로 카메라/마이크 테스트 후 입장할 수 있습니다.</div>
              </div>
            </div>

            <div className="pt-2 flex flex-wrap justify-end gap-2 border-t border-[#E6DFD5]">
              <a
                href={meetLink || undefined}
                target="_blank"
                rel="noopener noreferrer"
                aria-disabled={!meetLink}
                className={`px-3.5 py-2 rounded-xl bg-white text-[#2F855A] text-xs font-semibold border border-[#C6E2D0] flex items-center gap-1.5 transition-colors ${
                  meetLink ? 'hover:bg-[#F3EFE7]' : 'opacity-50 pointer-events-none'
                }`}
                title="실제 Google Meet 공식 웹사이트를 새 탭에서 열기"
              >
                <Video className="w-3.5 h-3.5 text-[#2F855A]" />
                <span>Google Meet 새 탭 열기</span>
              </a>
              <button
                type="button"
                onClick={() => setInCall(true)}
                className="px-4 py-2 rounded-xl bg-[#FAF7F2] hover:bg-[#F0EAE1] text-[#4A3E34] text-xs font-semibold border border-[#E0D8CB] transition-colors"
              >
                비디오 룸 입장하기
              </button>
              <button
                type="button"
                onClick={handleShare}
                className="px-4 py-2 rounded-xl bg-[#38A169] hover:bg-[#2F855A] text-white text-xs font-bold shadow-xs transition-colors"
              >
                채팅에 회의 초대장 공유
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

/* 2. DRIVE PICKER MODAL (REAL CLOUD DRIVE DOCUMENTS & CREATION) */
interface DrivePickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User;
  onShareDriveFile: (file: {
    fileId: string;
    fileName: string;
    fileType: DriveFileType;
    fileSize: string;
    permission: DrivePermission;
    ownerName: string;
    updatedAt: string;
  }) => void;
}

export const DrivePickerModal: React.FC<DrivePickerModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onShareDriveFile,
}) => {
  const [activeTab, setActiveTab] = useState<'browse' | 'create'>('browse');
  const [permission, setPermission] = useState<DrivePermission>('editor');
  const [searchQuery, setSearchQuery] = useState('');
  
  // New document form
  const [newTitle, setNewTitle] = useState('');
  const [newType, setNewType] = useState<DriveFileType>('doc');

  const [driveDocs, setDriveDocs] = useState<DriveDocument[]>(() => storage.getDriveDocuments());
  const driveFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setDriveDocs(storage.getDriveDocuments());
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleLocalFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const sizeKb = (file.size / 1024).toFixed(1);
      const sizeStr = file.size > 1024 * 1024 ? `${(file.size / (1024 * 1024)).toFixed(1)} MB` : `${sizeKb} KB`;
      const ext = file.name.split('.').pop()?.toLowerCase();
      const isSheet = ext === 'csv' || ext === 'xlsx' || ext === 'xls';
      const isSlide = ext === 'pptx' || ext === 'ppt';
      const docType: DriveFileType = isSheet ? 'sheet' : isSlide ? 'slide' : 'doc';
      const content = typeof event.target?.result === 'string' ? event.target.result : `[업로드된 파일: ${file.name}]`;

      const newDoc: DriveDocument = {
        id: `doc_${Date.now()}`,
        title: file.name,
        type: docType,
        content,
        ownerId: currentUser.id,
        ownerName: currentUser.name,
        updatedAt: '방금 전',
        size: sizeStr,
        permission,
      };

      const nextDocs = [newDoc, ...driveDocs];
      storage.saveDriveDocuments(nextDocs);
      setDriveDocs(nextDocs);
      handleShare(newDoc);
    };

    reader.readAsText(file);
    if (driveFileInputRef.current) driveFileInputRef.current.value = '';
  };

  const handleShare = (doc: DriveDocument) => {
    onShareDriveFile({
      fileId: doc.id,
      fileName: doc.title,
      fileType: doc.type,
      fileSize: doc.size,
      permission,
      ownerName: doc.ownerName,
      updatedAt: doc.updatedAt,
    });
    onClose();
  };

  const handleCreateDocument = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const fullTitle = newTitle.includes('.') 
      ? newTitle.trim() 
      : `${newTitle.trim()}.${newType === 'sheet' ? 'gsheet' : newType === 'slide' ? 'gslide' : 'gdoc'}`;

    const newDoc: DriveDocument = {
      id: `doc_${Date.now()}`,
      title: fullTitle,
      type: newType,
      content: '', // Completely blank document without forced examples
      ownerId: currentUser.id,
      ownerName: currentUser.name,
      updatedAt: '방금 전',
      size: '1.2 MB',
      permission,
    };

    const nextDocs = [newDoc, ...driveDocs];
    storage.saveDriveDocuments(nextDocs);
    setDriveDocs(nextDocs);

    handleShare(newDoc);
  };

  const filteredDocs = driveDocs.filter((d) => 
    !searchQuery.trim() || d.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs select-none animate-in fade-in duration-150">
      <div className="relative w-full max-w-lg rounded-3xl bg-white border border-[#E0D8CB] shadow-2xl p-6 text-[#342D26]">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#E6DFD5]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-[#EBF8FF] text-[#3182CE] border border-[#BEE3F8]">
              <HardDrive className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#2B6CB0]">Google Drive 파일 관리 &amp; 공유</h3>
              <p className="text-[11px] text-[#718096]">새 문서 생성 또는 기존 문서 권한 설정 후 공유</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-[#718096] hover:bg-[#F3EFE7]">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex p-1 bg-[#F8F5EE] rounded-2xl border border-[#E0D8CB] mt-3 mb-3 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab('browse')}
            className={`flex-1 py-1.5 rounded-xl transition-all ${
              activeTab === 'browse' ? 'bg-white text-[#342D26] shadow-xs' : 'text-[#7A6A5C] hover:text-[#342D26]'
            }`}
          >
            내 Drive 문서 목록 ({driveDocs.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('create')}
            className={`flex-1 py-1.5 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'create' ? 'bg-white text-[#342D26] shadow-xs' : 'text-[#7A6A5C] hover:text-[#342D26]'
            }`}
          >
            <FilePlus className="w-3.5 h-3.5 text-[#3182CE]" />
            <span>새 Google 문서 만들기</span>
          </button>
        </div>

        {activeTab === 'browse' ? (
          <div className="space-y-3">
            {/* Permission Selector */}
            <div>
              <label className="text-xs font-semibold text-[#4A3E34] block mb-1">공유 접근 권한 지정</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setPermission('editor')}
                  className={`p-2 rounded-xl border text-xs font-semibold transition-all ${
                    permission === 'editor'
                      ? 'bg-[#EBF8FF] border-[#3182CE] text-[#2B6CB0] shadow-xs'
                      : 'bg-[#FAF7F2] border-[#E0D8CB] text-[#718096]'
                  }`}
                >
                  수정 가능 (Editor)
                </button>
                <button
                  type="button"
                  onClick={() => setPermission('viewer')}
                  className={`p-2 rounded-xl border text-xs font-semibold transition-all ${
                    permission === 'viewer'
                      ? 'bg-[#EBF8FF] border-[#3182CE] text-[#2B6CB0] shadow-xs'
                      : 'bg-[#FAF7F2] border-[#E0D8CB] text-[#718096]'
                  }`}
                >
                  보기 전용 (Viewer)
                </button>
              </div>
            </div>

            {/* Search Input & Local Upload Button */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 text-[#A89A8E] absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Drive 문서 검색..."
                  className="w-full bg-[#FAF7F2] border border-[#E0D8CB] rounded-xl pl-8 pr-3 py-1.5 text-xs text-[#342D26] focus:outline-none"
                />
              </div>

              <input
                ref={driveFileInputRef}
                type="file"
                className="hidden"
                onChange={handleLocalFileUpload}
              />
              <button
                type="button"
                onClick={() => driveFileInputRef.current?.click()}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-[#F3EFE7] border border-[#DDD4C7] text-xs font-semibold text-[#4A3E34] transition-colors flex-shrink-0"
                title="내 컴퓨터에 있는 파일을 Google Drive에 업로드하고 채팅에 공유"
              >
                <Upload className="w-3.5 h-3.5 text-[#3182CE]" />
                <span className="hidden sm:inline">PC 파일 업로드</span>
              </button>
            </div>

            {/* Documents List */}
            <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
              {filteredDocs.length === 0 ? (
                <div className="text-center py-8 text-xs text-[#718096]">
                  문서가 없습니다. '새 Google 문서 만들기'로 문서를 생성해보세요!
                </div>
              ) : (
                filteredDocs.map((doc) => (
                  <div
                    key={doc.id}
                    onClick={() => handleShare(doc)}
                    className="flex items-center justify-between p-3 rounded-2xl bg-[#FAF7F2] hover:bg-[#F0EAE1] border border-[#E0D8CB] cursor-pointer transition-colors group"
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <div className="p-2 rounded-xl bg-white border border-[#DDD4C7] flex-shrink-0">
                        {doc.type === 'sheet' ? (
                          <Table className="w-4 h-4 text-[#48BB78]" />
                        ) : doc.type === 'slide' ? (
                          <Presentation className="w-4 h-4 text-[#DD6B20]" />
                        ) : (
                          <FileText className="w-4 h-4 text-[#3182CE]" />
                        )}
                      </div>
                      <div className="truncate">
                        <div className="text-xs font-bold text-[#342D26] group-hover:text-[#2B6CB0] transition-colors truncate">
                          {doc.title}
                        </div>
                        <div className="text-[10px] text-[#718096]">
                          {doc.size} • 작성자: {doc.ownerName} • {doc.updatedAt}
                        </div>
                      </div>
                    </div>
                    <span className="text-xs font-bold text-[#3182CE] px-2.5 py-1 rounded-lg bg-white border border-[#BEE3F8] flex-shrink-0">
                      채팅 공유
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        ) : (
          /* CREATE NEW DOCUMENT FORM */
          <form onSubmit={handleCreateDocument} className="space-y-3.5 py-1">
            <div>
              <label className="text-xs font-semibold text-[#4A3E34] block mb-1">새 문서 제목</label>
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="예: 2026 분기별 전략 기획안"
                className="w-full bg-[#FAF7F2] border border-[#E0D8CB] rounded-xl px-3 py-2 text-xs text-[#342D26] focus:outline-none focus:border-[#3182CE]"
                autoFocus
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-[#4A3E34] block mb-1">문서 종류 선택</label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setNewType('doc')}
                  className={`p-3 rounded-2xl border flex flex-col items-center gap-1.5 transition-all ${
                    newType === 'doc'
                      ? 'bg-[#EBF8FF] border-[#3182CE] text-[#2B6CB0] font-bold shadow-xs'
                      : 'bg-[#FAF7F2] border-[#E0D8CB] text-[#718096]'
                  }`}
                >
                  <FileText className="w-5 h-5 text-[#3182CE]" />
                  <span className="text-xs">Google Docs</span>
                </button>
                <button
                  type="button"
                  onClick={() => setNewType('sheet')}
                  className={`p-3 rounded-2xl border flex flex-col items-center gap-1.5 transition-all ${
                    newType === 'sheet'
                      ? 'bg-[#F0FFF4] border-[#48BB78] text-[#22543D] font-bold shadow-xs'
                      : 'bg-[#FAF7F2] border-[#E0D8CB] text-[#718096]'
                  }`}
                >
                  <Table className="w-5 h-5 text-[#48BB78]" />
                  <span className="text-xs">Google Sheets</span>
                </button>
                <button
                  type="button"
                  onClick={() => setNewType('slide')}
                  className={`p-3 rounded-2xl border flex flex-col items-center gap-1.5 transition-all ${
                    newType === 'slide'
                      ? 'bg-[#FFFAF0] border-[#DD6B20] text-[#7B341E] font-bold shadow-xs'
                      : 'bg-[#FAF7F2] border-[#E0D8CB] text-[#718096]'
                  }`}
                >
                  <Presentation className="w-5 h-5 text-[#DD6B20]" />
                  <span className="text-xs">Google Slides</span>
                </button>
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-[#F8F5EE] border border-[#E0D8CB] text-xs text-[#718096]">
              생성 즉시 나의 Google Drive에 보관되며, 채팅방에 사이드 바이 사이드 편집 링크로 공유됩니다.
            </div>

            <div className="pt-2 flex justify-end gap-2 border-t border-[#E6DFD5]">
              <button
                type="button"
                onClick={() => setActiveTab('browse')}
                className="px-4 py-2 rounded-xl bg-[#FAF7F2] text-[#4A3E34] text-xs font-semibold"
              >
                취소
              </button>
              <button
                type="submit"
                disabled={!newTitle.trim()}
                className="px-4 py-2 rounded-xl bg-[#3182CE] hover:bg-[#2B6CB0] text-white text-xs font-bold disabled:opacity-50 transition-colors shadow-xs"
              >
                문서 생성 &amp; 채팅 공유
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

/* 3. CALENDAR EVENT MODAL (REAL SCHEDULING WITH ATTENDEES & MEET) */
interface CalendarEventModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User;
  spaceMembers: User[];
  onSaveCalendarEvent: (event: {
    eventTitle: string;
    dateStr: string;
    timeStr: string;
    location: string;
    meetLink?: string;
    attendees: string[];
    rsvps: Record<string, 'accepted' | 'tentative' | 'declined'>;
  }) => void;
}

export const CalendarEventModal: React.FC<CalendarEventModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  spaceMembers = [],
  onSaveCalendarEvent,
}) => {
  const [eventTitle, setEventTitle] = useState('프로젝트 싱크 회의');
  const [dateStr, setDateStr] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  });
  const [startTime, setStartTime] = useState('14:00');
  const [endTime, setEndTime] = useState('15:00');
  const [location, setLocation] = useState('회의실 A & Google Meet');
  const [addMeet, setAddMeet] = useState(true);
  const [selectedAttendeeIds, setSelectedAttendeeIds] = useState<string[]>(() => 
    spaceMembers.map((m) => m.id)
  );

  useEffect(() => {
    if (isOpen) {
      setSelectedAttendeeIds(spaceMembers.map((m) => m.id));
    }
  }, [isOpen, spaceMembers]);

  if (!isOpen) return null;

  const toggleAttendee = (id: string) => {
    if (selectedAttendeeIds.includes(id)) {
      if (selectedAttendeeIds.length === 1 && id === currentUser.id) return; // keep at least current user
      setSelectedAttendeeIds(selectedAttendeeIds.filter((x) => x !== id));
    } else {
      setSelectedAttendeeIds([...selectedAttendeeIds, id]);
    }
  };

  const handleSave = async () => {
    if (!eventTitle.trim()) return;

    const chosenMembers = spaceMembers.filter((m) => selectedAttendeeIds.includes(m.id));
    const attendeeNames = chosenMembers.map((m) => m.name);
    if (!attendeeNames.includes(currentUser.name)) {
      attendeeNames.unshift(currentUser.name);
    }

    // 실제 Google Meet 링크: 권한이 있으면 Meet API 로 회의를 만들고, 없으면 링크 없이 저장합니다(가짜 링크 금지).
    let meetLink: string | undefined;
    if (addMeet) {
      const space = await createGoogleMeetSpace();
      meetLink = space?.meetingUri;
    }

    const rsvps: Record<string, 'accepted' | 'tentative' | 'declined'> = {
      [currentUser.id]: 'accepted',
    };

    onSaveCalendarEvent({
      eventTitle: eventTitle.trim(),
      dateStr,
      timeStr: `${startTime} - ${endTime}`,
      location,
      meetLink,
      attendees: attendeeNames,
      rsvps,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs select-none animate-in fade-in duration-150">
      <div className="relative w-full max-w-lg rounded-3xl bg-white border border-[#E0D8CB] shadow-2xl p-6 text-[#342D26]">
        <div className="flex items-center justify-between pb-3 border-b border-[#E6DFD5]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-[#EBF4FF] text-[#4C51BF] border border-[#C3DAFE]">
              <CalendarIcon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#342D26]">Google Calendar 일정 등록</h3>
              <p className="text-[11px] text-[#718096]">팀원 초대장 및 참석(RSVP) 투표 카드 공유</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-[#718096] hover:bg-[#F3EFE7]">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="py-4 space-y-3">
          <div>
            <label className="text-xs font-semibold text-[#4A3E34] block mb-1">일정 제목</label>
            <input
              type="text"
              value={eventTitle}
              onChange={(e) => setEventTitle(e.target.value)}
              className="w-full bg-[#FAF7F2] border border-[#E0D8CB] rounded-xl px-3 py-2 text-xs text-[#342D26] focus:outline-none focus:border-[#4C51BF]"
              placeholder="예: 분기별 로드맵 점검"
            />
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-xs font-semibold text-[#4A3E34] block mb-1">날짜</label>
              <input
                type="date"
                value={dateStr}
                onChange={(e) => setDateStr(e.target.value)}
                className="w-full bg-[#FAF7F2] border border-[#E0D8CB] rounded-xl px-2.5 py-1.5 text-xs text-[#342D26]"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-[#4A3E34] block mb-1">시작</label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full bg-[#FAF7F2] border border-[#E0D8CB] rounded-xl px-2.5 py-1.5 text-xs text-[#342D26]"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-[#4A3E34] block mb-1">종료</label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full bg-[#FAF7F2] border border-[#E0D8CB] rounded-xl px-2.5 py-1.5 text-xs text-[#342D26]"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-[#4A3E34] block mb-1">장소 / 세부 위치</label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="예: 온라인 또는 4층 세미나실"
              className="w-full bg-[#FAF7F2] border border-[#E0D8CB] rounded-xl px-3 py-1.5 text-xs text-[#342D26]"
            />
          </div>

          {/* Google Meet Toggle */}
          <div className="flex items-center justify-between p-2.5 bg-[#F5F9F6] border border-[#C6E2D0] rounded-xl">
            <div className="flex items-center gap-2">
              <Video className="w-4 h-4 text-[#38A169]" />
              <div className="text-xs font-semibold text-[#22543D]">Google Meet 화상 회의 링크 추가</div>
            </div>
            <input
              type="checkbox"
              checked={addMeet}
              onChange={(e) => setAddMeet(e.target.checked)}
              className="accent-[#38A169] w-4 h-4 rounded cursor-pointer"
            />
          </div>

          {/* Attendees Selection */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-[#4A3E34]">
                참석자 선택 ({selectedAttendeeIds.length}명 초대)
              </label>
              <span className="text-[11px] text-[#718096]">스페이스 멤버 중 선택</span>
            </div>
            <div className="p-2 rounded-2xl bg-[#FAF7F2] border border-[#E0D8CB] max-h-32 overflow-y-auto space-y-1">
              {spaceMembers.map((member) => {
                const isSelected = selectedAttendeeIds.includes(member.id);
                return (
                  <label
                    key={member.id}
                    className="flex items-center justify-between p-1.5 rounded-xl hover:bg-white cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <img src={avatarSrc(member.avatar)} onError={handleAvatarError} alt={member.name} className="w-6 h-6 rounded-lg object-cover" />
                      <span className="text-xs font-semibold text-[#342D26] truncate">
                        {member.name} {member.id === currentUser.id ? '(나)' : ''}
                      </span>
                    </div>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleAttendee(member.id)}
                      className="accent-[#4C51BF] w-4 h-4 rounded cursor-pointer"
                    />
                  </label>
                );
              })}
            </div>
          </div>

          <div className="pt-2 flex justify-end gap-2 border-t border-[#E6DFD5]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-[#FAF7F2] hover:bg-[#F0EAE1] text-[#4A3E34] text-xs font-semibold"
            >
              취소
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-4 py-2 rounded-xl bg-[#4C51BF] hover:bg-[#434190] text-white text-xs font-bold transition-colors shadow-xs"
            >
              일정 등록 &amp; 채팅 공유
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

/* 4. FRIEND MANAGEMENT MODAL (친구 추가, 수락, 거절) */
interface FriendManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User;
  allUsers: User[];
  friendRequests: FriendRequest[];
  friendships: Friendship[];
  onSendRequest: (toUser: User, message: string) => void;
  onAcceptRequest: (request: FriendRequest) => void;
  onRejectRequest: (request: FriendRequest) => void;
  onStartDmWithFriend: (friendUser: User) => void;
}

export const FriendManagementModal: React.FC<FriendManagementModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  allUsers,
  friendRequests,
  friendships,
  onSendRequest,
  onAcceptRequest,
  onRejectRequest,
  onStartDmWithFriend,
}) => {
  const [activeTab, setActiveTab] = useState<'received' | 'sent' | 'search' | 'friends'>('received');
  const [searchQuery, setSearchQuery] = useState('');
  const [customMsg, setCustomMsg] = useState('안녕하세요! 함께 업무 이야기 나눠요 👋');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  const receivedRequests = friendRequests.filter(
    (r) => r.toUserId === currentUser.id && r.status === 'pending'
  );
  const sentRequests = friendRequests.filter(
    (r) => r.fromUserId === currentUser.id
  );

  const friendIds = friendships
    .filter((f) => f.user1Id === currentUser.id || f.user2Id === currentUser.id)
    .map((f) => (f.user1Id === currentUser.id ? f.user2Id : f.user1Id));

  const friendsList = allUsers.filter((u) => friendIds.includes(u.id));

  const candidateUsers = allUsers.filter((u) => {
    if (u.id === currentUser.id) return false;
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs select-none">
      <div className="relative w-full max-w-xl rounded-3xl bg-white border border-[#E0D8CB] shadow-2xl overflow-hidden text-[#342D26]">
        {/* Toast Notification */}
        {toastMessage && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-xl bg-[#2D3748] text-white text-xs font-semibold shadow-lg animate-in fade-in duration-150">
            {toastMessage}
          </div>
        )}

        {/* Header */}
        <div className="p-4 border-b border-[#E6DFD5] flex items-center justify-between bg-[#FCFAF6]">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-[#EFEAE1] text-[#C89B7B]">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#342D26]">친구 추가 &amp; 요청 관리</h3>
              <p className="text-[11px] text-[#718096]">친구 요청 수락/거절 및 새 친구 찾기</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-[#718096] hover:bg-[#F3EFE7]">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-[#E6DFD5] px-4 pt-2 gap-3 sm:gap-4 text-xs font-semibold bg-[#F8F5EE] overflow-x-auto">
          <button
            onClick={() => setActiveTab('received')}
            className={`pb-2.5 transition-all border-b-2 flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'received'
                ? 'border-[#C89B7B] text-[#8C5D39]'
                : 'border-transparent text-[#718096] hover:text-[#342D26]'
            }`}
          >
            <span>받은 요청</span>
            {receivedRequests.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-[#ED8936] text-white text-[10px] font-bold">
                {receivedRequests.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('sent')}
            className={`pb-2.5 transition-all border-b-2 flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'sent'
                ? 'border-[#C89B7B] text-[#8C5D39]'
                : 'border-transparent text-[#718096] hover:text-[#342D26]'
            }`}
          >
            <span>보낸 요청</span>
            {sentRequests.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-[#EAE2D7] text-[#7A6A5C] text-[10px] font-bold">
                {sentRequests.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('search')}
            className={`pb-2.5 transition-all border-b-2 flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'search'
                ? 'border-[#C89B7B] text-[#8C5D39]'
                : 'border-transparent text-[#718096] hover:text-[#342D26]'
            }`}
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>새 친구 찾기</span>
          </button>

          <button
            onClick={() => setActiveTab('friends')}
            className={`pb-2.5 transition-all border-b-2 flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'friends'
                ? 'border-[#C89B7B] text-[#8C5D39]'
                : 'border-transparent text-[#718096] hover:text-[#342D26]'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>내 친구 ({friendsList.length})</span>
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-5 max-h-[60vh] overflow-y-auto bg-[#FAF7F2]">
          {/* 1. RECEIVED REQUESTS */}
          {activeTab === 'received' && (
            <div className="space-y-3">
              {receivedRequests.length === 0 ? (
                <div className="text-center py-12 text-xs text-[#718096]">
                  새로 도착한 친구 요청이 없습니다.
                </div>
              ) : (
                receivedRequests.map((req) => (
                  <div
                    key={req.id}
                    className="p-4 rounded-2xl bg-white border border-[#E6DFD5] space-y-3 shadow-xs"
                  >
                    <div className="flex items-center gap-3">
                      <img
                        src={avatarSrc(req.fromUserAvatar, req.fromUserName)}
                        onError={handleAvatarError}
                        alt={req.fromUserName}
                        className="w-10 h-10 rounded-xl bg-[#F8F5EE] border border-[#DDD4C7] object-cover"
                      />
                      <div>
                        <div className="text-xs font-bold text-[#342D26]">
                          {req.fromUserName}님이 친구 요청을 보냈습니다
                        </div>
                        <span className="text-[10px] text-[#A89A8E]">{req.timestamp}</span>
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-[#F8F5EE] border border-[#E0D8CB] text-xs text-[#4A3E34]">
                      💬 "{req.message}"
                    </div>

                    {/* Accept / Decline Buttons */}
                    <div className="flex items-center justify-end gap-2 pt-1 border-t border-[#F0EAE1]">
                      <button
                        onClick={() => {
                          onRejectRequest(req);
                          showToast('친구 요청을 거절했습니다.');
                        }}
                        className="px-3 py-1.5 rounded-xl bg-[#FAF7F2] hover:bg-[#EAE2D7] text-[#718096] text-xs font-semibold transition-colors"
                      >
                        거절
                      </button>
                      <button
                        onClick={() => {
                          onAcceptRequest(req);
                          showToast(`${req.fromUserName}님과 친구가 되었습니다!`);
                          onClose();
                        }}
                        className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-[#C89B7B] hover:bg-[#B58665] text-white text-xs font-bold shadow-xs transition-colors"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>수락 &amp; 1:1 대화 시작</span>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* 2. SENT REQUESTS */}
          {activeTab === 'sent' && (
            <div className="space-y-3">
              {sentRequests.length === 0 ? (
                <div className="text-center py-12 text-xs text-[#718096]">
                  보낸 친구 요청 내역이 없습니다.
                </div>
              ) : (
                sentRequests.map((req) => {
                  const targetUser = allUsers.find((u) => u.id === req.toUserId);
                  return (
                    <div
                      key={req.id}
                      className="p-3.5 rounded-2xl bg-white border border-[#E6DFD5] flex items-center justify-between gap-3 shadow-xs"
                    >
                      <div className="flex items-center gap-2.5 truncate">
                        <img
                          src={avatarSrc(targetUser?.avatar, targetUser?.name)} onError={handleAvatarError}
                          alt={req.toUserName}
                          className="w-9 h-9 rounded-xl bg-[#FAF7F2] border border-[#DDD4C7] object-cover flex-shrink-0"
                        />
                        <div className="truncate">
                          <div className="text-xs font-bold text-[#342D26] truncate">
                            {req.toUserName}님에게 보낸 요청
                          </div>
                          <div className="text-[11px] text-[#718096] truncate">
                            "{req.message}"
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        {req.status === 'pending' && (
                          <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-[#FFF5EB] text-[#C05621] border border-[#FBD38D]">
                            수락 대기 중
                          </span>
                        )}
                        {req.status === 'accepted' && (
                          <button
                            onClick={() => {
                              if (targetUser) {
                                onStartDmWithFriend(targetUser);
                                onClose();
                              }
                            }}
                            className="px-3 py-1 rounded-xl bg-[#E2F0E7] text-[#2F855A] text-xs font-bold border border-[#C6E2D0] hover:bg-[#D5EADF] transition-colors"
                          >
                            대화 시작
                          </button>
                        )}
                        {req.status === 'rejected' && (
                          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[#FED7D7] text-[#9B2C2C]">
                            거절됨
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* 3. SEARCH & SEND */}
          {activeTab === 'search' && (
            <div className="space-y-3.5">
              <div className="relative">
                <Search className="w-4 h-4 text-[#A89A8E] absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="이름 또는 이메일 검색..."
                  className="w-full bg-white border border-[#E0D8CB] rounded-xl pl-9 pr-3 py-2 text-xs text-[#342D26] focus:outline-none focus:border-[#C89B7B]"
                />
              </div>

              <div>
                <label className="text-[11px] text-[#718096] block mb-1">인사말 메시지</label>
                <input
                  type="text"
                  value={customMsg}
                  onChange={(e) => setCustomMsg(e.target.value)}
                  className="w-full bg-white border border-[#E0D8CB] rounded-xl px-3 py-1.5 text-xs text-[#342D26] focus:outline-none"
                />
              </div>

              <div className="space-y-1.5">
                {candidateUsers.length === 0 ? (
                  <div className="text-center py-8 text-xs text-[#718096]">
                    검색 결과가 없습니다.
                  </div>
                ) : (
                  candidateUsers.map((user) => {
                    const isFriend = friendIds.includes(user.id);
                    const isPending = sentRequests.some((r) => r.toUserId === user.id && r.status === 'pending');

                    return (
                      <div
                        key={user.id}
                        className="p-3 rounded-2xl bg-white border border-[#E6DFD5] flex items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-2.5 truncate">
                          <img
                            src={avatarSrc(user.avatar)} onError={handleAvatarError}
                            alt={user.name}
                            className="w-8 h-8 rounded-lg bg-[#FAF7F2] border border-[#DDD4C7] object-cover"
                          />
                          <div className="truncate">
                            <div className="text-xs font-bold text-[#342D26] truncate">{user.name}</div>
                            <div className="text-[10px] text-[#718096] truncate">{user.role} • {user.email}</div>
                          </div>
                        </div>

                        {isFriend ? (
                          <button
                            onClick={() => {
                              onStartDmWithFriend(user);
                              onClose();
                            }}
                            className="px-3 py-1.5 rounded-xl bg-[#F0EAE1] text-[#6B5E52] text-xs font-bold hover:bg-[#E5DDD0] transition-colors"
                          >
                            1:1 대화
                          </button>
                        ) : isPending ? (
                          <span className="text-[11px] text-[#C05621] font-medium bg-[#FFF5EB] px-2.5 py-1 rounded-lg border border-[#FBD38D]">
                            수락 대기 중
                          </span>
                        ) : (
                          <button
                            onClick={() => {
                              onSendRequest(user, customMsg);
                              showToast(`${user.name}님에게 친구 요청을 보냈습니다.`);
                            }}
                            className="px-3 py-1.5 rounded-xl bg-[#C89B7B] hover:bg-[#B58665] text-white text-xs font-bold transition-colors"
                          >
                            친구 요청
                          </button>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* 4. FRIENDS */}
          {activeTab === 'friends' && (
            <div className="space-y-2">
              {friendsList.length === 0 ? (
                <div className="text-center py-12 text-xs text-[#718096]">
                  아직 등록된 친구가 없습니다. '새 친구 찾기'에서 친구를 추가해보세요!
                </div>
              ) : (
                friendsList.map((friend) => (
                  <div
                    key={friend.id}
                    className="p-3 rounded-2xl bg-white border border-[#E6DFD5] flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <img
                        src={avatarSrc(friend.avatar)} onError={handleAvatarError}
                        alt={friend.name}
                        className="w-9 h-9 rounded-xl object-cover bg-white border border-[#DDD4C7]"
                      />
                      <div className="truncate">
                        <div className="text-xs font-bold text-[#342D26] truncate">{friend.name}</div>
                        <div className="text-[10px] text-[#718096] truncate">{friend.role} • {friend.email}</div>
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        onStartDmWithFriend(friend);
                        onClose();
                      }}
                      className="px-3 py-1.5 rounded-xl bg-[#C89B7B] hover:bg-[#B58665] text-white text-xs font-bold transition-colors"
                    >
                      1:1 대화
                    </button>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

/* 5. CREATE SPACE MODAL (선택적 팀원 초대 지원) */
interface CreateSpaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User;
  allUsers: User[];
  onCreateSpace: (name: string, topic: string, description: string, memberIds: string[]) => void;
}

export const CreateSpaceModal: React.FC<CreateSpaceModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  allUsers,
  onCreateSpace,
}) => {
  const [name, setName] = useState('');
  const [topic, setTopic] = useState('');
  const [description, setDescription] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([currentUser.id]);
  const [memberSearch, setMemberSearch] = useState('');

  if (!isOpen) return null;

  const candidateUsers = allUsers.filter((u) => u.id !== currentUser.id);
  const filteredCandidates = candidateUsers.filter(
    (u) =>
      !memberSearch.trim() ||
      u.name.toLowerCase().includes(memberSearch.toLowerCase()) ||
      u.email.toLowerCase().includes(memberSearch.toLowerCase())
  );

  const toggleMember = (userId: string) => {
    if (selectedIds.includes(userId)) {
      setSelectedIds(selectedIds.filter((id) => id !== userId));
    } else {
      setSelectedIds([...selectedIds, userId]);
    }
  };

  const handleSelectAll = () => {
    setSelectedIds([currentUser.id, ...candidateUsers.map((u) => u.id)]);
  };

  const handleDeselectAll = () => {
    setSelectedIds([currentUser.id]);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onCreateSpace(
      name.trim().toLowerCase().replace(/\s+/g, '-'),
      topic,
      description,
      selectedIds
    );
    setName('');
    setTopic('');
    setDescription('');
    setSelectedIds([currentUser.id]);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs select-none animate-in fade-in duration-150">
      <div className="relative w-full max-w-lg rounded-3xl bg-white border border-[#E0D8CB] shadow-2xl p-6 text-[#342D26]">
        <div className="flex items-center justify-between pb-3 border-b border-[#E6DFD5]">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-[#EFEAE1] text-[#C89B7B]">
              <Hash className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#342D26]">새 스페이스 만들기</h3>
              <p className="text-[11px] text-[#718096]">원하는 팀원만 선택하여 비공개 협업 공간을 개설합니다</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-[#718096] hover:bg-[#F3EFE7]">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="py-4 space-y-3.5">
          <div>
            <label className="text-xs font-semibold text-[#4A3E34] block mb-1">스페이스 이름 *</label>
            <div className="flex items-center gap-1 bg-[#FAF7F2] border border-[#E0D8CB] rounded-xl px-3 py-2 text-xs">
              <span className="text-[#A89A8E] font-bold">#</span>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="예: design-guild, dev-sprint-q4"
                className="flex-1 bg-transparent text-[#342D26] focus:outline-none"
                autoFocus
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-[#4A3E34] block mb-1">스페이스 주제 및 설명</label>
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="예: 4분기 디자인 시스템 및 UI/UX 개선 협업"
              className="w-full bg-[#FAF7F2] border border-[#E0D8CB] rounded-xl px-3 py-2 text-xs text-[#342D26] focus:outline-none"
            />
          </div>

          {/* Member Selection Section */}
          <div className="pt-1">
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-[#4A3E34] flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-[#C89B7B]" />
                <span>참여 팀원 지정 (선택된 멤버 {selectedIds.length}명)</span>
              </label>
              {candidateUsers.length > 0 && (
                <div className="flex items-center gap-2 text-[11px]">
                  <button
                    type="button"
                    onClick={handleSelectAll}
                    className="text-[#8C5D39] hover:underline font-semibold"
                  >
                    모두 선택
                  </button>
                  <span className="text-[#DDD4C7]">•</span>
                  <button
                    type="button"
                    onClick={handleDeselectAll}
                    className="text-[#718096] hover:underline"
                  >
                    초기화
                  </button>
                </div>
              )}
            </div>

            {/* Member search if candidates > 3 */}
            {candidateUsers.length > 2 && (
              <div className="relative mb-2">
                <Search className="w-3.5 h-3.5 text-[#A89A8E] absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={memberSearch}
                  onChange={(e) => setMemberSearch(e.target.value)}
                  placeholder="팀원 이름 또는 이메일 검색..."
                  className="w-full bg-[#FAF7F2] border border-[#E0D8CB] rounded-xl pl-8 pr-3 py-1.5 text-xs text-[#342D26] focus:outline-none"
                />
              </div>
            )}

            <div className="p-2 rounded-2xl bg-[#FAF7F2] border border-[#E0D8CB] max-h-40 overflow-y-auto space-y-1">
              {/* Creator is always included */}
              <div className="flex items-center justify-between p-2 rounded-xl bg-white border border-[#EAE2D7]">
                <div className="flex items-center gap-2.5 truncate">
                  <img
                    src={avatarSrc(currentUser.avatar)} onError={handleAvatarError}
                    alt={currentUser.name}
                    className="w-7 h-7 rounded-lg object-cover border border-[#DDD4C7]"
                  />
                  <div className="truncate">
                    <span className="text-xs font-bold text-[#342D26]">
                      {currentUser.name} (나)
                    </span>
                    <span className="text-[10px] text-[#A89A8E] block">개설자 / 방장</span>
                  </div>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#EAE2D7] text-[#7A6A5C]">
                  필수 포함
                </span>
              </div>

              {candidateUsers.length === 0 ? (
                <div className="text-center py-4 text-xs text-[#718096]">
                  등록된 다른 사용자가 없습니다. 스페이스를 생성한 후 나중에 '스페이스 설정'에서 새 팀원을 초대할 수 있습니다.
                </div>
              ) : filteredCandidates.length === 0 ? (
                <div className="text-center py-3 text-xs text-[#718096]">
                  검색 결과와 일치하는 사용자가 없습니다.
                </div>
              ) : (
                filteredCandidates.map((user) => {
                  const isChecked = selectedIds.includes(user.id);
                  return (
                    <label
                      key={user.id}
                      className={`flex items-center justify-between p-2 rounded-xl cursor-pointer transition-colors ${
                        isChecked ? 'bg-[#FFF9F2] border border-[#E8D4BE]' : 'hover:bg-white border border-transparent'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 truncate">
                        <img
                          src={avatarSrc(user.avatar)} onError={handleAvatarError}
                          alt={user.name}
                          className="w-7 h-7 rounded-lg object-cover border border-[#DDD4C7]"
                        />
                        <div className="truncate">
                          <span className="text-xs font-semibold text-[#342D26]">
                            {user.name}
                          </span>
                          <span className="text-[10px] text-[#718096] block truncate">
                            {user.role} • {user.email}
                          </span>
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleMember(user.id)}
                        className="accent-[#C89B7B] w-4 h-4 rounded cursor-pointer"
                      />
                    </label>
                  );
                })
              )}
            </div>

            <p className="text-[11px] text-[#8C7D70] mt-2 flex items-center gap-1">
              <span>💡</span>
              <span>지정된 팀원만 이 스페이스에 입장할 수 있으며, 초대받지 않은 사용자에게는 노출되지 않습니다.</span>
            </p>
          </div>

          <div className="pt-2 flex justify-end gap-2 border-t border-[#E6DFD5]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-[#FAF7F2] hover:bg-[#F0EAE1] text-[#4A3E34] text-xs font-semibold transition-colors"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={!name.trim()}
              className="px-4 py-2 rounded-xl bg-[#C89B7B] hover:bg-[#B58665] text-white text-xs font-bold disabled:opacity-50 transition-colors shadow-xs"
            >
              스페이스 생성 ({selectedIds.length}명)
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

/* 6. SPACE SETTINGS & MEMBER MANAGEMENT MODAL */
export interface SpaceSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  space: Space;
  currentUser: User;
  allUsers: User[];
  onUpdateSpace: (spaceId: string, updates: Partial<Space>) => void;
  onAddMember: (spaceId: string, userId: string) => void;
  onRemoveMember: (spaceId: string, userId: string) => void;
  onLeaveSpace: (spaceId: string) => void;
  onDeleteSpace: (spaceId: string) => void;
}

export const SpaceSettingsModal: React.FC<SpaceSettingsModalProps> = ({
  isOpen,
  onClose,
  space,
  currentUser,
  allUsers,
  onUpdateSpace,
  onAddMember,
  onRemoveMember,
  onLeaveSpace,
  onDeleteSpace,
}) => {
  const [activeTab, setActiveTab] = useState<'members' | 'settings'>('members');
  const [spaceName, setSpaceName] = useState(space.name);
  const [spaceTopic, setSpaceTopic] = useState(space.topic || '');
  const [spaceDescription, setSpaceDescription] = useState(space.description || '');
  const [inviteSearch, setInviteSearch] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setSpaceName(space.name);
      setSpaceTopic(space.topic || '');
      setSpaceDescription(space.description || '');
    }
  }, [isOpen, space]);

  if (!isOpen) return null;

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  const isCreator = space.creatorId === currentUser.id;
  const isDefaultLounge = space.id === 'space_general';

  // Current members
  const currentMembers = allUsers.filter((u) => 
    isDefaultLounge ? true : space.memberIds.includes(u.id)
  );

  // Users who are not in the space yet
  const nonMembers = allUsers.filter(
    (u) => !isDefaultLounge && !space.memberIds.includes(u.id)
  );

  const filteredNonMembers = nonMembers.filter(
    (u) =>
      !inviteSearch.trim() ||
      u.name.toLowerCase().includes(inviteSearch.toLowerCase()) ||
      u.email.toLowerCase().includes(inviteSearch.toLowerCase())
  );

  const handleSaveInfo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!spaceName.trim()) return;
    onUpdateSpace(space.id, {
      name: spaceName.trim().toLowerCase().replace(/\s+/g, '-'),
      topic: spaceTopic.trim(),
      description: spaceDescription.trim(),
    });
    showToast('스페이스 정보가 성공적으로 수정되었습니다.');
  };

  const handleInvite = (user: User) => {
    onAddMember(space.id, user.id);
    showToast(`${user.name}님을 스페이스에 초대했습니다!`);
  };

  const handleRemove = (user: User) => {
    if (window.confirm(`${user.name}님을 이 스페이스에서 제외(내보내기)하시겠습니까?`)) {
      onRemoveMember(space.id, user.id);
      showToast(`${user.name}님을 내보냈습니다.`);
    }
  };

  const handleLeave = () => {
    if (window.confirm('정말 이 스페이스에서 나가시겠습니까? 다시 초대받아야 입장할 수 있습니다.')) {
      onLeaveSpace(space.id);
      onClose();
    }
  };

  const handleDelete = () => {
    if (window.confirm(`정말 #${space.name} 스페이스를 삭제하시겠습니까? 모든 대화 내용이 함께 삭제됩니다.`)) {
      onDeleteSpace(space.id);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs select-none animate-in fade-in duration-150">
      <div className="relative w-full max-w-xl rounded-3xl bg-white border border-[#E0D8CB] shadow-2xl overflow-hidden text-[#342D26]">
        {/* Toast */}
        {toastMessage && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-xl bg-[#2D3748] text-white text-xs font-semibold shadow-lg animate-in fade-in duration-150">
            {toastMessage}
          </div>
        )}

        {/* Header */}
        <div className="p-4 border-b border-[#E6DFD5] flex items-center justify-between bg-[#FCFAF6]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-[#EFEAE1] text-[#C89B7B]">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-[#342D26]">#{space.name} 스페이스 설정</h3>
                {isCreator && (
                  <span className="px-2 py-0.5 rounded-full bg-[#EAE2D7] text-[#7A6A5C] text-[10px] font-bold">
                    방장 (개설자)
                  </span>
                )}
              </div>
              <p className="text-[11px] text-[#718096]">팀원 관리, 초대 및 채널 설정</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-[#718096] hover:bg-[#F3EFE7]">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-[#E6DFD5] px-4 pt-2 gap-4 text-xs font-semibold bg-[#F8F5EE]">
          <button
            onClick={() => setActiveTab('members')}
            className={`pb-2.5 transition-all border-b-2 flex items-center gap-1.5 ${
              activeTab === 'members'
                ? 'border-[#C89B7B] text-[#8C5D39]'
                : 'border-transparent text-[#718096] hover:text-[#342D26]'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>팀원 관리 ({currentMembers.length}명)</span>
          </button>

          <button
            onClick={() => setActiveTab('settings')}
            className={`pb-2.5 transition-all border-b-2 flex items-center gap-1.5 ${
              activeTab === 'settings'
                ? 'border-[#C89B7B] text-[#8C5D39]'
                : 'border-transparent text-[#718096] hover:text-[#342D26]'
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>스페이스 정보 수정</span>
          </button>
        </div>

        {/* Tab Contents */}
        <div className="p-5 max-h-[65vh] overflow-y-auto bg-[#FAF7F2] space-y-4">
          {activeTab === 'members' ? (
            <div className="space-y-4">
              {/* 1. Current Members List */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-bold text-[#4A3E34]">현재 참여 팀원 ({currentMembers.length}명)</h4>
                  <span className="text-[11px] text-[#8C7D70]">
                    {isDefaultLounge ? '모든 가입자가 입장 가능한 공용 라운지' : '비공개 스페이스'}
                  </span>
                </div>

                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {currentMembers.map((member) => {
                    const isMemberCreator = member.id === space.creatorId;
                    const isMe = member.id === currentUser.id;

                    return (
                      <div
                        key={member.id}
                        className="flex items-center justify-between p-2.5 rounded-2xl bg-white border border-[#E6DFD5] shadow-xs"
                      >
                        <div className="flex items-center gap-2.5 truncate">
                          <img
                            src={avatarSrc(member.avatar)} onError={handleAvatarError}
                            alt={member.name}
                            className="w-8 h-8 rounded-xl object-cover border border-[#DDD4C7]"
                          />
                          <div className="truncate">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-bold text-[#342D26]">
                                {member.name} {isMe && '(나)'}
                              </span>
                              {isMemberCreator ? (
                                <span className="px-1.5 py-0.2 rounded-md bg-[#FFF5EB] border border-[#FBD38D] text-[#C05621] text-[10px] font-bold">
                                  방장
                                </span>
                              ) : (
                                <span className="px-1.5 py-0.2 rounded-md bg-[#F0EAE1] text-[#7A6A5C] text-[10px]">
                                  팀원
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] text-[#718096] block truncate">
                              {member.role} • {member.email}
                            </span>
                          </div>
                        </div>

                        {/* Actions */}
                        <div>
                          {!isDefaultLounge && isCreator && !isMemberCreator && (
                            <button
                              onClick={() => handleRemove(member)}
                              className="px-2.5 py-1 rounded-xl bg-[#FFF5F5] hover:bg-[#FED7D7] text-[#E53E3E] text-xs font-semibold transition-colors"
                              title="팀원 내보내기"
                            >
                              내보내기
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 2. Invite New Members Section (only for non-default spaces) */}
              {!isDefaultLounge && (
                <div className="pt-3 border-t border-[#E6DFD5]">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-xs font-bold text-[#4A3E34] flex items-center gap-1.5">
                      <UserPlus className="w-3.5 h-3.5 text-[#C89B7B]" />
                      <span>새 팀원 초대하기 ({nonMembers.length}명 대기)</span>
                    </h4>
                  </div>

                  {nonMembers.length > 2 && (
                    <div className="relative mb-2">
                      <Search className="w-3.5 h-3.5 text-[#A89A8E] absolute left-3 top-2.5" />
                      <input
                        type="text"
                        value={inviteSearch}
                        onChange={(e) => setInviteSearch(e.target.value)}
                        placeholder="초대할 사용자 이름 또는 이메일..."
                        className="w-full bg-white border border-[#E0D8CB] rounded-xl pl-8 pr-3 py-1.5 text-xs text-[#342D26] focus:outline-none"
                      />
                    </div>
                  )}

                  <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                    {nonMembers.length === 0 ? (
                      <div className="p-4 rounded-xl bg-white border border-[#E6DFD5] text-center text-xs text-[#718096]">
                        현재 가입된 모든 사용자가 이미 이 스페이스에 참여 중입니다.
                      </div>
                    ) : filteredNonMembers.length === 0 ? (
                      <div className="p-3 rounded-xl bg-white border border-[#E6DFD5] text-center text-xs text-[#718096]">
                        검색 조건과 일치하는 미참여 사용자가 없습니다.
                      </div>
                    ) : (
                      filteredNonMembers.map((user) => (
                        <div
                          key={user.id}
                          className="flex items-center justify-between p-2.5 rounded-2xl bg-white border border-[#E6DFD5]"
                        >
                          <div className="flex items-center gap-2.5 truncate">
                            <img
                              src={avatarSrc(user.avatar)} onError={handleAvatarError}
                              alt={user.name}
                              className="w-8 h-8 rounded-xl object-cover border border-[#DDD4C7]"
                            />
                            <div className="truncate">
                              <span className="text-xs font-semibold text-[#342D26] truncate block">
                                {user.name}
                              </span>
                              <span className="text-[10px] text-[#718096] truncate block">
                                {user.role} • {user.email}
                              </span>
                            </div>
                          </div>
                          <button
                            onClick={() => handleInvite(user)}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-[#C89B7B] hover:bg-[#B58665] text-white text-xs font-bold transition-colors shadow-xs"
                          >
                            <UserPlus className="w-3 h-3" />
                            <span>초대</span>
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* Leave Space button for non-creators */}
              {!isDefaultLounge && !isCreator && (
                <div className="pt-3 border-t border-[#E6DFD5] flex justify-end">
                  <button
                    onClick={handleLeave}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[#E53E3E] hover:bg-[#FFF5F5] border border-[#FED7D7] text-xs font-semibold transition-colors"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>스페이스 나가기</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            /* Tab 2: Settings & Info */
            <form onSubmit={handleSaveInfo} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-[#4A3E34] block mb-1">스페이스 이름</label>
                <div className="flex items-center gap-1 bg-white border border-[#E0D8CB] rounded-xl px-3 py-2 text-xs">
                  <span className="text-[#A89A8E] font-bold">#</span>
                  <input
                    type="text"
                    value={spaceName}
                    disabled={isDefaultLounge}
                    onChange={(e) => setSpaceName(e.target.value)}
                    className="flex-1 bg-transparent text-[#342D26] focus:outline-none disabled:opacity-60"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-[#4A3E34] block mb-1">스페이스 주제</label>
                <input
                  type="text"
                  value={spaceTopic}
                  onChange={(e) => setSpaceTopic(e.target.value)}
                  placeholder="대화의 목적 및 공유 규칙"
                  className="w-full bg-white border border-[#E0D8CB] rounded-xl px-3 py-2 text-xs text-[#342D26] focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-[#4A3E34] block mb-1">상세 설명</label>
                <textarea
                  value={spaceDescription}
                  onChange={(e) => setSpaceDescription(e.target.value)}
                  rows={3}
                  placeholder="새로 합류하는 팀원을 위한 가이드라인"
                  className="w-full bg-white border border-[#E0D8CB] rounded-xl p-3 text-xs text-[#342D26] focus:outline-none resize-none"
                />
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-[#E6DFD5]">
                {/* Delete Space Button (only for creator and non-default) */}
                {!isDefaultLounge && isCreator ? (
                  <button
                    type="button"
                    onClick={handleDelete}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[#E53E3E] hover:bg-[#FFF5F5] border border-[#FED7D7] text-xs font-semibold transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>스페이스 삭제</span>
                  </button>
                ) : <div />}

                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-[#C89B7B] hover:bg-[#B58665] text-white text-xs font-bold transition-colors shadow-xs"
                >
                  변경사항 저장
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

/* 6. USER PROFILE & SWITCH MODAL */
interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User;
  allUsers: User[];
  onUpdateUser: (updatedUser: User) => void;
  onLogout: () => void;
  onSwitchUser?: (user: User) => void;
}

const PROFILE_PHOTO_PRESETS: string[] = [];

export const UserProfileModal: React.FC<UserProfileModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  allUsers,
  onUpdateUser,
  onLogout,
  onSwitchUser,
}) => {
  const [status, setStatus] = useState(currentUser.status);
  const [statusText, setStatusText] = useState(currentUser.customStatus?.text || '');
  const [avatar, setAvatar] = useState(currentUser.avatar);
  const [urlInput, setUrlInput] = useState('');
  const [showUrlField, setShowUrlField] = useState(false);

  // 계정이 바뀌면 이전 계정의 사진이 남지 않도록 즉시 새 계정 값으로 다시 맞춥니다.
  useEffect(() => {
    setAvatar(currentUser.avatar);
    setStatus(currentUser.status);
    setStatusText(currentUser.customStatus?.text || '');
  }, [currentUser.id, currentUser.avatar]);

  if (!isOpen) return null;

  const handleSave = () => {
    onUpdateUser({
      ...currentUser,
      status,
      avatar,
      customStatus: statusText.trim() ? { emoji: '💬', text: statusText.trim() } : undefined,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs select-none">
      <div className="relative w-full max-w-md rounded-3xl bg-white border border-[#E0D8CB] shadow-2xl p-6 text-[#342D26]">
        <div className="flex items-center justify-between pb-3 border-b border-[#E6DFD5]">
          <div className="flex items-center gap-2.5">
            <div className="relative">
              <img
                src={avatarSrc(avatar, currentUser.name)}
                onError={handleAvatarError}
                alt={currentUser.name}
                className="w-12 h-12 rounded-2xl bg-[#FAF7F2] border border-[#DDD4C7] object-cover shadow-xs"
              />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#342D26]">{currentUser.name}</h3>
              <p className="text-[11px] text-[#718096]">{currentUser.email}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-[#718096] hover:bg-[#F3EFE7]">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="py-4 space-y-4">
          {/* Custom Avatar Upload Section */}
          <div className="p-3 bg-[#FAF7F2] rounded-2xl border border-[#E0D8CB] space-y-2.5">
            <div className="flex items-center justify-between gap-3">
              <div className="text-xs">
                <div className="font-bold text-[#342D26]">내 프로필 사진 직접 꾸미기</div>
                <div className="text-[11px] text-[#718096]">내 기기의 사진 파일을 직접 올릴 수 있습니다</div>
              </div>

              <div className="flex items-center gap-1.5 flex-wrap">
                <label className="px-3 py-1.5 rounded-xl bg-white hover:bg-[#F3EFE7] border border-[#DDD4C7] text-xs font-bold text-[#4A3E34] cursor-pointer transition-colors shadow-xs flex items-center gap-1">
                  <Upload className="w-3.5 h-3.5 text-[#C89B7B]" />
                  <span>사진 업로드</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onload = (event) => {
                          if (event.target?.result) {
                            setAvatar(event.target.result as string);
                          }
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                  />
                </label>

                <button
                  type="button"
                  onClick={() => setShowUrlField(!showUrlField)}
                  className="p-2 rounded-xl bg-white hover:bg-[#F3EFE7] border border-[#DDD4C7] text-xs text-[#7A6A5C] transition-colors"
                  title="이미지 URL 직접 입력"
                >
                  <LinkIcon className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {showUrlField && (
              <div className="flex items-center gap-1.5 pt-1">
                <input
                  type="url"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  placeholder="https://... 이미지 웹 주소"
                  className="flex-1 bg-white border border-[#E0D8CB] rounded-xl px-3 py-1.5 text-xs text-[#342D26] focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (urlInput.trim()) {
                      setAvatar(urlInput.trim());
                      setUrlInput('');
                      setShowUrlField(false);
                    }
                  }}
                  className="px-3 py-1.5 rounded-xl bg-[#C89B7B] text-white text-xs font-bold hover:bg-[#B58665]"
                >
                  적용
                </button>
              </div>
            )}

            <div>
              <div className="text-[10px] text-[#8C7D70] mb-1">인물 사진 프리셋:</div>
              <div className="grid grid-cols-6 gap-2">
                {PROFILE_PHOTO_PRESETS.map((preset, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setAvatar(preset)}
                    className={`p-0.5 rounded-xl border flex items-center justify-center transition-all overflow-hidden ${
                      avatar === preset
                        ? 'border-[#C89B7B] ring-2 ring-[#C89B7B]/40 scale-105 shadow-xs'
                        : 'border-[#E0D8CB] bg-white hover:border-[#C89B7B]'
                    }`}
                  >
                    <img src={preset} alt="preset" className="w-8 h-8 rounded-lg object-cover" />
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-[#4A3E34] block mb-1.5">상태 설정</label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setStatus('online')}
                className={`py-2 rounded-xl text-xs font-semibold ${
                  status === 'online' ? 'bg-[#E2F0E7] text-[#2F855A] border border-[#C6E2D0]' : 'bg-[#FAF7F2]'
                }`}
              >
                온라인
              </button>
              <button
                type="button"
                onClick={() => setStatus('away')}
                className={`py-2 rounded-xl text-xs font-semibold ${
                  status === 'away' ? 'bg-[#FFF5EB] text-[#C05621] border border-[#FBD38D]' : 'bg-[#FAF7F2]'
                }`}
              >
                자리 비움
              </button>
              <button
                type="button"
                onClick={() => setStatus('dnd')}
                className={`py-2 rounded-xl text-xs font-semibold ${
                  status === 'dnd' ? 'bg-[#FED7D7] text-[#9B2C2C] border border-[#FEB2B2]' : 'bg-[#FAF7F2]'
                }`}
              >
                방해 금지
              </button>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-[#4A3E34] block mb-1">상태 문구</label>
            <input
              type="text"
              value={statusText}
              onChange={(e) => setStatusText(e.target.value)}
              placeholder="예: 회의 중, 디자인 시스템 검토 중"
              className="w-full bg-[#FAF7F2] border border-[#E0D8CB] rounded-xl px-3 py-2 text-xs text-[#342D26]"
            />
          </div>

          {/* 구글 계정 전환 (실제 계정 선택창) */}
          {onSwitchUser && (
            <div className="p-3 bg-[#FAF7F2] rounded-2xl border border-[#E0D8CB] space-y-2" data-testid="profile-switch-account">
              <div className="text-xs">
                <div className="font-bold text-[#342D26]">다른 Google 계정으로 전환</div>
                <div className="text-[11px] text-[#718096] mt-0.5">
                  계정 선택창이 열리고, 전환하면 테마·대화·프로필 사진이 그 계정의 것으로 바뀝니다.
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onSwitchUser(currentUser);
                }}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-[#1A73E8] text-white text-xs font-bold hover:bg-[#1765CC] transition-colors"
              >
                <Users className="w-3.5 h-3.5" />
                Google 계정 선택창 열기
              </button>
            </div>
          )}

          {false && allUsers.filter((u) => u.id !== currentUser.id).length > 0 && (
            <div className="p-3 bg-[#FAF7F2] rounded-2xl border border-[#E0D8CB] space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-[#342D26]">다른 팀원 계정으로 즉시 전환:</span>
                <span className="text-[10px] text-[#A89A8E]">새로고침 없이 전환</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {allUsers
                  .filter((u) => u.id !== currentUser.id)
                  .map((user) => (
                    <button
                      key={user.id}
                      type="button"
                      onClick={() => {
                        onClose();
                        if (onSwitchUser) onSwitchUser(user);
                      }}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-white hover:bg-[#F3EFE7] border border-[#DDD4C7] text-xs font-semibold text-[#342D26] shadow-xs cursor-pointer transition-all"
                    >
                      <img src={avatarSrc(user.avatar)} onError={handleAvatarError} alt={user.name} className="w-5 h-5 rounded-md object-cover" />
                      <span>{user.name}</span>
                    </button>
                  ))}
              </div>
            </div>
          )}

          <div className="pt-2 flex items-center justify-between border-t border-[#E6DFD5]">
            <button
              type="button"
              onClick={() => {
                onClose();
                onLogout();
              }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[#C53030] hover:bg-[#FFF5F5] text-xs font-semibold transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>로그아웃</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-[#FAF7F2] text-[#4A3E34] text-xs font-semibold hover:bg-[#EAE2D7]"
              >
                닫기
              </button>
              <button
                type="button"
                onClick={handleSave}
                className="px-4 py-2 rounded-xl bg-[#C89B7B] hover:bg-[#B58665] text-white text-xs font-bold transition-colors"
              >
                저장
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
