import { TALISMANS } from "../content/talismans";
import { BOOKS, FORBIDDEN_CARDS, PAINTER_CARDS } from "../content/upgrades";
import type { GameState } from "../types";

export type ShopCategory = NonNullable<GameState["shopType"]>;

/** Shared catalog boundary used by both market rolls and pack generation. */
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
