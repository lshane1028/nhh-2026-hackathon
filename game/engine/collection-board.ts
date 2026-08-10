import type { CardInstance, CardKind } from "../types";
import {
  getCollectionKindValue,
  getEffectiveCardKinds,
  getEffectiveChaffValue,
  getEffectiveKindMultiplicity,
  resolveCupRole,
  type CupRole,
} from "./deck";

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

/** Visual order shared by collection-board filing and landing animations. */
export const COLLECTION_TRACK_ORDER: readonly CollectionTrack[] = [
  "bright",
  "animal",
  "godori",
  "ribbon",
  "chaff",
];

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
  /** Effective copies on this track. 쌍패 contributes two. */
  deckCount: number;
  /** Effective copies already banked onto the board this round. */
  collectedCount: number;
  /** Effective copies in the hand being scored but not yet banked. */
  pendingCount: number;
}

export type CupRoleLookup = CupRole | Readonly<Record<string, CupRole>>;

/**
 * One destination affected when a submitted card is filed onto the collection
 * board. `track` plus `originId` identifies the exact slot built by
 * `buildCollectionSlots`.
 */
export interface CollectionLandingTarget {
  track: CollectionTrack;
  originId: string;
  /** Stable cross-track key for animation queues and DOM lookups. */
  slotKey: string;
  /** Amount by which the matching CollectionSlot counters advance. */
  slotMultiplicity: number;
  /** Amount added to the track's numeric collection counter. */
  collectionValue: number;
}

function isGodoriCard(
  card: CardInstance,
  effectiveKinds: ReadonlySet<CardKind>,
): boolean {
  return effectiveKinds.has("animal")
    && card.tags.includes("bird")
    && (GODORI_MONTHS as readonly number[]).includes(card.month);
}

/**
 * Maps a card to every collection-board slot it affects.
 *
 * Added-kind effects keep the printed role, so a single card can legitimately
 * return several destinations. Godori remains a distinct-month set and never
 * receives twin-kind's doubled slot contribution.
 */
export function getCollectionLandingTargets(
  card: CardInstance,
  lookup?: CupRoleLookup,
): CollectionLandingTarget[] {
  if (card.disabledForRound) return [];

  const role = resolveCupRole(lookup, card);
  const effectiveKinds = new Set(getEffectiveCardKinds(card, role));

  return COLLECTION_TRACK_ORDER.flatMap((track): CollectionLandingTarget[] => {
    const belongs = track === "godori"
      ? isGodoriCard(card, effectiveKinds)
      : effectiveKinds.has(track);
    if (!belongs) return [];

    const slotMultiplicity = track === "godori"
      ? 1
      : getEffectiveKindMultiplicity(card, track, role);
    const collectionValue = track === "godori"
      ? 1
      : getCollectionKindValue(card, track, role);

    return [{
      track,
      originId: card.originId,
      slotKey: `${track}:${card.originId}`,
      slotMultiplicity,
      collectionValue,
    }];
  });
}

function findLandingTarget(
  card: CardInstance,
  track: CollectionTrack,
  lookup: CupRoleLookup | undefined,
): CollectionLandingTarget | undefined {
  return getCollectionLandingTargets(card, lookup).find((target) => target.track === track);
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
    const target = findLandingTarget(card, input.track, input.cupRoles);
    if (!target) continue;
    const held = confirmed.has(card.instanceId) || pending.has(card.instanceId);
    if (input.collectedOnly && !held) continue;
    const multiplicity = target.slotMultiplicity;

    const existing = byOrigin.get(card.originId);
    const slot = existing ?? {
      originId: card.originId,
      name: card.name,
      month: card.month,
      assetTag: card.assetTag,
      kind: card.kind,
      chaffValue: getEffectiveChaffValue(card, resolveCupRole(input.cupRoles, card)),
      deckCount: 0,
      collectedCount: 0,
      pendingCount: 0,
    };
    slot.deckCount += multiplicity;
    if (confirmed.has(card.instanceId)) slot.collectedCount += multiplicity;
    else if (pending.has(card.instanceId)) slot.pendingCount += multiplicity;
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
