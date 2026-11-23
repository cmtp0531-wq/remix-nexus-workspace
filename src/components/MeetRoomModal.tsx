import React, { useEffect, useMemo, useState } from 'react';
import {
  Video,
  X,
  Copy,
  Check,
  ExternalLink,
  Share2,
  PhoneOff,
  Plus,
  Mic,
  MonitorUp,
  Info,
  RefreshCw,
  Users,
} from 'lucide-react';
import { MeetingRoom, createNewMeetingRoom } from '../services/meetingService';
import { avatarSrc, handleAvatarError } from './UserAvatar';
import { User } from '../types';

interface MeetRoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  room: MeetingRoom | null;
  spaceName: string;
  members: User[];
  currentUser: User;
  onStartNewMeeting: (title?: string) => Promise<void>;
  onShareToChat: (room: MeetingRoom) => void;
  onCreateRoomForSpace?: () => Promise<MeetingRoom | null>;
}

/**
 * 실제로 열리는 회의실.
 * - 즉시 회의실(Jitsi)은 앱 안에 임베드되어 화상/음성/화면공유가 바로 동작합니다.
 * - Google Meet 링크는 Google 정책상 외부 창에서 열리므로, 같은 링크로 모두 입장할 수 있게 안내합니다.
 */
export const MeetRoomModal: React.FC<MeetRoomModalProps> = ({
  isOpen,
  onClose,
  room,
  spaceName,
  members,
  currentUser,
  onStartNewMeeting,
  onShareToChat,
}) => {
  const [copied, setCopied] = useState(false);
  const [starting, setStarting] = useState(false);
  const [showInfo, setShowInfo] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setCopied(false);
      setStarting(false);
      setShowInfo(false);
    }
  }, [isOpen]);

  const participants = useMemo(() => members.slice(0, 8), [members]);

  if (!isOpen) return null;

  const handleCopy = () => {
    if (!room) return;
    navigator.clipboard?.writeText(room.link);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="fixed inset-0 z-[80] bg-[#0E0B09]/95 backdrop-blur-sm flex items-center justify-center p-0 sm:p-4">
      <div className="w-full h-[100dvh] sm:h-[88dvh] sm:max-h-[92dvh] sm:max-w-5xl bg-[#1A1512] sm:rounded-3xl overflow-hidden flex flex-col border border-white/10 shadow-2xl">
        {/* header */}
        <div className="px-3 sm:px-4 py-2.5 flex items-center gap-2 border-b border-white/10 shrink-0">
          <div className="p-1.5 rounded-xl bg-[#22C55E]/20 text-[#4ADE80]">
            <Video className="w-4 h-4" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-xs sm:text-sm font-bold text-white truncate">
              {room?.title || '회의'} · #{spaceName}
            </h3>
            <p className="text-[10px] text-white/50 truncate">
              {room?.provider === 'google'
                ? 'Google Meet · 링크를 연 사람은 모두 같은 회의로 입장합니다'
                : room
                ? `즉시 회의실 · ${room.code}`
                : '회의를 준비하는 중…'}
            </p>
          </div>
          <span className="hidden sm:flex items-center gap-1 text-[10px] text-white/60 px-2 py-1 rounded-full bg-white/10">
            <span className="w-1.5 h-1.5 rounded-full bg-[#4ADE80] animate-pulse" /> LIVE
          </span>
          <button onClick={onClose} className="p-1.5 rounded-lg text-white/70 hover:bg-white/10" title="회의 화면 닫기">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* stage */}
        <div className="flex-1 min-h-[300px] bg-black relative">
          {room?.provider === 'instant' && room.embedUrl ? (
            <iframe
              title="nexus-meeting"
              src={room.embedUrl}
              allow="camera; microphone; display-capture; autoplay; clipboard-write; fullscreen; speaker"
              allowFullScreen
              className="w-full h-full border-none bg-black"
            />
          ) : room?.provider === 'google' ? (
            <div className="w-full h-full flex flex-col items-center justify-center gap-3 p-6 text-center text-white">
              <div className="w-14 h-14 rounded-2xl bg-[#1A73E8]/20 flex items-center justify-center">
                <Video className="w-7 h-7 text-[#8AB4F8]" />
              </div>
              <h4 className="text-sm font-bold">Google Meet 회의가 만들어졌습니다</h4>
              <p className="text-[11px] text-white/60 max-w-md leading-relaxed">
                Google Meet는 보안 정책상 다른 웹사이트 안에 임베드할 수 없습니다. 아래 버튼으로 열면 <b>모두 같은 회의</b>로 입장합니다.
                채팅방에 자동으로 올라간 링크 카드를 눌러도 같은 방으로 들어옵니다.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-2">
                <a
                  href={room.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#1A73E8] hover:bg-[#1765CC] text-xs font-bold"
                >
                  <ExternalLink className="w-3.5 h-3.5" /> Google Meet로 참여
                </a>
                <button onClick={handleCopy} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-semibold">
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />} 링크 복사
                </button>
              </div>
              <p className="text-[10px] text-white/40 break-all max-w-md">{room.link}</p>
            </div>
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-white/60 text-xs">
              <RefreshCw className="w-5 h-5 animate-spin" /> 새 회의실을 준비하는 중…
            </div>
          )}
        </div>

        {/* controls */}
        <div className="px-3 py-2.5 border-t border-white/10 flex items-center gap-2 flex-wrap shrink-0">
          <div className="flex items-center gap-1.5 mr-auto min-w-0">
            <div className="flex -space-x-1.5">
              {participants.map((m) => (
                <img
                  key={m.id}
                  src={avatarSrc(m.avatar, m.name)}
                  onError={handleAvatarError}
                  alt={m.name}
                  title={m.name}
                  className="w-6 h-6 rounded-full border border-[#1A1512] object-cover"
                />
              ))}
            </div>
            <span className="text-[10px] text-white/60 flex items-center gap-1">
              <Users className="w-3 h-3" /> {members.length}명
            </span>
            {room && (
              <>
                <button
                  onClick={handleCopy}
                  className="ml-1 flex items-center gap-1 px-2 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-[10.5px] font-semibold text-white"
                  title="회의 링크 복사"
                >
                  {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  <span className="hidden sm:inline">{copied ? '복사됨' : '링크 복사'}</span>
                </button>
                <button
                  onClick={() => onShareToChat(room)}
                  className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-[#22C55E]/20 hover:bg-[#22C55E]/30 text-[10.5px] font-bold text-[#4ADE80]"
                  title="채팅방에 회의 링크 올리기"
                >
                  <Share2 className="w-3 h-3" />
                  <span className="hidden sm:inline">채팅에 링크 올리기</span>
                </button>
                {room.provider === 'google' && (
                  <a
                    href={room.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-[10.5px] font-semibold text-white"
                  >
                    <ExternalLink className="w-3 h-3" />
                    <span className="hidden sm:inline">새 탭</span>
                  </a>
                )}
              </>
            )}
            <button
              onClick={() => setShowInfo((v) => !v)}
              className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white/70"
              title="회의 안내"
            >
              <Info className="w-3 h-3" />
            </button>
          </div>

          <button
            onClick={async () => {
              setStarting(true);
              await onStartNewMeeting();
              setStarting(false);
            }}
            disabled={starting}
            className="flex items-center gap-1 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-[11px] font-bold text-white disabled:opacity-60"
            title="지금 회의는 그대로 두고, 완전히 새로운 회의를 하나 더 만듭니다"
          >
            {starting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">새 회의 만들기</span>
          </button>
          <button
            onClick={onClose}
            className="flex items-center gap-1 px-3 py-2 rounded-xl bg-[#DC2626] hover:bg-[#B91C1C] text-[11px] font-bold text-white"
          >
            <PhoneOff className="w-3.5 h-3.5" />
            <span>나가기</span>
          </button>
        </div>

        {showInfo && (
          <div className="px-3 py-2 bg-black/60 text-[10.5px] leading-relaxed text-white/70 border-t border-white/10 space-y-1 shrink-0">
            <p className="flex items-center gap-1"><Mic className="w-3 h-3" /> 마이크·카메라는 브라우저 권한을 허용하면 바로 켜집니다.</p>
            <p className="flex items-center gap-1"><MonitorUp className="w-3 h-3" /> 화면 공유는 회의 화면 하단의 공유 버튼을 사용하세요.</p>
            <p>회의를 시작하면 새 회의 링크가 채팅방에 자동으로 올라가, 같은 방 사람들이 같은 회의로 들어옵니다.</p>
          </div>
        )}
      </div>
    </div>
  );
};
