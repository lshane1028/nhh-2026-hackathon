import type {
  CardInstance,
  CardKind,
  EditionId,
  EnhancementId,
  ForbiddenDefinition,
  PainterDefinition,
  RibbonGroup,
  SealId,
  TalismanInstance,
  YakuLevelState,
} from "../types";
import { removeRedundantKindEffect } from "../content/card-effects";

export interface DeckEditResult {
  deck: CardInstance[];
  message: string;
  changedCardIds: string[];
}

export function applyPainterEffect(
  deck: CardInstance[],
  definition: PainterDefinition,
  targetIds: string[],
  option: string | undefined,
  makeId: (prefix: string) => string,
  previousPainter?: PainterDefinition,
): DeckEditResult {
  const limitedTargets = targetIds.slice(0, definition.maxTargets);
  const selected = new Set(limitedTargets);
  let next = deck.map((card) => ({ ...card, tags: [...card.tags] }));
  const update = (id: string, fn: (card: CardInstance) => CardInstance) => {
    next = next.map((card) => (card.instanceId === id ? fn(card) : card));
  };

  switch (definition.effectKey) {
    case "month_plus":
      limitedTargets.forEach((id) => update(id, (card) => ({ ...card, month: card.month === 12 ? 1 : ((card.month + 1) as CardInstance["month"]) })));
      break;
    case "month_minus":
      limitedTargets.forEach((id) => update(id, (card) => ({ ...card, month: card.month === 1 ? 12 : ((card.month - 1) as CardInstance["month"]) })));
      break;
    case "copy_month": {
      const [target, source] = limitedTargets;
      const sourceCard = next.find((card) => card.instanceId === source);
      if (target && sourceCard) update(target, (card) => ({ ...card, month: sourceCard.month }));
      break;
    }
    case "unify_two_months": {
      const source = next.find((card) => card.instanceId === limitedTargets[0]);
      if (source) limitedTargets.forEach((id) => update(id, (card) => ({ ...card, month: source.month })));
      break;
    }
    case "duplicate": {
      const source = next.find((card) => card.instanceId === limitedTargets[0]);
      if (source) next.push({ ...source, tags: [...source.tags], instanceId: makeId("copy") });
      break;
    }
    case "burn":
      next = next.filter((card) => !selected.has(card.instanceId));
      break;
    case "promote_kind":
      limitedTargets.forEach((id) => update(id, (card) => promoteCard(card, option)));
      break;
    case "double_chaff":
      limitedTargets.forEach((id) => update(id, (card) => card.kind === "chaff" ? { ...card, chaffValue: 2 } : card));
      break;
    case "ribbon_dye":
      limitedTargets.forEach((id) => update(id, (card) => ({
        ...card,
        kind: "ribbon",
        chaffValue: 0,
        ribbonGroup: normalizeRibbonGroup(option),
      })));
      break;
    case "bird_mark":
      limitedTargets.forEach((id) => update(id, (card) => ({
        ...card,
        month: normalizeBirdMonth(option),
        kind: "animal",
        chaffValue: 0,
        ribbonGroup: undefined,
        tags: unique([...card.tags, "bird"]),
      })));
      break;
    case "rain_mark":
      limitedTargets.forEach((id) => update(id, (card) => ({ ...card, tags: unique([...card.tags, "rain"]) })));
      break;
    case "apply_enhancement":
      limitedTargets.forEach((id) => update(id, (card) => ({ ...card, enhancement: normalizeEnhancement(option) })));
      break;
    case "apply_edition":
      limitedTargets.forEach((id) => update(id, (card) => ({ ...card, edition: normalizeEdition(option) })));
      break;
    case "apply_seal":
      limitedTargets.forEach((id) => update(id, (card) => ({ ...card, seal: normalizeSeal(option) })));
      break;
    case "repeat_last_consumable":
      if (previousPainter && previousPainter.effectKey !== "repeat_last_consumable") {
        return applyPainterEffect(deck, previousPainter, targetIds, option, makeId);
      }
      return { deck, message: "되새길 이전 화공패가 없습니다.", changedCardIds: [] };
  }

  return {
    deck: next.map(removeRedundantKindEffect),
    message: `${definition.name} 적용 · ${limitedTargets.length}장`,
    changedCardIds: limitedTargets,
  };
}

