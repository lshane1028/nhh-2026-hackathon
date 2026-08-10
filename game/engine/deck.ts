import { STANDARD_CARD_TEMPLATES } from "../content/cards";
import type { CardInstance, CardKind, Month, Season } from "../types";
import { createRngState, shuffleDeterministic, type RngState } from "./rng";

export interface ValidationIssue {
  code: string;
  message: string;
  expected?: number | string;
  actual?: number | string;
}

export interface EffectiveCardRole {
  kind: CardKind;
  chaffValue: 0 | 1 | 2;
  baseKkeut: number;
}

export type CupRole = "animal" | "double_chaff";

/**
 * The September cup no longer has a single round-wide role. Each cup card is
 * filed onto the collection board individually, so callers may pass either one
 * role for a whole evaluation pass or a per-instance assignment map.
 */
export type CupRoleSource = CupRole | Readonly<Record<string, CupRole>>;

export const DEFAULT_CUP_ROLE: CupRole = "animal";

export function resolveCupRole(
  source: CupRoleSource | undefined,
  card: Pick<CardInstance, "instanceId">,
): CupRole {
  if (source === undefined) return DEFAULT_CUP_ROLE;
  if (typeof source === "string") return source;
  return source[card.instanceId] ?? DEFAULT_CUP_ROLE;
}

export function isCupCard(card: Pick<CardInstance, "tags">): boolean {
  return card.tags.includes("cup");
}

export function getMonthName(month: Month): string {
  return ["", "송학", "매조", "벚꽃", "흑싸리", "난초", "모란", "홍싸리", "공산명월", "국화", "단풍", "오동", "비"][month];
}

export function getSeason(month: Month): Season {
  if (month <= 3) return "spring";
  if (month <= 6) return "summer";
  if (month <= 9) return "autumn";
  return "winter";
}

/**
 * Legacy name kept for callers that still render the old `baseKkeut` field.
 * Card kind and chaff value no longer affect the front half of the score: every
 * normal card contributes its printed month.
 */
export function getKindBaseKkeut(
  _kind: CardKind,
  _chaffValue: 0 | 1 | 2,
  month: Month,
): number {
  return month;
}

export function getEffectiveCardRole(card: CardInstance, cupRole: CupRole = "animal"): EffectiveCardRole {
  const baseKkeut = card.tags.includes("zero_base") ? 0 : card.month;
  if (card.tags.includes("cup")) {
    return cupRole === "double_chaff"
      ? { kind: "chaff", chaffValue: 2, baseKkeut }
      : { kind: "animal", chaffValue: 0, baseKkeut };
  }
  return {
    kind: card.kind,
    chaffValue: card.kind === "chaff" ? card.chaffValue : 0,
    baseKkeut,
  };
}

const ALL_CARD_KINDS: readonly CardKind[] = ["bright", "animal", "ribbon", "chaff"];

const ADDED_KIND_BY_EFFECT = {
  as_bright: "bright",
  as_animal: "animal",
  as_ribbon: "ribbon",
} as const satisfies Partial<Record<string, CardKind>>;

/**
 * Every kind the card counts as while scoring and filing collections.
 * `getEffectiveCardRole` remains the primary printed/cup role; 취급 effects add
 * a role instead of replacing it. 돌패 deliberately has no kind, while 만능패
 * keeps the existing all-kind behaviour.
 */
export function getEffectiveCardKinds(card: CardInstance, cupRole: CupRole = "animal"): readonly CardKind[] {
  if (card.enhancement === "stone") return [];
  if (card.enhancement === "wild" || card.tags.includes("all_kind_wild")) return ALL_CARD_KINDS;

  const kinds = new Set<CardKind>([getEffectiveCardRole(card, cupRole).kind]);
  if (card.tags.includes("counts_as_bright")) kinds.add("bright");
  const addedKind = card.effectTagId
    ? ADDED_KIND_BY_EFFECT[card.effectTagId as keyof typeof ADDED_KIND_BY_EFFECT]
    : undefined;
  if (addedKind) kinds.add(addedKind);
  // 덧피 gives even a non-피 card one 피 point, so it must be fileable on the
  // 피 track as well as on its printed track.
  if (card.effectTagId === "extra_pi") kinds.add("chaff");
  return [...kinds];
}

export function hasEffectiveCardKind(
  card: CardInstance,
  kind: CardKind,
  cupRole: CupRole = "animal",
): boolean {
  return getEffectiveCardKinds(card, cupRole).includes(kind);
}

/** 피 points after the card's filed cup role and 덧피 are applied. */
export function getEffectiveChaffValue(card: CardInstance, cupRole: CupRole = "animal"): number {
  if (card.enhancement === "stone") return 0;
  const role = getEffectiveCardRole(card, cupRole);
  const printedValue = role.kind === "chaff" ? role.chaffValue : 0;
  return printedValue + Number(card.effectTagId === "extra_pi");
}

/**
 * Number of copies the card represents on one collection track. 쌍패 doubles
 * only its primary printed/cup role; kinds added by 취급 still count once.
 */
