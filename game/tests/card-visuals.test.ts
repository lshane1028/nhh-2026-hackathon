import { describe, expect, it } from "vitest";
import { getCardMarks, getCardModifierLines, getCardSurface } from "../../app/components/card-visuals";
import { CARD_EFFECT_TAGS } from "../content/card-effects";
import { createStandardHwatuDeck } from "../engine/deck";
import type { CardInstance } from "../types";

/**
 * A card can carry four modifiers at once and packs roll doubles on purpose,
 * so the rule these tests defend is: every modifier gets its own object on the
 * card, and only one may own the surface.
 */

const base = createStandardHwatuDeck()[0];
const withMods = (patch: Partial<CardInstance>): CardInstance => ({ ...base, tags: [...base.tags], ...patch });

describe("card visuals", () => {
  it("gives a plain card nothing to show", () => {
    expect(getCardMarks(base)).toEqual([]);
    expect(getCardSurface(base)).toBeNull();
    expect(getCardModifierLines(base)).toEqual([]);
  });

  it("gives every modifier its own mark, in its own corner", () => {
    const loaded = withMods({
      enhancement: "coin",
      edition: "gold_leaf",
      seal: "red",
      effectTagId: "gilded",
    });
    const marks = getCardMarks(loaded);
    expect(marks).toHaveLength(4);

    // Separated on three axes at once, because any single axis fails somewhere:
    // two circles differ only by colour on a red card, two red things differ
    // only by shape at 14px. All four must be distinct on every axis.
    expect(new Set(marks.map((mark) => mark.slot)).size).toBe(4);
    expect(new Set(marks.map((mark) => mark.id)).size).toBe(4);
    expect(new Set(marks.map((mark) => `${mark.sprite}|${mark.fill}`)).size).toBe(4);

    // 엽전 is drawn as an actual coin — the one shape nobody misreads.
    expect(marks.find((mark) => mark.id === "enhancement-coin")?.sprite).toBe("coin");
  });

  it("keeps every effect tag visually distinct from every other", () => {
    const seen = new Map<string, string>();
    for (const tag of CARD_EFFECT_TAGS) {
      const mark = getCardMarks(withMods({ effectTagId: tag.id }))[0];
      expect(mark, `${tag.id} has no mark`).toBeTruthy();
      const signature = `${mark.sprite}|${mark.fill}`;
      expect(seen.has(signature), `${tag.id} looks identical to ${seen.get(signature)}`).toBe(false);
      seen.set(signature, tag.id);
    }
  });

  it("never lets two surfaces fight, and keeps the unstable one on top", () => {
    // 복패 is defined by being unstable, so its glitch has to survive being
    // gilded. 유리패 is a fact about the card, so it beats mere decoration.
    expect(getCardSurface(withMods({ enhancement: "fortune", edition: "gold_leaf" }))).toBe("glitch");
    expect(getCardSurface(withMods({ enhancement: "glass", edition: "gold_leaf" }))).toBe("glass");
    expect(getCardSurface(withMods({ edition: "mother_of_pearl" }))).toBe("holo");
    expect(getCardSurface(withMods({ enhancement: "inked" }))).toBeNull();
  });

  it("lists one hover line per modifier", () => {
    const lines = getCardModifierLines(withMods({
      enhancement: "coin",
      seal: "blue",
      effectTagId: "keeper_coin",
    }));
    expect(lines).toHaveLength(3);
    expect(lines.some((line) => line.includes("곳간패"))).toBe(true);
  });
});
