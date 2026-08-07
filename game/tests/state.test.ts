import { describe, expect, it } from "vitest";

import { TALISMANS } from "../content/talismans";
import type { TalismanDefinition } from "../types";
import { createStandardHwatuDeck } from "../engine/deck";
import { createGoChainState } from "../engine/go";
import { createInitialGameState, gameReducer, sortHand } from "../state/game";

describe("playable run reducer", () => {
  it("starts a seeded run with the full deck, hand and four actions", () => {
    const title = createInitialGameState("STATE-SMOKE");
    const intro = gameReducer(title, { type: "START_RUN", startDeckId: "deck_standard", tutorialMode: false });
    const play = gameReducer(intro, { type: "START_STAGE" });

    expect(play.screen).toBe("play");
    expect(play.deck).toHaveLength(48);
    expect(play.hand).toHaveLength(8);
    expect(play.yard.cards).toHaveLength(0);
    // 제출 4 : 버리기 3. 버리기 한 번의 실측 가치가 제출의 약 1/7이라 같은
    // 개수로 두면 두 자원이 대등해 보이는 착시가 생긴다.
    expect(play.handsRemaining).toBe(4);
    expect(play.discardsRemaining).toBe(3);
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

  it("always keeps the hand in calendar order", () => {
    // The 광·동물·띠·피 toggle is gone. 짓 is built from month sums, so month
    // order is the only arrangement that helps with the actual task.
    const deck = createStandardHwatuDeck();
    const messy = [
      deck.find((card) => card.month === 9 && card.kind === "chaff")!,
      deck.find((card) => card.month === 1 && card.kind === "bright")!,
      deck.find((card) => card.month === 5 && card.kind === "animal")!,
      deck.find((card) => card.month === 3 && card.kind === "ribbon")!,
      deck.find((card) => card.month === 1 && card.kind === "chaff")!,
    ];
    const base = {
      ...createInitialGameState("SORT"),
      screen: "round_intro" as const,
      deck: [...messy, ...deck.filter((card) => !messy.includes(card))],
    };
    const play = gameReducer(base, { type: "START_STAGE" });
    const months = play.hand.map((card) => card.month);
    expect(months).toEqual([...months].sort((left, right) => left - right));
    // Ties inside a month still fall back to 광 → 동물 → 띠 → 피.
    expect(sortHand(messy).map((card) => card.kind).slice(0, 2)).toEqual(["bright", "chaff"]);
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

  it("never restocks a talisman the player already owns", () => {
    // Own everything but two, and the shelf can only hold those two.
    const survivors = ["t_first_charm", "t_empty_shrine"];
    const reward = {
      ...createInitialGameState("OWNED-SMOKE"),
      runId: "owned-smoke",
      stage: 3,
      screen: "reward" as const,
      talismans: TALISMANS
        .filter((entry) => !survivors.includes(entry.id))
        .map((entry) => ({ instanceId: `owned:${entry.id}`, definitionId: entry.id, growth: 0 })),
    };
    const shop = gameReducer(reward, { type: "CONTINUE_AFTER_REWARD" });
    const offered = shop.shopOffers
      .filter((offer) => offer.category === "talisman")
      .map((offer) => offer.definitionId);
    expect(offered).toHaveLength(2);
    expect([...offered].sort()).toEqual([...survivors].sort());
  });

  it("lets 제물 단도 eat its right-hand neighbour when a stage opens", () => {
    const byId = (id: string): TalismanDefinition =>
      TALISMANS.find((entry) => entry.id === id) as TalismanDefinition;
    const dagger = byId("t_devouring_dagger");
    const victim = byId("t_first_charm");
    const intro = {
      ...createInitialGameState("DAGGER-SMOKE"),
      runId: "dagger-smoke",
      screen: "round_intro" as const,
      talismans: [
        { instanceId: "owned:dagger", definitionId: dagger.id, growth: 0 },
        { instanceId: "owned:victim", definitionId: victim.id, growth: 0 },
      ],
    };
    const play = gameReducer(intro, { type: "START_STAGE" });
    expect(play.talismans.map((item) => item.definitionId)).toEqual([dagger.id]);
    expect(play.talismans[0].growth).toBeCloseTo(victim.price * (dagger.amount ?? 0), 5);

    // With nothing to its right the dagger just sits there.
    const alone = gameReducer(
      { ...intro, talismans: [intro.talismans[0]] },
      { type: "START_STAGE" },
    );
    expect(alone.talismans).toHaveLength(1);
    expect(alone.talismans[0].growth).toBe(0);
  });

  it("grows 무광 연습 on a bright-free hand and resets it on a 광", () => {
    const deck = createStandardHwatuDeck();
    const chaffPair = deck.filter((card) => card.month === 1 && card.kind === "chaff").slice(0, 2);
    const brightPair = [
      deck.find((card) => card.month === 1 && card.kind === "bright")!,
      deck.find((card) => card.month === 1 && card.kind === "ribbon")!,
    ];
    const base = (hand: typeof chaffPair) => ({
      ...createInitialGameState("DROUGHT-SMOKE"),
      runId: "drought",
      screen: "play" as const,
      deck,
      hand,
      drawPile: deck.filter((card) => !hand.some((entry) => entry.instanceId === card.instanceId)),
      selectedCardIds: hand.map((card) => card.instanceId),
      targetScore: 10_000,
      talismans: [{ instanceId: "owned:drought", definitionId: "t_dark_practice", growth: 0.7 }],
    });

    const grown = gameReducer(base(chaffPair), { type: "SUBMIT_HAND" });
    expect(grown.talismans[0].growth).toBeCloseTo(0.7 + 0.35, 5);

    const reset = gameReducer(base(brightPair), { type: "SUBMIT_HAND" });
    expect(reset.talismans[0].growth).toBe(0);
  });

  it("hands out the collection perks the moment a row completes", () => {
    const deck = createStandardHwatuDeck();
    // 홍단 1·2월을 이미 모아 둔 상태에서 3월 홍단을 내면 그 순간 단이 완성된다.
    const hong = (month: number) =>
      deck.find((card) => card.month === month && card.ribbonGroup === "hong")!;
    const closer = hong(3);
    // 짓 없이 낼 수 있도록 2장 제출로 맞춘다.
    const partner = deck.find((card) => card.month === 5 && card.kind === "chaff")!;
    const hand = [closer, partner];

    const base = {
      ...createInitialGameState("PERK"),
      runId: "perk",
      screen: "play" as const,
      deck,
      hand,
      drawPile: deck.filter((card) => !hand.some((entry) => entry.instanceId === card.instanceId)),
      selectedCardIds: hand.map((card) => card.instanceId),
      targetScore: 10_000,
      chain: {
        ...createGoChainState(),
        collection: {
          cardIds: [hong(1).instanceId, hong(2).instanceId],
          completedYakuIds: [],
        },
      },
    };

    const before = { hands: base.handsRemaining, discards: base.discardsRemaining };
    const after = gameReducer(base, { type: "SUBMIT_HAND" });

    // 단 완성으로 버리기가 하나 늘고, 제출은 이번 손을 쓴 만큼만 줄어야 한다.
    expect(after.discardsRemaining).toBe(before.discards + 1);
    expect(after.handsRemaining).toBe(before.hands - 1);

    // 같은 판에서 또 내도 이미 받은 단이 다시 주지는 않는다.
    const again = gameReducer(
      { ...after, selectedCardIds: after.hand.slice(0, 2).map((card) => card.instanceId) },
      { type: "SUBMIT_HAND" },
    );
    expect(again.discardsRemaining).toBe(after.discardsRemaining);
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
