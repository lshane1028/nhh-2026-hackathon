"use client";

import { useEffect, useMemo, useReducer, useState } from "react";

import { BOSS_BY_ID } from "@/game/content/bosses";
import { CONTRACTS, WEATHER_BY_ID } from "@/game/content/meta";
import { getStageDefinition } from "@/game/content/stages";
import { TALISMAN_BY_ID } from "@/game/content/talismans";
import { ALL_IMMEDIATE_YAKU_DEFINITIONS } from "@/game/content/yaku";
import { CARD_EFFECT_TAG_BY_ID } from "@/game/content/card-effects";
import { playCardPickSound, playCardRevealSound, playPackOpenSound } from "./audio/game-sfx";
import { calculateCollectionBonus, GODORI_MONTHS } from "@/game/engine/collection-bonus";
import { buildCollectionSlots } from "@/game/engine/collection-board";
import { createStandardHwatuDeck } from "@/game/engine/deck";
import { canDeclareGo, getGoRewardFactor } from "@/game/engine/go";
import { findImmediateYakuCandidates } from "@/game/engine/yaku";
import {
  createInitialGameState,
  evaluateSelectedHand,
  gameReducer,
  getRoundRequirement,
  getNextGoRequirement,
  mustDeclareGo,
  getDefinitionForOffer,
  getEffectiveTalismanSlots,
  getPendingConsumableDefinition,
  sortHand,
} from "@/game/state/game";
import { clearSavedGame, loadGame, saveGame } from "@/game/state/storage";
import type {
  CardInstance,
  ExperimentalRules,
  GameState,
  ImmediateYakuId,
} from "@/game/types";

import { AssetPlaceholder } from "./components/AssetPlaceholder";
import { CollectionBoard, type CollectionBoardItem } from "./components/CollectionBoard";
import { GameModal } from "./components/GameModal";
import { getGeneratedAssetUrl } from "./components/generated-asset";
import { HwatuCard } from "./components/HwatuCard";
import { getAtlasPosition, getCardArtUrl } from "./components/hwatu-atlas";
import { MarketScreen } from "./components/MarketScreen";
import { PlayRail } from "./components/PlayRail";
import { RunEndScreen } from "./components/RunEndScreen";
import { TalismanStrip } from "./components/TalismanStrip";
import { TitleScreen, type ExperimentalRuleOption } from "./components/TitleScreen";
import { TutorialSpotlight } from "./components/TutorialSpotlight";
import { TUTORIAL_STEPS } from "./components/tutorial-steps";
import { useScoreReveal } from "./components/useScoreReveal";
import "./game.css";
import "./components/art-direction.css";
import "./components/pixel-direction.css";

const MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;

/**
 * One concrete example per 끗패, so the ladder can be shown with pictures.
 *
 * These are illustrations, not the rule — 땡 is any matching pair, not only
 * 6월. The engine judges; this only has to make the shape recognisable.
 */
const YAKU_SAMPLES: Partial<Record<ImmediateYakuId, ReadonlyArray<[number, CardInstance["kind"]]>>> = {
  gwangttaeng_38: [[3, "bright"], [8, "bright"]],
  gwangttaeng_18: [[1, "bright"], [8, "bright"]],
  gwangttaeng_13: [[1, "bright"], [3, "bright"]],
  jangttaeng: [[10, "animal"], [10, "ribbon"]],
  ttaeng: [[6, "animal"], [6, "ribbon"]],
  ali: [[1, "chaff"], [2, "chaff"]],
  doksa: [[1, "chaff"], [4, "chaff"]],
  gupping: [[1, "chaff"], [9, "chaff"]],
  jangpping: [[1, "chaff"], [10, "chaff"]],
  jangsa: [[4, "chaff"], [10, "chaff"]],
  seryuk: [[4, "chaff"], [6, "chaff"]],
  gabo: [[4, "chaff"], [5, "chaff"]],
  kkeut: [[3, "chaff"], [5, "chaff"]],
  mangtong: [[2, "chaff"], [8, "chaff"]],
};

const EXPERIMENT_OPTIONS: ExperimentalRuleOption[] = [
  { id: "bakContracts", label: "광박·피박·멍박", description: "판 종료 시 완성한 수집 경로에 따라 추가 냥을 받는 계약.", assetTag: "rule:bak-contracts" },
  { id: "weather", label: "월별 날씨", description: "비·바람·눈이 특정 카드의 월 합이나 재발동을 바꿉니다.", assetTag: "rule:weather" },
  { id: "nagariRetry", label: "나가리 재승부", description: "12월 최종 두목에게 한 번 패하면 제출 1회를 내고 재도전.", assetTag: "rule:nagari-retry" },
];


interface MarketBanner {
  assetTag: string;
  title: string;
  subtitle?: string;
  tone?: "shop" | "reward" | "contract";
}

