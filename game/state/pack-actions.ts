import { rollCardEffectTagForCard } from "../content/card-effects";
import { PACK_BY_ID } from "../content/meta";
import { TALISMAN_BY_ID } from "../content/talismans";
import { BOOKS, BOOK_BY_ID } from "../content/upgrades";
import { createStandardHwatuDeck } from "../engine/deck";
import { randomAt } from "../engine/rng";
import type { CardInstance, GameState, PackDefinition } from "../types";
import { getShopCategoryPool } from "./shop-catalog";
import { prependGameLog } from "./logs";
import { countContractEffect, getEffectiveTalismanSlots } from "./selectors";

export interface OpenedPack {
  pendingPack: NonNullable<GameState["pendingPack"]>;
  cursor: number;
}

/**
 * Rolls the candidates a bought card pack puts on the table. Every candidate
 * may carry a random effect tag. Plain cards are deliberate: a pack full of
 * guaranteed powers removes the decision and inflates the deck too quickly.
 */
function openCardPack(state: GameState, pack: PackDefinition): OpenedPack {
  let cursor = state.rngCursor;
  if (pack.category === "burn") {
    const candidates = state.deck
      .filter((card) => !card.disabledForRound)
      .map((card) => ({ ...card, tags: [...card.tags] }));
    return {
      pendingPack: {
        packId: pack.id,
        name: pack.name,
        category: pack.category,
        picksLeft: Math.min(pack.picks, candidates.length),
        candidates,
      },
      cursor,
    };
  }

  const templates = createStandardHwatuDeck();
  const candidates: CardInstance[] = [];
  for (let index = 0; index < pack.choices; index += 1) {
    const templateIndex = Math.floor(randomAt(`${state.seed}:${state.runId}:pack-card:${state.stage}:${pack.id}`, cursor++) * templates.length);
    const template = templates[templateIndex];
    if (!template) continue;
    const effectRoll = randomAt(`${state.seed}:${state.runId}:pack-tag:${state.stage}:${pack.id}`, cursor++);
    const painterGuildLevel = countContractEffect(state, "modified_card_weight");
    const plainChance = painterGuildLevel >= 1 ? 0.1 : pack.id === "pack_hwatu_large" ? 0.2 : 0.3;
    const tag = effectRoll < plainChance
      ? undefined
      : rollCardEffectTagForCard((effectRoll - plainChance) / (1 - plainChance), template);
    const candidate: CardInstance = {
      ...template,
      tags: [...template.tags],
      instanceId: `pack:${state.runId}:${state.stage}:${pack.id}:${index}:${cursor}`,
      effectTagId: tag?.id,
    };
    if (painterGuildLevel >= 2) {
      const finishRoll = randomAt(`${state.seed}:${state.runId}:pack-finish:${state.stage}:${pack.id}`, cursor++);
      const editions = ["gold_leaf", "mother_of_pearl", "five_color"] as const;
      const seals = ["yellow", "red", "blue", "purple"] as const;
      if (finishRoll < 0.3) candidate.edition = editions[Math.floor((finishRoll / 0.3) * editions.length)];
      else if (finishRoll < 0.6) candidate.seal = seals[Math.floor(((finishRoll - 0.3) / 0.3) * seals.length)];
    }
    candidates.push(candidate);
  }
  return {
    pendingPack: {
      packId: pack.id,
      name: pack.name,
      category: pack.category,
      picksLeft: Math.min(pack.picks, candidates.length),
      candidates,
    },
    cursor,
  };
}

