import type { CardInstance, ScoreOperation, YakuLevelState } from "../types";
import { getEffectiveCardRole, resolveCupRole, type CupRoleSource } from "./deck";

export type CollectionTrackId = "bright" | "animal" | "godori" | "ribbon" | "chaff";
export const GODORI_MONTHS = [2, 4, 8] as const;

export interface CollectionScoreEffect {
  sourceId: string;
  label: string;
  operation: ScoreOperation["operation"];
  value: number;
}

export interface CollectionMilestone {
  id: string;
  track: CollectionTrackId;
  label: string;
  required: number;
  achieved: boolean;
  multiplierBonus?: number;
  monthSumBonus?: number;
}

export interface CollectionBonusResult {
  counts: { bright: number; animal: number; godori: number; ribbon: number; chaff: number };
  matchedGodoriMonths: number[];
  completedSets: { godori: boolean; hongdan: boolean; chodan: boolean; cheongdan: boolean };
  /** Ordinary Go-Stop points before the game's 20-point conversion. */
  goStopPoints: number;
  scoreLines: { id: string; label: string; points: number }[];
  perks: {
    goThresholdFactor: number;
    handSizeBonus: number;
    allowFiveMultipleJit: boolean;
    extraDiscards: number;
    moneyBonus: number;
  };
  /** Kept at neutral values for scoring-engine compatibility. */
  multiplierBonus: number;
  monthSumBonus: number;
  effects: CollectionScoreEffect[];
  milestones: CollectionMilestone[];
}

function uniqueActiveCards(cards: readonly CardInstance[]): CardInstance[] {
  const seen = new Set<string>();
  return cards.filter((card) => {
    if (card.disabledForRound || seen.has(card.instanceId)) return false;
    seen.add(card.instanceId);
    return true;
  });
}

function matchesKind(card: CardInstance, kind: "bright" | "animal" | "ribbon" | "chaff", cupRoles?: CupRoleSource): boolean {
  if (card.enhancement === "stone") return false;
  if (card.enhancement === "wild" || card.tags.includes("all_kind_wild")) return true;
  if (kind === "bright" && card.tags.includes("counts_as_bright")) return true;
  return getEffectiveCardRole(card, resolveCupRole(cupRoles, card)).kind === kind;
}

function matchedMonths(cards: readonly CardInstance[], months: readonly number[], predicate: (card: CardInstance) => boolean): number[] {
  return months.filter((month) => cards.some((card) => card.month === month && predicate(card)));
}

