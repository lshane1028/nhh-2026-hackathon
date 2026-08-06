import { describe, expect, it } from "vitest";
import {
  ALL_CONTENT_ASSET_TAGS,
  BOSSES,
  BOOKS,
  CONTENT_ACTUAL_COUNTS,
  CONTENT_CATALOG_COMPLETE,
  CONTENT_CATALOG_VALIDATION,
  CONTENT_EXPECTED_COUNTS,
  CONTRACTS,
  EDITIONS,
  ENHANCEMENTS,
  FORBIDDEN_CARDS,
  PACKS,
  PAINTER_CARDS,
  SEALS,
  START_DECKS,
  TALISMANS,
  WEATHER,
  assertContentCatalogComplete,
} from "../content";
import { createStandardHwatuDeck } from "../engine/deck";
import { findImmediateYakuCandidates } from "../engine/yaku";
import {
  calculateContractModifiers,
  calculateDiscountedPrice,
  calculateRoundReward,
  generateSeededOffers,
  purchaseShopOffer,
  rerollShop,
} from "../engine/economy";
import { createRngState } from "../engine/rng";
import { calculateHandScore } from "../engine/scoring";
import {
  buildOrderedTalismanScoreEffects,
  calculateTalismanGoFailureAdjustment,
  calculateTalismanRoundRewardAdjustment,
  calculateTalismanRoundRuleModifiers,
  evaluateTalismanEffects,
} from "../engine/talismans";
import type { CardInstance, TalismanInstance, YakuCandidate } from "../types";

