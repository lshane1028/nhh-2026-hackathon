import { describe, expect, it } from "vitest";

import { TALISMANS } from "../content/talismans";
import { FORBIDDEN_CARDS } from "../content/upgrades";
import type { TalismanDefinition } from "../types";
import { createStandardHwatuDeck } from "../engine/deck";
import { createGoChainState } from "../engine/go";
import { randomAt } from "../engine/rng";
import { createInitialGameState, evaluateSelectedHand, gameReducer, getEffectiveCupRoles, sortHand } from "../state/game";
import { calculateCollectionBonus } from "../engine/collection-bonus";

describe("playable run reducer", () => {
  it("applies 외날 to an exact two-card hand in both preview and submission", () => {
    const deck = createStandardHwatuDeck();
    const pair = deck.filter((card) => card.month === 1).slice(0, 2);
    const state = {
      ...createInitialGameState("LONE-BLADE"),
      runId: "lone-blade",
      screen: "play" as const,
      deck,
      hand: pair,
      drawPile: deck.filter((card) => !pair.some((selected) => selected.instanceId === card.instanceId)),
      selectedCardIds: pair.map((card) => card.instanceId),
      yard: { cards: [], sweptCount: 0 },
      targetScore: 1_000_000,
      talismans: [{ instanceId: "owned:lone-blade", definitionId: "t_lone_blade", growth: 0 }],
    };

    const preview = evaluateSelectedHand(state)?.breakdown;
    expect(preview?.operations).toEqual(expect.arrayContaining([
      expect.objectContaining({ sourceId: "owned:lone-blade", operation: "add_kkeut", value: 60 }),
      expect.objectContaining({ sourceId: "owned:lone-blade", operation: "add_heung", value: 6 }),
    ]));
    expect(preview?.finalKkeut).toBe(61);

    const submitted = gameReducer(state, { type: "SUBMIT_HAND" });
    expect(submitted.lastScore?.score).toBe(preview?.score);
    expect(submitted.lastScore?.finalKkeut).toBe(61);
    expect(submitted.stats.highestHand).toBe(submitted.lastScore?.score);
    expect(submitted.stats.highestHandYakuId).toBe(submitted.lastScore?.yakuId);
    expect(submitted.stats.highestHandCards.map((card) => card.instanceId)).toEqual(
      pair.map((card) => card.instanceId),
    );
  });

  it("makes 국진 술잔 count its cup as animal and 쌍피 without opening a filing modal", () => {
    const deck = createStandardHwatuDeck();
    const cup = deck.find((card) => card.tags.includes("cup"))!;
    const partner = deck.find((card) => card.month === cup.month && card.instanceId !== cup.instanceId)!;
    const state = {
      ...createInitialGameState("DUAL-CUP"),
      runId: "dual-cup",
      screen: "play" as const,
      deck,
      hand: [cup, partner],
      drawPile: deck.filter((card) => card.instanceId !== cup.instanceId && card.instanceId !== partner.instanceId),
      selectedCardIds: [cup.instanceId, partner.instanceId],
      yard: { cards: [], sweptCount: 0 },
      targetScore: 1_000_000,
      talismans: [{ instanceId: "owned:dual-cup", definitionId: "t_chrysanthemum_cup", growth: 0 }],
    };

    const submitted = gameReducer(state, { type: "SUBMIT_HAND" });
    expect(submitted.pendingCupCardId).toBeNull();
    const result = calculateCollectionBonus(
      submitted.deck.filter((card) => submitted.chain.collection.cardIds.includes(card.instanceId)),
      getEffectiveCupRoles(submitted),
      submitted.yakuLevels,
    );
    expect(result.counts.animal).toBeGreaterThanOrEqual(1);
    expect(result.counts.chaff).toBeGreaterThanOrEqual(2);
  });

  it("applies 고리 장부 from the live purse to both preview and submitted score", () => {
    const deck = createStandardHwatuDeck();
    const pair = deck.filter((card) => card.month === 1).slice(0, 2);
    const state = {
      ...createInitialGameState("RING-LEDGER"),
      runId: "ring-ledger",
      screen: "play" as const,
      deck,
      hand: pair,
      drawPile: deck.filter((card) => !pair.some((selected) => selected.instanceId === card.instanceId)),
      selectedCardIds: pair.map((card) => card.instanceId),
      yard: { cards: [], sweptCount: 0 },
      money: 12,
      targetScore: 1_000_000,
      talismans: [{ instanceId: "owned:ring-ledger", definitionId: "t_ring_ledger", growth: 0 }],
    };

    const preview = evaluateSelectedHand(state);
    const ledger = preview?.breakdown.operations.find((operation) => operation.sourceId === "owned:ring-ledger");
    expect(ledger).toMatchObject({ label: "고리 장부", operation: "add_heung", value: 2 });

    const submitted = gameReducer(state, { type: "SUBMIT_HAND" });
    expect(submitted.lastScore?.operations).toContainEqual(expect.objectContaining({
      sourceId: "owned:ring-ledger",
      operation: "add_heung",
      value: 2,
    }));
    expect(submitted.lastScore?.finalHeung).toBe(preview?.breakdown.finalHeung);
  });

  it("preserves the exact two kkeut cards and the remaining jit cards for presentation", () => {
    const deck = createStandardHwatuDeck();
    const card = (month: number) => deck.find((entry) => entry.month === month && entry.kind === "chaff")
      ?? deck.find((entry) => entry.month === month)!;
    const hand = [card(12), card(7), card(4), card(6)];
    const state = {
      ...createInitialGameState("PRESENTATION-SPLIT"),
      runId: "presentation-split",
      screen: "play" as const,
      deck,
      hand,
      drawPile: [],
      selectedCardIds: hand.map((entry) => entry.instanceId),
    };

    const scored = evaluateSelectedHand(state);
    expect(scored?.breakdown).toMatchObject({ yakuId: "gabo", jitSum: 10 });
    expect(new Set(scored?.breakdown.jitCardIds)).toEqual(new Set([hand[2].instanceId, hand[3].instanceId]));
  });

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

  it("opens a card pack into picks that land in the deck with optional effects", () => {
    const base = createInitialGameState("PACK-SMOKE");
    const shop = {
      ...base,
      runId: "pack-smoke",
      screen: "shop" as const,
      money: 99,
      shopOffers: [{
        offerId: "offer-pack",
        category: "pack" as const,
        definitionId: "pack_hwatu_medium",
        price: 8,
        sold: false,
      }],
    };
    const deckBefore = shop.deck.length;

    const opened = gameReducer(shop, { type: "BUY_OFFER", offerId: "offer-pack" });
    expect(opened.pendingPack?.picksLeft).toBe(2);
    expect(opened.pendingPack?.candidates).toHaveLength(5);
    // A candidate may deliberately be plain; tagged and plain cards use the
    // same pick flow and both land in the deck intact.
    expect(opened.pendingPack?.candidates.every((card) => card.effectTagId === undefined || typeof card.effectTagId === "string")).toBe(true);
    expect(opened.deck).toHaveLength(deckBefore);
    expect(opened.money).toBe(91);

    const selected = opened.pendingPack!.candidates.slice(0, 2);
    const confirmed = gameReducer(opened, {
      type: "CONFIRM_PACK_SELECTION",
      candidateIds: selected.map((card) => card.instanceId),
    });
    expect(confirmed.deck).toHaveLength(deckBefore + 2);
    expect(confirmed.deck.slice(-2).map((card) => card.instanceId)).toEqual(selected.map((card) => card.instanceId));
    expect(confirmed.pendingPack).toBeNull();
  });

  it("keeps plain cards in the pack pool for deck balance", () => {
    let plainCards = 0;
    let effectCards = 0;
    let redundantKindEffects = 0;
    const redundantEffect = {
      bright: "as_bright",
      animal: "as_animal",
      ribbon: "as_ribbon",
    } as const;
    for (let index = 0; index < 40; index += 1) {
      const base = createInitialGameState(`PACK-BALANCE-${index}`);
      const shop = {
        ...base,
        runId: `pack-balance-${index}`,
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
      const opened = gameReducer(shop, { type: "BUY_OFFER", offerId: "offer-pack" });
      for (const card of opened.pendingPack?.candidates ?? []) {
        if (card.effectTagId) effectCards += 1;
        else plainCards += 1;
        if (card.effectTagId && redundantEffect[card.kind as keyof typeof redundantEffect] === card.effectTagId) {
          redundantKindEffects += 1;
        }
      }
    }
    expect(plainCards).toBeGreaterThan(0);
    expect(effectCards).toBeGreaterThan(plainCards);
    expect(redundantKindEffects).toBe(0);
  });

  it("opens burn and book packs with their own pick flows", () => {
    const base = { ...createInitialGameState("PACK-CATEGORIES"), runId: "pack-categories", screen: "shop" as const, money: 99 };
    const burnShop = { ...base, shopOffers: [{ offerId: "burn", category: "pack" as const, definitionId: "pack_burn_large", price: 14, sold: false }] };
    const burn = gameReducer(burnShop, { type: "BUY_OFFER", offerId: "burn" });
    expect(burn.pendingPack).toMatchObject({ category: "burn", picksLeft: 4 });
    expect(burn.pendingPack?.candidates).toHaveLength(base.deck.length);
    expect(new Set(burn.pendingPack?.candidates.map((card) => card.instanceId)).size).toBe(base.deck.length);
    const burnTargets = burn.pendingPack!.candidates.slice(0, 4);
    const rejectedPartialBurn = gameReducer(burn, {
      type: "CONFIRM_PACK_SELECTION",
      candidateIds: burnTargets.slice(0, 1).map((card) => card.instanceId),
    });
    expect(rejectedPartialBurn).toBe(burn);
    const afterBurn = gameReducer(burn, {
      type: "CONFIRM_PACK_SELECTION",
      candidateIds: burnTargets.map((card) => card.instanceId),
    });
    expect(burnTargets.every((target) => !afterBurn.deck.some((card) => card.instanceId === target.instanceId))).toBe(true);
    expect(afterBurn.pendingPack).toBeNull();

    const bookShop = { ...base, shopOffers: [{ offerId: "book", category: "pack" as const, definitionId: "pack_book_small", price: 6, sold: false }] };
    const book = gameReducer(bookShop, { type: "BUY_OFFER", offerId: "book" });
    expect(book.pendingPack).toMatchObject({ category: "book", picksLeft: 1, candidates: [] });
    expect(book.pendingPack?.rewardCandidates).toHaveLength(3);
    const reward = book.pendingPack!.rewardCandidates![0];
    const afterBook = gameReducer(book, { type: "CONFIRM_PACK_SELECTION", candidateIds: [reward.candidateId] });
    expect(afterBook.pendingPack).toBeNull();
    expect(Object.values(afterBook.yakuLevels).some((entry) => entry.level > 1)).toBe(true);
  });

  it("guarantees the most-used yaku book in a book pack with the upgraded bookshop contract", () => {
    const base = {
      ...createInitialGameState("BOOKSHOP-GUARANTEE"),
      runId: "bookshop-guarantee",
      screen: "shop" as const,
      money: 99,
      contracts: ["contract_bookshop", "contract_bookshop"],
      stats: {
        ...createInitialGameState("BOOKSHOP-GUARANTEE").stats,
        yakusPlayed: { gabo: 9, ttaeng: 4, kkeut: 2 },
      },
      shopOffers: [{
        offerId: "book-pack",
        category: "pack" as const,
        definitionId: "pack_book_small",
        price: 6,
        sold: false,
      }],
    };

    const opened = gameReducer(base, { type: "BUY_OFFER", offerId: "book-pack" });
    expect(opened.pendingPack?.rewardCandidates).toHaveLength(3);
    expect(opened.pendingPack?.rewardCandidates?.some((candidate) => candidate.definitionId === "b_gabo")).toBe(true);
  });

  it("adds a third book offer for 동네 책방 and finished cards for 명장 조합", () => {
    const bookshop = gameReducer({
      ...createInitialGameState("BOOKSHOP-SHELF"),
      runId: "bookshop-shelf",
      screen: "reward",
      contracts: ["contract_bookshop"],
    }, { type: "CONTINUE_AFTER_REWARD" });
    expect(bookshop.shopOffers.filter((offer) => offer.category === "book")).toHaveLength(3);

    const guildShop = {
      ...createInitialGameState("MASTER-PAINTER-PACK"),
      runId: "master-painter-pack",
      screen: "shop" as const,
      money: 99,
      contracts: ["contract_painter_guild", "contract_painter_guild"],
      shopOffers: [{
        offerId: "guild-pack",
        category: "pack" as const,
        definitionId: "pack_hwatu_large",
        price: 16,
        sold: false,
      }],
    };
    const opened = gameReducer(guildShop, { type: "BUY_OFFER", offerId: "guild-pack" });
    expect(opened.pendingPack?.candidates.some((card) => card.edition || card.seal)).toBe(true);
  });

  it("reorders talismans by dragged destination", () => {
    const state = {
      ...createInitialGameState("TALISMAN-DRAG"),
      talismans: ["t_first_charm", "t_empty_shrine", "t_gambler_gut"].map((definitionId, index) => ({
        instanceId: `owned:${index}`,
        definitionId,
        growth: 0,
      })),
    };
    const moved = gameReducer(state, { type: "MOVE_TALISMAN_TO", instanceId: "owned:2", targetInstanceId: "owned:0" });
    expect(moved.talismans.map((item) => item.instanceId)).toEqual(["owned:2", "owned:0", "owned:1"]);
  });

  it("keeps tutorial month one fixed but uses run entropy when tutorial is skipped", () => {
    const initial = createInitialGameState("SHUFFLE");
    const open = (tutorialMode: boolean, entropy: string) => gameReducer(
      gameReducer(initial, { type: "START_RUN", startDeckId: "deck_standard", tutorialMode, entropy }),
      { type: "START_STAGE" },
    ).hand.map((card) => card.instanceId);
    expect(open(true, "one")).toEqual(open(true, "two"));
    expect(open(false, "one")).not.toEqual(open(false, "two"));
  });

  it("keeps every opening hand in calendar order", () => {
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
    expect(play.hand).toEqual(sortHand(play.hand));
    const tutorial = gameReducer({ ...base, tutorialMode: true }, { type: "START_STAGE" });
    expect(tutorial.hand).toEqual(sortHand(tutorial.hand));
    const february = gameReducer({ ...base, stage: 2 }, { type: "START_STAGE" });
    expect(february.hand).toEqual(sortHand(february.hand));
    expect(sortHand(messy).map((card) => card.kind).slice(0, 2)).toEqual(["bright", "chaff"]);
  });

  it("sorts a saved hand when a run is continued", () => {
    const deck = createStandardHwatuDeck();
    const hand = [deck[35], deck[2], deck[20], deck[8]];
    const saved = {
      ...createInitialGameState("CONTINUE-SORT"),
      runId: "continue-sort",
      screen: "play" as const,
      hand,
    };

    const continued = gameReducer(createInitialGameState(), { type: "CONTINUE_RUN", state: saved });
    expect(continued.hand).toEqual(sortHand(hand));
  });

  it("restores calendar order after refilling a hand", () => {
    const deck = createStandardHwatuDeck();
    const hand = [12, 10, 9, 8, 7, 6, 5, 4].map(
      (month) => deck.find((card) => card.month === month)!,
    );
    const draw = deck.find((card) => card.month === 1)!;
    const discardedCard = hand[0];
    const base = {
      ...createInitialGameState("REFILL-SORT"),
      runId: "refill-sort",
      screen: "play" as const,
      deck,
      hand,
      drawPile: [draw],
      selectedCardIds: [discardedCard.instanceId],
    };

    const refilled = gameReducer(base, { type: "DISCARD_SELECTED" });
    expect(refilled.hand.some((card) => card.instanceId === draw.instanceId)).toBe(true);
    expect(refilled.hand).toEqual(sortHand(refilled.hand));
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
    expect(discarded.hand).toEqual(sortHand(discarded.hand));
    expect(discarded.usedPile.map((card) => card.instanceId)).toEqual([plain.instanceId]);

    // Selecting only the stubborn card spends nothing at all.
    const onlyStubborn = gameReducer(
      { ...base, selectedCardIds: [stubborn.instanceId] },
      { type: "DISCARD_SELECTED" },
    );
    expect(onlyStubborn.discardsRemaining).toBe(base.discardsRemaining);
    expect(onlyStubborn.hand).toHaveLength(2);
  });

  it("restores one discard when a drawn-luck card enters the hand", () => {
    const deck = createStandardHwatuDeck();
    const plain = deck[0];
    const drawnLuck = { ...deck[5], tags: [...deck[5].tags], effectTagId: "drawn_luck" };
    const hand = [plain, ...deck.slice(1, 5)];
    const base = {
      ...createInitialGameState("DRAWN-LUCK"),
      runId: "drawn-luck",
      screen: "play" as const,
      deck: deck.map((card) => card.instanceId === drawnLuck.instanceId ? drawnLuck : card),
      hand,
      drawPile: [drawnLuck, ...deck.slice(6)],
      selectedCardIds: [plain.instanceId],
    };

    const discarded = gameReducer(base, { type: "DISCARD_SELECTED" });
    expect(discarded.hand.some((card) => card.instanceId === drawnLuck.instanceId)).toBe(true);
    expect(discarded.discardsRemaining).toBe(base.discardsRemaining);
    expect(discarded.usedPile.map((card) => card.instanceId)).toEqual([plain.instanceId]);
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
      drawPile: deck.filter((card) => !hand.some((held) => held.instanceId === card.instanceId)).slice(0, 10),
      selectedCardIds: hand.map((card) => card.instanceId),
      yard: { cards: [], sweptCount: 0 },
      targetScore: 1_000_000,
    };

    expect(base.pendingCupCardId).toBeNull();

    const submitted = gameReducer(base, { type: "SUBMIT_HAND" });
    expect(submitted.pendingCupCardId).toBe(cup.instanceId);
    expect(submitted.cupAssignments).toEqual({});
    expect(submitted.screen).toBe("play");
    expect(submitted.hand).toEqual([]);
    expect(submitted.drawPile).toEqual(base.drawPile);

    const filed = gameReducer(submitted, {
      type: "ASSIGN_CUP_ROLE",
      cardId: cup.instanceId,
      role: "double_chaff",
    });
    expect(filed.pendingCupCardId).toBeNull();
    expect(filed.cupAssignments[cup.instanceId]).toBe("double_chaff");
    expect(filed.screen).toBe("play");
    expect(filed.hand).toHaveLength(8);
    expect(filed.drawPile).toHaveLength(2);
    expect(filed.stats.handsPlayed).toBe(1);
    expect(filed.roundSubmissionIndex).toBe(1);

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

  it("waits for the cup role before deciding both animal and double-chaff score boundaries", () => {
    const deck = createStandardHwatuDeck();
    const cup = deck.find((card) => card.tags.includes("cup"));
    const partner = deck.find((card) => card.month === 9 && card.kind === "ribbon");
    if (!cup || !partner) throw new Error("September cup pair missing");

    const scenarios = [
      {
        label: "animal",
        winningRole: "animal" as const,
        priorCards: deck.filter((card) => card.kind === "animal" && !card.tags.includes("cup") && !card.tags.includes("bird")).slice(0, 4),
      },
      {
        label: "double-chaff",
        winningRole: "double_chaff" as const,
        priorCards: deck.filter((card) => card.kind === "chaff" && card.chaffValue === 1).slice(0, 8),
      },
    ];

    for (const scenario of scenarios) {
      expect(scenario.priorCards).toHaveLength(scenario.winningRole === "animal" ? 4 : 8);
      const hand = [cup, partner];
      const base = {
        ...createInitialGameState(`CUP-BOUNDARY-${scenario.label}`),
        runId: `cup-boundary-${scenario.label}`,
        screen: "play" as const,
        deck,
        hand,
        drawPile: [],
        selectedCardIds: hand.map((card) => card.instanceId),
        yard: { cards: [], sweptCount: 0 },
        handsRemaining: 1,
        targetScore: 1_000_000,
        chain: {
          ...createGoChainState(),
          collection: {
            cardIds: scenario.priorCards.map((card) => card.instanceId),
            completedYakuIds: [],
          },
        },
      };

      const pending = gameReducer(base, { type: "SUBMIT_HAND" });
      expect(pending).toMatchObject({
        screen: "play",
        pendingCupCardId: cup.instanceId,
        handsRemaining: 0,
      });
      expect(pending.chain.collectionScore).toBe(base.chain.collectionScore);
      expect(pending.logs.some((entry) => entry.kind === "fail")).toBe(false);

      const animalPreview = gameReducer(pending, {
        type: "ASSIGN_CUP_ROLE",
        cardId: cup.instanceId,
        role: "animal",
      });
      const chaffPreview = gameReducer(pending, {
        type: "ASSIGN_CUP_ROLE",
        cardId: cup.instanceId,
        role: "double_chaff",
      });
      const winningPreview = scenario.winningRole === "animal" ? animalPreview : chaffPreview;
      const losingPreview = scenario.winningRole === "animal" ? chaffPreview : animalPreview;
      expect(winningPreview.chain.collectionScore).toBeGreaterThan(losingPreview.chain.collectionScore);

      const boundary = losingPreview.chain.roundScore + 1;
      const winning = gameReducer({ ...pending, targetScore: boundary }, {
        type: "ASSIGN_CUP_ROLE",
        cardId: cup.instanceId,
        role: scenario.winningRole,
      });
      const losingRole = scenario.winningRole === "animal" ? "double_chaff" as const : "animal" as const;
      const losing = gameReducer({ ...pending, targetScore: boundary }, {
        type: "ASSIGN_CUP_ROLE",
        cardId: cup.instanceId,
        role: losingRole,
      });

      expect(winning.screen).toBe("decision");
      expect(losing.screen).toBe("run_lose");
      expect(winning.chain.roundScore).toBe(
        winning.chain.submissionScore + winning.chain.collectionScore,
      );
      expect(losing.chain.roundScore).toBe(
        losing.chain.submissionScore + losing.chain.collectionScore,
      );
      expect(winning.stats.handsPlayed).toBe(1);
      expect(winning.roundSubmissionIndex).toBe(1);
      expect(winning.usedPile).toHaveLength(hand.length);
      expect(gameReducer(winning, {
        type: "ASSIGN_CUP_ROLE",
        cardId: cup.instanceId,
        role: scenario.winningRole,
      })).toBe(winning);
    }
  });

  it("does not leave a stale cup choice when a glass cup breaks in aftermath", () => {
    const standardDeck = createStandardHwatuDeck();
    const cup = standardDeck.find((card) => card.tags.includes("cup"));
    const partner = standardDeck.find((card) => card.month === 9 && card.kind === "ribbon");
    if (!cup || !partner) throw new Error("September cup pair missing");
    const seed = Array.from({ length: 100 }, (_, index) => `GLASS-CUP-${index}`)
      .find((candidate) => randomAt(`${candidate}:glass`, 0) < 0.25);
    if (!seed) throw new Error("No deterministic glass seed found");
    const glassCup = { ...cup, tags: [...cup.tags], enhancement: "glass" as const };
    const deck = standardDeck.map((card) => card.instanceId === cup.instanceId ? glassCup : card);
    const priorRibbons = deck.filter((card) =>
      card.ribbonGroup === "cheong" && (card.month === 6 || card.month === 10));
    expect(priorRibbons).toHaveLength(2);
    const hand = [glassCup, partner];
    const base = {
      ...createInitialGameState(seed),
      runId: "glass-cup-aftermath",
      screen: "play" as const,
      deck,
      hand,
      drawPile: [],
      selectedCardIds: hand.map((card) => card.instanceId),
      yard: { cards: [], sweptCount: 0 },
      handsRemaining: 2,
      discardsRemaining: 1,
      targetScore: 1_000_000,
      yakuLevels: {
        ...createInitialGameState().yakuLevels,
        cheongdan: { level: 2, mastery: 0 },
      },
      chain: {
        ...createGoChainState(),
        collection: {
          cardIds: priorRibbons.map((card) => card.instanceId),
          completedYakuIds: [],
        },
      },
    };

    const submitted = gameReducer(base, { type: "SUBMIT_HAND" });
    expect(submitted.deck.some((card) => card.instanceId === glassCup.instanceId)).toBe(false);
    expect(submitted.pendingCupCardId).toBeNull();
    expect(submitted.pendingCupExtraDiscardsBefore).toBeNull();
    expect(submitted.screen).toBe("play");
    expect(submitted.handsRemaining).toBe(1);
    expect(submitted.chain.collectionScore).toBeGreaterThan(0);
    expect(submitted.discardsRemaining).toBe(2);
    expect(submitted.stats.handsPlayed).toBe(1);
    expect(submitted.roundSubmissionIndex).toBe(1);
  });

  it("queues multiple surviving cups and resolves the hand only after the final choice", () => {
    const standardDeck = createStandardHwatuDeck();
    const cup = standardDeck.find((card) => card.tags.includes("cup"));
    if (!cup) throw new Error("September cup missing");
    const secondCup = {
      ...cup,
      tags: [...cup.tags],
      instanceId: `${cup.instanceId}:second`,
    };
    const deck = [...standardDeck, secondCup];
    const hand = [cup, secondCup];
    const drawPile = standardDeck.filter((card) => card.instanceId !== cup.instanceId).slice(0, 10);
    const base = {
      ...createInitialGameState("MULTIPLE-CUPS"),
      runId: "multiple-cups",
      screen: "play" as const,
      deck,
      hand,
      drawPile,
      selectedCardIds: hand.map((card) => card.instanceId),
      yard: { cards: [], sweptCount: 0 },
      handsRemaining: 2,
      targetScore: 1_000_000,
    };

    const pendingFirst = gameReducer(base, { type: "SUBMIT_HAND" });
    expect(pendingFirst.pendingCupCardId).toBe(cup.instanceId);
    expect(pendingFirst.drawPile).toEqual(drawPile);

    const pendingSecond = gameReducer(pendingFirst, {
      type: "ASSIGN_CUP_ROLE",
      cardId: cup.instanceId,
      role: "animal",
    });
    expect(pendingSecond.pendingCupCardId).toBe(secondCup.instanceId);
    expect(pendingSecond.cupAssignments).toEqual({ [cup.instanceId]: "animal" });
    expect(pendingSecond.chain.collectionScore).toBe(base.chain.collectionScore);
    expect(pendingSecond.drawPile).toEqual(drawPile);
    expect(pendingSecond.hand).toEqual([]);
    expect(pendingSecond.stats.handsPlayed).toBe(1);
    expect(pendingSecond.roundSubmissionIndex).toBe(1);

    const resolved = gameReducer(pendingSecond, {
      type: "ASSIGN_CUP_ROLE",
      cardId: secondCup.instanceId,
      role: "double_chaff",
    });
    expect(resolved.pendingCupCardId).toBeNull();
    expect(resolved.cupAssignments).toEqual({
      [cup.instanceId]: "animal",
      [secondCup.instanceId]: "double_chaff",
    });
    expect(resolved.screen).toBe("play");
    expect(resolved.hand).toHaveLength(8);
    expect(resolved.drawPile).toHaveLength(2);
    expect(resolved.stats.handsPlayed).toBe(1);
    expect(resolved.roundSubmissionIndex).toBe(1);
    expect(resolved.logs.filter((entry) => entry.title === "술잔 기록")).toHaveLength(2);
  });

  it("grants a newly completed collection perk once, after the cup choice", () => {
    const standardDeck = createStandardHwatuDeck();
    const cup = standardDeck.find((card) => card.tags.includes("cup"));
    const nineRibbon = standardDeck.find((card) => card.month === 9 && card.ribbonGroup === "cheong");
    const oneChaff = standardDeck.find((card) => card.month === 1 && card.kind === "chaff");
    const priorRibbons = standardDeck.filter((card) =>
      card.ribbonGroup === "cheong" && (card.month === 6 || card.month === 10));
    if (!cup || !nineRibbon || !oneChaff || priorRibbons.length !== 2) throw new Error("Cheongdan cup fixture missing");
    const secondCup = { ...cup, tags: [...cup.tags], instanceId: `${cup.instanceId}:perk-second` };
    const deck = [...standardDeck, secondCup];
    // 1월 + 9월 띠가 짓 10을 만들고, 두 술잔은 9땡 끗패가 된다.
    const hand = [cup, secondCup, oneChaff, nineRibbon];
    const base = {
      ...createInitialGameState("CUP-PERK-DEFER"),
      runId: "cup-perk-defer",
      screen: "play" as const,
      deck,
      hand,
      drawPile: [],
      selectedCardIds: hand.map((card) => card.instanceId),
      yard: { cards: [], sweptCount: 0 },
      handsRemaining: 1,
      discardsRemaining: 1,
      targetScore: 1_000_000,
      yakuLevels: {
        ...createInitialGameState().yakuLevels,
        cheongdan: { level: 2, mastery: 0 },
      },
      chain: {
        ...createGoChainState(),
        collection: {
          cardIds: priorRibbons.map((card) => card.instanceId),
          completedYakuIds: [],
        },
      },
    };

    const pending = gameReducer(base, { type: "SUBMIT_HAND" });
    expect(pending.pendingCupCardId).toBe(cup.instanceId);
    expect(pending.pendingCupExtraDiscardsBefore).toBe(0);
    expect(pending.discardsRemaining).toBe(1);

    const pendingSecond = gameReducer(pending, {
      type: "ASSIGN_CUP_ROLE",
      cardId: cup.instanceId,
      role: "animal",
    });
    expect(pendingSecond.pendingCupCardId).toBe(secondCup.instanceId);
    expect(pendingSecond.discardsRemaining).toBe(1);
    expect(pendingSecond.pendingCupExtraDiscardsBefore).toBe(0);

    const filed = gameReducer(pendingSecond, {
      type: "ASSIGN_CUP_ROLE",
      cardId: secondCup.instanceId,
      role: "double_chaff",
    });
    expect(filed.discardsRemaining).toBe(2);
    expect(filed.pendingCupExtraDiscardsBefore).toBeNull();
    expect(filed.stats.handsPlayed).toBe(1);

    const repeated = gameReducer(filed, {
      type: "ASSIGN_CUP_ROLE",
      cardId: secondCup.instanceId,
      role: "animal",
    });
    expect(repeated).toBe(filed);
    expect(repeated.discardsRemaining).toBe(2);
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

  it("treats 광내림 as one exact non-bright target and charges the full 12+6냥", () => {
    const base = createInitialGameState("BRIGHT-DESCENT");
    const targets = base.deck.filter((card) => card.kind !== "bright").slice(0, 2);
    const alreadyBright = base.deck.find((card) => card.kind === "bright");
    if (targets.length < 2 || !alreadyBright) throw new Error("Test deck is missing 광내림 targets");
    const shop = {
      ...base,
      runId: "bright-descent",
      screen: "shop" as const,
      money: 99,
      shopType: "forbidden" as const,
      shopOffers: [{ offerId: "offer-bright", category: "forbidden" as const, definitionId: "f_bright_descent", price: 12, sold: false }],
    };

    const editing = gameReducer(shop, { type: "BUY_OFFER", offerId: "offer-bright" });
    expect(editing.screen).toBe("deck_editor");
    expect(editing.money).toBe(87);

    const withoutTarget = gameReducer(editing, { type: "APPLY_CONSUMABLE" });
    expect(withoutTarget).toEqual(editing);

    const first = gameReducer(editing, { type: "SELECT_CONSUMABLE_TARGET", cardId: targets[0].instanceId });
    const invalid = gameReducer(first, { type: "SELECT_CONSUMABLE_TARGET", cardId: alreadyBright.instanceId });
    expect(invalid.pendingTargetIds).toEqual([targets[0].instanceId]);

    const replaced = gameReducer(invalid, { type: "SELECT_CONSUMABLE_TARGET", cardId: targets[1].instanceId });
    expect(replaced.pendingTargetIds).toEqual([targets[1].instanceId]);
    const applied = gameReducer(replaced, { type: "APPLY_CONSUMABLE" });
    expect(applied.screen).toBe("shop");
    expect(applied.money).toBe(81);
    expect(applied.deck.find((card) => card.instanceId === targets[0].instanceId)?.kind).toBe(targets[0].kind);
    expect(applied.deck.find((card) => card.instanceId === targets[1].instanceId)?.kind).toBe("bright");
    expect(applied.stats.forbiddenCardsUsed).toEqual({ f_bright_descent: 1 });
  });

  it("refuses 광내림 before purchase when the hidden ritual fee is unaffordable", () => {
    const base = createInitialGameState("BRIGHT-COST");
    const shop = {
      ...base,
      runId: "bright-cost",
      screen: "shop" as const,
      money: 17,
      shopType: "forbidden" as const,
      shopOffers: [{ offerId: "offer-bright", category: "forbidden" as const, definitionId: "f_bright_descent", price: 12, sold: false }],
    };

    const rejected = gameReducer(shop, { type: "BUY_OFFER", offerId: "offer-bright" });
    expect(rejected.screen).toBe("shop");
    expect(rejected.money).toBe(17);
    expect(rejected.shopOffers[0].sold).toBe(false);
    expect(rejected.logs.at(-1)).toMatchObject({ title: "대가 부족" });
  });

  it("ignores player targets for 큰 소각 and resolves five random ordinary cards internally", () => {
    const base = createInitialGameState("GREAT-BURN");
    const protectedCard = { ...base.deck[0], enhancement: "inked" as const };
    const shop = {
      ...base,
      runId: "great-burn",
      screen: "shop" as const,
      deck: [protectedCard, ...base.deck.slice(1)],
      money: 99,
      shopType: "forbidden" as const,
      shopOffers: [{ offerId: "offer-burn", category: "forbidden" as const, definitionId: "f_great_burn", price: 8, sold: false }],
    };

    const editing = gameReducer(shop, { type: "BUY_OFFER", offerId: "offer-burn" });
    const clicked = gameReducer(editing, { type: "SELECT_CONSUMABLE_TARGET", cardId: protectedCard.instanceId });
    expect(clicked.pendingTargetIds).toEqual([]);
    const applied = gameReducer(clicked, { type: "APPLY_CONSUMABLE" });
    expect(applied.screen).toBe("shop");
    expect(applied.deck).toHaveLength(shop.deck.length - 5);
    expect(applied.deck.some((card) => card.instanceId === protectedCard.instanceId)).toBe(true);
    expect(applied.money).toBe(109);
  });

  it("targets owned talismans for 전승 instead of silently using the first two", () => {
    const base = createInitialGameState("INHERITANCE");
    const talismans = [
      { instanceId: "owned-a", definitionId: "t_first_charm", growth: 0 },
      { instanceId: "owned-b", definitionId: "t_empty_shrine", growth: 0 },
      { instanceId: "owned-c", definitionId: "t_twelve_moons", growth: 2 },
    ];
    const shop = {
      ...base,
      runId: "inheritance",
      screen: "shop" as const,
      talismans,
      money: 99,
      shopType: "forbidden" as const,
      shopOffers: [{ offerId: "offer-inheritance", category: "forbidden" as const, definitionId: "f_inheritance", price: 14, sold: false }],
    };

    const editing = gameReducer(shop, { type: "BUY_OFFER", offerId: "offer-inheritance" });
    const invalidFirst = gameReducer(editing, { type: "SELECT_CONSUMABLE_TARGET", cardId: "owned-a" });
    expect(invalidFirst.pendingTargetIds).toEqual([]);
    const selected = gameReducer(invalidFirst, { type: "SELECT_CONSUMABLE_TARGET", cardId: "owned-c" });
    expect(selected.pendingTargetIds).toEqual(["owned-c"]);
    const applied = gameReducer(selected, { type: "APPLY_CONSUMABLE" });
    expect(applied.screen).toBe("shop");
    expect(applied.talismans.map((item) => item.definitionId)).toEqual([
      "t_first_charm",
      "t_twelve_moons",
      "t_twelve_moons",
    ]);
    expect(applied.talismans.some((item) => item.instanceId === "owned-b")).toBe(false);
  });

  it("refuses talisman purchases when the effective pouch is full", () => {
    const base = createInitialGameState("FULL-TALISMAN-POUCH");
    const owned = Array.from({ length: 5 }, (_, index) => ({
      instanceId: `owned-${index}`,
      definitionId: "t_first_charm",
      growth: 0,
    }));
    const offer = {
      offerId: "offer-talisman",
      category: "talisman" as const,
      definitionId: "t_empty_shrine",
      price: 7,
      sold: false,
    };
    const fullShop = {
      ...base,
      screen: "shop" as const,
      money: 99,
      talismans: owned,
      shopOffers: [offer],
    };

    const rejected = gameReducer(fullShop, { type: "BUY_OFFER", offerId: offer.offerId });
    expect(rejected).toBe(fullShop);

    const engravedShop = {
      ...fullShop,
      talismans: owned.map((item, index) => index === 0 ? { ...item, edition: "engraved" as const } : item),
    };
    const purchased = gameReducer(engravedShop, { type: "BUY_OFFER", offerId: offer.offerId });
    expect(purchased.talismans).toHaveLength(6);
    expect(purchased.money).toBe(92);
  });

  it("stacks duplicated 화형 문서 and 불사조 triggers by owned instance", () => {
    const deck = createStandardHwatuDeck();
    const januaryChaff = deck.filter((card) => card.month === 1 && card.kind === "chaff");
    if (januaryChaff.length !== 2) throw new Error("January chaff pair missing");
    const cremations = [
      { instanceId: "cremation-a", definitionId: "t_cremation_deed", growth: 0 },
      { instanceId: "cremation-b", definitionId: "t_cremation_deed", growth: 0 },
    ];
    const base = {
      ...createInitialGameState("DOUBLE-RITUAL-TALISMANS"),
      runId: "double-ritual-talismans",
      screen: "play" as const,
      deck,
      hand: januaryChaff,
      drawPile: deck.filter((card) => !januaryChaff.includes(card)),
      selectedCardIds: januaryChaff.map((card) => card.instanceId),
      targetScore: 1_000_000,
      chain: createGoChainState(),
      talismans: cremations,
    };
    const burned = gameReducer(base, { type: "SUBMIT_HAND" });
    expect(burned.deck).toHaveLength(46);
    expect(burned.talismans.map((item) => item.growth)).toEqual([0.08, 0.08]);

    const januaryBright = deck.find((card) => card.month === 1 && card.kind === "bright");
    const januaryRibbon = deck.find((card) => card.month === 1 && card.kind === "ribbon");
    if (!januaryBright || !januaryRibbon) throw new Error("January scoring cards missing");
    const firstHand = [januaryChaff[0], januaryBright];
    const firstBurn = gameReducer({
      ...base,
      hand: firstHand,
      drawPile: deck.filter((card) => !firstHand.includes(card)),
      selectedCardIds: firstHand.map((card) => card.instanceId),
    }, { type: "SUBMIT_HAND" });
    expect(firstBurn.talismans.map((item) => item.growth)).toEqual([0.08, 0]);

    const secondHand = [januaryChaff[1], januaryRibbon];
    const secondBurn = gameReducer({
      ...firstBurn,
      screen: "play" as const,
      hand: secondHand,
      drawPile: firstBurn.deck.filter((card) => !secondHand.includes(card)),
      selectedCardIds: secondHand.map((card) => card.instanceId),
    }, { type: "SUBMIT_HAND" });
    expect(secondBurn.talismans.map((item) => item.growth)).toEqual([0.08, 0.08]);

    const phoenixBase = {
      ...base,
      talismans: [cremations[0],
        { instanceId: "phoenix-a", definitionId: "t_phoenix_seal", growth: 0 },
        { instanceId: "phoenix-b", definitionId: "t_phoenix_seal", growth: 0 }],
    };
    const reborn = gameReducer(phoenixBase, { type: "SUBMIT_HAND" });
    expect(reborn.deck).toHaveLength(51);
    expect(reborn.deck.filter((card) => card.instanceId.startsWith("phoenix:")).length).toBe(4);
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

  it("does not repeat the previous 금단패", () => {
    const previous = FORBIDDEN_CARDS[0].id;
    const reward = {
      ...createInitialGameState("FORBIDDEN-ROTATION"),
      runId: "forbidden-rotation",
      stage: 4,
      screen: "reward" as const,
      lastForbiddenOfferId: previous,
    };
    const shop = gameReducer(reward, { type: "CONTINUE_AFTER_REWARD" });
    const offered = shop.shopOffers.find((offer) => offer.category === "forbidden");

    expect(offered?.definitionId).not.toBe(previous);
    expect(shop.lastForbiddenOfferId).toBe(offered?.definitionId);
  });

  it("awards only 냥 after a clear and never inserts a free card", () => {
    const base = createInitialGameState("MONEY-ONLY-REWARD");
    const beforeIds = base.deck.map((card) => card.instanceId);
    const decision = {
      ...base,
      runId: "money-only-reward",
      screen: "decision" as const,
      targetScore: 100,
      chain: {
        ...createGoChainState(),
        submissionScore: 925,
        roundScore: 925,
      },
    };

    const reward = gameReducer(decision, { type: "STOP_ROUND" });
    expect(reward.screen).toBe("reward");
    expect(reward.money).toBeGreaterThan(decision.money);
    expect(reward.deck.map((card) => card.instanceId)).toEqual(beforeIds);
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

  it("hands out a collection perk only after its book is purchased", () => {
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
      yakuLevels: { ...createInitialGameState("PERK").yakuLevels, hongdan: { level: 2, mastery: 0 } },
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
    expect(byCategory).toEqual({ talisman: 2, book: 2, forbidden: 1, pack: 3 });
    expect(shop.shopOffers.filter((offer) => offer.category === "pack")).toHaveLength(3);
    const contract = gameReducer(shop, { type: "NEXT_STAGE" });
    expect(contract.screen).toBe("contract");
    expect(contract.contractChoices).toHaveLength(2);
    const next = gameReducer(contract, { type: "CHOOSE_CONTRACT", contractId: contract.contractChoices[0] });
    expect(next.screen).toBe("round_intro");
    expect(next.stage).toBe(4);
    expect(next.contracts).toContain(contract.contractChoices[0]);
  });
});
