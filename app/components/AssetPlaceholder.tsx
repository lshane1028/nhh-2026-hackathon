import type { AriaRole } from "react";

import { getGeneratedAssetUrl } from "./generated-asset";
import "./game-ui.css";

export type AssetPlaceholderTone =
  | "neutral"
  | "card"
  | "score"
  | "collection"
  | "talisman"
  | "boss";

export interface AssetPlaceholderProps {
  assetTag: string;
  label?: string;
  description?: string;
  tone?: AssetPlaceholderTone;
  compact?: boolean;
  className?: string;
  role?: AriaRole;
  id?: string;
}

function joinClassNames(...values: Array<string | false | undefined>): string {
  return values.filter(Boolean).join(" ");
}

/** Visual fallback that never leaks internal asset identifiers to players. */
export function AssetPlaceholder({
  assetTag,
  label = "텍스트 에셋",
  description,
  tone = "neutral",
  compact = false,
  className,
  role = "img",
  id,
}: AssetPlaceholderProps) {
  const generatedArtUrl = getGeneratedAssetUrl(assetTag);

  return (
    <div
      id={id}
      className={joinClassNames(
        "asset-placeholder",
        `asset-placeholder--${tone}`,
        compact && "asset-placeholder--compact",
        className,
      )}
      role={role}
      aria-label={`${label}${description ? `, ${description}` : ""}`}
      data-asset-tag={assetTag}
      style={generatedArtUrl ? { "--generated-art": `url("${generatedArtUrl}")` } as React.CSSProperties : undefined}
    >
      <span className="asset-placeholder__marker" aria-hidden="true">
        花
      </span>
      <span className="asset-placeholder__copy">
        <strong className="asset-placeholder__label">{label}</strong>
        {description ? (
          <span className="asset-placeholder__description">{description}</span>
        ) : null}
      </span>
    </div>
  );
}

