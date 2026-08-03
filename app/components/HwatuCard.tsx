"use client";

import type { CardInstance, CardKind } from "@/game/types";

export type HwatuCupRole = "animal" | "double_chaff";

export interface HwatuCardProps {
  card: CardInstance;
  selected?: boolean;
  scoring?: boolean;
  disabled?: boolean;
  cupRole?: HwatuCupRole;
  onSelect?: (card: CardInstance) => void;
  onCardFocus?: (card: CardInstance) => void;
  className?: string;
  ariaLabel?: string;
  testId?: string;
}

const KIND_LABELS: Record<CardKind, string> = {
  bright: "광",
  animal: "동물",
  ribbon: "띠",
  chaff: "피",
};

const RIBBON_LABELS = {
  hong: "홍단",
  cho: "초단",
  cheong: "청단",
  rain: "비띠",
} as const;

function joinClassNames(...values: Array<string | false | undefined>): string {
  return values.filter(Boolean).join(" ");
}

const ENHANCEMENT_LABELS: Record<
  NonNullable<CardInstance["enhancement"]>,
  string
> = {
  inked: "먹칠",
  scarlet: "주홍",
  wild: "야생",
  glass: "유리",
  steel: "강철",
  stone: "돌",
  coin: "엽전",
  fortune: "복",
};

const EDITION_LABELS: Record<NonNullable<CardInstance["edition"]>, string> = {
  gold_leaf: "금박",
  mother_of_pearl: "자개",
  five_color: "오방색",
  engraved: "각인",
};

const SEAL_LABELS: Record<NonNullable<CardInstance["seal"]>, string> = {
  yellow: "황인",
  red: "적인",
  blue: "청인",
  purple: "자인",
};

function getCardKindLabel(card: CardInstance, cupRole?: HwatuCupRole) {
  if (cupRole === "double_chaff") {
    return "쌍피";
  }

  if (cupRole === "animal") {
    return "동물";
  }

  return card.kind === "chaff" && card.chaffValue === 2
    ? "쌍피"
    : KIND_LABELS[card.kind];
}

export function HwatuCard({
  card,
  selected = false,
  scoring = false,
  disabled = false,
  cupRole,
  onSelect,
  onCardFocus,
  className,
  ariaLabel,
  testId,
}: HwatuCardProps) {
  const isDisabled = disabled || Boolean(card.disabledForRound);
  const kindLabel = getCardKindLabel(card, cupRole);
  const monthValue = card.month + card.permanentKkeutBonus;
  const ribbonLabel = card.ribbonGroup
    ? RIBBON_LABELS[card.ribbonGroup]
    : null;
  const accessibleLabel =
    ariaLabel ??
    `${card.month}월 ${card.name}, ${kindLabel}, 월값 ${monthValue}${selected ? ", 선택됨" : ""}${isDisabled ? ", 사용 불가" : ""}`;

  const content = (
    <>
      <header className="hwatu-card__header">
        <span className="hwatu-card__month">
          <strong>{card.month}</strong>
          <span>월</span>
        </span>
        <span className="hwatu-card__kind">{kindLabel}</span>
      </header>

      <div className="hwatu-card__motif">
        <span className="hwatu-card__month-name" aria-hidden="true">
          {card.monthName}
        </span>
        <strong className="hwatu-card__name">{card.name}</strong>
        <code className="hwatu-card__asset-tag">{card.assetTag}</code>
      </div>

      <div className="hwatu-card__value-row">
        <span className="hwatu-card__value">
          <strong>{monthValue}</strong>
          <span>월값</span>
        </span>
        {card.permanentKkeutBonus !== 0 ? (
          <span className="hwatu-card__bonus">
            {card.month}월 + 강화 {card.permanentKkeutBonus > 0 ? "+" : ""}
            {card.permanentKkeutBonus}
          </span>
        ) : (
          <span className="hwatu-card__bonus">이 패의 월 {card.month}</span>
        )}
      </div>

      <div className="hwatu-card__tags" aria-label="카드 태그">
        {ribbonLabel ? <span>{ribbonLabel}</span> : null}
        {card.tags.map((tag, index) => (
          <span key={`${tag}-${index}`}>#{tag}</span>
        ))}
      </div>

      {card.enhancement || card.edition || card.seal ? (
        <div className="hwatu-card__modifiers" aria-label="카드 강화">
          {card.enhancement ? (
            <span>손질 · {ENHANCEMENT_LABELS[card.enhancement]}</span>
          ) : null}
          {card.edition ? (
            <span>판본 · {EDITION_LABELS[card.edition]}</span>
          ) : null}
          {card.seal ? <span>낙관 · {SEAL_LABELS[card.seal]}</span> : null}
        </div>
      ) : null}

      <span className="hwatu-card__state" aria-hidden="true">
        {isDisabled
          ? "사용 불가"
          : selected && scoring
            ? "선택됨 · 점수 포함"
            : selected
              ? "선택됨"
              : scoring
                ? "점수 포함"
                : "선택 가능"}
      </span>
    </>
  );

  const rootClassName = joinClassNames(
    "hwatu-card",
    selected && "hwatu-card--selected",
    scoring && "hwatu-card--scoring",
    isDisabled && "hwatu-card--disabled",
    card.enhancement && `hwatu-card--enhancement-${card.enhancement}`,
    card.edition && `hwatu-card--edition-${card.edition}`,
    card.seal && `hwatu-card--seal-${card.seal}`,
    className,
  );

  const dataAttributes = {
    "data-testid": testId,
    "data-card-id": card.instanceId,
    "data-asset-tag": card.assetTag,
    "data-enhancement": card.enhancement,
    "data-edition": card.edition,
    "data-seal": card.seal,
  };

  if (!onSelect) {
    return (
      <article
        className={rootClassName}
        aria-label={accessibleLabel}
        {...dataAttributes}
      >
        {content}
      </article>
    );
  }

  return (
    <button
      type="button"
      className={rootClassName}
      aria-label={accessibleLabel}
      aria-pressed={selected}
      disabled={isDisabled}
      onClick={() => onSelect(card)}
      onFocus={() => onCardFocus?.(card)}
      {...dataAttributes}
    >
      {content}
    </button>
  );
}
