"use client";

import { useCallback, useEffect, useMemo, useReducer, useState } from "react";

import { BOSS_BY_ID } from "@/game/content/bosses";
import { CONTRACTS, START_DECKS, WEATHER_BY_ID } from "@/game/content/meta";
import { getStageDefinition } from "@/game/content/stages";
import { getTalismanTimingText, TALISMAN_BY_ID } from "@/game/content/talismans";
import { BOOK_BY_ID, FORBIDDEN_BY_ID } from "@/game/content/upgrades";
import { ALL_IMMEDIATE_YAKU_DEFINITIONS, getYakuAssetTag, getYakuDisplayName } from "@/game/content/yaku";
import {
  playCardRevealSound,
  playShopPurchaseSound,
  playShopRerollSound,
  playShopSaleSound,
  primeGameAudio,
} from "./audio/game-sfx";
import {
  calculateCollectionBonus,
  calculateCupRolePreview,
  GODORI_MONTHS,
} from "@/game/engine/collection-bonus";
import {
  buildCollectionSlots,
  COLLECTION_TRACK_ORDER,
  getCollectionLandingTargets,
  type CollectionTrack,
  type CupRoleLookup,
} from "@/game/engine/collection-board";
import { getBookLevelPreview } from "@/game/engine/book-preview";
import {
  canPayForbiddenCost,
  getEligibleForbiddenTargetIds,
  isForbiddenTargetSelectionValid,
} from "@/game/engine/consumables";
import { getBossDiscardMoneyCost } from "@/game/engine/boss";
import { canDeclareGo, getGoRewardFactor } from "@/game/engine/go";
import { findImmediateYakuCandidates } from "@/game/engine/yaku";
import {
  createInitialGameState,
  evaluateSelectedHand,
  gameReducer,
  getRoundRequirement,
  getEffectiveCupRoles,
  getNextGoRequirement,
  mustDeclareGo,
  getDefinitionForOffer,
  getEffectiveTalismanSlots,
  getPendingConsumableDefinition,
  isUndiscardable,
  sortHand,
} from "@/game/state/game";
import { clearSavedGame } from "@/game/state/storage";
import { getRunIdentityTags } from "@/game/state/run-identity";
import type {
  CardInstance,
  ForbiddenDefinition,
  GameState,
  Rarity,
} from "@/game/types";

import { AssetPlaceholder } from "./components/AssetPlaceholder";
import { BossSeasonOverlay, getBossSeasonForMonth } from "./components/BossSeasonOverlay";
import { CollectionBoard, type CollectionBoardItem } from "./components/CollectionBoard";
import {
  DiscardTheater,
  SubmissionTheater,
  getInlineHandPresentation,
  submissionBeatToReveal,
  type TalismanGrowthEvent,
} from "./components/CardActionTheater";
import { GameModal } from "./components/GameModal";
import { CupChoiceModal } from "./components/CupChoiceModal";
import { GameRulesModal } from "./components/GameRulesModal";
import {
  ForbiddenRitualTheater,
} from "./components/ForbiddenRitualTheater";
import { getGeneratedAssetUrl } from "./components/generated-asset";
import { HwatuCard } from "./components/HwatuCard";
import { MarketScreen, OwnedTalismanBar } from "./components/MarketScreen";
import { PlayRail } from "./components/PlayRail";
import { PackPickModal } from "./components/PackPickModal";
import { RunEndScreen } from "./components/RunEndScreen";
import { TalismanStrip } from "./components/TalismanStrip";
import { TitleScreen } from "./components/TitleScreen";
import { TutorialSpotlight } from "./components/TutorialSpotlight";
import { TUTORIAL_STEPS } from "./components/tutorial-steps";
import { useGameAudioScene } from "./hooks/useGameAudioScene";
import { useCardPresentation } from "./hooks/useCardPresentation";
import { useForbiddenPresentation } from "./hooks/useForbiddenPresentation";
import { useGamePersistence } from "./hooks/useGamePersistence";
import {
  selectScoreRailBreakdown,
  selectScoreRevealBreakdown,
  useScoreReveal,
} from "./components/useScoreReveal";
import "./game.css";
import "./components/deck-editor.css";
import "./components/art-direction.css";
import "./components/pixel-direction.css";

const MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;

function getForbiddenUnavailableReason(
  state: GameState,
  definition: ForbiddenDefinition,
): string | undefined {
  const costCheckState = {
    ...state,
    money: definition.additionalCost ?? 0,
  };
  if (!canPayForbiddenCost(costCheckState, definition)) {
    if (
      definition.effectKey === "double_duplicate_hand_penalty"
      || definition.effectKey === "engrave_talisman_hand_penalty"
    ) {
      return "손패가 이미 최소 5장이라 대가를 치를 수 없음";
    }
    return "현재 상태에서는 의식의 대가를 치를 수 없음";
  }

  if (
    definition.targetKind !== "none"
    && getEligibleForbiddenTargetIds(state, definition).length < definition.minTargets
  ) {
    if (definition.effectKey === "make_bright_pay") return "광으로 올릴 비광 패가 없음";
    if (definition.effectKey === "engrave_talisman_hand_penalty") return "음각을 새길 부적이 없음";
    if (definition.effectKey === "sacrifice_copy") return "왼쪽 제물을 남길 수 있는 부적이 없음";
    return "의식에 쓸 수 있는 대상이 부족함";
  }

  return undefined;
}

const DECK_UNLOCK_STORAGE_KEY = "flower-board-go:start-decks:v1";

function startDeckUnlocksForStage(stage: number): string[] {
  return START_DECKS.filter((deck) => deck.unlockStage <= stage).map((deck) => deck.id);
}
interface MarketBanner {
  assetTag: string;
  title: string;
  subtitle?: string;
  tone?: "shop" | "reward" | "contract";
}

const NUMBER_FORMATTER = new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 2 });

function format(value: number): string {
  return NUMBER_FORMATTER.format(value);
}

const RARITY_LABELS: Record<Rarity, string> = {
  common: "흔함",
  uncommon: "드묾",
  rare: "매우 희귀",
  legendary: "전설",
};

function getOfferRarityLabel(definition: ReturnType<typeof getDefinitionForOffer>): string | undefined {
  if (!definition || !("rarity" in definition)) return undefined;
  return `등장 빈도 · ${RARITY_LABELS[definition.rarity as Rarity]}`;
}

function cardMap(state: GameState): Map<string, CardInstance> {
  return new Map(state.deck.map((card) => [card.instanceId, card]));
}

function cardsFor(state: GameState, ids: readonly string[]): CardInstance[] {
  const map = cardMap(state);
  return ids.flatMap((id) => {
    const card = map.get(id);
    return card ? [card] : [];
  });
}

type CollectionCardIdsByTrack = Partial<Record<CollectionTrack, readonly string[]>>;

export function getVisibleCollectionCardIdsByTrack(
  collectionCardIdsBefore: readonly string[],
  collectionCards: readonly CardInstance[],
  cupRoles: CupRoleLookup,
  landedTargets: ReadonlySet<string>,
): Record<CollectionTrack, string[]> {
  const visible = Object.fromEntries(
    COLLECTION_TRACK_ORDER.map((track) => [track, new Set(collectionCardIdsBefore)]),
  ) as Record<CollectionTrack, Set<string>>;

  for (const card of collectionCards) {
    for (const target of getCollectionLandingTargets(card, cupRoles)) {
      if (landedTargets.has(`${target.track}:${card.instanceId}`)) {
        visible[target.track].add(card.instanceId);
      }
    }
  }

  return Object.fromEntries(
    COLLECTION_TRACK_ORDER.map((track) => [track, [...visible[track]]]),
  ) as Record<CollectionTrack, string[]>;
}

function collectionResultForTrack(
  state: GameState,
  track: CollectionTrack,
  confirmedCardIdsByTrack?: CollectionCardIdsByTrack,
) {
  const ids = confirmedCardIdsByTrack?.[track] ?? state.chain.collection.cardIds;
  return calculateCollectionBonus(cardsFor(state, ids), getEffectiveCupRoles(state), state.yakuLevels);
}

