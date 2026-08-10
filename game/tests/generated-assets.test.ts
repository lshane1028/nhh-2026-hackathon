import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { getGeneratedAssetUrl } from "../../app/components/generated-asset";
import { ALL_CONTENT_ASSET_TAGS } from "../content";

describe("generated content art resolver", () => {
  it("never advertises a generated image that is absent from public assets", () => {
    ALL_CONTENT_ASSET_TAGS.forEach((assetTag) => {
      const url = getGeneratedAssetUrl(assetTag);
      if (!url) return;
      const path = fileURLToPath(new URL(`../../public${url}`, import.meta.url));
      expect(existsSync(path), `${assetTag} resolved to missing ${url}`).toBe(true);
    });
  });

  it("keeps labelled fallbacks visible for catalog art that has not been drawn", () => {
    expect(getGeneratedAssetUrl("forbidden:eight-directions")).toBeNull();
    expect(getGeneratedAssetUrl("boss:go-bond")).toBeNull();
  });
});
