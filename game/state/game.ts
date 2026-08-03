import {
  ALL_IMMEDIATE_YAKU_DEFINITIONS,
  COLLECTION_YAKU_DEFINITIONS,
} from "../content/yaku";
import { BOSSES, BOSS_BY_ID } from "../content/bosses";
import { getStageDefinition } from "../content/stages";
import { TALISMAN_BY_ID, TALISMANS } from "../content/talismans";
import {
  BOOKS,
  BOOK_BY_ID,
  FORBIDDEN_BY_ID,
  FORBIDDEN_CARDS,
  PAINTER_BY_ID,
  PAINTER_CARDS,
} from "../content/upgrades";
import {
  CONTRACTS,
  PACKS,
  PACK_BY_ID,
} from "../content/meta";
import {
  bossAllowsCardToScore,
  bossAllowsYaku,
  bossVictoryConditionMet,
  getBossDiscardMoneyCost,
  getBossGoFailureScoreFactor,
  getBossKkeutAdjustment,
  getBossSettlementFactor,
} from "../engine/boss";
import {
  applyForbiddenEffect,
  applyPainterEffect,
  applyStartDeck,
} from "../engine/consumables";
import { calculateCollectionBonus } from "../engine/collection-bonus";
import { createStandardHwatuDeck } from "../engine/deck";
import {
  canDeclareBomb,
  canDeclareShake,
  evaluateBakContract,
  getShakeResult,
  resolveYardCapture,
  weatherCardModifier,
} from "../engine/experimental";
import {
  armGo,
  bankChain,
  choosePostHandTransition,
  commitMasteryEvents,
  createGoChainState,
  forceOrAutoSettle,
  resolveGoAttempt,
  stopRound,
  type SettlementResolution,
} from "../engine/go";
import { randomAt, shuffleDeterministic } from "../engine/rng";
import {
  calculateHandScore,
  chooseDefaultCandidate,
  createMasteryEvents,
  evaluateImmediateCandidates,
  type OrderedScoreEffect,
} from "../engine/scoring";
import {
  buildOrderedTalismanScoreEffects,
  calculateTalismanGoFailureAdjustment,
  calculateTalismanRoundRewardAdjustment,
  calculateTalismanRoundRuleModifiers,
} from "../engine/talismans";
import { calculateRoundReward } from "../engine/economy";
import type { CollectionEvaluationInput } from "../engine/yaku";
import type { GameAction } from "./actions";
import type {
  BossDefinition,
  CardInstance,
  GameState,
  ImmediateYakuId,
  ForbiddenDefinition,
  PainterDefinition,
  RoundLogEntry,
  ScoreBreakdown,
  ShopOffer,
  TalismanDefinition,
  YakuCandidate,
  YakuLevelState,
} from "../types";

const DEFAULT_SEED = "FLOWER-2026";
const MAX_SELECTED = 5;

function initialYakuLevels(): Record<string, YakuLevelState> {
  return Object.fromEntries(
    [...ALL_IMMEDIATE_YAKU_DEFINITIONS, ...COLLECTION_YAKU_DEFINITIONS].map((entry) => [
      entry.id,
      { level: 1, mastery: 0 },
    ]),
  );
}

function emptyStats(): GameState["stats"] {
  return {
    handsPlayed: 0,
    discardsUsed: 0,
    goAttempts: 0,
    goSuccesses: 0,
    goFailures: 0,
    highestHand: 0,
    moneyEarned: 0,
    yakusPlayed: {},
  };
}

export function createInitialGameState(seed = DEFAULT_SEED): GameState {
  return {
    version: 1,
    screen: "title",
    seed,
    rngCursor: 0,
    runId: "not-started",
    startDeckId: null,
    stage: 1,
    infiniteLap: 0,
    targetScore: 300,
    bossId: null,
    weatherId: "clear",
    deck: createStandardHwatuDeck(),
    drawPile: [],
    hand: [],
    usedPile: [],
    selectedCardIds: [],
    manualYakuId: null,
    cupRole: "animal",
    handsRemaining: 4,
    discardsRemaining: 4,
    handSize: 8,
    baseHands: 4,
    baseDiscards: 4,
    targetMultiplier: 1,
    roundSettlementBonus: 0,
    failMoneyPenalty: 0,
    roundSubmissionIndex: 0,
    roundTalismanUses: {},
    scoredMonthsThisRound: [],
    chain: createGoChainState(),
    money: 4,
    talismans: [],
    talismanSlots: 5,
    yakuLevels: initialYakuLevels(),
    unlockedSecretYakuIds: [],
    shopOffers: [],
    shopType: null,
    rerollCost: 2,
    pendingConsumableId: null,
    pendingTargetIds: [],
    pendingShopOfferId: null,
    lastConsumableId: null,
    contracts: [],
    contractChoices: [],
    experimentalRules: {
      yardMatching: false,
      bombsAndShake: true,
      bakContracts: true,
      weather: true,
      nagariRetry: true,
    },
    yard: { cards: [], sweptCount: 0, shakeArmed: false },
    nagariUsed: false,
    tutorialBossRetryUsed: false,
    tutorialMode: false,
    calendarStamps: [],
    lastScore: null,
    lastRoundReward: 0,
    returnScreen: null,
    logs: [],
    stats: emptyStats(),
  };
}

function logEntry(
  state: GameState,
  kind: RoundLogEntry["kind"],
  title: string,
  detail: string,
): RoundLogEntry[] {
  const id = `${state.runId}:${state.stage}:${state.rngCursor}:${state.logs.length}`;
  return [{ id, kind, title, detail }, ...state.logs].slice(0, 18);
}

function cardsFromIds(state: GameState, ids: readonly string[]): CardInstance[] {
  const map = new Map(state.deck.map((card) => [card.instanceId, card]));
  return ids.flatMap((id) => {
    const card = map.get(id);
    return card ? [card] : [];
  });
}

function countContract(state: GameState, effectKey: string): number {
  const matchingIds = new Set<string>(
    CONTRACTS.filter((entry) => entry.effectKey === effectKey).map((entry) => entry.id),
  );
  return state.contracts.filter((id) => matchingIds.has(id)).length;
}

function contractDiscount(state: GameState): number {
  const count = countContract(state, "shop_discount");
  return count <= 0 ? 0 : count === 1 ? 0.15 : 0.3;
}

function effectiveHandSize(state: GameState): number {
  return state.handSize + countContract(state, "hand_size");
}

export function getEffectiveTalismanSlots(state: GameState): number {
  return state.talismanSlots + state.talismans.filter((item) => item.edition === "engraved").length;
}

function cloneCard(card: CardInstance): CardInstance {
  return { ...card, tags: [...card.tags] };
}

