import {
  ALL_IMMEDIATE_YAKU_DEFINITIONS,
  getCollectionYakuDefinition,
  getImmediateYakuDefinition,
} from "../content/yaku";
import type {
  CardInstance,
  CollectionYakuId,
  MasteryEvent,
  ScoreBreakdown,
  ScoreOperation,
  TalismanInstance,
  YakuCandidate,
  YakuId,
  YakuLevelState,
} from "../types";
import { getEffectiveCardRole, type CupRole } from "./deck";
import {
  detectNewCollectionCompletions,
  findImmediateYakuCandidates,
  getScoringCards,
  type CollectionEvaluationInput,
  type YakuMatchContext,
} from "./yaku";

export interface OrderedScoreEffect {
  sourceId: string;
  label: string;
  operation: ScoreOperation["operation"];
  value: number;
}

export interface ScoreInput {
  candidate: YakuCandidate;
  submittedCards: readonly CardInstance[];
  heldCards?: readonly CardInstance[];
  collection?: CollectionEvaluationInput;
  newCollectionYakuIds?: readonly CollectionYakuId[];
  /**
   * Legacy one-time collection completion rewards are useful to the standalone
   * scorer, but the live game uses persistent collection tracks instead.
   */
  applyCollectionCompletionBonus?: boolean;
  yakuLevels?: Partial<Record<YakuId, number | YakuLevelState>>;
  cupRole?: CupRole;
  talismans?: readonly TalismanInstance[];
  orderedTalismanEffects?: readonly OrderedScoreEffect[];
}

export interface BestScoreInput extends Omit<ScoreInput, "candidate">, YakuMatchContext {
  manualYakuId?: YakuCandidate["yakuId"] | null;
}

export const STONE_MONTH_VALUE = 12;
export const INKED_MONTH_BONUS = 3;
export const GOLD_LEAF_MONTH_BONUS = 5;

function levelOf(id: YakuId, levels: ScoreInput["yakuLevels"]): number {
  const value = levels?.[id];
  if (typeof value === "number") return Math.max(1, Math.floor(value));
  return Math.max(1, Math.floor(value?.level ?? 1));
}

function appendOperation(
  operations: ScoreOperation[],
  state: { kkeut: number; heung: number },
  effect: OrderedScoreEffect,
): void {
  if (!Number.isFinite(effect.value)) throw new RangeError(`Non-finite score effect from ${effect.sourceId}`);
  if (effect.operation === "add_kkeut") state.kkeut += effect.value;
  else if (effect.operation === "add_heung") state.heung += effect.value;
  else if (effect.operation === "multiply_heung") state.heung *= effect.value;
  else state.kkeut = effect.value;
  operations.push({
    ...effect,
    runningKkeut: state.kkeut,
    runningHeung: state.heung,
  });
}

function scoreCardOnce(
  card: CardInstance,
  operations: ScoreOperation[],
  state: { kkeut: number; heung: number },
  suffix = "",
): void {
  // The card's own month is NOT added here any more. Under 짓고땡 the 월 합 is
  // the 짓 total, so a card only contributes what its enhancements print.
  if (card.enhancement === "inked") {
    appendOperation(operations, state, { sourceId: card.instanceId, label: `먹칠${suffix}`, operation: "add_kkeut", value: INKED_MONTH_BONUS });
  } else if (card.enhancement === "scarlet") {
    appendOperation(operations, state, { sourceId: card.instanceId, label: `홍칠${suffix}`, operation: "add_heung", value: 3 });
  } else if (card.enhancement === "glass") {
    appendOperation(operations, state, { sourceId: card.instanceId, label: `유리패${suffix}`, operation: "multiply_heung", value: 1.75 });
  }

  if (card.edition === "gold_leaf") {
    appendOperation(operations, state, { sourceId: card.instanceId, label: `금박${suffix}`, operation: "add_kkeut", value: GOLD_LEAF_MONTH_BONUS });
  } else if (card.edition === "mother_of_pearl") {
    appendOperation(operations, state, { sourceId: card.instanceId, label: `자개${suffix}`, operation: "add_heung", value: 6 });
  } else if (card.edition === "five_color") {
    appendOperation(operations, state, { sourceId: card.instanceId, label: `오색${suffix}`, operation: "multiply_heung", value: 1.35 });
  }
}

