import { describe, expect, it } from "vitest";

import { createStandardHwatuDeck } from "../engine/deck";
import { createGoChainState } from "../engine/go";
import { calculateBestHandScore, calculateHandScore } from "../engine/scoring";
import { createInitialGameState, gameReducer } from "../state/game";
import type { CardInstance, YakuCandidate } from "../types";

const standardDeck = createStandardHwatuDeck();

function card(month: number, index = 0): CardInstance {
  const matches = standardDeck.filter((entry) => entry.month === month);
  const match = matches[index];
  if (!match) throw new Error(`Missing ${month}월 test card`);
  return match;
}

function withEffect(source: CardInstance, effectTagId: string, suffix: string): CardInstance {
  return {
    ...source,
    tags: [...source.tags],
    instanceId: `${source.instanceId}:${suffix}`,
    effectTagId,
  };
}

describe("live card effect mechanics", () => {
  it("emits card-sourced operations for 짝패, 무거운 달 and 고집패", () => {
    const heavy = withEffect(card(4), "heavy_month", "heavy");
    const partner = withEffect(card(6), "partner_boost", "partner");
    const stubborn = withEffect(card(12), "stubborn", "stubborn");
    const submitted = [heavy, partner, stubborn, card(8)];

    const breakdown = calculateBestHandScore({ submittedCards: submitted });
    const effectOperations = breakdown.operations.filter((operation) =>
      [heavy.instanceId, partner.instanceId, stubborn.instanceId].includes(operation.sourceId),
    );

    expect(effectOperations).toMatchObject([
      { sourceId: heavy.instanceId, label: "무거운 달", operation: "add_kkeut", value: 50 },
      { sourceId: partner.instanceId, label: "짝패", operation: "add_heung", value: 2 },
      { sourceId: stubborn.instanceId, label: "고집패", operation: "add_heung", value: 3 },
    ]);
    const [heavyOperation, partnerOperation, stubbornOperation] = effectOperations;
    const partnerIndex = breakdown.operations.indexOf(partnerOperation);
    const heungBeforePartner = partnerIndex > 0
      ? breakdown.operations[partnerIndex - 1].runningHeung
      : breakdown.startingHeung;
    expect(heavyOperation.runningKkeut).toBe(breakdown.startingKkeut + 50);
    expect(partnerOperation.runningHeung).toBeCloseTo(heungBeforePartner + 2, 5);
    expect(stubbornOperation.runningHeung).toBeCloseTo(partnerOperation.runningHeung + 3, 5);
    expect(breakdown.finalKkeut).toBe(breakdown.startingKkeut + 50);
    expect(breakdown.score).toBe(Math.floor(breakdown.finalKkeut * breakdown.finalHeung));
  });

  it("only triggers 짝패 when another card scores with it", () => {
    const partner = withEffect(card(1), "partner_boost", "solo-partner");
    const bystander = card(2);
    const candidate: YakuCandidate = {
      yakuId: "mangtong",
      scoringCardIds: [partner.instanceId],
      jitCardIds: [],
      jitSum: 0,
      label: "망통",
    };

    const breakdown = calculateHandScore({ candidate, submittedCards: [partner, bystander] });
    expect(breakdown.operations.some((operation) => operation.sourceId === partner.instanceId)).toBe(false);
  });

  it("pays 금칠패 immediately when its card scores", () => {
    const first = withEffect(card(1), "gilded", "gilded");
    const second = card(1, 1);
    const base = {
      ...createInitialGameState("GILDED-EFFECT"),
      runId: "gilded-effect",
      screen: "play" as const,
      deck: standardDeck,
      hand: [first, second],
      drawPile: [],
      selectedCardIds: [first.instanceId, second.instanceId],
      targetScore: 1_000_000,
      chain: createGoChainState(),
    };

    const scored = gameReducer(base, { type: "SUBMIT_HAND" });
    expect(scored.money).toBe(base.money + 1);
    expect(scored.stats.moneyEarned).toBe(base.stats.moneyEarned + 1);
  });

  it("pays 3냥 per 곳간패 left in hand at round settlement", () => {
    const keeper = withEffect(card(3), "keeper_coin", "keeper");
    const decision = {
      ...createInitialGameState("KEEPER-EFFECT"),
      runId: "keeper-effect",
      screen: "decision" as const,
      hand: [keeper],
      targetScore: 1,
      chain: {
        ...createGoChainState(),
        submissionScore: 925,
        roundScore: 925,
      },
    };
    const plain = gameReducer({ ...decision, hand: [{ ...keeper, effectTagId: undefined }] }, { type: "STOP_ROUND" });
    const paid = gameReducer(decision, { type: "STOP_ROUND" });

    expect(paid.lastRoundReward).toBe(plain.lastRoundReward + 3);
    expect(paid.money).toBe(plain.money + 3);
    expect(paid.lastRoundSummary?.rewardReasons).toContainEqual({
      id: "keeper-coin",
      label: "곳간패를 남겨서",
      detail: "곳간패 1장",
      amount: 3,
    });
  });
});
