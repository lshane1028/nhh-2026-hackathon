import { describe, expect, it } from "vitest";
import { BOSS_BY_ID } from "../content/bosses";
import { STANDARD_CARD_TEMPLATES } from "../content/cards";
import { STAGES } from "../content/stages";
import {
  ALL_IMMEDIATE_YAKU_DEFINITIONS,
  COLLECTION_YAKU_DEFINITIONS,
  IMMEDIATE_YAKU_DEFINITIONS,
  SECRET_YAKU_DEFINITIONS,
} from "../content/yaku";
import type { CardInstance, CollectionYakuId, ImmediateYakuId, MasteryEvent, YakuCandidate } from "../types";
import { getBossKkeutAdjustment } from "../engine/boss";
import {
  createStandardHwatuDeck,
  getEffectiveCardRole,
  shuffleWithSeed,
  validateStandardDeck,
} from "../engine/deck";
import {
  armGo,
  choosePostHandTransition,
  commitMasteryEvents,
  createGoChainState,
  forceOrAutoSettle,
  resolveGoAttempt,
} from "../engine/go";
import {
  GOLD_LEAF_MONTH_BONUS,
  INKED_MONTH_BONUS,
  STONE_MONTH_VALUE,
  calculateBestHandScore,
  calculateHandScore,
  createMasteryEvents,
} from "../engine/scoring";
import { buildOrderedTalismanScoreEffects } from "../engine/talismans";
import { detectNewCollectionCompletions, findImmediateYakuCandidates, validateYakuDefinitions } from "../engine/yaku";

const standardDeck = createStandardHwatuDeck();

function take(month: number, predicate: (card: CardInstance) => boolean): CardInstance {
  const card = standardDeck.find((entry) => entry.month === month && predicate(entry));
  if (!card) throw new Error(`Missing test card for month ${month}`);
  return card;
}

function takeKind(month: number, kind: CardInstance["kind"]): CardInstance {
  return take(month, (card) => card.kind === kind);
}

let cloneSerial = 0;
function cloneCard(card: CardInstance, patch: Partial<CardInstance> = {}): CardInstance {
  cloneSerial += 1;
  return { ...card, tags: [...card.tags], instanceId: `test-clone-${cloneSerial}`, ...patch };
}

function ids(candidates: readonly YakuCandidate[]): Set<ImmediateYakuId> {
  return new Set(candidates.map((entry) => entry.yakuId));
}

function expectYaku(cards: readonly CardInstance[], id: ImmediateYakuId): void {
  expect(ids(findImmediateYakuCandidates(cards))).toContain(id);
}

describe("standard content registries", () => {
  it("builds and validates the exact 48-card deck", () => {
    expect(STANDARD_CARD_TEMPLATES).toHaveLength(48);
    expect(validateStandardDeck(standardDeck)).toEqual([]);
    expect(new Set(standardDeck.map((card) => card.assetTag)).size).toBe(48);
  });

  it("contains 13 immediate, 4 secret, and 8 collection yaku with asset tags", () => {
    expect(IMMEDIATE_YAKU_DEFINITIONS).toHaveLength(13);
    expect(SECRET_YAKU_DEFINITIONS).toHaveLength(4);
    expect(ALL_IMMEDIATE_YAKU_DEFINITIONS).toHaveLength(17);
    expect(COLLECTION_YAKU_DEFINITIONS).toHaveLength(8);
    expect(validateYakuDefinitions()).toEqual([]);
    expect([...ALL_IMMEDIATE_YAKU_DEFINITIONS, ...COLLECTION_YAKU_DEFINITIONS].every((entry) => entry.assetTag.length > 0)).toBe(true);
  });

  it("keeps yaku text and stage targets aligned with month-sum scoring", () => {
    const allYaku = [...ALL_IMMEDIATE_YAKU_DEFINITIONS, ...COLLECTION_YAKU_DEFINITIONS];
    expect(allYaku.every((entry) => !`${entry.name} ${entry.description}`.includes("끗"))).toBe(true);
    expect(ALL_IMMEDIATE_YAKU_DEFINITIONS.every((entry) => entry.baseKkeut === 0 && entry.growthKkeut === 0)).toBe(true);
    expect(COLLECTION_YAKU_DEFINITIONS.every((entry) => entry.completionKkeut === 0 && entry.growthKkeut === 0)).toBe(true);
    expect(STAGES.map((stage) => stage.target)).toEqual([
      120, 190, 320, 520, 840, 1_400, 2_300, 3_800, 6_400, 10_800, 18_000, 30_000,
    ]);
  });

  it("shuffles reproducibly without mutating the source deck", () => {
    const before = standardDeck.map((card) => card.instanceId);
    const first = shuffleWithSeed(standardDeck, "꽃판-seed").map((card) => card.instanceId);
    const second = shuffleWithSeed(standardDeck, "꽃판-seed").map((card) => card.instanceId);
    const other = shuffleWithSeed(standardDeck, "다른-seed").map((card) => card.instanceId);
    expect(first).toEqual(second);
    expect(other).not.toEqual(first);
    expect(standardDeck.map((card) => card.instanceId)).toEqual(before);
  });
});

