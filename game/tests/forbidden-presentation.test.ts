import { describe, expect, it } from "vitest";

import {
  buildForbiddenRitualPresentation,
  createForbiddenRitualSnapshot,
} from "../../app/components/ForbiddenRitualTheater";
import { FORBIDDEN_BY_ID } from "../content/upgrades";
import { createInitialGameState } from "../state/game";

describe("forbidden ritual result presentation", () => {
  it("names every randomly burned card instead of hiding the targets", () => {
    const base = createInitialGameState("RITUAL-BURN-REVEAL");
    const definition = FORBIDDEN_BY_ID.f_great_burn;
    const burned = base.deck.slice(0, 5);
    const snapshot = createForbiddenRitualSnapshot(base, definition);
    const after = {
      ...base,
      deck: base.deck.filter((card) => !burned.some((entry) => entry.instanceId === card.instanceId)),
      money: base.money + 18,
    };

    const presentation = buildForbiddenRitualPresentation(snapshot, after);
    expect(presentation.cards.map((entry) => entry.card.instanceId)).toEqual(burned.map((card) => card.instanceId));
    expect(presentation.cards.every((entry) => entry.label === "무작위로 뽑혀 영구 소각")).toBe(true);
    expect(presentation.summaries).toContain("영구 소각 5장");
  });

  it("shows the source and both exact copies made by 복제굿", () => {
    const base = createInitialGameState("RITUAL-CLONE-REVEAL");
    const definition = FORBIDDEN_BY_ID.f_clone_ritual;
    const source = base.deck[0];
    const selected = { ...base, pendingTargetIds: [source.instanceId] };
    const snapshot = createForbiddenRitualSnapshot(selected, definition);
    const copies = [1, 2].map((index) => ({ ...source, instanceId: `copy-${index}`, tags: [...source.tags] }));
    const after = { ...base, deck: [...base.deck, ...copies], handSize: base.handSize - 1 };

    const presentation = buildForbiddenRitualPresentation(snapshot, after);
    expect(presentation.cards[0]).toMatchObject({ card: source, label: "복제 원본", tone: "source" });
    expect(presentation.cards.filter((entry) => entry.tone === "created")).toHaveLength(2);
    expect(presentation.summaries).toContain("새 카드 2장");
    expect(presentation.summaries).toContain(`손패 크기 ${base.handSize} → ${base.handSize - 1}`);
  });
});