function faceDownForBoss(cards: CardInstance[], boss: BossDefinition | null): CardInstance[] {
  if (boss?.ruleKey !== "two_face_down") return cards;
  return cards.map((card, index) =>
    index < 2 ? { ...card, tags: [...card.tags, "face_down"] } : card,
  );
}

function refillHand(state: GameState, currentHand: CardInstance[]): GameState {
  const needed = Math.max(0, effectiveHandSize(state) - currentHand.length);
  if (needed === 0) return { ...state, hand: currentHand };

  let pile = state.drawPile;
  let cursor = state.rngCursor;
  let usedPile = state.usedPile;
  if (pile.length < needed && usedPile.length > 0) {
    const shuffled = shuffleDeterministic(usedPile.map(cloneCard), {
      seed: `${state.seed}:recycle:${state.stage}`,
      cursor,
    });
    pile = [...pile, ...shuffled.value];
    cursor = shuffled.state.cursor;
    usedPile = [];
  }
  const drawn = pile.slice(0, needed).map(cloneCard);
  const boss = state.bossId ? BOSS_BY_ID[state.bossId] ?? null : null;
  return {
    ...state,
    rngCursor: cursor,
    hand: [...currentHand, ...faceDownForBoss(drawn, boss)],
    drawPile: pile.slice(drawn.length),
    usedPile,
  };
}

function startRun(state: GameState, startDeckId: string, tutorialMode: boolean): GameState {
  let cursor = 0;
  const runId = `${state.seed}:run:${state.rngCursor}`;
  const random = () => randomAt(`${state.seed}:${runId}`, cursor++);
  const makeId = (prefix: string) => `${prefix}:${runId}:${cursor++}`;
  const result = applyStartDeck(createStandardHwatuDeck(), startDeckId, random, makeId);
  const stage = getStageDefinition(1);
  return {
    ...createInitialGameState(state.seed),
    experimentalRules: { ...state.experimentalRules, yardMatching: false },
    screen: "round_intro",
    rngCursor: cursor,
    runId,
    startDeckId,
    tutorialMode,
    stage: 1,
    targetScore: Math.ceil(stage.target * result.targetMultiplier),
    bossId: stage.bossId,
    weatherId: stage.weatherId,
    deck: result.deck,
    baseHands: result.hands,
    baseDiscards: result.discards,
    handSize: result.handSize,
    talismanSlots: result.talismanSlots,
    money: result.money,
    targetMultiplier: result.targetMultiplier,
    roundSettlementBonus: result.settlementBonus,
    failMoneyPenalty: result.failMoneyPenalty,
    logs: [
      {
        id: `${runId}:start`,
        kind: "system",
        title: "새 달력 펼침",
        detail: `${startDeckId} · 시드 ${state.seed}`,
      },
    ],
  };
}

function startStage(state: GameState): GameState {
  const stage = getStageDefinition(state.stage, state.infiniteLap);
  const stageBossId = state.stage > 12
    ? BOSSES[(state.stage - 13) % BOSSES.length].id
    : stage.bossId;
  const shuffled = shuffleDeterministic(state.deck.map(cloneCard), {
    seed: `${state.seed}:${state.runId}:stage:${state.stage}`,
    cursor: state.rngCursor,
  });
  const yardCards: CardInstance[] = [];
  const pileAfterYard = shuffled.value;
  const hands = state.baseHands + countContract(state, "hands_per_round");
  const discards = state.baseDiscards + countContract(state, "discards_per_round");
  const boss = stageBossId ? BOSS_BY_ID[stageBossId] ?? null : null;
  const handSize = effectiveHandSize(state);
  const hand = faceDownForBoss(pileAfterYard.slice(0, handSize).map(cloneCard), boss);
  const next: GameState = {
    ...state,
    screen: "play",
    rngCursor: shuffled.state.cursor,
    targetScore: Math.ceil(stage.target * state.targetMultiplier),
    bossId: stageBossId,
    weatherId: state.experimentalRules.weather ? stage.weatherId : "clear",
    drawPile: pileAfterYard.slice(hand.length),
    hand,
    usedPile: [],
    selectedCardIds: [],
    manualYakuId: null,
    handsRemaining: hands,
    discardsRemaining: discards,
    chain: createGoChainState(),
    yard: { cards: yardCards, sweptCount: 0, shakeArmed: false },
    roundSubmissionIndex: 0,
    roundTalismanUses: {},
    scoredMonthsThisRound: [],
    lastScore: null,
    lastRoundReward: 0,
    returnScreen: null,
  };
  return {
    ...next,
    logs: logEntry(
      next,
      "system",
      stage.name,
      `${stage.subtitle} · 목표 ${next.targetScore.toLocaleString("ko-KR")}점`,
    ),
  };
}

function selectionInOrder(state: GameState): CardInstance[] {
  const map = new Map(state.hand.map((card) => [card.instanceId, card]));
  return state.selectedCardIds.flatMap((id) => {
    const card = map.get(id);
    return card ? [card] : [];
  });
}

function scoreEffectsForState(
  state: GameState,
  submitted: readonly CardInstance[],
  base: ScoreBreakdown,
  yardBonusKkeut: number,
  yardBonusHeung: number,
  shakeBonusKkeut: number,
): OrderedScoreEffect[] {
  const boss = state.bossId ? BOSS_BY_ID[state.bossId] ?? null : null;
  const scoring = new Set(base.scoringCardIds);
  const scoringCards = submitted.filter((card) => scoring.has(card.instanceId));
  const effects: OrderedScoreEffect[] = [];

  scoringCards.forEach((card, scoringIndex) => {
    const weather = weatherCardModifier(card, state.weatherId);
    if (weather !== 0) {
      effects.push({
        sourceId: `weather:${state.weatherId}:${card.instanceId}`,
        label: `날씨 · ${state.weatherId}`,
        operation: "add_kkeut",
        value: weather,
      });
    }
    const bossAdjustment = getBossKkeutAdjustment(boss, card, {
      submissionIndex: state.roundSubmissionIndex,
      scoringIndex,
    });
    if (bossAdjustment !== 0) {
      effects.push({
        sourceId: `boss:${boss?.id}:${card.instanceId}`,
        label: `두목 · ${boss?.name}`,
        operation: "add_kkeut",
        value: bossAdjustment,
      });
    }
  });
  if (yardBonusKkeut) effects.push({ sourceId: "yard", label: "마당 매칭", operation: "add_kkeut", value: yardBonusKkeut });
  if (yardBonusHeung) effects.push({ sourceId: "yard:sweep", label: "싹쓸이", operation: "add_heung", value: yardBonusHeung });
  if (shakeBonusKkeut) effects.push({ sourceId: "bomb", label: "폭탄", operation: "add_kkeut", value: shakeBonusKkeut });
  return effects;
}

