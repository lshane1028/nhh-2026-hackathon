import type { GameState } from "../types";
import { removeRedundantKindEffect } from "../content/card-effects";

// v2 = 짓고땡. A v1 save holds the old poker-style yaku ids, which no longer
// resolve, so bumping the key is the cheapest way to drop them.
export const SAVE_KEY = "flower-board-go:v2";

export interface SaveEnvelope {
  schemaVersion: 1;
  savedAt: string;
  game: GameState;
}

export function saveGame(state: GameState): void {
  if (typeof window === "undefined") return;
  const envelope: SaveEnvelope = {
    schemaVersion: 1,
    savedAt: new Date().toISOString(),
    game: state,
  };
  window.localStorage.setItem(SAVE_KEY, JSON.stringify(envelope));
}

export function loadGame(): GameState | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(SAVE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<SaveEnvelope>;
    if (parsed.schemaVersion !== 1 || !isGameState(parsed.game)) {
      window.localStorage.removeItem(SAVE_KEY);
      return null;
    }
    return normalizeGameState(parsed.game);
  } catch {
    window.localStorage.removeItem(SAVE_KEY);
    return null;
  }
}

export function normalizeGameState(game: GameState): GameState {
  const legacyRoundScore = game.chain.roundScore ?? 0;
  const submissionScore = game.chain.submissionScore ?? legacyRoundScore;
  const collectionScore = game.chain.collectionScore ?? 0;
  return {
    ...game,
    deck: game.deck.map(removeRedundantKindEffect),
    drawPile: game.drawPile.map(removeRedundantKindEffect),
    hand: game.hand.map(removeRedundantKindEffect),
    usedPile: game.usedPile.map(removeRedundantKindEffect),
    pendingPack: game.pendingPack
      ? { ...game.pendingPack, candidates: game.pendingPack.candidates.map(removeRedundantKindEffect) }
      : null,
    experimentalRules: { ...game.experimentalRules, yardMatching: false },
    yard: { cards: [], sweptCount: 0 },
    baseHands: game.baseHands ?? 4,
    baseDiscards: game.baseDiscards ?? 4,
    targetMultiplier: game.targetMultiplier ?? 1,
    roundSettlementBonus: game.roundSettlementBonus ?? 0,
    failMoneyPenalty: game.failMoneyPenalty ?? 0,
    roundSubmissionIndex: game.roundSubmissionIndex ?? 0,
    roundHighestHand: game.roundHighestHand ?? game.stats?.highestHand ?? 0,
    roundHighestSubmissionCards: game.roundHighestSubmissionCards ?? 0,
    roundTalismanUses: game.roundTalismanUses ?? {},
    scoredMonthsThisRound: game.scoredMonthsThisRound ?? [],
    returnScreen: game.returnScreen ?? null,
    cupAssignments: game.cupAssignments ?? {},
    pendingCupCardId: game.pendingCupCardId ?? null,
    pendingCupExtraDiscardsBefore: game.pendingCupExtraDiscardsBefore ?? null,
    lastForbiddenOfferId: game.lastForbiddenOfferId ?? null,
    chain: {
      ...game.chain,
      submissionScore,
      collectionScore,
      roundScore: submissionScore + collectionScore,
    },
    lastRoundSummary: game.lastRoundSummary ?? null,
    stats: {
      ...game.stats,
      highestSubmissionCards: game.stats?.highestSubmissionCards ?? 0,
    },
  };
}

export function clearSavedGame(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(SAVE_KEY);
}

function isGameState(value: unknown): value is GameState {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<GameState>;
  return (
    candidate.version === 1 &&
    typeof candidate.seed === "string" &&
    typeof candidate.stage === "number" &&
    Array.isArray(candidate.deck) &&
    Array.isArray(candidate.hand) &&
    Array.isArray(candidate.talismans) &&
    candidate.chain != null &&
    typeof candidate.chain === "object"
  );
}
