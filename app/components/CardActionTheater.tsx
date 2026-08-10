"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import {
  getCollectionLandingTargets,
  type CollectionTrack,
  type CupRoleLookup,
} from "@/game/engine/collection-board";
import { getImmediateYakuDefinition } from "@/game/content/yaku";
import type { CardInstance, ScoreBreakdown, ScoreOperation } from "@/game/types";
import {
  playCardPickSound,
  playCardRevealSound,
  playCollectionSlapSound,
  playCollectionSlideSound,
  playDrawSnapSound,
  playJitAdditionSound,
  playKkeutHitSound,
  playScoreOperationSound,
  playSubmissionFinaleSound,
  playTalismanGrowthSound,
  playYakuRevealSound,
} from "../audio/game-sfx";
import { HwatuCard } from "./HwatuCard";
import type { ScoreRevealState } from "./useScoreReveal";

export type SubmissionBeatKind =
  | "intro"
  | "yaku"
  | "kkeut-card"
  | "jit-start"
  | "jit-card"
  | "effect"
  | "collect"
  | "finale"
  | "growth";

export interface TalismanGrowthEvent {
  sourceId: string;
  label: string;
  delta: number;
  total: number;
}

export interface SubmissionBeat {
  kind: SubmissionBeatKind;
  activeCardIds: string[];
  eyebrow: string;
  title: string;
  detail: string;
  duration: number;
  runningJit: number;
  runningHeung: number;
  operation?: ScoreOperation;
  /** Talisman instance highlighted above the felt for non-score growth beats. */
  sourceId?: string;
  /** Exact collection row this beat files the card into. */
  collectionTrack?: CollectionTrack;
  /** 0=일반, 1=땡/고레벨, 2=광땡, 3=38광땡. */
  emphasisTier?: 0 | 1 | 2 | 3;
}

function yakuEmphasisTier(breakdown: ScoreBreakdown): 0 | 1 | 2 | 3 {
  if (breakdown.yakuId === "gwangttaeng_38") return 3;
  if (breakdown.yakuId.startsWith("gwangttaeng_")) return 2;
  const definition = getImmediateYakuDefinition(breakdown.yakuId);
  const estimatedLevel = definition.growthHeung > 0
    ? Math.max(1, Math.floor((breakdown.startingHeung - definition.baseHeung) / definition.growthHeung) + 1)
    : 1;
  if (estimatedLevel >= 5) return 2;
  if (estimatedLevel >= 3) return 1;
  if (breakdown.yakuId === "ttaeng" || breakdown.yakuId === "jangttaeng" || breakdown.startingHeung >= 10) return 1;
  return 0;
}

export function submissionBeatToReveal(
  beat: SubmissionBeat,
  index: number,
  count: number,
  finalScore: number,
): ScoreRevealState {
  const finale = beat.kind === "finale" || beat.kind === "growth";
  return {
    visible: true,
    playing: beat.kind !== "finale",
    kkeut: beat.runningJit,
    heung: beat.runningHeung,
    total: finale ? finalScore : null,
    current: beat.operation ?? null,
    index: index + 1,
    count,
  };
}

function operationText(operation: ScoreOperation): string {
  if (operation.operation === "add_kkeut") return `월 합 +${operation.value}`;
  if (operation.operation === "add_heung") return `배수 +${operation.value}`;
  if (operation.operation === "multiply_heung") return `배수 ×${operation.value}`;
  return `월 합 = ${operation.value}`;
}

function visibleJitValue(card: CardInstance): number {
  if (card.tags.includes("zero_base")) return 0;
  if (card.enhancement === "stone") return 12;
  return card.month + card.permanentKkeutBonus;
}

