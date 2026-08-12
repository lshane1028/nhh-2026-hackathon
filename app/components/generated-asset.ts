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
  season: "seasons",
};

// Pack sizes are communicated by the price badge and copy. These files were
// byte-for-byte identical, so all sizes deliberately share one runtime image.
const GENERATED_ASSET_ALIASES: Readonly<Record<string, string>> = {
  "pack:book-medium": "pack:book-small",
  "pack:book-large": "pack:book-small",
  "pack:talisman-medium": "pack:talisman-small",
  "pack:talisman-large": "pack:talisman-small",
  "pack:burn-large": "pack:burn-small",
};

export function getGeneratedAssetUrl(assetTag: string): string | null {
  const resolvedTag = GENERATED_ASSET_ALIASES[assetTag] ?? assetTag;
  const separator = resolvedTag.indexOf(":");
  if (separator < 1) return null;

  const category = resolvedTag.slice(0, separator);
  const slug = resolvedTag.slice(separator + 1);
  const directory = GENERATED_ASSET_DIRECTORIES[category];

  if (!directory || !slug) return null;
  return `/assets/generated/${directory}/${slug}.webp`;
}
