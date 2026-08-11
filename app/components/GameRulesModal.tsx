"use client";

import { useMemo, useState } from "react";

import { ALL_IMMEDIATE_YAKU_DEFINITIONS } from "@/game/content/yaku";
import { createStandardHwatuDeck } from "@/game/engine/deck";
import type { CardInstance, ImmediateYakuId } from "@/game/types";

import { GameModal } from "./GameModal";
import { getAtlasPosition } from "./hwatu-atlas";

/** Concrete illustrations only; the engine remains the source of rule truth. */
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

export function GameRulesModal({ open, onClose }: { open: boolean; onClose: () => void }) {
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
                    {sample?.map(([month, kind], index) => {
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
                    }) ?? null}
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
