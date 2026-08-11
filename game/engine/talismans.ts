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
import {
  getCollectionKindValue,
  getEffectiveCardRole,
  getEffectiveChaffValue,
  getEffectiveKindMultiplicity,
  type CupRole,
} from "./deck";
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
  /** Buying-decision fuel for the jokers that read the rest of your run. */
  discardsRemaining?: number;
  yakusPlayed?: Readonly<Record<string, number>>;
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
  "five_multiple_jit",
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
  "devour_neighbor",
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
  scoringCardCount: number,
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

  // Card treatments are part of the card's score text too. Omitting these made
  // 재발동 charms work on editions but silently ignore 짝패/무거운 달/고집패.
  if (card.effectTagId === "partner_boost" && scoringCardCount > 1) {
    addEffect(effects, makeEffect(talisman, definition, "add_heung", 2, `${card.name} 짝패 ${suffix}`));
  } else if (card.effectTagId === "heavy_month") {
    addEffect(effects, makeEffect(talisman, definition, "add_kkeut", 50, `${card.name} 무거운 달 ${suffix}`));
  } else if (card.effectTagId === "stubborn") {
    addEffect(effects, makeEffect(talisman, definition, "add_heung", 3, `${card.name} 고집패 ${suffix}`));
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
      const count = context.scoringCards.reduce(
        (sum, card) => sum + (kind ? getCollectionKindValue(card, kind, cupRole) : 0),
        0,
      );
      addEffect(effects, makeEffect(talisman, definition, "add_kkeut", count * amount));
      break;
    }
    case "chaff_value_add_kkeut": {
      const totalChaffValue = context.scoringCards.reduce(
        (sum, card) => sum + getCollectionKindValue(card, "chaff", cupRole),
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
      if (yakuIds.length === 0 || yakuIds.includes(context.candidate.yakuId)) {
        // No yakuIds listed means the bonus is unconditional.
        addEffect(effects, makeEffect(talisman, definition, "add_heung", amount));
      }
      break;
    }
    case "jit_add_heung": {
      // Pays off the 짓 half of the split, so it rewards long submissions —
      // the only lever in the game that scales with how many cards you commit.
      const jitCards = context.candidate.jitCardIds.length;
      const value = params.perJitCard ? amount * jitCards : jitCards > 0 ? amount : 0;
      if (value !== 0) addEffect(effects, makeEffect(talisman, definition, "add_heung", value));
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
          effects.push(...cardRetriggerEffects(card, talisman, definition, cupRole, context.scoringCards.length, `재발동 ${repeat + 1}`));
        }
      }
      break;
    }
    case "double_chaff_boost": {
      const chaffValueBonus = finiteOr(params.chaffValueBonus);
      const chaffCount = context.scoringCards.reduce(
        (sum, card) => sum + getEffectiveKindMultiplicity(card, "chaff", cupRole),
        0,
      );
      const doubleChaffCount = context.scoringCards.reduce(
        (sum, card) => sum + Number(getEffectiveChaffValue(card, cupRole) >= 2)
          * getEffectiveKindMultiplicity(card, "chaff", cupRole),
        0,
      );
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
    case "all_distinct_months_add": {
      const months = new Set(context.submittedCards.map((card) => card.month));
      const enough = context.submittedCards.length >= Math.max(1, positiveInteger(params.minCards, 1));
      if (enough && months.size === context.submittedCards.length) {
        addEffect(effects, makeEffect(talisman, definition, "add_kkeut", amount));
        addEffect(effects, makeEffect(talisman, definition, "add_heung", finiteOr(params.addHeung), "배수"));
      }
      break;
    }
    case "jit_size_add": {
      // maxJitCards 0 means "a bare 끗패", which is the two-card escape hatch.
      const jitCards = context.candidate.jitCardIds.length;
      const max = positiveInteger(params.maxJitCards, 0);
      const min = positiveInteger(params.minJitCards, 0);
      if (jitCards >= min && jitCards <= max) {
        addEffect(effects, makeEffect(talisman, definition, "add_kkeut", amount));
        addEffect(effects, makeEffect(talisman, definition, "add_heung", finiteOr(params.addHeung), "배수"));
      }
      break;
    }

    /* ---- Jokers that only pay off next to other cards ---- */

    case "held_cards_add_heung": {
      // Everything you did NOT submit. Pulls the opposite way from 다섯 손가락.
      const held = context.heldCards?.length ?? 0;
      addEffect(effects, makeEffect(talisman, definition, "add_heung", held * amount, `손패 ${held}장`));
      break;
    }
    case "held_kind_multiply_heung": {
      const kind = typeof params.kind === "string" ? params.kind as CardKind : "bright";
      const matching = (context.heldCards ?? []).reduce(
        (sum, card) => sum + getCollectionKindValue(card, kind, cupRole),
        0,
      );
      const perCard = finiteOr(definition.factor, 1);
      const factor = perCard ** matching;
      if (matching > 0 && factor !== 1) {
        addEffect(effects, makeEffect(talisman, definition, "multiply_heung", factor, `손에 ${matching}장`));
      }
      break;
    }
    case "discards_left_add_kkeut": {
      const left = positiveInteger(context.discardsRemaining);
      addEffect(effects, makeEffect(talisman, definition, "add_kkeut", left * amount, `버리기 ${left}회`));
      break;
    }
    case "talisman_value_add_heung": {
      // Reads the price tag of every OTHER talisman you own, so it grows as the
      // rest of the board gets expensive.
      const catalog = context.definitions ?? TALISMAN_BY_ID;
      const others = context.talismans.filter((item) => item.instanceId !== talisman.instanceId);
      const total = others.reduce((sum, item) => sum + finiteOr(catalog[item.definitionId]?.price), 0);
      const step = Math.max(1, positiveInteger(params.priceStep, 1));
      const value = Math.floor(total / step) * amount;
      addEffect(effects, makeEffect(talisman, definition, "add_heung", value, `${total}냥어치`));
      break;
    }
    case "full_slots_multiply_heung": {
      // The exact opposite of 빈 사당 / 빈 부적집. Owning both is a mistake.
      if (positiveInteger(context.emptyTalismanSlots) === 0) {
        addEffect(effects, makeEffect(talisman, definition, "multiply_heung", finiteOr(definition.factor, 1)));
      }
      break;
    }
    case "fresh_yaku_multiply_heung": {
      // Rewards variety, which is the opposite of what 비결서 pushes you toward.
      const played = context.yakusPlayed?.[context.candidate.yakuId] ?? 0;
      if (played < Math.max(1, positiveInteger(params.maxTimesPlayed, 1))) {
        addEffect(effects, makeEffect(talisman, definition, "multiply_heung", finiteOr(definition.factor, 1)));
      }
      break;
    }
    case "yaku_multiply_heung": {
      // Named-hand jokers. Hitting one exact 끗패 is a narrow ask, so the payoff
      // is a multiplier rather than a flat bonus — and the rarer the hand, the
      // bigger the factor. 비결서 raises the same hand's base, so the two stack
      // into a real build instead of two separate small bonuses.
      const yakuIds = csvValues(params.yakuIds);
      if (yakuIds.includes(context.candidate.yakuId)) {
        addEffect(effects, makeEffect(talisman, definition, "multiply_heung", finiteOr(definition.factor, 1)));
        addEffect(effects, makeEffect(talisman, definition, "add_kkeut", amount));
      }
      break;
    }
    case "yaku_multiply_kkeut": {
      const yakuIds = csvValues(params.yakuIds);
      if (yakuIds.includes(context.candidate.yakuId)) {
        const factor = Math.max(0, finiteOr(definition.factor, 1));
        // 월 합 has no multiply operation, so the gain is expressed as an add.
        const bonus = Math.round(Math.max(0, context.candidate.jitSum || 1) * (factor - 1));
        addEffect(effects, makeEffect(talisman, definition, "add_kkeut", bonus));
      }
      break;
    }
    case "jit_sum_multiply_heung": {
      if (context.candidate.jitSum >= Math.max(1, positiveInteger(params.minJitSum, 1))) {
        addEffect(effects, makeEffect(talisman, definition, "multiply_heung", finiteOr(definition.factor, 1)));
      }
      break;
    }
    case "bright_drought_growth": {
      // Grown in the reducer every time a hand scores without a 광.
      const factor = 1 + Math.max(0, finiteOr(talisman.growth));
      if (factor !== 1) addEffect(effects, makeEffect(talisman, definition, "multiply_heung", factor, "무광 연습"));
      break;
    }
    case "first_card_retrigger": {
      const first = context.scoringCards[0];
      const requiresEnhancement = params.requiresEnhancement === true;
      if (first && (!requiresEnhancement || first.enhancement !== undefined)) {
        const repeats = Math.max(1, positiveInteger(definition.amount, 1));
        for (let repeat = 0; repeat < repeats; repeat += 1) {
          effects.push(...cardRetriggerEffects(first, talisman, definition, cupRole, context.scoringCards.length, `첫 패 재발동 ${repeat + 1}`));
        }
      }
      break;
    }
    case "burn_chaff_growth": {
      const factor = 1 + Math.max(0, finiteOr(talisman.growth));
      if (factor !== 1) addEffect(effects, makeEffect(talisman, definition, "multiply_heung", factor));
      break;
    }
    case "devour_neighbor": {
      // The stage-opening reducer stores the eaten talisman's value in growth.
      // Without turning that growth back into a score operation the dagger
      // visibly ate a charm but never paid the promised permanent multiplier.
      const factor = 1 + Math.max(0, finiteOr(talisman.growth));
      if (factor !== 1) addEffect(effects, makeEffect(talisman, definition, "multiply_heung", factor, "누적 성장"));
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
        effects.push(...cardRetriggerEffects(card, talisman, definition, "double_chaff", context.scoringCards.length, "쌍피 역할 재발동"));
      }
      break;
    }
    case "copy_left_score":
    case "copy_neighbors":
    case "five_multiple_jit":
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
  const cannotBeCopied = new Set<ScoreEffectKey>([
    "copy_left_score",
    "copy_neighbors",
    "economy",
    "fail_rescue",
    "threshold_relief",
    "settlement_multiplier",
  ]);

  const rightmostLiveScoreEffects = (reader: TalismanInstance): OrderedScoreEffect[] => {
    for (const candidateTalisman of [...context.talismans].reverse()) {
      if (candidateTalisman.instanceId === reader.instanceId) continue;
      const candidateDefinition = definitions[candidateTalisman.definitionId];
      if (!candidateDefinition || cannotBeCopied.has(candidateDefinition.effectKey)) continue;
      const candidateEffects = [
        ...effectsForDefinition(candidateTalisman, candidateDefinition, context),
        ...editionEffects(candidateTalisman, candidateDefinition),
      ];
      if (candidateEffects.length > 0) return candidateEffects;
    }
    return [];
  };

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
      const targetEffects = rightmostLiveScoreEffects(talisman);
      effects = cloneEffects(targetEffects, talisman, definition);
    } else {
      effects = effectsForDefinition(talisman, definition, context);
    }

    effects.push(...editionEffects(talisman, definition));
    const copyable = !cannotBeCopied.has(definition.effectKey);
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
  allowsFiveMultipleJit: boolean;
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
    allowsFiveMultipleJit: false,
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
    if (definition.effectKey === "five_multiple_jit") result.allowsFiveMultipleJit = true;
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
