import type { GameState } from "../types";
import { removeRedundantKindEffect } from "../content/card-effects";
import { FORBIDDEN_CARDS } from "../content/upgrades";

// v2 = 짓고땡. A v1 save holds the old poker-style yaku ids, which no longer
// resolve, so bumping the key is the cheapest way to drop them.
export const SAVE_KEY = "flower-board-go:v2";
const RETIRED_TALISMAN_IDS = new Set(["t_twelve_month_painter", "t_five_direction_goblin"]);

export interface SaveEnvelope {
  schemaVersion: 1;
  savedAt: string;
  game: GameState;
}

/** Removes card flags that belonged to rules retired from the current build. */
function normalizeCurrentRuleCard<T extends GameState["deck"][number]>(card: T): T {
  return removeRedundantKindEffect({
    ...card,
    tags: card.tags.filter((tag) => tag !== "zero_base"),
  }) as T;
}

export function saveGame(state: GameState): void {
  if (typeof window === "undefined") return;
  const envelope: SaveEnvelope = {
    schemaVersion: 1,
    savedAt: new Date().toISOString(),
    game: state,
  };
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(envelope));
  } catch {
    // Storage can be unavailable or full in private/embedded browsers. A save
    // failure must never interrupt a score animation or leave the run stuck.
  }
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
  const inferredForbiddenCardsUsed = Object.fromEntries(
    FORBIDDEN_CARDS.flatMap((definition) => {
      const count = (game.logs ?? []).filter((entry) => entry.kind === "reward" && entry.title === definition.name).length;
      return count > 0 ? [[definition.id, count]] : [];
    }),
  );
  return {
    ...game,
    deck: game.deck.map(normalizeCurrentRuleCard),
    drawPile: game.drawPile.map(normalizeCurrentRuleCard),
    hand: game.hand.map(normalizeCurrentRuleCard),
    usedPile: game.usedPile.map(normalizeCurrentRuleCard),
    talismans: game.talismans.filter((item) => !RETIRED_TALISMAN_IDS.has(item.definitionId)),
    pendingPack: game.pendingPack
      ? { ...game.pendingPack, candidates: game.pendingPack.candidates.map(normalizeCurrentRuleCard) }
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
      highestHandYakuId: game.stats?.highestHandYakuId ?? null,
      highestHandCards: game.stats?.highestHandCards ?? [],
      highestSubmissionCards: game.stats?.highestSubmissionCards ?? 0,
      forbiddenCardsUsed: game.stats?.forbiddenCardsUsed ?? inferredForbiddenCardsUsed,
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
