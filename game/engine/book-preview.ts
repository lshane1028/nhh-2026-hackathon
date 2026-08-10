import { ALL_IMMEDIATE_YAKU_DEFINITIONS } from "../content/yaku";
import type { CollectionYakuId, YakuId } from "../types";

export interface BookLevelPreview {
  current: string;
  next: string;
}

const COLLECTION_BASE_POINTS: Record<CollectionYakuId, number> = {
  hongdan: 3,
  chodan: 3,
  cheongdan: 3,
  godori: 5,
  rain_three_brights: 2,
  three_brights: 3,
  four_brights: 4,
  five_brights: 15,
};

const BRIGHT_BOOKS = new Set<CollectionYakuId>([
  "rain_three_brights",
  "three_brights",
  "four_brights",
  "five_brights",
]);

const RIBBON_BOOKS = new Set<CollectionYakuId>(["hongdan", "chodan", "cheongdan"]);

function formatMultiplier(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

function collectionEffect(id: CollectionYakuId, level: number): string {
  const points = COLLECTION_BASE_POINTS[id] + level - 1;
  const parts = [`완성 ${points}점`];

  if (BRIGHT_BOOKS.has(id)) {
    parts.push(`고 목표 추가 -${(level - 1) * 5}%`);
  } else if (id === "godori") {
    parts.push(level > 1 ? "짓 5의 배수 허용" : "짓은 10의 배수만 허용");
  } else if (RIBBON_BOOKS.has(id)) {
    parts.push(level > 1 ? "완성 시 버리기 +1" : "추가 버리기 없음");
  }

  return parts.join(" · ");
}

/** Exact player-facing before/after values for a shop book purchase. */
export function getBookLevelPreview(yakuId: YakuId, currentLevel: number): BookLevelPreview {
  const level = Math.max(1, Math.floor(currentLevel));
  const immediate = ALL_IMMEDIATE_YAKU_DEFINITIONS.find((entry) => entry.id === yakuId);
  if (immediate) {
    const at = (value: number) => immediate.baseHeung + immediate.growthHeung * (value - 1);
    return {
      current: `Lv.${level} · 기본 배수 ${formatMultiplier(at(level))}`,
      next: `Lv.${level + 1} · 기본 배수 ${formatMultiplier(at(level + 1))}`,
    };
  }

  const collectionId = yakuId as CollectionYakuId;
  return {
    current: `Lv.${level} · ${collectionEffect(collectionId, level)}`,
    next: `Lv.${level + 1} · ${collectionEffect(collectionId, level + 1)}`,
  };
}
