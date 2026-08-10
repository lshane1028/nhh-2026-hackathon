import { describe, expect, it } from "vitest";

import { buildCollectionSlots } from "../engine/collection-board";
import { calculateCollectionBonus } from "../engine/collection-bonus";
import {
  createStandardHwatuDeck,
  getCollectionKindValue,
  getEffectiveCardKinds,
  getEffectiveChaffValue,
} from "../engine/deck";
import { buildOrderedTalismanScoreEffects } from "../engine/talismans";
import { getCollectionProgress, judgeKkeutPair } from "../engine/yaku";
import { findImmediateYakuCandidates } from "../engine/yaku";
import type { CardInstance, CardKind, TalismanInstance } from "../types";

const deck = createStandardHwatuDeck();
let serial = 0;

function cardOf(kind: CardKind, month?: number): CardInstance {
  const card = deck.find((entry) => entry.kind === kind && (month === undefined || entry.month === month));
  if (!card) throw new Error(`missing ${kind} ${month ?? ""}`);
  serial += 1;
  return { ...card, tags: [...card.tags], instanceId: `effect-engine:${serial}` };
}

function withEffect(card: CardInstance, effectTagId: string): CardInstance {
  return { ...card, tags: [...card.tags], effectTagId };
}

function owned(definitionId: string): TalismanInstance {
  return { instanceId: `owned:${definitionId}`, definitionId, growth: 0 };
}

