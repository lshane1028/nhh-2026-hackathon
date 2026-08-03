"use client";

import type {
  ContractDefinition,
  ShopOffer,
} from "@/game/types";

import { AssetPlaceholder } from "./AssetPlaceholder";
import {
  TutorialCoach,
  type TutorialCoachProps,
} from "./TutorialCoach";
import "./screen-ui.css";

export type MarketShopCategory = Exclude<ShopOffer["category"], "pack">;

export interface MarketRewardView {
  assetTag: string;
  amount: number;
  title?: string;
  description?: string;
  lines?: readonly string[];
}

export interface MarketShopChoice {
  category: MarketShopCategory;
  label: string;
  description: string;
  assetTag: string;
  disabled?: boolean;
  recommended?: boolean;
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
  coach?: TutorialCoachProps;
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
      mode: "shop_choice";
      choices: readonly MarketShopChoice[];
      selectedCategory?: MarketShopCategory | null;
      onChooseShop: (category: MarketShopCategory) => void;
    })
  | (MarketScreenBaseProps & {
      mode: "shop";
      offers: readonly MarketOfferView[];
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

const MODE_LABELS: Record<MarketScreenProps["mode"], string> = {
  reward: "판 보상",
  shop_choice: "장터 선택",
  shop: "상품 구매",
  contract: "계절 계약",
};

const SHOP_CATEGORY_GUIDES: Record<ShopOffer["category"], string> = {
  talisman: "부적 · 보유 중 자동 발동",
  book: "비결서 · 족보 배수 영구 성장",
  painter: "화공 · 카드 한 장 강화",
  forbidden: "금단 계약 · 강력하지만 대가 있음",
  pack: "꾸러미 · 여러 강화 중 하나를 골라 획득",
};

export function MarketScreen(props: MarketScreenProps) {
  const title = props.title ?? MODE_LABELS[props.mode];

  return (
    <main className={joinClassNames("market-screen", props.className)}>
      <header className="market-screen__header">
        <AssetPlaceholder
          assetTag={props.assetTag}
          label={title}
          description={props.stageLabel ?? MODE_LABELS[props.mode]}
          tone="neutral"
        />
        <div className="market-screen__heading-copy">
          <p>{MODE_LABELS[props.mode]}</p>
          <h1>{title}</h1>
          {props.description ? <span>{props.description}</span> : null}
        </div>
        <div className="market-screen__wallet" aria-label={`보유 재화 ${props.money}냥`}>
          <span>보유</span>
          <strong>{formatNumber(props.money)}</strong>
          <small>냥</small>
        </div>
      </header>

      {props.coach ? <TutorialCoach {...props.coach} /> : null}

      {props.mode === "reward" ? (
        <section className="market-screen__reward" aria-labelledby="market-reward-title">
          <AssetPlaceholder
            assetTag={props.reward.assetTag}
            label={props.reward.title ?? "이번 판 보상"}
            description={`${formatNumber(props.reward.amount)}냥 획득`}
            tone="score"
          />
          <div className="market-screen__reward-total">
            <span id="market-reward-title">획득한 재화</span>
            <strong>+{formatNumber(props.reward.amount)}냥</strong>
            {props.reward.description ? <p>{props.reward.description}</p> : null}
          </div>
          {props.reward.lines && props.reward.lines.length > 0 ? (
            <ul className="market-screen__reward-lines">
              {props.reward.lines.map((line, index) => (
                <li key={`${line}-${index}`}>{line}</li>
              ))}
            </ul>
          ) : null}
          <button
            type="button"
            className="screen-button screen-button--primary"
            onClick={props.onContinue}
          >
            보상 받고 계속
          </button>
        </section>
      ) : null}

      {props.mode === "shop_choice" ? (
        <section aria-labelledby="market-choice-title">
          <div className="screen-section-heading">
            <div>
              <p>CHOOSE ONE</p>
              <h2 id="market-choice-title">어느 장터로 갈까요?</h2>
            </div>
            <span>{props.choices.length}개 후보</span>
          </div>
          <div className="market-screen__choice-grid">
            {props.choices.map((choice) => {
              const selected = props.selectedCategory === choice.category;
              return (
                <button
                  type="button"
                  key={choice.category}
                  className={joinClassNames(
                    "market-screen__choice",
                    selected && "market-screen__choice--selected",
                    choice.recommended && "market-screen__choice--recommended",
                  )}
                  aria-pressed={selected}
                  disabled={choice.disabled}
                  onClick={() => props.onChooseShop(choice.category)}
                >
                  {choice.recommended ? (
                    <span className="market-screen__recommendation-badge">
                      첫 방문 추천
                    </span>
                  ) : null}
                  <AssetPlaceholder
                    assetTag={choice.assetTag}
                    label={choice.label}
                    description={SHOP_CATEGORY_GUIDES[choice.category]}
                    tone="neutral"
                  />
                  <span className="market-screen__choice-guide">
                    {SHOP_CATEGORY_GUIDES[choice.category]}
                  </span>
                  <span className="market-screen__choice-description">
                    {choice.description}
                  </span>
                  <strong aria-hidden="true">{selected ? "선택됨" : "선택"}</strong>
                </button>
              );
            })}
          </div>
        </section>
      ) : null}

      {props.mode === "shop" ? (
        <section aria-labelledby="market-shop-title">
          <div className="screen-section-heading">
            <div>
              <p>MARKET</p>
              <h2 id="market-shop-title">오늘의 상품</h2>
            </div>
            <span>{props.offers.filter((item) => !item.offer.sold).length}개 구매 가능</span>
          </div>
          <div className="market-screen__offer-grid">
            {props.offers.map((item) => {
              const cannotAfford = props.money < item.offer.price;
              const disabled = item.offer.sold || cannotAfford;

              return (
                <article
                  className={joinClassNames(
                    "market-screen__offer",
                    item.offer.sold && "market-screen__offer--sold",
                    item.recommended && "market-screen__offer--recommended",
                  )}
                  key={item.offer.offerId}
                >
                  {item.recommended ? (
                    <span className="market-screen__recommendation-badge">
                      첫 구매 추천
                    </span>
                  ) : null}
                  <AssetPlaceholder
                    assetTag={item.assetTag}
                    label={item.name}
                    description={
                      item.rarityLabel ?? SHOP_CATEGORY_GUIDES[item.offer.category]
                    }
                    tone={item.offer.category === "talisman" ? "talisman" : "neutral"}
                  />
                  <span className="market-screen__offer-guide">
                    {SHOP_CATEGORY_GUIDES[item.offer.category]}
                  </span>
                  <p>{item.description}</p>
                  {item.detailLabel ? <small>{item.detailLabel}</small> : null}
                  <div className="market-screen__offer-footer">
                    <strong>{formatNumber(item.offer.price)}냥</strong>
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => props.onBuyOffer(item.offer.offerId)}
                    >
                      {item.offer.sold ? "판매 완료" : cannotAfford ? "냥 부족" : "구매"}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
          <div className="market-screen__shop-actions">
            {props.onReroll ? (
              <button
                type="button"
                className="screen-button"
                disabled={!props.canReroll || props.money < props.rerollCost}
                onClick={props.onReroll}
              >
                새 상품 보기 · {formatNumber(props.rerollCost)}냥
              </button>
            ) : null}
          </div>
        </section>
      ) : null}

      {props.mode === "contract" ? (
        <section aria-labelledby="market-contract-title">
          <div className="screen-section-heading">
            <div>
              <p>SEASON CONTRACT</p>
              <h2 id="market-contract-title">런 동안 유지할 계약</h2>
            </div>
            <span>하나 선택</span>
          </div>
          <div className="market-screen__contract-grid">
            {props.contracts.map(({ definition, disabled }) => {
              const selected = definition.id === props.selectedContractId;
              return (
                <button
                  type="button"
                  key={definition.id}
                  className={joinClassNames(
                    "market-screen__contract",
                    selected && "market-screen__contract--selected",
                  )}
                  aria-pressed={selected}
                  disabled={disabled}
                  onClick={() => props.onSelectContract(definition.id)}
                >
                  <AssetPlaceholder
                    assetTag={definition.assetTag}
                    label={definition.name}
                    description={definition.effectKey}
                    tone="neutral"
                  />
                  <p>{definition.description}</p>
                  <div>
                    <span>상위 계약</span>
                    <strong>{definition.upgradedName}</strong>
                    <small>{definition.upgradedDescription}</small>
                  </div>
                </button>
              );
            })}
          </div>
          <button
            type="button"
            className="screen-button screen-button--primary market-screen__confirm"
            disabled={!props.selectedContractId}
            onClick={props.onConfirmContract}
          >
            이 계약으로 계속
          </button>
        </section>
      ) : null}

      {props.onLeave ? (
        <footer className="market-screen__leave">
          <button type="button" className="screen-button" onClick={props.onLeave}>
            장터 나가기
          </button>
        </footer>
      ) : null}
    </main>
  );
}
