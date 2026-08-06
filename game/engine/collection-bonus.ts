import type { CardInstance, ScoreOperation } from "../types";
import {
  getEffectiveCardRole,
  resolveCupRole,
  type CupRoleSource,
} from "./deck";

/**
 * Godori is displayed as its own row on the collection board, but the three
 * birds are still counted inside the animal track, so the scoring math is
 * unchanged: animals grow on their own and Godori adds a separate bonus.
 */
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
  counts: {
    bright: number;
    animal: number;
    /** Distinct Godori months held, 0 to 3. Also included in `animal`. */
    godori: number;
    ribbon: number;
    /** Pi value, so a double-chaff card contributes two. */
    chaff: number;
  };
  /** Which of 2·4·8월 are actually held, so the UI can label each slot. */
  matchedGodoriMonths: number[];
  completedSets: {
    godori: boolean;
    hongdan: boolean;
    chodan: boolean;
    cheongdan: boolean;
  };
  multiplierBonus: number;
  monthSumBonus: number;
  /** Compatible with scoring's ordered score-effect input. */
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

function matchesKind(
  card: CardInstance,
  kind: "bright" | "animal" | "ribbon" | "chaff",
  cupRoles: CupRoleSource | undefined,
): boolean {
  if (card.enhancement === "stone") return false;
  if (card.enhancement === "wild" || card.tags.includes("all_kind_wild")) return true;
  if (kind === "bright" && card.tags.includes("counts_as_bright")) return true;
  return getEffectiveCardRole(card, resolveCupRole(cupRoles, card)).kind === kind;
}

function matchedMonths(
  cards: readonly CardInstance[],
  months: readonly number[],
  predicate: (card: CardInstance) => boolean,
): number[] {
  return months.filter((month) => cards.some((card) => card.month === month && predicate(card)));
}

function hasRequiredMonths(
  cards: readonly CardInstance[],
  months: readonly number[],
  predicate: (card: CardInstance) => boolean,
): boolean {
  return matchedMonths(cards, months, predicate).length === months.length;
}

function addEffect(
  effects: CollectionScoreEffect[],
  sourceId: string,
  label: string,
  operation: CollectionScoreEffect["operation"],
  value: number,
): void {
  if (value !== 0) effects.push({ sourceId, label, operation, value });
}

