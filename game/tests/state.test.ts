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

  it("scores a month pair into P, then banks P into confirmed C", () => {
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
      manualYakuId: "month_pair" as const,
      yard: { cards: [], sweptCount: 0, shakeArmed: false },
      targetScore: 10_000,
      chain: createGoChainState(),
    };

    const decision = gameReducer(base, { type: "SUBMIT_HAND" });
    expect(decision.screen).toBe("decision");
    expect(decision.lastScore?.yakuId).toBe("month_pair");
    expect(decision.chain.pot).toBeGreaterThan(0);
    expect(decision.chain.confirmedScore).toBe(0);

    const banked = gameReducer(decision, { type: "BANK_CHAIN" });
    expect(banked.screen).toBe("play");
    expect(banked.chain.pot).toBe(0);
    expect(banked.chain.confirmedScore).toBeGreaterThan(0);
    expect(banked.chain.confirmedCollection.cardIds).toEqual(expect.arrayContaining(januaryPair.map((card) => card.instanceId)));
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

  it("clears a chosen yaku when cards or the cup role change", () => {
    const deck = createStandardHwatuDeck();
    const pair = deck.filter((card) => card.month === 1).slice(0, 2);
    const base = {
      ...createInitialGameState("MANUAL-RESET"),
      screen: "play" as const,
      deck,
      hand: deck.slice(0, 8),
      selectedCardIds: pair.map((card) => card.instanceId),
      manualYakuId: "month_pair" as const,
    };

    const changedCards = gameReducer(base, { type: "SELECT_CARD", cardId: base.hand[4].instanceId });
    expect(changedCards.manualYakuId).toBeNull();

    const changedRole = gameReducer(base, { type: "SET_CUP_ROLE", role: "double_chaff" });
    expect(changedRole.manualYakuId).toBeNull();
  });

  it("requires a valid manually chosen yaku before submission", () => {
    const deck = createStandardHwatuDeck();
    const pair = deck.filter((card) => card.month === 1).slice(0, 2);
    const base = {
      ...createInitialGameState("MANUAL-SUBMIT"),
      runId: "manual-submit",
      screen: "play" as const,
      deck,
      hand: pair,
      selectedCardIds: pair.map((card) => card.instanceId),
      yard: { cards: [], sweptCount: 0, shakeArmed: false },
    };

    expect(gameReducer(base, { type: "SUBMIT_HAND" })).toBe(base);

    const invalid = gameReducer(
      { ...base, manualYakuId: "four_ribbons" as const },
      { type: "SUBMIT_HAND" },
    );
    expect(invalid.screen).toBe("play");
    expect(invalid.handsRemaining).toBe(base.handsRemaining);
    expect(invalid.lastScore).toBeNull();

    const valid = gameReducer(
      { ...base, manualYakuId: "month_pair" as const },
      { type: "SUBMIT_HAND" },
    );
    expect(valid.screen).toBe("decision");
    expect(valid.lastScore?.yakuId).toBe("month_pair");
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
    const choice = gameReducer(reward, { type: "CONTINUE_AFTER_REWARD" });
    expect(choice.screen).toBe("shop_choice");
    const shop = gameReducer(choice, { type: "CHOOSE_SHOP", shopType: "book" });
    expect(shop.shopOffers).toHaveLength(4);
    const contract = gameReducer(shop, { type: "NEXT_STAGE" });
    expect(contract.screen).toBe("contract");
    expect(contract.contractChoices).toHaveLength(2);
    const next = gameReducer(contract, { type: "CHOOSE_CONTRACT", contractId: contract.contractChoices[0] });
    expect(next.screen).toBe("round_intro");
    expect(next.stage).toBe(4);
    expect(next.contracts).toContain(contract.contractChoices[0]);
  });
});
