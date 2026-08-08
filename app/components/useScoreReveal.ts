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

export interface ScoreRevealState {
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
  playing: false,
  kkeut: 0,
  heung: 0,
  total: null,
  current: null,
  index: 0,
  count: 0,
};

/** Identity of a scored hand, so a re-render never restarts a reveal. */
function handKey(breakdown: ScoreBreakdown): string {
  return [
    breakdown.yakuId,
    breakdown.score,
    breakdown.operations.length,
    breakdown.scoringCardIds.join(","),
  ].join("|");
}

export function useScoreReveal(breakdown: ScoreBreakdown | null): ScoreRevealState {
  const key = breakdown ? handKey(breakdown) : null;
  const [progress, setProgress] = useState<{ key: string | null; index: number }>({
    key: null,
    index: 0,
  });

  useEffect(() => {
    if (!breakdown || !key) return;
    const operations = breakdown.operations;
    if (operations.length === 0) return;

    const timers = operations.map((_, index) => window.setTimeout(
      () => setProgress({ key, index: index + 1 }),
      LEAD_MS + index * STEP_MS,
    ));
    // One past the end means "done", which is when the total is allowed to land.
    timers.push(window.setTimeout(
      () => setProgress({ key, index: operations.length + 1 }),
      LEAD_MS + operations.length * STEP_MS + TAIL_MS,
    ));

    return () => {
      for (const timer of timers) window.clearTimeout(timer);
    };
  }, [breakdown, key]);

  if (!breakdown || !key) return IDLE;

  const operations = breakdown.operations;
  // A hand we have not started playing sits at zero, which is the bare 짓 × 끗패.
  const index = progress.key === key ? Math.min(progress.index, operations.length + 1) : 0;
  const done = operations.length === 0 || index > operations.length;
  const applied = Math.min(index, operations.length);
  const current = applied > 0 && !done ? operations[applied - 1] : null;
  const last = applied > 0 ? operations[applied - 1] : null;

  return {
    playing: !done,
    kkeut: done ? breakdown.finalKkeut : last?.runningKkeut ?? breakdown.startingKkeut,
    heung: done ? breakdown.finalHeung : last?.runningHeung ?? breakdown.startingHeung,
    total: done ? breakdown.score : null,
    current,
    index: applied,
    count: operations.length,
  };
}
