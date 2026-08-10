import { describe, expect, it } from "vitest";

import {
  COLLECTION_TRACK_ORDER,
  buildCollectionSlots,
  getCollectionLandingTargets,
  type CollectionTrack,
} from "../engine/collection-board";
import { createStandardHwatuDeck } from "../engine/deck";
import type { CardInstance, CardKind } from "../types";

const deck = createStandardHwatuDeck();
let serial = 0;

function cardOf(kind: CardKind, predicate: (card: CardInstance) => boolean = () => true): CardInstance {
  const card = deck.find((entry) => entry.kind === kind && predicate(entry));
  if (!card) throw new Error(`Missing ${kind} fixture`);
  serial += 1;
  return { ...card, instanceId: `landing:${serial}`, tags: [...card.tags] };
}

function withPatch(card: CardInstance, patch: Partial<CardInstance>): CardInstance {
  return { ...card, tags: [...card.tags], ...patch };
}

function tracks(card: CardInstance, cupRoles?: Readonly<Record<string, "animal" | "double_chaff">>) {
  return getCollectionLandingTargets(card, cupRoles).map((target) => target.track);
}

describe("collection landing targets", () => {
  it("maps ordinary cards and files a Godori bird into both affected tracks", () => {
    const bright = cardOf("bright");
    const bird = cardOf("animal", (card) => card.month === 2 && card.tags.includes("bird"));
    const ribbon = cardOf("ribbon");
    const chaff = cardOf("chaff");

    expect(tracks(bright)).toEqual(["bright"]);
    expect(tracks(bird)).toEqual(["animal", "godori"]);
    expect(tracks(ribbon)).toEqual(["ribbon"]);
    expect(tracks(chaff)).toEqual(["chaff"]);
  });

  it("returns every printed, tagged, and added-kind destination exactly once", () => {
    const multiKind = withPatch(cardOf("animal", (card) => !card.tags.includes("bird")), {
      effectTagId: "as_ribbon",
      tags: ["counts_as_bright"],
    });
    const targets = getCollectionLandingTargets(multiKind);

    expect(targets.map((target) => target.track)).toEqual(["bright", "animal", "ribbon"]);
    expect(new Set(targets.map((target) => target.slotKey)).size).toBe(3);
    expect(targets.every((target) => target.originId === multiKind.originId)).toBe(true);
    expect(targets.every((target) => target.slotKey === `${target.track}:${multiKind.originId}`)).toBe(true);
    expect(targets.every((target) => target.slotMultiplicity === 1 && target.collectionValue === 1)).toBe(true);

    const redundant = withPatch(cardOf("animal", (card) => !card.tags.includes("bird")), {
      effectTagId: "as_animal",
    });
    expect(tracks(redundant)).toEqual(["animal"]);
  });

  it("lets added animal and extra-pi effects land on their secondary tracks", () => {
    const birdChaff = withPatch(cardOf("chaff", (card) => card.month === 2), {
      effectTagId: "as_animal",
      tags: ["bird"],
    });
    expect(tracks(birdChaff)).toEqual(["animal", "godori", "chaff"]);

    const extraPi = withPatch(cardOf("animal", (card) => !card.tags.includes("bird")), {
      effectTagId: "extra_pi",
    });
    const targets = getCollectionLandingTargets(extraPi);
    expect(targets.map((target) => target.track)).toEqual(["animal", "chaff"]);
    expect(targets.find((target) => target.track === "chaff")).toMatchObject({
      slotMultiplicity: 1,
      collectionValue: 1,
    });
  });

  it("resolves each cup card to its chosen animal or double-chaff slot", () => {
    const cup = deck.find((card) => card.tags.includes("cup"));
    if (!cup) throw new Error("Missing cup fixture");
    const card = withPatch(cup, { instanceId: "landing:cup", tags: [...cup.tags] });

    expect(tracks(card)).toEqual(["animal"]);
    expect(getCollectionLandingTargets(card, { [card.instanceId]: "double_chaff" })).toEqual([
      expect.objectContaining({
        track: "chaff",
        originId: card.originId,
        slotMultiplicity: 1,
        collectionValue: 2,
      }),
    ]);
  });

  it("exposes twin-kind slot weight without letting one bird replace a missing Godori month", () => {
    const twinBird = withPatch(
      cardOf("animal", (card) => card.month === 2 && card.tags.includes("bird")),
      { effectTagId: "twin_kind" },
    );
    expect(getCollectionLandingTargets(twinBird)).toEqual([
      expect.objectContaining({ track: "animal", slotMultiplicity: 2, collectionValue: 2 }),
      expect.objectContaining({ track: "godori", slotMultiplicity: 1, collectionValue: 1 }),
    ]);

    const doubleChaff = cardOf("chaff", (card) => card.chaffValue === 2);
    const twinDoubleChaff = withPatch(doubleChaff, { effectTagId: "twin_kind" });
    expect(getCollectionLandingTargets(twinDoubleChaff)).toEqual([
      expect.objectContaining({ track: "chaff", slotMultiplicity: 2, collectionValue: 4 }),
    ]);
  });

  it("keeps wild, stone, and disabled filing behavior aligned with effective kinds", () => {
    const bird = cardOf("animal", (card) => card.month === 2 && card.tags.includes("bird"));
    const wild = withPatch(bird, { enhancement: "wild" });
    const wildTargets = getCollectionLandingTargets(wild);
    expect(wildTargets.map((target) => target.track)).toEqual(COLLECTION_TRACK_ORDER);
    expect(wildTargets.find((target) => target.track === "chaff")?.collectionValue).toBe(0);

    expect(getCollectionLandingTargets(withPatch(bird, { enhancement: "stone" }))).toEqual([]);
    expect(getCollectionLandingTargets(withPatch(bird, { disabledForRound: true }))).toEqual([]);
  });

  it("stays in lockstep with every slot produced by buildCollectionSlots", () => {
    const cup = deck.find((card) => card.tags.includes("cup"));
    if (!cup) throw new Error("Missing cup fixture");
    const cards = [
      withPatch(cardOf("chaff"), { effectTagId: "as_bright" }),
      withPatch(cardOf("animal", (card) => !card.tags.includes("bird")), { effectTagId: "extra_pi" }),
      withPatch(cardOf("ribbon"), { effectTagId: "twin_kind" }),
      withPatch(cup, { instanceId: "landing:cup-lockstep", tags: [...cup.tags] }),
    ];
    const cupRoles = { "landing:cup-lockstep": "double_chaff" } as const;

    for (const card of cards) {
      const targets = getCollectionLandingTargets(card, cupRoles);
      for (const track of COLLECTION_TRACK_ORDER) {
        const target = targets.find((entry) => entry.track === track);
        const slot = buildCollectionSlots({
          deck: [card],
          pendingCardIds: [card.instanceId],
          track: track as CollectionTrack,
          cupRoles,
        })[0];

        if (!target) {
          expect(slot).toBeUndefined();
        } else {
          expect(slot).toMatchObject({
            originId: target.originId,
            deckCount: target.slotMultiplicity,
            pendingCount: target.slotMultiplicity,
          });
        }
      }
    }
  });
});
