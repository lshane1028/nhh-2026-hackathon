import type {
  CollectionState,
  GoChainState,
  MasteryEvent,
  YakuLevelState,
} from "../types";

export type GoLevel = 0 | 1 | 2 | 3;

export const MAX_GO_LEVEL = 3;

/**
 * Go is a single bet taken at the end of a round, not a per-hand chain.
 * Every hand adds to the round score. Once the round score clears the current
 * bar the player either stops and banks the reward, or calls Go, which raises
 * the bar and the payout. Missing a called Go loses the run.
 */
const THRESHOLD_RATIOS: Record<GoLevel, number> = { 0: 1, 1: 1.8, 2: 2.8, 3: 4.2 };
const REWARD_FACTORS: Record<GoLevel, number> = { 0: 1, 1: 1.7, 2: 2.7, 3: 4.2 };

/**
 * A Go must also beat the score already on the table, not just a multiple of
 * the target. Without this, clearing the target with one huge hand made the
 * next Go free — the bar was already behind you the moment you called it.
 */
const OVERSHOOT_GROWTH = 1.5;

function unique<T>(items: readonly T[]): T[] {
  return [...new Set(items)];
}

function emptyCollection(): CollectionState {
  return { cardIds: [], completedYakuIds: [] };
}

export function createGoChainState(): GoChainState {
  return {
    submissionScore: 0,
    collectionScore: 0,
    roundScore: 0,
    goCount: 0,
    /** null until a Go is called; before that the bar is simply the target. */
    goRequirement: null,
    collection: emptyCollection(),
    mastery: [],
  };
}

function assertLevel(goCount: number): GoLevel {
  if (!Number.isInteger(goCount) || goCount < 0 || goCount > MAX_GO_LEVEL) {
    throw new RangeError(`goCount must be an integer between 0 and ${MAX_GO_LEVEL}`);
  }
  return goCount as GoLevel;
}

/**
 * The bar for a Go level. `currentScore` is what is already banked this round;
 * the bar never lands below a real increase on top of it.
 */
export function getGoRequirement(
  target: number,
  goCount: number,
  thresholdFactor = 1,
  currentScore = 0,
): number {
  if (!Number.isFinite(target) || target <= 0) throw new RangeError("target must be a positive finite number");
  const level = assertLevel(goCount);
  const factor = Number.isFinite(thresholdFactor) && thresholdFactor > 0 ? thresholdFactor : 1;
  if (level === 0) return Math.ceil(target);
  // Round off float noise first: 1000 * 1.5 * 1.1 is 1650.0000000000002, and
  // ceiling that raw would quietly cost the player a point.
  const fromTarget = Number((target * THRESHOLD_RATIOS[level] * factor).toFixed(6));
  const fromScore = Number((Math.max(0, currentScore) * OVERSHOOT_GROWTH * factor).toFixed(6));
  return Math.ceil(Math.max(fromTarget, fromScore));
}

/** Multiplier applied to the round's money reward for a settled Go level. */
export function getGoRewardFactor(goCount: number): number {
  return REWARD_FACTORS[assertLevel(goCount)];
}

export function getRemainingToRequirement(state: GoChainState, requirement: number): number {
  return Math.max(0, requirement - state.roundScore);
}

export function isRequirementCleared(state: GoChainState, requirement: number): boolean {
  return state.roundScore >= requirement;
}

export function canDeclareGo(state: GoChainState, handsRemaining: number): boolean {
  return state.goCount < MAX_GO_LEVEL && handsRemaining > 0;
}

export interface HandContribution {
  submittedCardIds?: readonly string[];
  completedCollectionYakuIds?: CollectionState["completedYakuIds"];
  masteryEvents?: readonly MasteryEvent[];
  /** Absolute converted collection score after this hand. */
  collectionScore?: number;
}

/** Folds one scored hand into the round. Nothing is ever rolled back. */
export function addHandToRound(
  state: GoChainState,
  handScore: number,
  contribution: HandContribution = {},
): GoChainState {
  if (!Number.isFinite(handScore) || handScore < 0) {
    throw new RangeError("handScore must be a finite non-negative value");
  }
  const submissionScore = state.submissionScore + handScore;
  const collectionScore = contribution.collectionScore ?? state.collectionScore;
  return {
    ...state,
    submissionScore,
    collectionScore,
    roundScore: submissionScore + collectionScore,
    collection: {
      cardIds: unique([...state.collection.cardIds, ...(contribution.submittedCardIds ?? [])]),
      completedYakuIds: unique([
        ...state.collection.completedYakuIds,
        ...(contribution.completedCollectionYakuIds ?? []),
      ]),
    },
    mastery: [...state.mastery, ...(contribution.masteryEvents ?? [])],
  };
}

/**
 * Locks in the next bar. The requirement is snapshotted here because it depends
 * on the score at the moment of the call — recomputing it later would let it
 * drift upward as the player scores.
 */
export function declareGo(state: GoChainState, target: number, thresholdFactor = 1): GoChainState {
  if (state.goCount >= MAX_GO_LEVEL) throw new Error("Go level is already at its maximum");
  const goCount = (state.goCount + 1) as GoLevel;
  return {
    ...state,
    goCount,
    goRequirement: getGoRequirement(target, goCount, thresholdFactor, state.roundScore),
  };
}

export interface RoundSettlement {
  goCount: GoLevel;
  roundScore: number;
  rewardFactor: number;
  masteryEvents: MasteryEvent[];
  masteryLevels: Record<string, YakuLevelState>;
}

/**
 * Banks the round. Go mastery bonuses are granted here so that a player who
 * pushed further also grows their yaku faster.
 */
export function settleRound(
  state: GoChainState,
  masteryLevels: Readonly<Record<string, YakuLevelState>> = {},
): RoundSettlement {
  const collectionEvents = state.mastery.filter((event) => event.reason === "collection");
  const goBonusEvents: MasteryEvent[] = state.goCount >= 1
    ? collectionEvents.map((event) => ({ yakuId: event.yakuId, amount: 1, reason: "go_collection_bonus" }))
    : [];
  const masteryEvents = [...state.mastery, ...goBonusEvents];
  return {
    goCount: state.goCount,
    roundScore: state.roundScore,
    rewardFactor: getGoRewardFactor(state.goCount),
    masteryEvents,
    masteryLevels: commitMasteryEvents(masteryLevels, masteryEvents),
  };
}

export function commitMasteryEvents(
  levels: Readonly<Record<string, YakuLevelState>>,
  events: readonly MasteryEvent[],
): Record<string, YakuLevelState> {
  const next: Record<string, YakuLevelState> = Object.fromEntries(
    Object.entries(levels).map(([id, value]) => [id, { ...value }]),
  );
  for (const event of events) {
    const current = next[event.yakuId] ?? { level: 1, mastery: 0 };
    let level = Math.max(1, Math.floor(current.level));
    let mastery = Math.max(0, current.mastery) + Math.max(0, event.amount);
    let requirement = level * 2 + 1;
    while (mastery >= requirement) {
      mastery -= requirement;
      level += 1;
      requirement = level * 2 + 1;
    }
    next[event.yakuId] = { level, mastery };
  }
  return next;
}
