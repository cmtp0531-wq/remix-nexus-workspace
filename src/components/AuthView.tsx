import React from 'react';
import { MessageCircle, ShieldCheck, LoaderCircle } from 'lucide-react';

interface AuthViewProps {
  onGoogleSignIn: () => void;
  loading?: boolean;
  error?: string;
}

export const AuthView: React.FC<AuthViewProps> = ({ onGoogleSignIn, loading = false, error = '' }) => (
  <main className="min-h-screen w-screen flex items-center justify-center p-5 bg-[#F7F5F0] text-[#292524]">
    <section className="w-full max-w-sm rounded-3xl bg-white border border-[#E7E2D9] p-7 sm:p-9 shadow-xl">
      <div className="w-14 h-14 rounded-2xl bg-[#3E2723] text-white flex items-center justify-center mx-auto mb-5">
        <MessageCircle className="w-7 h-7" />
      </div>
      <h1 className="text-2xl font-bold text-center tracking-tight">WorkChat</h1>
      <p className="text-sm text-center text-[#78716C] mt-2 leading-6">
        Google 계정으로 로그인하고 대화를 시작하세요.
      </p>

      {error && (
        <div role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700 leading-5">
          {error}
        </div>
      )}

      <button
        type="button"
        onClick={onGoogleSignIn}
        disabled={loading}
        className="mt-7 w-full min-h-12 rounded-xl border border-[#D6D3D1] bg-white hover:bg-[#FAFAF9] disabled:opacity-60 text-sm font-semibold flex items-center justify-center gap-3 transition-colors cursor-pointer"
      >
        {loading ? <LoaderCircle className="w-5 h-5 animate-spin" /> : (
          <svg aria-hidden="true" viewBox="0 0 48 48" className="w-5 h-5">
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.01 13.22l7.98 6.19C11.94 13.72 17.45 9.5 24 9.5Z" />
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.74 7.18l7.65 5.94c4.46-4.12 7.13-10.2 7.13-17.59Z" />
            <path fill="#FBBC05" d="M9.99 28.59A14.4 14.4 0 0 1 9.22 24c0-1.59.27-3.13.76-4.59l-7.98-6.19A23.9 23.9 0 0 0 0 24c0 3.87.93 7.53 2.58 10.78l7.41-6.19Z" />
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.9-5.86l-7.65-5.94c-2.13 1.43-4.85 2.28-8.25 2.28-6.55 0-12.06-4.22-14.01-10.09l-7.98 6.19C6.51 42.62 14.62 48 24 48Z" />
          </svg>
        )}
        {loading ? 'Google 로그인 중…' : 'Google 계정으로 계속하기'}
      </button>

      <p className="mt-5 text-xs text-center text-[#78716C] leading-5">
        <ShieldCheck className="inline w-3.5 h-3.5 mr-1 -mt-0.5" />
        비밀번호를 별도로 저장하지 않습니다. Google 인증을 사용합니다.
      </p>
      <p className="mt-4 text-[11px] text-center text-[#A8A29E] leading-5">
        처음 로그인할 때 Google 인증 창이 열립니다. 로그인 오류가 나면 Firebase에서 Google 로그인 제공자를 활성화해야 합니다.
      </p>
    </section>
  </main>
);
