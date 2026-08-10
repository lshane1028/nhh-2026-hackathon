import { describe, expect, it } from "vitest";

import {
  buildSubmissionBeats,
  getInlineHandPresentation,
  submissionBeatToReveal,
} from "../../app/components/CardActionTheater";
import { createStandardHwatuDeck } from "../engine/deck";
import { calculateBestHandScore } from "../engine/scoring";

const deck = createStandardHwatuDeck();
const card = (month: number) => deck.find((entry) => entry.month === month && entry.kind === "chaff")
  ?? deck.find((entry) => entry.month === month)!;

describe("submission theater timeline", () => {
  it("reveals kkeut first, builds jit one card at a time, then collects every card", () => {
    const submitted = [card(12), card(7), card(4), card(6)];
    const breakdown = calculateBestHandScore({ submittedCards: submitted });
    const captured = [card(1), card(2)];
    const beats = buildSubmissionBeats(breakdown, submitted, [...submitted, ...captured]);

    const yaku = beats.find((beat) => beat.kind === "yaku")!;
    expect(yaku.title).toBe("갑오");
    expect(new Set(yaku.activeCardIds)).toEqual(new Set([submitted[0].instanceId, submitted[1].instanceId]));

    const jit = beats.filter((beat) => beat.kind === "jit-card");
    expect(jit.map((beat) => beat.title)).toEqual(["+4", "+6"]);
    expect(jit.map((beat) => beat.runningJit)).toEqual([4, 10]);
    expect(jit.map((beat) => beat.operation)).toEqual([
      expect.objectContaining({ sourceId: submitted[2].instanceId, operation: "add_kkeut", value: 4 }),
      expect.objectContaining({ sourceId: submitted[3].instanceId, operation: "add_kkeut", value: 6 }),
    ]);
    expect(beats.filter((beat) => beat.kind === "collect").map((beat) => beat.activeCardIds[0]))
      .toEqual([...submitted, ...captured].map((entry) => entry.instanceId));
    expect(beats.at(-1)).toMatchObject({ kind: "finale", runningJit: breakdown.finalKkeut });
  });

  it("holds and intensifies rare or highly upgraded yaku reveals", () => {
    const pair = [card(11), { ...card(11), instanceId: "november-pair", tags: [...card(11).tags] }];
    const ttaeng = buildSubmissionBeats(calculateBestHandScore({ submittedCards: pair }), pair)
      .find((beat) => beat.kind === "yaku")!;
    expect(ttaeng).toMatchObject({ title: "11땡", emphasisTier: 1 });
    expect(ttaeng.duration).toBeGreaterThan(1_500);

    const upgradedCards = [card(3), card(5)];
    const upgraded = buildSubmissionBeats(calculateBestHandScore({
      submittedCards: upgradedCards,
      yakuLevels: { kkeut: 5 },
    }), upgradedCards).find((beat) => beat.kind === "yaku")!;
    expect(upgraded.emphasisTier).toBe(2);
  });

  it("shows a kkeut card's score operation after the yaku emphasis", () => {
    const enhanced = { ...card(7), tags: [...card(7).tags], enhancement: "scarlet" as const };
    const submitted = [card(12), enhanced];
    const breakdown = calculateBestHandScore({ submittedCards: submitted });
    const beats = buildSubmissionBeats(breakdown, submitted);
    const yakuIndex = beats.findIndex((beat) => beat.kind === "yaku");
    const effectIndex = beats.findIndex((beat) => beat.kind === "effect" && beat.operation?.sourceId === enhanced.instanceId);

    expect(effectIndex).toBeGreaterThan(yakuIndex);
    expect(beats[effectIndex].detail).toContain("배수 +3");
  });

  it("does not file stone or boss-disabled cards into the collection board", () => {
    const scoring = [card(12), card(7)];
    const disabled = { ...card(3), tags: [...card(3).tags], disabledForRound: true };
    const stone = { ...card(5), tags: [...card(5).tags], enhancement: "stone" as const };
    const submitted = [...scoring, disabled, stone];
    const breakdown = calculateBestHandScore({ submittedCards: scoring });
    const beats = buildSubmissionBeats(breakdown, submitted);

    expect(beats[0]).toMatchObject({ kind: "intro", title: "4장 제출" });
    expect(beats.filter((beat) => beat.kind === "collect").map((beat) => beat.activeCardIds[0]))
      .toEqual(scoring.map((entry) => entry.instanceId));
  });

  it("files a counts-as card into every effective collection track", () => {
    const scoring = [card(12), card(7)];
    const multiTrack = {
      ...card(3),
      tags: [...card(3).tags, "counts_as_bright"],
      effectTagId: "as_ribbon",
    };
    const breakdown = calculateBestHandScore({ submittedCards: scoring });
    const beats = buildSubmissionBeats(breakdown, scoring, [multiTrack]);
    const collectionBeats = beats.filter((beat) => beat.kind === "collect");

    expect(collectionBeats.map((beat) => beat.collectionTrack)).toEqual(["bright", "ribbon", "chaff"]);
    expect(collectionBeats.every((beat) => beat.activeCardIds[0] === multiTrack.instanceId)).toBe(true);
  });

  it("files the September cup only into the track the player chose", () => {
    const scoring = [card(12), card(7)];
    const cup = deck.find((entry) => entry.tags.includes("cup"))!;
    const breakdown = calculateBestHandScore({ submittedCards: scoring });
    const animalBeats = buildSubmissionBeats(
      breakdown,
      scoring,
      [cup],
      { [cup.instanceId]: "animal" },
    );
    const chaffBeats = buildSubmissionBeats(
      breakdown,
      scoring,
      [cup],
      { [cup.instanceId]: "double_chaff" },
    );

    expect(animalBeats.filter((beat) => beat.kind === "collect").map((beat) => beat.collectionTrack))
      .toEqual(["animal"]);
    expect(chaffBeats.filter((beat) => beat.kind === "collect").map((beat) => beat.collectionTrack))
      .toEqual(["chaff"]);
  });

  it("links weather and boss operations back to the card they modify", () => {
    const submitted = [card(12), card(7)];
    const base = calculateBestHandScore({ submittedCards: submitted });
    const affected = submitted[1];
    const weatherOperation = {
      sourceId: `weather:rain:${affected.instanceId}`,
      label: "비바람",
      operation: "add_kkeut" as const,
      value: 2,
      runningKkeut: base.finalKkeut + 2,
      runningHeung: base.finalHeung,
    };
    const beats = buildSubmissionBeats({ ...base, operations: [...base.operations, weatherOperation] }, submitted);
    const effect = beats.find((beat) => beat.operation === weatherOperation)!;

    expect(effect.activeCardIds).toEqual([affected.instanceId]);
    expect(beats.indexOf(effect)).toBeGreaterThan(beats.findIndex((beat) => beat.kind === "yaku"));
  });

  it("keeps card-effect bonuses while visibly building the jit total", () => {
    const heavy = { ...card(12), tags: [...card(12).tags], effectTagId: "heavy_month" };
    const submitted = [heavy, card(7), card(4), card(6)];
    const breakdown = calculateBestHandScore({ submittedCards: submitted });
    const beats = buildSubmissionBeats(breakdown, submitted);
    const jit = beats.filter((beat) => beat.kind === "jit-card");

    expect(jit.map((beat) => beat.title)).toEqual(["+4", "+6"]);
    expect(jit.map((beat) => beat.runningJit)).toEqual([4, 10]);
    expect(jit.at(-1)?.detail).toContain("짓 10 완성");
    expect(beats.at(-1)?.runningJit).toBe(breakdown.finalKkeut);
  });

  it("feeds each submission beat's running values to the PlayRail reveal", () => {
    const submitted = [card(12), { ...card(7), tags: [...card(7).tags], enhancement: "scarlet" as const }];
    const breakdown = calculateBestHandScore({ submittedCards: submitted });
    const beats = buildSubmissionBeats(breakdown, submitted);
    const effectIndex = beats.findIndex((beat) => beat.kind === "effect");
    const effectReveal = submissionBeatToReveal(beats[effectIndex], effectIndex, beats.length, breakdown.score);
    const finaleReveal = submissionBeatToReveal(beats.at(-1)!, beats.length - 1, beats.length, breakdown.score);

    expect(effectReveal).toMatchObject({
      playing: true,
      kkeut: beats[effectIndex].runningJit,
      heung: beats[effectIndex].runningHeung,
      total: null,
      current: beats[effectIndex].operation,
      index: effectIndex + 1,
      count: beats.length,
    });
    expect(finaleReveal).toMatchObject({
      playing: false,
      kkeut: breakdown.finalKkeut,
      heung: breakdown.finalHeung,
      total: breakdown.score,
    });
  });

  it("puts permanent talisman growth after the score finale and keeps its source visible", () => {
    const submitted = [card(12), card(7)];
    const breakdown = calculateBestHandScore({ submittedCards: submitted });
    const beats = buildSubmissionBeats(breakdown, submitted, submitted, undefined, [{
      sourceId: "owned:dark-practice",
      label: "무광 연습",
      delta: 0.35,
      total: 1.05,
    }]);
    const finaleIndex = beats.findIndex((beat) => beat.kind === "finale");
    const growth = beats.at(-1)!;

    expect(finaleIndex).toBe(beats.length - 2);
    expect(growth).toMatchObject({
      kind: "growth",
      sourceId: "owned:dark-practice",
      title: "무광 연습 · 성장 +0.35",
      detail: "영구 성장 누적 +1.05",
    });
    expect(submissionBeatToReveal(growth, beats.length - 1, beats.length, breakdown.score))
      .toMatchObject({ playing: true, total: breakdown.score, current: null });
  });

  it("keeps discard ghosts in the hand fan, then swaps to the real drawn hand", () => {
    const before = [card(1), card(2), card(3), card(4)];
    const discarded = [before[1], before[3]];
    const drawn = card(5);
    const current = [before[0], before[2], drawn];
    const discarding = getInlineHandPresentation(before, current, discarded, {
      kind: "discard",
      activeCardId: discarded[1].instanceId,
      index: 1,
      count: 2,
    });
    const drawing = getInlineHandPresentation(before, current, discarded, {
      kind: "draw",
      activeCardId: drawn.instanceId,
      index: 0,
      count: 1,
    });

    expect(discarding.cards).toBe(before);
    expect([...discarding.discardedIds]).toEqual([discarded[0].instanceId]);
    expect(discarding.discardingId).toBe(discarded[1].instanceId);
    expect(drawing.cards).toBe(current);
    expect(drawing.drawingId).toBe(drawn.instanceId);
    expect(drawing.discardedIds.size).toBe(0);
  });
});
