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
  START_DECK_BY_ID,
  WEATHER_BY_ID,
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
  canPayForbiddenCost,
  getEligibleForbiddenTargetIds,
  isForbiddenTargetEligible,
  isForbiddenTargetSelectionValid,
} from "../engine/consumables";
import { rollCardEffectTagForCard } from "../content/card-effects";
import { calculateCollectionBonus } from "../engine/collection-bonus";
import {
  createStandardHwatuDeck,
  hasEffectiveCardKind,
  isCupCard,
  resolveCupRole,
  type CupRole,
} from "../engine/deck";
import {
  evaluateBakContract,
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
import { MIN_SUBMISSION } from "../engine/yaku";
import type { CollectionEvaluationInput } from "../engine/yaku";
import type { GameAction } from "./actions";
import type {
  BossDefinition,
  CardInstance,
  GameState,
  ImmediateYakuId,
  ForbiddenDefinition,
  PainterDefinition,
  PackDefinition,
  RoundLogEntry,
  ScoreBreakdown,
  ShopOffer,
  TalismanDefinition,
  TalismanInstance,
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

/**
 * Always calendar order.
 *
 * There used to be a 광·동물·띠·피 toggle beside the hand. It cost a control and
 * a piece of state to answer a question the player almost never has: 짓 is
 * built out of month sums, so month order is the only arrangement that helps
 * with the thing you are actually doing.
 */
export function sortHand(hand: readonly CardInstance[]): CardInstance[] {
  return [...hand].sort((left, right) =>
    left.month - right.month
    || KIND_ORDER[left.kind] - KIND_ORDER[right.kind]
    || left.instanceId.localeCompare(right.instanceId),
  );
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
    highestSubmissionCards: 0,
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
    cupAssignments: {},
    pendingCupCardId: null,
    pendingCupExtraDiscardsBefore: null,
    handsRemaining: 4,
    // 버리기는 제출보다 훨씬 값이 싸다. 그리디 시뮬레이션에서 제출 한 번은
    // 라운드 점수의 약 25%를 만들지만 버리기 한 번은 3.5%뿐이었다. 4:4로 두면
    // 두 자원이 같은 무게로 보이지만 실제로는 7배 차이라 4:3으로 맞춘다.
    discardsRemaining: 3,
    handSize: 8,
    baseHands: 4,
    baseDiscards: 3,
    targetMultiplier: 1,
    roundSettlementBonus: 0,
    failMoneyPenalty: 0,
    roundSubmissionIndex: 0,
    roundHighestHand: 0,
    roundHighestSubmissionCards: 0,
    roundTalismanUses: {},
    scoredMonthsThisRound: [],
    chain: createGoChainState(),
    money: 4,
    talismans: [],
    talismanSlots: 5,
    yakuLevels: initialYakuLevels(),
    unlockedSecretYakuIds: [],
    shopOffers: [],
    lastForbiddenOfferId: null,
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
      bakContracts: true,
      weather: true,
      nagariRetry: true,
    },
    yard: { cards: [], sweptCount: 0 },
    nagariUsed: false,
    tutorialBossRetryUsed: false,
    tutorialMode: false,
    calendarStamps: [],
    lastScore: null,
    lastRoundReward: 0,
    lastRoundSummary: null,
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

/**
 * What the collection board is paying right now, beyond 배수.
 *
 * Read straight off the cards banked this round, so the perks appear the
 * instant a row completes and vanish when the round resets. Everything that
 * consumes them goes through here rather than recomputing the board.
 */
function collectionPerks(state: GameState) {
  return calculateCollectionBonus(
    cardsFromIds(state, state.chain.collection.cardIds),
    state.cupAssignments,
    state.yakuLevels,
  ).perks;
}

function effectiveHandSize(state: GameState): number {
  return state.handSize + countContract(state, "hand_size") + collectionPerks(state).handSizeBonus;
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
  if (needed === 0) return { ...state, hand: sortHand(currentHand) };

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
  const luckyDiscards = drawn.filter((card) => card.effectTagId === "drawn_luck").length;
  const boss = state.bossId ? BOSS_BY_ID[state.bossId] ?? null : null;
  return {
    ...state,
    rngCursor: cursor,
    discardsRemaining: state.discardsRemaining + luckyDiscards,
    hand: sortHand([...currentHand, ...faceDownForBoss(drawn, boss)]),
    drawPile: pile.slice(drawn.length),
    usedPile,
  };
}

function startRun(state: GameState, startDeckId: string, tutorialMode: boolean, entropy = "fixed"): GameState {
  let cursor = 0;
  const runId = `${state.seed}:run:${entropy}`;
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
        detail: `${START_DECK_BY_ID[startDeckId]?.name ?? "정석패"} · 시드 ${state.seed}`,
      },
    ],
  };
}

/**
 * 제물 단도 eats the talisman immediately to its right when a stage opens and
 * converts that talisman's price into permanent growth. Two daggers side by
 * side resolve left to right, so the left one eats the right one.
 */
