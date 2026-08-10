import { describe, expect, it } from "vitest";

import { FORBIDDEN_BY_ID, FORBIDDEN_CARDS } from "../content/upgrades";
import {
  applyForbiddenEffect,
  isForbiddenTargetEligible,
  isForbiddenTargetSelectionValid,
  type ForbiddenRunSlice,
} from "../engine/consumables";
import { createStandardHwatuDeck } from "../engine/deck";
import type { ForbiddenDefinition, TalismanInstance } from "../types";

function forbidden(id: string): ForbiddenDefinition {
  const definition = FORBIDDEN_BY_ID[id] as ForbiddenDefinition | undefined;
  if (!definition) throw new Error(`Missing forbidden definition: ${id}`);
  return definition;
}

function runSlice(overrides: Partial<ForbiddenRunSlice> = {}): ForbiddenRunSlice {
  return {
    deck: createStandardHwatuDeck(),
    handSize: 8,
    money: 20,
    talismans: [],
    talismanSlots: 5,
    yakuLevels: {},
    ...overrides,
  };
}

describe("forbidden consumables", () => {
  it("executes every 금단장 definition instead of leaving a catalog-only effect", () => {
    for (const definition of FORBIDDEN_CARDS) {
      const state = runSlice({
        money: 30,
        talismanSlots: 5,
        talismans: [
          { instanceId: "audit-left", definitionId: "t_first_charm", growth: 0 },
          { instanceId: "audit-target", definitionId: "t_empty_shrine", growth: 0 },
        ],
        yakuLevels: { ttaeng: { level: 1, mastery: 0 } },
      });
      const nonBright = state.deck.find((card) => card.kind !== "bright")!;
      const cardTargets = definition.effectKey === "all_to_january"
        ? state.deck.slice(0, 2).map((card) => card.instanceId)
        : [nonBright.instanceId];
      const targets = definition.effectKey === "random_burn_for_money"
        ? state.deck.map((card) => card.instanceId)
        : definition.targetKind === "card"
          ? cardTargets
          : definition.targetKind === "talisman"
            ? ["audit-target"]
            : [];
      let sequence = 0;
      const result = applyForbiddenEffect(state, definition, targets, (prefix) => `${prefix}:${sequence++}`);

      expect(result.applied, definition.name).toBe(true);
      expect({
        deck: result.deck,
        handSize: result.handSize,
        money: result.money,
        talismans: result.talismans,
        yakuLevels: result.yakuLevels,
        legendary: result.grantLegendaryTalisman,
      }, `${definition.name} produced no state change`).not.toEqual({
        deck: state.deck,
        handSize: state.handSize,
        money: state.money,
        talismans: state.talismans,
        yakuLevels: state.yakuLevels,
        legendary: false,
      });
    }
  });

  it("turns 팔방패 into a collection wildcard without erasing its printed month", () => {
    const definition = forbidden("f_monthless");
    const deck = createStandardHwatuDeck();
    const target = { ...deck.find((card) => card.month === 8)!, tags: ["zero_base"] };
    const state = runSlice({ deck: [target, ...deck.filter((card) => card.instanceId !== target.instanceId)], money: 4 });

    const applied = applyForbiddenEffect(state, definition, [target.instanceId], () => "unused");

    expect(applied.applied).toBe(true);
    expect(applied.money).toBe(0);
    expect(applied.deck.find((card) => card.instanceId === target.instanceId)).toMatchObject({
      month: 8,
      enhancement: "wild",
    });
    expect(applied.deck.find((card) => card.instanceId === target.instanceId)?.tags).not.toContain("zero_base");
    expect(isForbiddenTargetEligible(applied, definition, target.instanceId)).toBe(false);
  });

  it("requires exactly one non-bright target for 광내림 and charges its 6냥 ritual cost", () => {
    const definition = forbidden("f_bright_descent");
    const state = runSlice({ money: 6 });
    const target = state.deck.find((card) => card.kind !== "bright");
    const other = state.deck.find((card) => card.kind !== "bright" && card.instanceId !== target?.instanceId);
    const bright = state.deck.find((card) => card.kind === "bright");
    if (!target || !other || !bright) throw new Error("Test deck is missing target cards");

    expect(isForbiddenTargetEligible(state, definition, target.instanceId)).toBe(true);
    expect(isForbiddenTargetEligible(state, definition, bright.instanceId)).toBe(false);
    expect(isForbiddenTargetSelectionValid(state, definition, [])).toBe(false);
    expect(isForbiddenTargetSelectionValid(state, definition, [target.instanceId, other.instanceId])).toBe(false);

    const rejected = applyForbiddenEffect(state, definition, [bright.instanceId], () => "unused");
    expect(rejected.applied).toBe(false);
    expect(rejected.money).toBe(6);
    expect(rejected.deck.find((card) => card.instanceId === bright.instanceId)?.kind).toBe("bright");

    const applied = applyForbiddenEffect(state, definition, [target.instanceId], () => "unused");
    expect(applied.applied).toBe(true);
    expect(applied.money).toBe(0);
    expect(applied.deck.find((card) => card.instanceId === target.instanceId)).toMatchObject({
      kind: "bright",
      chaffValue: 0,
    });
    expect(state.deck.find((card) => card.instanceId === target.instanceId)?.kind).not.toBe("bright");
  });

  it("keeps 큰 소각 automatic and burns five eligible cards despite its 0-target UI", () => {
    const definition = forbidden("f_great_burn");
    const deck = createStandardHwatuDeck();
    const protectedCard = { ...deck[0], enhancement: "inked" as const };
    const state = runSlice({ deck: [protectedCard, ...deck.slice(1)], money: 10 });

    expect(definition.maxTargets).toBe(0);
    const applied = applyForbiddenEffect(
      state,
      definition,
      state.deck.map((card) => card.instanceId),
      () => "unused",
    );

    expect(applied.applied).toBe(true);
    expect(applied.deck).toHaveLength(state.deck.length - 5);
    expect(applied.deck.some((card) => card.instanceId === protectedCard.instanceId)).toBe(true);
    expect(applied.money).toBe(28);
  });

  it("engraves the chosen talisman and makes 전승 consume only its left neighbour", () => {
    const talismans: TalismanInstance[] = [
      { instanceId: "talisman-a", definitionId: "t_first_charm", growth: 1 },
      { instanceId: "talisman-b", definitionId: "t_empty_shrine", growth: 2 },
      { instanceId: "talisman-c", definitionId: "t_twelve_moons", growth: 3 },
    ];
    const state = runSlice({ talismans });

    const possession = applyForbiddenEffect(
      state,
      forbidden("f_talisman_possession"),
      ["talisman-b"],
      () => "unused",
    );
    expect(possession.applied).toBe(true);
    expect(possession.handSize).toBe(7);
    expect(possession.talismans.map((item) => item.edition)).toEqual([undefined, "engraved", undefined]);

    const inheritance = forbidden("f_inheritance");
    expect(isForbiddenTargetEligible(state, inheritance, "talisman-a")).toBe(false);
    expect(isForbiddenTargetEligible(state, inheritance, "talisman-c")).toBe(true);
    const inherited = applyForbiddenEffect(
      state,
      inheritance,
      ["talisman-c"],
      () => "talisman-copy",
    );
    expect(inherited.applied).toBe(true);
    expect(inherited.talismans.map((item) => item.definitionId)).toEqual([
      "t_first_charm",
      "t_twelve_moons",
      "t_twelve_moons",
    ]);
    expect(inherited.talismans.map((item) => item.instanceId)).toEqual([
      "talisman-a",
      "talisman-copy",
      "talisman-c",
    ]);
  });

  it("blocks 전승 when sacrificing an engraved slot would overflow the pouch", () => {
    const talismans: TalismanInstance[] = Array.from({ length: 6 }, (_, index) => ({
      instanceId: `talisman-${index}`,
      definitionId: index === 5 ? "t_empty_shrine" : "t_first_charm",
      growth: 0,
      edition: index === 4 ? "engraved" as const : undefined,
    }));
    const state = runSlice({ talismans, talismanSlots: 5 });
    const inheritance = forbidden("f_inheritance");

    expect(isForbiddenTargetEligible(state, inheritance, "talisman-5")).toBe(false);
    expect(applyForbiddenEffect(state, inheritance, ["talisman-5"], () => "copy").applied).toBe(false);

    const engravedTarget = runSlice({
      talismans: talismans.map((item, index) => index === 5 ? { ...item, edition: "engraved" as const } : item),
      talismanSlots: 5,
    });
    expect(isForbiddenTargetEligible(engravedTarget, inheritance, "talisman-5")).toBe(true);
  });

  it("blocks 전승 targets whose structural effect cannot stack", () => {
    const state = runSlice({
      talismanSlots: 7,
      talismans: [
        { instanceId: "left-sacrifice", definitionId: "t_first_charm", growth: 0 },
        { instanceId: "stacking-target", definitionId: "t_empty_shrine", growth: 0 },
        { instanceId: "structural-target", definitionId: "t_leap_calendar", growth: 0 },
        { instanceId: "boolean-economy-target", definitionId: "t_market_rumor", growth: 0 },
        { instanceId: "mirror-target", definitionId: "t_goblin_mirror", growth: 0 },
        { instanceId: "reader-target", definitionId: "t_table_reader", growth: 0 },
        { instanceId: "dagger-target", definitionId: "t_devouring_dagger", growth: 0 },
      ],
    });
    const inheritance = forbidden("f_inheritance");

    expect(isForbiddenTargetEligible(state, inheritance, "stacking-target")).toBe(true);
    expect(isForbiddenTargetEligible(state, inheritance, "structural-target")).toBe(false);
    expect(isForbiddenTargetEligible(state, inheritance, "boolean-economy-target")).toBe(false);
    expect(isForbiddenTargetEligible(state, inheritance, "mirror-target")).toBe(false);
    expect(isForbiddenTargetEligible(state, inheritance, "reader-target")).toBe(false);
    expect(isForbiddenTargetEligible(state, inheritance, "dagger-target")).toBe(false);
  });
});
