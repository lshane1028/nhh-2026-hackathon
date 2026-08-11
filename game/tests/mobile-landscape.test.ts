import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

describe("mobile landscape layout", () => {
  const css = readFileSync(join(root, "app", "components", "pixel-direction.css"), "utf8");
  const landscapeStart = css.indexOf("@media (orientation: landscape) and (max-height: 620px)");
  const compactStart = css.indexOf("@media (orientation: landscape) and (max-height: 420px)");
  const landscape = css.slice(landscapeStart, compactStart);

  it("overrides the short-screen single-column fallback with a stable three-rail table", () => {
    expect(landscapeStart).toBeGreaterThan(-1);
    expect(compactStart).toBeGreaterThan(landscapeStart);
    expect(landscape).toContain("height: 100svh !important");
    expect(landscape).toContain("grid-template-columns:");
    expect(landscape).toContain("minmax(0, 1fr)");
    expect(landscape).toContain("grid-template-rows: minmax(0, 1fr) !important");
    expect(landscape).toContain(".play-shell > .play-side { order: 1; }");
    expect(landscape).toContain(".play-shell > .play-board { order: 2; }");
    expect(landscape).toContain(".play-shell > .play-rail { order: 3; }");
  });

  it("keeps the hand, collection tracks, and all touch actions inside one viewport", () => {
    expect(landscape).toContain("flex-wrap: nowrap !important");
    expect(landscape).toContain("grid-template-rows: repeat(5, minmax(0, 1fr))");
    expect(landscape).toContain(".hand-actions > button");
    expect(landscape).toContain(".play-rail__resources { grid-template-columns: repeat(4");
    expect(landscape).toContain("env(safe-area-inset-left)");
    expect(landscape).toContain("env(safe-area-inset-right)");
  });

  it("uses visual-viewport bounds for shops, modals, month openings, and theaters", () => {
    expect(landscape).toContain(".market-shell");
    expect(landscape).toContain(".game-modal__backdrop");
    expect(landscape).toContain("max-height: calc(100svh - 0.5rem) !important");
    expect(landscape).toContain(".card-theater__stage");
    expect(landscape).toContain(".game-root > .intro-screen.intro-screen--ritual");
  });

  it("resizes the boss canvas when mobile browser chrome or orientation changes", () => {
    const source = readFileSync(join(root, "app", "components", "BossSeasonOverlay.tsx"), "utf8");
    expect(source).toContain('window.visualViewport?.addEventListener("resize", scheduleResize)');
    expect(source).toContain('window.visualViewport?.removeEventListener("resize", scheduleResize)');
    expect(source).toContain("window.cancelAnimationFrame(resizeFrameId)");
  });
});
