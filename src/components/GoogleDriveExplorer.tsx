import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  HardDrive,
  FileText,
  Table,
  Presentation,
  Upload,
  Plus,
  Search,
  Trash2,
  Download,
  Share2,
  ExternalLink,
  Edit3,
  CheckCircle2,
  File,
  Eye,
  RefreshCw,
  ArrowLeft,
  AlertCircle,
  X
} from 'lucide-react';
import { DriveDocument, DriveFileType, User } from '../types';
import { storage } from '../storage';
import {
  fetchRealDriveFiles,
  createRealDriveDoc,
  deleteRealDriveFile,
  getAccessToken,
  describeAuthError,
  getLastAuthErrorCode,
  signInWithGoogleWorkspace
} from '../services/googleWorkspace';

interface GoogleDriveExplorerProps {
  currentUser: User;
  onOpenDocEditor: (fileId: string, fileName: string, fileType: string) => void;
  onShareDocToChat?: (doc: DriveDocument) => void;
  onBackToChat?: () => void;
}

export const GoogleDriveExplorer: React.FC<GoogleDriveExplorerProps> = ({
  currentUser,
  onOpenDocEditor,
  onShareDocToChat,
  onBackToChat,
}) => {
  const [docs, setDocs] = useState<DriveDocument[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'doc' | 'sheet' | 'slide'>('all');
  const [isCreatingModal, setIsCreatingModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newType, setNewType] = useState<DriveFileType>('doc');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hasToken, setHasToken] = useState<boolean | null>(null);

  // Confirmation dialog (Mandatory per Workspace skill for destructive actions)
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string;
    description: string;
    onConfirm: () => void;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const loadDriveFiles = async () => {
    setIsLoading(true);
    try {
      const token = await getAccessToken();
      setHasToken(!!token);
      if (token) {
        const realFiles = await fetchRealDriveFiles(searchQuery, filterType);
        // Merge with any offline-saved files created this session
        const localSaved = storage.getDriveDocuments().filter((d) => !d.id.startsWith('doc_recent_'));
        const mergedMap = new Map<string, DriveDocument>();
        localSaved.forEach((d) => mergedMap.set(d.id, d));
        realFiles.forEach((f) => mergedMap.set(f.id, f));
        setDocs(Array.from(mergedMap.values()));
      } else {
        const localSaved = storage.getDriveDocuments().filter((d) => !d.id.startsWith('doc_recent_'));
        setDocs(localSaved);
      }
    } catch (e: any) {
      console.warn('Failed to fetch Drive files:', e);
      showToast('Drive 파일을 불러오지 못했습니다. Google Drive 권한을 다시 연결해 주세요.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDriveFiles();
  }, [filterType]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadDriveFiles();
  };

  // Create real Google Drive document
  const handleCreateDocument = async (type: DriveFileType) => {
    const ext = type === 'sheet' ? '.gsheet' : type === 'slide' ? '.gslides' : '.gdoc';
    const rawTitle = newTitle.trim() || (type === 'sheet' ? '새 스프레드시트' : type === 'slide' ? '새 프레젠테이션' : '새 문서');
    const fullTitle = rawTitle.endsWith(ext) ? rawTitle : `${rawTitle}${ext}`;

    setIsLoading(true);
    try {
      const realDoc = await createRealDriveDoc(fullTitle, type as any);
      if (realDoc) {
        const next = [realDoc, ...docs];
        storage.saveDriveDocuments(next);
        setDocs(next);
        setIsCreatingModal(false);
        setNewTitle('');
        showToast(`✓ "${fullTitle}"이(가) Google Drive에 실시간 생성되었습니다.`);
        onOpenDocEditor(realDoc.id, realDoc.title, realDoc.type);
      } else {
        // Fallback local document
        const newDoc: DriveDocument = {
          id: `doc_${Date.now()}`,
          title: fullTitle,
          type,
          content: '',
          ownerId: currentUser.id,
          ownerName: currentUser.name,
          updatedAt: '방금 전',
          size: '0 KB',
          permission: 'editor',
        };
        const next = [newDoc, ...docs];
        storage.saveDriveDocuments(next);
        setDocs(next);
        setIsCreatingModal(false);
        setNewTitle('');
        showToast(`✓ "${fullTitle}"이(가) 생성되었습니다.`);
        onOpenDocEditor(newDoc.id, newDoc.title, newDoc.type);
      }
    } catch {
      showToast('문서 생성 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  // Upload real file
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      const isSheet = file.name.endsWith('.csv') || file.name.endsWith('.xlsx') || file.name.endsWith('.gsheet');
      const isSlide = file.name.endsWith('.pptx') || file.name.endsWith('.gslides');
      const docType: DriveFileType = isSheet ? 'sheet' : isSlide ? 'slide' : 'doc';

      reader.onload = (event) => {
        const textContent = (event.target?.result as string) || '';
        const sizeKb = (file.size / 1024).toFixed(1);

        const uploadedDoc: DriveDocument = {
          id: `upload_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          title: file.name,
          type: docType,
          content: textContent,
          ownerId: currentUser.id,
          ownerName: currentUser.name,
          updatedAt: '방금 전',
          size: `${sizeKb} KB`,
          permission: 'editor',
        };

        setDocs((prev) => {
          const updated = [uploadedDoc, ...prev];
          storage.saveDriveDocuments(updated);
          return updated;
        });
        showToast(`✓ "${file.name}" 파일이 Google Drive에 추가되었습니다.`);
      };

      reader.readAsText(file);
    });

    e.target.value = '';
  };

  // Delete file with mandatory confirmation dialog
  const handleDeleteDoc = (docId: string, docTitle: string) => {
    setConfirmDialog({
      title: 'Google Drive 파일 삭제 확인',
      description: `"${docTitle}" 파일을 Google Drive에서 삭제하시겠습니까?`,
      onConfirm: async () => {
        setConfirmDialog(null);
        if (!docId.startsWith('doc_') && !docId.startsWith('upload_')) {
          await deleteRealDriveFile(docId);
        }
        const next = docs.filter((d) => d.id !== docId);
        storage.saveDriveDocuments(next);
        setDocs(next);
        showToast(`"${docTitle}"이(가) 드라이브에서 삭제되었습니다.`);
      },
    });
  };

  // Download locally
  const handleDownloadDoc = (doc: DriveDocument) => {
    const blob = new Blob([doc.content || ''], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = doc.title.endsWith('.gdoc') || doc.title.endsWith('.gsheet') ? `${doc.title}.txt` : doc.title;
    a.click();
    URL.revokeObjectURL(url);
    showToast(`"${doc.title}" 다운로드가 시작되었습니다.`);
  };

  const handleConnectGoogle = async () => {
    try {
      const result = await signInWithGoogleWorkspace();
      if (!result) {
        showToast(describeAuthError(getLastAuthErrorCode()));
        return;
      }
      await loadDriveFiles();
      showToast('✓ Google Drive 권한이 연결되었습니다.');
    } catch (e: any) {
      console.warn('OAuth connect failed', e);
      showToast(describeAuthError(String(e?.code || e?.message || '')));
    }
  };

  // Accurate classification helper functions
  const isDocType = (doc: DriveDocument) => {
    return (
      doc.type === 'doc' ||
      doc.title.endsWith('.gdoc') ||
      doc.title.endsWith('.docx') ||
      doc.title.endsWith('.doc') ||
      doc.title.endsWith('.txt') ||
      doc.title.endsWith('.md') ||
      (Boolean(doc.mimeType) && doc.mimeType!.includes('document'))
    );
  };

  const isSheetType = (doc: DriveDocument) => {
    return (
      doc.type === 'sheet' ||
      doc.title.endsWith('.gsheet') ||
      doc.title.endsWith('.xlsx') ||
      doc.title.endsWith('.xls') ||
      doc.title.endsWith('.csv') ||
      (Boolean(doc.mimeType) && doc.mimeType!.includes('spreadsheet'))
    );
  };

  const isSlideType = (doc: DriveDocument) => {
    return (
      doc.type === 'slide' ||
      doc.title.endsWith('.gslides') ||
      doc.title.endsWith('.pptx') ||
      doc.title.endsWith('.ppt') ||
      (Boolean(doc.mimeType) && doc.mimeType!.includes('presentation'))
    );
  };

  const filteredDocs = useMemo(() => {
    return docs.filter((doc) => {
      if (filterType === 'doc') return isDocType(doc);
      if (filterType === 'sheet') return isSheetType(doc);
      if (filterType === 'slide') return isSlideType(doc);
      return true;
    });
  }, [docs, filterType]);

  const docCount = useMemo(() => docs.filter(isDocType).length, [docs]);
  const sheetCount = useMemo(() => docs.filter(isSheetType).length, [docs]);
  const slideCount = useMemo(() => docs.filter(isSlideType).length, [docs]);

  return (
    <div className="flex-1 flex flex-col h-full bg-[#FAF7F0] text-[#2C2520] overflow-hidden select-none">
      {/* Toast */}
      {toastMessage && (
        <div className="bg-[#3E2723] text-white text-xs px-4 py-2 font-medium flex items-center justify-between z-30 shadow-md">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#C18C5D]" />
            <span>{toastMessage}</span>
          </div>
        </div>
      )}

      {/* Header Bar */}
      <header className="px-5 py-3.5 bg-[#FAF7F0] border-b border-[#E8E2D8] flex items-center justify-between gap-3 flex-wrap shrink-0">
        <div className="flex items-center gap-3">
          {onBackToChat && (
            <button
              onClick={onBackToChat}
              className="p-1.5 rounded-lg hover:bg-[#EFE9DF] text-[#7A6F66] hover:text-[#2C2520] transition-colors cursor-pointer"
              title="채팅으로 복귀"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#4285F4]/10 text-[#4285F4] flex items-center justify-center font-bold">
              <HardDrive className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-[#2C2520]">Google Drive 통합 탐색기</h2>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-semibold border border-emerald-200">
                  {hasToken ? '실시간 연동됨' : '로컬/클라우드'}
                </span>
              </div>
              <p className="text-[11px] text-[#7A6F66]">
                내 Google Drive의 문서, 시트, 슬라이드를 앱 내에서 즉시 열람 및 편집합니다.
              </p>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {hasToken === false && (
            <button
              onClick={handleConnectGoogle}
              className="px-3 py-1.5 bg-[#FBBC04]/15 border border-[#FBBC04]/40 hover:bg-[#FBBC04]/25 text-[#92400E] text-xs font-semibold rounded-lg transition-colors cursor-pointer"
            >
              Google Drive 권한 연결
            </button>
          )}
          <button
            onClick={() => setIsCreatingModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#3E2723] hover:bg-[#2C2520] text-white rounded-lg text-xs font-medium shadow-sm transition-colors cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            <span>새 문서 작성</span>
          </button>

          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            multiple
            className="hidden"
            accept=".txt,.md,.csv,.xlsx,.docx,.gdoc,.gsheet,.gslides"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-[#E8E2D8] hover:bg-[#EFE9DF] text-[#3E2723] rounded-lg text-xs font-medium transition-colors cursor-pointer whitespace-nowrap"
          >
            <Upload className="w-4 h-4" />
            <span>파일 업로드</span>
          </button>

          <button
            onClick={loadDriveFiles}
            disabled={isLoading}
            className="p-1.5 rounded-lg hover:bg-[#EFE9DF] text-[#7A6F66] hover:text-[#2C2520] transition-colors"
            title="새로고침"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </header>

      {/* Filter and Search Bar */}
      <div className="px-5 py-2.5 bg-[#FDFBF7] border-b border-[#E8E2D8] flex items-center justify-between gap-3 flex-wrap">
        {/* Filter Tabs */}
        <div className="flex items-center gap-1 text-xs font-medium">
          <button
            onClick={() => setFilterType('all')}
            className={`px-3 py-1 rounded-xl transition-all cursor-pointer font-semibold ${
              filterType === 'all' ? 'bg-[#3E2723] text-white shadow-xs' : 'text-[#7A6F66] hover:bg-[#EFE9DF]'
            }`}
          >
            전체 ({docs.length})
          </button>
          <button
            onClick={() => setFilterType('doc')}
            className={`px-3 py-1 rounded-xl transition-all cursor-pointer flex items-center gap-1 font-semibold ${
              filterType === 'doc' ? 'bg-[#3E2723] text-white shadow-xs' : 'text-[#7A6F66] hover:bg-[#EFE9DF]'
            }`}
          >
            <FileText className="w-3.5 h-3.5 text-[#4285F4]" />
            <span>문서 ({docCount})</span>
          </button>
          <button
            onClick={() => setFilterType('sheet')}
            className={`px-3 py-1 rounded-xl transition-all cursor-pointer flex items-center gap-1 font-semibold ${
              filterType === 'sheet' ? 'bg-[#3E2723] text-white shadow-xs' : 'text-[#7A6F66] hover:bg-[#EFE9DF]'
            }`}
          >
            <Table className="w-3.5 h-3.5 text-[#0F9D58]" />
            <span>시트 ({sheetCount})</span>
          </button>
          <button
            onClick={() => setFilterType('slide')}
            className={`px-3 py-1 rounded-xl transition-all cursor-pointer flex items-center gap-1 font-semibold ${
              filterType === 'slide' ? 'bg-[#3E2723] text-white shadow-xs' : 'text-[#7A6F66] hover:bg-[#EFE9DF]'
            }`}
          >
            <Presentation className="w-3.5 h-3.5 text-[#F4B400]" />
            <span>슬라이드 ({slideCount})</span>
          </button>
        </div>

        {/* Search */}
        <form onSubmit={handleSearchSubmit} className="relative flex items-center">
          <Search className="w-4 h-4 absolute left-3 text-[#A89F91]" />
          <input
            type="text"
            placeholder="드라이브 파일 검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 pr-3 py-1.5 text-xs bg-white border border-[#E8E2D8] rounded-xl text-[#2C2520] placeholder-[#A89F91] focus:outline-none focus:border-[#8D5B4C] w-48 sm:w-64"
          />
        </form>
      </div>

      {/* Document Grid / List */}
      <div className="flex-1 overflow-y-auto p-5">
        {isLoading ? (
          <div className="h-64 flex flex-col items-center justify-center text-xs text-[#7A6F66]">
            <RefreshCw className="w-6 h-6 animate-spin text-[#8D5B4C] mb-2" />
            <span>Google Drive 파일을 동기화하는 중...</span>
          </div>
        ) : filteredDocs.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-center p-6 bg-white border border-[#E8E2D8] rounded-2xl">
            <HardDrive className="w-12 h-12 stroke-[1.2] text-[#D6CFC4] mb-3" />
            <h3 className="text-sm font-semibold text-[#2C2520] mb-1">선택한 분류에 해당하는 문서가 없습니다</h3>
            <p className="text-xs text-[#7A6F66] max-w-sm mb-4">
              상단의 '새 문서 작성' 버튼을 눌러 새 Google 문서, 스프레드시트 또는 프레젠테이션을 생성해 보세요!
            </p>
            <button
              onClick={() => setIsCreatingModal(true)}
              className="px-4 py-2 bg-[#3E2723] text-white text-xs font-medium rounded-xl hover:bg-[#2C2520] transition-colors cursor-pointer"
            >
              새 문서 만들기
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredDocs.map((doc: DriveDocument) => {
              const isDoc = isDocType(doc);
              const isSheet = isSheetType(doc);
              const isSlide = isSlideType(doc);

              return (
                <div
                  key={doc.id}
                  onClick={() => onOpenDocEditor(doc.id, doc.title, doc.type)}
                  className="bg-white border border-[#E8E2D8] hover:border-[#C18C5D]/60 rounded-2xl p-4.5 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-250 ease-out flex flex-col justify-between group cursor-pointer relative"
                  title="클릭하여 워크스페이스 에디터에서 열기"
                >
                  <div>
                    {/* Icon & Menu */}
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="p-2.5 rounded-xl bg-[#FAF7F0] border border-[#E8E2D8] group-hover:scale-105 transition-transform duration-200">
                        {isDoc ? (
                          <FileText className="w-5 h-5 text-[#4285F4]" />
                        ) : isSheet ? (
                          <Table className="w-5 h-5 text-[#0F9D58]" />
                        ) : isSlide ? (
                          <Presentation className="w-5 h-5 text-[#F4B400]" />
                        ) : (
                          <File className="w-5 h-5 text-[#7A6F66]" />
                        )}
                      </div>
                      <div className="flex items-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                        {onShareDocToChat && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onShareDocToChat(doc);
                            }}
                            className="p-1.5 rounded-lg hover:bg-[#EFE9DF] text-[#7A6F66] hover:text-[#2C2520] transition-colors"
                            title="채팅방에 공유"
                          >
                            <Share2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDownloadDoc(doc);
                          }}
                          className="p-1.5 rounded-lg hover:bg-[#EFE9DF] text-[#7A6F66] hover:text-[#2C2520] transition-colors"
                          title="다운로드"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteDoc(doc.id, doc.title);
                          }}
                          className="p-1.5 rounded-lg hover:bg-red-50 text-[#7A6F66] hover:text-red-600 transition-colors"
                          title="삭제"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Title */}
                    <h4 className="text-xs font-bold text-[#2C2520] group-hover:text-[#8D5B4C] transition-colors line-clamp-2 mb-1.5" title={doc.title}>
                      {doc.title}
                    </h4>

                    {/* Metadata */}
                    <div className="flex items-center gap-1.5 text-[11px] text-[#7A6F66] mb-3">
                      <span>{doc.size}</span>
                      <span>·</span>
                      <span className="tabular-nums">{doc.updatedAt}</span>
                    </div>
                  </div>

                  {/* Open in Editor button */}
                  <div className="pt-2.5 border-t border-[#F0EBE1] flex items-center justify-between">
                    <span className="text-[10px] text-[#A89F91] truncate max-w-[120px]">
                      {doc.ownerName}
                    </span>
                    <span className="flex items-center gap-1 text-[11px] font-semibold text-[#8D5B4C] group-hover:underline">
                      <Edit3 className="w-3 h-3" />
                      <span>열기 & 편집</span>
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create Document Modal */}
      {isCreatingModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl border border-[#E8E2D8] p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-[#2C2520] flex items-center gap-2">
                <Plus className="w-4 h-4 text-[#C18C5D]" />
                새 Google 문서 생성
              </h3>
              <button
                onClick={() => setIsCreatingModal(false)}
                className="p-1 rounded-lg hover:bg-[#EFE9DF] text-[#7A6F66]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 mb-5">
              <div>
                <label className="block text-xs font-medium text-[#5A5048] mb-1">문서 종류</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setNewType('doc')}
                    className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer flex flex-col items-center gap-1 ${
                      newType === 'doc'
                        ? 'border-[#4285F4] bg-[#4285F4]/10 text-[#4285F4] font-bold'
                        : 'border-[#E8E2D8] hover:bg-[#FAF7F0] text-[#7A6F66]'
                    }`}
                  >
                    <FileText className="w-4 h-4" />
                    <span className="text-[11px]">Docs</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewType('sheet')}
                    className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer flex flex-col items-center gap-1 ${
                      newType === 'sheet'
                        ? 'border-[#0F9D58] bg-[#0F9D58]/10 text-[#0F9D58] font-bold'
                        : 'border-[#E8E2D8] hover:bg-[#FAF7F0] text-[#7A6F66]'
                    }`}
                  >
                    <Table className="w-4 h-4" />
                    <span className="text-[11px]">Sheets</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewType('slide')}
                    className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer flex flex-col items-center gap-1 ${
                      newType === 'slide'
                        ? 'border-[#F4B400] bg-[#F4B400]/10 text-[#B45309] font-bold'
                        : 'border-[#E8E2D8] hover:bg-[#FAF7F0] text-[#7A6F66]'
                    }`}
                  >
                    <Presentation className="w-4 h-4" />
                    <span className="text-[11px]">Slides</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#5A5048] mb-1">파일 이름</label>
                <input
                  type="text"
                  placeholder="예: 프로젝트 기획서"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-[#E8E2D8] rounded-lg text-[#2C2520] focus:outline-none focus:border-[#8D5B4C]"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsCreatingModal(false)}
                className="px-3 py-1.5 text-xs text-[#7A6F66] hover:bg-[#EFE9DF] rounded-lg cursor-pointer"
              >
                취소
              </button>
              <button
                type="button"
                onClick={() => handleCreateDocument(newType)}
                className="px-4 py-1.5 bg-[#3E2723] hover:bg-[#2C2520] text-white rounded-lg text-xs font-medium cursor-pointer"
              >
                생성 후 편집 시작
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Dialog for Destructive Actions */}
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
                삭제 확인
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
