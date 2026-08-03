"use client";

import type {
  TalismanDefinition,
  TalismanInstance,
} from "@/game/types";

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
        <div>
          <span>부적 · {items.length}/{slots}칸</span>
          <strong>보유한 동안 항상 발동</strong>
        </div>
        <code>{assetTag}</code>
      </div>

      <div className="talisman-strip__slots">
        {Array.from({ length: slotCount }, (_, index) => {
          const item = items[index];

          if (!item) {
            return (
              <div
                className="talisman-strip__empty"
                data-asset-tag={`${assetTag}:empty:${index + 1}`}
                key={`empty-${index}`}
              >
                <span className="talisman-strip__empty-mark" aria-hidden="true">
                  +
                </span>
                <strong>빈 부적 칸 {index + 1}</strong>
                <span>장터에서 구매하면 이곳에 장착됩니다</span>
              </div>
            );
          }

          const isSelected = selectedInstanceId === item.instance.instanceId;
          const itemContent = (
            <>
              <div className="talisman-strip__item-heading">
                <div>
                  <span>{RARITY_LABELS[item.definition.rarity]} 부적</span>
                  <strong>{item.definition.name}</strong>
                </div>
                <code>{item.definition.assetTag}</code>
              </div>
              <span className="talisman-strip__always-on">
                항상 발동 중
              </span>
              <p className="talisman-strip__description">
                {item.definition.description}
              </p>
              <div className="talisman-strip__meta">
                <span>{item.definition.price}냥</span>
                {item.instance.growth !== 0 ? (
                  <span>성장 +{item.instance.growth}</span>
                ) : null}
                {item.contributionLabel ? (
                  <strong>{item.contributionLabel}</strong>
                ) : null}
              </div>
            </>
          );
          const itemClassName = joinClassNames(
            "talisman-strip__item",
            isSelected && "talisman-strip__item--selected",
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
