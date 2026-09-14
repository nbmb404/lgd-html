import { useEffect, useMemo, useRef } from "react";
import type { PointerEvent } from "react";
import type { ObjectType, ParticleLevel } from "./api";
import { getObject } from "./game";
import { drawObject, HEIGHT, hitTest, WIDTH, type Mark, type Particle } from "./scene";
import { playImpact } from "./sound";

interface GameCanvasProps {
  objectType: ObjectType;
  muted: boolean;
  volume: number;
  screenShake: boolean;
  particleLevel: ParticleLevel;
  onHit: (type: ObjectType) => void;
  onDestroyed: (type: ObjectType) => void;
}

interface GameState {
  damage: number;
  marks: Mark[];
  particles: Particle[];
  shockwaves: Shockwave[];
  shakeUntil: number;
  stretch: number;
  toastAge: number;
  flashAge: number;
}

const particleMultipliers: Record<ParticleLevel, number> = {
  low: 0.75,
  normal: 1.05,
  high: 1.45
};

type Shockwave = { x: number; y: number; life: number; maxLife: number; color: string };

export default function GameCanvas({
  objectType,
  muted,
  volume,
  screenShake,
  particleLevel,
  onHit,
  onDestroyed
}: GameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stateRef = useRef<GameState>({
    damage: 0,
    marks: [],
    particles: [],
    shockwaves: [],
    shakeUntil: 0,
    stretch: 0,
    toastAge: 0,
    flashAge: 0
  });
  const pointerRef = useRef<{ id: number; x: number; y: number; last: number } | null>(null);
  const object = useMemo(() => getObject(objectType), [objectType]);
  const particleMultiplier = particleMultipliers[particleLevel];

  useEffect(() => {
    stateRef.current = {
      damage: 0,
      marks: [],
      particles: [],
      shockwaves: [],
      shakeUntil: 0,
      stretch: 0,
      toastAge: 0,
      flashAge: 0
    };
    pointerRef.current = null;
  }, [objectType]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const context = canvas.getContext("2d");
    if (!context) {
      return;
    }

    let animationId = 0;
    let previous = performance.now();

    const render = (now: number) => {
      const state = stateRef.current;
      const delta = Math.min((now - previous) / 16.67, 2);
      previous = now;

      context.clearRect(0, 0, WIDTH, HEIGHT);
      drawBackdrop(context);

      context.save();
      if (screenShake && now < state.shakeUntil) {
        const power = Math.max(0, (state.shakeUntil - now) / 140);
        context.translate((Math.random() - 0.5) * 4 * power, (Math.random() - 0.5) * 4 * power);
      }

      context.fillStyle = "rgba(66, 54, 67, 0.12)";
      context.beginPath();
      context.ellipse(WIDTH / 2, 426, 190, 24, 0, 0, Math.PI * 2);
      context.fill();

      drawObject(context, object, state.damage, state.marks, state.stretch);
      context.restore();

      drawShockwaves(context, state.shockwaves, delta);
      drawParticles(context, state.particles, delta);
      drawFlash(context, state);
      drawToast(context, state);
      state.stretch *= 0.86;

      animationId = requestAnimationFrame(render);
    };

    animationId = requestAnimationFrame(render);

    return () => cancelAnimationFrame(animationId);
  }, [object, screenShake]);

  const strike = (x: number, y: number) => {
    if (!hitTest(object, x, y)) {
      return;
    }

    const state = stateRef.current;
    const seed =
      object.type === "bubble"
        ? Math.round((x - 342) / 72) + Math.round((y - 185) / 75) * 4
        : Math.random() * 7;

    if (object.type === "bubble" && state.marks.some((mark) => mark.seed === seed)) {
      return;
    }

    state.damage += 1;
    state.marks.push({ x, y, seed });
    state.marks = state.marks.slice(-54);
    state.stretch = Math.min(230, state.stretch + 38);

    const complete = state.damage >= object.maxDamage;
    state.shockwaves.push({ x, y, life: complete ? 18 : 10, maxLife: complete ? 18 : 10, color: object.color });
    spawnParticles(state.particles, x, y, object.color, complete, object.type, particleMultiplier);

    if (!muted) {
      playImpact(object.material, complete, volume);
    }

    onHit(object.type);

    if (complete) {
      state.toastAge = 1;
      state.flashAge = 5;
      state.shakeUntil = performance.now() + 150;
      spawnObjectBurst(state.particles, object.type, object.color, particleMultiplier);
      onDestroyed(object.type);
      state.damage = 0;
      state.marks = object.type === "bubble" ? [] : state.marks.slice(-18);
    } else {
      state.shakeUntil = performance.now() + 64;
    }
  };

  const pointerToCanvas = (event: PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();

    return {
      x: ((event.clientX - rect.left) / rect.width) * WIDTH,
      y: ((event.clientY - rect.top) / rect.height) * HEIGHT
    };
  };

  const handlePointerDown = (event: PointerEvent<HTMLCanvasElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = pointerToCanvas(event);
    pointerRef.current = { id: event.pointerId, x: point.x, y: point.y, last: performance.now() };
    strike(point.x, point.y);
  };

  const handlePointerMove = (event: PointerEvent<HTMLCanvasElement>) => {
    const pointer = pointerRef.current;
    if (!pointer || pointer.id !== event.pointerId || event.buttons !== 1) {
      return;
    }

    const point = pointerToCanvas(event);
    const distance = Math.hypot(point.x - pointer.x, point.y - pointer.y);
    const now = performance.now();
    stateRef.current.stretch = Math.max(stateRef.current.stretch, distance);

    if (distance > 18 && now - pointer.last > 80) {
      pointer.x = point.x;
      pointer.y = point.y;
      pointer.last = now;
      strike(point.x, point.y);
    }
  };

  const handlePointerEnd = (event: PointerEvent<HTMLCanvasElement>) => {
    if (pointerRef.current?.id === event.pointerId) {
      pointerRef.current = null;
      stateRef.current.stretch = 0;
    }
  };

  return (
    <canvas
      ref={canvasRef}
      className="game-canvas"
      width={WIDTH}
      height={HEIGHT}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
      onLostPointerCapture={handlePointerEnd}
    />
  );
}

