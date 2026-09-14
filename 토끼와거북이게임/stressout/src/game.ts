import type { ObjectType, ParticleLevel } from "./api";

export type Material = "glass" | "wood" | "paper" | "metal" | "ceramic" | "soft";

export interface Destructible {
  type: ObjectType;
  label: string;
  emoji: string;
  category: string;
  material: Material;
  action: string;
  maxDamage: number;
  color: string;
}

export const objects: Destructible[] = [
  { type: "window", label: "유리창", emoji: "🪟", category: "와장창", material: "glass", action: "클릭해서 와장창 깨뜨려요", maxDamage: 5, color: "#a6dadd" },
  { type: "cup", label: "유리컵", emoji: "🥛", category: "와장창", material: "glass", action: "톡톡 두드려 깨뜨려요", maxDamage: 3, color: "#b7dfe5" },
  { type: "plank", label: "나무판자", emoji: "🪵", category: "우지끈", material: "wood", action: "내려쳐서 쩍 쪼개요", maxDamage: 5, color: "#c59565" },
  { type: "paper", label: "종이", emoji: "📄", category: "쫘아악", material: "paper", action: "꾹 누르고 드래그해서 갈기갈기 찢어요", maxDamage: 8, color: "#fff7df" },
  { type: "laptop", label: "노트북", emoji: "💻", category: "우지끈", material: "metal", action: "꾹 누르고 드래그해서 반으로 접어요", maxDamage: 8, color: "#acb1c7" },
  { type: "plate", label: "도자기 접시", emoji: "🍽️", category: "와장창", material: "ceramic", action: "내려쳐서 조각내요", maxDamage: 3, color: "#c5b3e0" },
  { type: "keyboard", label: "키보드", emoji: "⌨️", category: "우지끈", material: "metal", action: "키캡을 우수수 날려요", maxDamage: 7, color: "#e9b5cc" },
  { type: "monitor", label: "모니터", emoji: "🖥️", category: "와장창", material: "glass", action: "화면을 내려쳐 깨뜨려요", maxDamage: 5, color: "#879bb4" },
  { type: "can", label: "캔", emoji: "🥫", category: "우지끈", material: "metal", action: "누를수록 납작하게 찌그러져요", maxDamage: 5, color: "#ed9b95" },
  { type: "bubble", label: "뽁뽁이", emoji: "🫧", category: "톡톡팡", material: "soft", action: "동그라미를 하나씩 터뜨려요 · 드래그도 가능!", maxDamage: 12, color: "#b4d6e4" },
  { type: "balloon", label: "풍선", emoji: "🎈", category: "톡톡팡", material: "soft", action: "꾹꾹 눌러 팡 터뜨려요", maxDamage: 3, color: "#f59fbf" },
  { type: "ice", label: "얼음 덩어리", emoji: "🧊", category: "와장창", material: "glass", action: "시원하게 쩌적 깨뜨려요", maxDamage: 5, color: "#a1dbea" },
  { type: "wall", label: "벽돌 벽", emoji: "🧱", category: "우지끈", material: "ceramic", action: "벽돌을 하나씩 허물어요", maxDamage: 8, color: "#ce8f79" },
  { type: "box", label: "골판지 상자", emoji: "📦", category: "우지끈", material: "paper", action: "꾹꾹 눌러 구겨요", maxDamage: 5, color: "#d0ab7b" },
  { type: "pencils", label: "연필 다발", emoji: "✏️", category: "우지끈", material: "wood", action: "한꺼번에 뚝 꺾어요", maxDamage: 4, color: "#eccb71" },
  { type: "cookie", label: "쿠키", emoji: "🍪", category: "바스락", material: "ceramic", action: "바삭바삭 가루로 만들어요", maxDamage: 4, color: "#c99868" },
  { type: "jelly", label: "젤리 덩어리", emoji: "🟢", category: "쫘아악", material: "soft", action: "꾹 누르고 드래그해서 늘리고 끊어요", maxDamage: 7, color: "#b4caa0" }
];

export const particleCounts: Record<ParticleLevel, number> = {
  low: 8,
  normal: 16,
  high: 28
};

export function getObject(type: ObjectType) {
  return objects.find((item) => item.type === type) ?? objects[0];
}