function promoteCard(card: CardInstance, option?: string): CardInstance {
  const nextKind: CardKind = card.kind === "chaff" ? "ribbon" : card.kind === "ribbon" ? "animal" : card.kind;
  if (nextKind === "ribbon") {
    return { ...card, kind: nextKind, chaffValue: 0, ribbonGroup: normalizeRibbonGroup(option) };
  }
  return { ...card, kind: nextKind, chaffValue: 0, ribbonGroup: undefined };
}

export interface ForbiddenRunSlice {
  deck: CardInstance[];
  handSize: number;
  money: number;
  talismans: TalismanInstance[];
  yakuLevels: Record<string, YakuLevelState>;
}

export interface ForbiddenResult extends ForbiddenRunSlice {
  message: string;
  grantLegendaryTalisman: boolean;
}

export function applyForbiddenEffect(
  state: ForbiddenRunSlice,
  definition: ForbiddenDefinition,
  targetIds: string[],
  makeId: (prefix: string) => string,
): ForbiddenResult {
  let deck = state.deck.map((card) => ({ ...card, tags: [...card.tags] }));
  let handSize = state.handSize;
  let money = state.money;
  let talismans = state.talismans.map((item) => ({ ...item }));
  let yakuLevels = { ...state.yakuLevels };
  let grantLegendaryTalisman = false;
  const selected = targetIds.slice(0, 5);

  switch (definition.effectKey) {
    case "all_to_january": {
      deck = deck.map((card) => selected.includes(card.instanceId) ? { ...card, month: 1 } : card);
      const burned = selected[selected.length - 1];
      if (burned) deck = deck.filter((card) => card.instanceId !== burned);
      break;
    }
    case "double_duplicate_hand_penalty": {
      const source = deck.find((card) => card.instanceId === selected[0]);
      if (source) {
        deck.push(
          { ...source, tags: [...source.tags], instanceId: makeId("forbidden-copy") },
          { ...source, tags: [...source.tags], instanceId: makeId("forbidden-copy") },
        );
      }
      handSize = Math.max(5, handSize - 1);
      break;
    }
    case "make_bright_pay":
      if (money >= 6) {
        money -= 6;
        deck = deck.map((card) => selected[0] === card.instanceId
          ? { ...card, kind: "bright", chaffValue: 0, ribbonGroup: undefined }
          : card);
      }
      break;
    case "all_hand_chaff_bonus":
      deck = deck.map((card) => selected.includes(card.instanceId)
        ? { ...card, kind: "chaff", chaffValue: 1, ribbonGroup: undefined, permanentKkeutBonus: card.permanentKkeutBonus + 4 }
        : card);
      break;
    case "wild_month_zero_base":
      deck = deck.map((card) => selected[0] === card.instanceId
        ? { ...card, enhancement: "wild", tags: unique([...card.tags, "zero_base"]) }
        : card);
      break;
    case "random_burn_for_money":
      deck = deck.filter((card) => !selected.slice(0, 5).includes(card.instanceId));
      money += 18;
      break;
    case "engrave_talisman_hand_penalty":
      talismans = talismans.map((item, index) => index === 0 ? { ...item, edition: "engraved" } : item);
      handSize = Math.max(5, handSize - 1);
      break;
    case "level_all_money_zero":
      yakuLevels = Object.fromEntries(Object.entries(yakuLevels).map(([id, value]) => [id, { ...value, level: value.level + 1 }]));
      money = 0;
      break;
    case "sacrifice_copy":
      if (talismans.length >= 2) {
        const copied = talismans[1];
        talismans = [{ ...copied, instanceId: makeId("talisman-copy") }, ...talismans.slice(1)];
      }
      break;
    case "legendary_destroy_others":
      talismans = [];
      grantLegendaryTalisman = true;
      break;
  }

  return {
    deck: deck.map(removeRedundantKindEffect),
    handSize,
    money,
    talismans,
    yakuLevels,
    grantLegendaryTalisman,
    message: `${definition.name}: ${definition.benefit} / 대가: ${definition.cost}`,
  };
}

