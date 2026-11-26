import React, { useEffect, useState } from 'react';
import { Check, Image as ImageIcon, Palette, RotateCcw, Snowflake, Sparkles, Type } from 'lucide-react';
import { storage } from '../storage';
import {
  applyFont,
  applyTheme,
  BUBBLE_PRESETS,
  bubbleBorderColor,
  contrastText,
  FONT_PRESETS,
  getChosenWallpaperId,
  getFont,
  getTheme,
  getThemeButtonStyle,
  getThemeWallpaper,
  getWallpaperDim,
  isSnowEnabled,
  isWallpaperBlurred,
  setChosenWallpaper,
  setWallpaperBlurred,
  setWallpaperDim,
  WALLPAPER_LIBRARY,
  wallpaperUrl,
  markBubbleCustomized,
  setSnowEnabled,
  THEME_BUBBLE_DEFAULTS,
  THEME_PRESETS,
} from '../theme';

type BubbleColors = { mine: string; other: string };

const bubbleVars = (bg: string) =>
  ({
    '--nx-bubble-bg': bg,
    '--nx-bubble-fg': contrastText(bg),
    '--nx-bubble-bd': bubbleBorderColor(bg),
  }) as React.CSSProperties;

/** 카드·글자색을 모두 테마 변수로 그려서 12종 테마 어디서나 선명하게 보이게 합니다. */
const cardStyle: React.CSSProperties = {
  background: 'var(--nx-surface)',
  border: '1px solid var(--nx-border)',
  color: 'var(--nx-text)',
};

/**
 * 테마(12종) + 말풍선 색(내/상대) + 글씨체 설정 패널.
 * 선택 즉시 앱 전체에 반영되고 localStorage 에 저장되어 새로고침 후에도 유지됩니다.
 */
