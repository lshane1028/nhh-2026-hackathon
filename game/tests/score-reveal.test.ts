import { describe, expect, it } from "vitest";

import {
  deriveScoreRevealState,
  scoreRevealKey,
  selectScoreRailBreakdown,
  selectScoreRevealBreakdown,
} from "../../app/components/useScoreReveal";
import type { ScoreBreakdown } from "../types";

const scoredHand: ScoreBreakdown = {
  yakuId: "ttaeng",
  yakuName: "땡",
  scoringCardIds: ["card-a", "card-b"],
  jitCardIds: [],
  jitSum: 0,
  rankLabel: "1땡",
  newCollectionYakuIds: [],
  startingKkeut: 10,
  startingHeung: 2,
  finalKkeut: 20,
  finalHeung: 3,
  score: 60,
  operations: [{
    sourceId: "talisman-a",
    label: "부적 효과",
    operation: "add_kkeut",
    value: 10,
    runningKkeut: 20,
    runningHeung: 3,
  }],
};

describe("score rail reveal", () => {
  it("shows the submitted hand, holds the result, then becomes idle", () => {
    const submissionId = "run-a:2:1";
    const key = scoreRevealKey(scoredHand, submissionId);

    expect(deriveScoreRevealState(scoredHand, submissionId, { key, index: 0 })).toMatchObject({
      visible: true,
      playing: true,
      kkeut: 10,
      heung: 2,
      total: null,
    });
    expect(deriveScoreRevealState(scoredHand, submissionId, { key, index: 1 })).toMatchObject({
      visible: true,
      playing: true,
      kkeut: 20,
      heung: 3,
      current: scoredHand.operations[0],
    });
    expect(deriveScoreRevealState(scoredHand, submissionId, { key, index: 2 })).toMatchObject({
      visible: true,
      playing: false,
      total: 60,
    });
    expect(deriveScoreRevealState(scoredHand, submissionId, { key, index: 3 })).toMatchObject({
      visible: false,
      playing: false,
    });
  });

  it("also releases a hand that has no score operations", () => {
    const plain = { ...scoredHand, operations: [] };
    const submissionId = "run-a:2:2";
    const key = scoreRevealKey(plain, submissionId);

    expect(deriveScoreRevealState(plain, submissionId, { key, index: 0 }).playing).toBe(true);
    expect(deriveScoreRevealState(plain, submissionId, { key, index: 1 })).toMatchObject({
      visible: true,
      playing: false,
      total: 60,
    });
    expect(deriveScoreRevealState(plain, submissionId, { key, index: 2 }).visible).toBe(false);
  });

  it("treats an identical recycled hand as a new submission", () => {
    const oldId = "run-a:2:3";
    const nextId = "run-a:2:4";
    const hiddenProgress = {
      key: scoreRevealKey(scoredHand, oldId),
      index: scoredHand.operations.length + 2,
    };

    expect(deriveScoreRevealState(scoredHand, oldId, hiddenProgress).visible).toBe(false);
    expect(deriveScoreRevealState(scoredHand, nextId, hiddenProgress)).toMatchObject({
      visible: true,
      playing: true,
      kkeut: scoredHand.startingKkeut,
      heung: scoredHand.startingHeung,
    });
  });

  it("does not replay the score stored in a continued run", () => {
    const continuedId = "saved-run:7:2";
    expect(selectScoreRevealBreakdown(scoredHand, continuedId, continuedId)).toBeNull();
    expect(selectScoreRevealBreakdown(scoredHand, "saved-run:7:3", continuedId)).toBe(scoredHand);
  });

  it("returns to 0 × 0 state instead of reviving the previous yaku", () => {
    expect(selectScoreRailBreakdown({
      preview: null,
      lastScore: scoredHand,
      selectedCount: 0,
      revealVisible: false,
    })).toBeNull();

    expect(selectScoreRailBreakdown({
      preview: null,
      lastScore: scoredHand,
      selectedCount: 1,
      revealVisible: true,
    })).toBeNull();

    expect(selectScoreRailBreakdown({
      preview: scoredHand,
      lastScore: null,
      selectedCount: 2,
      revealVisible: false,
    })).toBe(scoredHand);
  });
});
