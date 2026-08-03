import type { BossDefinition, CardInstance, ImmediateYakuId } from "../types";

export interface BossScoreContext {
  submissionIndex: number;
  scoringIndex: number;
  popularMonth?: number;
}

export function bossAllowsCardToScore(
  boss: BossDefinition | null,
  card: CardInstance,
  context: BossScoreContext,
): boolean {
  if (!boss) return true;
  if (boss.ruleKey === "no_rain") return !(card.tags.includes("rain") || card.month === 12);
  if (boss.ruleKey === "first_ribbon_disabled") {
    return !(context.submissionIndex === 0 && card.kind === "ribbon");
  }
  return true;
}

export function getBossKkeutAdjustment(
  boss: BossDefinition | null,
  card: CardInstance,
  context: BossScoreContext,
): number {
  if (!boss) return 0;
  switch (boss.ruleKey) {
    case "first_card_zero":
      return context.scoringIndex === 0 ? -getNaturalKkeut(card) : 0;
    case "dry_bright":
      return card.kind === "bright" && !card.tags.includes("rain") ? -getNaturalKkeut(card) : 0;
    case "bright_zero":
      return card.kind === "bright" ? -getNaturalKkeut(card) : 0;
    case "popular_month_weak":
      return context.popularMonth === card.month ? -Math.ceil(getNaturalKkeut(card) / 2) : 0;
    default:
      return 0;
  }
}

export function getBossSettlementFactor(
  boss: BossDefinition | null,
  successfulGoCount: number,
): number {
  if (boss?.ruleKey === "zero_go_reduced" && successfulGoCount === 0) return 0.8;
  return 1;
}

export function getBossGoFailureScoreFactor(boss: BossDefinition | null): number {
  return boss?.ruleKey === "go_fail_tax" ? 0.9 : 1;
}

export function getBossDiscardMoneyCost(boss: BossDefinition | null): number {
  return boss?.ruleKey === "discard_tax" ? 1 : 0;
}

export function bossVictoryConditionMet(
  boss: BossDefinition | null,
  confirmedGoCount: number,
): boolean {
  if (!boss) return true;
  return boss.ruleKey !== "requires_go" || confirmedGoCount >= 1;
}

export function bossAllowsYaku(
  boss: BossDefinition | null,
  yakuId: ImmediateYakuId,
  submittedOrder: CardInstance[],
): boolean {
  if (boss?.ruleKey !== "reverse_runs") return true;
  if (!yakuId.includes("run")) return true;
  const months = submittedOrder.map((card) => card.month);
  return months.every((month, index) => index === 0 || month < months[index - 1]);
}

export function faceDownCountForBoss(boss: BossDefinition | null): number {
  return boss?.ruleKey === "two_face_down" ? 2 : 0;
}

function getNaturalKkeut(card: CardInstance): number {
  if (card.tags.includes("zero_base")) return 0;
  return card.month;
}