function collectionItems(
  state: GameState,
  confirmedCardIdsByTrack?: CollectionCardIdsByTrack,
): CollectionBoardItem[] {
  const results = {
    bright: collectionResultForTrack(state, "bright", confirmedCardIdsByTrack),
    animal: collectionResultForTrack(state, "animal", confirmedCardIdsByTrack),
    godori: collectionResultForTrack(state, "godori", confirmedCardIdsByTrack),
    ribbon: collectionResultForTrack(state, "ribbon", confirmedCardIdsByTrack),
    chaff: collectionResultForTrack(state, "chaff", confirmedCardIdsByTrack),
  };
  const yakuLevel = (id: string) => Math.max(1, state.yakuLevels[id]?.level ?? 1);
  const upgraded = (id: string) => yakuLevel(id) > 1;

  // Picture rows come from the deck, so burning a card removes its slot and a
  // joker that turns 8월 into a 광 adds one.
  const slotsFor = (
    track: "bright" | "animal" | "godori" | "ribbon" | "chaff",
    collectedOnly = false,
  ) => buildCollectionSlots({
    deck: state.deck,
    confirmedCardIds: confirmedCardIdsByTrack?.[track] ?? state.chain.collection.cardIds,
    pendingCardIds: [],
    track,
    cupRoles: getEffectiveCupRoles(state),
    collectedOnly,
  });

  return [
    {
      id: "bright",
      name: "광",
      kind: "bright",
      assetTag: "collection:bright-five-slots",
      iconUrl: "/assets/cards/hwatu/card-08-bright-moon.webp",
      description: `삼광 ${2 + yakuLevel("three_brights")}점 · 비삼광 ${1 + yakuLevel("rain_three_brights")}점 · 사광 ${3 + yakuLevel("four_brights")}점 · 오광 ${14 + yakuLevel("five_brights")}점 · 육광 ${21 + yakuLevel("six_brights")}점${["rain_three_brights", "three_brights", "four_brights", "five_brights", "six_brights"].some(upgraded) ? " · 광 비결 1레벨마다 고 문턱 -5%" : ""}`,
      cards: slotsFor("bright"),
      confirmedCount: results.bright.counts.bright,
      milestones: [
        { at: 3, label: "삼광", reward: "3점 · 비광 포함 2점" },
        { at: 4, label: "사광", reward: "4점" },
        { at: 5, label: "오광", reward: "15점" },
        { at: 6, label: "육광", reward: "22점 · 이후 광당 +4" },
      ],
    },
    {
      id: "animal",
      name: "동물",
      kind: "animal",
      assetTag: "collection:animal-track",
      iconUrl: "/assets/cards/hwatu/card-10-animal-deer.webp",
      description: "5장부터 1점 · 이후 장당 +1점",
      cards: slotsFor("animal"),
      confirmedCount: results.animal.counts.animal,
      slotCount: 10,
      milestones: [
        { at: 5, label: "5장", reward: "1점" },
        { at: 6, label: "추가", reward: "장당 +1점" },
      ],
    },
    {
      id: "godori",
      name: "고도리",
      kind: "godori",
      assetTag: "collection:godori-track",
      iconUrl: "/assets/cards/hwatu/card-08-animal-bird.webp",
      description: `고도리 ${4 + yakuLevel("godori")}점 · 새떼 ${7 + yakuLevel("four_godori")}점 · 큰 새떼 ${11 + yakuLevel("five_godori")}점${upgraded("godori") ? " · 현재 짓 5배수 허용" : " · 비결 2레벨에 짓 5배수 허용"}`,
      cards: slotsFor("godori"),
      confirmedCount: results.godori.counts.godori,
      slotLabels: GODORI_MONTHS.map((month) => `${month}월`),
      milestones: [
        { at: 3, label: "세 마리", reward: upgraded("godori") ? "+5점 · 짓 5배수" : "+5점", active: results.godori.completedSets.godori },
        { at: 4, label: "새떼", reward: "8점", active: results.godori.completedSets.godori && results.godori.counts.godori >= 4 },
        { at: 5, label: "큰 새떼", reward: "12점 · 이후 새당 +3", active: results.godori.completedSets.godori && results.godori.counts.godori >= 5 },
      ],
    },
    {
      id: "ribbon",
      name: "띠",
      kind: "ribbon",
      assetTag: "collection:ribbon-track",
      iconUrl: "/assets/cards/hwatu/card-03-ribbon-hong.webp",
      description: "5장부터 1점 · 단마다 +3점",
      cards: slotsFor("ribbon"),
      confirmedCount: results.ribbon.counts.ribbon,
      slotCount: 10,
      milestones: [
        { at: 3, label: "홍단", reward: upgraded("hongdan") ? "+3점 · 버리기 +1" : "+3점", active: results.ribbon.completedSets.hongdan },
        { at: 3, label: "초단", reward: upgraded("chodan") ? "+3점 · 버리기 +1" : "+3점", active: results.ribbon.completedSets.chodan },
        { at: 3, label: "청단", reward: upgraded("cheongdan") ? "+3점 · 버리기 +1" : "+3점", active: results.ribbon.completedSets.cheongdan },
        { at: 5, label: "5장", reward: "1점 · 이후 장당 +1" },
      ],
    },
    {
      id: "chaff",
      name: "피",
      kind: "chaff",
      assetTag: "collection:chaff-ten-slots",
      iconUrl: "/assets/cards/hwatu/card-01-chaff-a.webp",
      // 피는 덱에 24장이라 후보를 전부 깔면 판이 파묻힌다. 어차피 어떤 피든
      // 값이 같으니 체크리스트가 될 이유도 없다. 그래서 여기만 "가져온 것"만
      // 그리는 집계 줄이고, 쌍피는 값 배지로 두 칸어치임을 밝힌다.
      cards: slotsFor("chaff", true),
      description: "10피부터 1점 · 쌍피는 2피",
      confirmedCount: results.chaff.counts.chaff,
      milestones: [
        { at: 10, label: "10피", reward: "1점 · 이후 피점당 +1" },
      ],
    },
  ];
}

const COLLECTION_SCORE_LINE_IDS: Record<CollectionTrack, ReadonlySet<string>> = {
  bright: new Set(["rain_three_brights", "three_brights", "four_brights", "five_brights", "six_brights"]),
  animal: new Set(["animal"]),
  godori: new Set(["godori", "four_godori", "five_godori"]),
  ribbon: new Set(["ribbon", "hongdan", "chodan", "cheongdan"]),
  chaff: new Set(["chaff"]),
};

function visibleCollectionGoStopPoints(
  state: GameState,
  confirmedCardIdsByTrack?: CollectionCardIdsByTrack,
): number {
  if (!confirmedCardIdsByTrack) return state.chain.collectionScore / 20;
  return COLLECTION_TRACK_ORDER.reduce((total, track) => {
    const result = collectionResultForTrack(state, track, confirmedCardIdsByTrack);
    return total + result.scoreLines
      .filter((line) => COLLECTION_SCORE_LINE_IDS[track].has(line.id))
      .reduce((sum, line) => sum + line.points, 0);
  }, 0);
}

function cardEditorOption(definition: ReturnType<typeof getPendingConsumableDefinition>): {
  label: string;
  values: Array<{ value: string; label: string }>;
} | null {
  if (!definition || !("effectKey" in definition)) return null;
  switch (definition.effectKey) {
    case "promote_kind":
    case "ribbon_dye":
      return { label: "띠 색", values: [{ value: "hong", label: "홍단" }, { value: "cho", label: "초단" }, { value: "cheong", label: "청단" }] };
    case "bird_mark":
      return { label: "새의 월", values: [{ value: "2", label: "2월" }, { value: "4", label: "4월" }, { value: "8", label: "8월" }] };
    case "apply_seal":
      return { label: "낙관", values: ["yellow", "red", "blue", "purple"].map((value) => ({ value, label: value })) };
    default:
      return null;
  }
}

