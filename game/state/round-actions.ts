import { BOSS_BY_ID } from "../content/bosses";
import { shuffleDeterministic } from "../engine/rng";
import type { BossDefinition, CardInstance, GameState } from "../types";
import { getEffectiveHandSize } from "./selectors";

export const MAX_SELECTED = 5;

/** 광 → 동물 → 띠 → 피, the order a hwatu player reads a hand in. */
const KIND_ORDER: Record<CardInstance["kind"], number> = {
  bright: 0,
  animal: 1,
  ribbon: 2,
  chaff: 3,
};

/** Calendar order keeps the month sums used by 짓 easy to scan. */
export function sortHand(hand: readonly CardInstance[]): CardInstance[] {
  return [...hand].sort((left, right) =>
    left.month - right.month
    || KIND_ORDER[left.kind] - KIND_ORDER[right.kind]
    || left.instanceId.localeCompare(right.instanceId),
  );
}

export function cloneCard(card: CardInstance): CardInstance {
  return { ...card, tags: [...card.tags] };
}

export function faceDownForBoss(cards: CardInstance[], boss: BossDefinition | null): CardInstance[] {
  if (boss?.ruleKey !== "two_face_down") return cards;
  return cards.map((card, index) =>
    index < 2 ? { ...card, tags: [...card.tags, "face_down"] } : card,
  );
}

export function refillHand(state: GameState, currentHand: CardInstance[]): GameState {
  const needed = Math.max(0, getEffectiveHandSize(state) - currentHand.length);
  if (needed === 0) return { ...state, hand: sortHand(currentHand) };

  let pile = state.drawPile;
  let cursor = state.rngCursor;
  let usedPile = state.usedPile;
  if (pile.length < needed && usedPile.length > 0) {
    const shuffled = shuffleDeterministic(usedPile.map(cloneCard), {
      seed: `${state.seed}:recycle:${state.stage}`,
      cursor,
    });
    pile = [...pile, ...shuffled.value];
    cursor = shuffled.state.cursor;
    usedPile = [];
  }
  const drawn = pile.slice(0, needed).map(cloneCard);
  const luckyDiscards = drawn.filter((card) => card.effectTagId === "drawn_luck").length;
  const boss = state.bossId ? BOSS_BY_ID[state.bossId] ?? null : null;
  return {
    ...state,
    rngCursor: cursor,
    discardsRemaining: state.discardsRemaining + luckyDiscards,
    hand: sortHand([...currentHand, ...faceDownForBoss(drawn, boss)]),
    drawPile: pile.slice(drawn.length),
    usedPile,
  };
}

export function selectHandCard(state: GameState, cardId: string): GameState {
  const card = state.hand.find((entry) => entry.instanceId === cardId);
  if (!card) return state;
  const already = state.selectedCardIds.includes(cardId);
  const selectedCardIds = already
    ? state.selectedCardIds.filter((id) => id !== cardId)
    : state.selectedCardIds.length < MAX_SELECTED
      ? [...state.selectedCardIds, cardId]
      : state.selectedCardIds;
  const hand = card.tags.includes("face_down")
    ? state.hand.map((entry) => entry.instanceId === card.instanceId
      ? { ...entry, tags: entry.tags.filter((tag) => tag !== "face_down") }
      : entry)
    : state.hand;
  return { ...state, hand, selectedCardIds };
}

export function clearHandSelection(state: GameState): GameState {
  return state.selectedCardIds.length > 0 ? { ...state, selectedCardIds: [] } : state;
}
