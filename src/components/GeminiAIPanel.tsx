import React, { useState, useRef, useEffect } from 'react';
import { 
  Sparkles, 
  X, 
  Send, 
  Paperclip, 
  Bot, 
  User as UserIcon, 
  CheckCircle2, 
  FileText, 
  Image as ImageIcon, 
  Trash2, 
  RefreshCw, 
  ArrowRight,
  Copy,
  Check
} from 'lucide-react';
import { Message, User } from '../types';
import { callGeminiServerChat, GeminiFileAttachment } from '../services/geminiService';
import { DEFAULT_GEMINI_MODELS, DEFAULT_GEMINI_MODEL, normalizeModelId } from '../services/geminiModels';
import { getGeminiModel, saveGeminiModel } from '../services/appConfig';

interface GeminiAIPanelProps {
  isOpen: boolean;
  onClose: () => void;
  messages: Message[];
  spaceName: string;
  currentUser: User;
}

interface AIChatMessage {
  id: string;
  sender: 'user' | 'gemini';
  text: string;
  timestamp: string;
  attachments?: GeminiFileAttachment[];
  hasContextReflected?: boolean;
}

export const GeminiAIPanel: React.FC<GeminiAIPanelProps> = ({
  isOpen,
  onClose,
  messages,
  spaceName,
  currentUser,
}) => {
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [includeFullChatContext, setIncludeFullChatContext] = useState(true);
  const [pendingAttachments, setPendingAttachments] = useState<GeminiFileAttachment[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  // 이 계정에서 사용할 Gemini 모델 (설정 → AI 탭과 같은 값)
  const [model, setModel] = useState<string>(() => normalizeModelId(getGeminiModel()) || DEFAULT_GEMINI_MODEL);

  useEffect(() => {
    const sync = () => setModel(normalizeModelId(getGeminiModel()) || DEFAULT_GEMINI_MODEL);
    window.addEventListener('workchat-settings-changed', sync);
    return () => window.removeEventListener('workchat-settings-changed', sync);
  }, []);

  const GEMINI_CHAT_KEY = `workchat_gemini_chat_history_v6_${currentUser.id}`;
  const [aiChatHistory, setAiChatHistory] = useState<AIChatMessage[]>(() => {
    try {
      const data = localStorage.getItem(GEMINI_CHAT_KEY);
      if (data) {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return [
      {
        id: 'init_welcome',
        sender: 'gemini',
        text: `안녕하세요 ${currentUser.name}님! **Google Gemini AI 협업 비서**입니다 ✨\n\n대화방의 업무 내용, 문서 작성, 일정 요약, 아이디어 기획 등 무엇이든 물어보세요. 실시간으로 즉시 답변해 드립니다!`,
        timestamp: '방금 전',
      },
    ];
  });

  useEffect(() => {
    try {
      localStorage.setItem(GEMINI_CHAT_KEY, JSON.stringify(aiChatHistory));
    } catch {}
  }, [aiChatHistory, GEMINI_CHAT_KEY]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [isOpen, aiChatHistory]);

  if (!isOpen) return null;

  // Format full conversation history into a structured context document
  const getFormattedChatContext = (): string => {
    const validMsgs = messages.filter((m) => !m.isSystemMessage);
    if (validMsgs.length === 0) return '대화 기록이 없습니다.';
    return validMsgs
      .map((m) => `[${m.senderName} (${m.timestamp})]: ${m.content}`)
      .join('\n');
  };

  // Handle file uploads for Gemini
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const result = event.target?.result as string;
        if (result) {
          // Extract base64 part
          const base64Data = result.split(',')[1] || '';
          setPendingAttachments((prev) => [
            ...prev,
            {
              name: file.name,
              mimeType: file.type || 'application/octet-stream',
              base64Data,
            },
          ]);
        }
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };

  // Send message to Gemini
  const handleSendMessage = async (customPrompt?: string) => {
    const promptToSend = (customPrompt || inputText).trim();
    if (!promptToSend && pendingAttachments.length === 0) return;

    const userMsgId = `user_${Date.now()}`;
    const now = new Date();
    const timeStr = `${now.getHours()}:${now.getMinutes().toString().padStart(2, '0')}`;

    const newChatMsg: AIChatMessage = {
      id: userMsgId,
      sender: 'user',
      text: promptToSend,
      timestamp: timeStr,
      attachments: [...pendingAttachments],
      hasContextReflected: includeFullChatContext,
    };

    setAiChatHistory((prev) => [...prev, newChatMsg]);
    setInputText('');
    const currentAttachments = [...pendingAttachments];
    setPendingAttachments([]);
    setIsLoading(true);

    try {
      const chatContext = includeFullChatContext ? getFormattedChatContext() : undefined;
      const reply = await callGeminiServerChat({
        message: promptToSend,
        fullChatContext: chatContext,
        attachments: currentAttachments.length > 0 ? currentAttachments : undefined,
        model,
      });

      const geminiMsg: AIChatMessage = {
        id: `ai_${Date.now()}`,
        sender: 'gemini',
        text: reply,
        timestamp: `${new Date().getHours()}:${new Date().getMinutes().toString().padStart(2, '0')}`,
      };
      setAiChatHistory((prev) => [...prev, geminiMsg]);
    } catch (e: any) {
      const errorMsg: AIChatMessage = {
        id: `err_${Date.now()}`,
        sender: 'gemini',
        text: `오류가 발생했습니다: ${e?.message || '잠시 후 다시 시도해 주세요.'}`,
        timestamp: '오류',
      };
      setAiChatHistory((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyText = (id: string, text: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <aside className="fixed inset-y-0 right-0 z-40 w-full sm:static sm:w-80 md:w-96 h-full flex flex-col bg-[#FDFBF7] border-l border-[#EBE5DA] cafe-shadow-lg select-none animate-in slide-in-from-right duration-200">
      {/* Top Header */}
      <div className="p-3.5 border-b border-[#EBE5DA] bg-[#F4EFE6] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#3E2723] to-[#C18C5D] text-white flex items-center justify-center shadow-xs">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-bold text-[#2C2520] flex items-center gap-1.5">
              <span>Google Gemini AI</span>
              <select
                value={model}
                onChange={(event) => {
                  setModel(event.target.value);
                  saveGeminiModel(event.target.value);
                }}
                title="사용할 Gemini 모델 선택"
                data-testid="gemini-model-select-panel"
                className="text-[10px] px-1.5 py-0.5 rounded-md bg-[#E6DCD0] text-[#3E2723] font-mono font-semibold outline-none cursor-pointer max-w-[150px]"
              >
                {(DEFAULT_GEMINI_MODELS.some((option) => option.id === model)
                  ? DEFAULT_GEMINI_MODELS
                  : [{ id: model, label: model, desc: '', source: 'key' as const }, ...DEFAULT_GEMINI_MODELS]
                ).map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.id}
                  </option>
                ))}
              </select>
            </div>
            <div className="text-[10px] text-[#7A6A5C]">
              #{spaceName} 실시간 협업 AI
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => {
              const defaultMsg: AIChatMessage = {
                id: 'init_welcome',
                sender: 'gemini',
                text: `안녕하세요 ${currentUser.name}님! **Google Gemini AI 협업 비서**입니다 ✨\n\n대화방의 업무 내용, 문서 작성, 일정 요약, 아이디어 기획 등 무엇이든 물어보세요. 실시간으로 즉시 답변해 드립니다!`,
                timestamp: '방금 전',
              };
              setAiChatHistory([defaultMsg]);
            }}
            className="p-1.5 rounded-lg text-[#7A6A5C] hover:text-[#DC2626] hover:bg-[#EBE5DA] transition-colors cursor-pointer"
            title="대화 기록 초기화"
          >
            <Trash2 className="w-4 h-4" />
          </button>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#7A6A5C] hover:text-[#2C2520] hover:bg-[#EBE5DA] transition-colors cursor-pointer"
            title="닫기"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Context & File Controls */}
      <div className="px-3 py-2 bg-[#FDFBF7] border-b border-[#EBE5DA] flex items-center justify-between gap-1.5 overflow-x-auto">
        <button
          type="button"
          onClick={() => setIncludeFullChatContext(!includeFullChatContext)}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-colors cursor-pointer ${
            includeFullChatContext
              ? 'bg-[#E6F4EA] border-[#A8DAB5] text-[#137333]'
              : 'bg-white border-[#EBE5DA] text-[#7A6A5C] hover:bg-[#F4EFE6]'
          }`}
          title="현재 대화방의 최근 대화 내용을 질문 맥락에 자동 첨부"
        >
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>대화 내용 첨부 ({messages.filter((m) => !m.isSystemMessage).length}건)</span>
        </button>

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white hover:bg-[#F4EFE6] border border-[#EBE5DA] text-[11px] font-bold text-[#5C5046] transition-colors cursor-pointer"
          title="분석할 파일/문서 첨부"
        >
          <Paperclip className="w-3 h-3 text-[#C18C5D]" />
          <span>+ 파일 첨부</span>
        </button>
      </div>

      {/* Message History Viewport */}
      <div className="flex-1 p-3.5 overflow-y-auto space-y-3">
        {aiChatHistory.map((chat) => {
          const isUser = chat.sender === 'user';
          return (
            <div
              key={chat.id}
              className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} animate-in fade-in duration-150`}
            >
              <div className="flex items-center gap-1.5 mb-1 text-[10px] text-[#A89A8E]">
                {isUser ? (
                  <span>{currentUser.name}</span>
                ) : (
                  <span className="flex items-center gap-1 text-[#C18C5D] font-bold">
                    <Sparkles className="w-3 h-3" />
                    <span>Gemini AI</span>
                  </span>
                )}
                <span>• {chat.timestamp}</span>
              </div>

              {/* Chat bubble */}
              <div
                className={`p-3 rounded-2xl text-xs leading-relaxed max-w-[90%] cafe-shadow ${
                  isUser
                    ? 'bg-[#E6DCD0] text-[#2C2520] border border-[#DCD3C5]'
                    : 'bg-white text-[#2C2520] border border-[#EBE5DA]'
                }`}
              >
                {/* Attached files preview */}
                {chat.attachments && chat.attachments.length > 0 && (
                  <div className="mb-2 space-y-1">
                    {chat.attachments.map((att, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-black/5 text-[11px] text-[#5C5046]"
                      >
                        <FileText className="w-3 h-3 text-[#C18C5D]" />
                        <span className="truncate">{att.name}</span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="whitespace-pre-wrap">{chat.text}</div>

                {!isUser && (
                  <div className="mt-2 pt-1 border-t border-[#EBE5DA] flex justify-end">
                    <button
                      onClick={() => handleCopyText(chat.id, chat.text)}
                      className="flex items-center gap-1 text-[10px] text-[#7A6A5C] hover:text-[#2C2520]"
                    >
                      {copiedId === chat.id ? (
                        <>
                          <Check className="w-3 h-3 text-[#137333]" />
                          <span>복사됨</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>답변 복사</span>
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {isLoading && (
          <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-2xl bg-[#F4EFE6]/80 border border-[#E8E2D8] text-xs text-[#7A6A5C] w-fit animate-fade-in shadow-2xs">
            <span className="flex items-center gap-1 mr-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#8D5B4C] typing-dot-1" />
              <span className="w-1.5 h-1.5 rounded-full bg-[#8D5B4C] typing-dot-2" />
              <span className="w-1.5 h-1.5 rounded-full bg-[#8D5B4C] typing-dot-3" />
            </span>
            <span className="text-[11px] font-medium text-[#7A6A5C]">답변 작성 중...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Attached file previews pending send */}
      {pendingAttachments.length > 0 && (
        <div className="p-2 border-t border-[#EBE5DA] bg-[#F4EFE6] flex items-center gap-1.5 overflow-x-auto">
          {pendingAttachments.map((att, i) => (
            <div
              key={i}
              className="flex items-center gap-1 bg-white px-2 py-1 rounded-lg border border-[#DCD3C5] text-[11px]"
            >
              <Paperclip className="w-3 h-3 text-[#C18C5D]" />
              <span className="truncate max-w-[120px]">{att.name}</span>
              <button
                onClick={() => setPendingAttachments((prev) => prev.filter((_, idx) => idx !== i))}
                className="text-[#A89A8E] hover:text-[#DC2626] ml-1"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Quick Context Action Chips (No Prompt Required) */}
      <div className="px-3 py-1.5 bg-[#FAF7F2] border-t border-[#EBE5DA] flex items-center gap-1.5 overflow-x-auto">
        <button
          type="button"
          onClick={() => handleSendMessage('현재 대화 내용과 첨부된 자료의 핵심 사항을 명쾌하게 요약해 주세요.')}
          disabled={isLoading}
          className="px-2.5 py-1 rounded-full bg-white hover:bg-[#F4EFE6] border border-[#EBE5DA] text-[10px] font-semibold text-[#3E2723] whitespace-nowrap transition-colors shadow-xs cursor-pointer"
        >
          ✨ 대화 & 파일 핵심 요약
        </button>
        <button
          type="button"
          onClick={() => handleSendMessage('현재 대화에서 결정된 내용과 담당자별 할 일(Tasks) 목록을 정리해 주세요.')}
          disabled={isLoading}
          className="px-2.5 py-1 rounded-full bg-white hover:bg-[#F4EFE6] border border-[#EBE5DA] text-[10px] font-semibold text-[#3E2723] whitespace-nowrap transition-colors shadow-xs cursor-pointer"
        >
          📋 할 일 목록 정리
        </button>
        <button
          type="button"
          onClick={() => handleSendMessage('첨부된 내용의 검토 피드백과 개선 아이디어를 제안해 주세요.')}
          disabled={isLoading}
          className="px-2.5 py-1 rounded-full bg-white hover:bg-[#F4EFE6] border border-[#EBE5DA] text-[10px] font-semibold text-[#3E2723] whitespace-nowrap transition-colors shadow-xs cursor-pointer"
        >
          💡 피드백 & 개선안
        </button>
      </div>

      {/* Input Area */}
      <div className="p-3 bg-[#FAF7F2] border-t border-[#EBE5DA]">
        <div className="rounded-2xl border border-[#EBE5DA] bg-white focus-within:border-[#C18C5D] p-2 transition-all cafe-shadow">
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            placeholder="프롬프트 없이 질문만 적어도 대화 내용과 첨부파일을 바탕으로 똑똑하게 답변합니다..."
            rows={2}
            className="w-full bg-transparent text-xs text-[#2C2520] placeholder-[#A89A8E] focus:outline-none resize-none leading-relaxed"
          />

          <div className="flex items-center justify-between pt-1 border-t border-[#F4EFE6]">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="p-1 rounded-lg hover:bg-[#F4EFE6] text-[#7A6A5C] hover:text-[#3E2723]"
                title="파일/문서 첨부"
              >
                <Paperclip className="w-3.5 h-3.5" />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                onChange={handleFileUpload}
                className="hidden"
              />
              <span className="text-[10px] text-[#A89A8E]">파일 첨부 지원</span>
            </div>

            <button
              type="button"
              onClick={() => handleSendMessage()}
              disabled={isLoading || (!inputText.trim() && pendingAttachments.length === 0)}
              className={`p-1.5 rounded-xl font-bold transition-all ${
                inputText.trim() || pendingAttachments.length > 0
                  ? 'bg-[#3E2723] hover:bg-[#2C2520] text-white shadow-xs'
                  : 'bg-[#EBE5DA] text-[#A89A8E] cursor-not-allowed'
              }`}
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
};