interface ScoredSelection {
  breakdown: ScoreBreakdown;
  submitted: CardInstance[];
  captured: CardInstance[];
  remainingYard: CardInstance[];
  swept: boolean;
  settlementBonus: number;
  captureLabel: string;
  usedUnifyMonth: number | null;
}

export function evaluateSelectedHand(state: GameState): ScoredSelection | null {
  const submitted = selectionInOrder(state);
  if (!state.manualYakuId || submitted.length === 0 || submitted.length > MAX_SELECTED) return null;
  const boss = state.bossId ? BOSS_BY_ID[state.bossId] ?? null : null;
  const rules = calculateTalismanRoundRuleModifiers(state.talismans);
  const capture = resolveYardCapture(submitted, state.yard, state.experimentalRules.yardMatching);
  const shake = state.yard.shakeArmed
    ? getShakeResult(canDeclareBomb(submitted, state.yard, state.experimentalRules))
    : { settlementBonus: 0, bonusKkeut: 0, label: "" };
  const confirmedCards = cardsFromIds(state, state.chain.confirmedCollection.cardIds);
  const pendingCards = cardsFromIds(state, state.chain.pendingCollection.cardIds);
  const heldCards = state.hand.filter((card) => !state.selectedCardIds.includes(card.instanceId));
  const canUnify = rules.unifyMonthUses > (state.roundTalismanUses.t_twelve_month_painter ?? 0);
  const unifyVariants: Array<number | null> = [null];
  if (canUnify) {
    for (let month = 1; month <= 12; month += 1) unifyVariants.push(month);
  }
  const highestYakuLevel = Math.max(1, ...Object.values(state.yakuLevels).map((entry) => entry.level));
  const evaluatedVariants: Array<{ breakdown: ScoreBreakdown; unifyMonth: number | null }> = [];

  const decorateCard = (card: CardInstance, index: number, unifyMonth: number | null): CardInstance => ({
    ...card,
    month: (unifyMonth ?? card.month) as CardInstance["month"],
    tags: [
      ...card.tags.filter((tag) => tag !== "face_down"),
      ...(rules.allKindsWild ? ["all_kind_wild"] : []),
      ...(rules.monthsCountingAsBright.includes(card.month) ? ["counts_as_bright"] : []),
    ],
    disabledForRound: !bossAllowsCardToScore(boss, card, {
      submissionIndex: state.roundSubmissionIndex,
      scoringIndex: index,
    }),
  });

  for (const unifyMonth of unifyVariants) {
    const evaluatedSubmission = submitted.map((card, index) => decorateCard(card, index, unifyMonth));
    const evaluatedCaptured = capture.captured.map((card, index) => decorateCard(card, index, null));
    const collection: CollectionEvaluationInput = {
      confirmedCards,
      pendingCards,
      submittedCards: [...evaluatedSubmission, ...evaluatedCaptured],
      confirmedCompletedYakuIds: state.chain.confirmedCollection.completedYakuIds,
      pendingCompletedYakuIds: state.chain.pendingCollection.completedYakuIds,
      cupRole: state.cupRole,
    };
    const baseInput = {
      submittedCards: evaluatedSubmission,
      heldCards,
      collection,
      yakuLevels: state.yakuLevels,
      cupRole: state.cupRole,
      connectYear: rules.connectsDecemberToJanuary,
      includeSecretYaku: true,
    } as const;
    const bases = evaluateImmediateCandidates(baseInput).filter((entry) =>
      bossAllowsYaku(boss, entry.yakuId, evaluatedSubmission),
    );
    for (const base of bases) {
      const candidate: YakuCandidate = {
        yakuId: base.yakuId,
        scoringCardIds: base.scoringCardIds,
        label: base.yakuName,
      };
      const scoringIds = new Set(base.scoringCardIds);
      const scoringCards = evaluatedSubmission.filter((card) => scoringIds.has(card.instanceId));
      let yakuLevels = state.yakuLevels;
      if (rules.borrowedYakuLevelOffset !== null) {
        const borrowed = Math.max(1, highestYakuLevel - rules.borrowedYakuLevelOffset);
        const current = state.yakuLevels[candidate.yakuId] ?? { level: 1, mastery: 0 };
        if (borrowed > current.level) {
          yakuLevels = { ...state.yakuLevels, [candidate.yakuId]: { ...current, level: borrowed } };
        }
      }
      const talismanEffects = buildOrderedTalismanScoreEffects({
        talismans: state.talismans,
        candidate,
        submittedCards: evaluatedSubmission,
        scoringCards,
        heldCards,
        newCollectionYakuIds: base.newCollectionYakuIds,
        cupRole: state.cupRole,
        money: state.money,
        emptyTalismanSlots: Math.max(0, getEffectiveTalismanSlots(state) - state.talismans.length),
        successfulGoCount: state.chain.successfulGoCount,
        scoredMonthsThisRound: state.scoredMonthsThisRound,
      });
      const stateEffects = scoreEffectsForState(
        state,
        evaluatedSubmission,
        base,
        capture.bonusKkeut,
        capture.bonusHeung,
        shake.bonusKkeut,
      );
      const collectionEffects = calculateCollectionBonus(
        [...confirmedCards, ...pendingCards, ...evaluatedSubmission, ...evaluatedCaptured],
        state.cupRole,
      ).effects;
      const fortuneEffects: OrderedScoreEffect[] = scoringCards
        .filter((card) => card.enhancement === "fortune" && randomAt(`${state.seed}:fortune-heung:${state.stage}:${state.roundSubmissionIndex}:${card.instanceId}`, 0) < 0.2)
        .map((card) => ({ sourceId: card.instanceId, label: "복패 대박", operation: "add_heung", value: 12 }));
      const breakdown = calculateHandScore({
        ...baseInput,
        yakuLevels,
        candidate,
        newCollectionYakuIds: base.newCollectionYakuIds,
        applyCollectionCompletionBonus: false,
        orderedTalismanEffects: [
          ...stateEffects,
          ...collectionEffects,
          ...fortuneEffects,
          ...talismanEffects,
        ],
      });
      evaluatedVariants.push({ breakdown, unifyMonth });
    }
  }
  if (evaluatedVariants.length === 0) return null;
  const eligible = evaluatedVariants.filter(
    (entry) => entry.breakdown.yakuId === state.manualYakuId,
  );
  if (eligible.length === 0) return null;
  const breakdown = chooseDefaultCandidate(eligible.map((entry) => entry.breakdown));
  const chosen = eligible.find((entry) => entry.breakdown === breakdown) ?? eligible[0];
  return {
    breakdown,
    submitted,
    captured: capture.captured,
    remainingYard: capture.remainingYard,
    swept: capture.swept,
    settlementBonus: shake.settlementBonus,
    captureLabel: [capture.label, shake.label].filter(Boolean).join(" · "),
    usedUnifyMonth: chosen.unifyMonth,
  };
}