function resolveDevouringDaggers(talismans: readonly TalismanInstance[]): {
  talismans: TalismanInstance[];
  devoured: string[];
} {
  let list = [...talismans];
  const devoured: string[] = [];
  for (let index = 0; index < list.length; index += 1) {
    const dagger = list[index];
    const definition = TALISMAN_BY_ID[dagger.definitionId];
    if (definition?.effectKey !== "devour_neighbor") continue;
    const victim = list[index + 1];
    if (!victim) continue;
    const victimDefinition = TALISMAN_BY_ID[victim.definitionId];
    if (!victimDefinition) continue;
    devoured.push(victimDefinition.name);
    list = [
      ...list.slice(0, index),
      { ...dagger, growth: dagger.growth + victimDefinition.price * (definition.amount ?? 0) },
      ...list.slice(index + 2),
    ];
  }
  return { talismans: list, devoured };
}

function startStage(state: GameState): GameState {
  const stage = getStageDefinition(state.stage, state.infiniteLap);
  const devouring = resolveDevouringDaggers(state.talismans);
  const stageBossId = state.stage > 12
    ? BOSSES[(state.stage - 13) % BOSSES.length].id
    : stage.bossId;
  const scriptedTutorial = state.tutorialMode && state.stage === 1;
  const shuffled = shuffleDeterministic(state.deck.map(cloneCard), {
    seed: scriptedTutorial ? `${DEFAULT_SEED}:tutorial-stage-1` : `${state.seed}:${state.runId}:stage:${state.stage}`,
    cursor: state.rngCursor,
  });
  const yardCards: CardInstance[] = [];
  const pileAfterYard = shuffled.value;
  const hands = state.baseHands + countContract(state, "hands_per_round");
  const discards = state.baseDiscards + countContract(state, "discards_per_round");
  const boss = stageBossId ? BOSS_BY_ID[stageBossId] ?? null : null;
  const handSize = effectiveHandSize(state);
  const dealt = faceDownForBoss(pileAfterYard.slice(0, handSize).map(cloneCard), boss);
  const hand = sortHand(dealt);
  const next: GameState = {
    ...state,
    screen: "play",
    rngCursor: shuffled.state.cursor,
    talismans: devouring.talismans,
    targetScore: Math.ceil(stage.target * state.targetMultiplier),
    bossId: stageBossId,
    weatherId: state.experimentalRules.weather ? stage.weatherId : "clear",
    drawPile: pileAfterYard.slice(hand.length),
    hand,
    usedPile: [],
    selectedCardIds: [],
    pendingCupCardId: null,
    pendingCupExtraDiscardsBefore: null,
    handsRemaining: hands,
    discardsRemaining: discards,
    chain: createGoChainState(),
    yard: { cards: yardCards, sweptCount: 0 },
    roundSubmissionIndex: 0,
    roundHighestHand: 0,
    roundHighestSubmissionCards: 0,
    roundTalismanUses: {},
    scoredMonthsThisRound: [],
    lastScore: null,
    lastRoundReward: 0,
    lastRoundSummary: null,
    returnScreen: null,
  };
  if (devouring.devoured.length > 0) {
    return {
      ...next,
      logs: logEntry(
        next,
        "system",
        "제물 단도",
        `${devouring.devoured.join(" · ")}를 삼켰습니다.`,
      ),
    };
  }
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
        label: `날씨 · ${WEATHER_BY_ID[state.weatherId]?.name ?? "맑음"}`,
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
  return effects;
}

