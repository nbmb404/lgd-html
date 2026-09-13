import type { ObjectType, ParticleLevel } from "./api";

export interface Destructible {
  type: ObjectType;
  label: string;
  action: string;
  sound: "glass" | "wood" | "paper" | "metal" | "plastic" | "fire";
  maxDamage: number;
  color: string;
}

export const objects: Destructible[] = [
  { type: "window", label: "유리창", action: "와장창", sound: "glass", maxDamage: 5, color: "#9fd8ff" },
  { type: "keyboard", label: "키보드", action: "키캡 날리기", sound: "plastic", maxDamage: 6, color: "#222831" },
  { type: "wood", label: "나무판자", action: "쩍 가르기", sound: "wood", maxDamage: 5, color: "#9b6437" },
  { type: "paper", label: "종이", action: "쫘악 찢기", sound: "paper", maxDamage: 4, color: "#f6f2e8" },
  { type: "can", label: "캔", action: "찌그러뜨리기", sound: "metal", maxDamage: 5, color: "#d9483b" },
  { type: "tree", label: "나무", action: "횃불로 태우기", sound: "fire", maxDamage: 6, color: "#2f6b3f" }
];

export const particleCounts: Record<ParticleLevel, number> = {
  low: 8,
  normal: 16,
  high: 28
};

export function getObject(type: ObjectType) {
  return objects.find((item) => item.type === type) ?? objects[0];
}
