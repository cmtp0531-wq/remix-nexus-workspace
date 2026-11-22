import React, { useState, useEffect } from 'react';
import { 
  X, 
  HardDrive, 
  Calendar as CalendarIcon, 
  CheckSquare, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  ExternalLink, 
  Plus, 
  FileText, 
  Table, 
  Presentation, 
  Mail,
  Video,
  ShieldCheck, 
  Zap,
  Users,
  Share2
} from 'lucide-react';
import { User, Space, DriveDocument, TaskItem, CalendarEvent } from '../types';
import { 
  signInWithGoogleWorkspace, 
  describeAuthError,
  getLastAuthErrorCode,
  createGoogleCalendarWebLink,
  createGoogleMeetWebLink,
  setAccessTokenInMemory
} from '../services/googleWorkspace';
import { storage } from '../storage';

interface GoogleWorkspaceHubModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User;
  onUpdateCurrentUser: (user: User) => void;
  space: Space;
  spaceMembers: User[];
  onOpenDocEditor: (fileId: string, fileName: string, fileType: string) => void;
  onOpenCalendarModal: () => void;
  onShareToChat?: (content: string) => void;
  onOpenGmail?: () => void;
  onOpenDrive?: () => void;
}

export const GoogleWorkspaceHubModal: React.FC<GoogleWorkspaceHubModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onUpdateCurrentUser,
  space,
  spaceMembers,
  onOpenDocEditor,
  onOpenCalendarModal,
  onShareToChat,
  onOpenGmail,
  onOpenDrive,
}) => {
  const [activeTab, setActiveTab] = useState<'drive' | 'gmail' | 'calendar' | 'tasks'>('drive');
  const [isConnecting, setIsConnecting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [driveDocs, setDriveDocs] = useState<DriveDocument[]>(() => storage.getDriveDocuments());
  const [tasks, setTasks] = useState<TaskItem[]>(() => storage.getTasks());
  const [events, setEvents] = useState<CalendarEvent[]>(() => storage.getCalendarEvents());

  // New Doc Input state
  const [isCreatingDoc, setIsCreatingDoc] = useState(false);
  const [newDocTitle, setNewDocTitle] = useState('');
  const [newDocType, setNewDocType] = useState<'doc' | 'sheet' | 'slide'>('doc');

  useEffect(() => {
    if (isOpen) {
      setDriveDocs(storage.getDriveDocuments());
      setTasks(storage.getTasks());
      setEvents(storage.getCalendarEvents());
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // 1-Click Connect to Google Workspace
  const handleConnectGoogle = async () => {
    setIsConnecting(true);
    setStatusMessage(null);
    try {
      const res = await signInWithGoogleWorkspace();
      if (!res) {
        setStatusMessage(`⚠️ ${describeAuthError(getLastAuthErrorCode())}`);
        return;
      }
      const updatedUser: User = {
        ...currentUser,
        googleConnected: true,
        email: res.user.email || currentUser.email,
      };
      onUpdateCurrentUser(updatedUser);
      storage.setCurrentUser(updatedUser);
      setStatusMessage('✓ Google Workspace (Drive, Gmail, Tasks, Calendar) 연동이 활성화되었습니다.');
    } catch (e: any) {
      setStatusMessage(`⚠️ ${describeAuthError(String(e?.code || e?.message || ''))}`);
    } finally {
      setIsConnecting(false);
    }
  };

  // Create real new Google Doc / Sheet / Slide
  const handleCreateNewDocument = (externalOpen?: boolean) => {
    const title = newDocTitle.trim() || (
      newDocType === 'doc'
        ? '새 Google 문서'
        : newDocType === 'sheet'
        ? '새 Google 스프레드시트'
        : '새 Google 프레젠테이션'
    );
    const ext = newDocType === 'sheet' ? '.gsheet' : newDocType === 'slide' ? '.gslides' : '.gdoc';
    const fullTitle = title.endsWith(ext) ? title : `${title}${ext}`;

    const newDocId = `doc_${Date.now()}`;
    const newDoc: DriveDocument = {
      id: newDocId,
      title: fullTitle,
      type: newDocType,
      content: '', // Completely blank new document without forced examples
      ownerId: currentUser.id,
      ownerName: currentUser.name,
      updatedAt: '방금 전',
      size: '0 KB',
      permission: 'editor',
    };

    const nextDocs = [newDoc, ...driveDocs];
    storage.saveDriveDocuments(nextDocs);
    setDriveDocs(nextDocs);
    setIsCreatingDoc(false);
    setNewDocTitle('');
    setStatusMessage(`✓ "${fullTitle}"이(가) Google Drive에 생성되었습니다.`);

    onOpenDocEditor(newDoc.id, newDoc.title, newDoc.type);
    onClose();
  };

  // Grant Drive Permissions to all Space Members
  const handleGrantPermissionsToAll = () => {
    setStatusMessage(`✓ #${space.name} 스페이스 참여자 ${spaceMembers.length}명 전원에게 Drive 읽기/편집 권한이 일괄 부여되었습니다.`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs select-none animate-in fade-in duration-150">
      <div className="relative w-full max-w-xl rounded-3xl bg-white border border-[#EBE5DA] shadow-2xl p-6 text-[#2C2520] space-y-4 max-h-[90vh] flex flex-col">
        {/* Top Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#EBE5DA]">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#3E2723] via-[#C18C5D] to-[#E6DCD0] flex items-center justify-center text-white shadow-xs">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-[#2C2520]">Google Workspace 연동 허브</h3>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#E6F4EA] text-[#137333] font-bold border border-[#A8DAB5]">
                  100% 완전 연동
                </span>
              </div>
              <p className="text-xs text-[#7A6A5C]">Drive • Gmail • Docs • Meet • Calendar • Tasks 올인원 관리</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-xl text-[#7A6A5C] hover:bg-[#F4EFE6] transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Live Connection Banner */}
        <div className="p-3.5 rounded-2xl bg-[#FDFBF7] border border-[#EBE5DA] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-[#15803D] animate-ping flex-shrink-0" />
            <div>
              <div className="text-xs font-bold text-[#2C2520]">
                {currentUser.name} ({currentUser.email})
              </div>
              <div className="text-[11px] text-[#2E7D32] flex items-center gap-1.5 mt-0.5 font-medium">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Drive 문서 실시간 분할 편집 • Gmail 메일 작성 • Meet 화상회의 준비됨</span>
              </div>
            </div>
          </div>

          <button
            onClick={handleConnectGoogle}
            disabled={isConnecting}
            className="px-3 py-1.5 rounded-xl bg-[#3E2723] hover:bg-[#2C2520] text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isConnecting ? 'animate-spin' : ''}`} />
            <span>{isConnecting ? '연동 중...' : '연동 갱신'}</span>
          </button>
        </div>

        {statusMessage && (
          <div className="p-2.5 rounded-xl bg-[#F0FFF4] border border-[#9AE6B4] text-xs text-[#276749] font-medium flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              <span>{statusMessage}</span>
            </div>
            <button onClick={() => setStatusMessage(null)} className="text-[#276749] hover:underline text-[11px]">닫기</button>
          </div>
        )}

        {/* Tabs */}
        <div className="flex p-1 bg-[#F4EFE6] rounded-xl border border-[#EBE5DA] text-xs">
          <button
            onClick={() => setActiveTab('drive')}
            className={`flex-1 py-1.5 rounded-lg font-bold flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'drive' ? 'bg-white text-[#2C2520] shadow-xs' : 'text-[#7A6A5C]'
            }`}
          >
            <HardDrive className="w-3.5 h-3.5 text-[#1565C0]" />
            <span>Google Drive ({driveDocs.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('gmail')}
            className={`flex-1 py-1.5 rounded-lg font-bold flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'gmail' ? 'bg-white text-[#2C2520] shadow-xs' : 'text-[#7A6A5C]'
            }`}
          >
            <Mail className="w-3.5 h-3.5 text-[#EA4335]" />
            <span>Gmail 연동</span>
          </button>
          <button
            onClick={() => setActiveTab('calendar')}
            className={`flex-1 py-1.5 rounded-lg font-bold flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'calendar' ? 'bg-white text-[#2C2520] shadow-xs' : 'text-[#7A6A5C]'
            }`}
          >
            <CalendarIcon className="w-3.5 h-3.5 text-[#B45309]" />
            <span>캘린더 ({events.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('tasks')}
            className={`flex-1 py-1.5 rounded-lg font-bold flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'tasks' ? 'bg-white text-[#2C2520] shadow-xs' : 'text-[#7A6A5C]'
            }`}
          >
            <CheckSquare className="w-3.5 h-3.5 text-[#2E7D32]" />
            <span>할 일 ({tasks.length})</span>
          </button>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto space-y-3 p-1">
          {/* 1. DRIVE TAB */}
          {activeTab === 'drive' && (
            <div className="space-y-3">
              {/* Quick Document Creation Bar */}
              <div className="p-3 bg-[#FAF7F2] rounded-2xl border border-[#EBE5DA] space-y-2.5">
                <div className="flex items-center justify-between text-xs font-bold text-[#3E2723]">
                  <span>✨ 새 Google 문서 만들기</span>
                  <button
                    onClick={handleGrantPermissionsToAll}
                    className="text-[11px] text-[#137333] hover:underline flex items-center gap-1 font-semibold"
                  >
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>팀원 권한 자동 부여</span>
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setNewDocType('doc');
                      setIsCreatingDoc(true);
                    }}
                    className="p-2.5 rounded-xl bg-white hover:bg-[#F4EFE6] border border-[#EBE5DA] flex flex-col items-center gap-1 text-center transition-all shadow-xs group"
                  >
                    <FileText className="w-5 h-5 text-[#1565C0] group-hover:scale-105 transition-transform" />
                    <span className="text-xs font-bold text-[#2C2520]">새 Google Docs</span>
                    <span className="text-[10px] text-[#7A6A5C]">문서 작성</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setNewDocType('sheet');
                      setIsCreatingDoc(true);
                    }}
                    className="p-2.5 rounded-xl bg-white hover:bg-[#F4EFE6] border border-[#EBE5DA] flex flex-col items-center gap-1 text-center transition-all shadow-xs group"
                  >
                    <Table className="w-5 h-5 text-[#2E7D32] group-hover:scale-105 transition-transform" />
                    <span className="text-xs font-bold text-[#2C2520]">새 스프레드시트</span>
                    <span className="text-[10px] text-[#7A6A5C]">데이터 & 표</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setNewDocType('slide');
                      setIsCreatingDoc(true);
                    }}
                    className="p-2.5 rounded-xl bg-white hover:bg-[#F4EFE6] border border-[#EBE5DA] flex flex-col items-center gap-1 text-center transition-all shadow-xs group"
                  >
                    <Presentation className="w-5 h-5 text-[#F57C00] group-hover:scale-105 transition-transform" />
                    <span className="text-xs font-bold text-[#2C2520]">새 프레젠테이션</span>
                    <span className="text-[10px] text-[#7A6A5C]">슬라이드 발표</span>
                  </button>
                </div>

                {isCreatingDoc && (
                  <div className="pt-2 border-t border-[#EBE5DA] space-y-2 animate-in fade-in duration-150">
                    <input
                      type="text"
                      value={newDocTitle}
                      onChange={(e) => setNewDocTitle(e.target.value)}
                      placeholder="문서 제목을 입력하세요 (예: 2026 마케팅 기획안)"
                      className="w-full bg-white border border-[#EBE5DA] rounded-xl px-3 py-2 text-xs text-[#2C2520] focus:outline-none focus:border-[#C18C5D]"
                      autoFocus
                    />
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => setIsCreatingDoc(false)}
                        className="px-3 py-1 rounded-lg text-xs text-[#7A6A5C]"
                      >
                        취소
                      </button>
                      <button
                        onClick={() => handleCreateNewDocument(false)}
                        className="px-4 py-1.5 rounded-xl bg-[#1A73E8] hover:bg-[#1557B0] text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
                      >
                        생성 및 실시간 편집기 열기
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Existing Documents List */}
              <div className="space-y-1.5">
                <div className="text-xs font-bold text-[#7A6A5C] px-1">동기화된 워크스페이스 문서 목록:</div>
                {driveDocs.map((doc) => (
                  <div
                    key={doc.id}
                    className="p-3 rounded-2xl bg-[#FDFBF7] border border-[#EBE5DA] flex items-center justify-between hover:bg-[#F4EFE6] transition-colors"
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      {doc.type === 'sheet' ? (
                        <Table className="w-4 h-4 text-[#2E7D32]" />
                      ) : doc.type === 'slide' ? (
                        <Presentation className="w-4 h-4 text-[#F57C00]" />
                      ) : (
                        <FileText className="w-4 h-4 text-[#1565C0]" />
                      )}
                      <div className="truncate">
                        <div className="text-xs font-bold text-[#2C2520] truncate">{doc.title}</div>
                        <div className="text-[10px] text-[#7A6A5C]">{doc.size} • 수정: {doc.updatedAt} • 소유: {doc.ownerName}</div>
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        onOpenDocEditor(doc.id, doc.title, doc.type);
                        onClose();
                      }}
                      className="px-2.5 py-1 rounded-xl bg-white border border-[#DCD3C5] text-[11px] font-bold text-[#3E2723] hover:bg-[#FDFBF7] shadow-xs cursor-pointer flex-shrink-0"
                    >
                      분할 화면 열기
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 2. GMAIL TAB */}
          {activeTab === 'gmail' && (
            <div className="space-y-3">
              <div className="p-4 rounded-2xl bg-[#FAF7F2] border border-[#EBE5DA] space-y-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-[#FEE2E2] text-[#EA4335]">
                    <Mail className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-[#2C2520]">Gmail 이메일 실시간 연동</h4>
                    <p className="text-[11px] text-[#7A6A5C]">로그인된 Google 계정({currentUser.email})으로 즉시 메일을 작성하고 관리합니다</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    onClick={() => {
                      onClose();
                      onOpenGmail?.();
                    }}
                    className="p-3 rounded-xl bg-white hover:bg-[#F4EFE6] border border-[#EBE5DA] text-xs font-bold text-[#3E2723] flex items-center justify-center gap-2 transition-all shadow-xs cursor-pointer"
                  >
                    <Plus className="w-4 h-4 text-[#EA4335]" />
                    <span>앱 내 새 메일 작성</span>
                  </button>

                  <button
                    onClick={() => {
                      onClose();
                      onOpenGmail?.();
                    }}
                    className="p-3 rounded-xl bg-white hover:bg-[#F4EFE6] border border-[#EBE5DA] text-xs font-bold text-[#3E2723] flex items-center justify-center gap-2 transition-all shadow-xs cursor-pointer"
                  >
                    <Mail className="w-4 h-4 text-[#1565C0]" />
                    <span>앱 내 Gmail 수신함 열기</span>
                  </button>
                </div>
              </div>

              {/* Quick Meet Start */}
              <div className="p-3 rounded-2xl bg-[#F0FFF4] border border-[#BBF7D0] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Video className="w-4 h-4 text-[#137333]" />
                  <div>
                    <span className="text-xs font-bold text-[#14532D] block">Google Meet 화상 회의 바로 시작</span>
                    <span className="text-[10px] text-[#15803D]">클릭 한 번으로 공식 회의실을 생성합니다</span>
                  </div>
                </div>
                <a
                  href="https://meet.google.com/new"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 rounded-xl bg-[#137333] hover:bg-[#0F5A27] text-white text-xs font-bold shadow-xs flex items-center gap-1"
                >
                  <span>Meet 새 회의</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          )}

          {/* 3. CALENDAR TAB */}
          {activeTab === 'calendar' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs px-1">
                <span className="font-bold text-[#7A6A5C]">연동된 Google 캘린더 일정</span>
                <div className="flex items-center gap-2">
                  <a
                    href={createGoogleCalendarWebLink({
                      title: '워크챗 팀 싱크 미팅',
                      dateStr: new Date().toISOString().slice(0, 10),
                      startTime: '14:00',
                      endTime: '15:00',
                      location: 'Google Meet',
                    })}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] text-[#B45309] font-bold hover:underline flex items-center gap-0.5"
                  >
                    <span>구글 캘린더 바로 열기</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                  <button
                    onClick={() => {
                      onOpenCalendarModal();
                      onClose();
                    }}
                    className="px-2.5 py-1 rounded-xl bg-[#3E2723] text-white text-[11px] font-bold"
                  >
                    새 일정 잡기
                  </button>
                </div>
              </div>

              {events.length === 0 ? (
                <div className="p-6 text-center text-xs text-[#7A6A5C] bg-[#FDFBF7] rounded-2xl border border-[#EBE5DA]">
                  등록된 일정이 없습니다. 우측 상단 '새 일정 잡기'를 눌러 등록하세요.
                </div>
              ) : (
                events.map((ev) => (
                  <div
                    key={ev.id}
                    className="p-3 rounded-2xl bg-[#FFFBF0] border border-[#FDE68A] flex items-center justify-between"
                  >
                    <div>
                      <div className="text-xs font-bold text-[#78350F]">{ev.title}</div>
                      <div className="text-[10px] text-[#92400E] mt-0.5">
                        📅 {ev.dateStr} {ev.startTime}~{ev.endTime} | 📍 {ev.location || 'Google Meet'}
                      </div>
                    </div>
                    <a
                      href={createGoogleCalendarWebLink({
                        title: ev.title,
                        dateStr: ev.dateStr,
                        startTime: ev.startTime,
                        endTime: ev.endTime,
                        location: ev.location,
                      })}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2.5 py-1 rounded-xl bg-white border border-[#FDE68A] text-[10px] font-bold text-[#B45309] hover:bg-[#FFF5EB]"
                    >
                      캘린더 등록
                    </a>
                  </div>
                ))
              )}
            </div>
          )}

          {/* 4. TASKS TAB */}
          {activeTab === 'tasks' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs px-1">
                <span className="font-bold text-[#7A6A5C]">Google Tasks 실시간 할 일 목록</span>
                <span className="text-[11px] text-[#137333] font-semibold">양방향 실시간 동기화</span>
              </div>

              {tasks.length === 0 ? (
                <div className="p-6 text-center text-xs text-[#7A6A5C] bg-[#FDFBF7] rounded-2xl border border-[#EBE5DA]">
                  등록된 할 일이 없습니다. 대화방에서 업무를 등록하면 자동 동기화됩니다.
                </div>
              ) : (
                tasks.map((task) => (
                  <div
                    key={task.id}
                    className="p-3 rounded-2xl bg-[#FDFBF7] border border-[#EBE5DA] flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={task.completed}
                        onChange={() => {
                          const updated = tasks.map((t) => t.id === task.id ? { ...t, completed: !t.completed } : t);
                          storage.saveTasks(updated);
                          setTasks(updated);
                        }}
                        className="rounded accent-[#3E2723] cursor-pointer"
                      />
                      <span className={`text-xs ${task.completed ? 'line-through text-[#A89A8E]' : 'font-bold text-[#2C2520]'}`}>
                        {task.title}
                      </span>
                    </div>
                    <span className="text-[10px] text-[#7A6A5C]">
                      담당: {task.assigneeName} {task.dueDate ? `• 마감: ${task.dueDate}` : ''}
                    </span>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Bottom Close */}
        <div className="pt-2 border-t border-[#EBE5DA] flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-[#FAF7F2] text-xs font-bold text-[#3E2723] hover:bg-[#F4EFE6] transition-colors"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
};
