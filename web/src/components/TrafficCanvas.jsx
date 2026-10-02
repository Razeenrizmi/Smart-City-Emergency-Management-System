import { useEffect, useRef } from 'react';

const LANE_FRACS = [-0.86, -0.34, 0.34, 0.86];
const LANE_BOUNDS = [-0.6, 0, 0.6];
const CARS_PER_LANE = 4;
const DASH_COUNT = 12;
const TARGET_FPS = 30;
const MAX_DPR = 1.25;

const CAR_COLORS = [
  '#3B4A63', '#8FA8C8', '#C24F4F', '#E8EAEE',
  '#4C5A73', '#5B8DEF', '#6B7280', '#D9A441',
];

const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a, b) => a + Math.random() * (b - a);

const makeGlow = (rgb, size) => {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, `rgba(${rgb},1)`);
  grad.addColorStop(0.4, `rgba(${rgb},0.5)`);
  grad.addColorStop(1, `rgba(${rgb},0)`);
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  return c;
};

const makeStreak = (rgb, brightAtBottom) => {
  const w = 16;
  const h = 96;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, h);
  const solid = `rgba(${rgb},0.6)`;
  const clear = `rgba(${rgb},0)`;
  grad.addColorStop(0, brightAtBottom ? clear : solid);
  grad.addColorStop(1, brightAtBottom ? solid : clear);
  g.fillStyle = grad;
  g.fillRect(0, 0, w, h);
  return c;
};