function unlockSecret(state: GameState, yakuId: ImmediateYakuId): ImmediateYakuId[] {
  const definition = ALL_IMMEDIATE_YAKU_DEFINITIONS.find((entry) => entry.id === yakuId);
  if (!definition?.secret || state.unlockedSecretYakuIds.includes(yakuId)) {
    return state.unlockedSecretYakuIds;
  }
  return [...state.unlockedSecretYakuIds, yakuId];
}

function applyCardAftermath(state: GameState, scored: ScoredSelection): GameState {
  const scoringIds = new Set(scored.breakdown.scoringCardIds);
  let cursor = state.rngCursor;
  let money = state.money;
  let deck = state.deck;
  let talismans = state.talismans;
  const roundTalismanUses = { ...state.roundTalismanUses };
  const burned = new Set<string>();
  const scoringCards = scored.submitted.filter((item) => scoringIds.has(item.instanceId));
  for (const card of scoringCards) {
    if (card.seal === "yellow") money += 2;
    if (card.enhancement === "fortune") {
      if (randomAt(`${state.seed}:fortune-money`, cursor++) < 0.08) money += 12;
    }
    if (card.enhancement === "glass" && randomAt(`${state.seed}:glass`, cursor++) < 0.25) {
      burned.add(card.instanceId);
    }
  }
  const cremation = talismans.find((item) => item.definitionId === "t_cremation_deed");
  if (cremation && !roundTalismanUses.t_cremation_deed) {
    const firstChaff = scoringCards.find((card) => card.kind === "chaff");
    if (firstChaff) {
      burned.add(firstChaff.instanceId);
      talismans = talismans.map((item) => item.instanceId === cremation.instanceId
        ? { ...item, growth: item.growth + 0.08 }
        : item);
      roundTalismanUses.t_cremation_deed = 1;
    }
  }
  if (scored.usedUnifyMonth !== null) roundTalismanUses.t_twelve_month_painter = 1;
  const burnedCards = deck.filter((card) => burned.has(card.instanceId));
  if (burned.size) deck = deck.filter((card) => !burned.has(card.instanceId));

  const phoenix = talismans.find((item) => item.definitionId === "t_phoenix_seal");
  if (phoenix && burnedCards.length && !roundTalismanUses.t_phoenix_seal) {
    const source = burnedCards[0];
    const editions = ["gold_leaf", "mother_of_pearl", "five_color"] as const;
    const copies = Array.from({ length: 2 }, (_, index): CardInstance => ({
      ...source,
      tags: [...source.tags],
      instanceId: `phoenix:${state.runId}:${state.stage}:${cursor++}:${index}`,
      edition: editions[Math.floor(randomAt(`${state.seed}:phoenix-edition`, cursor++) * editions.length)],
    }));
    deck = [...deck, ...copies];
    roundTalismanUses.t_phoenix_seal = 1;
  }
  const gainedMoney = money - state.money;
  return {
    ...state,
    rngCursor: cursor,
    money,
    deck,
    drawPile: state.drawPile.filter((card) => !burned.has(card.instanceId)),
    usedPile: state.usedPile.filter((card) => !burned.has(card.instanceId)),
    hand: state.hand.filter((card) => !burned.has(card.instanceId)),
    talismans,
    roundTalismanUses,
    stats: { ...state.stats, moneyEarned: state.stats.moneyEarned + Math.max(0, gainedMoney) },
  };
}

function settle(
  state: GameState,
  resolution: SettlementResolution,
): GameState {
  const boss = state.bossId ? BOSS_BY_ID[state.bossId] ?? null : null;
  const talismanRules = calculateTalismanRoundRuleModifiers(state.talismans);
  const factor = getBossSettlementFactor(boss, state.chain.successfulGoCount)
    * (1 + state.roundSettlementBonus)
    * talismanRules.settlementFactor;
  const adjustedValue = Math.floor(resolution.settlementValue * factor);
  const scoreDelta = adjustedValue - resolution.settlementValue;
  const chain = {
    ...resolution.state,
    confirmedScore: Math.max(0, resolution.state.confirmedScore + scoreDelta),
  };
  const levels = commitMasteryEvents(state.yakuLevels, resolution.committedMasteryEvents);
  const money = state.money + resolution.moneyBonus;
  const next = {
    ...state,
    chain,
    yakuLevels: levels,
    money,
    selectedCardIds: [],
    roundSettlementBonus: state.startDeckId === "deck_master" ? 0.1 : 0,
    logs: logEntry(
      state,
      "bank",
      `${resolution.reason === "stop" ? "스톱" : "정산"} ${adjustedValue.toLocaleString("ko-KR")}점`,
      `확정 ${chain.confirmedScore.toLocaleString("ko-KR")} / 목표 ${state.targetScore.toLocaleString("ko-KR")}`,
    ),
  };
  const won = chain.confirmedScore >= state.targetScore
    && bossVictoryConditionMet(boss, chain.confirmedGoCount);
  if (won) return finishRound(next);
  if (state.handsRemaining <= 0) return loseRound(next);
  return refillHand({ ...next, screen: "play" }, next.hand);
}

function finishRound(state: GameState): GameState {
  const talismanReward = calculateTalismanRoundRewardAdjustment({
    talismans: state.talismans,
    won: true,
    remainingHands: state.handsRemaining,
  });
  const scoringKinds = state.lastScore
    ? cardsFromIds(state, state.lastScore.scoringCardIds).map((card) => card.kind)
    : [];
  const bak = evaluateBakContract(
    scoringKinds,
    state.chain.confirmedCollection.completedYakuIds,
    state.experimentalRules.bakContracts,
  );
  const rewardBreakdown = calculateRoundReward({
    won: true,
    baseWinReward: 3 + Math.ceil(state.stage / 2),
    remainingHands: state.handsRemaining,
    successfulGoCount: state.chain.confirmedGoCount,
    confirmedScore: state.chain.confirmedScore,
    targetScore: state.targetScore,
    adjustment: talismanReward.moneyDelta + bak.bonusMoney,
  });
  const heldCoinMoney = state.hand.filter((card) => card.enhancement === "coin").length * 2;
  const blueSeals = state.hand.filter((card) => card.seal === "blue").length;
  const reward = rewardBreakdown.total + heldCoinMoney;
  let yakuLevels = state.yakuLevels;
  if (state.lastScore && blueSeals > 0) {
    const current = yakuLevels[state.lastScore.yakuId] ?? { level: 1, mastery: 0 };
    yakuLevels = {
      ...yakuLevels,
      [state.lastScore.yakuId]: { ...current, level: current.level + blueSeals },
    };
  }
  const stamp = state.lastScore
    ? {
        month: getStageDefinition(state.stage, state.infiniteLap).month,
        yakuId: state.lastScore.yakuId,
        stage: state.stage,
        assetTag: `stamp:stage-${state.stage}:${state.lastScore.yakuId}`,
      }
    : null;
  const next: GameState = {
    ...state,
    screen: "reward",
    money: state.money + reward,
    yakuLevels,
    lastRoundReward: reward,
    calendarStamps: stamp ? [...state.calendarStamps, stamp] : state.calendarStamps,
    stats: {
      ...state.stats,
      moneyEarned: state.stats.moneyEarned + reward,
    },
  };
  return {
    ...next,
    logs: logEntry(next, "reward", `판돈 ${reward}냥`, `${bak.name} · ${bak.description}`),
  };
}