export interface StartDeckResult {
  deck: CardInstance[];
  hands: number;
  discards: number;
  handSize: number;
  talismanSlots: number;
  money: number;
  targetMultiplier: number;
  settlementBonus: number;
  failMoneyPenalty: number;
}

export function applyStartDeck(
  deck: CardInstance[],
  startDeckId: string,
  random: () => number,
  makeId: (prefix: string) => string,
): StartDeckResult {
  const next = deck.map((card) => ({ ...card, tags: [...card.tags] }));
  const result: StartDeckResult = {
    deck: next,
    hands: 4,
    // Keep in step with createInitialGameState. This is the value a real run
    // actually uses — the reducer's own default only covers the title screen.
    discards: 3,
    handSize: 8,
    talismanSlots: 5,
    money: 4,
    targetMultiplier: 1,
    settlementBonus: 0,
    failMoneyPenalty: 0,
  };
  switch (startDeckId) {
    case "deck_red":
      result.discards += 1;
      break;
    case "deck_blue":
      result.hands += 1;
      break;
    case "deck_black":
      result.talismanSlots += 1;
      result.hands -= 1;
      break;
    case "deck_money":
      result.money += 12;
      break;
    case "deck_plain":
      result.deck = next.filter((card) => card.kind !== "bright");
      result.handSize += 2;
      break;
    case "deck_pairs": {
      const byMonth = new Map<number, CardInstance[]>();
      next.forEach((card) => byMonth.set(card.month, [...(byMonth.get(card.month) ?? []), card]));
      result.deck = [...byMonth.values()].flatMap((cards) => [...cards].sort(() => random() - 0.5).slice(0, 2));
      result.targetMultiplier = 1.25;
      break;
    }
    case "deck_seasons": {
      const seasonal = next.filter((card) => [1, 2, 3, 7, 8, 9].includes(card.month));
      result.deck = seasonal.flatMap((card) => [card, { ...card, tags: [...card.tags], instanceId: makeId("season-copy") }]);
      break;
    }
    case "deck_painter":
      result.deck = next.map((card) => ({ ...card, month: (Math.floor(random() * 12) + 1) as CardInstance["month"] }));
      break;
    case "deck_master":
      result.settlementBonus = 0.1;
      result.failMoneyPenalty = 2;
      break;
  }
  return result;
}

function normalizeRibbonGroup(option?: string): RibbonGroup {
  return option === "cho" || option === "cheong" ? option : "hong";
}

function normalizeBirdMonth(option?: string): 2 | 4 | 8 {
  return option === "4" ? 4 : option === "8" ? 8 : 2;
}

function normalizeEnhancement(option?: string): EnhancementId {
  const values: EnhancementId[] = ["inked", "scarlet", "wild", "glass", "steel", "stone", "coin", "fortune"];
  return values.includes(option as EnhancementId) ? (option as EnhancementId) : "inked";
}

function normalizeEdition(option?: string): EditionId {
  const values: EditionId[] = ["gold_leaf", "mother_of_pearl", "five_color", "engraved"];
  return values.includes(option as EditionId) ? (option as EditionId) : "gold_leaf";
}

function normalizeSeal(option?: string): SealId {
  const values: SealId[] = ["yellow", "red", "blue", "purple"];
  return values.includes(option as SealId) ? (option as SealId) : "yellow";
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}
