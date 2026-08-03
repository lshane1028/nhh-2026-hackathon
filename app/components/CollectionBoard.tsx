"use client";

export type CollectionTrackKind = "bright" | "animal" | "ribbon" | "chaff";

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
  confirmedCount: number;
  pendingCount?: number;
  /** animal/ribbon track length. Bright is always 5 and chaff is always 10. */
  slotCount?: number;
  description?: string;
  milestones?: readonly CollectionMilestone[];
}

export interface CollectionBoardProps {
  assetTag: string;
  items: readonly CollectionBoardItem[];
  className?: string;
}

function joinClassNames(...values: Array<string | false | undefined>): string {
  return values.filter(Boolean).join(" ");
}

function normalizedSlotCount(item: CollectionBoardItem): number {
  if (item.kind === "bright") return 5;
  if (item.kind === "chaff") return 10;
  return Math.max(1, Math.floor(item.slotCount ?? 10));
}

export function CollectionBoard({
  assetTag,
  items,
  className,
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
        <p>모은 패가 밝아지고, 표시된 구간마다 효과가 강해집니다.</p>
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
                  <div>
                    <strong>{item.name}</strong>
                    {item.description ? <span>{item.description}</span> : null}
                  </div>
                  <b aria-label={`${item.name} ${total}개 수집`}>{total}</b>
                </div>

                <div className="collection-board__track-body">
                  <div
                    className="collection-board__slots"
                    role="progressbar"
                    aria-label={`${item.name} 수집 진행`}
                    aria-valuemin={0}
                    aria-valuemax={slotCount}
                    aria-valuenow={Math.min(total, slotCount)}
                  >
                    {Array.from({ length: slotCount }, (_, index) => (
                      <span
                        aria-hidden="true"
                        className={joinClassNames(
                          "collection-board__slot",
                          index < total && "collection-board__slot--filled",
                          index >= confirmedCount &&
                            index < total &&
                            "collection-board__slot--pending",
                        )}
                        key={index}
                      />
                    ))}
                    {overflow > 0 ? (
                      <strong className="collection-board__overflow">+{overflow}</strong>
                    ) : null}
                  </div>

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
