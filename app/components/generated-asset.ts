const GENERATED_ASSET_DIRECTORIES: Readonly<Record<string, string>> = {
  talisman: "talismans",
  book: "books",
  forbidden: "forbidden",
  painter: "painters",
  pack: "packs",
  boss: "bosses",
  "card-effect": "card-effects",
  enhancement: "modifiers",
  edition: "modifiers",
  seal: "modifiers",
};

/**
 * Catalog entries that intentionally fall back to their labelled UI tile until
 * bespoke art is added. Returning a URL for these used to hide that fallback
 * and leave a completely blank card after the inevitable 404.
 */
const UNAVAILABLE_GENERATED_ASSET_TAGS = new Set([
  "book:hongdan",
  "book:chodan",
  "book:cheongdan",
  "book:godori",
  "book:rain-three-brights",
  "book:three-brights",
  "book:four-brights",
  "book:five-brights",
  "boss:falling-first",
  "boss:drought",
  "boss:dark-cloud",
  "boss:ribbon-scissors",
  "boss:lost-pair-moon",
  "boss:tax-collector",
  "boss:reversed-screen",
  "boss:go-bond",
]);

export function getGeneratedAssetUrl(assetTag: string): string | null {
  if (UNAVAILABLE_GENERATED_ASSET_TAGS.has(assetTag)) return null;
  const separator = assetTag.indexOf(":");
  if (separator < 1) return null;

  const category = assetTag.slice(0, separator);
  const slug = assetTag.slice(separator + 1);
  const directory = GENERATED_ASSET_DIRECTORIES[category];

  if (!directory || !slug) return null;
  return `/assets/generated/${directory}/${slug}.webp`;
}
