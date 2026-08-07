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

/**
 * Text-only stand-in for a future visual asset. The asset tag is deliberately
 * visible so screenshots and accessibility trees never hide provenance IDs.
 */
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
      aria-label={`${label}, 에셋 태그 ${assetTag}${description ? `, ${description}` : ""}`}
      data-asset-tag={assetTag}
      style={generatedArtUrl ? { "--generated-art": `url("${generatedArtUrl}")` } as React.CSSProperties : undefined}
    >
      <span className="asset-placeholder__marker" aria-hidden="true">
        ASSET
      </span>
      <span className="asset-placeholder__copy">
        <strong className="asset-placeholder__label">{label}</strong>
        {description ? (
          <span className="asset-placeholder__description">{description}</span>
        ) : null}
      </span>
      <code className="asset-placeholder__tag">{assetTag}</code>
    </div>
  );
}

