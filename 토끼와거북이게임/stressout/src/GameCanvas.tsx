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
const OBJECT_SCALE = 1.45;
const WINDOW_SCALE = 1.75;
const TREE_SCALE = 1.22;

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
  const scale = getRenderScale(type);

  context.save();
  context.translate(centerX, centerY);
  context.scale(scale, scale);
  context.translate(-centerX, -centerY);
  context.lineWidth = 4;
  context.lineJoin = "round";

  if (type === "window") {
    drawWindow(context, centerX, centerY);
  }

  if (type === "keyboard") {
    drawKeyboard(context, centerX, centerY, damage);
  }

  if (type === "wood") {
    drawWoodPlank(context, centerX, centerY, damage);
  }

  if (type === "paper") {
    drawPaperSheet(context, centerX, centerY, damage);
  }

  if (type === "can") {
    drawCan(context, centerX, centerY, damage);
  }

  if (type === "tree") {
    drawTree(context, centerX, centerY, damage);
  }

  context.restore();
}

function drawWindow(context: CanvasRenderingContext2D, centerX: number, centerY: number) {
  const frameGradient = context.createLinearGradient(centerX - 170, centerY - 130, centerX + 170, centerY + 130);
  frameGradient.addColorStop(0, "#406678");
  frameGradient.addColorStop(0.5, "#6f94a5");
  frameGradient.addColorStop(1, "#315264");

  context.fillStyle = "#fdf8fb";
  roundRect(context, centerX - 165, centerY - 130, 330, 260, 13);
  context.fill();

  context.fillStyle = frameGradient;
  roundRect(context, centerX - 157, centerY - 122, 314, 244, 11);
  context.fill();

  const glassGradient = context.createLinearGradient(centerX - 142, centerY - 110, centerX + 142, centerY + 108);
  glassGradient.addColorStop(0, "#d9f4ff");
  glassGradient.addColorStop(0.48, "#bfe5fa");
  glassGradient.addColorStop(1, "#a9d5ef");
  context.fillStyle = glassGradient;
  roundRect(context, centerX - 142, centerY - 108, 284, 216, 5);
  context.fill();

  context.strokeStyle = "#406678";
  context.lineWidth = 7;
  context.beginPath();
  context.moveTo(centerX, centerY - 112);
  context.lineTo(centerX, centerY + 112);
  context.moveTo(centerX - 148, centerY);
  context.lineTo(centerX + 148, centerY);
  context.stroke();

  context.strokeStyle = "rgba(255, 255, 255, 0.78)";
  context.lineWidth = 5;
  context.beginPath();
  context.moveTo(centerX - 112, centerY - 82);
  context.lineTo(centerX - 58, centerY - 106);
  context.moveTo(centerX + 42, centerY + 78);
  context.lineTo(centerX + 112, centerY + 22);
  context.stroke();
}

function drawKeyboard(context: CanvasRenderingContext2D, centerX: number, centerY: number, damage: number) {
  const crush = Math.min(22, damage * 3);
  const top = centerY - 78 + crush;
  const height = 164 - crush * 1.8;
  const bodyGradient = context.createLinearGradient(centerX - 190, top, centerX + 190, top + height);
  bodyGradient.addColorStop(0, "#fff6fb");
  bodyGradient.addColorStop(0.42, "#f3bfd1");
  bodyGradient.addColorStop(1, "#a86178");

  context.fillStyle = bodyGradient;
  context.strokeStyle = "#8f5367";
  context.lineWidth = 4;
  roundRect(context, centerX - 195, top, 390, height, 18);
  context.fill();
  context.stroke();

  for (let row = 0; row < 4; row += 1) {
    for (let col = 0; col < 10; col += 1) {
      const index = row * 10 + col;
      const missing = Math.sin(row * 9 + col * 13 + damage) > 0.78 - damage * 0.05;
      if (missing || index > 35) {
        continue;
      }

      const keyWidth = index === 35 ? 96 : 28;
      const keyX = centerX - 174 + col * 35;
      const keyY = top + 20 + row * 34;
      context.fillStyle = index % 7 === 0 ? "#f29abe" : "#fffafe";
      context.strokeStyle = "rgba(111, 74, 91, 0.32)";
      context.lineWidth = 2;
      roundRect(context, keyX, keyY, keyWidth, 24, 5);
      context.fill();
      context.stroke();
    }
  }
}

