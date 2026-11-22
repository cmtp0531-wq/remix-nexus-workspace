import React, { useState, useEffect } from 'react';
import {
  Youtube,
  Search,
  Play,
  Share2,
  Sparkles,
  Music,
  Video,
  Flame,
  Check,
  RefreshCw,
  ArrowLeft,
  ExternalLink
} from 'lucide-react';
import { searchYouTubeVideos, YouTubeVideoItem } from '../services/geminiService';

interface YouTubeInPageViewProps {
  onShareToChat?: (videoUrl: string, title: string, videoId: string) => void;
  onBackToChat?: () => void;
}

const CATEGORY_TAGS = [
  'Google Workspace',
  '코딩 BGM',
  '업무 생산성',
  'Lo-Fi 음악',
  '카페 ASMR',
  '테크 뉴스',
];

export const YouTubeInPageView: React.FC<YouTubeInPageViewProps> = ({
  onShareToChat,
  onBackToChat,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [inputUrl, setInputUrl] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<YouTubeVideoItem[]>([]);
  const [activeVideoId, setActiveVideoId] = useState<string>('jfKfPfyJRdk');
  const [activeVideoTitle, setActiveVideoTitle] = useState('lofi hip hop radio - beats to relax/study to');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Universal Extract YouTube ID helper (supports shorts, live, standard, mobile, embed)
  const extractVideoId = (url: string): string | null => {
    if (!url) return null;
    const clean = url.trim();
    if (/^[a-zA-Z0-9_-]{11}$/.test(clean)) return clean;
    const patterns = [
      /(?:youtu\.be\/|v\/|embed\/|shorts\/|live\/)([a-zA-Z0-9_-]{11})/i,
      /(?:youtube\.com|m\.youtube\.com)\/(?:watch\?.*v=|embed\/|v\/|shorts\/|live\/)([a-zA-Z0-9_-]{11})/i,
      /[?&]v=([a-zA-Z0-9_-]{11})/i,
    ];
    for (const regex of patterns) {
      const match = clean.match(regex);
      if (match && match[1] && match[1].length === 11) {
        return match[1];
      }
    }
    return null;
  };

  const handleSearch = async (queryText: string) => {
    const q = queryText.trim();
    if (!q) return;

    setIsSearching(true);
    try {
      const results = await searchYouTubeVideos(q);
      setSearchResults(results);
      if (results.length > 0) {
        setActiveVideoId(results[0].id);
        setActiveVideoTitle(results[0].title);
      }
    } catch (e) {
      console.warn('YouTube search error:', e);
    } finally {
      setIsSearching(false);
    }
  };

  useEffect(() => {
    handleSearch('Google Workspace');
  }, []);

  const handlePlayDirectUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    const queryOrUrl = inputUrl.trim();
    if (!queryOrUrl) return;

    const id = extractVideoId(queryOrUrl);
    if (id) {
      setActiveVideoId(id);
      setActiveVideoTitle('사용자 입력 YouTube 영상');
      setInputUrl('');
      // Try fetching accurate oEmbed title
      try {
        const oembedRes = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${id}&format=json`);
        if (oembedRes.ok) {
          const oembedData = await oembedRes.json();
          if (oembedData.title) {
            setActiveVideoTitle(oembedData.title);
          }
        }
      } catch {
        // keep fallback title
      }
    } else {
      // It is a search keyword!
      setSearchQuery(queryOrUrl);
      handleSearch(queryOrUrl);
      setInputUrl('');
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#FDFBF7] text-[#2C2520] overflow-hidden select-none">
      {/* Header */}
      <header className="px-4 py-3 bg-[#FAF7F2] border-b border-[#EBE5DA] flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          {onBackToChat && (
            <button
              onClick={onBackToChat}
              className="p-1.5 rounded-xl hover:bg-[#EBE5DA] text-[#5C5046] transition-colors cursor-pointer"
              title="대화방으로 돌아가기"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-[#FEE2E2] text-[#DC2626] border border-[#FECACA] shadow-xs">
              <Youtube className="w-5 h-5 text-[#DC2626]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-bold text-[#2C2520]">YouTube 인앱 미디어 센터</h2>
                <span className="px-2 py-0.5 rounded-full bg-[#FEE2E2] text-[#DC2626] text-[10px] font-bold">
                  인앱 실시간 스트리밍
                </span>
              </div>
              <p className="text-[11px] text-[#7A6A5C]">
                외부 이동 없이 모든 YouTube 동영상 검색 및 인앱 재생 & 대화방 1클릭 공유
              </p>
            </div>
          </div>
        </div>

        {/* Search & Direct Link Input Form */}
        <form onSubmit={handlePlayDirectUrl} className="flex items-center gap-2 max-w-md w-full sm:w-auto">
          <input
            type="text"
            value={inputUrl}
            onChange={(e) => setInputUrl(e.target.value)}
            placeholder="영상 검색 또는 링크 입력 (예: 뉴진스, lofi, https://...)"
            className="flex-1 sm:w-72 pl-3 pr-3 py-1.5 bg-white border border-[#EBE5DA] rounded-xl text-xs text-[#2C2520] focus:outline-none focus:border-[#DC2626]"
          />
          <button
            type="submit"
            disabled={!inputUrl.trim() || isSearching}
            className="px-3.5 py-1.5 bg-[#DC2626] hover:bg-[#B91C1C] text-white text-xs font-bold rounded-xl shadow-xs transition-colors disabled:opacity-50 flex items-center gap-1 cursor-pointer"
          >
            {isSearching ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
            <span>검색</span>
          </button>
        </form>
      </header>

      {/* Main Content Layout (Left: Video Player / Right: Search & Feed) */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Left/Top: Responsive In-App Player */}
        <div className="w-full lg:w-3/5 p-4 sm:p-5 flex flex-col justify-between bg-black/95 text-white overflow-y-auto">
          <div>
            <div className="relative aspect-video w-full rounded-2xl overflow-hidden bg-black shadow-2xl border border-white/10">
              {activeVideoId ? (
                <iframe
                  title="YouTube in-app player"
                  src={`https://www.youtube.com/embed/${activeVideoId}?autoplay=0&rel=0&enablejsapi=1`}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  referrerPolicy="strict-origin-when-cross-origin"
                  allowFullScreen
                  className="w-full h-full border-none"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-white/50 text-sm">
                  재생할 동영상을 선택하세요
                </div>
              )}
            </div>

            {/* Video Details & Action Buttons */}
            <div className="mt-4 flex items-center justify-between gap-3 flex-wrap">
              <div className="min-w-0 flex-1">
                <h3 className="text-sm sm:text-base font-bold text-white line-clamp-1">{activeVideoTitle}</h3>
                <p className="text-xs text-white/60 mt-0.5 font-mono">동영상 ID: {activeVideoId}</p>
              </div>

              <div className="flex items-center gap-2">
                {/* Watch in New Tab Button */}
                <a
                  href={`https://www.youtube.com/watch?v=${activeVideoId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold border border-white/15 transition-colors cursor-pointer"
                  title="YouTube 원본 페이지에서 보기"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>새 탭에서 열기</span>
                </a>

                {/* Share to Chat button */}
                {onShareToChat && (
                  <button
                    type="button"
                    onClick={() => onShareToChat(`https://www.youtube.com/watch?v=${activeVideoId}`, activeVideoTitle, activeVideoId)}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#DC2626] hover:bg-[#B91C1C] text-white text-xs font-bold shadow-lg transition-colors cursor-pointer"
                  >
                    <Share2 className="w-4 h-4" />
                    <span>대화방 공유</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-white/10 text-xs text-white/50 flex items-center justify-between">
            <span>✨ 인앱 플레이어로 백그라운드 끊김 없이 시청 가능합니다.</span>
            <span className="font-mono text-[10px]">YouTube Connected</span>
          </div>
        </div>

        {/* Right/Bottom: Real Search & Video Catalog */}
        <div className="w-full lg:w-2/5 border-t lg:border-t-0 lg:border-l border-[#EBE5DA] bg-[#FDFBF7] flex flex-col h-full overflow-hidden">
          {/* Search bar & Tag Pills */}
          <div className="p-3.5 bg-white border-b border-[#EBE5DA] space-y-2.5">
            <div className="relative flex items-center">
              <Search className="w-4 h-4 text-[#A89A8E] absolute left-3 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleSearch(searchQuery);
                  }
                }}
                placeholder="YouTube 전체 검색 (원하는 검색어 입력)"
                className="w-full pl-9 pr-16 py-2 bg-[#FDFBF7] border border-[#EBE5DA] rounded-xl text-xs text-[#2C2520] focus:outline-none focus:border-[#DC2626]"
              />
              <button
                type="button"
                onClick={() => handleSearch(searchQuery)}
                disabled={isSearching || !searchQuery.trim()}
                className="absolute right-1.5 px-3 py-1 bg-[#DC2626] hover:bg-[#B91C1C] text-white text-xs font-bold rounded-lg disabled:opacity-50 transition-colors cursor-pointer"
              >
                {isSearching ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : '검색'}
              </button>
            </div>

            {/* Category Quick Tags */}
            <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-0.5">
              {CATEGORY_TAGS.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => {
                    setSearchQuery(tag);
                    handleSearch(tag);
                  }}
                  className="px-2.5 py-1 rounded-lg bg-[#FAF7F2] hover:bg-[#F4EFE6] text-[11px] font-semibold text-[#5C5046] border border-[#EBE5DA] whitespace-nowrap transition-colors cursor-pointer"
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>

          {/* Search Results List */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            <div className="text-[11px] font-bold text-[#7A6A5C] px-1">동영상 검색 결과:</div>
            {searchResults.map((item) => {
              const isPlaying = activeVideoId === item.id;
              return (
                <div
                  key={item.id}
                  onClick={() => {
                    setActiveVideoId(item.id);
                    setActiveVideoTitle(item.title);
                  }}
                  className={`p-2.5 rounded-2xl border transition-all cursor-pointer flex gap-3 items-center group ${
                    isPlaying
                      ? 'bg-[#FEE2E2] border-[#FECACA] shadow-xs'
                      : 'bg-white border-[#EBE5DA] hover:bg-[#FAF7F2]'
                  }`}
                >
                  {/* Thumbnail / Play Preview */}
                  <div className="relative w-24 h-16 rounded-xl overflow-hidden bg-black flex-shrink-0 border border-[#EBE5DA]">
                    <img
                      src={`https://img.youtube.com/vi/${item.id}/mqdefault.jpg`}
                      alt={item.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    />
                    <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <Play className="w-5 h-5 text-white fill-white" />
                    </div>
                    {item.duration && (
                      <span className="absolute bottom-1 right-1 bg-black/80 text-white text-[9px] px-1 rounded font-mono">
                        {item.duration}
                      </span>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <h4 className="text-xs font-bold text-[#2C2520] truncate group-hover:text-[#DC2626]">
                      {item.title}
                    </h4>
                    <p className="text-[11px] text-[#7A6A5C] mt-0.5 truncate">{item.channel}</p>
                    <div className="flex items-center gap-2 mt-1">
                      {isPlaying && (
                        <span className="px-1.5 py-0.5 rounded bg-[#DC2626] text-white text-[9px] font-bold">
                          현재 재생 중
                        </span>
                      )}
                      <span className="text-[10px] text-[#A89A8E]">{item.category || '비디오'}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
