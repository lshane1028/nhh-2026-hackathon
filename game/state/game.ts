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
  getBossKkeutAdjustment,
  getBossSettlementFactor,
} from "../engine/boss";
import {
  applyForbiddenEffect,
  applyPainterEffect,
  applyStartDeck,
} from "../engine/consumables";
import { rollCardEffectTag } from "../content/card-effects";
import { calculateCollectionBonus } from "../engine/collection-bonus";
import { createStandardHwatuDeck, isCupCard, type CupRole } from "../engine/deck";
import {
  canDeclareShake,
  evaluateBakContract,
  getShakeResult,
  resolveYardCapture,
  weatherCardModifier,
} from "../engine/experimental";
import {
  addHandToRound,
  canDeclareGo,
  createGoChainState,
  declareGo,
  getGoRequirement,
  isRequirementCleared,
  settleRound,
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

/** 광 → 동물 → 띠 → 피, the order a hwatu player reads a hand in. */
const KIND_ORDER: Record<CardInstance["kind"], number> = {
  bright: 0,
  animal: 1,
  ribbon: 2,
  chaff: 3,
};

export function sortHand(
  hand: readonly CardInstance[],
  mode: GameState["handSort"],
): CardInstance[] {
  const byMonth = (left: CardInstance, right: CardInstance) => left.month - right.month;
  const byKind = (left: CardInstance, right: CardInstance) =>
    KIND_ORDER[left.kind] - KIND_ORDER[right.kind];
  return [...hand].sort((left, right) => {
    const primary = mode === "kind" ? byKind(left, right) : byMonth(left, right);
    if (primary !== 0) return primary;
    const secondary = mode === "kind" ? byMonth(left, right) : byKind(left, right);
    if (secondary !== 0) return secondary;
    return left.instanceId.localeCompare(right.instanceId);
  });
}

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
    handSort: "month",
    cupAssignments: {},
    pendingCupCardId: null,
    pendingShakeChoice: false,
    shakeChoice: null,
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
    pendingPack: null,
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

/**
 * The one card effect tag the engine reads today. It is here rather than in a
 * generic tag dispatcher because a player tests "버릴 수 없다" immediately, and
 * a label that lies is worse than no label.
 */
export function isUndiscardable(card: CardInstance): boolean {
  return card.effectTagId === "stubborn";
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
    hand: sortHand([...currentHand, ...faceDownForBoss(drawn, boss)], state.handSort),
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
  const hand = sortHand(faceDownForBoss(pileAfterYard.slice(0, handSize).map(cloneCard), boss), state.handSort);
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
    pendingCupCardId: null,
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
  /** The cup role that produced this score, before the player files the card. */
  usedCupRole: CupRole;
}

/**
 * Cup cards in a submission are scored with whichever role pays more. The
 * player still chooses where the card is filed on the collection board once the
 * hand is over, which is what `pendingCupCardId` drives.
 */
function cupRoleVariantsFor(
  state: GameState,
  cards: readonly CardInstance[],
): { variants: CupRole[]; unassignedIds: string[] } {
  const cupCards = cards.filter(isCupCard);
  const unassignedIds = cupCards
    .filter((card) => !state.cupAssignments[card.instanceId])
    .map((card) => card.instanceId);
  if (unassignedIds.length > 0) return { variants: ["animal", "double_chaff"], unassignedIds };
  const assigned = cupCards.map((card) => state.cupAssignments[card.instanceId]);
  return { variants: [assigned[0] ?? "animal"], unassignedIds };
}

export function evaluateSelectedHand(state: GameState): ScoredSelection | null {
  const submitted = selectionInOrder(state);
  if (submitted.length === 0 || submitted.length > MAX_SELECTED) return null;
  const boss = state.bossId ? BOSS_BY_ID[state.bossId] ?? null : null;
  const rules = calculateTalismanRoundRuleModifiers(state.talismans);
  const capture = resolveYardCapture(submitted, state.yard, state.experimentalRules.yardMatching);
  const shake = getShakeResult(state.shakeChoice);
  const confirmedCards = cardsFromIds(state, state.chain.collection.cardIds);
  const pendingCards: CardInstance[] = [];
  const heldCards = state.hand.filter((card) => !state.selectedCardIds.includes(card.instanceId));
  const canUnify = rules.unifyMonthUses > (state.roundTalismanUses.t_twelve_month_painter ?? 0);
  const unifyVariants: Array<number | null> = [null];
  if (canUnify) {
    for (let month = 1; month <= 12; month += 1) unifyVariants.push(month);
  }
  const highestYakuLevel = Math.max(1, ...Object.values(state.yakuLevels).map((entry) => entry.level));
  const cupVariants = cupRoleVariantsFor(state, [...submitted, ...capture.captured]);
  const evaluatedVariants: Array<{
    breakdown: ScoreBreakdown;
    unifyMonth: number | null;
    cupRole: CupRole;
  }> = [];

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
  for (const cupRole of cupVariants.variants) {
    const cupRoleMap: Record<string, CupRole> = { ...state.cupAssignments };
    for (const id of cupVariants.unassignedIds) cupRoleMap[id] = cupRole;
    const evaluatedSubmission = submitted.map((card, index) => decorateCard(card, index, unifyMonth));
    const evaluatedCaptured = capture.captured.map((card, index) => decorateCard(card, index, null));
    const collection: CollectionEvaluationInput = {
      confirmedCards,
      pendingCards,
      submittedCards: [...evaluatedSubmission, ...evaluatedCaptured],
      confirmedCompletedYakuIds: state.chain.collection.completedYakuIds,
      cupRole,
    };
    const baseInput = {
      submittedCards: evaluatedSubmission,
      heldCards,
      collection,
      yakuLevels: state.yakuLevels,
      cupRole,
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
        cupRole,
        money: state.money,
        emptyTalismanSlots: Math.max(0, getEffectiveTalismanSlots(state) - state.talismans.length),
        successfulGoCount: state.chain.goCount,
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
        cupRoleMap,
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
      evaluatedVariants.push({ breakdown, unifyMonth, cupRole });
    }
  }
  }
  if (evaluatedVariants.length === 0) return null;
  const breakdown = chooseDefaultCandidate(evaluatedVariants.map((entry) => entry.breakdown));
  const chosen = evaluatedVariants.find((entry) => entry.breakdown === breakdown) ?? evaluatedVariants[0];
  return {
    breakdown,
    submitted,
    captured: capture.captured,
    remainingYard: capture.remainingYard,
    swept: capture.swept,
    settlementBonus: shake.settlementBonus,
    captureLabel: [capture.label, shake.label].filter(Boolean).join(" · "),
    usedUnifyMonth: chosen.unifyMonth,
    usedCupRole: chosen.cupRole,
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

/** Factors that make a called Go harder, from the boss and from talismans. */
function goThresholdFactor(state: GameState): number {
  const boss = state.bossId ? BOSS_BY_ID[state.bossId] ?? null : null;
  const talismanRules = calculateTalismanRoundRuleModifiers(state.talismans);
  const bossFactor = boss?.ruleKey === "go_fail_tax" ? 1.1 : 1;
  return talismanRules.thresholdFactor * bossFactor;
}

/**
 * The score this round must reach right now. Once a Go is called the bar is the
 * value snapshotted at that moment, so it cannot drift as the player scores.
 */
export function getRoundRequirement(state: GameState): number {
  return state.chain.goRequirement ?? getGoRequirement(state.targetScore, 0);
}

/** What the bar would become if the player called Go from here. */
export function getNextGoRequirement(state: GameState): number | null {
  if (!canDeclareGo(state.chain, state.handsRemaining)) return null;
  return getGoRequirement(
    state.targetScore,
    state.chain.goCount + 1,
    goThresholdFactor(state),
    state.chain.roundScore,
  );
}

/** True while the player still owes the boss a called Go before stopping. */
export function mustDeclareGo(state: GameState): boolean {
  const boss = state.bossId ? BOSS_BY_ID[state.bossId] ?? null : null;
  return !bossVictoryConditionMet(boss, state.chain.goCount);
}

function finishRound(state: GameState): GameState {
  const boss = state.bossId ? BOSS_BY_ID[state.bossId] ?? null : null;
  const talismanRules = calculateTalismanRoundRuleModifiers(state.talismans);
  const settlement = settleRound(state.chain, state.yakuLevels);
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
    state.chain.collection.completedYakuIds,
    state.experimentalRules.bakContracts,
  );
  const rewardBreakdown = calculateRoundReward({
    won: true,
    baseWinReward: 3 + Math.ceil(state.stage / 2),
    remainingHands: state.handsRemaining,
    successfulGoCount: state.chain.goCount,
    confirmedScore: state.chain.roundScore,
    targetScore: state.targetScore,
    adjustment: talismanReward.moneyDelta + bak.bonusMoney,
  });
  const heldCoinMoney = state.hand.filter((card) => card.enhancement === "coin").length * 2;
  const blueSeals = state.hand.filter((card) => card.seal === "blue").length;
  // Going further multiplies the whole purse, and the boss/deck settlement
  // modifiers now land on the money instead of on a separate banked score.
  const settlementFactor = getBossSettlementFactor(boss, state.chain.goCount)
    * (1 + state.roundSettlementBonus)
    * talismanRules.settlementFactor;
  const reward = Math.max(
    0,
    Math.floor((rewardBreakdown.total + heldCoinMoney) * settlement.rewardFactor * settlementFactor),
  );
  let yakuLevels = settlement.masteryLevels;
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
    roundSettlementBonus: 0,
    selectedCardIds: [],
    calendarStamps: stamp ? [...state.calendarStamps, stamp] : state.calendarStamps,
    stats: {
      ...state.stats,
      goSuccesses: state.stats.goSuccesses + state.chain.goCount,
      moneyEarned: state.stats.moneyEarned + reward,
    },
  };
  return {
    ...next,
    logs: logEntry(
      next,
      "reward",
      `판돈 ${reward}냥`,
      `${state.chain.goCount}고 · ×${settlement.rewardFactor} · ${bak.name}`,
    ),
  };
}