/** Pure timeline builder: the animation can never disagree with the scored result. */
export function buildSubmissionBeats(
  breakdown: ScoreBreakdown,
  submittedCards: readonly CardInstance[],
  collectionCards: readonly CardInstance[] = submittedCards,
  cupRoles?: CupRoleLookup,
  growthEvents: readonly TalismanGrowthEvent[] = [],
): SubmissionBeat[] {
  const scoringIds = new Set(breakdown.scoringCardIds);
  const scoringCards = submittedCards.filter((card) => scoringIds.has(card.instanceId));
  const jitIds = new Set(breakdown.jitCardIds);
  const kkeutCards = scoringCards.filter((card) => !jitIds.has(card.instanceId));
  const jitCards = scoringCards.filter((card) => jitIds.has(card.instanceId));
  const operationCardIds = (operation: ScoreOperation) => scoringCards
    .filter((card) => operation.sourceId === card.instanceId || operation.sourceId.endsWith(`:${card.instanceId}`))
    .map((card) => card.instanceId);
  let runningJit = breakdown.jitSum > 0 ? 0 : breakdown.startingKkeut;
  let runningHeung = breakdown.startingHeung;
  const beats: SubmissionBeat[] = [{
    kind: "intro",
    activeCardIds: submittedCards.map((card) => card.instanceId),
    eyebrow: "패를 펼칩니다",
    title: `${submittedCards.length}장 제출`,
    detail: "끗패부터 읽고, 짓을 차례로 맞춥니다.",
    duration: 430,
    runningJit,
    runningHeung,
  }];

  beats.push({
    kind: "yaku",
    activeCardIds: kkeutCards.map((card) => card.instanceId),
    eyebrow: "끗패 족보",
    title: breakdown.rankLabel || breakdown.yakuName,
    detail: `두 장이 만나 기본 배수 ×${breakdown.startingHeung}`,
    duration: 1_260 + yakuEmphasisTier(breakdown) * 360,
    runningJit,
    runningHeung,
    emphasisTier: yakuEmphasisTier(breakdown),
  });

  const consumedOperations = new Set<number>();
  const appendOperation = (operation: ScoreOperation, index: number) => {
    consumedOperations.add(index);
    const sourceCardIds = operationCardIds(operation);
    if (operation.operation === "add_kkeut") runningJit += operation.value;
    else if (operation.operation === "add_heung") runningHeung += operation.value;
    else if (operation.operation === "multiply_heung") runningHeung *= operation.value;
    else runningJit = operation.value;
    beats.push({
      kind: "effect",
      activeCardIds: sourceCardIds.length > 0
        ? sourceCardIds
        : scoringCards.map((card) => card.instanceId),
      eyebrow: "효과 발동",
      title: operation.label,
      detail: `${operationText(operation)} · 현재 ${runningJit} × ${runningHeung}`,
      duration: 430,
      runningJit,
      runningHeung,
      operation,
    });
  };

  breakdown.operations.forEach((operation, index) => {
    if (operation.sourceId === `${breakdown.yakuId}:rank`) appendOperation(operation, index);
  });

  // 끗패 두 장은 족보 이름과 함께 한 번에 강조한다. 카드 이름을 한 장씩
  // 읽는 장면은 같은 월을 두 번 반복해 흐름을 끊었고, 정작 족보가 짧았다.

  if (jitCards.length > 0) {
    beats.push({
      kind: "jit-start",
      activeCardIds: jitCards.map((card) => card.instanceId),
      eyebrow: "짓 만들기",
      title: `${runningJit}에서 시작`,
      detail: runningJit === 0
        ? "남은 패의 월값을 한 장씩 더합니다."
        : "먼저 붙은 카드 효과에 남은 패의 월값을 더합니다.",
      duration: 430,
      runningJit,
      runningHeung,
    });
  }

  let builtJit = 0;
  jitCards.forEach((card, cardIndex) => {
    const isLast = cardIndex === jitCards.length - 1;
    const visible = visibleJitValue(card);
    const value = isLast ? breakdown.jitSum - builtJit : visible;
    builtJit += value;
    runningJit += value;
    beats.push({
      kind: "jit-card",
      activeCardIds: [card.instanceId],
      eyebrow: `짓패 ${cardIndex + 1}/${jitCards.length}`,
      title: `+${value}`,
      detail: isLast
        ? `짓 ${builtJit} 완성 · 효과 포함 월 합 ${runningJit}`
        : `${card.month}월을 더해 짓 ${builtJit}`,
      duration: 540,
      runningJit,
      runningHeung,
      operation: {
        sourceId: card.instanceId,
        label: `${card.month}월 짓패`,
        operation: "add_kkeut",
        value,
        runningKkeut: runningJit,
        runningHeung,
      },
    });
    breakdown.operations.forEach((operation, index) => {
      if (!consumedOperations.has(index) && operationCardIds(operation).includes(card.instanceId)) appendOperation(operation, index);
    });
  });

  breakdown.operations.forEach((operation, index) => {
    if (!consumedOperations.has(index)) appendOperation(operation, index);
  });

  const collectionLandings = collectionCards.flatMap((card) =>
    getCollectionLandingTargets(card, cupRoles).map((target) => ({ card, target })),
  );
  const collectionTrackLabel: Record<CollectionTrack, string> = {
    bright: "광",
    animal: "동물",
    godori: "고도리",
    ribbon: "띠",
    chaff: "피",
  };
  collectionLandings.forEach(({ card, target }, index) => {
    beats.push({
      kind: "collect",
      activeCardIds: [card.instanceId],
      eyebrow: `수집 ${index + 1}/${collectionLandings.length}`,
      title: `${card.month}월 ${collectionTrackLabel[target.track]}`,
      detail: "수집판에 착!",
      duration: 300,
      runningJit: breakdown.finalKkeut,
      runningHeung: breakdown.finalHeung,
      collectionTrack: target.track,
    });
  });

  beats.push({
    kind: "finale",
    activeCardIds: [],
    eyebrow: "득점 완료",
    title: `${breakdown.score.toLocaleString("ko-KR")}점`,
    detail: `${breakdown.finalKkeut} × ${breakdown.finalHeung}`,
    duration: 720,
    runningJit: breakdown.finalKkeut,
    runningHeung: breakdown.finalHeung,
  });
  const growthNumber = (value: number) => new Intl.NumberFormat("ko-KR", {
    maximumFractionDigits: 2,
  }).format(value);
  growthEvents
    .filter((event) => event.delta > 0)
    .forEach((event) => {
      beats.push({
        kind: "growth",
        activeCardIds: [],
        eyebrow: "부적이 힘을 얻습니다",
        title: `${event.label} · 성장 +${growthNumber(event.delta)}`,
        detail: `영구 성장 누적 +${growthNumber(event.total)}`,
        duration: 920,
        runningJit: breakdown.finalKkeut,
        runningHeung: breakdown.finalHeung,
        sourceId: event.sourceId,
      });
    });
  return beats;
}

