import { describe, expect, it } from "vitest";
import { STAGES } from "../content/stages";
import { createStandardHwatuDeck, shuffleWithSeed } from "../engine/deck";
import { calculateBestHandScore } from "../engine/scoring";
import { findImmediateYakuCandidates } from "../engine/yaku";
import type { CardInstance } from "../types";

/**
 * A brute-force ceiling for a run with zero upgrades.
 *
 * For each of 40 seeded shuffles it deals four 8-card hands and, for every one,
 * tries every legal 2~5장 submission and keeps the best. That is far better than
 * a person plays, so it is an upper bound rather than an expectation — but it is
 * a stable one, which makes it a useful guard rail for the stage ladder.
 *
 * If this drifts, the stage targets in content/stages.ts drift with it.
 */

const RUNS = 40;
const HANDS_PER_ROUND = 4;
const HAND_SIZE = 8;

function combinations(cards: readonly CardInstance[], size: number): CardInstance[][] {
  if (size === 0) return [[]];
  if (cards.length < size) return [];
  const [head, ...rest] = cards;
  return [
    ...combinations(rest, size - 1).map((tail) => [head, ...tail]),
    ...combinations(rest, size),
  ];
}

function bestSubmission(hand: readonly CardInstance[]): number {
  let best = 0;
  for (let size = 2; size <= 5; size += 1) {
    for (const pick of combinations(hand, size)) {
      // 실제 플레이어처럼 끗패로 삼을 두 장을 먼저 고르는 모든 경우를 탐색한다.
      for (let left = 0; left < pick.length - 1; left += 1) {
        for (let right = left + 1; right < pick.length; right += 1) {
          const ordered = [pick[left], pick[right], ...pick.filter((_, index) => index !== left && index !== right)];
          if (findImmediateYakuCandidates(ordered).length === 0) continue;
          const evaluated = calculateBestHandScore({ submittedCards: ordered });
          if (evaluated.score > best) best = evaluated.score;
        }
      }
    }
  }
  return best;
}

function optimalRoundScores(): number[] {
  const scores: number[] = [];
  for (let run = 0; run < RUNS; run += 1) {
    const deck = shuffleWithSeed(createStandardHwatuDeck(), `balance-${run}`);
    let round = 0;
    for (let hand = 0; hand < HANDS_PER_ROUND; hand += 1) {
      round += bestSubmission(deck.slice(hand * HAND_SIZE, (hand + 1) * HAND_SIZE));
    }
    scores.push(round);
  }
  return scores.sort((left, right) => left - right);
}

describe("stage ladder balance", () => {
  const scores = optimalRoundScores();
  const median = scores[Math.floor(scores.length / 2)];
  const targets = STAGES.map((stage) => stage.target);

  it("always finds a legal submission in an eight-card hand", () => {
    expect(scores[0]).toBeGreaterThan(0);
  });

  it("keeps the first three stages clearable without any shopping", () => {
    // Half the no-upgrade ceiling is a rough stand-in for how a person plays.
    const humanish = median / 2;
    expect(targets[0]).toBeLessThan(humanish);
    expect(targets[1]).toBeLessThan(humanish);
    expect(targets[2]).toBeLessThan(humanish);
  });

  it("pushes past the no-upgrade ceiling by the middle of the run", () => {
    expect(targets[4]).toBeGreaterThan(median);
    expect(targets[5]).toBeGreaterThan(median * 2);
  });

  it("climbs at a steady rate the 배수 engine can chase", () => {
    for (let index = 1; index < targets.length; index += 1) {
      const ratio = targets[index] / targets[index - 1];
      expect(ratio).toBeGreaterThan(1.5);
      expect(ratio).toBeLessThan(2);
    }
  });
});
