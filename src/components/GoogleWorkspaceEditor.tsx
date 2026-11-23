import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  FileText,
  Table,
  Presentation,
  Save,
  Download,
  Bold,
  Italic,
  Underline,
  Strikethrough,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  List,
  ListOrdered,
  CheckSquare,
  Sparkles,
  RefreshCw,
  Plus,
  Trash2,
  Copy,
  Check,
  Eye,
  Edit3,
  HelpCircle,
  Play,
  ChevronLeft,
  ChevronRight,
  Palette,
  Maximize2,
  Minimize2,
  Clock,
  BarChart3,
  PieChart,
  Type,
  Printer,
  Search,
  ArrowUp,
  ArrowDown,
  Share2,
  Layers,
  X,
  Undo,
  Redo,
  ZoomIn,
  ZoomOut,
  AlertCircle,
  Quote,
  Code,
  Image as ImageIcon,
  Columns,
  Layout,
  Shapes,
  Upload,
  Send,
  Sliders,
  MoveUp,
  MoveDown,
  FileSpreadsheet,
  SplitSquareVertical
} from 'lucide-react';
import { User } from '../types';
import { assistDocumentWithGemini } from '../services/geminiService';
import { fetchRealDocContent, saveRealDocContent } from '../services/googleWorkspace';
import { SheetEditor } from './SheetEditor';
import { SlideEditor } from './SlideEditor';

interface GoogleWorkspaceEditorProps {
  fileId: string;
  fileName: string;
  fileType: 'doc' | 'sheet' | 'slide' | string;
  currentUser: User;
  initialContent?: string;
  onSave: (fileId: string, content: string, title?: string) => void;
  onClose?: () => void;
  onShareToChat?: (content: string) => void;
}

// ==========================================
// TYPES FOR CANVA-LIKE SLIDES & SPREADSHEETS
// ==========================================
export interface SlideElement {
  id: string;
  type: 'title' | 'text' | 'metric' | 'image' | 'badge' | 'card';
  content: string;
  subtitle?: string;
  metricLabel?: string;
  imageUrl?: string;
  color?: string;
}

export interface SlideItem {
  id: string;
  layout: 'title' | 'bullet' | 'two-column' | 'metric' | 'quote' | 'showcase' | 'custom';
  title: string;
  subtitle: string;
  bullets: string[];
  col1Text?: string;
  col2Text?: string;
  metricNumber?: string;
  metricLabel?: string;
  quoteAuthor?: string;
  imageUrl?: string;
  bgTheme: string;
  notes?: string;
  elements?: SlideElement[];
}

export interface SheetTab {
  id: string;
  name: string;
  data: string[][];
}


// 외부 스톡 사진 대신 앱 안에서 생성하는 샘플 이미지(오프라인에서도 즉시 표시)
const sampleImage = (label: string, hue: number): string => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 180"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="hsl(${hue}, 30%, 90%)"/><stop offset="100%" stop-color="hsl(${hue + 26}, 26%, 70%)"/></linearGradient></defs><rect width="320" height="180" fill="url(#g)"/><text x="160" y="98" font-family="sans-serif" font-size="18" fill="#4A3E34" text-anchor="middle">${label}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
};

