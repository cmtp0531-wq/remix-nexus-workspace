import React, { useEffect, useRef, useState } from 'react';
import { getTheme, isSnowEnabled } from '../theme';

interface Flake {
  x: number;
  y: number;
  r: number;
  speed: number;
  drift: number;
  sway: number;
  phase: number;
  gold: boolean;
}

/**
 * 겨울 감성 / 크리스마스 테마에서만 내리는 눈.
 * - 캔버스 한 장을 화면 위에 깔고 pointer-events: none 으로 클릭·스크롤을 가로막지 않습니다.
 * - prefers-reduced-motion 사용자는 애니메이션 없이(=표시하지 않음) 동작합니다.
 */
export const SnowFall: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [theme, setTheme] = useState<string>(() => getTheme());
  const [enabled, setEnabled] = useState<boolean>(() => isSnowEnabled());
  const [reduced, setReduced] = useState<boolean>(false);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setReduced(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  useEffect(() => {
    const syncTheme = () => setTheme(getTheme());
    const syncSnow = () => setEnabled(isSnowEnabled());
    window.addEventListener('nexus-theme-changed', syncTheme);
    window.addEventListener('nexus-snow-changed', syncSnow);
    return () => {
      window.removeEventListener('nexus-theme-changed', syncTheme);
      window.removeEventListener('nexus-snow-changed', syncSnow);
    };
  }, []);

  const active = enabled && !reduced && (theme === 'winter' || theme === 'xmas');

  useEffect(() => {
    if (!active) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = 0;
    let height = 0;
    let flakes: Flake[] = [];
    let frame = 0;
    let last = 0;

    const isXmas = theme === 'xmas';

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.max(28, Math.min(110, Math.round((width * height) / 18000)));
      flakes = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        r: 1.1 + Math.random() * 2.6,
        speed: 8 + Math.random() * 22,
        drift: (Math.random() - 0.5) * 12,
        sway: 6 + Math.random() * 16,
        phase: Math.random() * Math.PI * 2,
        gold: isXmas && Math.random() < 0.22,
      }));
    };

    const draw = (time: number) => {
      const dt = Math.min(0.05, (time - last) / 1000 || 0.016);
      last = time;
      ctx.clearRect(0, 0, width, height);
      for (const f of flakes) {
        f.phase += dt * 0.9;
        f.y += f.speed * dt;
        f.x += (f.drift + Math.sin(f.phase) * f.sway) * dt;
        if (f.y - f.r > height) {
          f.y = -f.r * 2;
          f.x = Math.random() * width;
        }
        if (f.x < -f.r * 3) f.x = width + f.r * 3;
        if (f.x > width + f.r * 3) f.x = -f.r * 3;
        ctx.beginPath();
        ctx.fillStyle = f.gold
          ? 'rgba(243, 201, 105, 0.9)'
          : isXmas
          ? 'rgba(255, 255, 255, 0.92)'
          : 'rgba(147, 197, 253, 0.9)';
        ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
        ctx.fill();
      }
      frame = window.requestAnimationFrame(draw);
    };

    resize();
    window.addEventListener('resize', resize);
    frame = window.requestAnimationFrame(draw);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('resize', resize);
      ctx.clearRect(0, 0, width, height);
    };
  }, [active, theme]);

  if (!active) return null;

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      data-testid="snow-fall"
      className="fixed inset-0 z-[30]"
      style={{ pointerEvents: 'none' }}
    />
  );
};