interface ScoredSelection {
  breakdown: ScoreBreakdown;
  submitted: CardInstance[];
  captured: CardInstance[];
  remainingYard: CardInstance[];
  swept: boolean;
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
  if (submitted.length < MIN_SUBMISSION || submitted.length > MAX_SELECTED) return null;
  const boss = state.bossId ? BOSS_BY_ID[state.bossId] ?? null : null;
  const rules = calculateTalismanRoundRuleModifiers(state.talismans);
  const capture = resolveYardCapture(submitted, state.yard, state.experimentalRules.yardMatching);
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
      // 반짓 셈판 부적이나 고도리 완성 효과가 있으면 5의 배수도 짓이 된다.
      allowFiveMultipleJit: rules.allowsFiveMultipleJit || collectionPerks(state).allowFiveMultipleJit,
      includeSecretYaku: true,
    } as const;
    const bases = evaluateImmediateCandidates(baseInput).filter((entry) =>
      bossAllowsYaku(boss, entry.yakuId, evaluatedSubmission),
    );
    for (const base of bases) {
      const candidate: YakuCandidate = {
        yakuId: base.yakuId,
        scoringCardIds: base.scoringCardIds,
        jitCardIds: [...base.jitCardIds],
        jitSum: base.jitSum,
        label: base.yakuName,
        rankLabel: base.rankLabel,
        rankBonusHeung: base.operations.find((operation) => operation.sourceId === `${base.yakuId}:rank`)?.value,
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
        discardsRemaining: state.discardsRemaining,
        yakusPlayed: state.stats.yakusPlayed,
      });
      const stateEffects = scoreEffectsForState(
        state,
        evaluatedSubmission,
        base,
        capture.bonusKkeut,
        capture.bonusHeung,
      );
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
    captureLabel: capture.label,
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
    if (card.effectTagId === "gilded") money += 1;
    if (card.enhancement === "fortune") {
      if (randomAt(`${state.seed}:fortune-money`, cursor++) < 0.08) money += 12;
    }
    if (card.enhancement === "glass" && randomAt(`${state.seed}:glass`, cursor++) < 0.25) {
      burned.add(card.instanceId);
    }
  }
  // 무광 연습 — the drought only counts hands that actually scored.
  const scoredABright = scoringCards.some((card) =>
    hasEffectiveCardKind(card, "bright", resolveCupRole(state.cupAssignments, card)),
  );
  talismans = talismans.map((item) => {
    const definition = TALISMAN_BY_ID[item.definitionId];
    if (definition?.effectKey !== "bright_drought_growth") return item;
    const grown = scoredABright ? 0 : item.growth + (definition.amount ?? 0);
    return grown === item.growth ? item : { ...item, growth: grown };
  });

  const cremations = talismans.filter((item) => item.definitionId === "t_cremation_deed");
  const chaffToBurn = scoringCards.filter((card) =>
    hasEffectiveCardKind(card, "chaff", resolveCupRole(state.cupAssignments, card)),
  ).slice(0, cremations.length);
  const growingCremationIds = new Set<string>();
  const cremationsByGrowthPriority = [...cremations].sort((left, right) => {
    const leftUsed = Number(Boolean(roundTalismanUses[`t_cremation_deed:${left.instanceId}`]));
    const rightUsed = Number(Boolean(roundTalismanUses[`t_cremation_deed:${right.instanceId}`]));
    return leftUsed - rightUsed;
  });
  cremationsByGrowthPriority.slice(0, chaffToBurn.length).forEach((cremation, index) => {
    const chaff = chaffToBurn[index];
    burned.add(chaff.instanceId);
    const useKey = `t_cremation_deed:${cremation.instanceId}`;
    if (!roundTalismanUses[useKey]) {
      growingCremationIds.add(cremation.instanceId);
      roundTalismanUses[useKey] = 1;
    }
  });
  if (growingCremationIds.size > 0) {
    talismans = talismans.map((item) => growingCremationIds.has(item.instanceId)
      ? { ...item, growth: item.growth + 0.08 }
      : item);
    roundTalismanUses.t_cremation_deed = (roundTalismanUses.t_cremation_deed ?? 0) + growingCremationIds.size;
  }
  if (scored.usedUnifyMonth !== null) {
    roundTalismanUses.t_twelve_month_painter = (roundTalismanUses.t_twelve_month_painter ?? 0) + 1;
  }
  const burnedCards = deck.filter((card) => burned.has(card.instanceId));
  if (burned.size) deck = deck.filter((card) => !burned.has(card.instanceId));

  const phoenixCopies = calculateTalismanRoundRuleModifiers(talismans).scoreThenBurnCopies;
  if (phoenixCopies > 0 && burnedCards.length && !roundTalismanUses.t_phoenix_seal) {
    const source = burnedCards[0];
    const editions = ["gold_leaf", "mother_of_pearl", "five_color"] as const;
    const copies = Array.from({ length: phoenixCopies }, (_, index): CardInstance => ({
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
  // 광 discount. Collecting brights is what makes calling Go affordable.
  return talismanRules.thresholdFactor * bossFactor * collectionPerks(state).goThresholdFactor;
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
    // 피는 돈이다. 판을 이길 때만 값을 친다.
    adjustment: talismanReward.moneyDelta + bak.bonusMoney + collectionPerks(state).moneyBonus,
  });
  const heldCoinMoney = state.hand.filter((card) => card.enhancement === "coin").length * 2;
  const keeperCoinMoney = state.hand.filter((card) => card.effectTagId === "keeper_coin").length * 3;
  const blueSeals = state.hand.filter((card) => card.seal === "blue").length;
  // Going further multiplies the whole purse, and the boss/deck settlement
  // modifiers now land on the money instead of on a separate banked score.
  const settlementFactor = getBossSettlementFactor(boss, state.chain.goCount)
    * (1 + state.roundSettlementBonus)
    * talismanRules.settlementFactor;
  const reward = Math.max(
    0,
    Math.floor((rewardBreakdown.total + heldCoinMoney + keeperCoinMoney) * settlement.rewardFactor * settlementFactor),
  );
  const collectionResult = calculateCollectionBonus(
    cardsFromIds(state, state.chain.collection.cardIds),
    state.cupAssignments,
    state.yakuLevels,
  );
  const rewardReasons = [
    { id: "base", label: "판을 이겨서", detail: "기본 승리 판돈", amount: rewardBreakdown.base },
    ...(rewardBreakdown.remainingHands > 0 ? [{ id: "hands", label: "제출을 아껴서", detail: `남은 제출 ${state.handsRemaining}회`, amount: rewardBreakdown.remainingHands }] : []),
    ...(rewardBreakdown.go > 0 ? [{ id: "go", label: `${state.chain.goCount}고를 성공해서`, detail: "고 성공 보너스", amount: rewardBreakdown.go }] : []),
    ...(rewardBreakdown.overkill > 0 ? [{ id: "overkill", label: "목표를 크게 넘겨서", detail: `${state.chain.roundScore.toLocaleString("ko-KR")}점 달성`, amount: rewardBreakdown.overkill }] : []),
    ...(rewardBreakdown.adjustment > 0 ? [{ id: "special", label: "부적·계약 효과로", detail: "추가 판돈", amount: rewardBreakdown.adjustment }] : []),
    ...(heldCoinMoney > 0 ? [{ id: "coin", label: "금전패를 남겨서", detail: `금전패 ${heldCoinMoney / 2}장`, amount: heldCoinMoney }] : []),
    ...(keeperCoinMoney > 0 ? [{ id: "keeper-coin", label: "곳간패를 남겨서", detail: `곳간패 ${keeperCoinMoney / 3}장`, amount: keeperCoinMoney }] : []),
    ...((settlement.rewardFactor * settlementFactor) !== 1 ? [{ id: "factor", label: "고 판돈을 불려서", detail: "최종 판돈 배율", multiplier: Number((settlement.rewardFactor * settlementFactor).toFixed(2)) }] : []),
  ];
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
    lastRoundSummary: {
      submissionScore: state.chain.submissionScore,
      collectionScore: state.chain.collectionScore,
      goStopPoints: collectionResult.goStopPoints,
      totalScore: state.chain.roundScore,
      goCount: state.chain.goCount,
      highestHand: state.roundHighestHand,
      highestSubmissionCards: state.roundHighestSubmissionCards,
      collectionCardIds: [...state.chain.collection.cardIds],
      completedCollectionYakuIds: [...state.chain.collection.completedYakuIds],
      rewardReasons,
    },
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

function nextUnassignedCollectedCupId(
  state: GameState,
  cupAssignments: GameState["cupAssignments"] = state.cupAssignments,
): string | null {
  return cardsFromIds(state, state.chain.collection.cardIds)
    .find((card) => isCupCard(card) && !cupAssignments[card.instanceId])
    ?.instanceId ?? null;
}

/** Applies the complete board exactly once after every surviving cup is filed. */
function finalizeDeferredCupCollection(state: GameState): GameState {
  const collectionScore = calculateCollectionBonus(
    cardsFromIds(state, state.chain.collection.cardIds),
    state.cupAssignments,
    state.yakuLevels,
  ).goStopPoints * 20;
  const chain = {
    ...state.chain,
    collectionScore,
    roundScore: state.chain.submissionScore + collectionScore,
  };
  const extraDiscardsAfter = collectionPerks({ ...state, chain }).extraDiscards;
  const grantedDiscards = state.pendingCupExtraDiscardsBefore == null
    ? 0
    : Math.max(0, extraDiscardsAfter - state.pendingCupExtraDiscardsBefore);
  return {
    ...state,
    chain,
    discardsRemaining: state.discardsRemaining + grantedDiscards,
    pendingCupCardId: null,
    pendingCupExtraDiscardsBefore: null,
  };
}

/**
 * Resolves the part of a successful submission that may change screens or draw
 * cards. A newly collected cup pauses immediately before this point so its
 * chosen collection role can update the round score first.
 */
function resolveSubmittedHandOutcome(state: GameState): GameState {
  const requirement = getRoundRequirement(state);
  const cleared = isRequirementCleared(state.chain, requirement);

  // Clearing the bar opens the Go/Stop decision. Nothing else ends the round.
  if (cleared) {
    if (mustDeclareGo(state) && !canDeclareGo(state.chain, state.handsRemaining)) {
      return loseRound(state, "두목이 요구한 고를 선언할 기회가 남지 않았습니다.");
    }
    return { ...state, screen: "decision" };
  }

  if (state.handsRemaining <= 0) {
    // A called Go that never landed is the classic 고박: the run ends here.
    if (state.chain.goCount > 0) {
      const talismanFailure = calculateTalismanGoFailureAdjustment({
        talismans: state.talismans,
        failed: true,
        rescueRoll: randomAt(`${state.seed}:go-rescue:${state.stage}`, state.rngCursor),
      });
      const failed: GameState = {
        ...state,
        rngCursor: state.rngCursor + 1,
        money: Math.max(0, state.money - state.failMoneyPenalty + talismanFailure.moneyDelta),
        stats: { ...state.stats, goFailures: state.stats.goFailures + 1 },
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
    return loseRound(state, `목표 ${requirement.toLocaleString("ko-KR")}점에 닿지 못했습니다.`);
  }

  return refillHand({ ...state, screen: "play" }, state.hand);
}

function submitHand(state: GameState): GameState {
  if (state.screen !== "play" || state.handsRemaining <= 0 || state.pendingCupCardId) return state;
  const scored = evaluateSelectedHand(state);
  if (!scored) {
    return { ...state, logs: logEntry(state, "system", "제출 불가", "2~5장으로 짓(월 합 10의 배수)과 끗패를 만들어 주세요.") };
  }
  const pendingCupCardId = [...scored.submitted, ...scored.captured]
    .filter(isCupCard)
    .map((card) => card.instanceId)
    .find((id) => !state.cupAssignments[id]) ?? null;
  const submittedIds = new Set(scored.submitted.map((card) => card.instanceId));
  const remainingHand = state.hand.filter((card) => !submittedIds.has(card.instanceId));
  const mastery = createMasteryEvents(scored.breakdown);
  const collectedIds = [...new Set([
    ...state.chain.collection.cardIds,
    ...scored.submitted.map((card) => card.instanceId),
    ...scored.captured.map((card) => card.instanceId),
  ])];
  const collectionResult = calculateCollectionBonus(
    cardsFromIds(state, collectedIds),
    state.cupAssignments,
    state.yakuLevels,
  );
  const chain = addHandToRound(state.chain, scored.breakdown.score, {
    submittedCardIds: collectedIds,
    completedCollectionYakuIds: scored.breakdown.newCollectionYakuIds,
    masteryEvents: mastery,
    // An unfiled cup has no collection role yet. Keep the previous collection
    // score visible until ASSIGN_CUP_ROLE recomputes the complete board.
    collectionScore: pendingCupCardId
      ? state.chain.collectionScore
      : collectionResult.goStopPoints * 20,
  });

  // 단은 완성되는 순간 버리기를 준다. 앞뒤 상태의 특전을 빼서 차이만 지급하므로
  // 같은 줄을 두 번 완성해도 두 번 주지 않는다.
  const perksBefore = collectionPerks(state);
  const perksAfter = collectionPerks({ ...state, chain });
  const grantedDiscards = pendingCupCardId
    ? 0
    : Math.max(0, perksAfter.extraDiscards - perksBefore.extraDiscards);
  const handsRemaining = state.handsRemaining - 1;

  let next: GameState = {
    ...state,
    hand: remainingHand,
    usedPile: [...state.usedPile, ...scored.submitted],
    handsRemaining,
    discardsRemaining: state.discardsRemaining + grantedDiscards,
    selectedCardIds: [],
    pendingCupCardId,
    pendingCupExtraDiscardsBefore: pendingCupCardId ? perksBefore.extraDiscards : null,
    chain,
    lastScore: scored.breakdown,
    unlockedSecretYakuIds: unlockSecret(state, scored.breakdown.yakuId),
    yard: {
      cards: scored.remainingYard,
      sweptCount: state.yard.sweptCount + Number(scored.swept),
    },
    roundSubmissionIndex: state.roundSubmissionIndex + 1,
    roundHighestHand: Math.max(state.roundHighestHand, scored.breakdown.score),
    roundHighestSubmissionCards: Math.max(state.roundHighestSubmissionCards, scored.submitted.length),
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
      highestSubmissionCards: Math.max(state.stats.highestSubmissionCards, scored.submitted.length),
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

  if (pendingCupCardId) {
    // Glass, cremation, and similar aftermath may remove a cup before the modal
    // can open. Rebuild the queue from cards that still exist in the deck.
    const survivingPendingCupId = nextUnassignedCollectedCupId(next);
    next = { ...next, pendingCupCardId: survivingPendingCupId };
    if (survivingPendingCupId) return next;

    // No choice remains, but the rest of this submission still belongs on the
    // board and may complete score lines or one-shot collection perks.
    next = finalizeDeferredCupCollection(next);
  }
  return resolveSubmittedHandOutcome(next);
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

/**
 * Talismans you already own never come back to the shelf. A duplicate 부적 does
 * nothing you cannot already do, so seeing one is a wasted slot rather than a
 * choice. Books and painters are consumed on purchase, and 금단패 are one-shot
 * contracts, so only this category needs the filter.
 */
function ownedTalismanIds(state: GameState): Set<string> {
  return new Set(state.talismans.map((item) => item.definitionId));
}

function categoryPool(state: GameState, shopType: ShopCategory) {
  if (shopType === "talisman") {
    const owned = ownedTalismanIds(state);
    return TALISMANS.filter((entry) => !owned.has(entry.id));
  }
  return shopType === "painter"
    ? PAINTER_CARDS
    : shopType === "book"
      ? BOOKS
      : FORBIDDEN_CARDS;
}

/**
 * The market is one screen with four fixed departments:
 *   부적전 2장 · 비결서점 2장 · 무작위 손질 꾸러미 3장 · 금단장 1장.
 * 화공패 단품 대신 카드·비결서·부적·소각 꾸러미가 덱 손질방을 채운다.
 * The tutorial round leads with the flat-multiplier charm so the first purchase
 * has an effect a new player can actually read.
 */
const SHOP_DEPARTMENT_SIZES: Record<ShopCategory | "pack", number> = {
  talisman: 2,
  book: 2,
  forbidden: 1,
  // 덱 손질방은 네 종류와 세 크기 가운데 서로 다른 꾸러미 셋을 뽑는다.
  painter: 0,
  pack: 3,
};

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
      const at = Math.floor(randomAt(`${state.seed}:${state.runId}:${salt}:${state.stage}`, cursor++) * remaining.length);
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
    const size = SHOP_DEPARTMENT_SIZES[category]
      + (category === "book" && countContract(state, "book_weight") >= 1 ? 1 : 0);
    if (size <= 0) continue;
    const basePool = categoryPool(state, category);
    const pool = category === "forbidden" && basePool.length > 1
      ? basePool.filter((entry) => entry.id !== state.lastForbiddenOfferId)
      : basePool;
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
  const pool = [...categoryPool(state, shopType)];
  const offers: ShopOffer[] = [];
  for (let index = 0; index < Math.min(3, pool.length); index += 1) {
    const pick = Math.floor(randomAt(`${state.seed}:${state.runId}:shop:${state.stage}:${shopType}`, cursor++) * pool.length);
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
 * may carry a random effect tag. Plain cards are deliberate: a pack full of
 * guaranteed powers removes the decision and inflates the deck too quickly.
 */
function openCardPack(state: GameState, pack: PackDefinition): {
  pendingPack: NonNullable<GameState["pendingPack"]>;
  cursor: number;
} {
  let cursor = state.rngCursor;
  if (pack.category === "burn") {
    const candidates = state.deck
      .filter((card) => !card.disabledForRound)
      .map((card) => ({ ...card, tags: [...card.tags] }));
    return {
      pendingPack: {
        packId: pack.id,
        name: pack.name,
        category: pack.category,
        picksLeft: Math.min(pack.picks, candidates.length),
        candidates,
      },
      cursor,
    };
  }

  const templates = createStandardHwatuDeck();
  const candidates: CardInstance[] = [];
  for (let index = 0; index < pack.choices; index += 1) {
    const templateIndex = Math.floor(randomAt(`${state.seed}:${state.runId}:pack-card:${state.stage}:${pack.id}`, cursor++) * templates.length);
    const template = templates[templateIndex];
    if (!template) continue;
    const effectRoll = randomAt(`${state.seed}:${state.runId}:pack-tag:${state.stage}:${pack.id}`, cursor++);
    const painterGuildLevel = countContract(state, "modified_card_weight");
    const plainChance = painterGuildLevel >= 1 ? 0.1 : pack.id === "pack_hwatu_large" ? 0.2 : 0.3;
    const tag = effectRoll < plainChance
      ? undefined
      : rollCardEffectTagForCard((effectRoll - plainChance) / (1 - plainChance), template);
    const candidate: CardInstance = {
      ...template,
      tags: [...template.tags],
      instanceId: `pack:${state.runId}:${state.stage}:${pack.id}:${index}:${cursor}`,
      effectTagId: tag?.id,
    };
    if (painterGuildLevel >= 2) {
      const finishRoll = randomAt(`${state.seed}:${state.runId}:pack-finish:${state.stage}:${pack.id}`, cursor++);
      const editions = ["gold_leaf", "mother_of_pearl", "five_color"] as const;
      const seals = ["yellow", "red", "blue", "purple"] as const;
      if (finishRoll < 0.3) candidate.edition = editions[Math.floor((finishRoll / 0.3) * editions.length)];
      else if (finishRoll < 0.6) candidate.seal = seals[Math.floor(((finishRoll - 0.3) / 0.3) * seals.length)];
    }
    candidates.push(candidate);
  }
  return {
    pendingPack: { packId: pack.id, name: pack.name, category: pack.category, picksLeft: Math.min(pack.picks, candidates.length), candidates },
    cursor,
  };
}

function openRewardPack(state: GameState, pack: PackDefinition): {
  pendingPack: NonNullable<GameState["pendingPack"]>;
  cursor: number;
} {
  let cursor = state.rngCursor;
  const pool = pack.category === "book"
    ? [...BOOKS]
    : [...categoryPool(state, "talisman")];
  const rewardCandidates: NonNullable<NonNullable<GameState["pendingPack"]>["rewardCandidates"]> = [];

  // 대서고(동네 책방 계약 2회)는 플레이 기록을 실제 비결서 후보로
  // 바꾼다. 기존 구현은 설명만 있었고 묶음 추첨에는 전혀 관여하지
  // 않았기 때문에, 여기서 가장 많이 낸 족보의 책을 첫 칸에 고정한다.
  if (pack.category === "book" && countContract(state, "book_weight") >= 2) {
    const favorite = BOOKS
      .map((book, index) => ({ book, index, count: state.stats.yakusPlayed[book.yakuId] ?? 0 }))
      .filter((entry) => entry.count > 0)
      .sort((a, b) => b.count - a.count || a.index - b.index)[0]?.book;
    if (favorite) {
      const poolIndex = pool.findIndex((entry) => entry.id === favorite.id);
      if (poolIndex >= 0) pool.splice(poolIndex, 1);
      rewardCandidates.push({
        candidateId: `${pack.id}:${state.stage}:favorite:${cursor}`,
        definitionId: favorite.id,
        category: "book",
      });
    }
  }

  for (let index = rewardCandidates.length; index < pack.choices && pool.length > 0; index += 1) {
    const at = Math.floor(randomAt(`${state.seed}:${state.runId}:pack-reward:${state.stage}:${pack.id}`, cursor++) * pool.length);
    const [definition] = pool.splice(at, 1);
    rewardCandidates.push({
      candidateId: `${pack.id}:${state.stage}:${index}:${cursor}`,
      definitionId: definition.id,
      category: pack.category as "book" | "talisman",
    });
  }
  return {
    pendingPack: {
      packId: pack.id,
      name: pack.name,
      category: pack.category,
      picksLeft: Math.min(pack.picks, rewardCandidates.length),
      candidates: [],
      rewardCandidates,
    },
    cursor,
  };
}

function buyOffer(state: GameState, offerId: string): GameState {
  const offer = state.shopOffers.find((entry) => entry.offerId === offerId);
  if (!offer || offer.sold || state.money < offer.price) return state;
  if (offer.category === "pack") {
    const pack = PACK_BY_ID[offer.definitionId];
    if (!pack) return state;
    const opened = pack.category === "book" || pack.category === "talisman"
      ? openRewardPack(state, pack)
      : openCardPack(state, pack);
    return {
      ...state,
      rngCursor: opened.cursor,
      money: state.money - offer.price,
      pendingPack: opened.pendingPack,
      shopOffers: state.shopOffers.map((entry) => entry.offerId === offer.offerId ? { ...entry, sold: true } : entry),
      logs: logEntry(state, "reward", `${pack.name} 개봉`, `후보 ${opened.pendingPack.candidates.length + (opened.pendingPack.rewardCandidates?.length ?? 0)}개 중 ${opened.pendingPack.picksLeft}개를 고르세요.`),
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
  if (offer.category === "forbidden") {
    const forbidden = FORBIDDEN_BY_ID[offer.definitionId] as ForbiddenDefinition | undefined;
    if (!forbidden) return state;
    const additionalCost = forbidden.additionalCost ?? 0;
    if (state.money < offer.price + additionalCost) {
      return {
        ...state,
        logs: logEntry(state, "system", "대가 부족", `구매가 외에 ${additionalCost}냥이 더 필요합니다.`),
      };
    }
    const afterPurchase = { ...state, money: state.money - offer.price };
    if (!canPayForbiddenCost(afterPurchase, forbidden)) {
      return { ...state, logs: logEntry(state, "system", "대가 불가", forbidden.cost) };
    }
    if (
      forbidden.targetKind !== "none"
      && getEligibleForbiddenTargetIds(state, forbidden).length < forbidden.minTargets
    ) {
      return { ...state, logs: logEntry(state, "system", "대상 없음", forbidden.targetPrompt) };
    }
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
  const selectedTargets = forbidden.targetKind === "none" ? [] : state.pendingTargetIds;
  if (
    !canPayForbiddenCost(state, forbidden)
    || !isForbiddenTargetSelectionValid(state, forbidden, selectedTargets)
  ) return state;

  let targets = selectedTargets;
  if (forbidden.effectKey === "random_burn_for_money" && targets.length === 0) {
    targets = [...state.deck]
      .filter((card) => !card.enhancement && !card.edition && !card.seal)
      .sort((left, right) => randomAt(`${state.seed}:burn:${left.instanceId}`, cursor) - randomAt(`${state.seed}:burn:${right.instanceId}`, cursor))
      .slice(0, 5)
      .map((card) => card.instanceId);
    cursor += state.deck.length;
  }
  const result = applyForbiddenEffect(state, forbidden, targets, makeId);
  if (!result.applied) return state;
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
    talismanSlots: result.talismanSlots,
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

function openSeasonContract(state: GameState): GameState {
  let cursor = state.rngCursor;
  const pool = [...CONTRACTS];
  const choices: string[] = [];
  while (choices.length < 2 && pool.length) {
    const index = Math.floor(randomAt(`${state.seed}:contract:${state.stage}`, cursor++) * pool.length);
    choices.push(pool.splice(index, 1)[0].id);
  }
  return { ...state, screen: "contract", contractChoices: choices, rngCursor: cursor };
}

function nextFromShop(state: GameState): GameState {
  if (state.stage % 3 === 0) return openSeasonContract(state);
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
      return { ...action.state, hand: sortHand(action.state.hand) };
    case "SET_SEED":
      return state.screen === "title" || state.screen === "deck_select" ? { ...state, seed: action.seed.slice(0, 40) } : state;
    case "OPEN_DECK_SELECT":
      return { ...state, screen: "deck_select" };
    case "START_RUN":
      return startRun(state, action.startDeckId, action.tutorialMode, action.entropy);
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
    case "ASSIGN_CUP_ROLE": {
      if (state.pendingCupCardId !== action.cardId) return state;
      const card = state.deck.find((entry) => entry.instanceId === action.cardId);
      const cupAssignments = { ...state.cupAssignments, [action.cardId]: action.role };
      let assigned: GameState = {
        ...state,
        cupAssignments,
        logs: logEntry(
          state,
          "system",
          "술잔 기록",
          `${card?.name ?? "9월 술잔"} → ${action.role === "animal" ? "동물 1장" : "피 2점"}`,
        ),
      };
      const nextCupCardId = nextUnassignedCollectedCupId(assigned, cupAssignments);
      if (nextCupCardId) {
        return { ...assigned, pendingCupCardId: nextCupCardId };
      }

      assigned = finalizeDeferredCupCollection(assigned);
      return resolveSubmittedHandOutcome(assigned);
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
      if (state.stage === 12 && state.infiniteLap === 0) return openSeasonContract(state);
      const generated = generateShopOffers(state);
      const baseReroll = Math.max(0, 2 - Math.min(1, countContract(state, "reroll_cost")));
      const firstFree = state.talismans.some((item) => item.definitionId === "t_market_rumor");
      return {
        ...state,
        screen: "shop",
        shopType: null,
        shopOffers: generated.offers,
        lastForbiddenOfferId: generated.offers.find((offer) => offer.category === "forbidden")?.definitionId
          ?? state.lastForbiddenOfferId,
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
      return {
        ...state,
        money: state.money - state.rerollCost,
        rngCursor: generated.cursor,
        shopOffers: generated.offers,
        lastForbiddenOfferId: generated.offers.find((offer) => offer.category === "forbidden")?.definitionId
          ?? state.lastForbiddenOfferId,
        rerollCost: nextCost,
      };
    }
    case "CONFIRM_PACK_SELECTION": {
      const pack = state.pendingPack;
      if (!pack || pack.picksLeft <= 0) return state;
      const selectedIds = [...new Set(action.candidateIds)];
      const selectedCards = pack.candidates.filter((card) => selectedIds.includes(card.instanceId));
      const selectedRewards = (pack.rewardCandidates ?? []).filter((candidate) => selectedIds.includes(candidate.candidateId));
      const selectedCount = selectedCards.length + selectedRewards.length;
      if (selectedCount === 0 || selectedCount !== selectedIds.length || selectedCount > pack.picksLeft) return state;
      if (pack.category === "burn" && selectedCount !== pack.picksLeft) return state;

      const selectedTalismanRewards = selectedRewards.filter((candidate) => candidate.category === "talisman");
      if (state.talismans.length + selectedTalismanRewards.length > getEffectiveTalismanSlots(state)) return state;

      const selectedCardIds = new Set(selectedCards.map((card) => card.instanceId));
      const burn = pack.category === "burn";
      let yakuLevels = { ...state.yakuLevels };
      const talismans = [...state.talismans];
      let lastConsumableId = state.lastConsumableId;
      const rewardNames: string[] = [];

      for (const candidate of selectedRewards) {
        if (candidate.category === "book") {
          const book = BOOK_BY_ID[candidate.definitionId];
          if (!book) return state;
          const current = yakuLevels[book.yakuId] ?? { level: 1, mastery: 0 };
          yakuLevels = { ...yakuLevels, [book.yakuId]: { ...current, level: current.level + 1 } };
          lastConsumableId = book.id;
          rewardNames.push(book.name);
        } else {
          const definition = TALISMAN_BY_ID[candidate.definitionId];
          if (!definition) return state;
          talismans.push({ instanceId: `${candidate.candidateId}:owned`, definitionId: definition.id, growth: 0 });
          rewardNames.push(definition.name);
        }
      }

      const cardNames = selectedCards.map((card) => `${card.month}월 ${card.name}`);
      const names = [...cardNames, ...rewardNames];
      return {
        ...state,
        deck: burn
          ? state.deck.filter((card) => !selectedCardIds.has(card.instanceId))
          : [...state.deck, ...selectedCards],
        yakuLevels,
        talismans,
        lastConsumableId,
        pendingPack: null,
        logs: logEntry(
          state,
          "reward",
          burn ? `${selectedCount}장 소각 확정` : `${selectedCount}개 획득 확정`,
          names.join(" · "),
        ),
      };
    }
    case "CLOSE_PACK":
      return { ...state, pendingPack: null };
    case "SELECT_CONSUMABLE_TARGET": {
      const exists = state.pendingTargetIds.includes(action.cardId);
      const forbidden = state.pendingConsumableId
        ? FORBIDDEN_BY_ID[state.pendingConsumableId]
        : undefined;
      if (forbidden) {
        if (forbidden.targetKind === "none") {
          return state.pendingTargetIds.length > 0 ? { ...state, pendingTargetIds: [] } : state;
        }
        if (!isForbiddenTargetEligible(state, forbidden, action.cardId)) return state;
        if (exists) {
          return { ...state, pendingTargetIds: state.pendingTargetIds.filter((id) => id !== action.cardId) };
        }
        if (forbidden.maxTargets === 1) return { ...state, pendingTargetIds: [action.cardId] };
        if (state.pendingTargetIds.length >= forbidden.maxTargets) return state;
        return { ...state, pendingTargetIds: [...state.pendingTargetIds, action.cardId] };
      }

      const painter = state.pendingConsumableId
        ? PAINTER_BY_ID[state.pendingConsumableId]
        : undefined;
      if (!painter || painter.maxTargets === 0) return state;
      if (exists) {
        return { ...state, pendingTargetIds: state.pendingTargetIds.filter((id) => id !== action.cardId) };
      }
      if (painter.maxTargets === 1) return { ...state, pendingTargetIds: [action.cardId] };
      if (state.pendingTargetIds.length >= painter.maxTargets) return state;
      return { ...state, pendingTargetIds: [...state.pendingTargetIds, action.cardId] };
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
    case "MOVE_TALISMAN_TO": {
      const from = state.talismans.findIndex((entry) => entry.instanceId === action.instanceId);
      const to = state.talismans.findIndex((entry) => entry.instanceId === action.targetInstanceId);
      if (from < 0 || to < 0 || from === to) return state;
      const talismans = [...state.talismans];
      const [moved] = talismans.splice(from, 1);
      talismans.splice(to, 0, moved);
      return { ...state, talismans };
    }
    case "CHOOSE_CONTRACT": {
      if (!state.contractChoices.includes(action.contractId)) return state;
      const contracts = [...state.contracts, action.contractId];
      const definition = CONTRACTS.find((entry) => entry.id === action.contractId);
      if (state.stage === 12 && state.infiniteLap === 0) {
        return { ...state, contracts, screen: "run_win", contractChoices: [], shopOffers: [], shopType: null };
      }
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

export function getDefinitionForOffer(offer: ShopOffer) {
  if (offer.category === "talisman") return TALISMAN_BY_ID[offer.definitionId] ?? null;
  if (offer.category === "painter") return PAINTER_BY_ID[offer.definitionId] ?? null;
  if (offer.category === "book") return BOOK_BY_ID[offer.definitionId] ?? null;
  if (offer.category === "forbidden") return FORBIDDEN_BY_ID[offer.definitionId] ?? null;
  return PACK_BY_ID[offer.definitionId] ?? null;
}

export function getPendingConsumableDefinition(state: GameState): PainterDefinition | ForbiddenDefinition | null {
  if (!state.pendingConsumableId) return null;
  const painter = PAINTER_BY_ID[state.pendingConsumableId] as PainterDefinition | undefined;
  const forbidden = FORBIDDEN_BY_ID[state.pendingConsumableId] as ForbiddenDefinition | undefined;
  return painter ?? forbidden ?? null;
}