function playSubmissionBeat(beat: SubmissionBeat, index: number) {
  if (beat.kind === "intro") playCardRevealSound(0);
  else if (beat.kind === "yaku") playYakuRevealSound();
  else if (beat.kind === "kkeut-card") playKkeutHitSound(index);
  else if (beat.kind === "effect" && beat.operation) playScoreOperationSound(beat.operation, index);
  else if (beat.kind === "jit-start") playCardPickSound();
  else if (beat.kind === "jit-card") playJitAdditionSound(index);
  else if (beat.kind === "finale") playSubmissionFinaleSound(beat.runningJit * beat.runningHeung);
  else if (beat.kind === "growth") playTalismanGrowthSound();
}

interface CollectionFlight {
  animation: Animation;
  clone: HTMLElement;
  source: HTMLElement;
}

function findByDataValue(attribute: string, value: string): HTMLElement | null {
  return Array.from(document.querySelectorAll<HTMLElement>(`[${attribute}]`))
    .find((element) => element.getAttribute(attribute) === value) ?? null;
}

function findCollectionTarget(card: CardInstance, track?: CollectionTrack): HTMLElement | null {
  if (track) {
    const trackElement = findByDataValue("data-collection-track", track);
    const exactSlot = trackElement
      ? Array.from(trackElement.querySelectorAll<HTMLElement>("[data-collection-origin]"))
        .find((element) => element.getAttribute("data-collection-origin") === card.originId) ?? null
      : null;
    if (exactSlot) return exactSlot;
    if (trackElement) return trackElement;
  }
  return findByDataValue("data-collection-origin", card.originId)
    ?? findByDataValue("data-collection-track", card.kind);
}

