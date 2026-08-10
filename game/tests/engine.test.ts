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
import type { CardInstance, ImmediateYakuId, MasteryEvent, YakuCandidate } from "../types";
import { getBossKkeutAdjustment } from "../engine/boss";
import {
  createStandardHwatuDeck,
  getEffectiveCardRole,
  shuffleWithSeed,
  validateStandardDeck,
} from "../engine/deck";
import {
  addHandToRound,
  canDeclareGo,
  commitMasteryEvents,
  createGoChainState,
  declareGo,
  getGoRequirement,
  getGoRewardFactor,
  isRequirementCleared,
  settleRound,
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
import {
  MAX_SUBMISSION,
  MIN_SUBMISSION,
  detectNewCollectionCompletions,
  findImmediateYakuCandidates,
  getEffectiveMonth,
  isValidJit,
  judgeKkeutPair,
  validateYakuDefinitions,
} from "../engine/yaku";

const standardDeck = createStandardHwatuDeck();

function take(month: number, predicate: (card: CardInstance) => boolean): CardInstance {
  const card = standardDeck.find((entry) => entry.month === month && predicate(entry));
  if (!card) throw new Error(`Missing test card for month ${month}`);
  return card;
}

function takeKind(month: number, kind: CardInstance["kind"]): CardInstance {
  return take(month, (card) => card.kind === kind);
}

/** The two chaff of a month, handy whenever a test just needs "a card of month N". */
function chaff(month: number, index = 0): CardInstance {
  const cards = standardDeck.filter((entry) => entry.month === month && entry.kind === "chaff");
  const card = cards[index] ?? standardDeck.find((entry) => entry.month === month);
  if (!card) throw new Error(`Missing chaff for month ${month}`);
  return card;
}

let cloneSerial = 0;
function cloneCard(card: CardInstance, patch: Partial<CardInstance> = {}): CardInstance {
  cloneSerial += 1;
  return { ...card, tags: [...card.tags], instanceId: `test-clone-${cloneSerial}`, ...patch };
}

function ids(candidates: readonly YakuCandidate[]): Set<ImmediateYakuId> {
  return new Set(candidates.map((entry) => entry.yakuId));
}

/** Judges a bare two-card 끗패 the way the table would read it. */
function pairId(left: CardInstance, right: CardInstance): ImmediateYakuId {
  return judgeKkeutPair(left, right).yakuId;
}

describe("standard content registries", () => {
  it("builds and validates the exact 48-card deck", () => {
    expect(STANDARD_CARD_TEMPLATES).toHaveLength(48);
    expect(validateStandardDeck(standardDeck)).toEqual([]);
    expect(new Set(standardDeck.map((card) => card.assetTag)).size).toBe(48);
  });

  it("contains 11 open, 3 secret, and 8 collection yaku with asset tags", () => {
    expect(IMMEDIATE_YAKU_DEFINITIONS).toHaveLength(11);
    expect(SECRET_YAKU_DEFINITIONS).toHaveLength(3);
    expect(ALL_IMMEDIATE_YAKU_DEFINITIONS).toHaveLength(14);
    expect(COLLECTION_YAKU_DEFINITIONS).toHaveLength(8);
    expect(validateYakuDefinitions()).toEqual([]);
    expect([...ALL_IMMEDIATE_YAKU_DEFINITIONS, ...COLLECTION_YAKU_DEFINITIONS].every((entry) => entry.assetTag.length > 0)).toBe(true);
  });

  it("keeps every yaku on the 배수 side, since 월 합 now comes from the 짓", () => {
    expect(ALL_IMMEDIATE_YAKU_DEFINITIONS.every((entry) => entry.baseKkeut === 0 && entry.growthKkeut === 0)).toBe(true);
    expect(COLLECTION_YAKU_DEFINITIONS.every((entry) => entry.completionKkeut === 0 && entry.growthKkeut === 0)).toBe(true);
    expect(STAGES.map((stage) => stage.target)).toEqual([
      150, 280, 450, 850, 1_450, 2_450, 4_100, 6_800, 11_200, 18_500, 30_500, 50_000,
    ]);
  });

  it("keeps the 끗패 ladder strictly increasing", () => {
    const ladder = IMMEDIATE_YAKU_DEFINITIONS.map((entry) => entry.baseHeung);
    expect(ladder).toEqual([...ladder].sort((left, right) => left - right));
    for (const secret of SECRET_YAKU_DEFINITIONS) {
      expect(secret.baseHeung).toBeGreaterThan(Math.max(...ladder));
    }
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

describe("끗패 판정", () => {
  it("reads every named pair ahead of the plain ladder", () => {
    // Each of these also has a numeric reading — 1·9 sums to 10, 4·6 sums to
    // 10 — and the named pair has to win, exactly as at a real table.
    expect(pairId(chaff(1), chaff(2))).toBe("ali");
    expect(pairId(chaff(1), chaff(4))).toBe("doksa");
    expect(pairId(chaff(1), chaff(9))).toBe("gupping");
    expect(pairId(chaff(1), chaff(10))).toBe("jangpping");
    expect(pairId(chaff(4), chaff(10))).toBe("jangsa");
    expect(pairId(chaff(4), chaff(6))).toBe("seryuk");
  });

  it("reads 땡, 장땡 and the numeric ladder", () => {
    expect(pairId(chaff(6), chaff(6, 1))).toBe("ttaeng");
    expect(pairId(chaff(10), takeKind(10, "ribbon"))).toBe("jangttaeng");
    expect(pairId(chaff(4), chaff(5))).toBe("gabo"); // 9
    expect(pairId(chaff(2), chaff(8))).toBe("mangtong"); // 10
    expect(pairId(chaff(3), chaff(5))).toBe("kkeut"); // 8끗
  });

  it("counts 11월 and 12월 in the numeric ladder without inventing new named hands", () => {
    const decemberSeven = judgeKkeutPair(chaff(12), chaff(7));
    expect(decemberSeven).toMatchObject({ yakuId: "gabo", rankLabel: "" });

    const novemberPair = judgeKkeutPair(chaff(11), cloneCard(chaff(11)));
    expect(novemberPair).toMatchObject({ yakuId: "kkeut", rankLabel: "2끗" });

    const decemberBright = takeKind(12, "bright");
    expect(judgeKkeutPair(decemberBright, takeKind(3, "bright")).yakuId).toBe("kkeut");
  });

  it("keeps printed months authoritative when a card has a month-sum modifier", () => {
    const modifiedSeven = cloneCard(chaff(7), { permanentKkeutBonus: 4, tags: [...chaff(7).tags, "zero_base"] });
    expect(judgeKkeutPair(chaff(12), modifiedSeven).yakuId).toBe("gabo");
  });

  it("ranks inside 땡 and 끗 instead of flattening them", () => {
    const low = judgeKkeutPair(chaff(2), chaff(2, 1));
    const high = judgeKkeutPair(chaff(9), chaff(9, 1));
    expect(low.yakuId).toBe("ttaeng");
    expect(high.yakuId).toBe("ttaeng");
    expect(high.rankBonusHeung).toBeGreaterThan(low.rankBonusHeung);
    expect(high.rankLabel).toBe("9땡");

    const twoKkeut = judgeKkeutPair(chaff(5), chaff(7)); // 12 → 2끗
    const eightKkeut = judgeKkeutPair(chaff(3), chaff(5)); // 8끗
    expect(eightKkeut.rankBonusHeung).toBeGreaterThan(twoKkeut.rankBonusHeung);
    expect(eightKkeut.rankLabel).toBe("8끗");
  });

  it("finds all three 광땡, and only between two brights", () => {
    expect(pairId(takeKind(1, "bright"), takeKind(3, "bright"))).toBe("gwangttaeng_13");
    expect(pairId(takeKind(1, "bright"), takeKind(8, "bright"))).toBe("gwangttaeng_18");
    expect(pairId(takeKind(3, "bright"), takeKind(8, "bright"))).toBe("gwangttaeng_38");
    // Same months, but the 3월 card is a ribbon, so it drops back to 8끗.
    expect(pairId(takeKind(1, "bright"), takeKind(3, "ribbon"))).toBe("kkeut");
  });
});

describe("짓 splitting", () => {
  it("lets a bare pair through with no 짓 at all", () => {
    const candidates = findImmediateYakuCandidates([chaff(1), chaff(2)]);
    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({ yakuId: "ali", jitSum: 0, jitCardIds: [] });
  });

  it("refuses a submission shorter than the minimum", () => {
    expect(MIN_SUBMISSION).toBe(2);
    expect(MAX_SUBMISSION).toBe(5);
    expect(findImmediateYakuCandidates([chaff(1)])).toEqual([]);
  });

  it("requires the 짓 to land on a multiple of ten", () => {
    expect(isValidJit(10)).toBe(true);
    expect(isValidJit(20)).toBe(true);
    expect(isValidJit(0)).toBe(false);
    expect(isValidJit(15)).toBe(false);
    expect(isValidJit(15, true)).toBe(true);

    // 3장: the single leftover card has to be 10월 by itself.
    expect(findImmediateYakuCandidates([chaff(1), chaff(2), chaff(10)])).toHaveLength(1);
    expect(findImmediateYakuCandidates([chaff(1), chaff(2), chaff(7)])).toEqual([]);
  });

  it("builds 짓 of two and three cards for longer submissions", () => {
    const four = findImmediateYakuCandidates([takeKind(1, "bright"), takeKind(3, "bright"), chaff(4), chaff(6)]);
    expect(four).toHaveLength(1);
    expect(four[0]).toMatchObject({ yakuId: "gwangttaeng_13", jitSum: 10 });

    const five = findImmediateYakuCandidates([chaff(1), chaff(2), chaff(4), chaff(6), chaff(10)]);
    expect(five.map((entry) => entry.jitSum)).toContain(20);
    expect(ids(five)).toContain("ali");
  });

  it("opens up five-multiple 짓 only with the leap-calendar talisman", () => {
    const cards = [chaff(1), chaff(2), chaff(5)];
    expect(findImmediateYakuCandidates(cards)).toEqual([]);
    expect(ids(findImmediateYakuCandidates(cards, { allowFiveMultipleJit: true }))).toContain("ali");
  });

  it("treats a 돌패 as 12월 and a zero-base card as nothing", () => {
    expect(getEffectiveMonth(cloneCard(takeKind(3, "bright"), { enhancement: "stone" }))).toBe(STONE_MONTH_VALUE);
    expect(getEffectiveMonth(cloneCard(chaff(7), { tags: ["zero_base"] }))).toBe(0);
    expect(getEffectiveMonth(cloneCard(chaff(7), { permanentKkeutBonus: 2 }))).toBe(9);
  });
});

describe("collection board and score evaluation", () => {
  const bird2 = take(2, (card) => card.tags.includes("bird"));
  const bird4 = take(4, (card) => card.tags.includes("bird"));
  const bird8 = take(8, (card) => card.tags.includes("bird"));

  it("rolls an unconfirmed completion back but never repeats a confirmed completion", () => {
    const submitted = [bird8, chaff(2)];
    const base = { confirmedCards: [bird2, bird4], submittedCards: submitted };
    expect(detectNewCollectionCompletions(base)).toContain("godori");
    expect(detectNewCollectionCompletions({ ...base, confirmedCompletedYakuIds: ["godori"] })).not.toContain("godori");

    // 8월 + 2월 = 10 → 망통, 배수 1, plus the 고도리 완성 배수 5.
    const first = calculateBestHandScore({ submittedCards: submitted, collection: base });
    expect(first.yakuId).toBe("mangtong");
    expect(first.finalKkeut).toBe(1);
    expect(first.finalHeung).toBe(6);
    expect(first.score).toBe(6);

    const afterConfirmation = calculateBestHandScore({
      submittedCards: submitted,
      collection: { ...base, confirmedCompletedYakuIds: ["godori"] },
    });
    expect(afterConfirmation.score).toBe(1);
  });

  it("awards only the highest newly reached bright tier", () => {
    const brights = standardDeck.filter((card) => card.kind === "bright");
    expect(detectNewCollectionCompletions({ submittedCards: brights })).toEqual(["five_brights"]);
  });

  it("scores 월 합 from the 짓 and 배수 from the 끗패", () => {
    // 짓 4월+6월 = 10, 끗패 1월광+3월광 = 13광땡 (배수 16).
    const cards = [takeKind(1, "bright"), takeKind(3, "bright"), chaff(4), chaff(6)];
    const best = calculateBestHandScore({ submittedCards: cards });
    expect(best.yakuId).toBe("gwangttaeng_13");
    expect(best.startingKkeut).toBe(10);
    expect(best.finalHeung).toBe(16);
    expect(best.score).toBe(160);
  });

  it("uses the first two selected cards as the kkeut pair", () => {
    const cards = [takeKind(10, "animal"), takeKind(10, "ribbon"), chaff(4), chaff(6)];
    const candidates = findImmediateYakuCandidates(cards);
    expect(ids(candidates)).toEqual(new Set(["jangttaeng"]));

    const best = calculateBestHandScore({ submittedCards: cards });
    expect(best.yakuId).toBe("jangttaeng");
    expect(best.score).toBe(140);

    const reordered = [chaff(4), chaff(6), takeKind(10, "animal"), takeKind(10, "ribbon")];
    expect(ids(findImmediateYakuCandidates(reordered))).toEqual(new Set(["seryuk"]));
  });

  it("applies ordered effects after the 짓 total and the collection multiplier", () => {
    const pair = [bird8, chaff(2)];
    const candidate = findImmediateYakuCandidates(pair).find((entry) => entry.yakuId === "mangtong");
    if (!candidate) throw new Error("mangtong candidate missing");
    const score = calculateHandScore({
      candidate,
      submittedCards: pair,
      newCollectionYakuIds: ["godori"],
      orderedTalismanEffects: [
        { sourceId: "plus-k", label: "+3 월 합", operation: "add_kkeut", value: 3 },
        { sourceId: "plus-h", label: "+2흥", operation: "add_heung", value: 2 },
        { sourceId: "times-h", label: "×1.25흥", operation: "multiply_heung", value: 1.25 },
      ],
    });
    expect(score.startingKkeut).toBe(1);
    expect(score.finalKkeut).toBe(4);
    expect(score.finalHeung).toBe(10);
    expect(score.score).toBe(40);
  });

  it("uses printed months for every normal kind and scaled modifier values", () => {
    const cards = [takeKind(9, "ribbon"), takeKind(9, "chaff")];
    expect(cards.map((card) => getEffectiveCardRole(card).baseKkeut)).toEqual([9, 9]);
    const submitted = [
      cloneCard(cards[0], { enhancement: "inked" }),
      cloneCard(cards[1], { edition: "gold_leaf" }),
    ];
    const candidate = findImmediateYakuCandidates(submitted)[0];
    const modified = calculateHandScore({ candidate, submittedCards: submitted });
    // 월 합의 바탕은 짓이 10/20/30으로 묶어 두므로, 각인이 작으면 카드를 아무리
    // 치장해도 점수가 움직이지 않는다. 그래서 값이 크다.
    expect(INKED_MONTH_BONUS).toBe(25);
    expect(GOLD_LEAF_MONTH_BONUS).toBe(40);
    expect(candidate.yakuId).toBe("ttaeng");
    // 짓이 없으니 월 합은 1에서 시작하고, 카드는 각인 값만 얹는다.
    expect(modified.finalKkeut).toBe(1 + INKED_MONTH_BONUS + GOLD_LEAF_MONTH_BONUS);
    expect(modified.finalHeung).toBeCloseTo(8 + (9 - 1) * 0.6, 5);
  });

  it("replays an echo card's own month and printed modifiers exactly once", () => {
    const echo = cloneCard(takeKind(7, "ribbon"), {
      effectTagId: "echo",
      enhancement: "inked",
    });
    const submitted = [echo, takeKind(12, "chaff")];
    const candidate = findImmediateYakuCandidates(submitted)[0];
    const score = calculateHandScore({ candidate, submittedCards: submitted });
    const echoOperations = score.operations.filter((operation) => operation.sourceId === echo.instanceId);

    expect(echoOperations.map((operation) => operation.value)).toEqual([
      INKED_MONTH_BONUS,
      7,
      INKED_MONTH_BONUS,
    ]);
    expect(echoOperations.map((operation) => operation.label)).toEqual(["먹칠", "메아리패", "먹칠 메아리"]);
    expect(score.finalKkeut).toBe(score.startingKkeut + INKED_MONTH_BONUS * 2 + 7);
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
    const soloCandidate: YakuCandidate = {
      yakuId: "mangtong",
      scoringCardIds: [inkedGold.instanceId],
      jitCardIds: [],
      jitSum: 0,
      label: "망통",
    };
    const retriggers = buildOrderedTalismanScoreEffects({
      talismans: [{ instanceId: "cardsharp", definitionId: "t_cardsharp_touch", growth: 0 }],
      candidate: soloCandidate,
      submittedCards: [inkedGold],
      scoringCards: [inkedGold],
    });
    expect(retriggers.map((effect) => effect.value)).toEqual([6, 25, 40, 6, 25, 40]);

    const stone = cloneCard(takeKind(2, "animal"), { enhancement: "stone" });
    const stoneRetriggers = buildOrderedTalismanScoreEffects({
      talismans: [{ instanceId: "cardsharp-stone", definitionId: "t_cardsharp_touch", growth: 0 }],
      candidate: { ...soloCandidate, scoringCardIds: [stone.instanceId] },
      submittedCards: [stone],
      scoringCards: [stone],
    });
    expect(stoneRetriggers.map((effect) => effect.value)).toEqual([12, 12]);
  });

  it("raises the yaku level multiplier without adding a hidden front value", () => {
    const cards = [takeKind(6, "animal"), takeKind(6, "chaff")];
    const candidate = findImmediateYakuCandidates(cards).find((entry) => entry.yakuId === "ttaeng");
    if (!candidate) throw new Error("ttaeng candidate missing");
    const leveled = calculateHandScore({
      candidate,
      submittedCards: cards,
      yakuLevels: { ttaeng: 3 },
    });
    expect(leveled.startingKkeut).toBe(1);
    // 기본 8 + 레벨 2단계 ×0.5 = 9, 여기에 6땡 등급 +3.0.
    expect(leveled.startingHeung).toBeCloseTo(9, 5);
    expect(leveled.finalHeung).toBeCloseTo(12, 5);
    expect(leveled.score).toBe(12);
  });

  it("preserves left-to-right +흥 and ×흥 order", () => {
    const cards = [takeKind(1, "bright"), takeKind(1, "chaff")];
    const candidate = findImmediateYakuCandidates(cards)[0];
    const plusThenTimes = calculateHandScore({
      candidate,
      submittedCards: cards,
      orderedTalismanEffects: [
        { sourceId: "plus", label: "+2", operation: "add_heung", value: 2 },
        { sourceId: "times", label: "×2", operation: "multiply_heung", value: 2 },
      ],
    });
    const timesThenPlus = calculateHandScore({
      candidate,
      submittedCards: cards,
      orderedTalismanEffects: [
        { sourceId: "times", label: "×2", operation: "multiply_heung", value: 2 },
        { sourceId: "plus", label: "+2", operation: "add_heung", value: 2 },
      ],
    });
    expect(plusThenTimes.finalHeung).toBe(20);
    expect(timesThenPlus.finalHeung).toBe(18);
  });
});

describe("Go as an end-of-round bet", () => {
  const played: MasteryEvent = { yakuId: "ttaeng", amount: 1, reason: "played" };
  const collection: MasteryEvent = { yakuId: "godori", amount: 1, reason: "collection" };

  it("accumulates every hand into one round score that never rolls back", () => {
    let round = createGoChainState();
    round = addHandToRound(round, 1_230, { submittedCardIds: ["a"], masteryEvents: [played] });
    round = addHandToRound(round, 920, {
      submittedCardIds: ["b"],
      completedCollectionYakuIds: ["godori"],
      masteryEvents: [collection],
    });

    expect(round.roundScore).toBe(2_150);
    expect(round.goCount).toBe(0);
    expect(round.collection).toEqual({ cardIds: ["a", "b"], completedYakuIds: ["godori"] });
    expect(round.mastery).toHaveLength(2);
  });

  it("raises the bar on each Go and caps at three", () => {
    expect(getGoRequirement(1_000, 0)).toBe(1_000);
    expect(getGoRequirement(1_000, 1)).toBe(1_800);
    expect(getGoRequirement(1_000, 2)).toBe(2_800);
    expect(getGoRequirement(1_000, 3)).toBe(4_200);
    expect(getGoRequirement(1_000, 1, 1.1)).toBe(1_980);

    let round = createGoChainState();
    expect(canDeclareGo(round, 2)).toBe(true);
    round = declareGo(declareGo(declareGo(round, 1_000), 1_000), 1_000);
    expect(round.goCount).toBe(3);
    expect(canDeclareGo(round, 2)).toBe(false);
    expect(() => declareGo(round, 1_000)).toThrow();
  });

  it("never lets an overshoot make the next Go free", () => {
    expect(getGoRequirement(1_000, 1, 1, 2_500)).toBe(3_750);
    expect(getGoRequirement(1_000, 1, 1, 500)).toBe(1_800);

    const huge = addHandToRound(createGoChainState(), 2_500);
    const went = declareGo(huge, 1_000);
    expect(went.goRequirement).toBe(3_750);
    expect(isRequirementCleared(went, went.goRequirement!)).toBe(false);
  });

  it("locks the bar in at declaration so later scoring cannot move it", () => {
    const round = declareGo(addHandToRound(createGoChainState(), 1_000), 1_000);
    const bar = round.goRequirement;
    const scoredMore = addHandToRound(round, 900);
    expect(scoredMore.goRequirement).toBe(bar);
  });

  it("never lets a Go be called without a hand left to play it", () => {
    expect(canDeclareGo(createGoChainState(), 0)).toBe(false);
  });

  it("reports whether the current bar is cleared", () => {
    const round = addHandToRound(createGoChainState(), 1_900);
    expect(isRequirementCleared(round, getGoRequirement(1_000, 0))).toBe(true);
    expect(isRequirementCleared(round, getGoRequirement(1_000, 1))).toBe(true);
    expect(isRequirementCleared(round, getGoRequirement(1_000, 2))).toBe(false);
  });

  it("multiplies the purse by the Go level and doubles collection mastery", () => {
    expect(getGoRewardFactor(0)).toBe(1);
    expect(getGoRewardFactor(1)).toBe(1.7);
    expect(getGoRewardFactor(3)).toBe(4.2);

    const round = declareGo(
      addHandToRound(createGoChainState(), 2_000, {
        completedCollectionYakuIds: ["godori"],
        masteryEvents: [played, collection],
      }),
      1_000,
    );
    const settled = settleRound(round, {});
    expect(settled.rewardFactor).toBe(1.7);
    expect(
      settled.masteryEvents
        .filter((event) => event.yakuId === "godori")
        .reduce((sum, event) => sum + event.amount, 0),
    ).toBe(2);
    expect(settled.masteryLevels).toMatchObject({
      ttaeng: { level: 1, mastery: 1 },
      godori: { level: 1, mastery: 2 },
    });
  });

  it("grants no Go mastery bonus when the round is stopped at zero Go", () => {
    const round = addHandToRound(createGoChainState(), 900, {
      completedCollectionYakuIds: ["godori"],
      masteryEvents: [collection],
    });
    const settled = settleRound(round, {});
    expect(settled.rewardFactor).toBe(1);
    expect(settled.masteryEvents).toHaveLength(1);
  });

  it("commits 3→5→7 mastery thresholds deterministically", () => {
    const events = Array.from({ length: 8 }, () => ({ yakuId: "ttaeng" as const, amount: 1, reason: "played" as const }));
    expect(commitMasteryEvents({}, events).ttaeng).toEqual({ level: 3, mastery: 0 });
    const breakdown = calculateBestHandScore({ submittedCards: [takeKind(1, "bright"), takeKind(1, "chaff")] });
    expect(createMasteryEvents(breakdown)[0]).toMatchObject({ yakuId: "ttaeng", amount: 1 });
  });
});
