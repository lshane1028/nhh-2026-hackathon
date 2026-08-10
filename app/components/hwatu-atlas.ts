/**
 * Where each card sits in `/assets/cards/hwatu-basic-atlas-generated-v4-aligned.png`.
 *
 * The sheet is an 8-column, 6-row grid: two months per row, four cards per
 * month. Both the hand and the collection board draw from it, so the lookup
 * lives here rather than inside either component.
 *
 * The layout is keyed off `assetTag` and month rather than `kind`, because a
 * card's kind can be rewritten at runtime — a joker that makes 8월 count as 광
 * must not move its picture.
 */

export const HWATU_ATLAS_URL = "/assets/cards/hwatu-basic-atlas-generated-v4-aligned.png";
export const HWATU_ATLAS_COLUMNS = 8;
export const HWATU_ATLAS_ROWS = 6;

export interface AtlasCard {
  month: number;
  assetTag: string;
  kind: string;
  chaffValue?: number;
}

/**
 * The shipping cards are individually cropped and normalised to 320x480.
 * The source sheet has irregular gutters, so using it as a uniform CSS sprite
 * clips a few pixels from every card even though it looks like an 8x6 grid.
 */
export function getCardArtUrl(card: AtlasCard): string {
  return `/assets/cards/hwatu/${card.assetTag}.webp`;
}

/** Column offset of a card inside its month's block of four. */
function cardOffset(card: AtlasCard): number {
  if (card.assetTag.endsWith("chaff-a")) return 2;
  if (card.assetTag.endsWith("chaff-b")) return 3;
  if (card.month === 12) {
    if (card.kind === "animal") return 1;
    if (card.kind === "ribbon") return 2;
    if (card.chaffValue === 2) return 3;
    return 0;
  }
  if (
    (card.month === 8 && card.kind === "animal")
    || (card.month === 11 && card.chaffValue === 2)
    || card.kind === "ribbon"
  ) {
    return 1;
  }
  return 0;
}

/** A `background-position` value for a tile scaled to 800% 600%. */
export function getAtlasPosition(card: AtlasCard): string {
  const row = Math.floor((card.month - 1) / 2);
  const monthStartColumn = ((card.month - 1) % 2) * 4;
  const column = monthStartColumn + cardOffset(card);
  return `${(column / (HWATU_ATLAS_COLUMNS - 1)) * 100}% ${(row / (HWATU_ATLAS_ROWS - 1)) * 100}%`;
}
