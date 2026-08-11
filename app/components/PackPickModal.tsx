"use client";

import { useEffect, useState } from "react";

import { CARD_EFFECT_TAG_BY_ID } from "@/game/content/card-effects";
import { TALISMAN_BY_ID } from "@/game/content/talismans";
import { BOOK_BY_ID } from "@/game/content/upgrades";
import type { CardInstance, GameState } from "@/game/types";
import {
  playCardPickSound,
  playCardRevealSound,
  playPackOpenSound,
} from "../audio/game-sfx";

import { GameModal } from "./GameModal";
import { getGeneratedAssetUrl } from "./generated-asset";
import { HwatuCard } from "./HwatuCard";

function packKindLabel(card: CardInstance): string {
  if (card.kind === "chaff" && card.chaffValue === 2) return "쌍피";
  if (card.kind === "bright") return "광";
  if (card.kind === "animal") return "동물";
  if (card.kind === "ribbon") return "띠";
  return "피";
}

/** Marks choices locally, then commits every selected reward in one transaction. */
export function PackPickModal({ pack, maxSelections, onConfirm, onClose }: {
  pack: GameState["pendingPack"];
  maxSelections: number;
  onConfirm: (candidateIds: string[]) => void;
  onClose: () => void;
}) {
  const [opened, setOpened] = useState(false);
  const [opening, setOpening] = useState(false);
  const [revealedCount, setRevealedCount] = useState(0);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [initialRevealCount] = useState(() => (pack?.candidates.length ?? 0) + (pack?.rewardCandidates?.length ?? 0));
  const packSlug = pack?.packId.replace(/^pack_/, "").replaceAll("_", "-") ?? "hwatu-small";
  const packAssetTag = `pack:${packSlug}`;
  const packArtUrl = getGeneratedAssetUrl(packAssetTag);

  useEffect(() => {
    if (!opened) return;
    if (pack?.category === "burn") {
      const timer = window.setTimeout(() => {
        setRevealedCount(pack.candidates.length);
        playCardRevealSound(0);
      }, 180);
      return () => window.clearTimeout(timer);
    }
    const timers = Array.from({ length: initialRevealCount }, (_, index) => window.setTimeout(() => {
      setRevealedCount(index + 1);
      playCardRevealSound(index);
    }, 180 + index * 145));
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [initialRevealCount, opened, pack]);

  const handleOpen = () => {
    if (opening) return;
    playPackOpenSound();
    window.navigator.vibrate?.([18, 28, 32]);
    setOpening(true);
    setRevealedCount(0);
    window.setTimeout(() => setOpened(true), 520);
  };

  const toggleSelection = (candidateId: string) => {
    playCardPickSound();
    window.navigator.vibrate?.(18);
    setSelectedIds((current) => current.includes(candidateId)
      ? current.filter((id) => id !== candidateId)
      : current.length < maxSelections
        ? [...current, candidateId]
        : current);
  };
  const packDescription = pack?.category === "burn"
    ? `태울 패 ${maxSelections}장을 먼저 표시한 뒤 소각 확정을 누르세요. 확정 전에는 덱이 바뀌지 않습니다.`
    : pack?.category === "book"
      ? `독파할 비결서를 최대 ${maxSelections}권까지 표시한 뒤 획득 확정을 누르세요.`
      : pack?.category === "talisman"
        ? `가져갈 부적을 최대 ${maxSelections}개까지 표시한 뒤 획득 확정을 누르세요. 왼쪽부터 발동합니다.`
        : `가져갈 패를 최대 ${maxSelections}장까지 표시한 뒤 획득 확정을 누르세요. 확정 전에는 덱이 바뀌지 않습니다.`;

  return (
    <GameModal
      id="pack-pick"
      open={Boolean(pack)}
      assetTag={packAssetTag}
      title={pack ? (opened
        ? `${pack.name} · ${selectedIds.length}/${maxSelections}${pack.category === "burn" ? "장 소각 선택" : "개 선택"}`
        : `${pack.name} 개봉`) : "화투 묶음"}
      description={opened ? packDescription : "매듭을 풀고 봉인을 뜯어 안에 든 것을 확인하세요."}
      closeOnBackdrop={false}
      dismissible={pack?.category !== "burn"}
      closeLabel="그만 고르기"
      onClose={onClose}
      className="game-modal--pack"
      actions={opened && pack ? [
        {
          id: "confirm",
          label: pack.category === "burn" ? `${selectedIds.length}장 소각 확정` : `${selectedIds.length}개 획득 확정`,
          variant: "primary",
          disabled: pack.category === "burn"
            ? selectedIds.length !== maxSelections || maxSelections === 0
            : selectedIds.length === 0,
          onClick: () => onConfirm(selectedIds),
        },
        ...(pack.category !== "burn" ? [{ id: "close", label: "그만 고르기", onClick: onClose } as const] : []),
      ] : []}
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
        <ul className={pack?.category === "burn" ? "pack-picks pack-picks--revealing pack-picks--burn" : "pack-picks pack-picks--revealing"} data-tutorial="pack-picks">
          {pack?.candidates.map((card, index) => {
            const tag = card.effectTagId ? CARD_EFFECT_TAG_BY_ID[card.effectTagId] : undefined;
            const selected = selectedIds.includes(card.instanceId);
            return (
              <li className={`${index < revealedCount ? "pack-picks__item pack-picks__item--revealed" : "pack-picks__item"}${selected ? " pack-picks__item--selected" : ""}`} key={card.instanceId}>
                <HwatuCard
                  card={card}
                  className="pack-pick__card"
                  selected={selected}
                  onSelect={() => toggleSelection(card.instanceId)}
                  ariaLabel={`${card.month}월 ${card.name}${tag ? `, ${tag.name}` : ""}${pack.category === "burn" ? ", 소각 후보" : ""}`}
                />
                {selected ? <span className="pack-pick__selected-mark">선택 {selectedIds.indexOf(card.instanceId) + 1}</span> : null}
                {pack.category !== "burn" ? <div className={tag ? `pack-pick__details pack-pick__details--${tag.id.replaceAll("_", "-")}` : "pack-pick__details pack-pick__details--plain"}>
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
                </div> : null}
              </li>
            );
          })}
          {pack?.rewardCandidates?.map((candidate, rewardIndex) => {
            const definition = candidate.category === "book"
              ? BOOK_BY_ID[candidate.definitionId]
              : TALISMAN_BY_ID[candidate.definitionId];
            if (!definition) return null;
            const artUrl = getGeneratedAssetUrl(definition.assetTag);
            const index = pack.candidates.length + rewardIndex;
            const selected = selectedIds.includes(candidate.candidateId);
            return (
              <li className={`${index < revealedCount ? "pack-picks__item pack-picks__item--revealed" : "pack-picks__item"}${selected ? " pack-picks__item--selected" : ""}`} key={candidate.candidateId}>
                <button type="button" className="pack-reward-pick" aria-pressed={selected} onClick={() => toggleSelection(candidate.candidateId)}>
                  <span className="pack-reward-pick__art" style={artUrl ? { backgroundImage: `url("${artUrl}")` } : undefined} aria-hidden="true" />
                  <strong>{definition.name}</strong>
                  <small>{definition.description}</small>
                  <b>{candidate.category === "book" ? "족보 레벨 +1" : "부적 획득"}</b>
                </button>
                {selected ? <span className="pack-pick__selected-mark">선택 {selectedIds.indexOf(candidate.candidateId) + 1}</span> : null}
              </li>
            );
          })}
        </ul>
      )}
    </GameModal>
  );
}
