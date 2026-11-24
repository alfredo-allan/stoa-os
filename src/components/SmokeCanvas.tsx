"use client";
import { useEffect, useRef } from "react";

// Abertura procedural em canvas (sem imagens externas):
//  - fios de fumaça finos e translúcidos que se desprendem do anel do medalhão
//    no momento da revelação e depois um véu ambiente muito sutil subindo do chão;
//  - poeira/brasas douradas que se soltam do anel e flutuam lentamente.

interface Wisp {
  x: number;
  y: number;
  vx: number;
  vy: number;
  sx: number; // escala horizontal (comprimento do fio)
  sy: number; // escala vertical (espessura)
  growth: number;
  rot: number;
  vr: number;
  alpha: number;
  life: number;
  delay: number;
  maxLife: number;
  sprite: number;
}

interface Ember {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  alpha: number;
  life: number;
  delay: number;
  maxLife: number;
  phase: number;
}

// Sprite de fumaça alongado: vários tufos pequenos ao longo de uma curva suave,
// com bordas desfocadas. Fica com cara de "fio" em vez de bola.
function makeWispSprite(size: number, seed: number, tint: [number, number, number]) {
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size / 2;
  const g = c.getContext("2d")!;
  let s = seed;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  g.filter = `blur(${size * 0.018}px)`;
  const W = size;
  const H = size / 2;
  const bend = (rnd() - 0.5) * H * 0.35;
  const freq = 1 + rnd() * 1.5;
  for (let i = 0; i < 140; i++) {
    const t = rnd();
    // perfil afinado nas pontas
    const taper = Math.sin(Math.PI * t);
    const x = W * (0.08 + t * 0.84);
    const y = H / 2 + Math.sin(t * Math.PI * freq) * bend + (rnd() - 0.5) * H * 0.18 * taper;
    const r = H * (0.04 + rnd() * 0.12) * (0.35 + taper);
    const a = (0.025 + rnd() * 0.05) * (0.3 + taper);
    const grad = g.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, `rgba(${tint[0]},${tint[1]},${tint[2]},${a})`);
    grad.addColorStop(0.6, `rgba(${tint[0]},${tint[1]},${tint[2]},${a * 0.4})`);
    grad.addColorStop(1, `rgba(${tint[0]},${tint[1]},${tint[2]},0)`);
    g.fillStyle = grad;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  }
  // apaga as bordas do sprite com uma elipse suave, para que nenhum tufo
  // cortado pelos limites do canvas desenhe uma aresta reta (o "quadrado")
  g.filter = "none";
  g.globalCompositeOperation = "destination-in";
  g.save();
  g.translate(W / 2, H / 2);
  g.scale(W / 2, H / 2);
  const fade = g.createRadialGradient(0, 0, 0, 0, 0, 1);
  fade.addColorStop(0, "rgba(0,0,0,1)");
  fade.addColorStop(0.55, "rgba(0,0,0,1)");
  fade.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = fade;
  g.fillRect(-1, -1, 2, 2);
  g.restore();
  return c;
}

function makeEmberSprite(size: number) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d")!;
  const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, "rgba(255,236,190,1)");
  grad.addColorStop(0.18, "rgba(240,198,118,.85)");
  grad.addColorStop(0.45, "rgba(217,160,80,.22)");
  grad.addColorStop(1, "rgba(217,160,80,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  return c;
}