describe("all immediate and secret yaku", () => {
  it("recognizes all 13 immediate patterns", () => {
    const m1 = standardDeck.filter((card) => card.month === 1);
    const m2 = standardDeck.filter((card) => card.month === 2);
    expectYaku([m1[0]], "single");
    expectYaku(m1.slice(0, 2), "month_pair");
    expectYaku([...m1.slice(0, 2), ...m2.slice(0, 2)], "two_pairs");
    expectYaku([takeKind(1, "bright"), takeKind(2, "animal"), takeKind(3, "bright")], "three_run");
    expectYaku([take(11, (card) => card.chaffValue === 2), take(12, (card) => card.chaffValue === 2), takeKind(1, "chaff")], "chaff_field");
    expectYaku(m1.slice(0, 3), "triple_month");
    expectYaku([takeKind(1, "bright"), takeKind(2, "animal"), takeKind(3, "bright"), takeKind(4, "animal")], "four_run");
    expectYaku([1, 2, 3, 4].map((month) => takeKind(month, "ribbon")), "four_ribbons");
    expectYaku([2, 4, 5, 6].map((month) => takeKind(month, "animal")), "four_animals");
    expectYaku([...m1, takeKind(2, "animal")], "same_season");
    expectYaku([...m1.slice(0, 3), ...m2.slice(0, 2)], "house_party");
    expectYaku([1, 2, 3, 4, 5].map((month) => takeKind(month, month === 1 || month === 3 ? "bright" : "animal")), "five_run");
    expectYaku(m1, "four_of_month");
  });

  it("recognizes all four deck-modification-only secret patterns", () => {
    const january = standardDeck.filter((card) => card.month === 1);
    expectYaku([...january, cloneCard(january[0], { kind: "animal" })], "five_of_month");

    const birds = [2, 4, 8].map((month) => take(month, (card) => card.tags.includes("bird")));
    expectYaku([...birds, cloneCard(birds[0]), cloneCard(birds[1])], "double_godori");

    const januaryBright = takeKind(1, "bright");
    expectYaku([
      januaryBright,
      cloneCard(januaryBright),
      cloneCard(takeKind(1, "ribbon")),
      cloneCard(takeKind(1, "chaff")),
      cloneCard(takeKind(1, "chaff")),
    ], "ten_thousand_pines");

    const rainBright = takeKind(12, "bright");
    expectYaku([
      rainBright,
      cloneCard(rainBright),
      cloneCard(rainBright),
      cloneCard(takeKind(12, "animal")),
      cloneCard(takeKind(12, "ribbon")),
    ], "rain_bright_world");
  });

  it("allows 12-to-1 runs only with the leap rule", () => {
    const cards = [takeKind(11, "bright"), takeKind(12, "bright"), takeKind(1, "bright")];
    expect(ids(findImmediateYakuCandidates(cards))).not.toContain("three_run");
    expect(ids(findImmediateYakuCandidates(cards, { connectYear: true }))).toContain("three_run");
  });
});

