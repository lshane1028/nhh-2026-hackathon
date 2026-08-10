import { describe, expect, it } from "vitest";

import { createInitialGameState } from "../state/game";
import { normalizeGameState } from "../state/storage";

describe("saved game normalization", () => {
  it("removes legacy same-kind effects from every place cards can be stored", () => {
    const base = createInitialGameState("LEGACY-SAME-KIND");
    const bright = { ...base.deck.find((card) => card.kind === "bright")!, effectTagId: "as_bright" };
    const animal = { ...base.deck.find((card) => card.kind === "animal")!, effectTagId: "as_animal" };
    const ribbon = { ...base.deck.find((card) => card.kind === "ribbon")!, effectTagId: "as_ribbon" };
    const valid = { ...base.deck.find((card) => card.kind === "chaff")!, effectTagId: "as_animal" };

    const normalized = normalizeGameState({
      ...base,
      deck: [bright, valid],
      hand: [animal],
      drawPile: [ribbon],
      usedPile: [bright],
      yard: { cards: [animal], sweptCount: 1 },
      pendingPack: {
        packId: "legacy-pack",
        name: "옛 꾸러미",
        picksLeft: 1,
        candidates: [ribbon, valid],
      },
    });

    expect(normalized.deck[0].effectTagId).toBeUndefined();
    expect(normalized.hand[0].effectTagId).toBeUndefined();
    expect(normalized.drawPile[0].effectTagId).toBeUndefined();
    expect(normalized.usedPile[0].effectTagId).toBeUndefined();
    expect(normalized.yard.cards).toEqual([]);
    expect(normalized.pendingPack?.candidates[0].effectTagId).toBeUndefined();
    expect(normalized.deck[1].effectTagId).toBe("as_animal");
    expect(normalized.pendingPack?.candidates[1].effectTagId).toBe("as_animal");
  });

  it("removes the retired zero-base penalty from an existing 팔방패 save", () => {
    const base = createInitialGameState("LEGACY-EIGHT-DIRECTIONS");
    const card = { ...base.deck.find((entry) => entry.month === 8)!, enhancement: "wild" as const, tags: ["zero_base"] };
    const normalized = normalizeGameState({
      ...base,
      deck: [card],
      hand: [card],
      drawPile: [card],
      usedPile: [card],
    });

    expect(normalized.deck[0].tags).not.toContain("zero_base");
    expect(normalized.hand[0].tags).not.toContain("zero_base");
    expect(normalized.drawPile[0].tags).not.toContain("zero_base");
    expect(normalized.usedPile[0].tags).not.toContain("zero_base");
  });

  it("removes the two deferred talismans from existing saves", () => {
    const base = createInitialGameState("RETIRED-TALISMANS");
    const normalized = normalizeGameState({
      ...base,
      talismans: [
        { instanceId: "painter", definitionId: "t_twelve_month_painter", growth: 0 },
        { instanceId: "goblin", definitionId: "t_five_direction_goblin", growth: 0 },
        { instanceId: "keeper", definitionId: "t_first_charm", growth: 0 },
      ],
    });

    expect(normalized.talismans.map((item) => item.definitionId)).toEqual(["t_first_charm"]);
  });
});
