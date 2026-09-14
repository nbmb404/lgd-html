import { useEffect, useMemo, useRef } from "react";
import type { ObjectType, ParticleLevel } from "./api";
import { getObject, particleCounts } from "./game";

interface GameCanvasProps {
  objectType: ObjectType;
  muted: boolean;
  volume: number;
  screenShake: boolean;
  particleLevel: ParticleLevel;
  onHit: (type: ObjectType) => void;
  onDestroyed: (type: ObjectType) => void;
}

interface Mark {
  x: number;
  y: number;
  age: number;
  seed: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  life: number;
  color: string;
}

interface Toast {
  x: number;
  y: number;
  age: number;
}

const audioContextRef: { current: AudioContext | null } = { current: null };

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
  const marksRef = useRef<Mark[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const toastsRef = useRef<Toast[]>([]);
  const damageRef = useRef(0);
  const lastDragHitRef = useRef(0);
  const object = useMemo(() => getObject(objectType), [objectType]);

  useEffect(() => {
    marksRef.current = [];
    particlesRef.current = [];
    toastsRef.current = [];
    damageRef.current = 0;
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

    let frame = 0;
    let animationId = 0;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const ratio = window.devicePixelRatio || 1;
      canvas.width = Math.floor(rect.width * ratio);
      canvas.height = Math.floor(rect.height * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
    };

    const draw = () => {
      frame += 1;
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      context.clearRect(0, 0, width, height);
      drawBackdrop(context, width, height);

      if (screenShake && damageRef.current > 0) {
        const shake = Math.min(6, damageRef.current) * 0.45;
        context.save();
        context.translate(Math.sin(frame * 0.7) * shake, Math.cos(frame * 0.9) * shake);
      }

      drawObject(context, objectType, width, height, damageRef.current);
      drawMarks(context, marksRef.current, objectType);

      if (screenShake && damageRef.current > 0) {
        context.restore();
      }

      updateParticles(context, particlesRef.current, height);
      updateToasts(context, toastsRef.current);

      animationId = requestAnimationFrame(draw);
    };

    resize();
    draw();
    window.addEventListener("resize", resize);

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener("resize", resize);
    };
  }, [objectType, screenShake]);

  const strike = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    if (!isInsideObject(objectType, x, y, canvas.clientWidth, canvas.clientHeight)) {
      return;
    }

    const now = performance.now();
    if (event.buttons === 1 && now - lastDragHitRef.current < 80) {
      return;
    }
    lastDragHitRef.current = now;

    damageRef.current += 1;
    marksRef.current.push({ x, y, age: 0, seed: Math.random() * 1000 });
    if (marksRef.current.length > 38) {
      marksRef.current.splice(0, marksRef.current.length - 38);
    }
    spawnParticles(particlesRef.current, objectType, x, y, particleCounts[particleLevel]);
    playSound(object.sound, muted, volume);
    onHit(objectType);

    if (damageRef.current >= object.maxDamage) {
      toastsRef.current.push({ x, y, age: 0 });
      spawnParticles(particlesRef.current, objectType, x, y, particleCounts[particleLevel] * 2);
      playSound(object.sound, muted, Math.min(100, volume + 15));
      onDestroyed(objectType);
      damageRef.current = Math.max(1, damageRef.current % object.maxDamage);
    }
  };

  return (
    <canvas
      ref={canvasRef}
      className="game-canvas"
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        strike(event);
      }}
      onPointerMove={(event) => {
        if (event.buttons === 1) {
          strike(event);
        }
      }}
    />
  );
}

function drawBackdrop(context: CanvasRenderingContext2D, width: number, height: number) {
  const gradient = context.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, "#fff0f6");
  gradient.addColorStop(0.45, "#fff7fb");
  gradient.addColorStop(1, "#f4f7ff");
  context.fillStyle = gradient;
  context.fillRect(0, 0, width, height);

  context.fillStyle = "rgba(255, 109, 153, 0.1)";
  context.fillRect(0, height - 32, width, 32);
}

