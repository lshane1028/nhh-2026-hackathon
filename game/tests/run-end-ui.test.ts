import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { RunEndScreen } from "../../app/components/RunEndScreen";
import { createInitialGameState } from "../state/game";

describe("run ending record", () => {
  it("shows the best hand and owned yakus without obsolete Go success/failure stats", () => {
    const initial = createInitialGameState("RUN-END-RECORD");
    const bestCards = initial.deck.slice(0, 2);
    const html = renderToStaticMarkup(createElement(RunEndScreen, {
      assetTag: "ui:test-run-end",
      result: "win",
      stageLabel: "12월 결산",
      finalScore: 12_345,
      targetScore: 10_000,
      money: 42,
      seed: "RUN-END-RECORD",
      stats: {
        ...initial.stats,
        highestHand: 777,
        highestHandYakuId: "ddaeng",
        highestHandCards: bestCards,
        highestSubmissionCards: 5,
      },
      yakuStats: [
        { yakuId: "ddaeng", name: "땡", count: 3, assetTag: "yaku:ddaeng" },
      ],
      ownedYakus: [
        { yakuId: "ddaeng", name: "땡", level: 2, assetTag: "yaku:ddaeng" },
      ],
      ownedTalismans: [
        {
          instanceId: "owned:first-charm",
          name: "첫 부적",
          description: "첫 제출의 배수를 높입니다.",
          assetTag: "talisman:first-charm",
          growth: 3,
        },
      ],
      usedForbiddens: [
        {
          definitionId: "f_bright_descent",
          name: "광내림",
          description: "카드 한 장을 광으로 바꿉니다.",
          assetTag: "forbidden:bright-descent",
          count: 2,
        },
      ],
      buildTags: [
        { id: "bright", label: "광 수집", detail: "광 수집 비결과 광 연계", strength: 4 },
      ],
      onRestart: () => undefined,
    }));

    expect(html).toContain("가장 높았던 손패");
    expect(html).toContain("777");
    expect(html).toContain("최다 제출");
    expect(html).toContain("5장");
    expect(html).toContain("보유했던 족보");
    expect(html).toContain("Lv.2");
    expect(html).toContain("보유했던 부적");
    expect(html).toContain("성장 +3");
    expect(html).toContain("사용한 금단서");
    expect(html).toContain("2회 사용");
    expect(html).toContain("완성한 덱의 방향");
    expect(html).toContain("광 수집");
    for (const card of bestCards) expect(html).toContain(card.instanceId);
    expect(html).not.toContain("고 성공");
    expect(html).not.toContain("고 실패");
    expect(html).not.toContain("고 성공률");
    expect(html).not.toContain("고 도전");
  });
});
