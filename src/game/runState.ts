import { EXTRA_RELICS } from './content';
import { shuffle, TACTIC_BY_ID } from './data';
import type { BuildArchetype, RelicDefinition, Tactic } from './types';

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

export interface RewardOption {
  id: string;
  type: 'tactic' | 'relic' | 'heal';
  name: string;
  description: string;
  detail: string;
  archetype?: BuildArchetype;
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
  purgeTokens: number;
}

export const TOTAL_STAGES = 8;
const SEASONS: SeasonId[] = ['봄', '여름', '가을', '겨울'];

const ENCOUNTERS: Encounter[][] = [
  [
    {
      id: 'spring-garden',
      season: '봄',
      name: '매화 뜰의 첫판',
      ruleName: '첫꽃',
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
      description: '목표와 상대 점수가 높지만 희귀 보상이 자주 나온다.',
      rule: 'red_tax',
      targetBonus: 8,
      opponentBonus: 12,
      rewardLevel: 2,
    },
  ],
  [
    {
      id: 'summer-rain',
      season: '여름',
      name: '장마 월광판',
      ruleName: '비바람',
      description: '12월 패는 모든 달과 맞는 만능패로 작용한다.',
      rule: 'rain_wild',
      targetBonus: 15,
      opponentBonus: 10,
      rewardLevel: 2,
    },
    {
      id: 'summer-dry',
      season: '여름',
      name: '마른 연못판',
      ruleName: '기근',
      description: '기력이 부족한 상태로 시작한다. 순환 빌드를 시험한다.',
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
      description: '먹은 띠와 열끗마다 추가 점수를 얻는다.',
      rule: 'harvest',
      targetBonus: 20,
      opponentBonus: 15,
      rewardLevel: 2,
    },
    {
      id: 'autumn-stakes',
      season: '가을',
      name: '여우의 판돈',
      ruleName: '강자 판',
      description: '상대 점수에 큰 보정이 붙는다. 견제와 고 판단이 중요하다.',
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
      name: '열두 달의 월식',
      ruleName: '월식',
      description: '목표와 상대 점수가 크게 오른다. 완성한 빌드를 시험한다.',
      rule: 'eclipse',
      targetBonus: 35,
      opponentBonus: 35,
      rewardLevel: 2,
    },
    {
      id: 'winter-silence',
      season: '겨울',
      name: '눈 덮인 마지막 판',
      ruleName: '설국',
      description: '낮은 기력과 높은 목표를 함께 견뎌야 한다.',
      rule: 'thin_energy',
      targetBonus: 28,
      opponentBonus: 25,
      rewardLevel: 2,
    },
  ],
];

const BASE_RELICS: RelicDefinition[] = [
  {
    id: 'rain-charm',
    name: '비광 부적',
    description: '먹은 광 한 장마다 20점.',
    build: '광',
    rarity: '희귀',
    effects: [{ type: 'score-per-kind', kind: '광', amount: 20 }],
  },
  {
    id: 'ribbon-knot',
    name: '청홍 매듭',
    description: '먹은 띠 한 장마다 9점.',
    build: '띠',
    rarity: '희귀',
    effects: [{ type: 'score-per-kind', kind: '띠', amount: 9 }],
  },
  {
    id: 'bird-bell',
    name: '고도리 방울',
    description: '먹은 열끗 한 장마다 12점.',
    build: '열끗',
    rarity: '희귀',
    effects: [{ type: 'score-per-kind', kind: '열끗', amount: 12 }],
  },
  {
    id: 'goblin-mirror',
    name: '도깨비 거울',
    description: '매 판 첫 전술은 기력을 소모하지 않는다.',
    build: '판술',
    rarity: '전설',
    effects: [{ type: 'first-tactic-free' }],
  },
  {
    id: 'broken-coin',
    name: '끊어진 엽전',
    description: '런에서 한 번 체력 손실을 막는다.',
    build: '고',
    rarity: '전설',
    effects: [{ type: 'shield' }],
  },
  {
    id: 'moon-mortar',
    name: '달토끼 절구',
    description: '모든 판의 목표 점수 -15.',
    build: '포획',
    rarity: '희귀',
    effects: [{ type: 'target-down', amount: 15 }],
  },
  {
    id: 'last-cup',
    name: '마지막 술잔',
    description: '체력이 1이면 최종 점수 +35%.',
    build: '고',
    rarity: '전설',
    effects: [{ type: 'score-low-hp', amount: 0.35 }],
  },
  {
    id: 'empty-table',
    name: '빈 술상',
    description: '손패가 2장 이하면 포획마다 35점.',
    build: '포획',
    rarity: '희귀',
    effects: [{ type: 'late-capture-bonus', threshold: 2, amount: 35 }],
  },
];

export const RELICS: RelicDefinition[] = [...BASE_RELICS, ...EXTRA_RELICS];
export const RELIC_BY_ID = new Map(RELICS.map((relic) => [relic.id, relic]));

function createInitialState(): PersistentRunState {
  return {
    stage: 0,
    hp: 3,
    maxHp: 3,
    fame: 0,
    tacticDeck: ['peek', 'moonstep', 'storm', 'swap', 'blossom', 'breath'],
    relics: [],
    currentEncounter: null,
    clearedEncounters: [],
    shieldSpent: false,
    purgeTokens: 1,
  };
}

export const runStore: PersistentRunState = createInitialState();
let drawSerial = 0;

