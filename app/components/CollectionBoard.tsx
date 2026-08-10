"use client";

import type { CollectionSlot } from "@/game/engine/collection-board";
import { getCardArtUrl } from "./hwatu-atlas";

export type CollectionTrackKind =
  | "bright"
  | "animal"
  | "godori"
  | "ribbon"
  | "chaff";

export interface CollectionMilestone {
  at: number;
  label: string;
  reward?: string;
  /** Use for combination milestones such as Godori or colored ribbon sets. */
  active?: boolean;
}

export interface CollectionBoardItem {
  id: string;
  name: string;
  kind: CollectionTrackKind;
  assetTag: string;
  iconUrl?: string;
  confirmedCount: number;
  pendingCount?: number;
  /**
   * animal/ribbon track length. Bright is always 5, godori always 3, and
   * chaff always 10.
   */
  slotCount?: number;
  /** Per-slot labels, used by the godori track to name 2·4·8월. */
  slotLabels?: readonly string[];
  /**
   * Explicit per-slot state. Tracks whose slots mean specific cards (godori)
   * must pass this, otherwise slots fill left to right from the counts.
   */
  slotStates?: readonly ("empty" | "confirmed" | "pending")[];
  /**
   * Real cards from the deck. When present the row draws pictures instead of
   * blank pips, and `slotCount` is ignored — the deck decides the length.
   *
   * 피 passes only what has been COLLECTED rather than every candidate, since
   * the deck holds two dozen of them and their identity does not matter. Its
   * 쌍피 are marked with a value badge so the running total still adds up.
   */
  cards?: readonly CollectionSlot[];
  description?: string;
  milestones?: readonly CollectionMilestone[];
}

export interface CollectionBoardProps {
  assetTag: string;
  items: readonly CollectionBoardItem[];
  className?: string;
  scoreLabel?: string;
}

function joinClassNames(...values: Array<string | false | undefined>): string {
  return values.filter(Boolean).join(" ");
}

function normalizedSlotCount(item: CollectionBoardItem): number {
  if (item.kind === "bright") return 5;
  if (item.kind === "godori") return 3;
  if (item.kind === "chaff") return 10;
  return Math.max(1, Math.floor(item.slotCount ?? 10));
}

/**
 * One card in a picture row.
 *
 * Uncollected cards are dimmed and desaturated rather than hidden, so the row
 * doubles as a checklist of what is still out there. A card the deck holds more
 * than once gets a stacked edge behind it plus a count, because a bare "×2" on
 * a single picture reads as a score multiplier — the stack is what makes the
 * "two of these" reading the obvious one.
 */
function CollectionCard({ slot }: { slot: CollectionSlot }) {
  const held = slot.collectedCount + slot.pendingCount;
  const state = slot.collectedCount >= slot.deckCount
    ? "confirmed"
    : held > 0
      ? "pending"
      : "empty";
  const duplicated = slot.deckCount > 1;
  const badge = duplicated
    ? held > 0 && held < slot.deckCount
      ? `${held}/${slot.deckCount}`
      : `×${slot.deckCount}`
    : null;

  const title = [
    `${slot.month}월 ${slot.name}`,
    slot.chaffValue === 2 ? "쌍피 · 두 칸" : null,
    duplicated ? `덱에 ${slot.deckCount}장` : null,
    state === "confirmed" ? "수집 완료" : state === "pending" ? "이번 손에 포함" : "아직 없음",
  ].filter(Boolean).join(" · ");

  return (
    <span
      className={joinClassNames(
        "collection-card",
        `collection-card--${state}`,
        duplicated && "collection-card--stacked",
      )}
      title={title}
      aria-label={title}
      data-asset-tag={slot.assetTag}
    >
      <span
        className="collection-card__art"
        style={{ backgroundImage: `url("${getCardArtUrl(slot)}")` }}
        aria-hidden="true"
      />
      <span className="collection-card__month" aria-hidden="true">{slot.month}</span>
      {slot.chaffValue === 2 ? (
        <b className="collection-card__value" aria-hidden="true">2점</b>
      ) : null}
      {badge ? <b className="collection-card__count" aria-hidden="true">{badge}</b> : null}
    </span>
  );
}

