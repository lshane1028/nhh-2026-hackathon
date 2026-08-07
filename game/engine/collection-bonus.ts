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
  /**
   * What the board multiplies the 배수 by, as a single factor. 1 means the
   * board is paying nothing yet. This used to be a SUM of flat bonuses, which
   * is why it read as "+5"; the rows multiply now, so it reads as "×3.5".
   */
  multiplierBonus: number;
  monthSumBonus: number;
  /**
   * What each track pays BESIDES 배수.
   *
   * Every row used to hand out the same currency, which made the board a
   * single number wearing five hats — there was no reason to prefer 광 over 띠
   * beyond the size of the bonus. Each track now pays in something the player
   * spends differently, so "which row do I chase" becomes a real question:
   *
   *   광    고 문턱을 깎는다      — 광을 모을수록 고를 부르기 쉬워진다
   *   동물  손패가 커진다         — 짓을 맞출 재료가 늘어난다
   *   고도리 짓 규칙이 느슨해진다  — 5의 배수도 짓으로 인정된다
   *   띠    각 단마다 버리기 +1   — 묶을수록 손을 갈아엎기 쉬워진다
   *   피    판돈이 붙는다         — 피는 돈이다
   *
   * These are round-scoped, exactly like the 배수. The board resets each 판.
   */
  perks: {
    /** Multiplies the Go threshold. 1 = no relief, 0.85 = 15% cheaper. */
    goThresholdFactor: number;
    /** Extra cards drawn on every refill. */
    handSizeBonus: number;
    /** 고도리: the 짓 may settle on a multiple of five for the rest of the 판. */
    allowFiveMultipleJit: boolean;
    /** Extra discards this round. */
    extraDiscards: number;
    /** 냥 added to the purse when the round is won. */
    moneyBonus: number;
  };
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

