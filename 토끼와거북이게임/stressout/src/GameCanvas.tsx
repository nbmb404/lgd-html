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
  shakeUntil: number;
  stretch: number;
  toastAge: number;
}

const particleMultipliers: Record<ParticleLevel, number> = {
  low: 0.7,
  normal: 1,
  high: 1.55
};

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
    shakeUntil: 0,
    stretch: 0,
    toastAge: 0
  });
  const pointerRef = useRef<{ id: number; x: number; y: number; last: number } | null>(null);
  const object = useMemo(() => getObject(objectType), [objectType]);
  const particleMultiplier = particleMultipliers[particleLevel];

  useEffect(() => {
    stateRef.current = {
      damage: 0,
      marks: [],
      particles: [],
      shakeUntil: 0,
      stretch: 0,
      toastAge: 0
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

      drawParticles(context, state.particles, delta);
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
    state.marks = state.marks.slice(-44);
    state.stretch = Math.min(220, state.stretch + 34);

    const complete = state.damage >= object.maxDamage;
    spawnParticles(state.particles, x, y, object.color, complete, object.type, particleMultiplier);

    if (!muted) {
      playImpact(object.material, complete, volume);
    }

    onHit(object.type);

    if (complete) {
      state.toastAge = 1;
      state.shakeUntil = performance.now() + 130;
      spawnObjectBurst(state.particles, object.type, object.color, particleMultiplier);
      onDestroyed(object.type);
      state.damage = 0;
      state.marks = object.type === "bubble" ? [] : state.marks.slice(-12);
    } else {
      state.shakeUntil = performance.now() + 70;
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

function spawnParticles(
  particles: Particle[],
  x: number,
  y: number,
  color: string,
  burst: boolean,
  type: ObjectType,
  multiplier: number
) {
  const count = Math.round((burst ? 58 : 13) * multiplier);
  const square = ["keyboard", "paper", "wall", "box"].includes(type);

  for (let i = 0; i < count; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const speed = (burst ? 3.6 : 1.8) + Math.random() * (burst ? 7.5 : 3.4);

    particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - (burst ? 4.2 : 1.9),
      size: 4 + Math.random() * (burst ? 12 : 7),
      angle: Math.random() * Math.PI,
      spin: (Math.random() - 0.5) * 0.35,
      life: 52 + Math.random() * (burst ? 52 : 28),
      color,
      square
    });
  }

  if (particles.length > 420) {
    particles.splice(0, particles.length - 420);
  }
}

function spawnObjectBurst(particles: Particle[], type: ObjectType, color: string, multiplier: number) {
  const origins = type === "window" ? windowPaneOrigins() : [{ x: WIDTH / 2, y: HEIGHT / 2 }];

  origins.forEach((origin) => {
    spawnParticles(particles, origin.x, origin.y, color, true, type, multiplier * (type === "window" ? 0.72 : 1));
  });
}

function windowPaneOrigins() {
  const points = [];
  for (let i = 0; i < 18; i += 1) {
    points.push({
      x: 318 + Math.random() * 264,
      y: 128 + Math.random() * 264
    });
  }
  return points;
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
    context.globalAlpha = Math.max(0, Math.min(1, particle.life / 68));
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
      context.moveTo(0, -particle.size);
      context.lineTo(particle.size * 0.9, particle.size * 0.7);
      context.lineTo(-particle.size * 0.85, particle.size * 0.45);
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