export function CollectionBoard({
  assetTag,
  items,
  className,
  scoreLabel,
}: CollectionBoardProps) {
  return (
    <section
      className={joinClassNames("collection-board", className)}
      aria-label="수집판"
      data-asset-tag={assetTag}
    >
      <header className="collection-board__header">
        <div>
          <span>COLLECTION</span>
          <strong>수집판</strong>
        </div>
        <p>{scoreLabel ?? "고스톱 기본 점수 · 비결서를 사면 추가 특전이 열립니다."}</p>
      </header>

      {items.length === 0 ? (
        <p className="collection-board__empty">아직 모은 패가 없습니다.</p>
      ) : (
        <div className="collection-board__items">
          {items.map((item) => {
            const slotCount = normalizedSlotCount(item);
            const confirmedCount = Math.max(0, Math.floor(item.confirmedCount));
            const pendingCount = Math.max(0, Math.floor(item.pendingCount ?? 0));
            const total = confirmedCount + pendingCount;
            const overflow = Math.max(0, total - slotCount);

            return (
              <article
                className={joinClassNames(
                  "collection-board__track",
                  `collection-board__track--${item.kind}`,
                )}
                data-asset-tag={item.assetTag}
                key={item.id}
              >
                <div className="collection-board__track-heading">
                  {/* Image slot for the track's own picture. */}
                  <span
                    className="collection-board__icon collection-board__icon--art"
                    data-asset-tag={item.assetTag}
                    style={item.iconUrl ? { backgroundImage: `url("${item.iconUrl}")` } : undefined}
                  >
                    {!item.iconUrl ? <span aria-hidden="true">IMG</span> : null}
                  </span>
                  <div>
                    <strong>{item.name}</strong>
                    {item.description ? <span>{item.description}</span> : null}
                  </div>
                  <b aria-label={`${item.name} ${total}개 수집`}>{total}</b>
                </div>

                <div className="collection-board__track-body">
                  {/* An empty picture list is not a picture row. 피 only lists what
                      has been taken, so before the first hand it has nothing to
                      draw and has to fall back to the notches. */}
                  {item.cards && item.cards.length > 0 ? (
                    <div className="collection-board__cards" aria-label={`${item.name} 수집 카드`}>
                      {item.cards.map((slot) => (
                        <CollectionCard key={slot.originId} slot={slot} />
                      ))}
                    </div>
                  ) : (
                  <div
                    className="collection-board__slots"
                    role="progressbar"
                    aria-label={`${item.name} 수집 진행`}
                    aria-valuemin={0}
                    aria-valuemax={slotCount}
                    aria-valuenow={Math.min(total, slotCount)}
                  >
                    {Array.from({ length: slotCount }, (_, index) => {
                      const slotState = item.slotStates?.[index]
                        ?? (index >= total
                          ? "empty"
                          : index >= confirmedCount
                            ? "pending"
                            : "confirmed");

                      return (
                        <span
                          aria-hidden="true"
                          className={joinClassNames(
                            "collection-board__slot",
                            slotState !== "empty" && "collection-board__slot--filled",
                            slotState === "pending" && "collection-board__slot--pending",
                          )}
                          key={index}
                        >
                          {item.slotLabels?.[index] ?? null}
                        </span>
                      );
                    })}
                    {overflow > 0 ? (
                      <strong className="collection-board__overflow">+{overflow}</strong>
                    ) : null}
                  </div>
                  )}

                  {item.milestones?.length ? (
                    <div className="collection-board__milestones" aria-label={`${item.name} 효과 구간`}>
                      {item.milestones.map((milestone) => {
                        const isActive = milestone.active ?? total >= milestone.at;

                        return (
                          <span
                            className={joinClassNames(
                              "collection-board__milestone",
                              isActive && "collection-board__milestone--active",
                            )}
                            key={`${milestone.at}-${milestone.label}`}
                          >
                            <b>{milestone.at}</b>
                            {milestone.label}
                            {milestone.reward ? <em>{milestone.reward}</em> : null}
                          </span>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
