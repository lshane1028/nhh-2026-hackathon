import { CONTRACTS, PACKS, PACK_BY_ID } from "../content/meta";
import { TALISMAN_BY_ID } from "../content/talismans";
import { BOOK_BY_ID, FORBIDDEN_BY_ID, PAINTER_BY_ID } from "../content/upgrades";
import { canPayForbiddenCost, getEligibleForbiddenTargetIds } from "../engine/consumables";
import { generateSeededOffers, purchaseShopOffer } from "../engine/economy";
import type { ForbiddenDefinition, GameState, ShopOffer, TalismanDefinition } from "../types";
import { prependGameLog as logEntry } from "./logs";
import { openPurchasedPack } from "./pack-actions";
import { countContractEffect, getContractDiscount, getEffectiveTalismanSlots } from "./selectors";
import { getShopCategoryPool, type ShopCategory } from "./shop-catalog";

export { getShopCategoryPool } from "./shop-catalog";
export type { ShopCategory } from "./shop-catalog";

const SHOP_CATEGORIES: readonly ShopCategory[] = ["talisman", "book", "forbidden", "painter"];
const SHOP_DEPARTMENT_SIZES: Record<ShopCategory | "pack", number> = {
  talisman: 2,
  book: 2,
  forbidden: 1,
  painter: 0,
  pack: 3,
};

export function generateShopOffers(state: GameState): { offers: ShopOffer[]; cursor: number } {
  let rng = {
    seed: `${state.seed}:${state.runId}:shop:${state.stage}`,
    cursor: state.rngCursor,
  };
  const offers: ShopOffer[] = [];
  const tutorialFirstShop = state.tutorialMode && state.stage === 1;

  for (const category of SHOP_CATEGORIES) {
    const size = SHOP_DEPARTMENT_SIZES[category]
      + (category === "book" && countContractEffect(state, "book_weight") >= 1 ? 1 : 0);
    if (size <= 0) continue;
    const basePool = getShopCategoryPool(state, category);
    const pool = category === "forbidden" && basePool.length > 1
      ? basePool.filter((entry) => entry.id !== state.lastForbiddenOfferId)
      : basePool;
    const tutorialTalisman = tutorialFirstShop && category === "talisman"
      ? TALISMAN_BY_ID.t_first_charm
      : undefined;
    const forcedTutorialTalisman = tutorialTalisman
      && pool.some((entry) => entry.id === tutorialTalisman.id)
      ? tutorialTalisman
      : undefined;
    if (forcedTutorialTalisman) {
      offers.push({
        offerId: `${state.runId}:offer:${state.stage}:talisman:tutorial`,
        category: "talisman",
        definitionId: forcedTutorialTalisman.id,
        price: Math.max(0, Math.ceil(forcedTutorialTalisman.price * (1 - getContractDiscount(state)))),
        sold: false,
      });
    }
    const generated = generateSeededOffers({
      category,
      count: size - (forcedTutorialTalisman ? 1 : 0),
      rng,
      pool,
      excludeDefinitionIds: forcedTutorialTalisman ? [forcedTutorialTalisman.id] : undefined,
      discountRate: getContractDiscount(state),
      offerNamespace: `${state.runId}:offer:${state.stage}`,
    });
    offers.push(...generated.value);
    rng = generated.state;
  }

  const packs = generateSeededOffers({
    category: "pack",
    count: SHOP_DEPARTMENT_SIZES.pack,
    rng,
    pool: PACKS,
    discountRate: getContractDiscount(state),
    offerNamespace: `${state.runId}:offer:${state.stage}`,
  });
  return { offers: [...offers, ...packs.value], cursor: packs.state.cursor };
}

/** Compatibility path for older saves that still hold a single shop category. */
export function generateLegacyShopOffers(
  state: GameState,
  category: ShopCategory,
  free = false,
): { offers: ShopOffer[]; cursor: number } {
  const pool = getShopCategoryPool(state, category);
  const generated = generateSeededOffers({
    category,
    count: Math.min(3, pool.length),
    rng: {
      seed: `${state.seed}:${state.runId}:shop:${state.stage}:${category}`,
      cursor: state.rngCursor,
    },
    pool,
    discountRate: free ? 0.95 : getContractDiscount(state),
    offerNamespace: `${state.runId}:offer:${state.stage}`,
  });
  return {
    offers: free ? generated.value.map((offer) => ({ ...offer, price: 0 })) : generated.value,
    cursor: generated.state.cursor,
  };
}