export function startNewRun(): void {
  Object.assign(runStore, createInitialState());
  drawSerial = 0;
}

export function currentSeason(): SeasonId {
  return SEASONS[Math.min(Math.floor(runStore.stage / 2), SEASONS.length - 1)];
}

export function encounterChoices(): Encounter[] {
  return ENCOUNTERS[Math.min(Math.floor(runStore.stage / 2), ENCOUNTERS.length - 1)];
}

export function selectEncounter(encounter: Encounter): void {
  runStore.currentEncounter = encounter;
}

export function drawTactics(count = 3): Tactic[] {
  return shuffle(runStore.tacticDeck.map((id, deckIndex) => ({ id, deckIndex })))
    .slice(0, count)
    .flatMap(({ id, deckIndex }): Tactic[] => {
      const tactic = TACTIC_BY_ID.get(id);
      if (!tactic) return [];
      drawSerial += 1;
      return [{ ...tactic, instanceId: `${id}:${deckIndex}:${drawSerial}` }];
    });
}

export function buildAffinities(): Map<BuildArchetype, number> {
  const scores = new Map<BuildArchetype, number>();
  const add = (build: BuildArchetype | undefined, amount: number): void => {
    if (build) scores.set(build, (scores.get(build) ?? 0) + amount);
  };
  runStore.tacticDeck.forEach((id) => add(TACTIC_BY_ID.get(id)?.archetype, 1));
  runStore.relics.forEach((id) => add(RELIC_BY_ID.get(id)?.build, 2));
  return scores;
}

function synergyRank(build: BuildArchetype | undefined, rarity: string | undefined): number {
  const affinity = build ? buildAffinities().get(build) ?? 0 : 0;
  const rarityGate = rarity === '전설' && runStore.stage < 3 && runStore.currentEncounter?.rewardLevel !== 2 ? -20 : 0;
  return Math.random() * 6 + affinity * 2 + rarityGate;
}

function tacticReward(tactic: Tactic): RewardOption {
  const ownedCopies = runStore.tacticDeck.filter((id) => id === tactic.id).length;
  return {
    id: tactic.id,
    type: 'tactic',
    name: tactic.name,
    description: tactic.description,
    detail: `${tactic.rarity ?? '일반'} · ${tactic.archetype ?? '범용'} · ${ownedCopies ? `현재 ${ownedCopies}장` : '새 전술'}`,
    archetype: tactic.archetype,
  };
}

function relicReward(relic: RelicDefinition): RewardOption {
  return {
    id: relic.id,
    type: 'relic',
    name: relic.name,
    description: relic.description,
    detail: `${relic.rarity ?? '일반'} · ${relic.build} 빌드`,
    archetype: relic.build,
  };
}

export function makeRewardChoices(): RewardOption[] {
  const tacticPool = [...TACTIC_BY_ID.values()].sort(
    (a, b) => synergyRank(b.archetype, b.rarity) - synergyRank(a.archetype, a.rarity),
  );
  const relicPool = RELICS.filter((relic) => !runStore.relics.includes(relic.id)).sort(
    (a, b) => synergyRank(b.build, b.rarity) - synergyRank(a.build, a.rarity),
  );
  const choices: RewardOption[] = [];
  if (tacticPool[0]) choices.push(tacticReward(tacticPool[0]));
  if (relicPool[0]) choices.push(relicReward(relicPool[0]));

  if (runStore.hp < runStore.maxHp && Math.random() < 0.45) {
    choices.push({
      id: 'heal',
      type: 'heal',
      name: '동동주 한 사발',
      description: '체력을 1 회복한다. 빌드 보상을 포기하는 안전한 선택.',
      detail: `현재 ${runStore.hp}/${runStore.maxHp}`,
    });
  } else {
    if (runStore.currentEncounter?.rewardLevel === 2 && relicPool[1]) {
      choices.push(relicReward(relicPool[1]));
    } else if (tacticPool[1]) {
      choices.push(tacticReward(tacticPool[1]));
    }
  }

  if (choices.length < 3 && tacticPool[1]) choices.push(tacticReward(tacticPool[1]));
  return choices.slice(0, 3);
}

export function applyReward(reward: RewardOption): void {
  if (reward.type === 'tactic') runStore.tacticDeck.push(reward.id);
  if (reward.type === 'relic' && !runStore.relics.includes(reward.id)) runStore.relics.push(reward.id);
  if (reward.type === 'heal') runStore.hp = Math.min(runStore.maxHp, runStore.hp + 1);
  runStore.stage += 1;
  if (runStore.stage % 2 === 0 && runStore.stage < TOTAL_STAGES) runStore.purgeTokens += 1;
  runStore.currentEncounter = null;
}

export function purgeTactic(deckIndex: number): boolean {
  if (runStore.purgeTokens <= 0 || runStore.tacticDeck.length <= 4) return false;
  if (deckIndex < 0 || deckIndex >= runStore.tacticDeck.length) return false;
  runStore.tacticDeck.splice(deckIndex, 1);
  runStore.purgeTokens -= 1;
  return true;
}

export function hasRelic(id: string): boolean {
  return runStore.relics.includes(id);
}

export function activeRelics(): RelicDefinition[] {
  return runStore.relics
    .map((id) => RELIC_BY_ID.get(id))
    .filter((relic): relic is RelicDefinition => relic !== undefined);
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
  return runStore.stage >= TOTAL_STAGES;
}
