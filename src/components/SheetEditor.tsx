import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { HyperFormula, DetailedCellError } from 'hyperformula';
import {
  Bold,
  Italic,
  Underline,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Palette,
  PaintBucket,
  Sigma,
  Undo,
  Redo,
  Download,
  Save,
  X,
  Plus,
  Trash2,
  Check,
  RefreshCw,
  Table,
  BarChart3,
  PieChart,
  ArrowUp,
  ArrowDown,
  ChevronDown,
  Copy,
  Scissors,
  ClipboardPaste,
  FileSpreadsheet,
  AlertCircle,
  Calculator,
  Grid3x3,
  ListPlus,
  Play,
} from 'lucide-react';
import { fetchRealDocContent, saveRealDocContent } from '../services/googleWorkspace';

// ============================================================
// TYPES
// ============================================================
export interface CellFormat {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  color?: string;
  bg?: string;
  align?: 'left' | 'center' | 'right';
  numFmt?: 'general' | 'number' | 'currency' | 'percent' | 'date';
  size?: number;
}

export interface SheetTab {
  id: string;
  name: string;
  data: string[][];
  formats?: Record<string, CellFormat>;
  colWidths?: number[];
}

interface SheetEditorProps {
  fileId: string;
  fileName: string;
  fileType: string;
  currentUser?: unknown;
  initialContent?: string;
  onSave: (fileId: string, content: string, title?: string) => void;
  onClose?: () => void;
  onShareToChat?: (content: string) => void;
}

interface Selection {
  r1: number;
  c1: number;
  r2: number;
  c2: number;
}

interface EditState {
  r: number;
  c: number;
  text: string;
  caret: number;
}

// ============================================================
// GRID GEOMETRY
// ============================================================
const CELL_H = 26;
const HEADER_H = 26;
const ROW_HDR_W = 46;
const DEFAULT_COL_W = 108;
const DEFAULT_ROWS = 28;
const DEFAULT_COLS = 10;

