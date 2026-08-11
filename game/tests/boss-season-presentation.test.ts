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

  it("renders one canvas layer instead of dozens of animated DOM nodes", () => {
    const seasons = ["spring", "summer", "autumn", "winter"] as const;
    for (const season of seasons) {
      const markup = renderToStaticMarkup(
        createElement(BossSeasonOverlay, { season }),
      );
      expect(markup).toContain(`data-season="${season}"`);
      expect(markup).toContain('aria-hidden="true"');
      expect(markup).toContain("boss-season-fx__canvas");
      expect(markup).not.toContain("boss-season-fx__particle");
    }
  });

  it("ships canvas atmosphere and reduced-motion styles for every season", () => {
    const cssPath = fileURLToPath(new URL("../../app/game.css", import.meta.url));
    const css = readFileSync(cssPath, "utf8");
    for (const season of ["spring", "summer", "autumn", "winter"]) {
      expect(css).toContain(`.boss-season-fx--${season}`);
    }
    expect(css).toContain(".boss-season-fx__canvas");
    expect(css).toContain("mix-blend-mode: screen");
    expect(css).not.toContain("boss-season-fx__particle");
    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
  });

  it("drives the canvas with one animation frame loop and an anime.js scene timeline", () => {
    const componentPath = fileURLToPath(new URL("../../app/components/BossSeasonOverlay.tsx", import.meta.url));
    const source = readFileSync(componentPath, "utf8");

    expect(source).toContain('from "animejs/timeline"');
    expect(source).toContain("createTimeline({ loop: true");
    expect(source).toContain("window.requestAnimationFrame(draw)");
    expect(source).toContain("Math.min(window.devicePixelRatio || 1, 1.5)");
    expect(source).toContain("timeline.revert()");
  });

  it("keeps the absolute submission theater out of the boss layer stacking rule", () => {
    const gameCssPath = fileURLToPath(new URL("../../app/game.css", import.meta.url));
    const theaterCssPath = fileURLToPath(new URL("../../app/components/pixel-direction.css", import.meta.url));
    const gameCss = readFileSync(gameCssPath, "utf8");
    const theaterCss = readFileSync(theaterCssPath, "utf8");

    expect(gameCss).toContain(":not(.boss-season-fx, .card-theater)");
    expect(theaterCss).toMatch(/\.card-theater\s*\{[^}]*position:\s*absolute/);
  });
});
