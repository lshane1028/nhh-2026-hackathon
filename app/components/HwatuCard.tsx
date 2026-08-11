"use client";

import { memo, useCallback, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { CARD_EFFECT_TAG_BY_ID } from "@/game/content/card-effects";
import type { CardInstance, CardKind } from "@/game/types";
import { CardArt } from "./CardArt";
import {
  getCardMaterial,
  getCardModifierLines,
  getCardShine,
  getCardSurface,
  MATERIAL_GLYPHS,
  MATERIAL_LABELS,
  SEAL_LABELS,
  SEAL_VISUALS,
  SURFACE_GLYPHS,
  SURFACE_LABELS,
} from "./card-visuals";
import { getFloatingHintPosition, type FloatingHintPosition } from "./tooltip-position";

export type HwatuCupRole = "animal" | "double_chaff" | "dual";

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
  if (cupRole === "dual") {
    return "동물·쌍피";
  }
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

export const HwatuCard = memo(function HwatuCard({
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
  const tooltipId = useId();
  const [hintPosition, setHintPosition] = useState<FloatingHintPosition | null>(null);
  const anchorRef = useRef<HTMLElement | null>(null);
  const hintRef = useRef<HTMLElement | null>(null);
  const pointerBoundsRef = useRef<DOMRect | null>(null);
  const hintVisible = hintPosition !== null;
  const isDisabled = disabled || Boolean(card.disabledForRound);
  const kindLabel = getCardKindLabel(card, cupRole);
  const scoreMonthBonus = card.permanentKkeutBonus;
  const ribbonLabel = card.ribbonGroup
    ? RIBBON_LABELS[card.ribbonGroup]
    : null;
  const accessibleLabel =
    ariaLabel ??
    `${card.month}월 ${card.name}, ${kindLabel}, 짓 계산 ${card.month}${scoreMonthBonus ? `, 득점 월 합 +${scoreMonthBonus}` : ""}${splitRole === "jit" ? ", 짓" : splitRole === "kkeut" ? ", 끗패" : ""}${selected ? ", 선택됨" : ""}${isDisabled ? ", 사용 불가" : ""}`;

  const effectTag = card.effectTagId ? CARD_EFFECT_TAG_BY_ID[card.effectTagId] : undefined;
  // Four categories, four channels: 각인 is what the card is MADE of, 판본 is how
  // it CATCHES LIGHT, 낙관 and the effect tag are things STUCK to it. Different
  // questions, so they cannot crowd each other out however many are on at once.
  const material = getCardMaterial(card);
  const surface = getCardSurface(card);
  const shine = getCardShine(card);
  const modifierLines = getCardModifierLines(card);

  const updateHintPosition = useCallback(() => {
    const anchor = anchorRef.current;
    if (!anchor) return;
    const hint = hintRef.current;
    setHintPosition(getFloatingHintPosition(
      anchor.getBoundingClientRect(),
      window.innerWidth,
      window.innerHeight,
      hint?.offsetWidth ?? 288,
      hint?.offsetHeight ?? 180,
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
    pointerBoundsRef.current = node.getBoundingClientRect();
    setHintPosition(getFloatingHintPosition(
      pointerBoundsRef.current,
      window.innerWidth,
      window.innerHeight,
      288,
      180,
    ));
  };
  const hideHint = () => {
    anchorRef.current = null;
    pointerBoundsRef.current = null;
    setHintPosition(null);
  };

  /*
   * Pointer tilt, the trading-card trick.
   *
   * All this does is publish where the pointer is, as a plain number from -0.5
   * to 0.5 on each axis. How far that leans the card, and how much of the foil
   * it lights, are decisions in game-ui.css — which is what lets reduced-motion
   * turn the amplitude down without JS being involved.
   *
   * Written straight onto the node instead of through state: this fires on
   * every mousemove, and a re-render per frame would drag the whole hand down.
   */
  const tilt = (event: React.PointerEvent<HTMLElement>) => {
    const node = event.currentTarget;
    const box = pointerBoundsRef.current ?? node.getBoundingClientRect();
    pointerBoundsRef.current = box;
    const x = (event.clientX - box.left) / box.width - 0.5;
    const y = (event.clientY - box.top) / box.height - 0.5;
    node.style.setProperty("--pointer-x", x.toFixed(3));
    node.style.setProperty("--pointer-y", y.toFixed(3));
    node.style.setProperty("--shine-x", `${((x + 0.5) * 100).toFixed(1)}%`);
    node.style.setProperty("--shine-y", `${((y + 0.5) * 100).toFixed(1)}%`);
    node.style.setProperty("--shadow-x", `${(-x * 18).toFixed(1)}px`);
    node.style.setProperty("--shadow-y", `${(12 - y * 12).toFixed(1)}px`);
  };
  const untilt = (event: React.PointerEvent<HTMLElement>) => {
    const node = event.currentTarget;
    node.style.removeProperty("--pointer-x");
    node.style.removeProperty("--pointer-y");
    node.style.removeProperty("--shine-x");
    node.style.removeProperty("--shine-y");
    node.style.removeProperty("--shadow-x");
    node.style.removeProperty("--shadow-y");
  };

  /* The face is the picture, a month corner, and one sticker per modifier.
     Everything else lives in the hover panel ABOVE the card — below it was off
     the bottom of the screen for the hand, which is the only place it matters. */
  const content = (
    <>
      <CardArt className="hwatu-card__art" card={card} />
      {/* Material first: it is the card stock, so everything else sits on top. */}
      {material ? (
        <span className={`hwatu-card__material hwatu-card__material--${material}`} aria-hidden="true" />
      ) : null}
      {surface ? (
        <span className={`hwatu-card__surface hwatu-card__surface--${surface}`} aria-hidden="true" />
      ) : null}
      {shine ? (
        <span className={`hwatu-card__shine hwatu-card__shine--${shine}`} aria-hidden="true" />
      ) : null}

      {material ? (
        <span className="hwatu-card__modifier-badge hwatu-card__modifier-badge--material" aria-hidden="true">
          <b>{MATERIAL_GLYPHS[material]}</b><small>{MATERIAL_LABELS[material]}</small>
        </span>
      ) : null}
      {surface ? (
        <span className="hwatu-card__modifier-badge hwatu-card__modifier-badge--surface" aria-hidden="true">
          <b>{SURFACE_GLYPHS[surface]}</b><small>{SURFACE_LABELS[surface]}</small>
        </span>
      ) : null}
      {card.seal ? (
        <span className={`hwatu-card__seal hwatu-card__seal--${card.seal}`} aria-hidden="true">
          <b>{SEAL_VISUALS[card.seal].glyph}</b>
          <small>{SEAL_LABELS[card.seal]} · {SEAL_VISUALS[card.seal].cue}</small>
        </span>
      ) : null}

      {effectTag ? (
        <span className="hwatu-card__effect-field" aria-hidden="true" />
      ) : null}

      <span className="hwatu-card__corner" aria-hidden="true">{card.month}</span>
      {splitRole ? (
        <span className="hwatu-card__split" aria-hidden="true">{splitRole === "jit" ? "짓" : "끗"}</span>
      ) : null}

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
    `짓 계산 ${card.month}`,
    scoreMonthBonus ? `득점 월 합 +${scoreMonthBonus}` : null,
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
    onPointerEnter: (event: React.PointerEvent<HTMLElement>) => showHint(event.currentTarget),
    onPointerLeave: (event: React.PointerEvent<HTMLElement>) => {
      untilt(event);
      hideHint();
    },
  };

  const hint = hintPosition && typeof document !== "undefined"
    ? createPortal(
        <span
          ref={hintRef}
          id={tooltipId}
          className="hwatu-card__hint hwatu-card__hint--portal"
          data-placement={hintPosition.placement}
          role="tooltip"
          style={{ left: hintPosition.left, top: hintPosition.top }}
        >
          <b>{card.month}월</b>
          <em>{kindLabel}{ribbonLabel ? ` · ${ribbonLabel}` : ""}</em>
          <i>짓 계산 {card.month}{scoreMonthBonus ? ` · 득점 월 합 +${scoreMonthBonus}` : ""}</i>
          {modifierLines.map((line) => <u key={line}>{line}</u>)}
          {isDisabled ? <s>이번 판 사용 불가</s> : null}
        </span>,
        document.body,
      )
    : null;

  if (!onSelect) {
    return (
      <>
        <article
          className={rootClassName}
          aria-label={accessibleLabel}
          aria-describedby={hintPosition ? tooltipId : undefined}
          tabIndex={0}
          onFocus={(event) => showHint(event.currentTarget)}
          onBlur={hideHint}
          {...dataAttributes}
        >
          {content}
        </article>
        {hint}
      </>
    );
  }

  return (
    <>
      <button
        type="button"
        className={rootClassName}
        aria-label={accessibleLabel}
        aria-describedby={hintPosition ? tooltipId : undefined}
        aria-pressed={selected}
        disabled={isDisabled}
        onClick={() => onSelect(card)}
        onFocus={(event) => {
          onCardFocus?.(card);
          showHint(event.currentTarget);
        }}
        onBlur={hideHint}
        {...dataAttributes}
      >
        {content}
      </button>
      {hint}
    </>
  );
});