function loseRound(state: GameState): GameState {
  return {
    ...state,
    screen: "run_lose",
    selectedCardIds: [],
    logs: logEntry(state, "fail", "판 패배", "확정 점수가 목표에 닿지 못했습니다."),
  };
}

function submitHand(state: GameState): GameState {
  if (state.screen !== "play" || state.handsRemaining <= 0 || !state.manualYakuId) return state;
  const scored = evaluateSelectedHand(state);
  if (!scored) {
    return { ...state, logs: logEntry(state, "system", "제출 불가", "1~5장의 카드를 골라 주세요.") };
  }
  const submittedIds = new Set(scored.submitted.map((card) => card.instanceId));
  const remainingHand = state.hand.filter((card) => !submittedIds.has(card.instanceId));
  const handsRemaining = state.handsRemaining - 1;
  const mastery = createMasteryEvents(scored.breakdown);
  const go = resolveGoAttempt(state.chain, scored.breakdown.score, {
    submittedCardIds: [...scored.submitted, ...scored.captured].map((card) => card.instanceId),
    completedCollectionYakuIds: scored.breakdown.newCollectionYakuIds,
    masteryEvents: mastery,
  });
  let next: GameState = {
    ...state,
    hand: remainingHand,
    usedPile: [...state.usedPile, ...scored.submitted],
    handsRemaining,
    selectedCardIds: [],
    manualYakuId: null,
    chain: go.state,
    lastScore: scored.breakdown,
    unlockedSecretYakuIds: unlockSecret(state, scored.breakdown.yakuId),
    yard: {
      cards: scored.remainingYard,
      sweptCount: state.yard.sweptCount + Number(scored.swept),
      shakeArmed: false,
    },
    roundSettlementBonus: state.roundSettlementBonus + scored.settlementBonus,
    roundSubmissionIndex: state.roundSubmissionIndex + 1,
    scoredMonthsThisRound: [...new Set([
      ...state.scoredMonthsThisRound,
      ...scored.submitted
        .filter((card) => scored.breakdown.scoringCardIds.includes(card.instanceId))
        .map((card) => card.month),
    ])],
    stats: {
      ...state.stats,
      handsPlayed: state.stats.handsPlayed + 1,
      goSuccesses: state.stats.goSuccesses + Number(go.outcome === "success"),
      highestHand: Math.max(state.stats.highestHand, scored.breakdown.score),
      yakusPlayed: {
        ...state.stats.yakusPlayed,
        [scored.breakdown.yakuId]: (state.stats.yakusPlayed[scored.breakdown.yakuId] ?? 0) + 1,
      },
    },
    logs: logEntry(
      state,
      "score",
      `${scored.breakdown.yakuName} ${scored.breakdown.score.toLocaleString("ko-KR")}점`,
      scored.captureLabel || `월 합 ${scored.breakdown.finalKkeut} × 배수 ${scored.breakdown.finalHeung}`,
    ),
  };
  next = applyCardAftermath(next, scored);

  if (go.outcome === "failure") {
    const boss = state.bossId ? BOSS_BY_ID[state.bossId] ?? null : null;
    const confirmedScore = Math.floor(go.state.confirmedScore * getBossGoFailureScoreFactor(boss));
    const talismanFailure = calculateTalismanGoFailureAdjustment({
      talismans: next.talismans,
      failed: true,
      rescueRoll: randomAt(`${state.seed}:go-rescue:${state.stage}`, next.rngCursor),
    });
    next = {
      ...next,
      rngCursor: next.rngCursor + 1,
      money: Math.max(0, next.money - next.failMoneyPenalty + talismanFailure.moneyDelta),
      chain: { ...go.state, confirmedScore },
      stats: {
        ...next.stats,
        goFailures: next.stats.goFailures + 1,
      },
      logs: logEntry(next, "fail", "고 실패", `${go.combinedScore.toLocaleString("ko-KR")} < ${go.threshold?.toLocaleString("ko-KR")}`),
    };
    if (handsRemaining <= 0) {
      const won = confirmedScore >= state.targetScore && bossVictoryConditionMet(boss, go.state.confirmedGoCount);
      return won ? finishRound(next) : loseRound(next);
    }
    return refillHand({ ...next, screen: "play" }, remainingHand);
  }

  const transition = choosePostHandTransition(go, handsRemaining);
  if (transition === "auto_settle" || transition === "force_settle") {
    const resolution = forceOrAutoSettle(go.state, transition === "force_settle" ? "force" : "auto", {
      target: state.targetScore,
      handsRemaining,
      requiresSettledGo: state.bossId === "boss_stubborn",
    });
    return settle(next, resolution);
  }
  return { ...next, screen: "decision" };
}

function discardSelected(state: GameState): GameState {
  if (state.screen !== "play" || state.discardsRemaining <= 0 || state.selectedCardIds.length === 0) return state;
  const cost = getBossDiscardMoneyCost(state.bossId ? BOSS_BY_ID[state.bossId] ?? null : null);
  if (state.money < cost) {
    return { ...state, logs: logEntry(state, "system", "버리기 불가", "세금쟁이에게 낼 냥이 없습니다.") };
  }
  const ids = new Set(state.selectedCardIds);
  const discarded = state.hand.filter((card) => ids.has(card.instanceId));
  const kept = state.hand.filter((card) => !ids.has(card.instanceId));
  let deck = state.deck;
  let cursor = state.rngCursor;
  const purpleResults: string[] = [];
  const generatedPainters = PAINTER_CARDS.filter((entry) => entry.minTargets <= 1 && entry.maxTargets >= 1 && entry.effectKey !== "repeat_last_consumable");
  for (const purple of discarded.filter((card) => card.seal === "purple")) {
    const painter = generatedPainters[Math.floor(randomAt(`${state.seed}:purple:${purple.instanceId}`, cursor++) * generatedPainters.length)];
    const target = deck[Math.floor(randomAt(`${state.seed}:purple-target:${purple.instanceId}`, cursor++) * deck.length)];
    if (painter && target) {
      const result = applyPainterEffect(
        deck,
        painter,
        [target.instanceId],
        undefined,
        (prefix) => `${prefix}:${state.runId}:${cursor++}`,
      );
      deck = result.deck;
      purpleResults.push(`자인 → ${painter.name} 자동 적용`);
    }
  }
  const next: GameState = {
    ...state,
    deck,
    rngCursor: cursor,
    hand: kept,
    usedPile: [...state.usedPile, ...discarded],
    selectedCardIds: [],
    discardsRemaining: state.discardsRemaining - 1,
    money: state.money - cost,
    stats: { ...state.stats, discardsUsed: state.stats.discardsUsed + 1 },
    logs: logEntry(state, "system", `${discarded.length}장 버림`, [cost ? "세금 1냥 지불" : "손패를 보충합니다.", ...purpleResults].join(" · ")),
  };
  return refillHand(next, kept);
}

