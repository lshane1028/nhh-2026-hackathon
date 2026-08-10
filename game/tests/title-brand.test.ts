import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { TitleScreen } from "../../app/components/TitleScreen";
import type { StartDeckDefinition } from "../types";

const START_DECKS: readonly StartDeckDefinition[] = [{
  id: "deck_standard",
  name: "기본 덱",
  description: "기본 화투패 48장",
  effectKey: "standard",
  assetTag: "deck:standard",
  unlockStage: 0,
}];

describe("경화수월 타이틀", () => {
  it("renders the accessible Korean wordmark over the generated backdrop", () => {
    const html = renderToStaticMarkup(createElement(TitleScreen, {
      assetTag: "ui:gyeonghwasuwol-logo-backdrop",
      title: "경화수월",
      subtitle: "화투패로 끗을 만들고 목표 점수를 넘기세요.",
      description: "두 장으로 끗을 만들고, 남은 패와 수집 족보로 점수를 쌓아 판을 이기세요.",
      startDecks: START_DECKS,
      selectedStartDeckId: "deck_standard",
      unlockedStartDeckIds: ["deck_standard"],
      canContinue: false,
      onSelectStartDeck: () => undefined,
      onNewGame: () => undefined,
      onSkipTutorial: () => undefined,
    }));

    expect(html).toContain("경화수월");
    expect(html).toContain('src="/assets/generated/ui/gyeonghwasuwol-logo-backdrop.png"');
    expect(html).toMatch(/<img[^>]*alt=""[^>]*aria-hidden="true"/);
    expect(html).not.toContain("꽃판: GO!");
  });

  it("keeps the logo art in the project and removes the former game name from app chrome", () => {
    expect(existsSync(resolve(process.cwd(), "public/assets/generated/ui/gyeonghwasuwol-logo-backdrop.png"))).toBe(true);

    const layout = readFileSync(resolve(process.cwd(), "app/layout.tsx"), "utf8");
    const runEnd = readFileSync(resolve(process.cwd(), "app/components/RunEndScreen.tsx"), "utf8");
    expect(layout).toContain("경화수월 — 화투 로그라이크");
    expect(layout).not.toContain("꽃판: GO!");
    expect(runEnd).toContain("경화수월 완주!");
  });
});
