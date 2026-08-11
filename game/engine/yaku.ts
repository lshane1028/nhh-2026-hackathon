import { ALL_IMMEDIATE_YAKU_DEFINITIONS, COLLECTION_YAKU_DEFINITIONS, getImmediateYakuDefinition } from "../content/yaku";
import type {
  CardInstance,
  CollectionProgress,
  CollectionYakuId,
  ImmediateYakuId,
  Month,
  YakuCandidate,
} from "../types";
import {
  getCollectionKindValue,
  hasEffectiveCardKind,
  type CupRole,
} from "./deck";

export interface YakuMatchContext {
  cupRole?: CupRole;
  /** 짓 may also settle on a multiple of five. Sold as a talisman. */
  allowFiveMultipleJit?: boolean;
  includeSecretYaku?: boolean;
}

export interface CollectionEvaluationInput {
  confirmedCards?: readonly CardInstance[];
  pendingCards?: readonly CardInstance[];
  submittedCards?: readonly CardInstance[];
  confirmedCompletedYakuIds?: readonly CollectionYakuId[];
  pendingCompletedYakuIds?: readonly CollectionYakuId[];
  cupRole?: CupRole;
}

export const MIN_SUBMISSION = 2;
export const MAX_SUBMISSION = 5;

/**
 * Month used only to decide whether the trailing cards form a legal 짓.
 *
 * Permanent score bonuses must not rewrite the printed combination. Otherwise
 * two visually identical 11월 cards can disagree for 9+11, and a boosted 4월
 * can incorrectly turn 4+12 into a legal 20. Those bonuses are applied later
 * by the scoring engine, after the printed-month 짓 has been validated.
 */
export function getEffectiveMonth(card: CardInstance): number {
  if (card.enhancement === "stone") return 12;
  return card.month;
}

function uniqueCards(cards: readonly CardInstance[]): CardInstance[] {
  const seen = new Set<string>();
  return cards.filter((card) => {
    if (seen.has(card.instanceId)) return false;
    seen.add(card.instanceId);
    return true;
  });
}

function isBright(card: CardInstance, cupRole: CupRole): boolean {
  return hasEffectiveCardKind(card, "bright", cupRole);
}

/** The named 섯다 pairs, in the order a player would read them. */
const SPECIAL_PAIRS: ReadonlyArray<{ id: ImmediateYakuId; months: readonly [number, number] }> = [
  { id: "ali", months: [1, 2] },
  { id: "doksa", months: [1, 4] },
  { id: "gupping", months: [1, 9] },
  { id: "jangpping", months: [1, 10] },
  { id: "jangsa", months: [4, 10] },
  { id: "seryuk", months: [4, 6] },
];

export interface KkeutPairResult {
  yakuId: ImmediateYakuId;
  /** Added on top of the definition's base, so 9끗 beats 1끗. */
  rankBonusHeung: number;
  rankLabel: string;
}

/**
 * Judges the two-card 끗패. Exactly one result per pair — 광땡, then 땡, then a
 * named pair, then the plain 끗 ladder.
 */
export function judgeKkeutPair(
  left: CardInstance,
  right: CardInstance,
  context: YakuMatchContext = {},
): KkeutPairResult {
  const cupRole = context.cupRole ?? "animal";
  // 끗패의 족보는 카드에 인쇄된 월로 읽는다. 영구 월 합 보너스와
  // zero_base 같은 점수 효과가 12월+7월=갑오 같은 족보까지 바꾸면,
  // 화면에 보이는 두 숫자와 판정이 서로 달라진다.
  const a = left.month;
  const b = right.month;
  const months = [a, b].sort((x, y) => x - y) as [number, number];
  const hasOnlyClassicSeotdaMonths = a <= 10 && b <= 10;

  if (hasOnlyClassicSeotdaMonths && context.includeSecretYaku !== false && isBright(left, cupRole) && isBright(right, cupRole)) {
    const key = `${months[0]}-${months[1]}`;
    if (key === "3-8") return { yakuId: "gwangttaeng_38", rankBonusHeung: 0, rankLabel: "" };
    if (key === "1-8") return { yakuId: "gwangttaeng_18", rankBonusHeung: 0, rankLabel: "" };
    if (key === "1-3") return { yakuId: "gwangttaeng_13", rankBonusHeung: 0, rankLabel: "" };
  }

  // 11·12월도 이 게임에서는 정식 월패다. 광땡과 섯다 고유 조합만
  // 1~10월로 제한하고, 같은 월 두 장은 열두 달 모두 땡으로 읽는다.
  if (a === b) {
    if (a === 10) return { yakuId: "jangttaeng", rankBonusHeung: 0, rankLabel: "" };
    // 1땡 is the floor; every month above it adds 0.6.
    return {
      yakuId: "ttaeng",
      rankBonusHeung: Number(((Math.max(1, a) - 1) * 0.6).toFixed(4)),
      rankLabel: `${a}땡`,
    };
  }

  if (hasOnlyClassicSeotdaMonths) {
    for (const pair of SPECIAL_PAIRS) {
      if (months[0] === pair.months[0] && months[1] === pair.months[1]) {
        return { yakuId: pair.id, rankBonusHeung: 0, rankLabel: "" };
      }
    }
  }

  const rank = (a + b) % 10;
  if (rank === 9) return { yakuId: "gabo", rankBonusHeung: 0, rankLabel: "" };
  if (rank === 0) return { yakuId: "mangtong", rankBonusHeung: 0, rankLabel: "" };
  return {
    yakuId: "kkeut",
    rankBonusHeung: Number((rank * 0.3).toFixed(4)),
    rankLabel: `${rank}끗`,
  };
}

