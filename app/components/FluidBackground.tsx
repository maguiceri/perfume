'use client';

import { useEffect, useRef } from 'react';

// ── Physics ───────────────────────────────────────────────────────────────────
const SCALE = 0.01;   // noise spatial frequency → vortex size at screen scale
const DT    = 0.00015;  // field time step per frame
const SPD   = 1.8;      // px/frame — fast dispersion so particles leave the path quickly

// ── Rendering ─────────────────────────────────────────────────────────────────
const FADE  = 0.12;    // fast fade to black — path mark clears in ~0.5s

// ── Ink particles (emitted by mouse / touch — the "brush") ────────────────────
const INK_RATE      = 20;    // particles spawned per frame while brush moves
const INK_OP        = 0.3;  // brighter to compensate for faster fade
const INK_LW        = 2.0;
const INK_LIFE_MIN  = 15;
const INK_LIFE_MAX  = 180;   // shorter life — ink flows away, doesn't linger
const INK_SPREAD    = 20;    // wider spawn scatter so density is lower at cursor
const CARRY_INIT    = 0;
const CARRY_DECAY   = 0;  // fast blend into curl — particles diverge from path quickly
const INK_CAP       = 6000;

// ── Ambient particles — none at rest, canvas is dark water ────────────────────
const AMB_N         = 0;     // no ambient: the "water" is clear until brush touches it
const AMB_OP        = 0.016;
const AMB_LW        = 0.9;
const AMB_LIFE_MIN  = 80;
const AMB_LIFE_MAX  = 180;

// ── Color ─────────────────────────────────────────────────────────────────────
const BUCKETS  = 64;
const DHUE_MIN = 0.0010;
const DHUE_MAX = 0.0028;

const PAL: [number, number, number][] = [
  [210, 125, 125],  // vibrant old rose
  [215, 138, 138],  // light vibrant rose
  [195, 112, 118],  // deep vibrant rose
  [240, 195,  55],  // bright gold
  [205, 130, 132],  // warm rose
  [255, 215,  45],  // brilliant gold
];

// ── Perlin noise ──────────────────────────────────────────────────────────────
const PERM = new Uint8Array(512);
let noiseReady = false;
function initNoise() {
  if (noiseReady) return;
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  for (let i = 255; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    const tmp = p[i]; p[i] = p[j]; p[j] = tmp;
  }
  PERM.set(p); PERM.set(p, 256);
  noiseReady = true;
}
function sm(t: number) { return t * t * t * (t * (t * 6 - 15) + 10); }
function gr(h: number, x: number, y: number) {
  const v = h & 7, u = v < 4 ? x : y, w = v < 4 ? y : x;
  return ((v & 1) ? -u : u) + ((v & 2) ? -w : w);
}
function noise(x: number, y: number): number {
  const xi = Math.floor(x) & 255, yi = Math.floor(y) & 255;
  const xf = x - Math.floor(x), yf = y - Math.floor(y);
  const u = sm(xf), v = sm(yf);
  const aa = PERM[PERM[xi] + yi],     ab = PERM[PERM[xi] + yi + 1];
  const ba = PERM[PERM[xi + 1] + yi], bb = PERM[PERM[xi + 1] + yi + 1];
  return (1 - v) * ((1 - u) * gr(aa, xf, yf)     + u * gr(ba, xf - 1, yf))
             + v * ((1 - u) * gr(ab, xf, yf - 1) + u * gr(bb, xf - 1, yf - 1));
}

const EPS = 0.001;
function curlVel(x: number, y: number, t: number): [number, number] {
  const bx = x * SCALE + t * 0.23, by = y * SCALE + t * 0.17;
  const vx = ((noise(bx, by + EPS) - noise(bx, by - EPS)) / (2 * EPS)) * SPD;
  const vy = (-(noise(bx + EPS, by) - noise(bx - EPS, by)) / (2 * EPS)) * SPD;
  return [vx, vy];
}

// ── Palette ───────────────────────────────────────────────────────────────────
function palLerp(h: number): [number, number, number] {
  const f  = ((h % 1) + 1) % 1 * PAL.length;
  const i0 = Math.floor(f) % PAL.length, i1 = (i0 + 1) % PAL.length, r = f - Math.floor(f);
  const a = PAL[i0], b = PAL[i1];
  return [a[0] + (b[0] - a[0]) * r, a[1] + (b[1] - a[1]) * r, a[2] + (b[2] - a[2]) * r];
}
const ST_INK = Array.from({ length: BUCKETS }, (_, i) => {
  const [r, g, b] = palLerp(i / BUCKETS);
  return `rgba(${r | 0},${g | 0},${b | 0},${INK_OP})`;
});
const ST_AMB = Array.from({ length: BUCKETS }, (_, i) => {
  const [r, g, b] = palLerp(i / BUCKETS);
  return `rgba(${r | 0},${g | 0},${b | 0},${AMB_OP})`;
});