function startCollectionFlight(
  card: CardInstance,
  duration: number,
  track?: CollectionTrack,
): CollectionFlight | null {
  const source = findByDataValue("data-theater-card-id", card.instanceId);
  const target = findCollectionTarget(card, track);
  if (!source || !target || typeof source.animate !== "function") return null;

  // The collection rail is compact and may scroll on a short viewport. Bring
  // the exact row/slot into view before measuring it, otherwise the card can
  // faithfully fly to a point that is currently hidden below the rail.
  target.scrollIntoView({ block: "nearest", inline: "nearest" });
  const from = source.getBoundingClientRect();
  const to = target.getBoundingClientRect();
  const deltaX = to.left + to.width / 2 - (from.left + from.width / 2);
  const deltaY = to.top + to.height / 2 - (from.top + from.height / 2);
  const targetScale = Math.max(0.2, Math.min(0.72, to.height / Math.max(1, from.height)));
  const clone = source.cloneNode(true) as HTMLElement;
  clone.className = "submission-theater__flight-card";
  clone.removeAttribute("data-theater-card-id");
  Object.assign(clone.style, {
    position: "fixed",
    left: `${from.left}px`,
    top: `${from.top}px`,
    width: `${from.width}px`,
    height: `${from.height}px`,
    margin: "0",
    pointerEvents: "none",
  });
  document.body.append(clone);
  source.style.visibility = "hidden";
  const animation = clone.animate([
    { opacity: 1, transform: "translate3d(0, 0, 0) scale(1) rotate(0deg)", offset: 0 },
    { opacity: 1, transform: `translate3d(${deltaX * 0.68}px, ${deltaY * 0.56}px, 0) scale(0.82) rotate(-5deg)`, offset: 0.66 },
    { opacity: 0.18, transform: `translate3d(${deltaX}px, ${deltaY}px, 0) scale(${targetScale}) rotate(-9deg)`, offset: 1 },
  ], {
    duration,
    easing: "cubic-bezier(.2,.72,.18,1)",
    fill: "forwards",
  });
  return { animation, clone, source };
}

interface SubmissionTheaterProps {
  breakdown: ScoreBreakdown;
  submittedCards: readonly CardInstance[];
  collectionCards?: readonly CardInstance[];
  cupRoles?: CupRoleLookup;
  growthEvents?: readonly TalismanGrowthEvent[];
  onBeatChange?: (beat: SubmissionBeat, index: number, count: number) => void;
  onCollectionLand?: (card: CardInstance, index: number, track: CollectionTrack) => void;
  onComplete: () => void;
}

