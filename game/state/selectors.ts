import { BOSS_BY_ID } from "../content/bosses";
import { CONTRACTS } from "../content/meta";
import { calculateCollectionBonus } from "../engine/collection-bonus";
import { isCupCard, type CupRole, type CupRoleSource } from "../engine/deck";
import { bossVictoryConditionMet } from "../engine/boss";
import { canDeclareGo, getGoRequirement } from "../engine/go";
import { calculateTalismanRoundRuleModifiers } from "../engine/talismans";
import type { CardInstance, GameState } from "../types";

export function countContractEffect(state: GameState, effectKey: string): number {
  const matchingIds = new Set<string>(
    CONTRACTS.filter((entry) => entry.effectKey === effectKey).map((entry) => entry.id),
  );
  return state.contracts.filter((id) => matchingIds.has(id)).length;
}

export function getContractDiscount(state: GameState): number {
  const count = countContractEffect(state, "shop_discount");
  return count <= 0 ? 0 : count === 1 ? 0.15 : 0.3;
}

/** Collection/scoring view of the September cup, including dual-role talismans. */
export function getEffectiveCupRoles(state: GameState): CupRoleSource {
  const dual = calculateTalismanRoundRuleModifiers(state.talismans).cupHasDualRole;
  if (!dual) return state.cupAssignments;
  const roles: Record<string, CupRole> = { ...state.cupAssignments };
  for (const card of state.deck) {
    if (isCupCard(card)) roles[card.instanceId] = "dual";
  }
  return roles;
}

export function getCollectionPerks(state: GameState) {
  const cardsById = new Map(state.deck.map((card) => [card.instanceId, card]));
  const cards = state.chain.collection.cardIds.flatMap((id) => {
    const card = cardsById.get(id);
    return card ? [card] : [];
  });
  return calculateCollectionBonus(cards, getEffectiveCupRoles(state), state.yakuLevels).perks;
}

export function getEffectiveHandSize(state: GameState): number {
  return state.handSize
    + countContractEffect(state, "hand_size")
    + getCollectionPerks(state).handSizeBonus;
}

export function isUndiscardable(card: CardInstance): boolean {
  return card.effectTagId === "stubborn";
}

export function getEffectiveTalismanSlots(state: GameState): number {
  return state.talismanSlots
    + state.talismans.filter((item) => item.edition === "engraved").length;
}

export function getGoThresholdFactor(state: GameState): number {
  const boss = state.bossId ? BOSS_BY_ID[state.bossId] ?? null : null;
  const talismanRules = calculateTalismanRoundRuleModifiers(state.talismans);
  const bossFactor = boss?.ruleKey === "go_fail_tax" ? 1.1 : 1;
  return talismanRules.thresholdFactor * bossFactor * getCollectionPerks(state).goThresholdFactor;
}

export function getRoundRequirement(state: GameState): number {
  return state.chain.goRequirement ?? getGoRequirement(state.targetScore, 0);
}

export function getNextGoRequirement(state: GameState): number | null {
  if (!canDeclareGo(state.chain, state.handsRemaining)) return null;
  return getGoRequirement(
    state.targetScore,
    state.chain.goCount + 1,
    getGoThresholdFactor(state),
    state.chain.roundScore,
  );
}

export function mustDeclareGo(state: GameState): boolean {
  const boss = state.bossId ? BOSS_BY_ID[state.bossId] ?? null : null;
  return !bossVictoryConditionMet(boss, state.chain.goCount);
}
