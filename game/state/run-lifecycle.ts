import { CONTRACTS } from "../content/meta";
import { randomAt } from "../engine/rng";
import type { GameState } from "../types";

export function openSeasonContract(state: GameState): GameState {
  let cursor = state.rngCursor;
  const pool = [...CONTRACTS];
  const choices: string[] = [];
  while (choices.length < 2 && pool.length) {
    const index = Math.floor(randomAt(`${state.seed}:contract:${state.stage}`, cursor++) * pool.length);
    choices.push(pool.splice(index, 1)[0].id);
  }
  return { ...state, screen: "contract", contractChoices: choices, rngCursor: cursor };
}

export function advanceAfterShop(state: GameState): GameState {
  if (state.stage % 3 === 0) return openSeasonContract(state);
  return {
    ...state,
    stage: state.stage + 1,
    screen: "round_intro",
    shopOffers: [],
    shopType: null,
    pendingPack: null,
  };
}