describe("collection board and score evaluation", () => {
  const bird2 = take(2, (card) => card.tags.includes("bird"));
  const bird4 = take(4, (card) => card.tags.includes("bird"));
  const bird8 = take(8, (card) => card.tags.includes("bird"));

  it("rolls an unconfirmed completion back but never repeats a confirmed completion", () => {
    const base = { confirmedCards: [bird2, bird4], submittedCards: [bird8] };
    expect(detectNewCollectionCompletions(base)).toContain("godori");
    expect(detectNewCollectionCompletions({ ...base, confirmedCompletedYakuIds: ["godori"] })).not.toContain("godori");

    const first = calculateBestHandScore({ submittedCards: [bird8], collection: base });
    expect(first.finalKkeut).toBe(8);
    expect(first.finalHeung).toBe(6);
    expect(first.score).toBe(48);
    const afterFailure = calculateBestHandScore({ submittedCards: [cloneCard(bird8)], collection: { ...base, submittedCards: [cloneCard(bird8)] } });
    expect(afterFailure.score).toBe(48);
    const afterConfirmation = calculateBestHandScore({
      submittedCards: [cloneCard(bird8)],
      collection: { ...base, submittedCards: [cloneCard(bird8)], confirmedCompletedYakuIds: ["godori"] },
    });
    expect(afterConfirmation.score).toBe(8);
  });

  it("awards only the highest newly reached bright tier", () => {
    const brights = standardDeck.filter((card) => card.kind === "bright");
    expect(detectNewCollectionCompletions({ submittedCards: brights })).toEqual(["five_brights"]);
  });

  it("applies ordered effects after card month sum and collection multiplier", () => {
    const pair = [bird8, takeKind(8, "chaff")];
    const pairCandidate = findImmediateYakuCandidates(pair).find((entry) => entry.yakuId === "month_pair");
    if (!pairCandidate) throw new Error("month pair candidate missing");
    const score = calculateHandScore({
      candidate: pairCandidate,
      submittedCards: pair,
      newCollectionYakuIds: ["godori"],
      orderedTalismanEffects: [
        { sourceId: "plus-k", label: "+3 월 합", operation: "add_kkeut", value: 3 },
        { sourceId: "plus-h", label: "+2흥", operation: "add_heung", value: 2 },
        { sourceId: "times-h", label: "×1.25흥", operation: "multiply_heung", value: 1.25 },
      ],
    });
    expect(score.startingKkeut).toBe(0);
    expect(score.finalKkeut).toBe(19);
    expect(score.finalHeung).toBe(11.25);
    expect(score.score).toBe(213);
  });

  it("selects the highest actual candidate rather than a fixed pattern rank", () => {
    const january = standardDeck.filter((card) => card.month === 1);
    const best = calculateBestHandScore({ submittedCards: january });
    expect(best.yakuId).toBe("four_of_month");
    expect(best.finalKkeut).toBe(4);
    expect(best.score).toBe(4 * 6);
  });

  it("uses printed months for every normal kind and scaled modifier values", () => {
    const cards = [
      takeKind(9, "ribbon"),
      takeKind(9, "chaff"),
    ];
    expect(cards.map((card) => getEffectiveCardRole(card).baseKkeut)).toEqual([9, 9]);
    const submitted = [
      cloneCard(cards[0], { enhancement: "inked" }),
      cloneCard(cards[1], { edition: "gold_leaf" }),
      cloneCard(takeKind(3, "bright"), { enhancement: "stone" }),
    ];
    const pair = findImmediateYakuCandidates(submitted).find((entry) => entry.yakuId === "month_pair");
    if (!pair) throw new Error("month pair candidate missing");
    const modified = calculateHandScore({
      candidate: pair,
      submittedCards: submitted,
    });
    expect(INKED_MONTH_BONUS).toBe(3);
    expect(GOLD_LEAF_MONTH_BONUS).toBe(5);
    expect(STONE_MONTH_VALUE).toBe(12);
    expect(modified.finalKkeut).toBe(9 + 3 + 9 + 5 + 12);
  });

  it("uses the same scaled values for bosses and talisman retriggers", () => {
    const dryBright = takeKind(3, "bright");
    expect(getBossKkeutAdjustment(BOSS_BY_ID.boss_monsoon, dryBright, {
      submissionIndex: 0,
      scoringIndex: 0,
    })).toBe(-3);
    expect(getBossKkeutAdjustment(BOSS_BY_ID.boss_falling_first, takeKind(11, "bright"), {
      submissionIndex: 0,
      scoringIndex: 0,
    })).toBe(-11);

    const inkedGold = cloneCard(takeKind(6, "animal"), {
      enhancement: "inked",
      edition: "gold_leaf",
    });
    const retriggers = buildOrderedTalismanScoreEffects({
      talismans: [{ instanceId: "cardsharp", definitionId: "t_cardsharp_touch", growth: 0 }],
      candidate: { yakuId: "single", scoringCardIds: [inkedGold.instanceId], label: "홑패" },
      submittedCards: [inkedGold],
      scoringCards: [inkedGold],
    });
    expect(retriggers.map((effect) => effect.value)).toEqual([6, 3, 5, 6, 3, 5]);

    const stone = cloneCard(takeKind(2, "animal"), { enhancement: "stone" });
    const stoneRetriggers = buildOrderedTalismanScoreEffects({
      talismans: [{ instanceId: "cardsharp-stone", definitionId: "t_cardsharp_touch", growth: 0 }],
      candidate: { yakuId: "single", scoringCardIds: [stone.instanceId], label: "홑패" },
      submittedCards: [stone],
      scoringCards: [stone],
    });
    expect(stoneRetriggers.map((effect) => effect.value)).toEqual([12, 12]);
  });

  it("raises yaku level multiplier without adding a hidden front value", () => {
    const cards = [takeKind(6, "animal"), takeKind(6, "chaff")];
    const pair = findImmediateYakuCandidates(cards).find((entry) => entry.yakuId === "month_pair");
    if (!pair) throw new Error("month pair candidate missing");
    const leveled = calculateHandScore({
      candidate: pair,
      submittedCards: cards,
      yakuLevels: { month_pair: 3 },
    });
    expect(leveled.startingKkeut).toBe(0);
    expect(leveled.finalKkeut).toBe(12);
    expect(leveled.finalHeung).toBe(2.5);
    expect(leveled.score).toBe(30);
  });

  it("preserves left-to-right +흥 and ×흥 order", () => {
    const cards = [takeKind(1, "bright"), takeKind(1, "chaff")];
    const pair = findImmediateYakuCandidates(cards).find((entry) => entry.yakuId === "month_pair") as YakuCandidate;
    const plusThenTimes = calculateHandScore({
      candidate: pair,
      submittedCards: cards,
      orderedTalismanEffects: [
        { sourceId: "plus", label: "+2", operation: "add_heung", value: 2 },
        { sourceId: "times", label: "×2", operation: "multiply_heung", value: 2 },
      ],
    });
    const timesThenPlus = calculateHandScore({
      candidate: pair,
      submittedCards: cards,
      orderedTalismanEffects: [
        { sourceId: "times", label: "×2", operation: "multiply_heung", value: 2 },
        { sourceId: "plus", label: "+2", operation: "add_heung", value: 2 },
      ],
    });
    expect(plusThenTimes.finalHeung).toBe(8);
    expect(timesThenPlus.finalHeung).toBe(6);
  });
});

