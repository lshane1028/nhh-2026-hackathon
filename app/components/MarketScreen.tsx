"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type {
  ContractDefinition,
  ShopOffer,
} from "@/game/types";

import { getGeneratedAssetUrl } from "./generated-asset";
import { CollectionBoard, type CollectionBoardItem } from "./CollectionBoard";
import { playRewardFinishSound, playRewardStepSound } from "../audio/game-sfx";
import "./screen-ui.css";

export interface MarketRewardView {
  assetTag: string;
  amount: number;
  title?: string;
  description?: string;
  lines?: readonly string[];
  reasons?: readonly { id: string; label: string; detail: string; amount?: number; multiplier?: number }[];
  scores?: { submission: number; collection: number; goStopPoints: number; total: number; goCount: number; highestHand: number; highestSubmissionCards: number };
  collectionItems?: readonly CollectionBoardItem[];
}

export interface MarketOfferView {
  offer: ShopOffer;
  name: string;
  description: string;
  assetTag: string;
  rarityLabel?: string;
  detailLabel?: string;
  comparison?: { current: string; next: string };
  recommended?: boolean;
}

export interface MarketContractView {
  definition: ContractDefinition;
  disabled?: boolean;
}

export interface OwnedTalismanView {
  instanceId: string;
  name: string;
  description: string;
  assetTag: string;
  sellPrice: number;
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
      ownedTalismans: readonly OwnedTalismanView[];
      onSellTalisman: (instanceId: string) => void;
      onOpenDeck: () => void;
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

interface MarketCardProps {
  assetTag: string;
  name: string;
  kindLabel: string;
  guide: string;
  description: string;
  priceLabel?: string;
  ctaLabel: string;
  detailLabel?: string;
  comparison?: { current: string; next: string };
  selected?: boolean;
  recommended?: boolean;
  disabled?: boolean;
  sold?: boolean;
  tutorialId?: string;
  onClick: () => void;
}

const EMPTY_REWARD_REASONS: NonNullable<MarketRewardView["reasons"]> = [];

export function getMarketHintPosition(
  rect: Pick<DOMRect, "left" | "top" | "right" | "bottom" | "width">,
  viewportWidth: number,
  viewportHeight: number,
) {
  const halfWidth = Math.min(160, viewportWidth * 0.41);
  const x = Math.max(halfWidth + 12, Math.min(viewportWidth - halfWidth - 12, rect.left + rect.width / 2));
  const placement = rect.top >= 250 || viewportHeight - rect.bottom < 250 ? "above" as const : "below" as const;
  return { x, y: placement === "above" ? rect.top - 10 : rect.bottom + 10, placement };
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
  comparison,
  selected,
  recommended,
  disabled,
  sold,
  tutorialId,
  onClick,
}: MarketCardProps) {
  const artUrl = getGeneratedAssetUrl(assetTag);
  const [hintPosition, setHintPosition] = useState<{
    x: number;
    y: number;
    placement: "above" | "below";
  } | null>(null);

  const showHint = (node: HTMLElement) => {
    const rect = node.getBoundingClientRect();
    setHintPosition(getMarketHintPosition(rect, window.innerWidth, window.innerHeight));
  };

  /* The picture is the whole tile; everything else lives in the hover panel,
     so a department reads as two or three pictures rather than a wall of text. */
  return (
    <>
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
        onPointerEnter={(event) => showHint(event.currentTarget)}
        onPointerLeave={() => setHintPosition(null)}
        onFocus={(event) => showHint(event.currentTarget)}
        onBlur={() => setHintPosition(null)}
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

      </button>
    </div>
    {hintPosition && typeof document !== "undefined"
      ? createPortal(
          <span
            className="market-card__hint market-card__hint--portal"
            data-placement={hintPosition.placement}
            role="tooltip"
            style={{ left: hintPosition.x, top: hintPosition.y }}
          >
            <b>{name}</b>
            <em>{kindLabel}{priceLabel ? ` · ${priceLabel}` : ""}</em>
            <p>{description}</p>
            <i>{guide}</i>
            {comparison ? (
              <span className="market-card__comparison" aria-label="레벨업 전후 비교">
                <span><small>현재</small><b>{comparison.current}</b></span>
                <span><small>구매 후</small><b>{comparison.next}</b></span>
              </span>
            ) : null}
            {detailLabel ? <u>{detailLabel}</u> : null}
            <s>{ctaLabel}</s>
          </span>,
          document.body,
        )
      : null}
    </>
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
      comparison={item.comparison}
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
  const reward = props.mode === "reward" ? props.reward : null;
  const rewardReasons = reward?.reasons ?? EMPTY_REWARD_REASONS;
  const [revealedReasonCount, setRevealedReasonCount] = useState(0);
  const [animatedReward, setAnimatedReward] = useState(() => reward ? 0 : 0);
  const [animatedMoney, setAnimatedMoney] = useState(() => reward ? props.money - reward.amount : props.money);
  const rewardComplete = !reward || (rewardReasons.length > 0
    ? revealedReasonCount >= rewardReasons.length
    : animatedReward >= reward.amount);
  const walletMoney = reward ? animatedMoney : props.money;

  useEffect(() => {
    if (!reward) return;
    const timers: number[] = [];
    const startMoney = props.money - reward.amount;
    timers.push(window.setTimeout(() => {
      setRevealedReasonCount(0);
      setAnimatedReward(0);
      setAnimatedMoney(startMoney);
    }, 0));

    if (rewardReasons.length === 0) {
      timers.push(window.setTimeout(() => {
        setAnimatedReward(reward.amount);
        setAnimatedMoney(props.money);
        playRewardFinishSound();
      }, 320));
    } else {
      rewardReasons.forEach((reason, index) => {
        timers.push(window.setTimeout(() => {
          const isLast = index === rewardReasons.length - 1;
          const partial = rewardReasons.slice(0, index + 1).reduce((value, entry) => {
            if (entry.amount !== undefined) return value + entry.amount;
            if (entry.multiplier !== undefined) return value * entry.multiplier;
            return value;
          }, 0);
          const shown = isLast ? reward.amount : Math.min(reward.amount, Math.max(0, Math.floor(partial)));
          setRevealedReasonCount(index + 1);
          setAnimatedReward(shown);
          setAnimatedMoney(startMoney + shown);
          playRewardStepSound(index);
          if (isLast) playRewardFinishSound();
        }, 380 + index * 520));
      });
    }

    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [props.money, reward, rewardReasons]);

  return (
    <section className={joinClassNames("market-panel", props.className)} aria-label={props.title}>
      <div className="market-panel__body">
        <aside className="market-panel__actions" aria-label="장터 조작">
          <div className="market-panel__wallet" data-tutorial="wallet">
            <span>보유</span>
            <strong className={reward && !rewardComplete ? "market-panel__money--counting" : undefined}>{formatNumber(walletMoney)}</strong>
            <small>냥</small>
          </div>

          {props.mode === "reward" ? (
            <button
              type="button"
              className="market-action market-action--primary"
              data-tutorial="reward-continue"
              disabled={!rewardComplete}
              onClick={props.onContinue}
            >
              <strong>{rewardComplete ? "보상 받기" : "판돈 계산 중"}</strong>
              <span>+{formatNumber(animatedReward)}냥</span>
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
              <button type="button" className="market-action" onClick={props.onOpenDeck}>
                <strong>덱 보기</strong>
                <span>현재 구성 확인</span>
              </button>
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
                <div className="market-reward__copy">
                  <span>판돈 합계</span>
                  <strong aria-live="polite">+{formatNumber(animatedReward)}냥</strong>
                  {props.reward.description ? <p>{props.reward.description}</p> : null}
                  {props.reward.lines?.length ? (
                    <ul>
                      {props.reward.lines.map((line, index) => <li key={`${line}-${index}`}>{line}</li>)}
                    </ul>
                  ) : null}
                </div>
                {props.reward.reasons?.length ? (
                  <ol className="market-reward__reasons">
                    {props.reward.reasons.map((reason, index) => (
                      <li
                        className={index < revealedReasonCount ? "market-reward__reason--revealed" : undefined}
                        key={reason.id}
                      >
                        <span>{reason.label}</span>
                        <small>{reason.detail}</small>
                        <strong>{reason.amount !== undefined ? `+${formatNumber(reason.amount)}냥` : `×${reason.multiplier}`}</strong>
                      </li>
                    ))}
                  </ol>
                ) : null}
                {props.reward.scores ? (
                  <div className="market-reward__scores">
                    <span><small>제출 점수</small><strong>{formatNumber(props.reward.scores.submission)}</strong></span>
                    <span><small>수집 점수</small><strong>{formatNumber(props.reward.scores.collection)}</strong><em>고스톱 {props.reward.scores.goStopPoints}점</em></span>
                    <span className="market-reward__score-total"><small>총점 · {props.reward.scores.goCount}고</small><strong>{formatNumber(props.reward.scores.total)}</strong></span>
                    <span><small>최고 제출</small><strong>{formatNumber(props.reward.scores.highestHand)}점</strong><em>최대 {props.reward.scores.highestSubmissionCards}장</em></span>
                  </div>
                ) : null}
                {props.reward.collectionItems ? (
                  <CollectionBoard assetTag="ui:reward-collection" className="market-reward__collection" items={props.reward.collectionItems} scoreLabel="이번 판 최종 수집 족보" />
                ) : null}
              </div>
            </Rack>
          ) : null}

          {props.mode === "shop" ? (
            props.openedPack ? (
              <Rack label={`${props.openedPack} 개봉`} hint="하나만 무료로 고르세요" tutorialId="dept-pack">
                {shopOffers.map((item) => offerCard(item, props.money, props.onBuyOffer))}
              </Rack>
            ) : (
              <>
              <section className="market-owned" aria-label="보유 부적">
                <header><strong>보유 부적</strong><span>누르면 판매됩니다</span></header>
                <div>
                  {props.ownedTalismans.length ? props.ownedTalismans.map((item) => {
                    const artUrl = getGeneratedAssetUrl(item.assetTag);
                    return (
                      <button type="button" key={item.instanceId} title={item.description} onClick={() => props.onSellTalisman(item.instanceId)}>
                        <span style={artUrl ? { backgroundImage: `url("${artUrl}")` } : undefined} />
                        <b>{item.name}</b>
                        <small>판매 +{item.sellPrice}냥</small>
                      </button>
                    );
                  }) : <p>아직 가진 부적이 없습니다.</p>}
                </div>
              </section>
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
              </>
            )
          ) : null}

          {props.mode === "contract" ? (
            <Rack label="이번 판 동안 유지할 계약" hint="하나 선택">
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
