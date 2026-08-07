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

export function getGeneratedAssetUrl(assetTag: string): string | null {
  const separator = assetTag.indexOf(":");
  if (separator < 1) return null;

  const category = assetTag.slice(0, separator);
  const slug = assetTag.slice(separator + 1);
  const directory = GENERATED_ASSET_DIRECTORIES[category];

  if (!directory || !slug) return null;
  return `/assets/generated/${directory}/${slug}.webp`;
}
