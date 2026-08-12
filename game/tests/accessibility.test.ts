import axe from "axe-core";
import { JSDOM } from "jsdom";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { GameModal } from "../../app/components/GameModal";
import { MarketScreen } from "../../app/components/MarketScreen";
import { RunEndScreen } from "../../app/components/RunEndScreen";
import { createInitialGameState } from "../state/game";

interface AxeRuntimeWindow extends Window {
  axe: typeof axe;
}

async function seriousViolations(markup: string) {
  const dom = new JSDOM(
    `<!doctype html><html lang="ko"><head><title>경화수월 접근성 검사</title></head><body>${markup}</body></html>`,
    { runScripts: "outside-only", url: "https://example.test/" },
  );
  dom.window.eval(axe.source);
  const runtime = dom.window as unknown as AxeRuntimeWindow;
  const result = await runtime.axe.run(dom.window.document, {
    // JSDOM has no layout or painted pixels, so contrast belongs to browser
    // visual QA. All semantic serious/critical rules remain enabled here.
    rules: { "color-contrast": { enabled: false } },
  });
  dom.window.close();
  return result.violations.filter((violation) => (
    violation.impact === "serious" || violation.impact === "critical"
  ));
}

describe("axe accessibility smoke tests", () => {
  it("keeps the shared modal semantics free of serious violations", async () => {
    const html = renderToStaticMarkup(createElement(GameModal, {
      id: "rules-test",
      open: true,
      assetTag: "ui:test-rules",
      title: "족보와 규칙",
      description: "현재 판에 적용되는 규칙을 확인합니다.",
      actions: [{ id: "confirm", label: "확인", onClick: () => undefined }],
      onClose: () => undefined,
    }));
    expect(await seriousViolations(html)).toEqual([]);
  });

  it("keeps the shop and ending records semantically accessible", async () => {
    const market = renderToStaticMarkup(createElement(MarketScreen, {
      mode: "shop",
      assetTag: "ui:test-market",
      stageLabel: "3월 장터",
      money: 20,
      offers: [{
        offer: { offerId: "offer", category: "book", definitionId: "b_ddaeng", price: 6, sold: false },
        name: "땡 비결",
        description: "땡의 기본 배수를 높입니다.",
        assetTag: "book:ddaeng",
        rarityLabel: "등장 빈도 · 드묾",
      }],
      rerollCost: 2,
      canReroll: true,
      ownedTalismans: [],
      onSellTalisman: () => undefined,
      onMoveTalisman: () => undefined,
      onBuyOffer: () => undefined,
      onReroll: () => undefined,
      onLeave: () => undefined,
      onOpenDeck: () => undefined,
    }));
    expect(await seriousViolations(`<main>${market}</main>`)).toEqual([]);

    const initial = createInitialGameState("AXE-END");
    const ending = renderToStaticMarkup(createElement(RunEndScreen, {
      assetTag: "ui:test-ending",
      result: "lose",
      stageLabel: "5월",
      finalScore: 800,
      targetScore: 1_000,
      money: 4,
      seed: "AXE-END",
      stats: initial.stats,
      onRestart: () => undefined,
    }));
    expect(await seriousViolations(ending)).toEqual([]);
  });
});
