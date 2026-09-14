import type { ObjectType, ParticleLevel } from "./api";

export interface Destructible {
  type: ObjectType;
  label: string;
  emoji: string;
  category: string;
  action: string;
  sound: "glass" | "wood" | "paper" | "metal" | "plastic" | "fire";
  maxDamage: number;
  color: string;
}

export const objects: Destructible[] = [
  { type: "window", label: "유리창", emoji: "▦", category: "와장창", action: "클릭해서 와장창 깨뜨려요", sound: "glass", maxDamage: 5, color: "#9fd8ff" },
  { type: "keyboard", label: "키보드", emoji: "⌨", category: "우수수", action: "키캡을 우수수 날려요", sound: "plastic", maxDamage: 6, color: "#222831" },
  { type: "wood", label: "나무판자", emoji: "▰", category: "쩍", action: "내려쳐서 쩍 쪼개요", sound: "wood", maxDamage: 5, color: "#9b6437" },
  { type: "paper", label: "종이", emoji: "□", category: "쫘아악", action: "꾹 누르고 드래그해서 찢어요", sound: "paper", maxDamage: 4, color: "#f6f2e8" },
  { type: "can", label: "캔", emoji: "◖", category: "찌그러짐", action: "누를수록 납작하게 찌그러져요", sound: "metal", maxDamage: 5, color: "#d9483b" },
  { type: "tree", label: "나무", emoji: "♨", category: "화르륵", action: "횃불로 천천히 태워요", sound: "fire", maxDamage: 6, color: "#2f6b3f" }
];

export const particleCounts: Record<ParticleLevel, number> = {
  low: 8,
  normal: 16,
  high: 28
};

export function getObject(type: ObjectType) {
  return objects.find((item) => item.type === type) ?? objects[0];
}