export function enterMarketAfterReward(state: GameState): GameState {
  const generated = generateShopOffers(state);
  const baseReroll = Math.max(0, 2 - Math.min(1, countContractEffect(state, "reroll_cost")));
  const firstFree = state.talismans.some((item) => item.definitionId === "t_market_rumor");
  return {
    ...state,
    screen: "shop",
    shopType: null,
    shopOffers: generated.offers,
    lastForbiddenOfferId: generated.offers.find((offer) => offer.category === "forbidden")?.definitionId
      ?? state.lastForbiddenOfferId,
    rngCursor: generated.cursor,
    rerollCost: firstFree ? 0 : baseReroll,
  };
}

export function rerollMarket(state: GameState): GameState {
  if (state.money < state.rerollCost) return state;
  const generated = state.shopType
    ? generateLegacyShopOffers({ ...state, rngCursor: state.rngCursor + 1 }, state.shopType)
    : generateShopOffers({ ...state, rngCursor: state.rngCursor + 1 });
  const bargainingLevel = countContractEffect(state, "reroll_cost");
  const baseReroll = Math.max(0, 2 - Math.min(1, bargainingLevel));
  const marketRumor = state.talismans.some((item) => item.definitionId === "t_market_rumor");
  const nextCost = bargainingLevel >= 2
    ? baseReroll
    : state.rerollCost === 0
      ? baseReroll + (marketRumor ? 2 : 1)
      : state.rerollCost + (marketRumor ? 2 : 1);
  return {
    ...state,
    money: state.money - state.rerollCost,
    rngCursor: generated.cursor,
    shopOffers: generated.offers,
    lastForbiddenOfferId: generated.offers.find((offer) => offer.category === "forbidden")?.definitionId
      ?? state.lastForbiddenOfferId,
    rerollCost: nextCost,
  };
}

export function buyMarketOffer(state: GameState, offerId: string): GameState {
  const offer = state.shopOffers.find((entry) => entry.offerId === offerId);
  if (!offer || offer.sold || state.money < offer.price) return state;
  const completePurchase = (closeOtherFreeOffers = true) => {
    const purchase = purchaseShopOffer(state.shopOffers, offerId, state.money);
    if (!purchase.success) return null;
    return {
      money: purchase.moneyAfter,
      shopOffers: closeOtherFreeOffers
        ? purchase.offers.map((entry) => ({
            ...entry,
            sold: entry.sold || (offer.price === 0 && entry.price === 0),
          }))
        : purchase.offers,
    };
  };

  if (offer.category === "pack") {
    const pack = PACK_BY_ID[offer.definitionId];
    if (!pack) return state;
    const purchase = completePurchase(false);
    if (!purchase) return state;
    const opened = openPurchasedPack(state, offer.definitionId);
    if (!opened) return state;
    return {
      ...state,
      rngCursor: opened.cursor,
      money: purchase.money,
      pendingPack: opened.pendingPack,
      shopOffers: purchase.shopOffers,
      logs: logEntry(state, "reward", `${pack.name} 개봉`, `후보 ${opened.pendingPack.candidates.length + (opened.pendingPack.rewardCandidates?.length ?? 0)}개 중 ${opened.pendingPack.picksLeft}개를 고르세요.`),
    };
  }

  if (offer.category === "talisman") {
    if (state.talismans.length >= getEffectiveTalismanSlots(state)) return state;
    const definition = TALISMAN_BY_ID[offer.definitionId] as TalismanDefinition | undefined;
    if (!definition) return state;
    const purchase = completePurchase();
    if (!purchase) return state;
    return {
      ...state,
      money: purchase.money,
      talismans: [...state.talismans, { instanceId: `${offer.offerId}:owned`, definitionId: definition.id, growth: 0 }],
      shopOffers: purchase.shopOffers,
      logs: logEntry(state, "reward", `${definition.name} 획득`, definition.description),
    };
  }

  if (offer.category === "book") {
    const book = BOOK_BY_ID[offer.definitionId];
    if (!book) return state;
    const current = state.yakuLevels[book.yakuId] ?? { level: 1, mastery: 0 };
    const purchase = completePurchase();
    if (!purchase) return state;
    return {
      ...state,
      money: purchase.money,
      yakuLevels: { ...state.yakuLevels, [book.yakuId]: { ...current, level: current.level + 1 } },
      shopOffers: purchase.shopOffers,
      lastConsumableId: book.id,
      logs: logEntry(state, "reward", `${book.name} 독파`, `${book.yakuId} 레벨 ${current.level + 1}`),
    };
  }

  const definition = offer.category === "painter"
    ? PAINTER_BY_ID[offer.definitionId]
    : FORBIDDEN_BY_ID[offer.definitionId];
  if (!definition) return state;
  if (offer.category === "forbidden") {
    const forbidden = FORBIDDEN_BY_ID[offer.definitionId] as ForbiddenDefinition | undefined;
    if (!forbidden) return state;
    const additionalCost = forbidden.additionalCost ?? 0;
    if (state.money < offer.price + additionalCost) {
      return {
        ...state,
        logs: logEntry(state, "system", "대가 부족", `구매가 외에 ${additionalCost}냥이 더 필요합니다.`),
      };
    }
    const afterPurchase = { ...state, money: state.money - offer.price };
    if (!canPayForbiddenCost(afterPurchase, forbidden)) {
      return { ...state, logs: logEntry(state, "system", "대가 불가", forbidden.cost) };
    }
    if (
      forbidden.targetKind !== "none"
      && getEligibleForbiddenTargetIds(state, forbidden).length < forbidden.minTargets
    ) {
      return { ...state, logs: logEntry(state, "system", "대상 없음", forbidden.targetPrompt) };
    }
  }
  const purchase = completePurchase();
  if (!purchase) return state;
  return {
    ...state,
    money: purchase.money,
    screen: "deck_editor",
    returnScreen: "shop",
    pendingConsumableId: definition.id,
    pendingTargetIds: [],
    pendingShopOfferId: offerId,
    shopOffers: purchase.shopOffers,
  };
}

