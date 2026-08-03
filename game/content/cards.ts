import type { CardTemplate, Month } from "../types";

type CardSeed = Omit<CardTemplate, "originId" | "name" | "month" | "monthName" | "assetTag"> & {
  slug: string;
  label: string;
};

const MONTH_NAMES: Record<Month, string> = {
  1: "송학",
  2: "매조",
  3: "벚꽃",
  4: "흑싸리",
  5: "난초",
  6: "모란",
  7: "홍싸리",
  8: "공산명월",
  9: "국화",
  10: "단풍",
  11: "오동",
  12: "비",
};

const MONTH_CARDS: Record<Month, readonly CardSeed[]> = {
  1: [
    { slug: "bright-crane", label: "학광", kind: "bright", chaffValue: 0, tags: ["crane", "pine"] },
    { slug: "ribbon-hong", label: "홍단", kind: "ribbon", ribbonGroup: "hong", chaffValue: 0, tags: ["pine"] },
    { slug: "chaff-a", label: "피", kind: "chaff", chaffValue: 1, tags: ["pine"] },
    { slug: "chaff-b", label: "피", kind: "chaff", chaffValue: 1, tags: ["pine"] },
  ],
  2: [
    { slug: "animal-bird", label: "새 동물패", kind: "animal", chaffValue: 0, tags: ["bird", "plum"] },
    { slug: "ribbon-hong", label: "홍단", kind: "ribbon", ribbonGroup: "hong", chaffValue: 0, tags: ["plum"] },
    { slug: "chaff-a", label: "피", kind: "chaff", chaffValue: 1, tags: ["plum"] },
    { slug: "chaff-b", label: "피", kind: "chaff", chaffValue: 1, tags: ["plum"] },
  ],
  3: [
    { slug: "bright-curtain", label: "장막광", kind: "bright", chaffValue: 0, tags: ["curtain", "cherry"] },
    { slug: "ribbon-hong", label: "홍단", kind: "ribbon", ribbonGroup: "hong", chaffValue: 0, tags: ["cherry"] },
    { slug: "chaff-a", label: "피", kind: "chaff", chaffValue: 1, tags: ["cherry"] },
    { slug: "chaff-b", label: "피", kind: "chaff", chaffValue: 1, tags: ["cherry"] },
  ],
  4: [
    { slug: "animal-bird", label: "새 동물패", kind: "animal", chaffValue: 0, tags: ["bird", "wisteria"] },
    { slug: "ribbon-cho", label: "초단", kind: "ribbon", ribbonGroup: "cho", chaffValue: 0, tags: ["wisteria"] },
    { slug: "chaff-a", label: "피", kind: "chaff", chaffValue: 1, tags: ["wisteria"] },
    { slug: "chaff-b", label: "피", kind: "chaff", chaffValue: 1, tags: ["wisteria"] },
  ],
  5: [
    { slug: "animal-bridge", label: "다리 동물패", kind: "animal", chaffValue: 0, tags: ["bridge", "orchid"] },
    { slug: "ribbon-cho", label: "초단", kind: "ribbon", ribbonGroup: "cho", chaffValue: 0, tags: ["orchid"] },
    { slug: "chaff-a", label: "피", kind: "chaff", chaffValue: 1, tags: ["orchid"] },
    { slug: "chaff-b", label: "피", kind: "chaff", chaffValue: 1, tags: ["orchid"] },
  ],
  6: [
    { slug: "animal-butterfly", label: "나비 동물패", kind: "animal", chaffValue: 0, tags: ["butterfly", "peony"] },
    { slug: "ribbon-cheong", label: "청단", kind: "ribbon", ribbonGroup: "cheong", chaffValue: 0, tags: ["peony"] },
    { slug: "chaff-a", label: "피", kind: "chaff", chaffValue: 1, tags: ["peony"] },
    { slug: "chaff-b", label: "피", kind: "chaff", chaffValue: 1, tags: ["peony"] },
  ],
  7: [
    { slug: "animal-boar", label: "멧돼지 동물패", kind: "animal", chaffValue: 0, tags: ["boar", "bush-clover"] },
    { slug: "ribbon-cho", label: "초단", kind: "ribbon", ribbonGroup: "cho", chaffValue: 0, tags: ["bush-clover"] },
    { slug: "chaff-a", label: "피", kind: "chaff", chaffValue: 1, tags: ["bush-clover"] },
    { slug: "chaff-b", label: "피", kind: "chaff", chaffValue: 1, tags: ["bush-clover"] },
  ],
  8: [
    { slug: "bright-moon", label: "달광", kind: "bright", chaffValue: 0, tags: ["moon", "pampas"] },
    { slug: "animal-bird", label: "새 동물패", kind: "animal", chaffValue: 0, tags: ["bird", "pampas"] },
    { slug: "chaff-a", label: "피", kind: "chaff", chaffValue: 1, tags: ["pampas"] },
    { slug: "chaff-b", label: "피", kind: "chaff", chaffValue: 1, tags: ["pampas"] },
  ],
  9: [
    { slug: "animal-cup", label: "술잔 동물패", kind: "animal", chaffValue: 0, tags: ["cup", "chrysanthemum"] },
    { slug: "ribbon-cheong", label: "청단", kind: "ribbon", ribbonGroup: "cheong", chaffValue: 0, tags: ["chrysanthemum"] },
    { slug: "chaff-a", label: "피", kind: "chaff", chaffValue: 1, tags: ["chrysanthemum"] },
    { slug: "chaff-b", label: "피", kind: "chaff", chaffValue: 1, tags: ["chrysanthemum"] },
  ],
  10: [
    { slug: "animal-deer", label: "사슴 동물패", kind: "animal", chaffValue: 0, tags: ["deer", "maple"] },
    { slug: "ribbon-cheong", label: "청단", kind: "ribbon", ribbonGroup: "cheong", chaffValue: 0, tags: ["maple"] },
    { slug: "chaff-a", label: "피", kind: "chaff", chaffValue: 1, tags: ["maple"] },
    { slug: "chaff-b", label: "피", kind: "chaff", chaffValue: 1, tags: ["maple"] },
  ],
  11: [
    { slug: "bright-phoenix", label: "봉황광", kind: "bright", chaffValue: 0, tags: ["phoenix", "paulownia"] },
    { slug: "double-chaff", label: "쌍피", kind: "chaff", chaffValue: 2, tags: ["paulownia"] },
    { slug: "chaff-a", label: "피", kind: "chaff", chaffValue: 1, tags: ["paulownia"] },
    { slug: "chaff-b", label: "피", kind: "chaff", chaffValue: 1, tags: ["paulownia"] },
  ],
  12: [
    { slug: "bright-rain", label: "비광", kind: "bright", chaffValue: 0, tags: ["rain", "umbrella"] },
    { slug: "animal-bird", label: "새 동물패", kind: "animal", chaffValue: 0, tags: ["bird", "rain"] },
    { slug: "ribbon-rain", label: "비띠", kind: "ribbon", ribbonGroup: "rain", chaffValue: 0, tags: ["rain"] },
    { slug: "double-chaff", label: "쌍피", kind: "chaff", chaffValue: 2, tags: ["rain"] },
  ],
};

export const STANDARD_CARD_TEMPLATES: readonly CardTemplate[] = (
  Object.entries(MONTH_CARDS) as [string, readonly CardSeed[]][]
).flatMap(([monthText, cards]) => {
  const month = Number(monthText) as Month;
  const monthName = MONTH_NAMES[month];
  return cards.map((card) => ({
    originId: `hwatu-${String(month).padStart(2, "0")}-${card.slug}`,
    name: `${month}월 ${monthName} ${card.label}`,
    month,
    monthName,
    kind: card.kind,
    ribbonGroup: card.ribbonGroup,
    chaffValue: card.chaffValue,
    tags: [...card.tags],
    assetTag: `card-${String(month).padStart(2, "0")}-${card.slug}`,
  }));
});

export function getStandardCardTemplate(originId: string): CardTemplate | undefined {
  return STANDARD_CARD_TEMPLATES.find((card) => card.originId === originId);
}