function openRewardPack(state: GameState, pack: PackDefinition): OpenedPack {
  let cursor = state.rngCursor;
  const pool = pack.category === "book"
    ? [...BOOKS]
    : [...getShopCategoryPool(state, "talisman")];
  const rewardCandidates: NonNullable<NonNullable<GameState["pendingPack"]>["rewardCandidates"]> = [];

  // 대서고 2단계는 이번 런에서 가장 많이 낸 족보의 비결서를 첫 칸에 보장한다.
  if (pack.category === "book" && countContractEffect(state, "book_weight") >= 2) {
    const favorite = BOOKS
      .map((book, index) => ({ book, index, count: state.stats.yakusPlayed[book.yakuId] ?? 0 }))
      .filter((entry) => entry.count > 0)
      .sort((a, b) => b.count - a.count || a.index - b.index)[0]?.book;
    if (favorite) {
      const poolIndex = pool.findIndex((entry) => entry.id === favorite.id);
      if (poolIndex >= 0) pool.splice(poolIndex, 1);
      rewardCandidates.push({
        candidateId: `${pack.id}:${state.stage}:favorite:${cursor}`,
        definitionId: favorite.id,
        category: "book",
      });
    }
  }

  for (let index = rewardCandidates.length; index < pack.choices && pool.length > 0; index += 1) {
    const at = Math.floor(randomAt(`${state.seed}:${state.runId}:pack-reward:${state.stage}:${pack.id}`, cursor++) * pool.length);
    const [definition] = pool.splice(at, 1);
    rewardCandidates.push({
      candidateId: `${pack.id}:${state.stage}:${index}:${cursor}`,
      definitionId: definition.id,
      category: pack.category as "book" | "talisman",
    });
  }
  return {
    pendingPack: {
      packId: pack.id,
      name: pack.name,
      category: pack.category,
      picksLeft: Math.min(pack.picks, rewardCandidates.length),
      candidates: [],
      rewardCandidates,
    },
    cursor,
  };
}

export function openPurchasedPack(state: GameState, definitionId: string): OpenedPack | null {
  const pack = PACK_BY_ID[definitionId];
  if (!pack) return null;
  return pack.category === "book" || pack.category === "talisman"
    ? openRewardPack(state, pack)
    : openCardPack(state, pack);
}

export function confirmPackSelection(state: GameState, candidateIds: readonly string[]): GameState {
  const pack = state.pendingPack;
  if (!pack || pack.picksLeft <= 0) return state;
  const selectedIds = [...new Set(candidateIds)];
  const selectedCards = pack.candidates.filter((card) => selectedIds.includes(card.instanceId));
  const selectedRewards = (pack.rewardCandidates ?? []).filter((candidate) => selectedIds.includes(candidate.candidateId));
  const selectedCount = selectedCards.length + selectedRewards.length;
  if (selectedCount === 0 || selectedCount !== selectedIds.length || selectedCount > pack.picksLeft) return state;
  if (pack.category === "burn" && selectedCount !== pack.picksLeft) return state;

  const selectedTalismanRewards = selectedRewards.filter((candidate) => candidate.category === "talisman");
  if (state.talismans.length + selectedTalismanRewards.length > getEffectiveTalismanSlots(state)) return state;

  const selectedCardIds = new Set(selectedCards.map((card) => card.instanceId));
  const burn = pack.category === "burn";
  let yakuLevels = { ...state.yakuLevels };
  const talismans = [...state.talismans];
  let lastConsumableId = state.lastConsumableId;
  const rewardNames: string[] = [];

  for (const candidate of selectedRewards) {
    if (candidate.category === "book") {
      const book = BOOK_BY_ID[candidate.definitionId];
      if (!book) return state;
      const current = yakuLevels[book.yakuId] ?? { level: 1, mastery: 0 };
      yakuLevels = { ...yakuLevels, [book.yakuId]: { ...current, level: current.level + 1 } };
      lastConsumableId = book.id;
      rewardNames.push(book.name);
    } else {
      const definition = TALISMAN_BY_ID[candidate.definitionId];
      if (!definition) return state;
      talismans.push({ instanceId: `${candidate.candidateId}:owned`, definitionId: definition.id, growth: 0 });
      rewardNames.push(definition.name);
    }
  }

  const cardNames = selectedCards.map((card) => `${card.month}월 ${card.name}`);
  const names = [...cardNames, ...rewardNames];
  return {
    ...state,
    deck: burn
      ? state.deck.filter((card) => !selectedCardIds.has(card.instanceId))
      : [...state.deck, ...selectedCards],
    yakuLevels,
    talismans,
    lastConsumableId,
    pendingPack: null,
    logs: prependGameLog(
      state,
      "reward",
      burn ? `${selectedCount}장 소각 확정` : `${selectedCount}개 획득 확정`,
      names.join(" · "),
    ),
  };
}

export function closePendingPack(state: GameState): GameState {
  return state.pendingPack ? { ...state, pendingPack: null } : state;
}
