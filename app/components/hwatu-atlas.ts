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
function printedMonth(card: AtlasCard): number {
  const match = /^card-(\d{2})-/.exec(card.assetTag);
  const month = Number(match?.[1]);
  return Number.isInteger(month) && month >= 1 && month <= 12 ? month : card.month;
}

function cardOffset(card: AtlasCard, month: number): number {
  if (card.assetTag.endsWith("chaff-a")) return 2;
  if (card.assetTag.endsWith("chaff-b")) return 3;
  if (month === 12) {
    if (card.assetTag.includes("animal-")) return 1;
    if (card.assetTag.includes("ribbon-")) return 2;
    if (card.assetTag.endsWith("double-chaff")) return 3;
    return 0;
  }
  if (
    card.assetTag === "card-08-animal-bird"
    || card.assetTag === "card-11-double-chaff"
    || card.assetTag.includes("ribbon-")
  ) {
    return 1;
  }
  return 0;
}

/** A `background-position` value for a tile scaled to 800% 600%. */
export function getAtlasPosition(card: AtlasCard): string {
  const month = printedMonth(card);
  const row = Math.floor((month - 1) / 2);
  const monthStartColumn = ((month - 1) % 2) * 4;
  const column = monthStartColumn + cardOffset(card, month);
  return `${(column / (HWATU_ATLAS_COLUMNS - 1)) * 100}% ${(row / (HWATU_ATLAS_ROWS - 1)) * 100}%`;
}

/**
 * Two staged sources, ordered from sharpest to most defensive.
 *
 * CardArt requests the shared atlas only after a WebP error. The lossless PNG
 * editing sources live in source-assets and are not shipped to every player.
 */
export function getCardArtSources(card: AtlasCard): {
  primaryUrl: string;
  atlasUrl: string;
  atlasPosition: string;
} {
  return {
    primaryUrl: getCardArtUrl(card),
    atlasUrl: HWATU_ATLAS_URL,
    atlasPosition: getAtlasPosition(card),
  };
}