function drawBackdrop(context: CanvasRenderingContext2D) {
  const gradient = context.createLinearGradient(0, 0, WIDTH, HEIGHT);
  gradient.addColorStop(0, "#fff0f6");
  gradient.addColorStop(0.45, "#fff7fb");
  gradient.addColorStop(1, "#f4f7ff");
  context.fillStyle = gradient;
  context.fillRect(0, 0, WIDTH, HEIGHT);

  context.fillStyle = "rgba(241, 109, 153, 0.11)";
  context.fillRect(0, HEIGHT - 38, WIDTH, 38);
}

function drawFlash(context: CanvasRenderingContext2D, state: GameState) {
  if (state.flashAge <= 0) {
    return;
  }

  context.save();
  context.globalAlpha = state.flashAge / 42;
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, WIDTH, HEIGHT);
  context.restore();
  state.flashAge -= 1;
}

function spawnParticles(
  particles: Particle[],
  x: number,
  y: number,
  color: string,
  burst: boolean,
  type: ObjectType,
  multiplier: number
) {
  const count = Math.round((burst ? 68 : 18) * multiplier);
  const square = ["keyboard", "paper", "wall", "box", "pencils"].includes(type);
  const colors = getParticleColors(type, color);

  for (let i = 0; i < count; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const speed = (burst ? 4.2 : 2.1) + Math.random() * (burst ? 5.6 : 3.2);
    const sizeBoost = type === "window" || type === "ice" ? 1.2 : type === "wall" || type === "box" ? 1.15 : 1;

    particles.push({
      x: x + (burst ? (Math.random() - 0.5) * 10 : 0),
      y: y + (burst ? (Math.random() - 0.5) * 10 : 0),
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - (burst ? 3.9 : 1.8),
      size: (4 + Math.random() * (burst ? 13 : 7)) * sizeBoost,
      angle: Math.random() * Math.PI,
      spin: (Math.random() - 0.5) * (burst ? 0.48 : 0.32),
      life: 54 + Math.random() * (burst ? 50 : 26),
      color: colors[Math.floor(Math.random() * colors.length)],
      square
    });
  }

  if (particles.length > 620) {
    particles.splice(0, particles.length - 620);
  }
}

function spawnObjectBurst(particles: Particle[], type: ObjectType, color: string, multiplier: number) {
  const origins = type === "window" ? windowPaneOrigins() : objectBurstOrigins(type);

  origins.forEach((origin) => {
    spawnParticles(particles, origin.x, origin.y, color, true, type, multiplier * (type === "window" ? 0.11 : 0.18));
  });
}

function windowPaneOrigins() {
  const points = [];
  for (let i = 0; i < 10; i += 1) {
    points.push({
      x: 322 + Math.random() * 256,
      y: 132 + Math.random() * 256
    });
  }
  return points;
}

function objectBurstOrigins(type: ObjectType) {
  const bounds: Record<ObjectType, { w: number; h: number; count: number }> = {
    window: { w: 256, h: 256, count: 10 },
    cup: { w: 120, h: 200, count: 5 },
    plank: { w: 320, h: 104, count: 6 },
    paper: { w: 185, h: 245, count: 6 },
    laptop: { w: 315, h: 200, count: 6 },
    plate: { w: 200, h: 200, count: 6 },
    keyboard: { w: 340, h: 135, count: 7 },
    monitor: { w: 285, h: 205, count: 6 },
    can: { w: 105, h: 190, count: 5 },
    bubble: { w: 260, h: 190, count: 8 },
    balloon: { w: 150, h: 215, count: 5 },
    ice: { w: 210, h: 210, count: 7 },
    wall: { w: 320, h: 220, count: 8 },
    box: { w: 210, h: 185, count: 6 },
    pencils: { w: 210, h: 220, count: 6 },
    cookie: { w: 200, h: 200, count: 6 },
    jelly: { w: 235, h: 145, count: 6 }
  };
  const { w, h, count } = bounds[type];

  return Array.from({ length: count }, () => ({
    x: WIDTH / 2 + (Math.random() - 0.5) * w,
    y: HEIGHT / 2 + (Math.random() - 0.5) * h
  }));
}

