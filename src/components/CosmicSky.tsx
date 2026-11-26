import React, { useEffect, useRef, useState } from 'react';
import { getTheme } from '../theme';

/**
 * 우주(코스모스) · 오로라 테마의 배경 모션.
 * - 우주: 별이 총총한 밤하늘 + 사선으로 떨어지는 유성우
 * - 오로라: 아주 천천히 일렁이는 색 띠
 * - 캔버스는 pointer-events: none 이라 클릭·스크롤을 막지 않고,
 *   prefers-reduced-motion 사용자에게는 그리지 않습니다.
 */
export const CosmicSky: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [theme, setTheme] = useState<string>(() => getTheme());
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
    window.addEventListener('nexus-theme-changed', syncTheme);
    return () => window.removeEventListener('nexus-theme-changed', syncTheme);
  }, []);

  const active = !reduced && (theme === 'space' || theme === 'aurora');

  useEffect(() => {
    if (!active) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = 0;
    let height = 0;
    let frame = 0;
    let last = 0;
    let time = 0;

    type Star = { x: number; y: number; r: number; phase: number; twinkle: number };
    type Meteor = {
      x: number;
      y: number;
      len: number;
      speed: number;
      angle: number;
      life: number;
      maxLife: number;
      width: number;
    };

    let stars: Star[] = [];
    let meteors: Meteor[] = [];
    let nextMeteorAt = 900;

    const isSpace = theme === 'space';

    const spawnMeteor = () => {
      const angle = Math.PI * 0.72; // 오른쪽 위 → 왼쪽 아래 사선
      const speed = 260 + Math.random() * 220;
      meteors.push({
        x: Math.random() * (width + 200) - 100,
        y: -40 - Math.random() * 120,
        len: 90 + Math.random() * 130,
        speed,
        angle,
        life: 0,
        maxLife: 1.6 + Math.random() * 0.9,
        width: 1 + Math.random() * 1.1,
      });
    };

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.round(Math.max(40, Math.min(160, (width * height) / 14000)));
      stars = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        r: 0.5 + Math.random() * 1.3,
        phase: Math.random() * Math.PI * 2,
        twinkle: 0.6 + Math.random() * 1.6,
      }));
      meteors = [];
    };

    const drawSpace = (dt: number) => {
      ctx.clearRect(0, 0, width, height);

      // 별
      for (const star of stars) {
        star.phase += dt * star.twinkle;
        const alpha = 0.28 + (Math.sin(star.phase) + 1) * 0.22;
        ctx.beginPath();
        ctx.fillStyle = `rgba(216, 228, 255, ${alpha.toFixed(3)})`;
        ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
        ctx.fill();
      }

      // 유성우
      nextMeteorAt -= dt * 1000;
      if (nextMeteorAt <= 0) {
        spawnMeteor();
        nextMeteorAt = 1400 + Math.random() * 2600;
      }

      meteors = meteors.filter((m) => m.life < m.maxLife && m.y < height + m.len);
      for (const meteor of meteors) {
        meteor.life += dt;
        const vx = Math.cos(meteor.angle) * meteor.speed;
        const vy = Math.sin(meteor.angle) * meteor.speed;
        meteor.x += vx * dt;
        meteor.y += vy * dt;
        const tailX = meteor.x - Math.cos(meteor.angle) * meteor.len;
        const tailY = meteor.y - Math.sin(meteor.angle) * meteor.len;
        const fade = Math.max(0, 1 - meteor.life / meteor.maxLife);
        const grad = ctx.createLinearGradient(tailX, tailY, meteor.x, meteor.y);
        grad.addColorStop(0, 'rgba(160, 186, 255, 0)');
        grad.addColorStop(0.65, `rgba(186, 205, 255, ${0.42 * fade})`);
        grad.addColorStop(1, `rgba(255, 255, 255, ${0.9 * fade})`);
        ctx.strokeStyle = grad;
        ctx.lineWidth = meteor.width;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(tailX, tailY);
        ctx.lineTo(meteor.x, meteor.y);
        ctx.stroke();
      }
    };

    const drawAurora = () => {
      ctx.clearRect(0, 0, width, height);
      const bands = [
        { y: height * 0.18, amp: 46, color: [103, 232, 195], spd: 0.00018, alpha: 0.14 },
        { y: height * 0.34, amp: 60, color: [143, 180, 255], spd: 0.00013, alpha: 0.11 },
        { y: height * 0.5, amp: 38, color: [183, 156, 255], spd: 0.00022, alpha: 0.09 },
      ];
      bands.forEach((band, index) => {
        ctx.beginPath();
        ctx.moveTo(-40, band.y);
        for (let x = -40; x <= width + 40; x += 18) {
          const y =
            band.y +
            Math.sin(x * 0.004 + time * band.spd * 1000 + index * 1.7) * band.amp +
            Math.sin(x * 0.011 - time * band.spd * 1400) * (band.amp * 0.35);
          ctx.lineTo(x, y);
        }
        ctx.lineTo(width + 40, height);
        ctx.lineTo(-40, height);
        ctx.closePath();
        const grad = ctx.createLinearGradient(0, band.y - band.amp, 0, height);
        const [r, g, b] = band.color;
        grad.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${band.alpha})`);
        grad.addColorStop(0.55, `rgba(${r}, ${g}, ${b}, ${band.alpha * 0.4})`);
        grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = grad;
        ctx.fill();
      });
    };

    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000 || 0.016);
      last = now;
      time += dt;
      if (isSpace) drawSpace(dt);
      else drawAurora();
      frame = window.requestAnimationFrame(loop);
    };

    resize();
    window.addEventListener('resize', resize);
    frame = window.requestAnimationFrame(loop);

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
      data-testid="cosmic-sky"
      data-theme-motion={theme}
      className="fixed inset-0 z-[31]"
      style={{ pointerEvents: 'none' }}
    />
  );
};
