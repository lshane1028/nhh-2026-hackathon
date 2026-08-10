import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

describe("talisman tooltip frame", () => {
  it("does not clip the hover explanation outside the strip", () => {
    const cssPath = fileURLToPath(new URL("../../app/components/pixel-direction.css", import.meta.url));
    const css = readFileSync(cssPath, "utf8");
    const rules = [...css.matchAll(/\.play-board__top \.talisman-strip\s*\{([^}]*)\}/g)]
      .map((match) => match[1]);

    expect(rules.some((rule) => (
      /overflow:\s*visible\s*!important/.test(rule)
      && /clip-path:\s*none\s*!important/.test(rule)
    ))).toBe(true);
  });
});
