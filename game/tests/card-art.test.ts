import { existsSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  getCardArtUrl,
  getCardArtSources,
  HWATU_ATLAS_URL,
} from "../../app/components/hwatu-atlas";
import { createStandardHwatuDeck } from "../engine/deck";

function publicAssetPath(url: string): string {
  return fileURLToPath(new URL(`../../public${url}`, import.meta.url));
}

describe("hwatu card art delivery", () => {
  it("ships a WebP crop for every one of the 48 cards", () => {
    const deck = createStandardHwatuDeck();
    expect(deck).toHaveLength(48);

    deck.forEach((card) => {
      const url = getCardArtUrl(card);
      const path = publicAssetPath(url);
      expect(existsSync(path), `${url} should exist`).toBe(true);
      expect(statSync(path).size, `${url} should not be empty`).toBeGreaterThan(1_000);
    });
  });

  it("retains the complete atlas as the final fallback", () => {
    const card = createStandardHwatuDeck()[0];
    const sources = getCardArtSources(card);

    expect(sources.primaryUrl).toBe(getCardArtUrl(card));
    expect(sources.atlasUrl).toBe(HWATU_ATLAS_URL);
    expect(existsSync(publicAssetPath(HWATU_ATLAS_URL))).toBe(true);
  });

  it("keeps the fallback tied to the printed face after month and kind rewrites", () => {
    const deck = createStandardHwatuDeck();
    deck.forEach((card) => {
      const before = getCardArtSources(card).atlasPosition;
      for (let month = 1; month <= 12; month += 1) {
        const after = getCardArtSources({
          ...card,
          month,
          kind: card.kind === "bright" ? "chaff" : "bright",
          chaffValue: 0,
        }).atlasPosition;
        expect(after).toBe(before);
      }
    });
  });
});