describe("card effect engine", () => {
  it("adds 취급 kinds without replacing the printed kind", () => {
    const source = cardOf("chaff");
    const asBright = withEffect(source, "as_bright");
    const asAnimal = withEffect(source, "as_animal");
    const asRibbon = withEffect(source, "as_ribbon");

    expect(getEffectiveCardKinds(asBright)).toEqual(["chaff", "bright"]);
    expect(getEffectiveCardKinds(asAnimal)).toEqual(["chaff", "animal"]);
    expect(getEffectiveCardKinds(asRibbon)).toEqual(["chaff", "ribbon"]);

    expect(calculateCollectionBonus([asBright]).counts).toMatchObject({ bright: 1, chaff: 1 });
    expect(calculateCollectionBonus([asAnimal]).counts).toMatchObject({ animal: 1, chaff: 1 });
    expect(calculateCollectionBonus([asRibbon]).counts).toMatchObject({ ribbon: 1, chaff: 1 });
  });

  it("does not double-count a legacy same-kind treatment and lets 돌패 discard every kind", () => {
    const redundant = withEffect(cardOf("animal"), "as_animal");
    const stone = { ...withEffect(cardOf("chaff"), "as_bright"), enhancement: "stone" as const };

    expect(getEffectiveCardKinds(redundant)).toEqual(["animal"]);
    expect(getCollectionKindValue(redundant, "animal")).toBe(1);
    expect(getEffectiveCardKinds(stone)).toEqual([]);
    expect(calculateCollectionBonus([stone]).counts).toEqual({ bright: 0, animal: 0, godori: 0, ribbon: 0, chaff: 0 });
  });

  it("keeps 만능패 all-kind while 쌍패 doubles only its primary kind", () => {
    const wildTwin = {
      ...withEffect(cardOf("animal"), "twin_kind"),
      enhancement: "wild" as const,
    };

    expect(getEffectiveCardKinds(wildTwin)).toEqual(["bright", "animal", "ribbon", "chaff"]);
    expect(calculateCollectionBonus([wildTwin]).counts).toMatchObject({
      bright: 1,
      animal: 2,
      ribbon: 1,
      chaff: 0,
    });
  });

  it("uses 광 취급 for 광땡 and persistent bright collections", () => {
    const oneAsBright = withEffect(cardOf("chaff", 1), "as_bright");
    const threeBright = cardOf("bright", 3);
    expect(judgeKkeutPair(oneAsBright, threeBright).yakuId).toBe("gwangttaeng_13");

    const twinOneBright = withEffect(cardOf("bright", 1), "twin_kind");
    const progress = getCollectionProgress({ confirmedCards: [twinOneBright, threeBright] });
    expect(progress.find((entry) => entry.yakuId === "three_brights")).toMatchObject({
      completed: true,
      required: 3,
      matchedCardIds: [twinOneBright.instanceId, twinOneBright.instanceId, threeBright.instanceId],
    });
  });

  it("adds one 피 point with 덧피, including on a non-피 card", () => {
    const animal = withEffect(cardOf("animal"), "extra_pi");
    const chaff = withEffect(cardOf("chaff"), "extra_pi");
    const doubleChaff = withEffect(
      { ...deck.find((card) => card.kind === "chaff" && card.chaffValue === 2)!, instanceId: "effect-engine:double", tags: [] },
      "extra_pi",
    );

    expect(getEffectiveChaffValue(animal)).toBe(1);
    expect(getEffectiveChaffValue(chaff)).toBe(2);
    expect(getEffectiveChaffValue(doubleChaff)).toBe(3);
    expect(calculateCollectionBonus([animal, chaff, doubleChaff]).counts.chaff).toBe(6);

    const slots = buildCollectionSlots({ deck: [animal], track: "chaff" });
    expect(slots).toHaveLength(1);
    expect(slots[0]).toMatchObject({ kind: "animal", chaffValue: 1 });
  });

  it("counts 쌍패 twice only on its primary collection track", () => {
    const twinAnimal = withEffect(cardOf("animal"), "twin_kind");
    const twinRibbon = withEffect(cardOf("ribbon"), "twin_kind");
    const twinChaff = withEffect(cardOf("chaff"), "twin_kind");

    const counts = calculateCollectionBonus([twinAnimal, twinRibbon, twinChaff]).counts;
    expect(counts).toMatchObject({ animal: 2, ribbon: 2, chaff: 2 });
    expect(getCollectionKindValue(twinAnimal, "bright")).toBe(0);

    expect(buildCollectionSlots({ deck: [twinAnimal], track: "animal" })[0].deckCount).toBe(2);
    expect(buildCollectionSlots({ deck: [twinRibbon], track: "ribbon" })[0].deckCount).toBe(2);
    expect(buildCollectionSlots({ deck: [twinChaff], track: "chaff" })[0]).toMatchObject({
      deckCount: 2,
      chaffValue: 1,
    });
  });

  it("does not let added kinds counterfeit missing named-set markings", () => {
    const hongOne = cardOf("ribbon", 1);
    const hongTwo = cardOf("ribbon", 2);
    const plainThreeAsRibbon = withEffect(cardOf("chaff", 3), "as_ribbon");
    expect(calculateCollectionBonus([hongOne, hongTwo, plainThreeAsRibbon]).completedSets.hongdan).toBe(false);

    const birdTwo = deck.find((card) => card.month === 2 && card.tags.includes("bird"))!;
    const birdEight = deck.find((card) => card.month === 8 && card.tags.includes("bird"))!;
    const plainFourAsAnimal = withEffect(cardOf("chaff", 4), "as_animal");
    expect(calculateCollectionBonus([birdTwo, birdEight, plainFourAsAnimal]).completedSets.godori).toBe(false);
  });

  it("lets kind- and 피-reading talismans see the same effective roles", () => {
    const plain = cardOf("chaff", 1);
    const candidateFor = (card: CardInstance) => {
      const cards = [card, plain];
      return { cards, candidate: findImmediateYakuCandidates(cards)[0] };
    };

    const asAnimal = candidateFor(withEffect(cardOf("chaff", 2), "as_animal"));
    expect(buildOrderedTalismanScoreEffects({
      talismans: [owned("t_animal_tracks")],
      candidate: asAnimal.candidate,
      submittedCards: asAnimal.cards,
      scoringCards: asAnimal.cards,
    })).toEqual([expect.objectContaining({ operation: "add_kkeut", value: 18 })]);

    const twinAnimal = candidateFor(withEffect(cardOf("animal", 2), "twin_kind"));
    expect(buildOrderedTalismanScoreEffects({
      talismans: [owned("t_animal_tracks")],
      candidate: twinAnimal.candidate,
      submittedCards: twinAnimal.cards,
      scoringCards: twinAnimal.cards,
    })).toEqual([expect.objectContaining({ operation: "add_kkeut", value: 36 })]);

    const extraPi = candidateFor(withEffect(cardOf("animal", 2), "extra_pi"));
    expect(buildOrderedTalismanScoreEffects({
      talismans: [owned("t_chaff_bind")],
      candidate: extraPi.candidate,
      submittedCards: extraPi.cards,
      scoringCards: extraPi.cards,
    })).toEqual([expect.objectContaining({ operation: "add_kkeut", value: 18 })]);
  });
});