const TrafficCanvas = ({ className }) => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext('2d');
    if (!ctx) return undefined;

    const reduceMotion = typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false;

    const sprites = {
      head: makeGlow('255,250,225', 64),
      amber: makeGlow('245,190,90', 64),
      tail: makeGlow('230,60,50', 64),
      headStreak: makeStreak('210,200,180', true),
      tailStreak: makeStreak('230,60,50', false),
    };

    let width = 1;
    let height = 1;
    let dpr = 1;
    let bg = null;
    let lanes = [];
    let dashScroll = 0;
    let rafId = 0;
    let last = performance.now();
    let accumulator = 0;

    const minFrame = 1 / TARGET_FPS;
    const horizon = () => height * 0.42;

    const project = (frac, p) => {
      const clamped = Math.max(0, Math.min(p, 1));
      const e = Math.pow(clamped, 2.1);
      const y = horizon() + (height - horizon()) * e;
      const halfRoad = lerp(width * 0.02, width * 1.05, e);
      return { x: width * 0.5 + frac * halfRoad, y, scale: lerp(0.04, 1, e), e };
    };

    const path = (x, y, w, h, r) => {
      const rr = Math.max(0, Math.min(r, w / 2, h / 2));
      ctx.beginPath();
      ctx.moveTo(x + rr, y);
      ctx.arcTo(x + w, y, x + w, y + h, rr);
      ctx.arcTo(x + w, y + h, x, y + h, rr);
      ctx.arcTo(x, y + h, x, y, rr);
      ctx.arcTo(x, y, x + w, y, rr);
      ctx.closePath();
    };

    const seedTraffic = () => {
      lanes = LANE_FRACS.map((frac, index) => {
        const dir = index < 2 ? 1 : -1;
        return {
          frac,
          dir,
          cars: Array.from({ length: CARS_PER_LANE }, (_, k) => ({
            p: (k + rand(0, 0.8)) / CARS_PER_LANE,
            speed: rand(0.05, 0.11),
            wide: rand(0.8, 1.25),
            amber: Math.random() < 0.3,
            color: CAR_COLORS[Math.floor(Math.random() * CAR_COLORS.length)],
          })),
        };
      });
    };

    const paintSky = (g) => {
      const hy = horizon();
      const glow = g.createRadialGradient(width * 0.5, hy, 0, width * 0.5, hy, width * 0.55);
      glow.addColorStop(0, 'rgba(99,102,241,0.14)');
      glow.addColorStop(0.5, 'rgba(124,58,237,0.06)');
      glow.addColorStop(1, 'rgba(99,102,241,0)');
      g.fillStyle = glow;
      g.fillRect(0, hy - height * 0.32, width, height * 0.45);
    };

    const paintRoad = (g) => {
      const hy = horizon();
      const gradient = g.createLinearGradient(0, hy, 0, height);
      gradient.addColorStop(0, '#ccd5e0');
      gradient.addColorStop(0.45, '#b4bfcd');
      gradient.addColorStop(1, '#9ba7b7');
      g.fillStyle = gradient;
      g.beginPath();
      g.moveTo(project(-1, 0).x, hy);
      g.lineTo(project(1, 0).x, hy);
      g.lineTo(project(1, 1).x, height);
      g.lineTo(project(-1, 1).x, height);
      g.closePath();
      g.fill();
    };

    const buildBackground = () => {
      const layer = document.createElement('canvas');
      layer.width = Math.round(width * dpr);
      layer.height = Math.round(height * dpr);
      const g = layer.getContext('2d');
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      paintSky(g);
      paintRoad(g);
      bg = layer;
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
      width = Math.max(1, rect.width);
      height = Math.max(1, rect.height);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      buildBackground();
    };

    const drawCity = (time) => {
      const hy = horizon();
      for (let i = 0; i < 24; i += 1) {
        const x = (((i * 97) % 100) / 100) * width;
        const y = hy - 2 - ((i * 53) % 20);
        const flicker = 0.5 + 0.5 * Math.abs(Math.sin(time * 0.0012 + i));
        ctx.fillStyle = `rgba(71,85,105,${(0.04 + flicker * 0.10).toFixed(3)})`;
        ctx.fillRect(x, y, 1.6, 1.6);
      }
    };

    const drawDashes = () => {
      ctx.lineCap = 'round';
      for (const bound of LANE_BOUNDS) {
        for (let k = 0; k < DASH_COUNT; k += 1) {
          const start = ((k / DASH_COUNT) + dashScroll) % 1;
          const a = project(bound, start);
          const b = project(bound, start + 0.05);
          ctx.strokeStyle = `rgba(255,255,255,${(0.6 + a.e * 0.35).toFixed(3)})`;
          ctx.lineWidth = 0.6 + a.e * 5;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }
    };

    const drawTrail = ({ x, y, w, dir, scale, alpha, approaching }) => {
      const streak = approaching ? sprites.headStreak : sprites.tailStreak;
      const len = 14 + scale * 60;
      const trailY = y - dir * len;
      ctx.globalAlpha = alpha * 0.22;
      ctx.drawImage(streak, x - w * 0.32, Math.min(trailY, y), w * 0.64, len);
      ctx.globalAlpha = 1;
    };

    const drawBody = ({ x, y, w, alpha, color }) => {
      const h = w * 1.28;
      const r = w * 0.17;
      const bodyAlpha = Math.min(1, 0.5 + alpha);

      ctx.globalAlpha = bodyAlpha;
      ctx.fillStyle = '#2A2F3A';
      path(x - w * 0.52, y + h * 0.12, w * 0.2, h * 0.4, r * 0.4);
      ctx.fill();
      path(x + w * 0.32, y + h * 0.12, w * 0.2, h * 0.4, r * 0.4);
      ctx.fill();

      ctx.fillStyle = color;
      path(x - w / 2, y - h / 2, w, h, r);
      ctx.fill();

      const cw = w * 0.64;
      const ch = h * 0.5;
      ctx.fillStyle = 'rgba(30,41,59,0.92)';
      path(x - cw / 2, y - h * 0.54, cw, ch, r * 0.85);
      ctx.fill();

      ctx.fillStyle = 'rgba(148,180,214,0.55)';
      path(x - cw * 0.38, y - h * 0.48, cw * 0.76, ch * 0.56, r * 0.5);
      ctx.fill();

      ctx.globalAlpha = alpha * 0.7;
      ctx.strokeStyle = 'rgba(15,23,42,0.35)';
      ctx.lineWidth = Math.max(0.5, w * 0.02);
      path(x - w / 2, y - h / 2, w, h, r);
      ctx.stroke();

      ctx.globalAlpha = 1;
    };

    const drawLights = ({ x, y, w, alpha, approaching, amber }) => {
      const h = w * 1.28;
      const rgb = approaching
        ? (amber ? '245,190,90' : '255,250,225')
        : '230,60,50';
      const glow = approaching ? (amber ? sprites.amber : sprites.head) : sprites.tail;
      const lx = w * 0.3;
      const ly = y + h * 0.28;
      const gw = w * 0.38;
      const gsize = w * 0.55;

      ctx.globalAlpha = alpha * 0.85;
      ctx.drawImage(glow, x - lx - gsize / 2, ly - gsize / 2, gsize, gsize);
      ctx.drawImage(glow, x + lx - gsize / 2, ly - gsize / 2, gsize, gsize);

      ctx.fillStyle = `rgba(${rgb},${alpha.toFixed(3)})`;
      path(x - lx - gw / 2, ly - h * 0.045, gw, h * 0.09, h * 0.035);
      ctx.fill();
      path(x + lx - gw / 2, ly - h * 0.045, gw, h * 0.09, h * 0.035);
      ctx.fill();

      ctx.globalAlpha = 1;
    };

    const drawHaze = () => {
      const hy = horizon();
      const haze = ctx.createLinearGradient(0, hy - 6, 0, hy + height * 0.16);
      haze.addColorStop(0, 'rgba(240,244,249,0.75)');
      haze.addColorStop(1, 'rgba(240,244,249,0)');
      ctx.fillStyle = haze;
      ctx.fillRect(0, hy - 6, width, height * 0.14);
    };

    const collectCars = () => {
      const list = [];
      for (const lane of lanes) {
        for (const car of lane.cars) {
          const prj = project(lane.frac, car.p);
          const edge = Math.min(1, Math.min(car.p, 1 - car.p) * 7 + 0.15);
          const alpha = Math.min(1, prj.scale * 2.4) * edge;
          if (alpha <= 0.02) continue;
          list.push({
            x: prj.x,
            y: prj.y,
            scale: prj.scale,
            w: (3.2 + prj.scale * 8) * car.wide * 2,
            dir: lane.dir,
            alpha,
            color: car.color,
            approaching: lane.dir > 0,
            amber: car.amber,
          });
        }
      }
      list.sort((a, b) => a.y - b.y);
      return list;
    };

    const render = (time) => {
      ctx.clearRect(0, 0, width, height);
      if (bg) ctx.drawImage(bg, 0, 0, width, height);
      drawCity(time);
      drawDashes();

      const cars = collectCars();

      ctx.globalCompositeOperation = 'lighter';
      for (const car of cars) drawTrail(car);

      ctx.globalCompositeOperation = 'source-over';
      for (const car of cars) drawBody(car);

      ctx.globalCompositeOperation = 'lighter';
      for (const car of cars) drawLights(car);
      ctx.globalCompositeOperation = 'source-over';

      drawHaze();
    };

    const advance = (step) => {
      dashScroll = (dashScroll + step * 0.06) % 1;
      for (const lane of lanes) {
        for (const car of lane.cars) {
          car.p += lane.dir * car.speed * step;
          if (car.p > 1.06) car.p -= 1.12;
          if (car.p < -0.06) car.p += 1.12;
        }
      }
    };

    const frame = (time) => {
      rafId = window.requestAnimationFrame(frame);

      const raw = (time - last) / 1000;
      last = time;
      accumulator += Math.min(0.05, raw);
      if (accumulator < minFrame) return;

      advance(accumulator);
      accumulator = 0;
      render(time);
    };

    const start = () => {
      if (rafId || reduceMotion) return;
      last = performance.now();
      accumulator = 0;
      rafId = window.requestAnimationFrame(frame);
    };

    const stop = () => {
      if (rafId) window.cancelAnimationFrame(rafId);
      rafId = 0;
    };

    resize();
    seedTraffic();

    const resizeObserver = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(() => {
        resize();
        render(performance.now());
      })
      : null;
    resizeObserver?.observe(canvas);

    const intersectionObserver = typeof IntersectionObserver !== 'undefined'
      ? new IntersectionObserver((entries) => {
        if (entries[0]?.isIntersecting) start();
        else stop();
      }, { threshold: 0 })
      : null;
    intersectionObserver?.observe(canvas);

    const onVisibility = () => {
      if (document.hidden) stop();
      else if (canvas.getBoundingClientRect().top < window.innerHeight) start();
    };

    if (reduceMotion) {
      render(performance.now());
    } else {
      start();
    }
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      stop();
      resizeObserver?.disconnect();
      intersectionObserver?.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  return <canvas ref={canvasRef} className={className} aria-hidden="true" />;
};

export default TrafficCanvas;
