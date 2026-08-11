import { START_DECK_BY_ID } from "../content/meta";
import { TALISMAN_BY_ID } from "../content/talismans";
import type { GameState, YakuId } from "../types";

export interface RunIdentityTag {
  id: string;
  label: string;
  detail: string;
  strength: number;
}

const BRIGHT_YAKUS: readonly YakuId[] = ["rain_three_brights", "three_brights", "four_brights", "five_brights", "six_brights"];
const BIRD_YAKUS: readonly YakuId[] = ["godori", "four_godori", "five_godori"];
const RIBBON_YAKUS: readonly YakuId[] = ["hongdan", "chodan", "cheongdan"];

function bonusLevels(state: GameState, ids: readonly YakuId[]): number {
  return ids.reduce((sum, id) => sum + Math.max(0, (state.yakuLevels[id]?.level ?? 1) - 1), 0);
}

/** A compact, descriptive summary only. It never changes scoring or odds. */
export function getRunIdentityTags(state: GameState, limit = 3): RunIdentityTag[] {
  const talismanEffects = state.talismans.flatMap((instance) => {
    const definition = TALISMAN_BY_ID[instance.definitionId];
    return definition ? [definition.effectKey] : [];
  });
  const modifiedCards = state.deck.filter((card) => (
    card.effectTagId || card.enhancement || card.edition || card.seal || card.permanentKkeutBonus !== 0
  )).length;
  const strongestImmediateLevel = Math.max(
    1,
    ...Object.entries(state.yakuLevels)
      .filter(([id]) => !BRIGHT_YAKUS.includes(id as YakuId) && !BIRD_YAKUS.includes(id as YakuId) && !RIBBON_YAKUS.includes(id as YakuId))
      .map(([, level]) => level.level),
  );

  const candidates: RunIdentityTag[] = [
    {
      id: "long-jit",
      label: "긴 짓",
      detail: "월 합을 크게 불리는 부적 중심",
      strength: talismanEffects.filter((effect) => effect.includes("add_kkeut") || effect.includes("month")).length * 3,
    },
    {
      id: "multiplier",
      label: "배수 연쇄",
      detail: `끗패 비결 최고 Lv.${strongestImmediateLevel}`,
      strength: (strongestImmediateLevel - 1) * 2
        + talismanEffects.filter((effect) => effect.includes("heung") || effect.includes("multiplier") || effect.includes("retrigger")).length,
    },
    {
      id: "bright",
      label: "광 수집",
      detail: "광 수집 비결과 광 연계",
      strength: bonusLevels(state, BRIGHT_YAKUS) * 3
        + talismanEffects.filter((effect) => effect.includes("bright")).length * 2,
    },
    {
      id: "bird",
      label: "새 수집",
      detail: "고도리와 새 그림패 연계",
      strength: bonusLevels(state, BIRD_YAKUS) * 3
        + talismanEffects.filter((effect) => effect.includes("bird")).length * 2,
    },
    {
      id: "ribbon",
      label: "띠 수집",
      detail: "홍단·초단·청단 성장",
      strength: bonusLevels(state, RIBBON_YAKUS) * 3
        + talismanEffects.filter((effect) => effect.includes("ribbon")).length * 2,
    },
    {
      id: "economy",
      label: "경제",
      detail: "냥과 장터 효율 중심",
      strength: talismanEffects.filter((effect) => effect.includes("money") || effect.includes("market")).length * 2
        + state.contracts.length,
    },
    {
      id: "modified",
      label: "강화패",
      detail: `효과·재질·낙관이 붙은 패 ${modifiedCards}장`,
      strength: Math.min(8, modifiedCards),
    },
  ].filter((tag) => tag.strength > 0);

  const selected = candidates
    .sort((left, right) => right.strength - left.strength || left.id.localeCompare(right.id))
    .slice(0, limit);
  if (selected.length > 0) return selected;

  const startDeck = state.startDeckId ? START_DECK_BY_ID[state.startDeckId] : undefined;
  return [{
    id: "balanced",
    label: startDeck?.name ?? "기본 균형",
    detail: startDeck?.description ?? "아직 뚜렷한 강화 방향이 없습니다.",
    strength: 0,
  }];
}
