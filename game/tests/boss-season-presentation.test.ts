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

  it("renders decorative, non-interactive particles without changing the felt", () => {
    const markup = renderToStaticMarkup(createElement(BossSeasonOverlay, { season: "spring" }));
    expect(markup).toContain('data-season="spring"');
    expect(markup).toContain('aria-hidden="true"');
    expect(markup.match(/boss-season-fx__particle/g)).toHaveLength(30);
  });

  it("ships motion and reduced-motion styles for every season", () => {
    const cssPath = fileURLToPath(new URL("../../app/game.css", import.meta.url));
    const css = readFileSync(cssPath, "utf8");
    for (const season of ["spring", "summer", "autumn", "winter"]) {
      expect(css).toContain(`.boss-season-fx--${season}`);
    }
    expect(css).toContain("@keyframes boss-petal-fall");
    expect(css).toContain("@keyframes boss-rain-fall");
    expect(css).toContain("@keyframes boss-leaf-fall");
    expect(css).toContain("@keyframes boss-snow-fall");
    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
  });
});
