import { describe, expect, it } from "vitest";
import { buildCollectionSlots, isSlotComplete } from "../engine/collection-board";
import { calculateCollectionBonus } from "../engine/collection-bonus";
import { createStandardHwatuDeck } from "../engine/deck";
import type { CardInstance } from "../types";
import { COLLECTION_TRACK_MARKS } from "../../app/components/CollectionBoard";

const deck = createStandardHwatuDeck();

let cloneSerial = 0;
function copyOf(card: CardInstance, patch: Partial<CardInstance> = {}): CardInstance {
  cloneSerial += 1;
  return { ...card, tags: [...card.tags], instanceId: `copy-${cloneSerial}`, ...patch };
}

const brights = deck.filter((card) => card.kind === "bright");

describe("collection board slots", () => {
  it("uses a distinct seal mark for every collection track", () => {
    expect(COLLECTION_TRACK_MARKS).toEqual({
      bright: "광",
      animal: "동",
      godori: "새",
      ribbon: "띠",
      chaff: "피",
    });
    expect(new Set(Object.values(COLLECTION_TRACK_MARKS))).toHaveLength(5);
  });

  it("draws one slot per distinct card in the deck", () => {
    const slots = buildCollectionSlots({ deck, track: "bright" });
    expect(slots).toHaveLength(5);
    expect(slots.map((slot) => slot.month)).toEqual([1, 3, 8, 11, 12]);
    expect(slots.every((slot) => slot.deckCount === 1)).toBe(true);
    expect(slots.every((slot) => slot.collectedCount === 0)).toBe(true);
  });

  it("shrinks when a card leaves the deck", () => {
    const burned = deck.filter((card) => card.instanceId !== brights[0].instanceId);
    expect(buildCollectionSlots({ deck: burned, track: "bright" })).toHaveLength(4);
  });

  it("collapses duplicates into one slot with a count", () => {
    const doubled = [...deck, copyOf(brights[0])];
    const slots = buildCollectionSlots({ deck: doubled, track: "bright" });
    expect(slots).toHaveLength(5);
    const slot = slots.find((entry) => entry.originId === brights[0].originId)!;
    expect(slot.deckCount).toBe(2);

    // Both copies genuinely count toward the 광 tiers, so the badge is honest.
    expect(calculateCollectionBonus([brights[0], copyOf(brights[0])]).counts.bright).toBe(2);
  });

  it("shows a card a joker turned into a 광, and hides a 돌패", () => {
    const wildcard = copyOf(deck.find((card) => card.month === 8 && card.kind === "chaff")!, {
      tags: ["pampas", "counts_as_bright"],
    });
    const stoned = copyOf(brights[1], { enhancement: "stone" });
    const slots = buildCollectionSlots({ deck: [...deck, wildcard, stoned], track: "bright" });
    expect(slots.some((slot) => slot.originId === wildcard.originId)).toBe(true);
    // The stone copy shares its originId with a real 광 already in the deck, so
    // it must not inflate that slot's count.
    const stonedSlot = slots.find((slot) => slot.originId === brights[1].originId)!;
    expect(stonedSlot.deckCount).toBe(1);
  });

  it("splits collected, pending and missing", () => {
    const [first, second] = brights;
    const slots = buildCollectionSlots({
      deck,
      track: "bright",
      confirmedCardIds: [first.instanceId],
      pendingCardIds: [second.instanceId],
    });
    const byOrigin = new Map(slots.map((slot) => [slot.originId, slot]));
    expect(byOrigin.get(first.originId)).toMatchObject({ collectedCount: 1, pendingCount: 0 });
    expect(byOrigin.get(second.originId)).toMatchObject({ collectedCount: 0, pendingCount: 1 });
    expect(isSlotComplete(byOrigin.get(first.originId)!)).toBe(true);
    expect(isSlotComplete(byOrigin.get(second.originId)!)).toBe(false);
  });

  it("keeps the godori row to the three bird months", () => {
    const slots = buildCollectionSlots({ deck, track: "godori" });
    expect(slots.map((slot) => slot.month)).toEqual([2, 4, 8]);
  });

  it("agrees with the scorer about what belongs in a row", () => {
    // The row must never promise a card the scorer would not count.
    for (const track of ["bright", "animal", "ribbon"] as const) {
      const slots = buildCollectionSlots({ deck, track });
      const total = slots.reduce((sum, slot) => sum + slot.deckCount, 0);
      expect(total).toBe(calculateCollectionBonus(deck).counts[track]);
    }
  });

  it("lists only what was taken when asked, which is how 피 stays readable", () => {
    const chaff = deck.filter((card) => card.kind === "chaff");
    // The deck holds two dozen 피, so the full candidate list would bury the board.
    expect(chaff.length).toBeGreaterThan(20);

    const taken = chaff.slice(0, 3);
    const slots = buildCollectionSlots({
      deck,
      track: "chaff",
      confirmedCardIds: taken.map((card) => card.instanceId),
      collectedOnly: true,
    });
    expect(slots).toHaveLength(3);
    expect(slots.every((slot) => slot.collectedCount === 1)).toBe(true);

    // Nothing taken yet means no picture row at all — the board falls back to
    // its notches rather than rendering an empty strip.
    expect(buildCollectionSlots({ deck, track: "chaff", collectedOnly: true })).toEqual([]);
  });

  it("keeps the 쌍피 value on the slot so the row can explain a jump of two", () => {
    const doubleChaff = deck.find((card) => card.chaffValue === 2);
    if (!doubleChaff) throw new Error("Standard deck has no 쌍피");
    const slot = buildCollectionSlots({
      deck,
      track: "chaff",
      confirmedCardIds: [doubleChaff.instanceId],
      collectedOnly: true,
    })[0];
    expect(slot.chaffValue).toBe(2);
  });

  it("carries the printed kind so a re-labelled card keeps its picture", () => {
    const wildcard = copyOf(deck.find((card) => card.month === 8 && card.kind === "chaff")!, {
      tags: ["pampas", "counts_as_bright"],
    });
    const slot = buildCollectionSlots({ deck: [wildcard], track: "bright" })[0];
    expect(slot.kind).toBe("chaff");
    expect(slot.assetTag).toBe(wildcard.assetTag);
  });
});
