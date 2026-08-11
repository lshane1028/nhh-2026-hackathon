"use client";

import type { CupRolePreviewCounts } from "@/game/engine/collection-bonus";
import type { CardInstance } from "@/game/types";

import { GameModal } from "./GameModal";

export function getCupChoiceActionLabels(preview: CupRolePreviewCounts | null): {
  animal: string;
  chaff: string;
} {
  if (!preview) {
    return { animal: "동물로 기록 · 동물 1장", chaff: "피로 기록 · 피 2점" };
  }
  return {
    animal: `동물로 기록\n동물 ${preview.current.animal}→${preview.animal.animal}장 · 피 ${preview.current.chaff}→${preview.animal.chaff}점`,
    chaff: `피로 기록\n동물 ${preview.current.animal}→${preview.doubleChaff.animal}장 · 피 ${preview.current.chaff}→${preview.doubleChaff.chaff}점`,
  };
}

export function CupChoiceModal({ card, preview, onChoose }: {
  card: CardInstance | null;
  preview: CupRolePreviewCounts | null;
  onChoose: (role: "animal" | "double_chaff") => void;
}) {
  const labels = getCupChoiceActionLabels(preview);
  return (
    <GameModal
      id="cup-role"
      open={Boolean(card)}
      assetTag={card?.assetTag ?? "card-09-animal-cup"}
      title="술잔을 수집판 어디에 기록할까요?"
      description="이번 손의 제출 점수는 이미 확정됐습니다. 이 선택은 수집판 기록과 이번 판 수집 점수에 적용됩니다."
      closeOnBackdrop={false}
      closeLabel="동물로 기록"
      onClose={() => onChoose("animal")}
      className="game-modal--cup"
      actions={[
        { id: "animal", label: labels.animal, variant: "primary", onClick: () => onChoose("animal") },
        { id: "chaff", label: labels.chaff, variant: "primary", onClick: () => onChoose("double_chaff") },
      ]}
    >
      {preview ? (
        <div className="cup-choice__current" aria-label={`술잔을 빼고 현재 동물 ${preview.current.animal}장, 피 ${preview.current.chaff}점`}>
          <p>술잔을 아직 넣지 않은 현재 수집</p>
          <div>
            <span><small>동물</small><strong>{preview.current.animal}<i>장</i></strong></span>
            <span><small>피</small><strong>{preview.current.chaff}<i>점</i></strong></span>
          </div>
        </div>
      ) : null}
      <div className="rules-copy cup-choice__rules">
        <section>
          <h3>동물로 기록</h3>
          <p>동물 줄에 기록합니다. 동물은 5장부터 <strong>1점</strong>, 이후 한 장마다 <strong>+1점</strong>입니다.</p>
        </section>
        <section>
          <h3>피로 기록</h3>
          <p>피 줄에 2점으로 기록합니다. 피는 10점부터 <strong>1점</strong>, 이후 피 1점마다 <strong>+1점</strong>입니다.</p>
        </section>
      </div>
    </GameModal>
  );
}
