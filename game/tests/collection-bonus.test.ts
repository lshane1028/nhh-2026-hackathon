import { describe, expect, it } from "vitest";
import { createStandardHwatuDeck } from "../engine/deck";
import { calculateCollectionBonus, calculateCupRolePreview } from "../engine/collection-bonus";

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

  it("continues beyond five brights and three Godori birds", () => {
    const brights = pick((card) => card.kind === "bright");
    const extraBright = { ...brights[0], instanceId: "extra-bright", tags: [...brights[0].tags] };
    expect(calculateCollectionBonus([...brights, extraBright]).scoreLines)
      .toContainEqual(expect.objectContaining({ id: "six_brights", label: "육광", points: 22 }));

    const godori = [2, 4, 8].map((month) => deck.find((card) => card.month === month && card.tags.includes("bird"))!);
    const fourth = { ...godori[0], instanceId: "fourth-bird", tags: [...godori[0].tags] };
    const fifth = { ...godori[1], instanceId: "fifth-bird", tags: [...godori[1].tags] };
    expect(calculateCollectionBonus([...godori, fourth]).scoreLines)
      .toContainEqual(expect.objectContaining({ id: "four_godori", label: "새떼", points: 8 }));
    expect(calculateCollectionBonus([...godori, fourth, fifth]).scoreLines)
      .toContainEqual(expect.objectContaining({ id: "five_godori", label: "큰 새떼", points: 12 }));
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

  it("previews the cup against counts that do not already include it", () => {
    const cup = deck.find((card) => card.tags.includes("cup"))!;
    const animals = pick((card) => card.kind === "animal" && card.instanceId !== cup.instanceId).slice(0, 3);
    const chaff = pick((card) => card.kind === "chaff" && card.chaffValue === 1).slice(0, 7);
    // The live chain already contains the submitted cup while the role modal is open.
    const preview = calculateCupRolePreview([...animals, ...chaff, cup], cup);

    expect(preview.current).toEqual({ animal: 3, chaff: 7 });
    expect(preview.animal).toEqual({ animal: 4, chaff: 7 });
    expect(preview.doubleChaff).toEqual({ animal: 3, chaff: 9 });
  });
});
