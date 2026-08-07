import type { CardInstance, CardKind } from "../types";
import { getEffectiveCardRole, type CupRole } from "./deck";

/**
 * Turns the player's deck into the slots the collection board draws.
 *
 * The board used to render a fixed number of blank pips — five for 광, ten for
 * 띠 and so on — which stopped being true the moment the deck could be edited.
 * Burn a 광 and the row still promised five; add a joker that makes 8월 count
 * as 광 and the extra never showed up. These slots come from the deck instead,
 * so the row is always a picture of the run you are actually playing.
 *
 * Identity is `originId`, not `instanceId`: two copies of 1월 광 are one slot
 * carrying a count, because a row of duplicate pictures reads as noise.
 */

export type CollectionTrack = "bright" | "animal" | "godori" | "ribbon" | "chaff";

export const GODORI_MONTHS = [2, 4, 8] as const;

export interface CollectionSlot {
  /** Distinct card identity. Also the React key and the atlas lookup. */
  originId: string;
  name: string;
  month: number;
  assetTag: string;
  /**
   * The kind PRINTED on the card, not the one the scorer sees. A joker that
   * makes 8월 count as 광 must not move the picture on the sheet.
   */
  kind: CardKind;
  chaffValue: number;
  /** Copies of this card sitting in the deck right now. */
  deckCount: number;
  /** Copies already banked onto the board this round. */
  collectedCount: number;
  /** Copies in the hand being scored but not yet banked. */
  pendingCount: number;
}

export type CupRoleLookup = CupRole | Readonly<Record<string, CupRole>>;

function resolveCupRole(lookup: CupRoleLookup | undefined, card: CardInstance): CupRole {
  if (!lookup) return "animal";
  if (typeof lookup === "string") return lookup;
  return lookup[card.instanceId] ?? "animal";
}

/**
 * Mirrors `matchesKind` in collection-bonus.ts. Kept in step deliberately: a
 * card the board shows in the 광 row must be a card the scorer counts as 광.
 */
function matchesKind(
  card: CardInstance,
  kind: "bright" | "animal" | "ribbon" | "chaff",
  lookup: CupRoleLookup | undefined,
): boolean {
  if (card.enhancement === "stone") return false;
  if (card.enhancement === "wild" || card.tags.includes("all_kind_wild")) return true;
  if (kind === "bright" && card.tags.includes("counts_as_bright")) return true;
  return getEffectiveCardRole(card, resolveCupRole(lookup, card)).kind === kind;
}

function belongsToTrack(
  card: CardInstance,
  track: CollectionTrack,
  lookup: CupRoleLookup | undefined,
): boolean {
  if (track === "godori") {
    return matchesKind(card, "animal", lookup)
      && card.tags.includes("bird")
      && (GODORI_MONTHS as readonly number[]).includes(card.month);
  }
  return matchesKind(card, track, lookup);
}

export interface CollectionSlotInput {
  deck: readonly CardInstance[];
  /** Cards banked onto the board, i.e. from hands already settled. */
  confirmedCardIds?: readonly string[];
  /** Cards in the hand currently being previewed. */
  pendingCardIds?: readonly string[];
  track: CollectionTrack;
  cupRoles?: CupRoleLookup;
  /**
   * List only what has actually been taken, instead of every candidate in the
   * deck. 피 uses this: the deck holds two dozen of them, which would bury the
   * board, and their identity does not matter anyway — any 피 is as good as
   * any other. The row becomes a tally of what you picked up rather than a
   * checklist of what is left.
   */
  collectedOnly?: boolean;
}

export function buildCollectionSlots(input: CollectionSlotInput): CollectionSlot[] {
  const confirmed = new Set(input.confirmedCardIds ?? []);
  const pending = new Set(input.pendingCardIds ?? []);
  const byOrigin = new Map<string, CollectionSlot>();

  for (const card of input.deck) {
    if (card.disabledForRound) continue;
    if (!belongsToTrack(card, input.track, input.cupRoles)) continue;
    const held = confirmed.has(card.instanceId) || pending.has(card.instanceId);
    if (input.collectedOnly && !held) continue;

    const existing = byOrigin.get(card.originId);
    const slot = existing ?? {
      originId: card.originId,
      name: card.name,
      month: card.month,
      assetTag: card.assetTag,
      kind: card.kind,
      chaffValue: card.chaffValue,
      deckCount: 0,
      collectedCount: 0,
      pendingCount: 0,
    };
    slot.deckCount += 1;
    if (confirmed.has(card.instanceId)) slot.collectedCount += 1;
    else if (pending.has(card.instanceId)) slot.pendingCount += 1;
    if (!existing) byOrigin.set(card.originId, slot);
  }

  // Calendar order, so a row reads left to right the way a player counts months.
  return [...byOrigin.values()].sort((left, right) =>
    left.month - right.month || left.originId.localeCompare(right.originId),
  );
}

/** True once every copy the deck holds has been collected. */
export function isSlotComplete(slot: CollectionSlot): boolean {
  return slot.deckCount > 0 && slot.collectedCount >= slot.deckCount;
}
