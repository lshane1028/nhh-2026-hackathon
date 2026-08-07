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
    // multiplierBonus is a FACTOR now, so 1 means the board pays nothing.
    expect(calculateCollectionBonus(brights.slice(0, 2)).multiplierBonus).toBe(1);
    expect(calculateCollectionBonus(brights.slice(0, 3)).multiplierBonus).toBe(1.6);
    expect(calculateCollectionBonus(brights.slice(0, 4)).multiplierBonus).toBe(2.2);
    expect(calculateCollectionBonus(brights).multiplierBonus).toBe(3.5);
    expect(calculateCollectionBonus([...brights, brights[0]])).toMatchObject({
      counts: { bright: 5 },
      multiplierBonus: 3.5,
    });
  });

  it("grows animal bonuses after five and adds Godori separately", () => {
    const nonBirdAnimals = cardsOf("animal").filter((card) => !card.tags.includes("bird"));
    expect(nonBirdAnimals).toHaveLength(5);
    // 동물 5장은 손패를 주지 배수를 주지 않는다. 배수는 8장부터.
    expect(calculateCollectionBonus(nonBirdAnimals).multiplierBonus).toBe(1);
    expect(calculateCollectionBonus(nonBirdAnimals).perks.handSizeBonus).toBe(1);

    const godori = [2, 4, 8].map((month) => deck.find((card) => card.month === month && card.kind === "animal" && card.tags.includes("bird"))!);
    expect(calculateCollectionBonus(godori)).toMatchObject({
      completedSets: { godori: true },
    });
  });

  it("tracks Godori as its own count while still counting the birds as animals", () => {
    const birdOf = (month: number) => deck.find((card) => card.month === month && card.kind === "animal" && card.tags.includes("bird"))!;

    const partial = calculateCollectionBonus([birdOf(2), birdOf(8)]);
    expect(partial.counts).toMatchObject({ animal: 2, godori: 2 });
    expect(partial.matchedGodoriMonths).toEqual([2, 8]);
    expect(partial.completedSets.godori).toBe(false);
    expect(partial.multiplierBonus).toBe(1);

    const full = calculateCollectionBonus([birdOf(2), birdOf(4), birdOf(8)]);
    expect(full.counts).toMatchObject({ animal: 3, godori: 3 });
    expect(full.matchedGodoriMonths).toEqual([2, 4, 8]);
    // 고도리는 배수가 아니라 규칙을 준다.
    expect(full.multiplierBonus).toBe(1);
    expect(full.perks.allowFiveMultipleJit).toBe(true);

    // The December bird is not a Godori month but still an animal.
    const december = deck.find((card) => card.month === 12 && card.tags.includes("bird"))!;
    const withDecember = calculateCollectionBonus([birdOf(2), december]);
    expect(withDecember.counts).toMatchObject({ animal: 2, godori: 1 });
  });

  it("grows ribbon bonuses and awards each traditional ribbon set", () => {
    const mixedFive = [1, 4, 6, 12, 2].map((month) => deck.find((card) => card.month === month && card.kind === "ribbon")!);
    expect(calculateCollectionBonus(mixedFive).multiplierBonus).toBe(1.4);

    const hongdan = [1, 2, 3].map((month) => deck.find((card) => card.month === month && card.ribbonGroup === "hong")!);
    expect(calculateCollectionBonus(hongdan)).toMatchObject({
      completedSets: { hongdan: true },
    });
    expect(calculateCollectionBonus(hongdan).perks.extraDiscards).toBe(1);
  });

  it("starts Pi growth at five, jumps at ten, then adds month sum", () => {
    const singlePi = cardsOf("chaff").filter((card) => card.chaffValue === 1);
    expect(calculateCollectionBonus(singlePi.slice(0, 4)).multiplierBonus).toBe(1);
    expect(calculateCollectionBonus(singlePi.slice(0, 9)).multiplierBonus).toBe(1);
    expect(calculateCollectionBonus(singlePi.slice(0, 10))).toMatchObject({ multiplierBonus: 1.5, monthSumBonus: 0 });
    const eleven = calculateCollectionBonus(singlePi.slice(0, 11));
    expect(eleven).toMatchObject({ counts: { chaff: 11 }, multiplierBonus: 1.5, monthSumBonus: 1 });
    expect(eleven.effects[0]).toMatchObject({ operation: "add_kkeut", value: 1 });
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

describe("collection perks", () => {
  const pick = (predicate: (card: CardInstance) => boolean, count: number) =>
    deck.filter(predicate).slice(0, count);

  it("pays nothing extra on an empty board", () => {
    expect(calculateCollectionBonus([]).perks).toEqual({
      goThresholdFactor: 1,
      handSizeBonus: 0,
      allowFiveMultipleJit: false,
      extraDiscards: 0,
      moneyBonus: 0,
    });
  });

  it("makes 광 cheapen the Go threshold as the row fills", () => {
    const brights = deck.filter((card) => card.kind === "bright");
    const factorAt = (count: number) =>
      calculateCollectionBonus(brights.slice(0, count)).perks.goThresholdFactor;
    expect(factorAt(2)).toBe(1);
    expect(factorAt(3)).toBeLessThan(1);
    expect(factorAt(4)).toBeLessThan(factorAt(3));
    expect(factorAt(5)).toBeLessThan(factorAt(4));
  });

  it("grows the hand once 동물 pile up", () => {
    const animals = deck.filter((card) => card.kind === "animal");
    expect(calculateCollectionBonus(animals.slice(0, 4)).perks.handSizeBonus).toBe(0);
    expect(calculateCollectionBonus(animals.slice(0, 5)).perks.handSizeBonus).toBe(1);
  });

  it("multiplies rather than adds, and pays more for the harder rows", () => {
    const factorOf = (cards: readonly CardInstance[], sourceId: string) =>
      calculateCollectionBonus(cards).effects
        .find((effect) => effect.sourceId === sourceId && effect.operation === "multiply_heung")?.value ?? 1;

    const brights = deck.filter((card) => card.kind === "bright");
    const three = factorOf(brights.slice(0, 3), "collection:bright");
    const four = factorOf(brights.slice(0, 4), "collection:bright");
    const five = factorOf(brights, "collection:bright");
    expect(three).toBeGreaterThan(1);
    expect(four).toBeGreaterThan(three);
    expect(five).toBeGreaterThan(four);

    // 5광(특정 5장)이 띠 5장(아무 띠나)보다 반드시 후하다.
    const ribbons = deck.filter((card) => card.kind === "ribbon").slice(0, 5);
    expect(five).toBeGreaterThan(factorOf(ribbons, "collection:ribbon"));

    // 배수는 더하는 게 아니라 곱해야 한다. 배수가 이미 클수록 값이 커진다.
    expect(calculateCollectionBonus(brights).effects.every(
      (effect) => effect.operation !== "add_heung",
    )).toBe(true);
  });

  it("loosens the 짓 rule for 고도리 and pays a discard per 단", () => {
    const godori = [2, 4, 8].map((month) =>
      deck.find((card) => card.month === month && card.tags.includes("bird"))!,
    );
    expect(calculateCollectionBonus(godori).perks.allowFiveMultipleJit).toBe(true);
    expect(calculateCollectionBonus(godori.slice(0, 2)).perks.allowFiveMultipleJit).toBe(false);

    const hongdan = [1, 2, 3].map((month) =>
      deck.find((card) => card.month === month && card.ribbonGroup === "hong")!,
    );
    const chodan = [4, 5, 7].map((month) =>
      deck.find((card) => card.month === month && card.ribbonGroup === "cho")!,
    );
    expect(calculateCollectionBonus(hongdan).perks.extraDiscards).toBe(1);
    expect(calculateCollectionBonus([...hongdan, ...chodan]).perks.extraDiscards).toBe(2);
  });

  it("turns 피 into 냥 only past the seventh point", () => {
    const chaff = (count: number) => pick((card) => card.kind === "chaff", count);
    expect(calculateCollectionBonus(chaff(6)).perks.moneyBonus).toBe(0);
    expect(calculateCollectionBonus(chaff(10)).perks.moneyBonus).toBeGreaterThan(0);
    // Monotonic: more 피 never pays less.
    let previous = 0;
    for (let count = 0; count <= 20; count += 1) {
      const money = calculateCollectionBonus(chaff(count)).perks.moneyBonus;
      expect(money).toBeGreaterThanOrEqual(previous);
      previous = money;
    }
  });
});
