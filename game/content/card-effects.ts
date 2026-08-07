/**
 * Effect tags that can ride on a single card.
 *
 * These are LABELS ONLY for now. Nothing in the scoring engine reads them yet —
 * a card carrying `keeper_coin` behaves exactly like a plain card. The plan is
 * to wire each tag to real behaviour later; until then the tag is displayed on
 * the card and in its hover panel so the vocabulary can be play-tested first.
 *
 * When wiring one up, read `card.effectTagId` and branch in the relevant
 * engine module. Do NOT reuse `card.tags` — that array already drives kind and
 * yaku matching (`bird`, `rain`, `cup`), and a collision there is a scoring bug.
 *
 * Where each family will eventually hook in:
 *   as_bright / as_animal / as_ribbon  → `getEffectiveCardRole` in engine/deck,
 *     plus `matchesKind` in engine/collection-bonus and `hasKind` in engine/yaku.
 *     A card counting as two kinds means those helpers must return a SET, not a
 *     single kind — that refactor is the real cost of this family.
 *   extra_pi                           → `chaffValue` in `getEffectiveCardRole`.
 *   twin_kind                          → the counters in collection-bonus, which
 *     currently do `cards.length`; they would need a per-card weight instead.
 *   keeper_coin / gilded               → `finishRound` and `applyCardAftermath`.
 *   partner_boost / heavy_month / echo → ordered score effects in engine/scoring.
 */
export interface CardEffectTag {
  id: string;
  name: string;
  /** One line the player reads on the card. */
  description: string;
  /** Rough power, used to weight which tags a pack can roll. */
  weight: number;
  assetTag: string;
}

export const CARD_EFFECT_TAGS = [
  {
    id: "keeper_coin",
    name: "곳간패",
    description: "판이 끝날 때까지 손에 남아 있으면 3냥.",
    weight: 18,
    assetTag: "card-effect:keeper-coin",
  },
  {
    id: "partner_boost",
    name: "짝패",
    description: "다른 카드와 함께 제출하면 배수 +2.",
    weight: 18,
    assetTag: "card-effect:partner-boost",
  },
  {
    id: "heavy_month",
    name: "무거운 달",
    description: "득점하면 월 합 +50.",
    weight: 16,
    assetTag: "card-effect:heavy-month",
  },
  {
    id: "echo",
    name: "메아리패",
    description: "득점할 때 한 번 더 발동.",
    weight: 8,
    assetTag: "card-effect:echo",
  },
  {
    id: "drawn_luck",
    name: "행운패",
    description: "이 카드를 뽑은 손에서 버리기 1회 회복.",
    weight: 10,
    assetTag: "card-effect:drawn-luck",
  },
  {
    // Kind-bending tags. These change what the card counts AS, which is where
    // the deck-building gets interesting: a 6월 card that also counts as 광
    // opens the bright track to a month that never had one.
    id: "as_bright",
    name: "광 취급",
    description: "원래 종류에 더해 광으로도 셉니다.",
    weight: 7,
    assetTag: "card-effect:as-bright",
  },
  {
    id: "as_animal",
    name: "동물 취급",
    description: "원래 종류에 더해 동물로도 셉니다.",
    weight: 9,
    assetTag: "card-effect:as-animal",
  },
  {
    id: "as_ribbon",
    name: "띠 취급",
    description: "원래 종류에 더해 띠로도 셉니다.",
    weight: 9,
    assetTag: "card-effect:as-ribbon",
  },
  {
    id: "extra_pi",
    name: "덧피",
    description: "피값 +1. 피는 쌍피, 쌍피는 삼쌍피가 됩니다.",
    weight: 12,
    assetTag: "card-effect:extra-pi",
  },
  {
    id: "twin_kind",
    name: "쌍패",
    description: "제 종류로 두 장 취급. 광이면 쌍광, 동물이면 쌍동물입니다.",
    weight: 6,
    assetTag: "card-effect:twin-kind",
  },
  {
    id: "gilded",
    name: "금칠패",
    description: "득점하면 1냥.",
    weight: 14,
    assetTag: "card-effect:gilded",
  },
  {
    id: "stubborn",
    name: "고집패",
    description: "버릴 수 없지만 득점하면 배수 +3.",
    weight: 6,
    assetTag: "card-effect:stubborn",
  },
] as const satisfies readonly CardEffectTag[];

export const CARD_EFFECT_TAG_BY_ID = Object.fromEntries(
  CARD_EFFECT_TAGS.map((entry) => [entry.id, entry]),
) as Record<string, (typeof CARD_EFFECT_TAGS)[number]>;

/** Weighted pick, so the strong tags stay rare. */
export function rollCardEffectTag(roll: number): CardEffectTag {
  const total = CARD_EFFECT_TAGS.reduce((sum, entry) => sum + entry.weight, 0);
  let cursor = Math.min(Math.max(roll, 0), 0.999_999) * total;
  for (const entry of CARD_EFFECT_TAGS) {
    cursor -= entry.weight;
    if (cursor < 0) return entry;
  }
  return CARD_EFFECT_TAGS[CARD_EFFECT_TAGS.length - 1];
}