function drawObject(
  context: CanvasRenderingContext2D,
  type: ObjectType,
  width: number,
  height: number,
  damage: number
) {
  const centerX = width / 2;
  const centerY = height / 2 + 8;

  context.save();
  context.lineWidth = 4;
  context.lineJoin = "round";

  if (type === "window") {
    context.strokeStyle = "#557b8d";
    context.fillStyle = "rgba(178, 225, 255, 0.72)";
    roundRect(context, centerX - 150, centerY - 115, 300, 220, 6);
    context.fill();
    context.stroke();
    context.beginPath();
    context.moveTo(centerX, centerY - 115);
    context.lineTo(centerX, centerY + 105);
    context.moveTo(centerX - 150, centerY);
    context.lineTo(centerX + 150, centerY);
    context.stroke();
  }

  if (type === "keyboard") {
    context.fillStyle = "#1f242b";
    roundRect(context, centerX - 180, centerY - 70 + damage * 2, 360, 140 - damage * 5, 8);
    context.fill();
    for (let row = 0; row < 4; row += 1) {
      for (let col = 0; col < 10; col += 1) {
        const missing = Math.sin(row * 9 + col * 13 + damage) > 0.78 - damage * 0.05;
        if (!missing) {
          context.fillStyle = "#e8ecef";
          roundRect(context, centerX - 154 + col * 31, centerY - 48 + row * 28, 22, 18, 4);
          context.fill();
        }
      }
    }
  }

  if (type === "wood") {
    context.fillStyle = "#9b6437";
    roundRect(context, centerX - 170, centerY - 55, 340, 110, 4);
    context.fill();
    context.strokeStyle = "#5a331e";
    for (let i = 0; i < 7; i += 1) {
      context.beginPath();
      context.moveTo(centerX - 150 + i * 50, centerY - 45);
      context.lineTo(centerX - 130 + i * 42, centerY + 45);
      context.stroke();
    }
  }

  if (type === "paper") {
    context.fillStyle = "#faf7ef";
    context.strokeStyle = "#c9c0ad";
    context.beginPath();
    context.moveTo(centerX - 115, centerY - 135);
    context.lineTo(centerX + 115, centerY - 118 + damage * 4);
    context.lineTo(centerX + 95 - damage * 6, centerY + 135);
    context.lineTo(centerX - 125 + damage * 4, centerY + 112);
    context.closePath();
    context.fill();
    context.stroke();
    context.strokeStyle = "rgba(80, 80, 80, 0.2)";
    for (let i = 0; i < 6; i += 1) {
      context.beginPath();
      context.moveTo(centerX - 85, centerY - 82 + i * 32);
      context.lineTo(centerX + 75, centerY - 72 + i * 30);
      context.stroke();
    }
  }

  if (type === "can") {
    const canHeight = Math.max(90, 220 - damage * 20);
    context.fillStyle = "#d9483b";
    roundRect(context, centerX - 70, centerY - canHeight / 2, 140, canHeight, 26);
    context.fill();
    context.fillStyle = "#f7c24a";
    context.fillRect(centerX - 70, centerY - 25, 140, 50);
    context.strokeStyle = "#7f2a2a";
    context.stroke();
  }

  if (type === "tree") {
    context.fillStyle = "#744322";
    roundRect(context, centerX - 45, centerY - 35, 90, 185, 12);
    context.fill();
    context.fillStyle = damage > 2 ? "#365e36" : "#2f6b3f";
    context.beginPath();
    context.arc(centerX, centerY - 90, 118 - damage * 4, 0, Math.PI * 2);
    context.fill();
    drawFlames(context, centerX + 65, centerY - 25, damage);
  }

  context.restore();
}

function drawMarks(context: CanvasRenderingContext2D, marks: Mark[], type: ObjectType) {
  for (const mark of marks) {
    mark.age += 1;
    context.save();
    context.translate(mark.x, mark.y);
    context.rotate(mark.seed);
    context.strokeStyle = type === "tree" ? "rgba(239, 94, 45, 0.78)" : "rgba(22, 35, 45, 0.72)";
    context.lineWidth = type === "paper" ? 2 : 3;

    for (let i = 0; i < 7; i += 1) {
      const angle = (Math.PI * 2 * i) / 7;
      const length = 18 + (i % 3) * 12 + Math.min(34, mark.age * 0.4);
      context.beginPath();
      context.moveTo(0, 0);
      context.lineTo(Math.cos(angle) * length, Math.sin(angle) * length);
      context.stroke();
    }

    context.restore();
  }
}

function updateParticles(context: CanvasRenderingContext2D, particles: Particle[], height: number) {
  for (let index = particles.length - 1; index >= 0; index -= 1) {
    const particle = particles[index];
    particle.life -= 1;
    particle.vy += 0.18;
    particle.x += particle.vx;
    particle.y += particle.vy;

    context.globalAlpha = Math.max(0, particle.life / 58);
    context.fillStyle = particle.color;
    context.fillRect(particle.x, particle.y, particle.size, particle.size);
    context.globalAlpha = 1;

    if (particle.life <= 0 || particle.y > height + 40) {
      particles.splice(index, 1);
    }
  }
}

function updateToasts(context: CanvasRenderingContext2D, toasts: Toast[]) {
  for (let index = toasts.length - 1; index >= 0; index -= 1) {
    const toast = toasts[index];
    toast.age += 1;
    context.globalAlpha = Math.max(0, 1 - toast.age / 90);
    context.fillStyle = "#f16d99";
    context.font = "700 28px Pretendard, system-ui, sans-serif";
    context.textAlign = "center";
    context.fillText("엔돌핀 +10", toast.x, toast.y - toast.age * 0.75);
    context.globalAlpha = 1;

    if (toast.age > 90) {
      toasts.splice(index, 1);
    }
  }
}

