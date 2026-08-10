import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { HwatuCard } from "../../app/components/HwatuCard";
import { TalismanStrip } from "../../app/components/TalismanStrip";
import { getCardArtUrl } from "../../app/components/hwatu-atlas";
import { getGeneratedAssetUrl } from "../../app/components/generated-asset";
import { TALISMANS } from "../content/talismans";
import { createStandardHwatuDeck } from "../engine/deck";

const publicFile = (url: string) => join(process.cwd(), "public", url.replace(/^\//, ""));

describe("uncropped card art", () => {
  it("ships an individual 2:3 image for every card, including 11월 and 12월", () => {
    const deck = createStandardHwatuDeck();

    for (const card of deck) {
      const url = getCardArtUrl(card);
      expect(url, card.assetTag).toBe(`/assets/cards/hwatu/${card.assetTag}.webp`);
      expect(existsSync(publicFile(url)), card.assetTag).toBe(true);
    }

    for (const card of deck.filter(({ month }) => month >= 11)) {
      const html = renderToStaticMarkup(createElement(HwatuCard, { card }));
      expect(html, card.assetTag).toContain(`class="hwatu-card__art card-art-frame"`);
      expect(html, card.assetTag).toContain(`src="${getCardArtUrl(card)}"`);
      expect(html, card.assetTag).toContain(`draggable="false"`);
    }
  });

  it("renders every talisman as a real image instead of a cropped cover background", () => {
    for (const definition of TALISMANS) {
      const url = getGeneratedAssetUrl(definition.assetTag);
      expect(url, definition.assetTag).not.toBeNull();
      expect(existsSync(publicFile(url!)), definition.assetTag).toBe(true);
    }

    const definition = TALISMANS[0];
    const html = renderToStaticMarkup(createElement(TalismanStrip, {
      assetTag: "ui:test-talismans",
      items: [{
        definition,
        instance: { instanceId: "test-talisman", definitionId: definition.id, growth: 0 },
      }],
      slots: 1,
    }));

    expect(html).toContain(`class="talisman-strip__art talisman-strip__art--generated"`);
    expect(html).toContain(`src="${getGeneratedAssetUrl(definition.assetTag)}"`);
  });

  it("locks card and talisman pictures to contain sizing", () => {
    const css = [
      readFileSync(join(process.cwd(), "app/components/game-ui.css"), "utf8"),
      readFileSync(join(process.cwd(), "app/components/art-direction.css"), "utf8"),
    ].join("\n");

    expect(css).toMatch(/\.hwatu-card__art\s*\{[^}]*object-fit:\s*contain/);
    expect(css).toMatch(/\.collection-card__art\s*\{[^}]*object-fit:\s*contain/);
    expect(css).toMatch(/\.talisman-strip__art\s*>\s*img\s*\{[^}]*object-fit:\s*contain/);
    expect(css).toMatch(/\.talisman-strip__hint-art\s*\{[^}]*object-fit:\s*contain/);
    expect(css).toMatch(/\.card-art-frame\s*\{[^}]*padding:\s*2px/);
    expect(css).toMatch(/\.talisman-strip__art--generated\s*\{[^}]*padding:\s*0\.12rem/);
  });
});
