import React, { useState } from 'react';
import { Bell, Check, X, Users, Video, MessageSquare, UserPlus, Clock, ExternalLink } from 'lucide-react';
import { Invite } from '../services/inviteService';

const typeMeta: Record<Invite['type'], { icon: React.ElementType; label: string; color: string }> = {
  space: { icon: Users, label: '스페이스 초대', color: '#1A73E8' },
  dm: { icon: MessageSquare, label: '1:1 대화 초대', color: '#0F9D58' },
  meeting: { icon: Video, label: '회의 초대', color: '#DC2626' },
  contact: { icon: UserPlus, label: '연락처 공유', color: '#C18C5D' },
};

interface InviteBellProps {
  invites: Invite[];
  onAccept: (invite: Invite) => void;
  onDecline: (invite: Invite) => void;
}

export const InviteBell: React.FC<InviteBellProps> = ({ invites, onAccept, onDecline }) => {
  const [open, setOpen] = useState(false);
  const pending = invites.filter((invite) => invite.status === 'pending');

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative p-1.5 sm:p-2 rounded-xl hover:bg-[#F4EFE6] text-[#7A6A5C] hover:text-[#2C2520] transition-colors cursor-pointer"
        title="초대 알림"
        data-testid="invite-bell"
      >
        <Bell className="w-4 h-4" />
        {pending.length > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[15px] h-[15px] px-0.5 rounded-full bg-[#DC2626] text-white text-[9px] font-bold flex items-center justify-center animate-pulse">
            {pending.length > 9 ? '9+' : pending.length}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-10 z-40 w-[min(88vw,340px)] bg-white border border-[#EBE5DA] rounded-2xl shadow-2xl overflow-hidden">
            <div className="px-3 py-2 border-b border-[#EBE5DA] bg-[#FAF7F2] flex items-center justify-between">
              <span className="text-[11.5px] font-bold text-[#2C2520]">초대 알림</span>
              <span className="text-[10px] text-[#A89A8E]">{pending.length}건 대기</span>
            </div>
            <div className="max-h-72 overflow-y-auto">
              {pending.length === 0 && (
                <div className="py-8 px-4 text-center text-[11px] text-[#A89A8E]">
                  받은 초대가 없습니다.<br />스페이스·회의·연락처 초대가 오면 여기에 표시됩니다.
                </div>
              )}
              {pending.map((invite) => {
                const meta = typeMeta[invite.type] || typeMeta.space;
                const Icon = meta.icon;
                return (
                  <div key={invite.id} className="p-2.5 border-b border-[#F4EFE6] last:border-b-0">
                    <div className="flex items-start gap-2">
                      <div className="p-1.5 rounded-lg shrink-0" style={{ background: `${meta.color}18`, color: meta.color }}>
                        <Icon className="w-3.5 h-3.5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-bold text-[#2C2520] truncate">
                          {meta.label}
                          {invite.spaceName ? ` · #${invite.spaceName}` : ''}
                        </p>
                        <p className="text-[10px] text-[#7A6A5C] leading-snug">
                          <span className="font-semibold">{invite.fromUserName}</span>님이 초대했습니다.
                          {invite.message ? ` “${invite.message}”` : ''}
                        </p>
                        <p className="text-[9px] text-[#A89A8E] flex items-center gap-1 mt-0.5">
                          <Clock className="w-2.5 h-2.5" />
                          {new Date(invite.createdAt).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </p>
                        {invite.meetLink && (
                          <a
                            href={invite.meetLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[9.5px] text-[#0369A1] hover:underline mt-0.5"
                          >
                            회의 링크 <ExternalLink className="w-2.5 h-2.5" />
                          </a>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 mt-1.5 pl-8">
                      <button
                        onClick={() => {
                          onAccept(invite);
                          setOpen(false);
                        }}
                        className="flex items-center gap-1 px-2 py-1 rounded-lg bg-[#22C55E] hover:bg-[#16A34A] text-white text-[10px] font-bold"
                        data-testid={`invite-accept-${invite.id}`}
                      >
                        <Check className="w-3 h-3" /> 수락
                      </button>
                      <button
                        onClick={() => onDecline(invite)}
                        className="flex items-center gap-1 px-2 py-1 rounded-lg bg-[#F4EFE6] hover:bg-[#EBE5DA] text-[#7A6A5C] text-[10px] font-semibold"
                      >
                        <X className="w-3 h-3" /> 거절
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

interface InviteToastsProps {
  invites: Invite[];
  onAccept: (invite: Invite) => void;
  onDecline: (invite: Invite) => void;
  onDismiss: (invite: Invite) => void;
}

/** 새 초대가 도착하면 화면 오른쪽 위에 즉시 뜨는 알림 배너 */
export const InviteToasts: React.FC<InviteToastsProps> = ({ invites, onAccept, onDecline, onDismiss }) => {
  if (invites.length === 0) return null;
  return (
    <div className="fixed top-3 right-3 z-[65] flex flex-col gap-2 w-[min(92vw,340px)]">
      {invites.slice(0, 3).map((invite) => {
        const meta = typeMeta[invite.type] || typeMeta.space;
        const Icon = meta.icon;
        return (
          <div
            key={invite.id}
            className="bg-white border border-[#EBE5DA] rounded-2xl shadow-2xl p-3 animate-in slide-in-from-top-2"
            data-testid="invite-toast"
          >
            <div className="flex items-start gap-2">
              <div className="p-1.5 rounded-lg shrink-0" style={{ background: `${meta.color}18`, color: meta.color }}>
                <Icon className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[11.5px] font-bold text-[#2C2520]">{meta.label}</p>
                <p className="text-[10.5px] text-[#7A6A5C] leading-snug">
                  <b>{invite.fromUserName}</b>님이 초대했습니다{invite.spaceName ? ` · #${invite.spaceName}` : ''}
                </p>
              </div>
              <button onClick={() => onDismiss(invite)} className="p-0.5 rounded text-[#A89A8E] hover:text-[#3E2723]" aria-label="알림 닫기">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="flex items-center gap-1.5 mt-2">
              <button
                onClick={() => onAccept(invite)}
                className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg bg-[#22C55E] hover:bg-[#16A34A] text-white text-[10.5px] font-bold"
              >
                <Check className="w-3 h-3" /> 수락하고 참여
              </button>
              <button
                onClick={() => onDecline(invite)}
                className="px-2.5 py-1.5 rounded-lg bg-[#F4EFE6] hover:bg-[#EBE5DA] text-[#7A6A5C] text-[10.5px] font-semibold"
              >
                거절
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
};
