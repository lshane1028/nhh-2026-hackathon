"use client";

import type { ScoreBreakdown } from "@/game/types";
import type { ScoreRevealState } from "./useScoreReveal";

export interface PlayRailProps {
  assetTag: string;
  stageAssetTag: string;
  stageLabel: string;
  stageSubtitle?: string;
  weatherLabel?: string;
  bossLabel?: string | null;
  /** The bar this round must clear right now — target, or the Go threshold. */
  targetScore: number;
  rewardLabel?: string;
  /** Everything scored this round so far. */
  roundScore: number;
  submissionScore?: number;
  collectionScore?: number;
  goCount: number;
  /** The hand currently being previewed, or the hand that was just played. */
  breakdown?: ScoreBreakdown | null;
  formulaCaption: string;
  /**
   * Live playback of a submitted hand. While this is running the rail shows the
   * running numbers instead of the final ones, which is the whole point — the
   * payoff is watching the effects land, not reading the total.
   */
  reveal?: ScoreRevealState;
  handsRemaining: number;
  discardsRemaining: number;
  money: number;
  stageIndex: number;
  stageTotal: number;
  seed?: string;
  onOpenRules?: () => void;
  onRestart?: () => void;
  audioMuted?: boolean;
  onToggleAudio?: () => void;
  className?: string;
}

function joinClassNames(...values: Array<string | false | undefined>): string {
  return values.filter(Boolean).join(" ");
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 2 }).format(value);
}

