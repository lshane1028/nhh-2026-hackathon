import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { PlayRail } from "../../app/components/PlayRail";

describe("persistent boss rule guide", () => {
  it("keeps the boss rule and counterplay available during play", () => {
    const html = renderToStaticMarkup(createElement(PlayRail, {
      assetTag: "rail",
      stageAssetTag: "stage",
      stageLabel: "3월",
      bossLabel: "봄 두목",
      bossDescription: "고를 한 번 성공해야 합니다.",
      bossCounterplay: "점수를 남겨 두고 고를 선언하세요.",
      targetScore: 450,
      roundScore: 0,
      goCount: 0,
      formulaCaption: "패를 고르세요",
      handsRemaining: 4,
      discardsRemaining: 3,
      money: 4,
      stageIndex: 3,
      stageTotal: 12,
    }));

    expect(html).toContain("이번 판 두목 규칙");
    expect(html).toContain("고를 한 번 성공해야 합니다.");
    expect(html).toContain("대응 · 점수를 남겨 두고 고를 선언하세요.");
  });
});
