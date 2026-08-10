import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  BossSeasonOverlay,
  getBossSeasonForMonth,
} from "../../app/components/BossSeasonOverlay";

describe("seasonal boss presentation", () => {
  it("maps only the four boss months to their seasonal board layers", () => {
    expect(getBossSeasonForMonth(3)).toBe("spring");
    expect(getBossSeasonForMonth(6)).toBe("summer");
    expect(getBossSeasonForMonth(9)).toBe("autumn");
    expect(getBossSeasonForMonth(12)).toBe("winter");
    expect(getBossSeasonForMonth(4)).toBeNull();
    expect(getBossSeasonForMonth(3, false)).toBeNull();
  });

  it("renders denser decorative particles without changing the felt", () => {
    const expectedCounts = { spring: 45, summer: 54, autumn: 39, winter: 54 } as const;
    for (const [season, count] of Object.entries(expectedCounts)) {
      const markup = renderToStaticMarkup(
        createElement(BossSeasonOverlay, { season: season as keyof typeof expectedCounts }),
      );
      expect(markup).toContain(`data-season="${season}"`);
      expect(markup).toContain('aria-hidden="true"');
      expect(markup.match(/boss-season-fx__particle/g)).toHaveLength(count);
    }
  });

  it("ships motion and reduced-motion styles for every season", () => {
    const cssPath = fileURLToPath(new URL("../../app/game.css", import.meta.url));
    const css = readFileSync(cssPath, "utf8");
    for (const season of ["spring", "summer", "autumn", "winter"]) {
      expect(css).toContain(`.boss-season-fx--${season}`);
    }
    expect(css).toContain("@keyframes boss-petal-fall");
    expect(css).toContain("@keyframes boss-rain-fall");
    expect(css).toContain("width: 3px");
    expect(css).toContain("128vh");
    expect(css).toContain("@keyframes boss-leaf-fall");
    expect(css).toContain("@keyframes boss-snow-fall");
    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
  });
});