function scoreP0Talisman(
  talisman: TalismanInstance,
  candidate: YakuCandidate,
  scoringCards: readonly CardInstance[],
  cupRole: CupRole,
): OrderedScoreEffect | null {
  const roles = scoringCards.map((card) => ({ card, role: getEffectiveCardRole(card, cupRole) }));
  if (talisman.definitionId === "t_chaff_bind") {
    return {
      sourceId: talisman.instanceId,
      label: "피붙이",
      operation: "add_kkeut",
      value: roles.reduce((sum, entry) => sum + (entry.role.kind === "chaff" ? entry.role.chaffValue * 3 : 0), 0),
    };
  }
  if (talisman.definitionId === "t_ribbon_maker") {
    return { sourceId: talisman.instanceId, label: "띠장이", operation: "add_kkeut", value: roles.filter((entry) => entry.role.kind === "ribbon").length * 5 };
  }
  if (talisman.definitionId === "t_animal_tracks") {
    return { sourceId: talisman.instanceId, label: "산짐승 발자국", operation: "add_kkeut", value: roles.filter((entry) => entry.role.kind === "animal").length * 6 };
  }
  if (talisman.definitionId === "t_bright_polish") {
    return { sourceId: talisman.instanceId, label: "광약", operation: "add_kkeut", value: roles.filter((entry) => entry.role.kind === "bright").length * 10 };
  }
  if (talisman.definitionId === "t_pair_knot" && ["ttaeng", "jangttaeng"].includes(candidate.yakuId)) {
    return { sourceId: talisman.instanceId, label: "짝패 매듭", operation: "add_heung", value: 2 };
  }
  return null;
}

export function calculateHandScore(input: ScoreInput): ScoreBreakdown {
  const cupRole = input.cupRole ?? "animal";
  const definition = getImmediateYakuDefinition(input.candidate.yakuId);
  const immediateLevel = levelOf(definition.id, input.yakuLevels);
  // 월 합 is the 짓 total. A bare 끗패 has no 짓, so it scores off a base of 1 —
  // enough to be worth playing, far short of a real hand.
  const startingKkeut = input.candidate.jitSum > 0 ? input.candidate.jitSum : 1;
  const startingHeung = definition.baseHeung + (immediateLevel - 1) * definition.growthHeung;
  const operations: ScoreOperation[] = [];
  const state = { kkeut: startingKkeut, heung: startingHeung };

  // 끗/땡 rank sits on top of the family base so the breakdown stays readable.
  if (input.candidate.rankBonusHeung) {
    appendOperation(operations, state, {
      sourceId: `${input.candidate.yakuId}:rank`,
      label: input.candidate.rankLabel ?? "끗패 등급",
      operation: "add_heung",
      value: input.candidate.rankBonusHeung,
    });
  }
  const newCollectionYakuIds = [...(
    input.newCollectionYakuIds ?? (input.collection ? detectNewCollectionCompletions(input.collection) : [])
  )];

  if (input.applyCollectionCompletionBonus !== false) {
    for (const yakuId of newCollectionYakuIds) {
      const collection = getCollectionYakuDefinition(yakuId);
      const level = levelOf(yakuId, input.yakuLevels);
      appendOperation(operations, state, {
        sourceId: yakuId,
        label: `${collection.name} 완성 배수`,
        operation: "add_heung",
        value: collection.completionHeung + (level - 1) * collection.growthHeung,
      });
    }
  }

  const candidateScoringCards = getScoringCards(input.candidate, input.submittedCards);
  const stoneCards = input.submittedCards.filter((card) => card.enhancement === "stone");
  const scoringIds = new Set(candidateScoringCards.map((card) => card.instanceId));
  const scoringCards = input.submittedCards.filter(
    (card) => scoringIds.has(card.instanceId) || stoneCards.some((stone) => stone.instanceId === card.instanceId),
  );
  for (const card of scoringCards) {
    scoreCardOnce(card, operations, state);
    if (card.seal === "red") scoreCardOnce(card, operations, state, " 재발동");
  }

  for (const card of input.heldCards ?? []) {
    if (card.enhancement === "steel") {
      appendOperation(operations, state, {
        sourceId: card.instanceId,
        label: "강철패",
        operation: "multiply_heung",
        value: 1.25,
      });
    }
  }

  for (const talisman of input.talismans ?? []) {
    const effect = scoreP0Talisman(talisman, input.candidate, scoringCards, cupRole);
    if (effect && effect.value !== 0) appendOperation(operations, state, effect);
  }
  for (const effect of input.orderedTalismanEffects ?? []) appendOperation(operations, state, effect);

  const score = Math.floor(state.kkeut * state.heung);
  if (!Number.isFinite(score)) throw new RangeError("Score became non-finite");
  return {
    yakuId: input.candidate.yakuId,
    yakuName: definition.name,
    scoringCardIds: scoringCards.map((card) => card.instanceId),
    jitCardIds: [...input.candidate.jitCardIds],
    jitSum: input.candidate.jitSum,
    rankLabel: input.candidate.rankLabel,
    newCollectionYakuIds,
    startingKkeut,
    startingHeung,
    finalKkeut: state.kkeut,
    finalHeung: state.heung,
    score,
    operations,
  };
}

