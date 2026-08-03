import type {
  CollectionState,
  GoChainState,
  MasteryEvent,
  YakuLevelState,
} from "../types";

export type GoLevel = 1 | 2 | 3;
export type SettlementReason = "bank" | "stop" | "force" | "auto";
export type PostHandTransition =
  | "go_fail_continue"
  | "go_fail_round_check"
  | "auto_settle"
  | "force_settle"
  | "settlement_decision";

export interface PendingHandPayload {
  submittedCardIds?: readonly string[];
  completedCollectionYakuIds?: CollectionState["completedYakuIds"];
  masteryEvents?: readonly MasteryEvent[];
}

export interface GoResolution {
  state: GoChainState;
  outcome: "new_chain" | "success" | "failure";
  threshold: number | null;
  combinedScore: number;
}

export interface SettlementOptions {
  target: number;
  handsRemaining: number;
  requiresSettledGo?: boolean;
  masteryLevels?: Readonly<Record<string, YakuLevelState>>;
}

export interface SettlementResolution {
  state: GoChainState;
  reason: SettlementReason;
  settlementValue: number;
  committedMasteryEvents: MasteryEvent[];
  masteryLevels: Record<string, YakuLevelState>;
  moneyBonus: number;
  won: boolean;
  lost: boolean;
}

const GO_MULTIPLIERS: Record<0 | GoLevel, number> = { 0: 1, 1: 1.15, 2: 1.35, 3: 1.7 };
const REQUIREMENT_RULES: Record<GoLevel, { potFactor: number; targetFactor: number }> = {
  1: { potFactor: 1.75, targetFactor: 0.12 },
  2: { potFactor: 1.6, targetFactor: 0.18 },
  3: { potFactor: 1.5, targetFactor: 0.25 },
};

function emptyCollection(): CollectionState {
  return { cardIds: [], completedYakuIds: [] };
}

function unique<T>(items: readonly T[]): T[] {
  return [...new Set(items)];
}

function mergeCollection(left: CollectionState, right: CollectionState): CollectionState {
  return {
    cardIds: unique([...left.cardIds, ...right.cardIds]),
    completedYakuIds: unique([...left.completedYakuIds, ...right.completedYakuIds]),
  };
}

function pendingFromPayload(payload: PendingHandPayload): CollectionState {
  return {
    cardIds: unique(payload.submittedCardIds ?? []),
    completedYakuIds: unique(payload.completedCollectionYakuIds ?? []),
  };
}

function clearPending(state: GoChainState): GoChainState {
  return {
    ...state,
    pot: 0,
    successfulGoCount: 0,
    requirement: null,
    pendingCollection: emptyCollection(),
    pendingMastery: [],
    armed: false,
    lastHandScore: 0,
  };
}

export function createGoChainState(): GoChainState {
  return {
    pot: 0,
    successfulGoCount: 0,
    requirement: null,
    confirmedScore: 0,
    confirmedGoCount: 0,
    confirmedCollection: emptyCollection(),
    pendingCollection: emptyCollection(),
    pendingMastery: [],
    armed: false,
    lastHandScore: 0,
  };
}

export function calculateGoRequirement(pot: number, target: number, nextGoLevel: GoLevel): number {
  if (!Number.isFinite(pot) || pot < 0 || !Number.isFinite(target) || target <= 0) {
    throw new RangeError("pot and target must be finite non-negative/positive values");
  }
  const rule = REQUIREMENT_RULES[nextGoLevel];
  return Math.ceil(Math.max(pot * rule.potFactor, pot + target * rule.targetFactor));
}

export function getSettlementValue(pot: number, successfulGoCount: 0 | GoLevel): number {
  if (!Number.isFinite(pot) || pot < 0) throw new RangeError("pot must be a finite non-negative value");
  return Math.floor(pot * GO_MULTIPLIERS[successfulGoCount]);
}

export function getNextHandMinimum(state: GoChainState): number | null {
  return state.requirement === null ? null : Math.max(0, state.requirement - state.pot);
}

export function canGo(state: GoChainState, target: number, handsRemaining: number): boolean {
  return !state.armed
    && state.successfulGoCount < 3
    && handsRemaining > 0
    && state.pot >= target * 0.15;
}

export function armGo(state: GoChainState, target: number, handsRemaining: number): GoChainState {
  if (!canGo(state, target, handsRemaining)) throw new Error("Go is not available in the current state");
  const nextGoLevel = (state.successfulGoCount + 1) as GoLevel;
  return {
    ...state,
    armed: true,
    requirement: calculateGoRequirement(state.pot, target, nextGoLevel),
  };
}