function offerPrice(state: GameState, price: number): number {
  return Math.max(0, Math.ceil(price * (1 - contractDiscount(state))));
}

type ShopCategory = NonNullable<GameState["shopType"]>;

function generateOffers(state: GameState, shopType: ShopCategory, free = false): { offers: ShopOffer[]; cursor: number } {
  let cursor = state.rngCursor;
  const source = shopType === "talisman"
    ? TALISMANS
    : shopType === "painter"
      ? PAINTER_CARDS
      : shopType === "book"
        ? BOOKS
        : FORBIDDEN_CARDS;
  const pool = [...source];
  const offers: ShopOffer[] = [];
  for (let index = 0; index < Math.min(3, pool.length); index += 1) {
    const pick = Math.floor(randomAt(`${state.seed}:shop:${state.stage}:${shopType}`, cursor++) * pool.length);
    const [definition] = pool.splice(pick, 1);
    offers.push({
      offerId: `${state.runId}:offer:${state.stage}:${cursor}`,
      category: shopType,
      definitionId: definition.id,
      price: free ? 0 : offerPrice(state, definition.price),
      sold: false,
    });
  }
  if (!free) {
    const packPool = PACKS.filter((entry) => entry.category === shopType || entry.category === "card");
    const pack = packPool[Math.floor(randomAt(`${state.seed}:pack:${state.stage}:${shopType}`, cursor++) * packPool.length)]
      ?? PACKS[0];
    offers.push({
      offerId: `${state.runId}:pack:${state.stage}:${cursor}`,
      category: "pack",
      definitionId: pack.id,
      price: offerPrice(state, pack.price),
      sold: false,
    });
  }
  return { offers, cursor };
}

function buyOffer(state: GameState, offerId: string): GameState {
  const offer = state.shopOffers.find((entry) => entry.offerId === offerId);
  if (!offer || offer.sold || state.money < offer.price) return state;
  if (offer.category === "pack") {
    const pack = PACK_BY_ID[offer.definitionId];
    if (!pack) return state;
    if (pack.category === "card") {
      const templates = createStandardHwatuDeck();
      const pickIndex = Math.floor(randomAt(`${state.seed}:hwatu-pack:${state.stage}`, state.rngCursor) * templates.length);
      const picked = templates[pickIndex];
      if (!picked) return state;
      const added: CardInstance = {
        ...picked,
        tags: [...picked.tags],
        instanceId: `pack-card:${state.runId}:${state.stage}:${state.rngCursor}`,
      };
      return {
        ...state,
        rngCursor: state.rngCursor + 1,
        money: state.money - offer.price,
        deck: [...state.deck, added],
        shopOffers: state.shopOffers.map((entry) => ({ ...entry, sold: entry.offerId === offer.offerId })),
        logs: logEntry(state, "reward", `${pack.name} 개봉`, `${added.name}을 덱에 추가했습니다.`),
      };
    }
    const category: ShopCategory = pack.category;
    const generated = generateOffers({ ...state, money: state.money - offer.price }, category, true);
    return {
      ...state,
      money: state.money - offer.price,
      rngCursor: generated.cursor,
      shopOffers: generated.offers,
      shopType: category,
      logs: logEntry(state, "reward", `${pack.name} 개봉`, "무료 후보 3개 중 하나를 고르세요."),
    };
  }
  if (offer.category === "talisman") {
    if (state.talismans.length >= getEffectiveTalismanSlots(state)) return state;
    const definition = TALISMAN_BY_ID[offer.definitionId] as TalismanDefinition | undefined;
    if (!definition) return state;
    return {
      ...state,
      money: state.money - offer.price,
      talismans: [...state.talismans, { instanceId: `${offer.offerId}:owned`, definitionId: definition.id, growth: 0 }],
      shopOffers: state.shopOffers.map((entry) => ({ ...entry, sold: entry.offerId === offerId || (offer.price === 0 && entry.price === 0) })),
      logs: logEntry(state, "reward", `${definition.name} 획득`, definition.description),
    };
  }
  if (offer.category === "book") {
    const book = BOOK_BY_ID[offer.definitionId];
    if (!book) return state;
    const current = state.yakuLevels[book.yakuId] ?? { level: 1, mastery: 0 };
    return {
      ...state,
      money: state.money - offer.price,
      yakuLevels: { ...state.yakuLevels, [book.yakuId]: { ...current, level: current.level + 1 } },
      shopOffers: state.shopOffers.map((entry) => ({ ...entry, sold: entry.offerId === offerId || (offer.price === 0 && entry.price === 0) })),
      lastConsumableId: book.id,
      logs: logEntry(state, "reward", `${book.name} 독파`, `${book.yakuId} 레벨 ${current.level + 1}`),
    };
  }
  const definition = offer.category === "painter"
    ? PAINTER_BY_ID[offer.definitionId]
    : FORBIDDEN_BY_ID[offer.definitionId];
  if (!definition) return state;
  if (offer.category === "forbidden" && definition.effectKey === "make_bright_pay" && state.money < offer.price + 6) {
    return { ...state, logs: logEntry(state, "system", "대가 부족", "가격 외에 6냥이 더 필요합니다.") };
  }
  return {
    ...state,
    money: state.money - offer.price,
    screen: "deck_editor",
    returnScreen: "shop",
    pendingConsumableId: definition.id,
    pendingTargetIds: [],
    pendingShopOfferId: offerId,
    shopOffers: state.shopOffers.map((entry) => ({ ...entry, sold: entry.offerId === offerId || (offer.price === 0 && entry.price === 0) })),
  };
}