const DocsEditor: React.FC<GoogleWorkspaceEditorProps> = ({
  fileId,
  fileName,
  fileType,
  currentUser,
  initialContent,
  onSave,
  onClose,
  onShareToChat,
}) => {
  // Title state - initialized once to avoid feedback loops
  const [title, setTitle] = useState(fileName || '제목 없는 문서');

  // ========================================================
  // 1. DOCS STATE & RICH EDITING
  // ========================================================
  const [docContent, setDocContent] = useState<string>(() => {
    if (initialContent && fileType === 'doc') return initialContent;
    return '';
  });
  const docTextareaRef = useRef<HTMLTextAreaElement>(null);
  const docImageInputRef = useRef<HTMLInputElement>(null);
  const [docZoom, setDocZoom] = useState<number>(100);
  const [docViewMode, setDocViewMode] = useState<'edit' | 'preview' | 'split'>('edit');
  const [showOutline, setShowOutline] = useState<boolean>(false);
  const [fontFamily, setFontFamily] = useState<string>('Noto Sans KR');
  const [fontSize, setFontSize] = useState<number>(14);
  const [lineSpacing, setLineSpacing] = useState<string>('1.65');
  const [textColor, setTextColor] = useState<string>('#2C2520');
  const [highlightColor, setHighlightColor] = useState<string>('transparent');
  const [showColorPicker, setShowColorPicker] = useState<boolean>(false);
  const [showImageModal, setShowImageModal] = useState<boolean>(false);
  const [imageUrlInput, setImageUrlInput] = useState<string>('');

  // Undo / Redo history for Docs
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);

  // Find & Replace
  const [showFindReplace, setShowFindReplace] = useState<boolean>(false);
  const [findQuery, setFindQuery] = useState<string>('');
  const [replaceQuery, setReplaceQuery] = useState<string>('');
  const [findMatchCount, setFindMatchCount] = useState<number>(0);

  // ========================================================
  // 2. SHEETS STATE & EXCEL CALCULATION ENGINE
  // ========================================================
  const createDefaultSheet = (rows = 24, cols = 10): string[][] => {
    const data: string[][] = [];
    for (let r = 0; r < rows; r++) {
      const row: string[] = [];
      for (let c = 0; c < cols; c++) {
        row.push('');
      }
      data.push(row);
    }
    // 예시 데이터 없이 빈 그리드로 시작합니다.
    return data;
  };

  const [sheetTabs, setSheetTabs] = useState<SheetTab[]>(() => {
    if (initialContent && fileType === 'sheet') {
      try {
        const parsed = JSON.parse(initialContent);
        if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].data) {
          return parsed;
        }
      } catch {
        const rows = initialContent.split('\n').map((r) => r.split(','));
        if (rows.length > 0 && rows[0].length > 0) {
          return [{ id: 'sheet_1', name: '시트 1', data: rows }];
        }
      }
    }
    return [{ id: 'sheet_1', name: '시트 1', data: createDefaultSheet() }];
  });

  const [activeTabId, setActiveTabId] = useState<string>(() => sheetTabs[0]?.id || 'sheet_1');
  const currentSheet = useMemo(() => {
    return sheetTabs.find((t) => t.id === activeTabId) || sheetTabs[0];
  }, [sheetTabs, activeTabId]);

  const [selectedCell, setSelectedCell] = useState<{ r: number; c: number }>({ r: 0, c: 0 });
  const [formulaBarInput, setFormulaBarInput] = useState<string>('');
  const [showChartModal, setShowChartModal] = useState<boolean>(false);
  const [chartType, setChartType] = useState<'bar' | 'pie'>('bar');
  const cellInputRefs = useRef<Map<string, HTMLInputElement>>(new Map());

  // Focus active cell input ref
  const focusCellInput = (r: number, c: number) => {
    setSelectedCell({ r, c });
    setTimeout(() => {
      const input = cellInputRefs.current.get(`${r}_${c}`);
      if (input) {
        input.focus();
        input.select();
      }
    }, 10);
  };

  // Keyboard navigation for Excel grid
  const handleCellKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    r: number,
    c: number
  ) => {
    const totalRows = currentSheet.data.length;
    const totalCols = currentSheet.data[0]?.length || 1;

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (r > 0) focusCellInput(r - 1, c);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (r < totalRows - 1) focusCellInput(r + 1, c);
    } else if (e.key === 'ArrowLeft') {
      const target = e.currentTarget;
      if (target.selectionStart === 0 && target.selectionEnd === 0) {
        e.preventDefault();
        if (c > 0) focusCellInput(r, c - 1);
      }
    } else if (e.key === 'ArrowRight') {
      const target = e.currentTarget;
      if (target.selectionStart === target.value.length) {
        e.preventDefault();
        if (c < totalCols - 1) focusCellInput(r, c + 1);
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (e.shiftKey) {
        if (r > 0) focusCellInput(r - 1, c);
      } else {
        if (r < totalRows - 1) focusCellInput(r + 1, c);
      }
    } else if (e.key === 'Tab') {
      e.preventDefault();
      if (e.shiftKey) {
        if (c > 0) focusCellInput(r, c - 1);
      } else {
        if (c < totalCols - 1) focusCellInput(r, c + 1);
        else if (r < totalRows - 1) focusCellInput(r + 1, 0);
      }
    }
  };

  // ========================================================
  // 3. SLIDES STATE & CANVA-LIKE VISUAL STUDIO
  // ========================================================
  const SLIDE_THEMES = [
    { id: 'beige', name: '카페 베이지', bg: 'from-[#FAF7F2] to-[#EFE8DC]', text: 'text-[#2C2520]', accent: '#C18C5D' },
    { id: 'dark', name: '옵시디언 다크', bg: 'from-[#1E293B] to-[#0F172A]', text: 'text-white', accent: '#38BDF8' },
    { id: 'blue', name: '구글 블루', bg: 'from-[#1A73E8] to-[#1557B0]', text: 'text-white', accent: '#F4B400' },
    { id: 'emerald', name: '에메랄드', bg: 'from-[#064E3B] to-[#022C22]', text: 'text-white', accent: '#34D399' },
    { id: 'sunset', name: '선셋 코랄', bg: 'from-[#9A3412] to-[#431407]', text: 'text-white', accent: '#FB923C' },
    { id: 'white', name: '클린 화이트', bg: 'from-[#FFFFFF] to-[#F8FAFC]', text: 'text-[#1E293B]', accent: '#2563EB' },
  ];

  const [slides, setSlides] = useState<SlideItem[]>(() => {
    if (initialContent && fileType === 'slide') {
      try {
        const parsed = JSON.parse(initialContent);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch {}
    }
    return [
      {
        id: 'slide_1',
        layout: 'title',
        title: title || '새 비즈니스 프레젠테이션',
        subtitle: 'Canva 스타일 비주얼 슬라이드와 팀 협업',
        bullets: ['핵심 가치 제안 및 시장 기회', '실시간 데이터 기반 의사결정', '차세대 워크스페이스 구축'],
        bgTheme: 'beige',
        notes: '첫 슬라이드 발표: 팀 인사 및 전체 아젠다 소개',
        elements: [],
      },
    ];
  });

  const [currentSlideIndex, setCurrentSlideIndex] = useState<number>(0);
  const [canvaTab, setCanvaTab] = useState<'templates' | 'text' | 'elements' | 'images'>('templates');
  const [isSlideShowActive, setIsSlideShowActive] = useState<boolean>(false);
  const [slideShowTimer, setSlideShowTimer] = useState<number>(0);
  const [showNotesDrawer, setShowNotesDrawer] = useState<boolean>(false);
  const slideImageInputRef = useRef<HTMLInputElement>(null);

  // ========================================================
  // 4. COMMON STATUS & AUTO-SAVE
  // ========================================================
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'dirty'>('saved');
  const [lastSavedTime, setLastSavedTime] = useState<string>('방금 전');

  // 최신 핸들러/상태를 안정적으로 참조하기 위한 ref (이펙트 재실행으로 타이머가 취소되는 문제 방지)
  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;
  const saveStatusRef = useRef(saveStatus);
  saveStatusRef.current = saveStatus;
  const titleRef = useRef(title);
  titleRef.current = title;
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Gemini AI Office Assistant Right Drawer (Apple-style slide)
  const [showAiDrawer, setShowAiDrawer] = useState<boolean>(false);
  const [aiPrompt, setAiPrompt] = useState<string>('');
  const [isAiLoading, setIsAiLoading] = useState<boolean>(false);
  const [aiLastResult, setAiLastResult] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Content serialization helper
  const serializeContent = (): string => {
    if (fileType === 'doc') {
      return docContent;
    }
    if (fileType === 'sheet') {
      return JSON.stringify(sheetTabs);
    }
    return JSON.stringify(slides);
  };

  // Push to undo history when doc content changes
  const recordDocChange = (newText: string) => {
    setDocContent(newText);
    setSaveStatus('dirty');
    setHistory((prev) => {
      const updated = prev.slice(0, historyIndex + 1);
      return [...updated, newText];
    });
    setHistoryIndex((prev) => prev + 1);
  };

  const handleUndo = () => {
    if (historyIndex > 0) {
      const prevText = history[historyIndex - 1];
      setHistoryIndex((prev) => prev - 1);
      setDocContent(prevText);
      setSaveStatus('dirty');
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const nextText = history[historyIndex + 1];
      setHistoryIndex((prev) => prev + 1);
      setDocContent(nextText);
      setSaveStatus('dirty');
    }
  };

  // Auto-save debounced timer (600ms)
  // 주의: setSaveStatus('saving') 를 이펙트 본문에서 즉시 호출하면, saveStatus 가 의존성에 있어
  // 이펙트가 재실행되고 정리(clearTimeout)되면서 타이머가 절대 실행되지 않습니다.
  // 실제 저장은 타이머 안에서만 상태를 바꿉니다.
  useEffect(() => {
    if (saveStatus !== 'dirty') return;

    const timer = setTimeout(async () => {
      setSaveStatus('saving');
      const serialized = serializeContent();
      onSaveRef.current(fileId, serialized, title);

      // Attempt Google Drive sync if real Drive doc
      if (
        !fileId.startsWith('doc_') &&
        !fileId.startsWith('upload_') &&
        !fileId.startsWith('sheet_') &&
        !fileId.startsWith('slide_')
      ) {
        try {
          await saveRealDocContent(fileId, serialized, title);
        } catch {
          /* 로컬 저장은 이미 완료됨 */
        }
      }

      const now = new Date();
      setLastSavedTime(
        `${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`
      );
      setSaveStatus('saved');
    }, 600);

    return () => clearTimeout(timer);
  }, [docContent, sheetTabs, slides, title, saveStatus, fileId]);

  // 창을 닫거나 새로고침해도 마지막 편집이 사라지지 않도록 저장
  useEffect(() => {
    const flush = () => {
      if (saveStatusRef.current === 'dirty') {
        onSaveRef.current(fileId, serializeContent(), titleRef.current);
      }
    };
    window.addEventListener('beforeunload', flush);
    return () => {
      window.removeEventListener('beforeunload', flush);
      flush();
    };
  }, [fileId]);

  // Load initial content from Google Drive if real file ID
  useEffect(() => {
    if (!initialContent && fileId && !fileId.startsWith('doc_') && !fileId.startsWith('upload_') && !fileId.startsWith('sheet_') && !fileId.startsWith('slide_')) {
      const mime =
        fileType === 'sheet'
          ? 'application/vnd.google-apps.spreadsheet'
          : fileType === 'slide'
          ? 'application/vnd.google-apps.presentation'
          : 'application/vnd.google-apps.document';

      fetchRealDocContent(fileId, mime).then((content) => {
        if (!content) return;
        if (fileType === 'doc') {
          setDocContent(content);
          setHistory([content]);
          setHistoryIndex(0);
        } else if (fileType === 'sheet') {
          try {
            const parsed = JSON.parse(content);
            if (Array.isArray(parsed) && parsed[0]?.data) {
              setSheetTabs(parsed);
              return;
            }
          } catch {
            const rows = content.split('\n').map((r) => r.split(','));
            if (rows.length > 0) {
              setSheetTabs([{ id: 'sheet_1', name: '시트 1', data: rows }]);
            }
          }
        } else if (fileType === 'slide') {
          try {
            const parsed = JSON.parse(content);
            if (Array.isArray(parsed) && parsed.length > 0) {
              setSlides(parsed);
            }
          } catch {}
        }
      });
    }
  }, [fileId, fileType, initialContent]);

  // Synchronize formula bar with active cell in sheet
  useEffect(() => {
    if (fileType === 'sheet' && currentSheet?.data[selectedCell.r]?.[selectedCell.c] !== undefined) {
      setFormulaBarInput(currentSheet.data[selectedCell.r][selectedCell.c] || '');
    }
  }, [selectedCell, currentSheet, fileType]);

  // Manual explicit save action
  const handleManualSave = async () => {
    setSaveStatus('saving');
    const serialized = serializeContent();
    onSave(fileId, serialized, title);

    let driveResultMsg = '✓ 로컬 및 클라우드에 안전하게 저장되었습니다.';
    if (
      !fileId.startsWith('doc_') &&
      !fileId.startsWith('upload_') &&
      !fileId.startsWith('sheet_') &&
      !fileId.startsWith('slide_')
    ) {
      const res = await saveRealDocContent(fileId, serialized, title);
      if (res.success) {
        driveResultMsg = '✓ Google Drive에 실시간 저장 및 동기화 완료!';
      }
    }

    const now = new Date();
    setLastSavedTime(
      `${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`
    );
    setSaveStatus('saved');
    showToast(driveResultMsg);
  };

  // Keyboard shortcut Ctrl+S / Cmd+S
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleManualSave();
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && fileType === 'doc') {
        e.preventDefault();
        if (e.shiftKey) handleRedo();
        else handleUndo();
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f' && fileType === 'doc') {
        e.preventDefault();
        setShowFindReplace((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [fileType, historyIndex, history]);

  // ========================================================
  // DOCUMENT FORMATTING & IMAGE HELPERS
  // ========================================================
  const insertTextAtCursor = (prefix: string, suffix = '', defaultPlaceholder = '') => {
    const el = docTextareaRef.current;
    if (!el) {
      setDocContent((prev) => `${prev}\n${prefix}${defaultPlaceholder}${suffix}`);
      return;
    }
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const current = docContent;
    const selected = current.substring(start, end) || defaultPlaceholder;

    const replacement = `${prefix}${selected}${suffix}`;
    const nextContent = current.substring(0, start) + replacement + current.substring(end);
    recordDocChange(nextContent);

    setTimeout(() => {
      el.focus();
      el.setSelectionRange(start + prefix.length, start + prefix.length + selected.length);
    }, 50);
  };

  const handleImageFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const imageMd = `\n\n![${file.name || '삽입된 이미지'}](${dataUrl})\n\n`;
      insertTextAtCursor(imageMd);
      showToast('✓ 이미지가 문서에 추가되었습니다!');
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleInsertImageUrl = () => {
    if (!imageUrlInput.trim()) return;
    const imageMd = `\n\n![웹 이미지](${imageUrlInput.trim()})\n\n`;
    insertTextAtCursor(imageMd);
    setImageUrlInput('');
    setShowImageModal(false);
    showToast('✓ 이미지 URL이 삽입되었습니다.');
  };

  const insertTable = (rows = 3, cols = 3) => {
    let tableMd = '\n\n';
    const headerRow = Array.from({ length: cols }, (_, i) => `열 ${i + 1}`).join(' | ');
    const dividerRow = Array.from({ length: cols }, () => '---').join(' | ');
    tableMd += `| ${headerRow} |\n| ${dividerRow} |\n`;

    for (let r = 0; r < rows; r++) {
      const dataRow = Array.from({ length: cols }, () => '내용 입력').join(' | ');
      tableMd += `| ${dataRow} |\n`;
    }
    tableMd += '\n';

    insertTextAtCursor(tableMd);
    showToast('✓ 표가 문서에 삽입되었습니다.');
  };

  const insertCalloutBox = (type: 'tip' | 'info' | 'warning') => {
    const icons = { tip: '💡 [팁]', info: 'ℹ️ [안내]', warning: '⚠️ [주의]' };
    insertTextAtCursor(`\n> ${icons[type]} `, '\n\n', '중요한 내용을 여기에 작성하세요.');
  };

  // Find & Replace count calculation
  useEffect(() => {
    if (!findQuery.trim()) {
      setFindMatchCount(0);
      return;
    }
    try {
      const matches = docContent.split(findQuery).length - 1;
      setFindMatchCount(matches);
    } catch {
      setFindMatchCount(0);
    }
  }, [findQuery, docContent]);

  const handleReplaceAll = () => {
    if (!findQuery) return;
    const replaced = docContent.replaceAll(findQuery, replaceQuery);
    recordDocChange(replaced);
    showToast(`✓ ${findMatchCount}개의 단어를 모두 바꿨습니다.`);
  };

  // Word statistics
  const stats = useMemo(() => {
    const charCount = docContent.length;
    const charNoSpaces = docContent.replace(/\s/g, '').length;
    const words = docContent.trim() ? docContent.trim().split(/\s+/).length : 0;
    const readingTime = Math.max(1, Math.ceil(words / 200));
    return { charCount, charNoSpaces, words, readingTime };
  }, [docContent]);

  // Outline extraction (H1, H2, H3)
  const outlineHeadings = useMemo(() => {
    const lines = docContent.split('\n');
    const headings: { level: number; text: string; line: number }[] = [];
    lines.forEach((line, idx) => {
      if (line.startsWith('# ')) {
        headings.push({ level: 1, text: line.replace('# ', '').trim(), line: idx });
      } else if (line.startsWith('## ')) {
        headings.push({ level: 2, text: line.replace('## ', '').trim(), line: idx });
      } else if (line.startsWith('### ')) {
        headings.push({ level: 3, text: line.replace('### ', '').trim(), line: idx });
      }
    });
    return headings;
  }, [docContent]);

  // ========================================================
  // EXCEL SPREADSHEET FORMULA & GRID ENGINE
  // ========================================================
  const getColLetter = (idx: number) => String.fromCharCode(65 + idx);

  const evaluateFormula = (raw: string, data: string[][]): string => {
    if (!raw || !raw.startsWith('=')) return raw;
    const expr = raw.substring(1).toUpperCase().trim();

    try {
      // 1. SUM(A1:A5)
      const sumMatch = expr.match(/^SUM\(([A-Z]+)(\d+):([A-Z]+)(\d+)\)$/);
      if (sumMatch) {
        const c1 = sumMatch[1].charCodeAt(0) - 65;
        const r1 = parseInt(sumMatch[2], 10) - 1;
        const c2 = sumMatch[3].charCodeAt(0) - 65;
        const r2 = parseInt(sumMatch[4], 10) - 1;

        let total = 0;
        for (let r = Math.min(r1, r2); r <= Math.max(r1, r2); r++) {
          for (let c = Math.min(c1, c2); c <= Math.max(c1, c2); c++) {
            const rawVal = data[r]?.[c] || '0';
            const numVal = parseFloat(rawVal.replace(/,/g, ''));
            if (!isNaN(numVal)) total += numVal;
          }
        }
        return total.toLocaleString();
      }

      // 2. AVERAGE(A1:A5)
      const avgMatch = expr.match(/^AVERAGE\(([A-Z]+)(\d+):([A-Z]+)(\d+)\)$/);
      if (avgMatch) {
        const c1 = avgMatch[1].charCodeAt(0) - 65;
        const r1 = parseInt(avgMatch[2], 10) - 1;
        const c2 = avgMatch[3].charCodeAt(0) - 65;
        const r2 = parseInt(avgMatch[4], 10) - 1;

        let total = 0;
        let count = 0;
        for (let r = Math.min(r1, r2); r <= Math.max(r1, r2); r++) {
          for (let c = Math.min(c1, c2); c <= Math.max(c1, c2); c++) {
            const rawVal = data[r]?.[c] || '0';
            const numVal = parseFloat(rawVal.replace(/,/g, ''));
            if (!isNaN(numVal)) {
              total += numVal;
              count++;
            }
          }
        }
        return count > 0 ? (total / count).toFixed(1) : '0';
      }

      // 3. COUNT(A1:A5)
      const countMatch = expr.match(/^COUNT\(([A-Z]+)(\d+):([A-Z]+)(\d+)\)$/);
      if (countMatch) {
        const c1 = countMatch[1].charCodeAt(0) - 65;
        const r1 = parseInt(countMatch[2], 10) - 1;
        const c2 = countMatch[3].charCodeAt(0) - 65;
        const r2 = parseInt(countMatch[4], 10) - 1;

        let count = 0;
        for (let r = Math.min(r1, r2); r <= Math.max(r1, r2); r++) {
          for (let c = Math.min(c1, c2); c <= Math.max(c1, c2); c++) {
            if ((data[r]?.[c] || '').trim() !== '') count++;
          }
        }
        return String(count);
      }

      // 4. MIN(A1:A5) & MAX(A1:A5)
      const minMatch = expr.match(/^MIN\(([A-Z]+)(\d+):([A-Z]+)(\d+)\)$/);
      if (minMatch) {
        const c1 = minMatch[1].charCodeAt(0) - 65;
        const r1 = parseInt(minMatch[2], 10) - 1;
        const c2 = minMatch[3].charCodeAt(0) - 65;
        const r2 = parseInt(minMatch[4], 10) - 1;
        let minVal: number | null = null;
        for (let r = Math.min(r1, r2); r <= Math.max(r1, r2); r++) {
          for (let c = Math.min(c1, c2); c <= Math.max(c1, c2); c++) {
            const n = parseFloat((data[r]?.[c] || '').replace(/,/g, ''));
            if (!isNaN(n)) minVal = minVal === null ? n : Math.min(minVal, n);
          }
        }
        return minVal !== null ? minVal.toLocaleString() : '0';
      }

      const maxMatch = expr.match(/^MAX\(([A-Z]+)(\d+):([A-Z]+)(\d+)\)$/);
      if (maxMatch) {
        const c1 = maxMatch[1].charCodeAt(0) - 65;
        const r1 = parseInt(maxMatch[2], 10) - 1;
        const c2 = maxMatch[3].charCodeAt(0) - 65;
        const r2 = parseInt(maxMatch[4], 10) - 1;
        let maxVal: number | null = null;
        for (let r = Math.min(r1, r2); r <= Math.max(r1, r2); r++) {
          for (let c = Math.min(c1, c2); c <= Math.max(c1, c2); c++) {
            const n = parseFloat((data[r]?.[c] || '').replace(/,/g, ''));
            if (!isNaN(n)) maxVal = maxVal === null ? n : Math.max(maxVal, n);
          }
        }
        return maxVal !== null ? maxVal.toLocaleString() : '0';
      }

      // 5. Basic Math: A1*B1, A1+B1, A1-B1, A1/B1
      const mathMatch = expr.match(/^([A-Z]+)(\d+)\s*([\+\-\*\/])\s*([A-Z]+)(\d+)$/);
      if (mathMatch) {
        const c1 = mathMatch[1].charCodeAt(0) - 65;
        const r1 = parseInt(mathMatch[2], 10) - 1;
        const op = mathMatch[3];
        const c2 = mathMatch[4].charCodeAt(0) - 65;
        const r2 = parseInt(mathMatch[5], 10) - 1;

        const v1 = parseFloat((data[r1]?.[c1] || '0').replace(/,/g, ''));
        const v2 = parseFloat((data[r2]?.[c2] || '0').replace(/,/g, ''));
        if (!isNaN(v1) && !isNaN(v2)) {
          let res = 0;
          if (op === '+') res = v1 + v2;
          else if (op === '-') res = v1 - v2;
          else if (op === '*') res = v1 * v2;
          else if (op === '/') res = v2 !== 0 ? v1 / v2 : 0;
          return res.toLocaleString();
        }
      }
    } catch {
      return '#ERROR!';
    }
    return raw;
  };

  const updateCell = (r: number, c: number, val: string) => {
    setSheetTabs((prev) =>
      prev.map((tab) => {
        if (tab.id !== activeTabId) return tab;
        const updatedData = tab.data.map((row, rIdx) =>
          row.map((cell, cIdx) => (rIdx === r && cIdx === c ? val : cell))
        );
        return { ...tab, data: updatedData };
      })
    );
    setSaveStatus('dirty');
  };

  const addSheetRow = () => {
    const colCount = currentSheet.data[0]?.length || 10;
    const newRow = Array(colCount).fill('');
    setSheetTabs((prev) =>
      prev.map((tab) => (tab.id === activeTabId ? { ...tab, data: [...tab.data, newRow] } : tab))
    );
    setSaveStatus('dirty');
    showToast('새 행이 추가되었습니다.');
  };

  const addSheetCol = () => {
    setSheetTabs((prev) =>
      prev.map((tab) =>
        tab.id === activeTabId
          ? { ...tab, data: tab.data.map((row) => [...row, '']) }
          : tab
      )
    );
    setSaveStatus('dirty');
    showToast('새 열이 추가되었습니다.');
  };

  const deleteSelectedRow = () => {
    if (currentSheet.data.length <= 1) return;
    setSheetTabs((prev) =>
      prev.map((tab) =>
        tab.id === activeTabId
          ? { ...tab, data: tab.data.filter((_, idx) => idx !== selectedCell.r) }
          : tab
      )
    );
    setSelectedCell((prev) => ({ ...prev, r: Math.max(0, prev.r - 1) }));
    setSaveStatus('dirty');
    showToast('선택한 행이 삭제되었습니다.');
  };

  const deleteSelectedCol = () => {
    if ((currentSheet.data[0]?.length || 0) <= 1) return;
    setSheetTabs((prev) =>
      prev.map((tab) =>
        tab.id === activeTabId
          ? {
              ...tab,
              data: tab.data.map((row) => row.filter((_, idx) => idx !== selectedCell.c)),
            }
          : tab
      )
    );
    setSelectedCell((prev) => ({ ...prev, c: Math.max(0, prev.c - 1) }));
    setSaveStatus('dirty');
    showToast('선택한 열이 삭제되었습니다.');
  };

  const sortColumn = (ascending: boolean) => {
    const colIdx = selectedCell.c;
    const headerRow = currentSheet.data[0];
    const dataRows = currentSheet.data.slice(1);

    dataRows.sort((a, b) => {
      const valA = (a[colIdx] || '').replace(/,/g, '');
      const valB = (b[colIdx] || '').replace(/,/g, '');
      const numA = parseFloat(valA);
      const numB = parseFloat(valB);

      if (!isNaN(numA) && !isNaN(numB)) {
        return ascending ? numA - numB : numB - numA;
      }
      return ascending ? valA.localeCompare(valB) : valB.localeCompare(valA);
    });

    setSheetTabs((prev) =>
      prev.map((tab) =>
        tab.id === activeTabId ? { ...tab, data: [headerRow, ...dataRows] } : tab
      )
    );
    setSaveStatus('dirty');
    showToast(ascending ? '✓ 열 기준 오름차순 정렬 완료' : '✓ 열 기준 내림차순 정렬 완료');
  };

  // Quick stats for selected cell/column
  const sheetStats = useMemo(() => {
    const colIdx = selectedCell.c;
    let sum = 0;
    let count = 0;
    let numCount = 0;

    currentSheet.data.forEach((row, idx) => {
      if (idx === 0) return; // skip header
      const val = row[colIdx];
      if (val && val.trim()) {
        count++;
        const num = parseFloat(val.replace(/,/g, ''));
        if (!isNaN(num)) {
          sum += num;
          numCount++;
        }
      }
    });

    const avg = numCount > 0 ? (sum / numCount).toFixed(1) : '0';
    return { sum: sum.toLocaleString(), avg, count };
  }, [currentSheet, selectedCell.c]);

  // ========================================================
  // CANVA-LIKE SLIDES CONTROLS & TEMPLATES
  // ========================================================
  const currentSlide = slides[currentSlideIndex] || slides[0];

  const updateCurrentSlide = (updates: Partial<SlideItem>) => {
    setSlides((prev) =>
      prev.map((s, idx) => (idx === currentSlideIndex ? { ...s, ...updates } : s))
    );
    setSaveStatus('dirty');
  };

  const applySlideTemplate = (templateType: string) => {
    if (templateType === 'pitch') {
      updateCurrentSlide({
        layout: 'title',
        title: '2026 차세대 비즈니스 로드맵',
        subtitle: '구글 워크스페이스 & 인공지능 기반 고효율 업무 혁신',
        bullets: ['고객 니즈 100% 밀착 대응', '자동화 프로세스로 생산성 3.2배 향상', '글로벌 협업 확장'],
      });
      showToast('✓ 피치덱 템플릿이 적용되었습니다.');
    } else if (templateType === 'kpi') {
      updateCurrentSlide({
        layout: 'metric',
        title: '2026년 분기 목표 달성 현황',
        subtitle: '핵심 지표가 목표치를 140% 초과 달성하였습니다',
        metricNumber: '99.4%',
        metricLabel: '고객 만족도 및 프로젝트 완수율',
      });
      showToast('✓ 성과 지표(KPI) 템플릿이 적용되었습니다.');
    } else if (templateType === 'compare') {
      updateCurrentSlide({
        layout: 'two-column',
        title: '도입 전후 업무 프로세스 비교',
        subtitle: '기존 수동 작업 대비 자동화 도입 후 변화',
        col1Text: '• [기존 방식]\n- 파편화된 이메일 소통\n- 수동 파일 버전 관리\n- 응답 지연 평균 4.5시간\n- 반복 작업 비중 62%',
        col2Text: '• [워크챗 도입 후]\n- 실시간 올인원 메신저 통합\n- Google Drive 실시간 동기화\n- 즉각 협업 및 자동 저장\n- 업무 처리 속도 80% 단축',
      });
      showToast('✓ 2열 비교 템플릿이 적용되었습니다.');
    } else if (templateType === 'quote') {
      updateCurrentSlide({
        layout: 'quote',
        title: '단순함이야말로 궁극의 정교함이다.',
        quoteAuthor: '레오나르도 다빈치 & 스티브 잡스',
        subtitle: '우리가 만드는 모든 제품의 디자인 철학입니다.',
      });
      showToast('✓ 인용구 템플릿이 적용되었습니다.');
    } else if (templateType === 'showcase') {
      updateCurrentSlide({
        layout: 'showcase',
        title: '신제품 핵심 아키텍처 쇼케이스',
        subtitle: '완벽한 반응형 인터페이스와 모던 사용자 경험',
        imageUrl: sampleImage('데이터 차트', 210),
        bullets: ['실시간 양방향 데이터 바인딩', '서랍형 부드러운 애니메이션', '초경량 고성능 엔진 탑재'],
      });
      showToast('✓ 이미지 쇼케이스 템플릿이 적용되었습니다.');
    }
  };

  const handleSlideImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      updateCurrentSlide({ imageUrl: dataUrl, layout: 'showcase' });
      showToast('✓ 슬라이드에 이미지가 추가되었습니다.');
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const addNewSlide = (layout: SlideItem['layout'] = 'bullet') => {
    const newSlide: SlideItem = {
      id: `slide_${Date.now()}`,
      layout,
      title: layout === 'title' ? '새 프레젠테이션' : '슬라이드 제목을 입력하세요',
      subtitle: layout === 'title' ? '발표 주제 및 팀명' : '핵심 포인트 요약',
      bullets: layout === 'bullet' ? ['첫 번째 핵심 내용', '두 번째 추진 전략', '기대 효과 및 로드맵'] : [],
      col1Text: layout === 'two-column' ? '왼쪽 비교 항목' : undefined,
      col2Text: layout === 'two-column' ? '오른쪽 비교 항목' : undefined,
      metricNumber: layout === 'metric' ? '98.5%' : undefined,
      metricLabel: layout === 'metric' ? '고객 만족도 및 목표 달성률' : undefined,
      quoteAuthor: layout === 'quote' ? '빌 게이츠' : undefined,
      bgTheme: currentSlide?.bgTheme || 'beige',
      notes: '',
    };
    setSlides((prev) => [...prev, newSlide]);
    setCurrentSlideIndex(slides.length);
    setSaveStatus('dirty');
    showToast('새 슬라이드가 추가되었습니다.');
  };

  const duplicateCurrentSlide = () => {
    const clone: SlideItem = {
      ...currentSlide,
      id: `slide_${Date.now()}`,
      title: `${currentSlide.title} (복사본)`,
    };
    const nextSlides = [...slides];
    nextSlides.splice(currentSlideIndex + 1, 0, clone);
    setSlides(nextSlides);
    setCurrentSlideIndex(currentSlideIndex + 1);
    setSaveStatus('dirty');
    showToast('슬라이드가 복제되었습니다.');
  };

  const deleteCurrentSlide = () => {
    if (slides.length <= 1) {
      showToast('최소 한 개의 슬라이드가 필요합니다.');
      return;
    }
    const nextSlides = slides.filter((_, idx) => idx !== currentSlideIndex);
    setSlides(nextSlides);
    setCurrentSlideIndex(Math.max(0, currentSlideIndex - 1));
    setSaveStatus('dirty');
    showToast('슬라이드가 삭제되었습니다.');
  };

  const moveSlide = (dir: 'up' | 'down') => {
    const targetIdx = dir === 'up' ? currentSlideIndex - 1 : currentSlideIndex + 1;
    if (targetIdx < 0 || targetIdx >= slides.length) return;
    const nextSlides = [...slides];
    const temp = nextSlides[currentSlideIndex];
    nextSlides[currentSlideIndex] = nextSlides[targetIdx];
    nextSlides[targetIdx] = temp;
    setSlides(nextSlides);
    setCurrentSlideIndex(targetIdx);
    setSaveStatus('dirty');
  };

  // Slideshow Timer
  useEffect(() => {
    let interval: any = null;
    if (isSlideShowActive) {
      interval = setInterval(() => {
        setSlideShowTimer((prev) => prev + 1);
      }, 1000);
    } else {
      setSlideShowTimer(0);
    }
    return () => clearInterval(interval);
  }, [isSlideShowActive]);

  // Slideshow keyboard navigation
  useEffect(() => {
    if (!isSlideShowActive) return;
    const handleSlideNav = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') {
        e.preventDefault();
        setCurrentSlideIndex((prev) => Math.min(slides.length - 1, prev + 1));
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        setCurrentSlideIndex((prev) => Math.max(0, prev - 1));
      } else if (e.key === 'Escape') {
        setIsSlideShowActive(false);
      }
    };
    window.addEventListener('keydown', handleSlideNav);
    return () => window.removeEventListener('keydown', handleSlideNav);
  }, [isSlideShowActive, slides.length]);

  // ========================================================
  // GEMINI AI 2.5 FLASH ASSISTANT (SLEEK DRAWER)
  // ========================================================
  const handleRunAiAssist = async (
    action: 'expand' | 'summarize' | 'polish' | 'outline' | 'custom'
  ) => {
    setIsAiLoading(true);
    setAiLastResult(null);

    try {
      if (fileType === 'doc') {
        const result = await assistDocumentWithGemini({
          action,
          docTitle: title,
          currentContent: docContent,
          userInstruction: aiPrompt,
        });
        if (result && !result.includes('오류')) {
          setAiLastResult(result);
          showToast('✓ Gemini 2.5가 답변을 준비했습니다.');
        } else {
          showToast('AI 처리 중 오류가 발생했습니다.');
        }
      } else if (fileType === 'sheet') {
        const currentCsv = currentSheet.data.map((r) => r.join(',')).join('\n');
        const result = await assistDocumentWithGemini({
          action: 'custom',
          docTitle: title,
          currentContent: currentCsv,
          userInstruction:
            aiPrompt ||
            '스프레드시트에 바로 들어갈 수 있도록 쉼표로 구분된 CSV 형식의 관련 데이터 행 4개를 작성해줘',
        });
        if (result) {
          setAiLastResult(result);
          showToast('✓ AI가 데이터 분석 및 표 작성을 완료했습니다.');
        }
      } else if (fileType === 'slide') {
        const result = await assistDocumentWithGemini({
          action: 'outline',
          docTitle: title,
          currentContent: slides.map((s) => s.title).join(', '),
          userInstruction:
            aiPrompt || '이 발표 주제를 보강할 새로운 슬라이드 2개의 제목과 핵심 글머리 3개를 작성해줘',
        });
        if (result) {
          setAiLastResult(result);
          showToast('✓ AI 발표 슬라이드 제안이 준비되었습니다.');
        }
      }
    } catch {
      showToast('AI 처리 중 일시적인 오류가 발생했습니다.');
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleApplyAiResultToEditor = () => {
    if (!aiLastResult) return;

    if (fileType === 'doc') {
      const appended = docContent.trim()
        ? `${docContent}\n\n---\n### ✨ Gemini 2.5 제안 내용\n${aiLastResult}`
        : aiLastResult;
      recordDocChange(appended);
      showToast('✓ Gemini 2.5 답변이 문서에 반영되었습니다!');
    } else if (fileType === 'sheet') {
      const newRows = aiLastResult
        .split('\n')
        .filter((line) => line.includes(','))
        .map((line) => line.split(',').map((c) => c.trim().replace(/^"/, '').replace(/"$/, '')));
      if (newRows.length > 0) {
        setSheetTabs((prev) =>
          prev.map((tab) =>
            tab.id === activeTabId ? { ...tab, data: [...tab.data, ...newRows] } : tab
          )
        );
        setSaveStatus('dirty');
        showToast('✓ AI 생성 데이터가 시트에 추가되었습니다!');
      }
    } else if (fileType === 'slide') {
      addNewSlide('bullet');
      updateCurrentSlide({
        title: '✨ Gemini 제안: 핵심 전략 및 기대효과',
        bullets: ['데이터 기반 의사결정 프로세스 확립', '협업 능률 40% 이상 향상', '실시간 동기화로 업무 낭비 제거'],
      });
      showToast('✓ AI 슬라이드가 추가되었습니다!');
    }
    setAiLastResult(null);
  };

  // ========================================================
  // EXPORT / DOWNLOAD & PRINT
  // ========================================================
  const handleExportFile = (format: 'txt' | 'csv' | 'json' | 'md') => {
    let textData = '';
    let mimeType = 'text/plain;charset=utf-8';
    let fileExt = format;

    if (fileType === 'doc') {
      textData = docContent;
      fileExt = format === 'md' ? 'md' : 'txt';
    } else if (fileType === 'sheet') {
      textData = currentSheet.data
        .map((r) => r.map((c) => `"${(c || '').replace(/"/g, '""')}"`).join(','))
        .join('\n');
      fileExt = 'csv';
      mimeType = 'text/csv;charset=utf-8';
    } else {
      textData = JSON.stringify(slides, null, 2);
      fileExt = 'json';
      mimeType = 'application/json;charset=utf-8';
    }

    const blob = new Blob([textData], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title.replace(/\.[^/.]+$/, '')}.${fileExt}`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(`✓ ${fileExt.toUpperCase()} 파일로 다운로드되었습니다.`);
  };

  const handlePrintDocument = () => {
    window.print();
  };

  const handleShareToActiveChat = () => {
    if (!onShareToChat) return;
    const snippet =
      fileType === 'doc'
        ? docContent.substring(0, 200) + '...'
        : fileType === 'sheet'
        ? `[스프레드시트: ${title}] 총 ${currentSheet.data.length}개 행의 데이터`
        : `[슬라이드: ${title}] 총 ${slides.length}개 슬라이드 프레젠테이션`;

    onShareToChat(
      `📄 **${title}** 문서를 공유했습니다.\n\`\`\`\n${snippet}\n\`\`\`\n클라우드 워크스페이스에서 실시간으로 열람 가능합니다.`
    );
    showToast('✓ 현재 대화창에 문서가 공유되었습니다!');
  };

  // ========================================================
  // FULL-SCREEN SLIDESHOW OVERLAY
  // ========================================================
  if (isSlideShowActive) {
    const activeTheme =
      SLIDE_THEMES.find((t) => t.id === currentSlide.bgTheme) || SLIDE_THEMES[0];
    const mins = Math.floor(slideShowTimer / 60);
    const secs = slideShowTimer % 60;

    return (
      <div className="fixed inset-0 z-50 bg-black flex flex-col justify-between p-6 sm:p-12 select-none animate-in fade-in">
        {/* Presenter HUD Top */}
        <div className="flex items-center justify-between text-white/70 text-xs z-10">
          <div className="flex items-center gap-3">
            <span className="font-bold text-white text-sm">{title}</span>
            <span>•</span>
            <span className="flex items-center gap-1 font-mono bg-white/10 px-2 py-0.5 rounded">
              <Clock className="w-3.5 h-3.5" />
              {mins}:{secs < 10 ? `0${secs}` : secs}
            </span>
          </div>
          <button
            onClick={() => setIsSlideShowActive(false)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/20 hover:bg-white/30 text-white font-bold text-xs cursor-pointer transition-colors"
          >
            <X className="w-4 h-4" />
            <span>슬라이드 쇼 종료 (ESC)</span>
          </button>
        </div>

        {/* Slide Presentation Canvas */}
        <div className="flex-1 flex items-center justify-center my-4">
          <div
            className={`w-full max-w-5xl aspect-[16/9] rounded-2xl p-10 sm:p-16 shadow-2xl bg-gradient-to-br ${activeTheme.bg} ${activeTheme.text} flex flex-col justify-between transition-all duration-300`}
          >
            <div>
              <h1 className="text-3xl sm:text-5xl font-black tracking-tight leading-tight mb-3">
                {currentSlide.title || '제목 없음'}
              </h1>
              {currentSlide.subtitle && (
                <p className="text-lg sm:text-2xl opacity-80 font-medium">
                  {currentSlide.subtitle}
                </p>
              )}
            </div>

            {/* Layout Specific Render in Slideshow */}
            {currentSlide.layout === 'bullet' && (
              <div className="space-y-3 my-auto">
                {currentSlide.bullets.map((b, idx) => (
                  <div key={idx} className="flex items-center gap-3 text-lg sm:text-xl font-medium">
                    <span style={{ color: activeTheme.accent }} className="text-2xl font-black">
                      •
                    </span>
                    <span>{b}</span>
                  </div>
                ))}
              </div>
            )}

            {currentSlide.layout === 'metric' && (
              <div className="my-auto text-center p-6 bg-white/10 rounded-2xl backdrop-blur-xs">
                <div
                  style={{ color: activeTheme.accent }}
                  className="text-6xl sm:text-8xl font-black font-mono tracking-tighter"
                >
                  {currentSlide.metricNumber || '100%'}
                </div>
                <div className="text-xl sm:text-2xl mt-2 font-bold opacity-90">
                  {currentSlide.metricLabel || '핵심 성과 지표'}
                </div>
              </div>
            )}

            {currentSlide.layout === 'quote' && (
              <div className="my-auto p-8 border-l-4 border-white/40 italic">
                <p className="text-2xl sm:text-3xl font-serif">"{currentSlide.title}"</p>
                <p className="text-base sm:text-lg mt-4 font-bold text-right opacity-80">
                  — {currentSlide.quoteAuthor || '발표자'}
                </p>
              </div>
            )}

            {currentSlide.layout === 'showcase' && (
              <div className="my-auto grid grid-cols-2 gap-6 items-center">
                {currentSlide.imageUrl && (
                  <img
                    src={currentSlide.imageUrl}
                    alt=""
                    className="w-full aspect-[4/3] object-cover rounded-xl shadow-lg border border-white/20"
                  />
                )}
                <div className="space-y-2">
                  {currentSlide.bullets.map((b, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-base font-medium">
                      <Check className="w-5 h-5 text-[#34D399] shrink-0" />
                      <span>{b}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center justify-between text-xs opacity-60 border-t border-current/20 pt-4">
              <span>Google Slides 프리젠테이션</span>
              <span>
                {currentSlideIndex + 1} / {slides.length}
              </span>
            </div>
          </div>
        </div>

        {/* Presenter Controls Bottom */}
        <div className="flex items-center justify-center gap-4 text-white">
          <button
            onClick={() => setCurrentSlideIndex((prev) => Math.max(0, prev - 1))}
            disabled={currentSlideIndex === 0}
            className="p-3 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-30 cursor-pointer"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <span className="font-bold text-sm text-white/80">
            {currentSlideIndex + 1} of {slides.length}
          </span>
          <button
            onClick={() => setCurrentSlideIndex((prev) => Math.min(slides.length - 1, prev + 1))}
            disabled={currentSlideIndex === slides.length - 1}
            className="p-3 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-30 cursor-pointer"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        </div>
      </div>
    );
  }

  // ========================================================
  // MAIN WORKSPACE INTERFACE
  // ========================================================
  return (
    <div className="flex flex-col h-full bg-[#FDFBF7] text-[#2C2520] select-none font-sans relative overflow-hidden">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-[#2C2520] text-white text-xs px-4 py-2 rounded-2xl shadow-xl flex items-center gap-2 animate-in fade-in duration-200 pointer-events-none">
          <Check className="w-4 h-4 text-[#48BB78]" />
          <span className="font-medium">{toastMessage}</span>
        </div>
      )}

      {/* Hidden File Inputs for Document & Slide Image Uploads */}
      <input
        type="file"
        ref={docImageInputRef}
        onChange={handleImageFileSelect}
        accept="image/*"
        className="hidden"
      />
      <input
        type="file"
        ref={slideImageInputRef}
        onChange={handleSlideImageUpload}
        accept="image/*"
        className="hidden"
      />

      {/* ======================================================== */}
      {/* 1. TOP HEADER: BRANDING, TITLE, STATUS & SINGLE CLEAN ACTIONS */}
      {/* ======================================================== */}
      <header className="h-14 bg-white border-b border-[#EBE5DA] px-3 sm:px-4 flex items-center justify-between shrink-0 shadow-2xs">
        <div className="flex items-center gap-3 min-w-0">
          {/* App Type Icon */}
          <div
            className={`w-9 h-9 rounded-xl flex items-center justify-center text-white shadow-xs shrink-0 ${
              fileType === 'sheet'
                ? 'bg-[#0F9D58]'
                : fileType === 'slide'
                ? 'bg-[#F4B400]'
                : 'bg-[#4285F4]'
            }`}
          >
            {fileType === 'sheet' ? (
              <Table className="w-5 h-5" />
            ) : fileType === 'slide' ? (
              <Presentation className="w-5 h-5" />
            ) : (
              <FileText className="w-5 h-5" />
            )}
          </div>

          {/* Document Title with Inline Editing */}
          <div className="min-w-0 flex flex-col justify-center">
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                data-testid="doc-title"
                aria-label="문서 제목"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  setSaveStatus('dirty');
                }}
                className="text-xs sm:text-sm font-bold text-[#2C2520] bg-transparent hover:bg-[#F4EFE6] px-1.5 py-0.5 rounded-lg border border-transparent hover:border-[#EBE5DA] focus:border-[#C18C5D] focus:bg-white focus:outline-none truncate max-w-[160px] sm:max-w-xs transition-colors"
                title="문서 제목 클릭하여 변경"
              />
            </div>
            <div className="flex items-center gap-2 text-[10px] text-[#7A6A5C] px-1.5">
              <span className="font-semibold">
                {fileType === 'sheet'
                  ? 'Google Sheets (엑셀 호환)'
                  : fileType === 'slide'
                  ? 'Google Slides (Canva 스튜디오)'
                  : 'Google Docs (클라우드 오피스)'}
              </span>
              <span>•</span>
              <span
                className={`flex items-center gap-1 font-bold ${
                  saveStatus === 'saved'
                    ? 'text-[#0F9D58]'
                    : saveStatus === 'saving'
                    ? 'text-[#E67E22]'
                    : 'text-[#EA4335]'
                }`}
              >
                {saveStatus === 'saved' && <Check className="w-3 h-3" />}
                {saveStatus === 'saving' && <RefreshCw className="w-3 h-3 animate-spin" />}
                {saveStatus === 'saved'
                  ? `저장 완료 (${lastSavedTime})`
                  : saveStatus === 'saving'
                  ? '클라우드 저장 중...'
                  : '수정 사항 저장 대기'}
              </span>
            </div>
          </div>
        </div>

        {/* Global Action Toolbar */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Gemini AI Side Drawer Toggle Button (Single clean button) */}
          <button
            onClick={() => setShowAiDrawer(!showAiDrawer)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer ${
              showAiDrawer
                ? 'bg-gradient-to-r from-[#1A73E8] to-[#9333EA] text-white ring-2 ring-[#C18C5D]/40'
                : 'bg-gradient-to-r from-[#4285F4] to-[#9C27B0] hover:opacity-95 text-white'
            }`}
            title="Gemini 2.5 AI 오피스 비서 서랍 열기"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Gemini AI 비서</span>
          </button>

          {/* Share to Chat button */}
          {onShareToChat && (
            <button
              onClick={handleShareToActiveChat}
              className="p-1.5 rounded-xl hover:bg-[#F4EFE6] text-[#5C5046] border border-[#EBE5DA] transition-colors cursor-pointer"
              title="현재 대화방(채팅)에 문서 바로 공유하기"
            >
              <Share2 className="w-4 h-4 text-[#3E2723]" />
            </button>
          )}

          {/* Export / Download */}
          <button
            onClick={() => handleExportFile(fileType === 'sheet' ? 'csv' : 'txt')}
            className="p-1.5 rounded-xl hover:bg-[#F4EFE6] text-[#5C5046] border border-[#EBE5DA] transition-colors cursor-pointer"
            title="파일 다운로드 (txt / csv / json)"
          >
            <Download className="w-4 h-4 text-[#3E2723]" />
          </button>

          {/* Print for Docs */}
          {fileType === 'doc' && (
            <button
              onClick={handlePrintDocument}
              className="p-1.5 rounded-xl hover:bg-[#F4EFE6] text-[#5C5046] border border-[#EBE5DA] transition-colors cursor-pointer hidden md:flex"
              title="인쇄 및 PDF로 저장"
            >
              <Printer className="w-4 h-4 text-[#3E2723]" />
            </button>
          )}

          {/* Explicit Save Button */}
          <button
            onClick={handleManualSave}
            disabled={saveStatus === 'saving'}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer ${
              saveStatus === 'saved'
                ? 'bg-white border border-[#EBE5DA] text-[#2C2520] hover:bg-[#FDFBF7]'
                : 'bg-[#3E2723] text-white hover:bg-[#2C2520]'
            }`}
          >
            <Save className="w-3.5 h-3.5" />
            <span>저장</span>
          </button>

          {/* Close Editor */}
          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl hover:bg-[#FEE2E2] text-[#7A6A5C] hover:text-[#DC2626] border border-[#EBE5DA] transition-colors cursor-pointer ml-1"
              title="에디터 닫고 대화로 복귀"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </header>

      {/* ======================================================== */}
      {/* 2. SUB-TOOLBAR: SPECIFIC TO DOCS / SHEETS / SLIDES */}
      {/* ======================================================== */}
      {fileType === 'doc' && (
        <div className="bg-[#FAF7F2] border-b border-[#EBE5DA] px-3 py-1.5 flex items-center justify-between text-xs overflow-x-auto gap-2">
          <div className="flex items-center gap-1 shrink-0">
            {/* Undo / Redo */}
            <button
              onClick={handleUndo}
              disabled={historyIndex <= 0}
              className="p-1.5 rounded-lg hover:bg-white text-[#5C5046] disabled:opacity-30 cursor-pointer"
              title="실행 취소 (Ctrl+Z)"
            >
              <Undo className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleRedo}
              disabled={historyIndex >= history.length - 1}
              className="p-1.5 rounded-lg hover:bg-white text-[#5C5046] disabled:opacity-30 cursor-pointer"
              title="다시 실행 (Ctrl+Y)"
            >
              <Redo className="w-3.5 h-3.5" />
            </button>

            <div className="w-[1px] h-4 bg-[#EBE5DA] mx-1" />

            {/* Font Family */}
            <select
              value={fontFamily}
              onChange={(e) => setFontFamily(e.target.value)}
              className="bg-white border border-[#EBE5DA] rounded-lg px-2 py-1 text-xs text-[#2C2520] focus:outline-none"
            >
              <option value="Noto Sans KR">노토 산스 (기본)</option>
              <option value="Pretendard">프리텐다드</option>
              <option value="Nanum Myeongjo, serif">나눔명조 (세리프)</option>
              <option value="D2Coding, monospace">D2코딩 (고정폭)</option>
            </select>

            {/* Font Size */}
            <div className="flex items-center border border-[#EBE5DA] rounded-lg bg-white overflow-hidden">
              <button
                onClick={() => setFontSize((prev) => Math.max(10, prev - 1))}
                className="px-1.5 py-0.5 hover:bg-[#F4EFE6] text-xs font-bold text-[#5C5046]"
              >
                -
              </button>
              <span className="px-2 text-xs font-mono font-bold text-[#2C2520]">{fontSize}</span>
              <button
                onClick={() => setFontSize((prev) => Math.min(36, prev + 1))}
                className="px-1.5 py-0.5 hover:bg-[#F4EFE6] text-xs font-bold text-[#5C5046]"
              >
                +
              </button>
            </div>

            <div className="w-[1px] h-4 bg-[#EBE5DA] mx-1" />

            {/* Headings */}
            <button
              onClick={() => insertTextAtCursor('# ', '\n', '대제목 1')}
              className="px-2 py-1 rounded-lg hover:bg-white border border-transparent hover:border-[#EBE5DA] font-bold text-xs"
              title="대제목 (H1)"
            >
              H1
            </button>
            <button
              onClick={() => insertTextAtCursor('## ', '\n', '중제목 2')}
              className="px-2 py-1 rounded-lg hover:bg-white border border-transparent hover:border-[#EBE5DA] font-bold text-xs"
              title="중제목 (H2)"
            >
              H2
            </button>
            <button
              onClick={() => insertTextAtCursor('### ', '\n', '소제목 3')}
              className="px-2 py-1 rounded-lg hover:bg-white border border-transparent hover:border-[#EBE5DA] font-bold text-xs"
              title="소제목 (H3)"
            >
              H3
            </button>

            <div className="w-[1px] h-4 bg-[#EBE5DA] mx-1" />

            {/* Basic Formatting */}
            <button
              onClick={() => insertTextAtCursor('**', '**', '굵은 텍스트')}
              className="p-1.5 rounded-lg hover:bg-white text-[#3E2723]"
              title="굵게 (Ctrl+B)"
            >
              <Bold className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => insertTextAtCursor('*', '*', '기울임 텍스트')}
              className="p-1.5 rounded-lg hover:bg-white text-[#3E2723]"
              title="기울임 (Ctrl+I)"
            >
              <Italic className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => insertTextAtCursor('<u>', '</u>', '밑줄 텍스트')}
              className="p-1.5 rounded-lg hover:bg-white text-[#3E2723]"
              title="밑줄"
            >
              <Underline className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => insertTextAtCursor('~~', '~~', '취소선 텍스트')}
              className="p-1.5 rounded-lg hover:bg-white text-[#3E2723]"
              title="취소선"
            >
              <Strikethrough className="w-3.5 h-3.5" />
            </button>

            <div className="w-[1px] h-4 bg-[#EBE5DA] mx-1" />

            {/* Image Insertion Button */}
            <button
              onClick={() => docImageInputRef.current?.click()}
              className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white hover:bg-[#F4EFE6] border border-[#EBE5DA] text-xs font-semibold text-[#1A73E8] shadow-2xs cursor-pointer"
              title="내 컴퓨터에서 이미지 업로드 및 삽입"
            >
              <ImageIcon className="w-3.5 h-3.5" />
              <span>이미지 삽입</span>
            </button>

            {/* Image URL Modal Trigger */}
            <button
              onClick={() => setShowImageModal(true)}
              className="p-1.5 rounded-lg hover:bg-white text-[#5C5046]"
              title="웹 이미지 URL 삽입"
            >
              <Upload className="w-3.5 h-3.5" />
            </button>

            <div className="w-[1px] h-4 bg-[#EBE5DA] mx-1" />

            {/* Lists */}
            <button
              onClick={() => insertTextAtCursor('- ', '', '글머리 기호 항목')}
              className="p-1.5 rounded-lg hover:bg-white text-[#3E2723]"
              title="글머리 기호 목록"
            >
              <List className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => insertTextAtCursor('1. ', '', '번호 매기기 항목')}
              className="p-1.5 rounded-lg hover:bg-white text-[#3E2723]"
              title="번호 매기기 목록"
            >
              <ListOrdered className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => insertTextAtCursor('- [ ] ', '', '체크리스트 할 일')}
              className="p-1.5 rounded-lg hover:bg-white text-[#3E2723]"
              title="할 일 체크박스"
            >
              <CheckSquare className="w-3.5 h-3.5" />
            </button>

            <div className="w-[1px] h-4 bg-[#EBE5DA] mx-1" />

            {/* Table & Callout */}
            <button
              onClick={() => insertTable(3, 3)}
              className="px-2 py-1 rounded-lg hover:bg-white border border-transparent hover:border-[#EBE5DA] text-xs font-semibold text-[#3E2723]"
              title="표 삽입 (3x3)"
            >
              표 삽입
            </button>
            <button
              onClick={() => insertCalloutBox('tip')}
              className="px-2 py-1 rounded-lg hover:bg-white border border-transparent hover:border-[#EBE5DA] text-xs font-semibold text-[#3E2723]"
              title="안내 상자 삽입"
            >
              팁 박스
            </button>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* View Mode Toggle: Edit / Preview / Split */}
            <div className="flex items-center bg-white border border-[#EBE5DA] rounded-lg p-0.5 shadow-2xs">
              <button
                onClick={() => setDocViewMode('edit')}
                className={`px-2 py-0.5 rounded text-[11px] font-bold cursor-pointer transition-colors ${
                  docViewMode === 'edit' ? 'bg-[#3E2723] text-white' : 'text-[#7A6A5C] hover:text-[#2C2520]'
                }`}
              >
                편집
              </button>
              <button
                onClick={() => setDocViewMode('preview')}
                className={`px-2 py-0.5 rounded text-[11px] font-bold cursor-pointer transition-colors ${
                  docViewMode === 'preview' ? 'bg-[#3E2723] text-white' : 'text-[#7A6A5C] hover:text-[#2C2520]'
                }`}
              >
                미리보기
              </button>
              <button
                onClick={() => setDocViewMode('split')}
                className={`px-2 py-0.5 rounded text-[11px] font-bold cursor-pointer transition-colors hidden sm:block ${
                  docViewMode === 'split' ? 'bg-[#3E2723] text-white' : 'text-[#7A6A5C] hover:text-[#2C2520]'
                }`}
              >
                분할
              </button>
            </div>

            {/* Outline Toggle */}
            <button
              onClick={() => setShowOutline(!showOutline)}
              className={`flex items-center gap-1 px-2 py-1 rounded-lg border text-xs font-semibold cursor-pointer ${
                showOutline
                  ? 'bg-white border-[#C18C5D] text-[#3E2723] shadow-xs'
                  : 'border-transparent hover:bg-white text-[#7A6A5C]'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>목차 ({outlineHeadings.length})</span>
            </button>

            {/* Find & Replace Toggle */}
            <button
              onClick={() => setShowFindReplace(!showFindReplace)}
              className={`p-1.5 rounded-lg hover:bg-white text-[#5C5046] border ${
                showFindReplace ? 'border-[#C18C5D] bg-white' : 'border-transparent'
              }`}
              title="찾기 및 바꾸기 (Ctrl+F)"
            >
              <Search className="w-3.5 h-3.5" />
            </button>

            {/* Zoom Controls */}
            <div className="flex items-center border border-[#EBE5DA] rounded-lg bg-white px-1">
              <button
                onClick={() => setDocZoom((prev) => Math.max(75, prev - 10))}
                className="p-1 hover:bg-[#F4EFE6] text-[#7A6A5C]"
                title="축소"
              >
                <ZoomOut className="w-3 h-3" />
              </button>
              <span className="text-[10px] font-mono px-1 font-bold">{docZoom}%</span>
              <button
                onClick={() => setDocZoom((prev) => Math.min(150, prev + 10))}
                className="p-1 hover:bg-[#F4EFE6] text-[#7A6A5C]"
                title="확대"
              >
                <ZoomIn className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SHEETS FORMULA & EXCEL GRID TOOLBAR */}
      {fileType === 'sheet' && (
        <div className="bg-[#FAF7F2] border-b border-[#EBE5DA] px-3 py-1.5 flex flex-col gap-1.5">
          {/* Top Sheet Toolbar */}
          <div className="flex items-center justify-between text-xs overflow-x-auto gap-2">
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={addSheetRow}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white hover:bg-[#F4EFE6] border border-[#EBE5DA] text-xs font-bold text-[#0F9D58] shadow-2xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>행 추가</span>
              </button>
              <button
                onClick={addSheetCol}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white hover:bg-[#F4EFE6] border border-[#EBE5DA] text-xs font-bold text-[#0F9D58] shadow-2xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>열 추가</span>
              </button>

              <div className="w-[1px] h-4 bg-[#EBE5DA] mx-1" />

              <button
                onClick={deleteSelectedRow}
                className="px-2 py-1 rounded-lg hover:bg-[#FEE2E2] text-[#DC2626] font-semibold text-xs"
                title="현재 선택된 행 삭제"
              >
                행 삭제
              </button>
              <button
                onClick={deleteSelectedCol}
                className="px-2 py-1 rounded-lg hover:bg-[#FEE2E2] text-[#DC2626] font-semibold text-xs"
                title="현재 선택된 열 삭제"
              >
                열 삭제
              </button>

              <div className="w-[1px] h-4 bg-[#EBE5DA] mx-1" />

              {/* Sorting */}
              <button
                onClick={() => sortColumn(true)}
                className="flex items-center gap-0.5 px-2 py-1 rounded-lg hover:bg-white text-[#5C5046] text-xs font-semibold"
                title="선택된 열 오름차순 정렬 (A→Z)"
              >
                <ArrowUp className="w-3.5 h-3.5" />
                <span>오름차순</span>
              </button>
              <button
                onClick={() => sortColumn(false)}
                className="flex items-center gap-0.5 px-2 py-1 rounded-lg hover:bg-white text-[#5C5046] text-xs font-semibold"
                title="선택된 열 내림차순 정렬 (Z→A)"
              >
                <ArrowDown className="w-3.5 h-3.5" />
                <span>내림차순</span>
              </button>

              <div className="w-[1px] h-4 bg-[#EBE5DA] mx-1" />

              {/* Chart Visualizer */}
              <button
                onClick={() => setShowChartModal(true)}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white hover:bg-[#E6F4EA] border border-[#BBF7D0] text-xs font-bold text-[#0F9D58]"
                title="현재 시트 데이터로 차트 생성"
              >
                <BarChart3 className="w-3.5 h-3.5" />
                <span>차트 생성</span>
              </button>
            </div>

            {/* Quick Status Bar on Right */}
            <div className="flex items-center gap-3 text-xs bg-white px-2.5 py-1 rounded-lg border border-[#EBE5DA] shrink-0 font-mono">
              <span className="text-[#7A6A5C]">
                선택 열 합계: <b className="text-[#0F9D58]">{sheetStats.sum}</b>
              </span>
              <span>•</span>
              <span className="text-[#7A6A5C]">
                평균: <b className="text-[#2C2520]">{sheetStats.avg}</b>
              </span>
              <span>•</span>
              <span className="text-[#7A6A5C]">
                항목 수: <b className="text-[#2C2520]">{sheetStats.count}</b>
              </span>
            </div>
          </div>

          {/* Formula fx Bar */}
          <div className="flex items-center gap-2">
            <div className="px-2.5 py-1 rounded-lg bg-white border border-[#0F9D58]/40 font-mono font-bold text-xs text-[#0F9D58] min-w-14 text-center shadow-2xs">
              {getColLetter(selectedCell.c)}
              {selectedCell.r + 1}
            </div>
            <div className="font-serif italic font-black text-[#A89A8E] text-sm select-none">
              fx
            </div>
            <input
              type="text"
              value={formulaBarInput}
              onChange={(e) => {
                setFormulaBarInput(e.target.value);
                updateCell(selectedCell.r, selectedCell.c, e.target.value);
              }}
              placeholder="수식(=SUM(A1:A5), =AVERAGE(A1:A5), =C2*D2) 또는 셀 값 입력..."
              className="flex-1 bg-white border border-[#EBE5DA] rounded-lg px-3 py-1 text-xs text-[#2C2520] focus:outline-none focus:border-[#0F9D58] font-mono shadow-2xs"
            />
          </div>
        </div>
      )}

      {/* CANVA-LIKE SLIDES TOOLBAR */}
      {fileType === 'slide' && (
        <div className="bg-[#FAF7F2] border-b border-[#EBE5DA] px-3 py-1.5 flex items-center justify-between text-xs overflow-x-auto gap-2">
          <div className="flex items-center gap-2 shrink-0">
            {/* New Slide with Layout Choice */}
            <button
              onClick={() => addNewSlide('bullet')}
              className="flex items-center gap-1 px-3 py-1 rounded-xl bg-white hover:bg-[#FDFBF7] border border-[#EBE5DA] text-xs font-bold text-[#F4B400] shadow-2xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>새 슬라이드</span>
            </button>

            {/* Layout switch for current slide */}
            <select
              value={currentSlide?.layout || 'bullet'}
              onChange={(e) =>
                updateCurrentSlide({ layout: e.target.value as SlideItem['layout'] })
              }
              className="bg-white border border-[#EBE5DA] rounded-lg px-2.5 py-1 text-xs font-semibold text-[#5C5046] focus:outline-none"
            >
              <option value="title">🎯 타이틀 레이아웃</option>
              <option value="bullet">📝 본문 글머리 레이아웃</option>
              <option value="two-column">⚖️ 2열 비교 레이아웃</option>
              <option value="metric">📊 핵심 지표 강조 레이아웃</option>
              <option value="showcase">🖼️ 이미지 쇼케이스 레이아웃</option>
              <option value="quote">💬 명언/인용구 레이아웃</option>
            </select>

            {/* Theme Palette Choice */}
            <select
              value={currentSlide?.bgTheme || 'beige'}
              onChange={(e) => updateCurrentSlide({ bgTheme: e.target.value })}
              className="bg-white border border-[#EBE5DA] rounded-lg px-2.5 py-1 text-xs font-semibold text-[#5C5046] focus:outline-none"
            >
              {SLIDE_THEMES.map((theme) => (
                <option key={theme.id} value={theme.id}>
                  🎨 {theme.name} 테마
                </option>
              ))}
            </select>

            <div className="w-[1px] h-4 bg-[#EBE5DA] mx-1" />

            {/* Move Up / Down */}
            <button
              onClick={() => moveSlide('up')}
              disabled={currentSlideIndex === 0}
              className="p-1 rounded-lg hover:bg-white text-[#5C5046] disabled:opacity-30"
              title="슬라이드 위로 이동"
            >
              <MoveUp className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => moveSlide('down')}
              disabled={currentSlideIndex === slides.length - 1}
              className="p-1 rounded-lg hover:bg-white text-[#5C5046] disabled:opacity-30"
              title="슬라이드 아래로 이동"
            >
              <MoveDown className="w-3.5 h-3.5" />
            </button>

            <div className="w-[1px] h-4 bg-[#EBE5DA] mx-1" />

            <button
              onClick={duplicateCurrentSlide}
              className="px-2.5 py-1 rounded-lg hover:bg-white text-[#5C5046] text-xs font-semibold"
              title="현재 슬라이드 복제"
            >
              슬라이드 복제
            </button>
            <button
              onClick={deleteCurrentSlide}
              className="px-2.5 py-1 rounded-lg hover:bg-[#FEE2E2] text-[#DC2626] text-xs font-semibold"
              title="현재 슬라이드 삭제"
            >
              슬라이드 삭제
            </button>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setShowNotesDrawer(!showNotesDrawer)}
              className={`px-2.5 py-1 rounded-lg border text-xs font-semibold cursor-pointer ${
                showNotesDrawer
                  ? 'bg-white border-[#C18C5D] text-[#3E2723]'
                  : 'border-transparent hover:bg-white text-[#7A6A5C]'
              }`}
            >
              발표자 메모
            </button>

            {/* Slide Show Button */}
            <button
              onClick={() => setIsSlideShowActive(true)}
              className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-[#F4B400] hover:bg-[#D99B00] text-white font-bold text-xs shadow-xs transition-colors cursor-pointer"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>슬라이드 쇼 (전체화면)</span>
            </button>
          </div>
        </div>
      )}

      {/* Find & Replace Bar Popup */}
      {showFindReplace && fileType === 'doc' && (
        <div className="bg-white border-b border-[#EBE5DA] p-2.5 flex items-center justify-between gap-3 text-xs shadow-md animate-in slide-in-from-top-1">
          <div className="flex items-center gap-2 flex-1">
            <input
              type="text"
              value={findQuery}
              onChange={(e) => setFindQuery(e.target.value)}
              placeholder="찾을 단어 입력..."
              className="px-2.5 py-1 rounded-lg border border-[#EBE5DA] focus:outline-none focus:border-[#4285F4] w-48 text-xs"
            />
            <span className="text-[11px] text-[#7A6A5C] font-mono">{findMatchCount}개 일치</span>
            <input
              type="text"
              value={replaceQuery}
              onChange={(e) => setReplaceQuery(e.target.value)}
              placeholder="바꿀 단어 입력..."
              className="px-2.5 py-1 rounded-lg border border-[#EBE5DA] focus:outline-none focus:border-[#4285F4] w-48 text-xs"
            />
            <button
              onClick={handleReplaceAll}
              disabled={findMatchCount === 0}
              className="px-3 py-1 rounded-lg bg-[#4285F4] text-white font-bold text-xs disabled:opacity-40"
            >
              모두 바꾸기
            </button>
          </div>
          <button
            onClick={() => setShowFindReplace(false)}
            className="p-1 hover:bg-[#F4EFE6] rounded-lg text-[#7A6A5C]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Web Image URL Modal */}
      {showImageModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-md bg-white rounded-2xl border border-[#EBE5DA] p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-[#EBE5DA]">
              <div className="flex items-center gap-2 font-bold text-sm text-[#2C2520]">
                <ImageIcon className="w-4 h-4 text-[#1A73E8]" />
                <span>웹 이미지 삽입</span>
              </div>
              <button onClick={() => setShowImageModal(false)} className="text-[#7A6A5C] hover:text-[#2C2520]">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold text-[#5C5046]">이미지 주소 (URL):</label>
              <input
                type="text"
                value={imageUrlInput}
                onChange={(e) => setImageUrlInput(e.target.value)}
                placeholder="https://example.com/image.jpg"
                className="w-full px-3 py-2 rounded-xl border border-[#EBE5DA] text-xs focus:outline-none focus:border-[#1A73E8]"
              />
            </div>
            <div className="space-y-1.5">
              <span className="text-[11px] font-semibold text-[#7A6A5C]">이미지 주소를 입력하거나 파일을 업로드하세요.</span>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-[#EBE5DA]">
              <button
                type="button"
                onClick={() => setShowImageModal(false)}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold text-[#7A6A5C] hover:bg-[#F4EFE6]"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleInsertImageUrl}
                className="px-4 py-1.5 rounded-xl bg-[#1A73E8] text-white text-xs font-bold shadow-xs cursor-pointer"
              >
                삽입하기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 3. MAIN EDITOR CANVAS BODY */}
      {/* ======================================================== */}
      <div className="flex-1 overflow-hidden flex bg-[#F4EFE6]/30 relative">
        {/* Outline Sidebar for Docs */}
        {fileType === 'doc' && showOutline && (
          <aside className="w-56 bg-white border-r border-[#EBE5DA] p-3 flex flex-col gap-2 overflow-y-auto shrink-0 select-none animate-in slide-in-from-left duration-200">
            <div className="flex items-center justify-between text-xs font-bold text-[#3E2723] pb-1 border-b border-[#EBE5DA]">
              <span>문서 목차</span>
              <button
                onClick={() => setShowOutline(false)}
                className="text-[#7A6A5C] hover:text-[#2C2520]"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            {outlineHeadings.length === 0 ? (
              <p className="text-[11px] text-[#A89A8E] mt-2">
                H1, H2, H3 제목을 추가하면 여기에 목차가 자동 생성됩니다.
              </p>
            ) : (
              <div className="space-y-1">
                {outlineHeadings.map((h, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      showToast(`'${h.text}' 섹션으로 이동`);
                    }}
                    className={`w-full text-left truncate text-xs py-1 px-1.5 rounded-lg hover:bg-[#F4EFE6] text-[#3E2723] transition-colors ${
                      h.level === 1 ? 'font-bold' : h.level === 2 ? 'pl-3 font-medium' : 'pl-5 text-[11px]'
                    }`}
                  >
                    {h.text}
                  </button>
                ))}
              </div>
            )}
          </aside>
        )}

        {/* 3.1 DOCS CANVAS (Realistic A4 Page Presentation) */}
        {fileType === 'doc' && (
          <div className="flex-1 overflow-auto p-4 sm:p-8 flex justify-center">
            {docViewMode === 'split' ? (
              <div className="w-full max-w-6xl grid grid-cols-2 gap-4 h-full">
                {/* Left Editor */}
                <div className="bg-white rounded-2xl border border-[#EBE5DA] shadow-md p-6 flex flex-col">
                  <span className="text-[11px] font-bold text-[#7A6A5C] uppercase tracking-wider mb-2">마크다운 서식 편집</span>
                  <textarea
                    ref={docTextareaRef}
                    value={docContent}
                    onChange={(e) => recordDocChange(e.target.value)}
                    placeholder="문서 작성을 시작하세요..."
                    style={{ fontSize: `${fontSize}px`, fontFamily, lineHeight: lineSpacing }}
                    className="w-full flex-1 bg-transparent border-none text-[#2C2520] focus:outline-none resize-none font-mono"
                  />
                </div>
                {/* Right Preview */}
                <div className="bg-white rounded-2xl border border-[#EBE5DA] shadow-md p-6 overflow-y-auto">
                  <span className="text-[11px] font-bold text-[#1A73E8] uppercase tracking-wider mb-2 block">문서 실시간 미리보기</span>
                  <div
                    style={{ fontFamily, lineHeight: lineSpacing }}
                    className="prose prose-sm max-w-none text-[#2C2520]"
                  >
                    {docContent.split('\n').map((line, idx) => {
                      if (line.startsWith('# ')) {
                        return <h1 key={idx} className="text-2xl font-bold mt-4 mb-2 text-[#2C2520]">{line.replace('# ', '')}</h1>;
                      }
                      if (line.startsWith('## ')) {
                        return <h2 key={idx} className="text-xl font-bold mt-3 mb-1 text-[#3E2723]">{line.replace('## ', '')}</h2>;
                      }
                      if (line.startsWith('### ')) {
                        return <h3 key={idx} className="text-lg font-bold mt-2 mb-1 text-[#5C5046]">{line.replace('### ', '')}</h3>;
                      }
                      if (line.startsWith('![')) {
                        const imgMatch = line.match(/!\[(.*?)\]\((.*?)\)/);
                        if (imgMatch) {
                          return (
                            <div key={idx} className="my-3">
                              <img src={imgMatch[2]} alt={imgMatch[1]} className="max-w-full rounded-xl shadow-md border border-[#EBE5DA]" />
                              {imgMatch[1] && <p className="text-xs text-center text-[#7A6A5C] mt-1">{imgMatch[1]}</p>}
                            </div>
                          );
                        }
                      }
                      if (line.startsWith('> ')) {
                        return (
                          <blockquote key={idx} className="border-l-4 border-[#C18C5D] pl-3 py-1 my-2 bg-[#FAF7F2] rounded-r-lg text-sm text-[#3E2723]">
                            {line.replace('> ', '')}
                          </blockquote>
                        );
                      }
                      return <p key={idx} className="min-h-5 text-sm">{line}</p>;
                    })}
                  </div>
                </div>
              </div>
            ) : docViewMode === 'preview' ? (
              <div
                style={{
                  width: `${docZoom}%`,
                  maxWidth: '850px',
                  fontFamily,
                  lineHeight: lineSpacing,
                }}
                className="bg-white rounded-2xl border border-[#EBE5DA] shadow-xl p-8 sm:p-14 min-h-[780px] flex flex-col transition-all duration-150"
              >
                <div className="prose prose-sm max-w-none text-[#2C2520]">
                  {docContent.split('\n').map((line, idx) => {
                    if (line.startsWith('# ')) {
                      return <h1 key={idx} className="text-3xl font-extrabold mt-4 mb-2 text-[#2C2520]">{line.replace('# ', '')}</h1>;
                    }
                    if (line.startsWith('## ')) {
                      return <h2 key={idx} className="text-2xl font-bold mt-3 mb-1 text-[#3E2723]">{line.replace('## ', '')}</h2>;
                    }
                    if (line.startsWith('### ')) {
                      return <h3 key={idx} className="text-xl font-bold mt-2 mb-1 text-[#5C5046]">{line.replace('### ', '')}</h3>;
                    }
                    if (line.startsWith('![')) {
                      const imgMatch = line.match(/!\[(.*?)\]\((.*?)\)/);
                      if (imgMatch) {
                        return (
                          <div key={idx} className="my-4">
                            <img src={imgMatch[2]} alt={imgMatch[1]} className="max-w-full rounded-xl shadow-md border border-[#EBE5DA]" />
                            {imgMatch[1] && <p className="text-xs text-center text-[#7A6A5C] mt-1">{imgMatch[1]}</p>}
                          </div>
                        );
                      }
                    }
                    if (line.startsWith('> ')) {
                      return (
                        <blockquote key={idx} className="border-l-4 border-[#C18C5D] pl-3 py-1 my-2 bg-[#FAF7F2] rounded-r-lg text-sm text-[#3E2723]">
                          {line.replace('> ', '')}
                        </blockquote>
                      );
                    }
                    return <p key={idx} className="min-h-5 text-sm">{line}</p>;
                  })}
                </div>
              </div>
            ) : (
              <div
                style={{
                  width: `${docZoom}%`,
                  maxWidth: '850px',
                  fontFamily,
                  lineHeight: lineSpacing,
                }}
                className="bg-white rounded-2xl border border-[#EBE5DA] shadow-xl p-8 sm:p-14 min-h-[780px] flex flex-col transition-all duration-150"
              >
                <textarea
                  ref={docTextareaRef}
                  value={docContent}
                  onChange={(e) => recordDocChange(e.target.value)}
                  placeholder="문서 작성을 시작하세요... (상단 도구 모음 또는 이미지 삽입 지원)"
                  style={{
                    fontSize: `${fontSize}px`,
                    color: textColor,
                    backgroundColor: highlightColor === 'transparent' ? 'transparent' : highlightColor,
                  }}
                  className="w-full flex-1 bg-transparent border-none text-[#2C2520] focus:outline-none resize-none leading-relaxed font-sans"
                />
              </div>
            )}
          </div>
        )}

        {/* 3.2 SHEETS EXCEL GRID CANVAS WITH ARROW KEY NAVIGATION */}
        {fileType === 'sheet' && (
          <div className="flex-1 flex flex-col h-full overflow-hidden bg-white">
            <div className="flex-1 overflow-auto">
              <table className="w-full border-collapse font-sans text-xs">
                <thead>
                  <tr className="bg-[#FAF7F2] border-b border-[#DCD3C5] sticky top-0 z-10 shadow-2xs">
                    <th className="w-12 border-r border-[#DCD3C5] p-2 text-center text-[10px] text-[#8C7A6B] font-mono select-none">
                      #
                    </th>
                    {currentSheet.data[0]?.map((_, colIdx) => (
                      <th
                        key={colIdx}
                        onClick={() => focusCellInput(0, colIdx)}
                        className={`border-r border-[#DCD3C5] p-2 text-center text-xs font-bold min-w-28 cursor-pointer select-none ${
                          selectedCell.c === colIdx ? 'bg-[#E6F4EA] text-[#0F9D58]' : 'bg-[#FAF7F2] text-[#5C5046]'
                        }`}
                      >
                        {getColLetter(colIdx)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {currentSheet.data.map((row, rowIdx) => (
                    <tr key={rowIdx} className="hover:bg-[#FDFBF7] border-b border-[#EBE5DA]">
                      <td
                        onClick={() => focusCellInput(rowIdx, 0)}
                        className={`border-r border-[#DCD3C5] p-1 text-center font-mono text-[10px] select-none cursor-pointer ${
                          selectedCell.r === rowIdx ? 'bg-[#E6F4EA] font-bold text-[#0F9D58]' : 'bg-[#FAF7F2] text-[#A89A8E]'
                        }`}
                      >
                        {rowIdx + 1}
                      </td>
                      {row.map((cellValue, colIdx) => {
                        const isSelected = selectedCell.r === rowIdx && selectedCell.c === colIdx;
                        const displayVal = evaluateFormula(cellValue, currentSheet.data);
                        const isHeader = rowIdx === 0;

                        return (
                          <td
                            key={colIdx}
                            onClick={() => focusCellInput(rowIdx, colIdx)}
                            className={`p-0 border-r border-[#EBE5DA] relative ${
                              isSelected
                                ? 'ring-2 ring-[#0F9D58] ring-inset bg-[#E6F4EA]/25 z-5'
                                : isHeader
                                ? 'bg-[#FAF7F2]/60'
                                : ''
                            }`}
                          >
                            <input
                              ref={(el) => {
                                if (el) cellInputRefs.current.set(`${rowIdx}_${colIdx}`, el);
                                else cellInputRefs.current.delete(`${rowIdx}_${colIdx}`);
                              }}
                              type="text"
                              value={isSelected ? cellValue : displayVal}
                              onChange={(e) => updateCell(rowIdx, colIdx, e.target.value)}
                              onKeyDown={(e) => handleCellKeyDown(e, rowIdx, colIdx)}
                              className={`w-full bg-transparent border-none text-xs px-2 py-1.5 focus:outline-none ${
                                isHeader ? 'font-bold text-[#3E2723]' : 'text-[#2C2520]'
                              }`}
                            />
                            {/* Excel-style Active Cell Corner Square */}
                            {isSelected && (
                              <div className="absolute -bottom-1 -right-1 w-2 h-2 bg-[#0F9D58] border border-white z-10 pointer-events-none" />
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Sheet Tabs Bar at Bottom */}
            <div className="h-10 bg-[#FAF7F2] border-t border-[#EBE5DA] px-3 flex items-center justify-between shrink-0 select-none">
              <div className="flex items-center gap-1 overflow-x-auto">
                {sheetTabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTabId(tab.id)}
                    className={`px-3 py-1 rounded-t-lg text-xs font-bold border-t border-x transition-colors cursor-pointer ${
                      activeTabId === tab.id
                        ? 'bg-white border-[#EBE5DA] text-[#0F9D58] shadow-2xs'
                        : 'border-transparent text-[#7A6A5C] hover:bg-white/50'
                    }`}
                  >
                    {tab.name}
                  </button>
                ))}
                <button
                  onClick={() => {
                    const newId = `sheet_${Date.now()}`;
                    const newName = `시트 ${sheetTabs.length + 1}`;
                    setSheetTabs((prev) => [
                      ...prev,
                      { id: newId, name: newName, data: createDefaultSheet() },
                    ]);
                    setActiveTabId(newId);
                    setSaveStatus('dirty');
                    showToast(`'${newName}'이(가) 추가되었습니다.`);
                  }}
                  className="p-1 hover:bg-white rounded-lg text-[#0F9D58] cursor-pointer"
                  title="새 시트 탭 추가"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              <div className="text-[11px] text-[#A89A8E] font-mono">
                총 {currentSheet.data.length}행 × {currentSheet.data[0]?.length || 0}열 (화살표 키로 셀 이동 지원)
              </div>
            </div>
          </div>
        )}

        {/* 3.3 CANVA-LIKE SLIDES STUDIO CANVAS */}
        {fileType === 'slide' && (
          <div className="flex-1 flex overflow-hidden">
            {/* Canva Side Studio Drawer (Templates, Text, Elements, Images) */}
            <aside className="w-64 bg-white border-r border-[#EBE5DA] flex flex-col shrink-0 select-none">
              {/* Studio Tabs */}
              <div className="grid grid-cols-4 border-b border-[#EBE5DA] bg-[#FAF7F2] text-xs text-center font-bold">
                <button
                  onClick={() => setCanvaTab('templates')}
                  className={`py-2 border-b-2 cursor-pointer ${
                    canvaTab === 'templates' ? 'border-[#F4B400] text-[#B45309] bg-white' : 'border-transparent text-[#7A6A5C]'
                  }`}
                >
                  템플릿
                </button>
                <button
                  onClick={() => setCanvaTab('text')}
                  className={`py-2 border-b-2 cursor-pointer ${
                    canvaTab === 'text' ? 'border-[#F4B400] text-[#B45309] bg-white' : 'border-transparent text-[#7A6A5C]'
                  }`}
                >
                  텍스트
                </button>
                <button
                  onClick={() => setCanvaTab('elements')}
                  className={`py-2 border-b-2 cursor-pointer ${
                    canvaTab === 'elements' ? 'border-[#F4B400] text-[#B45309] bg-white' : 'border-transparent text-[#7A6A5C]'
                  }`}
                >
                  요소
                </button>
                <button
                  onClick={() => setCanvaTab('images')}
                  className={`py-2 border-b-2 cursor-pointer ${
                    canvaTab === 'images' ? 'border-[#F4B400] text-[#B45309] bg-white' : 'border-transparent text-[#7A6A5C]'
                  }`}
                >
                  사진
                </button>
              </div>

              {/* Canva Tab Content */}
              <div className="flex-1 overflow-y-auto p-3 space-y-3">
                {canvaTab === 'templates' && (
                  <div className="space-y-2">
                    <span className="text-[11px] font-bold text-[#7A6A5C] uppercase">Canva 추천 템플릿</span>
                    {[
                      { id: 'pitch', title: '🎯 비즈니스 피치덱', desc: '핵심 가치 제안 및 아젠다' },
                      { id: 'kpi', title: '📊 분기 성과 & KPI', desc: '대형 성과 지표와 목표 달성' },
                      { id: 'compare', title: '⚖️ 2열 비교 분석', desc: '도입 전후 / 옵션 대조' },
                      { id: 'showcase', title: '🖼️ 이미지 쇼케이스', desc: '사진과 특징 리스트' },
                      { id: 'quote', title: '💬 인용구 & 비전', desc: '철학과 메시지 강조' },
                    ].map((tmpl) => (
                      <button
                        key={tmpl.id}
                        onClick={() => applySlideTemplate(tmpl.id)}
                        className="w-full text-left p-2.5 rounded-xl border border-[#EBE5DA] hover:border-[#F4B400] hover:bg-[#FFFBEB] transition-all cursor-pointer group"
                      >
                        <div className="text-xs font-bold text-[#2C2520] group-hover:text-[#B45309]">{tmpl.title}</div>
                        <div className="text-[10px] text-[#7A6A5C]">{tmpl.desc}</div>
                      </button>
                    ))}
                  </div>
                )}

                {canvaTab === 'text' && (
                  <div className="space-y-2">
                    <span className="text-[11px] font-bold text-[#7A6A5C] uppercase">텍스트 스타일 추가</span>
                    <button
                      onClick={() => updateCurrentSlide({ title: '대제목을 입력하세요' })}
                      className="w-full text-left p-3 rounded-xl bg-[#FAF7F2] hover:bg-[#F4EFE6] text-sm font-black text-[#2C2520]"
                    >
                      대제목 추가 (Heading)
                    </button>
                    <button
                      onClick={() => updateCurrentSlide({ subtitle: '부제목 설명을 여기에 추가하세요' })}
                      className="w-full text-left p-2.5 rounded-xl bg-[#FAF7F2] hover:bg-[#F4EFE6] text-xs font-bold text-[#5C5046]"
                    >
                      부제목 추가 (Subheading)
                    </button>
                    <button
                      onClick={() =>
                        updateCurrentSlide({
                          bullets: [...currentSlide.bullets, '새 본문 텍스트 항목'],
                        })
                      }
                      className="w-full text-left p-2 rounded-xl bg-[#FAF7F2] hover:bg-[#F4EFE6] text-xs text-[#7A6A5C]"
                    >
                      • 본문 글머리 추가 (Bullet)
                    </button>
                  </div>
                )}

                {canvaTab === 'elements' && (
                  <div className="space-y-2">
                    <span className="text-[11px] font-bold text-[#7A6A5C] uppercase">위젯 & 시각 요소</span>
                    <button
                      onClick={() => updateCurrentSlide({ layout: 'metric', metricNumber: '100%', metricLabel: '성과 지표' })}
                      className="w-full p-2.5 rounded-xl border border-[#EBE5DA] hover:border-[#F4B400] text-center"
                    >
                      <div className="text-2xl font-black text-[#F4B400]">98%</div>
                      <div className="text-[10px] text-[#7A6A5C]">성과 메트릭 위젯</div>
                    </button>
                    <button
                      onClick={() => updateCurrentSlide({ layout: 'two-column', col1Text: 'A 그룹 항목', col2Text: 'B 그룹 항목' })}
                      className="w-full p-2.5 rounded-xl border border-[#EBE5DA] hover:border-[#F4B400] text-xs font-bold text-[#5C5046] flex items-center justify-center gap-2"
                    >
                      <Columns className="w-4 h-4 text-[#F4B400]" />
                      <span>2열 분할 컨테이너</span>
                    </button>
                  </div>
                )}

                {canvaTab === 'images' && (
                  <div className="space-y-3">
                    <button
                      onClick={() => slideImageInputRef.current?.click()}
                      className="w-full py-2.5 rounded-xl bg-[#F4B400] hover:bg-[#D99B00] text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
                    >
                      <Upload className="w-4 h-4" />
                      <span>내 컴퓨터에서 업로드</span>
                    </button>

                    <div className="space-y-1.5">
                      <span className="text-[10px] font-semibold text-[#7A6A5C]">스톡 추천 사진:</span>
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          sampleImage('데이터 차트', 210),
                          sampleImage('오피스', 32),
                          sampleImage('팀 회의', 150),
                          sampleImage('아이디어', 275)
                        ].map((url, i) => (
                          <img
                            key={i}
                            src={url}
                            alt=""
                            onClick={() => {
                              updateCurrentSlide({ imageUrl: url, layout: 'showcase' });
                              showToast('✓ 슬라이드에 사진이 삽입되었습니다.');
                            }}
                            className="w-full h-16 object-cover rounded-lg border border-[#EBE5DA] hover:border-[#F4B400] cursor-pointer"
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </aside>

            {/* Filmstrip Thumbnails */}
            <div className="w-44 bg-white border-r border-[#EBE5DA] p-3 flex flex-col gap-2 overflow-y-auto shrink-0 select-none">
              <div className="text-[11px] font-bold text-[#7A6A5C] uppercase tracking-wider px-1">
                슬라이드 ({slides.length})
              </div>
              {slides.map((s, idx) => {
                const theme = SLIDE_THEMES.find((t) => t.id === s.bgTheme) || SLIDE_THEMES[0];
                return (
                  <div
                    key={s.id}
                    onClick={() => setCurrentSlideIndex(idx)}
                    className={`flex items-center gap-1.5 p-1.5 rounded-xl border-2 transition-all cursor-pointer ${
                      idx === currentSlideIndex
                        ? 'border-[#F4B400] bg-[#FFFBEB] shadow-sm'
                        : 'border-[#EBE5DA] hover:border-[#DCD3C5] bg-[#FDFBF7]'
                    }`}
                  >
                    <span className="text-[10px] font-mono font-bold text-[#7A6A5C] w-3 text-center">
                      {idx + 1}
                    </span>
                    <div
                      className={`flex-1 aspect-[16/9] rounded-lg p-1.5 bg-gradient-to-br ${theme.bg} ${theme.text} flex flex-col justify-center overflow-hidden shadow-2xs`}
                    >
                      <div className="text-[8px] font-bold truncate leading-tight">
                        {s.title || '제목 없음'}
                      </div>
                      <div className="text-[6px] opacity-70 truncate">{s.subtitle}</div>
                    </div>
                  </div>
                );
              })}
              <button
                onClick={() => addNewSlide('bullet')}
                className="w-full flex items-center justify-center gap-1 p-2 rounded-xl border-2 border-dashed border-[#DCD3C5] hover:border-[#F4B400] text-xs font-bold text-[#7A6A5C] hover:text-[#F4B400] transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>슬라이드 추가</span>
              </button>
            </div>

            {/* Slide Stage Canvas */}
            <div className="flex-1 overflow-auto p-6 sm:p-10 flex flex-col items-center justify-center">
              {(() => {
                const theme =
                  SLIDE_THEMES.find((t) => t.id === currentSlide.bgTheme) || SLIDE_THEMES[0];
                return (
                  <div
                    className={`w-full max-w-4xl aspect-[16/9] rounded-2xl p-8 sm:p-12 shadow-2xl bg-gradient-to-br ${theme.bg} ${theme.text} flex flex-col justify-between transition-all duration-200 relative`}
                  >
                    {/* Header: Title & Subtitle Inputs */}
                    <div>
                      <input
                        type="text"
                        value={currentSlide.title}
                        onChange={(e) => updateCurrentSlide({ title: e.target.value })}
                        placeholder="슬라이드 제목을 입력하세요..."
                        className="w-full text-2xl sm:text-4xl font-black bg-transparent border-b border-current/20 pb-2 focus:outline-none focus:border-current leading-tight"
                      />
                      <input
                        type="text"
                        value={currentSlide.subtitle}
                        onChange={(e) => updateCurrentSlide({ subtitle: e.target.value })}
                        placeholder="부제목 및 보충 설명을 입력하세요..."
                        className="w-full text-sm sm:text-lg opacity-80 bg-transparent border-none mt-2 focus:outline-none font-medium"
                      />
                    </div>

                    {/* Layout Body */}
                    {currentSlide.layout === 'bullet' && (
                      <div className="space-y-2 my-auto">
                        {currentSlide.bullets.map((b, bIdx) => (
                          <div key={bIdx} className="flex items-center gap-2">
                            <span style={{ color: theme.accent }} className="text-xl font-bold">
                              •
                            </span>
                            <input
                              type="text"
                              value={b}
                              onChange={(e) => {
                                const nextB = [...currentSlide.bullets];
                                nextB[bIdx] = e.target.value;
                                updateCurrentSlide({ bullets: nextB });
                              }}
                              className="flex-1 bg-transparent border-b border-transparent focus:border-current/30 text-xs sm:text-base opacity-90 focus:outline-none py-1"
                            />
                            <button
                              onClick={() => {
                                const nextB = currentSlide.bullets.filter((_, idx) => idx !== bIdx);
                                updateCurrentSlide({ bullets: nextB });
                              }}
                              className="opacity-40 hover:opacity-100 p-1 text-xs"
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                        <button
                          onClick={() => {
                            updateCurrentSlide({
                              bullets: [...currentSlide.bullets, '새 핵심 포인트'],
                            });
                          }}
                          className="flex items-center gap-1 text-xs font-bold opacity-60 hover:opacity-100 mt-2 cursor-pointer"
                        >
                          <Plus className="w-3 h-3" />
                          <span>글머리 기호 추가</span>
                        </button>
                      </div>
                    )}

                    {currentSlide.layout === 'two-column' && (
                      <div className="grid grid-cols-2 gap-4 my-auto">
                        <div className="p-4 rounded-xl bg-black/5 border border-current/10">
                          <textarea
                            value={currentSlide.col1Text || ''}
                            onChange={(e) => updateCurrentSlide({ col1Text: e.target.value })}
                            placeholder="왼쪽 비교 내용..."
                            className="w-full h-32 bg-transparent border-none focus:outline-none resize-none text-xs sm:text-sm font-medium"
                          />
                        </div>
                        <div className="p-4 rounded-xl bg-black/5 border border-current/10">
                          <textarea
                            value={currentSlide.col2Text || ''}
                            onChange={(e) => updateCurrentSlide({ col2Text: e.target.value })}
                            placeholder="오른쪽 비교 내용..."
                            className="w-full h-32 bg-transparent border-none focus:outline-none resize-none text-xs sm:text-sm font-medium"
                          />
                        </div>
                      </div>
                    )}

                    {currentSlide.layout === 'metric' && (
                      <div className="my-auto text-center p-6 bg-black/5 rounded-2xl border border-current/10">
                        <input
                          type="text"
                          value={currentSlide.metricNumber || '99%'}
                          onChange={(e) => updateCurrentSlide({ metricNumber: e.target.value })}
                          style={{ color: theme.accent }}
                          className="w-full text-5xl sm:text-7xl font-black font-mono text-center bg-transparent border-none focus:outline-none"
                        />
                        <input
                          type="text"
                          value={currentSlide.metricLabel || '핵심 성과 지표'}
                          onChange={(e) => updateCurrentSlide({ metricLabel: e.target.value })}
                          className="w-full text-base sm:text-xl font-bold text-center bg-transparent border-none focus:outline-none mt-2 opacity-90"
                        />
                      </div>
                    )}

                    {currentSlide.layout === 'showcase' && (
                      <div className="my-auto grid grid-cols-2 gap-6 items-center">
                        {currentSlide.imageUrl ? (
                          <img
                            src={currentSlide.imageUrl}
                            alt=""
                            className="w-full aspect-[4/3] object-cover rounded-xl shadow-lg border border-current/20"
                          />
                        ) : (
                          <div
                            onClick={() => slideImageInputRef.current?.click()}
                            className="w-full aspect-[4/3] rounded-xl border-2 border-dashed border-current/30 flex flex-col items-center justify-center cursor-pointer hover:bg-black/5"
                          >
                            <ImageIcon className="w-8 h-8 opacity-60" />
                            <span className="text-xs font-bold mt-2 opacity-80">클릭하여 이미지 업로드</span>
                          </div>
                        )}
                        <div className="space-y-2">
                          {currentSlide.bullets.map((b, idx) => (
                            <div key={idx} className="flex items-center gap-2 text-sm font-medium">
                              <span style={{ color: theme.accent }} className="font-bold">•</span>
                              <input
                                type="text"
                                value={b}
                                onChange={(e) => {
                                  const nextB = [...currentSlide.bullets];
                                  nextB[idx] = e.target.value;
                                  updateCurrentSlide({ bullets: nextB });
                                }}
                                className="bg-transparent border-b border-transparent focus:border-current/30 focus:outline-none flex-1 text-xs sm:text-sm"
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {currentSlide.layout === 'quote' && (
                      <div className="my-auto p-6 border-l-4 border-current/40 italic">
                        <p className="text-xl sm:text-2xl font-serif">"{currentSlide.title}"</p>
                        <input
                          type="text"
                          value={currentSlide.quoteAuthor || ''}
                          onChange={(e) => updateCurrentSlide({ quoteAuthor: e.target.value })}
                          placeholder="인용 저자 이름 입력..."
                          className="w-full text-right bg-transparent border-none focus:outline-none mt-4 font-bold text-xs sm:text-sm opacity-80"
                        />
                      </div>
                    )}

                    {/* Slide Footer */}
                    <div className="flex items-center justify-between text-xs opacity-60 border-t border-current/20 pt-3">
                      <span>Google Slides (Canva Studio)</span>
                      <span>
                        슬라이드 {currentSlideIndex + 1} / {slides.length}
                      </span>
                    </div>
                  </div>
                );
              })()}

              {/* Speaker Notes Drawer */}
              {showNotesDrawer && (
                <div className="w-full max-w-4xl mt-3 p-3 bg-white rounded-xl border border-[#EBE5DA] shadow-xs animate-in slide-in-from-bottom-2">
                  <div className="text-[11px] font-bold text-[#7A6A5C] mb-1">
                    발표자 메모 (슬라이드 쇼 발표 시 참고할 스크립트):
                  </div>
                  <textarea
                    value={currentSlide.notes || ''}
                    onChange={(e) => updateCurrentSlide({ notes: e.target.value })}
                    placeholder="이 슬라이드에서 발표할 대본이나 중요 메모를 작성하세요..."
                    className="w-full h-16 bg-transparent border-none text-xs text-[#2C2520] focus:outline-none resize-none"
                  />
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ======================================================== */}
      {/* 4. BOTTOM STATS BAR FOR DOCS */}
      {/* ======================================================== */}
      {fileType === 'doc' && (
        <footer className="h-8 bg-[#FAF7F2] border-t border-[#EBE5DA] px-4 flex items-center justify-between text-[11px] text-[#7A6A5C] shrink-0 font-mono select-none">
          <div className="flex items-center gap-3">
            <span>공백 포함 {stats.charCount}자</span>
            <span>•</span>
            <span>공백 제외 {stats.charNoSpaces}자</span>
            <span>•</span>
            <span>{stats.words} 단어</span>
            <span>•</span>
            <span>예상 소요 시간: {stats.readingTime}분</span>
          </div>
          <div>Google Docs 클라우드 실시간 동기화 활성화됨</div>
        </footer>
      )}

      {/* ======================================================== */}
      {/* 5. GEMINI AI ASSISTANT SLEEK RIGHT DRAWER (Smooth slide) */}
      {/* ======================================================== */}
      {showAiDrawer && (
        <div
          onClick={() => setShowAiDrawer(false)}
          className="fixed inset-0 bg-black/20 backdrop-blur-2xs z-40 transition-opacity"
        />
      )}
      <aside
        className={`fixed top-0 right-0 bottom-0 w-84 sm:w-96 bg-white border-l border-[#EBE5DA] shadow-2xl z-50 flex flex-col transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
          showAiDrawer ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Drawer Header */}
        <div className="h-14 border-b border-[#EBE5DA] px-4 flex items-center justify-between bg-[#FAF7F2]">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-xl bg-gradient-to-r from-[#4285F4] to-[#9C27B0] flex items-center justify-center text-white shadow-2xs">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-[#2C2520]">Gemini 2.5 오피스 비서</h3>
              <p className="text-[10px] text-[#7A6A5C]">빠른 속도 & 문서/시트/슬라이드 직접 반영</p>
            </div>
          </div>
          <button
            onClick={() => setShowAiDrawer(false)}
            className="p-1.5 hover:bg-[#F4EFE6] rounded-xl text-[#7A6A5C] hover:text-[#2C2520] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Drawer Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Quick Action Buttons */}
          <div className="space-y-2">
            <span className="text-[11px] font-bold text-[#5C5046] uppercase">빠른 AI 작업</span>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleRunAiAssist('expand')}
                disabled={isAiLoading}
                className="p-2.5 rounded-xl bg-[#FDFBF7] hover:bg-[#F4EFE6] border border-[#EBE5DA] text-left text-xs font-semibold text-[#3E2723] transition-colors disabled:opacity-50 cursor-pointer"
              >
                ✍️ 본문 내용 보완
              </button>
              <button
                type="button"
                onClick={() => handleRunAiAssist('polish')}
                disabled={isAiLoading}
                className="p-2.5 rounded-xl bg-[#FDFBF7] hover:bg-[#F4EFE6] border border-[#EBE5DA] text-left text-xs font-semibold text-[#3E2723] transition-colors disabled:opacity-50 cursor-pointer"
              >
                ✨ 비즈니스 어조 교정
              </button>
              <button
                type="button"
                onClick={() => handleRunAiAssist('summarize')}
                disabled={isAiLoading}
                className="p-2.5 rounded-xl bg-[#FDFBF7] hover:bg-[#F4EFE6] border border-[#EBE5DA] text-left text-xs font-semibold text-[#3E2723] transition-colors disabled:opacity-50 cursor-pointer"
              >
                📝 핵심 3줄 요약
              </button>
              <button
                type="button"
                onClick={() => handleRunAiAssist('outline')}
                disabled={isAiLoading}
                className="p-2.5 rounded-xl bg-[#FDFBF7] hover:bg-[#F4EFE6] border border-[#EBE5DA] text-left text-xs font-semibold text-[#3E2723] transition-colors disabled:opacity-50 cursor-pointer"
              >
                📋 세부 실행 계획
              </button>
            </div>
          </div>

          {/* Custom Instruction Box */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-[#5C5046] block">
              지시사항 직접 입력 (Gemini 2.5 Flash):
            </label>
            <textarea
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              placeholder="예: 2026년 마케팅 전략 로드맵 3단계를 작성하고 예상 KPI를 제시해줘"
              className="w-full bg-[#FDFBF7] border border-[#EBE5DA] rounded-xl p-3 text-xs text-[#2C2520] focus:outline-none focus:border-[#4285F4] h-24 resize-none leading-relaxed"
            />
            <button
              type="button"
              onClick={() => handleRunAiAssist('custom')}
              disabled={isAiLoading}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-[#1A73E8] to-[#9333EA] hover:opacity-95 text-white text-xs font-bold shadow-xs transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              {isAiLoading ? (
                /* Sleek minimal typing dot indicator requested by user */
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-white animate-bounce" />
                  <span className="w-2 h-2 rounded-full bg-white animate-bounce [animation-delay:0.15s]" />
                  <span className="w-2 h-2 rounded-full bg-white animate-bounce [animation-delay:0.3s]" />
                  <span className="ml-1 text-xs font-medium">Gemini 작성 중...</span>
                </div>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Gemini 2.5 실행하기</span>
                </>
              )}
            </button>
          </div>

          {/* AI Result Card with Instant Insert */}
          {aiLastResult && (
            <div className="p-3.5 bg-[#FAF7F2] border border-[#EBE5DA] rounded-2xl space-y-2.5 animate-in fade-in duration-200">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#1A73E8] flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>생성 결과 미리보기</span>
                </span>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(aiLastResult);
                    showToast('클립보드에 복사되었습니다.');
                  }}
                  className="p-1 hover:bg-white rounded-lg text-[#7A6A5C]"
                  title="결과 복사"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="text-xs text-[#2C2520] leading-relaxed max-h-56 overflow-y-auto whitespace-pre-wrap bg-white p-2.5 rounded-xl border border-[#EBE5DA]">
                {aiLastResult}
              </div>
              <button
                onClick={handleApplyAiResultToEditor}
                className="w-full py-2 rounded-xl bg-[#3E2723] hover:bg-[#2C2520] text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
              >
                문서 / 시트 / 슬라이드에 바로 삽입
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* ======================================================== */}
      {/* 6. INSTANT CHART VISUALIZER MODAL FOR SHEETS */}
      {/* ======================================================== */}
      {showChartModal && fileType === 'sheet' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs select-none animate-in fade-in">
          <div className="w-full max-w-xl rounded-2xl bg-white border border-[#EBE5DA] p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#EBE5DA]">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-[#0F9D58]" />
                <h3 className="text-sm font-bold text-[#2C2520]">스프레드시트 데이터 차트 시각화</h3>
              </div>
              <button
                onClick={() => setShowChartModal(false)}
                className="p-1 text-[#7A6A5C] hover:bg-[#F4EFE6] rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-[#5C5046]">차트 유형:</span>
              <button
                onClick={() => setChartType('bar')}
                className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer ${
                  chartType === 'bar' ? 'bg-[#0F9D58] text-white' : 'bg-[#F4EFE6] text-[#5C5046]'
                }`}
              >
                막대 차트 (Bar)
              </button>
              <button
                onClick={() => setChartType('pie')}
                className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer ${
                  chartType === 'pie' ? 'bg-[#0F9D58] text-white' : 'bg-[#F4EFE6] text-[#5C5046]'
                }`}
              >
                원형 차트 (Pie)
              </button>
            </div>

            {/* Visual Bar Chart rendered from Sheet rows */}
            <div className="p-4 bg-[#FDFBF7] rounded-xl border border-[#EBE5DA] min-h-[220px] flex flex-col justify-end gap-2">
              <div className="text-xs font-bold text-[#3E2723] mb-2">
                📊 {currentSheet.name} 데이터 분포 ({currentSheet.data.length - 1}개 행)
              </div>
              <div className="flex items-end gap-3 h-44 border-b border-[#DCD3C5] pb-1 px-2 overflow-x-auto">
                {currentSheet.data.slice(1, 9).map((row, idx) => {
                  const label = row[1] || row[0] || `항목 ${idx + 1}`;
                  const rawVal = row[2] || row[4] || `${(idx + 1) * 25}`;
                  const parsed = parseFloat(rawVal.replace(/,/g, ''));
                  const safeVal = isNaN(parsed) ? 30 : Math.min(100, Math.max(15, (parsed % 100) + 15));
                  return (
                    <div key={idx} className="flex-1 flex flex-col items-center gap-1 min-w-10">
                      <span className="text-[10px] font-mono text-[#7A6A5C]">{safeVal}</span>
                      <div
                        style={{ height: `${safeVal}%` }}
                        className="w-full bg-[#0F9D58] rounded-t-md hover:bg-[#0B7A44] transition-all"
                      />
                      <span className="text-[9px] font-bold text-[#5C5046] truncate w-full text-center">
                        {label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center justify-end">
              <button
                onClick={() => setShowChartModal(false)}
                className="px-4 py-1.5 rounded-xl bg-[#0F9D58] hover:bg-[#0B7A44] text-white text-xs font-bold shadow-xs cursor-pointer"
              >
                확인 완료
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================================
// DISPATCHER: 시트/슬라이드는 전용 고도화 에디터로 위임하고,
// 문서(Docs)는 기존 동작을 그대로 유지한다.
// ============================================================
export const GoogleWorkspaceEditor: React.FC<GoogleWorkspaceEditorProps> = (props) => {
  if (props.fileType === 'sheet') {
    return <SheetEditor {...props} />;
  }
  if (props.fileType === 'slide') {
    return <SlideEditor {...props} />;
  }
  return <DocsEditor {...props} />;
};
