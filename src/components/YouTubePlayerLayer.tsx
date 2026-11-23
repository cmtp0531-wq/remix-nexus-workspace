import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  X,
  Maximize2,
  Minimize2,
  PictureInPicture2,
  Youtube,
  ExternalLink,
  Eye,
  EyeOff,
  GripHorizontal,
} from 'lucide-react';

export interface YouTubeTrack {
  videoId: string;
  title: string;
  channel?: string;
}

interface YouTubePlayerContextValue {
  track: YouTubeTrack | null;
  playing: boolean;
  muted: boolean;
  audioOnly: boolean;
  position: number;
  play: (track: YouTubeTrack) => void;
  togglePlay: () => void;
  setPlaying: (value: boolean) => void;
  toggleMute: () => void;
  setAudioOnly: (value: boolean) => void;
  close: () => void;
  attachSlot: (el: HTMLDivElement | null) => void;
  isInline: boolean;
  seekBy: (delta: number) => void;
  toggleFullscreenView?: () => void;
}

const YouTubePlayerContext = createContext<YouTubePlayerContextValue | null>(null);

export const useYouTubePlayer = (): YouTubePlayerContextValue => {
  const ctx = useContext(YouTubePlayerContext);
  if (!ctx) throw new Error('useYouTubePlayer must be used inside YouTubePlayerProvider');
  return ctx;
};

interface ProviderProps {
  children: React.ReactNode;
  onExpandToView?: () => void;
}

/**
 * 유튜브 플레이어를 앱 최상위에 항상 마운트해 두는 레이어.
 * - 화면(채팅/드라이브/설정…)을 바꿔도 iframe 이 언마운트되지 않아 재생이 초기화되지 않습니다.
 * - 유튜브 화면에서는 지정된 슬롯 위치에, 다른 화면에서는 우측 하단 미니 플레이어로 표시됩니다.
 * - 숨김(오디오) 모드, 미디어 세션, PiP(팝업) 등 브라우저가 허용하는 백그라운드 재생 기능을 제공합니다.
 */
