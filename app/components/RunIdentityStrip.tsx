import type { RunIdentityTag } from "@/game/state/run-identity";

import "./run-identity.css";

export function RunIdentityStrip({ tags, compact = false }: {
  tags: readonly RunIdentityTag[];
  compact?: boolean;
}) {
  return (
    <section className={`run-identity${compact ? " run-identity--compact" : ""}`} aria-label="이번 덱의 강점">
      <strong>이번 덱</strong>
      <div>
        {tags.map((tag) => (
          <span key={tag.id}>
            <b>{tag.label}</b>
            <small>{tag.detail}</small>
          </span>
        ))}
      </div>
    </section>
  );
}
