import { describe, expect, it } from "vitest";
import { createStandardHwatuDeck } from "../engine/deck";
import { calculateCollectionBonus } from "../engine/collection-bonus";

const deck = createStandardHwatuDeck();
const pick = (predicate: (card: (typeof deck)[number]) => boolean) => deck.filter(predicate);

describe("Go-Stop collection scoring", () => {
  it("uses 3/4/15 bright scoring and rain-three-bright scoring", () => {
    const brights = pick((card) => card.kind === "bright");
    expect(calculateCollectionBonus(brights.filter((card) => card.month !== 12).slice(0, 3)).goStopPoints).toBe(3);
    expect(calculateCollectionBonus(brights.slice(0, 4)).goStopPoints).toBe(4);
    expect(calculateCollectionBonus(brights).goStopPoints).toBe(15);
    const rainThree = [brights.find((card) => card.month === 12)!, ...brights.filter((card) => card.month !== 12).slice(0, 2)];
    expect(calculateCollectionBonus(rainThree).goStopPoints).toBe(2);
  });

  it("scores animals, ribbons and pi from their real thresholds", () => {
    const animals = [
      ...pick((card) => card.kind === "animal" && !card.tags.includes("bird")),
      pick((card) => card.kind === "animal" && card.tags.includes("bird"))[0],
    ];
    expect(calculateCollectionBonus(animals.slice(0, 4)).goStopPoints).toBe(0);
    expect(calculateCollectionBonus(animals.slice(0, 5)).goStopPoints).toBe(1);
    expect(calculateCollectionBonus(animals.slice(0, 6)).goStopPoints).toBe(2);
    const ribbons = pick((card) => card.kind === "ribbon");
    expect(calculateCollectionBonus(ribbons.slice(0, 5)).goStopPoints).toBeGreaterThanOrEqual(1);
    const chaff = pick((card) => card.kind === "chaff" && card.chaffValue === 1);
    expect(calculateCollectionBonus(chaff.slice(0, 9)).goStopPoints).toBe(0);
    expect(calculateCollectionBonus(chaff.slice(0, 10)).goStopPoints).toBe(1);
    expect(calculateCollectionBonus(chaff.slice(0, 11)).goStopPoints).toBe(2);
  });

  it("adds five points for Godori and three per ribbon set", () => {
    const godori = [2, 4, 8].map((month) => deck.find((card) => card.month === month && card.tags.includes("bird"))!);
    expect(calculateCollectionBonus(godori)).toMatchObject({ goStopPoints: 5, completedSets: { godori: true } });
    const hongdan = [1, 2, 3].map((month) => deck.find((card) => card.month === month && card.ribbonGroup === "hong")!);
    expect(calculateCollectionBonus(hongdan)).toMatchObject({ goStopPoints: 3, completedSets: { hongdan: true } });
  });

  it("keeps special perks locked until a collection book was purchased", () => {
    const godori = [2, 4, 8].map((month) => deck.find((card) => card.month === month && card.tags.includes("bird"))!);
    expect(calculateCollectionBonus(godori).perks.allowFiveMultipleJit).toBe(false);
    const upgraded = calculateCollectionBonus(godori, "animal", { godori: { level: 2, mastery: 0 } });
    expect(upgraded.perks.allowFiveMultipleJit).toBe(true);
    expect(upgraded.goStopPoints).toBe(6);
  });

  it("uses each September cup role and deduplicates instances", () => {
    const cup = deck.find((card) => card.tags.includes("cup"))!;
    expect(calculateCollectionBonus([cup], "animal").counts).toMatchObject({ animal: 1, chaff: 0 });
    expect(calculateCollectionBonus([cup], "double_chaff").counts).toMatchObject({ animal: 0, chaff: 2 });
    expect(calculateCollectionBonus([cup, cup], "animal").counts.animal).toBe(1);
  });
});
