export type CardKind = '광' | '열끗' | '띠' | '피';

export interface HwatuCard {
  id: string;
  month: number;
  kind: CardKind;
  copy: number;
  captured?: boolean;
}

export interface ScoreBreakdown {
  base: number;
  yaku: Array<{ name: string; score: number }>;
  multiplier: number;
  total: number;
}

export interface Tactic {
  id: string;
  name: string;
  description: string;
  cost: number;
}

export interface RunState {
  turn: number;
  maxTurns: number;
  goCount: number;
  energy: number;
  target: number;
  comboMultiplier: number;
  doubledTurn: boolean;
  wildMonth: boolean;
}
