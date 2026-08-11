"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { CollectionTrack, CupRoleLookup } from "@/game/engine/collection-board";
import type { CardInstance, GameState } from "@/game/types";
import type { DiscardBeat, SubmissionBeat } from "../components/CardActionTheater";
import { playDrawSnapSound } from "../audio/game-sfx";

export interface CardPresentationSnapshot {
  id: string;
  kind: "submit" | "discard";
  cards: CardInstance[];
  collectionCards: CardInstance[];
  collectionCupRoles: CupRoleLookup;
  collectionCardIdsBefore: string[];
  handBefore: CardInstance[];
  keptCardIds: string[];
  submissionScoreBefore: number;
  collectionScoreBefore: number;
  roundScoreBefore: number;
  talismanGrowthBefore: Record<string, number>;
}

export interface SubmissionPlayback {
  beat: SubmissionBeat;
  index: number;
  count: number;
}

/** Owns all transient card-theater, collection-flight, and draw feedback state. */
export function useCardPresentation(state: GameState) {
  const [cardPresentation, setCardPresentation] = useState<CardPresentationSnapshot | null>(null);
  const [submissionPlayback, setSubmissionPlayback] = useState<SubmissionPlayback | null>(null);
  const [discardPlayback, setDiscardPlayback] = useState<DiscardBeat | null>(null);
  const [collectionLanding, setCollectionLanding] = useState<{ originId: string; kind: CollectionTrack } | null>(null);
  const [landedCollectionTargets, setLandedCollectionTargets] = useState<Set<string>>(() => new Set());
  const [drawFeedbackIds, setDrawFeedbackIds] = useState<Set<string>>(() => new Set());
  const previousHandIds = useRef<Set<string>>(new Set());
  const collectionLandingTimer = useRef<number | null>(null);

  const clearCardPresentation = useCallback(() => {
    if (collectionLandingTimer.current !== null) {
      window.clearTimeout(collectionLandingTimer.current);
      collectionLandingTimer.current = null;
    }
    setCardPresentation(null);
    setSubmissionPlayback(null);
    setDiscardPlayback(null);
    setCollectionLanding(null);
    setLandedCollectionTargets(new Set());
  }, []);

  const handleSubmissionBeat = useCallback((beat: SubmissionBeat, index: number, count: number) => {
    setSubmissionPlayback({ beat, index, count });
  }, []);
  const handleDiscardBeat = useCallback((beat: DiscardBeat) => setDiscardPlayback(beat), []);
  const primeDiscardPlayback = useCallback((cards: readonly CardInstance[]) => {
    const first = cards[0];
    setDiscardPlayback(first ? {
      kind: "discard",
      activeCardId: first.instanceId,
      index: 0,
      count: cards.length,
    } : null);
  }, []);
  const handleCollectionLand = useCallback((card: CardInstance, _index: number, track: CollectionTrack) => {
    setLandedCollectionTargets((current) => {
      const next = new Set(current);
      next.add(`${track}:${card.instanceId}`);
      return next;
    });
    if (collectionLandingTimer.current !== null) window.clearTimeout(collectionLandingTimer.current);
    setCollectionLanding({ originId: card.originId, kind: track });
    collectionLandingTimer.current = window.setTimeout(() => {
      setCollectionLanding(null);
      collectionLandingTimer.current = null;
    }, 360);
  }, []);

  const assignCupRoleForPresentation = useCallback((cardId: string, role: "animal" | "double_chaff") => {
    setCardPresentation((current) => {
      if (current?.kind !== "submit") return current;
      const assignedRoles = typeof current.collectionCupRoles === "string"
        ? {}
        : current.collectionCupRoles;
      return {
        ...current,
        collectionCupRoles: { ...assignedRoles, [cardId]: role },
      };
    });
  }, []);

  useEffect(() => () => {
    if (collectionLandingTimer.current !== null) window.clearTimeout(collectionLandingTimer.current);
  }, []);

  useEffect(() => {
    if (state.screen !== "play" && state.screen !== "decision") {
      previousHandIds.current = new Set();
      return;
    }
    if (cardPresentation?.kind === "submit") return;
    const currentIds = new Set(state.hand.map((card) => card.instanceId));
    const added = state.hand.filter((card) => !previousHandIds.current.has(card.instanceId));
    previousHandIds.current = currentIds;
    if (cardPresentation || added.length === 0) return;

    setDrawFeedbackIds(new Set(added.map((card) => card.instanceId)));
    const timers = added.map((_, index) => window.setTimeout(() => playDrawSnapSound(index), index * 75));
    timers.push(window.setTimeout(() => setDrawFeedbackIds(new Set()), 720));
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [cardPresentation, state.hand, state.screen]);

  return {
    cardPresentation,
    setCardPresentation,
    submissionPlayback,
    discardPlayback,
    collectionLanding,
    landedCollectionTargets,
    setLandedCollectionTargets,
    drawFeedbackIds,
    clearCardPresentation,
    handleSubmissionBeat,
    handleDiscardBeat,
    primeDiscardPlayback,
    handleCollectionLand,
    assignCupRoleForPresentation,
  };
}
