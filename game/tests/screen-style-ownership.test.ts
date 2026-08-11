import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (...parts: string[]) => readFileSync(join(root, ...parts), "utf8");

describe("screen stylesheet ownership", () => {
  it("loads each screen stylesheet from its owning component", () => {
    expect(read("app", "components", "TitleScreen.tsx")).toContain('import "./title-screen.css"');
    expect(read("app", "components", "MarketScreen.tsx")).toContain('import "./market-screen.css"');
    expect(read("app", "components", "RunEndScreen.tsx")).toContain('import "./run-end-screen.css"');
  });

  it("keeps screen-specific layout out of the shared stylesheets", () => {
    const common = read("app", "components", "screen-ui.css");
    const game = read("app", "game.css");
    expect(common).not.toContain(".title-screen__hero {");
    expect(common).not.toContain(".run-end-screen__hero {");
    expect(game).not.toContain(".title-root {");
    expect(game).not.toContain(".market-shell {");
  });

  it("keeps every extracted stylesheet under an explicit growth budget", () => {
    const budget = read("assets", "style-budget.json");
    expect(budget).toContain('"app/components/title-screen.css"');
    expect(budget).toContain('"app/components/market-screen.css"');
    expect(budget).toContain('"app/components/run-end-screen.css"');
  });
});
