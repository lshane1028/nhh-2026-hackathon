import { describe, expect, it } from "vitest";

import { createStandardHwatuDeck } from "../engine/deck";
import { createGoChainState } from "../engine/go";
import { createInitialGameState, gameReducer } from "../state/game";

describe("playable run reducer", () => {
  it("starts a seeded run with the full deck, hand and four actions", () => {
    const title = createInitialGameState("STATE-SMOKE");
    const intro = gameReducer(title, { type: "START_RUN", startDeckId: "deck_standard", tutorialMode: false });
    const play = gameReducer(intro, { type: "START_STAGE" });

    expect(play.screen).toBe("play");
    expect(play.deck).toHaveLength(48);
    expect(play.hand).toHaveLength(8);
    expect(play.yard.cards).toHaveLength(0);
    expect(play.handsRemaining).toBe(4);
    expect(play.discardsRemaining).toBe(4);
    expect(new Set([...play.hand, ...play.drawPile].map((card) => card.instanceId)).size).toBe(48);
  });

  it("keeps playing below the target, then opens the Go/Stop decision once it is cleared", () => {
    const deck = createStandardHwatuDeck();
    const januaryPair = deck.filter((card) => card.month === 1).slice(0, 2);
    const base = {
      ...createInitialGameState("BANK-SMOKE"),
      runId: "bank-smoke",
      startDeckId: "deck_standard",
      screen: "play" as const,
      deck,
      hand: januaryPair,
      drawPile: deck.filter((card) => !januaryPair.some((selected) => selected.instanceId === card.instanceId)),
      selectedCardIds: januaryPair.map((card) => card.instanceId),
      yard: { cards: [], sweptCount: 0, shakeArmed: false },
      targetScore: 10_000,
      chain: createGoChainState(),
    };

    // Far below the target: the hand just banks score and play continues.
    const playing = gameReducer(base, { type: "SUBMIT_HAND" });
    expect(playing.screen).toBe("play");
    expect(playing.lastScore?.yakuId).toBe("month_pair");
    expect(playing.chain.roundScore).toBeGreaterThan(0);
    expect(playing.chain.goCount).toBe(0);
    expect(playing.chain.collection.cardIds).toEqual(
      expect.arrayContaining(januaryPair.map((card) => card.instanceId)),
    );

    // A target the first hand clears opens the decision instead.
    const cleared = gameReducer({ ...base, targetScore: 1 }, { type: "SUBMIT_HAND" });
    expect(cleared.screen).toBe("decision");
  });

  it("stops for the purse, or calls Go to raise both the bar and the payout", () => {
    const deck = createStandardHwatuDeck();
    const pair = deck.filter((card) => card.month === 1).slice(0, 2);
    const base = {
      ...createInitialGameState("GO-BET"),
      runId: "go-bet",
      screen: "play" as const,
      deck,
      hand: pair,
      drawPile: deck.filter((card) => !pair.some((s) => s.instanceId === card.instanceId)),
      selectedCardIds: pair.map((card) => card.instanceId),
      yard: { cards: [], sweptCount: 0, shakeArmed: false },
      targetScore: 1,
      chain: createGoChainState(),
    };
    const decision = gameReducer(base, { type: "SUBMIT_HAND" });
    expect(decision.screen).toBe("decision");

    const stopped = gameReducer(decision, { type: "STOP_ROUND" });
    expect(stopped.screen).toBe("reward");
    expect(stopped.lastRoundReward).toBeGreaterThan(0);

    const went = gameReducer(decision, { type: "DECLARE_GO" });
    expect(went.chain.goCount).toBe(1);
    expect(went.stats.goAttempts).toBe(1);
    // The bar it already cleared re-opens the decision immediately.
    expect(["play", "decision"]).toContain(went.screen);

    // Going pays more than stopping from the same position.
    const wentThenStopped = gameReducer({ ...went, screen: "decision" as const }, { type: "STOP_ROUND" });
    expect(wentThenStopped.lastRoundReward).toBeGreaterThan(stopped.lastRoundReward);
  });

  it("ends the run when a called Go runs out of hands", () => {
    const deck = createStandardHwatuDeck();
    const pair = deck.filter((card) => card.month === 1).slice(0, 2);
    const base = {
      ...createInitialGameState("GO-BUST"),
      runId: "go-bust",
      screen: "play" as const,
      deck,
      hand: pair,
      drawPile: deck.filter((card) => !pair.some((s) => s.instanceId === card.instanceId)),
      selectedCardIds: pair.map((card) => card.instanceId),
      yard: { cards: [], sweptCount: 0, shakeArmed: false },
      targetScore: 1_000_000,
      handsRemaining: 1,
      chain: { ...createGoChainState(), goCount: 1 as const },
    };

    const bust = gameReducer(base, { type: "SUBMIT_HAND" });
    expect(bust.screen).toBe("run_lose");
    expect(bust.stats.goFailures).toBe(1);
  });

  it("toggles only the clicked cards and preserves the five-card cap", () => {
    const deck = createStandardHwatuDeck();
    const hand = deck.slice(0, 6);
    let state: ReturnType<typeof createInitialGameState> = {
      ...createInitialGameState("SELECT-REGRESSION"),
      screen: "play" as const,
      deck,
      hand,
      selectedCardIds: [],
    };

    for (const index of [0, 2, 4]) {
      state = gameReducer(state, { type: "SELECT_CARD", cardId: hand[index].instanceId });
    }
    expect(state.selectedCardIds).toEqual([0, 2, 4].map((index) => hand[index].instanceId));

    state = gameReducer(state, { type: "SELECT_CARD", cardId: hand[2].instanceId });
    expect(state.selectedCardIds).toEqual([hand[0].instanceId, hand[4].instanceId]);

    state = gameReducer(state, { type: "CLEAR_SELECTION" });
    for (const card of hand.slice(0, 5)) {
      state = gameReducer(state, { type: "SELECT_CARD", cardId: card.instanceId });
    }
    expect(state.selectedCardIds).toHaveLength(5);
    const beforeSixth = state.selectedCardIds;
    state = gameReducer(state, { type: "SELECT_CARD", cardId: hand[5].instanceId });
    expect(state.selectedCardIds).toEqual(beforeSixth);
  });

  it("applies the highest scoring yaku without any manual choice", () => {
    const deck = createStandardHwatuDeck();
    const pair = deck.filter((card) => card.month === 1).slice(0, 2);
    const base = {
      ...createInitialGameState("AUTO-YAKU"),
      runId: "auto-yaku",
      screen: "play" as const,
      deck,
      hand: pair,
      selectedCardIds: [] as string[],
      yard: { cards: [], sweptCount: 0, shakeArmed: false },
    };

    // Nothing selected means nothing to score.
    expect(gameReducer(base, { type: "SUBMIT_HAND" }).lastScore).toBeNull();

    const selected = { ...base, selectedCardIds: pair.map((card) => card.instanceId) };
    const submitted = gameReducer(selected, { type: "SUBMIT_HAND" });
    expect(submitted.lastScore?.yakuId).toBe("month_pair");
    expect(submitted.handsRemaining).toBe(base.handsRemaining - 1);
    expect(submitted.chain.roundScore).toBe(submitted.lastScore?.score);
  });

  it("asks where to file the September cup only after it has scored", () => {
    const deck = createStandardHwatuDeck();
    const cup = deck.find((card) => card.tags.includes("cup"));
    if (!cup) throw new Error("September cup missing");
    const partner = deck.find((card) => card.month === 9 && card.instanceId !== cup.instanceId);
    if (!partner) throw new Error("September partner missing");
    const hand = [cup, partner];
    const base = {
      ...createInitialGameState("CUP-CHOICE"),
      runId: "cup-choice",
      screen: "play" as const,
      deck,
      hand,
      selectedCardIds: hand.map((card) => card.instanceId),
      yard: { cards: [], sweptCount: 0, shakeArmed: false },
    };

    expect(base.pendingCupCardId).toBeNull();

    const submitted = gameReducer(base, { type: "SUBMIT_HAND" });
    expect(submitted.pendingCupCardId).toBe(cup.instanceId);
    expect(submitted.cupAssignments).toEqual({});

    const filed = gameReducer(submitted, {
      type: "ASSIGN_CUP_ROLE",
      cardId: cup.instanceId,
      role: "double_chaff",
    });
    expect(filed.pendingCupCardId).toBeNull();
    expect(filed.cupAssignments[cup.instanceId]).toBe("double_chaff");

    // A cup that already has a role never asks again.
    const resubmitted = gameReducer(
      {
        ...filed,
        screen: "play" as const,
        hand,
        selectedCardIds: hand.map((card) => card.instanceId),
        chain: createGoChainState(),
      },
      { type: "SUBMIT_HAND" },
    );
    expect(resubmitted.pendingCupCardId).toBeNull();
    expect(resubmitted.lastScore).not.toBeNull();
  });

  it("buys and applies a painter card as a permanent deck edit", () => {
    const base = createInitialGameState("PAINTER-SMOKE");
    const target = base.deck.find((card) => card.month === 1);
    if (!target) throw new Error("January card missing");
    const shop = {
      ...base,
      runId: "painter-smoke",
      screen: "shop" as const,
      money: 99,
      shopType: "painter" as const,
      shopOffers: [{ offerId: "offer-painter", category: "painter" as const, definitionId: "p_month_plus", price: 4, sold: false }],
    };

    const editing = gameReducer(shop, { type: "BUY_OFFER", offerId: "offer-painter" });
    expect(editing.screen).toBe("deck_editor");
    expect(editing.pendingConsumableId).toBe("p_month_plus");

    const selected = gameReducer(editing, { type: "SELECT_CONSUMABLE_TARGET", cardId: target.instanceId });
    const applied = gameReducer(selected, { type: "APPLY_CONSUMABLE" });
    expect(applied.screen).toBe("shop");
    expect(applied.deck.find((card) => card.instanceId === target.instanceId)?.month).toBe(2);
    expect(applied.lastConsumableId).toBe("p_month_plus");
  });

  it("routes a cleared third month through reward, shop and a two-choice contract", () => {
    const reward = {
      ...createInitialGameState("CONTRACT-SMOKE"),
      runId: "contract-smoke",
      stage: 3,
      screen: "reward" as const,
      lastRoundReward: 7,
    };
    const shop = gameReducer(reward, { type: "CONTINUE_AFTER_REWARD" });
    expect(shop.screen).toBe("shop");
    // One card from each of the four shops, plus a pack.
    expect(shop.shopOffers).toHaveLength(5);
    expect(new Set(shop.shopOffers.map((offer) => offer.category))).toEqual(
      new Set(["talisman", "painter", "book", "forbidden", "pack"]),
    );
    const contract = gameReducer(shop, { type: "NEXT_STAGE" });
    expect(contract.screen).toBe("contract");
    expect(contract.contractChoices).toHaveLength(2);
    const next = gameReducer(contract, { type: "CHOOSE_CONTRACT", contractId: contract.contractChoices[0] });
    expect(next.screen).toBe("round_intro");
    expect(next.stage).toBe(4);
    expect(next.contracts).toContain(contract.contractChoices[0]);
  });
});