/** True when a set of 짓 cards settles on a legal total. */
export function isValidJit(sum: number, allowFiveMultiple = false): boolean {
  if (sum <= 0) return false;
  if (sum % 10 === 0) return true;
  return allowFiveMultiple && sum % 5 === 0;
}

/**
 * Splits the submission into 짓 + 끗패 using the player's pick order.
 *
 * The first two selected cards are always the 끗패. Every later card belongs to
 * the 짓, whose month sum must land on a multiple of ten. This makes the hand
 * controllable: changing selection order changes the intended 족보 instead of
 * silently replacing it with the mathematically strongest split.
 */
export function findImmediateYakuCandidates(
  submittedCards: readonly CardInstance[],
  context: YakuMatchContext = {},
): YakuCandidate[] {
  const submitted = uniqueCards(submittedCards)
    .filter((card) => !card.disabledForRound)
    .slice(0, MAX_SUBMISSION);
  if (submitted.length < MIN_SUBMISSION) return [];

  const allIds = submitted.map((card) => card.instanceId);
  const pair = [submitted[0], submitted[1]] as const;
  const jit = submitted.slice(2);
  const jitSum = jit.reduce((sum, card) => sum + getEffectiveMonth(card), 0);
  if (jit.length > 0 && !isValidJit(jitSum, context.allowFiveMultipleJit)) return [];

  const judged = judgeKkeutPair(pair[0], pair[1], context);
  const definition = getImmediateYakuDefinition(judged.yakuId);
  return [{
    yakuId: judged.yakuId,
    scoringCardIds: allIds,
    jitCardIds: jit.map((card) => card.instanceId),
    jitSum,
    label: definition.name,
    rankBonusHeung: judged.rankBonusHeung || undefined,
    rankLabel: judged.rankLabel || undefined,
  }];
}

export function getScoringCards(candidateEntry: YakuCandidate, submitted: readonly CardInstance[]): CardInstance[] {
  const ids = new Set(candidateEntry.scoringCardIds);
  return submitted.filter((card) => ids.has(card.instanceId));
}

function hasKind(
  card: CardInstance,
  kind: "bright" | "animal" | "ribbon" | "chaff",
  cupRole: CupRole,
): boolean {
  return hasEffectiveCardKind(card, kind, cupRole);
}

function requiredMonthProgress(
  id: CollectionYakuId,
  cards: readonly CardInstance[],
  months: readonly Month[],
  predicate: (card: CardInstance) => boolean,
): CollectionProgress {
  const matched = months.flatMap((month) => {
    const card = cards.find((entry) => entry.month === month && predicate(entry));
    return card ? [card.instanceId] : [];
  });
  return { yakuId: id, matchedCardIds: matched, required: months.length, completed: matched.length === months.length };
}

