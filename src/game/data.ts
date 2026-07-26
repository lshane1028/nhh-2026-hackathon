import type { CardKind, HwatuCard, Tactic } from './types';

export const MONTH_NAMES = [
  '송학', '매조', '벚꽃', '흑싸리', '난초', '모란',
  '홍싸리', '공산', '국화', '단풍', '오동', '비',
] as const;

const MONTH_KINDS: CardKind[][] = [
  ['광', '띠', '피', '피'],
  ['열끗', '띠', '피', '피'],
  ['광', '띠', '피', '피'],
  ['열끗', '띠', '피', '피'],
  ['열끗', '띠', '피', '피'],
  ['열끗', '띠', '피', '피'],
  ['열끗', '띠', '피', '피'],
  ['광', '열끗', '피', '피'],
  ['열끗', '띠', '피', '피'],
  ['열끗', '띠', '피', '피'],
  ['광', '띠', '피', '피'],
  ['광', '열끗', '띠', '피'],
];

export const TACTICS: Tactic[] = [
  {
    id: 'peek',
    name: '산패보기',
    description: '산패 위 3장을 확인하고 가장 유리한 월을 위로 올린다.',
    cost: 1,
  },
  {
    id: 'moonstep',
    name: '달넘기',
    description: '이번에 내는 패를 앞뒤 월과도 맞는 것으로 취급한다.',
    cost: 1,
  },
  {
    id: 'storm',
    name: '휘몰이',
    description: '이번 턴에 먹은 패의 기본 점수를 두 배로 계산한다.',
    cost: 2,
  },
];

export function createDeck(): HwatuCard[] {
  return MONTH_KINDS.flatMap((kinds, monthIndex) =>
    kinds.map((kind, copy) => ({
      id: `${monthIndex + 1}-${copy}`,
      month: monthIndex + 1,
      kind,
      copy,
    })),
  );
}

export function shuffle<T>(items: T[], random: () => number = Math.random): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    [result[index], result[target]] = [result[target], result[index]];
  }
  return result;
}

