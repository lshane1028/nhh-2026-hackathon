import { CONTRACTS, PACKS } from "../content/meta";
import { TALISMANS } from "../content/talismans";
import { BOOKS, FORBIDDEN_CARDS, PAINTER_CARDS } from "../content/upgrades";
import type { ShopOffer } from "../types";
import { nextRandom, type RngResult, type RngState } from "./rng";

interface OfferPoolEntry {
  id: string;
  price: number;
  weight?: number;
}

const OFFER_POOLS: Record<ShopOffer["category"], readonly OfferPoolEntry[]> = {
  talisman: TALISMANS,
  painter: PAINTER_CARDS,
  book: BOOKS,
  forbidden: FORBIDDEN_CARDS,
  pack: PACKS,
};

function finiteOr(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function nonNegativeInteger(value: unknown, label: string): number {
  const numeric = finiteOr(value, Number.NaN);
  if (!Number.isSafeInteger(numeric) || numeric < 0) {
    throw new RangeError(`${label} must be a non-negative safe integer`);
  }
  return numeric;
}

export function clampDiscountRate(discountRate: number): number {
  return Math.min(0.95, Math.max(0, finiteOr(discountRate)));
}

export function calculateDiscountedPrice(basePrice: number, discountRate = 0): number {
  const price = nonNegativeInteger(basePrice, "basePrice");
  if (price === 0) return 0;
  return Math.max(1, Math.ceil(price * (1 - clampDiscountRate(discountRate))));
}

export interface GenerateSeededOffersInput {
  category: ShopOffer["category"];
  count: number;
  rng: RngState;
  discountRate?: number;
  excludeDefinitionIds?: readonly string[];
  weightMultipliers?: Readonly<Record<string, number>>;
  offerNamespace?: string;
}

function weightedIndex(
  entries: readonly OfferPoolEntry[],
  state: RngState,
  multipliers: Readonly<Record<string, number>>,
): { index: number; state: RngState } | null {
  const weights = entries.map((entry) => {
    const baseWeight = Math.max(0, finiteOr(entry.weight, 1));
    const multiplier = Math.max(0, finiteOr(multipliers[entry.id], 1));
    return baseWeight * multiplier;
  });
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  if (total <= 0) return null;

  const roll = nextRandom(state);
  let cursor = roll.value * total;
  for (let index = 0; index < entries.length; index += 1) {
    cursor -= weights[index];
    if (cursor < 0) return { index, state: roll.state };
  }
  return { index: entries.length - 1, state: roll.state };
}

/** Deterministic weighted draws without replacement. */
export function generateSeededOffers(
  input: GenerateSeededOffersInput,
): RngResult<ShopOffer[]> {
  const count = nonNegativeInteger(input.count, "count");
  const excluded = new Set(input.excludeDefinitionIds ?? []);
  const pool = OFFER_POOLS[input.category].filter((entry) => !excluded.has(entry.id));
  const available = [...pool];
  const offers: ShopOffer[] = [];
  const multipliers = input.weightMultipliers ?? {};
  const namespace = input.offerNamespace ?? "offer";
  const initialCursor = input.rng.cursor;
  let state = input.rng;

  while (offers.length < count && available.length > 0) {
    const draw = weightedIndex(available, state, multipliers);
    if (!draw) break;
    state = draw.state;
    const [definition] = available.splice(draw.index, 1);
    offers.push({
      offerId: `${namespace}:${state.seed}:${initialCursor}:${input.category}:${offers.length}:${definition.id}`,
      category: input.category,
      definitionId: definition.id,
      price: calculateDiscountedPrice(definition.price, input.discountRate),
      sold: false,
    });
  }

  return { value: offers, state };
}

export interface RerollCostModifiers {
  firstRerollFree?: boolean;
  baseCostDelta?: number;
  extraRerollIncrement?: number;
  fixedRerollIncrement?: number | null;
}

export function calculateRerollCost(
  baseCost: number,
  rerollsUsed: number,
  modifiers: RerollCostModifiers = {},
): number {
  const used = nonNegativeInteger(rerollsUsed, "rerollsUsed");
  if (used === 0 && modifiers.firstRerollFree) return 0;
  const adjustedBase = Math.max(0, nonNegativeInteger(baseCost, "baseCost") + finiteOr(modifiers.baseCostDelta));
  const increment = modifiers.fixedRerollIncrement === null || modifiers.fixedRerollIncrement === undefined
    ? 1 + finiteOr(modifiers.extraRerollIncrement)
    : finiteOr(modifiers.fixedRerollIncrement);
  return Math.max(0, Math.ceil(adjustedBase + used * Math.max(0, increment)));
}

export interface RerollShopInput extends Omit<GenerateSeededOffersInput, "rng"> {
  rng: RngState;
  money: number;
  currentOffers?: readonly ShopOffer[];
  baseRerollCost: number;
  rerollsUsed: number;
  costModifiers?: RerollCostModifiers;
}

export interface RerollShopResult {
  success: boolean;
  charged: number;
  moneyAfter: number;
  offers: ShopOffer[];
  rng: RngState;
  nextRerollCost: number;
}

export function rerollShop(input: RerollShopInput): RerollShopResult {
  const money = nonNegativeInteger(input.money, "money");
  const charged = calculateRerollCost(input.baseRerollCost, input.rerollsUsed, input.costModifiers);
  const nextRerollCost = calculateRerollCost(
    input.baseRerollCost,
    input.rerollsUsed + 1,
    input.costModifiers,
  );
  if (money < charged) {
    return {
      success: false,
      charged: 0,
      moneyAfter: money,
      offers: [...(input.currentOffers ?? [])],
      rng: input.rng,
      nextRerollCost: charged,
    };
  }

  const generated = generateSeededOffers(input);
  return {
    success: true,
    charged,
    moneyAfter: money - charged,
    offers: generated.value,
    rng: generated.state,
    nextRerollCost,
  };
}

export interface PurchaseOfferResult {
  success: boolean;
  reason: "ok" | "not_found" | "sold" | "insufficient_money";
  moneyAfter: number;
  offers: ShopOffer[];
  purchasedOffer: ShopOffer | null;
}

export function purchaseShopOffer(
  offers: readonly ShopOffer[],
  offerId: string,
  money: number,
): PurchaseOfferResult {
  const availableMoney = nonNegativeInteger(money, "money");
  const offer = offers.find((entry) => entry.offerId === offerId);
  if (!offer) {
    return { success: false, reason: "not_found", moneyAfter: availableMoney, offers: [...offers], purchasedOffer: null };
  }
  if (offer.sold) {
    return { success: false, reason: "sold", moneyAfter: availableMoney, offers: [...offers], purchasedOffer: null };
  }
  if (availableMoney < offer.price) {
    return {
      success: false,
      reason: "insufficient_money",
      moneyAfter: availableMoney,
      offers: [...offers],
      purchasedOffer: null,
    };
  }

  const purchasedOffer = { ...offer, sold: true };
  return {
    success: true,
    reason: "ok",
    moneyAfter: availableMoney - offer.price,
    offers: offers.map((entry) => entry.offerId === offerId ? purchasedOffer : { ...entry }),
    purchasedOffer,
  };
}

export interface RoundRewardInput {
  won: boolean;
  baseWinReward?: number;
  remainingHands?: number;
  successfulGoCount?: number;
  goCollectionCompletions?: number;
  confirmedScore?: number;
  targetScore?: number;
  adjustment?: number;
}

export interface RoundRewardBreakdown {
  base: number;
  remainingHands: number;
  go: number;
  collectionGo: number;
  overkill: number;
  adjustment: number;
  total: number;
}

export function calculateRoundReward(input: RoundRewardInput): RoundRewardBreakdown {
  if (!input.won) {
    return { base: 0, remainingHands: 0, go: 0, collectionGo: 0, overkill: 0, adjustment: 0, total: 0 };
  }
  const base = nonNegativeInteger(input.baseWinReward ?? 4, "baseWinReward");
  const remainingHands = nonNegativeInteger(input.remainingHands ?? 0, "remainingHands");
  const go = nonNegativeInteger(input.successfulGoCount ?? 0, "successfulGoCount");
  const collectionGo = nonNegativeInteger(input.goCollectionCompletions ?? 0, "goCollectionCompletions");
  const score = Math.max(0, finiteOr(input.confirmedScore));
  const target = Math.max(0, finiteOr(input.targetScore));
  const ratio = target > 0 ? score / target : 0;
  const overkill = Number(ratio >= 1.5) + Number(ratio >= 2.5);
  const adjustment = Math.trunc(finiteOr(input.adjustment));
  return {
    base,
    remainingHands,
    go,
    collectionGo,
    overkill,
    adjustment,
    total: Math.max(0, base + remainingHands + go + collectionGo + overkill + adjustment),
  };
}

export type ContractLevel = 0 | 1 | 2;

export interface ContractModifiers {
  levels: Record<string, ContractLevel>;
  extraHands: number;
  extraDiscards: number;
  extraHandSize: number;
  extraConsumableSlots: number;
  extraTalismanSlots: number;
  shopDiscountRate: number;
  rerollBaseCostDelta: number;
  fixedRerollIncrement: number | null;
  bookWeightMultiplier: number;
  guaranteeFavoriteBook: boolean;
  modifiedCardWeightMultiplier: number;
  editionsAndSealsInShop: boolean;
}

function parseContractEntry(entry: string): { id: string; upgraded: boolean } {
  if (entry.endsWith(":upgraded")) return { id: entry.slice(0, -":upgraded".length), upgraded: true };
  if (entry.endsWith("@2")) return { id: entry.slice(0, -2), upgraded: true };
  return { id: entry, upgraded: false };
}

export function calculateContractLevels(contractIds: readonly string[]): Record<string, ContractLevel> {
  const known = new Set<string>(CONTRACTS.map((contract) => contract.id));
  const levels: Record<string, ContractLevel> = {};
  for (const rawEntry of contractIds) {
    const entry = parseContractEntry(rawEntry);
    if (!known.has(entry.id)) continue;
    const current = levels[entry.id] ?? 0;
    levels[entry.id] = entry.upgraded ? 2 : Math.min(2, current + 1) as ContractLevel;
  }
  return levels;
}

export function calculateContractModifiers(contractIds: readonly string[]): ContractModifiers {
  const levels = calculateContractLevels(contractIds);
  const level = (id: string): ContractLevel => levels[id] ?? 0;
  const stampLevel = level("contract_regular_stamp");
  const bargainingLevel = level("contract_bargaining_sheet");
  const bookshopLevel = level("contract_bookshop");
  const painterLevel = level("contract_painter_guild");
  return {
    levels,
    extraHands: level("contract_extra_hand"),
    extraDiscards: level("contract_extra_discard"),
    extraHandSize: level("contract_large_table"),
    extraConsumableSlots: level("contract_talisman_pouch") >= 1 ? 1 : 0,
    extraTalismanSlots: level("contract_talisman_pouch") >= 2 ? 1 : 0,
    shopDiscountRate: stampLevel === 2 ? 0.3 : stampLevel === 1 ? 0.15 : 0,
    rerollBaseCostDelta: bargainingLevel >= 1 ? -1 : 0,
    fixedRerollIncrement: bargainingLevel >= 2 ? 0 : null,
    bookWeightMultiplier: bookshopLevel >= 1 ? 1.5 : 1,
    guaranteeFavoriteBook: bookshopLevel >= 2,
    modifiedCardWeightMultiplier: painterLevel >= 1 ? 1.5 : 1,
    editionsAndSealsInShop: painterLevel >= 2,
  };
}