export const YouTubePlayerProvider: React.FC<ProviderProps> = ({ children, onExpandToView }) => {
  const [track, setTrack] = useState<YouTubeTrack | null>(null);
  const [playing, setPlayingState] = useState(false);
  const [muted, setMuted] = useState(false);
  const [audioOnly, setAudioOnly] = useState(false);
  const [position, setPosition] = useState(0);
  const [slotRect, setSlotRect] = useState<DOMRect | null>(null);
  const [hasSlot, setHasSlot] = useState(false);
  const [miniCollapsed, setMiniCollapsed] = useState(false);

  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const hostRef = useRef<HTMLDivElement | null>(null);
  const slotRef = useRef<HTMLDivElement | null>(null);
  const positionRef = useRef(0);

  const sendCommand = useCallback((func: string, args: unknown[] = []) => {
    const win = iframeRef.current?.contentWindow;
    if (!win) return;
    try {
      win.postMessage(JSON.stringify({ event: 'command', func, args }), '*');
    } catch {
      /* cross-origin 명령 실패는 무시 */
    }
  }, []);

  const play = useCallback((next: YouTubeTrack) => {
    setTrack(next);
    setPlayingState(true);
    setPosition(0);
    positionRef.current = 0;
    setAudioOnly(false);
    setMiniCollapsed(false);
  }, []);

  const setPlaying = useCallback(
    (value: boolean) => {
      setPlayingState(value);
      sendCommand(value ? 'playVideo' : 'pauseVideo');
    },
    [sendCommand]
  );

  const togglePlay = useCallback(() => {
    setPlayingState((prev) => {
      sendCommand(prev ? 'pauseVideo' : 'playVideo');
      return !prev;
    });
  }, [sendCommand]);

  const toggleMute = useCallback(() => {
    setMuted((prev) => {
      sendCommand(prev ? 'unMute' : 'mute');
      return !prev;
    });
  }, [sendCommand]);

  const seekBy = useCallback(
    (delta: number) => {
      sendCommand('seekTo', [Math.max(0, positionRef.current + delta), true]);
      setPosition((p) => Math.max(0, p + delta));
    },
    [sendCommand]
  );

  const close = useCallback(() => {
    sendCommand('stopVideo');
    setTrack(null);
    setPlayingState(false);
    setPosition(0);
  }, [sendCommand]);

  const attachSlot = useCallback((el: HTMLDivElement | null) => {
    if (slotRef.current === el) return;
    slotRef.current = el;
    setHasSlot(Boolean(el));
    if (!el) setSlotRect(null);
  }, []);

  // 슬롯(유튜브 화면 안의 자리)의 위치를 계속 추적해 플레이어를 그 위에 올립니다.
  useEffect(() => {
    if (!hasSlot || !slotRef.current) return;
    const update = () => {
      if (!slotRef.current) return;
      const next = slotRef.current.getBoundingClientRect();
      setSlotRect((prev) => {
        if (
          prev &&
          Math.abs(prev.left - next.left) < 1 &&
          Math.abs(prev.top - next.top) < 1 &&
          Math.abs(prev.width - next.width) < 1 &&
          Math.abs(prev.height - next.height) < 1
        ) {
          return prev;
        }
        return next;
      });
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(slotRef.current);
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [hasSlot]);

  // 재생 위치 추정 (진행 바/잠금화면 seek 용)
  useEffect(() => {
    if (!playing || !track) return;
    const timer = window.setInterval(() => {
      positionRef.current += 1;
      setPosition(positionRef.current);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [playing, track?.videoId]);

  // Media Session: 잠금화면/시스템 미디어 컨트롤에 제목과 재생/일시정지/탐색을 연결합니다.
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
    try {
      if (track) {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: track.title || 'YouTube',
          artist: track.channel || 'YouTube',
          album: 'Remix Nexus',
          artwork: [
            { src: `https://img.youtube.com/vi/${track.videoId}/mqdefault.jpg`, sizes: '320x180', type: 'image/jpeg' },
            { src: `https://img.youtube.com/vi/${track.videoId}/hqdefault.jpg`, sizes: '480x360', type: 'image/jpeg' },
          ],
        });
      } else {
        navigator.mediaSession.metadata = null;
      }
      navigator.mediaSession.playbackState = track ? (playing ? 'playing' : 'paused') : 'none';
    } catch {
      /* MediaMetadata 미지원 브라우저 무시 */
    }
  }, [track, playing]);

  useEffect(() => {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
    const handlers: [MediaSessionAction, MediaSessionActionHandler][] = [
      ['play', () => setPlaying(true)],
      ['pause', () => setPlaying(false)],
      ['stop', () => close()],
      ['seekbackward', () => seekBy(-10)],
      ['seekforward', () => seekBy(10)],
    ];
    handlers.forEach(([action, handler]) => {
      try {
        navigator.mediaSession.setActionHandler(action, handler);
      } catch {
        /* 미지원 action 무시 */
      }
    });
    return () => {
      handlers.forEach(([action]) => {
        try {
          navigator.mediaSession.setActionHandler(action, null);
        } catch {
          /* noop */
        }
      });
    };
  }, [setPlaying, close, seekBy]);

  // 탭이 백그라운드로 가도 재생을 유지하려고 시도합니다 (브라우저 자동 일시정지 방지).
  useEffect(() => {
    const onVisibility = () => {
      if (!track || !playing) return;
      window.setTimeout(() => sendCommand('playVideo'), 150);
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [track, playing, sendCommand]);

  const openPiP = () => {
    if (!track) return;
    const width = 480;
    const height = 300;
    const left = Math.max(0, window.screenX + window.outerWidth - width - 24);
    const top = Math.max(0, window.screenY + window.outerHeight - height - 80);
    const url = `https://www.youtube.com/embed/${track.videoId}?autoplay=1&rel=0&modestbranding=1&start=${Math.floor(positionRef.current)}&origin=${encodeURIComponent(location.origin)}`;
    const popup = window.open(
      url,
      'nexus-youtube-pip',
      `popup=yes,width=${width},height=${height},left=${left},top=${top}`
    );
    if (!popup) {
      window.open(`https://www.youtube.com/watch?v=${track.videoId}&t=${Math.floor(positionRef.current)}s`, '_blank', 'noopener,noreferrer');
    }
  };

  const inlineStyle: React.CSSProperties = useMemo(() => {
    if (!track) return { display: 'none' };
    if (audioOnly) {
      return {
        position: 'fixed',
        left: 0,
        bottom: 0,
        width: 2,
        height: 2,
        opacity: 0.01,
        zIndex: 5,
        pointerEvents: 'none',
        overflow: 'hidden',
      };
    }
    if (hasSlot && slotRect && slotRect.width > 80) {
      return {
        position: 'fixed',
        left: slotRect.left,
        top: slotRect.top,
        width: slotRect.width,
        height: slotRect.height,
        zIndex: 20,
      };
    }
    // 미니 플레이어
    if (miniCollapsed) {
      return { position: 'fixed', right: 12, bottom: 12, width: 140, height: 40, zIndex: 40 };
    }
    return { position: 'fixed', right: 12, bottom: 'calc(env(safe-area-inset-bottom, 0px) + 92px)', width: 'min(320px, 82vw)', aspectRatio: '16 / 9', zIndex: 40 };
  }, [track, audioOnly, hasSlot, slotRect, miniCollapsed]);

  const value: YouTubePlayerContextValue = {
    track,
    playing,
    muted,
    audioOnly,
    position,
    play,
    togglePlay,
    setPlaying,
    toggleMute,
    setAudioOnly,
    close,
    attachSlot,
    isInline: hasSlot && !audioOnly,
    seekBy,
    toggleFullscreenView: onExpandToView,
  };

  const showMini = Boolean(track) && (!hasSlot || audioOnly === false ? !hasSlot : false) && !audioOnly;
  const floatingMiniVisible = Boolean(track) && !hasSlot && !audioOnly;

  return (
    <YouTubePlayerContext.Provider value={value}>
      {children}

      {/* 항상 마운트되는 유튜브 플레이어 (화면 전환에도 초기화되지 않음) */}
      <div ref={hostRef} style={inlineStyle} className="rounded-2xl overflow-hidden bg-black shadow-2xl border border-black/20">
        {track && (
          <iframe
            ref={iframeRef}
            key={track.videoId}
            title={track.title || 'YouTube'}
            src={`https://www.youtube.com/embed/${track.videoId}?autoplay=1&rel=0&modestbranding=1&playsinline=1&enablejsapi=1&origin=${encodeURIComponent(
              typeof location !== 'undefined' ? location.origin : ''
            )}`}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            referrerPolicy="strict-origin-when-cross-origin"
            allowFullScreen
            className="w-full h-full border-none block"
          />
        )}
      </div>

      {/* 미니 플레이어 컨트롤 (다른 화면에서 이어 보기) */}
      {floatingMiniVisible && (
        <div
          className="fixed z-[41] right-3 bottom-3 max-w-[320px] w-[min(320px,82vw)] bg-white/97 backdrop-blur border border-[#EBE5DA] rounded-2xl shadow-2xl overflow-hidden"
          style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 92px)' }}
        >
          <div className="flex items-center gap-1.5 px-2 py-1 bg-[#3E2723] text-white">
            <Youtube className="w-3.5 h-3.5 text-[#FF0000] fill-[#FF0000]" />
            <span className="text-[10px] font-bold flex-1 truncate">{track?.title || 'YouTube'}</span>
            <button onClick={() => setMiniCollapsed((v) => !v)} className="p-0.5 rounded hover:bg-white/20" title={miniCollapsed ? '펼치기' : '접기'}>
              {miniCollapsed ? <Maximize2 className="w-3 h-3" /> : <Minimize2 className="w-3 h-3" />}
            </button>
            <button onClick={close} className="p-0.5 rounded hover:bg-white/20" title="플레이어 닫기">
              <X className="w-3 h-3" />
            </button>
          </div>
          {!miniCollapsed && (
            <div className="flex items-center gap-1 px-2 py-1.5 bg-white">
              <button onClick={togglePlay} className="p-1.5 rounded-lg bg-[#F4EFE6] hover:bg-[#EBE5DA]" title={playing ? '일시정지' : '재생'}>
                {playing ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              </button>
              <button onClick={toggleMute} className="p-1.5 rounded-lg bg-[#F4EFE6] hover:bg-[#EBE5DA]" title={muted ? '소리 켜기' : '음소거'}>
                {muted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
              </button>
              <button
                onClick={() => {
                  setAudioOnly(true);
                  sendCommand('unMute');
                  setMuted(false);
                }}
                className="p-1.5 rounded-lg bg-[#F4EFE6] hover:bg-[#EBE5DA]"
                title="영상만 숨기고 소리로 계속 듣기"
              >
                <EyeOff className="w-3.5 h-3.5" />
              </button>
              <button onClick={openPiP} className="p-1.5 rounded-lg bg-[#F4EFE6] hover:bg-[#EBE5DA]" title="Picture-in-Picture (별도 창)">
                <PictureInPicture2 className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setMiniCollapsed(true)}
                className="ml-auto flex items-center gap-1 px-2 py-1 rounded-lg bg-[#F4EFE6] hover:bg-[#EBE5DA] text-[10px] font-bold"
                title="영상 화면으로 이동"
              >
                <GripHorizontal className="w-3 h-3" />
              </button>
            </div>
          )}
          <div className="h-1 bg-[#EBE5DA]">
            <div className="h-full bg-[#DC2626]" style={{ width: `${Math.min(100, (position / 600) * 100)}%` }} />
          </div>
        </div>
      )}

      {/* 오디오 전용 모드 표시 */}
      {track && audioOnly && (
        <div className="fixed z-[41] right-3 bottom-3 flex items-center gap-2 px-3 py-2 bg-[#3E2723] text-white rounded-2xl shadow-2xl text-[11px] max-w-[280px]">
          <Volume2 className="w-3.5 h-3.5 text-[#4ADE80] animate-pulse" />
          <span className="truncate flex-1">{track.title}</span>
          <button onClick={togglePlay} className="p-1 rounded hover:bg-white/20">{playing ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}</button>
          <button onClick={() => setAudioOnly(false)} className="p-1 rounded hover:bg-white/20" title="영상 다시 표시"><Eye className="w-3 h-3" /></button>
          <button onClick={close} className="p-1 rounded hover:bg-white/20" title="닫기"><X className="w-3.5 h-3.5" /></button>
        </div>
      )}
    </YouTubePlayerContext.Provider>
  );
};
