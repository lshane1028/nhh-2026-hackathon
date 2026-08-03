import { ALL_IMMEDIATE_YAKU_DEFINITIONS, COLLECTION_YAKU_DEFINITIONS, getImmediateYakuDefinition } from "../content/yaku";
import type {
  CardInstance,
  CollectionProgress,
  CollectionYakuId,
  ImmediateYakuId,
  Month,
  YakuCandidate,
} from "../types";
import { getEffectiveCardRole, getSeason, type CupRole } from "./deck";

export interface YakuMatchContext {
  cupRole?: CupRole;
  connectYear?: boolean;
  includeSecretYaku?: boolean;
}

export interface CollectionEvaluationInput {
  confirmedCards?: readonly CardInstance[];
  pendingCards?: readonly CardInstance[];
  submittedCards?: readonly CardInstance[];
  confirmedCompletedYakuIds?: readonly CollectionYakuId[];
  pendingCompletedYakuIds?: readonly CollectionYakuId[];
  cupRole?: CupRole;
}

function combinations<T>(items: readonly T[], size: number): T[][] {
  const results: T[][] = [];
  const selected: T[] = [];
  const visit = (start: number): void => {
    if (selected.length === size) {
      results.push([...selected]);
      return;
    }
    for (let index = start; index <= items.length - (size - selected.length); index += 1) {
      selected.push(items[index]);
      visit(index + 1);
      selected.pop();
    }
  };
  if (size >= 0 && size <= items.length) visit(0);
  return results;
}

function uniqueCards(cards: readonly CardInstance[]): CardInstance[] {
  const seen = new Set<string>();
  return cards.filter((card) => {
    if (seen.has(card.instanceId)) return false;
    seen.add(card.instanceId);
    return true;
  });
}

function orderedIds(cards: readonly CardInstance[], submitted: readonly CardInstance[]): string[] {
  const indices = new Map(submitted.map((card, index) => [card.instanceId, index]));
  return [...cards]
    .sort((left, right) => (indices.get(left.instanceId) ?? 0) - (indices.get(right.instanceId) ?? 0))
    .map((card) => card.instanceId);
}

function hasKind(card: CardInstance, kind: "bright" | "animal" | "ribbon" | "chaff", cupRole: CupRole): boolean {
  if (card.enhancement === "stone") return false;
  if (card.enhancement === "wild" || card.tags.includes("all_kind_wild")) return true;
  if (kind === "bright" && card.tags.includes("counts_as_bright")) return true;
  return getEffectiveCardRole(card, cupRole).kind === kind;
}

function monthGroups(cards: readonly CardInstance[]): Map<Month, CardInstance[]> {
  const groups = new Map<Month, CardInstance[]>();
  for (const card of cards) {
    if (card.enhancement === "stone") continue;
    const group = groups.get(card.month) ?? [];
    group.push(card);
    groups.set(card.month, group);
  }
  return groups;
}

function candidate(id: ImmediateYakuId, cards: readonly CardInstance[], submitted: readonly CardInstance[]): YakuCandidate {
  return { yakuId: id, scoringCardIds: orderedIds(cards, submitted), label: getImmediateYakuDefinition(id).name };
}

function runMonthSequences(length: number, connectYear: boolean): Month[][] {
  const sequences: Month[][] = [];
  const lastStart = connectYear ? 12 : 13 - length;
  for (let start = 1; start <= lastStart; start += 1) {
    const months: Month[] = [];
    for (let offset = 0; offset < length; offset += 1) {
      months.push((((start - 1 + offset) % 12) + 1) as Month);
    }
    sequences.push(months);
  }
  return sequences;
}

function cartesian<T>(groups: readonly (readonly T[])[]): T[][] {
  return groups.reduce<T[][]>(
    (products, group) => products.flatMap((product) => group.map((item) => [...product, item])),
    [[]],
  );
}

