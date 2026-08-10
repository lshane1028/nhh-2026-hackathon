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
    expect(CONTENT_CATALOG_VALIDATION.totalEntries).toBe(157);
    expect(CONTENT_CATALOG_COMPLETE).toBe(true);
    expect(assertContentCatalogComplete()).toBe(true);
  });

  it("has globally unique IDs and asset tags with usable descriptions", () => {
    expect(catalogEntries).toHaveLength(157);
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

  it("declares exact, data-driven targeting for every forbidden card", () => {
    expect(Object.fromEntries(FORBIDDEN_CARDS.map((entry) => [
      entry.id,
      [entry.targetKind, entry.minTargets, entry.maxTargets, "additionalCost" in entry ? entry.additionalCost : 0],
    ]))).toEqual({
      f_first_full_moon: ["card", 2, 5, 0],
      f_clone_ritual: ["card", 1, 1, 0],
      f_bright_descent: ["card", 1, 1, 6],
      f_white_chaff: ["card", 1, 5, 0],
      f_monthless: ["card", 1, 1, 0],
      f_great_burn: ["none", 0, 0, 0],
      f_talisman_possession: ["talisman", 1, 1, 0],
      f_twelve_ritual: ["none", 0, 0, 0],
      f_inheritance: ["talisman", 1, 1, 0],
      f_spirit: ["none", 0, 0, 0],
    });

    for (const entry of FORBIDDEN_CARDS) {
      expect(entry.targetPrompt.trim().length).toBeGreaterThan(0);
      expect(entry.minTargets).toBeLessThanOrEqual(entry.maxTargets);
      if (entry.targetKind === "none") expect([entry.minTargets, entry.maxTargets]).toEqual([0, 0]);
    }
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

  it("pays the jokers that read the rest of the board", () => {
    const { cards, candidate } = januaryPair();
    const deck = createStandardHwatuDeck();
    const heldBrights = deck.filter((card) => card.kind === "bright").slice(0, 2);

    const only = (talismanId: string, extra: Record<string, unknown> = {}) =>
      buildOrderedTalismanScoreEffects({
        talismans: [owned(talismanId)],
        candidate,
        submittedCards: cards,
        scoringCards: cards,
        ...extra,
      });

    // 미련 — 손에 남긴 카드 3장 × 0.5.
    expect(only("t_lingering_hand", { heldCards: deck.slice(0, 3) })).toEqual([
      expect.objectContaining({ operation: "add_heung", value: 1.5 }),
    ]);
    expect(only("t_lingering_hand", { heldCards: [] })).toEqual([]);

    // 달 지킴이 — 손에 든 광 2장이면 1.4^2.
    const moonlit = only("t_moonlit_keep", { heldCards: heldBrights })[0];
    expect(moonlit.operation).toBe("multiply_heung");
    expect(moonlit.value).toBeCloseTo(1.96, 5);

    // 곳간 셈 — 남은 버리기 3회 × 40.
    expect(only("t_thrift_granary", { discardsRemaining: 3 })).toEqual([
      expect.objectContaining({ operation: "add_kkeut", value: 120 }),
    ]);

    // 삯꾼 주판 — 다른 부적들의 값만 세고 자기 값은 빼야 한다.
    const abacus = buildOrderedTalismanScoreEffects({
      talismans: [owned("t_haggler_abacus"), owned("t_first_charm"), owned("t_empty_shrine")],
      candidate,
      submittedCards: cards,
      scoringCards: cards,
    }).filter((effect) => effect.sourceId === "owned:t_haggler_abacus");
    const otherPrices = TALISMANS
      .filter((entry) => entry.id === "t_first_charm" || entry.id === "t_empty_shrine")
      .reduce((sum, entry) => sum + entry.price, 0);
    expect(abacus).toEqual([
      expect.objectContaining({ operation: "add_heung", value: Math.floor(otherPrices / 3) }),
    ]);

    // 빼곡한 사당 — 빈 칸이 0일 때만.
    expect(only("t_crowded_shrine", { emptyTalismanSlots: 0 })).toEqual([
      expect.objectContaining({ operation: "multiply_heung", value: 1.8 }),
    ]);
    expect(only("t_crowded_shrine", { emptyTalismanSlots: 1 })).toEqual([]);

    // 첫맛 — 이번 런에서 이미 두 번 낸 끗패면 꺼진다.
    expect(only("t_first_taste", { yakusPlayed: { ttaeng: 1 } })).toEqual([
      expect.objectContaining({ operation: "multiply_heung", value: 1.9 }),
    ]);
    expect(only("t_first_taste", { yakusPlayed: { ttaeng: 2 } })).toEqual([]);

    // 긴 짓 도둑 — 짓 합 30 이상.
    const bigJit = { ...candidate, jitSum: 30, jitCardIds: ["a", "b", "c"] };
    expect(buildOrderedTalismanScoreEffects({
      talismans: [owned("t_long_jit_thief")],
      candidate: bigJit,
      submittedCards: cards,
      scoringCards: cards,
    })).toEqual([expect.objectContaining({ operation: "multiply_heung", value: 2.2 })]);
    expect(only("t_long_jit_thief")).toEqual([]);
  });

  it("turns 망통 into a 월 합 multiplier rather than a dead hand", () => {
    const { cards } = januaryPair();
    const mangtong: YakuCandidate = {
      yakuId: "mangtong",
      scoringCardIds: cards.map((card) => card.instanceId),
      jitCardIds: ["x", "y"],
      jitSum: 20,
      label: "망통",
    };
    const effects = buildOrderedTalismanScoreEffects({
      talismans: [owned("t_mangtong_lover")],
      candidate: mangtong,
      submittedCards: cards,
      scoringCards: cards,
    });
    // 짓 20 → ×3이므로 +40.
    expect(effects).toEqual([expect.objectContaining({ operation: "add_kkeut", value: 40 })]);
  });

  it("pays the named-hand jokers only on their exact 끗패, and pays more for rarer ones", () => {
    const { cards } = januaryPair();
    const hand = (yakuId: YakuCandidate["yakuId"]): YakuCandidate => ({
      yakuId,
      scoringCardIds: cards.map((card) => card.instanceId),
      jitCardIds: [],
      jitSum: 0,
      label: yakuId,
    });
    const fire = (talismanId: string, yakuId: YakuCandidate["yakuId"]) =>
      buildOrderedTalismanScoreEffects({
        talismans: [owned(talismanId)],
        candidate: hand(yakuId),
        submittedCards: cards,
        scoringCards: cards,
      });

    // 알리 부적은 알리에만 붙는다.
    expect(fire("t_ali_charm", "ali")).toEqual([
      expect.objectContaining({ operation: "multiply_heung", value: 1.8 }),
      expect.objectContaining({ operation: "add_kkeut", value: 40 }),
    ]);
    expect(fire("t_ali_charm", "gabo")).toEqual([]);

    // 광땡 부적은 세 광땡 모두, 삼팔 봉인은 38광땡만.
    for (const id of ["gwangttaeng_13", "gwangttaeng_18", "gwangttaeng_38"] as const) {
      expect(fire("t_gwangttaeng_charm", id).length).toBeGreaterThan(0);
    }
    expect(fire("t_sampal_seal", "gwangttaeng_13")).toEqual([]);
    expect(fire("t_sampal_seal", "gwangttaeng_38").length).toBeGreaterThan(0);

    // 좁을수록 크게 갚아야 한다: 38광땡 > 광땡 아무거나 > 장땡 > 알리.
    const factorOf = (talismanId: string, yakuId: YakuCandidate["yakuId"]) =>
      fire(talismanId, yakuId).find((effect) => effect.operation === "multiply_heung")?.value ?? 1;
    expect(factorOf("t_sampal_seal", "gwangttaeng_38"))
      .toBeGreaterThan(factorOf("t_gwangttaeng_charm", "gwangttaeng_38"));
    expect(factorOf("t_gwangttaeng_charm", "gwangttaeng_38"))
      .toBeGreaterThan(factorOf("t_jangttaeng_charm", "jangttaeng"));
    expect(factorOf("t_jangttaeng_charm", "jangttaeng"))
      .toBeGreaterThan(factorOf("t_ali_charm", "ali"));
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
