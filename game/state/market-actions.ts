import { PACKS } from "../content/meta";
import { TALISMAN_BY_ID, TALISMANS } from "../content/talismans";
import { BOOKS, FORBIDDEN_CARDS, PAINTER_CARDS } from "../content/upgrades";
import { generateSeededOffers } from "../engine/economy";
import type { GameState, ShopOffer } from "../types";
import { countContractEffect, getContractDiscount } from "./selectors";

export type ShopCategory = NonNullable<GameState["shopType"]>;

const SHOP_CATEGORIES: readonly ShopCategory[] = ["talisman", "book", "forbidden", "painter"];
const SHOP_DEPARTMENT_SIZES: Record<ShopCategory | "pack", number> = {
  talisman: 2,
  book: 2,
  forbidden: 1,
  painter: 0,
  pack: 3,
};

export function getShopCategoryPool(state: GameState, category: ShopCategory) {
  if (category === "talisman") {
    const owned = new Set(state.talismans.map((item) => item.definitionId));
    return TALISMANS.filter((entry) => !owned.has(entry.id));
  }
  return category === "painter"
    ? PAINTER_CARDS
    : category === "book"
      ? BOOKS
      : FORBIDDEN_CARDS;
}

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
