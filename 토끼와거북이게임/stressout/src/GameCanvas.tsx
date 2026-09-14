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
  maxLife: number;
  color: string;
  kind: "glass" | "keycap" | "wood" | "paper" | "metal" | "ember" | "ash";
  rotation: number;
  spin: number;
}

interface Toast {
  x: number;
  y: number;
  age: number;
}

interface BreakEffect {
  x: number;
  y: number;
  age: number;
  seed: number;
  type: ObjectType;
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
  const breaksRef = useRef<BreakEffect[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const toastsRef = useRef<Toast[]>([]);
  const damageRef = useRef(0);
  const shakeRef = useRef(0);
  const lastDragHitRef = useRef(0);
  const object = useMemo(() => getObject(objectType), [objectType]);

  useEffect(() => {
    marksRef.current = [];
    breaksRef.current = [];
    particlesRef.current = [];
    toastsRef.current = [];
    damageRef.current = 0;
    shakeRef.current = 0;
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

      if (screenShake && shakeRef.current > 0.05) {
        const shake = shakeRef.current;
        context.save();
        context.translate(Math.sin(frame * 1.8) * shake, Math.cos(frame * 2.2) * shake);
      }

      drawObject(context, objectType, width, height, damageRef.current);
      drawImpactMarks(context, marksRef.current, objectType, width, height);
      updateBreakEffects(context, breaksRef.current, width, height);

      if (screenShake && shakeRef.current > 0.05) {
        context.restore();
      }

      updateParticles(context, particlesRef.current, height);
      updateToasts(context, toastsRef.current);
      shakeRef.current *= 0.78;

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
    shakeRef.current = Math.min(3.2, 1.2 + damageRef.current * 0.28);
    marksRef.current.push({ x, y, age: 0, seed: Math.random() * 1000 });
    if (marksRef.current.length > 38) {
      marksRef.current.splice(0, marksRef.current.length - 38);
    }
    spawnParticles(particlesRef.current, objectType, x, y, particleCounts[particleLevel], false);
    playSound(object.sound, muted, volume);
    onHit(objectType);

    if (damageRef.current >= object.maxDamage) {
      breaksRef.current.push({ x, y, age: 0, seed: Math.random() * 1000, type: objectType });
      toastsRef.current.push({ x, y, age: 0 });
      shakeRef.current = 4.4;
      spawnParticles(
        particlesRef.current,
        objectType,
        x,
        y,
        particleCounts[particleLevel] * (objectType === "window" ? 5 : 3),
        true
      );
      if (objectType === "window") {
        spawnWindowCollapse(particlesRef.current, canvas.clientWidth, canvas.clientHeight, particleCounts[particleLevel] * 2);
      }
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
    const charLevel = Math.min(1, damage / 6);
    context.fillStyle = mixColor("#744322", "#2a211d", charLevel);
    roundRect(context, centerX - 45, centerY - 35, 90, 185, 12);
    context.fill();
    context.fillStyle = damage > 2 ? mixColor("#365e36", "#463b32", charLevel * 0.8) : "#2f6b3f";
    context.beginPath();
    context.arc(centerX, centerY - 90, 118 - damage * 4, 0, Math.PI * 2);
    context.fill();
    drawBarkLines(context, centerX, centerY, damage);
    drawTorch(context, centerX + 120, centerY + 84, damage);
    drawFlames(context, centerX + 58, centerY - 42, damage);
    drawSmoke(context, centerX - 18, centerY - 156, damage);
  }

  context.restore();
}

function drawImpactMarks(
  context: CanvasRenderingContext2D,
  marks: Mark[],
  type: ObjectType,
  width: number,
  height: number
) {
  if (type === "window") {
    clipWindow(context, width, height);
  }

  for (const mark of marks) {
    mark.age += 1;
    context.save();
    context.translate(mark.x, mark.y);
    context.rotate(mark.seed);

    if (type === "window") {
      drawGlassCrack(context, mark);
    } else if (type === "paper") {
      drawPaperTear(context, mark);
    } else if (type === "wood") {
      drawWoodSplit(context, mark);
    } else if (type === "can") {
      drawMetalDent(context, mark);
    } else if (type === "tree") {
      drawBurnMark(context, mark);
    } else {
      drawKeycapPop(context, mark);
    }

    context.restore();
  }

  if (type === "window") {
    context.restore();
  }
}

function drawGlassCrack(context: CanvasRenderingContext2D, mark: Mark) {
  context.strokeStyle = "rgba(231, 250, 255, 0.95)";
  context.lineWidth = 2;

  for (let i = 0; i < 9; i += 1) {
    const angle = (Math.PI * 2 * i) / 9 + Math.sin(mark.seed + i) * 0.18;
    const length = 18 + Math.abs(Math.sin(mark.seed * (i + 1))) * 42;
    context.beginPath();
    context.moveTo(0, 0);
    context.lineTo(Math.cos(angle) * length, Math.sin(angle) * length);
    context.stroke();
  }

  context.strokeStyle = "rgba(77, 124, 148, 0.55)";
  context.lineWidth = 1;
  for (let i = 0; i < 5; i += 1) {
    const radius = 10 + i * 8;
    context.beginPath();
    context.arc(0, 0, radius, Math.PI * 0.12 * i, Math.PI * (0.7 + i * 0.18));
    context.stroke();
  }
}

function drawPaperTear(context: CanvasRenderingContext2D, mark: Mark) {
  context.strokeStyle = "rgba(127, 118, 101, 0.55)";
  context.lineWidth = 3;
  context.beginPath();
  context.moveTo(-18, -8);
  context.lineTo(-7, 4);
  context.lineTo(6, -2);
  context.lineTo(18, 9);
  context.stroke();
}

function drawWoodSplit(context: CanvasRenderingContext2D, mark: Mark) {
  context.strokeStyle = "rgba(58, 31, 18, 0.72)";
  context.lineWidth = 4;
  context.beginPath();
  context.moveTo(-28, -7);
  context.lineTo(-8, 1);
  context.lineTo(8, -3);
  context.lineTo(30, 8);
  context.stroke();
}

function drawMetalDent(context: CanvasRenderingContext2D, mark: Mark) {
  context.strokeStyle = "rgba(105, 45, 54, 0.65)";
  context.lineWidth = 3;
  context.beginPath();
  context.ellipse(0, 0, 24, 11, 0.35, 0, Math.PI * 2);
  context.stroke();
}

function drawBurnMark(context: CanvasRenderingContext2D, mark: Mark) {
  const gradient = context.createRadialGradient(0, 0, 2, 0, 0, 34);
  gradient.addColorStop(0, "rgba(255, 122, 48, 0.5)");
  gradient.addColorStop(0.45, "rgba(60, 39, 28, 0.48)");
  gradient.addColorStop(1, "rgba(60, 39, 28, 0)");
  context.fillStyle = gradient;
  context.beginPath();
  context.arc(0, 0, 34, 0, Math.PI * 2);
  context.fill();
}

function drawKeycapPop(context: CanvasRenderingContext2D, mark: Mark) {
  context.strokeStyle = "rgba(255, 184, 207, 0.62)";
  context.lineWidth = 2;
  context.beginPath();
  context.arc(0, 0, 20, 0, Math.PI * 2);
  context.stroke();
}

function updateBreakEffects(
  context: CanvasRenderingContext2D,
  effects: BreakEffect[],
  width: number,
  height: number
) {
  for (let index = effects.length - 1; index >= 0; index -= 1) {
    const effect = effects[index];
    effect.age += 1;

    if (effect.type === "window") {
      drawWindowBreak(context, effect, width, height);
    }

    if (effect.age > 46) {
      effects.splice(index, 1);
    }
  }
}

function drawWindowBreak(context: CanvasRenderingContext2D, effect: BreakEffect, width: number, height: number) {
  const opacity = Math.max(0, 1 - effect.age / 46);

  clipWindow(context, width, height);
  context.globalCompositeOperation = "destination-out";
  context.globalAlpha = 0.82 * opacity;
  drawJaggedHole(context, effect.x, effect.y, 52 + effect.age * 0.7, effect.seed);
  context.restore();

  context.save();
  context.globalAlpha = opacity;
  context.strokeStyle = "rgba(255, 255, 255, 0.95)";
  context.lineWidth = 3;
  drawJaggedHole(context, effect.x, effect.y, 56 + effect.age * 0.7, effect.seed);
  context.stroke();
  context.restore();
}

function drawJaggedHole(context: CanvasRenderingContext2D, x: number, y: number, radius: number, seed: number) {
  context.beginPath();
  for (let i = 0; i < 14; i += 1) {
    const angle = (Math.PI * 2 * i) / 14;
    const jag = 0.64 + Math.abs(Math.sin(seed + i * 2.31)) * 0.52;
    const px = x + Math.cos(angle) * radius * jag;
    const py = y + Math.sin(angle) * radius * jag;
    if (i === 0) {
      context.moveTo(px, py);
    } else {
      context.lineTo(px, py);
    }
  }
  context.closePath();
  context.fill();
}

function clipWindow(context: CanvasRenderingContext2D, width: number, height: number) {
  const centerX = width / 2;
  const centerY = height / 2 + 8;
  context.save();
  roundRect(context, centerX - 150, centerY - 115, 300, 220, 6);
  context.clip();
}

function updateParticles(context: CanvasRenderingContext2D, particles: Particle[], height: number) {
  for (let index = particles.length - 1; index >= 0; index -= 1) {
    const particle = particles[index];
    particle.life -= 1;
    particle.rotation += particle.spin;
    particle.vy += particle.kind === "ember" || particle.kind === "ash" ? -0.02 : 0.18;
    particle.x += particle.vx;
    particle.y += particle.vy;

    context.save();
    context.translate(particle.x, particle.y);
    context.rotate(particle.rotation);
    context.globalAlpha = Math.max(0, particle.life / particle.maxLife);
    drawParticle(context, particle);
    context.restore();
    context.globalAlpha = 1;

    if (particle.life <= 0 || particle.y > height + 40) {
      particles.splice(index, 1);
    }
  }
}

function drawParticle(context: CanvasRenderingContext2D, particle: Particle) {
  context.fillStyle = particle.color;
  context.strokeStyle = "rgba(48, 51, 65, 0.16)";
  context.lineWidth = 1;

  if (particle.kind === "glass") {
    context.beginPath();
    context.moveTo(0, -particle.size * 0.9);
    context.lineTo(particle.size * 0.75, particle.size * 0.65);
    context.lineTo(-particle.size * 0.85, particle.size * 0.45);
    context.closePath();
    context.fill();
    context.stroke();
    return;
  }

  if (particle.kind === "keycap") {
    roundRect(context, -particle.size * 0.8, -particle.size * 0.55, particle.size * 1.6, particle.size * 1.1, 3);
    context.fill();
    context.stroke();
    return;
  }

  if (particle.kind === "wood") {
    context.beginPath();
    context.moveTo(-particle.size * 1.6, -particle.size * 0.25);
    context.lineTo(particle.size * 1.4, -particle.size * 0.1);
    context.lineTo(particle.size * 0.8, particle.size * 0.3);
    context.lineTo(-particle.size * 1.2, particle.size * 0.5);
    context.closePath();
    context.fill();
    return;
  }

  if (particle.kind === "paper") {
    context.beginPath();
    context.moveTo(-particle.size, -particle.size * 0.7);
    context.lineTo(particle.size * 0.9, -particle.size * 0.45);
    context.lineTo(particle.size * 0.7, particle.size * 0.75);
    context.lineTo(-particle.size * 0.75, particle.size * 0.5);
    context.closePath();
    context.fill();
    context.stroke();
    return;
  }

  if (particle.kind === "metal") {
    context.beginPath();
    context.ellipse(0, 0, particle.size * 1.1, particle.size * 0.45, 0, 0, Math.PI * 2);
    context.fill();
    context.stroke();
    return;
  }

  if (particle.kind === "ember") {
    const gradient = context.createRadialGradient(0, 0, 1, 0, 0, particle.size * 1.4);
    gradient.addColorStop(0, "#fff1a8");
    gradient.addColorStop(0.45, particle.color);
    gradient.addColorStop(1, "rgba(241, 109, 153, 0)");
    context.fillStyle = gradient;
    context.beginPath();
    context.arc(0, 0, particle.size * 1.4, 0, Math.PI * 2);
    context.fill();
    return;
  }

  context.fillStyle = "rgba(72, 61, 56, 0.55)";
  context.beginPath();
  context.arc(0, 0, particle.size * 0.6, 0, Math.PI * 2);
  context.fill();
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

function spawnParticles(particles: Particle[], type: ObjectType, x: number, y: number, count: number, burst: boolean) {
  const palette: Record<ObjectType, string[]> = {
    window: ["#dff7ff", "#a9e5ff", "#ffffff", "#8fcfff"],
    keyboard: ["#f6f7fb", "#303341", "#8e98a8", "#ffb8cf"],
    wood: ["#a96d3a", "#6d4124", "#d79a5f", "#4b2d1d"],
    paper: ["#fffef8", "#f5eedf", "#ffffff", "#eadfcc"],
    can: ["#e84d5b", "#f5c84c", "#c9d0d8", "#ffffff"],
    tree: ["#ff7a30", "#ffc447", "#3c6f40", "#554038"]
  };

  for (let i = 0; i < count; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const speed = (burst ? 5.5 : 2.6) + Math.random() * (burst ? 8 : 4);
    const kind = getParticleKind(type);
    const maxLife = Math.random() * 36 + (burst ? 44 : 28);

    particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - (burst ? 4 : 2),
      size: Math.random() * (burst ? 9 : 6) + 4,
      life: maxLife,
      maxLife,
      color: palette[type][Math.floor(Math.random() * palette[type].length)],
      kind,
      rotation: Math.random() * Math.PI,
      spin: (Math.random() - 0.5) * 0.28
    });
  }

  if (particles.length > 360) {
    particles.splice(0, particles.length - 360);
  }
}

function spawnWindowCollapse(particles: Particle[], width: number, height: number, count: number) {
  const centerX = width / 2;
  const centerY = height / 2 + 8;

  for (let i = 0; i < count; i += 1) {
    const paneX = centerX - 130 + Math.random() * 260;
    const paneY = centerY - 95 + Math.random() * 190;
    const maxLife = 70 + Math.random() * 42;

    particles.push({
      x: paneX,
      y: paneY,
      vx: (Math.random() - 0.5) * 11,
      vy: Math.random() * 4 - 1,
      size: 7 + Math.random() * 16,
      life: maxLife,
      maxLife,
      color: ["#eaffff", "#bcebff", "#ffffff", "#8ed7ff"][Math.floor(Math.random() * 4)],
      kind: "glass",
      rotation: Math.random() * Math.PI,
      spin: (Math.random() - 0.5) * 0.38
    });
  }
}

function getParticleKind(type: ObjectType): Particle["kind"] {
  if (type === "window") return "glass";
  if (type === "keyboard") return "keycap";
  if (type === "wood") return "wood";
  if (type === "paper") return "paper";
  if (type === "can") return "metal";
  return Math.random() > 0.35 ? "ember" : "ash";
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
  const flameCount = Math.max(2, Math.min(10, damage + 3));

  for (let i = 0; i < flameCount; i += 1) {
    const offsetX = -42 + i * 14 + Math.sin(performance.now() / 130 + i) * 3;
    const height = 44 + damage * 8 + Math.sin(performance.now() / 90 + i) * 6;
    context.fillStyle = i % 2 === 0 ? "#ff6b32" : "#ffc447";
    context.beginPath();
    context.moveTo(x + offsetX, y + 88);
    context.quadraticCurveTo(x + offsetX - 24, y + 54, x + offsetX, y + 88 - height);
    context.quadraticCurveTo(x + offsetX + 24, y + 56, x + offsetX, y + 88);
    context.fill();
  }
}

function drawTorch(context: CanvasRenderingContext2D, x: number, y: number, damage: number) {
  context.save();
  context.translate(x, y);
  context.rotate(-0.72);
  context.fillStyle = "#5a351f";
  roundRect(context, -9, -10, 18, 120, 7);
  context.fill();
  context.fillStyle = "#3b2b25";
  roundRect(context, -16, -22, 32, 28, 6);
  context.fill();
  context.fillStyle = "#ff6b32";
  context.beginPath();
  context.moveTo(0, -70 - damage * 2);
  context.quadraticCurveTo(-30, -24, 0, -4);
  context.quadraticCurveTo(30, -28, 0, -70 - damage * 2);
  context.fill();
  context.fillStyle = "#ffd166";
  context.beginPath();
  context.moveTo(0, -50 - damage);
  context.quadraticCurveTo(-14, -24, 0, -10);
  context.quadraticCurveTo(16, -26, 0, -50 - damage);
  context.fill();
  context.restore();
}

function drawBarkLines(context: CanvasRenderingContext2D, centerX: number, centerY: number, damage: number) {
  context.strokeStyle = "rgba(37, 27, 22, 0.5)";
  context.lineWidth = 3;

  for (let i = 0; i < 6; i += 1) {
    context.beginPath();
    context.moveTo(centerX - 28 + i * 11, centerY - 20);
    context.bezierCurveTo(
      centerX - 40 + i * 14,
      centerY + 22,
      centerX - 16 + i * 7,
      centerY + 68,
      centerX - 30 + i * 13,
      centerY + 136
    );
    context.stroke();
  }

  if (damage > 2) {
    context.fillStyle = "rgba(39, 31, 28, 0.45)";
    for (let i = 0; i < damage; i += 1) {
      context.beginPath();
      context.ellipse(centerX - 32 + i * 13, centerY + 4 + i * 19, 14, 9, i, 0, Math.PI * 2);
      context.fill();
    }
  }
}

function drawSmoke(context: CanvasRenderingContext2D, x: number, y: number, damage: number) {
  if (damage < 2) {
    return;
  }

  context.fillStyle = "rgba(91, 85, 84, 0.18)";
  for (let i = 0; i < damage; i += 1) {
    const drift = Math.sin(performance.now() / 500 + i) * 12;
    context.beginPath();
    context.arc(x + drift + i * 10, y - i * 22, 18 + i * 3, 0, Math.PI * 2);
    context.fill();
  }
}

function mixColor(from: string, to: string, amount: number) {
  const start = hexToRgb(from);
  const end = hexToRgb(to);
  const ratio = Math.max(0, Math.min(1, amount));

  return `rgb(${Math.round(start.r + (end.r - start.r) * ratio)}, ${Math.round(
    start.g + (end.g - start.g) * ratio
  )}, ${Math.round(start.b + (end.b - start.b) * ratio)})`;
}

function hexToRgb(hex: string) {
  return {
    r: Number.parseInt(hex.slice(1, 3), 16),
    g: Number.parseInt(hex.slice(3, 5), 16),
    b: Number.parseInt(hex.slice(5, 7), 16)
  };
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