export function SubmissionTheater({
  breakdown,
  submittedCards,
  collectionCards = submittedCards,
  cupRoles,
  growthEvents = [],
  onBeatChange,
  onCollectionLand,
  onComplete,
}: SubmissionTheaterProps) {
  const beats = useMemo(
    () => buildSubmissionBeats(breakdown, submittedCards, collectionCards, cupRoles, growthEvents),
    [breakdown, collectionCards, cupRoles, growthEvents, submittedCards],
  );
  const [index, setIndex] = useState(0);
  const soundedIndex = useRef(-1);
  const flightStartedIndex = useRef(-1);
  const landedIndexes = useRef(new Set<number>());
  const finished = useRef(false);
  const beat = beats[Math.min(index, beats.length - 1)];
  const jitIds = useMemo(() => new Set(breakdown.jitCardIds), [breakdown.jitCardIds]);
  const collectableCards = useMemo(
    () => collectionCards.filter((card) => getCollectionLandingTargets(card, cupRoles).length > 0),
    [collectionCards, cupRoles],
  );
  const displayCards = beat.kind === "collect" ? collectableCards : submittedCards;

  useEffect(() => {
    if (!beat) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (soundedIndex.current !== index) {
      soundedIndex.current = index;
      if (beat.kind !== "collect") playSubmissionBeat(beat, index);
      onBeatChange?.(beat, index, beats.length);
    }
    let flight: CollectionFlight | null = null;
    let fallbackLandingTimer: number | null = null;
    let flightFrame: number | null = null;
    if (beat.kind === "collect" && flightStartedIndex.current !== index) {
      flightFrame = window.requestAnimationFrame(() => {
        flightStartedIndex.current = index;
        const card = collectableCards.find((entry) => entry.instanceId === beat.activeCardIds[0]);
        if (!card) return;
        const collectionIndex = beats
          .slice(0, index + 1)
          .filter((entry) => entry.kind === "collect").length - 1;
        const land = () => {
          if (landedIndexes.current.has(index)) return;
          landedIndexes.current.add(index);
          playCollectionSlapSound(collectionIndex);
          if (beat.collectionTrack) onCollectionLand?.(card, collectionIndex, beat.collectionTrack);
        };
        playCollectionSlideSound(collectionIndex);
        flight = startCollectionFlight(card, reduced ? 80 : 260, beat.collectionTrack);
        if (flight) void flight.animation.finished.then(land).catch(() => undefined);
        else fallbackLandingTimer = window.setTimeout(land, reduced ? 60 : 180);
      });
    }
    const timer = window.setTimeout(() => {
      if (index < beats.length - 1) setIndex((value) => value + 1);
      else if (!finished.current) {
        finished.current = true;
        onComplete();
      }
    }, reduced ? Math.min(110, beat.duration) : beat.duration);
    return () => {
      window.clearTimeout(timer);
      if (flightFrame !== null) window.cancelAnimationFrame(flightFrame);
      if (fallbackLandingTimer !== null) window.clearTimeout(fallbackLandingTimer);
      flight?.animation.cancel();
      flight?.clone.remove();
      if (flight) flight.source.style.visibility = "";
    };
  }, [beat, beats, collectableCards, index, onBeatChange, onCollectionLand, onComplete]);

  if (!beat) return null;
  const active = new Set(beat.activeCardIds);

  return (
    <section className={`card-theater submission-theater submission-theater--${beat.kind} submission-theater--tier-${beat.emphasisTier ?? 0}`} aria-live="assertive" aria-label="제출 득점 연출">
      <div className="card-theater__backdrop" />
      <div className="card-theater__stage">
        <header className="card-theater__headline">
          <span>{beat.eyebrow}</span>
          <strong>{beat.title}</strong>
          <p>{beat.detail}</p>
        </header>

        <div className="submission-theater__formula" aria-label={`월 합 ${beat.runningJit}, 배수 ${beat.runningHeung}`}>
          <span><small>월 합</small><b>{beat.runningJit}</b></span>
          <i>×</i>
          <span><small>배수</small><b>{beat.runningHeung}</b></span>
        </div>

        <div
          className="submission-theater__cards"
          data-card-count={displayCards.length}
          style={{
            "--theater-card-count": Math.max(1, displayCards.length),
            "--theater-row-max": `${Math.max(1, displayCards.length) * 9}rem`,
          } as React.CSSProperties}
        >
          {displayCards.map((card) => {
            const isActive = active.has(card.instanceId);
            const splitRole = beat.kind === "collect" ? undefined : jitIds.has(card.instanceId) ? "jit" : "kkeut";
            return (
              <div
                className={[
                  "submission-theater__card",
                  isActive ? "submission-theater__card--active" : "submission-theater__card--dim",
                  beat.kind === "collect" && isActive ? "submission-theater__card--collecting" : "",
                ].filter(Boolean).join(" ")}
                data-theater-card-id={card.instanceId}
                key={card.instanceId}
              >
                <HwatuCard card={card} scoring={isActive} splitRole={splitRole} className="submission-theater__hwatu" />
              </div>
            );
          })}
        </div>

        <button type="button" className="card-theater__skip" onClick={onComplete}>연출 건너뛰기</button>
      </div>
    </section>
  );
}