export const ThemeSettings: React.FC = () => {
  const [theme, setTheme] = useState<string>(() => getTheme());
  const [colors, setColors] = useState<BubbleColors>(() => storage.getBubbleColors());
  const [font, setFont] = useState<string>(() => getFont());
  const [snow, setSnow] = useState<boolean>(() => isSnowEnabled());
  const [wallpaperId, setWallpaperId] = useState<string | null>(() => getChosenWallpaperId());
  const [dim, setDim] = useState<number>(() => getWallpaperDim());
  const [blurred, setBlurred] = useState<boolean>(() => isWallpaperBlurred());
  const buttonStyle = getThemeButtonStyle(theme);
  const activeWallpaper = wallpaperId
    ? WALLPAPER_LIBRARY.find((item) => item.id === wallpaperId) || getThemeWallpaper(theme)
    : getThemeWallpaper(theme);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  // 다른 화면(채팅)에서 색이 바뀌거나 테마/폰트가 바뀌면 설정 화면도 즉시 따라갑니다.
  useEffect(() => {
    const syncColors = () => setColors(storage.getBubbleColors());
    const syncTheme = () => setTheme(getTheme());
    const syncFont = () => setFont(getFont());
    const syncSnow = () => setSnow(isSnowEnabled());
    window.addEventListener('nexus-bubble-colors', syncColors);
    window.addEventListener('nexus-theme-changed', syncTheme);
    window.addEventListener('nexus-font-changed', syncFont);
    window.addEventListener('nexus-snow-changed', syncSnow);
    window.addEventListener('storage', syncColors);
    return () => {
      window.removeEventListener('nexus-bubble-colors', syncColors);
      window.removeEventListener('nexus-theme-changed', syncTheme);
      window.removeEventListener('nexus-font-changed', syncFont);
      window.removeEventListener('nexus-snow-changed', syncSnow);
      window.removeEventListener('storage', syncColors);
    };
  }, []);

  const commitColors = (next: BubbleColors, custom = true) => {
    setColors(next);
    markBubbleCustomized(custom);
    storage.saveBubbleColors(next);
    window.dispatchEvent(new CustomEvent('nexus-bubble-colors'));
  };

  const resetColors = () => {
    markBubbleCustomized(false);
    const defaults = THEME_BUBBLE_DEFAULTS[theme] || { mine: '#1A73E8', other: '#FFFFFF' };
    commitColors(defaults, false);
  };

  const pickFont = (fontId: string) => {
    setFont(fontId);
    applyFont(fontId);
  };

  const rows: { key: keyof BubbleColors; label: string; hint: string }[] = [
    { key: 'other', label: '상대 말풍선', hint: '왼쪽에 보이는 남의 메시지' },
    { key: 'mine', label: '내 말풍선', hint: '오른쪽에 보이는 내 메시지' },
  ];

  return (
    <section className="space-y-3" data-testid="theme-settings" style={{ color: 'var(--nx-text)' }}>
      {/* ── 말풍선 색 (맨 위: 바꾸는 즉시 아래 미리보기와 실제 채팅에 반영) ── */}
      <div className="rounded-2xl p-4" style={cardStyle}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-sm">
            <Palette className="w-4 h-4" style={{ color: 'var(--nx-accent)' }} />
            말풍선 색
          </div>
          <button
            onClick={resetColors}
            className="flex items-center gap-1 text-[10.5px] font-semibold px-2 py-1 rounded-lg"
            style={{ color: 'var(--nx-text-muted)', background: 'var(--nx-surface-2)' }}
          >
            <RotateCcw className="w-3 h-3" /> 테마 기본값
          </button>
        </div>
        <p className="text-[12px] leading-5 mt-1.5" style={{ color: 'var(--nx-text-muted)' }}>
          색을 고르면 채팅창에 바로 적용됩니다. 글자색은 배경 밝기에 맞춰 자동으로 바뀌어 항상 읽힙니다.
        </p>

        {/* 실제 채팅과 같은 규칙으로 그리는 미리보기 */}
        <div
          className="mt-3 rounded-xl p-3 space-y-2 nx-chat-bg"
          data-testid="bubble-preview"
          style={{ background: 'var(--nx-bg)', border: '1px solid var(--nx-border)' }}
        >
          <div className="flex items-start gap-2">
            <span
              className="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center text-[10px] font-bold"
              style={{ background: 'var(--nx-surface-2)', color: 'var(--nx-text-muted)' }}
            >
              박
            </span>
            <div className="nx-msg-bubble rounded-2xl rounded-tl-xs px-3 py-2 text-[12px] max-w-[75%]" style={bubbleVars(colors.other)}>
              상대 말풍선이에요. 이렇게 보여요!
            </div>
          </div>
          <div className="flex items-end justify-end gap-2">
            <div className="nx-msg-bubble rounded-2xl rounded-tr-xs px-3 py-2 text-[12px] max-w-[75%]" style={bubbleVars(colors.mine)}>
              내 말풍선은 이렇게 보여요
            </div>
          </div>
        </div>

        {rows.map((row) => {
          const value = colors[row.key] || '#FFFFFF';
          const text = contrastText(value);
          const borderColor = bubbleBorderColor(value);
          return (
            <div key={row.key} className="mt-3.5">
              <div className="flex items-center justify-between text-[11px] font-bold" style={{ color: 'var(--nx-text-strong)' }}>
                <span className="flex items-baseline gap-1.5">
                  {row.label}
                  <span className="text-[9.5px] font-medium" style={{ color: 'var(--nx-text-muted)' }}>
                    {row.hint}
                  </span>
                </span>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <span className="font-mono text-[10px]" style={{ color: 'var(--nx-text-muted)' }}>
                    {value.toUpperCase()}
                  </span>
                  <input
                    type="color"
                    value={value}
                    onChange={(e) => commitColors({ ...colors, [row.key]: e.target.value })}
                    data-testid={`bubble-color-${row.key}`}
                    className="w-7 h-7 rounded-lg bg-transparent p-0.5 cursor-pointer"
                    style={{ border: '1px solid var(--nx-border)' }}
                    aria-label={`${row.label} 색상 선택`}
                  />
                </label>
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {BUBBLE_PRESETS.map((preset) => {
                  const selected = value.toLowerCase() === preset.toLowerCase();
                  return (
                    <button
                      key={preset}
                      onClick={() => commitColors({ ...colors, [row.key]: preset })}
                      className="w-6 h-6 rounded-full transition-transform active:scale-90"
                      style={{
                        background: preset,
                        border: selected ? '2px solid var(--nx-accent)' : '1px solid var(--nx-border)',
                        boxShadow: selected ? '0 0 0 2px var(--nx-surface)' : undefined,
                      }}
                      aria-label={`${row.label} ${preset}`}
                      title={preset}
                    />
                  );
                })}
                <span
                  className="ml-1 px-2 py-1 rounded-lg text-[10px] font-bold"
                  style={{ background: value, color: text, border: `1px solid ${borderColor}` }}
                >
                  미리보기
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── 글씨체 ── */}
      <div className="rounded-2xl p-4" style={cardStyle}>
        <div className="flex items-center gap-2 font-bold text-sm">
          <Type className="w-4 h-4" style={{ color: 'var(--nx-accent)' }} />
          글씨체
        </div>
        <p className="text-[12px] leading-5 mt-1.5" style={{ color: 'var(--nx-text-muted)' }}>
          앱 전체(채팅 포함) 글씨체가 즉시 바뀌고 이 기기에 저장됩니다.
        </p>
        <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-1.5">
          {FONT_PRESETS.map((preset) => {
            const active = font === preset.id;
            return (
              <button
                key={preset.id}
                onClick={() => pickFont(preset.id)}
                data-testid={`font-${preset.id}`}
                className="relative text-left rounded-xl px-2.5 py-2 transition-all active:scale-[0.97]"
                style={{
                  background: active ? 'color-mix(in srgb, var(--nx-accent) 14%, var(--nx-surface))' : 'var(--nx-surface-2)',
                  border: `1px solid ${active ? 'var(--nx-accent)' : 'var(--nx-border)'}`,
                  color: 'var(--nx-text)',
                  fontFamily: preset.stack,
                }}
              >
                <span className="block text-[13px] font-bold leading-tight" style={{ fontFamily: preset.stack }}>
                  {preset.sample}
                </span>
                <span className="block text-[10px] leading-tight mt-0.5" style={{ color: 'var(--nx-text-muted)', fontFamily: preset.stack }}>
                  {preset.name} · {preset.desc}
                </span>
                {active && <Check className="w-3 h-3 absolute top-1.5 right-1.5" style={{ color: 'var(--nx-accent)' }} />}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── 배경화면 (테마 감성 배경 일러스트 · 앱에 직접 제작) ── */}
      <div className="rounded-2xl p-4" style={cardStyle} data-testid="theme-wallpaper-card">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 font-bold text-sm">
            <ImageIcon className="w-4 h-4" style={{ color: 'var(--nx-accent)' }} />
            배경화면
          </div>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: 'var(--nx-surface-2)', color: 'var(--nx-text-muted)' }}>
            {activeWallpaper.name}
          </span>
        </div>
        <p className="text-[12px] leading-5 mt-1.5" style={{ color: 'var(--nx-text-muted)' }}>
          테마마다 어울리는 감성 배경이 깔립니다. 대화가 잘 읽히도록 배경 위에 덮는 농도를 직접 조절할 수 있어요.
        </p>

        <div
          className="mt-3 h-28 rounded-xl bg-cover bg-center relative overflow-hidden"
          style={{ border: '1px solid var(--nx-border)', backgroundImage: `url("${wallpaperUrl(activeWallpaper.id)}")` }}
          data-testid="wallpaper-preview"
        >
          <div className="absolute inset-0" style={{ background: `color-mix(in srgb, var(--nx-bg) ${Math.round(dim * 100)}%, transparent)` }} />
          <div className="absolute inset-x-2 bottom-2 space-y-1">
            <div className="h-4 w-2/3 rounded-full" style={{ background: 'var(--nx-surface)', opacity: 0.95 }} />
            <div className="h-4 w-1/2 rounded-full ml-auto" style={{ background: 'var(--nx-primary)', opacity: 0.95 }} />
          </div>
        </div>

        <div className="mt-3 grid grid-cols-8 gap-1.5">
          {WALLPAPER_LIBRARY.map((item) => {
            const active = activeWallpaper.id === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setChosenWallpaper(item.id);
                  setWallpaperId(item.id);
                  setDim(getWallpaperDim());
                }}
                data-testid={`wallpaper-${item.id}`}
                title={item.name}
                className="relative aspect-square bg-cover bg-center overflow-hidden"
                style={{ border: `2px solid ${active ? 'var(--nx-accent)' : 'var(--nx-border)'}`, borderRadius: 'var(--nx-btn-radius)' }}
                aria-label={`${item.name} 배경화면`}
              >
                <img src={wallpaperUrl(item.id, true)} alt={item.name} loading="lazy" className="w-full h-full object-cover" draggable={false} />
              </button>
            );
          })}
        </div>

        <div className="mt-3 space-y-2">
          <div className="flex items-center justify-between text-[11px] font-bold" style={{ color: 'var(--nx-text-strong)' }}>
            <span>배경 덮개 (가독성)</span>
            <span className="font-mono text-[10px]" style={{ color: 'var(--nx-text-muted)' }}>{Math.round(dim * 100)}%</span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round(dim * 100)}
            onChange={(event) => {
              const next = Number(event.target.value) / 100;
              setDim(next);
              setWallpaperDim(next);
            }}
            data-testid="wallpaper-dim"
            className="w-full accent-[var(--nx-accent)]"
            aria-label="배경 덮개 농도"
          />
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => {
                const next = !blurred;
                setBlurred(next);
                setWallpaperBlurred(next);
              }}
              data-testid="wallpaper-blur-toggle"
              className="px-2.5 py-1 text-[11px] font-bold flex items-center gap-1"
              style={{
                background: blurred ? 'var(--nx-primary)' : 'var(--nx-surface-2)',
                color: blurred ? 'var(--nx-on-primary)' : 'var(--nx-text-muted)',
              }}
            >
              <Sparkles className="w-3 h-3" /> 흐리게 보기
            </button>
            <button
              type="button"
              onClick={() => {
                setChosenWallpaper(null);
                setWallpaperId(null);
                setDim(getThemeWallpaper(theme).dim);
                setWallpaperDim(getThemeWallpaper(theme).dim);
              }}
              className="px-2.5 py-1 text-[11px] font-bold flex items-center gap-1"
              style={{ background: 'var(--nx-surface-2)', color: 'var(--nx-text-muted)' }}
            >
              <RotateCcw className="w-3 h-3" /> 테마 기본 배경
            </button>
            <span className="text-[10px]" style={{ color: 'var(--nx-text-muted)' }}>
              버튼: {buttonStyle.radiusLabel} · {buttonStyle.description}
            </span>
          </div>
        </div>
      </div>

      {/* ── 테마 ── */}
      <div className="rounded-2xl p-4" style={cardStyle}>
        <div className="flex items-center gap-2 font-bold text-sm">
          <Palette className="w-4 h-4" style={{ color: 'var(--nx-accent)' }} />
          테마
        </div>
        <p className="text-[12px] leading-5 mt-1.5" style={{ color: 'var(--nx-text-muted)' }}>
          한 번 누르면 앱 전체 색이 즉시 바뀌고, 이 기기에 저장됩니다.
        </p>
        <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-2">
          {THEME_PRESETS.map((preset) => {
            const active = theme === preset.id;
            return (
              <button
                key={preset.id}
                onClick={() => setTheme(preset.id)}
                data-testid={`theme-${preset.id}`}
                className="relative text-left rounded-xl p-2.5 transition-all active:scale-[0.97]"
                style={{
                  background: active ? 'color-mix(in srgb, var(--nx-accent) 12%, var(--nx-surface))' : 'var(--nx-surface-2)',
                  border: `1px solid ${active ? 'var(--nx-accent)' : 'var(--nx-border)'}`,
                  color: 'var(--nx-text)',
                }}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex gap-1">
                    {preset.swatch.map((color) => (
                      <span key={color} className="w-4 h-4 rounded-full" style={{ background: color, border: '1px solid rgba(0,0,0,0.12)' }} />
                    ))}
                  </div>
                  <img
                    src={wallpaperUrl(getThemeWallpaper(preset.id).id, true)}
                    alt=""
                    loading="lazy"
                    className="w-8 h-5 object-cover rounded-sm"
                    draggable={false}
                  />
                </div>
                <p className="text-[11px] font-bold leading-tight">{preset.name}</p>
                <p className="text-[9.5px] leading-tight" style={{ color: 'var(--nx-text-muted)' }}>
                  {preset.desc}
                </p>
                {active && <Check className="w-3.5 h-3.5 absolute top-2 right-2" style={{ color: 'var(--nx-accent)' }} />}
              </button>
            );
          })}
        </div>

        {/* 겨울 감성 · 크리스마스 테마에서만 나타나는 눈 내리는 효과 토글 */}
        <div
          className="mt-3 flex items-center justify-between rounded-xl px-3 py-2.5"
          style={{ background: 'var(--nx-surface-2)', border: '1px solid var(--nx-border)' }}
        >
          <div className="flex items-center gap-2 text-[11.5px] font-bold" style={{ color: 'var(--nx-text)' }}>
            <Snowflake className="w-3.5 h-3.5" style={{ color: 'var(--nx-accent)' }} />
            눈 내리는 효과
            <span className="text-[10px] font-medium" style={{ color: 'var(--nx-text-muted)' }}>
              겨울 감성 · 크리스마스 테마
            </span>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={snow}
            data-testid="snow-toggle"
            onClick={() => {
              const next = !snow;
              setSnow(next);
              setSnowEnabled(next);
            }}
            className="relative w-9 h-5 rounded-full transition-colors"
            style={{ background: snow ? 'var(--nx-accent)' : 'color-mix(in srgb, var(--nx-text) 22%, transparent)' }}
            title={snow ? '눈 내리는 효과 끄기' : '눈 내리는 효과 켜기'}
          >
            <span
              className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all"
              style={{ left: snow ? '18px' : '2px' }}
            />
          </button>
        </div>
      </div>
    </section>
  );
};