const colLabel = (idx: number): string => {
  let n = idx;
  let label = '';
  do {
    label = String.fromCharCode(65 + (n % 26)) + label;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return label;
};

const colIndex = (label: string): number => {
  let n = 0;
  for (let i = 0; i < label.length; i++) {
    n = n * 26 + (label.charCodeAt(i) - 64);
  }
  return n - 1;
};

const cellKey = (r: number, c: number) => `${r}_${c}`;

const emptySheet = (rows = DEFAULT_ROWS, cols = DEFAULT_COLS): string[][] =>
  Array.from({ length: rows }, () => Array.from({ length: cols }, () => ''));

const isFormulaText = (raw: string) => raw.startsWith('=') || raw.startsWith('+');

// 숫자로 해석되는 문자열은 엔진에 숫자로 넣어 SUM/AVERAGE 가 정확히 동작하게 한다
const toEngineValue = (raw: string): string | number | null => {
  if (raw === undefined || raw === null) return null;
  const text = String(raw);
  if (text.trim() === '') return null;
  if (isFormulaText(text)) return text;
  const compact = text.replace(/,/g, '').trim();
  if (/^-?\d+(\.\d+)?%$/.test(compact)) {
    return parseFloat(compact.replace('%', '')) / 100;
  }
  if (/^-?\d+(\.\d+)?$/.test(compact)) {
    return parseFloat(compact);
  }
  return text;
};

// ============================================================
// FORMULA NORMALIZER (엑셀 표기 → HyperFormula 표기)
// 문자열 리터럴("...") 안쪽은 건드리지 않는다
// ============================================================
const mapFormulaText = (formula: string, fn: (segment: string, inString: boolean) => string): string => {
  let out = '';
  let buf = '';
  let inString = false;
  for (let i = 0; i < formula.length; i++) {
    const ch = formula[i];
    if (ch === '"') {
      if (inString && formula[i + 1] === '"') {
        buf += '""';
        i++;
        continue;
      }
      out += fn(buf, inString);
      buf = ch;
      inString = !inString;
      continue;
    }
    buf += ch;
  }
  out += fn(buf, inString);
  return out;
};

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const normalizeFormula = (raw: string, sheetNames: string[]): string => {
  let formula = raw;

  // CONCAT 은 HyperFormula 에서 CONCATENATE 로 매핑
  formula = mapFormulaText(formula, (seg, inString) =>
    inString ? seg : seg.replace(/\bCONCAT\s*\(/gi, 'CONCATENATE(')
  );

  // TRUE / FALSE 리터럴은 함수 형태(TRUE())로
  formula = mapFormulaText(formula, (seg, inString) =>
    inString
      ? seg
      : seg.replace(/\b(TRUE|FALSE)\b/gi, (match, _p, offset, whole) => {
          const prev = whole[offset - 1] || '';
          const next = whole[offset + match.length] || '';
          if (next === '(') return match;
          if (/[A-Za-z0-9_.$]/.test(prev)) return match;
          return `${match.toUpperCase()}()`;
        })
  );

  // 시트 이름이 한글/공백/숫자 시작이면 '시트명'! 형태로 감싼다
  const names = [...sheetNames].sort((a, b) => b.length - a.length);
  names.forEach((name) => {
    if (!name) return;
    const needsQuote = !/^[A-Za-z_][A-Za-z0-9_.]*$/.test(name);
    if (!needsQuote) return;
    formula = mapFormulaText(formula, (seg, inString) => {
      if (inString) return seg;
      const pattern = new RegExp(`(^|[^'A-Za-z0-9_.])(${escapeRegex(name)})!`, 'g');
      return seg.replace(pattern, (_m, prefix) => `${prefix}'${name}'!`);
    });
  });

  return formula;
};

// 상대 참조 이동 (채우기 / 붙여넣기)
const shiftReferences = (formula: string, dRow: number, dCol: number): string => {
  if (!isFormulaText(formula) || (dRow === 0 && dCol === 0)) return formula;
  return mapFormulaText(formula, (seg, inString) => {
    if (inString) return seg;
    return seg.replace(
      /(\$?)([A-Za-z]{1,3})(\$?)(\d{1,6})/g,
      (match, absCol, letters, absRow, digits, offset) => {
        const prev = seg[offset - 1] || '';
        const next = seg[offset + match.length] || '';
        // 함수명(LOG10)이나 긴 토큰의 일부는 제외
        if (/[A-Za-z0-9_.$]/.test(prev)) return match;
        if (/[A-Za-z0-9_(]/.test(next)) return match;
        const c = colIndex(letters.toUpperCase()) + (absCol ? 0 : dCol);
        const r = parseInt(digits, 10) + (absRow ? 0 : dRow);
        if (c < 0 || r < 1) return '#REF!';
        return `${absCol}${colLabel(c)}${absRow}${r}`;
      }
    );
  });
};

const serialToDateText = (serial: number, withTime: boolean): string => {
  const ms = Math.round((serial - 25569) * 86400 * 1000);
  const d = new Date(ms);
  if (isNaN(d.getTime())) return String(serial);
  const pad = (n: number) => String(n).padStart(2, '0');
  const date = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  if (!withTime) return date;
  return `${date} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
};

const formatNumber = (value: number, fmt?: CellFormat['numFmt']): string => {
  switch (fmt) {
    case 'number':
      return value.toLocaleString('ko-KR', { maximumFractionDigits: 2 });
    case 'currency':
      return `₩${Math.round(value).toLocaleString('ko-KR')}`;
    case 'percent':
      return `${(value * 100).toLocaleString('ko-KR', { maximumFractionDigits: 1 })}%`;
    default:
      if (!isFinite(value)) return String(value);
      return Number.isInteger(value) ? String(value) : String(Math.round(value * 1e10) / 1e10);
  }
};

const parseSheetContent = (
  content?: string
): { tabs: SheetTab[]; activeTabId?: string } => {
  if (content) {
    try {
      const parsed = JSON.parse(content);
      if (parsed && Array.isArray(parsed.tabs) && parsed.tabs.length > 0) {
        const tabs: SheetTab[] = parsed.tabs.map((tab: SheetTab, idx: number) => ({
          id: tab.id || `sheet_${idx + 1}`,
          name: tab.name || `시트 ${idx + 1}`,
          data: Array.isArray(tab.data) && tab.data.length > 0 ? tab.data : emptySheet(),
          formats: tab.formats || {},
          colWidths: tab.colWidths || [],
        }));
        return { tabs, activeTabId: parsed.activeTabId };
      }
      if (Array.isArray(parsed) && parsed.length > 0 && parsed[0]?.data) {
        const tabs: SheetTab[] = parsed.map((tab: SheetTab, idx: number) => ({
          id: tab.id || `sheet_${idx + 1}`,
          name: tab.name || `시트 ${idx + 1}`,
          data: Array.isArray(tab.data) && tab.data.length > 0 ? tab.data : emptySheet(),
          formats: tab.formats || {},
          colWidths: tab.colWidths || [],
        }));
        return { tabs };
      }
    } catch {
      const rows = content.split('\n').map((r) => r.split(','));
      if (rows.length > 0 && rows[0].length > 0) {
        return { tabs: [{ id: 'sheet_1', name: '시트 1', data: rows, formats: {}, colWidths: [] }] };
      }
    }
  }

  // 새 스프레드시트는 예시 데이터 없이 빈 그리드로 시작합니다.
  return {
    tabs: [
      {
        id: 'sheet_1',
        name: '시트 1',
        data: emptySheet(),
        formats: {},
        colWidths: [],
      },
    ],
  };
};

// ============================================================
// COMPONENT
// ============================================================
export const SheetEditor: React.FC<SheetEditorProps> = ({
  fileId,
  fileName,
  initialContent,
  onSave,
  onClose,
  onShareToChat,
}) => {
  const parsedInit = useMemo(() => parseSheetContent(initialContent), [initialContent]);

  const [title, setTitle] = useState(fileName || '제목 없는 스프레드시트');
  const [tabs, setTabs] = useState<SheetTab[]>(parsedInit.tabs);
  const [activeTabId, setActiveTabId] = useState<string>(parsedInit.activeTabId || parsedInit.tabs[0].id);
  const [sel, setSel] = useState<Selection>({ r1: 0, c1: 0, r2: 0, c2: 0 });
  const [edit, setEdit] = useState<EditState | null>(null);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'dirty'>('saved');
  const [lastSavedTime, setLastSavedTime] = useState('방금 전');
  const [toast, setToast] = useState<string | null>(null);
  const [colorMenu, setColorMenu] = useState<'text' | 'fill' | null>(null);
  const [fnMenu, setFnMenu] = useState<boolean>(false);
  const [showChart, setShowChart] = useState(false);
  const [chartType, setChartType] = useState<'bar' | 'pie'>('bar');
  const [fillPreview, setFillPreview] = useState<Selection | null>(null);
  const [renamingTab, setRenamingTab] = useState<string | null>(null);
  const [zoom, setZoom] = useState(100);

  const gridRef = useRef<HTMLDivElement>(null);
  const editorInputRef = useRef<HTMLInputElement>(null);
  const formulaBarRef = useRef<HTMLInputElement>(null);
  const formulaCaretRef = useRef<number>(0);
  const formulaBarFocusedRef = useRef<boolean>(false);
  const formulaBarDirtyRef = useRef<boolean>(false);
  const clipboardRef = useRef<{ data: string[][]; cut: boolean } | null>(null);
  const lastPushRef = useRef<{ key: string; at: number }>({ key: '', at: 0 });

  const tab = tabs.find((t) => t.id === activeTabId) || tabs[0];

  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2400);
  };

  // ============================================================
  // HYPERFORMULA ENGINE
  // ============================================================
  const engineRef = useRef<{
    hf: HyperFormula;
    byTab: Record<string, number>;
    sig: string;
    snapshot: Record<string, string[][]>;
  } | null>(null);

  const uniqueNames = useMemo(() => {
    const used = new Set<string>();
    return tabs.map((t, i) => {
      let name = (t.name || `시트 ${i + 1}`).trim() || `Sheet${i + 1}`;
      let candidate = name;
      let n = 2;
      while (used.has(candidate.toLowerCase())) {
        candidate = `${name} ${n}`;
        n++;
      }
      used.add(candidate.toLowerCase());
      return candidate;
    });
  }, [tabs]);

  const ensureEngine = (): HyperFormula => {
    const sig = tabs
      .map((t, i) => `${t.id}|${uniqueNames[i]}|${t.data.length}|${t.data[0]?.length || 0}`)
      .join(';');
    const sheetNames = uniqueNames;

    if (!engineRef.current || engineRef.current.sig !== sig) {
      const hf = HyperFormula.buildEmpty({ licenseKey: 'gpl-v3' });
      const byTab: Record<string, number> = {};
      tabs.forEach((t, i) => {
        hf.addSheet(sheetNames[i]);
        const sheetId = hf.getSheetId(sheetNames[i]);
        if (sheetId === undefined) return;
        byTab[t.id] = sheetId;
        const content = t.data.map((row) =>
          row.map((raw) => {
            const value = toEngineValue(raw);
            return typeof value === 'string' && isFormulaText(value)
              ? normalizeFormula(value, sheetNames)
              : value;
          })
        );
        hf.setSheetContent(sheetId, content);
      });
      const snapshot: Record<string, string[][]> = {};
      tabs.forEach((t) => {
        snapshot[t.id] = t.data.map((row) => row.slice());
      });
      engineRef.current = { hf, byTab, sig, snapshot };
      return hf;
    }

    const state = engineRef.current;
    tabs.forEach((t) => {
      const sheetId = state.byTab[t.id];
      if (sheetId === undefined) return;
      const before = state.snapshot[t.id] || [];
      const rowCount = Math.max(before.length, t.data.length);
      const colCount = Math.max(before[0]?.length || 0, t.data[0]?.length || 0);
      for (let r = 0; r < rowCount; r++) {
        for (let c = 0; c < colCount; c++) {
          const prev = before[r]?.[c] ?? '';
          const next = t.data[r]?.[c] ?? '';
          if (prev === next) continue;
          const value = toEngineValue(next);
          const content =
            typeof value === 'string' && isFormulaText(value)
              ? normalizeFormula(value, sheetNames)
              : value;
          state.hf.setCellContents({ sheet: sheetId, row: r, col: c }, [[content]]);
        }
      }
      state.snapshot[t.id] = t.data.map((row) => row.slice());
    });
    return state.hf;
  };

  const hf = ensureEngine();

  const engineValue = useCallback(
    (tabId: string, r: number, c: number) => {
      const sheetId = engineRef.current?.byTab[tabId];
      if (sheetId === undefined) return null;
      return hf.getCellValue({ sheet: sheetId, row: r, col: c });
    },
    [hf]
  );

  const rawAt = (r: number, c: number) => tab.data[r]?.[c] ?? '';

  const displayCell = (
    r: number,
    c: number
  ): { text: string; isNumber: boolean; isError: boolean } => {
    const raw = rawAt(r, c);
    if (raw === '') return { text: '', isNumber: false, isError: false };
    const fmt = tab.formats?.[cellKey(r, c)];
    if (!isFormulaText(raw)) {
      const compact = raw.replace(/,/g, '').trim();
      const isNumber = /^-?\d+(\.\d+)?%?$/.test(compact);
      if (isNumber && fmt?.numFmt && fmt.numFmt !== 'general') {
        if (/%$/.test(compact) && fmt.numFmt !== 'percent') {
          return { text: raw, isNumber: true, isError: false };
        }
        return { text: formatNumber(parseFloat(compact.replace('%', '')), fmt.numFmt), isNumber: true, isError: false };
      }
      return { text: raw, isNumber, isError: /^#(DIV\/0!|VALUE!|NAME\?|REF!|N\/A|NUM!|ERROR!)/.test(raw) };
    }
    const value = engineValue(tab.id, r, c);
    if (value instanceof DetailedCellError) {
      return { text: value.value || '#ERROR!', isNumber: false, isError: true };
    }
    if (value === null || value === undefined || value === '') {
      return { text: '', isNumber: false, isError: false };
    }
    if (typeof value === 'number') {
      const isDateFormula = /TODAY\s*\(|NOW\s*\(|DATE\s*\(|DATEVALUE\s*\(/i.test(raw);
      if (isDateFormula || fmt?.numFmt === 'date') {
        return {
          text: serialToDateText(value, /NOW\s*\(/i.test(raw) || (fmt?.numFmt === 'date' && !Number.isInteger(value))),
          isNumber: false,
          isError: false,
        };
      }
      return { text: formatNumber(value, fmt?.numFmt), isNumber: true, isError: false };
    }
    if (typeof value === 'boolean') return { text: value ? 'TRUE' : 'FALSE', isNumber: false, isError: false };
    return { text: String(value), isNumber: false, isError: false };
  };

  // ============================================================
  // HISTORY (undo / redo)
  // ============================================================
  interface Snapshot {
    tabs: SheetTab[];
    active: string;
  }
  const undoRef = useRef<Snapshot[]>([]);
  const redoRef = useRef<Snapshot[]>([]);

  const snapshot = (): Snapshot => ({
    tabs: tabs.map((t) => ({
      ...t,
      data: t.data.map((row) => row.slice()),
      formats: { ...(t.formats || {}) },
      colWidths: [...(t.colWidths || [])],
    })),
    active: activeTabId,
  });

  const applySnapshot = (entry: Snapshot) => {
    setTabs(entry.tabs.map((t) => ({ ...t, data: t.data.map((row) => row.slice()) })));
    setActiveTabId(entry.active);
    setEdit(null);
    setSaveStatus('dirty');
  };

  const pushHistory = (coalesceKey?: string) => {
    const now = Date.now();
    const canCoalesce =
      !!coalesceKey &&
      lastPushRef.current.key === coalesceKey &&
      now - lastPushRef.current.at < 1000;
    lastPushRef.current = { key: coalesceKey || '', at: now };
    if (canCoalesce) return;
    undoRef.current.push(snapshot());
    if (undoRef.current.length > 60) undoRef.current.shift();
    redoRef.current = [];
  };

  const handleUndo = () => {
    const prev = undoRef.current.pop();
    if (!prev) return;
    redoRef.current.push(snapshot());
    applySnapshot(prev);
  };

  const handleRedo = () => {
    const next = redoRef.current.pop();
    if (!next) return;
    undoRef.current.push(snapshot());
    applySnapshot(next);
  };

  // ============================================================
  // MUTATIONS
  // ============================================================
  const setDirty = () => setSaveStatus('dirty');

  const updateData = (updater: (data: string[][]) => string[][], tabId = activeTabId) => {
    setTabs((prev) =>
      prev.map((t) => (t.id === tabId ? { ...t, data: updater(t.data) } : t))
    );
    setDirty();
  };

  const setCellRaw = (r: number, c: number, value: string) => {
    updateData((data) => {
      const next = data.map((row) => row.slice());
      while (next.length <= r) next.push(Array(next[0]?.length || DEFAULT_COLS).fill(''));
      while ((next[r]?.length || 0) <= c) next[r].push('');
      next[r][c] = value;
      return next;
    });
  };

  const commitEdit = (move?: 'down' | 'right' | 'up' | 'left') => {
    if (!edit) return;
    pushHistory();
    const { r, c, text } = edit;
    setCellRaw(r, c, text);
    setEdit(null);
    if (move === 'down') setSel({ r1: r + 1, c1: c, r2: r + 1, c2: c });
    if (move === 'up') setSel({ r1: Math.max(0, r - 1), c1: c, r2: Math.max(0, r - 1), c2: c });
    if (move === 'right') setSel({ r1: r, c1: c + 1, r2: r, c2: c + 1 });
    if (move === 'left') setSel({ r1: r, c1: Math.max(0, c - 1), r2: r, c2: Math.max(0, c - 1) });
    requestAnimationFrame(() => gridRef.current?.focus());
  };

  const startEdit = (r: number, c: number, initial?: string) => {
    const raw = rawAt(r, c);
    const text = initial !== undefined ? initial : raw;
    pushHistory(`${r}_${c}_edit`);
    setSel({ r1: r, c1: c, r2: r, c2: c });
    setEdit({ r, c, text, caret: text.length });
    window.setTimeout(() => {
      const input = editorInputRef.current;
      if (input) {
        input.focus();
        const pos = initial !== undefined ? text.length : text.length;
        input.setSelectionRange(pos, pos);
      }
    }, 0);
  };

  // ============================================================
  // SELECTION HELPERS
  // ============================================================
  const normSel = (s: Selection): Selection => ({
    r1: Math.min(s.r1, s.r2),
    c1: Math.min(s.c1, s.c2),
    r2: Math.max(s.r1, s.r2),
    c2: Math.max(s.c1, s.c2),
  });

  const inSel = (r: number, c: number) => {
    const n = normSel(sel);
    return r >= n.r1 && r <= n.r2 && c >= n.c1 && c <= n.c2;
  };

  const focusGrid = () => {
    window.setTimeout(() => gridRef.current?.focus(), 0);
  };

  const cellFromPoint = (x: number, y: number): { r: number; c: number } | null => {
    const el = document.elementFromPoint(x, y) as HTMLElement | null;
    const cellEl = el?.closest('[data-cell]') as HTMLElement | null;
    if (!cellEl) return null;
    const [r, c] = cellEl.dataset.cell!.split('_').map((v) => parseInt(v, 10));
    return { r, c };
  };

  // 셀 드래그 선택
  const startRangeDrag = (e: React.MouseEvent, r: number, c: number) => {
    const anchor = e.shiftKey ? { r: sel.r1, c: sel.c1 } : { r, c };
    setSel({ r1: anchor.r, c1: anchor.c, r2: r, c2: c });
    let dragging = true;
    const move = (ev: MouseEvent) => {
      if (!dragging) return;
      const hit = cellFromPoint(ev.clientX, ev.clientY);
      if (!hit) return;
      setSel({ r1: anchor.r, c1: anchor.c, r2: hit.r, c2: hit.c });
    };
    const up = () => {
      dragging = false;
      document.removeEventListener('mousemove', move);
      document.removeEventListener('mouseup', up);
    };
    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', up);
  };

  // ============================================================
  // 수식 입력 중 셀 클릭 → 참조 삽입 (드래그하면 범위 A1:B4)
  // ============================================================
  const refText = (r1: number, c1: number, r2: number, c2: number) => {
    const a = { r: Math.min(r1, r2), c: Math.min(c1, c2) };
    const b = { r: Math.max(r1, r2), c: Math.max(c1, c2) };
    const first = `${colLabel(a.c)}${a.r + 1}`;
    if (a.r === b.r && a.c === b.c) return first;
    return `${first}:${colLabel(b.c)}${b.r + 1}`;
  };

  const startReferencePick = (e: React.MouseEvent, r: number, c: number) => {
    if (!edit) return false;
    const baseText = edit.text;
    if (!isFormulaText(baseText)) return false;
    e.preventDefault();
    e.stopPropagation();

    const caret = Math.min(edit.caret ?? baseText.length, baseText.length);
    const tokenStart = caret;
    let currentLen = 0;
    const anchor = { r, c };

    const applyRef = (ref: string) => {
      const text = baseText.slice(0, tokenStart) + ref + baseText.slice(tokenStart + currentLen);
      currentLen = ref.length;
      const nextCaret = tokenStart + ref.length;
      setEdit((prev) => (prev ? { ...prev, text, caret: nextCaret } : prev));
      window.setTimeout(() => {
        const input = editorInputRef.current;
        if (input) {
          input.focus();
          input.setSelectionRange(nextCaret, nextCaret);
        }
      }, 0);
    };

    applyRef(refText(r, c, r, c));
    setSel({ r1: r, c1: c, r2: r, c2: c });

    const move = (ev: MouseEvent) => {
      const hit = cellFromPoint(ev.clientX, ev.clientY);
      if (!hit) return;
      applyRef(refText(anchor.r, anchor.c, hit.r, hit.c));
      setSel({ r1: anchor.r, c1: anchor.c, r2: hit.r, c2: hit.c });
    };
    const up = () => {
      document.removeEventListener('mousemove', move);
      document.removeEventListener('mouseup', up);
    };
    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', up);
    return true;
  };

  // 수식 표시줄에 입력 중일 때 셀 클릭 → 해당 셀/범위 참조 삽입
  const startFormulaBarPick = (e: React.MouseEvent, r: number, c: number): boolean => {
    if (edit || !formulaBarFocusedRef.current || !formulaBarDirtyRef.current) return false;
    const target = { r: sel.r1, c: sel.c1 };
    const baseText = rawAt(target.r, target.c);
    if (!isFormulaText(baseText)) return false;
    e.preventDefault();
    e.stopPropagation();

    pushHistory(`barpick_${target.r}_${target.c}`);
    const insertAt = Math.min(formulaCaretRef.current, baseText.length);
    let currentLen = 0;
    const anchorCell = { r, c };

    const applyRef = (ref: string) => {
      const value = baseText.slice(0, insertAt) + ref + baseText.slice(insertAt + currentLen);
      currentLen = ref.length;
      const caret = insertAt + ref.length;
      formulaCaretRef.current = caret;
      setCellRaw(target.r, target.c, value);
      window.setTimeout(() => {
        const input = formulaBarRef.current;
        if (input) {
          input.focus();
          input.setSelectionRange(caret, caret);
        }
      }, 0);
    };

    applyRef(refText(r, c, r, c));

    const move = (ev: MouseEvent) => {
      const hit = cellFromPoint(ev.clientX, ev.clientY);
      if (!hit) return;
      applyRef(refText(anchorCell.r, anchorCell.c, hit.r, hit.c));
    };
    const up = () => {
      document.removeEventListener('mousemove', move);
      document.removeEventListener('mouseup', up);
    };
    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', up);
    return true;
  };

  // ============================================================
  // 채우기 핸들
  // ============================================================
  const startFillHandle = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const source = normSel(sel);
    let target: Selection = { ...source };
    pushHistory();
    const move = (ev: MouseEvent) => {
      const hit = cellFromPoint(ev.clientX, ev.clientY);
      if (!hit) return;
      target = { ...source };
      if (hit.r < source.r1) target.r1 = hit.r;
      if (hit.r > source.r2) target.r2 = hit.r;
      if (hit.c < source.c1) target.c1 = hit.c;
      if (hit.c > source.c2) target.c2 = hit.c;
      setFillPreview(target);
    };
    const up = () => {
      document.removeEventListener('mousemove', move);
      document.removeEventListener('mouseup', up);
      setFillPreview(null);
      applyFill(source, target);
    };
    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', up);
  };

  const applyFill = (source: Selection, target: Selection) => {
    if (target.r1 === source.r1 && target.r2 === source.r2 && target.c1 === source.c1 && target.c2 === source.c2) {
      return;
    }
    const srcH = source.r2 - source.r1 + 1;
    const srcW = source.c2 - source.c1 + 1;
    updateData((data) => {
      const next = data.map((row) => row.slice());
      for (let r = target.r1; r <= target.r2; r++) {
        if (r >= source.r1 && r <= source.r2) continue;
        for (let c = target.c1; c <= target.c2; c++) {
          if (c >= source.c1 && c <= source.c2 && r >= source.r1 && r <= source.r2) continue;
          const offsetR = ((r - source.r1) % srcH + srcH) % srcH;
          const offsetC = ((c - source.c1) % srcW + srcW) % srcW;
          const srcR = source.r1 + offsetR;
          const srcC = source.c1 + offsetC;
          const raw = next[srcR]?.[srcC] ?? '';
          const filled = shiftReferences(raw, r - srcR, c - srcC);
          while (next.length <= r) next.push(Array(next[0]?.length || DEFAULT_COLS).fill(''));
          while ((next[r]?.length || 0) <= c) next[r].push('');
          next[r][c] = filled;
        }
      }
      return next;
    });
    showToast('✓ 선택 영역을 자동 채우기 했습니다.');
  };

  // ============================================================
  // 복사 / 붙여넣기
  // ============================================================
  const normalizeRange = () => normSel(sel);

  const copySelection = (cut = false) => {
    const n = normSel(sel);
    const data: string[][] = [];
    for (let r = n.r1; r <= n.r2; r++) {
      const row: string[] = [];
      for (let c = n.c1; c <= n.c2; c++) row.push(rawAt(r, c));
      data.push(row);
    }
    clipboardRef.current = { data, cut };
    try {
      navigator.clipboard?.writeText(data.map((row) => row.join('\t')).join('\n')).catch(() => {});
    } catch {
      /* 권한 없으면 내부 클립보드만 사용 */
    }
    showToast(cut ? `✂️ ${data.length}행을 잘라냈습니다.` : `✓ ${data.length}×${data[0]?.length || 0} 영역을 복사했습니다.`);
    if (cut) {
      pushHistory();
      updateData((current) =>
        current.map((row, rIdx) =>
          row.map((cell, cIdx) =>
            rIdx >= n.r1 && rIdx <= n.r2 && cIdx >= n.c1 && cIdx <= n.c2 ? '' : cell
          )
        )
      );
    }
  };

  const pasteClipboard = (external?: string) => {
    let grid: string[][] | null = clipboardRef.current?.data || null;
    if (external && external.trim() !== '') {
      grid = external.replace(/\r/g, '').split('\n').filter((line, idx, arr) => !(idx === arr.length - 1 && line === '')).map((line) => line.split('\t'));
    }
    if (!grid || grid.length === 0) return;
    const n = normSel(sel);
    pushHistory();
    updateData((data) => {
      const next = data.map((row) => row.slice());
      const isCut = clipboardRef.current?.cut && !external;
      grid!.forEach((row, rIdx) => {
        const destR = n.r1 + rIdx;
        while (next.length <= destR) next.push(Array(next[0]?.length || DEFAULT_COLS).fill(''));
        row.forEach((value, cIdx) => {
          const destC = n.c1 + cIdx;
          while ((next[destR]?.length || 0) <= destC) next[destR].push('');
          next[destR][destC] = isCut ? value : shiftReferences(value, rIdx, cIdx);
        });
      });
      return next;
    });
    if (clipboardRef.current?.cut) clipboardRef.current = { ...clipboardRef.current, cut: false };
    showToast('✓ 붙여넣기 완료 (상대 참조 자동 조정)');
  };

  // ============================================================
  // 서식
  // ============================================================
  const applyFormat = (patch: Partial<CellFormat>) => {
    const n = normSel(sel);
    pushHistory();
    setTabs((prev) =>
      prev.map((t) => {
        if (t.id !== activeTabId) return t;
        const formats = { ...(t.formats || {}) };
        for (let r = n.r1; r <= n.r2; r++) {
          for (let c = n.c1; c <= n.c2; c++) {
            const key = cellKey(r, c);
            formats[key] = { ...(formats[key] || {}), ...patch };
          }
        }
        return { ...t, formats };
      })
    );
    setDirty();
  };

  const activeFormat = tab.formats?.[cellKey(sel.r1, sel.c1)] || {};

  // ============================================================
  // 행 / 열 / 시트 조작
  // ============================================================
  const addRow = () => {
    pushHistory();
    updateData((data) => {
      const cols = data[0]?.length || DEFAULT_COLS;
      const next = data.map((row) => row.slice());
      next.splice(sel.r2 + 1, 0, Array(cols).fill(''));
      return next;
    });
  };

  const addCol = () => {
    pushHistory();
    updateData((data) => data.map((row) => {
      const next = row.slice();
      next.splice(sel.c2 + 1, 0, '');
      return next;
    }));
  };

  const deleteRow = () => {
    if (tab.data.length <= 1) return;
    const n = normSel(sel);
    pushHistory();
    updateData((data) => data.filter((_, idx) => idx < n.r1 || idx > n.r2));
    setSel({ r1: Math.max(0, n.r1 - 1), c1: n.c1, r2: Math.max(0, n.r1 - 1), c2: n.c2 });
    showToast('선택한 행을 삭제했습니다.');
  };

  const deleteCol = () => {
    if ((tab.data[0]?.length || 0) <= 1) return;
    const n = normSel(sel);
    pushHistory();
    updateData((data) => data.map((row) => row.filter((_, idx) => idx < n.c1 || idx > n.c2)));
    setSel({ r1: n.r1, c1: Math.max(0, n.c1 - 1), r2: n.r2, c2: Math.max(0, n.c1 - 1) });
    showToast('선택한 열을 삭제했습니다.');
  };

  const sortColumn = (ascending: boolean) => {
    const n = normSel(sel);
    const header = tab.data[0] || [];
    const body = tab.data.slice(1);
    pushHistory();
    updateData(() => {
      const sorted = body.slice().sort((a, b) => {
        const av = (a[n.c1] || '').replace(/,/g, '');
        const bv = (b[n.c1] || '').replace(/,/g, '');
        const an = parseFloat(av);
        const bn = parseFloat(bv);
        if (!isNaN(an) && !isNaN(bn)) return ascending ? an - bn : bn - an;
        return ascending ? av.localeCompare(bv, 'ko') : bv.localeCompare(av, 'ko');
      });
      return [header, ...sorted];
    });
    showToast(ascending ? '✓ 오름차순 정렬 완료' : '✓ 내림차순 정렬 완료');
  };

  const addTab = () => {
    pushHistory();
    const id = `sheet_${Date.now()}`;
    const name = `시트 ${tabs.length + 1}`;
    setTabs((prev) => [...prev, { id, name, data: emptySheet(), formats: {}, colWidths: [] }]);
    setActiveTabId(id);
    setSel({ r1: 0, c1: 0, r2: 0, c2: 0 });
    setDirty();
  };

  const duplicateTab = (id: string) => {
    const target = tabs.find((t) => t.id === id);
    if (!target) return;
    pushHistory();
    const newId = `sheet_${Date.now()}`;
    setTabs((prev) => [
      ...prev,
      {
        id: newId,
        name: `${target.name} 사본`,
        data: target.data.map((row) => row.slice()),
        formats: { ...(target.formats || {}) },
        colWidths: [...(target.colWidths || [])],
      },
    ]);
    setActiveTabId(newId);
    setDirty();
    showToast('✓ 시트를 복제했습니다.');
  };

  const deleteTab = (id: string) => {
    if (tabs.length <= 1) {
      showToast('시트가 하나뿐이라 삭제할 수 없습니다.');
      return;
    }
    pushHistory();
    const remaining = tabs.filter((t) => t.id !== id);
    setTabs(remaining);
    if (activeTabId === id) setActiveTabId(remaining[0].id);
    setDirty();
  };

  const renameTab = (id: string, name: string) => {
    setTabs((prev) => prev.map((t) => (t.id === id ? { ...t, name: name || t.name } : t)));
    setDirty();
  };

  // ============================================================
  // 열 너비 / 내보내기
  // ============================================================
  const colWidth = (c: number) => tab.colWidths?.[c] || DEFAULT_COL_W;

  const startResizeColumn = (e: React.MouseEvent, c: number) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startW = colWidth(c);
    pushHistory();
    const move = (ev: MouseEvent) => {
      const width = Math.max(50, Math.min(420, startW + (ev.clientX - startX)));
      setTabs((prev) =>
        prev.map((t) => {
          if (t.id !== activeTabId) return t;
          const colWidths = [...(t.colWidths || [])];
          colWidths[c] = width;
          return { ...t, colWidths };
        })
      );
    };
    const up = () => {
      document.removeEventListener('mousemove', move);
      document.removeEventListener('mouseup', up);
      setDirty();
    };
    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', up);
  };

  const buildCsv = (tabId: string) => {
    const target = tabs.find((t) => t.id === tabId);
    if (!target) return '';
    const rows = target.data.map((row, r) =>
      row
        .map((_, c) => {
          const raw = target.data[r]?.[c] ?? '';
          let text = raw;
          if (isFormulaText(raw)) {
            const sheetId = engineRef.current?.byTab[tabId];
            const value = sheetId !== undefined ? hf.getCellValue({ sheet: sheetId, row: r, col: c }) : null;
            text = value instanceof DetailedCellError ? value.value : value === null || value === undefined ? '' : String(value);
          }
          return `"${String(text).replace(/"/g, '""')}"`;
        })
        .join(',')
    );
    return rows.join('\n');
  };

  const downloadCsv = () => {
    const csv = `\ufeff${buildCsv(tab.id)}`;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(title || 'sheet').replace(/\.(gsheet|csv)$/i, '')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('✓ CSV 파일로 내려받았습니다.');
  };

  // ============================================================
  // KEYBOARD
  // ============================================================
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const inInput = target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA';
      const mod = e.ctrlKey || e.metaKey;

      if (mod && e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleManualSave();
        return;
      }
      if (edit || (inInput && target !== gridRef.current)) {
        if (mod && e.key.toLowerCase() === 'z') {
          // 셀 편집 중에는 브라우저 기본 동작 허용
        }
        return;
      }
      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) handleRedo();
        else handleUndo();
        return;
      }
      if (mod && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedo();
        return;
      }
      if (mod && e.key.toLowerCase() === 'c') {
        e.preventDefault();
        copySelection(false);
        return;
      }
      if (mod && e.key.toLowerCase() === 'x') {
        e.preventDefault();
        copySelection(true);
        return;
      }
      if (mod && e.key.toLowerCase() === 'v') {
        e.preventDefault();
        pasteClipboard();
        return;
      }
      if (mod && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        setSel({ r1: 0, c1: 0, r2: tab.data.length - 1, c2: (tab.data[0]?.length || 1) - 1 });
        return;
      }
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.key)) {
        e.preventDefault();
        const n = normSel(sel);
        const rows = tab.data.length;
        const cols = tab.data[0]?.length || 1;
        let r = n.r1;
        let c = n.c1;
        if (e.key === 'ArrowUp') r = Math.max(0, r - 1);
        if (e.key === 'ArrowDown') r = Math.min(rows - 1, r + 1);
        if (e.key === 'ArrowLeft') c = Math.max(0, c - 1);
        if (e.key === 'ArrowRight') c = Math.min(cols - 1, c + 1);
        if (e.key === 'Tab') c = e.shiftKey ? Math.max(0, c - 1) : Math.min(cols - 1, c + 1);
        setSel({ r1: r, c1: c, r2: r, c2: c });
        return;
      }
      if (e.key === 'Enter' || e.key === 'F2') {
        e.preventDefault();
        startEdit(sel.r1, sel.c1);
        return;
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        const n = normSel(sel);
        pushHistory();
        updateData((data) =>
          data.map((row, rIdx) =>
            row.map((cell, cIdx) =>
              rIdx >= n.r1 && rIdx <= n.r2 && cIdx >= n.c1 && cIdx <= n.c2 ? '' : cell
            )
          )
        );
        return;
      }
      if (e.key.length === 1 && !mod && !e.altKey) {
        e.preventDefault();
        startEdit(sel.r1, sel.c1, e.key);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  });

  // 외부 클립보드 붙여넣기 (문자열이 실제로 있을 때만)
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      if (edit) return;
      const active = document.activeElement as HTMLElement | null;
      if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) return;
      const text = e.clipboardData?.getData('text/plain');
      if (!text) return;
      e.preventDefault();
      pasteClipboard(text);
    };
    document.addEventListener('paste', onPaste);
    return () => document.removeEventListener('paste', onPaste);
  });

  // 실제 Google Drive 스프레드시트를 열었을 때 내용 불러오기
  useEffect(() => {
    if (initialContent) return;
    if (!fileId || /^(sheet_|doc_|upload_)/.test(fileId)) return;
    let cancelled = false;
    fetchRealDocContent(fileId, 'application/vnd.google-apps.spreadsheet').then((content) => {
      if (cancelled || !content || !content.trim()) return;
      const loaded = parseSheetContent(content);
      setTabs(loaded.tabs);
      if (loaded.activeTabId) setActiveTabId(loaded.activeTabId);
    });
    return () => {
      cancelled = true;
    };
  }, [fileId, initialContent]);

  // ============================================================
  // SAVE
  // ============================================================
  const serialize = () => JSON.stringify({ v: 2, activeTabId, tabs });

  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;
  const titleRef = useRef(title);
  titleRef.current = title;
  const serializeRef = useRef(serialize);
  serializeRef.current = serialize;

  useEffect(() => {
    if (saveStatus !== 'dirty') return;
    const timer = window.setTimeout(async () => {
      setSaveStatus('saving');
      onSaveRef.current(fileId, serializeRef.current(), titleRef.current);
      if (!fileId.startsWith('sheet_') && !fileId.startsWith('doc_') && !fileId.startsWith('upload_')) {
        try {
          await saveRealDocContent(fileId, serializeRef.current(), titleRef.current);
        } catch {
          /* 로컬 저장은 완료 */
        }
      }
      setLastSavedTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      setSaveStatus('saved');
    }, 600);
    return () => window.clearTimeout(timer);
  }, [tabs, title, saveStatus, fileId, activeTabId]);

  useEffect(() => {
    const flush = () => {
      if (saveStatus === 'dirty') onSaveRef.current(fileId, serializeRef.current(), titleRef.current);
    };
    window.addEventListener('beforeunload', flush);
    return () => {
      window.removeEventListener('beforeunload', flush);
      flush();
    };
  }, [fileId]);

  const handleManualSave = async () => {
    setSaveStatus('saving');
    onSave(fileId, serialize(), title);
    if (!fileId.startsWith('sheet_') && !fileId.startsWith('doc_') && !fileId.startsWith('upload_')) {
      await saveRealDocContent(fileId, serialize(), title);
    }
    setLastSavedTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    setSaveStatus('saved');
    showToast('✓ 저장했습니다.');
  };

  // ============================================================
  // 선택 영역 통계 (합계/평균/개수)
  // ============================================================
  const selectionStats = useMemo(() => {
    const n = normSel(sel);
    let sum = 0;
    let numeric = 0;
    let filled = 0;
    const sheetId = engineRef.current?.byTab[tab.id];
    for (let r = n.r1; r <= n.r2; r++) {
      for (let c = n.c1; c <= n.c2; c++) {
        const raw = tab.data[r]?.[c] ?? '';
        if (raw === '') continue;
        if (r - n.r1 > 2000) break;
        filled++;
        let value: unknown = raw;
        if (isFormulaText(raw) && sheetId !== undefined) {
          value = hf.getCellValue({ sheet: sheetId, row: r, col: c });
        }
        const num = typeof value === 'number' ? value : parseFloat(String(value).replace(/,/g, ''));
        if (typeof value === 'number' || (!isNaN(num) && !isFormulaText(raw))) {
          sum += num;
          numeric++;
        }
      }
    }
    return { sum, numeric, filled };
  }, [sel, tab, hf]);

  // ============================================================
  // 차트 데이터
  // ============================================================
  const chartData = useMemo(() => {
    const n = normSel(sel);
    const points: { label: string; value: number }[] = [];
    const useRange = n.r2 > n.r1 && n.c2 > n.c1;
    const r1 = useRange ? n.r1 : 1;
    const r2 = useRange ? n.r2 : tab.data.length - 1;
    const labelCol = useRange ? n.c1 : 1;
    const valueCol = useRange ? n.c2 : 4;
    for (let r = r1; r <= r2 && points.length < 12; r++) {
      const label = tab.data[r]?.[labelCol] || `${r + 1}행`;
      const displayed = displayCell(r, valueCol).text;
      const value = parseFloat(displayed.replace(/[₩,%]/g, '').replace(/,/g, ''));
      if (!isNaN(value)) points.push({ label, value });
    }
    return points;
  }, [sel, tab, hf]);

  // ============================================================
  // RENDER
  // ============================================================
  const nSel = normSel(sel);
  const colCount = tab.data[0]?.length || DEFAULT_COLS;
  const totalWidth = ROW_HDR_W + Array.from({ length: colCount }).reduce<number>((acc, _, c) => acc + colWidth(c), 0);

  const palette = ['#2C2520', '#0F9D58', '#1A73E8', '#EA4335', '#F4B400', '#9333EA', '#0F766E', '#B45309', '#FFFFFF'];
  const fills = ['#FFFFFF', '#F1F3F4', '#E6F4EA', '#FEF7E0', '#FCE8E6', '#E8F0FE', '#F3E8FF', '#F4EFE6'];

  const numFmtLabel: Record<string, string> = {
    general: '일반',
    number: '숫자 #,##0',
    currency: '원화 ₩',
    percent: '퍼센트 %',
    date: '날짜',
  };

  const insertFunction = (template: string) => {
    setFnMenu(false);
    const target = edit ? edit : null;
    if (target) {
      const caret = target.caret ?? target.text.length;
      const nextText = `${target.text.slice(0, caret)}${template}${target.text.slice(caret)}`;
      setEdit({ ...target, text: nextText, caret: caret + template.length });
      window.setTimeout(() => {
        const input = editorInputRef.current;
        if (input) {
          input.focus();
          const pos = caret + template.length;
          input.setSelectionRange(pos, pos);
        }
      }, 0);
    } else {
      startEdit(sel.r1, sel.c1, template);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#FDFBF7] text-[#2C2520] font-sans relative overflow-hidden select-none">
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-[#2C2520] text-white text-xs px-4 py-2 rounded-2xl shadow-xl flex items-center gap-2 pointer-events-none">
          <Check className="w-4 h-4 text-[#48BB78]" />
          <span className="font-medium">{toast}</span>
        </div>
      )}

      {/* HEADER */}
      <header className="h-14 bg-white border-b border-[#EBE5DA] px-3 sm:px-4 flex items-center justify-between shrink-0 shadow-2xs">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white shadow-xs shrink-0 bg-[#0F9D58]">
            <Table className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex flex-col justify-center">
            <input
              type="text"
              data-testid="doc-title"
              aria-label="문서 제목"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                setDirty();
              }}
              className="text-xs sm:text-sm font-bold text-[#2C2520] bg-transparent hover:bg-[#F4EFE6] px-1.5 py-0.5 rounded-lg border border-transparent hover:border-[#EBE5DA] focus:border-[#0F9D58] focus:bg-white focus:outline-none truncate max-w-[160px] sm:max-w-xs"
            />
            <div className="flex items-center gap-2 text-[10px] text-[#7A6A5C] px-1.5">
              <span className="font-semibold">Google Sheets · 수식 엔진</span>
              <span>•</span>
              <span
                className={`flex items-center gap-1 font-bold ${
                  saveStatus === 'saved' ? 'text-[#0F9D58]' : saveStatus === 'saving' ? 'text-[#E67E22]' : 'text-[#EA4335]'
                }`}
              >
                {saveStatus === 'saved' && <Check className="w-3 h-3" />}
                {saveStatus === 'saving' && <RefreshCw className="w-3 h-3 animate-spin" />}
                {saveStatus === 'saved' ? `저장 완료 (${lastSavedTime})` : saveStatus === 'saving' ? '저장 중...' : '저장 대기'}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={downloadCsv}
            className="p-1.5 rounded-xl hover:bg-[#F4EFE6] text-[#5C5046] border border-[#EBE5DA]"
            title="CSV로 다운로드"
            data-testid="sheet-csv"
          >
            <Download className="w-4 h-4" />
          </button>
          {onShareToChat && (
            <button
              onClick={() =>
                onShareToChat(`📊 ${title}\n\n${buildCsv(tab.id).split('\n').slice(0, 12).join('\n')}`)
              }
              className="p-1.5 rounded-xl hover:bg-[#F4EFE6] text-[#5C5046] border border-[#EBE5DA]"
              title="현재 표를 대화방에 공유"
            >
              <FileSpreadsheet className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={handleManualSave}
            data-testid="sheet-save"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-xs ${
              saveStatus === 'saved' ? 'bg-white border border-[#EBE5DA] text-[#2C2520]' : 'bg-[#3E2723] text-white'
            }`}
          >
            <Save className="w-3.5 h-3.5" />
            <span>저장</span>
          </button>
          {onClose && (
            <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-[#FEE2E2] text-[#7A6A5C] hover:text-[#DC2626] border border-[#EBE5DA] ml-1" title="에디터 닫기">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </header>

      {/* TOOLBAR */}
      <div className="bg-[#FAF7F2] border-b border-[#EBE5DA] px-3 py-1.5 flex flex-col gap-1.5 shrink-0">
        <div className="flex items-center gap-1 text-xs overflow-x-auto">
          <button onClick={handleUndo} className="p-1.5 rounded-lg hover:bg-white text-[#5C5046]" title="실행 취소 (Ctrl+Z)">
            <Undo className="w-3.5 h-3.5" />
          </button>
          <button onClick={handleRedo} className="p-1.5 rounded-lg hover:bg-white text-[#5C5046]" title="다시 실행 (Ctrl+Y)">
            <Redo className="w-3.5 h-3.5" />
          </button>
          <div className="w-px h-4 bg-[#EBE5DA] mx-1" />

          <button
            onClick={() => applyFormat({ bold: !activeFormat.bold })}
            className={`p-1.5 rounded-lg hover:bg-white ${activeFormat.bold ? 'bg-white text-[#0F9D58]' : 'text-[#3E2723]'}`}
            title="굵게"
          >
            <Bold className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => applyFormat({ italic: !activeFormat.italic })}
            className={`p-1.5 rounded-lg hover:bg-white ${activeFormat.italic ? 'bg-white text-[#0F9D58]' : 'text-[#3E2723]'}`}
            title="기울임"
          >
            <Italic className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => applyFormat({ underline: !activeFormat.underline })}
            className={`p-1.5 rounded-lg hover:bg-white ${activeFormat.underline ? 'bg-white text-[#0F9D58]' : 'text-[#3E2723]'}`}
            title="밑줄"
          >
            <Underline className="w-3.5 h-3.5" />
          </button>

          <div className="relative">
            <button
              onClick={() => setColorMenu(colorMenu === 'text' ? null : 'text')}
              className="flex items-center gap-0.5 p-1.5 rounded-lg hover:bg-white text-[#3E2723]"
              title="글자색"
            >
              <Palette className="w-3.5 h-3.5" />
              <span className="w-2 h-2 rounded-full" style={{ background: activeFormat.color || '#2C2520' }} />
            </button>
            {colorMenu === 'text' && (
              <div className="absolute z-40 mt-1 p-2 bg-white border border-[#EBE5DA] rounded-xl shadow-xl grid grid-cols-5 gap-1 w-40">
                {palette.map((color) => (
                  <button
                    key={color}
                    onClick={() => {
                      applyFormat({ color });
                      setColorMenu(null);
                    }}
                    className="w-6 h-6 rounded-md border border-[#EBE5DA]"
                    style={{ background: color }}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="relative">
            <button
              onClick={() => setColorMenu(colorMenu === 'fill' ? null : 'fill')}
              className="flex items-center gap-0.5 p-1.5 rounded-lg hover:bg-white text-[#3E2723]"
              title="셀 배경색"
            >
              <PaintBucket className="w-3.5 h-3.5" />
              <span className="w-2 h-2 rounded-full border border-[#EBE5DA]" style={{ background: activeFormat.bg || '#FFFFFF' }} />
            </button>
            {colorMenu === 'fill' && (
              <div className="absolute z-40 mt-1 p-2 bg-white border border-[#EBE5DA] rounded-xl shadow-xl grid grid-cols-4 gap-1 w-36">
                {fills.map((color) => (
                  <button
                    key={color}
                    onClick={() => {
                      applyFormat({ bg: color });
                      setColorMenu(null);
                    }}
                    className="w-7 h-7 rounded-md border border-[#EBE5DA]"
                    style={{ background: color }}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="w-px h-4 bg-[#EBE5DA] mx-1" />
          <button onClick={() => applyFormat({ align: 'left' })} className={`p-1.5 rounded-lg hover:bg-white ${activeFormat.align === 'left' ? 'bg-white text-[#0F9D58]' : 'text-[#3E2723]'}`} title="왼쪽 정렬">
            <AlignLeft className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => applyFormat({ align: 'center' })} className={`p-1.5 rounded-lg hover:bg-white ${activeFormat.align === 'center' ? 'bg-white text-[#0F9D58]' : 'text-[#3E2723]'}`} title="가운데 정렬">
            <AlignCenter className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => applyFormat({ align: 'right' })} className={`p-1.5 rounded-lg hover:bg-white ${activeFormat.align === 'right' ? 'bg-white text-[#0F9D58]' : 'text-[#3E2723]'}`} title="오른쪽 정렬">
            <AlignRight className="w-3.5 h-3.5" />
          </button>

          <div className="w-px h-4 bg-[#EBE5DA] mx-1" />
          <select
            value={activeFormat.numFmt || 'general'}
            onChange={(e) => applyFormat({ numFmt: e.target.value as CellFormat['numFmt'] })}
            className="bg-white border border-[#EBE5DA] rounded-lg px-2 py-1 text-[11px] font-semibold text-[#2C2520] focus:outline-none"
            title="숫자 서식"
            data-testid="num-format"
          >
            {Object.entries(numFmtLabel).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>

          <div className="relative">
            <button
              onClick={() => setFnMenu(!fnMenu)}
              className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white border border-[#EBE5DA] text-[11px] font-bold text-[#0F9D58]"
              data-testid="fn-menu"
            >
              <Sigma className="w-3.5 h-3.5" />
              <span>함수</span>
              <ChevronDown className="w-3 h-3" />
            </button>
            {fnMenu && (
              <div className="absolute z-40 mt-1 w-64 max-h-80 overflow-auto bg-white border border-[#EBE5DA] rounded-xl shadow-xl p-2 text-[11px]">
                {[
                  ['합계', '=SUM('],
                  ['평균', '=AVERAGE('],
                  ['개수', '=COUNT('],
                  ['조건 합계', '=SUMIF('],
                  ['조건 개수', '=COUNTIF('],
                  ['조건문', '=IF('],
                  ['다중 조건문', '=IFS('],
                  ['조회 (VLOOKUP)', '=VLOOKUP('],
                  ['행 조회 (HLOOKUP)', '=HLOOKUP('],
                  ['위치 찾기', '=MATCH('],
                  ['순위 값', '=INDEX('],
                  ['에러 처리', '=IFERROR('],
                  ['반올림', '=ROUND('],
                  ['제곱근', '=SQRT('],
                  ['오늘 날짜', '=TODAY()'],
                  ['문자 연결', '=CONCATENATE('],
                ].map(([label, template]) => (
                  <button
                    key={template}
                    onClick={() => insertFunction(template)}
                    className="w-full flex items-center justify-between px-2 py-1 rounded hover:bg-[#F4EFE6] text-left"
                  >
                    <span className="font-semibold text-[#3E2723]">{label}</span>
                    <span className="font-mono text-[10px] text-[#7A6A5C]">{template}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="w-px h-4 bg-[#EBE5DA] mx-1" />
          <button onClick={addRow} className="flex items-center gap-0.5 px-2 py-1 rounded-lg bg-white border border-[#EBE5DA] text-[11px] font-bold text-[#0F9D58]" title="아래에 행 추가">
            <Plus className="w-3 h-3" /> 행
          </button>
          <button onClick={addCol} className="flex items-center gap-0.5 px-2 py-1 rounded-lg bg-white border border-[#EBE5DA] text-[11px] font-bold text-[#0F9D58]" title="오른쪽에 열 추가">
            <Plus className="w-3 h-3" /> 열
          </button>
          <button onClick={deleteRow} className="px-2 py-1 rounded-lg hover:bg-[#FEE2E2] text-[11px] font-semibold text-[#DC2626]" title="선택 행 삭제">
            행 삭제
          </button>
          <button onClick={deleteCol} className="px-2 py-1 rounded-lg hover:bg-[#FEE2E2] text-[11px] font-semibold text-[#DC2626]" title="선택 열 삭제">
            열 삭제
          </button>

          <div className="w-px h-4 bg-[#EBE5DA] mx-1" />
          <button onClick={() => sortColumn(true)} className="p-1.5 rounded-lg hover:bg-white text-[#5C5046]" title="선택 열 오름차순">
            <ArrowUp className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => sortColumn(false)} className="p-1.5 rounded-lg hover:bg-white text-[#5C5046]" title="선택 열 내림차순">
            <ArrowDown className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => setShowChart(true)} className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white border border-[#BBF7D0] text-[11px] font-bold text-[#0F9D58]" title="차트 생성">
            <BarChart3 className="w-3.5 h-3.5" /> 차트
          </button>

          <div className="w-px h-4 bg-[#EBE5DA] mx-1" />
          <button onClick={() => copySelection(false)} className="p-1.5 rounded-lg hover:bg-white text-[#5C5046]" title="복사 (Ctrl+C)">
            <Copy className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => copySelection(true)} className="p-1.5 rounded-lg hover:bg-white text-[#5C5046]" title="잘라내기 (Ctrl+X)">
            <Scissors className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => pasteClipboard()} className="p-1.5 rounded-lg hover:bg-white text-[#5C5046]" title="붙여넣기 (Ctrl+V)">
            <ClipboardPaste className="w-3.5 h-3.5" />
          </button>

          <div className="ml-auto flex items-center gap-1 text-[11px] text-[#7A6A5C] pl-2">
            <button onClick={() => setZoom((z) => Math.max(70, z - 10))} className="px-1.5 py-0.5 rounded hover:bg-white">−</button>
            <span className="font-mono font-bold">{zoom}%</span>
            <button onClick={() => setZoom((z) => Math.min(140, z + 10))} className="px-1.5 py-0.5 rounded hover:bg-white">+</button>
          </div>
        </div>

        {/* FORMULA BAR */}
        <div className="flex items-center gap-2">
          <div className="px-2.5 py-1 rounded-lg bg-white border border-[#0F9D58]/40 font-mono font-bold text-xs text-[#0F9D58] min-w-16 text-center shadow-2xs" data-testid="cell-address">
            {colLabel(nSel.c1)}
            {nSel.r1 + 1}
            {nSel.r2 !== nSel.r1 || nSel.c2 !== nSel.c1
              ? `:${colLabel(nSel.c2)}${nSel.r2 + 1}`
              : ''}
          </div>
          <span className="font-serif italic font-black text-[#A89A8E] text-sm select-none">fx</span>
          <input
            ref={formulaBarRef}
            data-testid="formula-input"
            type="text"
            value={edit ? edit.text : rawAt(sel.r1, sel.c1)}
            onFocus={() => {
              formulaBarFocusedRef.current = true;
              formulaBarDirtyRef.current = false;
              formulaCaretRef.current = rawAt(sel.r1, sel.c1).length;
            }}
            onBlur={() => {
              formulaBarFocusedRef.current = false;
              formulaBarDirtyRef.current = false;
            }}
            onSelect={(e) => {
              formulaCaretRef.current = (e.target as HTMLInputElement).selectionStart || 0;
            }}
            onChange={(e) => {
              const value = e.target.value;
              formulaBarDirtyRef.current = true;
              formulaCaretRef.current = e.target.selectionStart || value.length;
              if (edit) {
                setEdit({ ...edit, text: value, caret: formulaCaretRef.current });
              } else {
                pushHistory(`${sel.r1}_${sel.c1}_bar`);
                setCellRaw(sel.r1, sel.c1, value);
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                formulaBarDirtyRef.current = false;
                if (edit) commitEdit('down');
                else {
                  setSel({ r1: sel.r1 + 1, c1: sel.c1, r2: sel.r1 + 1, c2: sel.c1 });
                  setDirty();
                }
                gridRef.current?.focus();
              }
              if (e.key === 'Escape') {
                formulaBarDirtyRef.current = false;
                setEdit(null);
                gridRef.current?.focus();
              }
            }}
            placeholder='수식 또는 값 입력 — 예: =IF(SUM(B2:B4)>50,"합격","미달"), =VLOOKUP(A2,A5:B9,2,FALSE)'
            className="flex-1 bg-white border border-[#EBE5DA] rounded-lg px-3 py-1 text-xs text-[#2C2520] focus:outline-none focus:border-[#0F9D58] font-mono shadow-2xs"
          />
          <div className="hidden md:flex items-center gap-2 text-[10px] bg-white px-2.5 py-1 rounded-lg border border-[#EBE5DA] shrink-0 font-mono">
            <span className="text-[#7A6A5C]">
              합계 <b className="text-[#0F9D58]">{formatNumber(selectionStats.sum)}</b>
            </span>
            <span>·</span>
            <span className="text-[#7A6A5C]">
              평균 <b className="text-[#2C2520]">{selectionStats.numeric ? formatNumber(selectionStats.sum / selectionStats.numeric) : 0}</b>
            </span>
            <span>·</span>
            <span className="text-[#7A6A5C]">
              값 <b className="text-[#2C2520]">{selectionStats.filled}</b>
            </span>
          </div>
        </div>
      </div>

      {/* GRID */}
      <div className="flex-1 flex overflow-hidden border-t border-[#EBE5DA]">
        <div
          ref={gridRef}
          tabIndex={0}
          data-testid="sheet-grid"
          className="flex-1 overflow-auto outline-none bg-[#F4EFE6]"
          style={{ zoom: `${zoom}%` }}
          onMouseDown={() => setColorMenu(null)}
        >
          <div style={{ width: totalWidth, paddingBottom: 160 }}>
            {/* column headers */}
            <div className="flex sticky top-0 z-30" style={{ height: HEADER_H }}>
              <div
                className="sticky left-0 z-40 bg-[#EFE9DE] border-r border-b border-[#DDD5C7] flex items-center justify-center text-[10px] text-[#7A6A5C]"
                style={{ width: ROW_HDR_W, height: HEADER_H }}
              >
                <Grid3x3 className="w-3 h-3" />
              </div>
              {Array.from({ length: colCount }, (_, c) => (
                <div
                  key={c}
                  className={`relative bg-[#F4EFE6] border-r border-b border-[#DDD5C7] flex items-center justify-center text-[11px] font-bold ${
                    c >= nSel.c1 && c <= nSel.c2 ? 'text-[#0F9D58] bg-[#E6F4EA]' : 'text-[#7A6A5C]'
                  }`}
                  style={{ width: colWidth(c), height: HEADER_H }}
                  onMouseDown={() => setSel({ r1: 0, c1: c, r2: tab.data.length - 1, c2: c })}
                >
                  {colLabel(c)}
                  <span
                    onMouseDown={(e) => startResizeColumn(e, c)}
                    className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize hover:bg-[#0F9D58]/40"
                    title="열 너비 조절"
                  />
                </div>
              ))}
            </div>

            {tab.data.map((row, r) => (
              <div key={r} className="flex">
                <div
                  className={`sticky left-0 z-20 border-r border-b border-[#DDD5C7] flex items-center justify-center text-[10px] font-semibold cursor-pointer ${
                    r >= nSel.r1 && r <= nSel.r2 ? 'bg-[#E6F4EA] text-[#0F9D58]' : 'bg-[#F4EFE6] text-[#7A6A5C]'
                  }`}
                  style={{ width: ROW_HDR_W, height: CELL_H }}
                  onMouseDown={() => setSel({ r1: r, c1: 0, r2: r, c2: colCount - 1 })}
                >
                  {r + 1}
                </div>
                {row.map((raw, c) => {
                  const fmt = tab.formats?.[cellKey(r, c)] || {};
                  const selected = inSel(r, c);
                  const isEditing = edit?.r === r && edit?.c === c;
                  const showFillTarget =
                    fillPreview &&
                    r >= fillPreview.r1 && r <= fillPreview.r2 && c >= fillPreview.c1 && c <= fillPreview.c2 &&
                    !(r >= nSel.r1 && r <= nSel.r2 && c >= nSel.c1 && c <= nSel.c2);
                  const display = isEditing ? { text: '', isNumber: false, isError: false } : displayCell(r, c);
                  return (
                    <div
                      key={c}
                      data-cell={`${r}_${c}`}
                      data-ref={`${colLabel(c)}${r + 1}`}
                      onMouseDown={(e) => {
                        if (startReferencePick(e, r, c)) return;
                        if (startFormulaBarPick(e, r, c)) return;
                        if (edit) commitEdit();
                        startRangeDrag(e, r, c);
                        gridRef.current?.focus();
                      }}
                      onDoubleClick={() => startEdit(r, c)}
                      className={`relative flex items-center border-r border-b border-[#EDE7DC] px-1.5 text-[11.5px] overflow-hidden whitespace-nowrap cursor-cell ${
                        selected ? 'bg-[#E6F4EA]' : showFillTarget ? 'bg-[#F1F8E9]' : ''
                      } ${display.isError ? 'text-[#DC2626]' : ''}`}
                      style={{
                        width: colWidth(c),
                        height: CELL_H,
                        background: isEditing ? '#FFFFFF' : fmt.bg || (selected ? '#E6F4EA' : '#FFFFFF'),
                        color: display.isError ? '#DC2626' : fmt.color || '#2C2520',
                        fontWeight: fmt.bold ? 700 : 400,
                        fontStyle: fmt.italic ? 'italic' : 'normal',
                        textDecoration: fmt.underline ? 'underline' : 'none',
                        justifyContent:
                          fmt.align === 'center'
                            ? 'center'
                            : fmt.align === 'right'
                            ? 'flex-end'
                            : fmt.align === 'left'
                            ? 'flex-start'
                            : display.isNumber
                            ? 'flex-end'
                            : 'flex-start',
                        fontSize: fmt.size ? `${fmt.size}px` : 11.5,
                        boxShadow: selected ? 'inset 0 0 0 1.5px #0F9D58' : undefined,
                        zIndex: selected ? 5 : 1,
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {isEditing ? (
                        <input
                          ref={editorInputRef}
                          data-testid="cell-editor"
                          value={edit.text}
                          onChange={(e) =>
                            setEdit({ r, c, text: e.target.value, caret: e.target.selectionStart || 0 })
                          }
                          onSelect={(e) =>
                            setEdit((prev) =>
                              prev ? { ...prev, caret: (e.target as HTMLInputElement).selectionStart || 0 } : prev
                            )
                          }
                          onBlur={() => {
                            if (edit) commitEdit();
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              commitEdit('down');
                            } else if (e.key === 'Tab') {
                              e.preventDefault();
                              commitEdit('right');
                            } else if (e.key === 'Escape') {
                              e.preventDefault();
                              setEdit(null);
                              gridRef.current?.focus();
                            }
                          }}
                          className="absolute inset-0 w-full h-full px-1.5 text-[11.5px] font-mono outline-none bg-white"
                          style={{ textAlign: fmt.align || 'left' }}
                        />
                      ) : (
                        <span className="truncate">{display.text}</span>
                      )}
                      {/* fill handle */}
                      {selected && r === nSel.r2 && c === nSel.c2 && (
                        <span
                          data-testid="fill-handle"
                          onMouseDown={startFillHandle}
                          className="absolute -right-[3px] -bottom-[3px] w-2 h-2 bg-[#0F9D58] border border-white rounded-[1px] cursor-crosshair z-10"
                          title="채우기 핸들 (드래그)"
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            ))}

          </div>
        </div>
      </div>

      {/* SHEET TABS */}
      <div className="h-10 bg-[#F4EFE6] border-t border-[#EBE5DA] flex items-center px-2 gap-1 shrink-0 overflow-x-auto">
        {tabs.map((t) => (
          <div
            key={t.id}
            onClick={() => {
              setActiveTabId(t.id);
              setSel({ r1: 0, c1: 0, r2: 0, c2: 0 });
              setEdit(null);
            }}
            onDoubleClick={() => setRenamingTab(t.id)}
            className={`group flex items-center gap-1 px-3 py-1 rounded-t-lg text-[11px] font-semibold cursor-pointer border ${
              t.id === activeTabId
                ? 'bg-white border-[#EBE5DA] border-b-white text-[#0F9D58]'
                : 'bg-[#EBE5DA]/60 border-transparent text-[#5C5046] hover:bg-[#E3DACB]'
            }`}
            data-testid={`sheet-tab-${t.id}`}
          >
            {renamingTab === t.id ? (
              <input
                autoFocus
                defaultValue={t.name}
                onBlur={(e) => {
                  renameTab(t.id, e.target.value.trim());
                  setRenamingTab(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    renameTab(t.id, (e.target as HTMLInputElement).value.trim());
                    setRenamingTab(null);
                  }
                  if (e.key === 'Escape') setRenamingTab(null);
                }}
                className="w-20 bg-white border border-[#0F9D58] rounded px-1 outline-none text-[11px]"
              />
            ) : (
              <span>{t.name}</span>
            )}
            {t.id === activeTabId && tabs.length > 1 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  deleteTab(t.id);
                }}
                className="opacity-0 group-hover:opacity-100 text-[#7A6A5C] hover:text-[#DC2626]"
                title="시트 삭제"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        ))}
        <button onClick={addTab} data-testid="add-sheet-tab" className="p-1 rounded-lg hover:bg-white text-[#0F9D58]" title="시트 추가">
          <Plus className="w-4 h-4" />
        </button>
        <button onClick={() => duplicateTab(activeTabId)} className="p-1 rounded-lg hover:bg-white text-[#7A6A5C]" title="현재 시트 복제">
          <Copy className="w-3.5 h-3.5" />
        </button>
        <div className="ml-auto flex items-center gap-3 text-[10px] text-[#7A6A5C] pl-3 shrink-0">
          <span>
            {tab.data.length}행 × {colCount}열
          </span>
          <span className="flex items-center gap-1">
            <Calculator className="w-3 h-3" /> HyperFormula 엔진
          </span>
        </div>
      </div>

      {/* CHART MODAL */}
      {showChart && (
        <div className="fixed inset-0 z-50 bg-[#2C2520]/40 flex items-center justify-center p-4" onMouseDown={() => setShowChart(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl p-5" onMouseDown={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-[#0F9D58]" /> 차트 미리보기
              </h3>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setChartType('bar')}
                  className={`px-2 py-1 rounded-lg text-[11px] font-bold ${chartType === 'bar' ? 'bg-[#0F9D58] text-white' : 'bg-[#F4EFE6] text-[#5C5046]'}`}
                >
                  막대
                </button>
                <button
                  onClick={() => setChartType('pie')}
                  className={`px-2 py-1 rounded-lg text-[11px] font-bold ${chartType === 'pie' ? 'bg-[#0F9D58] text-white' : 'bg-[#F4EFE6] text-[#5C5046]'}`}
                >
                  원형
                </button>
                <button onClick={() => setShowChart(false)} className="p-1 rounded-lg hover:bg-[#F4EFE6] ml-2">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            {chartData.length === 0 ? (
              <p className="text-xs text-[#7A6A5C] py-10 text-center">차트로 만들 숫자 데이터가 없습니다. 값이 있는 범위를 선택해 주세요.</p>
            ) : chartType === 'bar' ? (
              <div className="space-y-2 py-3">
                {(() => {
                  const max = Math.max(...chartData.map((d) => Math.abs(d.value)), 1);
                  return chartData.map((d, i) => (
                    <div key={i} className="flex items-center gap-2 text-[11px]">
                      <span className="w-24 truncate text-[#5C5046]">{d.label}</span>
                      <div className="flex-1 h-4 bg-[#F4EFE6] rounded">
                        <div
                          className="h-4 rounded bg-gradient-to-r from-[#0F9D58] to-[#34D399]"
                          style={{ width: `${(Math.abs(d.value) / max) * 100}%` }}
                        />
                      </div>
                      <span className="w-20 text-right font-mono font-bold">{formatNumber(d.value)}</span>
                    </div>
                  ));
                })()}
              </div>
            ) : (
              <div className="flex items-center justify-center py-4">
                <svg viewBox="0 0 200 200" className="w-64 h-64">
                  {(() => {
                    const total = chartData.reduce((acc, d) => acc + Math.abs(d.value), 0) || 1;
                    const colors = ['#0F9D58', '#1A73E8', '#F4B400', '#EA4335', '#9333EA', '#0F766E', '#B45309'];
                    let angle = -Math.PI / 2;
                    return chartData.map((d, i) => {
                      const slice = (Math.abs(d.value) / total) * Math.PI * 2;
                      const x1 = 100 + 80 * Math.cos(angle);
                      const y1 = 100 + 80 * Math.sin(angle);
                      angle += slice;
                      const x2 = 100 + 80 * Math.cos(angle);
                      const y2 = 100 + 80 * Math.sin(angle);
                      const large = slice > Math.PI ? 1 : 0;
                      return (
                        <path
                          key={i}
                          d={`M100,100 L${x1},${y1} A80,80 0 ${large} 1 ${x2},${y2} Z`}
                          fill={colors[i % colors.length]}
                          stroke="#fff"
                          strokeWidth="1"
                        />
                      );
                    });
                  })()}
                </svg>
                <div className="ml-4 space-y-1 text-[11px]">
                  {chartData.map((d, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span
                        className="w-2.5 h-2.5 rounded"
                        style={{ background: ['#0F9D58', '#1A73E8', '#F4B400', '#EA4335', '#9333EA', '#0F766E', '#B45309'][i % 7] }}
                      />
                      <span className="w-24 truncate">{d.label}</span>
                      <span className="font-mono font-bold">{formatNumber(d.value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