export function resolveGoAttempt(
  state: GoChainState,
  handScore: number,
  payload: PendingHandPayload = {},
): GoResolution {
  if (!Number.isFinite(handScore) || handScore < 0) throw new RangeError("handScore must be a finite non-negative value");
  const handPending = pendingFromPayload(payload);
  if (!state.armed) {
    if (state.pot !== 0 || state.pendingCollection.cardIds.length > 0 || state.pendingMastery.length > 0) {
      throw new Error("A non-armed hand can only start an empty chain");
    }
    return {
      state: {
        ...state,
        pot: handScore,
        pendingCollection: handPending,
        pendingMastery: [...(payload.masteryEvents ?? [])],
        lastHandScore: handScore,
      },
      outcome: "new_chain",
      threshold: null,
      combinedScore: handScore,
    };
  }

  if (state.requirement === null) throw new Error("An armed Go chain must have a requirement");
  const combinedScore = state.pot + handScore;
  if (combinedScore < state.requirement) {
    const threshold = state.requirement;
    return {
      state: clearPending(state),
      outcome: "failure",
      threshold,
      combinedScore,
    };
  }

  const successfulGoCount = (state.successfulGoCount + 1) as 1 | 2 | 3;
  return {
    state: {
      ...state,
      pot: combinedScore,
      successfulGoCount,
      requirement: null,
      pendingCollection: mergeCollection(state.pendingCollection, handPending),
      pendingMastery: [...state.pendingMastery, ...(payload.masteryEvents ?? [])],
      armed: false,
      lastHandScore: handScore,
    },
    outcome: "success",
    threshold: state.requirement,
    combinedScore,
  };
}

export function choosePostHandTransition(
  resolution: GoResolution,
  handsRemaining: number,
): PostHandTransition {
  if (resolution.outcome === "failure") {
    return handsRemaining === 0 ? "go_fail_round_check" : "go_fail_continue";
  }
  if (handsRemaining === 0) return "auto_settle";
  if (resolution.state.successfulGoCount === 3) return "force_settle";
  return "settlement_decision";
}

export function checkConfirmedVictory(
  state: GoChainState,
  target: number,
  requiresSettledGo = false,
): boolean {
  return state.confirmedScore >= target && (!requiresSettledGo || state.confirmedGoCount >= 1);
}

export function settleChainAtomically(
  state: GoChainState,
  reason: SettlementReason,
  options: SettlementOptions,
): SettlementResolution {
  if (state.armed) throw new Error("Cannot settle while a Go attempt is armed");
  const settlementValue = getSettlementValue(state.pot, state.successfulGoCount);
  const collectionEvents = state.pendingMastery.filter((event) => event.reason === "collection");
  const goCollectionBonusEvents: MasteryEvent[] = state.successfulGoCount >= 1
    ? collectionEvents.map((event) => ({ yakuId: event.yakuId, amount: 1, reason: "go_collection_bonus" }))
    : [];
  const committedMasteryEvents = [...state.pendingMastery, ...goCollectionBonusEvents];
  const masteryLevels = commitMasteryEvents(options.masteryLevels ?? {}, committedMasteryEvents);
  const settled: GoChainState = {
    ...state,
    confirmedScore: state.confirmedScore + settlementValue,
    confirmedGoCount: state.confirmedGoCount + state.successfulGoCount,
    confirmedCollection: mergeCollection(state.confirmedCollection, state.pendingCollection),
  };
  const cleared = clearPending(settled);
  const won = checkConfirmedVictory(cleared, options.target, options.requiresSettledGo ?? false);
  const lost = !won && options.handsRemaining === 0;
  return {
    state: cleared,
    reason,
    settlementValue,
    committedMasteryEvents,
    masteryLevels,
    moneyBonus: state.successfulGoCount + goCollectionBonusEvents.length,
    won,
    lost,
  };
}

export function bankChain(state: GoChainState, options: SettlementOptions): SettlementResolution {
  return settleChainAtomically(state, "bank", options);
}

export function stopRound(state: GoChainState, options: SettlementOptions): SettlementResolution {
  return settleChainAtomically(state, "stop", options);
}

export function forceOrAutoSettle(
  state: GoChainState,
  reason: "force" | "auto",
  options: SettlementOptions,
): SettlementResolution {
  return settleChainAtomically(state, reason, options);
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
