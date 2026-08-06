"use client";

import { useEffect, useMemo, useReducer, useState } from "react";

import { BOSS_BY_ID } from "@/game/content/bosses";
import { CONTRACTS, WEATHER_BY_ID } from "@/game/content/meta";
import { getStageDefinition } from "@/game/content/stages";
import { TALISMAN_BY_ID } from "@/game/content/talismans";
import { ALL_IMMEDIATE_YAKU_DEFINITIONS } from "@/game/content/yaku";
import { CARD_EFFECT_TAG_BY_ID } from "@/game/content/card-effects";
import { calculateCollectionBonus, GODORI_MONTHS } from "@/game/engine/collection-bonus";
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
} from "@/game/state/game";
import { clearSavedGame, loadGame, saveGame } from "@/game/state/storage";
import type {
  CardInstance,
  ExperimentalRules,
  GameState,
} from "@/game/types";

import { AssetPlaceholder } from "./components/AssetPlaceholder";
import { CollectionBoard, type CollectionBoardItem } from "./components/CollectionBoard";
import { GameModal } from "./components/GameModal";
import { HwatuCard } from "./components/HwatuCard";
import { MarketScreen } from "./components/MarketScreen";
import { PlayRail } from "./components/PlayRail";
import { RunEndScreen } from "./components/RunEndScreen";
import { TalismanStrip } from "./components/TalismanStrip";
import { TitleScreen, type ExperimentalRuleOption } from "./components/TitleScreen";
import { TutorialSpotlight } from "./components/TutorialSpotlight";
import { TUTORIAL_STEPS } from "./components/tutorial-steps";
import "./game.css";

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
  const confirmed = calculateCollectionBonus(confirmedCards, state.cupAssignments);
  const total = calculateCollectionBonus([...confirmedCards, ...pendingCards], state.cupAssignments);
  const pendingCount = (track: keyof typeof total.counts): number =>
    Math.max(0, total.counts[track] - confirmed.counts[track]);

  return [
    {
      id: "bright",
      name: "광",
      kind: "bright",
      assetTag: "collection:bright-five-slots",
      description: "다섯 광 중 모은 패만 빛납니다",
      confirmedCount: confirmed.counts.bright,
      pendingCount: pendingCount("bright"),
      milestones: [
        { at: 3, label: "3장", reward: "+2배수" },
        { at: 4, label: "4장", reward: "+4배수" },
        { at: 5, label: "5장", reward: "+7배수" },
      ],
    },
    {
      id: "animal",
      name: "동물",
      kind: "animal",
      assetTag: "collection:animal-track",
      description: "동물 그림패 전체",
      confirmedCount: confirmed.counts.animal,
      pendingCount: pendingCount("animal"),
      slotCount: 10,
      milestones: [
        { at: 5, label: "5장", reward: "+2배수" },
        { at: 6, label: "그 뒤", reward: "+0.5/장" },
      ],
    },
    {
      id: "godori",
      name: "고도리",
      kind: "godori",
      assetTag: "collection:godori-track",
      description: "2·4·8월 새 · 동물 줄에도 함께 집계",
      confirmedCount: confirmed.counts.godori,
      pendingCount: pendingCount("godori"),
      slotLabels: GODORI_MONTHS.map((month) => `${month}월`),
      slotStates: GODORI_MONTHS.map((month) =>
        confirmed.matchedGodoriMonths.includes(month)
          ? "confirmed"
          : total.matchedGodoriMonths.includes(month)
            ? "pending"
            : "empty",
      ),
      milestones: [
        { at: 3, label: "세 마리", reward: "+2배수", active: total.completedSets.godori },
      ],
    },
    {
      id: "ribbon",
      name: "띠",
      kind: "ribbon",
      assetTag: "collection:ribbon-track",
      description: "띠 전체 · 홍단·초단·청단은 조합 보너스",
      confirmedCount: confirmed.counts.ribbon,
      pendingCount: pendingCount("ribbon"),
      slotCount: 10,
      milestones: [
        { at: 3, label: "홍단", reward: "+2", active: total.completedSets.hongdan },
        { at: 3, label: "초단", reward: "+2", active: total.completedSets.chodan },
        { at: 3, label: "청단", reward: "+2", active: total.completedSets.cheongdan },
        { at: 5, label: "5장", reward: "+2배수" },
        { at: 6, label: "그 뒤", reward: "+0.5/장" },
      ],
    },
    {
      id: "chaff",
      name: "피",
      kind: "chaff",
      assetTag: "collection:chaff-ten-slots",
      description: "쌍피는 두 칸 · 10을 넘으면 월 합도 성장",
      confirmedCount: confirmed.counts.chaff,
      pendingCount: pendingCount("chaff"),
      milestones: [
        { at: 5, label: "5피", reward: "+1배수" },
        { at: 10, label: "10피", reward: "+4배수" },
        { at: 11, label: "초과", reward: "월 합 +1/피" },
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
  const weather = WEATHER_BY_ID[state.experimentalRules.weather ? stage.weatherId : "clear"];
  return (
    <main className="intro-screen">
      <p className="eyebrow">CALENDAR {String(stage.month).padStart(2, "0")} / 12</p>
      <AssetPlaceholder assetTag={stage.assetTag} label={stage.name} description={stage.subtitle} tone={boss ? "boss" : "neutral"} />
      <div className="intro-screen__copy">
        <span>{stage.month}월 스테이지</span>
        <h1>{stage.name}</h1>
        <p>{stage.subtitle}</p>
        <strong>목표 {format(introTarget)}점</strong>
      </div>
      <div className="intro-screen__rules">
        <article>
          <AssetPlaceholder assetTag={weather.assetTag} label={`날씨 · ${weather.name}`} description={weather.description} compact />
        </article>
        <article>
          <AssetPlaceholder assetTag={boss?.assetTag ?? "boss:none"} label={boss ? `두목 · ${boss.name}` : "일반 판"} description={boss?.description ?? "이번 달에는 두목 규칙이 없습니다."} tone={boss ? "boss" : "neutral"} compact />
          {boss ? <small>대응법: {boss.counterplay}</small> : null}
        </article>
      </div>
      {state.calendarStamps.length ? (
        <div className="calendar-strip" aria-label="완료한 달력 도장">
          {state.calendarStamps.map((stamp) => <code key={`${stamp.stage}-${stamp.yakuId}`}>{stamp.month}월 · {stamp.yakuId}</code>)}
        </div>
      ) : null}
      <div className="intro-screen__actions">
        <button className="primary-action" type="button" onClick={onStart}>패 섞고 시작</button>
        <button type="button" onClick={onDeck}>내 덱 보기</button>
        <button type="button" onClick={onRules}>규칙 읽기</button>
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
          <p>{definition?.description ?? "월·종류·강화 태그와 모든 이미지 교체용 assetTag를 확인합니다."}</p>
        </div>
        <AssetPlaceholder assetTag={definition?.assetTag ?? "ui:deck-editor"} label={definition?.name ?? "덱 편집기"} description={definition ? `${minTargets}~${maxTargets}장 선택` : "텍스트 플레이스홀더 목록"} tone={definition && !isPainter ? "boss" : "card"} />
      </header>
      {optionConfig ? (
        <label className="editor-option">
          <span>{optionConfig.label}</span>
          <select value={option} onChange={(event) => setOption(event.target.value)}>
            {optionConfig.values.map((entry) => <option value={entry.value} key={entry.value}>{entry.label}</option>)}
          </select>
        </label>
      ) : null}
      <div className="deck-editor-grid">
        {state.deck.map((card) => {
          const selected = state.pendingTargetIds.includes(card.instanceId);
          return (
            <button
              type="button"
              key={card.instanceId}
              aria-pressed={selected}
              className={selected ? "deck-editor-card deck-editor-card--selected" : "deck-editor-card"}
              disabled={!definition}
              onClick={() => dispatch({ type: "SELECT_CONSUMABLE_TARGET", cardId: card.instanceId })}
            >
              <strong>{card.month}월 · {card.kind}</strong>
              <span>{card.name}</span>
              <code>{card.assetTag}</code>
              <small>{[card.enhancement, card.edition, card.seal].filter(Boolean).join(" · ") || "기본패"}</small>
            </button>
          );
        })}
      </div>
      <section className="codex-summary">
        <div>
          <h2>끗패 배수 레벨</h2>
          <ul>{ALL_IMMEDIATE_YAKU_DEFINITIONS.map((yaku) => <li key={yaku.id}><span>{yaku.name}</span><strong>Lv.{state.yakuLevels[yaku.id]?.level ?? 1}</strong><code>{yaku.assetTag}</code></li>)}</ul>
        </div>
        <div>
          <h2>발견한 광땡</h2>
          <ul>{state.unlockedSecretYakuIds.length ? state.unlockedSecretYakuIds.map((id) => <li key={id}>{ALL_IMMEDIATE_YAKU_DEFINITIONS.find((entry) => entry.id === id)?.name ?? id}</li>) : <li>아직 발견하지 못했습니다.</li>}</ul>
        </div>
      </section>
      <footer className="sticky-editor-actions">
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
  const yakuChoices = useMemo(() => {
    const candidates = findImmediateYakuCandidates(selectedCards, {
      cupRole: preview?.usedCupRole ?? "animal",
      allowFiveMultipleJit: state.talismans.some((item) => item.definitionId === "t_leap_calendar"),
      includeSecretYaku: true,
    });
    return [...new Set(candidates.map((entry) => entry.yakuId))];
  }, [selectedCards, preview?.usedCupRole, state.talismans]);
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
          subtitle="열두 달을 고쳐 만드는 화투 로그라이크"
          description="짓고땡으로 점수를 냅니다. 낸 패를 짓(월 합)과 끗패(배수)로 갈라 곱하고, 안전하게 저장할지 고를 외쳐 더 크게 걸지 고르는 덱빌딩 게임입니다. 모든 그림 자리는 교체 가능한 assetTag 텍스트로 남겨 둔 프로토타입입니다."
          versionLabel="NAN 2026 PROTOTYPE · v0.3"
          experimentalRules={state.experimentalRules}
          experimentalRuleOptions={EXPERIMENT_OPTIONS}
          canContinue={Boolean(savedState)}
          continueSummary={savedState ? `${savedState.stage}월 · ${format(savedState.chain.roundScore)}점` : undefined}
          onToggleExperimentalRule={(key: keyof ExperimentalRules) => dispatch({ type: "TOGGLE_EXPERIMENT", key })}
          onNewGame={() => dispatch({ type: "START_RUN", startDeckId: "deck_standard", tutorialMode })}
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
          lines: [`남은 제출 ${state.handsRemaining}회`, `${state.chain.goCount}고`, `달력 도장 ${state.calendarStamps.length}개`],
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
          onRestart={() => dispatch({ type: "START_RUN", startDeckId: "deck_standard", tutorialMode: state.tutorialMode })}
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
  const shownBreakdown = isDecision ? state.lastScore : preview?.breakdown ?? null;
  const drawnCount = state.drawPile.length;
  const deckTotal = state.deck.length;

  return (
    <div className="play-shell">
      <aside className="play-side" data-tutorial="collection">
        <CollectionBoard assetTag="ui:collection-board" items={collections} />
      </aside>

      <main className="play-board">
        <div className="play-board__top" data-tutorial="talisman">
          <TalismanStrip assetTag="ui:talisman-strip" items={talismanItems} slots={getEffectiveTalismanSlots(state)} />
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

          <div className="hand-sort" role="group" aria-label="손패 정렬" data-tutorial="sort">
            <span>정렬</span>
            <button
              type="button"
              className={state.handSort === "month" ? "active" : ""}
              aria-pressed={state.handSort === "month"}
              onClick={() => dispatch({ type: "SET_HAND_SORT", mode: "month" })}
            >
              월 순
            </button>
            <button
              type="button"
              className={state.handSort === "kind" ? "active" : ""}
              aria-pressed={state.handSort === "kind"}
              onClick={() => dispatch({ type: "SET_HAND_SORT", mode: "kind" })}
            >
              광·동물·띠·피
            </button>
          </div>

          <div className="play-board__stage">
            <ul className="hand-fan" aria-label="내 손패" data-tutorial="hand" style={{ "--n": state.hand.length } as React.CSSProperties}>
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

            <div className="deck-stack" aria-label={`남은 덱 ${drawnCount}장`}>
              <div className="deck-stack__back" data-asset-tag="ui:card-back:hanji">
                <span aria-hidden="true">IMG</span>
                <code>ui:card-back:hanji</code>
              </div>
              <strong>{drawnCount} / {deckTotal}</strong>
            </div>
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
        goCount={state.chain.goCount}
        breakdown={shownBreakdown}
        formulaCaption={
          shownBreakdown
            ? isDecision
              ? "방금 낸 점수"
              : `짓 ${shownBreakdown.startingKkeut} × 끗패 배수`
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
        onOpenDeck={() => dispatch({ type: "OPEN_SCREEN", screen: "deck_editor" })}
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
  return (
    <GameModal
      id="pack-pick"
      open={Boolean(pack)}
      assetTag={`pack:${pack?.packId ?? "hwatu"}`}
      title={pack ? `${pack.name} · ${pack.picksLeft}장 더 고르세요` : "묶음"}
      description="고른 카드는 덱에 영구히 들어갑니다. 각 카드에 붙은 효과는 그 카드가 손에 들어올 때마다 따라옵니다."
      closeOnBackdrop={false}
      closeLabel="그만 고르기"
      onClose={onClose}
      actions={[{ id: "close", label: "그만 고르기", onClick: onClose }]}
    >
      <ul className="pack-picks" data-tutorial="pack-picks">
        {pack?.candidates.map((card) => {
          const tag = card.effectTagId ? CARD_EFFECT_TAG_BY_ID[card.effectTagId] : undefined;
          return (
            <li key={card.instanceId}>
              <button type="button" className="pack-pick" onClick={() => onPick(card.instanceId)}>
                <span className="pack-pick__art" data-asset-tag={card.assetTag}>
                  <span aria-hidden="true">IMG</span>
                  <b>{card.month}</b>
                </span>
                <strong>{card.month}월 {card.monthName}</strong>
                <span className="pack-pick__kind">{card.name}</span>
                {tag ? (
                  <span className="pack-pick__tag">
                    <b>{tag.name}</b>
                    <em>{tag.description}</em>
                  </span>
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>
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

function RulesModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <GameModal id="rules" open={open} assetTag="ui:rules:scroll" title="꽃판 규칙 요약" description="짓고땡 제출과 고·스톱의 선택을 간단히 정리했습니다." onClose={onClose}>
      <div className="rules-copy">
        <section><h3>1. 2~5장을 클릭</h3><p>손패에서 두 장부터 다섯 장까지 클릭합니다. 드래그는 없습니다. 낸 패는 짓과 끗패로 갈립니다.</p></section>
        <section><h3>2. 끗패 — 배수</h3><p>두 장이 끗패가 됩니다. 두 장의 월을 더한 끝자리가 끗수이고, 9면 갑오, 0이면 망통입니다. 1·2 알리, 1·4 독사, 1·9 구삥, 1·10 장삥, 4·10 장사, 4·6 세륙은 이름이 따로 붙은 특수패라 숫자보다 셉니다. 같은 월 두 장은 땡, 10월 두 장은 장땡, 광 두 장이 만나면 광땡입니다.</p></section>
        <section><h3>3. 짓 — 월 합</h3><p>끗패를 뺀 나머지가 짓입니다. 짓에 들어간 카드들의 월 합이 10의 배수여야 제출이 되고, 그 합이 그대로 월 합이 됩니다. 두 장만 낼 때는 짓이 없어 월 합 1에서 시작합니다.</p></section>
        <section><h3>4. 점수</h3><p>월 합 × 배수입니다. 배수는 끗패에 광·동물·고도리·띠·피 수집과 부적이 얹은 값입니다. 갈래가 여럿이면 점수가 가장 높은 쪽이 자동으로 붙습니다. 9월 술잔은 점수를 낸 뒤 동물과 피 중 어디에 기록할지 직접 고릅니다.</p></section>
        <section><h3>5. 고 · 스톱</h3><p>제출한 점수는 이번 판에 계속 쌓입니다. 목표를 넘긴 순간에만 고와 스톱을 고릅니다. 스톱은 지금 판돈을 받고 끝내고, 고는 문턱을 1.8배 → 2.8배 → 4.2배로 올리는 대신 판돈을 1.7배 → 2.7배 → 4.2배로 불립니다. 남은 제출로 그 문턱을 못 넘기면 런이 끝납니다.</p></section>
        <section><h3>6. 덱빌딩</h3><p>모든 런은 기본 48장으로 시작합니다. 매달 장터에서 부적·끗패 성장·덱 손질·금단 계약을 골라 나만의 덱으로 바꿉니다.</p></section>
      </div>
      </GameModal>
  );
}
