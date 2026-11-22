import React, { useState, useEffect } from 'react';
import {
  Mail,
  Inbox,
  Star,
  Send,
  Trash2,
  RefreshCw,
  Search,
  Plus,
  ArrowLeft,
  CheckCircle2,
  Clock,
  User as UserIcon,
  CornerUpLeft,
  X,
  AlertCircle
} from 'lucide-react';
import { GmailMessageSummary, GmailMessageDetail, User } from '../types';
import {
  fetchRealGmailMessages,
  fetchRealGmailDetail,
  sendRealGmailMessage,
  toggleRealGmailStar,
  markRealGmailRead,
  trashRealGmailMessage,
  getAccessToken,
  signInWithGoogleWorkspace
} from '../services/googleWorkspace';

interface InAppGmailHubProps {
  currentUser: User;
  onBackToChat?: () => void;
  onClose?: () => void;
  onShareToChat?: (content: string) => void;
  onSelectThreadReply?: (subject: string, from: string) => void;
}

export const InAppGmailHub: React.FC<InAppGmailHubProps> = ({
  currentUser,
  onBackToChat,
  onClose,
  onShareToChat,
}) => {
  const [messages, setMessages] = useState<GmailMessageSummary[]>([]);
  const [activeMessage, setActiveMessage] = useState<GmailMessageDetail | null>(null);
  const [selectedFolder, setSelectedFolder] = useState<'INBOX' | 'STARRED' | 'SENT' | 'IMPORTANT'>('INBOX');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [hasToken, setHasToken] = useState<boolean | null>(null);

  // In-app Compose modal
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [composeTo, setComposeTo] = useState('');
  const [composeSubject, setComposeSubject] = useState('');
  const [composeBody, setComposeBody] = useState('');
  const [isSending, setIsSending] = useState(false);

  // In-app Reply
  const [replyText, setReplyText] = useState('');
  const [isReplying, setIsReplying] = useState(false);

  // Toast & confirmation
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string;
    description: string;
    onConfirm: () => void;
  } | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const checkTokenAndLoad = async () => {
    const token = await getAccessToken();
    setHasToken(!!token);
    if (token) {
      loadMessages();
    }
  };

  useEffect(() => {
    checkTokenAndLoad();
  }, [selectedFolder]);

  const loadMessages = async () => {
    setIsLoading(true);
    try {
      const list = await fetchRealGmailMessages(searchQuery, selectedFolder, 30);
      setMessages(list);
    } catch (e) {
      console.warn('Failed to load messages:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadMessages();
  };

  const handleSelectMessage = async (msg: GmailMessageSummary) => {
    setIsLoadingDetail(true);
    try {
      const detail = await fetchRealGmailDetail(msg.id);
      setActiveMessage(detail || { ...msg, bodyText: msg.snippet });
      if (msg.isUnread) {
        await markRealGmailRead(msg.id, true);
        setMessages((prev) =>
          prev.map((m) => (m.id === msg.id ? { ...m, isUnread: false } : m))
        );
      }
    } catch (err) {
      console.warn('Failed to get detail:', err);
    } finally {
      setIsLoadingDetail(false);
    }
  };

  const handleToggleStar = async (e: React.MouseEvent, msgId: string, currentStar: boolean) => {
    e.stopPropagation();
    const next = !currentStar;
    setMessages((prev) =>
      prev.map((m) => (m.id === msgId ? { ...m, isStarred: next } : m))
    );
    if (activeMessage && activeMessage.id === msgId) {
      setActiveMessage({ ...activeMessage, isStarred: next });
    }
    await toggleRealGmailStar(msgId, next);
  };

  const handleDeleteMessage = (msgId: string, subject: string) => {
    setConfirmDialog({
      title: '메일 삭제 확인',
      description: `"${subject}" 메일을 휴지통으로 이동하시겠습니까?`,
      onConfirm: async () => {
        setConfirmDialog(null);
        const ok = await trashRealGmailMessage(msgId);
        if (ok) {
          setMessages((prev) => prev.filter((m) => m.id !== msgId));
          if (activeMessage?.id === msgId) {
            setActiveMessage(null);
          }
          showToast('메일이 휴지통으로 이동되었습니다.');
        } else {
          showToast('메일 삭제에 실패했습니다.');
        }
      },
    });
  };

  const handleSendEmail = async () => {
    if (!composeTo.trim()) {
      showToast('받는 사람 이메일을 입력해주세요.');
      return;
    }
    if (!composeSubject.trim()) {
      showToast('메일 제목을 입력해주세요.');
      return;
    }

    setIsSending(true);
    try {
      const success = await sendRealGmailMessage(composeTo, composeSubject, composeBody);
      if (success) {
        showToast('✓ 이메일이 성공적으로 발송되었습니다.');
        setIsComposeOpen(false);
        setComposeTo('');
        setComposeSubject('');
        setComposeBody('');
        loadMessages();
      } else {
        showToast('이메일 발송 중 오류가 발생했습니다.');
      }
    } catch {
      showToast('이메일 발송 실패.');
    } finally {
      setIsSending(false);
    }
  };

  const handleSendReply = async () => {
    if (!activeMessage || !replyText.trim()) return;

    const recipient = activeMessage.fromEmail;
    const replySubject = activeMessage.subject.startsWith('Re:')
      ? activeMessage.subject
      : `Re: ${activeMessage.subject}`;

    setIsReplying(true);
    try {
      const success = await sendRealGmailMessage(recipient, replySubject, replyText);
      if (success) {
        showToast('✓ 답장 메일이 성공적으로 발송되었습니다.');
        setReplyText('');
      } else {
        showToast('답장 발송 실패.');
      }
    } catch {
      showToast('답장 발송 중 오류가 발생했습니다.');
    } finally {
      setIsReplying(false);
    }
  };

  const handleConnectGoogle = async () => {
    try {
      await signInWithGoogleWorkspace();
      checkTokenAndLoad();
    } catch (e: any) {
      console.warn('OAuth connect failed', e);
      const message = String(e?.message || '');
      if (message.includes('Firebase 설정이 없습니다')) {
        showToast('먼저 설정(⚙) → Google 연동에서 본인 Firebase 설정을 저장해 주세요.');
      } else if (message.includes('popup')) {
        showToast('로그인 창이 차단되었습니다. 브라우저에서 팝업을 허용해 주세요.');
      } else {
        showToast('Google 연결에 실패했습니다. 설정의 Firebase 구성과 승인된 도메인을 확인해 주세요.');
      }
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#FDFBF7] text-[#2C2520] select-text">
      {/* Top Header Bar */}
      <div className="px-5 py-3.5 border-b border-[#E8E2D8] bg-[#FAF7F0] flex items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-3">
          {onBackToChat && (
            <button
              onClick={onBackToChat}
              className="p-1.5 rounded-lg hover:bg-[#EFE9DF] text-[#7A6F66] hover:text-[#2C2520] transition-colors"
              title="채팅으로 복귀"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#EA4335]/10 text-[#EA4335] flex items-center justify-center font-bold">
              <Mail className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-[#2C2520] tracking-tight flex items-center gap-2">
                Gmail 받은편지함
                <span className="text-xs font-normal text-[#7A6F66]">
                  ({currentUser.email || '연동 계정'})
                </span>
              </h2>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsComposeOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#3E2723] hover:bg-[#2C2520] text-white rounded-lg text-xs font-medium shadow-sm transition-colors cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            <span>새 메일 작성</span>
          </button>
          <button
            onClick={loadMessages}
            disabled={isLoading}
            className="p-1.5 rounded-lg hover:bg-[#EFE9DF] text-[#7A6F66] hover:text-[#2C2520] transition-colors"
            title="새로고침"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Main Workspace Body */}
      {hasToken === false ? (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
          <div className="w-16 h-16 rounded-2xl bg-[#EA4335]/10 text-[#EA4335] flex items-center justify-center mb-4">
            <Mail className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-semibold text-[#2C2520] mb-2">Google 계정 권한 연결 필요</h3>
          <p className="text-sm text-[#7A6F66] max-w-md mb-6 leading-relaxed">
            실제 Google 계정의 Gmail을 앱 내부에서 안전하게 읽고 답장하려면 Workspace 연동 권한 승인이 필요합니다.
          </p>
          <button
            onClick={handleConnectGoogle}
            className="px-5 py-2.5 bg-[#3E2723] text-white text-sm font-medium rounded-xl hover:bg-[#2C2520] shadow-sm transition-all cursor-pointer"
          >
            Google Workspace 권한 연결하기
          </button>
        </div>
      ) : (
        <div className="flex-1 flex overflow-hidden">
          {/* Left Column: Folders & Message List */}
          <div className="w-full md:w-96 border-r border-[#E8E2D8] flex flex-col bg-[#FDFBF7] shrink-0">
            {/* Search Box */}
            <form onSubmit={handleSearchSubmit} className="p-3 border-b border-[#E8E2D8]">
              <div className="relative flex items-center">
                <Search className="w-4 h-4 absolute left-3 text-[#A89F91]" />
                <input
                  type="text"
                  placeholder="메일 검색 (보낸사람, 제목)..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-[#E8E2D8] rounded-lg text-[#2C2520] placeholder-[#A89F91] focus:outline-none focus:border-[#8D5B4C]"
                />
              </div>
            </form>

            {/* Folder Tabs */}
            <div className="px-3 py-2 border-b border-[#E8E2D8] flex items-center gap-1 overflow-x-auto text-xs font-medium">
              <button
                onClick={() => setSelectedFolder('INBOX')}
                className={`px-2.5 py-1 rounded-md transition-colors whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                  selectedFolder === 'INBOX' ? 'bg-[#3E2723] text-white' : 'text-[#7A6F66] hover:bg-[#EFE9DF]'
                }`}
              >
                <Inbox className="w-3.5 h-3.5" />
                받은편지함
              </button>
              <button
                onClick={() => setSelectedFolder('STARRED')}
                className={`px-2.5 py-1 rounded-md transition-colors whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                  selectedFolder === 'STARRED' ? 'bg-[#3E2723] text-white' : 'text-[#7A6F66] hover:bg-[#EFE9DF]'
                }`}
              >
                <Star className="w-3.5 h-3.5" />
                별표 편지함
              </button>
              <button
                onClick={() => setSelectedFolder('SENT')}
                className={`px-2.5 py-1 rounded-md transition-colors whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                  selectedFolder === 'SENT' ? 'bg-[#3E2723] text-white' : 'text-[#7A6F66] hover:bg-[#EFE9DF]'
                }`}
              >
                <Send className="w-3.5 h-3.5" />
                보낸편지함
              </button>
            </div>

            {/* Messages List */}
            <div className="flex-1 overflow-y-auto divide-y divide-[#E8E2D8]">
              {isLoading ? (
                <div className="p-8 text-center text-xs text-[#7A6F66]">
                  <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-[#8D5B4C]" />
                  실제 메일을 불러오는 중...
                </div>
              ) : messages.length === 0 ? (
                <div className="p-8 text-center text-xs text-[#7A6F66]">
                  편지함에 메일이 없습니다.
                </div>
              ) : (
                messages.map((msg) => (
                  <div
                    key={msg.id}
                    onClick={() => handleSelectMessage(msg)}
                    className={`p-3.5 cursor-pointer transition-colors text-left flex gap-3 ${
                      activeMessage?.id === msg.id
                        ? 'bg-[#EFE9DF]'
                        : msg.isUnread
                        ? 'bg-white font-medium hover:bg-[#FAF7F0]'
                        : 'bg-[#FDFBF7] hover:bg-[#FAF7F0]'
                    }`}
                  >
                    {/* Star icon */}
                    <button
                      onClick={(e) => handleToggleStar(e, msg.id, msg.isStarred)}
                      className="pt-0.5 text-[#A89F91] hover:text-[#D97706] transition-colors"
                    >
                      <Star
                        className={`w-4 h-4 ${msg.isStarred ? 'fill-[#D97706] text-[#D97706]' : ''}`}
                      />
                    </button>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span
                          className={`text-xs truncate ${
                            msg.isUnread ? 'font-bold text-[#2C2520]' : 'text-[#5A5048]'
                          }`}
                        >
                          {msg.from.replace(/<.*>/, '').trim() || msg.from}
                        </span>
                        <span className="text-[10px] text-[#A89F91] shrink-0 tabular-nums">
                          {msg.date ? new Date(msg.date).toLocaleDateString() : ''}
                        </span>
                      </div>
                      <h4
                        className={`text-xs truncate mb-1 ${
                          msg.isUnread ? 'font-bold text-[#2C2520]' : 'text-[#4A4038]'
                        }`}
                      >
                        {msg.subject}
                      </h4>
                      <p className="text-[11px] text-[#7A6F66] truncate line-clamp-1">
                        {msg.snippet}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Right Column: Mail Detail Reader */}
          <div className="hidden md:flex flex-1 flex-col bg-white overflow-hidden">
            {isLoadingDetail ? (
              <div className="flex-1 flex items-center justify-center text-xs text-[#7A6F66]">
                <RefreshCw className="w-5 h-5 animate-spin mr-2 text-[#8D5B4C]" />
                메일 상세 본문을 불러오는 중...
              </div>
            ) : activeMessage ? (
              <div className="flex-1 flex flex-col overflow-hidden">
                {/* Header */}
                <div className="p-5 border-b border-[#E8E2D8] bg-[#FAF7F0]">
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <h2 className="text-base font-bold text-[#2C2520] tracking-tight leading-snug">
                      {activeMessage.subject}
                    </h2>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={(e) => handleToggleStar(e, activeMessage.id, activeMessage.isStarred)}
                        className="p-1.5 rounded-lg hover:bg-[#EFE9DF] text-[#7A6F66] transition-colors"
                        title="별표 표시"
                      >
                        <Star
                          className={`w-4 h-4 ${
                            activeMessage.isStarred ? 'fill-[#D97706] text-[#D97706]' : ''
                          }`}
                        />
                      </button>
                      <button
                        onClick={() => handleDeleteMessage(activeMessage.id, activeMessage.subject)}
                        className="p-1.5 rounded-lg hover:bg-red-50 text-[#7A6F66] hover:text-red-600 transition-colors"
                        title="메일 삭제"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs text-[#7A6F66]">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-[#EFE9DF] text-[#3E2723] flex items-center justify-center font-bold text-xs">
                        {activeMessage.from.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <span className="font-semibold text-[#2C2520]">{activeMessage.from}</span>
                        {activeMessage.to && (
                          <div className="text-[11px] text-[#A89F91]">받는 사람: {activeMessage.to}</div>
                        )}
                      </div>
                    </div>
                    <span className="text-[11px] text-[#A89F91] tabular-nums">{activeMessage.date}</span>
                  </div>
                </div>

                {/* Email Content Body */}
                <div className="flex-1 p-6 overflow-y-auto bg-white">
                  {activeMessage.bodyHtml ? (
                    <div
                      className="prose prose-sm max-w-none text-[#2C2520] text-sm leading-relaxed"
                      dangerouslySetInnerHTML={{ __html: activeMessage.bodyHtml }}
                    />
                  ) : (
                    <pre className="text-sm font-sans whitespace-pre-wrap text-[#2C2520] leading-relaxed">
                      {activeMessage.bodyText}
                    </pre>
                  )}
                </div>

                {/* Inline Quick Reply Section */}
                <div className="p-4 border-t border-[#E8E2D8] bg-[#FAF7F0]">
                  <div className="flex items-center gap-2 mb-2 text-xs font-semibold text-[#5A5048]">
                    <CornerUpLeft className="w-3.5 h-3.5" />
                    <span>{activeMessage.fromEmail} 님에게 인앱 즉시 답장</span>
                  </div>
                  <div className="flex gap-2">
                    <textarea
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      placeholder="답장 내용을 입력하세요..."
                      rows={2}
                      className="flex-1 p-2.5 text-xs bg-white border border-[#E8E2D8] rounded-xl text-[#2C2520] placeholder-[#A89F91] focus:outline-none focus:border-[#8D5B4C] resize-none"
                    />
                    <button
                      onClick={handleSendReply}
                      disabled={isReplying || !replyText.trim()}
                      className="px-4 bg-[#3E2723] text-white rounded-xl text-xs font-medium hover:bg-[#2C2520] disabled:opacity-50 transition-colors flex items-center gap-1.5 cursor-pointer shrink-0"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>{isReplying ? '발송 중...' : '답장'}</span>
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-[#A89F91]">
                <Mail className="w-12 h-12 stroke-[1.2] mb-3 text-[#D6CFC4]" />
                <p className="text-sm">목록에서 메일을 선택하면 본문이 여기에 표시됩니다.</p>
                <p className="text-xs text-[#B8AF9F] mt-1">외부 창 이동 없이 앱 안에서 바로 읽고 답장할 수 있습니다.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* In-App Compose Email Modal (Apple Mail style sheet) */}
      {isComposeOpen && (
        <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4 backdrop-blur-md transition-all animate-fade-in">
          <div 
            className="w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-[#E8E2D8] overflow-hidden flex flex-col"
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                e.preventDefault();
                handleSendEmail();
              }
            }}
          >
            {/* Header bar */}
            <div className="px-5 py-3.5 border-b border-[#E8E2D8] bg-[#FAF7F0]/90 backdrop-blur-sm flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 mr-2">
                  <button 
                    onClick={() => setIsComposeOpen(false)}
                    className="w-3 h-3 rounded-full bg-[#FF5F56] border border-[#E0443E] hover:opacity-80 transition-opacity" 
                    title="닫기"
                  />
                  <div className="w-3 h-3 rounded-full bg-[#FFBD2E] border border-[#DEA123]" />
                  <div className="w-3 h-3 rounded-full bg-[#27C93F] border border-[#1AAB29]" />
                </div>
                <h3 className="text-xs font-bold text-[#2C2520] flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-[#EA4335]" />
                  새 메일 작성
                </h3>
              </div>
              <button
                onClick={() => setIsComposeOpen(false)}
                className="p-1 rounded-lg hover:bg-[#EFE9DF] text-[#7A6F66] transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Inputs */}
            <div className="p-5 flex flex-col gap-3">
              <div className="flex items-center border-b border-[#F0EBE1] pb-2">
                <label className="w-16 text-xs font-semibold text-[#8C8075] shrink-0">받는 사람</label>
                <input
                  type="email"
                  placeholder="example@gmail.com"
                  value={composeTo}
                  onChange={(e) => setComposeTo(e.target.value)}
                  className="flex-1 text-xs bg-transparent text-[#2C2520] placeholder-[#A89F91] focus:outline-none"
                  autoFocus
                />
              </div>

              <div className="flex items-center border-b border-[#F0EBE1] pb-2">
                <label className="w-16 text-xs font-semibold text-[#8C8075] shrink-0">제목</label>
                <input
                  type="text"
                  placeholder="메일 제목을 입력하세요"
                  value={composeSubject}
                  onChange={(e) => setComposeSubject(e.target.value)}
                  className="flex-1 text-xs bg-transparent text-[#2C2520] placeholder-[#A89F91] focus:outline-none font-medium"
                />
              </div>

              <div className="pt-2">
                <textarea
                  rows={9}
                  placeholder="메일 본문을 자유롭게 작성하세요... (⌘+Enter로 즉시 발송)"
                  value={composeBody}
                  onChange={(e) => setComposeBody(e.target.value)}
                  className="w-full text-xs bg-transparent text-[#2C2520] placeholder-[#A89F91] focus:outline-none resize-none leading-relaxed font-sans"
                />
              </div>
            </div>

            {/* Footer with Apple-style buttons */}
            <div className="px-5 py-3 border-t border-[#E8E2D8] bg-[#FAF7F0] flex items-center justify-between">
              <span className="text-[11px] text-[#A89F91]">
                단축키: <kbd className="px-1.5 py-0.5 bg-white border border-[#E8E2D8] rounded text-[10px] font-mono">⌘/Ctrl + Enter</kbd>
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsComposeOpen(false)}
                  className="px-3.5 py-1.5 text-xs text-[#7A6F66] hover:bg-[#EFE9DF] rounded-xl transition-colors cursor-pointer"
                >
                  취소
                </button>
                <button
                  onClick={handleSendEmail}
                  disabled={isSending}
                  className="flex items-center gap-1.5 px-4 py-1.5 bg-[#3E2723] hover:bg-[#2C2520] active:scale-95 text-white rounded-xl text-xs font-semibold shadow-xs transition-all cursor-pointer disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{isSending ? '발송 중...' : '보내기'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Dialog for Destructive Actions (MANDATORY per Workspace skill) */}
      {confirmDialog && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl border border-[#E8E2D8] p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                <AlertCircle className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-[#2C2520]">{confirmDialog.title}</h3>
            </div>
            <p className="text-xs text-[#7A6F66] leading-relaxed mb-5">
              {confirmDialog.description}
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setConfirmDialog(null)}
                className="px-3.5 py-1.5 text-xs text-[#7A6F66] hover:bg-[#EFE9DF] rounded-lg transition-colors cursor-pointer"
              >
                취소
              </button>
              <button
                onClick={confirmDialog.onConfirm}
                className="px-4 py-1.5 bg-[#3E2723] hover:bg-[#2C2520] text-white rounded-lg text-xs font-medium shadow-sm transition-colors cursor-pointer"
              >
                확인
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 px-4 py-2.5 bg-[#2C2520] text-white rounded-xl shadow-lg text-xs font-medium flex items-center gap-2 animate-fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
};
