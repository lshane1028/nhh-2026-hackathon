import { TALISMANS } from "../content/talismans";
import { FORBIDDEN_BY_ID, PAINTER_BY_ID } from "../content/upgrades";
import {
  applyForbiddenEffect,
  applyPainterEffect,
  canPayForbiddenCost,
  isForbiddenTargetSelectionValid,
} from "../engine/consumables";
import { randomAt } from "../engine/rng";
import type { GameState } from "../types";
import { prependGameLog } from "./logs";

export function applyPendingConsumable(state: GameState, option?: string): GameState {
  const id = state.pendingConsumableId;
  if (!id) return state;
  let cursor = state.rngCursor;
  const makeId = (prefix: string) => `${prefix}:${state.runId}:${cursor++}`;
  const painter = PAINTER_BY_ID[id];
  if (painter) {
    if (state.pendingTargetIds.length < painter.minTargets) return state;
    const previous = state.lastConsumableId ? PAINTER_BY_ID[state.lastConsumableId] : undefined;
    let resolvedOption = option;
    if (painter.effectKey === "apply_enhancement") {
      const options = ["inked", "scarlet", "wild", "glass", "steel", "stone", "coin", "fortune"];
      resolvedOption = options[Math.floor(randomAt(`${state.seed}:painter-enhancement`, cursor++) * options.length)];
    } else if (painter.effectKey === "apply_edition") {
      const options = ["gold_leaf", "mother_of_pearl", "five_color"];
      resolvedOption = options[Math.floor(randomAt(`${state.seed}:painter-edition`, cursor++) * options.length)];
    }
    const result = applyPainterEffect(state.deck, painter, state.pendingTargetIds, resolvedOption, makeId, previous);
    return {
      ...state,
      rngCursor: cursor,
      deck: result.deck,
      screen: state.returnScreen ?? "shop",
      returnScreen: null,
      pendingConsumableId: null,
      pendingTargetIds: [],
      pendingShopOfferId: null,
      lastConsumableId: id,
      logs: prependGameLog(state, "reward", painter.name, result.message),
    };
  }

  const forbidden = FORBIDDEN_BY_ID[id];
  if (!forbidden) return state;
  const selectedTargets = forbidden.targetKind === "none" ? [] : state.pendingTargetIds;
  if (
    !canPayForbiddenCost(state, forbidden)
    || !isForbiddenTargetSelectionValid(state, forbidden, selectedTargets)
  ) return state;

  let targets = selectedTargets;
  if (forbidden.effectKey === "random_burn_for_money" && targets.length === 0) {
    targets = [...state.deck]
      .filter((card) => !card.enhancement && !card.edition && !card.seal)
      .sort((left, right) => randomAt(`${state.seed}:burn:${left.instanceId}`, cursor) - randomAt(`${state.seed}:burn:${right.instanceId}`, cursor))
      .slice(0, 5)
      .map((card) => card.instanceId);
    cursor += state.deck.length;
  }
  const result = applyForbiddenEffect(state, forbidden, targets, makeId);
  if (!result.applied) return state;
  let talismans = result.talismans;
  if (result.grantLegendaryTalisman) {
    const legendary = TALISMANS.filter((entry) => entry.rarity === "legendary");
    const picked = legendary[Math.floor(randomAt(`${state.seed}:legendary`, cursor++) * legendary.length)];
    if (picked) talismans = [{ instanceId: makeId("legendary"), definitionId: picked.id, growth: 0 }, ...talismans];
  }
  return {
    ...state,
    rngCursor: cursor,
    deck: result.deck,
    handSize: result.handSize,
    money: result.money,
    talismans,
    talismanSlots: result.talismanSlots,
    yakuLevels: result.yakuLevels,
    screen: state.returnScreen ?? "shop",
    returnScreen: null,
    pendingConsumableId: null,
    pendingTargetIds: [],
    pendingShopOfferId: null,
    lastConsumableId: id,
    stats: {
      ...state.stats,
      forbiddenCardsUsed: {
        ...(state.stats.forbiddenCardsUsed ?? {}),
        [forbidden.id]: ((state.stats.forbiddenCardsUsed ?? {})[forbidden.id] ?? 0) + 1,
      },
    },
    logs: prependGameLog(state, "reward", forbidden.name, result.message),
  };
}
