import React, { useEffect, useState } from 'react';
import { Check, Palette, RotateCcw } from 'lucide-react';
import { storage } from '../storage';
import { applyTheme, BUBBLE_PRESETS, contrastText, getTheme, markBubbleCustomized, THEME_BUBBLE_DEFAULTS, THEME_PRESETS } from '../theme';

/**
 * 테마(6종+) + 말풍선 색 커스텀 설정 패널.
 * 선택 즉시 반영되고 localStorage 에 저장되어 새로고침 후에도 유지됩니다.
 */
export const ThemeSettings: React.FC = () => {
  const [theme, setTheme] = useState<string>(() => getTheme());
  const [colors, setColors] = useState(() => storage.getBubbleColors());

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const commitColors = (next: { mine: string; other: string }, custom = true) => {
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

  return (
    <section className="space-y-3" data-testid="theme-settings">
      <div className="rounded-2xl border border-[#EBE5DA] bg-white p-4">
        <div className="flex items-center gap-2 font-bold text-sm">
          <Palette className="w-4 h-4 text-[#8D5B4C]" />
          테마
        </div>
        <p className="text-[12px] text-[#7A6A5C] leading-5 mt-1.5">한 번 누르면 앱 전체 색이 즉시 바뀌고, 이 기기에 저장됩니다.</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-3">
          {THEME_PRESETS.map((preset) => {
            const active = theme === preset.id;
            return (
              <button
                key={preset.id}
                onClick={() => setTheme(preset.id)}
                data-testid={`theme-${preset.id}`}
                className={`relative text-left rounded-xl border p-2.5 transition-all active:scale-[0.97] ${
                  active ? 'border-[#8D5B4C] ring-1 ring-[#8D5B4C]/30' : 'border-[#EBE5DA] hover:border-[#C9BFAF]'
                }`}
              >
                <div className="flex gap-1 mb-1.5">
                  {preset.swatch.map((color) => (
                    <span key={color} className="w-4 h-4 rounded-full border border-black/5" style={{ background: color }} />
                  ))}
                </div>
                <p className="text-[11px] font-bold leading-tight">{preset.name}</p>
                <p className="text-[9.5px] text-[#A89A8E] leading-tight">{preset.desc}</p>
                {active && <Check className="w-3.5 h-3.5 text-[#8D5B4C] absolute top-2 right-2" />}
              </button>
            );
          })}
        </div>
      </div>

      <div className="rounded-2xl border border-[#EBE5DA] bg-white p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-sm">
            <Palette className="w-4 h-4 text-[#1A73E8]" />
            말풍선 색
          </div>
          <button
            onClick={resetColors}
            className="flex items-center gap-1 text-[10.5px] font-semibold text-[#7A6A5C] hover:text-[#2C2520]"
          >
            <RotateCcw className="w-3 h-3" /> 기본값
          </button>
        </div>
        <p className="text-[12px] text-[#7A6A5C] leading-5 mt-1.5">글자색은 배경 밝기에 맞춰 자동으로 대비가 조정됩니다.</p>

        {[
          { key: 'mine' as const, label: '내 말풍선' },
          { key: 'other' as const, label: '상대 말풍선' },
        ].map((row) => {
          const value = colors[row.key];
          const text = contrastText(value);
          return (
            <div key={row.key} className="mt-3">
              <div className="flex items-center justify-between text-[11px] font-bold text-[#5C5046]">
                <span>{row.label}</span>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <span className="font-mono text-[10px] text-[#A89A8E]">{value.toUpperCase()}</span>
                  <input
                    type="color"
                    value={value}
                    onChange={(e) => commitColors({ ...colors, [row.key]: e.target.value })}
                    data-testid={`bubble-color-${row.key}`}
                    className="w-7 h-7 rounded-lg border border-[#D9D2C6] bg-transparent p-0.5 cursor-pointer"
                    aria-label={`${row.label} 색상 선택`}
                  />
                </label>
              </div>
              <div className="mt-1.5 flex flex-wrap gap-1.5 items-center">
                {BUBBLE_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    onClick={() => commitColors({ ...colors, [row.key]: preset })}
                    className={`w-6 h-6 rounded-full border transition-transform active:scale-90 ${
                      value.toLowerCase() === preset.toLowerCase() ? 'border-[#2C2520] ring-2 ring-[#2C2520]/20' : 'border-black/10'
                    }`}
                    style={{ background: preset }}
                    aria-label={`${row.label} ${preset}`}
                  />
                ))}
                <span
                  className="ml-1 px-2 py-1 rounded-lg text-[10px] font-bold"
                  style={{ background: value, color: text }}
                >
                  미리보기
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};