export function PlayRail({
  assetTag,
  stageAssetTag,
  stageLabel,
  stageSubtitle,
  weatherLabel,
  bossLabel,
  targetScore,
  rewardLabel = "냥",
  roundScore,
  submissionScore = roundScore,
  collectionScore = 0,
  goCount,
  breakdown,
  formulaCaption,
  reveal,
  handsRemaining,
  discardsRemaining,
  money,
  stageIndex,
  stageTotal,
  seed,
  onOpenRules,
  onRestart,
  audioMuted = false,
  onToggleAudio,
  className,
}: PlayRailProps) {
  const progress = targetScore > 0
    ? Math.min(100, Math.round((roundScore / targetScore) * 100))
    : 0;
  const remaining = Math.max(0, targetScore - roundScore);
  const revealLane = reveal?.current
    ? reveal.current.operation === "add_kkeut" || reveal.current.operation === "set_kkeut"
      ? "kkeut"
      : "heung"
    : null;

  return (
    <aside
      className={joinClassNames("play-rail", Boolean(bossLabel) && "play-rail--boss", className)}
      aria-label="판 정보"
      data-asset-tag={assetTag}
    >
      <header className="play-rail__stage">
        <div className="play-rail__stage-plate" data-asset-tag={stageAssetTag}>
          <span aria-hidden="true">月</span>
        </div>
        <div className="play-rail__stage-copy">
          <strong>{stageLabel}</strong>
          {stageSubtitle ? <span>{stageSubtitle}</span> : null}
          <div className="play-rail__badges">
            {weatherLabel ? <em>{weatherLabel}</em> : null}
            {bossLabel ? <em className="play-rail__boss">두목 · {bossLabel}</em> : null}
          </div>
        </div>
      </header>

      <section className="play-rail__goal" aria-label="목표" data-tutorial="rail-goal">
        <span>{goCount > 0 ? `${goCount}고 문턱` : "이 판의 목표"}</span>
        <strong>{formatNumber(targetScore)}</strong>
        <small>보상 {rewardLabel}</small>
      </section>

      <section className="play-rail__progress" aria-label="이번 판 점수">
        <div className="play-rail__progress-head">
          <span>이번 판 점수</span>
          <strong>{formatNumber(roundScore)}</strong>
        </div>
        <div className="play-rail__score-split">
          <span>제출 <b>{formatNumber(submissionScore)}</b></span>
          <span>수집 <b>{formatNumber(collectionScore)}</b><small>고스톱 {formatNumber(collectionScore / 20)}점</small></span>
        </div>
        <div
          className="play-rail__progress-bar"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={targetScore}
          aria-valuenow={Math.min(roundScore, targetScore)}
        >
          <span style={{ width: `${progress}%` }} />
        </div>
        <div className="play-rail__pot">
          <span>{remaining > 0 ? "남은 점수" : "문턱 통과"}</span>
          <strong>{remaining > 0 ? formatNumber(remaining) : "완료"}</strong>
          {goCount > 0 ? <em>{goCount}고</em> : null}
        </div>
      </section>

{/*
        Before submit this shows the BARE hand — 짓 월합 x 끗패 배수 — and nothing
        else. Everything the collection and the talismans add is withheld until
        the hand is played, so the reveal has something left to reveal.
      */}
      <section
        className={joinClassNames(
          "play-rail__formula",
          reveal?.playing && "play-rail__formula--revealing",
          revealLane === "kkeut" && "play-rail__formula--hit-kkeut",
          revealLane === "heung" && "play-rail__formula--hit-heung",
        )}
        aria-label="점수 계산"
        aria-live="polite"
        data-tutorial="rail-formula"
      >
        <span className="play-rail__formula-yaku">
          {breakdown ? breakdown.yakuName : "—"}
        </span>
        <div className="play-rail__formula-values">
          <b className="play-rail__month-sum" key={`k${reveal?.index ?? -1}`}>
            {reveal
              ? formatNumber(reveal.kkeut)
              : breakdown ? formatNumber(breakdown.startingKkeut) : 0}
          </b>
          <i aria-hidden="true">×</i>
          <b className="play-rail__multiplier" key={`h${reveal?.index ?? -1}`}>
            {reveal
              ? formatNumber(reveal.heung)
              : breakdown ? formatNumber(breakdown.startingHeung) : 0}
          </b>
        </div>

        {reveal?.current ? (
          <div
            className={joinClassNames(
              "play-rail__pop",
              revealLane === "kkeut" && "play-rail__pop--kkeut",
              revealLane === "heung" && "play-rail__pop--heung",
            )}
            key={`p${reveal.index}`}
          >
            <span>{reveal.current.label}</span>
            <b>
              {reveal.current.operation === "multiply_heung"
                ? `×${formatNumber(reveal.current.value)}`
                : `+${formatNumber(reveal.current.value)}`}
            </b>
          </div>
        ) : null}

        <div className="play-rail__formula-total">
          <span>
            = {reveal
              ? reveal.total === null ? "…" : formatNumber(reveal.total)
              : breakdown ? formatNumber(breakdown.startingKkeut * breakdown.startingHeung) : 0}
          </span>
        </div>
        <small>{formulaCaption}</small>
      </section>

      <dl className="play-rail__resources" aria-label="남은 자원">
        <div>
          <dt>낼 기회</dt>
          <dd className="play-rail__count-blue">{handsRemaining}</dd>
        </div>
        <div>
          <dt>버리기</dt>
          <dd className="play-rail__count-red">{discardsRemaining}</dd>
        </div>
        <div>
          <dt>냥</dt>
          <dd className="play-rail__count-gold">{money}</dd>
        </div>
        <div>
          <dt>스테이지</dt>
          <dd>
            {stageIndex}
            <small> / {stageTotal}</small>
          </dd>
        </div>
      </dl>

      <nav className="play-rail__actions" aria-label="게임 메뉴">
        {onOpenRules ? <button type="button" onClick={onOpenRules}>규칙</button> : null}
        {onRestart ? <button type="button" onClick={onRestart}>재시작</button> : null}
        {onToggleAudio ? (
          <button
            type="button"
            className="audio-toggle"
            aria-pressed={!audioMuted}
            onClick={onToggleAudio}
          >
            {audioMuted ? "소리 켜기" : "소리 켜짐"}
          </button>
        ) : null}
      </nav>

      {seed ? <code className="play-rail__seed">SEED {seed}</code> : null}
    </aside>
  );
}
