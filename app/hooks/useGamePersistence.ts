"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { loadGame, saveGame } from "@/game/state/storage";
import type { GameState } from "@/game/types";

const SAVE_DEBOUNCE_MS = 120;

/** Loads once after hydration and batches local save writes during active play. */
export function useGamePersistence(state: GameState) {
  const pendingState = useRef<GameState | null>(null);
  const saveTimer = useRef<number | null>(null);
  const [savedState, setSavedState] = useState<GameState | null>(null);

  const flush = useCallback(() => {
    if (saveTimer.current !== null) {
      window.clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    if (!pendingState.current) return;
    saveGame(pendingState.current);
    pendingState.current = null;
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => setSavedState(loadGame()), 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (state.runId === "not-started" || state.screen === "title") return;
    pendingState.current = state;
    if (saveTimer.current !== null) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(flush, SAVE_DEBOUNCE_MS);
  }, [flush, state]);

  useEffect(() => {
    window.addEventListener("pagehide", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, [flush]);

  const clearLoadedSave = useCallback(() => setSavedState(null), []);
  return { savedState, clearLoadedSave };
}
