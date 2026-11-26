import React, { useEffect, useMemo, useState } from 'react';
import {
  X,
  Sparkles,
  KeyRound,
  Link2,
  Database,
  Check,
  AlertCircle,
  ExternalLink,
  LogIn,
  LogOut,
  Trash2,
  Download,
  Upload,
  ShieldCheck,
  Palette,
  Bell,
  BellOff,
} from 'lucide-react';
import { ThemeSettings } from './ThemeSettings';
import { User } from '../types';
import {
  FirebaseAppConfig,
  getGeminiApiKey,
  getStoredFirebaseConfig,
  isFirebaseConfigured,
  maskSecret,
  onSettingsChanged,
  parseFirebaseConfigText,
  saveGeminiApiKey,
  saveStoredFirebaseConfig,
} from '../services/appConfig';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User;
  isGuest: boolean;
  authLoading: boolean;
  authError: string;
  onGoogleSignIn: () => void;
  onSignOut: () => void;
  /** 시스템 알림 수신 설정 (설정 모달 안에서만 바꿉니다) */
  notificationsEnabled?: boolean;
  onToggleNotifications?: () => void;
}

type TabKey = 'ai' | 'notifications' | 'theme' | 'google' | 'data';

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  isGuest,
  authLoading,
  authError,
  onGoogleSignIn,
  onSignOut,
  notificationsEnabled = true,
  onToggleNotifications,
}) => {
  const [tab, setTab] = useState<TabKey>('ai');

  // Gemini
  const [geminiKey, setGeminiKey] = useState('');
  const [geminiSaved, setGeminiSaved] = useState(false);

  // Firebase
  const [firebaseText, setFirebaseText] = useState('');
  const [firebaseError, setFirebaseError] = useState('');
  const [firebaseSaved, setFirebaseSaved] = useState(false);
  const [storedConfig, setStoredConfig] = useState<FirebaseAppConfig | null>(() => getStoredFirebaseConfig());

  // 데이터
  const [dataMessage, setDataMessage] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setGeminiKey(getGeminiApiKey());
    setStoredConfig(getStoredFirebaseConfig());
    setGeminiSaved(false);
    setFirebaseSaved(false);
    setFirebaseError('');
    setDataMessage('');
  }, [isOpen]);

  useEffect(() => onSettingsChanged(() => setStoredConfig(getStoredFirebaseConfig())), []);

  const firebaseConfigured = useMemo(() => isFirebaseConfigured(), [storedConfig, isOpen]);

  if (!isOpen) return null;

  const handleSaveGeminiKey = () => {
    saveGeminiApiKey(geminiKey);
    setGeminiSaved(true);
    setTimeout(() => setGeminiSaved(false), 2200);
  };

  const handleSaveFirebase = () => {
    const parsed = parseFirebaseConfigText(firebaseText);
    if (!parsed) {
      setFirebaseError('설정을 읽지 못했습니다. Firebase 콘솔의 firebaseConfig 값(JSON 또는 apiKey/projectId 가 포함된 코드)을 붙여넣어 주세요.');
      return;
    }
    setFirebaseError('');
    saveStoredFirebaseConfig(parsed);
    setStoredConfig(parsed);
    setFirebaseSaved(true);
    setTimeout(() => setFirebaseSaved(false), 2200);
  };

  const handleClearFirebase = () => {
    saveStoredFirebaseConfig(null);
    setStoredConfig(null);
    setFirebaseText('');
    setFirebaseError('');
  };

  const handleExportData = () => {
    try {
      const dump: Record<string, string | null> = {};
      for (let i = 0; i < localStorage.length; i += 1) {
        const key = localStorage.key(i);
        if (!key) continue;
        if (key.startsWith('workchat_') || key.startsWith('gchat_')) {
          dump[key] = localStorage.getItem(key);
        }
      }
      const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), data: dump }, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `workchat-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setDataMessage('✓ 이 기기의 데이터를 JSON 파일로 내려받았습니다.');
    } catch {
      setDataMessage('백업 파일을 만들지 못했습니다.');
    }
  };

  const handleImportData = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result || '{}'));
        const data: Record<string, string> = parsed?.data && typeof parsed.data === 'object' ? parsed.data : {};
        const keys = Object.keys(data).filter(
          (key) => (key.startsWith('workchat_') || key.startsWith('gchat_')) && typeof data[key] === 'string'
        );
        if (keys.length === 0) {
          setDataMessage('백업 파일에서 복원할 데이터를 찾지 못했습니다.');
          return;
        }
        const confirmed = window.confirm(
          `백업 파일에서 ${keys.length}개 항목을 복원할까요? 지금 이 브라우저의 같은 항목은 덮어써집니다.`
        );
        if (!confirmed) return;
        keys.forEach((key) => localStorage.setItem(key, data[key]));
        setDataMessage('✓ 백업을 복원했습니다. 새로고침하면 반영됩니다.');
      } catch {
        setDataMessage('백업 파일을 읽지 못했습니다. 올바른 WorkChat 백업 JSON인지 확인해 주세요.');
      }
    };
    reader.readAsText(file);
  };

  const handleResetData = () => {
    const confirmed = window.confirm(
      '이 브라우저에 저장된 워크챗 데이터(대화·문서·할 일)를 모두 지울까요? 되돌릴 수 없습니다.'
    );
    if (!confirmed) return;
    try {
      const keys: string[] = [];
      for (let i = 0; i < localStorage.length; i += 1) {
        const key = localStorage.key(i);
        if (key && (key.startsWith('workchat_') || key.startsWith('gchat_'))) keys.push(key);
      }
      keys.forEach((k) => localStorage.removeItem(k));
      setDataMessage('✓ 데이터를 초기화했습니다. 새로고침하면 빈 워크스페이스로 시작합니다.');
    } catch {
      setDataMessage('데이터를 초기화하지 못했습니다.');
    }
  };

  const TabButton: React.FC<{ tabKey: TabKey; icon: React.ReactNode; label: string }> = ({ tabKey, icon, label }) => (
    <button
      onClick={() => setTab(tabKey)}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer"
      style={
        tab === tabKey
          ? { background: 'var(--nx-primary)', color: 'var(--nx-on-primary)', boxShadow: '0 1px 2px rgba(0,0,0,0.12)' }
          : { background: 'var(--nx-surface-2)', color: 'var(--nx-text-muted)' }
      }
    >
      {icon}
      <span>{label}</span>
    </button>
  );

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-3 sm:p-6">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      <div
        className="relative w-full max-w-lg h-[min(620px,88vh)] overflow-hidden rounded-3xl shadow-2xl flex flex-col"
        style={{ background: 'var(--nx-bg)', border: '1px solid var(--nx-border)', color: 'var(--nx-text)' }}
      >
        <header
          className="flex items-center justify-between px-5 py-4"
          style={{ background: 'var(--nx-surface-2)', borderBottom: '1px solid var(--nx-border)' }}
        >
          <div>
            <h2 className="text-base font-bold" style={{ color: 'var(--nx-text-strong)' }}>설정</h2>
            <p className="text-[11px] mt-0.5" style={{ color: 'var(--nx-text-muted)' }}>
              {isGuest ? '게스트(로컬) 모드로 사용 중입니다' : `${currentUser.email || currentUser.name} 계정으로 연결됨`}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center cursor-pointer"
            style={{ background: 'color-mix(in srgb, var(--nx-text) 8%, transparent)', color: 'var(--nx-text-muted)' }}
            aria-label="설정 닫기"
          >
            <X className="w-4 h-4" />
          </button>
        </header>

        <div className="px-5 pt-4 pb-2 flex items-center gap-2 flex-wrap" style={{ background: 'var(--nx-bg)' }}>
          <TabButton tabKey="ai" key="ai" icon={<Sparkles className="w-3.5 h-3.5" />} label="AI" />
          <TabButton
            tabKey="notifications"
            key="notifications"
            icon={<Bell className="w-3.5 h-3.5" />}
            label="알림"
          />
          <TabButton tabKey="theme" key="theme" icon={<Palette className="w-3.5 h-3.5" />} label="테마·색상" />
          <TabButton tabKey="google" key="google" icon={<Link2 className="w-3.5 h-3.5" />} label="Google 연동" />
          <TabButton tabKey="data" key="data" icon={<Database className="w-3.5 h-3.5" />} label="데이터" />
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-4" style={{ color: 'var(--nx-text)' }}>
          {tab === 'notifications' && (
            <section className="space-y-3">
              <div className="rounded-2xl border border-[#EBE5DA] bg-white p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 font-bold text-sm text-[#3E2723]">
                    {notificationsEnabled ? (
                      <Bell className="w-4 h-4 text-[#137333]" />
                    ) : (
                      <BellOff className="w-4 h-4 text-[#A89A8E]" />
                    )}
                    시스템 알림
                  </div>
                  <button
                    type="button"
                    onClick={onToggleNotifications}
                    disabled={!onToggleNotifications}
                    role="switch"
                    aria-checked={notificationsEnabled}
                    data-testid="settings-notifications-toggle"
                    className={`relative w-11 h-6 rounded-full transition-all duration-300 cursor-pointer disabled:opacity-50 shrink-0 ${
                      notificationsEnabled ? 'bg-[#3E2723]' : 'bg-[#DCD3C5]'
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-300 ${
                        notificationsEnabled ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
                <p className="text-[12px] text-[#7A6A5C] leading-5 mt-2">
                  새 메시지·회의·친구 요청이 도착하면 브라우저 알림과 알림음을 보냅니다. 이 설정은 이 기기에만 적용됩니다.
                </p>
                <p className="text-[11px] text-[#A89A8E] leading-5 mt-1.5">
                  현재 상태: <strong className="text-[#3E2723]">{notificationsEnabled ? '알림 켜짐' : '알림 꺼짐'}</strong>
                </p>
              </div>
              <div className="rounded-2xl border border-[#EBE5DA] bg-white p-4">
                <div className="flex items-center gap-2 font-bold text-sm text-[#3E2723]">
                  <ShieldCheck className="w-4 h-4 text-[#8D5B4C]" />
                  브라우저 권한
                </div>
                <p className="text-[12px] text-[#7A6A5C] leading-5 mt-1.5">
                  알림을 처음 켤 때 브라우저가 권한을 요청합니다. 차단한 경우 주소창의 사이트 설정에서 알림을 허용해 주세요.
                </p>
                {typeof Notification !== 'undefined' && (
                  <p className="text-[11px] mt-2 text-[#A89A8E]">
                    권한 상태: <strong className="text-[#3E2723]">{Notification.permission === 'granted' ? '허용됨' : Notification.permission === 'denied' ? '차단됨' : '아직 묻지 않음'}</strong>
                  </p>
                )}
              </div>
            </section>
          )}
          {tab === 'theme' && <ThemeSettings />}
          {tab === 'ai' && (
            <section className="space-y-3">
              <div className="rounded-2xl border border-[#EBE5DA] bg-white p-4">
                <div className="flex items-center gap-2 font-bold text-sm">
                  <KeyRound className="w-4 h-4 text-[#8D5B4C]" />
                  Gemini API 키
                </div>
                <p className="text-[12px] text-[#7A6A5C] leading-5 mt-1.5">
                  키를 저장하면 브라우저에서 Gemini 를 직접 호출합니다. 키는 이 기기의 localStorage 에만 저장되고 외부로 전송되지 않습니다.
                </p>
                <input
                  type="password"
                  value={geminiKey}
                  onChange={(e) => setGeminiKey(e.target.value)}
                  placeholder="AIza... (Google AI Studio API 키)"
                  className="w-full mt-3 px-3 py-2 rounded-xl border border-[#E7E2D9] bg-[#FDFBF7] text-sm outline-none focus:border-[#8D5B4C]"
                />
                <div className="flex items-center gap-2 mt-2.5">
                  <button
                    onClick={handleSaveGeminiKey}
                    className="px-3 py-1.5 rounded-xl bg-[#3E2723] text-white text-xs font-bold hover:bg-[#2C2520] cursor-pointer"
                  >
                    저장
                  </button>
                  {geminiKey && (
                    <button
                      onClick={() => {
                        setGeminiKey('');
                        saveGeminiApiKey('');
                      }}
                      className="px-3 py-1.5 rounded-xl bg-[#F4EFE6] text-[#7A6A5C] text-xs font-bold hover:bg-[#EBE5DA] cursor-pointer"
                    >
                      키 삭제
                    </button>
                  )}
                  {geminiSaved && (
                    <span className="flex items-center gap-1 text-[11px] text-emerald-700 font-bold">
                      <Check className="w-3.5 h-3.5" /> 저장했습니다
                    </span>
                  )}
                </div>
                <a
                  href="https://aistudio.google.com/apikey"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 mt-3 text-[11px] font-semibold text-[#8D5B4C] hover:underline"
                >
                  API 키 발급 받으러 가기
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
              {!geminiKey && (
                <p className="flex items-start gap-1.5 text-[11px] text-[#A15C00] bg-[#FFF7EB] border border-[#FBD38D] rounded-xl px-3 py-2">
                  <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  키가 없으면 AI 패널은 안내 문구만 표시합니다. 채팅·문서·시트·슬라이드는 키 없이도 모두 사용할 수 있습니다.
                </p>
              )}
            </section>
          )}

          {tab === 'google' && (
            <section className="space-y-3">
              <div className="rounded-2xl border border-[#EBE5DA] bg-white p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-bold text-sm">
                    <LogIn className="w-4 h-4 text-[#1A73E8]" />
                    구글 계정 연결
                  </div>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      isGuest ? 'bg-[#F4EFE6] text-[#7A6A5C]' : 'bg-emerald-50 text-emerald-700'
                    }`}
                  >
                    {isGuest ? '게스트' : '연결됨'}
                  </span>
                </div>
                <p className="text-[12px] text-[#7A6A5C] leading-5 mt-1.5">
                  구글 로그인을 연결하면 Gmail·드라이브·독스·캘린더를 실제 계정으로 쓰고, 대화를 Firestore 에 동기화할 수 있습니다.
                  {isGuest && ' 연결 전에도 게스트 모드로 모든 편집 기능을 그대로 쓸 수 있습니다.'}
                </p>

                {authError && (
                  <div className="mt-2.5 flex items-start gap-1.5 text-[11px] text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
                    <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                    <span>{authError}</span>
                  </div>
                )}

                <div className="flex items-center gap-2 mt-3">
                  {isGuest ? (
                    <button
                      onClick={onGoogleSignIn}
                      disabled={authLoading || !firebaseConfigured}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#1A73E8] text-white text-xs font-bold hover:bg-[#1765CC] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                    >
                      <LogIn className="w-3.5 h-3.5" />
                      {authLoading ? '로그인 중…' : 'Google로 로그인'}
                    </button>
                  ) : (
                    <button
                      onClick={onSignOut}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#F4EFE6] text-[#7A6A5C] text-xs font-bold hover:bg-[#EBE5DA] cursor-pointer"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      로그아웃 (게스트로 전환)
                    </button>
                  )}
                </div>
                {!firebaseConfigured && (
                  <p className="mt-2 text-[11px] text-[#7A6A5C]">
                    아래에 본인 Firebase 설정을 먼저 입력하면 로그인 버튼이 활성화됩니다.
                  </p>
                )}
              </div>

              <div className="rounded-2xl border border-[#EBE5DA] bg-white p-4">
                <div className="flex items-center gap-2 font-bold text-sm">
                  <ShieldCheck className="w-4 h-4 text-[#8D5B4C]" />
                  내 Firebase 설정 (선택)
                </div>
                <p className="text-[12px] text-[#7A6A5C] leading-5 mt-1.5">
                  Firebase 콘솔 → 프로젝트 설정 → 내 앱의 <span className="font-mono text-[11px]">firebaseConfig</span> 값을 그대로 붙여넣으세요.
                  Authentication 에서 Google 로그인을 켜고, 승인된 도메인에 이 사이트 주소를 추가해야 합니다.
                </p>

                {storedConfig && (
                  <div className="mt-2.5 rounded-xl bg-[#F7F5F0] border border-[#EBE5DA] px-3 py-2 text-[11px] text-[#5C5046] space-y-0.5">
                    <div>프로젝트: <span className="font-mono">{storedConfig.projectId}</span></div>
                    <div>API 키: <span className="font-mono">{maskSecret(storedConfig.apiKey)}</span></div>
                  </div>
                )}

                <textarea
                  value={firebaseText}
                  onChange={(e) => setFirebaseText(e.target.value)}
                  rows={5}
                  placeholder={'{\n  "apiKey": "AIza...",\n  "authDomain": "my-app.firebaseapp.com",\n  "projectId": "my-app",\n  "appId": "1:1234:web:abcd"\n}'}
                  className="w-full mt-3 px-3 py-2 rounded-xl border border-[#E7E2D9] bg-[#FDFBF7] text-[11px] font-mono outline-none focus:border-[#8D5B4C]"
                />
                {firebaseError && (
                  <p className="mt-1.5 text-[11px] text-red-600 flex items-start gap-1">
                    <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                    {firebaseError}
                  </p>
                )}
                <div className="flex items-center gap-2 mt-2.5">
                  <button
                    onClick={handleSaveFirebase}
                    className="px-3 py-1.5 rounded-xl bg-[#3E2723] text-white text-xs font-bold hover:bg-[#2C2520] cursor-pointer"
                  >
                    설정 저장
                  </button>
                  {firebaseConfigured && (
                    <button
                      onClick={handleClearFirebase}
                      className="px-3 py-1.5 rounded-xl bg-[#F4EFE6] text-[#7A6A5C] text-xs font-bold hover:bg-[#EBE5DA] cursor-pointer"
                    >
                      연결 해제
                    </button>
                  )}
                  {firebaseSaved && (
                    <span className="text-[11px] text-[#A15C00] font-bold flex items-center gap-2">
                      저장했습니다.
                      <button
                        onClick={() => window.location.reload()}
                        className="px-2 py-0.5 rounded-lg bg-[#FFF7EB] border border-[#FBD38D] text-[#A15C00] font-bold cursor-pointer"
                      >
                        지금 적용(새로고침)
                      </button>
                    </span>
                  )}
                </div>
              </div>
            </section>
          )}

          {tab === 'data' && (
            <section className="space-y-3">
              <div className="rounded-2xl border border-[#EBE5DA] bg-white p-4">
                <div className="flex items-center gap-2 font-bold text-sm">
                  <Database className="w-4 h-4 text-[#8D5B4C]" />
                  이 기기에 저장된 데이터
                </div>
                <p className="text-[12px] text-[#7A6A5C] leading-5 mt-1.5">
                  대화, 문서·시트·슬라이드 내용, 할 일, AI 대화는 이 브라우저(localStorage)에 자동 저장되어 새로고침해도 남습니다.
                </p>
                <div className="flex items-center gap-2 mt-3 flex-wrap">
                  <button
                    onClick={handleExportData}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#F4EFE6] text-[#3E2723] text-xs font-bold hover:bg-[#EBE5DA] cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    백업 파일 내려받기
                  </button>
                  <button
                    onClick={handleResetData}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-red-600 bg-red-50 border border-red-100 text-xs font-bold hover:bg-red-100 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    로컬 데이터 초기화
                  </button>
                </div>
                {dataMessage && <p className="mt-2 text-[11px] text-[#5C5046]">{dataMessage}</p>}
              </div>

              <div className="rounded-2xl border border-[#EBE5DA] bg-white p-4">
                <div className="flex items-center gap-2 font-bold text-sm">
                  <Upload className="w-4 h-4 text-[#8D5B4C]" />
                  백업 파일 불러오기
                </div>
                <p className="text-[12px] text-[#7A6A5C] leading-5 mt-1.5">
                  내려받아 둔 JSON 백업 파일을 선택하면 대화·문서·할 일이 이 브라우저로 복원됩니다.
                </p>
                <label className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#F4EFE6] text-[#3E2723] text-xs font-bold hover:bg-[#EBE5DA] cursor-pointer">
                  <Upload className="w-3.5 h-3.5" />
                  백업 파일 선택
                  <input
                    type="file"
                    accept="application/json,.json"
                    className="hidden"
                    onChange={handleImportData}
                  />
                </label>
              </div>
            </section>
          )}
        </div>

        <footer className="px-5 py-3 border-t border-[#EBE5DA] bg-white/70 flex items-center justify-between">
          <span className="text-[10px] text-[#A89A8E]">WorkChat · 설정은 이 브라우저에만 저장됩니다</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-[#3E2723] text-white text-xs font-bold hover:bg-[#2C2520] cursor-pointer"
          >
            닫기
          </button>
        </footer>
      </div>
    </div>
  );
};