function applyConsumable(state: GameState, option?: string): GameState {
  const id = state.pendingConsumableId;
  if (!id) return state;
  let cursor = state.rngCursor;
  const makeId = (prefix: string) => `${prefix}:${state.runId}:${cursor++}`;
  const painter = PAINTER_BY_ID[id];
  if (painter) {
    if (state.pendingTargetIds.length < painter.minTargets) return state;
    const previous = state.lastConsumableId ? PAINTER_BY_ID[state.lastConsumableId] : undefined;
    let resolvedOption = option;
    if (painter.effectKey === "apply_enhancement") {
      const options = ["inked", "scarlet", "wild", "glass", "steel", "stone", "coin", "fortune"];
      resolvedOption = options[Math.floor(randomAt(`${state.seed}:painter-enhancement`, cursor++) * options.length)];
    } else if (painter.effectKey === "apply_edition") {
      const options = ["gold_leaf", "mother_of_pearl", "five_color"];
      resolvedOption = options[Math.floor(randomAt(`${state.seed}:painter-edition`, cursor++) * options.length)];
    }
    const result = applyPainterEffect(state.deck, painter, state.pendingTargetIds, resolvedOption, makeId, previous);
    return {
      ...state,
      rngCursor: cursor,
      deck: result.deck,
      screen: state.returnScreen ?? "shop",
      returnScreen: null,
      pendingConsumableId: null,
      pendingTargetIds: [],
      pendingShopOfferId: null,
      lastConsumableId: id,
      logs: logEntry(state, "reward", painter.name, result.message),
    };
  }
  const forbidden = FORBIDDEN_BY_ID[id];
  if (!forbidden) return state;
  let targets = state.pendingTargetIds;
  if (forbidden.effectKey === "random_burn_for_money" && targets.length === 0) {
    targets = [...state.deck]
      .filter((card) => !card.enhancement && !card.edition && !card.seal)
      .sort((left, right) => randomAt(`${state.seed}:burn:${left.instanceId}`, cursor) - randomAt(`${state.seed}:burn:${right.instanceId}`, cursor))
      .slice(0, 5)
      .map((card) => card.instanceId);
    cursor += state.deck.length;
  }
  const result = applyForbiddenEffect(state, forbidden, targets, makeId);
  let talismans = result.talismans;
  if (result.grantLegendaryTalisman) {
    const legendary = TALISMANS.filter((entry) => entry.rarity === "legendary");
    const picked = legendary[Math.floor(randomAt(`${state.seed}:legendary`, cursor++) * legendary.length)];
    if (picked) talismans = [{ instanceId: makeId("legendary"), definitionId: picked.id, growth: 0 }, ...talismans];
  }
  return {
    ...state,
    rngCursor: cursor,
    deck: result.deck,
    handSize: result.handSize,
    money: result.money,
    talismans,
    yakuLevels: result.yakuLevels,
    screen: state.returnScreen ?? "shop",
    returnScreen: null,
    pendingConsumableId: null,
    pendingTargetIds: [],
    pendingShopOfferId: null,
    lastConsumableId: id,
    logs: logEntry(state, "reward", forbidden.name, result.message),
  };
}

function nextFromShop(state: GameState): GameState {
  if (state.stage % 3 === 0) {
    let cursor = state.rngCursor;
    const pool = [...CONTRACTS];
    const choices: string[] = [];
    while (choices.length < 2 && pool.length) {
      const index = Math.floor(randomAt(`${state.seed}:contract:${state.stage}`, cursor++) * pool.length);
      choices.push(pool.splice(index, 1)[0].id);
    }
    return { ...state, screen: "contract", contractChoices: choices, rngCursor: cursor };
  }
  return {
    ...state,
    stage: state.stage + 1,
    screen: "round_intro",
    shopOffers: [],
    shopType: null,
  };
}