function IntroScreen({ state, onStart, onDeck, onRules }: {
  state: GameState;
  onStart: () => void;
  onDeck: () => void;
  onRules: () => void;
}) {
  const stage = getStageDefinition(state.stage, state.infiniteLap);
  const introTarget = Math.ceil(stage.target * state.targetMultiplier);
  const boss = stage.bossId ? BOSS_BY_ID[stage.bossId] : null;
  const bossArtUrl = boss ? getGeneratedAssetUrl(boss.assetTag) : null;
  const weather = WEATHER_BY_ID[state.experimentalRules.weather ? stage.weatherId : "clear"];
  useEffect(() => {
    const timers = [0, 1].map((index) => window.setTimeout(() => playCardRevealSound(index + 1), 360 + index * 260));
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [stage.stage]);
  return (
    <main
      className={`intro-screen intro-screen--ritual${boss ? " intro-screen--boss" : ""}`}
      data-month={stage.month}
      data-boss-id={boss?.id}
    >
      <div className="intro-screen__stage-curtain" aria-hidden="true">
        <i />
        <i />
        <i />
      </div>
      <header className="intro-screen__heading" data-asset-tag={stage.assetTag}>
        <div className="intro-screen__month" aria-hidden="true">
          <strong>{String(stage.month).padStart(2, "0")}</strong>
          <span>月</span>
        </div>
        <div className="intro-screen__copy">
          <p className="eyebrow">열두 달 중 {stage.month}월</p>
          <span>{boss ? "두목 규칙이 붙는 판" : "기본 규칙으로 치르는 판"}</span>
          <h1>{stage.name}</h1>
          <p>{stage.subtitle}</p>
        </div>
        <div className="intro-screen__target">
          <span>이번 판 목표</span>
          <strong>{format(introTarget)}</strong>
          <small>점</small>
        </div>
      </header>
      {boss ? (
        <section className="intro-screen__boss-encounter" aria-label={`우두머리 ${boss.name} 등장`}>
          <div
            className="intro-screen__boss-art"
            role="img"
            aria-label={`${boss.name} 우두머리`}
            style={bossArtUrl ? { "--boss-portrait": `url("${bossArtUrl}")` } as React.CSSProperties : undefined}
          >
            <span aria-hidden="true">우두머리 출현</span>
          </div>
          <div className="intro-screen__boss-copy">
            <p>이번 판을 막아선 자</p>
            <h2>{boss.name}</h2>
            <strong>{boss.description}</strong>
            <div className="intro-screen__boss-rules">
              <article>
                <em>날씨</em>
                <b>{weather.name}</b>
                <span>{weather.description}</span>
              </article>
              <article>
                <em>승부의 실마리</em>
                <b>{boss.counterplay}</b>
              </article>
            </div>
          </div>
        </section>
      ) : null}
      {!boss ? (
        <div className="intro-screen__rules">
          <h2><span>이번 판의 규칙</span><small>패를 돌리기 전에 두 규칙을 확인하세요</small></h2>
          <article className="intro-screen__rule intro-screen__rule--weather" data-asset-tag={weather.assetTag}>
            <span className="intro-screen__rule-mark" aria-hidden="true">天</span>
            <div><em>첫째 규칙</em><strong>날씨 · {weather.name}</strong><small>{weather.description}</small></div>
          </article>
          <article className="intro-screen__rule intro-screen__rule--plain" data-asset-tag="boss:none">
            <span className="intro-screen__rule-mark" aria-hidden="true">將</span>
            <div><em>둘째 규칙</em><strong>일반 판</strong><small>이번 달에는 우두머리 규칙이 없습니다.</small><b>별도의 방해 없이 기본 규칙으로 진행됩니다.</b></div>
          </article>
        </div>
      ) : null}
      {state.calendarStamps.length ? (
        <div className="calendar-strip" aria-label="완료한 달력 도장">
          {state.calendarStamps.map((stamp) => <code key={`${stamp.stage}-${stamp.yakuId}`}>{stamp.month}월 · {getYakuDisplayName(stamp.yakuId)}</code>)}
        </div>
      ) : null}
      <div className="intro-screen__actions">
        <button className="primary-action" type="button" onClick={onStart}>패 돌리기</button>
        <button type="button" onClick={onDeck}>덱 확인</button>
        <button type="button" onClick={onRules}>족보와 규칙</button>
      </div>
    </main>
  );
}
function DeckEditor({ state, dispatch, onApplyConsumable }: {
  state: GameState;
  dispatch: React.Dispatch<import("@/game/state/actions").GameAction>;
  onApplyConsumable: (option?: string) => void;
}) {
  const definition = getPendingConsumableDefinition(state);
  const optionConfig = cardEditorOption(definition);
  const [option, setOption] = useState(optionConfig?.values[0]?.value ?? "");
  const forbidden = definition && "benefit" in definition ? definition : null;
  const isPainter = Boolean(definition && !forbidden);
  const targetKind = forbidden?.targetKind ?? (definition ? "card" : "none");
  const minTargets = definition?.minTargets ?? 0;
  const maxTargets = definition?.maxTargets ?? 0;
  const eligibleTargetIds = new Set(forbidden
    ? getEligibleForbiddenTargetIds(state, forbidden)
    : state.deck.map((card) => card.instanceId));
  const canApply = Boolean(definition) && (forbidden
    ? isForbiddenTargetSelectionValid(state, forbidden, state.pendingTargetIds)
      && canPayForbiddenCost(state, forbidden)
    : state.pendingTargetIds.length >= minTargets && state.pendingTargetIds.length <= maxTargets);
  const singleTargetCard = targetKind === "card" && maxTargets === 1
    ? state.deck.find((card) => card.instanceId === state.pendingTargetIds[0]) ?? null
    : null;
  const sacrificeTargetCard = forbidden?.effectKey === "all_to_january"
    ? state.deck.find((card) => card.instanceId === state.pendingTargetIds.at(-1)) ?? null
    : null;
  const singleTargetOutcome = forbidden?.effectKey === "double_duplicate_hand_penalty"
    ? "같은 패 2장 추가 · 손패 크기 -1"
    : forbidden?.effectKey === "make_bright_pay"
      ? "패의 그림은 유지 · 종류만 광으로 승격"
      : forbidden?.effectKey === "wild_month_zero_base"
        ? "모든 종류에 연결 · 적힌 월값은 짓에 그대로 적용"
        : forbidden?.effectKey === "engrave_talisman_hand_penalty"
          ? "고른 부적 보유 중 부적 칸 +1 · 기본 손패 크기 영구 -1"
        : null;
  const talismanItems = state.talismans.flatMap((instance) => {
    const talisman = TALISMAN_BY_ID[instance.definitionId];
    return talisman ? [{
      instance,
      definition: talisman,
      disabled: !eligibleTargetIds.has(instance.instanceId),
      contributionLabel: !eligibleTargetIds.has(instance.instanceId) && forbidden?.effectKey === "sacrifice_copy"
        ? "전승 불가 · 중첩되지 않거나 제물·부적 칸 조건을 충족하지 못함"
        : undefined,
    }] : [];
  });
  const inheritanceTargetIndex = forbidden?.effectKey === "sacrifice_copy"
    ? state.talismans.findIndex((item) => item.instanceId === state.pendingTargetIds[0])
    : -1;
  const inheritanceTarget = inheritanceTargetIndex >= 0 ? state.talismans[inheritanceTargetIndex] : null;
  const inheritanceSacrifice = inheritanceTargetIndex > 0 ? state.talismans[inheritanceTargetIndex - 1] : null;
  const inheritanceTargetDefinition = inheritanceTarget ? TALISMAN_BY_ID[inheritanceTarget.definitionId] : null;
  const inheritanceSacrificeDefinition = inheritanceSacrifice ? TALISMAN_BY_ID[inheritanceSacrifice.definitionId] : null;
  const targetUnit = targetKind === "talisman" ? "개" : "장";
  const selectionStatus = targetKind === "none"
    ? "대상 선택 없음 · 대가 확인 후 즉시 발동"
    : minTargets === maxTargets
      ? `${state.pendingTargetIds.length}/${maxTargets}${targetUnit} 선택 · 정확히 ${maxTargets}${targetUnit} 필요`
      : `${state.pendingTargetIds.length}/${maxTargets}${targetUnit} 선택 · 최소 ${minTargets}${targetUnit}`;
  const applyLabel = forbidden
    ? forbidden.additionalCost
      ? `${forbidden.additionalCost}냥 바치고 의식 집행`
      : "금단 의식 집행"
    : "영구 적용";
  const showingDrawPile = !definition && state.returnScreen === "play";
  const visibleCards = showingDrawPile ? state.drawPile : state.deck;

  return (
    <main className="deck-editor-screen">
      <header>
        <div>
          <p className="eyebrow">{showingDrawPile ? "남은 뽑기패" : "전체 보유 덱"} · {visibleCards.length}장</p>
          <h1>{definition ? definition.name : showingDrawPile ? "이번 판에 남은 덱" : "내 화투 덱"}</h1>
          <p>{definition?.description ?? (showingDrawPile
            ? "손에 들었거나 이미 사용한 패는 빼고, 앞으로 뽑힐 패만 보여줍니다."
            : "현재 보유한 전체 덱입니다. 카드에 손을 올리면 종류와 강화가 보입니다.")}</p>
        </div>
        <AssetPlaceholder
          assetTag={definition?.assetTag ?? "ui:deck-editor"}
          label={definition?.name ?? "열두 달 패목록"}
          description={forbidden?.targetPrompt ?? (definition ? `${minTargets}~${maxTargets}장 선택` : "월별로 덱의 구성과 강화 상태를 확인합니다")}
          tone={definition && !isPainter ? "boss" : "card"}
        />
      </header>
      {forbidden ? (
        <section className="ritual-terms" aria-label={`${forbidden.name} 효과와 대가`}>
          <article className="ritual-terms__benefit">
            <span>얻는 힘</span>
            <strong>{forbidden.benefit}</strong>
          </article>
          <article className="ritual-terms__cost">
            <span>치를 대가</span>
            <strong>{forbidden.cost}</strong>
          </article>
          <p><b>의식 순서</b><span>{forbidden.targetPrompt}</span></p>
        </section>
      ) : null}
      {optionConfig ? (
        <label className="editor-option">
          <span>{optionConfig.label}</span>
          <select value={option} onChange={(event) => setOption(event.target.value)}>
            {optionConfig.values.map((entry) => <option value={entry.value} key={entry.value}>{entry.label}</option>)}
          </select>
        </label>
      ) : null}
      {targetKind === "talisman" && forbidden ? (
        <section className="ritual-talisman-targets">
          <header><span>부적 제단</span><strong>{forbidden.targetPrompt}</strong></header>
          <TalismanStrip
            assetTag={`ui:ritual:${forbidden.id}`}
            items={talismanItems}
            slots={getEffectiveTalismanSlots(state)}
            selectedInstanceId={state.pendingTargetIds[0] ?? null}
            sacrificeInstanceId={inheritanceSacrifice?.instanceId ?? null}
            onSelect={(item) => dispatch({ type: "SELECT_CONSUMABLE_TARGET", cardId: item.instance.instanceId })}
          />
        </section>
      ) : targetKind === "none" && forbidden ? (
        <section className="ritual-auto-confirm" aria-label="자동 대상 금단 의식">
          <span aria-hidden="true">禁</span>
          <div><strong>고를 것은 없습니다</strong><p>{forbidden.targetPrompt}</p><small>효과와 대가를 다시 읽고 아래에서 집행하세요.</small></div>
        </section>
      ) : (
        /* One row per month, in calendar order. Burned cards vanish and bought
           copies show up twice, so this is also the permanent deck codex. */
        <div className="deck-months">
          {MONTHS.map((month) => {
            const cards = sortHand(visibleCards.filter((card) => card.month === month));
            if (cards.length === 0) return null;
            return (
              <section className="deck-month" key={month}>
                <h2>{month}월<span>{cards.length}장</span></h2>
                <div className="deck-month__cards">
                  {cards.map((card) => {
                    const selected = state.pendingTargetIds.includes(card.instanceId);
                    const eligible = !definition || eligibleTargetIds.has(card.instanceId);
                    const isSacrifice = sacrificeTargetCard?.instanceId === card.instanceId;
                    return (
                      <HwatuCard
                        dense
                        key={card.instanceId}
                        card={card}
                        selected={selected}
                        disabled={!eligible}
                        className={`deck-card${isSacrifice ? " deck-card--sacrifice" : ""}`}
                        ariaLabel={isSacrifice
                          ? `${card.month}월 ${card.name}, 마지막 선택 제물, 영구 소각 예정`
                          : undefined}
                        onSelect={definition && eligible
                          ? () => dispatch({ type: "SELECT_CONSUMABLE_TARGET", cardId: card.instanceId })
                          : undefined}
                      />
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}
      {sacrificeTargetCard ? (
        <aside className="ritual-selection-preview ritual-selection-preview--sacrifice" aria-live="polite">
          <HwatuCard dense card={sacrificeTargetCard} selected className="ritual-selection-preview__card" />
          <div>
            <span>마지막 선택 · 영구 소각</span>
            <strong>{sacrificeTargetCard.month}월 {sacrificeTargetCard.name}</strong>
            <em>이 패는 사라지고, 나머지 선택 패만 1월로 바뀝니다.</em>
          </div>
        </aside>
      ) : singleTargetCard && singleTargetOutcome ? (
        <aside className="ritual-selection-preview" aria-live="polite">
          <HwatuCard dense card={singleTargetCard} selected className="ritual-selection-preview__card" />
          <div><span>선택한 패</span><strong>{singleTargetCard.month}월 {singleTargetCard.name}</strong><em>{singleTargetOutcome}</em></div>
        </aside>
      ) : null}
      {inheritanceTargetDefinition && inheritanceSacrificeDefinition ? (
        <aside className="ritual-inheritance-preview" aria-live="polite">
          <div>
            <span>영구 파괴 · 왼쪽 제물</span>
            <strong>{inheritanceSacrificeDefinition.name}</strong>
          </div>
          <b aria-hidden="true">→</b>
          <div>
            <span>남는 힘 · 선택 부적 복제</span>
            <strong>{inheritanceTargetDefinition.name} ×2</strong>
          </div>
        </aside>
      ) : null}
      <footer className={`sticky-editor-actions sticky-editor-actions--${definition ? "editing" : "return"}`}>
        {definition ? (
          <>
            <span>{selectionStatus}</span>
            <button type="button" onClick={() => dispatch({ type: "CANCEL_CONSUMABLE" })}>구매 취소</button>
            <button className="primary-action" disabled={!canApply} type="button" onClick={() => onApplyConsumable(option)}>{applyLabel}</button>
          </>
        ) : (
          <button className="primary-action" type="button" onClick={() => dispatch({ type: "RETURN_TO_PLAY" })}>돌아가기</button>
        )}
      </footer>
    </main>
  );
}

export default function GameApp() {
  const [state, dispatch] = useReducer(gameReducer, undefined, () => createInitialGameState());
  const { savedState, clearLoadedSave } = useGamePersistence(state);
  const [tutorialMode, setTutorialMode] = useState(true);
  const [selectedStartDeckId, setSelectedStartDeckId] = useState("deck_standard");
  // Keep the server render and the browser's first render identical. Reading
  // localStorage in a state initializer changes the title-screen text before
  // React hydrates it, which produces a hydration mismatch on every refresh.
  const [storedStartDeckIds, setStoredStartDeckIds] = useState<string[]>(["deck_standard"]);
  const [startDeckUnlocksLoaded, setStartDeckUnlocksLoaded] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const stored = JSON.parse(window.localStorage.getItem(DECK_UNLOCK_STORAGE_KEY) ?? "[]");
        const valid = Array.isArray(stored)
          ? START_DECKS.map((deck) => deck.id).filter((id) => stored.includes(id))
          : [];
        setStoredStartDeckIds([...new Set(["deck_standard", ...valid])]);
      } catch {
        setStoredStartDeckIds(["deck_standard"]);
      } finally {
        setStartDeckUnlocksLoaded(true);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);
  const runEntropy = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
  const [selectedContract, setSelectedContract] = useState<string | null>(null);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [restartOpen, setRestartOpen] = useState(false);
  const [tutorialIndex, setTutorialIndex] = useState(0);
  const [tutorialOff, setTutorialOff] = useState(false);
  const {
    cardPresentation,
    setCardPresentation,
    submissionPlayback,
    discardPlayback,
    collectionLanding,
    landedCollectionTargets,
    setLandedCollectionTargets,
    drawFeedbackIds,
    clearCardPresentation,
    handleSubmissionBeat,
    handleDiscardBeat,
    primeDiscardPlayback,
    handleCollectionLand,
    assignCupRoleForPresentation,
  } = useCardPresentation(state);
  const {
    forbiddenPresentation,
    applyConsumableWithPresentation,
    closeForbiddenPresentation,
  } = useForbiddenPresentation(state, dispatch);
  const handleHandCardSelect = useCallback((selected: CardInstance) => {
    dispatch({ type: "SELECT_CARD", cardId: selected.instanceId });
  }, []);
  const handleTalismanReorder = useCallback((instanceId: string, targetInstanceId: string) => {
    dispatch({ type: "MOVE_TALISMAN_TO", instanceId, targetInstanceId });
  }, []);
  const [suppressedScoreRevealId, setSuppressedScoreRevealId] = useState<string | null>(null);

  const highestClearedStage = Math.max(0, ...state.calendarStamps.map((stamp) => stamp.stage));
  const unlockedStartDeckIds = useMemo(
    () => [...new Set([...storedStartDeckIds, ...startDeckUnlocksForStage(highestClearedStage)])],
    [highestClearedStage, storedStartDeckIds],
  );
  useEffect(() => {
    if (!startDeckUnlocksLoaded) return;
    window.localStorage.setItem(DECK_UNLOCK_STORAGE_KEY, JSON.stringify(unlockedStartDeckIds));
  }, [startDeckUnlocksLoaded, unlockedStartDeckIds]);

  const stage = getStageDefinition(state.stage, state.infiniteLap);
  const boss = state.bossId ? BOSS_BY_ID[state.bossId] ?? null : null;
  const bossSeason = getBossSeasonForMonth(stage.month, Boolean(boss));
  const { audioMuted, toggleAudio: handleAudioToggle } = useGameAudioScene(
    state.screen,
    boss ? stage.month : null,
  );
  // Only a SUBMITTED hand gets played back. The preview must stay a still
  // picture of the bare 짓 × 끗패, otherwise there is nothing left to show.
  // Declared up here with the other hooks, above every early screen return.
  const scoreRevealId = `${state.runId}:${state.stage}:${state.roundSubmissionIndex}`;
  const reveal = useScoreReveal(
    selectScoreRevealBreakdown(state.lastScore, scoreRevealId, suppressedScoreRevealId),
    scoreRevealId,
  );
  const preview = useMemo(() => {
    try {
      return evaluateSelectedHand(state);
    } catch {
      return null;
    }
  }, [state]);
  const selectedCards = state.selectedCardIds.flatMap((id) => {
    const card = state.hand.find((entry) => entry.instanceId === id);
    return card ? [card] : [];
  });
  const effectiveCupRoleLookup = useMemo(() => getEffectiveCupRoles(state), [state]);
  const presentationDrawnCards = useMemo(() => {
    if (!cardPresentation) return [];
    const keptIds = new Set(cardPresentation.keptCardIds);
    return state.hand.filter((card) => !keptIds.has(card.instanceId));
  }, [cardPresentation, state.hand]);

  const beginSubmitPresentation = () => {
    if (!preview || state.screen !== "play" || state.handsRemaining <= 0 || state.pendingCupCardId) return;
    primeGameAudio();
    const selectedIds = new Set(state.selectedCardIds);
    // An unfiled September cup is still an animal on the live board. Its
    // scoring role may have been chosen automatically for the best hand, but
    // that must not silently decide where the player files it afterward.
    const collectionCupRoles = typeof effectiveCupRoleLookup === "string"
      ? effectiveCupRoleLookup
      : { ...effectiveCupRoleLookup };
    const collectionCards = [...selectedCards, ...preview.captured]
      .filter((card) => getCollectionLandingTargets(card, collectionCupRoles).length > 0);
    setLandedCollectionTargets(new Set());
    setCardPresentation({
      id: `${state.runId}:submit:${state.stage}:${state.roundSubmissionIndex}`,
      kind: "submit",
      cards: selectedCards.map((card) => ({ ...card, tags: [...card.tags] })),
      collectionCards: collectionCards.map((card) => ({ ...card, tags: [...card.tags] })),
      collectionCupRoles,
      collectionCardIdsBefore: [...state.chain.collection.cardIds],
      handBefore: state.hand.map((card) => ({ ...card, tags: [...card.tags] })),
      keptCardIds: state.hand.filter((card) => !selectedIds.has(card.instanceId)).map((card) => card.instanceId),
      submissionScoreBefore: state.chain.submissionScore,
      collectionScoreBefore: state.chain.collectionScore,
      roundScoreBefore: state.chain.roundScore,
      talismanGrowthBefore: Object.fromEntries(state.talismans.map((item) => [item.instanceId, item.growth])),
    });
    dispatch({ type: "SUBMIT_HAND" });
  };

  const beginDiscardPresentation = () => {
    if (state.screen !== "play" || state.discardsRemaining <= 0 || state.pendingCupCardId) return;
    primeGameAudio();
    const discardable = selectedCards.filter((card) => !isUndiscardable(card));
    const canPayDiscardCost = state.money >= getBossDiscardMoneyCost(boss);
    if (discardable.length > 0 && canPayDiscardCost) {
      const discardedIds = new Set(discardable.map((card) => card.instanceId));
      const orderedDiscarded = state.hand.filter((card) => discardedIds.has(card.instanceId));
      setCardPresentation({
        id: `${state.runId}:discard:${state.stage}:${state.stats.discardsUsed}`,
        kind: "discard",
        cards: orderedDiscarded.map((card) => ({ ...card, tags: [...card.tags] })),
        collectionCards: [],
        collectionCupRoles: {},
        collectionCardIdsBefore: [...state.chain.collection.cardIds],
        handBefore: state.hand.map((card) => ({ ...card, tags: [...card.tags] })),
        keptCardIds: state.hand.filter((card) => !discardedIds.has(card.instanceId)).map((card) => card.instanceId),
        submissionScoreBefore: state.chain.submissionScore,
        collectionScoreBefore: state.chain.collectionScore,
        roundScoreBefore: state.chain.roundScore,
        talismanGrowthBefore: Object.fromEntries(state.talismans.map((item) => [item.instanceId, item.growth])),
      });
      primeDiscardPlayback(orderedDiscarded);
    }
    dispatch({ type: "DISCARD_SELECTED" });
  };
  // 반짓 셈판 부적이나 고도리 완성 효과가 있으면 5의 배수도 짓이 된다.
  const fiveMultipleJit = useMemo(
    () => state.talismans.some((item) => item.definitionId === "t_leap_calendar")
      || calculateCollectionBonus(
        cardsFor(state, state.chain.collection.cardIds),
        effectiveCupRoleLookup,
        state.yakuLevels,
      ).perks.allowFiveMultipleJit,
    [effectiveCupRoleLookup, state],
  );
  const yakuChoices = useMemo(() => {
    const candidates = findImmediateYakuCandidates(selectedCards, {
      cupRole: preview?.usedCupRole ?? "animal",
      allowFiveMultipleJit: fiveMultipleJit,
      includeSecretYaku: true,
    });
    return [...new Set(candidates.map((entry) => entry.yakuId))];
  }, [selectedCards, preview?.usedCupRole, fiveMultipleJit]);
  const appliedYaku = preview
    ? ALL_IMMEDIATE_YAKU_DEFINITIONS.find((entry) => entry.id === preview.breakdown.yakuId) ?? null
    : null;
  // 짓고땡: the previewed candidate splits the selection into 짓 (월 합) and
  // 끗패 (배수). Showing which card is which is the whole readability of the
  // system, so it is surfaced on the card faces and in the hand meta.
  const splitRoleOf = (cardId: string): "jit" | "kkeut" | undefined => {
    const selectedIndex = state.selectedCardIds.indexOf(cardId);
    if (selectedIndex < 0) return undefined;
    return selectedIndex < 2 ? "kkeut" : "jit";
  };
  const pendingCupCard = state.pendingCupCardId
    ? state.deck.find((card) => card.instanceId === state.pendingCupCardId) ?? null
    : null;
  const cupRolePreview = useMemo(() => pendingCupCard
    ? calculateCupRolePreview(
      cardsFor(state, state.chain.collection.cardIds),
      pendingCupCard,
      state.cupAssignments,
      state.yakuLevels,
    )
    : null, [pendingCupCard, state]);
  const presentationCollectionCards = useMemo(() => {
    if (cardPresentation?.kind !== "submit") return [];
    const liveCardIds = new Set(state.deck.map((card) => card.instanceId));
    // A glass card (or cremation effect) still appears in the scoring replay,
    // but once it has burned it must not fly into or reappear on the collection
    // board afterward.
    return cardPresentation.collectionCards.filter((card) => liveCardIds.has(card.instanceId));
  }, [cardPresentation, state.deck]);
  const visibleCollectionCardIdsByTrack = useMemo<CollectionCardIdsByTrack | undefined>(() => {
    if (cardPresentation?.kind !== "submit") return undefined;
    return getVisibleCollectionCardIdsByTrack(
      cardPresentation.collectionCardIdsBefore,
      presentationCollectionCards,
      cardPresentation.collectionCupRoles,
      landedCollectionTargets,
    );
  }, [cardPresentation, landedCollectionTargets, presentationCollectionCards]);
  const collections = useMemo(
    () => collectionItems(state, visibleCollectionCardIdsByTrack),
    [state, visibleCollectionCardIdsByTrack],
  );
  const visibleCollectionPoints = useMemo(
    () => visibleCollectionGoStopPoints(state, visibleCollectionCardIdsByTrack),
    [state, visibleCollectionCardIdsByTrack],
  );
  const visibleCollectionScore = visibleCollectionPoints * 20;
  const visibleRoundScore = state.chain.submissionScore + visibleCollectionScore;
  const submitSnapshot = cardPresentation?.kind === "submit" ? cardPresentation : null;
  const talismanGrowthEvents = useMemo<TalismanGrowthEvent[]>(() => {
    if (!submitSnapshot) return [];
    return state.talismans.flatMap((instance) => {
      const before = submitSnapshot.talismanGrowthBefore[instance.instanceId] ?? instance.growth;
      const delta = instance.growth - before;
      const definition = TALISMAN_BY_ID[instance.definitionId];
      return definition && delta > 0
        ? [{ sourceId: instance.instanceId, label: definition.name, delta, total: instance.growth }]
        : [];
    });
  }, [state.talismans, submitSnapshot]);
  const talismanItems = useMemo(() => state.talismans.flatMap((instance) => {
    const definition = TALISMAN_BY_ID[instance.definitionId];
    return definition ? [{ instance, definition }] : [];
  }), [state.talismans]);
  const cardTheater = cardPresentation?.kind === "submit" && state.lastScore && !state.pendingCupCardId ? (
    <SubmissionTheater
      key={cardPresentation.id}
      breakdown={state.lastScore}
      submittedCards={cardPresentation.cards}
      collectionCards={presentationCollectionCards}
      cupRoles={cardPresentation.collectionCupRoles}
      growthEvents={talismanGrowthEvents}
      onBeatChange={handleSubmissionBeat}
      onCollectionLand={handleCollectionLand}
      onComplete={clearCardPresentation}
    />
  ) : cardPresentation?.kind === "discard" ? (
    <DiscardTheater
      key={cardPresentation.id}
      discardedCards={cardPresentation.cards}
      drawnCards={presentationDrawnCards}
      onBeatChange={handleDiscardBeat}
      onComplete={clearCardPresentation}
    />
  ) : null;

  const resetToTitle = () => {
    clearSavedGame();
    clearLoadedSave();
    setRestartOpen(false);
    dispatch({ type: "RESET_RUN" });
  };

  // The first month is scripted. Steps whose `when` fails are skipped, and
  // steps with `doneWhen` advance the moment the player does the thing.
  //
  // The cursor is derived rather than stored, so every `doneWhen` MUST be
  // monotonic — a predicate that can flip back to false snaps the tutorial to
  // an earlier step. That is why the 손패 step advances on the Next button
  // instead of on `selectedCardIds.length >= 2`: deselecting a card would have
  // rewound it. See tutorial-steps.ts.
  const tutorialActive = state.tutorialMode && !tutorialOff && state.stage === 1;
  const tutorialStep = (() => {
    if (!tutorialActive) return null;
    for (let index = tutorialIndex; index < TUTORIAL_STEPS.length; index += 1) {
      const step = TUTORIAL_STEPS[index];
      if (step.when && !step.when(state)) continue;
      if (step.doneWhen?.(state)) continue;
      return { step, index };
    }
    return null;
  })();


  /**
   * Market screens drop both rails. There is no hand to score and no
   * collection to grow here, so the panel gets the whole viewport.
   */
  const marketShell = (
    banner: MarketBanner,
    caption: string,
    children: React.ReactNode,
    bannerTools?: React.ReactNode,
  ) => (
    <div className="market-shell">
      <header className={`market-shell__banner market-shell__banner--${banner.tone ?? "shop"}`} data-asset-tag={banner.assetTag}>
        <span className="market-shell__banner-mark" aria-hidden="true">花</span>
        <div>
          <strong>{banner.title}</strong>
          {banner.subtitle ? <span>{banner.subtitle}</span> : null}
        </div>
        {bannerTools ? <div className="market-shell__banner-tools">{bannerTools}</div> : null}
        <p className="market-shell__caption">{caption}</p>
      </header>
      <main className="market-shell__body">{children}</main>
      <PackPickModal
        key={state.pendingPack?.packId ?? "no-pack"}
        pack={state.pendingPack}
        maxSelections={state.pendingPack?.category === "talisman"
          ? Math.min(state.pendingPack.picksLeft, Math.max(0, getEffectiveTalismanSlots(state) - state.talismans.length))
          : state.pendingPack?.picksLeft ?? 0}
        onConfirm={(candidateIds) => dispatch({ type: "CONFIRM_PACK_SELECTION", candidateIds })}
        onClose={() => dispatch({ type: "CLOSE_PACK" })}
      />
      {tutorialStep ? (
        <TutorialSpotlight
          target={tutorialStep.step.target}
          step={tutorialStep.index + 1}
          total={TUTORIAL_STEPS.length}
          title={tutorialStep.step.title}
          body={tutorialStep.step.body}
          actionHint={tutorialStep.step.actionHint}
          nextLabel={tutorialStep.step.nextLabel}
          onNext={() => setTutorialIndex(tutorialStep.index + 1)}
          onSkip={() => setTutorialOff(true)}
        />
      ) : null}
      <GameRulesModal open={rulesOpen} onClose={() => setRulesOpen(false)} />
      <GameModal
        id="restart-run"
        open={restartOpen}
        assetTag="ui:warning:restart"
        title="현재 판을 끝낼까요?"
        description="저장된 달력과 덱이 초기화됩니다."
        onClose={() => setRestartOpen(false)}
        actions={[
          { id: "cancel", label: "계속 플레이", onClick: () => setRestartOpen(false) },
          { id: "reset", label: "제목으로", variant: "danger", onClick: resetToTitle },
        ]}
      />
      {forbiddenPresentation ? (
        <ForbiddenRitualTheater
          presentation={forbiddenPresentation}
          onClose={closeForbiddenPresentation}
        />
      ) : null}
    </div>
  );

  if (state.screen === "title" || state.screen === "deck_select") {
    return (
      <div className="game-root title-root" onPointerDownCapture={primeGameAudio}>
        <section className="title-controls" aria-label="판 설정">
          <label><span>재현 시드</span><input value={state.seed} onChange={(event) => dispatch({ type: "SET_SEED", seed: event.target.value })} /></label>
          <label className="tutorial-toggle"><input type="checkbox" checked={tutorialMode} onChange={(event) => setTutorialMode(event.target.checked)} /><span>처음이라면 단계별 안내 켜기</span></label>
          <button
            type="button"
            className="audio-toggle"
            aria-pressed={!audioMuted}
            onClick={handleAudioToggle}
          >
            {audioMuted ? "소리 켜기" : "소리 켜짐"}
          </button>
        </section>
        <TitleScreen
          assetTag="ui:gyeonghwasuwol-logo-backdrop"
          title="경화수월"
          subtitle="화투패로 끗을 만들고 목표 점수를 넘기세요."
          description="두 장으로 끗을 만들고, 남은 패와 수집 족보로 점수를 쌓아 판을 이기세요."
          startDecks={START_DECKS}
          selectedStartDeckId={selectedStartDeckId}
          unlockedStartDeckIds={unlockedStartDeckIds}
          canContinue={Boolean(savedState)}
          continueSummary={savedState ? `${savedState.stage}월 · ${format(savedState.chain.roundScore)}점` : undefined}
          onSelectStartDeck={setSelectedStartDeckId}
          onNewGame={() => {
            primeGameAudio();
            dispatch({ type: "START_RUN", startDeckId: selectedStartDeckId, tutorialMode, entropy: runEntropy() });
          }}
          onSkipTutorial={() => {
            primeGameAudio();
            dispatch({ type: "START_RUN", startDeckId: selectedStartDeckId, tutorialMode: false, entropy: runEntropy() });
          }}
          onContinue={savedState ? () => {
            primeGameAudio();
            setSuppressedScoreRevealId(`${savedState.runId}:${savedState.stage}:${savedState.roundSubmissionIndex}`);
            dispatch({ type: "CONTINUE_RUN", state: savedState });
          } : undefined}
        />
      </div>
    );
  }

  if (state.screen === "round_intro") {
    return (
      <div className="game-root">
        <IntroScreen state={state} onStart={() => {
          primeGameAudio();
          dispatch({ type: "START_STAGE" });
        }} onDeck={() => dispatch({ type: "OPEN_SCREEN", screen: "deck_editor" })} onRules={() => setRulesOpen(true)} />
        <GameRulesModal open={rulesOpen} onClose={() => setRulesOpen(false)} />
      </div>
    );
  }

  if (state.screen === "deck_editor" || state.screen === "codex") {
    return <div className="game-root"><DeckEditor state={state} dispatch={dispatch} onApplyConsumable={applyConsumableWithPresentation} /></div>;
  }

  if (state.screen === "reward" && !cardPresentation) {
    const summary = state.lastRoundSummary;
    return marketShell(
      { assetTag: "ui:reward:ink-pouch", title: "판 승리", subtitle: "판돈을 받아 갑니다", tone: "reward" },
      "판을 넘겼습니다",
      <MarketScreen
        mode="reward"
        assetTag="ui:reward:ink-pouch"
        stageLabel={stage.name}
        money={state.money}
        description={`${format(state.chain.roundScore)}점으로 목표 ${format(state.targetScore)}점을 넘겼습니다.`}
        reward={{
          assetTag: `reward:stage-${state.stage}`,
          amount: state.lastRoundReward,
          title: "판돈과 박 보상",
          description: `${format(state.chain.roundScore)}점으로 목표 달성`,
          reasons: summary?.rewardReasons,
          scores: summary ? {
            submission: summary.submissionScore,
            collection: summary.collectionScore,
            goStopPoints: summary.goStopPoints,
            total: summary.totalScore,
            goCount: summary.goCount,
            highestHand: summary.highestHand,
            highestSubmissionCards: summary.highestSubmissionCards,
          } : undefined,
          collectionItems: collections,
          lines: summary ? undefined : [`남은 제출 ${state.handsRemaining}회`, `${state.chain.goCount}고`, `달력 도장 ${state.calendarStamps.length}개`],
        }}
        onContinue={() => dispatch({ type: "CONTINUE_AFTER_REWARD" })}
      />,
    );
  }

  if (state.screen === "shop") {
    const ownedTalismanViews = talismanItems.map(({ instance, definition }) => ({
      instanceId: instance.instanceId,
      name: definition.name,
      description: `${definition.description} ${getTalismanTimingText(definition)}${instance.edition === "engraved" ? " · 음각: 이 부적을 보유하는 동안 부적 칸 +1" : ""}`,
      assetTag: definition.assetTag,
      sellPrice: Math.max(1, Math.floor(definition.price / 2)),
    }));
    const offers = state.shopOffers.flatMap((offer) => {
      const definition = getDefinitionForOffer(offer);
      let description: string = definition?.description ?? "";
      let comparison: { current: string; next: string } | undefined;
      const forbiddenDefinition = offer.category === "forbidden" && definition && "benefit" in definition
        ? definition
        : null;
      const additionalCost = forbiddenDefinition && "additionalCost" in forbiddenDefinition
        ? forbiddenDefinition.additionalCost
        : 0;
      const requiredMoney = offer.price + additionalCost;
      const unavailableReason = forbiddenDefinition
        ? getForbiddenUnavailableReason(state, forbiddenDefinition)
        : offer.category === "talisman" && state.talismans.length >= getEffectiveTalismanSlots(state)
          ? `부적 주머니가 가득 참 · ${state.talismans.length}/${getEffectiveTalismanSlots(state)}칸`
          : undefined;
      let detailLabel = offer.category === "pack" && definition && "choices" in definition
        ? definition.category === "burn"
          ? `덱 전체에서 ${definition.picks}장 확정 소각`
          : `후보 ${definition.choices}개 중 ${definition.picks}개 선택`
        : offer.category === "talisman"
          ? "빈 부적 칸에 바로 장착"
          : offer.category === "book"
            ? "끗패 배수 레벨 +1"
            : offer.category === "painter"
              ? "구매 후 바꿀 카드를 고름"
              : "대가를 확인하고 사용";

      if (offer.category === "talisman") {
        const talisman = TALISMAN_BY_ID[offer.definitionId];
        if (talisman) {
          description = `${talisman.description} ${getTalismanTimingText(talisman)}`;
          detailLabel = "빈 부적 칸에 바로 장착 · 왼쪽부터 순서대로 발동";
        }
      }

      if (offer.category === "book") {
        const book = BOOK_BY_ID[offer.definitionId];
        if (book) {
          const level = state.yakuLevels[book.yakuId]?.level ?? 1;
          comparison = getBookLevelPreview(book.yakuId, level);
          description = `${book.description} 아래에서 현재 효과와 구매 후 효과를 비교할 수 있습니다.`;
          detailLabel = "구매 즉시 이번 판 끝까지 적용";
        }
      } else if (offer.category === "forbidden") {
        const forbidden = FORBIDDEN_BY_ID[offer.definitionId];
        if (forbidden) {
          description = `얻는 것 · ${forbidden.benefit}`;
          detailLabel = `치르는 대가 · ${forbidden.cost} · 구매 즉시 발동, 되돌릴 수 없음`;
        }
      }
      if (forbiddenDefinition) {
        detailLabel = `${detailLabel} · ${forbiddenDefinition.targetPrompt}${additionalCost ? ` · 구매 ${format(offer.price)}냥 + 의식 ${format(additionalCost)}냥` : ""}`;
      }
      return definition
        ? [{
            offer,
            name: definition.name,
            description,
            assetTag: definition.assetTag,
            detailLabel,
            comparison,
            rarityLabel: getOfferRarityLabel(definition),
            requiredMoney,
            priceLabel: additionalCost
              ? `총 ${format(requiredMoney)}냥`
              : undefined,
            unavailableReason,
            recommended: tutorialActive && offer.definitionId === "t_first_charm" && !offer.sold,
          }]
        : [];
    });
    const openedPack = state.shopType
      ? { talisman: "부적 묶음", painter: "화공 묶음", book: "비결 묶음", forbidden: "금단 묶음" }[state.shopType]
      : null;
    return marketShell(
      { assetTag: "ui:shop:market", title: "장터", subtitle: "내 덱을 고칠 차례" },
      `${state.stage}월 장터 · 남은 냥 ${format(state.money)}`,
      <MarketScreen
        mode="shop"
        assetTag="ui:shop:market"
        stageLabel={`${state.stage}월 장터`}
        money={state.money}
        offers={offers}
        openedPack={openedPack}
        rerollCost={state.rerollCost}
        canReroll={true}
        ownedTalismans={ownedTalismanViews}
        onSellTalisman={(instanceId) => {
          primeGameAudio();
          playShopSaleSound();
          dispatch({ type: "SELL_TALISMAN", instanceId });
        }}
        onMoveTalisman={(instanceId, targetInstanceId) => dispatch({ type: "MOVE_TALISMAN_TO", instanceId, targetInstanceId })}
        onOpenDeck={() => dispatch({ type: "OPEN_SCREEN", screen: "deck_editor" })}
        onBuyOffer={(offerId) => {
          const offer = state.shopOffers.find((entry) => entry.offerId === offerId);
          if (!offer || offer.sold) return;
          primeGameAudio();
          playShopPurchaseSound(offer.category);
          dispatch({ type: "BUY_OFFER", offerId });
        }}
        onReroll={() => {
          primeGameAudio();
          playShopRerollSound();
          dispatch({ type: "REROLL_SHOP" });
        }}
        onLeave={() => dispatch({ type: "NEXT_STAGE" })}
      />,
      <OwnedTalismanBar
        items={ownedTalismanViews}
        onSell={(instanceId) => {
          primeGameAudio();
          playShopSaleSound();
          dispatch({ type: "SELL_TALISMAN", instanceId });
        }}
        onMove={(instanceId, targetInstanceId) => dispatch({ type: "MOVE_TALISMAN_TO", instanceId, targetInstanceId })}
      />,
    );
  }

  if (state.screen === "contract") {
    const contracts = state.contractChoices.flatMap((id) => {
      const definition = CONTRACTS.find((entry) => entry.id === id);
      const currentLevel = state.contracts.filter((contractId) => contractId.split("@")[0] === id).length;
      return definition ? [{ definition, currentLevel }] : [];
    });
    return marketShell(
      { assetTag: "ui:contract:season-scroll", title: "계절 결산", subtitle: "열두 달 내내 남는 계약", tone: "contract" },
      `${state.stage}월 계절 결산`,
      <MarketScreen
        mode="contract"
        seasonMonth={((((state.stage - 1) % 12) + 1) as 3 | 6 | 9 | 12)}
        className="market-panel--contract"
        assetTag="ui:contract:season-scroll"
        stageLabel={`${state.stage}월 계절 결산`}
        money={state.money}
        description="한 번 고르면 이번 판 내내 유지됩니다."
        contracts={contracts}
        selectedContractId={selectedContract}
        onSelectContract={setSelectedContract}
        onConfirmContract={() => {
          if (selectedContract) {
            dispatch({ type: "CHOOSE_CONTRACT", contractId: selectedContract });
            setSelectedContract(null);
          }
        }}
      />,
    );
  }

  // Keep the live board mounted until the final submitted hand has finished
  // travelling into the real collection rail. Otherwise a last-hand loss
  // swaps the rail for the result screen before the player can see the cards
  // land, and every collection flight falls back to an invisible target.
  if ((state.screen === "run_win" || state.screen === "run_lose") && !cardPresentation) {
    const isWin = state.screen === "run_win";
    const ownedYakus = Object.entries(state.yakuLevels)
      .filter(([, progress]) => progress.level > 1)
      .sort((left, right) => right[1].level - left[1].level || left[0].localeCompare(right[0]))
      .map(([yakuId, progress]) => ({
        yakuId,
        name: getYakuDisplayName(yakuId),
        level: progress.level,
        assetTag: getYakuAssetTag(yakuId) ?? `ending:yaku:${yakuId}`,
      }));
    const ownedTalismans = state.talismans.flatMap((instance) => {
      const definition = TALISMAN_BY_ID[instance.definitionId];
      return definition ? [{
        instanceId: instance.instanceId,
        name: definition.name,
        description: definition.description,
        assetTag: definition.assetTag,
        growth: instance.growth,
      }] : [];
    });
    const usedForbiddens = Object.entries(state.stats.forbiddenCardsUsed ?? {})
      .filter(([, count]) => count > 0)
      .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
      .flatMap(([definitionId, count]) => {
        const definition = FORBIDDEN_BY_ID[definitionId];
        return definition ? [{
          definitionId,
          name: definition.name,
          description: `${definition.benefit} · 대가: ${definition.cost}`,
          assetTag: definition.assetTag,
          count,
        }] : [];
      });
    return (
      <div className="game-root">
        <RunEndScreen
          assetTag={isWin ? "ending:twelve-months-complete" : "ending:nagari"}
          result={isWin ? "win" : "lose"}
          stageLabel={`${state.stage}월 · ${stage.name}`}
          finalScore={state.chain.roundScore}
          targetScore={state.targetScore}
          money={state.money}
          seed={state.seed}
          stats={state.stats}
          ownedYakus={ownedYakus}
          ownedTalismans={ownedTalismans}
          usedForbiddens={usedForbiddens}
          buildTags={getRunIdentityTags(state)}
          summary={isWin ? "열두 달을 모두 도장 찍었습니다. 같은 덱으로 무한 달력을 이어갈 수 있습니다." : "덱은 사라지지 않았습니다. 같은 시드로 다시 설계해 보세요."}
          failureReason={!isWin ? `${format(Math.max(0, state.targetScore - state.chain.roundScore))}점 부족` : undefined}
          onRestart={() => dispatch({ type: "START_RUN", startDeckId: "deck_standard", tutorialMode: state.tutorialMode, entropy: runEntropy() })}
          onReturnToTitle={resetToTitle}
          onCopySeed={() => void navigator.clipboard?.writeText(state.seed)}
        />
        <div className="run-extra-actions">
          {isWin ? <button className="primary-action" type="button" onClick={() => dispatch({ type: "CONTINUE_INFINITE" })}>무한 달력 계속</button> : null}
          {!isWin && state.stage === 12 && state.experimentalRules.nagariRetry && !state.nagariUsed ? <button className="primary-action" type="button" onClick={() => dispatch({ type: "RETRY_NAGARI" })}>나가리 재승부</button> : null}
          {!isWin && state.tutorialMode && !state.tutorialBossRetryUsed ? <button type="button" onClick={() => dispatch({ type: "RETRY_TUTORIAL_BOSS" })}>튜토리얼 재도전</button> : null}
        </div>
      </div>
    );
  }

  const requirement = getRoundRequirement(state);
  const remainingToClear = Math.max(0, requirement - state.chain.roundScore);
  const goAvailable = canDeclareGo(state.chain, state.handsRemaining);
  const nextGoRequirement = getNextGoRequirement(state);
  const goRequired = mustDeclareGo(state);
  const baseReward = Math.floor(
    (3 + Math.ceil(state.stage / 2) + state.handsRemaining) * getGoRewardFactor(state.chain.goCount),
  );
  const goRewardFactor = getGoRewardFactor(state.chain.goCount + 1);
  const isDecision = state.screen === "decision";
  const shownBreakdown = selectScoreRailBreakdown({
    preview: preview?.breakdown ?? null,
    lastScore: state.lastScore,
    selectedCount: state.selectedCardIds.length,
    // Once the theater releases the board, the old hand must disappear from
    // the rail as well. Otherwise the freshly dealt hand sits next to the last
    // submission's formula for another 700 ms (the mismatch in screenshots).
    revealVisible: reveal.visible && Boolean(submitSnapshot),
  });
  const theaterReveal = submissionPlayback && state.lastScore
    ? submissionBeatToReveal(
        submissionPlayback.beat,
        submissionPlayback.index,
        submissionPlayback.count,
        state.lastScore.score,
      )
    : undefined;
  const activeReveal = theaterReveal
    ?? (shownBreakdown === state.lastScore ? reveal : undefined);
  const firingTalismanId = submissionPlayback?.beat.kind === "growth"
    ? submissionPlayback.beat.sourceId ?? null
    : activeReveal?.playing ? activeReveal.current?.sourceId ?? null : null;
  const discardSnapshot = cardPresentation?.kind === "discard" ? cardPresentation : null;
  const inlineHand = getInlineHandPresentation(
    discardSnapshot?.handBefore ?? state.hand,
    state.hand,
    discardSnapshot?.cards ?? [],
    discardPlayback,
  );
  const visibleHand = inlineHand.cards;
  const handFanClassName = [
    "hand-fan",
    state.selectedCardIds.length > 0 && "hand-fan--selecting",
    discardSnapshot && "hand-fan--resolving",
  ].filter(Boolean).join(" ");
  const drawnCount = state.drawPile.length;
  const deckTotal = state.deck.length;

  return (
    <div className="play-shell">
      <aside className="play-side" data-tutorial="collection">
        <CollectionBoard
          assetTag="ui:collection-board"
          items={collections}
          scoreLabel={`수집 ${format(visibleCollectionScore)}점 · 고스톱 ${format(visibleCollectionPoints)}점`}
          landingOriginId={collectionLanding?.originId ?? null}
          landingKind={collectionLanding?.kind ?? null}
        />
      </aside>

      <main className="play-board">
        <div className="play-board__top" data-tutorial="talisman">
          <TalismanStrip
            assetTag="ui:talisman-strip"
            items={talismanItems}
            slots={getEffectiveTalismanSlots(state)}
            firingInstanceId={firingTalismanId}
            onReorder={handleTalismanReorder}
          />
        </div>

        {state.chain.goCount > 0 && !isDecision ? (
          <aside className="go-danger-banner" role="status" data-tutorial="go-banner">
            <strong>{state.chain.goCount}고 진행 중</strong>
            <span>
              {format(requirement)}점 문턱까지 {format(remainingToClear)}점 남음 · 못 넘기면 이번 도전이 끝납니다
            </span>
          </aside>
        ) : null}

        <div className="play-board__felt">
          <BossSeasonOverlay season={bossSeason} />
          {cardTheater}
          <p className="play-board__prompt">
            {isDecision
              ? `${format(state.chain.roundScore)}점 · 문턱 ${format(requirement)}점을 넘겼습니다`
              : "손패를 눌러 최대 5장까지 고르세요"}
          </p>

          <div className="play-board__stage">
            {/* `--selecting` dims everything the player did NOT pick, which is the
                only cue that reads at a glance across eight fanned cards. */}
            <ul
              className={handFanClassName}
              aria-label="내 손패"
              aria-busy={Boolean(discardSnapshot)}
              data-tutorial="hand"
              style={{ "--n": visibleHand.length } as React.CSSProperties}
            >
              {visibleHand.map((card, index) => {
                const cardClassName = [
                  drawFeedbackIds.has(card.instanceId) && "hand-card--drawn",
                  inlineHand.discardedIds.has(card.instanceId) && "hand-card--discarded",
                  inlineHand.discardingId === card.instanceId && "hand-card--discarding",
                  inlineHand.drawingId === card.instanceId && "hand-card--inline-drawn",
                ].filter(Boolean).join(" ") || undefined;
                return (
                <li className={cardClassName} key={card.instanceId} style={{ "--i": index } as React.CSSProperties}>
                  <HwatuCard
                    dense
                    card={card}
                    selected={state.selectedCardIds.includes(card.instanceId)}
                    scoring={Boolean(preview?.breakdown.scoringCardIds.includes(card.instanceId))}
                    splitRole={splitRoleOf(card.instanceId)}
                    disabled={isDecision || Boolean(discardSnapshot)}
                    cupRole={card.tags.includes("cup")
                      ? typeof effectiveCupRoleLookup === "string"
                        ? effectiveCupRoleLookup
                        : effectiveCupRoleLookup[card.instanceId]
                      : undefined}
                    onSelect={handleHandCardSelect}
                  />
                </li>
                );
              })}
            </ul>

{/* The face-down pile IS the deck button. Putting it behind a "내 덱" link in
                the rail meant the one object on screen that obviously represents
                the deck did nothing when clicked. */}
            <button
              type="button"
              className="deck-stack"
              aria-label={`내 덱 보기 · 남은 ${drawnCount}장 / 전체 ${deckTotal}장`}
              onClick={() => dispatch({ type: "OPEN_SCREEN", screen: "deck_editor" })}
            >
              <span className="deck-stack__back" data-asset-tag="ui:card-back:hanji" aria-hidden="true" />
              <strong><small>남은 덱</small><span>{drawnCount} / {deckTotal}장</span></strong>
              <em>덱 보기</em>
            </button>
          </div>

          <div className="hand-meta">
            <span>{state.selectedCardIds.length} / 5 선택</span>
            <span className="hand-meta__yaku">
              {preview ? (
                <>
                  짓 {preview.breakdown.jitSum > 0 ? preview.breakdown.jitSum : "없음"}
                  {" · "}
                  {preview.breakdown.rankLabel || appliedYaku?.name || "끗패"}
                </>
              ) : state.screen === "play" && state.selectedCardIds.length >= 2 ? (
                "짓이 맞지 않습니다"
              ) : null}
              {yakuChoices.length > 1 ? (
                <em>
                  다른 갈래 {yakuChoices.length - 1}가지
                </em>
              ) : null}
            </span>
            <span>손패 {state.hand.length}장</span>
          </div>
        </div>

        {state.screen === "play" || Boolean(submitSnapshot) ? (
          <footer className="hand-actions" aria-busy={Boolean(cardPresentation)}>
            <button type="button" disabled={!state.selectedCardIds.length || Boolean(cardPresentation)} onClick={() => dispatch({ type: "CLEAR_SELECTION" })}>선택 해제</button>
            <button type="button" className="primary-action" disabled={!preview || state.handsRemaining <= 0 || Boolean(cardPresentation) || Boolean(state.pendingCupCardId)} data-tutorial="submit" onClick={beginSubmitPresentation}><strong>제출</strong><span>{`${state.handsRemaining}회 남음`}</span></button>
            <button type="button" className="discard-action" disabled={!state.selectedCardIds.length || state.discardsRemaining <= 0 || Boolean(cardPresentation) || Boolean(state.pendingCupCardId)} data-tutorial="discard" onClick={beginDiscardPresentation}><strong>버리기</strong><span>{state.discardsRemaining}회 남음</span></button>
          </footer>
        ) : (
          <footer className="decision-actions decision-actions--two">
            <button
              type="button"
              className="stop-action"
              data-tutorial="stop"
              disabled={goRequired || Boolean(cardPresentation)}
              onClick={() => {
                primeGameAudio();
                dispatch({ type: "STOP_ROUND" });
              }}
            >
              <strong>스톱</strong>
              <span>
                {goRequired
                  ? "이 두목은 고를 한 번 외쳐야 합니다"
                  : `판돈 ${format(baseReward)}냥을 받고 판을 끝냅니다`}
              </span>
            </button>
            <button
              type="button"
              className="go-action"
              data-tutorial="go"
              disabled={!goAvailable || Boolean(cardPresentation)}
              onClick={() => dispatch({ type: "DECLARE_GO" })}
            >
              <strong>{state.chain.goCount + 1}고</strong>
              <span>
                {goAvailable
                  ? `문턱 ${format(nextGoRequirement ?? 0)}점 · 판돈 ×${goRewardFactor}`
                  : state.chain.goCount >= 3
                    ? "3고가 최대입니다"
                    : "남은 제출이 없습니다"}
              </span>
            </button>
          </footer>
        )}
      </main>

      <PlayRail
        assetTag={`ui:rail:month-${stage.month}`}
        stageAssetTag={stage.assetTag}
        stageLabel={`${stage.month}월 · ${stage.name}`}
        stageSubtitle={stage.subtitle}
        weatherLabel={`날씨 ${WEATHER_BY_ID[state.weatherId].name}`}
        bossLabel={boss?.name ?? null}
        bossDescription={boss?.description ?? null}
        bossCounterplay={boss?.counterplay ?? null}
        targetScore={requirement}
        rewardLabel={`${baseReward}냥`}
        roundScore={submitSnapshot?.roundScoreBefore ?? visibleRoundScore}
        submissionScore={submitSnapshot?.submissionScoreBefore ?? state.chain.submissionScore}
        collectionScore={submitSnapshot?.collectionScoreBefore ?? visibleCollectionScore}
        goCount={state.chain.goCount}
        breakdown={shownBreakdown}
        reveal={activeReveal}
        formulaCaption={
          shownBreakdown
            ? submissionPlayback
              ? `${submissionPlayback.beat.eyebrow} · ${submissionPlayback.beat.title}`
              : reveal.playing
                ? `효과 적용 중 ${reveal.index}/${reveal.count}`
              : shownBreakdown === state.lastScore
                ? "방금 낸 점수"
                : `짓 ${shownBreakdown.startingKkeut} × 끗패 배수 · 제출하면 효과가 붙습니다`
            : state.selectedCardIds.length
              ? "짓의 월 합이 10의 배수가 되어야 합니다"
              : "먼저 고른 두 장은 끗패, 그다음 패는 짓이 됩니다"
        }
        handsRemaining={state.handsRemaining}
        discardsRemaining={state.discardsRemaining}
        money={state.money}
        stageIndex={state.stage}
        stageTotal={12}
        seed={state.seed}
        onOpenRules={() => setRulesOpen(true)}
        onRestart={() => setRestartOpen(true)}
        audioMuted={audioMuted}
        onToggleAudio={handleAudioToggle}
      />

      <CupChoiceModal
        card={pendingCupCard}
        preview={cupRolePreview}
        onChoose={(role) => {
          const cardId = state.pendingCupCardId;
          if (!cardId) return;
          assignCupRoleForPresentation(cardId, role);
          dispatch({ type: "ASSIGN_CUP_ROLE", cardId, role });
        }}
      />
      {tutorialStep ? (
        <TutorialSpotlight
          target={tutorialStep.step.target}
          step={tutorialStep.index + 1}
          total={TUTORIAL_STEPS.length}
          title={tutorialStep.step.title}
          body={tutorialStep.step.body}
          actionHint={tutorialStep.step.actionHint}
          nextLabel={tutorialStep.step.nextLabel}
          onNext={() => setTutorialIndex(tutorialStep.index + 1)}
          onSkip={() => setTutorialOff(true)}
        />
      ) : null}
      <GameRulesModal open={rulesOpen} onClose={() => setRulesOpen(false)} />
      <GameModal id="restart-run" open={restartOpen} assetTag="ui:warning:restart" title="현재 판을 끝낼까요?" description="저장된 달력과 덱이 초기화됩니다." onClose={() => setRestartOpen(false)} actions={[{ id: "cancel", label: "계속 플레이", onClick: () => setRestartOpen(false) }, { id: "reset", label: "제목으로", variant: "danger", onClick: resetToTitle }]} />
    </div>
  );
}