export function sellMarketTalisman(state: GameState, instanceId: string): GameState {
  const instance = state.talismans.find((entry) => entry.instanceId === instanceId);
  const definition = instance ? TALISMAN_BY_ID[instance.definitionId] : undefined;
  if (!instance || !definition) return state;
  return {
    ...state,
    money: state.money + Math.max(1, Math.floor(definition.price / 2)),
    talismans: state.talismans.filter((entry) => entry.instanceId !== instanceId),
  };
}

export function moveMarketTalisman(state: GameState, instanceId: string, direction: -1 | 1): GameState {
  const index = state.talismans.findIndex((entry) => entry.instanceId === instanceId);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= state.talismans.length) return state;
  const talismans = [...state.talismans];
  [talismans[index], talismans[target]] = [talismans[target], talismans[index]];
  return { ...state, talismans };
}

export function moveMarketTalismanTo(state: GameState, instanceId: string, targetInstanceId: string): GameState {
  const from = state.talismans.findIndex((entry) => entry.instanceId === instanceId);
  const to = state.talismans.findIndex((entry) => entry.instanceId === targetInstanceId);
  if (from < 0 || to < 0 || from === to) return state;
  const talismans = [...state.talismans];
  const [moved] = talismans.splice(from, 1);
  talismans.splice(to, 0, moved);
  return { ...state, talismans };
}

export function chooseSeasonContract(state: GameState, contractId: string): GameState {
  if (!state.contractChoices.includes(contractId)) return state;
  const contracts = [...state.contracts, contractId];
  const definition = CONTRACTS.find((entry) => entry.id === contractId);
  if (state.stage === 12 && state.infiniteLap === 0) {
    return { ...state, contracts, screen: "run_win", contractChoices: [], shopOffers: [], shopType: null };
  }
  return {
    ...state,
    contracts,
    talismanSlots: definition?.effectKey === "inventory_slots" ? state.talismanSlots + 1 : state.talismanSlots,
    stage: state.stage + 1,
    screen: "round_intro",
    contractChoices: [],
    shopOffers: [],
    shopType: null,
  };
}
