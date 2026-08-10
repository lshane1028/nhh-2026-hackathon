import type { CardInstance } from "../types";

/**
 * Effect tags that can ride on a single card.
 *
 * Every tag is a live mechanic. Score effects emit ordered operations so the
 * submission theater can replay the same arithmetic the engine used.
 *
 * When wiring one up, read `card.effectTagId` and branch in the relevant
 * engine module. Do NOT reuse `card.tags` — that array already drives kind and
 * yaku matching (`bird`, `rain`, `cup`), and a collision there is a scoring bug.
 *
 * Where each family is resolved:
 *   as_bright / as_animal / as_ribbon  → the multi-kind helpers in engine/deck,
 *     shared by yaku, collections, and kind-reading talismans.
 *   extra_pi / twin_kind               → effective 피 value and per-track
 *     collection contribution in engine/deck.
 *   keeper_coin / gilded               → `finishRound` and `applyCardAftermath`.
 *   partner_boost / heavy_month / echo → per-card operations in engine/scoring.
 *   drawn_luck                         → draw/refill handling in state/game.
 */
export interface CardEffectTag {
  id: string;
  name: string;
  /** Large, readable mark painted on the card face. */
  icon: string;
  /** Short mechanical cue that remains legible at hand size. */
  cue: string;
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
    icon: "냥",
    cue: "보유 +3냥",
    description: "판이 끝날 때까지 손에 남아 있으면 3냥.",
    weight: 18,
    assetTag: "card-effect:keeper-coin",
  },
  {
    id: "partner_boost",
    name: "짝패",
    icon: "짝",
    cue: "함께 배수 +2",
    description: "다른 카드와 함께 제출하면 배수 +2.",
    weight: 18,
    assetTag: "card-effect:partner-boost",
  },
  {
    id: "heavy_month",
    name: "무거운 달",
    icon: "+50",
    cue: "득점 월합 +50",
    description: "득점하면 월 합 +50.",
    weight: 16,
    assetTag: "card-effect:heavy-month",
  },
  {
    id: "echo",
    name: "메아리패",
    icon: "×2",
    cue: "득점 재발동",
    description: "득점할 때 한 번 더 발동.",
    weight: 8,
    assetTag: "card-effect:echo",
  },
  {
    id: "drawn_luck",
    name: "행운패",
    icon: "+1",
    cue: "버리기 +1",
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
    icon: "光",
    cue: "광으로도 셈",
    description: "원래 종류에 더해 광으로도 셉니다.",
    weight: 7,
    assetTag: "card-effect:as-bright",
  },
  {
    id: "as_animal",
    name: "동물 취급",
    icon: "獸",
    cue: "동물로도 셈",
    description: "원래 종류에 더해 동물로도 셉니다.",
    weight: 9,
    assetTag: "card-effect:as-animal",
  },
  {
    id: "as_ribbon",
    name: "띠 취급",
    icon: "帶",
    cue: "띠로도 셈",
    description: "원래 종류에 더해 띠로도 셉니다.",
    weight: 9,
    assetTag: "card-effect:as-ribbon",
  },
  {
    id: "extra_pi",
    name: "덧피",
    icon: "+1피",
    cue: "피값 +1",
    description: "피값 +1. 피는 쌍피, 쌍피는 삼쌍피가 됩니다.",
    weight: 12,
    assetTag: "card-effect:extra-pi",
  },
  {
    id: "twin_kind",
    name: "쌍패",
    icon: "×2",
    cue: "제 종류 2장",
    description: "제 종류로 두 장 취급. 광이면 쌍광, 동물이면 쌍동물입니다.",
    weight: 6,
    assetTag: "card-effect:twin-kind",
  },
  {
    id: "gilded",
    name: "금칠패",
    icon: "+1냥",
    cue: "득점 +1냥",
    description: "득점하면 1냥.",
    weight: 14,
    assetTag: "card-effect:gilded",
  },
  {
    id: "stubborn",
    name: "고집패",
    icon: "固",
    cue: "못 버림 · 배수 +3",
    description: "버릴 수 없지만 득점하면 배수 +3.",
    weight: 6,
    assetTag: "card-effect:stubborn",
  },
] as const satisfies readonly CardEffectTag[];

export const CARD_EFFECT_TAG_BY_ID = Object.fromEntries(
  CARD_EFFECT_TAGS.map((entry) => [entry.id, entry]),
) as Record<string, (typeof CARD_EFFECT_TAGS)[number]>;

const SAME_KIND_EFFECT_BY_KIND = {
  bright: "as_bright",
  animal: "as_animal",
  ribbon: "as_ribbon",
} as const;

type EffectBearingCard = {
  kind: "bright" | "animal" | "ribbon" | "chaff";
};

/**
 * A kind-bending effect must add a second kind, never restate the kind already
 * printed on the card. Keeping this rule beside the effect catalogue gives
 * every pack generator the same compatibility check.
 */
export function isCardEffectCompatible(
  effectTagId: string,
  card: EffectBearingCard,
): boolean {
  return SAME_KIND_EFFECT_BY_KIND[card.kind as keyof typeof SAME_KIND_EFFECT_BY_KIND] !== effectTagId;
}

/**
 * Cleans cards created by an older build (or changed to a new kind later).
 * Returning the original object for the common path keeps state normalization
 * cheap and preserves referential equality when nothing needs fixing.
 */
export function removeRedundantKindEffect(card: CardInstance): CardInstance {
  if (!card.effectTagId || isCardEffectCompatible(card.effectTagId, card)) return card;
  return { ...card, effectTagId: undefined };
}

function rollFromPool(roll: number, pool: readonly CardEffectTag[]): CardEffectTag {
  const total = pool.reduce((sum, entry) => sum + entry.weight, 0);
  let cursor = Math.min(Math.max(roll, 0), 0.999_999) * total;
  for (const entry of pool) {
    cursor -= entry.weight;
    if (cursor < 0) return entry;
  }
  return pool[pool.length - 1];
}

/** Weighted pick, so the strong tags stay rare. */
export function rollCardEffectTag(roll: number): CardEffectTag {
  return rollFromPool(roll, CARD_EFFECT_TAGS);
}

/** Weighted pick that cannot roll a redundant same-kind treatment. */
export function rollCardEffectTagForCard(roll: number, card: EffectBearingCard): CardEffectTag {
  return rollFromPool(roll, CARD_EFFECT_TAGS.filter((entry) => isCardEffectCompatible(entry.id, card)));
}
