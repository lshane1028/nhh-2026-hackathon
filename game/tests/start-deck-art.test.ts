import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { START_DECKS } from "../content/meta";

const DECK_ART_SLUGS = ["standard", "red", "blue", "black", "money"] as const;

describe("starter deck backs", () => {
  it("ships one distinct 2:3 art file for every unlock deck", () => {
    expect(START_DECKS.map((deck) => deck.unlockStage)).toEqual([0, 3, 6, 9, 12]);

    for (const slug of DECK_ART_SLUGS) {
      expect(existsSync(join(
        process.cwd(),
        "public",
        "assets",
        "generated",
        "start-decks",
        `${slug}.webp`,
      )), slug).toBe(true);
    }
  });

  it("never restores the red deck's radial-ray fallback", () => {
    const css = readFileSync(join(process.cwd(), "app", "components", "screen-ui.css"), "utf8");
    const rule = css.match(/\.title-screen__deck\[data-deck-id="deck_red"\][\s\S]*?\n\}/)?.[0] ?? "";

    expect(rule).not.toContain("conic-gradient");
    expect(rule).not.toContain("radial-gradient");
    expect(rule).toContain("linear-gradient");
  });
});
