"use client";

import { useEffect, useState } from "react";
import type { ScoreBreakdown } from "@/game/types";

/**
 * Plays a scored hand back one effect at a time.
 *
 * The engine already hands us everything needed: `breakdown.operations` is an
 * ordered list, each entry carrying the source that fired, a label, and the
 * running 월 합 / 배수 AFTER it applied. So the reveal is not a simulation — it
 * is a cursor walking a list the scorer already produced.
 *
 * This exists because showing the final number the instant you press 제출
 * throws away the whole payoff. The interesting part is not "you scored 4,200",
 * it is watching 짓 20 × 8 turn into ×1.6 → +40 → ×2.2 one beat at a time. That
 * sequence is the reason to have built the deck.
 *
 * Before a hand is submitted the rail shows only `startingKkeut × startingHeung`
 * — the bare 짓 and 끗패. Everything the collection and the talismans add is
 * withheld until submit, so the reveal has something to reveal.
 *
 * Only the cursor lives in state, and it is only ever moved from a timer
 * callback. Everything else is derived during render: React forbids setting
 * state synchronously inside an effect, and a hook that fights that rule ends
 * up re-running the animation on every unrelated re-render anyway.
 */

/** Beat length. Slow enough to read a label, fast enough not to be a cutscene. */
const STEP_MS = 260;
/** A breath before the first effect fires, so the base reads as the base. */
const LEAD_MS = 320;
/** And after the last one, before the total lands. */
const TAIL_MS = 420;
/** Keep the settled result readable, then return the idle rail to 0 × 0. */
const RESULT_HOLD_MS = 700;

export interface ScoreRevealState {
  /** Whether the submitted hand should still occupy the score rail. */
  visible: boolean;
  /** True while a hand is being played back. */
  playing: boolean;
  /** 월 합 to show right now. */
  kkeut: number;
  /** 배수 to show right now. */
  heung: number;
  /** Total to show, or null while the reveal is still running. */
  total: number | null;
  /** The effect that just fired, for the floating label and the talisman pop. */
  current: ScoreBreakdown["operations"][number] | null;
  index: number;
  count: number;
}

const IDLE: ScoreRevealState = {
  visible: false,
  playing: false,
  kkeut: 0,
  heung: 0,
  total: null,
  current: null,
  index: 0,
  count: 0,
};

/** Identity of a submission, so recycled cards with the same score still replay. */
export function scoreRevealKey(breakdown: ScoreBreakdown, submissionId: string): string {
  return [
    submissionId,
    breakdown.yakuId,
    breakdown.score,
    breakdown.operations.length,
    breakdown.scoringCardIds.join(","),
  ].join("|");
}

export function deriveScoreRevealState(
  breakdown: ScoreBreakdown | null,
  submissionId: string,
  progress: { key: string | null; index: number },
): ScoreRevealState {
  if (!breakdown) return IDLE;

  const key = scoreRevealKey(breakdown, submissionId);
  const operations = breakdown.operations;
  // A newly submitted hand starts at its bare values. One step past the
  // operations is the settled result; two steps past is the idle/hidden rail.
  const index = progress.key === key ? Math.min(progress.index, operations.length + 2) : 0;
  const completed = index > operations.length;
  const hidden = index > operations.length + 1;
  const applied = Math.min(index, operations.length);
  const current = applied > 0 && !completed ? operations[applied - 1] : null;
  const last = applied > 0 ? operations[applied - 1] : null;

  return {
    visible: !hidden,
    playing: !completed,
    kkeut: completed ? breakdown.finalKkeut : last?.runningKkeut ?? breakdown.startingKkeut,
    heung: completed ? breakdown.finalHeung : last?.runningHeung ?? breakdown.startingHeung,
    total: completed ? breakdown.score : null,
    current,
    index: applied,
    count: operations.length,
  };
}

export function selectScoreRailBreakdown({
  preview,
  lastScore,
  selectedCount,
  revealVisible,
}: {
  preview: ScoreBreakdown | null;
  lastScore: ScoreBreakdown | null;
  selectedCount: number;
  revealVisible: boolean;
}): ScoreBreakdown | null {
  if (preview) return preview;
  if (selectedCount > 0 || !revealVisible) return null;
  return lastScore;
}

export function selectScoreRevealBreakdown(
  lastScore: ScoreBreakdown | null,
  submissionId: string,
  suppressedSubmissionId: string | null,
): ScoreBreakdown | null {
  return submissionId === suppressedSubmissionId ? null : lastScore;
}

export function useScoreReveal(
  breakdown: ScoreBreakdown | null,
  submissionId: string,
): ScoreRevealState {
  const key = breakdown ? scoreRevealKey(breakdown, submissionId) : null;
  const [progress, setProgress] = useState<{ key: string | null; index: number }>({
    key: null,
    index: 0,
  });

  useEffect(() => {
    if (!breakdown || !key) return;
    const operations = breakdown.operations;

    const timers = operations.map((_, index) => window.setTimeout(
      () => setProgress({ key, index: index + 1 }),
      LEAD_MS + index * STEP_MS,
    ));
    // One past the end means "done", which is when the total is allowed to land.
    const completedAt = LEAD_MS + operations.length * STEP_MS + TAIL_MS;
    timers.push(window.setTimeout(
      () => setProgress({ key, index: operations.length + 1 }),
      completedAt,
    ));
    // Two past the end releases lastScore from the rail. The domain state keeps
    // it for settlement, but the presentation returns to its neutral 0 × 0.
    timers.push(window.setTimeout(
      () => setProgress({ key, index: operations.length + 2 }),
      completedAt + RESULT_HOLD_MS,
    ));

    return () => {
      for (const timer of timers) window.clearTimeout(timer);
    };
  }, [breakdown, key]);

  return deriveScoreRevealState(breakdown, submissionId, progress);
}
