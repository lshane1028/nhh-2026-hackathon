import { TALISMAN_BY_ID } from "../content/talismans";
import type {
  CardInstance,
  CardKind,
  CollectionYakuId,
  Month,
  ScoreEffectKey,
  TalismanDefinition,
  TalismanInstance,
  YakuCandidate,
} from "../types";
import { getEffectiveCardRole, type CupRole } from "./deck";
import {
  GOLD_LEAF_MONTH_BONUS,
  INKED_MONTH_BONUS,
  STONE_MONTH_VALUE,
  type OrderedScoreEffect,
} from "./scoring";

export type TalismanDefinitionMap = Readonly<Record<string, TalismanDefinition>>;

export interface TalismanScoreContext {
  talismans: readonly TalismanInstance[];
  definitions?: TalismanDefinitionMap;
  candidate: YakuCandidate;
  submittedCards: readonly CardInstance[];
  scoringCards: readonly CardInstance[];
  heldCards?: readonly CardInstance[];
  newCollectionYakuIds?: readonly CollectionYakuId[];
  cupRole?: CupRole;
  money?: number;
  emptyTalismanSlots?: number;
  successfulGoCount?: number;
  scoredMonthsThisRound?: readonly Month[];
}

export interface TalismanStructuralEffect {
  sourceId: string;
  definitionId: string;
  label: string;
  effectKey: ScoreEffectKey;
  amount?: number;
  factor?: number;
  params: Readonly<Record<string, string | number | boolean>>;
}

export interface EvaluatedTalismanEffects {
  orderedScoreEffects: OrderedScoreEffect[];
  structuralEffects: TalismanStructuralEffect[];
  unknownDefinitionIds: string[];
}

export const STRUCTURAL_TALISMAN_EFFECT_KEYS = [
  "connect_year",
  "cup_dual_role",
  "month_counts_as_bright",
  "borrow_yaku_level",
  "unify_month_once",
  "all_kind_wild",
  "score_then_burn",
  "threshold_relief",
  "settlement_multiplier",
  "fail_rescue",
  "economy",
] as const satisfies readonly ScoreEffectKey[];

const structuralEffectKeys = new Set<ScoreEffectKey>(STRUCTURAL_TALISMAN_EFFECT_KEYS);

