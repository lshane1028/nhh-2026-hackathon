"use client";

import { useEffect, useMemo, useReducer, useState } from "react";

import { BOSS_BY_ID } from "@/game/content/bosses";
import { CONTRACTS, WEATHER_BY_ID } from "@/game/content/meta";
import { getStageDefinition } from "@/game/content/stages";
import { TALISMAN_BY_ID } from "@/game/content/talismans";
import { ALL_IMMEDIATE_YAKU_DEFINITIONS } from "@/game/content/yaku";
import { calculateCollectionBonus } from "@/game/engine/collection-bonus";
import { calculateGoRequirement, canGo, getNextHandMinimum } from "@/game/engine/go";
import { canDeclareShake } from "@/game/engine/experimental";
import { findImmediateYakuCandidates } from "@/game/engine/yaku";
import {
  createInitialGameState,
  evaluateSelectedHand,
  gameReducer,
  getDefinitionForOffer,
  getEffectiveTalismanSlots,
  getPendingConsumableDefinition,
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
import { GameTopBar } from "./components/GameTopBar";
import { HwatuCard } from "./components/HwatuCard";
import { MarketScreen, type MarketShopChoice } from "./components/MarketScreen";
import { RunEndScreen } from "./components/RunEndScreen";
import { ScoreFormula } from "./components/ScoreFormula";
import { TalismanStrip } from "./components/TalismanStrip";
import { TitleScreen, type ExperimentalRuleOption } from "./components/TitleScreen";
import { TutorialCoach } from "./components/TutorialCoach";
import "./game.css";

const EXPERIMENT_OPTIONS: ExperimentalRuleOption[] = [
  { id: "bombsAndShake", label: "흔들기", description: "같은 월 3장을 함께 내면 이번 판의 정산 보너스를 올립니다.", assetTag: "rule:shake" },
  { id: "bakContracts", label: "광박·피박·멍박", description: "판 종료 시 완성한 수집 경로에 따라 추가 냥을 받는 계약.", assetTag: "rule:bak-contracts" },
  { id: "weather", label: "월별 날씨", description: "비·바람·눈이 특정 카드의 월 합이나 재발동을 바꿉니다.", assetTag: "rule:weather" },
  { id: "nagariRetry", label: "나가리 재승부", description: "12월 최종 두목에게 한 번 패하면 제출 1회를 내고 재도전.", assetTag: "rule:nagari-retry" },
];

const SHOP_CHOICES: MarketShopChoice[] = [
  { category: "talisman", label: "부적전", description: "사두면 매 손 자동으로 발동하는 지속 효과를 팝니다.", assetTag: "shop:talisman" },
  { category: "painter", label: "화공방", description: "내 덱의 카드 한 장을 영구 강화하거나 바꿉니다.", assetTag: "shop:painter" },
  { category: "book", label: "비결서점", description: "족보의 기본 배수를 영구적으로 키웁니다.", assetTag: "shop:book" },
  { category: "forbidden", label: "금단장", description: "강력한 효과를 얻는 대신 영구적인 대가를 치릅니다.", assetTag: "shop:forbidden" },
];

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
  const confirmedCards = cardsFor(state, state.chain.confirmedCollection.cardIds);
  const pendingCards = cardsFor(state, state.chain.pendingCollection.cardIds);
  const confirmed = calculateCollectionBonus(confirmedCards, state.cupRole);
  const total = calculateCollectionBonus([...confirmedCards, ...pendingCards], state.cupRole);
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
      description: "동물 그림패 전체 · 고도리는 별도 보너스",
      confirmedCount: confirmed.counts.animal,
      pendingCount: pendingCount("animal"),
      slotCount: 10,
      milestones: [
        { at: 3, label: "고도리", reward: "+2배수", active: total.completedSets.godori },
        { at: 5, label: "5장", reward: "+2배수" },
        { at: 6, label: "그 뒤", reward: "+0.5/장" },
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
          <h2>족보 배수 레벨</h2>
          <ul>{ALL_IMMEDIATE_YAKU_DEFINITIONS.map((yaku) => <li key={yaku.id}><span>{yaku.name}</span><strong>Lv.{state.yakuLevels[yaku.id]?.level ?? 1}</strong><code>{yaku.assetTag}</code></li>)}</ul>
        </div>
        <div>
          <h2>발견한 비밀 족보</h2>
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
      cupRole: state.cupRole,
      connectYear: state.talismans.some((item) => item.definitionId === "t_leap_calendar"),
      includeSecretYaku: true,
    });
    return [...new Set(candidates.map((entry) => entry.yakuId))];
  }, [selectedCards, state.cupRole, state.talismans]);
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
          description="48장 화투패의 월 숫자를 더하고 족보 배수를 키우세요. 안전하게 저장할지, 고를 외쳐 더 크게 걸지 선택하는 덱빌딩 게임입니다. 모든 그림 자리는 교체 가능한 assetTag 텍스트로 남겨 둔 프로토타입입니다."
          versionLabel="NAN 2026 PROTOTYPE · v0.3"
          experimentalRules={state.experimentalRules}
          experimentalRuleOptions={EXPERIMENT_OPTIONS}
          canContinue={Boolean(savedState)}
          continueSummary={savedState ? `${savedState.stage}월 · ${format(savedState.chain.confirmedScore)}점` : undefined}
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
    return (
      <div className="game-root">
        <MarketScreen
          mode="reward"
          assetTag="ui:reward:ink-pouch"
          stageLabel={stage.name}
          money={state.money}
          reward={{ assetTag: `reward:stage-${state.stage}`, amount: state.lastRoundReward, title: "판돈과 박 보상", description: `${state.chain.confirmedScore.toLocaleString("ko-KR")}점으로 목표 달성`, lines: [`남은 제출 ${state.handsRemaining}회`, `${state.chain.confirmedGoCount}고 확정`, `달력 도장 ${state.calendarStamps.length}개`] }}
          onContinue={() => dispatch({ type: "CONTINUE_AFTER_REWARD" })}
        />
      </div>
    );
  }

  if (state.screen === "shop_choice") {
    const firstShopTutorial = state.tutorialMode && state.stage === 1;
    return (
      <div className="game-root">
        <MarketScreen
          mode="shop_choice"
          assetTag="ui:market:crossroads"
          stageLabel={`${stage.name} 완료`}
          money={state.money}
          choices={SHOP_CHOICES.map((choice) => ({
            ...choice,
            recommended: firstShopTutorial && choice.category === "book",
          }))}
          coach={firstShopTutorial ? {
            step: 1,
            total: 2,
            title: "장터는 내 덱을 고치는 곳입니다",
            body: "매 스테이지 뒤에 상점 하나를 고릅니다. 부적은 자동 효과, 비결서는 족보 배수, 화공은 카드 강화, 금단장은 강한 효과와 대가를 다룹니다.",
            actionHint: "첫 방문에는 규칙이 가장 단순한 ‘비결서점’을 선택해 보세요.",
            targetLabel: "비결서점",
          } : undefined}
          onChooseShop={(shopType) => dispatch({ type: "CHOOSE_SHOP", shopType })}
        />
      </div>
    );
  }

  if (state.screen === "shop") {
    const baseOffers = state.shopOffers.flatMap((offer) => {
      const definition = getDefinitionForOffer(offer);
      const detailLabel = offer.category === "pack"
        ? "개봉하면 무료 후보 3개"
        : offer.category === "talisman"
          ? "구매 즉시 빈 부적 칸에 장착"
          : offer.category === "book"
            ? "구매 즉시 족보 배수 레벨 +1"
            : "구매 후 강화할 카드를 선택";
      return definition ? [{ offer, name: definition.name, description: definition.description, assetTag: definition.assetTag, detailLabel }] : [];
    });
    const firstShopTutorial = state.tutorialMode && state.stage === 1;
    const recommendedOffer = baseOffers.find(({ offer }) => !offer.sold && offer.price <= state.money)
      ?? baseOffers.find(({ offer }) => !offer.sold);
    const offers = baseOffers.map((entry) => ({
      ...entry,
      recommended: firstShopTutorial && entry.offer.offerId === recommendedOffer?.offer.offerId,
    }));
    return (
      <div className="game-root">
        <MarketScreen
          mode="shop"
          assetTag={`ui:shop:${state.shopType}`}
          stageLabel={`${state.stage}월 장터`}
          money={state.money}
          offers={offers}
          rerollCost={state.rerollCost}
          canReroll={true}
          coach={firstShopTutorial ? {
            step: 2,
            total: 2,
            title: "상품은 한 번 사면 이번 런에 계속 남습니다",
            body: state.shopType === "book"
              ? "비결서는 적힌 족보의 배수를 영구적으로 한 단계 올립니다. 자주 만들기 쉬운 족보부터 키우면 안정적입니다."
              : "가격과 효과를 읽고 지금 덱에 필요한 상품을 고르세요. 추천 표시는 현재 가진 냥으로 살 수 있는 첫 상품입니다.",
            actionHint: recommendedOffer && recommendedOffer.offer.price <= state.money
              ? `‘${recommendedOffer.name}’을 구매해 보세요.`
              : "살 수 없다면 상점을 나가 다음 판을 시작하세요.",
            targetLabel: recommendedOffer?.name,
          } : undefined}
          onBuyOffer={(offerId) => dispatch({ type: "BUY_OFFER", offerId })}
          onReroll={() => dispatch({ type: "REROLL_SHOP" })}
          onLeave={() => dispatch({ type: "NEXT_STAGE" })}
        />
      </div>
    );
  }

  if (state.screen === "contract") {
    const contracts = state.contractChoices.flatMap((id) => {
      const definition = CONTRACTS.find((entry) => entry.id === id);
      return definition ? [{ definition }] : [];
    });
    return (
      <div className="game-root">
        <MarketScreen mode="contract" assetTag="ui:contract:season-scroll" stageLabel={`${state.stage}월 계절 결산`} money={state.money} contracts={contracts} selectedContractId={selectedContract} onSelectContract={setSelectedContract} onConfirmContract={() => { if (selectedContract) { dispatch({ type: "CHOOSE_CONTRACT", contractId: selectedContract }); setSelectedContract(null); } }} />
      </div>
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
          finalScore={state.chain.confirmedScore}
          targetScore={state.targetScore}
          money={state.money}
          seed={state.seed}
          stats={state.stats}
          summary={isWin ? "열두 달을 모두 도장 찍었습니다. 같은 덱으로 무한 달력을 이어갈 수 있습니다." : "덱은 사라지지 않았습니다. 같은 시드로 다시 설계해 보세요."}
          failureReason={!isWin ? `${format(Math.max(0, state.targetScore - state.chain.confirmedScore))}점 부족` : undefined}
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

  const nextMinimum = getNextHandMinimum(state.chain);
  const goAvailable = canGo(state.chain, state.targetScore, state.handsRemaining);
  const nextGoRequirement = goAvailable
    ? calculateGoRequirement(state.chain.pot, state.targetScore, (state.chain.successfulGoCount + 1) as 1 | 2 | 3)
    : null;
  const shakeReady = canDeclareShake(selectedCards, state.experimentalRules);
  const firstLesson = state.tutorialMode && state.stage === 1;
  const playTutorial = state.screen === "decision"
    ? {
        step: 5,
        total: 5,
        title: "첫 점수를 안전하게 저장해 보세요",
        body: "방금 만든 점수는 아직 ‘이번 승부’에 있습니다. 저장하면 누적 점수가 되고, 고를 누르면 다음 손까지 더 큰 점수를 노리는 대신 실패 위험이 생깁니다.",
        actionHint: "이번에는 ‘저장하고 계속’을 눌러 보세요.",
        targetLabel: "저장하고 계속",
      }
    : state.roundSubmissionIndex > 0 || state.chain.confirmedScore > 0
      ? {
          step: 5,
          total: 5,
          title: "기본 조작을 익혔어요",
          body: "카드를 클릭해 월 합을 만들고, 족보 배수를 붙여 목표 점수를 채우면 됩니다. 필요 없는 카드는 버려 새 패를 뽑으세요.",
          actionHint: `누적 ${format(state.chain.confirmedScore)} / 목표 ${format(state.targetScore)}점`,
        }
      : state.selectedCardIds.length === 0
        ? {
            step: 1,
            total: 5,
            title: "손패는 드래그하지 않고 클릭합니다",
            body: "카드의 큰 숫자가 월값입니다. 선택한 카드들의 월 숫자를 더한 값이 점수식의 앞 숫자가 됩니다.",
            actionHint: "같은 월 두 장이 보이면 둘 다 클릭하세요. 없으면 월 숫자가 큰 카드 두 장을 골라도 됩니다.",
            targetLabel: "손패 카드",
          }
        : state.selectedCardIds.length === 1
          ? {
              step: 2,
              total: 5,
              title: "선택한 카드는 위로 올라옵니다",
              body: "지금 선택한 카드가 첫 번째 점수 재료입니다. 한 장을 더 골라 월 합과 가능한 족보가 어떻게 바뀌는지 확인하세요.",
              actionHint: "카드 한 장을 더 클릭해 보세요.",
              targetLabel: "두 번째 카드",
            }
          : !state.manualYakuId
            ? {
                step: 3,
                total: 5,
                title: "이번 손의 족보를 직접 고르세요",
                body: "선택한 카드로 가능한 족보만 버튼으로 나타납니다. 자동 최고점은 없으니 월 합과 배수를 보고 어떤 족보로 낼지 직접 정합니다.",
                actionHint: "‘적용할 족보’에서 원하는 족보 버튼을 눌러 보세요.",
                targetLabel: "적용할 족보",
              }
            : {
                step: 4,
                total: 5,
                title: "월 합 × 배수가 이번 손 점수입니다",
                body: "점수판의 왼쪽은 족보에 들어간 카드의 월 숫자 합, 오른쪽은 족보·수집·부적이 만든 배수입니다.",
                actionHint: "예상 점수를 확인한 뒤 ‘족보 제출’을 눌러 보세요.",
                targetLabel: "족보 제출",
              };
  return (
    <div className="game-root play-root">
      <GameTopBar
        assetTag={`ui:topbar:month-${stage.month}`}
        stageLabel={`${stage.month}월 · ${stage.name}`}
        roundLabel={`날씨 ${WEATHER_BY_ID[state.weatherId].name}`}
        bossLabel={boss?.name ?? null}
        targetScore={state.targetScore}
        confirmedScore={state.chain.confirmedScore}
        potScore={state.chain.pot}
        successfulGoCount={state.chain.successfulGoCount}
        handsRemaining={state.handsRemaining}
        discardsRemaining={state.discardsRemaining}
        money={state.money}
        seed={state.seed}
        onOpenDeck={() => dispatch({ type: "OPEN_SCREEN", screen: "deck_editor" })}
        onOpenRules={() => setRulesOpen(true)}
        onRestart={() => setRestartOpen(true)}
      />

      {state.chain.armed ? <aside className="go-danger-banner" role="status"><strong>{state.chain.successfulGoCount + 1}고 진행 중</strong><span>이번 손까지 합쳐 {format(state.chain.requirement ?? 0)}점 이상 필요 · 지금 손 최소 {format(nextMinimum ?? 0)}점</span></aside> : null}

      {firstLesson ? <TutorialCoach {...playTutorial} /> : null}

      <main className="play-layout">
        <section className="play-table">
          <header className="play-table__header">
            <div><p className="eyebrow">HAND · 클릭해서 최대 5장 선택</p><h1>{state.screen === "decision" ? "저장할까요, 고를 외칠까요?" : "이번 손을 만드세요"}</h1></div>
            <button type="button" disabled={!state.selectedCardIds.length || state.screen === "decision"} onClick={() => dispatch({ type: "CLEAR_SELECTION" })}>선택 모두 해제</button>
          </header>

          <div className="play-score-panel">
            <ScoreFormula
              assetTag="ui:score-formula:month-times-multiplier"
              breakdown={state.screen === "decision" ? state.lastScore : preview?.breakdown}
              label={state.screen === "decision" ? "방금 낸 점수" : "선택 카드 예상 점수"}
              emptyMessage={state.selectedCardIds.length > 0 ? "적용할 족보를 직접 고르면 계산식이 열립니다." : "카드를 선택하면 가능한 족보가 표시됩니다."}
              showOperations={false}
            />
          </div>

          <div className="hand-cards" aria-label="내 손패">
            {state.hand.map((card) => <HwatuCard key={card.instanceId} card={card} selected={state.selectedCardIds.includes(card.instanceId)} scoring={Boolean(preview?.breakdown.scoringCardIds.includes(card.instanceId))} disabled={state.screen === "decision"} cupRole={card.tags.includes("cup") ? state.cupRole : undefined} onSelect={(selected) => dispatch({ type: "SELECT_CARD", cardId: selected.instanceId })} />)}
          </div>

          <div className="hand-options">
            <section className="yaku-picker" aria-label="메인 족보 선택">
              <div><strong>적용할 족보를 직접 선택</strong><span>{state.selectedCardIds.length ? "하나를 골라야 점수를 낼 수 있습니다" : "먼저 카드를 고르세요"}</span></div>
              {yakuChoices.map((id) => {
                const definition = ALL_IMMEDIATE_YAKU_DEFINITIONS.find((entry) => entry.id === id);
                return (
                  <button type="button" className={state.manualYakuId === id ? "active" : ""} key={id} onClick={() => dispatch({ type: "SET_MANUAL_YAKU", yakuId: id as ImmediateYakuId })}>
                    <strong>{definition?.name ?? id}</strong>
                    <span>×{definition?.baseHeung ?? 1} · {definition?.description}</span>
                  </button>
                );
              })}
            </section>

            <div className="cup-role-switch" role="group" aria-label="9월 술잔 역할">
              <span>9월 술잔을 어디에 셀까요?</span>
              <button type="button" className={state.cupRole === "animal" ? "active" : ""} onClick={() => dispatch({ type: "SET_CUP_ROLE", role: "animal" })}>동물패 1장</button>
              <button type="button" className={state.cupRole === "double_chaff" ? "active" : ""} onClick={() => dispatch({ type: "SET_CUP_ROLE", role: "double_chaff" })}>피 2장</button>
            </div>
          </div>

          {state.screen === "play" ? (
            <footer className="hand-actions">
              {state.experimentalRules.bombsAndShake ? <button type="button" disabled={!shakeReady} className={state.yard.shakeArmed ? "active" : ""} onClick={() => dispatch({ type: "DECLARE_SHAKE" })}>같은 월 3장 흔들기</button> : null}
              <button type="button" disabled={!state.selectedCardIds.length || state.discardsRemaining <= 0} onClick={() => dispatch({ type: "DISCARD_SELECTED" })}>선택 버리기 ({state.discardsRemaining})</button>
              <button type="button" className="primary-action" disabled={!state.selectedCardIds.length || !state.manualYakuId || state.handsRemaining <= 0} onClick={() => dispatch({ type: "SUBMIT_HAND" })}>족보 제출 ({state.handsRemaining})</button>
            </footer>
          ) : (
            <footer className="decision-actions">
              <button type="button" onClick={() => dispatch({ type: "BANK_CHAIN" })}><strong>저장하고 계속</strong><span>이번 승부 점수를 누적 점수에 더합니다</span></button>
              <button type="button" className="go-action" disabled={!goAvailable} onClick={() => dispatch({ type: "DECLARE_GO" })}><strong>{state.chain.successfulGoCount + 1}고 도전</strong><span>{goAvailable ? `다음 손까지 합계 ${format(nextGoRequirement ?? 0)}점 넘기기` : "이번 승부가 목표의 15% 이상이고 다음 손이 남아야 합니다"}</span></button>
              <button type="button" className="stop-action" onClick={() => dispatch({ type: "STOP_ROUND" })}><strong>스톱하고 판정</strong><span>현재 점수를 저장하고 스테이지 결과를 확인합니다</span></button>
            </footer>
          )}
        </section>

        <aside className="play-support">
          <CollectionBoard assetTag="ui:collection-board" items={collections} />
        </aside>
      </main>

      <TalismanStrip assetTag="ui:talisman-strip" items={talismanItems} slots={getEffectiveTalismanSlots(state)} />
      <RulesModal open={rulesOpen} onClose={() => setRulesOpen(false)} />
      <GameModal id="restart-run" open={restartOpen} assetTag="ui:warning:restart" title="현재 런을 끝낼까요?" description="저장된 달력과 덱이 초기화됩니다." onClose={() => setRestartOpen(false)} actions={[{ id: "cancel", label: "계속 플레이", onClick: () => setRestartOpen(false) }, { id: "reset", label: "제목으로", variant: "danger", onClick: resetToTitle }]} />
    </div>
  );
}

function RulesModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <GameModal id="rules" open={open} assetTag="ui:rules:scroll" title="꽃판 규칙 요약" description="월 합 × 배수와 고·스톱의 선택을 간단히 정리했습니다." onClose={onClose}>
      <div className="rules-copy">
        <section><h3>1. 카드를 클릭</h3><p>손패에서 1~5장을 클릭합니다. 드래그는 없습니다. 선택한 카드들의 월 숫자를 더한 값이 점수식의 앞 숫자입니다.</p></section>
        <section><h3>2. 족보를 직접 선택</h3><p>선택 카드로 가능한 족보 중 하나를 직접 고릅니다. 자동 최고점은 없으며, 족보를 골라야 예상 점수와 제출 버튼이 열립니다.</p></section>
        <section><h3>3. 월 합 × 배수</h3><p>족보에 들어간 카드의 월 숫자 합이 앞 숫자, 족보와 광·동물·띠·피 수집 및 부적이 만든 값이 배수입니다.</p></section>
        <section><h3>4. 저장 / 고 / 스톱</h3><p>저장은 이번 승부 점수를 누적하고 계속합니다. 고는 다음 손까지 더 높은 문턱에 도전하며, 실패하면 이번 승부에서 모은 점수를 잃습니다. 스톱은 지금 점수로 판을 끝냅니다.</p></section>
        <section><h3>5. 덱빌딩</h3><p>모든 런은 기본 48장으로 시작합니다. 매달 장터에서 부적·족보 성장·영구 카드 강화·금단 계약을 골라 나만의 덱으로 바꿉니다.</p></section>
      </div>
    </GameModal>
  );
}
