import { describe, expect, it } from "vitest";
import type { CollectionYakuId } from "../types";
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
import { calculateCollectionBonus } from "../engine/collection-bonus";
import { getBookLevelPreview } from "../engine/book-preview";
import { findImmediateYakuCandidates } from "../engine/yaku";
import { ALL_IMMEDIATE_YAKU_DEFINITIONS, getYakuDisplayName } from "../content/yaku";
import {
  CARD_EFFECT_TAGS,
  isCardEffectCompatible,
  rollCardEffectTagForCard,
} from "../content/card-effects";
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
import type { CardInstance, TalismanDefinition, TalismanInstance, YakuCandidate } from "../types";

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
  it("keeps workshop pack sizes and prices on the requested tiers", () => {
    const category = (name: "card" | "book" | "talisman") => PACKS.filter((pack) => pack.category === name);
    for (const name of ["card", "book", "talisman"] as const) {
      expect(category(name).map((pack) => [pack.choices, pack.picks])).toEqual([[3, 1], [5, 2], [7, 3]]);
      const prices = category(name).map((pack) => pack.price);
      expect(prices[2] - prices[1]).toBeGreaterThan(prices[1] - prices[0]);
    }
    expect(PACKS.filter((pack) => pack.category === "burn").map((pack) => [pack.choices, pack.picks]))
      .toEqual([[2, 2], [4, 4]]);
    const burnPrices = PACKS.filter((pack) => pack.category === "burn").map((pack) => pack.price);
    expect(burnPrices[1]).toBeGreaterThan(burnPrices[0] * 2);
    category("talisman").forEach((pack, index) => {
      expect(pack.price).toBeGreaterThan(category("book")[index].price);
      expect(category("book")[index].price).toBeGreaterThan(category("card")[index].price);
    });
  });
  it("never exposes internal English ids as 끗패 names", () => {
    expect(getYakuDisplayName("ttaeng")).toBe("땡");
    expect(getYakuDisplayName("jangttaeng")).toBe("장땡");
    expect(getYakuDisplayName("unknown-id")).toBe("기록된 끗패");
  });

  it("matches every required catalog count", () => {
    const expectedTotal = Object.values(CONTENT_EXPECTED_COUNTS).reduce((sum, count) => sum + count, 0);
    expect(CONTENT_ACTUAL_COUNTS).toEqual(CONTENT_EXPECTED_COUNTS);
    expect(CONTENT_CATALOG_VALIDATION.totalEntries).toBe(expectedTotal);
    expect(CONTENT_CATALOG_COMPLETE).toBe(true);
    expect(assertContentCatalogComplete()).toBe(true);
  });

  it("has globally unique IDs and asset tags with usable descriptions", () => {
    const expectedTotal = Object.values(CONTENT_EXPECTED_COUNTS).reduce((sum, count) => sum + count, 0);
    expect(catalogEntries).toHaveLength(expectedTotal);
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

  it("explains the exact before and after values of every kind of book", () => {
    expect(getBookLevelPreview("gabo", 1)).toEqual({
      current: "Lv.1 · 기본 배수 4",
      next: "Lv.2 · 기본 배수 4.3",
    });
    expect(getBookLevelPreview("four_brights", 1)).toEqual({
      current: "Lv.1 · 완성 4점 · 고 목표 추가 -0%",
      next: "Lv.2 · 완성 5점 · 고 목표 추가 -5%",
    });
    expect(getBookLevelPreview("hongdan", 1).next).toContain("완성 시 버리기 +1");
    expect(getBookLevelPreview("godori", 1).next).toContain("짓 5의 배수 허용");
  });

  it("makes every 비결서 change the live scoring rule it describes", () => {
    const deck = createStandardHwatuDeck();
    const immediateIds = new Set<string>(ALL_IMMEDIATE_YAKU_DEFINITIONS.map((entry) => entry.id));
    const sampleCards = deck.slice(0, 2);

    for (const book of BOOKS.filter((entry) => immediateIds.has(entry.yakuId))) {
      const definition = ALL_IMMEDIATE_YAKU_DEFINITIONS.find((entry) => entry.id === book.yakuId)!;
      const candidate: YakuCandidate = {
        yakuId: definition.id,
        scoringCardIds: sampleCards.map((card) => card.instanceId),
        jitCardIds: [],
        jitSum: 0,
        label: definition.name,
      };
      const before = calculateHandScore({ candidate, submittedCards: sampleCards, yakuLevels: { [book.yakuId]: 1 } });
      const after = calculateHandScore({ candidate, submittedCards: sampleCards, yakuLevels: { [book.yakuId]: 2 } });
      expect(after.startingHeung, book.name).toBeGreaterThan(before.startingHeung);
    }

    const bright = deck.filter((card) => card.kind === "bright");
    const collectionCards: Record<string, CardInstance[]> = {
      hongdan: deck.filter((card) => card.kind === "ribbon" && card.ribbonGroup === "hong"),
      chodan: deck.filter((card) => card.kind === "ribbon" && card.ribbonGroup === "cho"),
      cheongdan: deck.filter((card) => card.kind === "ribbon" && card.ribbonGroup === "cheong"),
      godori: deck.filter((card) => card.kind === "animal" && card.tags.includes("bird") && [2, 4, 8].includes(card.month)),
      rain_three_brights: [bright.find((card) => card.month === 12)!, ...bright.filter((card) => card.month !== 12).slice(0, 2)],
      three_brights: bright.filter((card) => card.month !== 12).slice(0, 3),
      four_brights: bright.slice(0, 4),
      five_brights: bright.slice(0, 5),
    };
    for (const book of BOOKS.filter((entry) => !immediateIds.has(entry.yakuId))) {
      const cards = collectionCards[book.yakuId];
      expect(cards, `${book.name} audit fixture`).toBeTruthy();
      const before = calculateCollectionBonus(cards, {}, { [book.yakuId]: { level: 1, mastery: 0 } });
      const after = calculateCollectionBonus(cards, {}, { [book.yakuId]: { level: 2, mastery: 0 } });
      const beforeLine = before.scoreLines.find((line) => line.id === book.yakuId);
      const afterLine = after.scoreLines.find((line) => line.id === book.yakuId);
      expect(afterLine?.points, book.name).toBe((beforeLine?.points ?? 0) + 1);
    }
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
      f_monthless: ["card", 1, 1, 4],
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

describe("card effect compatibility", () => {
  it("never rolls a kind treatment onto a card already printed with that kind", () => {
    const redundantEffect = {
      bright: "as_bright",
      animal: "as_animal",
      ribbon: "as_ribbon",
    } as const;

    for (const [kind, forbiddenId] of Object.entries(redundantEffect)) {
      const card = { kind: kind as keyof typeof redundantEffect };
      expect(isCardEffectCompatible(forbiddenId, card)).toBe(false);

      const rolledIds = Array.from({ length: 1_000 }, (_, index) =>
        rollCardEffectTagForCard(index / 1_000, card).id,
      );
      expect(rolledIds, `${kind} received ${forbiddenId}`).not.toContain(forbiddenId);
      expect(rolledIds).toContain("keeper_coin");
    }
  });

  it("keeps every treatment available when it adds a genuinely new kind", () => {
    const chaff = { kind: "chaff" as const };
    const allowedKindEffects = CARD_EFFECT_TAGS
      .filter((effect) => effect.id.startsWith("as_"))
      .map((effect) => effect.id);

    expect(allowedKindEffects.every((id) => isCardEffectCompatible(id, chaff))).toBe(true);
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
      deck.find((card) => card.month === 1 && card.kind === "bright")!,
      deck.find((card) => card.month === 3 && card.kind === "bright")!,
      deck.find((card) => card.month === 4 && card.kind === "chaff")!,
      deck.find((card) => card.month === 6 && card.kind === "chaff")!,
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

  it("re-triggers card treatment score effects as part of the card", () => {
    const { cards, candidate } = januaryPair();
    const treated = { ...cards[0], effectTagId: "heavy_month" as const };
    const submitted = [treated, cards[1]];
    const effects = buildOrderedTalismanScoreEffects({
      talismans: [owned("t_cardsharp_touch")],
      candidate: { ...candidate, scoringCardIds: submitted.map((card) => card.instanceId) },
      submittedCards: submitted,
      scoringCards: submitted,
    });
    expect(effects.filter((effect) => effect.operation === "add_kkeut" && effect.value === 50)).toHaveLength(2);
  });

  it("turns 제물 단도의 consumed value into its promised permanent multiplier", () => {
    const { cards, candidate } = januaryPair();
    const effects = buildOrderedTalismanScoreEffects({
      talismans: [owned("t_devouring_dagger", 1.25)],
      candidate,
      submittedCards: cards,
      scoringCards: cards,
    });
    expect(effects).toEqual([
      expect.objectContaining({ sourceId: "owned:t_devouring_dagger", operation: "multiply_heung", value: 2.25 }),
    ]);
  });

  it("lets 판을 읽는 자 copy the rightmost live score talisman even when it sits to the reader's right", () => {
    const { cards, candidate } = januaryPair();
    const effects = buildOrderedTalismanScoreEffects({
      talismans: [owned("t_table_reader"), owned("t_first_charm")],
      candidate,
      submittedCards: cards,
      scoringCards: cards,
    });
    expect(effects).toContainEqual(expect.objectContaining({
      sourceId: "owned:t_table_reader",
      operation: "add_heung",
      value: 4,
    }));
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

  it("gives every individual 부적 either a live score operation or a live rule hook", () => {
    const deck = createStandardHwatuDeck();
    const bright = deck.find((card) => card.kind === "bright")!;
    const bird = deck.find((card) => card.kind === "animal" && card.tags.includes("bird"))!;
    const ribbon = deck.find((card) => card.kind === "ribbon")!;
    const doubleChaff = deck.find((card) => card.kind === "chaff" && card.chaffValue === 2)!;
    const cup = deck.find((card) => card.tags.includes("cup"))!;
    const baseCards = [
      { ...bright, enhancement: "inked" as const },
      bird,
      ribbon,
      doubleChaff,
      cup,
    ].map((card) => ({ ...card, tags: [...card.tags] }));

    for (const definition of TALISMANS as readonly TalismanDefinition[]) {
      const params = definition.params ?? {};
      const count = definition.effectKey === "exact_submit_add"
        ? Number(params.cardCount ?? 5)
        : 5;
      let submitted = baseCards.slice(0, Math.max(2, Math.min(5, count)));
      if (definition.effectKey === "season_cards_add_kkeut") {
        const month = Number(params.monthFrom ?? 1);
        submitted = [deck.find((card) => card.month === month)!, ...baseCards.slice(1, 2)];
      } else if (definition.effectKey === "kind_cards_add_kkeut") {
        const match = deck.find((card) => card.kind === params.kind) ?? bright;
        submitted = [match, bird];
      } else if (definition.effectKey === "double_chaff_boost") {
        submitted = [doubleChaff, bird];
      } else if (definition.effectKey === "bird_retrigger") {
        submitted = [bird, bright];
      } else if (definition.effectKey === "cup_dual_role") {
        submitted = [cup, bright];
      } else if (definition.effectKey === "all_distinct_months_add") {
        submitted = [1, 2, 3, 4, 5].map((month) => deck.find((card) => card.month === month)!);
      }
      const yakuId = typeof params.yakuIds === "string"
        ? params.yakuIds.split(",")[0]
        : "ttaeng";
      const jitCount = definition.effectKey === "jit_add_heung" ? 3
        : definition.effectKey === "jit_sum_multiply_heung" || definition.effectKey === "yaku_multiply_kkeut" ? 2
          : 0;
      const candidate: YakuCandidate = {
        yakuId: yakuId as YakuCandidate["yakuId"],
        scoringCardIds: submitted.map((card) => card.instanceId),
        jitCardIds: jitCount > 0 ? submitted.slice(-jitCount).map((card) => card.instanceId) : [],
        jitSum: definition.effectKey === "jit_sum_multiply_heung" ? 30 : jitCount > 0 ? 20 : 0,
        label: yakuId,
      };
      const instance = owned(definition.id, 1);
      const helpers = ["copy_left_score", "copy_neighbors", "talisman_value_add_heung"].includes(definition.effectKey)
        ? [owned("t_first_charm"), instance]
        : [instance];
      const result = evaluateTalismanEffects({
        talismans: helpers,
        candidate,
        submittedCards: submitted,
        scoringCards: submitted,
        heldCards: [bright],
        newCollectionYakuIds: [typeof params.yakuId === "string" ? params.yakuId as CollectionYakuId : "hongdan"],
        money: 20,
        emptyTalismanSlots: definition.effectKey === "full_slots_multiply_heung" ? 0 : 2,
        successfulGoCount: 1,
        scoredMonthsThisRound: [1, 2, 3],
        discardsRemaining: 2,
        yakusPlayed: {},
      });
      const scoreOperations = result.orderedScoreEffects.filter((effect) => effect.sourceId === instance.instanceId);
      const ruleHooks = result.structuralEffects.filter((effect) => effect.sourceId === instance.instanceId);
      expect(scoreOperations.length + ruleHooks.length, definition.name).toBeGreaterThan(0);
    }
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