function format(value: number): string {
  return new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 2 }).format(value);
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

function collectionItems(state: GameState): CollectionBoardItem[] {
  const confirmedCards = cardsFor(state, state.chain.collection.cardIds);
  const pendingCards: CardInstance[] = [];
  const confirmed = calculateCollectionBonus(confirmedCards, state.cupAssignments, state.yakuLevels);
  const total = calculateCollectionBonus([...confirmedCards, ...pendingCards], state.cupAssignments, state.yakuLevels);
  const upgraded = (id: string) => (state.yakuLevels[id]?.level ?? 1) > 1;
  const pendingCount = (track: keyof typeof total.counts): number =>
    Math.max(0, total.counts[track] - confirmed.counts[track]);

  // Picture rows come from the deck, so burning a card removes its slot and a
  // joker that turns 8월 into a 광 adds one.
  const slotsFor = (
    track: "bright" | "animal" | "godori" | "ribbon" | "chaff",
    collectedOnly = false,
  ) => buildCollectionSlots({
    deck: state.deck,
    confirmedCardIds: state.chain.collection.cardIds,
    pendingCardIds: [],
    track,
    cupRoles: state.cupAssignments,
    collectedOnly,
  });

  return [
    {
      id: "bright",
      name: "광",
      kind: "bright",
      assetTag: "collection:bright-five-slots",
      iconUrl: "/assets/cards/hwatu/card-08-bright-moon.webp",
      description: `삼광 3점 · 비삼광 2점${["rain_three_brights", "three_brights", "four_brights", "five_brights"].some(upgraded) ? " · 비결: 고 문턱 감소" : ""}`,
      cards: slotsFor("bright"),
      confirmedCount: confirmed.counts.bright,
      pendingCount: pendingCount("bright"),
      milestones: [
        { at: 3, label: "삼광", reward: "3점 · 비광 포함 2점" },
        { at: 4, label: "사광", reward: "4점" },
        { at: 5, label: "오광", reward: "15점" },
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
      confirmedCount: confirmed.counts.animal,
      pendingCount: pendingCount("animal"),
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
      description: `완성 +5점${upgraded("godori") ? " · 비결: 짓 5배수 허용" : ""}`,
      cards: slotsFor("godori"),
      confirmedCount: confirmed.counts.godori,
      pendingCount: pendingCount("godori"),
      slotLabels: GODORI_MONTHS.map((month) => `${month}월`),
      milestones: [
        { at: 3, label: "세 마리", reward: upgraded("godori") ? "+5점 · 짓 5배수" : "+5점", active: total.completedSets.godori },
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
      confirmedCount: confirmed.counts.ribbon,
      pendingCount: pendingCount("ribbon"),
      slotCount: 10,
      milestones: [
        { at: 3, label: "홍단", reward: upgraded("hongdan") ? "+3점 · 버리기 +1" : "+3점", active: total.completedSets.hongdan },
        { at: 3, label: "초단", reward: upgraded("chodan") ? "+3점 · 버리기 +1" : "+3점", active: total.completedSets.chodan },
        { at: 3, label: "청단", reward: upgraded("cheongdan") ? "+3점 · 버리기 +1" : "+3점", active: total.completedSets.cheongdan },
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
      confirmedCount: confirmed.counts.chaff,
      pendingCount: pendingCount("chaff"),
      milestones: [
        { at: 10, label: "10피", reward: "1점 · 이후 피점당 +1" },
      ],
    },
  ];
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
  return (
    <main className="intro-screen">
      <header className="intro-screen__heading" data-asset-tag={stage.assetTag}>
        <div className="intro-screen__month" aria-hidden="true">
          <strong>{String(stage.month).padStart(2, "0")}</strong>
          <span>月</span>
        </div>
        <div className="intro-screen__copy">
          <p className="eyebrow">CALENDAR {String(stage.month).padStart(2, "0")} / 12</p>
          <span>{boss ? "두목이 기다리는 달" : "열두 달의 다음 판"}</span>
          <h1>{stage.name}</h1>
          <p>{stage.subtitle}</p>
        </div>
        <div className="intro-screen__target">
          <span>이번 판 목표</span>
          <strong>{format(introTarget)}</strong>
          <small>점</small>
        </div>
      </header>
      <div className="intro-screen__rules">
        <article data-asset-tag={weather.assetTag}>
          <span className="intro-screen__rule-mark" aria-hidden="true">天</span>
          <div><strong>날씨 · {weather.name}</strong><small>{weather.description}</small></div>
        </article>
        <article
          data-asset-tag={boss?.assetTag ?? "boss:none"}
          style={bossArtUrl ? { "--boss-art": `url("${bossArtUrl}")` } as React.CSSProperties : undefined}
        >
          <span className="intro-screen__rule-mark" aria-hidden="true">將</span>
          <div>
            <strong>{boss ? `두목 · ${boss.name}` : "일반 판"}</strong>
            <small>{boss?.description ?? "이번 달에는 두목 규칙이 없습니다."}</small>
            {boss ? <em>대응법 · {boss.counterplay}</em> : null}
          </div>
        </article>
      </div>
      {state.calendarStamps.length ? (
        <div className="calendar-strip" aria-label="완료한 달력 도장">
          {state.calendarStamps.map((stamp) => <code key={`${stamp.stage}-${stamp.yakuId}`}>{stamp.month}월 · {stamp.yakuId}</code>)}
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

function DeckEditor({ state, dispatch }: {
  state: GameState;
  dispatch: React.Dispatch<import("@/game/state/actions").GameAction>;
}) {
  const definition = getPendingConsumableDefinition(state);
  const optionConfig = cardEditorOption(definition);
  const [option, setOption] = useState(optionConfig?.values[0]?.value ?? "");
  const isPainter = Boolean(definition && "minTargets" in definition);
  const forbiddenMinimum = definition && !("minTargets" in definition)
    ? definition.effectKey === "all_to_january" ? 2
      : ["double_duplicate_hand_penalty", "make_bright_pay", "all_hand_chaff_bonus", "wild_month_zero_base"].includes(definition.effectKey) ? 1
        : 0
    : 0;
  const minTargets = definition && "minTargets" in definition ? definition.minTargets : forbiddenMinimum;
  const maxTargets = definition && "maxTargets" in definition ? definition.maxTargets : 5;
  const canApply = Boolean(definition) && state.pendingTargetIds.length >= minTargets;

  return (
    <main className="deck-editor-screen">
      <header>
        <div>
          <p className="eyebrow">PERMANENT DECK · {state.deck.length}장</p>
          <h1>{definition ? definition.name : "내 화투 덱"}</h1>
          <p>{definition?.description ?? "지금 덱에 남아 있는 카드입니다. 카드에 손을 올리면 종류와 강화가 보입니다."}</p>
        </div>
        <AssetPlaceholder assetTag={definition?.assetTag ?? "ui:deck-editor"} label={definition?.name ?? "열두 달 패목록"} description={definition ? `${minTargets}~${maxTargets}장 선택` : "월별로 덱의 구성과 강화 상태를 확인합니다"} tone={definition && !isPainter ? "boss" : "card"} />
      </header>
      {optionConfig ? (
        <label className="editor-option">
          <span>{optionConfig.label}</span>
          <select value={option} onChange={(event) => setOption(event.target.value)}>
            {optionConfig.values.map((entry) => <option value={entry.value} key={entry.value}>{entry.label}</option>)}
          </select>
        </label>
      ) : null}
      {/* One row per month, in calendar order. The question this screen answers
          is "what is still in there", and the deck changes every 판 — burned
          cards vanish, bought copies show up twice. */}
      <div className="deck-months">
        {MONTHS.map((month) => {
          const cards = sortHand(state.deck.filter((card) => card.month === month));
          if (cards.length === 0) return null;
          return (
            <section className="deck-month" key={month}>
              <h2>{month}월<span>{cards.length}장</span></h2>
              <div className="deck-month__cards">
                {cards.map((card) => {
                  const selected = state.pendingTargetIds.includes(card.instanceId);
                  return (
                    <HwatuCard
                      dense
                      key={card.instanceId}
                      card={card}
                      selected={selected}
                      className="deck-card"
                      onSelect={definition
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
      <footer className={`sticky-editor-actions sticky-editor-actions--${definition ? "editing" : "return"}`}>
        {definition ? (
          <>
            <span>{state.pendingTargetIds.length}/{maxTargets}장 선택</span>
            <button type="button" onClick={() => dispatch({ type: "CANCEL_CONSUMABLE" })}>구매 취소</button>
            <button className="primary-action" disabled={!canApply} type="button" onClick={() => dispatch({ type: "APPLY_CONSUMABLE", option })}>영구 적용</button>
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
  const [savedState, setSavedState] = useState<GameState | null>(null);
  const [tutorialMode, setTutorialMode] = useState(true);
  const runEntropy = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
  const [selectedContract, setSelectedContract] = useState<string | null>(null);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [restartOpen, setRestartOpen] = useState(false);
  const [tutorialIndex, setTutorialIndex] = useState(0);
  const [tutorialOff, setTutorialOff] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setSavedState(loadGame()), 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (state.runId !== "not-started" && state.screen !== "title") {
      saveGame(state);
    }
  }, [state]);

  const stage = getStageDefinition(state.stage, state.infiniteLap);
  const boss = state.bossId ? BOSS_BY_ID[state.bossId] ?? null : null;
  // Only a SUBMITTED hand gets played back. The preview must stay a still
  // picture of the bare 짓 × 끗패, otherwise there is nothing left to show.
  // Declared up here with the other hooks, above every early screen return.
  const reveal = useScoreReveal(state.lastScore);
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
  // 윤달 달력 부적이든 고도리 완성이든, 둘 중 하나면 5의 배수도 짓이 된다.
  const fiveMultipleJit = useMemo(
    () => state.talismans.some((item) => item.definitionId === "t_leap_calendar")
      || calculateCollectionBonus(
        cardsFor(state, state.chain.collection.cardIds),
        state.cupAssignments,
        state.yakuLevels,
      ).perks.allowFiveMultipleJit,
    [state],
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
  const jitCardIds = useMemo(
    () => new Set(preview?.breakdown.jitCardIds ?? []),
    [preview?.breakdown.jitCardIds],
  );
  const splitRoleOf = (cardId: string): "jit" | "kkeut" | undefined => {
    if (!preview?.breakdown.scoringCardIds.includes(cardId)) return undefined;
    return jitCardIds.has(cardId) ? "jit" : "kkeut";
  };
  const pendingCupCard = state.pendingCupCardId
    ? state.deck.find((card) => card.instanceId === state.pendingCupCardId) ?? null
    : null;
  const collections = useMemo(() => collectionItems(state), [state]);
  const talismanItems = state.talismans.flatMap((instance) => {
    const definition = TALISMAN_BY_ID[instance.definitionId];
    return definition ? [{ instance, definition }] : [];
  });

  const resetToTitle = () => {
    clearSavedGame();
    setSavedState(null);
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
  const marketShell = (banner: MarketBanner, caption: string, children: React.ReactNode) => (
    <div className="market-shell">
      <header className={`market-shell__banner market-shell__banner--${banner.tone ?? "shop"}`} data-asset-tag={banner.assetTag}>
        <span className="market-shell__banner-mark" aria-hidden="true">IMG</span>
        <div>
          <strong>{banner.title}</strong>
          {banner.subtitle ? <span>{banner.subtitle}</span> : null}
        </div>
        <code>{banner.assetTag}</code>
        <p className="market-shell__caption">{caption}</p>
      </header>
      <main className="market-shell__body">{children}</main>
      <PackPickModal
        key={state.pendingPack?.packId ?? "no-pack"}
        pack={state.pendingPack}
        onPick={(instanceId) => dispatch({ type: "PICK_PACK_CARD", instanceId })}
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
      <RulesModal open={rulesOpen} onClose={() => setRulesOpen(false)} />
      <GameModal
        id="restart-run"
        open={restartOpen}
        assetTag="ui:warning:restart"
        title="현재 런을 끝낼까요?"
        description="저장된 달력과 덱이 초기화됩니다."
        onClose={() => setRestartOpen(false)}
        actions={[
          { id: "cancel", label: "계속 플레이", onClick: () => setRestartOpen(false) },
          { id: "reset", label: "제목으로", variant: "danger", onClick: resetToTitle },
        ]}
      />
    </div>
  );

  if (state.screen === "title" || state.screen === "deck_select") {
    return (
      <div className="game-root title-root">
        <section className="title-controls" aria-label="런 설정">
          <label><span>재현 시드</span><input value={state.seed} onChange={(event) => dispatch({ type: "SET_SEED", seed: event.target.value })} /></label>
          <label className="tutorial-toggle"><input type="checkbox" checked={tutorialMode} onChange={(event) => setTutorialMode(event.target.checked)} /><span>처음이라면 단계별 안내 켜기</span></label>
        </section>
        <TitleScreen
          assetTag="ui:title:flower-board-go"
          title="꽃판: GO!"
          subtitle="열두 달, 끝까지 판을 키워라"
          description="손패에서 짓을 맞추고 남은 패로 끗을 세웁니다. 족보와 부적으로 점수를 불린 뒤, 목표를 넘기면 스톱할지 고할지 선택하세요."
          versionLabel="NAN 2026 PROTOTYPE · v0.3"
          experimentalRules={state.experimentalRules}
          experimentalRuleOptions={EXPERIMENT_OPTIONS}
          canContinue={Boolean(savedState)}
          continueSummary={savedState ? `${savedState.stage}월 · ${format(savedState.chain.roundScore)}점` : undefined}
          onToggleExperimentalRule={(key: keyof ExperimentalRules) => dispatch({ type: "TOGGLE_EXPERIMENT", key })}
          onNewGame={() => dispatch({ type: "START_RUN", startDeckId: "deck_standard", tutorialMode, entropy: runEntropy() })}
          onSkipTutorial={() => dispatch({ type: "START_RUN", startDeckId: "deck_standard", tutorialMode: false, entropy: runEntropy() })}
          onContinue={savedState ? () => dispatch({ type: "CONTINUE_RUN", state: savedState }) : undefined}
        />
      </div>
    );
  }

  if (state.screen === "round_intro") {
    return (
      <div className="game-root">
        <IntroScreen state={state} onStart={() => dispatch({ type: "START_STAGE" })} onDeck={() => dispatch({ type: "OPEN_SCREEN", screen: "deck_editor" })} onRules={() => setRulesOpen(true)} />
        <RulesModal open={rulesOpen} onClose={() => setRulesOpen(false)} />
      </div>
    );
  }

  if (state.screen === "deck_editor" || state.screen === "codex") {
    return <div className="game-root"><DeckEditor state={state} dispatch={dispatch} /></div>;
  }

  if (state.screen === "reward") {
    const summary = state.lastRoundSummary;
    const rewardArtCard = (summary ? cardsFor(state, summary.collectionCardIds) : [])[0]
      ?? state.deck.find((card) => card.month === stage.month)
      ?? state.deck[0];
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
          imageUrl: rewardArtCard ? getCardArtUrl(rewardArtCard) : undefined,
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
    const offers = state.shopOffers.flatMap((offer) => {
      const definition = getDefinitionForOffer(offer);
      const detailLabel = offer.category === "pack"
        ? "개봉하면 무료 후보 3장"
        : offer.category === "talisman"
          ? "빈 부적 칸에 바로 장착"
          : offer.category === "book"
            ? "끗패 배수 레벨 +1"
            : offer.category === "painter"
              ? "구매 후 바꿀 카드를 고름"
              : "대가를 확인하고 사용";
      return definition
        ? [{
            offer,
            name: definition.name,
            description: definition.description,
            assetTag: definition.assetTag,
            detailLabel,
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
        onBuyOffer={(offerId) => dispatch({ type: "BUY_OFFER", offerId })}
        onReroll={() => dispatch({ type: "REROLL_SHOP" })}
        onLeave={() => dispatch({ type: "NEXT_STAGE" })}
      />,
    );
  }

  if (state.screen === "contract") {
    const contracts = state.contractChoices.flatMap((id) => {
      const definition = CONTRACTS.find((entry) => entry.id === id);
      return definition ? [{ definition }] : [];
    });
    return marketShell(
      { assetTag: "ui:contract:season-scroll", title: "계절 결산", subtitle: "런 끝까지 남는 계약", tone: "contract" },
      `${state.stage}월 계절 결산`,
      <MarketScreen
        mode="contract"
        assetTag="ui:contract:season-scroll"
        stageLabel={`${state.stage}월 계절 결산`}
        money={state.money}
        description="한 번 고르면 이번 런 내내 유지됩니다."
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

  if (state.screen === "run_win" || state.screen === "run_lose") {
    const isWin = state.screen === "run_win";
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
  // A live selection wins; otherwise the last scored hand stays on the rail so
  // the reveal has somewhere to play out after the cards have left the hand.
  const shownBreakdown = preview?.breakdown ?? state.lastScore;
  const drawnCount = state.drawPile.length;
  const deckTotal = state.deck.length;

  return (
    <div className="play-shell">
      <aside className="play-side" data-tutorial="collection">
        <CollectionBoard
          assetTag="ui:collection-board"
          items={collections}
          scoreLabel={`수집 ${format(state.chain.collectionScore)}점 · 고스톱 ${format(state.chain.collectionScore / 20)}점`}
        />
      </aside>

      <main className="play-board">
        <div className="play-board__top" data-tutorial="talisman">
          <TalismanStrip
            assetTag="ui:talisman-strip"
            items={talismanItems}
            slots={getEffectiveTalismanSlots(state)}
            firingInstanceId={reveal.playing ? reveal.current?.sourceId ?? null : null}
          />
        </div>

        {state.chain.goCount > 0 && !isDecision ? (
          <aside className="go-danger-banner" role="status" data-tutorial="go-banner">
            <strong>{state.chain.goCount}고 진행 중</strong>
            <span>
              {format(requirement)}점 문턱까지 {format(remainingToClear)}점 남음 · 못 넘기면 런이 끝납니다
            </span>
          </aside>
        ) : null}

        <div className="play-board__felt">
          <p className="play-board__prompt">
            {isDecision
              ? `${format(state.chain.roundScore)}점 · 문턱 ${format(requirement)}점을 넘겼습니다`
              : "손패를 눌러 최대 5장까지 고르세요"}
          </p>

          <div className="play-board__stage">
            {/* `--selecting` dims everything the player did NOT pick, which is the
                only cue that reads at a glance across eight fanned cards. */}
            <ul
              className={state.selectedCardIds.length > 0 ? "hand-fan hand-fan--selecting" : "hand-fan"}
              aria-label="내 손패"
              data-tutorial="hand"
              style={{ "--n": state.hand.length } as React.CSSProperties}
            >
              {state.hand.map((card, index) => (
                <li key={card.instanceId} style={{ "--i": index } as React.CSSProperties}>
                  <HwatuCard
                    dense
                    card={card}
                    selected={state.selectedCardIds.includes(card.instanceId)}
                    scoring={Boolean(preview?.breakdown.scoringCardIds.includes(card.instanceId))}
                    splitRole={splitRoleOf(card.instanceId)}
                    disabled={isDecision}
                    cupRole={card.tags.includes("cup") ? state.cupAssignments[card.instanceId] : undefined}
                    onSelect={(selected) => dispatch({ type: "SELECT_CARD", cardId: selected.instanceId })}
                  />
                </li>
              ))}
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
              <strong>{drawnCount} / {deckTotal}</strong>
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
              ) : (
                "짓이 맞지 않습니다"
              )}
              {yakuChoices.length > 1 ? (
                <em>
                  다른 갈래 {yakuChoices.length - 1}가지
                </em>
              ) : null}
            </span>
            <span>손패 {state.hand.length}장</span>
          </div>
        </div>

        {state.screen === "play" ? (
          <footer className="hand-actions">
            <button type="button" disabled={!state.selectedCardIds.length} onClick={() => dispatch({ type: "CLEAR_SELECTION" })}>선택 해제</button>
            <button type="button" className="primary-action" disabled={!preview || state.handsRemaining <= 0} data-tutorial="submit" onClick={() => dispatch({ type: "SUBMIT_HAND" })}><strong>제출</strong><span>{`${state.handsRemaining}회 남음`}</span></button>
            <button type="button" className="discard-action" disabled={!state.selectedCardIds.length || state.discardsRemaining <= 0} data-tutorial="discard" onClick={() => dispatch({ type: "DISCARD_SELECTED" })}><strong>버리기</strong><span>{state.discardsRemaining}회 남음</span></button>
          </footer>
        ) : (
          <footer className="decision-actions decision-actions--two">
            <button
              type="button"
              className="stop-action"
              data-tutorial="stop"
              disabled={goRequired}
              onClick={() => dispatch({ type: "STOP_ROUND" })}
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
              disabled={!goAvailable}
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
        targetScore={requirement}
        rewardLabel={`${baseReward}냥`}
        roundScore={state.chain.roundScore}
        submissionScore={state.chain.submissionScore}
        collectionScore={state.chain.collectionScore}
        goCount={state.chain.goCount}
        breakdown={shownBreakdown}
        reveal={state.lastScore && shownBreakdown === state.lastScore ? reveal : undefined}
        formulaCaption={
          shownBreakdown
            ? reveal.playing
              ? `효과 적용 중 ${reveal.index}/${reveal.count}`
              : shownBreakdown === state.lastScore
                ? "방금 낸 점수"
                : `짓 ${shownBreakdown.startingKkeut} × 끗패 배수 · 제출하면 효과가 붙습니다`
            : state.selectedCardIds.length
              ? "짓의 월 합이 10의 배수가 되어야 합니다"
              : "2~5장을 고르면 가장 높은 짓·끗패 갈래가 자동으로 붙습니다"
        }
        handsRemaining={state.handsRemaining}
        discardsRemaining={state.discardsRemaining}
        money={state.money}
        stageIndex={state.stage}
        stageTotal={12}
        seed={state.seed}
        onOpenRules={() => setRulesOpen(true)}
        onRestart={() => setRestartOpen(true)}
      />

      <CupChoiceModal
        card={pendingCupCard}
        onChoose={(role) => {
          if (state.pendingCupCardId) {
            dispatch({ type: "ASSIGN_CUP_ROLE", cardId: state.pendingCupCardId, role });
          }
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
      <RulesModal open={rulesOpen} onClose={() => setRulesOpen(false)} />
      <GameModal id="restart-run" open={restartOpen} assetTag="ui:warning:restart" title="현재 런을 끝낼까요?" description="저장된 달력과 덱이 초기화됩니다." onClose={() => setRestartOpen(false)} actions={[{ id: "cancel", label: "계속 플레이", onClick: () => setRestartOpen(false) }, { id: "reset", label: "제목으로", variant: "danger", onClick: resetToTitle }]} />
    </div>
  );
}

/** Card pack payout: pick N of the candidates, each carrying an effect tag. */
function PackPickModal({ pack, onPick, onClose }: {
  pack: GameState["pendingPack"];
  onPick: (instanceId: string) => void;
  onClose: () => void;
}) {
  const packKindLabel = (card: CardInstance) => {
    if (card.kind === "chaff" && card.chaffValue === 2) return "쌍피";
    if (card.kind === "bright") return "광";
    if (card.kind === "animal") return "동물";
    if (card.kind === "ribbon") return "띠";
    return "피";
  };
  const [opened, setOpened] = useState(false);
  const [opening, setOpening] = useState(false);
  const [revealedCount, setRevealedCount] = useState(0);
  const [initialRevealCount] = useState(() => pack?.candidates.length ?? 0);
  const packSlug = pack?.packId === "pack_hwatu_large" ? "hwatu-large" : "hwatu-small";
  const packAssetTag = `pack:${packSlug}`;
  const packArtUrl = getGeneratedAssetUrl(packAssetTag);

  useEffect(() => {
    if (!opened) return;
    const timers = Array.from({ length: initialRevealCount }, (_, index) => window.setTimeout(() => {
      setRevealedCount(index + 1);
      playCardRevealSound(index);
    }, 180 + index * 145));
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [initialRevealCount, opened]);

  const handleOpen = () => {
    if (opening) return;
    playPackOpenSound();
    window.navigator.vibrate?.([18, 28, 32]);
    setOpening(true);
    setRevealedCount(0);
    window.setTimeout(() => setOpened(true), 520);
  };

  const handlePick = (instanceId: string) => {
    playCardPickSound();
    window.navigator.vibrate?.(18);
    onPick(instanceId);
  };

  return (
    <GameModal
      id="pack-pick"
      open={Boolean(pack)}
      assetTag={packAssetTag}
      title={pack ? (opened ? `${pack.name} · ${pack.picksLeft}장 고르기` : `${pack.name} 개봉`) : "화투 묶음"}
      description={opened ? "가져갈 패를 고르세요. 패에 붙은 효과도 덱에 그대로 들어갑니다." : "매듭을 풀고 봉인을 뜯어 안에 든 패를 확인하세요."}
      closeOnBackdrop={false}
      closeLabel="그만 고르기"
      onClose={onClose}
      className="game-modal--pack"
      actions={opened ? [{ id: "close", label: "그만 고르기", onClick: onClose }] : []}
    >
      {!opened ? (
        <div className="pack-opening" data-tutorial="pack-picks">
          <button type="button" className={opening ? "pack-opening__bundle pack-opening__bundle--opening" : "pack-opening__bundle"} onClick={handleOpen} disabled={opening}>
            <span className="pack-opening__art" aria-hidden="true" style={packArtUrl ? { backgroundImage: `url("${packArtUrl}")` } : undefined} />
            <span className="pack-opening__cord" aria-hidden="true" />
            <span className="pack-opening__seal" aria-hidden="true">花</span>
            <strong>{opening ? "봉인을 뜯는 중…" : "봉인 뜯기"}</strong>
          </button>
          <p>눌러서 묶음을 개봉하세요</p>
        </div>
      ) : (
        <ul className="pack-picks pack-picks--revealing" data-tutorial="pack-picks">
          {pack?.candidates.map((card, index) => {
            const tag = card.effectTagId ? CARD_EFFECT_TAG_BY_ID[card.effectTagId] : undefined;
            return (
              <li className={index < revealedCount ? "pack-picks__item pack-picks__item--revealed" : "pack-picks__item"} key={card.instanceId}>
                <HwatuCard
                  card={card}
                  className="pack-pick__card"
                  onSelect={() => handlePick(card.instanceId)}
                  ariaLabel={`${card.month}월 ${card.name}${tag ? `, ${tag.name}` : ""}`}
                />
                <div className={tag ? `pack-pick__details pack-pick__details--${tag.id.replaceAll("_", "-")}` : "pack-pick__details pack-pick__details--plain"}>
                  <div className="pack-pick__identity">
                    <span><b>{card.month}월</b> · {packKindLabel(card)}</span>
                    <small>{card.monthName}</small>
                  </div>
                  {tag ? (
                    <div className="pack-pick__effect-copy">
                      <span className="pack-pick__effect-icon" aria-hidden="true">{tag.icon}</span>
                      <span><b>{tag.name}</b><small>{tag.description}</small></span>
                    </div>
                  ) : (
                    <div className="pack-pick__effect-copy pack-pick__effect-copy--none">
                      <span className="pack-pick__effect-icon" aria-hidden="true">無</span>
                      <span><b>기본패</b><small>추가 효과 없음</small></span>
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </GameModal>
  );
}

function CupChoiceModal({ card, onChoose }: {
  card: CardInstance | null;
  onChoose: (role: "animal" | "double_chaff") => void;
}) {
  return (
    <GameModal
      id="cup-role"
      open={Boolean(card)}
      assetTag={card?.assetTag ?? "card-09-animal-cup"}
      title="술잔을 수집판 어디에 기록할까요?"
      description="이번 손의 점수는 이미 확정됐습니다. 이 선택은 수집판 기록과 앞으로의 지속 배수에만 적용됩니다."
      closeOnBackdrop={false}
      closeLabel="나중에"
      onClose={() => onChoose("animal")}
      actions={[
        { id: "animal", label: "동물로 기록 · 동물 1장", variant: "primary", onClick: () => onChoose("animal") },
        { id: "chaff", label: "피로 기록 · 피 2점", variant: "primary", onClick: () => onChoose("double_chaff") },
      ]}
    >
      <div className="rules-copy">
        <section>
          <h3>동물로 기록</h3>
          <p>동물 줄이 한 칸 채워집니다. 동물 5장 <strong>+2배수</strong>와 그 뒤 장당 <strong>+0.5배수</strong>를 노릴 때 유리합니다.</p>
        </section>
        <section>
          <h3>피로 기록</h3>
          <p>피 줄이 두 칸 채워집니다. 피 5점 <strong>+1배수</strong>, 10점 <strong>+4배수</strong> 문턱을 앞당길 때 유리합니다.</p>
        </section>
      </div>
    </GameModal>
  );
}

/**
 * Two pages: the rules in as few words as they can be said, and the 끗패 ladder
 * drawn with the real cards.
 *
 * The ladder used to live only in the rules text, which meant a player had to
 * read "1월 광과 3월 광" and then go hunting for those cards. Showing the actual
 * pictures is the difference between a rule and a thing you can recognise.
 */
function RulesModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [page, setPage] = useState<"rules" | "yaku">("rules");
  const deck = useMemo(() => createStandardHwatuDeck(), []);
  const cardOf = (month: number, kind: CardInstance["kind"]) =>
    deck.find((card) => card.month === month && card.kind === kind) ?? null;

  return (
    <GameModal
      id="rules"
      open={open}
      assetTag="ui:rules:scroll"
      title={page === "rules" ? "규칙" : "끗패 족보"}
      description={page === "rules"
        ? "낸 패를 짓과 끗패로 갈라 곱합니다."
        : "두 장으로 만드는 족보입니다. 위로 갈수록 셉니다."}
      onClose={onClose}
    >
      <div className="rules-tabs" role="tablist">
        <button type="button" role="tab" aria-selected={page === "rules"} onClick={() => setPage("rules")}>규칙</button>
        <button type="button" role="tab" aria-selected={page === "yaku"} onClick={() => setPage("yaku")}>끗패 족보</button>
      </div>

      {page === "rules" ? (
        <ol className="rules-steps">
          <li><b>2~5장</b>을 클릭해 냅니다.</li>
          <li>그중 <b>두 장이 끗패</b>가 되어 <b>배수</b>를 정합니다. 두 장의 월을 더한 끝자리가 끗수입니다.</li>
          <li>나머지가 <b>짓</b>입니다. 짓의 월 합이 <b>10의 배수</b>여야 낼 수 있고, 그 합이 <b>월 합</b>이 됩니다.</li>
          <li>점수는 <b>월 합 × 배수</b>. 나누는 방법이 여럿이면 가장 높은 쪽이 자동으로 붙습니다.</li>
          <li>낸 패는 왼쪽 <b>수집판</b>에 쌓입니다. 줄을 채울수록 배수가 곱해집니다.</li>
          <li>목표를 넘긴 순간 <b>고</b>와 <b>스톱</b>을 고릅니다. 고는 판돈을 불리지만 문턱도 올라갑니다.</li>
        </ol>
      ) : (
        <ul className="yaku-list">
          {[...ALL_IMMEDIATE_YAKU_DEFINITIONS]
            .slice()
            .sort((left, right) => right.baseHeung - left.baseHeung)
            .map((yaku) => {
              const sample = YAKU_SAMPLES[yaku.id];
              return (
                <li className="yaku-list__row" key={yaku.id}>
                  <span className="yaku-list__cards">
                    {sample
                      ? sample.map(([month, kind], index) => {
                          const card = cardOf(month, kind);
                          return card ? (
                            <span
                              className="yaku-sample"
                              key={`${yaku.id}-${index}`}
                              title={`${card.month}월 ${card.name}`}
                            >
                              <span
                                className="yaku-sample__art"
                                style={{ backgroundPosition: getAtlasPosition(card) }}
                                aria-hidden="true"
                              />
                              <b>{card.month}</b>
                            </span>
                          ) : null;
                        })
                      : null}
                  </span>
                  <span className="yaku-list__name">
                    <strong>{yaku.name}</strong>
                    <em>{yaku.description}</em>
                  </span>
                  <b className="yaku-list__heung">×{yaku.baseHeung}</b>
                </li>
              );
            })}
        </ul>
      )}
    </GameModal>
  );
}
