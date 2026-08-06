import type { GameState } from "../types";

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

function normalizeGameState(game: GameState): GameState {
  return {
    ...game,
    experimentalRules: { ...game.experimentalRules, yardMatching: false },
    yard: { cards: [], sweptCount: 0 },
    baseHands: game.baseHands ?? 4,
    baseDiscards: game.baseDiscards ?? 4,
    targetMultiplier: game.targetMultiplier ?? 1,
    roundSettlementBonus: game.roundSettlementBonus ?? 0,
    failMoneyPenalty: game.failMoneyPenalty ?? 0,
    roundSubmissionIndex: game.roundSubmissionIndex ?? 0,
    roundTalismanUses: game.roundTalismanUses ?? {},
    scoredMonthsThisRound: game.scoredMonthsThisRound ?? [],
    returnScreen: game.returnScreen ?? null,
    cupAssignments: game.cupAssignments ?? {},
    pendingCupCardId: game.pendingCupCardId ?? null,
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
