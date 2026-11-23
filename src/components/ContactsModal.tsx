import React, { useEffect, useMemo, useState } from 'react';
import {
  X,
  Plus,
  UserPlus,
  Pencil,
  Check,
  Trash2,
  Mail,
  MessageSquare,
  Search,
  AlertCircle,
  Users,
} from 'lucide-react';
import { Contact, normalizeEmail } from '../services/contactsService';
import { avatarSrc, handleAvatarError } from './UserAvatar';

interface ContactsModalProps {
  isOpen: boolean;
  onClose: () => void;
  contacts: Contact[];
  onAdd: (input: { displayName: string; email?: string; userId?: string; note?: string }) => { ok: boolean; message: string };
  onRename: (contactId: string, displayName: string) => void;
  onRemove: (contactId: string) => void;
  onStartDm?: (contact: Contact) => void;
  currentUserId?: string;
}

export const ContactsModal: React.FC<ContactsModalProps> = ({
  isOpen,
  onClose,
  contacts,
  onAdd,
  onRename,
  onRemove,
  onStartDm,
}) => {
  const [query, setQuery] = useState('');
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newNote, setNewNote] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [feedback, setFeedback] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setEditingId(null);
      setNewName('');
      setNewEmail('');
      setNewNote('');
      setFeedback(null);
      setQuery('');
    }
  }, [isOpen]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return contacts;
    return contacts.filter(
      (c) => c.displayName.toLowerCase().includes(q) || c.email.toLowerCase().includes(q) || (c.note || '').toLowerCase().includes(q)
    );
  }, [contacts, query]);

  if (!isOpen) return null;

  const duplicateHint = (() => {
    const email = normalizeEmail(newEmail);
    if (!email) return null;
    const found = contacts.find((c) => normalizeEmail(c.email) === email);
    return found ? `이미 연락처에 있습니다: “${found.displayName}” — 저장하면 중복 생성 없이 이름만 업데이트됩니다.` : null;
  })();

  const submitNew = () => {
    if (!newName.trim()) {
      setFeedback({ kind: 'error', text: '저장할 이름을 입력해 주세요.' });
      return;
    }
    if (!newEmail.trim()) {
      setFeedback({ kind: 'error', text: '상대방 이메일을 입력해 주세요. (중복 확인 기준)' });
      return;
    }
    const result = onAdd({ displayName: newName, email: newEmail, note: newNote });
    setFeedback({ kind: result.ok ? 'ok' : 'error', text: result.message });
    if (result.ok) {
      setNewName('');
      setNewEmail('');
      setNewNote('');
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/45 backdrop-blur-xs p-0 sm:p-4" onClick={onClose}>
      <div
        className="w-full sm:max-w-2xl max-h-[92dvh] bg-white rounded-t-3xl sm:rounded-3xl border border-[#EBE5DA] shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 sm:px-5 py-3 border-b border-[#EBE5DA] bg-[#FAF7F2] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-xl bg-[#E6DCD0] text-[#3E2723]">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#2C2520]">내 연락처</h3>
              <p className="text-[10px] text-[#7A6A5C]">이름을 원하는 대로 저장하세요 · 같은 사람은 중복 등록되지 않습니다</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-[#7A6A5C] hover:bg-[#EBE5DA] cursor-pointer" aria-label="닫기">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 border-b border-[#EBE5DA] bg-white space-y-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="저장할 이름 (예: 우리팀 지훈)"
              className="px-2.5 py-1.5 border border-[#EBE5DA] rounded-xl text-xs focus:outline-none focus:border-[#C18C5D]"
            />
            <input
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="상대방 이메일 (중복 확인)"
              type="email"
              className="px-2.5 py-1.5 border border-[#EBE5DA] rounded-xl text-xs focus:outline-none focus:border-[#C18C5D]"
            />
          </div>
          <div className="flex gap-2">
            <input
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              placeholder="메모 (선택)"
              className="flex-1 px-2.5 py-1.5 border border-[#EBE5DA] rounded-xl text-xs focus:outline-none focus:border-[#C18C5D]"
            />
            <button
              type="button"
              onClick={submitNew}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-[#3E2723] hover:bg-[#2C2520] text-white text-xs font-bold cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              저장
            </button>
          </div>
          {duplicateHint && (
            <p className="text-[10.5px] text-[#B7791F] flex items-start gap-1">
              <AlertCircle className="w-3 h-3 mt-0.5 shrink-0" />
              {duplicateHint}
            </p>
          )}
          {feedback && (
            <p className={`text-[10.5px] ${feedback.kind === 'ok' ? 'text-[#2F855A]' : 'text-[#C53030]'}`}>{feedback.text}</p>
          )}
        </div>

        <div className="px-4 pt-3 pb-2 shrink-0">
          <div className="relative flex items-center">
            <Search className="w-3.5 h-3.5 text-[#A89A8E] absolute left-2.5" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="연락처 검색"
              className="w-full pl-8 pr-2.5 py-1.5 bg-[#FAF7F2] border border-[#EBE5DA] rounded-xl text-[11px] focus:outline-none focus:border-[#C18C5D]"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-5 space-y-1.5">
          {filtered.length === 0 && (
            <div className="py-10 text-center text-[11px] text-[#A89A8E]">
              {contacts.length === 0
                ? '아직 저장한 연락처가 없습니다. 위에서 이름과 이메일을 입력해 추가해 보세요.'
                : '검색 결과가 없습니다.'}
            </div>
          )}
          {filtered.map((contact) => {
            const isEditing = editingId === contact.id;
            return (
              <div key={contact.id} className="flex items-center gap-2 p-2 rounded-2xl border border-[#EBE5DA] bg-white hover:bg-[#FDFBF7]">
                <img
                  src={avatarSrc(contact.avatar, contact.displayName)}
                  onError={handleAvatarError}
                  alt=""
                  className="w-8 h-8 rounded-xl object-cover border border-[#EBE5DA] shrink-0"
                />
                <div className="min-w-0 flex-1">
                  {isEditing ? (
                    <div className="flex items-center gap-1">
                      <input
                        autoFocus
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            onRename(contact.id, editingName);
                            setEditingId(null);
                          }
                          if (e.key === 'Escape') setEditingId(null);
                        }}
                        className="flex-1 px-2 py-1 border border-[#C18C5D] rounded-lg text-xs focus:outline-none"
                      />
                      <button
                        onClick={() => {
                          onRename(contact.id, editingName);
                          setEditingId(null);
                        }}
                        className="p-1 rounded-md bg-[#E6F4EA] text-[#137333] cursor-pointer"
                        title="저장"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-xs font-bold text-[#2C2520] truncate">{contact.displayName}</span>
                      {contact.originalName && contact.originalName !== contact.displayName && (
                        <span className="text-[9.5px] text-[#A89A8E] truncate">({contact.originalName})</span>
                      )}
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-[10px] text-[#7A6A5C] truncate">
                    <Mail className="w-2.5 h-2.5 shrink-0" />
                    <span className="truncate">{contact.email || contact.userId || '이메일 없음'}</span>
                    {contact.note && <span className="truncate text-[#A89A8E]">· {contact.note}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {onStartDm && (
                    <button
                      onClick={() => onStartDm(contact)}
                      className="p-1.5 rounded-lg text-[#7A6A5C] hover:text-[#1A73E8] hover:bg-[#E8F0FE] cursor-pointer"
                      title="1:1 대화 시작"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setEditingId(contact.id);
                      setEditingName(contact.displayName);
                    }}
                    className="p-1.5 rounded-lg text-[#7A6A5C] hover:text-[#3E2723] hover:bg-[#F4EFE6] cursor-pointer"
                    title="이름 바꾸기"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => onRemove(contact.id)}
                    className="p-1.5 rounded-lg text-[#A89A8E] hover:text-[#DC2626] hover:bg-[#FEF2F2] cursor-pointer"
                    title="연락처에서 삭제"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="px-4 py-2.5 border-t border-[#EBE5DA] bg-[#FAF7F2] text-[10px] text-[#7A6A5C] flex items-center gap-1.5 shrink-0">
          <UserPlus className="w-3 h-3.5" />
          저장한 이름은 이 계정에만 적용되며, Google 로그인 시 계정에도 동기화됩니다.
        </div>
      </div>
    </div>
  );
};
