import type { Destructible } from "./game";

export const WIDTH = 900;
export const HEIGHT = 520;

export type Mark = { x: number; y: number; seed: number };
export type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  angle: number;
  spin: number;
  life: number;
  color: string;
  square: boolean;
};

export function drawObject(
  ctx: CanvasRenderingContext2D,
  object: Destructible,
  damage: number,
  marks: Mark[],
  stretch: number
) {
  ctx.save();
  ctx.translate(450, 260);
  const ratio = damage / object.maxDamage;

  if (["can", "box"].includes(object.type)) {
    ctx.translate(0, ratio * 72);
    ctx.scale(1 + ratio * 0.18, 1 - ratio * 0.5);
  }

  if (object.type === "jelly") {
    ctx.scale(1 + Math.min(stretch / 180, 0.7), 1 - Math.min(stretch / 500, 0.3));
  }

  if (object.type === "laptop") {
    ctx.scale(1 - ratio * 0.55, 1);
    ctx.rotate(ratio * 0.22);
  }

  ctx.fillStyle = object.color;
  ctx.strokeStyle = "#555163";
  ctx.lineWidth = 4;
  ctx.lineJoin = "round";

  function rect(x: number, y: number, w: number, h: number, radius = 12, color = object.color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, radius);
    ctx.fill();
    ctx.stroke();
  }

  function ellipse(x: number, y: number, rx: number, ry: number, color = object.color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  function line(points: number[][]) {
    ctx.beginPath();
    points.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.stroke();
  }

  switch (object.type) {
    case "window":
      rect(-153, -153, 306, 306, 9, "#fffaf1");
      rect(-135, -135, 270, 270, 2);
      ctx.strokeStyle = "#eefeff";
      ctx.lineWidth = 10;
      line([
        [-104, -60],
        [-50, -114]
      ]);
      line([
        [48, 96],
        [106, 38]
      ]);
      ctx.strokeStyle = "#fffaf1";
      ctx.lineWidth = 14;
      line([
        [0, -140],
        [0, 140]
      ]);
      line([
        [-140, 0],
        [140, 0]
      ]);
      break;
    case "cup":
      ctx.beginPath();
      ctx.moveTo(-90, -110);
      ctx.lineTo(-68, 120);
      ctx.quadraticCurveTo(0, 146, 68, 120);
      ctx.lineTo(90, -110);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ellipse(0, -110, 90, 23, "#effbfc");
      ctx.strokeStyle = "#f8ffff";
      ctx.lineWidth = 9;
      line([
        [-55, -65],
        [-43, 75]
      ]);
      break;
    case "plank":
      rect(-185, -74, 370, 148, 5);
      ctx.strokeStyle = "#9b6a42";
      ctx.lineWidth = 2;
      for (let i = 0; i < 6; i += 1) {
        line([
          [-172, -55 + i * 23],
          [-40, -48 + i * 21],
          [170, -55 + i * 24]
        ]);
      }
      ellipse(64, 0, 28, 12);
      break;
    case "paper":
      rect(-115, -145, 230, 290, 3);
      ctx.strokeStyle = "#d6cdbc";
      ctx.lineWidth = 2;
      for (let i = 0; i < 7; i += 1) {
        line([
          [-85, -70 + i * 25],
          [80, -70 + i * 25]
        ]);
      }
      ctx.fillStyle = "#c99a91";
      ctx.font = "bold 19px sans-serif";
      ctx.fillText("오늘의 스트레스", -84, -106);
      break;
    case "monitor":
    case "laptop":
      rect(-168, -125, 336, 215, 14, "#77768b");
      rect(-151, -108, 302, 178, 5, ratio > 0.5 ? "#3c4056" : "#b9cdd7");
      ctx.fillStyle = "#f8ffff";
      ctx.font = "28px monospace";
      ctx.fillText(ratio > 0.5 ? "..." : "잠시 쉬어가기", -98, -12);
      if (object.type === "laptop") {
        rect(-187, 92, 374, 28, 7, "#c8cad6");
      } else {
        rect(-20, 91, 40, 45, 3, "#77768b");
        rect(-80, 136, 160, 12, 4, "#b9b9c8");
      }
      break;
    case "plate":
      ellipse(0, 0, 147, 147, "#faf5ff");
      ctx.strokeStyle = "#bda6d4";
      ctx.lineWidth = 6;
      ellipse(0, 0, 115, 115, "#ece2f6");
      ellipse(0, 0, 98, 98, "#f8f3ff");
      break;
    case "keyboard":
      rect(-195, -86, 390, 172, 15, "#f6e6ed");
      for (let i = 0; i < 36; i += 1) {
        if (i < damage * 5) continue;
        rect(
          -180 + (i % 10) * 36,
          -68 + Math.floor(i / 10) * 37,
          i === 35 ? 165 : 28,
          27,
          4,
          i % 7 === 0 ? "#e7a3bc" : "#fff9fc"
        );
      }
      break;
    case "can":
      rect(-78, -110, 156, 235, 18);
      ellipse(0, -108, 78, 22, "#dddde1");
      ellipse(0, -110, 22, 8, "#a2a3b1");
      ctx.fillStyle = "#fff8e9";
      ctx.font = "bold 32px sans-serif";
      ctx.fillText("CHILL", -49, 28);
      break;
    case "bubble":
      rect(-155, -120, 310, 240, 18, "#e5f0f5");
      for (let i = 0; i < 12; i += 1) {
        const popped = marks.some((mark) => mark.seed === i);
        ellipse(
          -108 + (i % 4) * 72,
          -75 + Math.floor(i / 4) * 75,
          popped ? 20 : 28,
          popped ? 16 : 28,
          popped ? "#d2dce4" : "#f6fdff"
        );
      }
      break;
    case "balloon":
      ellipse(0, -25, 100 + damage * 10, 125 + damage * 5);
      line([
        [0, 102],
        [-12, 122],
        [12, 122],
        [0, 102]
      ]);
      ctx.lineWidth = 2;
      line([
        [0, 122],
        [10, 150],
        [-6, 172]
      ]);
      ellipse(-35, -75, 16, 28, "#ffd9e8");
      break;
    case "ice":
      rect(-125, -125, 250, 250, 35);
      ctx.strokeStyle = "#e9fcff";
      ctx.lineWidth = 10;
      line([
        [-85, 40],
        [-85, -75],
        [25, -75]
      ]);
      line([
        [56, 80],
        [90, 46]
      ]);
      break;
    case "wall":
      for (let i = 0; i < 12; i += 1) {
        if (i < damage) continue;
        rect(-180 + (i % 3) * 120, -130 + Math.floor(i / 3) * 65, 114, 59, 4, i % 2 ? "#d5a089" : "#be816f");
      }
      break;
    case "box":
      rect(-130, -105, 260, 230, 4);
      rect(-18, -104, 36, 228, 0, "#ebce9d");
      ctx.strokeStyle = "#8d714e";
      line([
        [-95, 25],
        [-95, -30],
        [-110, -12],
        [-95, -30],
        [-80, -12]
      ]);
      break;
    case "pencils":
      for (let i = 0; i < 6; i += 1) {
        rect(-115 + i * 42, -125 + (i % 2) * 16, 26, 235, 3, i % 2 ? "#e8ac8c" : "#ecd482");
        line([
          [-115 + i * 42, 110 + (i % 2) * 16],
          [-102 + i * 42, 141 + (i % 2) * 16],
          [-89 + i * 42, 110 + (i % 2) * 16]
        ]);
      }
      break;
    case "cookie":
      ellipse(0, 0, 130, 130);
      for (let i = 0; i < 13; i += 1) {
        const angle = i * 2.4;
        ellipse(Math.cos(angle) * ((i % 3) * 33 + 20), Math.sin(angle) * ((i % 3) * 33 + 20), 10, 8, "#715041");
      }
      break;
    case "jelly":
      ellipse(0, 30, 150, 100);
      ellipse(-42, -12, 30, 15, "#e0edce");
      break;
  }

  ctx.restore();

  if (object.type !== "bubble") {
    marks.forEach((mark) => {
      ctx.save();
      ctx.strokeStyle = object.material === "paper" ? "#fff6f0" : "#62566b99";
      ctx.lineWidth = object.material === "paper" ? 7 : 2;
      for (let ray = 0; ray < 4; ray += 1) {
        const angle = mark.seed + ray * 1.6;
        ctx.beginPath();
        ctx.moveTo(mark.x, mark.y);
        ctx.lineTo(mark.x + Math.cos(angle) * 19, mark.y + Math.sin(angle) * 19);
        ctx.lineTo(mark.x + Math.cos(angle + 0.3) * 42, mark.y + Math.sin(angle + 0.3) * 42);
        ctx.stroke();
      }
      ctx.restore();
    });
  }
}

export function hitTest(object: Destructible, x: number, y: number) {
  const bounds: Record<string, number[]> = {
    window: [153, 153],
    cup: [90, 140],
    plank: [185, 74],
    paper: [115, 145],
    laptop: [187, 125],
    monitor: [168, 148],
    keyboard: [195, 86],
    can: [78, 132],
    bubble: [155, 120],
    balloon: [125, 150],
    ice: [125, 125],
    wall: [180, 130],
    box: [130, 125],
    pencils: [140, 158],
    jelly: [175, 130],
    plate: [147, 147],
    cookie: [130, 130]
  };
  const [w, h] = bounds[object.type];

  if (["plate", "cookie"].includes(object.type)) {
    return ((x - 450) / w) ** 2 + ((y - 260) / h) ** 2 <= 1;
  }

  return Math.abs(x - 450) < w && Math.abs(y - 260) < h;
}
