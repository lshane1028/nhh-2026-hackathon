"use client";

import { CARD_EFFECT_TAG_BY_ID } from "@/game/content/card-effects";
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
  /** Compact face for the fanned hand. Detail moves into the tooltip. */
  dense?: boolean;
  /** Which half of the 짓고땡 split this card is currently filling. */
  splitRole?: "jit" | "kkeut";
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
  dense = false,
  splitRole,
}: HwatuCardProps) {
  const isDisabled = disabled || Boolean(card.disabledForRound);
  const kindLabel = getCardKindLabel(card, cupRole);
  const monthValue = card.month + card.permanentKkeutBonus;
  const ribbonLabel = card.ribbonGroup
    ? RIBBON_LABELS[card.ribbonGroup]
    : null;
  const accessibleLabel =
    ariaLabel ??
    `${card.month}월 ${card.name}, ${kindLabel}, 월값 ${monthValue}${splitRole === "jit" ? ", 짓" : splitRole === "kkeut" ? ", 끗패" : ""}${selected ? ", 선택됨" : ""}${isDisabled ? ", 사용 불가" : ""}`;

  const effectTag = card.effectTagId ? CARD_EFFECT_TAG_BY_ID[card.effectTagId] : undefined;
  const modifierLabels = [
    card.enhancement ? ENHANCEMENT_LABELS[card.enhancement] : null,
    card.edition ? EDITION_LABELS[card.edition] : null,
    card.seal ? SEAL_LABELS[card.seal] : null,
  ].filter(Boolean) as string[];

  /* The face is the picture plus a month corner. Everything else lives in the
     hover card below, so a hand of eight reads as eight pictures. */
  const content = (
    <>
      <span className="hwatu-card__art" data-asset-tag={card.assetTag}>
        <span className="hwatu-card__art-mark" aria-hidden="true">IMG</span>
        <span className="hwatu-card__art-motif" aria-hidden="true">{card.monthName}</span>
        <code className="hwatu-card__art-tag">{card.assetTag}</code>
      </span>

      <span className="hwatu-card__corner" aria-hidden="true">{card.month}</span>
      {splitRole ? (
        <span className="hwatu-card__split" aria-hidden="true">{splitRole === "jit" ? "짓" : "끗"}</span>
      ) : null}
      {effectTag ? <span className="hwatu-card__effect" aria-hidden="true">효</span> : null}

      <span className="hwatu-card__hint" role="tooltip">
        <b>{card.month}월 {monthValue > card.month ? `+${monthValue - card.month}` : ""}</b>
        <em>{kindLabel}{ribbonLabel ? ` · ${ribbonLabel}` : ""}</em>
        <i>월값 {monthValue}</i>
        {effectTag ? <u>{effectTag.name} · {effectTag.description}</u> : null}
        {modifierLabels.length > 0 ? <u>{modifierLabels.join(" · ")}</u> : null}
        {isDisabled ? <s>이번 판 사용 불가</s> : null}
      </span>
    </>
  );

  const rootClassName = joinClassNames(
    "hwatu-card",
    dense && "hwatu-card--dense",
    selected && "hwatu-card--selected",
    scoring && "hwatu-card--scoring",
    splitRole && `hwatu-card--split-${splitRole}`,
    isDisabled && "hwatu-card--disabled",
    card.enhancement && `hwatu-card--enhancement-${card.enhancement}`,
    card.edition && `hwatu-card--edition-${card.edition}`,
    card.seal && `hwatu-card--seal-${card.seal}`,
    className,
  );

  const detailTitle = [
    card.name,
    `월값 ${monthValue}`,
    ribbonLabel,
    ...modifierLabels,
    effectTag ? `${effectTag.name}: ${effectTag.description}` : "",
    card.tags.map((tag) => `#${tag}`).join(" "),
  ]
    .filter(Boolean)
    .join(" · ");

  const dataAttributes = {
    "data-testid": testId,
    "data-card-id": card.instanceId,
    "data-asset-tag": card.assetTag,
    title: detailTitle,
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
