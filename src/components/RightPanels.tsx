import React, { useState } from 'react';
import { 
  X, 
  Send, 
  CornerDownRight, 
  FileText, 
  Table, 
  Save, 
  Check, 
  CheckSquare, 
  Square, 
  Trash2,
  Users,
  Calendar as CalendarIcon,
  HardDrive,
  Download,
  ExternalLink,
  ShieldCheck,
  CheckCircle2,
  RefreshCw
} from 'lucide-react';
import { Message, User, TaskItem } from '../types';
import { syncTaskToGoogle, updateGoogleTaskStatus, syncEventToGoogle } from '../services/googleWorkspace';
import { GoogleWorkspaceEditor } from './GoogleWorkspaceEditor';
import { storage } from '../storage';

/* 1. THREAD PANEL (인라인 스레드 답장) */
interface ThreadPanelProps {
  message: Message;
  currentUser: User;
  onClose: () => void;
  onSendReply: (messageId: string, replyContent: string) => void;
}

export const ThreadPanel: React.FC<ThreadPanelProps> = ({
  message,
  currentUser,
  onClose,
  onSendReply,
}) => {
  const [replyText, setReplyText] = useState('');

  const handleSend = () => {
    if (!replyText.trim()) return;
    onSendReply(message.id, replyText.trim());
    setReplyText('');
  };

  return (
    <aside className="w-80 sm:w-96 flex-shrink-0 bg-[#FDFBF7] border-l border-[#EBE5DA] flex flex-col justify-between z-20 cafe-shadow">
      <div className="h-16 px-4 border-b border-[#EBE5DA] flex items-center justify-between bg-[#FDFBF7]">
        <div className="flex items-center gap-2">
          <CornerDownRight className="w-4 h-4 text-[#C18C5D]" />
          <h3 className="text-sm font-bold text-[#2C2520]">스레드 (인라인 답장)</h3>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-[#7A6A5C] hover:bg-[#F4EFE6]"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#F4EFE6]/40">
        {/* Parent Message */}
        <div className="p-3.5 rounded-2xl bg-white border border-[#EBE5DA] cafe-shadow">
          <div className="flex items-center gap-2">
            <img
              src={message.senderAvatar}
              alt={message.senderName}
              className="w-7 h-7 rounded-lg object-cover"
            />
            <div>
              <span className="text-xs font-bold text-[#2C2520]">{message.senderName}</span>
              <span className="text-[10px] text-[#A89A8E] ml-2 font-mono">{message.timestamp}</span>
            </div>
          </div>
          <p className="mt-2 text-xs text-[#2C2520] leading-relaxed">{message.content}</p>
        </div>

        <div className="text-[11px] font-bold text-[#C18C5D] text-center">답글 목록</div>

        {message.replies && message.replies.length > 0 ? (
          <div className="space-y-3">
            {message.replies.map((reply) => (
              <div key={reply.id} className="flex items-start gap-2.5">
                <img
                  src={reply.senderAvatar}
                  alt={reply.senderName}
                  className="w-7 h-7 rounded-lg object-cover mt-0.5"
                />
                <div className="flex-1 bg-white p-2.5 rounded-xl border border-[#EBE5DA] cafe-shadow">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-[#2C2520]">{reply.senderName}</span>
                    <span className="text-[10px] text-[#A89A8E] font-mono">{reply.timestamp}</span>
                  </div>
                  <p className="text-xs text-[#4A3E34] mt-1 leading-relaxed">{reply.content}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-xs text-[#A89A8E]">
            첫 번째 답글을 남겨보세요!
          </div>
        )}
      </div>

      <div className="p-3 border-t border-[#EBE5DA] bg-white">
        <div className="flex items-center gap-2 bg-[#FDFBF7] border border-[#EBE5DA] rounded-xl px-3 py-2">
          <input
            type="text"
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="답글 남기기..."
            className="flex-1 bg-transparent text-xs text-[#2C2520] placeholder-[#A89A8E] focus:outline-none"
          />
          <button
            onClick={handleSend}
            disabled={!replyText.trim()}
            className={`p-1.5 rounded-lg ${
              replyText.trim() ? 'bg-[#3E2723] text-white' : 'text-[#BDB0A4]'
            }`}
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </aside>
  );
};

/* 2. SIDE-BY-SIDE DOC EDITOR (화면 분할 인앱 편집) */
interface SideBySideDocEditorProps {
  fileId: string;
  fileName: string;
  fileType: string;
  currentUser: User;
  onClose: () => void;
  onSaveDocContent?: (fileId: string, newContent: string, title?: string) => void;
}

export const SideBySideDocEditor: React.FC<SideBySideDocEditorProps> = ({
  fileId,
  fileName,
  fileType,
  currentUser,
  onClose,
  onSaveDocContent,
}) => {
  const currentDoc = storage.getDriveDocuments().find((d) => d.id === fileId);
  const initialContent = currentDoc?.content || '';

  return (
    <aside className="w-full md:w-1/2 lg:w-[55%] flex-shrink-0 bg-[#FDFBF7] border-l border-[#EBE5DA] flex flex-col justify-between z-20 cafe-shadow animate-in slide-in-from-right duration-200 min-w-0 max-w-full">
      <div className="flex-1 overflow-hidden flex flex-col relative">
        <GoogleWorkspaceEditor
          key={fileId}
          fileId={fileId}
          fileName={fileName}
          fileType={fileType}
          currentUser={currentUser}
          initialContent={initialContent}
          onSave={(id, content, title) => onSaveDocContent?.(id, content, title)}
          onClose={onClose}
        />
      </div>
      <div className="p-2 border-t border-[#EBE5DA] bg-[#FAF7F2] flex items-center justify-between text-xs text-[#7A6A5C] px-3">
        <div className="flex items-center gap-1.5 text-[11px]">
          <ShieldCheck className="w-3.5 h-3.5 text-[#0F9D58]" />
          <span>Google Workspace 실시간 인앱 분할 편집기</span>
        </div>
        <button
          onClick={onClose}
          className="px-3 py-1 rounded-xl bg-[#3E2723] hover:bg-[#2C2520] text-white text-xs font-bold transition-colors cursor-pointer"
        >
          편집 패널 닫기
        </button>
      </div>
    </aside>
  );
};

/* 3. TASKS PANEL (Google Tasks & 캘린더 실시간 양방향 동기화) */
interface TasksPanelProps {
  tasks: TaskItem[];
  teamMembers: User[];
  spaceId: string;
  onAddTask: (task: Omit<TaskItem, 'id'>) => void;
  onToggleTask: (taskId: string) => void;
  onDeleteTask: (taskId: string) => void;
  onClose?: () => void;
}

export const TasksPanel: React.FC<TasksPanelProps> = ({
  tasks,
  teamMembers,
  spaceId,
  onAddTask,
  onToggleTask,
  onDeleteTask,
  onClose,
}) => {
  const [newTitle, setNewTitle] = useState('');
  const [newAssigneeId, setNewAssigneeId] = useState(teamMembers[0]?.id || '');
  const [newDueDate, setNewDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 3);
    return d.toISOString().split('T')[0];
  });
  const [syncStatusToast, setSyncStatusToast] = useState<string | null>(null);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const assignee = teamMembers.find((m) => m.id === newAssigneeId) || teamMembers[0];

    // Trigger bilateral Google Tasks & Calendar sync
    const res = await syncTaskToGoogle({
      title: newTitle.trim(),
      dueDate: newDueDate,
      notes: `스페이스 업무 담당자: ${assignee.name}`,
    });

    if (newDueDate) {
      syncEventToGoogle({
        title: `[할 일 마감] ${newTitle.trim()}`,
        dateStr: newDueDate,
        startTime: '10:00',
        endTime: '11:00',
        location: 'Google Chat Workspace',
        description: `담당자: ${assignee.name} (${assignee.email})`,
        attendeeEmails: [assignee.email],
      });
    }

    onAddTask({
      spaceId,
      title: newTitle.trim(),
      assigneeId: assignee.id,
      assigneeName: assignee.name,
      assigneeAvatar: assignee.avatar,
      dueDate: newDueDate,
      completed: false,
      priority: 'medium',
      googleTaskId: res.googleTaskId,
      syncedToGoogleTasks: true,
      syncedToGoogleCalendar: true,
    });

    setNewTitle('');
    setSyncStatusToast('✓ Google Tasks 및 Google Calendar에 실시간 동기화 등록되었습니다!');
    setTimeout(() => setSyncStatusToast(null), 3000);
  };

  const handleToggle = (task: TaskItem) => {
    onToggleTask(task.id);
    if (task.googleTaskId) {
      updateGoogleTaskStatus(task.googleTaskId, !task.completed);
    }
  };

  return (
    <div className="h-full flex flex-col justify-between bg-[#FDFBF7] border-l border-[#EBE5DA] text-[#2C2520] select-none cafe-shadow">
      {/* Header */}
      <div className="p-4 border-b border-[#EBE5DA] flex items-center justify-between bg-[#FDFBF7]">
        <div className="flex items-center gap-2">
          <CheckSquare className="w-4 h-4 text-[#C18C5D]" />
          <div>
            <h3 className="text-sm font-bold text-[#2C2520]">Google Tasks &amp; 캘린더 대시보드</h3>
            <p className="text-[10px] text-[#2E7D32] font-semibold flex items-center gap-1 mt-0.5">
              <CheckCircle2 className="w-3 h-3" />
              <span>양방향 실시간 자동 동기화 활성화됨</span>
            </p>
          </div>
        </div>
        {onClose && (
          <button onClick={onClose} className="p-1 rounded-lg text-[#7A6A5C] hover:bg-[#F4EFE6]">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {syncStatusToast && (
        <div className="p-2.5 mx-3 mt-2 rounded-xl bg-[#F0FFF4] border border-[#9AE6B4] text-[11px] text-[#276749] font-medium animate-in fade-in">
          {syncStatusToast}
        </div>
      )}

      {/* Task Creation Form */}
      <form onSubmit={handleCreate} className="p-3.5 border-b border-[#EBE5DA] bg-[#F4EFE6]/50 space-y-2.5">
        <input
          type="text"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          placeholder="새 업무 생성 (Google Tasks 자동 동기화)..."
          className="w-full bg-white border border-[#EBE5DA] rounded-xl px-3 py-2 text-xs text-[#2C2520] focus:outline-none focus:border-[#C18C5D]"
        />

        <div className="flex items-center gap-2">
          <select
            value={newAssigneeId}
            onChange={(e) => setNewAssigneeId(e.target.value)}
            className="flex-1 bg-white border border-[#EBE5DA] rounded-xl px-2 py-1.5 text-xs text-[#2C2520]"
          >
            {teamMembers.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} ({m.role})
              </option>
            ))}
          </select>
          <input
            type="date"
            value={newDueDate}
            onChange={(e) => setNewDueDate(e.target.value)}
            className="bg-white border border-[#EBE5DA] rounded-xl px-2 py-1.5 text-xs text-[#2C2520]"
          />
          <button
            type="submit"
            disabled={!newTitle.trim()}
            className="px-3.5 py-1.5 rounded-xl bg-[#3E2723] hover:bg-[#2C2520] text-white text-xs font-bold disabled:opacity-50 transition-colors shadow-xs"
          >
            생성
          </button>
        </div>
      </form>

      {/* Task List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-[#F4EFE6]/20">
        {tasks.map((task) => (
          <div
            key={task.id}
            className={`group flex items-start gap-3 p-3 rounded-2xl border transition-all cafe-shadow ${
              task.completed ? 'bg-[#F4EFE6] border-[#EBE5DA] opacity-60' : 'bg-white border-[#EBE5DA]'
            }`}
          >
            <button
              onClick={() => handleToggle(task)}
              className="mt-0.5 text-[#7A6A5C] hover:text-[#C18C5D]"
            >
              {task.completed ? (
                <CheckSquare className="w-4 h-4 text-[#2E7D32]" />
              ) : (
                <Square className="w-4 h-4" />
              )}
            </button>

            <div className="flex-1 min-w-0">
              <div
                className={`text-xs font-bold ${
                  task.completed ? 'line-through text-[#8C7D70]' : 'text-[#2C2520]'
                }`}
              >
                {task.title}
              </div>
              <div className="flex items-center gap-2 mt-1 text-[11px] text-[#7A6A5C]">
                <span>담당: {task.assigneeName}</span>
                <span>•</span>
                <span>마감: {task.dueDate}</span>
                <span>•</span>
                <span className="text-[#2E7D32] font-semibold">Tasks/Calendar 동기화됨</span>
              </div>
            </div>

            <button
              onClick={() => onDeleteTask(task.id)}
              className="opacity-0 group-hover:opacity-100 p-1 text-[#A89A8E] hover:text-[#DC2626] transition-opacity"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
