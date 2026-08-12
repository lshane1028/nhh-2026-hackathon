import { BOSS_BY_ID } from "../content/bosses";
import { PAINTER_CARDS } from "../content/upgrades";
import { getBossDiscardMoneyCost } from "../engine/boss";
import { applyPainterEffect } from "../engine/consumables";
import { canDeclareGo, declareGo, isRequirementCleared } from "../engine/go";
import { randomAt, shuffleDeterministic } from "../engine/rng";
import type { BossDefinition, CardInstance, GameState } from "../types";
import { prependGameLog as logEntry } from "./logs";
import {
  getEffectiveHandSize,
  getGoThresholdFactor,
  getRoundRequirement,
  isUndiscardable,
} from "./selectors";

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

export function discardSelected(state: GameState): GameState {
  if (state.screen !== "play" || state.discardsRemaining <= 0 || state.selectedCardIds.length === 0) return state;
  const cost = getBossDiscardMoneyCost(state.bossId ? BOSS_BY_ID[state.bossId] ?? null : null);
  if (state.money < cost) {
    return { ...state, logs: logEntry(state, "system", "버리기 불가", "세금쟁이에게 낼 냥이 없습니다.") };
  }
  const ids = new Set(state.selectedCardIds);
  const stuck = state.hand.filter((card) => ids.has(card.instanceId) && isUndiscardable(card));
  const discarded = state.hand.filter((card) => ids.has(card.instanceId) && !isUndiscardable(card));
  if (discarded.length === 0) {
    return {
      ...state,
      logs: logEntry(state, "system", "버리기 불가", "고집패는 버릴 수 없습니다."),
    };
  }
  const kept = state.hand.filter((card) => !ids.has(card.instanceId) || isUndiscardable(card));
  let deck = state.deck;
  let cursor = state.rngCursor;
  const purpleResults: string[] = [];
  const generatedPainters = PAINTER_CARDS.filter((entry) => (
    entry.minTargets <= 1 && entry.maxTargets >= 1 && entry.effectKey !== "repeat_last_consumable"
  ));
  for (const purple of discarded.filter((card) => card.seal === "purple")) {
    const painter = generatedPainters[
      Math.floor(randomAt(`${state.seed}:purple:${purple.instanceId}`, cursor++) * generatedPainters.length)
    ];
    const target = deck[
      Math.floor(randomAt(`${state.seed}:purple-target:${purple.instanceId}`, cursor++) * deck.length)
    ];
    if (painter && target) {
      const result = applyPainterEffect(
        deck,
        painter,
        [target.instanceId],
        undefined,
        (prefix) => `${prefix}:${state.runId}:${cursor++}`,
      );
      deck = result.deck;
      purpleResults.push(`자인 → ${painter.name} 자동 적용`);
    }
  }
  const next: GameState = {
    ...state,
    deck,
    rngCursor: cursor,
    hand: kept,
    usedPile: [...state.usedPile, ...discarded],
    selectedCardIds: [],
    discardsRemaining: state.discardsRemaining - 1,
    money: state.money - cost,
    stats: { ...state.stats, discardsUsed: state.stats.discardsUsed + 1 },
    logs: logEntry(
      state,
      "system",
      `${discarded.length}장 버림`,
      [
        stuck.length ? `고집패 ${stuck.length}장은 남았습니다` : null,
        cost ? "세금 1냥 지불" : "손패를 보충합니다.",
        ...purpleResults,
      ].filter(Boolean).join(" · "),
    ),
  };
  return refillHand(next, kept);
}

export function declareRoundGo(state: GameState): GameState {
  if (state.screen !== "decision") return state;
  if (!canDeclareGo(state.chain, state.handsRemaining)) return state;
  const chain = declareGo(state.chain, state.targetScore, getGoThresholdFactor(state));
  const next: GameState = {
    ...state,
    chain,
    stats: { ...state.stats, goAttempts: state.stats.goAttempts + 1 },
  };
  const requirement = getRoundRequirement(next);
  const logged: GameState = {
    ...next,
    logs: logEntry(
      next,
      "go",
      `${chain.goCount}고 선언`,
      `이번 판에서 ${requirement.toLocaleString("ko-KR")}점을 넘겨야 합니다.`,
    ),
  };
  return isRequirementCleared(logged.chain, requirement)
    ? logged
    : refillHand({ ...logged, screen: "play" }, logged.hand);
}
