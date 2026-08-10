import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { getFloatingHintPosition } from "../../app/components/tooltip-position";

describe("global tooltip layer", () => {
  it("clamps the measured panel inside every viewport edge", () => {
    const topRight = getFloatingHintPosition(
      { left: 940, top: 20, bottom: 140, width: 80 },
      1_000,
      700,
      360,
      420,
    );
    const overTall = getFloatingHintPosition(
      { left: 20, top: 250, bottom: 330, width: 60 },
      360,
      420,
      340,
      900,
    );

    expect(topRight.left + 180).toBeLessThanOrEqual(988);
    expect(topRight.top).toBeGreaterThanOrEqual(12);
    expect(topRight.top + 420).toBeLessThanOrEqual(688);
    expect(overTall.left - 168).toBeGreaterThanOrEqual(12);
    expect(overTall.top).toBe(12);
  });

  it("renders card, market, and talisman explanations through body portals", () => {
    const root = process.cwd();
    const hwatu = readFileSync(join(root, "app", "components", "HwatuCard.tsx"), "utf8");
    const market = readFileSync(join(root, "app", "components", "MarketScreen.tsx"), "utf8");
    const talisman = readFileSync(join(root, "app", "components", "TalismanStrip.tsx"), "utf8");
    const css = readFileSync(join(root, "app", "components", "pixel-direction.css"), "utf8");

    expect(hwatu).toContain("createPortal(");
    expect(hwatu).toContain("hwatu-card__hint--portal");
    expect(market.match(/createPortal\(/g)).toHaveLength(2);
    expect(talisman).toContain("talisman-strip__hint--portal");
    expect(css).toMatch(/\.hwatu-card__hint--portal,[\s\S]*\.talisman-strip__hint--portal[\s\S]*z-index: 2147483000/);
  });
});