const catalogEntries = [
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

function owned(definitionId: string, growth = 0): TalismanInstance {
  return { instanceId: `owned:${definitionId}`, definitionId, growth };
}

/** 1월 두 장이면 끗패는 1땡. 짓이 없으니 월 합은 1에서 시작한다. */
function januaryPair(): { cards: CardInstance[]; candidate: YakuCandidate } {
  const january = createStandardHwatuDeck().filter((card) => card.month === 1);
  const bright = january.find((card) => card.kind === "bright");
  const chaff = january.find((card) => card.kind === "chaff");
  if (!bright || !chaff) throw new Error("Standard January cards are incomplete");
  const cards = [bright, chaff];
  return {
    cards,
    candidate: {
      yakuId: "ttaeng",
      scoringCardIds: cards.map((card) => card.instanceId),
      jitCardIds: [],
      jitSum: 0,
      label: "땡",
    },
  };
}

describe("complete content catalog", () => {
  it("matches every required catalog count", () => {
    expect(CONTENT_ACTUAL_COUNTS).toEqual(CONTENT_EXPECTED_COUNTS);
    expect(CONTENT_CATALOG_VALIDATION.totalEntries).toBe(134);
    expect(CONTENT_CATALOG_COMPLETE).toBe(true);
    expect(assertContentCatalogComplete()).toBe(true);
  });

  it("has globally unique IDs and asset tags with usable descriptions", () => {
    expect(catalogEntries).toHaveLength(134);
    expect(new Set(catalogEntries.map((entry) => entry.id)).size).toBe(catalogEntries.length);
    expect(new Set(ALL_CONTENT_ASSET_TAGS).size).toBe(ALL_CONTENT_ASSET_TAGS.length);
    for (const entry of catalogEntries) {
      expect(entry.id).toMatch(/^[a-z0-9][a-z0-9:_-]*$/);
      expect(entry.assetTag.trim().length).toBeGreaterThan(0);
      expect(entry.description.trim().length).toBeGreaterThan(0);
    }
    expect(CONTENT_CATALOG_VALIDATION).toMatchObject({
      countMismatches: [],
      duplicateIds: [],
      duplicateAssetTags: [],
      missingDescriptions: [],
      missingAssetTags: [],
      missingBasicBookYakuIds: [],
    });
  });
});

describe("talisman engine", () => {
  it("turns ordered score talismans into scoring.ts operations", () => {
    const { cards, candidate } = januaryPair();
    const effects = buildOrderedTalismanScoreEffects({
      talismans: [owned("t_pair_knot")],
      candidate,
      submittedCards: cards,
      scoringCards: cards,
    });
    expect(effects).toEqual([
      expect.objectContaining({ sourceId: "owned:t_pair_knot", operation: "add_heung", value: 2 }),
    ]);

    const score = calculateHandScore({
      candidate,
      submittedCards: cards,
      orderedTalismanEffects: effects,
    });
    expect(score.finalHeung).toBe(10);
    expect(score.score).toBe(10);
  });

  it("pays 짓모루 per card sitting in the 짓", () => {
    const deck = createStandardHwatuDeck();
    // 짓 4월+6월 = 10, 끗패 1월광+3월광.
    const cards = [
      deck.find((card) => card.month === 4 && card.kind === "chaff")!,
      deck.find((card) => card.month === 6 && card.kind === "chaff")!,
      deck.find((card) => card.month === 1 && card.kind === "bright")!,
      deck.find((card) => card.month === 3 && card.kind === "bright")!,
    ];
    const candidate = findImmediateYakuCandidates(cards)[0];
    expect(candidate.jitCardIds).toHaveLength(2);

    const effects = buildOrderedTalismanScoreEffects({
      talismans: [owned("t_jit_anvil")],
      candidate,
      submittedCards: cards,
      scoringCards: cards,
    });
    expect(effects).toEqual([
      expect.objectContaining({ operation: "add_heung", value: 2 }),
    ]);

    // 짓이 없는 두 장 제출에는 아무것도 붙지 않는다.
    const bare = [cards[2], cards[3]];
    expect(buildOrderedTalismanScoreEffects({
      talismans: [owned("t_jit_anvil")],
      candidate: findImmediateYakuCandidates(bare)[0],
      submittedCards: bare,
      scoringCards: bare,
    })).toEqual([]);
  });

  it("evaluates every catalog effect key without unsafe score values", () => {
    const { cards, candidate } = januaryPair();
    const talismans = TALISMANS.map((definition) => owned(
      definition.id,
      definition.id === "t_cremation_deed" ? 0.16 : 0,
    ));
    const evaluated = evaluateTalismanEffects({
      talismans,
      candidate,
      submittedCards: cards,
      scoringCards: cards,
      newCollectionYakuIds: ["hongdan"],
      money: 20,
      emptyTalismanSlots: 2,
      successfulGoCount: 1,
      scoredMonthsThisRound: [1, 2, 3],
    });
    expect(evaluated.unknownDefinitionIds).toEqual([]);
    expect(evaluated.orderedScoreEffects.length).toBeGreaterThan(0);
    expect(evaluated.orderedScoreEffects.every((effect) =>
      Number.isFinite(effect.value)
      && ["add_kkeut", "add_heung", "multiply_heung", "set_kkeut"].includes(effect.operation)
    )).toBe(true);
    expect(evaluated.structuralEffects.some((effect) => effect.effectKey === "economy")).toBe(true);
    expect(evaluated.structuralEffects.some((effect) => effect.effectKey === "five_multiple_jit")).toBe(true);
  });

  it("provides round reward, Go-failure, and structural rule adjustments", () => {
    expect(calculateTalismanRoundRewardAdjustment({
      talismans: [owned("t_early_home")],
      won: true,
      remainingHands: 3,
    }).moneyDelta).toBe(3);
    expect(calculateTalismanGoFailureAdjustment({
      talismans: [owned("t_go_bond_deed")],
      failed: true,
    })).toMatchObject({ moneyDelta: -2, rescued: false });

    const rules = calculateTalismanRoundRuleModifiers([
      owned("t_leap_calendar"),
      owned("t_full_moon_screen"),
      owned("t_phoenix_seal"),
    ]);
    expect(rules).toMatchObject({
      allowsFiveMultipleJit: true,
      monthsCountingAsBright: [8],
      scoreThenBurnCopies: 2,
    });

    const cup = createStandardHwatuDeck().find((card) => card.tags.includes("cup"));
    if (!cup) throw new Error("Standard cup card is missing");
    const cupEffects = buildOrderedTalismanScoreEffects({
      talismans: [owned("t_chrysanthemum_cup")],
      candidate: { yakuId: "mangtong", scoringCardIds: [cup.instanceId], jitCardIds: [], jitSum: 0, label: "망통" },
      submittedCards: [cup],
      scoringCards: [cup],
    });
    expect(cupEffects).toContainEqual(expect.objectContaining({ operation: "add_kkeut", value: 9 }));
  });
});

describe("economy engine", () => {
  it("draws reproducible weighted offers without replacement", () => {
    const input = {
      category: "talisman" as const,
      count: 4,
      rng: createRngState("content-smoke"),
      discountRate: 0.15,
    };
    const first = generateSeededOffers(input);
    const second = generateSeededOffers(input);
    expect(first).toEqual(second);
    expect(first.value).toHaveLength(4);
    expect(new Set(first.value.map((offer) => offer.definitionId)).size).toBe(4);
    expect(first.state.cursor).toBe(4);
    expect(calculateDiscountedPrice(7, 0.15)).toBe(6);
  });

  it("rerolls and purchases without mutating the input", () => {
    const rerolled = rerollShop({
      category: "book",
      count: 3,
      rng: createRngState("reroll-smoke"),
      money: 9,
      baseRerollCost: 3,
      rerollsUsed: 0,
      costModifiers: { firstRerollFree: true, extraRerollIncrement: 1 },
    });
    expect(rerolled).toMatchObject({ success: true, charged: 0, moneyAfter: 9, nextRerollCost: 5 });
    expect(rerolled.offers).toHaveLength(3);

    const before = rerolled.offers.map((offer) => ({ ...offer }));
    const purchase = purchaseShopOffer(rerolled.offers, rerolled.offers[0].offerId, 9);
    expect(purchase).toMatchObject({ success: true, reason: "ok" });
    expect(purchase.purchasedOffer?.sold).toBe(true);
    expect(rerolled.offers).toEqual(before);
  });

  it("calculates reward tiers and cumulative contract upgrades", () => {
    expect(calculateRoundReward({
      won: true,
      remainingHands: 2,
      successfulGoCount: 1,
      goCollectionCompletions: 1,
      confirmedScore: 260,
      targetScore: 100,
    })).toMatchObject({ base: 4, remainingHands: 2, go: 1, collectionGo: 1, overkill: 2, total: 10 });

    const modifiers = calculateContractModifiers([
      "contract_extra_hand",
      "contract_extra_hand",
      "contract_talisman_pouch",
      "contract_regular_stamp@2",
      "contract_bargaining_sheet",
      "contract_bargaining_sheet",
    ]);
    expect(modifiers).toMatchObject({
      extraHands: 2,
      extraConsumableSlots: 1,
      extraTalismanSlots: 0,
      shopDiscountRate: 0.3,
      rerollBaseCostDelta: -1,
      fixedRerollIncrement: 0,
    });
  });
});
