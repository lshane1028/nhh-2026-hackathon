import { describe, expect, it } from "vitest";

import { getStageDefinition } from "../content/stages";

describe("infinite calendar variations", () => {
  it("keeps stage variations deterministic and scales the target", () => {
    const first = getStageDefinition(2, 1);
    const repeated = getStageDefinition(2, 1);
    expect(repeated).toEqual(first);
    expect(first.target).toBe(Math.floor(280 * 1.6));
    expect(first.subtitle).toContain("떠돌이 두목");
    expect(first.bossId).not.toBeNull();
  });

  it("preserves canonical boss rules while rotating infinite weather", () => {
    const base = getStageDefinition(3, 0);
    const infinite = getStageDefinition(3, 1);
    expect(infinite.bossId).toBe(base.bossId);
    expect(infinite.weatherId).not.toBe(base.weatherId);
    expect(infinite.subtitle).toContain("날씨 변주");
  });

  it("does not add variations to the original twelve months", () => {
    expect(getStageDefinition(2, 0)).toMatchObject({ bossId: null, weatherId: "wind", target: 280 });
  });
});
