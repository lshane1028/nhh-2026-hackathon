import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { MarketScreen, type MarketOfferView } from "../../app/components/MarketScreen";

function renderOffer(item: MarketOfferView, money: number): string {
  return renderToStaticMarkup(createElement(MarketScreen, {
    mode: "shop",
    assetTag: "ui:test-market",
    money,
    offers: [item],
    rerollCost: 2,
    canReroll: false,
    onBuyOffer: () => undefined,
  }));
}

describe("market offer affordances", () => {
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

  it("renders a labelled tile instead of requesting catalog art that does not exist", () => {
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
    }, 99);

    expect(html).toContain("book:four-brights");
    expect(html).not.toContain("/assets/generated/books/four-brights.webp");
  });
});