function getParticleColors(type: ObjectType, fallback: string) {
  const palettes: Partial<Record<ObjectType, string[]>> = {
    window: ["#eaffff", "#c9f5ff", "#ffffff", "#9fe1f7", "#dff9ff"],
    cup: ["#e8fbff", "#b7dfe5", "#ffffff", "#a6dadd"],
    plank: ["#7a4b29", "#a96d3a", "#c59565", "#e2b37d"],
    paper: ["#fffdf4", "#fff7df", "#eadfc9", "#ffffff"],
    laptop: ["#34374c", "#8f95aa", "#c9ccd8", "#94d4ef"],
    plate: ["#ffffff", "#f4efff", "#c5b3e0", "#a78cc9"],
    keyboard: ["#fff9fc", "#e9b5cc", "#2f3342", "#c9cad5"],
    monitor: ["#dff7ff", "#8aa0b8", "#3d435a", "#ffffff"],
    can: ["#ed9b95", "#d45d66", "#fff8e9", "#c9cbd3"],
    bubble: ["#f6fdff", "#cdebf5", "#ffffff", "#b4d6e4"],
    balloon: ["#f59fbf", "#ffd3e2", "#ff6f9a", "#ffffff"],
    ice: ["#e9fcff", "#a1dbea", "#ffffff", "#8fd4e7"],
    wall: ["#ce8f79", "#a86758", "#e3ad91", "#8d584a"],
    box: ["#d0ab7b", "#ebce9d", "#a98254", "#f3ddb8"],
    pencils: ["#eccb71", "#e8ac8c", "#5d4736", "#f5e2a8"],
    cookie: ["#c99868", "#8e6346", "#715041", "#e9c28c"],
    jelly: ["#b4caa0", "#dcecc7", "#7ea778", "#f4ffd9"]
  };

  return palettes[type] ?? [fallback];
}

function drawShockwaves(context: CanvasRenderingContext2D, shockwaves: Shockwave[], delta: number) {
  for (let index = shockwaves.length - 1; index >= 0; index -= 1) {
    const shockwave = shockwaves[index];
    const progress = 1 - shockwave.life / shockwave.maxLife;
    const radius = 14 + progress * 52;

    context.save();
    context.globalAlpha = Math.max(0, shockwave.life / shockwave.maxLife) * 0.22;
    context.strokeStyle = shockwave.color;
    context.lineWidth = 4;
    context.beginPath();
    context.arc(shockwave.x, shockwave.y, radius, 0, Math.PI * 2);
    context.stroke();
    context.restore();

    shockwave.life -= delta;
    if (shockwave.life <= 0) {
      shockwaves.splice(index, 1);
    }
  }
}

function drawParticles(context: CanvasRenderingContext2D, particles: Particle[], delta: number) {
  for (let index = particles.length - 1; index >= 0; index -= 1) {
    const particle = particles[index];
    particle.life -= delta;
    particle.vy += 0.18 * delta;
    particle.x += particle.vx * delta;
    particle.y += particle.vy * delta;
    particle.angle += particle.spin * delta;

    context.save();
    context.globalAlpha = Math.max(0, Math.min(1, particle.life / 88));
    context.translate(particle.x, particle.y);
    context.rotate(particle.angle);
    context.fillStyle = particle.color;
    context.strokeStyle = "rgba(54, 46, 60, 0.16)";
    context.lineWidth = 1;

    if (particle.square) {
      context.beginPath();
      context.roundRect(-particle.size, -particle.size * 0.7, particle.size * 2, particle.size * 1.35, 2);
      context.fill();
      context.stroke();
    } else {
      context.beginPath();
      context.moveTo(0, -particle.size * 1.12);
      context.lineTo(particle.size * 1.05, particle.size * 0.72);
      context.lineTo(-particle.size * 0.95, particle.size * 0.5);
      context.closePath();
      context.fill();
      context.stroke();
    }

    context.restore();

    if (particle.life <= 0 || particle.y > HEIGHT + 70) {
      particles.splice(index, 1);
    }
  }
}

function drawToast(context: CanvasRenderingContext2D, state: GameState) {
  if (state.toastAge <= 0) {
    return;
  }

  const alpha = Math.max(0, 1 - state.toastAge / 72);
  context.save();
  context.globalAlpha = alpha;
  context.fillStyle = "#f16d99";
  context.font = "800 28px Pretendard, system-ui, sans-serif";
  context.textAlign = "center";
  context.fillText("엔돌핀 +10", WIDTH / 2, 82 - state.toastAge * 0.45);
  context.restore();

  state.toastAge += 1;
  if (state.toastAge > 72) {
    state.toastAge = 0;
  }
}
