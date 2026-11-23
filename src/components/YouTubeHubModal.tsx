import React, { useState, useEffect } from 'react';
import {
  Youtube,
  Search,
  X,
  Play,
  ExternalLink,
  Share2,
  Sparkles,
  Music,
  Video,
  Flame,
  Check,
  RefreshCw
} from 'lucide-react';
import {
  fetchYouTubeTrending,
  searchYouTubeVideosDetailed,
  YouTubeVideoItem,
} from '../services/geminiService';

interface YouTubeHubModalProps {
  isOpen: boolean;
  onClose: () => void;
  onShareToChat: (videoUrl: string, title: string, videoId: string) => void;
}

export const YouTubeHubModal: React.FC<YouTubeHubModalProps> = ({
  isOpen,
  onClose,
  onShareToChat,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [inputUrl, setInputUrl] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<YouTubeVideoItem[]>([]);
  const [activeVideoId, setActiveVideoId] = useState<string | null>(null);
  const [activeVideoTitle, setActiveVideoTitle] = useState('');
  const [searchError, setSearchError] = useState('');
  const [searchSource, setSearchSource] = useState<'google' | 'piped' | 'invidious' | 'trending' | 'none'>('none');

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

  // 열 때 인기/추천 영상을 자동으로 불러오지 않습니다. 검색하기 전에는 빈 안내만 표시됩니다.

  const handleSearch = async (queryText: string) => {
    setIsSearching(true);
    setSearchError('');
    try {
      const result = await searchYouTubeVideosDetailed(queryText);
      setSearchResults(result.items);
      setSearchSource(result.source);
      if (result.items.length === 0) {
        setSearchError(result.error || '검색 결과가 없습니다. 다른 검색어로 시도해 주세요.');
      } else if (!activeVideoId) {
        setActiveVideoId(result.items[0].id);
        setActiveVideoTitle(result.items[0].title);
      }
    } catch (e) {
      console.warn('Search failed', e);
      setSearchError('검색 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.');
    } finally {
      setIsSearching(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    handleSearch(searchQuery.trim());
  };

  const handleSelectVideo = (video: YouTubeVideoItem) => {
    setActiveVideoId(video.id);
    setActiveVideoTitle(video.title);
    setInputUrl(`https://www.youtube.com/watch?v=${video.id}`);
  };

  const handleUrlInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputUrl(val);
    const parsedId = extractVideoId(val);
    if (parsedId) {
      setActiveVideoId(parsedId);
      setActiveVideoTitle('사용자 입력 YouTube 영상');
      try {
        const oembedRes = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${parsedId}&format=json`);
        if (oembedRes.ok) {
          const oembedData = await oembedRes.json();
          if (oembedData.title) {
            setActiveVideoTitle(oembedData.title);
          }
        }
      } catch {
        // keep fallback
      }
    }
  };

  const handleShareCurrent = () => {
    if (!activeVideoId) return;
    const shareUrl = inputUrl.trim() || `https://www.youtube.com/watch?v=${activeVideoId}`;
    onShareToChat(shareUrl, activeVideoTitle, activeVideoId);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/60 backdrop-blur-xs select-none animate-in fade-in duration-150">
      <div className="w-full max-w-3xl bg-white border border-[#EBE5DA] rounded-2xl cafe-shadow-lg flex flex-col max-h-[92vh] overflow-hidden text-[#2C2520]">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-[#EBE5DA] bg-[#FAF7F2] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-[#DC2626] text-white shadow-xs">
              <Youtube className="w-5 h-5 fill-current" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#2C2520] flex items-center gap-1.5">
                <span>YouTube 실시간 검색 &amp; 인앱 플레이어</span>
                <span className="px-2 py-0.5 rounded-full bg-[#FEE2E2] text-[#DC2626] text-[10px] font-bold">
                  모든 영상 지원
                </span>
              </h3>
              <p className="text-[11px] text-[#7A6A5C]">
                원하는 어떤 유튜브 영상이든 검색하거나 링크를 붙여넣어 채팅방에 공유하고 바로 시청하세요
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-[#7A6A5C] hover:bg-[#F4EFE6] rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search & URL Input Bar */}
        <div className="p-4 border-b border-[#EBE5DA] bg-white space-y-3">
          {/* 1. Global Search Form */}
          <form onSubmit={handleSearchSubmit} className="flex gap-2">
            <div className="flex-1 relative flex items-center">
              <Search className="w-4 h-4 text-[#A89A8E] absolute left-3 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="유튜브에서 검색 (예: 뉴진스, 코딩 강좌, 로파이, Google 팁, TED 등)..."
                className="w-full pl-9 pr-3 py-2 bg-[#FDFBF7] border border-[#EBE5DA] rounded-xl text-xs text-[#2C2520] placeholder-[#A89A8E] focus:outline-none focus:border-[#DC2626]"
              />
            </div>
            <button
              type="submit"
              disabled={isSearching || !searchQuery.trim()}
              className="px-4 py-2 bg-[#DC2626] hover:bg-[#B91C1C] text-white text-xs font-bold rounded-xl shadow-xs transition-colors disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
            >
              {isSearching ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
              <span>검색</span>
            </button>
          </form>

          {/* Quick Category Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto text-xs pb-1">
            <span className="text-[10px] font-bold text-[#A89A8E] flex-shrink-0">추천 검색:</span>
            {[
              { label: '🎧 Lo-Fi 집중 음악', q: 'lofi hip hop' },
              { label: '⚡ Google Workspace', q: 'Google Workspace' },
              { label: '☕ 비오는 카페 BGM', q: '카페 BGM' },
              { label: '💻 코딩 & 개발 강의', q: 'React 개발' },
              { label: '✨ 뉴진스 (NewJeans)', q: '뉴진스' },
              { label: '🚀 TED 명강의', q: 'TED' },
            ].map((chip) => (
              <button
                key={chip.q}
                type="button"
                onClick={() => {
                  setSearchQuery(chip.q);
                  handleSearch(chip.q);
                }}
                className="px-2.5 py-1 rounded-full bg-[#FAF7F2] hover:bg-[#F4EFE6] border border-[#EBE5DA] text-[11px] font-medium text-[#5C5046] flex-shrink-0 transition-colors cursor-pointer"
              >
                {chip.label}
              </button>
            ))}
          </div>

          {/* Direct URL input */}
          <div className="flex items-center gap-2 pt-1 border-t border-[#F4EFE6]">
            <span className="text-[11px] font-semibold text-[#7A6A5C] flex-shrink-0">링크 직접 입력:</span>
            <input
              type="text"
              value={inputUrl}
              onChange={handleUrlInputChange}
              placeholder="https://www.youtube.com/watch?v=... 또는 https://youtu.be/..."
              className="flex-1 bg-[#FDFBF7] border border-[#EBE5DA] rounded-lg px-2.5 py-1 text-xs text-[#2C2520] focus:outline-none focus:border-[#DC2626]"
            />
          </div>
        </div>

        {/* Body: Split View (Player Preview + Video Results List) */}
        <div className="flex-1 overflow-y-auto grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-[#FDFBF7]/40">
          {/* Left: Active Video Player Preview */}
          <div className="space-y-3 flex flex-col">
            <div className="w-full aspect-video rounded-xl overflow-hidden bg-black shadow-md border border-[#EBE5DA]">
              {activeVideoId ? (
                <iframe
                  src={`https://www.youtube.com/embed/${activeVideoId}?autoplay=0&rel=0&enablejsapi=1`}
                  title="YouTube Preview"
                  className="w-full h-full border-none"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  referrerPolicy="strict-origin-when-cross-origin"
                  allowFullScreen
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-white/50 text-xs">
                  동영상을 선택하세요
                </div>
              )}
            </div>

            <div className="bg-white p-3 rounded-xl border border-[#EBE5DA] shadow-xs">
              <h4 className="text-xs font-bold text-[#2C2520] line-clamp-2">
                {activeVideoTitle || '선택된 동영상 없음'}
              </h4>
              <div className="flex items-center justify-between text-[11px] text-[#7A6A5C] mt-2">
                <a
                  href={`https://www.youtube.com/watch?v=${activeVideoId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-[#DC2626] font-bold hover:underline"
                >
                  <span>YouTube에서 열기</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
                <span className="font-mono text-[10px]">ID: {activeVideoId}</span>
              </div>
            </div>
          </div>

          {/* Right: Search Results List */}
          <div className="space-y-2 overflow-y-auto max-h-[350px] pr-1">
            <div className="text-[11px] font-bold text-[#5C5046] flex items-center justify-between">
              <span>
                {searchSource === 'trending' ? '지금 인기 영상' : '검색 결과'} ({searchResults.length}개):
              </span>
              <span className="text-[10px] text-[#A89A8E]">클릭 시 왼쪽에서 즉시 재생</span>
            </div>

            {searchError && !isSearching && (
              <div className="p-3 rounded-xl bg-[#FFFBEB] border border-[#FDE68A] text-[11px] text-[#8C6B3F] leading-relaxed">
                {searchError}
              </div>
            )}

            {searchResults.length === 0 ? (
              <div className="text-center py-12 text-xs text-[#A89A8E] bg-white rounded-xl border border-[#EBE5DA] p-6">
                {isSearching ? 'YouTube에서 영상을 찾는 중...' : '검색어를 입력하거나 유튜브 링크를 붙여넣어 주세요.'}
              </div>
            ) : (
              searchResults.map((item) => {
                const isSelected = activeVideoId === item.id;
                return (
                  <div
                    key={item.id}
                    onClick={() => handleSelectVideo(item)}
                    className={`flex items-start gap-2.5 p-2 rounded-xl border transition-all cursor-pointer group ${
                      isSelected
                        ? 'bg-[#FEE2E2]/30 border-[#DC2626] shadow-xs'
                        : 'bg-white hover:bg-[#FAF7F2] border-[#EBE5DA]'
                    }`}
                  >
                    {/* Thumbnail */}
                    <div className="relative w-24 aspect-video rounded-lg overflow-hidden bg-black/10 flex-shrink-0">
                      <img
                        src={`https://img.youtube.com/vi/${item.id}/mqdefault.jpg`}
                        alt={item.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      />
                      {item.duration && (
                        <span className="absolute bottom-1 right-1 bg-black/80 text-white text-[9px] px-1 py-0.2 rounded font-mono">
                          {item.duration}
                        </span>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <h5 className="text-xs font-bold text-[#2C2520] group-hover:text-[#DC2626] line-clamp-2 leading-snug">
                        {item.title}
                      </h5>
                      <div className="flex items-center gap-1.5 text-[10px] text-[#8C7A6B] mt-1">
                        <span className="truncate">{item.channel}</span>
                        {item.category && (
                          <span className="px-1 py-0.2 rounded bg-[#FAF7F2] text-[#7A6A5C]">
                            {item.category}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-3 border-t border-[#EBE5DA] bg-[#FAF7F2] flex items-center justify-between">
          <div className="text-[11px] text-[#7A6A5C] flex items-center gap-1">
            <span>채팅방 참여자 누구나 인앱에서 무제한 재생 가능합니다.</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-[#7A6A5C] hover:bg-[#EBE5DA] transition-colors cursor-pointer"
            >
              닫기
            </button>
            <button
              onClick={handleShareCurrent}
              disabled={!activeVideoId}
              className="px-4 py-1.5 rounded-xl bg-[#DC2626] hover:bg-[#B91C1C] text-white text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>채팅방에 영상 공유하기</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