export function calculateCollectionBonus(
  cards: readonly CardInstance[],
  cupRoles: CupRoleSource = "animal",
  yakuLevels: Record<string, YakuLevelState> = {},
): CollectionBonusResult {
  const uniqueCards = uniqueActiveCards(cards);
  const brightCards = uniqueCards.filter((card) => matchesKind(card, "bright", cupRoles));
  const animalCards = uniqueCards.filter((card) => matchesKind(card, "animal", cupRoles));
  const ribbonCards = uniqueCards.filter((card) => matchesKind(card, "ribbon", cupRoles));
  const chaffCards = uniqueCards.filter((card) => matchesKind(card, "chaff", cupRoles));
  const isGodori = (card: CardInstance) => matchesKind(card, "animal", cupRoles) && card.tags.includes("bird");
  const ribbonMonths = (group: "hong" | "cho" | "cheong", months: readonly number[]) =>
    months.every((month) => uniqueCards.some((card) => card.month === month && matchesKind(card, "ribbon", cupRoles) && card.ribbonGroup === group));

  const matchedGodoriMonths = matchedMonths(uniqueCards, GODORI_MONTHS, isGodori);
  const counts = {
    bright: brightCards.length,
    animal: animalCards.length,
    godori: matchedGodoriMonths.length,
    ribbon: ribbonCards.length,
    chaff: chaffCards.reduce((sum, card) => {
      const role = getEffectiveCardRole(card, resolveCupRole(cupRoles, card));
      return sum + (role.kind === "chaff" ? role.chaffValue : 0);
    }, 0),
  };
  const completedSets = {
    godori: counts.godori === 3,
    hongdan: ribbonMonths("hong", [1, 2, 3]),
    chodan: ribbonMonths("cho", [4, 5, 7]),
    cheongdan: ribbonMonths("cheong", [6, 9, 10]),
  };
  const level = (id: string) => Math.max(1, yakuLevels[id]?.level ?? 1);
  const upgraded = (id: string) => level(id) > 1;
  const scoreLines: CollectionBonusResult["scoreLines"] = [];
  const add = (id: string, label: string, points: number) => {
    if (points > 0) scoreLines.push({ id, label, points });
  };

  const hasRainBright = brightCards.some((card) => card.month === 12 || card.tags.includes("rain"));
  if (counts.bright >= 5) add("five_brights", "오광", 15 + level("five_brights") - 1);
  else if (counts.bright === 4) add("four_brights", "사광", 4 + level("four_brights") - 1);
  else if (counts.bright >= 3) {
    const id = hasRainBright ? "rain_three_brights" : "three_brights";
    add(id, hasRainBright ? "비삼광" : "삼광", (hasRainBright ? 2 : 3) + level(id) - 1);
  }
  add("animal", `열끗 ${counts.animal}장`, counts.animal >= 5 ? counts.animal - 4 : 0);
  if (completedSets.godori) add("godori", "고도리", 5 + level("godori") - 1);
  add("ribbon", `띠 ${counts.ribbon}장`, counts.ribbon >= 5 ? counts.ribbon - 4 : 0);
  if (completedSets.hongdan) add("hongdan", "홍단", 3 + level("hongdan") - 1);
  if (completedSets.chodan) add("chodan", "초단", 3 + level("chodan") - 1);
  if (completedSets.cheongdan) add("cheongdan", "청단", 3 + level("cheongdan") - 1);
  add("chaff", `피 ${counts.chaff}점`, counts.chaff >= 10 ? counts.chaff - 9 : 0);

  const brightUpgradeCount = ["rain_three_brights", "three_brights", "four_brights", "five_brights"]
    .reduce((sum, id) => sum + Math.max(0, level(id) - 1), 0);
  const perks = {
    goThresholdFactor: Math.max(0.75, 1 - brightUpgradeCount * 0.05),
    handSizeBonus: 0,
    allowFiveMultipleJit: completedSets.godori && upgraded("godori"),
    extraDiscards: Number(completedSets.hongdan && upgraded("hongdan"))
      + Number(completedSets.chodan && upgraded("chodan"))
      + Number(completedSets.cheongdan && upgraded("cheongdan")),
    moneyBonus: 0,
  };
  const milestones: CollectionMilestone[] = [
    { id: "bright-3", track: "bright", label: "삼광 3점 · 비삼광 2점", required: 3, achieved: counts.bright >= 3 },
    { id: "bright-4", track: "bright", label: "사광 4점", required: 4, achieved: counts.bright >= 4 },
    { id: "bright-5", track: "bright", label: "오광 15점", required: 5, achieved: counts.bright >= 5 },
    { id: "animal-5", track: "animal", label: "5장 1점 · 이후 장당 +1", required: 5, achieved: counts.animal >= 5 },
    { id: "godori", track: "godori", label: "완성 +5점", required: 3, achieved: completedSets.godori },
    { id: "ribbon-5", track: "ribbon", label: "5장 1점 · 이후 장당 +1", required: 5, achieved: counts.ribbon >= 5 },
    { id: "hongdan", track: "ribbon", label: "홍단 +3점", required: 3, achieved: completedSets.hongdan },
    { id: "chodan", track: "ribbon", label: "초단 +3점", required: 3, achieved: completedSets.chodan },
    { id: "cheongdan", track: "ribbon", label: "청단 +3점", required: 3, achieved: completedSets.cheongdan },
    { id: "chaff-10", track: "chaff", label: "10점 1점 · 이후 피점당 +1", required: 10, achieved: counts.chaff >= 10 },
  ];
  return {
    counts,
    matchedGodoriMonths,
    completedSets,
    goStopPoints: scoreLines.reduce((sum, line) => sum + line.points, 0),
    scoreLines,
    perks,
    multiplierBonus: 1,
    monthSumBonus: 0,
    effects: [],
    milestones,
  };
}