/** A x1 multiplier is not an effect, it is the absence of one. */
function addMultiplier(
  effects: CollectionScoreEffect[],
  sourceId: string,
  label: string,
  factor: number,
): void {
  if (factor !== 1) effects.push({ sourceId, label, operation: "multiply_heung", value: factor });
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

  /*
   * Rewards scale with how hard a row is to actually build, and the big ones
   * MULTIPLY rather than add. A flat "+5배수" disappears the moment the 배수 is
   * already 30; a "×3.5" never stops mattering, which is what makes finishing
   * a row feel like it was worth the hands it cost.
   *
   * Difficulty, cheapest first: 피 (24장이 널려 있다) → 띠·동물 5장 → 단 하나
   * (특정 3장) → 고도리 (특정 3장) → 3광 → 4광 → 5광 (비광까지 필요).
   * The payouts follow that order.
   *
   * They compound, but a round only has room for ~20 cards, so the expensive
   * rows are mutually exclusive in practice. That is the point: the board asks
   * which one row you are chasing this 판.
   */
  const brightMultiplier = counts.bright >= 5 ? 3.5 : counts.bright === 4 ? 2.2 : counts.bright >= 3 ? 1.6 : 1;
  const animalMultiplier = counts.animal >= 8 ? 1.8 : 1;
  const ribbonMultiplier = counts.ribbon >= 5 ? 1.4 : 1;
  const chaffMultiplier = counts.chaff >= 10 ? 1.5 : 1;
  // 삼단 — 홍단·초단·청단을 한 판에 모두 묶는 건 아홉 장짜리 과제다.
  const allThreeRibbonSets = completedSets.hongdan && completedSets.chodan && completedSets.cheongdan;
  const ribbonSetMultiplier = allThreeRibbonSets ? 2.5 : 1;
  const chaffMonthSumBonus = Math.max(0, counts.chaff - 10);

  // 광 — 판을 뒤집는 패다. 모을수록 고를 부르는 값이 싸진다.
  const goThresholdFactor = counts.bright >= 5
    ? 0.7
    : counts.bright === 4
      ? 0.8
      : counts.bright >= 3
        ? 0.9
        : 1;
  // 동물 — 사냥이 늘면 손이 커진다. 짓을 맞출 재료가 늘어난다는 뜻이다.
  const handSizeBonus = counts.animal >= 5 ? 1 : 0;
  /*
   * 고도리 — 숫자를 하나 더 주는 대신 규칙을 굽힌다.
   *
   * 새 세 마리를 모으면 이번 판 동안 짓이 5의 배수여도 성립한다. 8장 손패에서
   * 합법적인 5장 조합이 65%에서 85%로 뛰므로 "낼 게 없다"는 상황 자체가 거의
   * 사라진다. 다른 어느 줄도 규칙을 바꾸지는 않는다.
   */
  const allowFiveMultipleJit = completedSets.godori;
  // 띠 — 단 하나마다 손을 갈아엎을 기회가 하나씩.
  const extraDiscards = Number(completedSets.hongdan)
    + Number(completedSets.chodan)
    + Number(completedSets.cheongdan);
  // 피 — 피는 돈이다. 7점을 넘긴 만큼만 값을 친다.
  const moneyBonus = Math.floor(Math.max(0, counts.chaff - 6) * 0.5);

  // Cheap rows first, so the expensive multipliers land on a bigger number.
  const effects: CollectionScoreEffect[] = [];
  addEffect(effects, "collection:chaff-overflow", `피 10점 초과 +${chaffMonthSumBonus}`, "add_kkeut", chaffMonthSumBonus);
  addMultiplier(effects, "collection:chaff", `피 10점 ×${chaffMultiplier}`, chaffMultiplier);
  addMultiplier(effects, "collection:ribbon", `띠 ${counts.ribbon}장 ×${ribbonMultiplier}`, ribbonMultiplier);
  addMultiplier(effects, "collection:ribbon-sets", `삼단 ×${ribbonSetMultiplier}`, ribbonSetMultiplier);
  addMultiplier(effects, "collection:animal", `동물 ${counts.animal}장 ×${animalMultiplier}`, animalMultiplier);
  addMultiplier(effects, "collection:bright", `${counts.bright}광 ×${brightMultiplier}`, brightMultiplier);

  const milestones: CollectionMilestone[] = [
    { id: "bright-3", track: "bright", label: "3광 ×1.6 · 고 −10%", required: 3, achieved: counts.bright >= 3, multiplierBonus: 1.6 },
    { id: "bright-4", track: "bright", label: "4광 ×2.2 · 고 −20%", required: 4, achieved: counts.bright >= 4, multiplierBonus: 2.2 },
    { id: "bright-5", track: "bright", label: "5광 ×3.5 · 고 −30%", required: 5, achieved: counts.bright >= 5, multiplierBonus: 3.5 },
    { id: "animal-5", track: "animal", label: "동물 5장 손패 +1", required: 5, achieved: counts.animal >= 5 },
    { id: "animal-8", track: "animal", label: "동물 8장 ×1.8", required: 8, achieved: counts.animal >= 8, multiplierBonus: 1.8 },
    { id: "godori", track: "godori", label: "고도리 완성 · 짓 5의 배수 허용", required: 3, achieved: completedSets.godori },
    { id: "ribbon-5", track: "ribbon", label: "띠 5장 ×1.4", required: 5, achieved: counts.ribbon >= 5, multiplierBonus: 1.4 },
    { id: "hongdan", track: "ribbon", label: "홍단 버리기 +1", required: 3, achieved: completedSets.hongdan },
    { id: "chodan", track: "ribbon", label: "초단 버리기 +1", required: 3, achieved: completedSets.chodan },
    { id: "cheongdan", track: "ribbon", label: "청단 버리기 +1", required: 3, achieved: completedSets.cheongdan },
    { id: "ribbon-sets", track: "ribbon", label: "삼단 ×2.5", required: 9, achieved: allThreeRibbonSets, multiplierBonus: 2.5 },
    { id: "chaff-7", track: "chaff", label: "피 7점부터 판돈 +0.5/점", required: 7, achieved: counts.chaff >= 7 },
    { id: "chaff-10", track: "chaff", label: "피 10점 ×1.5", required: 10, achieved: counts.chaff >= 10, multiplierBonus: 1.5 },
  ];

  return {
    counts,
    matchedGodoriMonths,
    completedSets,
    perks: {
      goThresholdFactor,
      handSizeBonus,
      allowFiveMultipleJit,
      extraDiscards,
      moneyBonus,
    },
    multiplierBonus: effects
      .filter((effect) => effect.operation === "multiply_heung")
      .reduce((product, effect) => product * effect.value, 1),
    monthSumBonus: chaffMonthSumBonus,
    effects,
    milestones,
  };
}
