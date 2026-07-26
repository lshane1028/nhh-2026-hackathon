import { shuffle, TACTIC_BY_ID } from './data';
import type { Tactic } from './types';

export type SeasonId = '봄' | '여름' | '가을' | '겨울';

export interface Encounter {
  id: string;
  season: SeasonId;
  name: string;
  ruleName: string;
  description: string;
  rule: 'bloom' | 'red_tax' | 'rain_wild' | 'thin_energy' | 'harvest' | 'high_stakes' | 'eclipse';
  targetBonus: number;
  opponentBonus: number;
  rewardLevel: 1 | 2;
}

export interface RelicDefinition {
  id: string;
  name: string;
  description: string;
  build: string;
}

export interface RewardOption {
  id: string;
  type: 'tactic' | 'relic' | 'heal';
  name: string;
  description: string;
  detail: string;
}

export interface PersistentRunState {
  stage: number;
  hp: number;
  maxHp: number;
  fame: number;
  tacticDeck: string[];
  relics: string[];
  currentEncounter: Encounter | null;
  clearedEncounters: string[];
  shieldSpent: boolean;
}

const SEASONS: SeasonId[] = ['봄', '여름', '가을', '겨울'];

const ENCOUNTERS: Encounter[][] = [
  [
    {
      id: 'spring-garden',
      season: '봄',
      name: '매화 뜰의 첫판',
      ruleName: '첫 꽃',
      description: '처음 갈무리할 때 15점을 더 얻는다.',
      rule: 'bloom',
      targetBonus: 0,
      opponentBonus: 0,
      rewardLevel: 1,
    },
    {
      id: 'spring-ribbon',
      season: '봄',
      name: '붉은 띠 큰판',
      ruleName: '띠세',
      description: '내가 붉은 띠를 먹을수록 목표가 오르지만 보상이 좋다.',
      rule: 'red_tax',
      targetBonus: 5,
      opponentBonus: 10,
      rewardLevel: 2,
    },
  ],
  [
    {
      id: 'summer-rain',
      season: '여름',
      name: '장마 도깨비판',
      ruleName: '비바람',
      description: '12월 패는 모든 달과 맞는다. 누구에게나 적용된다.',
      rule: 'rain_wild',
      targetBonus: 15,
      opponentBonus: 10,
      rewardLevel: 2,
    },
    {
      id: 'summer-dry',
      season: '여름',
      name: '마른 우물의 판',
      ruleName: '기근',
      description: '기력 2로 시작한다. 판술을 아껴 써야 한다.',
      rule: 'thin_energy',
      targetBonus: 5,
      opponentBonus: 5,
      rewardLevel: 1,
    },
  ],
  [
    {
      id: 'autumn-harvest',
      season: '가을',
      name: '풍년 큰판',
      ruleName: '수확',
      description: '먹은 띠와 열끗 한 장마다 추가 점수를 얻는다.',
      rule: 'harvest',
      targetBonus: 20,
      opponentBonus: 15,
      rewardLevel: 2,
    },
    {
      id: 'autumn-stakes',
      season: '가을',
      name: '노을의 판돈',
      ruleName: '강자 셋',
      description: '판주 점수에 보정이 붙는다. 선두를 빼앗기 쉽다.',
      rule: 'high_stakes',
      targetBonus: 10,
      opponentBonus: 30,
      rewardLevel: 2,
    },
  ],
  [
    {
      id: 'winter-eclipse',
      season: '겨울',
      name: '열두 달의 최종판',
      ruleName: '월식',
      description: '판주 점수가 크게 오르고 목표가 높다. 완성한 빌드를 시험한다.',
      rule: 'eclipse',
      targetBonus: 35,
      opponentBonus: 35,
      rewardLevel: 2,
    },
  ],
];

export const RELICS: RelicDefinition[] = [
  { id: 'rain-charm', name: '비광 부적', description: '먹은 광 한 장마다 20점.', build: '광 폭발' },
  { id: 'ribbon-knot', name: '청홍 매듭', description: '먹은 띠 한 장마다 9점.', build: '띠 연쇄' },
  { id: 'bird-bell', name: '고도리 방울', description: '먹은 열끗 한 장마다 12점.', build: '동물 수집' },
  { id: 'goblin-mirror', name: '도깨비 거울', description: '매 판 첫 판술의 기력을 돌려받는다.', build: '판술 순환' },
  { id: 'broken-coin', name: '끊어진 엽전', description: '패배 시 체력 손실을 한 번 막고 부서진다.', build: '생존' },
  { id: 'moon-mortar', name: '달토끼 절구', description: '모든 판의 목표 점수 -15.', build: '안정' },
  { id: 'last-cup', name: '마지막 술잔', description: '체력이 1이면 최종 점수 ×1.35.', build: '위기 배수' },
  { id: 'empty-table', name: '빈 술상', description: '손패가 2장 이하일 때 얻는 점수 +35.', build: '후반 폭발' },
];

