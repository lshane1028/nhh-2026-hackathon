import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { RunIdentityStrip } from "../../app/components/RunIdentityStrip";
import { createInitialGameState } from "../state/game";
import { getRunIdentityTags } from "../state/run-identity";

describe("run identity summary", () => {
  it("falls back to the chosen starting deck before upgrades define a build", () => {
    const state = { ...createInitialGameState(), startDeckId: "deck_standard" };
    expect(getRunIdentityTags(state)).toEqual([expect.objectContaining({ label: "정석패" })]);
  });

  it("ranks actual book and talisman synergies without changing game state", () => {
    const state = createInitialGameState();
    state.yakuLevels.three_brights = { level: 3, mastery: 0 };
    state.talismans = [
      { instanceId: "bright", definitionId: "t_bright_hoard", growth: 0 },
      { instanceId: "bird", definitionId: "t_magpie_echo", growth: 0 },
    ];

    const before = JSON.stringify(state);
    const tags = getRunIdentityTags(state);
    expect(tags[0]).toMatchObject({ id: "bright", label: "광 수집" });
    expect(tags.some((tag) => tag.id === "bird")).toBe(true);
    expect(JSON.stringify(state)).toBe(before);
  });

  it("renders concise accessible build tags", () => {
    const html = renderToStaticMarkup(createElement(RunIdentityStrip, {
      tags: [{ id: "bright", label: "광 수집", detail: "광 수집 비결과 광 연계", strength: 4 }],
    }));
    expect(html).toContain('aria-label="이번 덱의 강점"');
    expect(html).toContain("광 수집");
    expect(html).toContain("광 수집 비결과 광 연계");
  });
});
