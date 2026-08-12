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
 * Loads one per-card WebP and attaches the shared atlas only if it fails.
 * Lossless editing PNGs stay outside the runtime bundle in source-assets.
 */
export function CardArt({ card, className }: CardArtProps) {
  return <CardArtSource key={card.assetTag} card={card} className={className} />;
}

type CardArtStage = "webp" | "atlas";

function CardArtSource({ card, className }: CardArtProps) {
  const sources = getCardArtSources(card);
  const [stage, setStage] = useState<CardArtStage>("webp");
  const frameStyle = stage === "atlas" ? {
    backgroundImage: `url("${sources.atlasUrl}")`,
    backgroundPosition: sources.atlasPosition,
    backgroundSize: "800% 600%",
    backgroundRepeat: "no-repeat",
  } : undefined;
  const imageUrl = sources.primaryUrl;

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
          onError={() => setStage("atlas")}
        />
      ) : null}
    </span>
  );
}
