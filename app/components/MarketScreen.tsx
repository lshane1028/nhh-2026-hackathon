"use client";

import type {
  ContractDefinition,
  ShopOffer,
} from "@/game/types";

import { getGeneratedAssetUrl } from "./generated-asset";
import "./screen-ui.css";

export interface MarketRewardView {
  assetTag: string;
  amount: number;
  title?: string;
  description?: string;
  lines?: readonly string[];
}

export interface MarketOfferView {
  offer: ShopOffer;
  name: string;
  description: string;
  assetTag: string;
  rarityLabel?: string;
  detailLabel?: string;
  recommended?: boolean;
}

export interface MarketContractView {
  definition: ContractDefinition;
  disabled?: boolean;
}

interface MarketScreenBaseProps {
  assetTag: string;
  title?: string;
  description?: string;
  money: number;
  stageLabel?: string;
  onLeave?: () => void;
  className?: string;
}

export type MarketScreenProps =
  | (MarketScreenBaseProps & {
      mode: "reward";
      reward: MarketRewardView;
      onContinue: () => void;
    })
  | (MarketScreenBaseProps & {
      mode: "shop";
      offers: readonly MarketOfferView[];
      /** Set while a bought pack's free choices are filling the rack. */
      openedPack?: string | null;
      rerollCost: number;
      canReroll: boolean;
      onBuyOffer: (offerId: string) => void;
      onReroll?: () => void;
    })
  | (MarketScreenBaseProps & {
      mode: "contract";
      contracts: readonly MarketContractView[];
      selectedContractId?: string | null;
      onSelectContract: (contractId: string) => void;
      onConfirmContract: () => void;
    });

function joinClassNames(...values: Array<string | false | undefined>): string {
  return values.filter(Boolean).join(" ");
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("ko-KR").format(value);
}

const CATEGORY_GUIDES: Record<ShopOffer["category"], string> = {
  talisman: "사두면 매 손 자동으로 발동",
  book: "이 끗패의 배수가 영구히 성장",
  painter: "덱에서 카드를 영구히 뺍니다",
  forbidden: "강한 효과와 영구적인 대가",
  pack: "열어서 덱에 넣을 카드를 고릅니다",
};

const CATEGORY_NAMES: Record<ShopOffer["category"], string> = {
  talisman: "부적",
  book: "비결서",
  painter: "소각",
  forbidden: "금단",
  pack: "카드 묶음",
};

interface Department {
  categories: readonly ShopOffer["category"][];
  label: string;
  blurb: string;
  assetTag: string;
  tutorialId: string;
}

/** Four fixed departments, one per quadrant. */
const DEPARTMENTS: readonly Department[] = [
  {
    categories: ["talisman"],
    label: "부적전",
    blurb: "가지고 있는 동안 매 손 자동으로 발동",
    assetTag: "shop:talisman",
    tutorialId: "dept-talisman",
  },
  {
    categories: ["book"],
    label: "비결서점",
    blurb: "적힌 끗패의 기본 배수가 영구히 성장",
    assetTag: "shop:book",
    tutorialId: "dept-book",
  },
  {
    categories: ["pack", "painter"],
    label: "덱 손질방",
    blurb: "덱에 카드를 넣거나 빼서 판을 다시 짭니다",
    assetTag: "shop:workshop",
    tutorialId: "dept-workshop",
  },
  {
    categories: ["forbidden"],
    label: "금단장",
    blurb: "판을 뒤집는 힘과 영구적인 대가",
    assetTag: "shop:forbidden",
    tutorialId: "dept-forbidden",
  },
];

/** Text stand-in for a picture. Swap by styling [data-asset-tag]. */
function ArtSlot({ assetTag, className }: { assetTag: string; className?: string }) {
  return (
    <span className={joinClassNames("market-art", className)} data-asset-tag={assetTag}>
      <span className="market-art__mark" aria-hidden="true">IMG</span>
      <code>{assetTag}</code>
    </span>
  );
}

interface MarketCardProps {
  assetTag: string;
  name: string;
  kindLabel: string;
  guide: string;
  description: string;
  priceLabel?: string;
  ctaLabel: string;
  detailLabel?: string;
  selected?: boolean;
  recommended?: boolean;
  disabled?: boolean;
  sold?: boolean;
  tutorialId?: string;
  onClick: () => void;
}

