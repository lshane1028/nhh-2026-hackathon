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

  it("resolves newly drawn current-rule forbidden and boss art", () => {
    expect(getGeneratedAssetUrl("forbidden:eight-directions")).toBe("/assets/generated/forbidden/eight-directions.webp");
    expect(getGeneratedAssetUrl("boss:go-bond")).toBe("/assets/generated/bosses/go-bond.webp");
  });

  it("keeps all four seasonal encounter scenes available", () => {
    for (const slug of ["spring-stranger", "summer-stranger", "autumn-stranger", "winter-stranger"]) {
      const url = getGeneratedAssetUrl(`season:${slug}`)!;
      expect(existsSync(fileURLToPath(new URL(`../../public${url}`, import.meta.url))), url).toBe(true);
    }
  });
});