function drawWoodPlank(context: CanvasRenderingContext2D, centerX: number, centerY: number, damage: number) {
  const plankGradient = context.createLinearGradient(centerX - 185, centerY - 70, centerX + 185, centerY + 70);
  plankGradient.addColorStop(0, "#d19b62");
  plankGradient.addColorStop(0.45, "#a86d3b");
  plankGradient.addColorStop(1, "#70401f");

  context.fillStyle = plankGradient;
  context.strokeStyle = "#5a331e";
  context.lineWidth = 5;
  roundRect(context, centerX - 188, centerY - 70, 376, 140, 8);
  context.fill();
  context.stroke();

  context.strokeStyle = "rgba(89, 49, 25, 0.42)";
  context.lineWidth = 2;
  for (let i = 0; i < 8; i += 1) {
    const y = centerY - 52 + i * 15;
    context.beginPath();
    context.moveTo(centerX - 174, y);
    context.bezierCurveTo(centerX - 85, y - 18, centerX + 30, y + 20, centerX + 174, y - 4);
    context.stroke();
  }

  context.strokeStyle = "rgba(51, 28, 15, 0.75)";
  context.lineWidth = 5;
  context.beginPath();
  context.moveTo(centerX - damage * 11, centerY - 65);
  context.lineTo(centerX + 12, centerY - 22);
  context.lineTo(centerX - 8, centerY + 12);
  context.lineTo(centerX + damage * 12, centerY + 65);
  context.stroke();

  context.strokeStyle = "#6b3d22";
  context.lineWidth = 3;
  context.beginPath();
  context.ellipse(centerX + 82, centerY + 10, 32, 14, -0.2, 0, Math.PI * 2);
  context.stroke();
}

function drawPaperSheet(context: CanvasRenderingContext2D, centerX: number, centerY: number, damage: number) {
  const fold = Math.min(34, damage * 8);
  context.fillStyle = "#fffdf7";
  context.strokeStyle = "#d4cab9";
  context.lineWidth = 3;
  context.beginPath();
  context.moveTo(centerX - 125, centerY - 150);
  context.lineTo(centerX + 95, centerY - 144 + fold * 0.3);
  context.lineTo(centerX + 122, centerY + 118);
  context.lineTo(centerX - 108 + fold * 0.25, centerY + 150);
  context.closePath();
  context.fill();
  context.stroke();

  context.fillStyle = "#f1e9da";
  context.beginPath();
  context.moveTo(centerX + 92, centerY - 143 + fold * 0.3);
  context.lineTo(centerX + 123, centerY - 108 + fold * 0.25);
  context.lineTo(centerX + 80, centerY - 111);
  context.closePath();
  context.fill();
  context.stroke();

  context.strokeStyle = "rgba(128, 115, 99, 0.22)";
  context.lineWidth = 2;
  for (let i = 0; i < 8; i += 1) {
    context.beginPath();
    context.moveTo(centerX - 88, centerY - 84 + i * 27);
    context.lineTo(centerX + 74, centerY - 82 + i * 26);
    context.stroke();
  }

  context.fillStyle = "#d94c7b";
  context.font = "700 16px Pretendard, system-ui, sans-serif";
  context.fillText("오늘의 스트레스", centerX - 86, centerY - 112);
}

