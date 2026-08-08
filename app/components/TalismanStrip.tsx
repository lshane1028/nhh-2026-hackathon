"use client";

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

export function TalismanStrip({
  assetTag,
  items,
  slots,
  selectedInstanceId,
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

          const isSelected = selectedInstanceId === item.instance.instanceId;
          const artUrl = getGeneratedAssetUrl(item.definition.assetTag);
          const itemContent = (
            <>
              <span
                className={joinClassNames(
                  "talisman-strip__art",
                  Boolean(artUrl) && "talisman-strip__art--generated",
                )}
                data-asset-tag={item.definition.assetTag}
                style={artUrl ? { backgroundImage: `url("${artUrl}")` } : undefined}
              >
                <span aria-hidden="true">IMG</span>
                <code>{item.definition.assetTag}</code>
              </span>
              <strong className="talisman-strip__name">{item.definition.name}</strong>

              <span className="talisman-strip__hint" role="tooltip">
                <b>{item.definition.name}</b>
                <em>{RARITY_LABELS[item.definition.rarity]} · {item.definition.price}냥</em>
                <p>{item.definition.description}</p>
                {item.instance.growth !== 0 ? <i>성장 +{item.instance.growth}</i> : null}
                {item.contributionLabel ? <u>{item.contributionLabel}</u> : null}
              </span>
            </>
          );
          const itemClassName = joinClassNames(
            "talisman-strip__item",
            isSelected && "talisman-strip__item--selected",
            firingInstanceId === item.instance.instanceId && "talisman-strip__item--firing",
            item.disabled && "talisman-strip__item--disabled",
          );

          if (!onSelect) {
            return (
              <article
                className={itemClassName}
                data-asset-tag={item.definition.assetTag}
                key={item.instance.instanceId}
              >
                {itemContent}
              </article>
            );
          }

          return (
            <button
              type="button"
              className={itemClassName}
              key={item.instance.instanceId}
              aria-pressed={isSelected}
              disabled={item.disabled}
              onClick={() => onSelect(item)}
              data-asset-tag={item.definition.assetTag}
            >
              {itemContent}
            </button>
          );
        })}
      </div>
    </section>
  );
}