export function SmokeCanvas({ className = "" }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext("2d")!;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let w = 0, h = 0, dpr = 1;
    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    const wispSprites = [
      makeWispSprite(512, 11, [176, 160, 136]),
      makeWispSprite(512, 97, [196, 170, 126]),
      makeWispSprite(512, 503, [150, 140, 128]),
      makeWispSprite(512, 1201, [210, 178, 120]),
      makeWispSprite(512, 4409, [168, 152, 130]),
    ];
    const ember = makeEmberSprite(32);

    const mobile = w < 768;
    // mesmo posicionamento/tamanho do medalhão definido em page.tsx
    const cx = () => w / 2;
    const cy = () => h * (mobile ? 0.4 : 0.38);
    const medalR = () => (mobile ? Math.min(w * 0.36, h * 0.26) : Math.min(w * 0.2, h * 0.22));

    const wisps: Wisp[] = [];
    const embers: Ember[] = [];
    const FPS = 60;

    // 1) fios que se desprendem do anel durante a revelação (~1.2s → 4s)
    if (!reduced) {
      const n = mobile ? 12 : 20;
      for (let i = 0; i < n; i++) {
        const ang = (i / n) * Math.PI * 2 + Math.random() * 0.3;
        const d = medalR() * (0.95 + Math.random() * 0.25);
        const tang = ang + Math.PI / 2;
        const out = 0.15 + Math.random() * 0.2;
        const spin = 0.18 + Math.random() * 0.2;
        wisps.push({
          x: cx() + Math.cos(ang) * d,
          y: cy() + Math.sin(ang) * d,
          vx: Math.cos(ang) * out + Math.cos(tang) * spin,
          vy: Math.sin(ang) * out + Math.sin(tang) * spin - 0.12,
          sx: medalR() * (0.9 + Math.random() * 0.8),
          sy: medalR() * (0.35 + Math.random() * 0.25),
          growth: 0.004 + Math.random() * 0.004,
          rot: tang + (Math.random() - 0.5) * 0.4,
          vr: (Math.random() - 0.5) * 0.0025,
          alpha: 0.5 + Math.random() * 0.25,
          life: 0,
          delay: FPS * (1.0 + Math.random() * 0.6),
          maxLife: FPS * (3.2 + Math.random() * 1.8),
          sprite: (Math.random() * wispSprites.length) | 0,
        });
      }

      // 2) brasas que se soltam do anel quando a luz o fecha (~1.6s)
      const ne = mobile ? 26 : 46;
      for (let i = 0; i < ne; i++) {
        const ang = Math.random() * Math.PI * 2;
        const d = medalR() * (0.98 + Math.random() * 0.08);
        const sp = 0.25 + Math.random() * 0.9;
        embers.push({
          x: cx() + Math.cos(ang) * d,
          y: cy() + Math.sin(ang) * d,
          vx: Math.cos(ang) * sp,
          vy: Math.sin(ang) * sp * 0.7 - 0.25,
          r: 1 + Math.random() * 2.2,
          alpha: 0.55 + Math.random() * 0.45,
          life: 0,
          delay: FPS * (1.3 + Math.random() * 0.9),
          maxLife: FPS * (2.5 + Math.random() * 2.5),
          phase: Math.random() * Math.PI * 2,
        });
      }
    }

    const spawnAmbientWisp = (initial = false) => {
      wisps.push({
        x: Math.random() * w,
        y: h * (0.75 + Math.random() * 0.35) - (initial ? Math.random() * h * 0.3 : 0),
        vx: (Math.random() - 0.5) * 0.22,
        vy: -(0.08 + Math.random() * 0.16),
        sx: (mobile ? 260 : 460) * (0.7 + Math.random() * 0.8),
        sy: (mobile ? 110 : 180) * (0.7 + Math.random() * 0.6),
        growth: 0.0006 + Math.random() * 0.0008,
        rot: (Math.random() - 0.5) * 0.7,
        vr: (Math.random() - 0.5) * 0.0012,
        alpha: 0.22 + Math.random() * 0.22,
        life: initial ? Math.random() * FPS * 6 : 0,
        delay: initial ? FPS * 1.6 : 0,
        maxLife: FPS * (14 + Math.random() * 8),
        sprite: (Math.random() * wispSprites.length) | 0,
      });
    };

    const spawnAmbientEmber = () => {
      embers.push({
        x: w * (0.15 + Math.random() * 0.7),
        y: h + 10,
        vx: (Math.random() - 0.5) * 0.25,
        vy: -(0.25 + Math.random() * 0.45),
        r: 0.8 + Math.random() * 1.6,
        alpha: 0.25 + Math.random() * 0.45,
        life: 0,
        delay: 0,
        maxLife: FPS * (8 + Math.random() * 8),
        phase: Math.random() * Math.PI * 2,
      });
    };

    for (let i = 0; i < (mobile ? 5 : 9); i++) spawnAmbientWisp(true);

    let raf = 0;
    let last = performance.now();
    let accW = 0;
    let accE = 0;
    let clock = 0;
    const tick = (t: number) => {
      const dt = Math.min(3, (t - last) / 16.67);
      last = t;
      clock += dt;
      ctx.clearRect(0, 0, w, h);

      accW += dt;
      if (accW > (mobile ? 70 : 45)) {
        accW = 0;
        if (wisps.length < (mobile ? 9 : 16)) spawnAmbientWisp();
      }
      accE += dt;
      if (!reduced && clock > FPS * 3 && accE > (mobile ? 55 : 32)) {
        accE = 0;
        if (embers.length < (mobile ? 14 : 26)) spawnAmbientEmber();
      }

      // fumaça
      for (let i = wisps.length - 1; i >= 0; i--) {
        const p = wisps[i];
        if (p.delay > 0) { p.delay -= dt; continue; }
        p.life += dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vx *= 0.998;
        p.vy *= 0.998;
        p.sx *= 1 + p.growth * dt;
        p.sy *= 1 + p.growth * 1.4 * dt;
        p.rot += p.vr * dt;
        const k = p.life / p.maxLife;
        if (k >= 1) { wisps.splice(i, 1); continue; }
        // entra devagar, permanece, se desfaz
        const env = k < 0.2 ? Math.sin((k / 0.2) * Math.PI / 2) : Math.pow(1 - (k - 0.2) / 0.8, 1.6);
        const a = p.alpha * env;
        if (a < 0.003) continue;
        ctx.save();
        ctx.globalAlpha = a;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.drawImage(wispSprites[p.sprite], -p.sx / 2, -p.sy / 2, p.sx, p.sy);
        ctx.restore();
      }

      // brasas douradas
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      for (let i = embers.length - 1; i >= 0; i--) {
        const e = embers[i];
        if (e.delay > 0) { e.delay -= dt; continue; }
        e.life += dt;
        e.vx = e.vx * 0.985 + Math.sin((e.life + e.phase * 40) / 45) * 0.006;
        e.vy = e.vy * 0.99 - 0.004;
        e.x += e.vx * dt;
        e.y += e.vy * dt;
        const k = e.life / e.maxLife;
        if (k >= 1 || e.y < -20) { embers.splice(i, 1); continue; }
        const env = k < 0.1 ? k / 0.1 : Math.pow(1 - (k - 0.1) / 0.9, 1.3);
        const twinkle = 0.7 + 0.3 * Math.sin(e.life / 6 + e.phase);
        const a = e.alpha * env * twinkle;
        if (a < 0.01) continue;
        const s = e.r * 6;
        ctx.globalAlpha = a;
        ctx.drawImage(ember, e.x - s / 2, e.y - s / 2, s, s);
      }
      ctx.restore();

      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    const onVis = () => {
      if (document.hidden) cancelAnimationFrame(raf);
      else { last = performance.now(); raf = requestAnimationFrame(tick); }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  return <canvas ref={ref} className={`pointer-events-none h-full w-full ${className}`} aria-hidden />;
}
