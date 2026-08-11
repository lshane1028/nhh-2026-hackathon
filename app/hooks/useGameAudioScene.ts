"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { ScreenId } from "@/game/types";
import {
  getGameAudioMuted,
  playShopEntrySound,
  primeGameAudio,
  resolveGameMusicScene,
  setGameMusicScene,
  toggleGameAudio,
} from "../audio/game-sfx";

export function useGameAudioScene(screen: ScreenId, bossMonth: number | null) {
  const [audioMuted, setAudioMuted] = useState(false);
  const previousScreen = useRef(screen);

  useEffect(() => {
    const timer = window.setTimeout(() => setAudioMuted(getGameAudioMuted()), 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (screen === "shop" && previousScreen.current !== "shop") playShopEntrySound();
    previousScreen.current = screen;
  }, [screen]);

  const musicScene = resolveGameMusicScene(screen, bossMonth);
  useEffect(() => setGameMusicScene(musicScene), [musicScene]);

  const toggleAudio = useCallback(() => {
    primeGameAudio();
    setAudioMuted(toggleGameAudio());
  }, []);

  return { audioMuted, toggleAudio };
}
