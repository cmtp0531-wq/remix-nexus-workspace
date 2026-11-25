import React, { useEffect, useMemo, useRef, useState } from 'react';
import { X, Search, MessageSquare, Hash, User as UserIcon, Zap, Plus, Bookmark, ArrowRight, CornerDownLeft } from 'lucide-react';
import { Message, Space, User } from '../types';

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  messages: Message[];
  spaces: Space[];
  allUsers: User[];
  onSelectSpace: (spaceId: string) => void;
  onOpenWorkspaceHub?: () => void;
  onOpenCreateSpace?: () => void;
  onSelectSelfNotes?: () => void;
}

export const SearchModal: React.FC<SearchModalProps> = ({
  isOpen,
  onClose,
  messages,
  spaces,
  allUsers,
  onSelectSpace,
  onOpenWorkspaceHub,
  onOpenCreateSpace,
  onSelectSelfNotes,
}) => {
  const [query, setQuery] = useState('');
  // 입력할 때마다 전체 메시지를 필터링하지 않도록 짧게 디바운스합니다 (0.1초 이내 표시).
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'spaces' | 'messages'>('all');
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query), 90);
    return () => window.clearTimeout(timer);
  }, [query]);

  // 열릴 때마다 깨끗한 상태로 시작하고 입력창에 포커스를 줍니다.
  useEffect(() => {
    if (!isOpen) return;
    setQuery('');
    setDebouncedQuery('');
    setFilterType('all');
    const timer = window.setTimeout(() => inputRef.current?.focus(), 30);
    return () => window.clearTimeout(timer);
  }, [isOpen]);

  // ⚠️ 훅 순서가 바뀌면 React #310 으로 화면이 깨지므로, 조기 return 은 모든 훅 뒤에 둡니다.
  const matchedMessages = useMemo(() => {
    const q = debouncedQuery.trim().toLowerCase();
    if (!q) return messages.slice(0, 5);
    return messages
      .filter((m) => m.content.toLowerCase().includes(q) || m.senderName.toLowerCase().includes(q))
      .slice(0, 50);
  }, [debouncedQuery, messages]);

  const matchedSpaces = useMemo(() => {
    const q = debouncedQuery.trim().toLowerCase();
    if (!q) return spaces.slice(0, 6);
    return spaces
      .filter((s) => s.name.toLowerCase().includes(q) || (s.topic && s.topic.toLowerCase().includes(q)))
      .slice(0, 20);
  }, [debouncedQuery, spaces]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[95] flex items-start justify-center pt-16 sm:pt-24 p-4 bg-black/50 backdrop-blur-xs select-none nx-fade-in">
      <div className="relative w-full max-w-xl rounded-2xl bg-[#FDFBF7] border border-[#EBE5DA] cafe-shadow-lg overflow-hidden text-[#2C2520]">
        {/* Search Header */}
        <div className="p-4 border-b border-[#EBE5DA] flex items-center gap-3 bg-white">
          <Search className="w-5 h-5 text-[#C18C5D] flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="빠른 이동 (스페이스, 대화 내용, 바로가기)..."
            className="flex-1 bg-transparent text-sm text-[#2C2520] placeholder-[#A89A8E] focus:outline-none"
            autoFocus
          />
          {query && (
            <button onClick={() => setQuery('')} className="p-1 text-[#A89A8E] hover:text-[#2C2520] rounded-lg">
              <X className="w-4 h-4" />
            </button>
          )}
          <kbd className="text-[10px] bg-[#F4EFE6] px-2 py-0.5 rounded border border-[#EBE5DA] text-[#7A6A5C] font-mono">
            ESC
          </kbd>
        </div>

        {/* Filter Pills */}
        <div className="px-4 py-2 border-b border-[#EBE5DA] bg-[#FDFBF7] flex items-center gap-1.5 text-xs">
          <button
            onClick={() => setFilterType('all')}
            className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
              filterType === 'all' ? 'bg-[#3E2723] text-white font-bold' : 'text-[#7A6A5C] hover:bg-[#F4EFE6]'
            }`}
          >
            전체
          </button>
          <button
            onClick={() => setFilterType('spaces')}
            className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
              filterType === 'spaces' ? 'bg-[#3E2723] text-white font-bold' : 'text-[#7A6A5C] hover:bg-[#F4EFE6]'
            }`}
          >
            스페이스 ({matchedSpaces.length})
          </button>
          <button
            onClick={() => setFilterType('messages')}
            className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
              filterType === 'messages' ? 'bg-[#3E2723] text-white font-bold' : 'text-[#7A6A5C] hover:bg-[#F4EFE6]'
            }`}
          >
            메시지 ({matchedMessages.length})
          </button>
        </div>

        {/* Results List */}
        <div className="max-h-96 overflow-y-auto p-3 space-y-3 bg-[#FDFBF7]">
          {/* Quick Actions (Slack Command Palette style) */}
          {!query.trim() && filterType === 'all' && (
            <div>
              <div className="text-[10px] font-bold text-[#A89A8E] uppercase tracking-wider px-2 mb-1.5">
                빠른 액션 (Quick Actions)
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {onOpenWorkspaceHub && (
                  <button
                    onClick={() => {
                      onOpenWorkspaceHub();
                      onClose();
                    }}
                    className="p-2.5 rounded-xl bg-white hover:bg-[#F4EFE6] border border-[#EBE5DA] text-left text-xs flex items-center justify-between transition-colors shadow-xs"
                  >
                    <div className="flex items-center gap-2">
                      <Zap className="w-4 h-4 text-[#C18C5D]" />
                      <span className="font-bold text-[#2C2520]">Google Workspace 연동 허브</span>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-[#A89A8E]" />
                  </button>
                )}

                {onSelectSelfNotes && (
                  <button
                    onClick={() => {
                      onSelectSelfNotes();
                      onClose();
                    }}
                    className="p-2.5 rounded-xl bg-white hover:bg-[#F4EFE6] border border-[#EBE5DA] text-left text-xs flex items-center justify-between transition-colors shadow-xs"
                  >
                    <div className="flex items-center gap-2">
                      <Bookmark className="w-4 h-4 text-[#C18C5D]" />
                      <span className="font-bold text-[#2C2520]">나의 메모장 (나와 대화하기)</span>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-[#A89A8E]" />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* SPACES */}
          {(filterType === 'all' || filterType === 'spaces') && matchedSpaces.length > 0 && (
            <div>
              <div className="text-[10px] font-bold text-[#A89A8E] uppercase tracking-wider px-2 mb-1.5">
                스페이스 &amp; 채널
              </div>
              <div className="space-y-1">
                {matchedSpaces.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => {
                      onSelectSpace(s.id);
                      onClose();
                    }}
                    className="w-full p-2.5 rounded-xl bg-white hover:bg-[#F4EFE6] border border-[#EBE5DA] text-left text-xs flex items-center justify-between transition-all"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <Hash className="w-3.5 h-3.5 text-[#C18C5D] flex-shrink-0" />
                      <span className="font-bold text-[#2C2520] truncate">{s.name}</span>
                      {s.topic && <span className="text-[10px] text-[#A89A8E] truncate">· {s.topic}</span>}
                    </div>
                    <span className="text-[10px] text-[#A89A8E] flex items-center gap-1">
                      <span>이동</span>
                      <CornerDownLeft className="w-3 h-3" />
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* MESSAGES */}
          {(filterType === 'all' || filterType === 'messages') && matchedMessages.length > 0 && (
            <div>
              <div className="text-[10px] font-bold text-[#A89A8E] uppercase tracking-wider px-2 mb-1.5">
                대화 메시지
              </div>
              <div className="space-y-1">
                {matchedMessages.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => {
                      onSelectSpace(m.spaceId);
                      onClose();
                    }}
                    className="w-full p-2.5 rounded-xl bg-white hover:bg-[#F4EFE6] border border-[#EBE5DA] text-left text-xs transition-all"
                  >
                    <div className="flex items-center justify-between text-[#3E2723] font-bold">
                      <span>{m.senderName}</span>
                      <span className="text-[10px] text-[#A89A8E] font-normal">{m.timestamp}</span>
                    </div>
                    <p className="text-[11px] text-[#5C5046] mt-0.5 line-clamp-1">{m.content}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {matchedSpaces.length === 0 && matchedMessages.length === 0 && (
            <div className="text-center py-8 text-xs text-[#A89A8E]">
              "{query}"에 대한 검색 결과가 없습니다.
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="p-2.5 bg-[#F4EFE6] border-t border-[#EBE5DA] text-[10px] text-[#7A6A5C] flex items-center justify-between px-4">
          <span>Google Workspace &amp; Slack 빠른 탐색 커맨드 팔레트</span>
          <span className="font-mono">⌘K / Ctrl+K 로 언제든지 열기</span>
        </div>
      </div>
    </div>
  );
};