function spawnParticles(particles: Particle[], type: ObjectType, x: number, y: number, count: number) {
  const palette: Record<ObjectType, string[]> = {
    window: ["#d4f1ff", "#9fd8ff", "#ffffff"],
    keyboard: ["#e8ecef", "#20242a", "#7d8792"],
    wood: ["#9b6437", "#6a3f22", "#c4935d"],
    paper: ["#faf7ef", "#ded5c5", "#ffffff"],
    can: ["#d9483b", "#f7c24a", "#c9d0d8"],
    tree: ["#f46d2f", "#ffbd45", "#2f6b3f"]
  };

  for (let i = 0; i < count; i += 1) {
    particles.push({
      x,
      y,
      vx: (Math.random() - 0.5) * 9,
      vy: -Math.random() * 7 - 1,
      size: Math.random() * 9 + 3,
      life: Math.random() * 36 + 32,
      color: palette[type][Math.floor(Math.random() * palette[type].length)]
    });
  }
}

function isInsideObject(type: ObjectType, x: number, y: number, width: number, height: number) {
  const centerX = width / 2;
  const centerY = height / 2 + 8;

  if (type === "window") return x > centerX - 150 && x < centerX + 150 && y > centerY - 115 && y < centerY + 105;
  if (type === "keyboard") return x > centerX - 180 && x < centerX + 180 && y > centerY - 80 && y < centerY + 80;
  if (type === "wood") return x > centerX - 170 && x < centerX + 170 && y > centerY - 65 && y < centerY + 65;
  if (type === "paper") return x > centerX - 130 && x < centerX + 130 && y > centerY - 145 && y < centerY + 145;
  if (type === "can") return x > centerX - 80 && x < centerX + 80 && y > centerY - 120 && y < centerY + 120;
  return (x - centerX) ** 2 + (y - (centerY - 55)) ** 2 < 160 ** 2;
}

function drawFlames(context: CanvasRenderingContext2D, x: number, y: number, damage: number) {
  if (damage <= 0) {
    context.fillStyle = "#5f3920";
    roundRect(context, x + 38, y + 92, 12, 92, 5);
    context.fill();
    context.fillStyle = "#ef5e2d";
    context.beginPath();
    context.moveTo(x + 44, y + 78);
    context.quadraticCurveTo(x + 18, y + 118, x + 44, y + 130);
    context.quadraticCurveTo(x + 68, y + 110, x + 44, y + 78);
    context.fill();
    return;
  }

  for (let i = 0; i < Math.min(7, damage + 2); i += 1) {
    context.fillStyle = i % 2 === 0 ? "#ef5e2d" : "#ffbd45";
    context.beginPath();
    context.moveTo(x - i * 16, y + 60 + i * 12);
    context.quadraticCurveTo(x - 26 + i * 8, y + 20 + i * 4, x + 6, y + 60 + i * 9);
    context.quadraticCurveTo(x + 24, y + 94, x - i * 16, y + 60 + i * 12);
    context.fill();
  }
}

function roundRect(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  context.beginPath();
  context.roundRect(x, y, width, height, radius);
}

function playSound(sound: string, muted: boolean, volume: number) {
  if (muted || volume <= 0) {
    return;
  }

  const AudioCtor = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtor) {
    return;
  }

  audioContextRef.current ??= new AudioCtor();
  const audio = audioContextRef.current;
  const oscillator = audio.createOscillator();
  const gain = audio.createGain();
  const baseVolume = volume / 100;

  const settings: Record<string, { frequency: number; type: OscillatorType; duration: number }> = {
    glass: { frequency: 920, type: "triangle", duration: 0.18 },
    wood: { frequency: 170, type: "sawtooth", duration: 0.14 },
    paper: { frequency: 380, type: "square", duration: 0.08 },
    metal: { frequency: 260, type: "triangle", duration: 0.15 },
    plastic: { frequency: 520, type: "square", duration: 0.09 },
    fire: { frequency: 130, type: "sawtooth", duration: 0.2 }
  };

  const tone = settings[sound] ?? settings.glass;
  oscillator.frequency.value = tone.frequency + Math.random() * 90;
  oscillator.type = tone.type;
  gain.gain.setValueAtTime(0.0001, audio.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.18 * baseVolume, audio.currentTime + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + tone.duration);
  oscillator.connect(gain);
  gain.connect(audio.destination);
  oscillator.start();
  oscillator.stop(audio.currentTime + tone.duration);
}

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
  }
}
