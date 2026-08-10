"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";

import { TALISMAN_BY_ID } from "@/game/content/talismans";
import type { CardInstance, ForbiddenDefinition, GameState, TalismanInstance } from "@/game/types";

import { playCardRevealSound, playForbiddenRitualSound } from "../audio/game-sfx";
import { getGeneratedAssetUrl } from "./generated-asset";
import { HwatuCard } from "./HwatuCard";

export interface ForbiddenRitualSnapshot {
  definition: ForbiddenDefinition;
  deck: readonly CardInstance[];
  talismans: readonly TalismanInstance[];
  yakuLevels: GameState["yakuLevels"];
  money: number;
  handSize: number;
  talismanSlots: number;
  targetIds: readonly string[];
}

export interface ForbiddenCardMoment {
  card: CardInstance;
  label: string;
  tone: "source" | "changed" | "created" | "burned";
}

export interface ForbiddenTalismanMoment {
  instance: TalismanInstance;
  label: string;
  tone: "changed" | "created" | "burned";
}

export interface ForbiddenRitualPresentation {
  definition: ForbiddenDefinition;
  cards: ForbiddenCardMoment[];
  talismans: ForbiddenTalismanMoment[];
  summaries: string[];
}

export function createForbiddenRitualSnapshot(
  state: GameState,
  definition: ForbiddenDefinition,
): ForbiddenRitualSnapshot {
  return {
    definition,
    deck: state.deck,
    talismans: state.talismans,
    yakuLevels: state.yakuLevels,
    money: state.money,
    handSize: state.handSize,
    talismanSlots: state.talismanSlots,
    targetIds: state.pendingTargetIds,
  };
}

function cardChanged(before: CardInstance, after: CardInstance): boolean {
  return before.month !== after.month
    || before.kind !== after.kind
    || before.chaffValue !== after.chaffValue
    || before.permanentKkeutBonus !== after.permanentKkeutBonus
    || before.enhancement !== after.enhancement
    || before.edition !== after.edition
    || before.seal !== after.seal
    || before.effectTagId !== after.effectTagId
    || before.tags.join("|") !== after.tags.join("|");
}

function changedCardLabel(definition: ForbiddenDefinition): string {
  switch (definition.effectKey) {
    case "all_to_january": return "1월 패로 영구 변경";
    case "make_bright_pay": return "광으로 영구 승격";
    case "all_hand_chaff_bonus": return "피로 변경 · 월 합 영구 +4";
    case "wild_month_zero_base": return "광·동물·띠·피 모두 취급";
    default: return "영구 변화 적용";
  }
}

function removedCardLabel(definition: ForbiddenDefinition): string {
  return definition.effectKey === "random_burn_for_money" ? "무작위로 뽑혀 영구 소각" : "제물로 영구 소각";
}

export function buildForbiddenRitualPresentation(
  before: ForbiddenRitualSnapshot,
  after: GameState,
): ForbiddenRitualPresentation {
  const beforeCards = new Map(before.deck.map((card) => [card.instanceId, card]));
  const afterCards = new Map(after.deck.map((card) => [card.instanceId, card]));
  const cards: ForbiddenCardMoment[] = [];

  if (before.definition.effectKey === "double_duplicate_hand_penalty") {
    const source = beforeCards.get(before.targetIds[0] ?? "");
    if (source) cards.push({ card: source, label: "복제 원본", tone: "source" });
  }

  for (const card of before.deck) {
    if (!afterCards.has(card.instanceId)) {
      cards.push({ card, label: removedCardLabel(before.definition), tone: "burned" });
    }
  }
  for (const card of after.deck) {
    const previous = beforeCards.get(card.instanceId);
    if (!previous) {
      cards.push({ card, label: "새 복사본 생성", tone: "created" });
    } else if (cardChanged(previous, card)) {
      cards.push({ card, label: changedCardLabel(before.definition), tone: "changed" });
    }
  }

  const beforeTalismans = new Map(before.talismans.map((item) => [item.instanceId, item]));
  const afterTalismans = new Map(after.talismans.map((item) => [item.instanceId, item]));
  const talismans: ForbiddenTalismanMoment[] = [];
  for (const item of before.talismans) {
    if (!afterTalismans.has(item.instanceId)) talismans.push({ instance: item, label: "제물로 영구 파괴", tone: "burned" });
  }
  for (const item of after.talismans) {
    const previous = beforeTalismans.get(item.instanceId);
    if (!previous) talismans.push({ instance: item, label: "새 부적 생성", tone: "created" });
    else if (previous.edition !== item.edition || previous.growth !== item.growth || previous.definitionId !== item.definitionId) {
      talismans.push({ instance: item, label: item.edition === "engraved" ? "음각 판본 영구 부여" : "부적 영구 변화", tone: "changed" });
    }
  }

  const summaries: string[] = [];
  const upgradedYakus = Object.entries(after.yakuLevels).filter(([id, value]) => (
    value.level > (before.yakuLevels[id]?.level ?? 1)
  ));
  if (upgradedYakus.length) summaries.push(`족보 ${upgradedYakus.length}종 레벨 +1`);
  if (before.money !== after.money) summaries.push(`보유 냥 ${before.money} → ${after.money}`);
  if (before.handSize !== after.handSize) summaries.push(`손패 크기 ${before.handSize} → ${after.handSize}`);
  if (before.talismanSlots !== after.talismanSlots) summaries.push(`부적 칸 ${before.talismanSlots} → ${after.talismanSlots}`);
  if (cards.some((entry) => entry.tone === "burned")) summaries.push(`영구 소각 ${cards.filter((entry) => entry.tone === "burned").length}장`);
  if (cards.some((entry) => entry.tone === "created")) summaries.push(`새 카드 ${cards.filter((entry) => entry.tone === "created").length}장`);
  if (!summaries.length && talismans.length) summaries.push(`부적 ${talismans.length}개에 영구 변화 적용`);

  return { definition: before.definition, cards, talismans, summaries };
}