function MarketCard({
  assetTag,
  name,
  kindLabel,
  guide,
  description,
  priceLabel,
  ctaLabel,
  detailLabel,
  selected,
  recommended,
  disabled,
  sold,
  tutorialId,
  onClick,
}: MarketCardProps) {
  const artUrl = getGeneratedAssetUrl(assetTag);

  /* The picture is the whole tile; everything else lives in the hover panel,
     so a department reads as two or three pictures rather than a wall of text. */
  return (
    <div className="market-card__wrap" data-tutorial={tutorialId}>
      {priceLabel ? <span className="market-card__price" aria-hidden="true">{priceLabel}</span> : null}
      <button
        type="button"
        className={joinClassNames(
          "market-card",
          selected && "market-card--selected",
          recommended && "market-card--recommended",
          sold && "market-card--sold",
        )}
        aria-label={`${name}, ${kindLabel}, ${description}`}
        aria-pressed={selected}
        disabled={disabled}
        onClick={onClick}
      >
        <span
          className={joinClassNames(
            "market-card__art",
            Boolean(artUrl) && "market-card__art--generated",
          )}
          data-asset-tag={assetTag}
          style={artUrl ? { "--market-card-art": `url("${artUrl}")` } as React.CSSProperties : undefined}
        >
          <span className="market-card__art-mark" aria-hidden="true">IMG</span>
          <code>{assetTag}</code>
        </span>

        <span className="market-card__kind">{kindLabel}</span>
        {recommended ? <span className="market-card__flag">추천</span> : null}
        <span className="market-card__label">{name}</span>

        <span className="market-card__hint" role="tooltip">
          <b>{name}</b>
          <em>{kindLabel}{priceLabel ? ` · ${priceLabel}` : ""}</em>
          <p>{description}</p>
          <i>{guide}</i>
          {detailLabel ? <u>{detailLabel}</u> : null}
          <s>{ctaLabel}</s>
        </span>
      </button>
    </div>
  );
}

function Rack({ label, hint, children, tutorialId }: {
  label: string;
  hint?: string;
  tutorialId?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="market-rack" data-tutorial={tutorialId}>
      <h3 className="market-rack__label">
        <span>{label}</span>
        {hint ? <em>{hint}</em> : null}
      </h3>
      <div className="market-rack__items">{children}</div>
    </section>
  );
}

function offerCard(item: MarketOfferView, money: number, onBuy: (id: string) => void, tutorialId?: string) {
  const cannotAfford = money < item.offer.price;
  const isPack = item.offer.category === "pack";
  return (
    <MarketCard
      key={item.offer.offerId}
      assetTag={item.assetTag}
      name={item.name}
      kindLabel={CATEGORY_NAMES[item.offer.category]}
      guide={item.rarityLabel ?? CATEGORY_GUIDES[item.offer.category]}
      description={item.description}
      detailLabel={item.detailLabel}
      priceLabel={item.offer.price === 0 ? "무료" : `${formatNumber(item.offer.price)}냥`}
      ctaLabel={item.offer.sold
        ? (isPack ? "개봉 완료" : "구매 완료")
        : cannotAfford ? "냥 부족" : isPack ? "개봉" : "구매"}
      recommended={item.recommended}
      sold={item.offer.sold}
      disabled={item.offer.sold || cannotAfford}
      tutorialId={tutorialId}
      onClick={() => onBuy(item.offer.offerId)}
    />
  );
}