export function getEffectiveKindMultiplicity(
  card: CardInstance,
  kind: CardKind,
  cupRole: CupRole = "animal",
): number {
  if (!hasEffectiveCardKind(card, kind, cupRole)) return 0;
  const primaryKind = getEffectiveCardRole(card, cupRole).kind;
  return card.effectTagId === "twin_kind" && primaryKind === kind ? 2 : 1;
}

/** Numeric contribution to the ordinary Go-Stop collection counter. */
export function getCollectionKindValue(
  card: CardInstance,
  kind: CardKind,
  cupRole: CupRole = "animal",
): number {
  const multiplicity = getEffectiveKindMultiplicity(card, kind, cupRole);
  if (multiplicity === 0) return 0;
  if (kind === "chaff") return getEffectiveChaffValue(card, cupRole) * multiplicity;
  return multiplicity;
}

export function createStandardHwatuDeck(): CardInstance[] {
  return STANDARD_CARD_TEMPLATES.map((template) => ({
    ...template,
    instanceId: `standard:${template.originId}`,
    tags: [...template.tags],
    permanentKkeutBonus: 0,
  }));
}

function countBy<T>(items: readonly T[], predicate: (item: T) => boolean): number {
  return items.reduce((count, item) => count + Number(predicate(item)), 0);
}

function expectCount(
  issues: ValidationIssue[],
  code: string,
  label: string,
  actual: number,
  expected: number,
): void {
  if (actual !== expected) issues.push({ code, message: `${label}: expected ${expected}, got ${actual}`, expected, actual });
}

export function validateStandardDeck(deck: readonly CardInstance[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  expectCount(issues, "deck.total", "total cards", deck.length, 48);

  for (let month = 1; month <= 12; month += 1) {
    expectCount(
      issues,
      `deck.month.${month}`,
      `${month}월 cards`,
      countBy(deck, (card) => card.month === month),
      4,
    );
  }

  expectCount(issues, "deck.bright", "bright cards", countBy(deck, (card) => card.kind === "bright"), 5);
  expectCount(issues, "deck.animal", "animal cards", countBy(deck, (card) => card.kind === "animal"), 9);
  expectCount(issues, "deck.ribbon", "ribbon cards", countBy(deck, (card) => card.kind === "ribbon"), 10);
  expectCount(issues, "deck.chaff", "physical chaff cards", countBy(deck, (card) => card.kind === "chaff"), 24);
  expectCount(issues, "deck.double_chaff", "double chaff cards", countBy(deck, (card) => card.kind === "chaff" && card.chaffValue === 2), 2);
  expectCount(issues, "deck.hong", "hong ribbons", countBy(deck, (card) => card.ribbonGroup === "hong"), 3);
  expectCount(issues, "deck.cho", "cho ribbons", countBy(deck, (card) => card.ribbonGroup === "cho"), 3);
  expectCount(issues, "deck.cheong", "cheong ribbons", countBy(deck, (card) => card.ribbonGroup === "cheong"), 3);
  expectCount(issues, "deck.rain_ribbon", "rain ribbons", countBy(deck, (card) => card.ribbonGroup === "rain"), 1);

  const godoriMonths = new Set(
    deck
      .filter((card) => card.kind === "animal" && card.tags.includes("bird") && [2, 4, 8].includes(card.month))
      .map((card) => card.month),
  );
  if (godoriMonths.size !== 3 || ![2, 4, 8].every((month) => godoriMonths.has(month as Month))) {
    issues.push({ code: "deck.godori", message: "Godori birds must identify months 2, 4, and 8 exactly" });
  }

  const ids = new Set<string>();
  for (const card of deck) {
    if (ids.has(card.instanceId)) issues.push({ code: "deck.instance_id", message: `duplicate instanceId: ${card.instanceId}` });
    ids.add(card.instanceId);
    if (!card.assetTag) issues.push({ code: "deck.asset_tag", message: `missing assetTag: ${card.instanceId}` });
    if (card.kind !== "chaff" && card.chaffValue !== 0) {
      issues.push({ code: "deck.chaff_value", message: `non-chaff card has chaffValue: ${card.instanceId}` });
    }
    if (card.kind === "chaff" && card.chaffValue === 0) {
      issues.push({ code: "deck.chaff_value", message: `chaff card has zero chaffValue: ${card.instanceId}` });
    }
  }
  return issues;
}

export function shuffleWithSeed<T>(deck: readonly T[], seed: string, cursor = 0): T[] {
  return shuffleDeterministic(deck, createRngState(seed, cursor)).value;
}

export function shuffleWithRngState<T>(deck: readonly T[], state: RngState): { deck: T[]; state: RngState } {
  const result = shuffleDeterministic(deck, state);
  return { deck: result.value, state: result.state };
}

export function drawCards<T>(pile: readonly T[], count: number): { drawn: T[]; remaining: T[] } {
  if (!Number.isSafeInteger(count) || count < 0) throw new RangeError("draw count must be a non-negative integer");
  return { drawn: pile.slice(0, count), remaining: pile.slice(count) };
}
