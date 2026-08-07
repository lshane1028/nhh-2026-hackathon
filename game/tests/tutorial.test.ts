import { describe, expect, it } from "vitest";
import { TUTORIAL_STEPS } from "../../app/components/tutorial-steps";
import { createStandardHwatuDeck } from "../engine/deck";
import { createGoChainState } from "../engine/go";
import { createInitialGameState } from "../state/game";
import type { GameState } from "../types";

/**
 * The tutorial cursor is derived from game state on every render, so a
 * `doneWhen` that can flip back to false snaps the player to an earlier step.
 * These tests pin the two ways that broke in practice.
 */

const deck = createStandardHwatuDeck();

function playing(patch: Partial<GameState> = {}): GameState {
  return {
    ...createInitialGameState("TUTORIAL"),
    runId: "tutorial",
    screen: "play",
    tutorialMode: true,
    stage: 1,
    deck,
    hand: deck.slice(0, 8),
    chain: createGoChainState(),
    ...patch,
  };
}

describe("tutorial steps", () => {
  it("has unique ids and non-empty copy", () => {
    expect(new Set(TUTORIAL_STEPS.map((step) => step.id)).size).toBe(TUTORIAL_STEPS.length);
    for (const step of TUTORIAL_STEPS) {
      expect(step.title.trim().length).toBeGreaterThan(0);
      expect(step.body.trim().length).toBeGreaterThan(0);
      expect(step.target.trim().length).toBeGreaterThan(0);
    }
  });

  it("keeps a hint short enough to sit beside the Next button", () => {
    // The hint shares the action row with the button now. Anything long wraps
    // and pushes the callout off screen, which is how the old dead ends were
    // discovered in the first place.
    for (const step of TUTORIAL_STEPS) {
      if (!step.actionHint) continue;
      expect(step.actionHint.length, `${step.id}: actionHint is too long`).toBeLessThanOrEqual(24);
    }
  });

  it("never keys a doneWhen off something the player can undo", () => {
    // Selecting cards and clearing the selection is the obvious one: the 손패
    // step used to advance on `selectedCardIds.length >= 2` and rewind the
    // moment a card was deselected.
    const empty = playing({ selectedCardIds: [] });
    const selected = playing({ selectedCardIds: deck.slice(0, 3).map((card) => card.instanceId) });

    for (const step of TUTORIAL_STEPS) {
      if (!step.doneWhen) continue;
      if (step.doneWhen(empty)) continue;
      expect(
        step.doneWhen(selected),
        `${step.id}: doneWhen flips with card selection, so deselecting rewinds the tutorial`,
      ).toBe(false);
    }
  });

  it("keeps every doneWhen monotonic along the round's forward progress", () => {
    // A forward walk through a first month: play → decision → reward → shop →
    // next stage. Counters carry forward the way the reducer carries them —
    // `roundSubmissionIndex` only resets in `startStage`, so it is still set
    // while the shop is open. No predicate may switch back off along the way.
    const wentOnce = { ...createGoChainState(), goCount: 1 as const };
    const charm = [{ instanceId: "t", definitionId: "t_first_charm", growth: 0 }];
    const timeline: GameState[] = [
      playing(),
      playing({ roundSubmissionIndex: 1 }),
      playing({ roundSubmissionIndex: 2, chain: wentOnce }),
      playing({ screen: "decision", roundSubmissionIndex: 2, chain: wentOnce }),
      playing({ screen: "reward", roundSubmissionIndex: 2, chain: wentOnce }),
      playing({ screen: "shop", roundSubmissionIndex: 2, chain: wentOnce }),
      playing({ screen: "shop", roundSubmissionIndex: 2, chain: wentOnce, talismans: charm }),
      // 2월이 열리면 판 단위 카운터는 전부 0으로 돌아간다. 여기서 되감기지
      // 않으려면 모든 단계가 stage 탈출구를 가지고 있어야 한다.
      playing({ screen: "play", stage: 2 }),
    ];

    for (const step of TUTORIAL_STEPS) {
      if (!step.doneWhen) continue;
      let everDone = false;
      for (const state of timeline) {
        const done = step.doneWhen(state);
        if (done) everDone = true;
        else if (everDone) {
          throw new Error(`${step.id}: doneWhen went true then false again along the round timeline`);
        }
      }
    }
  });

  it("ends on a step the player can actually finish", () => {
    const last = TUTORIAL_STEPS[TUTORIAL_STEPS.length - 1];
    expect(last.doneWhen?.(playing({ screen: "play", stage: 2 }))).toBe(true);
  });
});
