"use client";

import { memo, useCallback, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import type {
  TalismanDefinition,
  TalismanInstance,
} from "@/game/types";
import { getTalismanTimingText } from "@/game/content/talismans";

import { getGeneratedAssetUrl } from "./generated-asset";
import { getFloatingHintPosition } from "./tooltip-position";

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
  onReorder?: (instanceId: string, targetInstanceId: string) => void;
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
  return getFloatingHintPosition(rect, viewportWidth, viewportHeight, tooltipWidth, tooltipHeight);
}

interface TalismanSlotProps {
  item: TalismanStripItem;
  selected: boolean;
  sacrifice: boolean;
  firing: boolean;
  onSelect?: (item: TalismanStripItem) => void;
  onReorder?: (instanceId: string, targetInstanceId: string) => void;
  previousInstanceId?: string;
  nextInstanceId?: string;
}

function TalismanSlot({
  item,
  selected,
  sacrifice,
  firing,
  onSelect,
  onReorder,
  previousInstanceId,
  nextInstanceId,
}: TalismanSlotProps) {
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
            <span aria-hidden="true">符</span>
          </>
        )}
      </span>
      <strong className="talisman-strip__name">{item.definition.name}</strong>
      {sacrifice ? <span className="talisman-strip__sacrifice-badge" aria-hidden="true">제물</span> : null}
    </>
  );

  return (
    <>
      {onSelect || onReorder ? (
        <button
          type="button"
          {...commonProps}
          aria-pressed={selected}
          aria-keyshortcuts={onReorder ? "ArrowLeft ArrowRight" : undefined}
          aria-label={`${item.definition.name}${sacrifice ? ", 전승 제물로 영구 파괴 예정" : ""}`}
          disabled={item.disabled}
          draggable={Boolean(onReorder) && !item.disabled}
          onDragStart={(event) => {
            event.dataTransfer.effectAllowed = "move";
            event.dataTransfer.setData("text/plain", item.instance.instanceId);
          }}
          onDragOver={(event) => {
            if (!onReorder) return;
            event.preventDefault();
            event.dataTransfer.dropEffect = "move";
          }}
          onDrop={(event) => {
            if (!onReorder) return;
            event.preventDefault();
            const sourceId = event.dataTransfer.getData("text/plain");
            if (sourceId) onReorder(sourceId, item.instance.instanceId);
          }}
          onKeyDown={(event) => {
            if (!onReorder) return;
            const targetId = event.key === "ArrowLeft"
              ? previousInstanceId
              : event.key === "ArrowRight"
                ? nextInstanceId
                : undefined;
            if (!targetId) return;
            event.preventDefault();
            onReorder(item.instance.instanceId, targetId);
          }}
          onClick={() => onSelect?.(item)}
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
            <small className="talisman-strip__hint-timing">{getTalismanTimingText(item.definition)}</small>
            {item.instance.edition === "engraved" ? <u>음각 · 이 부적을 보유하는 동안 부적 칸 +1</u> : null}
            {item.instance.growth !== 0 ? <i>성장 +{item.instance.growth}</i> : null}
            {item.contributionLabel ? <u>{item.contributionLabel}</u> : null}
          </aside>,
          document.body,
        )
        : null}
    </>
  );
}

export const TalismanStrip = memo(function TalismanStrip({
  assetTag,
  items,
  slots,
  selectedInstanceId,
  sacrificeInstanceId,
  firingInstanceId,
  onSelect,
  onReorder,
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
              onReorder={onReorder}
              previousInstanceId={items[index - 1]?.instance.instanceId}
              nextInstanceId={items[index + 1]?.instance.instanceId}
            />
          );
        })}
      </div>
    </section>
  );
});