interface DiscardTheaterProps {
  discardedCards: readonly CardInstance[];
  drawnCards?: readonly CardInstance[];
  onBeatChange?: (beat: DiscardBeat) => void;
  onComplete: () => void;
}

export interface DiscardBeat {
  kind: "discard" | "draw";
  activeCardId: string;
  index: number;
  count: number;
}

export interface InlineHandPresentation {
  cards: readonly CardInstance[];
  discardedIds: ReadonlySet<string>;
  discardingId: string | null;
  drawingId: string | null;
}

export function getInlineHandPresentation(
  handBefore: readonly CardInstance[],
  currentHand: readonly CardInstance[],
  discardedCards: readonly CardInstance[],
  beat: DiscardBeat | null,
): InlineHandPresentation {
  if (beat?.kind === "discard") {
    return {
      cards: handBefore,
      discardedIds: new Set(discardedCards.slice(0, beat.index).map((card) => card.instanceId)),
      discardingId: beat.activeCardId,
      drawingId: null,
    };
  }
  return {
    cards: currentHand,
    discardedIds: new Set(),
    discardingId: null,
    drawingId: beat?.kind === "draw" ? beat.activeCardId : null,
  };
}

export function DiscardTheater({ discardedCards, drawnCards = [], onBeatChange, onComplete }: DiscardTheaterProps) {
  const total = discardedCards.length + drawnCards.length;
  const [index, setIndex] = useState(0);
  const finished = useRef(false);
  const soundedSteps = useRef(new Set<string>());
  const discarding = index < discardedCards.length;
  const localIndex = discarding ? index : index - discardedCards.length;
  const cards = discarding ? discardedCards : drawnCards;
  const active = cards[localIndex];

  useEffect(() => {
    if (total === 0) {
      if (!finished.current) {
        finished.current = true;
        onComplete();
      }
      return;
    }
    if (discarding) {
      const slideKey = `discard:${index}:slide`;
      if (!soundedSteps.current.has(slideKey)) {
        if (active) {
          onBeatChange?.({ kind: "discard", activeCardId: active.instanceId, index: localIndex, count: discardedCards.length });
        }
        soundedSteps.current.add(slideKey);
        playCollectionSlideSound(localIndex);
      }
      const snap = window.setTimeout(() => {
        const snapKey = `discard:${index}:snap`;
        if (!soundedSteps.current.has(snapKey)) {
          soundedSteps.current.add(snapKey);
          playCardRevealSound(localIndex);
        }
      }, 105);
      const next = window.setTimeout(() => {
        if (index < total - 1) setIndex((value) => value + 1);
        else if (!finished.current) {
          finished.current = true;
          onComplete();
        }
      }, 240);
      return () => { window.clearTimeout(snap); window.clearTimeout(next); };
    }
    const drawKey = `draw:${localIndex}`;
    if (active && !soundedSteps.current.has(drawKey)) {
      onBeatChange?.({ kind: "draw", activeCardId: active.instanceId, index: localIndex, count: drawnCards.length });
      soundedSteps.current.add(drawKey);
      playDrawSnapSound(localIndex);
    }
    const next = window.setTimeout(() => {
      if (index < total - 1) setIndex((value) => value + 1);
      else if (!finished.current) {
        finished.current = true;
        onComplete();
      }
    }, 230);
    return () => window.clearTimeout(next);
  }, [active, discardedCards.length, discarding, drawnCards.length, index, localIndex, onBeatChange, onComplete, total]);

  return null;
}
