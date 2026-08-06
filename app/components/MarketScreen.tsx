"use client";

import type {
  ContractDefinition,
  ShopOffer,
} from "@/game/types";

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
  book: "이 족보의 배수가 영구히 성장",
  painter: "내 카드 한 장을 영구히 바꿈",
  forbidden: "강한 효과와 영구적인 대가",
  pack: "후보 중 하나를 무료로",
};

const CATEGORY_NAMES: Record<ShopOffer["category"], string> = {
  talisman: "부적",
  book: "비결서",
  painter: "화공",
  forbidden: "금단",
  pack: "꾸러미",
};

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
        aria-pressed={selected}
        disabled={disabled}
        onClick={onClick}
      >
        {recommended ? <span className="market-card__flag">추천</span> : null}
        <span className="market-card__kind">{kindLabel}</span>
        <ArtSlot assetTag={assetTag} />
        <strong className="market-card__name">{name}</strong>
        <span className="market-card__guide">{guide}</span>
        <p className="market-card__body">{description}</p>
        {detailLabel ? <small className="market-card__detail">{detailLabel}</small> : null}
        <span className="market-card__cta">{ctaLabel}</span>
      </button>
    </div>
  );
}

function Rack({ label, hint, children, variant, tutorialId }: {
  label: string;
  hint?: string;
  variant?: "packs";
  tutorialId?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className={joinClassNames("market-rack", variant && `market-rack--${variant}`)}
      data-tutorial={tutorialId}
    >
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
  const goods = shopOffers.filter((item) => item.offer.category !== "pack");
  const packs = shopOffers.filter((item) => item.offer.category === "pack");
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
                  <strong>새 상품</strong>
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
            <>
              <Rack
                label={props.openedPack ? `${props.openedPack} 개봉` : "오늘의 장터"}
                hint={props.openedPack
                  ? "하나만 무료로 고르세요"
                  : `${goods.filter((item) => !item.offer.sold).length}개 구매 가능`}
                tutorialId="shop-rack"
              >
                {goods.map((item) => offerCard(
                  item,
                  props.money,
                  props.onBuyOffer,
                  item.offer.offerId === recommended?.offer.offerId ? "shop-pick" : undefined,
                ))}
              </Rack>

              {packs.length > 0 ? (
                <Rack label="꾸러미" hint="열면 후보 중 하나를 무료로" variant="packs">
                  {packs.map((item) => offerCard(item, props.money, props.onBuyOffer))}
                </Rack>
              ) : null}
            </>
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
