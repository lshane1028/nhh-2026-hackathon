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
      yard: { cards: [], sweptCount: 0 },
      targetScore: 10_000,
      chain: createGoChainState(),
    };

    // Far below the target: the hand just banks score and play continues.
    const playing = gameReducer(base, { type: "SUBMIT_HAND" });
    expect(playing.screen).toBe("play");
    expect(playing.lastScore?.yakuId).toBe("ttaeng");
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
      yard: { cards: [], sweptCount: 0 },
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
      yard: { cards: [], sweptCount: 0 },
      targetScore: 1_000_000,
      handsRemaining: 1,
      chain: { ...createGoChainState(), goCount: 1 as const },
    };

    const bust = gameReducer(base, { type: "SUBMIT_HAND" });
    expect(bust.screen).toBe("run_lose");
    expect(bust.stats.goFailures).toBe(1);
  });

  it("opens a card pack into picks that land in the deck with an effect tag", () => {
    const base = createInitialGameState("PACK-SMOKE");
    const shop = {
      ...base,
      runId: "pack-smoke",
      screen: "shop" as const,
      money: 99,
      shopOffers: [{
        offerId: "offer-pack",
        category: "pack" as const,
        definitionId: "pack_hwatu_large",
        price: 7,
        sold: false,
      }],
    };
    const deckBefore = shop.deck.length;

    const opened = gameReducer(shop, { type: "BUY_OFFER", offerId: "offer-pack" });
    expect(opened.pendingPack?.picksLeft).toBe(2);
    expect(opened.pendingPack?.candidates).toHaveLength(5);
    // Every candidate carries a label-only effect tag.
    expect(opened.pendingPack?.candidates.every((card) => Boolean(card.effectTagId))).toBe(true);
    expect(opened.deck).toHaveLength(deckBefore);
    expect(opened.money).toBe(92);

    const first = opened.pendingPack!.candidates[0];
    const afterFirst = gameReducer(opened, { type: "PICK_PACK_CARD", instanceId: first.instanceId });
    expect(afterFirst.deck).toHaveLength(deckBefore + 1);
    expect(afterFirst.pendingPack?.picksLeft).toBe(1);
    expect(afterFirst.pendingPack?.candidates).toHaveLength(4);

    const second = afterFirst.pendingPack!.candidates[0];
    const afterSecond = gameReducer(afterFirst, { type: "PICK_PACK_CARD", instanceId: second.instanceId });
    expect(afterSecond.deck).toHaveLength(deckBefore + 2);
    // Picks exhausted, so the prompt closes on its own.
    expect(afterSecond.pendingPack).toBeNull();
  });

  it("keeps the hand sorted and switches between month and kind order", () => {
    const deck = createStandardHwatuDeck();
    const messy = [
      deck.find((card) => card.month === 9 && card.kind === "chaff")!,
      deck.find((card) => card.month === 1 && card.kind === "bright")!,
      deck.find((card) => card.month === 5 && card.kind === "animal")!,
      deck.find((card) => card.month === 3 && card.kind === "ribbon")!,
      deck.find((card) => card.month === 1 && card.kind === "chaff")!,
    ];
    const base = { ...createInitialGameState("SORT"), screen: "play" as const, deck, hand: messy };

    const byMonth = gameReducer(base, { type: "SET_HAND_SORT", mode: "month" });
    expect(byMonth.hand.map((card) => card.month)).toEqual([1, 1, 3, 5, 9]);
    // Ties inside a month fall back to 광 → 동물 → 띠 → 피.
    expect(byMonth.hand.slice(0, 2).map((card) => card.kind)).toEqual(["bright", "chaff"]);

    const byKind = gameReducer(byMonth, { type: "SET_HAND_SORT", mode: "kind" });
    expect(byKind.hand.map((card) => card.kind)).toEqual([
      "bright", "animal", "ribbon", "chaff", "chaff",
    ]);
    expect(byKind.hand.slice(3).map((card) => card.month)).toEqual([1, 9]);
    expect(byKind.handSort).toBe("kind");
  });

  it("refuses to discard a stubborn card even when bundled with others", () => {
    const deck = createStandardHwatuDeck();
    const stubborn = { ...deck[0], effectTagId: "stubborn" };
    const plain = deck[1];
    const hand = [stubborn, plain];
    const base = {
      ...createInitialGameState("STUBBORN"),
      runId: "stubborn",
      screen: "play" as const,
      deck: [stubborn, ...deck.slice(1)],
      hand,
      drawPile: deck.slice(2),
      selectedCardIds: hand.map((card) => card.instanceId),
    };

    const discarded = gameReducer(base, { type: "DISCARD_SELECTED" });
    // The plain card goes, the stubborn one stays in hand.
    expect(discarded.hand.some((card) => card.instanceId === stubborn.instanceId)).toBe(true);
    expect(discarded.usedPile.map((card) => card.instanceId)).toEqual([plain.instanceId]);

    // Selecting only the stubborn card spends nothing at all.
    const onlyStubborn = gameReducer(
      { ...base, selectedCardIds: [stubborn.instanceId] },
      { type: "DISCARD_SELECTED" },
    );
    expect(onlyStubborn.discardsRemaining).toBe(base.discardsRemaining);
    expect(onlyStubborn.hand).toHaveLength(2);
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
      yard: { cards: [], sweptCount: 0 },
    };

    // Nothing selected means nothing to score.
    expect(gameReducer(base, { type: "SUBMIT_HAND" }).lastScore).toBeNull();

    const selected = { ...base, selectedCardIds: pair.map((card) => card.instanceId) };
    const submitted = gameReducer(selected, { type: "SUBMIT_HAND" });
    expect(submitted.lastScore?.yakuId).toBe("ttaeng");
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
      yard: { cards: [], sweptCount: 0 },
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
    // Four departments: 부적전 2, 비결서점 2, 덱 손질방 (묶음 2 + 소각 1), 금단장 1.
    const byCategory = shop.shopOffers.reduce<Record<string, number>>((counts, offer) => {
      counts[offer.category] = (counts[offer.category] ?? 0) + 1;
      return counts;
    }, {});
    expect(byCategory).toEqual({ talisman: 2, book: 2, forbidden: 1, pack: 2, painter: 1 });
    // The workshop only ever stocks the burn painter, never the month edits.
    expect(
      shop.shopOffers.filter((offer) => offer.category === "painter").map((offer) => offer.definitionId),
    ).toEqual(["p_burn"]);
    const contract = gameReducer(shop, { type: "NEXT_STAGE" });
    expect(contract.screen).toBe("contract");
    expect(contract.contractChoices).toHaveLength(2);
    const next = gameReducer(contract, { type: "CHOOSE_CONTRACT", contractId: contract.contractChoices[0] });
    expect(next.screen).toBe("round_intro");
    expect(next.stage).toBe(4);
    expect(next.contracts).toContain(contract.contractChoices[0]);
  });
});