export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case "HYDRATE":
      return action.payload && typeof action.payload === "object" ? action.payload as GameState : state;
    case "CONTINUE_RUN":
      return action.state;
    case "SET_SEED":
      return state.screen === "title" || state.screen === "deck_select" ? { ...state, seed: action.seed.slice(0, 40) } : state;
    case "OPEN_DECK_SELECT":
      return { ...state, screen: "deck_select" };
    case "START_RUN":
      return startRun(state, action.startDeckId, action.tutorialMode);
    case "TOGGLE_EXPERIMENT":
      return { ...state, experimentalRules: { ...state.experimentalRules, [action.key]: !state.experimentalRules[action.key] } };
    case "START_STAGE":
      return startStage(state);
    case "SELECT_CARD": {
      const card = state.hand.find((entry) => entry.instanceId === action.cardId);
      if (!card) return state;
      const already = state.selectedCardIds.includes(action.cardId);
      const selectedCardIds = already
        ? state.selectedCardIds.filter((id) => id !== action.cardId)
        : state.selectedCardIds.length < MAX_SELECTED
          ? [...state.selectedCardIds, action.cardId]
          : state.selectedCardIds;
      const hand = card.tags.includes("face_down")
        ? state.hand.map((entry) => entry.instanceId === card.instanceId ? { ...entry, tags: entry.tags.filter((tag) => tag !== "face_down") } : entry)
        : state.hand;
      const selectionChanged = selectedCardIds !== state.selectedCardIds;
      return {
        ...state,
        hand,
        selectedCardIds,
        manualYakuId: selectionChanged ? null : state.manualYakuId,
      };
    }
    case "CLEAR_SELECTION":
      return { ...state, selectedCardIds: [], manualYakuId: null };
    case "SET_MANUAL_YAKU":
      return { ...state, manualYakuId: action.yakuId };
    case "SET_CUP_ROLE":
      return {
        ...state,
        cupRole: action.role,
        manualYakuId: action.role === state.cupRole ? state.manualYakuId : null,
      };
    case "DECLARE_SHAKE": {
      const selected = selectionInOrder(state);
      if (!canDeclareShake(selected, state.experimentalRules)) return state;
      const declaring = !state.yard.shakeArmed;
      return {
        ...state,
        yard: { ...state.yard, shakeArmed: !state.yard.shakeArmed },
        talismans: declaring
          ? state.talismans.map((item) => item.definitionId === "t_shake_iron" ? { ...item, growth: item.growth + 1 } : item)
          : state.talismans,
        logs: logEntry(state, "system", "흔들기 선언", canDeclareBomb(selected, state.yard, state.experimentalRules) ? "강화 흔들기 준비" : "이번 판 정산 보너스를 걸었습니다."),
      };
    }
    case "SUBMIT_HAND":
      return submitHand(state);
    case "DISCARD_SELECTED":
      return discardSelected(state);
    case "BANK_CHAIN": {
      if (state.screen !== "decision") return state;
      return settle(state, bankChain(state.chain, { target: state.targetScore, handsRemaining: state.handsRemaining, requiresSettledGo: state.bossId === "boss_stubborn" }));
    }
    case "DECLARE_GO": {
      if (state.screen !== "decision") return state;
      try {
        const armed = armGo(state.chain, state.targetScore, state.handsRemaining);
        const thresholdFactor = calculateTalismanRoundRuleModifiers(state.talismans).thresholdFactor;
        const chain = {
          ...armed,
          requirement: armed.requirement === null ? null : Math.ceil(armed.requirement * thresholdFactor),
        };
        const next = {
          ...state,
          screen: "play" as const,
          chain,
          stats: { ...state.stats, goAttempts: state.stats.goAttempts + 1 },
          logs: logEntry(state, "go", `${chain.successfulGoCount + 1}고 선언`, `합계 ${chain.requirement?.toLocaleString("ko-KR")}점을 넘어야 합니다.`),
        };
        return refillHand(next, state.hand);
      } catch {
        return state;
      }
    }
    case "STOP_ROUND": {
      if (state.screen !== "decision") return state;
      return settle(state, stopRound(state.chain, { target: state.targetScore, handsRemaining: state.handsRemaining, requiresSettledGo: state.bossId === "boss_stubborn" }));
    }
    case "CONTINUE_AFTER_REWARD":
      if (state.stage === 12 && state.infiniteLap === 0) return { ...state, screen: "run_win" };
      return { ...state, screen: "shop_choice" };
    case "CHOOSE_SHOP": {
      const generated = generateOffers(state, action.shopType);
      const baseReroll = Math.max(0, 2 - Math.min(1, countContract(state, "reroll_cost")));
      const firstFree = state.talismans.some((item) => item.definitionId === "t_market_rumor");
      return { ...state, screen: "shop", shopType: action.shopType, shopOffers: generated.offers, rngCursor: generated.cursor, rerollCost: firstFree ? 0 : baseReroll };
    }
    case "BUY_OFFER":
      return buyOffer(state, action.offerId);
    case "REROLL_SHOP": {
      if (!state.shopType || state.money < state.rerollCost) return state;
      const generated = generateOffers({ ...state, rngCursor: state.rngCursor + 1 }, state.shopType);
      const bargainingLevel = countContract(state, "reroll_cost");
      const baseReroll = Math.max(0, 2 - Math.min(1, bargainingLevel));
      const marketRumor = state.talismans.some((item) => item.definitionId === "t_market_rumor");
      const nextCost = bargainingLevel >= 2
        ? baseReroll
        : state.rerollCost === 0
          ? baseReroll + (marketRumor ? 2 : 1)
          : state.rerollCost + (marketRumor ? 2 : 1);
      return { ...state, money: state.money - state.rerollCost, rngCursor: generated.cursor, shopOffers: generated.offers, rerollCost: nextCost };
    }
    case "SELECT_CONSUMABLE_TARGET": {
      const exists = state.pendingTargetIds.includes(action.cardId);
      const definition = getPendingConsumableDefinition(state);
      const maxTargets = definition && "maxTargets" in definition ? definition.maxTargets : 5;
      return { ...state, pendingTargetIds: exists ? state.pendingTargetIds.filter((id) => id !== action.cardId) : [...state.pendingTargetIds, action.cardId].slice(0, maxTargets) };
    }
    case "APPLY_CONSUMABLE":
      return applyConsumable(state, action.option);
    case "CANCEL_CONSUMABLE": {
      const offer = state.shopOffers.find((entry) => entry.offerId === state.pendingShopOfferId);
      return {
        ...state,
        money: state.money + (offer?.price ?? 0),
        shopOffers: state.shopOffers.map((entry) => entry.offerId === state.pendingShopOfferId ? { ...entry, sold: false } : entry),
        screen: state.returnScreen ?? "shop",
        returnScreen: null,
        pendingConsumableId: null,
        pendingTargetIds: [],
        pendingShopOfferId: null,
      };
    }
    case "SELL_TALISMAN": {
      const instance = state.talismans.find((entry) => entry.instanceId === action.instanceId);
      const definition = instance ? TALISMAN_BY_ID[instance.definitionId] : undefined;
      if (!instance || !definition) return state;
      return { ...state, money: state.money + Math.max(1, Math.floor(definition.price / 2)), talismans: state.talismans.filter((entry) => entry.instanceId !== action.instanceId) };
    }
    case "MOVE_TALISMAN": {
      const index = state.talismans.findIndex((entry) => entry.instanceId === action.instanceId);
      const target = index + action.direction;
      if (index < 0 || target < 0 || target >= state.talismans.length) return state;
      const talismans = [...state.talismans];
      [talismans[index], talismans[target]] = [talismans[target], talismans[index]];
      return { ...state, talismans };
    }
    case "CHOOSE_CONTRACT": {
      if (!state.contractChoices.includes(action.contractId)) return state;
      const contracts = [...state.contracts, action.contractId];
      const definition = CONTRACTS.find((entry) => entry.id === action.contractId);
      return {
        ...state,
        contracts,
        talismanSlots: definition?.effectKey === "inventory_slots" ? state.talismanSlots + 1 : state.talismanSlots,
        stage: state.stage + 1,
        screen: "round_intro",
        contractChoices: [],
        shopOffers: [],
        shopType: null,
      };
    }
    case "OPEN_SCREEN":
      return { ...state, returnScreen: state.screen, screen: action.screen };
    case "RETURN_TO_PLAY":
      return { ...state, screen: state.returnScreen ?? "play", returnScreen: null };
    case "RETRY_NAGARI":
      if (state.stage !== 12 || state.nagariUsed || !state.experimentalRules.nagariRetry) return state;
      return startStage({ ...state, nagariUsed: true, screen: "round_intro", baseHands: Math.max(1, state.baseHands - 1) });
    case "RETRY_TUTORIAL_BOSS":
      if (!state.tutorialMode || state.tutorialBossRetryUsed) return state;
      return startStage({ ...state, tutorialBossRetryUsed: true, screen: "round_intro" });
    case "NEXT_STAGE":
      return state.screen === "shop" ? nextFromShop(state) : state;
    case "CONTINUE_INFINITE":
      return { ...state, stage: state.stage + 1, infiniteLap: 0, screen: "round_intro", shopOffers: [], shopType: null };
    case "RESET_RUN":
      return { ...createInitialGameState(state.seed), experimentalRules: state.experimentalRules };
  }
}

export function getDefinitionForOffer(offer: ShopOffer): { name: string; description: string; assetTag: string } | null {
  if (offer.category === "talisman") return TALISMAN_BY_ID[offer.definitionId] ?? null;
  if (offer.category === "painter") return PAINTER_BY_ID[offer.definitionId] ?? null;
  if (offer.category === "book") return BOOK_BY_ID[offer.definitionId] ?? null;
  if (offer.category === "forbidden") return FORBIDDEN_BY_ID[offer.definitionId] ?? null;
  return PACK_BY_ID[offer.definitionId] ?? null;
}

export function getPendingConsumableDefinition(state: GameState): PainterDefinition | (ForbiddenDefinition & { description: string }) | null {
  if (!state.pendingConsumableId) return null;
  const painter = PAINTER_BY_ID[state.pendingConsumableId] as PainterDefinition | undefined;
  const forbidden = FORBIDDEN_BY_ID[state.pendingConsumableId] as (ForbiddenDefinition & { description: string }) | undefined;
  return painter ?? forbidden ?? null;
}