const registryOrder = new Map(ALL_IMMEDIATE_YAKU_DEFINITIONS.map((definition, index) => [definition.id, index]));

function compareEvaluated(left: ScoreBreakdown, right: ScoreBreakdown): number {
  if (left.score !== right.score) return right.score - left.score;
  if (left.finalKkeut !== right.finalKkeut) return right.finalKkeut - left.finalKkeut;
  const registryDifference = (registryOrder.get(left.yakuId) ?? 999) - (registryOrder.get(right.yakuId) ?? 999);
  if (registryDifference !== 0) return registryDifference;
  const idDifference = left.yakuId.localeCompare(right.yakuId);
  if (idDifference !== 0) return idDifference;
  return left.scoringCardIds.join("|").localeCompare(right.scoringCardIds.join("|"));
}

export function chooseDefaultCandidate(evaluated: readonly ScoreBreakdown[]): ScoreBreakdown {
  if (evaluated.length === 0) throw new Error("Cannot choose a candidate from an empty list");
  return [...evaluated].sort(compareEvaluated)[0];
}

export function evaluateCandidateScore(candidate: YakuCandidate, input: Omit<ScoreInput, "candidate">): ScoreBreakdown {
  return calculateHandScore({ ...input, candidate });
}

export function evaluateImmediateCandidates(input: BestScoreInput): ScoreBreakdown[] {
  const candidates = findImmediateYakuCandidates(input.submittedCards, {
    cupRole: input.cupRole,
    allowFiveMultipleJit: input.allowFiveMultipleJit,
    includeSecretYaku: input.includeSecretYaku,
  });
  return candidates.map((candidate) => calculateHandScore({ ...input, candidate }));
}

export function calculateBestHandScore(input: BestScoreInput): ScoreBreakdown {
  const evaluated = evaluateImmediateCandidates(input);
  if (input.manualYakuId) {
    const manual = evaluated.filter((entry) => entry.yakuId === input.manualYakuId);
    if (manual.length > 0) return chooseDefaultCandidate(manual);
  }
  return chooseDefaultCandidate(evaluated);
}

export function createMasteryEvents(breakdown: ScoreBreakdown): MasteryEvent[] {
  return [
    { yakuId: breakdown.yakuId, amount: 1, reason: "played" },
    ...breakdown.newCollectionYakuIds.map<MasteryEvent>((yakuId) => ({
      yakuId,
      amount: 1,
      reason: "collection",
    })),
  ];
}
