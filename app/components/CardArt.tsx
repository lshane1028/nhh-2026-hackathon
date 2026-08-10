"use client";

import { useState } from "react";
import Image from "next/image";

import type { AtlasCard } from "./hwatu-atlas";
import { getCardArtSources } from "./hwatu-atlas";

interface CardArtProps {
  card: AtlasCard;
  className: string;
}

/**
 * Loads one per-card source at a time: WebP crop → source PNG → shared atlas.
 * Neither fallback is downloaded on the common path; the atlas is attached
 * only after both individual files fail.
 */
export function CardArt({ card, className }: CardArtProps) {
  return <CardArtSource key={card.assetTag} card={card} className={className} />;
}

type CardArtStage = "webp" | "png" | "atlas";

function CardArtSource({ card, className }: CardArtProps) {
  const sources = getCardArtSources(card);
  const [stage, setStage] = useState<CardArtStage>("webp");
  const frameStyle = stage === "atlas" ? {
    backgroundImage: `url("${sources.atlasUrl}")`,
    backgroundPosition: sources.atlasPosition,
    backgroundSize: "800% 600%",
    backgroundRepeat: "no-repeat",
  } : undefined;
  const imageUrl = stage === "webp" ? sources.primaryUrl : sources.fallbackUrl;

  return (
    <span
      className={`${className} card-art-frame`}
      data-asset-tag={card.assetTag}
      aria-hidden="true"
      style={frameStyle}
    >
      {stage !== "atlas" ? (
        <Image
          key={imageUrl}
          className="card-art-frame__image"
          src={imageUrl}
          width={320}
          height={480}
          unoptimized
          alt=""
          draggable={false}
          onError={() => setStage((current) => current === "webp" ? "png" : "atlas")}
        />
      ) : null}
    </span>
  );
}
