import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  MarketScreen,
  OwnedTalismanBar,
  requiresShopPurchaseConfirmation,
  type MarketOfferView,
} from "../../app/components/MarketScreen";
import { CONTRACTS } from "../content/meta";

function renderOffer(item: MarketOfferView, money: number): string {
  return renderToStaticMarkup(createElement(MarketScreen, {
    mode: "shop",
    assetTag: "ui:test-market",
    money,
    offers: [item],
    rerollCost: 2,
    canReroll: false,
    onBuyOffer: () => undefined,
    ownedTalismans: [],
    onSellTalisman: () => undefined,
    onMoveTalisman: () => undefined,
    onOpenDeck: () => undefined,
  }));
}

describe("market offer affordances", () => {
  it("keeps the selected offer's purchase button inside its upper-right corner", () => {
    const cssPath = fileURLToPath(new URL("../../app/components/market-screen.css", import.meta.url));
    const css = readFileSync(cssPath, "utf8");
    const rule = css.match(/\.market-card__purchase\s*\{([^}]*)\}/)?.[1] ?? "";

    expect(rule).toMatch(/position:\s*absolute/);
    expect(rule).toMatch(/top:\s*[^;]+/);
    expect(rule).toMatch(/right:\s*[^;]+/);
    expect(rule).toMatch(/width:\s*auto/);
    expect(rule).toMatch(/margin:\s*0/);
  });

  it("requires a separate confirmation for talismans and books only", () => {
    expect(requiresShopPurchaseConfirmation("talisman")).toBe(true);
    expect(requiresShopPurchaseConfirmation("book")).toBe(true);
    expect(requiresShopPurchaseConfirmation("painter")).toBe(false);
    expect(requiresShopPurchaseConfirmation("forbidden")).toBe(false);
    expect(requiresShopPurchaseConfirmation("pack")).toBe(true);
  });

  it("puts an owned talisman's effect and sale value in the top-bar slot", () => {
    const html = renderToStaticMarkup(createElement(OwnedTalismanBar, {
      items: [{
        instanceId: "owned:first",
        name: "첫 부적",
        description: "첫 제출의 배수 +4.",
        assetTag: "talisman:first-charm",
        sellPrice: 2,
      }],
      onSell: () => undefined,
      onMove: () => undefined,
    }));

    expect(html).toContain("보유 부적");
    expect(html).toContain("첫 제출의 배수 +4.");
    expect(html).toContain("판매가 2냥");
  });

  it("shows 광내림's full 12+6냥 price and disables purchase below 18냥", () => {
    const html = renderOffer({
      offer: {
        offerId: "offer-bright",
        category: "forbidden",
        definitionId: "f_bright_descent",
        price: 12,
        sold: false,
      },
      name: "광내림",
      description: "일반 패 한 장을 광으로 승격",
      assetTag: "forbidden:bright-descent",
      requiredMoney: 18,
      priceLabel: "총 18냥",
      detailLabel: "구매 12냥 + 의식 6냥",
    }, 17);

    expect(html).toContain("총 18냥");
    expect(html).toContain("구매 12냥 + 의식 6냥");
    expect(html).toContain("총액 부족");
    expect(html).toMatch(/<button[^>]*disabled=""/);
  });

  it("keeps a structural unavailable reason visible on a disabled offer", () => {
    const html = renderOffer({
      offer: {
        offerId: "offer-talisman",
        category: "talisman",
        definitionId: "t_first_charm",
        price: 5,
        sold: false,
      },
      name: "첫 부적",
      description: "배수 +4",
      assetTag: "talisman:first-charm",
      unavailableReason: "부적 주머니가 가득 참 · 5/5칸",
    }, 99);

    expect(html).toContain("사용 불가");
    expect(html).toContain("부적 주머니가 가득 참 · 5/5칸");
    expect(html).toMatch(/<button[^>]*disabled=""/);
  });

  it("renders the generated collection-book art when the asset exists", () => {
    const html = renderOffer({
      offer: {
        offerId: "offer-book",
        category: "book",
        definitionId: "b_four_brights",
        price: 8,
        sold: false,
      },
      name: "사광 수집 비결",
      description: "사광 점수 +1",
      assetTag: "book:four-brights",
      rarityLabel: "등장 빈도 · 매우 희귀",
    }, 99);

    expect(html).toContain("book:four-brights");
    expect(html).toContain("/assets/generated/books/four-brights.webp");
    expect(html).toContain("등장 빈도 · 매우 희귀");
  });

  it("fills the seasonal scene above two direct one-sentence rewards", () => {
    const first = CONTRACTS[0];
    const second = CONTRACTS[1];
    const html = renderToStaticMarkup(createElement(MarketScreen, {
      mode: "contract",
      seasonMonth: 3,
      assetTag: "ui:test-contract",
      money: 10,
      contracts: [
        { definition: first, currentLevel: 0 },
        { definition: second, currentLevel: 1 },
      ],
      selectedContractId: null,
      onSelectContract: () => undefined,
      onConfirmContract: () => undefined,
    }));

    expect(html).toContain("season-contract__scene");
    expect(html).toContain(`“${first.description}”`);
    expect(html).toContain(`“${second.upgradedDescription}”`);
    expect(html).not.toContain("조건을 듣겠습니다");
    expect(html).not.toContain("더 깊은 약조");
  });
});