export function calculateCollectionBonus(
  cards: readonly CardInstance[],
  cupRoles: CupRoleSource = "animal",
): CollectionBonusResult {
  const uniqueCards = uniqueActiveCards(cards);
  const brightCards = uniqueCards.filter((card) => matchesKind(card, "bright", cupRoles));
  const animalCards = uniqueCards.filter((card) => matchesKind(card, "animal", cupRoles));
  const ribbonCards = uniqueCards.filter((card) => matchesKind(card, "ribbon", cupRoles));
  const chaffCards = uniqueCards.filter((card) => matchesKind(card, "chaff", cupRoles));

  const isAnimal = (card: CardInstance): boolean => matchesKind(card, "animal", cupRoles);
  const isGodoriBird = (card: CardInstance): boolean => isAnimal(card) && card.tags.includes("bird");
  const isRibbonGroup = (group: "hong" | "cho" | "cheong") => (card: CardInstance): boolean =>
    matchesKind(card, "ribbon", cupRoles) && card.ribbonGroup === group;

  const matchedGodoriMonths = matchedMonths(uniqueCards, GODORI_MONTHS, isGodoriBird);
  const godoriCount = matchedGodoriMonths.length;
  const counts = {
    bright: brightCards.length,
    animal: animalCards.length,
    godori: godoriCount,
    ribbon: ribbonCards.length,
    chaff: chaffCards.reduce((sum, card) => {
      const role = getEffectiveCardRole(card, resolveCupRole(cupRoles, card));
      return sum + (role.kind === "chaff" ? role.chaffValue : 0);
    }, 0),
  };

  const completedSets = {
    godori: godoriCount === GODORI_MONTHS.length,
    hongdan: hasRequiredMonths(uniqueCards, [1, 2, 3], isRibbonGroup("hong")),
    chodan: hasRequiredMonths(uniqueCards, [4, 5, 7], isRibbonGroup("cho")),
    cheongdan: hasRequiredMonths(uniqueCards, [6, 9, 10], isRibbonGroup("cheong")),
  };

  const brightBonus = counts.bright >= 5 ? 7 : counts.bright === 4 ? 4 : counts.bright === 3 ? 2 : 0;
  const animalBonus = counts.animal >= 5 ? 2 + (counts.animal - 5) * 0.5 : 0;
  const ribbonBonus = counts.ribbon >= 5 ? 2 + (counts.ribbon - 5) * 0.5 : 0;
  const chaffMultiplierBonus = counts.chaff >= 10
    ? 4
    : counts.chaff >= 5
      ? 1 + (counts.chaff - 5) * 0.25
      : 0;
  const chaffMonthSumBonus = Math.max(0, counts.chaff - 10);

  const effects: CollectionScoreEffect[] = [];
  addEffect(effects, "collection:bright", `광 ${counts.bright}장`, "add_heung", brightBonus);
  addEffect(effects, "collection:animal", `동물 ${counts.animal}장`, "add_heung", animalBonus);
  if (completedSets.godori) addEffect(effects, "collection:godori", "고도리 완성", "add_heung", 2);
  addEffect(effects, "collection:ribbon", `띠 ${counts.ribbon}장`, "add_heung", ribbonBonus);
  if (completedSets.hongdan) addEffect(effects, "collection:hongdan", "홍단 완성", "add_heung", 2);
  if (completedSets.chodan) addEffect(effects, "collection:chodan", "초단 완성", "add_heung", 2);
  if (completedSets.cheongdan) addEffect(effects, "collection:cheongdan", "청단 완성", "add_heung", 2);
  addEffect(effects, "collection:chaff", `피 ${counts.chaff}점`, "add_heung", chaffMultiplierBonus);
  addEffect(effects, "collection:chaff-overflow", `피 10점 초과 +${chaffMonthSumBonus}`, "add_kkeut", chaffMonthSumBonus);

  const milestones: CollectionMilestone[] = [
    { id: "bright-3", track: "bright", label: "3광 +2배수", required: 3, achieved: counts.bright >= 3, multiplierBonus: 2 },
    { id: "bright-4", track: "bright", label: "4광 +4배수", required: 4, achieved: counts.bright >= 4, multiplierBonus: 4 },
    { id: "bright-5", track: "bright", label: "5광 +7배수", required: 5, achieved: counts.bright >= 5, multiplierBonus: 7 },
    { id: "animal-5", track: "animal", label: "동물 5장부터 +2배수", required: 5, achieved: counts.animal >= 5, multiplierBonus: 2 },
    { id: "godori", track: "godori", label: "고도리 완성 +2배수", required: 3, achieved: completedSets.godori, multiplierBonus: 2 },
    { id: "ribbon-5", track: "ribbon", label: "띠 5장부터 +2배수", required: 5, achieved: counts.ribbon >= 5, multiplierBonus: 2 },
    { id: "hongdan", track: "ribbon", label: "홍단 +2배수", required: 3, achieved: completedSets.hongdan, multiplierBonus: 2 },
    { id: "chodan", track: "ribbon", label: "초단 +2배수", required: 3, achieved: completedSets.chodan, multiplierBonus: 2 },
    { id: "cheongdan", track: "ribbon", label: "청단 +2배수", required: 3, achieved: completedSets.cheongdan, multiplierBonus: 2 },
    { id: "chaff-5", track: "chaff", label: "피 5점 +1배수", required: 5, achieved: counts.chaff >= 5, multiplierBonus: 1 },
    { id: "chaff-10", track: "chaff", label: "피 10점 +4배수", required: 10, achieved: counts.chaff >= 10, multiplierBonus: 4 },
  ];

  return {
    counts,
    matchedGodoriMonths,
    completedSets,
    multiplierBonus: effects
      .filter((effect) => effect.operation === "add_heung")
      .reduce((sum, effect) => sum + effect.value, 0),
    monthSumBonus: chaffMonthSumBonus,
    effects,
    milestones,
  };
}
