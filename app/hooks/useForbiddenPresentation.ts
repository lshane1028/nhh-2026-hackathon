"use client";

import { useCallback, useState, type Dispatch } from "react";

import { primeGameAudio } from "../audio/game-sfx";
import {
  buildForbiddenRitualPresentation,
  createForbiddenRitualSnapshot,
  type ForbiddenRitualPresentation,
} from "../components/ForbiddenRitualTheater";
import { gameReducer, getPendingConsumableDefinition } from "@/game/state/game";
import type { GameAction } from "@/game/state/actions";
import type { GameState } from "@/game/types";

export function useForbiddenPresentation(
  state: GameState,
  dispatch: Dispatch<GameAction>,
) {
  const [presentation, setPresentation] = useState<ForbiddenRitualPresentation | null>(null);

  const applyConsumable = useCallback((option?: string) => {
    const definition = getPendingConsumableDefinition(state);
    const action = { type: "APPLY_CONSUMABLE", option } as const;
    if (definition && "benefit" in definition) {
      const snapshot = createForbiddenRitualSnapshot(state, definition);
      const nextState = gameReducer(state, action);
      if (nextState !== state && nextState.lastConsumableId === definition.id) {
        primeGameAudio();
        setPresentation(buildForbiddenRitualPresentation(snapshot, nextState));
      }
    }
    dispatch(action);
  }, [dispatch, state]);

  const closePresentation = useCallback(() => setPresentation(null), []);

  return {
    forbiddenPresentation: presentation,
    applyConsumableWithPresentation: applyConsumable,
    closeForbiddenPresentation: closePresentation,
  };
}