function loseRound(state: GameState, detail: string): GameState {
  return {
    ...state,
    screen: "run_lose",
    selectedCardIds: [],
    logs: logEntry(state, "fail", "판 패배", detail),
  };
}

function submitHand(state: GameState): GameState {
  if (state.screen !== "play" || state.handsRemaining <= 0 || state.pendingCupCardId) return state;
  // Three of one month is worth either 흔들기 or 폭탄, and the player picks
  // before the hand is scored because 폭탄 changes this hand's month sum.
  if (
    state.shakeChoice === null
    && !state.pendingShakeChoice
    && canDeclareShake(selectionInOrder(state), state.experimentalRules)
  ) {
    return { ...state, pendingShakeChoice: true };
  }
  const scored = evaluateSelectedHand(state);
  if (!scored) {
    return { ...state, logs: logEntry(state, "system", "제출 불가", "1~5장의 카드를 골라 주세요.") };
  }
  const pendingCupCardId = [...scored.submitted, ...scored.captured]
    .filter(isCupCard)
    .map((card) => card.instanceId)
    .find((id) => !state.cupAssignments[id]) ?? null;
  const submittedIds = new Set(scored.submitted.map((card) => card.instanceId));
  const remainingHand = state.hand.filter((card) => !submittedIds.has(card.instanceId));
  const handsRemaining = state.handsRemaining - 1;
  const mastery = createMasteryEvents(scored.breakdown);
  const chain = addHandToRound(state.chain, scored.breakdown.score, {
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
    pendingCupCardId,
    pendingShakeChoice: false,
    shakeChoice: null,
    chain,
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

  const requirement = getRoundRequirement(next);
  const cleared = isRequirementCleared(next.chain, requirement);

  // Clearing the bar opens the Go/Stop decision. Nothing else ends the round.
  if (cleared) {
    if (mustDeclareGo(next) && !canDeclareGo(next.chain, handsRemaining)) {
      return loseRound(next, "두목이 요구한 고를 선언할 기회가 남지 않았습니다.");
    }
    return { ...next, screen: "decision" };
  }

  if (handsRemaining <= 0) {
    // A called Go that never landed is the classic 고박: the run ends here.
    if (next.chain.goCount > 0) {
      const talismanFailure = calculateTalismanGoFailureAdjustment({
        talismans: next.talismans,
        failed: true,
        rescueRoll: randomAt(`${state.seed}:go-rescue:${state.stage}`, next.rngCursor),
      });
      const failed: GameState = {
        ...next,
        rngCursor: next.rngCursor + 1,
        money: Math.max(0, next.money - next.failMoneyPenalty + talismanFailure.moneyDelta),
        stats: { ...next.stats, goFailures: next.stats.goFailures + 1 },
      };
      if (talismanFailure.rescued) {
        return finishRound({
          ...failed,
          chain: { ...failed.chain, goCount: (failed.chain.goCount - 1) as GameState["chain"]["goCount"] },
          logs: logEntry(failed, "system", "고 실패 구제", "부적이 고 한 단계를 물러 주었습니다."),
        });
      }
      return loseRound(
        failed,
        `${failed.chain.goCount}고 문턱 ${requirement.toLocaleString("ko-KR")}점에 ${(requirement - failed.chain.roundScore).toLocaleString("ko-KR")}점 부족`,
      );
    }
    return loseRound(next, `목표 ${requirement.toLocaleString("ko-KR")}점에 닿지 못했습니다.`);
  }

  return refillHand({ ...next, screen: "play" }, remainingHand);
}

function discardSelected(state: GameState): GameState {
  if (state.screen !== "play" || state.discardsRemaining <= 0 || state.selectedCardIds.length === 0) return state;
  const cost = getBossDiscardMoneyCost(state.bossId ? BOSS_BY_ID[state.bossId] ?? null : null);
  if (state.money < cost) {
    return { ...state, logs: logEntry(state, "system", "버리기 불가", "세금쟁이에게 낼 냥이 없습니다.") };
  }
  const ids = new Set(state.selectedCardIds);
  // 고집패 refuses to leave the hand even when bundled with other cards.
  const stuck = state.hand.filter((card) => ids.has(card.instanceId) && isUndiscardable(card));
  const discarded = state.hand.filter((card) => ids.has(card.instanceId) && !isUndiscardable(card));
  if (discarded.length === 0) {
    return {
      ...state,
      logs: logEntry(state, "system", "버리기 불가", "고집패는 버릴 수 없습니다."),
    };
  }
  const kept = state.hand.filter((card) => !ids.has(card.instanceId) || isUndiscardable(card));
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
    logs: logEntry(
      state,
      "system",
      `${discarded.length}장 버림`,
      [
        stuck.length ? `고집패 ${stuck.length}장은 남았습니다` : null,
        cost ? "세금 1냥 지불" : "손패를 보충합니다.",
        ...purpleResults,
      ].filter(Boolean).join(" · "),
    ),
  };
  return refillHand(next, kept);
}

function offerPrice(state: GameState, price: number): number {
  return Math.max(0, Math.ceil(price * (1 - contractDiscount(state))));
}

type ShopCategory = NonNullable<GameState["shopType"]>;

const SHOP_CATEGORIES: readonly ShopCategory[] = ["talisman", "book", "forbidden", "painter"];

function categoryPool(shopType: ShopCategory) {
  return shopType === "talisman"
    ? TALISMANS
    : shopType === "painter"
      ? PAINTER_CARDS
      : shopType === "book"
        ? BOOKS
        : FORBIDDEN_CARDS;
}

/**
 * The market is one screen with four fixed departments:
 *   부적전 2장 · 비결서점 2장 · 꾸러미 2장 · 금단장 1장
 * Painters are deliberately not a department — a card that turns 1월 into 2월
 * is not worth a quarter of the screen. They still appear inside 화공 묶음.
 * The tutorial round leads with the flat-multiplier charm so the first purchase
 * has an effect a new player can actually read.
 */
const SHOP_DEPARTMENT_SIZES: Record<ShopCategory | "pack", number> = {
  talisman: 2,
  book: 2,
  forbidden: 1,
  // The deck workshop sells card packs plus one 소각 painter.
  painter: 1,
  pack: 2,
};

/** The workshop only ever stocks the burn painter, never the fiddly month edits. */
const WORKSHOP_PAINTER_IDS = ["p_burn"];

function generateShopOffers(state: GameState): { offers: ShopOffer[]; cursor: number } {
  let cursor = state.rngCursor;
  const offers: ShopOffer[] = [];
  const tutorialFirstShop = state.tutorialMode && state.stage === 1;

  type Purchasable = { id: string; price: number };
  const draw = (
    pool: readonly Purchasable[],
    count: number,
    salt: string,
  ): Purchasable[] => {
    const remaining = [...pool];
    const picked: Purchasable[] = [];
    for (let index = 0; index < count && remaining.length > 0; index += 1) {
      const at = Math.floor(randomAt(`${state.seed}:${salt}:${state.stage}`, cursor++) * remaining.length);
      picked.push(remaining.splice(at, 1)[0]);
    }
    return picked;
  };

  const push = (category: ShopOffer["category"], definition: { id: string; price: number }, index: number) => {
    offers.push({
      offerId: `${state.runId}:offer:${state.stage}:${category}:${index}:${cursor}`,
      category,
      definitionId: definition.id,
      price: offerPrice(state, definition.price),
      sold: false,
    });
  };

  for (const category of SHOP_CATEGORIES) {
    const size = SHOP_DEPARTMENT_SIZES[category];
    if (size <= 0) continue;
    const pool = category === "painter"
      ? categoryPool(category).filter((entry) => WORKSHOP_PAINTER_IDS.includes(entry.id))
      : categoryPool(category);
    const picked = draw(pool, size, `shop:${category}`);
    if (tutorialFirstShop && category === "talisman" && TALISMAN_BY_ID.t_first_charm) {
      picked[0] = TALISMAN_BY_ID.t_first_charm;
    }
    picked.forEach((definition, index) => push(category, definition, index));
  }

  draw(PACKS, SHOP_DEPARTMENT_SIZES.pack, "pack").forEach((pack, index) => push("pack", pack, index));

  return { offers, cursor };
}

function generateOffers(state: GameState, shopType: ShopCategory, free = false): { offers: ShopOffer[]; cursor: number } {
  let cursor = state.rngCursor;
  const pool = [...categoryPool(shopType)];
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
  return { offers, cursor };
}

/**
 * Rolls the candidates a bought card pack puts on the table. Every candidate
 * carries a random effect tag — a label only, see content/card-effects.ts.
 */
function openCardPack(state: GameState, pack: { id: string; name: string; choices: number; picks: number }): {
  pendingPack: NonNullable<GameState["pendingPack"]>;
  cursor: number;
} {
  let cursor = state.rngCursor;
  const templates = createStandardHwatuDeck();
  const candidates: CardInstance[] = [];
  for (let index = 0; index < pack.choices; index += 1) {
    const template = templates[Math.floor(randomAt(`${state.seed}:pack-card:${state.stage}:${pack.id}`, cursor++) * templates.length)];
    if (!template) continue;
    const tag = rollCardEffectTag(randomAt(`${state.seed}:pack-tag:${state.stage}:${pack.id}`, cursor++));
    candidates.push({
      ...template,
      tags: [...template.tags],
      instanceId: `pack:${state.runId}:${state.stage}:${pack.id}:${index}:${cursor}`,
      effectTagId: tag.id,
    });
  }
  return {
    pendingPack: { packId: pack.id, name: pack.name, picksLeft: Math.min(pack.picks, candidates.length), candidates },
    cursor,
  };
}

function buyOffer(state: GameState, offerId: string): GameState {
  const offer = state.shopOffers.find((entry) => entry.offerId === offerId);
  if (!offer || offer.sold || state.money < offer.price) return state;
  if (offer.category === "pack") {
    const pack = PACK_BY_ID[offer.definitionId];
    if (!pack) return state;
    const opened = openCardPack(state, pack);
    return {
      ...state,
      rngCursor: opened.cursor,
      money: state.money - offer.price,
      pendingPack: opened.pendingPack,
      shopOffers: state.shopOffers.map((entry) => entry.offerId === offer.offerId ? { ...entry, sold: true } : entry),
      logs: logEntry(state, "reward", `${pack.name} 개봉`, `후보 ${opened.pendingPack.candidates.length}장 중 ${opened.pendingPack.picksLeft}장을 고르세요.`),
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
    pendingPack: null,
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
      return { ...state, hand, selectedCardIds };
    }
    case "CLEAR_SELECTION":
      return { ...state, selectedCardIds: [] };
    case "SET_HAND_SORT":
      return { ...state, handSort: action.mode, hand: sortHand(state.hand, action.mode) };
    case "ASSIGN_CUP_ROLE": {
      if (state.pendingCupCardId !== action.cardId) return state;
      const card = state.deck.find((entry) => entry.instanceId === action.cardId);
      return {
        ...state,
        cupAssignments: { ...state.cupAssignments, [action.cardId]: action.role },
        pendingCupCardId: null,
        logs: logEntry(
          state,
          "system",
          "술잔 기록",
          `${card?.name ?? "9월 술잔"} → ${action.role === "animal" ? "동물 1장" : "피 2점"}`,
        ),
      };
    }
    case "RESOLVE_SHAKE": {
      if (!state.pendingShakeChoice) return state;
      const armed: GameState = {
        ...state,
        pendingShakeChoice: false,
        shakeChoice: action.choice,
        talismans: action.choice === "shake"
          ? state.talismans.map((item) => item.definitionId === "t_shake_iron"
              ? { ...item, growth: item.growth + 1 }
              : item)
          : state.talismans,
      };
      return submitHand(armed);
    }
    case "SUBMIT_HAND":
      return submitHand(state);
    case "DISCARD_SELECTED":
      return discardSelected(state);
    case "DECLARE_GO": {
      if (state.screen !== "decision") return state;
      if (!canDeclareGo(state.chain, state.handsRemaining)) return state;
      const chain = declareGo(state.chain, state.targetScore, goThresholdFactor(state));
      const next: GameState = {
        ...state,
        chain,
        stats: { ...state.stats, goAttempts: state.stats.goAttempts + 1 },
      };
      const requirement = getRoundRequirement(next);
      const logged: GameState = {
        ...next,
        logs: logEntry(
          next,
          "go",
          `${chain.goCount}고 선언`,
          `이번 판에서 ${requirement.toLocaleString("ko-KR")}점을 넘겨야 합니다.`,
        ),
      };
      // A hand big enough to clear the new bar outright re-opens the decision.
      if (isRequirementCleared(logged.chain, requirement)) return logged;
      return refillHand({ ...logged, screen: "play" }, logged.hand);
    }
    case "STOP_ROUND": {
      if (state.screen !== "decision") return state;
      if (mustDeclareGo(state)) return state;
      return finishRound(state);
    }
    case "CONTINUE_AFTER_REWARD": {
      if (state.stage === 12 && state.infiniteLap === 0) return { ...state, screen: "run_win" };
      const generated = generateShopOffers(state);
      const baseReroll = Math.max(0, 2 - Math.min(1, countContract(state, "reroll_cost")));
      const firstFree = state.talismans.some((item) => item.definitionId === "t_market_rumor");
      return {
        ...state,
        screen: "shop",
        shopType: null,
        shopOffers: generated.offers,
        rngCursor: generated.cursor,
        rerollCost: firstFree ? 0 : baseReroll,
      };
    }
    case "BUY_OFFER":
      return buyOffer(state, action.offerId);
    case "REROLL_SHOP": {
      if (state.money < state.rerollCost) return state;
      const generated = state.shopType
        ? generateOffers({ ...state, rngCursor: state.rngCursor + 1 }, state.shopType)
        : generateShopOffers({ ...state, rngCursor: state.rngCursor + 1 });
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
    case "PICK_PACK_CARD": {
      const pack = state.pendingPack;
      if (!pack || pack.picksLeft <= 0) return state;
      const card = pack.candidates.find((entry) => entry.instanceId === action.instanceId);
      if (!card) return state;
      const picksLeft = pack.picksLeft - 1;
      const candidates = pack.candidates.filter((entry) => entry.instanceId !== card.instanceId);
      return {
        ...state,
        deck: [...state.deck, card],
        pendingPack: picksLeft > 0 && candidates.length > 0
          ? { ...pack, picksLeft, candidates }
          : null,
        logs: logEntry(state, "reward", `${card.name} 획득`, `덱이 ${state.deck.length + 1}장이 되었습니다.`),
      };
    }
    case "CLOSE_PACK":
      return { ...state, pendingPack: null };
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
