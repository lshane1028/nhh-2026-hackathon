"use client";

import type { SyntheticEvent } from "react";
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
  const sources = getCardArtSources(card);
  const handleError = (event: SyntheticEvent<HTMLImageElement>) => {
    const image = event.currentTarget;
    const fallbackUrl = image.dataset.fallbackUrl;
    if (fallbackUrl) {
      delete image.dataset.fallbackUrl;
      image.removeAttribute("srcset");
      image.removeAttribute("sizes");
      image.src = fallbackUrl;
      return;
    }

    const frame = image.parentElement;
    if (frame) {
      frame.style.backgroundImage = `url("${sources.atlasUrl}")`;
      frame.style.backgroundPosition = sources.atlasPosition;
      frame.style.backgroundSize = "800% 600%";
      frame.style.backgroundRepeat = "no-repeat";
    }
    image.hidden = true;
  };

  return (
    <span
      className={`${className} card-art-frame`}
      data-asset-tag={card.assetTag}
      aria-hidden="true"
    >
      <Image
        className="card-art-frame__image"
        src={sources.primaryUrl}
        width={320}
        height={480}
        unoptimized
        data-fallback-url={sources.fallbackUrl}
        alt=""
        draggable={false}
        onError={handleError}
      />
    </span>
  );
}