function dedupeCandidates(candidates: readonly YakuCandidate[]): YakuCandidate[] {
  const seen = new Set<string>();
  return candidates.filter((entry) => {
    const key = `${entry.yakuId}:${[...entry.scoringCardIds].sort().join("|")}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function findImmediateYakuCandidates(
  submittedCards: readonly CardInstance[],
  context: YakuMatchContext = {},
): YakuCandidate[] {
  const submitted = uniqueCards(submittedCards).filter((card) => !card.disabledForRound).slice(0, 5);
  if (submitted.length === 0) return [];
  const cupRole = context.cupRole ?? "animal";
  const groups = monthGroups(submitted);
  const candidates: YakuCandidate[] = [];

  for (const cards of groups.values()) {
    for (const pair of combinations(cards, 2)) candidates.push(candidate("month_pair", pair, submitted));
    for (const triple of combinations(cards, 3)) candidates.push(candidate("triple_month", triple, submitted));
    for (const four of combinations(cards, 4)) candidates.push(candidate("four_of_month", four, submitted));
  }

  const pairGroups = [...groups.entries()].filter(([, cards]) => cards.length >= 2);
  for (const [leftIndex, [leftMonth, leftCards]] of pairGroups.entries()) {
    for (const [rightMonth, rightCards] of pairGroups.slice(leftIndex + 1)) {
      if (leftMonth === rightMonth) continue;
      for (const leftPair of combinations(leftCards, 2)) {
        for (const rightPair of combinations(rightCards, 2)) {
          candidates.push(candidate("two_pairs", [...leftPair, ...rightPair], submitted));
        }
      }
    }
  }

  for (const [length, id] of [
    [3, "three_run"],
    [4, "four_run"],
    [5, "five_run"],
  ] as const) {
    for (const months of runMonthSequences(length, context.connectYear ?? false)) {
      const monthCards = months.map((month) => groups.get(month) ?? []);
      if (monthCards.every((cards) => cards.length > 0)) {
        for (const cards of cartesian(monthCards)) candidates.push(candidate(id, cards, submitted));
      }
    }
  }

  const chaffCards = submitted.filter((card) => hasKind(card, "chaff", cupRole));
  if (chaffCards.reduce((sum, card) => sum + getEffectiveCardRole(card, cupRole).chaffValue, 0) >= 5) {
    candidates.push(candidate("chaff_field", chaffCards, submitted));
  }

  const ribbonCards = submitted.filter((card) => hasKind(card, "ribbon", cupRole));
  for (const cards of combinations(ribbonCards, 4)) candidates.push(candidate("four_ribbons", cards, submitted));
  const animalCards = submitted.filter((card) => hasKind(card, "animal", cupRole));
  for (const cards of combinations(animalCards, 4)) candidates.push(candidate("four_animals", cards, submitted));

  const seasonGroups = new Map<string, CardInstance[]>();
  for (const card of submitted.filter((entry) => entry.enhancement !== "stone")) {
    const season = getSeason(card.month);
    seasonGroups.set(season, [...(seasonGroups.get(season) ?? []), card]);
  }
  for (const cards of seasonGroups.values()) {
    for (const hand of combinations(cards, 5)) candidates.push(candidate("same_season", hand, submitted));
  }

  for (const [tripleMonth, tripleCards] of groups.entries()) {
    if (tripleCards.length < 3) continue;
    for (const [pairMonth, pairCards] of groups.entries()) {
      if (tripleMonth === pairMonth || pairCards.length < 2) continue;
      for (const triple of combinations(tripleCards, 3)) {
        for (const pair of combinations(pairCards, 2)) {
          candidates.push(candidate("house_party", [...triple, ...pair], submitted));
        }
      }
    }
  }

  if (context.includeSecretYaku !== false && submitted.length === 5) {
    for (const cards of groups.values()) {
      if (cards.length === 5) candidates.push(candidate("five_of_month", cards, submitted));
    }
    if (submitted.every((card) => card.tags.includes("bird"))) {
      const months = new Set(submitted.map((card) => card.month));
      if ([2, 4, 8].every((month) => months.has(month as Month))) {
        candidates.push(candidate("double_godori", submitted, submitted));
      }
    }
    if (submitted.every((card) => card.month === 1) && submitted.filter((card) => hasKind(card, "bright", cupRole)).length >= 2) {
      candidates.push(candidate("ten_thousand_pines", submitted, submitted));
    }
    if (submitted.every((card) => card.tags.includes("rain")) && submitted.filter((card) => hasKind(card, "bright", cupRole)).length >= 3) {
      candidates.push(candidate("rain_bright_world", submitted, submitted));
    }
  }

  const distinct = dedupeCandidates(candidates);
  if (distinct.length > 0) return distinct;

  const bestKkeut = Math.max(...submitted.map((card) => getEffectiveCardRole(card, cupRole).baseKkeut + card.permanentKkeutBonus));
  return submitted
    .filter((card) => getEffectiveCardRole(card, cupRole).baseKkeut + card.permanentKkeutBonus === bestKkeut)
    .map((card) => candidate("single", [card], submitted));
}

export function getScoringCards(candidateEntry: YakuCandidate, submitted: readonly CardInstance[]): CardInstance[] {
  const ids = new Set(candidateEntry.scoringCardIds);
  return submitted.filter((card) => ids.has(card.instanceId));
}

function requiredMonthProgress(
  id: CollectionYakuId,
  cards: readonly CardInstance[],
  months: readonly Month[],
  predicate: (card: CardInstance) => boolean,
): CollectionProgress {
  const matched = months.flatMap((month) => {
    const card = cards.find((entry) => entry.month === month && predicate(entry));
    return card ? [card.instanceId] : [];
  });
  return { yakuId: id, matchedCardIds: matched, required: months.length, completed: matched.length === months.length };
}

export function getCollectionProgress(input: CollectionEvaluationInput): CollectionProgress[] {
  const cupRole = input.cupRole ?? "animal";
  const cards = uniqueCards([...(input.confirmedCards ?? []), ...(input.pendingCards ?? []), ...(input.submittedCards ?? [])])
    .filter((card) => !card.disabledForRound);

  const progress: CollectionProgress[] = [
    requiredMonthProgress("hongdan", cards, [1, 2, 3], (card) => hasKind(card, "ribbon", cupRole) && card.ribbonGroup === "hong"),
    requiredMonthProgress("chodan", cards, [4, 5, 7], (card) => hasKind(card, "ribbon", cupRole) && card.ribbonGroup === "cho"),
    requiredMonthProgress("cheongdan", cards, [6, 9, 10], (card) => hasKind(card, "ribbon", cupRole) && card.ribbonGroup === "cheong"),
    requiredMonthProgress("godori", cards, [2, 4, 8], (card) => hasKind(card, "animal", cupRole) && card.tags.includes("bird")),
  ];

  const brights = cards.filter((card) => hasKind(card, "bright", cupRole));
  const rainBrights = brights.filter((card) => card.tags.includes("rain"));
  const dryBrights = brights.filter((card) => !card.tags.includes("rain"));
  const rainMatched = rainBrights.length > 0 ? [rainBrights[0], ...brights.filter((card) => card !== rainBrights[0]).slice(0, 2)] : [];
  progress.push(
    { yakuId: "rain_three_brights", matchedCardIds: rainMatched.map((card) => card.instanceId), required: 3, completed: rainMatched.length >= 3 },
    { yakuId: "three_brights", matchedCardIds: dryBrights.slice(0, 3).map((card) => card.instanceId), required: 3, completed: dryBrights.length >= 3 },
    { yakuId: "four_brights", matchedCardIds: brights.slice(0, 4).map((card) => card.instanceId), required: 4, completed: brights.length >= 4 },
    { yakuId: "five_brights", matchedCardIds: brights.slice(0, 5).map((card) => card.instanceId), required: 5, completed: brights.length >= 5 },
  );
  return COLLECTION_YAKU_DEFINITIONS.map((definition) => progress.find((entry) => entry.yakuId === definition.id) as CollectionProgress);
}

export function detectNewCollectionCompletions(input: CollectionEvaluationInput): CollectionYakuId[] {
  const before = getCollectionProgress({
    ...input,
    submittedCards: [],
  });
  const after = getCollectionProgress(input);
  const completedIds = new Set<CollectionYakuId>([
    ...(input.confirmedCompletedYakuIds ?? []),
    ...(input.pendingCompletedYakuIds ?? []),
  ]);
  let newlyCompleted = after
    .filter((entry) => entry.completed && !before.find((old) => old.yakuId === entry.yakuId)?.completed && !completedIds.has(entry.yakuId))
    .map((entry) => entry.yakuId);

  const brightRanks: Partial<Record<CollectionYakuId, number>> = {
    rain_three_brights: 3,
    three_brights: 3,
    four_brights: 4,
    five_brights: 5,
  };
  const highestBrightRank = Math.max(0, ...newlyCompleted.map((id) => brightRanks[id] ?? 0));
  if (highestBrightRank > 0) {
    newlyCompleted = newlyCompleted.filter((id) => !(id in brightRanks) || brightRanks[id] === highestBrightRank);
  }
  const order = new Map(COLLECTION_YAKU_DEFINITIONS.map((definition, index) => [definition.id, index]));
  return newlyCompleted.sort((left, right) => (order.get(left) ?? 0) - (order.get(right) ?? 0));
}

export function validateYakuDefinitions(): string[] {
  const issues: string[] = [];
  const expectedImmediate = 17;
  if (ALL_IMMEDIATE_YAKU_DEFINITIONS.length !== expectedImmediate) {
    issues.push(`expected ${expectedImmediate} immediate/secret definitions, got ${ALL_IMMEDIATE_YAKU_DEFINITIONS.length}`);
  }
  if (COLLECTION_YAKU_DEFINITIONS.length !== 8) issues.push(`expected 8 collection definitions, got ${COLLECTION_YAKU_DEFINITIONS.length}`);
  for (const definition of [...ALL_IMMEDIATE_YAKU_DEFINITIONS, ...COLLECTION_YAKU_DEFINITIONS]) {
    if (!definition.assetTag) issues.push(`missing assetTag: ${definition.id}`);
  }
  return issues;
}
