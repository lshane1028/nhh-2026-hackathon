"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type {
  ContractDefinition,
  ShopOffer,
} from "@/game/types";

import { getGeneratedAssetUrl } from "./generated-asset";
import { getFloatingHintPosition } from "./tooltip-position";
import { CollectionBoard, type CollectionBoardItem } from "./CollectionBoard";
import {
  playCashRegisterSound,
  playRewardFinishSound,
  playRewardStepSound,
  primeGameAudio,
} from "../audio/game-sfx";
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
  /** Money that must be on hand, including any ritual fee paid on use. */
  requiredMoney?: number;
  /** Exact price copy when the sticker price is not the whole cost. */
  priceLabel?: string;
  /** A permanent run-state constraint that money alone cannot solve. */
  unavailableReason?: string;
  rarityLabel?: string;
  detailLabel?: string;
  comparison?: { current: string; next: string };
  recommended?: boolean;
}

export interface MarketContractView {
  definition: ContractDefinition;
  currentLevel?: number;
  disabled?: boolean;
}

export interface OwnedTalismanView {
  instanceId: string;
  name: string;
  description: string;
  assetTag: string;
  sellPrice: number;
}

export function OwnedTalismanBar({ items, onSell, onMove }: {
  items: readonly OwnedTalismanView[];
  onSell: (instanceId: string) => void;
  onMove: (instanceId: string, targetInstanceId: string) => void;
}) {
  const [hint, setHint] = useState<{
    item: OwnedTalismanView;
    x: number;
    y: number;
    placement: "above" | "below";
  } | null>(null);
  const anchorRef = useRef<HTMLElement | null>(null);
  const hintRef = useRef<HTMLElement | null>(null);
  const hintVisible = hint !== null;

  const updateHintPosition = useCallback(() => {
    const anchor = anchorRef.current;
    if (!anchor) return;
    const panel = hintRef.current;
    const position = getMarketHintPosition(
      anchor.getBoundingClientRect(),
      window.innerWidth,
      window.innerHeight,
      panel?.offsetWidth ?? 352,
      panel?.offsetHeight ?? 220,
    );
    setHint((current) => current ? { ...current, ...position } : current);
  }, []);

  useLayoutEffect(() => {
    if (!hintVisible) return;
    updateHintPosition();
    window.addEventListener("resize", updateHintPosition);
    window.addEventListener("scroll", updateHintPosition, true);
    return () => {
      window.removeEventListener("resize", updateHintPosition);
      window.removeEventListener("scroll", updateHintPosition, true);
    };
  }, [hintVisible, updateHintPosition]);

  const showHint = (item: OwnedTalismanView, node: HTMLElement) => {
    anchorRef.current = node;
    setHint({ item, ...getMarketHintPosition(node.getBoundingClientRect(), window.innerWidth, window.innerHeight) });
  };
  const hideHint = () => {
    anchorRef.current = null;
    setHint(null);
  };

  return (
    <section className="market-owned market-owned--banner" aria-label="보유 부적">
      <header><strong>보유 부적</strong><span>끌어서 순서 변경 · 눌러서 판매</span></header>
      <div className="market-owned__slots">
        {items.length ? items.map((item, index) => {
          const artUrl = getGeneratedAssetUrl(item.assetTag);
          return (
            <button
              type="button"
              key={item.instanceId}
              aria-label={`${index + 1}번째 부적 ${item.name}. ${item.description}. 판매가 ${item.sellPrice}냥`}
              draggable
              onPointerEnter={(event) => showHint(item, event.currentTarget)}
              onPointerLeave={hideHint}
              onFocus={(event) => showHint(item, event.currentTarget)}
              onBlur={hideHint}
              onDragStart={(event) => {
                hideHint();
                event.dataTransfer.effectAllowed = "move";
                event.dataTransfer.setData("text/plain", item.instanceId);
              }}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                const sourceId = event.dataTransfer.getData("text/plain");
                if (sourceId) onMove(sourceId, item.instanceId);
              }}
              onClick={() => onSell(item.instanceId)}
            >
              <i>{index + 1}</i>
              <span style={artUrl ? { backgroundImage: `url("${artUrl}")` } : undefined} aria-hidden="true" />
              <b>{item.name}</b>
            </button>
          );
        }) : <p>비어 있음</p>}
      </div>
      {hint && typeof document !== "undefined"
        ? createPortal(
            <span
              ref={hintRef}
              className="market-card__hint market-card__hint--portal market-owned__hint"
              data-placement={hint.placement}
              role="tooltip"
              style={{ left: hint.x, top: hint.y }}
            >
              <b>{hint.item.name}</b>
              <em>보유 부적 · 자동 발동</em>
              <p>{hint.item.description}</p>
              <i>왼쪽 부적부터 차례대로 적용됩니다.</i>
              <s>누르면 판매 +{hint.item.sellPrice}냥</s>
            </span>,
            document.body,
          )
        : null}
    </section>
  );
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
      onMoveTalisman: (instanceId: string, targetInstanceId: string) => void;
      onOpenDeck: () => void;
    })
  | (MarketScreenBaseProps & {
      mode: "contract";
      seasonMonth: 3 | 6 | 9 | 12;
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

const SEASON_ENCOUNTERS = {
  3: { name: "매화 장수", season: "봄", assetTag: "season:spring-stranger", line: "꽃이 지기 전에 약조 하나 묶어 두시지. 어느 쪽이든 값은 치르게 될 테니." },
  6: { name: "장마 사공", season: "여름", assetTag: "season:summer-stranger", line: "물이 불면 건널 길도 바뀌는 법이오. 다음 석 달을 건널 노를 하나 고르시오." },
  9: { name: "가면 쓴 서리", season: "가을", assetTag: "season:autumn-stranger", line: "잘 익은 패만 거두려다 빈손이 되기도 하지. 그대는 무엇을 남길 텐가?" },
  12: { name: "눈밭의 장부꾼", season: "겨울", assetTag: "season:winter-stranger", line: "열두 달의 끝에도 빚과 약속은 남는다네. 마지막 줄에 어떤 이름을 적겠나?" },
} as const;

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
  unavailable?: boolean;
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
  tooltipWidth = 320,
  tooltipHeight = 320,
) {
  const position = getFloatingHintPosition(rect, viewportWidth, viewportHeight, tooltipWidth, tooltipHeight);
  return { x: position.left, y: position.top, placement: position.placement };
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
  unavailable,
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
  const anchorRef = useRef<HTMLElement | null>(null);
  const hintRef = useRef<HTMLElement | null>(null);
  const hintVisible = hintPosition !== null;

  const updateHintPosition = useCallback(() => {
    const anchor = anchorRef.current;
    if (!anchor) return;
    const hint = hintRef.current;
    setHintPosition(getMarketHintPosition(
      anchor.getBoundingClientRect(),
      window.innerWidth,
      window.innerHeight,
      hint?.offsetWidth ?? 320,
      hint?.offsetHeight ?? 320,
    ));
  }, []);

  useLayoutEffect(() => {
    if (!hintVisible) return;
    updateHintPosition();
    window.addEventListener("resize", updateHintPosition);
    window.addEventListener("scroll", updateHintPosition, true);
    return () => {
      window.removeEventListener("resize", updateHintPosition);
      window.removeEventListener("scroll", updateHintPosition, true);
    };
  }, [hintVisible, updateHintPosition]);

  const showHint = (node: HTMLElement) => {
    anchorRef.current = node;
    setHintPosition(getMarketHintPosition(node.getBoundingClientRect(), window.innerWidth, window.innerHeight));
  };
  const hideHint = () => {
    anchorRef.current = null;
    setHintPosition(null);
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
          unavailable && "market-card--unavailable",
          sold && "market-card--sold",
        )}
        aria-label={`${name}, ${kindLabel}, ${priceLabel ?? "가격 없음"}, ${description}${detailLabel ? `, ${detailLabel}` : ""}, ${ctaLabel}`}
        aria-pressed={selected}
        disabled={disabled}
        onClick={onClick}
        onPointerEnter={(event) => showHint(event.currentTarget)}
        onPointerLeave={hideHint}
        onFocus={(event) => showHint(event.currentTarget)}
        onBlur={hideHint}
      >
        <span
          className={joinClassNames(
            "market-card__art",
            Boolean(artUrl) && "market-card__art--generated",
          )}
          data-asset-tag={assetTag}
          style={artUrl ? { "--market-card-art": `url("${artUrl}")` } as React.CSSProperties : undefined}
        >
          <span className="market-card__art-mark" aria-hidden="true">花</span>
        </span>

        <span className="market-card__kind">{kindLabel}</span>
        {unavailable
          ? <span className="market-card__flag market-card__flag--blocked">사용 불가</span>
          : recommended ? <span className="market-card__flag">추천</span> : null}
        <span className="market-card__label">{name}</span>

      </button>
    </div>
    {hintPosition && typeof document !== "undefined"
      ? createPortal(
          <span
            ref={hintRef}
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
  const cannotAfford = money < (item.requiredMoney ?? item.offer.price);
  const unavailable = Boolean(item.unavailableReason);
  const isPack = item.offer.category === "pack";
  return (
    <MarketCard
      key={item.offer.offerId}
      assetTag={item.assetTag}
      name={item.name}
      kindLabel={CATEGORY_NAMES[item.offer.category]}
      guide={item.rarityLabel ?? CATEGORY_GUIDES[item.offer.category]}
      description={item.description}
      detailLabel={item.unavailableReason
        ? `${item.detailLabel ? `${item.detailLabel} · ` : ""}사용 불가: ${item.unavailableReason}`
        : item.detailLabel}
      priceLabel={item.priceLabel ?? (item.offer.price === 0 ? "무료" : `${formatNumber(item.offer.price)}냥`)}
      comparison={item.comparison}
      ctaLabel={item.offer.sold
        ? (isPack ? "개봉 완료" : "구매 완료")
        : unavailable ? item.unavailableReason! : cannotAfford ? "총액 부족" : isPack ? "개봉" : "구매"}
      recommended={item.recommended}
      unavailable={unavailable}
      sold={item.offer.sold}
      disabled={item.offer.sold || unavailable || cannotAfford}
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
              onClick={() => {
                primeGameAudio();
                playCashRegisterSound();
                props.onContinue();
              }}
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
                        <span className="market-dept__mark" aria-hidden="true">花</span>
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
            (() => {
              const encounter = SEASON_ENCOUNTERS[props.seasonMonth];
              const sceneUrl = getGeneratedAssetUrl(encounter.assetTag);
              return (
                <section className="season-contract" data-season={props.seasonMonth}>
                  <div className="season-contract__scene" style={sceneUrl ? { backgroundImage: `linear-gradient(180deg, transparent 42%, rgb(8 7 6 / 92%)), url("${sceneUrl}")` } : undefined}>
                    <span>{encounter.season} · {props.seasonMonth}월 결산</span>
                    <strong>{encounter.name}</strong>
                    <p>“{encounter.line}”</p>
                  </div>
                  <div className="season-contract__choices" role="group" aria-label="계약 대화 선택지">
                    {props.contracts.map(({ definition, currentLevel = 0, disabled }, index) => {
                      const rewardSentence = currentLevel > 0 ? definition.upgradedDescription : definition.description;
                      const rewardName = currentLevel > 0 ? definition.upgradedName : definition.name;
                      return (
                        <button
                          type="button"
                          className={definition.id === props.selectedContractId ? "season-contract__choice season-contract__choice--selected" : "season-contract__choice"}
                          disabled={disabled}
                          aria-pressed={definition.id === props.selectedContractId}
                          onClick={() => props.onSelectContract(definition.id)}
                          key={definition.id}
                        >
                          <em>{index + 1}</em>
                          <span><b>{rewardName}</b><small>“{rewardSentence}”</small></span>
                        </button>
                      );
                    })}
                  </div>
                </section>
              );
            })()
          ) : null}
        </div>
      </div>
    </section>
  );
}
