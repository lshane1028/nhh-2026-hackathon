export * from "./bosses";
export * from "./cards";
export * from "./meta";
export * from "./stages";
export * from "./talismans";
export * from "./upgrades";
export * from "./yaku";

import { BOSSES } from "./bosses";
import { CONTRACTS, PACKS, START_DECKS, WEATHER } from "./meta";
import { TALISMANS } from "./talismans";
import {
  BOOKS,
  EDITIONS,
  ENHANCEMENTS,
  FORBIDDEN_CARDS,
  PAINTER_CARDS,
  SEALS,
} from "./upgrades";

export const CONTENT_EXPECTED_COUNTS = {
  talismans: 58,
  painters: 15,
  forbidden: 10,
  books: 22,
  enhancements: 8,
  editions: 4,
  seals: 4,
  startDecks: 10,
  bosses: 12,
  packs: 2,
  contractPairs: 8,
  weather: 4,
} as const;

export const CONTENT_ACTUAL_COUNTS = {
  talismans: TALISMANS.length,
  painters: PAINTER_CARDS.length,
  forbidden: FORBIDDEN_CARDS.length,
  books: BOOKS.length,
  enhancements: ENHANCEMENTS.length,
  editions: EDITIONS.length,
  seals: SEALS.length,
  startDecks: START_DECKS.length,
  bosses: BOSSES.length,
  packs: PACKS.length,
  contractPairs: CONTRACTS.length,
  weather: WEATHER.length,
} as const;

export const BASIC_IMMEDIATE_YAKU_BOOK_IDS = [
  "mangtong",
  "kkeut",
  "gabo",
  "seryuk",
  "jangsa",
  "jangpping",
  "gupping",
  "doksa",
  "ali",
  "ttaeng",
  "jangttaeng",
] as const;

interface CatalogValidationEntry {
  id: string;
  name: string;
  description: string;
  assetTag: string;
}

const ALL_CATALOG_ENTRIES: readonly CatalogValidationEntry[] = [
  ...TALISMANS,
  ...PAINTER_CARDS,
  ...FORBIDDEN_CARDS,
  ...BOOKS,
  ...ENHANCEMENTS,
  ...EDITIONS,
  ...SEALS,
  ...START_DECKS,
  ...BOSSES,
  ...PACKS,
  ...CONTRACTS,
  ...WEATHER,
];

function findDuplicates(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  for (const value of values) {
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  }

  return [...duplicates].sort();
}

const countMismatches = Object.entries(CONTENT_EXPECTED_COUNTS)
  .filter(([key, expected]) => {
    const actual = CONTENT_ACTUAL_COUNTS[key as keyof typeof CONTENT_ACTUAL_COUNTS];
    return actual !== expected;
  })
  .map(([key, expected]) => ({
    category: key,
    expected,
    actual: CONTENT_ACTUAL_COUNTS[key as keyof typeof CONTENT_ACTUAL_COUNTS],
  }));

const presentBookYakuIds = new Set<string>(BOOKS.map((book) => book.yakuId));
const missingBasicBookYakuIds = BASIC_IMMEDIATE_YAKU_BOOK_IDS.filter(
  (yakuId) => !presentBookYakuIds.has(yakuId),
);

export const ALL_CONTENT_ASSET_TAGS = ALL_CATALOG_ENTRIES.map((entry) => entry.assetTag);

export const CONTENT_CATALOG_VALIDATION = {
  expectedCounts: CONTENT_EXPECTED_COUNTS,
  actualCounts: CONTENT_ACTUAL_COUNTS,
  totalEntries: ALL_CATALOG_ENTRIES.length,
  countMismatches,
  duplicateIds: findDuplicates(ALL_CATALOG_ENTRIES.map((entry) => entry.id)),
  duplicateAssetTags: findDuplicates(ALL_CONTENT_ASSET_TAGS),
  missingDescriptions: ALL_CATALOG_ENTRIES.filter(
    (entry) => entry.description.trim().length === 0,
  ).map((entry) => entry.id),
  missingAssetTags: ALL_CATALOG_ENTRIES.filter(
    (entry) => entry.assetTag.trim().length === 0,
  ).map((entry) => entry.id),
  missingBasicBookYakuIds,
} as const;

export const CONTENT_CATALOG_COMPLETE =
  CONTENT_CATALOG_VALIDATION.countMismatches.length === 0 &&
  CONTENT_CATALOG_VALIDATION.duplicateIds.length === 0 &&
  CONTENT_CATALOG_VALIDATION.duplicateAssetTags.length === 0 &&
  CONTENT_CATALOG_VALIDATION.missingDescriptions.length === 0 &&
  CONTENT_CATALOG_VALIDATION.missingAssetTags.length === 0 &&
  CONTENT_CATALOG_VALIDATION.missingBasicBookYakuIds.length === 0;

/** 테스트와 부트스트랩에서 전체 카탈로그 누락을 즉시 실패시키는 검증 함수. */
export function assertContentCatalogComplete(): true {
  if (!CONTENT_CATALOG_COMPLETE) {
    throw new Error(
      `Incomplete content catalog: ${JSON.stringify(CONTENT_CATALOG_VALIDATION)}`,
    );
  }
  return true;
}
