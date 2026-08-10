"use client";

import { useCallback, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import type {
  TalismanDefinition,
  TalismanInstance,
} from "@/game/types";

import { getGeneratedAssetUrl } from "./generated-asset";

export interface TalismanStripItem {
  instance: TalismanInstance;
  definition: TalismanDefinition;
  contributionLabel?: string;
  disabled?: boolean;
}

export interface TalismanStripProps {
  assetTag: string;
  items: readonly TalismanStripItem[];
  slots: number;
  selectedInstanceId?: string | null;
  /** A neighbouring talisman that will be destroyed if the selection resolves. */
  sacrificeInstanceId?: string | null;
  /**
   * The talisman firing right now during a score reveal. Talismans stay on
   * screen after a hand is submitted — unlike the cards, which have already
   * left the hand — so this is where "that joker just did something" can
   * actually be seen.
   */
  firingInstanceId?: string | null;
  onSelect?: (item: TalismanStripItem) => void;
  className?: string;
}

function joinClassNames(...values: Array<string | false | undefined>): string {
  return values.filter(Boolean).join(" ");
}

const RARITY_LABELS: Record<TalismanDefinition["rarity"], string> = {
  common: "일반",
  uncommon: "고급",
  rare: "희귀",
  legendary: "전설",
};

export interface TalismanHintPosition {
  left: number;
  top: number;
  placement: "above" | "below";
}

interface TalismanAnchorRect {
  left: number;
  top: number;
  bottom: number;
  width: number;
}

export function getTalismanHintPosition(
  rect: TalismanAnchorRect,
  viewportWidth: number,
  viewportHeight: number,
  tooltipWidth = 320,
  tooltipHeight = 180,
): TalismanHintPosition {
  const margin = 12;
  const gap = 10;
  const width = Math.min(tooltipWidth, Math.max(0, viewportWidth - margin * 2));
  const height = Math.min(tooltipHeight, Math.max(0, viewportHeight - margin * 2));
  const minimumLeft = margin + width / 2;
  const maximumLeft = Math.max(minimumLeft, viewportWidth - margin - width / 2);
  const availableBelow = viewportHeight - margin - rect.bottom - gap;
  const availableAbove = rect.top - gap - margin;
  const placement = availableBelow >= height || availableBelow >= availableAbove
    ? "below"
    : "above";
  const preferredTop = placement === "below"
    ? rect.bottom + gap
    : rect.top - gap - height;
  const maximumTop = Math.max(margin, viewportHeight - margin - height);

  return {
    left: Math.min(maximumLeft, Math.max(minimumLeft, rect.left + rect.width / 2)),
    top: Math.min(maximumTop, Math.max(margin, preferredTop)),
    placement,
  };
}

interface TalismanSlotProps {
  item: TalismanStripItem;
  selected: boolean;
  sacrifice: boolean;
  firing: boolean;
  onSelect?: (item: TalismanStripItem) => void;
}

function TalismanSlot({ item, selected, sacrifice, firing, onSelect }: TalismanSlotProps) {
  const tooltipId = useId();
  const [hintPosition, setHintPosition] = useState<TalismanHintPosition | null>(null);
  const anchorRef = useRef<HTMLElement | null>(null);
  const hintRef = useRef<HTMLElement | null>(null);
  const hintVisible = hintPosition !== null;
  const artUrl = getGeneratedAssetUrl(item.definition.assetTag);
  const itemClassName = joinClassNames(
    "talisman-strip__item",
    selected && "talisman-strip__item--selected",
    sacrifice && "talisman-strip__item--sacrifice",
    firing && "talisman-strip__item--firing",
    item.disabled && "talisman-strip__item--disabled",
  );

  const updateHintPosition = useCallback(() => {
    const anchor = anchorRef.current;
    if (!anchor) return;

    const hint = hintRef.current;
    const next = getTalismanHintPosition(
      anchor.getBoundingClientRect(),
      window.innerWidth,
      window.innerHeight,
      hint?.offsetWidth ?? 320,
      hint?.offsetHeight ?? 180,
    );
    setHintPosition((current) => (
      current
      && current.left === next.left
      && current.top === next.top
      && current.placement === next.placement
        ? current
        : next
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

  const showHint = (target: HTMLElement) => {
    anchorRef.current = target;
    setHintPosition(getTalismanHintPosition(
      target.getBoundingClientRect(),
      window.innerWidth,
      window.innerHeight,
    ));
  };
  const hideHint = () => {
    anchorRef.current = null;
    setHintPosition(null);
  };
  const commonProps = {
    className: itemClassName,
    "data-asset-tag": item.definition.assetTag,
    "aria-describedby": hintPosition ? tooltipId : undefined,
    onPointerEnter: (event: React.PointerEvent<HTMLElement>) => showHint(event.currentTarget),
    onPointerLeave: hideHint,
    onFocus: (event: React.FocusEvent<HTMLElement>) => showHint(event.currentTarget),
    onBlur: hideHint,
  };
  const content = (
    <>
      <span
        className={joinClassNames(
          "talisman-strip__art",
          Boolean(artUrl) && "talisman-strip__art--generated",
        )}
        data-asset-tag={item.definition.assetTag}
      >
        {artUrl ? (
          // Native img avoids optimizer resampling and cover-cropping the pixel art.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={artUrl} alt="" draggable={false} aria-hidden="true" />
        ) : (
          <>
            <span aria-hidden="true">IMG</span>
            <code>{item.definition.assetTag}</code>
          </>
        )}
      </span>
      <strong className="talisman-strip__name">{item.definition.name}</strong>
      {sacrifice ? <span className="talisman-strip__sacrifice-badge" aria-hidden="true">제물</span> : null}
    </>
  );

  return (
    <>
      {onSelect ? (
        <button
          type="button"
          {...commonProps}
          aria-pressed={selected}
          aria-label={`${item.definition.name}${sacrifice ? ", 전승 제물로 영구 파괴 예정" : ""}`}
          disabled={item.disabled}
          onClick={() => onSelect(item)}
        >
          {content}
        </button>
      ) : (
        <article {...commonProps}>{content}</article>
      )}
      {hintPosition && typeof document !== "undefined"
        ? createPortal(
          <aside
            ref={hintRef}
            id={tooltipId}
            className="talisman-strip__hint talisman-strip__hint--portal"
            data-placement={hintPosition.placement}
            role="tooltip"
            style={{ left: hintPosition.left, top: hintPosition.top }}
          >
            {artUrl ? (
              // Keep the complete generated art visible inside the measured portal.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                className="talisman-strip__hint-art"
                src={artUrl}
                alt={`${item.definition.name} 부적 그림`}
                draggable={false}
              />
            ) : null}
            <b>{item.definition.name}</b>
            <em>{RARITY_LABELS[item.definition.rarity]} · {item.definition.price}냥</em>
            <p>{item.definition.description}</p>
            {item.instance.growth !== 0 ? <i>성장 +{item.instance.growth}</i> : null}
            {item.contributionLabel ? <u>{item.contributionLabel}</u> : null}
          </aside>,
          document.body,
        )
        : null}
    </>
  );
}

export function TalismanStrip({
  assetTag,
  items,
  slots,
  selectedInstanceId,
  sacrificeInstanceId,
  firingInstanceId,
  onSelect,
  className,
}: TalismanStripProps) {
  const slotCount = Math.max(slots, items.length);

  return (
    <section
      className={joinClassNames("talisman-strip", className)}
      aria-label={`부적 ${items.length}/${slots}`}
      data-asset-tag={assetTag}
    >
      <div className="talisman-strip__header">
        <span>부적 {items.length}/{slots}</span>
        <em>가지고 있는 동안 매 손 자동으로 발동합니다</em>
      </div>

      <div className="talisman-strip__slots">
        {Array.from({ length: slotCount }, (_, index) => {
          const item = items[index];

          // Empty slots are just dashed outlines — no label, no instructions.
          if (!item) {
            return (
              <div
                className="talisman-strip__empty"
                aria-hidden="true"
                data-asset-tag={`${assetTag}:empty:${index + 1}`}
                key={`empty-${index}`}
              />
            );
          }

          return (
            <TalismanSlot
              key={item.instance.instanceId}
              item={item}
              selected={selectedInstanceId === item.instance.instanceId}
              sacrifice={sacrificeInstanceId === item.instance.instanceId}
              firing={firingInstanceId === item.instance.instanceId}
              onSelect={onSelect}
            />
          );
        })}
      </div>
    </section>
  );
}
