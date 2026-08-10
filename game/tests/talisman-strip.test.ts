import { describe, expect, it } from "vitest";

import { getTalismanHintPosition } from "../../app/components/TalismanStrip";

describe("talisman strip", () => {
  it("clamps a wide hint inside the left and right viewport edges", () => {
    const left = getTalismanHintPosition(
      { left: 0, top: 80, bottom: 180, width: 72 },
      1_000,
      700,
      320,
      180,
    );
    const right = getTalismanHintPosition(
      { left: 950, top: 80, bottom: 180, width: 72 },
      1_000,
      700,
      320,
      180,
    );

    expect(left.left - 160).toBeGreaterThanOrEqual(12);
    expect(right.left + 160).toBeLessThanOrEqual(988);
  });

  it("places a measured hint above a talisman near the bottom edge", () => {
    const position = getTalismanHintPosition(
      { left: 450, top: 570, bottom: 690, width: 100 },
      1_000,
      700,
      288,
      210,
    );

    expect(position.placement).toBe("above");
    expect(position.top).toBe(350);
    expect(position.top + 210).toBeLessThanOrEqual(560);
  });

  it("keeps an over-tall mobile hint pinned within the safe margin", () => {
    const position = getTalismanHintPosition(
      { left: 20, top: 260, bottom: 340, width: 56 },
      360,
      420,
      320,
      600,
    );

    expect(position.left).toBe(172);
    expect(position.top).toBe(12);
  });
});
