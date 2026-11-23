import React, { useEffect, useMemo, useState } from 'react';
import { Languages, X, RefreshCw, Copy, Check, ArrowLeftRight, Wand2 } from 'lucide-react';
import {
  LANGUAGES,
  languageLabel,
  translateMessageText,
  TranslationProvider,
} from '../services/translationService';

export interface MessageTranslationState {
  messageId: string;
  lang: string;
  text: string;
  provider: TranslationProvider;
  show: 'translation' | 'original';
}

interface MessageTranslateModalProps {
  open: boolean;
  messageId: string;
  originalText: string;
  initialLang?: string;
  onClose: () => void;
  onTranslated: (state: MessageTranslationState) => void;
}

const POPULAR_CODES = ['ko', 'en', 'ja', 'zh-CN', 'es', 'fr', 'de', 'ru', 'ar', 'vi', 'th', 'id'];

export const MessageTranslateModal: React.FC<MessageTranslateModalProps> = ({
  open,
  messageId,
  originalText,
  initialLang = 'ko',
  onClose,
  onTranslated,
}) => {
  const [target, setTarget] = useState(initialLang);
  const [customCode, setCustomCode] = useState('');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ text: string; provider: TranslationProvider } | null>(null);

  useEffect(() => {
    if (open) {
      setTarget(initialLang);
      setResult(null);
      setError('');
      setQuery('');
      setLoading(false);
    }
  }, [open, initialLang]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return LANGUAGES;
    return LANGUAGES.filter(
      (l) => l.label.includes(q) || l.englishName.toLowerCase().includes(q) || l.code.toLowerCase().includes(q)
    );
  }, [query]);

  if (!open) return null;

  const effectiveTarget = (customCode.trim() || target).trim();

  const runTranslate = async () => {
    if (!originalText.trim()) return;
    setLoading(true);
    setError('');
    const res = await translateMessageText(originalText, effectiveTarget, { skipCache: !!result });
    setLoading(false);
    if (!res.text) {
      setError(res.error || '번역하지 못했습니다.');
      return;
    }
    setResult({ text: res.text, provider: res.provider });
    onTranslated({
      messageId,
      lang: effectiveTarget,
      text: res.text,
      provider: res.provider,
      show: 'translation',
    });
  };

  return (
    <div
      className="fixed inset-0 z-[75] flex items-end sm:items-center justify-center bg-black/45 backdrop-blur-xs p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-lg bg-white rounded-t-3xl sm:rounded-3xl border border-[#EBE5DA] shadow-2xl overflow-hidden max-h-[92dvh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 sm:px-5 py-3 border-b border-[#EBE5DA] bg-[#FAF7F2] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <div className="p-1.5 rounded-xl bg-[#F4EFE6] text-[#3E2723]">
              <Languages className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-[#2C2520]">메시지 번역</h3>
              <p className="text-[10px] text-[#7A6A5C] truncate">전 세계 모든 언어로 번역합니다 · Gemini 또는 무료 엔진</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-[#7A6A5C] hover:bg-[#EBE5DA] cursor-pointer" aria-label="닫기">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-3 overflow-y-auto">
          <div>
            <p className="text-[10px] font-bold text-[#7A6A5C] mb-1">원문</p>
            <div className="max-h-24 overflow-y-auto whitespace-pre-wrap text-[12px] leading-relaxed bg-[#FAF7F2] border border-[#EBE5DA] rounded-xl p-2.5 text-[#3E2723]">
              {originalText}
            </div>
          </div>

          <div>
            <p className="text-[10px] font-bold text-[#7A6A5C] mb-1">빠른 언어 선택</p>
            <div className="flex flex-wrap gap-1.5">
              {POPULAR_CODES.map((code) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => {
                    setCustomCode('');
                    setTarget(code);
                  }}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-colors cursor-pointer ${
                    !customCode && target === code
                      ? 'bg-[#3E2723] text-white border-[#3E2723]'
                      : 'bg-white text-[#5C5046] border-[#EBE5DA] hover:bg-[#FAF7F2]'
                  }`}
                >
                  {languageLabel(code)}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <label className="block">
              <span className="text-[10px] font-bold text-[#7A6A5C]">모든 언어에서 찾기</span>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="언어명 또는 코드 검색 (예: 힌디, sw)"
                className="mt-1 w-full px-2.5 py-1.5 border border-[#EBE5DA] rounded-xl text-[11px] focus:outline-none focus:border-[#C18C5D]"
              />
            </label>
            <label className="block">
              <span className="text-[10px] font-bold text-[#7A6A5C]">직접 코드 입력 (ISO)</span>
              <input
                value={customCode}
                onChange={(e) => setCustomCode(e.target.value)}
                placeholder="예: tl, yue, ceb"
                className="mt-1 w-full px-2.5 py-1.5 border border-[#EBE5DA] rounded-xl text-[11px] font-mono focus:outline-none focus:border-[#C18C5D]"
              />
            </label>
          </div>

          <label className="block">
            <span className="text-[10px] font-bold text-[#7A6A5C]">언어 목록 ({filtered.length})</span>
            <select
              value={customCode ? '' : target}
              onChange={(e) => {
                setCustomCode('');
                setTarget(e.target.value);
              }}
              className="mt-1 w-full px-2.5 py-1.5 border border-[#EBE5DA] rounded-xl text-[11px] bg-white focus:outline-none focus:border-[#C18C5D]"
              size={5}
            >
              {filtered.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.label} · {l.englishName} ({l.code})
                </option>
              ))}
            </select>
          </label>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={runTranslate}
              disabled={loading}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-[#3E2723] hover:bg-[#2C2520] text-white text-xs font-bold disabled:opacity-60 cursor-pointer"
            >
              {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
              <span>{loading ? '번역 중…' : `${customCode || languageLabel(target)}(으)로 번역`}</span>
            </button>
            {result && (
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(result.text);
                }}
                className="px-3 py-2 rounded-xl border border-[#EBE5DA] text-xs font-semibold text-[#5C5046] hover:bg-[#FAF7F2] cursor-pointer"
                title="번역문 복사"
              >
                <Copy className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {error && (
            <div className="p-2.5 rounded-xl bg-[#FEF2F2] border border-[#FCA5A5] text-[11px] text-[#991B1B] leading-relaxed">
              {error}
            </div>
          )}

          {result && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <p className="text-[10px] font-bold text-[#7A6A5C]">
                  번역 결과 · {languageLabel(effectiveTarget)}
                </p>
                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[#E6F4EA] text-[#137333] font-bold">
                  {result.provider === 'gemini' ? 'Gemini' : 'Google 번역'}
                </span>
              </div>
              <div className="whitespace-pre-wrap text-[12px] leading-relaxed bg-[#F0F9FF] border border-[#BAE6FD] rounded-xl p-2.5 text-[#0C4A6E]">
                {result.text}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

interface TranslatedBlockProps {
  state: MessageTranslationState;
  isMine: boolean;
  onToggle: () => void;
  onRetranslate: () => void;
}

export const TranslatedBlock: React.FC<TranslatedBlockProps> = ({ state, isMine, onToggle, onRetranslate }) => {
  const [copied, setCopied] = useState(false);
  const showingTranslation = state.show === 'translation';
  return (
    <div
      className={`mt-2 rounded-xl border px-2.5 py-2 text-[12px] leading-relaxed ${
        isMine ? 'bg-white/15 border-white/25 text-white' : 'bg-[#F0F9FF] border-[#BAE6FD] text-[#0C4A6E]'
      }`}
    >
      <div className="flex items-center justify-between gap-2 mb-1">
        <span className={`flex items-center gap-1 text-[9.5px] font-bold ${isMine ? 'text-white/80' : 'text-[#0369A1]'}`}>
          <Languages className="w-3 h-3" />
          {languageLabel(state.lang)} 번역 · {state.provider === 'gemini' ? 'Gemini' : 'Google'}
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onToggle}
            className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[9.5px] font-bold cursor-pointer ${
              isMine ? 'bg-white/20 hover:bg-white/30 text-white' : 'bg-white hover:bg-[#E0F2FE] text-[#075985]'
            }`}
            title="원문 / 번역문 전환"
          >
            <ArrowLeftRight className="w-2.5 h-2.5" />
            {showingTranslation ? '원문' : '번역'}
          </button>
          <button
            type="button"
            onClick={onRetranslate}
            className={`p-0.5 rounded-md cursor-pointer ${isMine ? 'hover:bg-white/20 text-white/80' : 'hover:bg-white text-[#0369A1]'}`}
            title="다른 언어로 번역"
          >
            <RefreshCw className="w-2.5 h-2.5" />
          </button>
          <button
            type="button"
            onClick={() => {
              navigator.clipboard.writeText(state.text);
              setCopied(true);
              window.setTimeout(() => setCopied(false), 1500);
            }}
            className={`p-0.5 rounded-md cursor-pointer ${isMine ? 'hover:bg-white/20 text-white/80' : 'hover:bg-white text-[#0369A1]'}`}
            title="번역문 복사"
          >
            {copied ? <Check className="w-2.5 h-2.5" /> : <Copy className="w-2.5 h-2.5" />}
          </button>
        </div>
      </div>
      <div className="whitespace-pre-wrap">
        {showingTranslation ? state.text : '번역을 숨겼습니다 — 원문만 표시 중'}
      </div>
    </div>
  );
};
