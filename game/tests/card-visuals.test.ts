import { describe, expect, it } from "vitest";
import {
  getCardMarks,
  getCardMaterial,
  getCardModifierLines,
  getCardShine,
  getCardSurface,
  SEAL_VISUALS,
} from "../../app/components/card-visuals";
import { CARD_EFFECT_TAGS } from "../content/card-effects";
import { createStandardHwatuDeck } from "../engine/deck";
import type { CardInstance } from "../types";
import { getGeneratedAssetUrl } from "../../app/components/generated-asset";
import { getMarketHintPosition } from "../../app/components/MarketScreen";

/**
 * A card can carry four modifiers at once and packs roll doubles on purpose.
 *
 * The rule these tests defend is that the four are on four different CHANNELS —
 * material, surface, and two corner objects — so none of them can push another
 * off the card. The old design gave all four a corner token, which meant they
 * competed for the same space and the fix kept being "draw a better token".
 */

const base = createStandardHwatuDeck()[0];
const withMods = (patch: Partial<CardInstance>): CardInstance => ({ ...base, tags: [...base.tags], ...patch });

describe("card visuals", () => {
  it("gives every collection book a meaningful picture", () => {
    for (const slug of [
      "hongdan", "chodan", "cheongdan", "godori",
      "rain-three-brights", "three-brights", "four-brights", "five-brights",
    ]) {
      expect(getGeneratedAssetUrl(`book:${slug}`), slug).toBe(`/assets/generated/books/${slug}.webp`);
    }
  });

  it("keeps market explanations inside the viewport", () => {
    const leftEdge = getMarketHintPosition(
      { left: 0, right: 80, top: 300, bottom: 420, width: 80 },
      1_000,
      700,
    );
    const bottomEdge = getMarketHintPosition(
      { left: 450, right: 550, top: 570, bottom: 690, width: 100 },
      1_000,
      700,
    );

    expect(leftEdge.x).toBeGreaterThanOrEqual(172);
    expect(bottomEdge.placement).toBe("above");
    expect(bottomEdge.y).toBe(560);
  });

  it("gives a plain card nothing to show", () => {
    expect(getCardMarks(base)).toEqual([]);
    expect(getCardMaterial(base)).toBeNull();
    expect(getCardSurface(base)).toBeNull();
    expect(getCardModifierLines(base)).toEqual([]);
  });

  it("shows all four modifiers at once, each on its own channel", () => {
    const loaded = withMods({
      enhancement: "glass",
      edition: "gold_leaf",
      seal: "red",
      effectTagId: "gilded",
    });

    // 각인 is the material, 판본 is the finish. Neither may consume the other.
    expect(getCardMaterial(loaded)).toBe("glass");
    expect(getCardSurface(loaded)).toBe("gold_leaf");

    // The effect mark stays independent. The seal is rendered by its own
    // lacquer-stamp layer instead of competing for this mark slot.
    expect(getCardMarks(loaded).map((mark) => mark.id)).toEqual(["effect-gilded"]);

    // All four still reach the player in words, including the undrawn one. A
    // seal you own and cannot see anywhere at all would be worse than one that
    // is only named.
    expect(getCardModifierLines(loaded)).toHaveLength(4);
  });

  it("gives every 낙관 a distinct glyph and trigger cue", () => {
    const sealed = withMods({ seal: "purple" });
    expect(getCardMarks(sealed)).toEqual([]);
    expect(getCardModifierLines(sealed)).toEqual(["낙관 · 자인"]);
    expect(SEAL_VISUALS.purple).toEqual({ glyph: "棄", cue: "버릴 때" });
    expect(sealed.seal).toBe("purple");

    const signatures = Object.values(SEAL_VISUALS).map(({ glyph, cue }) => `${glyph}|${cue}`);
    expect(new Set(signatures).size).toBe(signatures.length);
  });

  it("never lets 각인 swallow 판본", () => {
    // This is the regression. 유리패 and 복패 used to outrank the edition for the
    // surface, so a glass card silently threw its 판본 away with nothing on
    // screen to say so.
    for (const enhancement of ["glass", "fortune", "stone", "steel"] as const) {
      const card = withMods({ enhancement, edition: "mother_of_pearl" });
      expect(getCardMaterial(card), enhancement).toBe(enhancement);
      expect(getCardSurface(card), enhancement).toBe("mother_of_pearl");
    }
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

  it("hands the foil to 무거운 달 and to nothing else", () => {
    // The foil is the loudest thing a card can do, so it is worth one effect
    // at a time. If this ever starts failing because a second tag was added,
    // that is the question to answer first: is the new one really louder than
    // +50 to the month sum? Two foils and neither one marks anything out.
    expect(getCardShine(withMods({ effectTagId: "heavy_month" }))).toBe("gilt");
    expect(getCardShine(base)).toBeNull();
    const shining = CARD_EFFECT_TAGS.filter(
      (tag) => getCardShine(withMods({ effectTagId: tag.id })) !== null,
    );
    expect(shining.map((tag) => tag.id)).toEqual(["heavy_month"]);
  });

  it("names every modifier in the hover panel", () => {
    const lines = getCardModifierLines(withMods({
      enhancement: "coin",
      edition: "engraved",
      seal: "blue",
      effectTagId: "keeper_coin",
    }));
    expect(lines).toEqual([
      "각인 · 금전패",
      "판본 · 음각",
      "낙관 · 청인",
      expect.stringContaining("곳간패"),
    ]);
  });

  it("keeps the bottom-right slot free for 낙관", () => {
    // Reserved, not unused. If an effect token ever drifts into this corner the
    // seal will land on top of it the moment someone builds it.
    const everything = CARD_EFFECT_TAGS.flatMap((tag) => getCardMarks(withMods({ effectTagId: tag.id })));
    expect(everything.some((mark) => mark.slot === "bottom-right")).toBe(false);
  });
});
