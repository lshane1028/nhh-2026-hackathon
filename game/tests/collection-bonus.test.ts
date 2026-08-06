import { describe, expect, it } from "vitest";
import type { CardInstance } from "../types";
import { calculateCollectionBonus } from "../engine/collection-bonus";
import { createStandardHwatuDeck } from "../engine/deck";

const deck = createStandardHwatuDeck();

function cardsOf(kind: CardInstance["kind"]): CardInstance[] {
  return deck.filter((card) => card.kind === kind);
}

describe("persistent collection bonuses", () => {
  it("deduplicates cards and applies only the highest bright tier", () => {
    const brights = cardsOf("bright");
    expect(calculateCollectionBonus(brights.slice(0, 2)).multiplierBonus).toBe(0);
    expect(calculateCollectionBonus(brights.slice(0, 3)).multiplierBonus).toBe(2);
    expect(calculateCollectionBonus(brights.slice(0, 4)).multiplierBonus).toBe(4);
    expect(calculateCollectionBonus(brights).multiplierBonus).toBe(7);
    expect(calculateCollectionBonus([...brights, brights[0]])).toMatchObject({
      counts: { bright: 5 },
      multiplierBonus: 7,
    });
  });

  it("grows animal bonuses after five and adds Godori separately", () => {
    const nonBirdAnimals = cardsOf("animal").filter((card) => !card.tags.includes("bird"));
    expect(nonBirdAnimals).toHaveLength(5);
    expect(calculateCollectionBonus(nonBirdAnimals).multiplierBonus).toBe(2);
    expect(calculateCollectionBonus([...nonBirdAnimals, cardsOf("animal").find((card) => card.month === 2)!]).multiplierBonus).toBe(2.5);

    const godori = [2, 4, 8].map((month) => deck.find((card) => card.month === month && card.kind === "animal" && card.tags.includes("bird"))!);
    expect(calculateCollectionBonus(godori)).toMatchObject({
      completedSets: { godori: true },
      multiplierBonus: 2,
    });
  });

  it("tracks Godori as its own count while still counting the birds as animals", () => {
    const birdOf = (month: number) => deck.find((card) => card.month === month && card.kind === "animal" && card.tags.includes("bird"))!;

    const partial = calculateCollectionBonus([birdOf(2), birdOf(8)]);
    expect(partial.counts).toMatchObject({ animal: 2, godori: 2 });
    expect(partial.matchedGodoriMonths).toEqual([2, 8]);
    expect(partial.completedSets.godori).toBe(false);
    expect(partial.multiplierBonus).toBe(0);

    const full = calculateCollectionBonus([birdOf(2), birdOf(4), birdOf(8)]);
    expect(full.counts).toMatchObject({ animal: 3, godori: 3 });
    expect(full.matchedGodoriMonths).toEqual([2, 4, 8]);
    expect(full.multiplierBonus).toBe(2);

    // The December bird is not a Godori month but still an animal.
    const december = deck.find((card) => card.month === 12 && card.tags.includes("bird"))!;
    const withDecember = calculateCollectionBonus([birdOf(2), december]);
    expect(withDecember.counts).toMatchObject({ animal: 2, godori: 1 });
  });

  it("grows ribbon bonuses and awards each traditional ribbon set", () => {
    const mixedFive = [1, 4, 6, 12, 2].map((month) => deck.find((card) => card.month === month && card.kind === "ribbon")!);
    expect(calculateCollectionBonus(mixedFive).multiplierBonus).toBe(2);

    const hongdan = [1, 2, 3].map((month) => deck.find((card) => card.month === month && card.ribbonGroup === "hong")!);
    expect(calculateCollectionBonus(hongdan)).toMatchObject({
      completedSets: { hongdan: true },
      multiplierBonus: 2,
    });
  });

  it("starts Pi growth at five, jumps at ten, then adds month sum", () => {
    const singlePi = cardsOf("chaff").filter((card) => card.chaffValue === 1);
    expect(calculateCollectionBonus(singlePi.slice(0, 4)).multiplierBonus).toBe(0);
    expect(calculateCollectionBonus(singlePi.slice(0, 5)).multiplierBonus).toBe(1);
    expect(calculateCollectionBonus(singlePi.slice(0, 9)).multiplierBonus).toBe(2);
    expect(calculateCollectionBonus(singlePi.slice(0, 10))).toMatchObject({ multiplierBonus: 4, monthSumBonus: 0 });
    const eleven = calculateCollectionBonus(singlePi.slice(0, 11));
    expect(eleven).toMatchObject({ counts: { chaff: 11 }, multiplierBonus: 4, monthSumBonus: 1 });
    expect(eleven.effects.at(-1)).toMatchObject({ operation: "add_kkeut", value: 1 });
  });

  it("uses the selected role for the September cup", () => {
    const cup = deck.find((card) => card.tags.includes("cup"))!;
    expect(calculateCollectionBonus([cup], "animal").counts).toMatchObject({ animal: 1, chaff: 0 });
    expect(calculateCollectionBonus([cup], "double_chaff").counts).toMatchObject({ animal: 0, chaff: 2 });
  });

  it("reads per-instance cup assignments and defaults unfiled cups to animal", () => {
    const cup = deck.find((card) => card.tags.includes("cup"))!;
    const chaff = deck.find((card) => card.kind === "chaff" && card.chaffValue === 1)!;

    expect(calculateCollectionBonus([cup, chaff], {}).counts).toMatchObject({ animal: 1, chaff: 1 });
    expect(
      calculateCollectionBonus([cup, chaff], { [cup.instanceId]: "double_chaff" }).counts,
    ).toMatchObject({ animal: 0, chaff: 3 });
    expect(
      calculateCollectionBonus([cup, chaff], { "some-other-card": "double_chaff" }).counts,
    ).toMatchObject({ animal: 1, chaff: 1 });
  });
});