function drawTree(context: CanvasRenderingContext2D, centerX: number, centerY: number, damage: number) {
  const charLevel = Math.min(1, damage / 6);
  const crownGradient = context.createRadialGradient(centerX - 45, centerY - 126, 12, centerX, centerY - 92, 150);
  crownGradient.addColorStop(0, "#6fba68");
  crownGradient.addColorStop(0.55, mixColor("#3f8a4c", "#554038", charLevel * 0.65));
  crownGradient.addColorStop(1, mixColor("#285d35", "#322925", charLevel * 0.8));

  context.fillStyle = crownGradient;
  drawLeafBlob(context, centerX - 78, centerY - 102, 58, 50);
  drawLeafBlob(context, centerX - 24, centerY - 142, 66, 58);
  drawLeafBlob(context, centerX + 48, centerY - 108, 64, 52);
  drawLeafBlob(context, centerX + 4, centerY - 76, 78, 54);
  drawLeafBlob(context, centerX - 42, centerY - 68, 54, 40);

  const trunkGradient = context.createLinearGradient(centerX - 54, centerY - 38, centerX + 58, centerY + 158);
  trunkGradient.addColorStop(0, mixColor("#9a5c2f", "#3a2a22", charLevel));
  trunkGradient.addColorStop(0.48, mixColor("#744322", "#251c18", charLevel));
  trunkGradient.addColorStop(1, "#4a2b18");
  context.fillStyle = trunkGradient;
  context.strokeStyle = "#3a2216";
  context.lineWidth = 4;

  context.beginPath();
  context.moveTo(centerX - 46, centerY + 154);
  context.bezierCurveTo(centerX - 32, centerY + 86, centerX - 42, centerY + 28, centerX - 20, centerY - 28);
  context.lineTo(centerX + 24, centerY - 28);
  context.bezierCurveTo(centerX + 44, centerY + 38, centerX + 34, centerY + 88, centerX + 54, centerY + 154);
  context.closePath();
  context.fill();
  context.stroke();

  context.strokeStyle = "rgba(39, 25, 18, 0.55)";
  context.lineWidth = 3;
  drawBranch(context, centerX - 8, centerY + 4, centerX - 82, centerY - 62);
  drawBranch(context, centerX + 12, centerY - 12, centerX + 76, centerY - 74);
  drawBarkLines(context, centerX, centerY, damage);
  drawTorch(context, centerX + 128, centerY + 90, damage);
  drawFlames(context, centerX + 55, centerY - 55, damage);
  drawSmoke(context, centerX - 18, centerY - 170, damage);
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

function drawCan(context: CanvasRenderingContext2D, centerX: number, centerY: number, damage: number) {
  const crush = Math.min(68, damage * 16);
  const topY = centerY - 116 + crush * 0.55;
  const bottomY = centerY + 116 - crush * 0.35;
  const bodyWidth = 142 + Math.sin(damage * 1.7) * 9;
  const left = centerX - bodyWidth / 2;
  const right = centerX + bodyWidth / 2;

  const bodyGradient = context.createLinearGradient(left, topY, right, topY);
  bodyGradient.addColorStop(0, "#ad2437");
  bodyGradient.addColorStop(0.18, "#e8455a");
  bodyGradient.addColorStop(0.52, "#ff6f82");
  bodyGradient.addColorStop(0.82, "#d7354b");
  bodyGradient.addColorStop(1, "#922032");

  context.fillStyle = bodyGradient;
  context.beginPath();
  context.moveTo(left, topY);
  context.bezierCurveTo(left - 10, centerY - 42, left + 18, centerY + 46, left + 8, bottomY);
  context.quadraticCurveTo(centerX, bottomY + 22, right - 8, bottomY);
  context.bezierCurveTo(right - 18, centerY + 46, right + 10, centerY - 42, right, topY);
  context.quadraticCurveTo(centerX, topY + 19, left, topY);
  context.fill();

  context.fillStyle = "#fff3a3";
  context.beginPath();
  context.moveTo(left + 4, centerY - 30);
  context.bezierCurveTo(centerX - 28, centerY - 14 - damage * 4, centerX + 24, centerY - 46 + damage * 4, right - 4, centerY - 28);
  context.lineTo(right - 8, centerY + 28);
  context.bezierCurveTo(centerX + 18, centerY + 46 - damage * 3, centerX - 24, centerY + 18 + damage * 3, left + 8, centerY + 28);
  context.closePath();
  context.fill();

  context.fillStyle = "#f3f6fb";
  context.strokeStyle = "#8b94a3";
  context.lineWidth = 3;
  context.beginPath();
  context.ellipse(centerX, topY, bodyWidth / 2, 22, 0, 0, Math.PI * 2);
  context.fill();
  context.stroke();

  context.strokeStyle = "#c3cad4";
  context.lineWidth = 5;
  context.beginPath();
  context.ellipse(centerX + 10, topY - 2, 32, 8, -0.1, 0, Math.PI * 2);
  context.stroke();

  context.strokeStyle = "rgba(95, 37, 48, 0.42)";
  context.lineWidth = 3;
  for (let i = 0; i < damage + 2; i += 1) {
    const y = topY + 34 + i * 24;
    context.beginPath();
    context.moveTo(left + 10, y);
    context.bezierCurveTo(centerX - 34, y - 16, centerX + 24, y + 18, right - 12, y - 4);
    context.stroke();
  }

  context.fillStyle = "#cbd2dd";
  context.beginPath();
  context.ellipse(centerX, bottomY, bodyWidth / 2 - 8, 17, 0, 0, Math.PI * 2);
  context.fill();
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
  roundRect(
    context,
    centerX - 150 * WINDOW_SCALE,
    centerY - 115 * WINDOW_SCALE,
    300 * WINDOW_SCALE,
    220 * WINDOW_SCALE,
    8
  );
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
  const paneWidth = 260 * WINDOW_SCALE;
  const paneHeight = 190 * WINDOW_SCALE;

  for (let i = 0; i < count; i += 1) {
    const paneX = centerX - paneWidth / 2 + Math.random() * paneWidth;
    const paneY = centerY - paneHeight / 2 + Math.random() * paneHeight;
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

function getRenderScale(type: ObjectType) {
  if (type === "tree") return TREE_SCALE;
  return type === "window" ? WINDOW_SCALE : OBJECT_SCALE;
}

function isInsideObject(type: ObjectType, x: number, y: number, width: number, height: number) {
  const centerX = width / 2;
  const centerY = height / 2 + 8;
  const scale = getRenderScale(type);
  const localX = centerX + (x - centerX) / scale;
  const localY = centerY + (y - centerY) / scale;

  if (type === "window") return localX > centerX - 150 && localX < centerX + 150 && localY > centerY - 115 && localY < centerY + 105;
  if (type === "keyboard") return localX > centerX - 180 && localX < centerX + 180 && localY > centerY - 80 && localY < centerY + 80;
  if (type === "wood") return localX > centerX - 170 && localX < centerX + 170 && localY > centerY - 65 && localY < centerY + 65;
  if (type === "paper") return localX > centerX - 130 && localX < centerX + 130 && localY > centerY - 145 && localY < centerY + 145;
  if (type === "can") return localX > centerX - 82 && localX < centerX + 82 && localY > centerY - 128 && localY < centerY + 128;
  return (localX - centerX) ** 2 + (localY - (centerY - 55)) ** 2 < 160 ** 2;
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

function drawLeafBlob(context: CanvasRenderingContext2D, x: number, y: number, radiusX: number, radiusY: number) {
  context.beginPath();
  context.ellipse(x, y, radiusX, radiusY, -0.14, 0, Math.PI * 2);
  context.fill();
}

function drawBranch(
  context: CanvasRenderingContext2D,
  startX: number,
  startY: number,
  endX: number,
  endY: number
) {
  context.beginPath();
  context.moveTo(startX, startY);
  context.quadraticCurveTo((startX + endX) / 2, startY - 32, endX, endY);
  context.stroke();
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
