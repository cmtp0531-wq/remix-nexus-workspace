import React, { useCallback, useState } from 'react';
import {
  Youtube,
  Search,
  Play,
  Share2,
  RefreshCw,
  ArrowLeft,
  ExternalLink,
  Radio,
  MonitorPlay,
  Headphones,
  EyeOff,
  Volume2,
} from 'lucide-react';
import { searchYouTubeVideosDetailed, YouTubeVideoItem } from '../services/geminiService';
import { useYouTubePlayer } from './YouTubePlayerLayer';

interface YouTubeInPageViewProps {
  onShareToChat?: (videoUrl: string, title: string, videoId: string) => void;
  onBackToChat?: () => void;
}

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
    if (match && match[1] && match[1].length === 11) return match[1];
  }
  return null;
};

/**
 * 유튜브 화면. 플레이어 자체는 앱 최상위(YouTubePlayerProvider)에 항상 마운트되어 있고,
 * 이 화면은 '플레이어가 놓일 자리(slot)'와 검색 UI 만 담당합니다.
 * → 채팅/드라이브/설정으로 화면을 바꿔도 재생이 초기화되지 않습니다.
 */
export const YouTubeInPageView: React.FC<YouTubeInPageViewProps> = ({ onShareToChat, onBackToChat }) => {
  const player = useYouTubePlayer();
  const [input, setInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<YouTubeVideoItem[]>([]);
  const [error, setError] = useState('');
  const [hasSearched, setHasSearched] = useState(false);
  // ref 콜백은 항상 같은 함수여야 무한 렌더링을 피할 수 있습니다.
  const slotRefCallback = useCallback((el: HTMLDivElement | null) => player.attachSlot(el), [player.attachSlot]);

  const runSearch = async (query: string) => {
    const q = query.trim();
    if (!q) return;
    setIsSearching(true);
    setError('');
    setHasSearched(true);
    try {
      const result = await searchYouTubeVideosDetailed(q);
      setResults(result.items);
      if (result.items.length === 0) {
        setError(result.error || '검색 결과가 없습니다. 다른 검색어로 시도해 주세요.');
      }
    } catch {
      setError('검색 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.');
    } finally {
      setIsSearching(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = input.trim();
    if (!value) return;
    const id = extractVideoId(value);
    if (id) {
      let title = 'YouTube 영상';
      try {
        const res = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${id}&format=json`);
        if (res.ok) {
          const data = await res.json();
          if (data?.title) title = data.title;
        }
      } catch {
        /* 제목 조회 실패 시 기본 제목 */
      }
      player.play({ videoId: id, title });
      setInput('');
      return;
    }
    setSearchQuery(value);
    void runSearch(value);
    setInput('');
  };

  const playItem = (item: YouTubeVideoItem) => {
    player.play({ videoId: item.id, title: item.title, channel: item.channel });
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#FDFBF7] text-[#2C2520] overflow-hidden min-w-0">
      <header className="px-3 sm:px-4 py-2.5 bg-[#FAF7F2] border-b border-[#EBE5DA] flex items-center gap-2 flex-wrap shrink-0">
        {onBackToChat && (
          <button
            onClick={onBackToChat}
            className="p-1.5 rounded-xl hover:bg-[#EBE5DA] text-[#5C5046] transition-colors cursor-pointer shrink-0"
            title="대화방으로 돌아가기"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
        )}
        <div className="p-1.5 rounded-xl bg-[#FEE2E2] text-[#DC2626] border border-[#FECACA] shrink-0">
          <Youtube className="w-5 h-5" />
        </div>
        <div className="min-w-0 hidden sm:block">
          <h2 className="text-sm font-bold truncate">YouTube</h2>
          <p className="text-[10.5px] text-[#7A6A5C] truncate">화면을 바꿔도 재생이 끊기지 않는 인앱 플레이어</p>
        </div>
        <form onSubmit={handleSubmit} className="flex items-center gap-2 flex-1 min-w-[180px] max-w-md ml-auto">
          <div className="relative flex-1 flex items-center">
            <Search className="w-3.5 h-3.5 text-[#A89A8E] absolute left-2.5" />
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="검색어 또는 YouTube 링크"
              className="w-full pl-8 pr-2 py-1.5 bg-white border border-[#EBE5DA] rounded-xl text-xs focus:outline-none focus:border-[#DC2626]"
            />
          </div>
          <button
            type="submit"
            disabled={!input.trim() || isSearching}
            className="px-3 py-1.5 bg-[#DC2626] hover:bg-[#B91C1C] text-white text-xs font-bold rounded-xl disabled:opacity-50 shrink-0"
          >
            {isSearching ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : '검색'}
          </button>
        </form>
      </header>

      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden min-h-0">
        {/* 플레이어 슬롯 — 실제 iframe 은 최상위 레이어가 이 자리에 올라갑니다 */}
        <div className="w-full lg:w-3/5 p-3 sm:p-4 flex flex-col bg-[#1A1512] text-white overflow-y-auto min-h-0">
          <div
            ref={slotRefCallback}
            className="relative w-full aspect-video rounded-2xl bg-black border border-white/10 overflow-hidden"
            data-testid="youtube-player-slot"
          >
            {!player.track && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-white/60 text-xs">
                <Youtube className="w-8 h-8 text-white/30" />
                <p>영상을 검색하거나 링크를 붙여넣으면 여기에서 재생됩니다.</p>
              </div>
            )}
          </div>

          <div className="mt-3 flex items-center justify-between gap-2 flex-wrap">
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-bold truncate">{player.track?.title || '재생 중인 영상 없음'}</h3>
              <p className="text-[10.5px] text-white/50 truncate">
                {player.track ? `youtube.com/watch?v=${player.track.videoId}` : '추천 영상은 표시하지 않습니다 — 검색한 영상만 재생됩니다.'}
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => player.setAudioOnly(true)}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-[11px] font-semibold"
                title="영상 화면을 숨기고 소리로 계속 듣기"
              >
                <Headphones className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">오디오만</span>
              </button>
              <a
                href={player.track ? `https://www.youtube.com/watch?v=${player.track.videoId}` : '#'}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-[11px] font-semibold"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">새 탭</span>
              </a>
              {onShareToChat && player.track && (
                <button
                  onClick={() =>
                    onShareToChat(
                      `https://www.youtube.com/watch?v=${player.track!.videoId}`,
                      player.track!.title,
                      player.track!.videoId
                    )
                  }
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-[#DC2626] hover:bg-[#B91C1C] text-[11px] font-bold"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">공유</span>
                </button>
              )}
            </div>
          </div>

          <div className="mt-3 rounded-xl bg-white/5 border border-white/10 p-2.5 text-[10.5px] leading-relaxed text-white/60">
            <p className="flex items-center gap-1 font-bold text-white/80 mb-1">
              <Radio className="w-3 h-3 text-[#4ADE80]" /> 백그라운드 재생 안내
            </p>
            다른 화면(채팅·드라이브·설정)으로 이동해도 재생은 그대로 이어지고, 작은 미니 플레이어로 제어할 수 있습니다.
            휴대폰 화면을 끄거나 앱을 완전히 벗어나면 브라우저·YouTube 정책상 재생이 멈출 수 있으며, 이때는 새 탭에서 YouTube 앱/플레이어로 이어 보세요.
          </div>
        </div>

        {/* 검색 결과 */}
        <div className="w-full lg:w-2/5 border-t lg:border-t-0 lg:border-l border-[#EBE5DA] bg-[#FDFBF7] flex flex-col min-h-0 overflow-hidden">
          <div className="px-3 py-2 border-b border-[#EBE5DA] bg-white flex items-center justify-between shrink-0">
            <span className="text-[11px] font-bold text-[#5C5046]">
              {hasSearched ? `검색 결과 ${results.length}개` : '검색 결과'}
            </span>
            <span className="text-[10px] text-[#A89A8E] flex items-center gap-1">
              <MonitorPlay className="w-3 h-3" /> 클릭하면 위에서 재생
            </span>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-0">
            {!hasSearched && (
              <div className="py-10 px-4 text-center text-[12px] text-[#7A6A5C] leading-relaxed flex flex-col items-center gap-2">
                <div className="w-11 h-11 rounded-2xl bg-[#F4EFE6] flex items-center justify-center">
                  <Search className="w-5 h-5 text-[#A89A8E]" />
                </div>
                <p className="font-bold text-[#3E2723]">검색어를 입력해 주세요</p>
                <p className="text-[11px] text-[#A89A8E]">
                  추천·인기 영상은 보여주지 않습니다.<br />원하는 영상만 검색해서 재생·공유할 수 있어요.
                </p>
                <p className="text-[10.5px] text-[#A89A8E] mt-1">
                  링크를 붙여넣으면 바로 재생됩니다.<br />(예: https://youtu.be/영상ID)
                </p>
              </div>
            )}

            {isSearching && (
              <div className="py-8 text-center text-xs text-[#A89A8E] flex flex-col items-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin" />
                검색 중…
              </div>
            )}

            {!isSearching && error && (
              <div className="p-3 rounded-xl bg-[#FFFBEB] border border-[#FDE68A] text-[11px] text-[#8C6B3F] leading-relaxed">{error}</div>
            )}

            {!isSearching &&
              results.map((item) => {
                const isPlaying = player.track?.videoId === item.id;
                return (
                  <div
                    key={item.id}
                    onClick={() => playItem(item)}
                    className={`p-2 rounded-xl border transition-all cursor-pointer flex gap-2.5 items-center group ${
                      isPlaying ? 'bg-[#FEE2E2] border-[#FECACA]' : 'bg-white border-[#EBE5DA] hover:bg-[#FAF7F2]'
                    }`}
                  >
                    <div className="relative w-24 aspect-video rounded-lg overflow-hidden bg-black flex-shrink-0">
                      <img src={`https://img.youtube.com/vi/${item.id}/mqdefault.jpg`} alt="" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 flex items-center justify-center bg-black/25 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Play className="w-4 h-4 text-white fill-white" />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-[11.5px] font-bold truncate group-hover:text-[#DC2626]">{item.title}</h4>
                      <p className="text-[10px] text-[#7A6A5C] truncate mt-0.5">{item.channel}</p>
                      {isPlaying && (
                        <span className="inline-block mt-1 px-1.5 py-0.5 rounded bg-[#DC2626] text-white text-[9px] font-bold">재생 중</span>
                      )}
                    </div>
                  </div>
                );
              })}
          </div>

          <div className="px-3 py-2 border-t border-[#EBE5DA] bg-white text-[10px] text-[#A89A8E] flex items-center gap-1 shrink-0">
            <EyeOff className="w-3 h-3" /> 추천 영상 자동 표시 OFF · <Volume2 className="w-3 h-3" /> 백그라운드 오디오 지원
          </div>
        </div>
      </div>
    </div>
  );
};