export function getCollectionProgress(input: CollectionEvaluationInput): CollectionProgress[] {
  const cupRole = input.cupRole ?? "animal";
  const cards = uniqueCards([...(input.confirmedCards ?? []), ...(input.pendingCards ?? []), ...(input.submittedCards ?? [])])
    .filter((card) => !card.disabledForRound);

  const progress: CollectionProgress[] = [
    requiredMonthProgress("hongdan", cards, [1, 2, 3], (card) => hasKind(card, "ribbon", cupRole) && card.ribbonGroup === "hong"),
    requiredMonthProgress("chodan", cards, [4, 5, 7], (card) => hasKind(card, "ribbon", cupRole) && card.ribbonGroup === "cho"),
    requiredMonthProgress("cheongdan", cards, [6, 9, 10], (card) => hasKind(card, "ribbon", cupRole) && card.ribbonGroup === "cheong"),
    requiredMonthProgress("godori", cards, [2, 4, 8], (card) => hasKind(card, "animal", cupRole) && card.tags.includes("bird")),
  ];

  const brights = cards.flatMap((card) =>
    Array.from({ length: getCollectionKindValue(card, "bright", cupRole) }, () => card),
  );
  const rainBrights = brights.filter((card) => card.tags.includes("rain"));
  const dryBrights = brights.filter((card) => !card.tags.includes("rain"));
  const rainIndex = rainBrights.length > 0 ? brights.indexOf(rainBrights[0]) : -1;
  const remainingBrights = rainIndex >= 0
    ? brights.filter((_, index) => index !== rainIndex)
    : brights;
  const rainMatched = rainBrights.length > 0 ? [rainBrights[0], ...remainingBrights.slice(0, 2)] : [];
  progress.push(
    { yakuId: "rain_three_brights", matchedCardIds: rainMatched.map((card) => card.instanceId), required: 3, completed: rainMatched.length >= 3 },
    { yakuId: "three_brights", matchedCardIds: dryBrights.slice(0, 3).map((card) => card.instanceId), required: 3, completed: dryBrights.length >= 3 },
    { yakuId: "four_brights", matchedCardIds: brights.slice(0, 4).map((card) => card.instanceId), required: 4, completed: brights.length >= 4 },
    { yakuId: "five_brights", matchedCardIds: brights.slice(0, 5).map((card) => card.instanceId), required: 5, completed: brights.length >= 5 },
    { yakuId: "six_brights", matchedCardIds: brights.slice(0, 6).map((card) => card.instanceId), required: 6, completed: brights.length >= 6 },
  );
  const godoriCards = cards.filter((card) => hasKind(card, "animal", cupRole) && card.tags.includes("bird"));
  progress.push(
    { yakuId: "four_godori", matchedCardIds: godoriCards.slice(0, 4).map((card) => card.instanceId), required: 4, completed: godoriCards.length >= 4 },
    { yakuId: "five_godori", matchedCardIds: godoriCards.slice(0, 5).map((card) => card.instanceId), required: 5, completed: godoriCards.length >= 5 },
  );
  return COLLECTION_YAKU_DEFINITIONS.map((definition) => progress.find((entry) => entry.yakuId === definition.id) as CollectionProgress);
}

export function detectNewCollectionCompletions(input: CollectionEvaluationInput): CollectionYakuId[] {
  const before = getCollectionProgress({ ...input, submittedCards: [] });
  const after = getCollectionProgress(input);
  const completedIds = new Set<CollectionYakuId>([
    ...(input.confirmedCompletedYakuIds ?? []),
    ...(input.pendingCompletedYakuIds ?? []),
  ]);
  let newlyCompleted = after
    .filter((entry) => entry.completed && !before.find((old) => old.yakuId === entry.yakuId)?.completed && !completedIds.has(entry.yakuId))
    .map((entry) => entry.yakuId);

  const brightRanks: Partial<Record<CollectionYakuId, number>> = {
    rain_three_brights: 3,
    three_brights: 3,
    four_brights: 4,
    five_brights: 5,
    six_brights: 6,
  };
  const highestBrightRank = Math.max(0, ...newlyCompleted.map((id) => brightRanks[id] ?? 0));
  if (highestBrightRank > 0) {
    newlyCompleted = newlyCompleted.filter((id) => !(id in brightRanks) || brightRanks[id] === highestBrightRank);
  }
  const godoriRanks: Partial<Record<CollectionYakuId, number>> = { godori: 3, four_godori: 4, five_godori: 5 };
  const highestGodoriRank = Math.max(0, ...newlyCompleted.map((id) => godoriRanks[id] ?? 0));
  if (highestGodoriRank > 0) {
    newlyCompleted = newlyCompleted.filter((id) => !(id in godoriRanks) || godoriRanks[id] === highestGodoriRank);
  }
  const order = new Map(COLLECTION_YAKU_DEFINITIONS.map((definition, index) => [definition.id, index]));
  return newlyCompleted.sort((left, right) => (order.get(left) ?? 0) - (order.get(right) ?? 0));
}

export function validateYakuDefinitions(): string[] {
  const issues: string[] = [];
  const expectedImmediate = 14;
  if (ALL_IMMEDIATE_YAKU_DEFINITIONS.length !== expectedImmediate) {
    issues.push(`expected ${expectedImmediate} immediate/secret definitions, got ${ALL_IMMEDIATE_YAKU_DEFINITIONS.length}`);
  }
  if (COLLECTION_YAKU_DEFINITIONS.length !== 11) issues.push(`expected 11 collection definitions, got ${COLLECTION_YAKU_DEFINITIONS.length}`);
  for (const definition of [...ALL_IMMEDIATE_YAKU_DEFINITIONS, ...COLLECTION_YAKU_DEFINITIONS]) {
    if (!definition.assetTag) issues.push(`missing assetTag: ${definition.id}`);
  }
  return issues;
}