// ── Particle ──────────────────────────────────────────────────────────────────
interface Pt {
  x: number; y: number; px: number; py: number;
  vx: number; vy: number;   // carried velocity (ink only, decays toward curl)
  hue: number; dhue: number;
  age: number; maxAge: number;
  ink: boolean;
}

function mkAmb(W: number, H: number, stagger: boolean): Pt {
  const maxAge = AMB_LIFE_MIN + Math.random() * (AMB_LIFE_MAX - AMB_LIFE_MIN);
  const x = Math.random() * W, y = Math.random() * H;
  return {
    x, y, px: x, py: y, vx: 0, vy: 0,
    hue: Math.random(), dhue: DHUE_MIN + Math.random() * (DHUE_MAX - DHUE_MIN),
    age: stagger ? Math.random() * maxAge : 0, maxAge, ink: false,
  };
}

function mkInk(cx: number, cy: number, mvx: number, mvy: number, hue: number, spread = INK_SPREAD): Pt {
  const ox = (Math.random() * 2 - 1) * spread;
  const oy = (Math.random() * 2 - 1) * spread;
  const maxAge = INK_LIFE_MIN + Math.random() * (INK_LIFE_MAX - INK_LIFE_MIN);
  return {
    x: cx + ox, y: cy + oy, px: cx + ox, py: cy + oy,
    vx: mvx * CARRY_INIT, vy: mvy * CARRY_INIT,
    hue: (hue + (Math.random() - 0.5) * 0.06 + 1) % 1,
    dhue: DHUE_MIN + Math.random() * (DHUE_MAX - DHUE_MIN),
    age: 0, maxAge, ink: true,
  };
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function FluidBackground() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current; if (!canvas) return;
    const mc = canvas.getContext('2d'); if (!mc) return;
    const ctx: CanvasRenderingContext2D = mc;

    initNoise();

    let W = window.innerWidth, H = window.innerHeight;
    canvas.width = W; canvas.height = H;
    ctx.fillStyle = '#f5ede8'; ctx.fillRect(0, 0, W, H);

    let pts: Pt[] = Array.from({ length: AMB_N }, () => mkAmb(W, H, true));
    let inkCount = 0;

    type Seg = { px: number; py: number; x: number; y: number };
    const bInk: Seg[][] = Array.from({ length: BUCKETS }, () => []);
    const bAmb: Seg[][] = Array.from({ length: BUCKETS }, () => []);

    // Brush state: track velocity so ink inherits brush direction
    const mouse = { x: 0, y: 0, px: 0, py: 0, on: false, vx: 0, vy: 0, moved: false };
    let inkHue = Math.random();
    let t = 0, raf = 0;

    // Intro: invisible brush sweeps top-left → bottom-right over INTRO_FRAMES frames
    const INTRO_FRAMES = 110;
    const INTRO_RATE   = 38;
    let introFrame = 0;

    function frame() {
      raf = requestAnimationFrame(frame);

      // Intro sweep
      if (introFrame <= INTRO_FRAMES) {
        const prog = introFrame / INTRO_FRAMES;
        const bx   = prog * W;
        const by   = prog * H;
        const bvx  = W / INTRO_FRAMES;
        const bvy  = H / INTRO_FRAMES;
        if (inkCount < INK_CAP) {
          const n = Math.min(INTRO_RATE, INK_CAP - inkCount);
          for (let i = 0; i < n; i++) pts.push(mkInk(bx, by, bvx, bvy, inkHue, 80));
          inkCount += n;
          inkHue = (inkHue + 0.007) % 1;
        }
        introFrame++;
      }

      // Deposit ink at brush position when moving
      if (mouse.on && mouse.moved && inkCount < INK_CAP) {
        const speed = Math.sqrt(mouse.vx * mouse.vx + mouse.vy * mouse.vy);
        const n = Math.max(2, Math.round(INK_RATE * Math.min(speed / 6, 2.5)));
        for (let i = 0; i < n; i++) {
          pts.push(mkInk(mouse.x, mouse.y, mouse.vx, mouse.vy, inkHue));
        }
        inkCount += n;
        inkHue = (inkHue + 0.004) % 1;
        mouse.moved = false;
      }

      ctx.fillStyle = `rgba(245,237,232,${FADE})`; ctx.fillRect(0, 0, W, H);

      // Update particles — compact dead ink, respawn dead ambient
      let writeIdx = 0;
      for (let i = 0; i < pts.length; i++) {
        const p = pts[i];
        p.age++;

        if (p.age >= p.maxAge) {
          if (p.ink) { inkCount--; continue; } // remove from array
          // respawn ambient at random position, skip draw this frame
          p.x = Math.random() * W; p.y = Math.random() * H;
          p.px = p.x; p.py = p.y; p.vx = 0; p.vy = 0; p.age = 0;
          p.hue = Math.random();
          p.maxAge = AMB_LIFE_MIN + Math.random() * (AMB_LIFE_MAX - AMB_LIFE_MIN);
          pts[writeIdx++] = p;
          continue;
        }

        p.px = p.x; p.py = p.y;
        const [cvx, cvy] = curlVel(p.x, p.y, t);

        if (p.ink) {
          // Carried velocity blends toward curl — ink "takes on" water current
          p.vx = p.vx * CARRY_DECAY + cvx * (1 - CARRY_DECAY);
          p.vy = p.vy * CARRY_DECAY + cvy * (1 - CARRY_DECAY);
          p.x += p.vx; p.y += p.vy;
        } else {
          p.x += cvx; p.y += cvy;
        }

        p.hue = (p.hue + p.dhue) % 1;
        if (p.x < 0) p.x += W; else if (p.x > W) p.x -= W;
        if (p.y < 0) p.y += H; else if (p.y > H) p.y -= H;

        pts[writeIdx++] = p;

        // Skip draw for particles that wrapped (avoids streak across screen)
        if (Math.abs(p.x - p.px) > W * 0.5 || Math.abs(p.y - p.py) > H * 0.5) continue;

        const b = (p.hue * BUCKETS) | 0;
        (p.ink ? bInk : bAmb)[b % BUCKETS].push({ px: p.px, py: p.py, x: p.x, y: p.y });
      }
      pts.length = writeIdx;

      // Draw ambient background
      ctx.lineWidth = AMB_LW;
      for (let b = 0; b < BUCKETS; b++) {
        if (!bAmb[b].length) continue;
        ctx.strokeStyle = ST_AMB[b]; ctx.beginPath();
        for (const s of bAmb[b]) { ctx.moveTo(s.px, s.py); ctx.lineTo(s.x, s.y); }
        ctx.stroke(); bAmb[b].length = 0;
      }

      // Draw ink on top
      ctx.lineWidth = INK_LW;
      for (let b = 0; b < BUCKETS; b++) {
        if (!bInk[b].length) continue;
        ctx.strokeStyle = ST_INK[b]; ctx.beginPath();
        for (const s of bInk[b]) { ctx.moveTo(s.px, s.py); ctx.lineTo(s.x, s.y); }
        ctx.stroke(); bInk[b].length = 0;
      }

      t += DT;
    }

    const onMM = (e: MouseEvent) => {
      mouse.px = mouse.x; mouse.py = mouse.y;
      mouse.x = e.clientX; mouse.y = e.clientY;
      mouse.vx = mouse.x - mouse.px; mouse.vy = mouse.y - mouse.py;
      mouse.on = true; mouse.moved = true;
    };
    const onML = () => { mouse.on = false; };
    const onTM = (e: TouchEvent) => {
      mouse.px = mouse.x; mouse.py = mouse.y;
      mouse.x = e.touches[0].clientX; mouse.y = e.touches[0].clientY;
      mouse.vx = mouse.x - mouse.px; mouse.vy = mouse.y - mouse.py;
      mouse.on = true; mouse.moved = true;
    };
    const onTE = () => { mouse.on = false; };
    const onRz = () => {
      W = window.innerWidth; H = window.innerHeight;
      canvas.width = W; canvas.height = H;
      ctx.fillStyle = '#f5ede8'; ctx.fillRect(0, 0, W, H);
      pts = Array.from({ length: AMB_N }, () => mkAmb(W, H, true));
      inkCount = 0;
    };

    window.addEventListener('mousemove',  onMM);
    window.addEventListener('mouseleave', onML);
    window.addEventListener('resize',     onRz);
    window.addEventListener('touchmove',  onTM, { passive: true });
    window.addEventListener('touchend',   onTE);
    frame();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('mousemove',  onMM);
      window.removeEventListener('mouseleave', onML);
      window.removeEventListener('resize',     onRz);
      window.removeEventListener('touchmove',  onTM);
      window.removeEventListener('touchend',   onTE);
    };
  }, []);

  return (
    <canvas ref={ref} style={{
      position: 'fixed', inset: 0,
      width: '100%', height: '100%',
      zIndex: -1, pointerEvents: 'none',
    }} />
  );
}