describe("Go pot state machine", () => {
  const played: MasteryEvent = { yakuId: "month_pair", amount: 1, reason: "played" };
  const collection: MasteryEvent = { yakuId: "godori", amount: 1, reason: "collection" };

  it("sets R on arm, accepts equality, and clears R on success", () => {
    const first = resolveGoAttempt(createGoChainState(), 1_230, { masteryEvents: [played] });
    const armed = armGo(first.state, 6_000, 3);
    expect(armed.requirement).toBe(2_153);
    const success = resolveGoAttempt(armed, 923, { masteryEvents: [played] });
    expect(success.outcome).toBe("success");
    expect(success.state.pot).toBe(2_153);
    expect(success.state.successfulGoCount).toBe(1);
    expect(success.state.requirement).toBeNull();
  });

  it("loses P/Q/M on failure while preserving confirmed state", () => {
    const initial = {
      ...createGoChainState(),
      confirmedScore: 300,
      confirmedGoCount: 1,
      confirmedCollection: { cardIds: ["safe"], completedYakuIds: ["hongdan" as CollectionYakuId] },
    };
    const first = resolveGoAttempt(initial, 1_230, {
      submittedCardIds: ["risky"],
      completedCollectionYakuIds: ["godori"],
      masteryEvents: [played, collection],
    });
    const failure = resolveGoAttempt(armGo(first.state, 6_000, 3), 922);
    expect(failure.outcome).toBe("failure");
    expect(failure.state).toMatchObject({
      pot: 0,
      successfulGoCount: 0,
      requirement: null,
      confirmedScore: 300,
      confirmedGoCount: 1,
      confirmedCollection: { cardIds: ["safe"], completedYakuIds: ["hongdan"] },
      pendingCollection: { cardIds: [], completedYakuIds: [] },
      pendingMastery: [],
    });
  });

  it("atomically settles score, C, A, normal mastery, and Hansum bonus", () => {
    const base = createGoChainState();
    const first = resolveGoAttempt(base, 1_230, {
      submittedCardIds: ["a"],
      completedCollectionYakuIds: ["godori"],
      masteryEvents: [played, collection],
    });
    const success = resolveGoAttempt(armGo(first.state, 6_000, 3), 1_000, {
      submittedCardIds: ["b"],
      masteryEvents: [{ yakuId: "single", amount: 1, reason: "played" }],
    });
    const settled = forceOrAutoSettle(success.state, "auto", { target: 6_000, handsRemaining: 0 });
    expect(settled.settlementValue).toBe(2_564);
    expect(settled.state.confirmedScore).toBe(2_564);
    expect(settled.state.confirmedGoCount).toBe(1);
    expect(settled.state.confirmedCollection).toEqual({ cardIds: ["a", "b"], completedYakuIds: ["godori"] });
    expect(settled.state.pot).toBe(0);
    expect(settled.state.pendingMastery).toEqual([]);
    expect(settled.committedMasteryEvents.filter((event) => event.yakuId === "godori").reduce((sum, event) => sum + event.amount, 0)).toBe(2);
    expect(settled.masteryLevels).toMatchObject({ month_pair: { level: 1, mastery: 1 }, godori: { level: 1, mastery: 2 } });
    expect(settled.moneyBonus).toBe(2);
  });

  it("uses AUTO before FORCE on the final third-Go hand and settles once", () => {
    const resolution = {
      state: { ...createGoChainState(), pot: 5_630, successfulGoCount: 3 as const },
      outcome: "success" as const,
      threshold: 5_595,
      combinedScore: 5_630,
    };
    expect(choosePostHandTransition(resolution, 0)).toBe("auto_settle");
    const settled = forceOrAutoSettle(resolution.state, "auto", { target: 6_000, handsRemaining: 0 });
    expect(settled.settlementValue).toBe(9_571);
    expect(settled.state.confirmedScore).toBe(9_571);
    expect(settled.state.confirmedGoCount).toBe(3);
  });

  it("commits 3→5→7 mastery thresholds deterministically", () => {
    const events = Array.from({ length: 8 }, () => ({ yakuId: "month_pair" as const, amount: 1, reason: "played" as const }));
    expect(commitMasteryEvents({}, events).month_pair).toEqual({ level: 3, mastery: 0 });
    const breakdown = calculateBestHandScore({ submittedCards: [takeKind(1, "bright"), takeKind(1, "chaff")] });
    expect(createMasteryEvents(breakdown)[0]).toMatchObject({ yakuId: "month_pair", amount: 1 });
  });
});