function createInitialState(): PersistentRunState {
  return {
    stage: 0,
    hp: 3,
    maxHp: 3,
    fame: 0,
    tacticDeck: ['peek', 'moonstep', 'storm', 'swap', 'blossom'],
    relics: [],
    currentEncounter: null,
    clearedEncounters: [],
    shieldSpent: false,
  };
}

export const runStore: PersistentRunState = createInitialState();

export function startNewRun(): void {
  Object.assign(runStore, createInitialState());
}

export function currentSeason(): SeasonId {
  return SEASONS[Math.min(runStore.stage, SEASONS.length - 1)];
}

export function encounterChoices(): Encounter[] {
  return ENCOUNTERS[Math.min(runStore.stage, ENCOUNTERS.length - 1)];
}

export function selectEncounter(encounter: Encounter): void {
  runStore.currentEncounter = encounter;
}

export function drawTactics(count = 3): Tactic[] {
  const ids = shuffle(runStore.tacticDeck).slice(0, count);
  return ids
    .map((id) => TACTIC_BY_ID.get(id))
    .filter((tactic): tactic is Tactic => tactic !== undefined);
}

export function makeRewardChoices(): RewardOption[] {
  const availableRelics = shuffle(RELICS.filter((relic) => !runStore.relics.includes(relic.id)));
  const tacticPool = shuffle([...TACTIC_BY_ID.values()]);
  const choices: RewardOption[] = [];

  const tactic = tacticPool[0];
  if (tactic) {
    const ownedCopies = runStore.tacticDeck.filter((id) => id === tactic.id).length;
    choices.push({
      id: tactic.id,
      type: 'tactic',
      name: tactic.name,
      description: tactic.description,
      detail: ownedCopies > 0 ? `사본 추가 · 현재 ${ownedCopies}장` : '새 판술',
    });
  }

  const relic = availableRelics[0];
  if (relic) {
    choices.push({
      id: relic.id,
      type: 'relic',
      name: relic.name,
      description: relic.description,
      detail: relic.build,
    });
  }

  const secondTactic = tacticPool.find((item) => item.id !== tactic?.id);
  if (runStore.hp < runStore.maxHp) {
    choices.push({
      id: 'heal',
      type: 'heal',
      name: '따뜻한 술 한 잔',
      description: '체력을 1 회복한다.',
      detail: `현재 ${runStore.hp}/${runStore.maxHp}`,
    });
  } else if (runStore.currentEncounter?.rewardLevel === 2 && availableRelics[1]) {
    const secondRelic = availableRelics[1];
    choices.push({
      id: secondRelic.id,
      type: 'relic',
      name: secondRelic.name,
      description: secondRelic.description,
      detail: secondRelic.build,
    });
  } else if (secondTactic) {
    choices.push({
      id: secondTactic.id,
      type: 'tactic',
      name: secondTactic.name,
      description: secondTactic.description,
      detail: '판술 덱에 추가',
    });
  }

  if (choices.length < 3) {
    choices.push({
      id: 'heal',
      type: 'heal',
      name: '따뜻한 술 한 잔',
      description: '체력을 1 회복한다.',
      detail: `현재 ${runStore.hp}/${runStore.maxHp}`,
    });
  }
  return choices.slice(0, 3);
}

export function applyReward(reward: RewardOption): void {
  if (reward.type === 'tactic') runStore.tacticDeck.push(reward.id);
  if (reward.type === 'relic' && !runStore.relics.includes(reward.id)) runStore.relics.push(reward.id);
  if (reward.type === 'heal') runStore.hp = Math.min(runStore.maxHp, runStore.hp + 1);
  runStore.stage += 1;
  runStore.currentEncounter = null;
}

export function hasRelic(id: string): boolean {
  return runStore.relics.includes(id);
}

export function registerVictory(score: number): void {
  runStore.fame += score;
  if (runStore.currentEncounter) runStore.clearedEncounters.push(runStore.currentEncounter.id);
}

export function registerDefeat(): boolean {
  if (hasRelic('broken-coin') && !runStore.shieldSpent) {
    runStore.shieldSpent = true;
    return true;
  }
  runStore.hp -= 1;
  return false;
}

export function runIsComplete(): boolean {
  return runStore.stage >= SEASONS.length;
}