function finiteOr(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function positiveInteger(value: unknown, fallback = 0): number {
  return Math.max(0, Math.floor(finiteOr(value, fallback)));
}

function makeEffect(
  talisman: TalismanInstance,
  definition: TalismanDefinition,
  operation: OrderedScoreEffect["operation"],
  value: number,
  suffix = "",
): OrderedScoreEffect | null {
  if (!Number.isFinite(value) || value === 0) return null;
  return {
    sourceId: talisman.instanceId,
    label: suffix ? `${definition.name} · ${suffix}` : definition.name,
    operation,
    value,
  };
}

function addEffect(target: OrderedScoreEffect[], effect: OrderedScoreEffect | null): void {
  if (effect) target.push(effect);
}

function cardRetriggerEffects(
  card: CardInstance,
  talisman: TalismanInstance,
  definition: TalismanDefinition,
  cupRole: CupRole,
  suffix: string,
): OrderedScoreEffect[] {
  const effects: OrderedScoreEffect[] = [];
  const role = getEffectiveCardRole(card, cupRole);
  const baseKkeut = card.enhancement === "stone" ? STONE_MONTH_VALUE : role.baseKkeut;
  addEffect(
    effects,
    makeEffect(
      talisman,
      definition,
      "add_kkeut",
      baseKkeut + finiteOr(card.permanentKkeutBonus),
      `${card.name} ${suffix}`,
    ),
  );

  if (card.enhancement === "inked") {
    addEffect(effects, makeEffect(talisman, definition, "add_kkeut", INKED_MONTH_BONUS, `${card.name} 먹칠 ${suffix}`));
  } else if (card.enhancement === "scarlet") {
    addEffect(effects, makeEffect(talisman, definition, "add_heung", 3, `${card.name} 홍칠 ${suffix}`));
  } else if (card.enhancement === "glass") {
    addEffect(effects, makeEffect(talisman, definition, "multiply_heung", 1.75, `${card.name} 유리패 ${suffix}`));
  }

  if (card.edition === "gold_leaf") {
    addEffect(effects, makeEffect(talisman, definition, "add_kkeut", GOLD_LEAF_MONTH_BONUS, `${card.name} 금박 ${suffix}`));
  } else if (card.edition === "mother_of_pearl") {
    addEffect(effects, makeEffect(talisman, definition, "add_heung", 6, `${card.name} 자개 ${suffix}`));
  } else if (card.edition === "five_color") {
    addEffect(effects, makeEffect(talisman, definition, "multiply_heung", 1.35, `${card.name} 오색 ${suffix}`));
  }

  return effects;
}

function editionEffects(
  talisman: TalismanInstance,
  definition: TalismanDefinition,
): OrderedScoreEffect[] {
  if (talisman.edition === "gold_leaf") {
    return [makeEffect(talisman, definition, "add_kkeut", GOLD_LEAF_MONTH_BONUS, "금박")].filter(
      (effect): effect is OrderedScoreEffect => effect !== null,
    );
  }
  if (talisman.edition === "mother_of_pearl") {
    return [makeEffect(talisman, definition, "add_heung", 6, "자개")].filter(
      (effect): effect is OrderedScoreEffect => effect !== null,
    );
  }
  if (talisman.edition === "five_color") {
    return [makeEffect(talisman, definition, "multiply_heung", 1.35, "오색")].filter(
      (effect): effect is OrderedScoreEffect => effect !== null,
    );
  }
  return [];
}

function csvValues(value: unknown): string[] {
  if (typeof value !== "string") return [];
  return value.split(",").map((entry) => entry.trim()).filter(Boolean);
}

function effectsForDefinition(
  talisman: TalismanInstance,
  definition: TalismanDefinition,
  context: TalismanScoreContext,
): OrderedScoreEffect[] {
  const effects: OrderedScoreEffect[] = [];
  const amount = finiteOr(definition.amount);
  const params = definition.params ?? {};
  const cupRole = context.cupRole ?? "animal";
  const roles = context.scoringCards.map((card) => ({ card, role: getEffectiveCardRole(card, cupRole) }));
  const key = definition.effectKey;

  switch (key) {
    case "season_cards_add_kkeut": {
      const from = finiteOr(params.monthFrom, 1);
      const to = finiteOr(params.monthTo, 12);
      const count = context.scoringCards.filter((card) => card.month >= from && card.month <= to).length;
      addEffect(effects, makeEffect(talisman, definition, "add_kkeut", count * amount));
      break;
    }
    case "kind_cards_add_kkeut": {
      const kind = params.kind as CardKind | undefined;
      const count = roles.filter((entry) => entry.role.kind === kind).length;
      addEffect(effects, makeEffect(talisman, definition, "add_kkeut", count * amount));
      break;
    }
    case "chaff_value_add_kkeut": {
      const totalChaffValue = roles.reduce(
        (sum, entry) => sum + (entry.role.kind === "chaff" ? entry.role.chaffValue : 0),
        0,
      );
      addEffect(effects, makeEffect(talisman, definition, "add_kkeut", totalChaffValue * amount));
      break;
    }
    case "exact_submit_add": {
      if (context.submittedCards.length === positiveInteger(params.cardCount)) {
        addEffect(effects, makeEffect(talisman, definition, "add_kkeut", amount));
        addEffect(effects, makeEffect(talisman, definition, "add_heung", finiteOr(params.addHeung), "배수"));
      }
      break;
    }
    case "exact_scoring_add": {
      if (context.scoringCards.length === positiveInteger(params.scoringCardCount)) {
        addEffect(effects, makeEffect(talisman, definition, "add_kkeut", amount));
        addEffect(effects, makeEffect(talisman, definition, "add_heung", finiteOr(params.addHeung), "배수"));
      }
      break;
    }
    case "yaku_add_heung": {
      const yakuIds = csvValues(params.yakuIds);
      if (params.trigger === "shake_declared") {
        addEffect(effects, makeEffect(talisman, definition, "add_heung", Math.max(0, finiteOr(talisman.growth))));
      } else if (yakuIds.length === 0 || yakuIds.includes(context.candidate.yakuId)) {
        // No yakuIds listed means the bonus is unconditional.
        addEffect(effects, makeEffect(talisman, definition, "add_heung", amount));
      }
      break;
    }
    case "collection_add_heung": {
      const yakuId = params.yakuId;
      if (typeof yakuId === "string" && context.newCollectionYakuIds?.includes(yakuId as CollectionYakuId)) {
        addEffect(effects, makeEffect(talisman, definition, "add_heung", amount));
      }
      break;
    }
    case "bird_retrigger": {
      const repeats = Math.max(1, positiveInteger(definition.amount, 1));
      const tag = typeof params.tag === "string" ? params.tag : "bird";
      for (const card of context.scoringCards.filter((entry) => entry.tags.includes(tag))) {
        for (let repeat = 0; repeat < repeats; repeat += 1) {
          effects.push(...cardRetriggerEffects(card, talisman, definition, cupRole, `재발동 ${repeat + 1}`));
        }
      }
      break;
    }
    case "double_chaff_boost": {
      const chaffValueBonus = finiteOr(params.chaffValueBonus);
      const chaffCount = roles.filter((entry) => entry.role.kind === "chaff").length;
      const doubleChaffCount = roles.filter(
        (entry) => entry.role.kind === "chaff" && entry.role.chaffValue >= 2,
      ).length;
      addEffect(
        effects,
        makeEffect(talisman, definition, "add_kkeut", chaffCount * chaffValueBonus, "피값"),
      );
      addEffect(
        effects,
        makeEffect(talisman, definition, "add_kkeut", doubleChaffCount * amount, "쌍피"),
      );
      break;
    }
    case "empty_slots_add_heung":
      addEffect(
        effects,
        makeEffect(talisman, definition, "add_heung", positiveInteger(context.emptyTalismanSlots) * amount),
      );
      break;
    case "money_add_heung": {
      const step = Math.max(1, positiveInteger(params.moneyStep, 1));
      const cap = Math.max(0, finiteOr(params.maxHeung, Number.POSITIVE_INFINITY));
      const value = Math.min(cap, Math.floor(Math.max(0, finiteOr(context.money)) / step) * amount);
      addEffect(effects, makeEffect(talisman, definition, "add_heung", value));
      break;
    }
    case "all_cards_score_bonus": {
      const submittedIds = new Set(context.submittedCards.map((card) => card.instanceId));
      const allSubmittedScore = context.submittedCards.length > 0
        && context.scoringCards.length === submittedIds.size
        && context.scoringCards.every((card) => submittedIds.has(card.instanceId));
      if (allSubmittedScore) {
        addEffect(effects, makeEffect(talisman, definition, "add_kkeut", amount));
        addEffect(effects, makeEffect(talisman, definition, "add_heung", finiteOr(params.addHeung), "배수"));
      }
      break;
    }
    case "first_card_retrigger": {
      const first = context.scoringCards[0];
      const requiresEnhancement = params.requiresEnhancement === true;
      if (first && (!requiresEnhancement || first.enhancement !== undefined)) {
        const repeats = Math.max(1, positiveInteger(definition.amount, 1));
        for (let repeat = 0; repeat < repeats; repeat += 1) {
          effects.push(...cardRetriggerEffects(first, talisman, definition, cupRole, `첫 패 재발동 ${repeat + 1}`));
        }
      }
      break;
    }
    case "burn_chaff_growth": {
      const factor = 1 + Math.max(0, finiteOr(talisman.growth));
      if (factor !== 1) addEffect(effects, makeEffect(talisman, definition, "multiply_heung", factor));
      break;
    }
    case "month_diversity_multiplier": {
      const months = new Set<Month>(context.scoredMonthsThisRound ?? []);
      for (const card of context.scoringCards) months.add(card.month);
      const factor = 1 + months.size * Math.max(0, finiteOr(definition.factor));
      if (factor !== 1) addEffect(effects, makeEffect(talisman, definition, "multiply_heung", factor));
      break;
    }
    case "go_chain_multiplier": {
      if (positiveInteger(context.successfulGoCount) > 0) {
        addEffect(effects, makeEffect(talisman, definition, "multiply_heung", finiteOr(definition.factor, 1)));
      }
      break;
    }
    case "cup_dual_role": {
      for (const card of context.scoringCards.filter((entry) => entry.tags.includes("cup"))) {
        effects.push(...cardRetriggerEffects(card, talisman, definition, "double_chaff", "쌍피 역할 재발동"));
      }
      break;
    }
    case "copy_left_score":
    case "copy_neighbors":
    case "connect_year":
    case "month_counts_as_bright":
    case "borrow_yaku_level":
    case "unify_month_once":
    case "all_kind_wild":
    case "score_then_burn":
    case "threshold_relief":
    case "settlement_multiplier":
    case "fail_rescue":
    case "economy":
      break;
    default: {
      const exhaustive: never = key;
      return exhaustive;
    }
  }

  return effects;
}

function cloneEffects(
  effects: readonly OrderedScoreEffect[],
  talisman: TalismanInstance,
  definition: TalismanDefinition,
): OrderedScoreEffect[] {
  return effects.map((effect) => ({
    ...effect,
    sourceId: talisman.instanceId,
    label: `${definition.name} → ${effect.label}`,
  }));
}

/**
 * Evaluates every owned talisman in slot order. Pass the returned score effects to
 * scoring.ts as orderedTalismanEffects; do not also pass the same instances via its
 * legacy talismans option, because the five P0 effects would otherwise be counted twice.
 */
export function evaluateTalismanEffects(context: TalismanScoreContext): EvaluatedTalismanEffects {
  const definitions = context.definitions ?? (TALISMAN_BY_ID as TalismanDefinitionMap);
  const orderedScoreEffects: OrderedScoreEffect[] = [];
  const structuralEffects: TalismanStructuralEffect[] = [];
  const unknownDefinitionIds: string[] = [];
  const groups: Array<{
    definition: TalismanDefinition;
    effects: OrderedScoreEffect[];
    copyable: boolean;
  }> = [];

  for (const talisman of context.talismans) {
    const definition = definitions[talisman.definitionId];
    if (!definition) {
      unknownDefinitionIds.push(talisman.definitionId);
      continue;
    }

    if (structuralEffectKeys.has(definition.effectKey)) {
      structuralEffects.push({
        sourceId: talisman.instanceId,
        definitionId: definition.id,
        label: definition.name,
        effectKey: definition.effectKey,
        amount: definition.amount,
        factor: definition.factor,
        params: definition.params ?? {},
      });
    }

    let effects: OrderedScoreEffect[];
    if (definition.effectKey === "copy_left_score") {
      const left = groups.at(-1);
      effects = left?.copyable ? cloneEffects(left.effects, talisman, definition) : [];
    } else if (definition.effectKey === "copy_neighbors") {
      const target = [...groups].reverse().find((group) => group.copyable && group.effects.length > 0);
      effects = target ? cloneEffects(target.effects, talisman, definition) : [];
    } else {
      effects = effectsForDefinition(talisman, definition, context);
    }

    effects.push(...editionEffects(talisman, definition));
    const copyable = ![
      "copy_left_score",
      "copy_neighbors",
      "economy",
      "fail_rescue",
      "threshold_relief",
      "settlement_multiplier",
    ].includes(definition.effectKey);
    groups.push({ definition, effects, copyable });
    orderedScoreEffects.push(...effects);
  }

  return { orderedScoreEffects, structuralEffects, unknownDefinitionIds };
}

export function buildOrderedTalismanScoreEffects(context: TalismanScoreContext): OrderedScoreEffect[] {
  return evaluateTalismanEffects(context).orderedScoreEffects;
}

export function collectTalismanStructuralEffects(
  talismans: readonly TalismanInstance[],
  definitions: TalismanDefinitionMap = TALISMAN_BY_ID as TalismanDefinitionMap,
): TalismanStructuralEffect[] {
  return talismans.flatMap((talisman) => {
    const definition = definitions[talisman.definitionId];
    if (!definition || !structuralEffectKeys.has(definition.effectKey)) return [];
    return [{
      sourceId: talisman.instanceId,
      definitionId: definition.id,
      label: definition.name,
      effectKey: definition.effectKey,
      amount: definition.amount,
      factor: definition.factor,
      params: definition.params ?? {},
    }];
  });
}

export interface TalismanRoundRewardInput {
  talismans: readonly TalismanInstance[];
  definitions?: TalismanDefinitionMap;
  won: boolean;
  remainingHands: number;
}

export interface TalismanMoneyAdjustment {
  moneyDelta: number;
  entries: Array<{ sourceId: string; label: string; amount: number }>;
}

export function calculateTalismanRoundRewardAdjustment(
  input: TalismanRoundRewardInput,
): TalismanMoneyAdjustment {
  const definitions = input.definitions ?? (TALISMAN_BY_ID as TalismanDefinitionMap);
  const entries: TalismanMoneyAdjustment["entries"] = [];
  if (!input.won) return { moneyDelta: 0, entries };

  for (const talisman of input.talismans) {
    const definition = definitions[talisman.definitionId];
    if (!definition || definition.effectKey !== "economy" || definition.params?.trigger !== "round_win") continue;
    const units = definition.params.perRemainingHand === true ? positiveInteger(input.remainingHands) : 1;
    const amount = units * finiteOr(definition.amount);
    if (amount !== 0) entries.push({ sourceId: talisman.instanceId, label: definition.name, amount });
  }
  return { moneyDelta: entries.reduce((sum, entry) => sum + entry.amount, 0), entries };
}

export interface TalismanGoFailureInput {
  talismans: readonly TalismanInstance[];
  definitions?: TalismanDefinitionMap;
  failed: boolean;
  rescueRoll?: number;
}

export interface TalismanGoFailureAdjustment extends TalismanMoneyAdjustment {
  rescued: boolean;
}

export function calculateTalismanGoFailureAdjustment(
  input: TalismanGoFailureInput,
): TalismanGoFailureAdjustment {
  const definitions = input.definitions ?? (TALISMAN_BY_ID as TalismanDefinitionMap);
  const entries: TalismanMoneyAdjustment["entries"] = [];
  if (!input.failed) return { moneyDelta: 0, rescued: false, entries };
  let rescued = false;

  for (const talisman of input.talismans) {
    const definition = definitions[talisman.definitionId];
    if (!definition) continue;
    if (definition.effectKey === "go_chain_multiplier") {
      const amount = -Math.max(0, finiteOr(definition.params?.failMoneyLoss));
      if (amount !== 0) entries.push({ sourceId: talisman.instanceId, label: definition.name, amount });
    } else if (definition.effectKey === "fail_rescue") {
      const chance = Math.min(1, Math.max(0, finiteOr(definition.params?.chance, finiteOr(definition.factor))));
      rescued ||= chance >= 1 || (input.rescueRoll !== undefined && input.rescueRoll >= 0 && input.rescueRoll < chance);
    }
  }

  return {
    moneyDelta: entries.reduce((sum, entry) => sum + entry.amount, 0),
    rescued,
    entries,
  };
}

export interface TalismanRoundRuleModifiers {
  thresholdFactor: number;
  settlementFactor: number;
  connectsDecemberToJanuary: boolean;
  cupHasDualRole: boolean;
  monthsCountingAsBright: Month[];
  allKindsWild: boolean;
  borrowedYakuLevelOffset: number | null;
  unifyMonthUses: number;
  scoreThenBurnCopies: number;
}

export function calculateTalismanRoundRuleModifiers(
  talismans: readonly TalismanInstance[],
  definitions: TalismanDefinitionMap = TALISMAN_BY_ID as TalismanDefinitionMap,
): TalismanRoundRuleModifiers {
  const result: TalismanRoundRuleModifiers = {
    thresholdFactor: 1,
    settlementFactor: 1,
    connectsDecemberToJanuary: false,
    cupHasDualRole: false,
    monthsCountingAsBright: [],
    allKindsWild: false,
    borrowedYakuLevelOffset: null,
    unifyMonthUses: 0,
    scoreThenBurnCopies: 0,
  };

  for (const talisman of talismans) {
    const definition = definitions[talisman.definitionId];
    if (!definition) continue;
    const params = definition.params ?? {};
    if (definition.effectKey === "connect_year") result.connectsDecemberToJanuary = true;
    else if (definition.effectKey === "cup_dual_role") result.cupHasDualRole = true;
    else if (definition.effectKey === "month_counts_as_bright") {
      const month = positiveInteger(params.month);
      if (month >= 1 && month <= 12 && !result.monthsCountingAsBright.includes(month as Month)) {
        result.monthsCountingAsBright.push(month as Month);
      }
    } else if (definition.effectKey === "all_kind_wild") result.allKindsWild = true;
    else if (definition.effectKey === "borrow_yaku_level") {
      result.borrowedYakuLevelOffset = positiveInteger(params.highestLevelOffset, 2);
    } else if (definition.effectKey === "unify_month_once") {
      result.unifyMonthUses += Math.max(1, positiveInteger(params.usesPerRound, finiteOr(definition.amount, 1)));
    } else if (definition.effectKey === "score_then_burn") {
      result.scoreThenBurnCopies += Math.max(1, positiveInteger(params.copies, finiteOr(definition.amount, 1)));
    } else if (definition.effectKey === "threshold_relief") {
      result.thresholdFactor *= Math.max(0, finiteOr(definition.factor, 1));
    } else if (definition.effectKey === "settlement_multiplier") {
      result.settlementFactor *= Math.max(0, finiteOr(definition.factor, 1));
    }
  }

  result.monthsCountingAsBright.sort((left, right) => left - right);
  return result;
}