export function ForbiddenRitualTheater({ presentation, onClose }: {
  presentation: ForbiddenRitualPresentation;
  onClose: () => void;
}) {
  useEffect(() => {
    const total = presentation.cards.length + presentation.talismans.length;
    const timers = Array.from({ length: total }, (_, index) => window.setTimeout(() => {
      playCardRevealSound(index);
    }, 180 + index * 170));
    timers.push(window.setTimeout(playForbiddenRitualSound, 240 + total * 170));
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" || event.key === "Enter") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose, presentation.cards.length, presentation.talismans.length]);

  if (typeof document === "undefined") return null;
  return createPortal(
    <section className="forbidden-theater" role="dialog" aria-modal="true" aria-label={`${presentation.definition.name} 의식 결과`}>
      <div className="forbidden-theater__veil" aria-hidden="true" />
      <article className="forbidden-theater__panel">
        <header>
          <span>禁 · 금단 의식 완료</span>
          <h2>{presentation.definition.name}</h2>
          <p><b>얻은 힘</b>{presentation.definition.benefit}</p>
          <p><b>치른 대가</b>{presentation.definition.cost}</p>
        </header>

        {presentation.cards.length ? (
          <div className="forbidden-theater__cards" aria-label="영향을 받은 카드">
            {presentation.cards.map((moment, index) => (
              <figure className={`forbidden-theater__card forbidden-theater__card--${moment.tone}`} style={{ animationDelay: `${160 + index * 170}ms` }} key={`${moment.tone}-${moment.card.instanceId}-${index}`}>
                <HwatuCard dense card={moment.card} />
                <figcaption><strong>{moment.card.month}월 {moment.card.name}</strong><span>{moment.label}</span></figcaption>
              </figure>
            ))}
          </div>
        ) : null}

        {presentation.talismans.length ? (
          <div className="forbidden-theater__talismans" aria-label="영향을 받은 부적">
            {presentation.talismans.map((moment, index) => {
              const definition = TALISMAN_BY_ID[moment.instance.definitionId];
              const artUrl = definition ? getGeneratedAssetUrl(definition.assetTag) : null;
              return (
                <figure className={`forbidden-theater__talisman forbidden-theater__talisman--${moment.tone}`} style={{ animationDelay: `${160 + (presentation.cards.length + index) * 170}ms` }} key={`${moment.tone}-${moment.instance.instanceId}`}>
                  {/* Generated art is a static local asset and must preserve its full uncropped frame. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {artUrl ? <img src={artUrl} alt="" draggable={false} /> : <span aria-hidden="true">符</span>}
                  <figcaption><strong>{definition?.name ?? "알 수 없는 부적"}</strong><span>{moment.label}</span></figcaption>
                </figure>
              );
            })}
          </div>
        ) : null}

        <footer>
          <div>{presentation.summaries.map((summary) => <strong key={summary}>{summary}</strong>)}</div>
          <button type="button" onClick={onClose}>결과 확인</button>
        </footer>
      </article>
    </section>,
    document.body,
  );
}
