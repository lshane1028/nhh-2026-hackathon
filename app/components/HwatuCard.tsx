"use client";

import { CARD_EFFECT_TAG_BY_ID } from "@/game/content/card-effects";
import type { CardInstance, CardKind } from "@/game/types";
import { getAtlasPosition } from "./hwatu-atlas";
import { getCardMarks, getCardModifierLines, getCardSurface } from "./card-visuals";
import { CardMark } from "./CardMark";

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
  const atlasPosition = getAtlasPosition(card);
  const ribbonLabel = card.ribbonGroup
    ? RIBBON_LABELS[card.ribbonGroup]
    : null;
  const accessibleLabel =
    ariaLabel ??
    `${card.month}월 ${card.name}, ${kindLabel}, 월값 ${monthValue}${splitRole === "jit" ? ", 짓" : splitRole === "kkeut" ? ", 끗패" : ""}${selected ? ", 선택됨" : ""}${isDisabled ? ", 사용 불가" : ""}`;

  const effectTag = card.effectTagId ? CARD_EFFECT_TAG_BY_ID[card.effectTagId] : undefined;
  // Every modifier gets its own sticker; only one may own the surface. A card
  // with four things on it must read as four things, not one muddy glow.
  const marks = getCardMarks(card);
  const surface = getCardSurface(card);
  const modifierLines = getCardModifierLines(card);

  /*
   * Pointer tilt, the trading-card trick: the pointer position becomes two CSS
   * variables and the transform is done in CSS. Written to the node directly
   * rather than through state, because this fires on every mousemove and a
   * re-render per frame would drop the hand to a crawl.
   */
  const tilt = (event: React.PointerEvent<HTMLElement>) => {
    const node = event.currentTarget;
    const box = node.getBoundingClientRect();
    const x = (event.clientX - box.left) / box.width - 0.5;
    const y = (event.clientY - box.top) / box.height - 0.5;
    node.style.setProperty("--tilt-x", `${(-y * 18).toFixed(2)}deg`);
    node.style.setProperty("--tilt-y", `${(x * 18).toFixed(2)}deg`);
    node.style.setProperty("--shine-x", `${((x + 0.5) * 100).toFixed(1)}%`);
    node.style.setProperty("--shine-y", `${((y + 0.5) * 100).toFixed(1)}%`);
  };
  const untilt = (event: React.PointerEvent<HTMLElement>) => {
    const node = event.currentTarget;
    node.style.removeProperty("--tilt-x");
    node.style.removeProperty("--tilt-y");
    node.style.removeProperty("--shine-x");
    node.style.removeProperty("--shine-y");
  };

  /* The face is the picture, a month corner, and one sticker per modifier.
     Everything else lives in the hover panel ABOVE the card — below it was off
     the bottom of the screen for the hand, which is the only place it matters. */
  const content = (
    <>
      <span
        className="hwatu-card__art"
        data-asset-tag={card.assetTag}
        style={{ backgroundPosition: atlasPosition }}
        aria-hidden="true"
      />
      {surface ? (
        <span className={`hwatu-card__surface hwatu-card__surface--${surface}`} aria-hidden="true" />
      ) : null}

      <span className="hwatu-card__corner" aria-hidden="true">{card.month}</span>
      {splitRole ? (
        <span className="hwatu-card__split" aria-hidden="true">{splitRole === "jit" ? "짓" : "끗"}</span>
      ) : null}

      {/* One mark per modifier, each in its own corner. Four can be on at once
          and none of them will ever land on another. */}
      {marks.map((mark) => (
        <span
          className={`hwatu-card__mark hwatu-card__mark--${mark.slot}`}
          key={mark.id}
          aria-hidden="true"
        >
          <CardMark sprite={mark.sprite} fill={mark.fill} highlight={mark.highlight} title={mark.label} />
        </span>
      ))}

      <span className="hwatu-card__hint" role="tooltip">
        <b>{card.month}월 {monthValue > card.month ? `+${monthValue - card.month}` : ""}</b>
        <em>{kindLabel}{ribbonLabel ? ` · ${ribbonLabel}` : ""}</em>
        <i>월값 {monthValue}</i>
        {modifierLines.map((line) => <u key={line}>{line}</u>)}
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
    surface ? `hwatu-card--has-${surface}` : undefined,
    effectTag && `hwatu-card--effect-${effectTag.id.replaceAll("_", "-")}`,
    className,
  );

  const detailTitle = [
    card.name,
    `월값 ${monthValue}`,
    ribbonLabel,
    ...modifierLines,
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
    onPointerMove: tilt,
    onPointerLeave: untilt,
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