export function MarketScreen(props: MarketScreenProps) {
  const shopOffers = props.mode === "shop" ? props.offers : [];
  const recommended = shopOffers.find((item) => item.recommended);

  return (
    <section className={joinClassNames("market-panel", props.className)} aria-label={props.title}>
      <div className="market-panel__body">
        <aside className="market-panel__actions" aria-label="장터 조작">
          <div className="market-panel__wallet" data-tutorial="wallet">
            <span>보유</span>
            <strong>{formatNumber(props.money)}</strong>
            <small>냥</small>
          </div>

          {props.mode === "reward" ? (
            <button
              type="button"
              className="market-action market-action--primary"
              data-tutorial="reward-continue"
              onClick={props.onContinue}
            >
              <strong>보상 받기</strong>
              <span>+{formatNumber(props.reward.amount)}냥</span>
            </button>
          ) : null}

          {props.mode === "shop" ? (
            <>
              {props.onLeave ? (
                <button
                  type="button"
                  className="market-action market-action--primary"
                  data-tutorial="shop-leave"
                  onClick={props.onLeave}
                >
                  <strong>다음 판으로</strong>
                  <span>장터를 떠납니다</span>
                </button>
              ) : null}
              {props.onReroll ? (
                <button
                  type="button"
                  className="market-action market-action--reroll"
                  data-tutorial="shop-reroll"
                  disabled={!props.canReroll || props.money < props.rerollCost}
                  onClick={props.onReroll}
                >
                  <strong>새 물건</strong>
                  <span>{formatNumber(props.rerollCost)}냥</span>
                </button>
              ) : null}
            </>
          ) : null}

          {props.mode === "contract" ? (
            <button
              type="button"
              className="market-action market-action--primary"
              disabled={!props.selectedContractId}
              onClick={props.onConfirmContract}
            >
              <strong>이 계약으로</strong>
              <span>{props.selectedContractId ? "확정하고 계속" : "먼저 하나 고르세요"}</span>
            </button>
          ) : null}

          {props.description ? <p className="market-panel__note">{props.description}</p> : null}
        </aside>

        <div className="market-panel__racks">
          {props.mode === "reward" ? (
            <Rack label="이번 판 보상" hint={`+${formatNumber(props.reward.amount)}냥`}>
              <div className="market-reward">
                <ArtSlot assetTag={props.reward.assetTag} className="market-art--wide" />
                <div className="market-reward__copy">
                  <strong>+{formatNumber(props.reward.amount)}냥</strong>
                  {props.reward.description ? <p>{props.reward.description}</p> : null}
                  {props.reward.lines?.length ? (
                    <ul>
                      {props.reward.lines.map((line, index) => <li key={`${line}-${index}`}>{line}</li>)}
                    </ul>
                  ) : null}
                </div>
              </div>
            </Rack>
          ) : null}

          {props.mode === "shop" ? (
            props.openedPack ? (
              <Rack label={`${props.openedPack} 개봉`} hint="하나만 무료로 고르세요" tutorialId="dept-pack">
                {shopOffers.map((item) => offerCard(item, props.money, props.onBuyOffer))}
              </Rack>
            ) : (
              <div className="market-floor">
                {DEPARTMENTS.map((dept) => {
                  const items = shopOffers.filter((item) => dept.categories.includes(item.offer.category));
                  if (items.length === 0) return null;
                  return (
                    <section
                      className={`market-dept market-dept--${dept.categories[0]}`}
                      key={dept.label}
                      data-tutorial={dept.tutorialId}
                    >
                      <header className="market-dept__sign" data-asset-tag={dept.assetTag}>
                        <span className="market-dept__mark" aria-hidden="true">IMG</span>
                        <div>
                          <strong>{dept.label}</strong>
                          <span>{dept.blurb}</span>
                        </div>
                      </header>
                      <div className="market-dept__items">
                        {items.map((item) => offerCard(
                          item,
                          props.money,
                          props.onBuyOffer,
                          item.offer.offerId === recommended?.offer.offerId ? "shop-pick" : undefined,
                        ))}
                      </div>
                    </section>
                  );
                })}
              </div>
            )
          ) : null}

          {props.mode === "contract" ? (
            <Rack label="런 동안 유지할 계약" hint="하나 선택">
              {props.contracts.map(({ definition, disabled }) => (
                <MarketCard
                  key={definition.id}
                  assetTag={definition.assetTag}
                  name={definition.name}
                  kindLabel="계약"
                  guide={definition.description}
                  description={`상위 · ${definition.upgradedName} — ${definition.upgradedDescription}`}
                  ctaLabel={definition.id === props.selectedContractId ? "선택됨" : "선택"}
                  selected={definition.id === props.selectedContractId}
                  disabled={disabled}
                  onClick={() => props.onSelectContract(definition.id)}
                />
              ))}
            </Rack>
          ) : null}
        </div>
      </div>
    </section>
  );
}
