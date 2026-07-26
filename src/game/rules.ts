import type { HwatuCard, ScoreBreakdown } from './types';

const KIND_SCORE = {
  광: 40,
  열끗: 18,
  띠: 12,
  피: 5,
} as const;

export function matchesMonth(played: HwatuCard, field: HwatuCard, wildMonth: boolean): boolean {
  if (played.month === field.month) return true;
  if (!wildMonth) return false;
  const previous = played.month === 1 ? 12 : played.month - 1;
  const next = played.month === 12 ? 1 : played.month + 1;
  return field.month === previous || field.month === next;
}

export function calculateScore(
  captured: HwatuCard[],
  goCount: number,
  comboMultiplier = 1,
): ScoreBreakdown {
  const counts = {
    광: captured.filter((card) => card.kind === '광').length,
    열끗: captured.filter((card) => card.kind === '열끗').length,
    띠: captured.filter((card) => card.kind === '띠').length,
    피: captured.filter((card) => card.kind === '피').length,
  };

  const base = captured.reduce((sum, card) => sum + KIND_SCORE[card.kind], 0);
  const yaku: ScoreBreakdown['yaku'] = [];

  if (counts.광 >= 5) yaku.push({ name: '오광', score: 500 });
  else if (counts.광 >= 4) yaku.push({ name: '사광', score: 280 });
  else if (counts.광 >= 3) yaku.push({ name: '삼광', score: 150 });

  const capturedIds = new Set(captured.map((card) => card.id));
  if (['1-1', '2-1', '3-1'].every((id) => capturedIds.has(id))) {
    yaku.push({ name: '홍단', score: 120 });
  }
  if (['6-1', '9-1', '10-1'].every((id) => capturedIds.has(id))) {
    yaku.push({ name: '청단', score: 120 });
  }
  if (['2-0', '4-0', '8-1'].every((id) => capturedIds.has(id))) {
    yaku.push({ name: '고도리', score: 180 });
  }

  if (counts.열끗 >= 5) yaku.push({ name: '열끗', score: (counts.열끗 - 4) * 30 });
  if (counts.띠 >= 5) yaku.push({ name: '띠', score: (counts.띠 - 4) * 20 });
  if (counts.피 >= 10) yaku.push({ name: '피', score: (counts.피 - 9) * 15 });

  const months = new Set(captured.map((card) => card.month));
  const seasons = [
    [1, 2, 3],
    [4, 5, 6],
    [7, 8, 9],
    [10, 11, 12],
  ];
  const seasonNames = ['봄바람', '여름밤', '풍년', '겨울잠'];
  seasons.forEach((season, index) => {
    if (season.every((month) => months.has(month))) {
      yaku.push({ name: seasonNames[index], score: 70 });
    }
  });

  const multiplier = Number(((1 + goCount * 0.55) * comboMultiplier).toFixed(2));
  const total = Math.round((base + yaku.reduce((sum, item) => sum + item.score, 0)) * multiplier);
  return { base, yaku, multiplier, total };
}

export function chooseBestDeckCard(deck: HwatuCard[], field: HwatuCard[]): number {
  const firstThree = deck.slice(0, 3);
  let bestIndex = 0;
  let bestValue = -1;
  firstThree.forEach((card, index) => {
    const matchCount = field.filter((fieldCard) => fieldCard.month === card.month).length;
    const kindBonus = card.kind === '광' ? 4 : card.kind === '열끗' ? 2 : 0;
    const value = matchCount * 10 + kindBonus;
    if (value > bestValue) {
      bestValue = value;
      bestIndex = index;
    }
  });
  return bestIndex;
}

