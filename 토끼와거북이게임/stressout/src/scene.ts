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

  function rect(x: number, y: number, w: number, h: number, radius = 12, color: string | CanvasGradient = object.color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, radius);
    ctx.fill();
    ctx.stroke();
  }

  function ellipse(x: number, y: number, rx: number, ry: number, color: string | CanvasGradient = object.color) {
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
      {
        const glass = ctx.createLinearGradient(-135, -135, 135, 135);
        glass.addColorStop(0, "#dff9ff");
        glass.addColorStop(0.48, "#a9dfe3");
        glass.addColorStop(1, "#86c7ce");
        const frame = ctx.createLinearGradient(-153, -153, 153, 153);
        frame.addColorStop(0, "#3f4450");
        frame.addColorStop(1, "#686173");
      rect(-153, -153, 306, 306, 9, "#fffaf1");
        rect(-135, -135, 270, 270, 2, glass);
        ctx.strokeStyle = "#4e4a59";
        ctx.lineWidth = 6;
        ctx.strokeRect(-135, -135, 270, 270);
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
        ctx.strokeStyle = frame;
        ctx.lineWidth = 5;
        ctx.strokeRect(-153, -153, 306, 306);
      }
      break;
    case "cup":
      {
        const cup = ctx.createLinearGradient(-90, -110, 90, 132);
        cup.addColorStop(0, "rgba(236, 252, 255, 0.9)");
        cup.addColorStop(0.45, "rgba(174, 222, 231, 0.72)");
        cup.addColorStop(1, "rgba(116, 180, 193, 0.84)");
      ctx.beginPath();
      ctx.moveTo(-90, -110);
      ctx.lineTo(-68, 120);
      ctx.quadraticCurveTo(0, 146, 68, 120);
      ctx.lineTo(90, -110);
      ctx.closePath();
        ctx.fillStyle = cup;
      ctx.fill();
      ctx.stroke();
      ellipse(0, -110, 90, 23, "#effbfc");
        ctx.strokeStyle = "rgba(255, 255, 255, 0.72)";
        ctx.lineWidth = 4;
        line([
          [-15, -92],
          [-3, 98]
        ]);
      ctx.strokeStyle = "#f8ffff";
      ctx.lineWidth = 9;
      line([
        [-55, -65],
        [-43, 75]
      ]);
      }
      break;
    case "plank":
      {
        const plank = ctx.createLinearGradient(-185, -74, 185, 74);
        plank.addColorStop(0, "#dfb276");
        plank.addColorStop(0.42, "#b47a49");
        plank.addColorStop(1, "#754826");
        rect(-185, -74, 370, 148, 5, plank);
      ctx.strokeStyle = "#9b6a42";
      ctx.lineWidth = 2;
        for (let i = 0; i < 8; i += 1) {
        line([
            [-172, -60 + i * 18],
            [-52, -52 + i * 17 + Math.sin(i) * 7],
            [170, -58 + i * 18]
        ]);
      }
        ctx.strokeStyle = "#6f4428";
        ellipse(72, -12, 35, 15, "rgba(115, 73, 42, 0.34)");
        ellipse(-86, 34, 24, 10, "rgba(115, 73, 42, 0.28)");
        if (damage > 1) {
          ctx.strokeStyle = "#4f2d1b";
          ctx.lineWidth = 5;
          line([
            [-30, -70],
            [-10, -28],
            [-27, 4],
            [10, 38],
            [28, 76]
          ]);
        }
      }
      break;
    case "paper":
      ctx.fillStyle = "#fffdf5";
      ctx.strokeStyle = "#d6cdbc";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-118, -145);
      ctx.lineTo(86, -145);
      ctx.lineTo(118, -112);
      ctx.lineTo(116, 139);
      ctx.lineTo(-102, 146);
      ctx.lineTo(-120, -145);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#eee5d8";
      ctx.beginPath();
      ctx.moveTo(86, -145);
      ctx.lineTo(118, -112);
      ctx.lineTo(82, -112);
      ctx.closePath();
      ctx.fill();
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
      {
        const bezel = ctx.createLinearGradient(-168, -125, 168, 120);
        bezel.addColorStop(0, "#8d8da2");
        bezel.addColorStop(1, "#4e5063");
        const screen = ctx.createLinearGradient(-151, -108, 151, 70);
        screen.addColorStop(0, ratio > 0.5 ? "#2e3244" : "#d9f4ff");
        screen.addColorStop(1, ratio > 0.5 ? "#111522" : "#81b9d0");
        rect(-168, -125, 336, 215, 14, bezel);
        rect(-151, -108, 302, 178, 5, screen);
        ctx.strokeStyle = "rgba(255, 255, 255, 0.56)";
        ctx.lineWidth = 5;
        line([
          [-116, -82],
          [-48, -105]
        ]);
      ctx.fillStyle = "#f8ffff";
      ctx.font = "28px monospace";
      ctx.fillText(ratio > 0.5 ? "..." : "잠시 쉬어가기", -98, -12);
      if (object.type === "laptop") {
          rect(-187, 92, 374, 32, 7, "#c8cad6");
          rect(-42, 101, 84, 11, 4, "#aeb2c2");
      } else {
        rect(-20, 91, 40, 45, 3, "#77768b");
        rect(-80, 136, 160, 12, 4, "#b9b9c8");
      }
      }
      break;
    case "plate":
      {
        const plate = ctx.createRadialGradient(-40, -42, 12, 0, 0, 150);
        plate.addColorStop(0, "#ffffff");
        plate.addColorStop(0.62, "#f6f0ff");
        plate.addColorStop(1, "#cdb8e3");
        ellipse(0, 0, 147, 147, plate);
      ctx.strokeStyle = "#bda6d4";
      ctx.lineWidth = 6;
      ellipse(0, 0, 115, 115, "#ece2f6");
      ellipse(0, 0, 98, 98, "#f8f3ff");
        ctx.strokeStyle = "rgba(255, 255, 255, 0.8)";
        ctx.lineWidth = 5;
        line([
          [-62, -84],
          [-24, -103],
          [28, -104]
        ]);
      }
      break;
    case "keyboard":
      {
        const body = ctx.createLinearGradient(-195, -86, 195, 86);
        body.addColorStop(0, "#fff4f8");
        body.addColorStop(0.52, "#ecc0d3");
        body.addColorStop(1, "#a66c82");
        rect(-195, -86, 390, 172, 15, body);
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
        rect(-86, 51, 172, 26, 6, "#fff9fc");
      }
      break;
    case "can":
      {
        const can = ctx.createLinearGradient(-78, -110, 78, 125);
        can.addColorStop(0, "#f9b3af");
        can.addColorStop(0.35, "#ee7f82");
        can.addColorStop(0.78, "#d95d69");
        can.addColorStop(1, "#a94c59");
        rect(-78, -110, 156, 235, 18, can);
      ellipse(0, -108, 78, 22, "#dddde1");
      ellipse(0, -110, 22, 8, "#a2a3b1");
        ctx.fillStyle = "#fff4ba";
        ctx.beginPath();
        ctx.roundRect(-62, -42, 124, 82, 16);
        ctx.fill();
        ctx.strokeStyle = "rgba(120, 55, 65, 0.24)";
        ctx.stroke();
      ctx.fillStyle = "#fff8e9";
      ctx.font = "bold 32px sans-serif";
        ctx.fillText("CHILL", -49, 15);
        ctx.strokeStyle = "rgba(116, 45, 56, 0.48)";
        ctx.lineWidth = 3;
        for (let i = 0; i < Math.min(5, damage + 1); i += 1) {
          line([
            [-58, 58 + i * 13],
            [-8, 48 + i * 9],
            [56, 56 + i * 11]
          ]);
        }
      }
      break;
    case "bubble":
      {
        const wrap = ctx.createLinearGradient(-155, -120, 155, 120);
        wrap.addColorStop(0, "#f7fdff");
        wrap.addColorStop(1, "#c8e0ea");
        rect(-155, -120, 310, 240, 18, wrap);
      for (let i = 0; i < 12; i += 1) {
        const popped = marks.some((mark) => mark.seed === i);
          const bubble = ctx.createRadialGradient(
            -118 + (i % 4) * 72,
            -84 + Math.floor(i / 4) * 75,
            4,
            -108 + (i % 4) * 72,
            -75 + Math.floor(i / 4) * 75,
            31
          );
          bubble.addColorStop(0, "#ffffff");
          bubble.addColorStop(0.5, popped ? "#d2dce4" : "#f6fdff");
          bubble.addColorStop(1, popped ? "#bdcbd5" : "#b4d6e4");
        ellipse(
          -108 + (i % 4) * 72,
          -75 + Math.floor(i / 4) * 75,
          popped ? 20 : 28,
          popped ? 16 : 28,
            bubble
        );
      }
      }
      break;
    case "balloon":
      {
        const balloon = ctx.createRadialGradient(-35, -75, 12, 0, -25, 128 + damage * 8);
        balloon.addColorStop(0, "#ffddec");
        balloon.addColorStop(0.42, "#f59fbf");
        balloon.addColorStop(1, "#d95886");
        ellipse(0, -25, 100 + damage * 10, 125 + damage * 5, balloon);
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
      }
      break;
    case "ice":
      {
        const ice = ctx.createLinearGradient(-125, -125, 125, 125);
        ice.addColorStop(0, "#eaffff");
        ice.addColorStop(0.5, "#a1dbea");
        ice.addColorStop(1, "#69b9d6");
        rect(-125, -125, 250, 250, 35, ice);
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
        ctx.strokeStyle = "rgba(255, 255, 255, 0.72)";
        ctx.lineWidth = 4;
        line([
          [-72, -82],
          [-20, -104],
          [42, -92]
        ]);
      }
      break;
    case "wall":
      ctx.save();
      ctx.translate(0, damage * 2);
      for (let i = 0; i < 12; i += 1) {
        if (i < damage) continue;
        const brick = ctx.createLinearGradient(-180 + (i % 3) * 120, 0, -66 + (i % 3) * 120, 0);
        brick.addColorStop(0, i % 2 ? "#e0aa93" : "#cd8b77");
        brick.addColorStop(1, i % 2 ? "#b97b68" : "#9e5f53");
        rect(-180 + (i % 3) * 120, -130 + Math.floor(i / 3) * 65, 114, 59, 4, brick);
        ctx.fillStyle = "rgba(255, 255, 255, 0.18)";
        ctx.fillRect(-168 + (i % 3) * 120, -118 + Math.floor(i / 3) * 65, 52, 6);
      }
      ctx.restore();
      break;
    case "box":
      {
        const box = ctx.createLinearGradient(-130, -105, 130, 125);
        box.addColorStop(0, "#eac48d");
        box.addColorStop(0.58, "#d0ab7b");
        box.addColorStop(1, "#a77b4d");
        rect(-130, -105, 260, 230, 4, box);
        ctx.fillStyle = "rgba(123, 88, 52, 0.16)";
        ctx.beginPath();
        ctx.moveTo(-130, -105);
        ctx.lineTo(0, -42);
        ctx.lineTo(130, -105);
        ctx.lineTo(130, -55);
        ctx.lineTo(0, 4);
        ctx.lineTo(-130, -55);
        ctx.closePath();
        ctx.fill();
        rect(-18, -104, 36, 228, 0, "#ebce9d");
      ctx.strokeStyle = "#8d714e";
      line([
        [-95, 25],
        [-95, -30],
        [-110, -12],
        [-95, -30],
        [-80, -12]
      ]);
      }
      break;
    case "pencils":
      for (let i = 0; i < 6; i += 1) {
        const x = -115 + i * 42;
        const y = -125 + (i % 2) * 16;
        const pencil = ctx.createLinearGradient(x, y, x + 26, y);
        pencil.addColorStop(0, i % 2 ? "#f1c1a5" : "#f5df8e");
        pencil.addColorStop(0.5, i % 2 ? "#e8ac8c" : "#ecd482");
        pencil.addColorStop(1, i % 2 ? "#bd7359" : "#b99845");
        rect(x, y, 26, 235, 3, pencil);
        rect(x, y - 12, 26, 20, 3, "#f3d7dd");
        rect(x + 2, y - 24, 22, 13, 2, "#d56a82");
        line([
          [x, 110 + (i % 2) * 16],
          [x + 13, 141 + (i % 2) * 16],
          [x + 26, 110 + (i % 2) * 16]
        ]);
      }
      break;
    case "cookie":
      {
        const cookie = ctx.createRadialGradient(-42, -38, 12, 0, 0, 136);
        cookie.addColorStop(0, "#e8bd82");
        cookie.addColorStop(0.72, "#c99868");
        cookie.addColorStop(1, "#9e6d47");
        ellipse(0, 0, 130, 130, cookie);
      for (let i = 0; i < 13; i += 1) {
        const angle = i * 2.4;
        ellipse(Math.cos(angle) * ((i % 3) * 33 + 20), Math.sin(angle) * ((i % 3) * 33 + 20), 10, 8, "#715041");
      }
        ctx.strokeStyle = "rgba(112, 70, 45, 0.28)";
        ctx.lineWidth = 4;
        line([
          [-70, -18],
          [-30, -6],
          [8, -24],
          [52, -10]
        ]);
      }
      break;
    case "jelly":
      {
        const jelly = ctx.createRadialGradient(-58, -28, 18, 0, 35, 162);
        jelly.addColorStop(0, "rgba(245, 255, 222, 0.96)");
        jelly.addColorStop(0.38, "rgba(177, 212, 151, 0.88)");
        jelly.addColorStop(0.76, "rgba(120, 171, 115, 0.9)");
        jelly.addColorStop(1, "rgba(91, 137, 88, 0.96)");
        ctx.fillStyle = jelly;
        ctx.strokeStyle = "#5f7f5d";
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(-146, 22);
        ctx.bezierCurveTo(-128, -72, -56, -112, 28, -88);
        ctx.bezierCurveTo(106, -68, 158, -10, 148, 58);
        ctx.bezierCurveTo(138, 122, 70, 142, -8, 136);
        ctx.bezierCurveTo(-96, 130, -160, 92, -146, 22);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = "rgba(255, 255, 255, 0.36)";
        ctx.beginPath();
        ctx.ellipse(-48, -34, 54, 23, -0.3, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(42, 42, 76, 20, 0.18, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = "rgba(72, 118, 71, 0.22)";
        ctx.lineWidth = 3;
        for (let i = 0; i < 4; i += 1) {
          line([
            [-98 + i * 46, 92],
            [-82 + i * 43, 112],
            [-42 + i * 40, 106]
          ]);
        }
      }
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
