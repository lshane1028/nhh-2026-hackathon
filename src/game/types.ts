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
  instanceId?: string;
  name: string;
  description: string;
  cost: number;
  archetype?: BuildArchetype;
  rarity?: ContentRarity;
  tags?: string[];
  effect?: TacticEffect;
}

export type BuildArchetype =
  | '광'
  | '띠'
  | '열끗'
  | '피'
  | '포획'
  | '판술'
  | '견제'
  | '고';

export type ContentRarity = '일반' | '희귀' | '전설';

export type TacticEffect =
  | { type: 'peek'; amount?: number }
  | { type: 'wild' }
  | { type: 'double-capture' }
  | { type: 'swap'; amount?: number }
  | { type: 'snatch'; kind?: CardKind; highest?: boolean }
  | { type: 'skip'; amount?: number }
  | { type: 'capture-bonus'; amount: number; kind?: CardKind }
  | { type: 'energy'; amount: number }
  | { type: 'score-kind'; kind: CardKind; amount: number }
  | { type: 'score-flat'; amount: number }
  | { type: 'target-down'; amount: number }
  | { type: 'reset-tactics'; amount?: number }
  | { type: 'field-sweep'; kind: CardKind; limit?: number }
  | { type: 'go-bonus'; amount: number };

export interface RelicEffect {
  type:
    | 'score-per-kind'
    | 'score-per-tactic'
    | 'score-per-go'
    | 'score-per-skip'
    | 'score-four-kinds'
    | 'score-low-hp'
    | 'start-energy'
    | 'max-energy'
    | 'target-down'
    | 'first-tactic-free'
    | 'tag-cost-down'
    | 'capture-kind-bonus'
    | 'capture-chain-bonus'
    | 'energy-on-kind'
    | 'energy-on-chain'
    | 'go-multiplier'
    | 'late-capture-bonus'
    | 'shield';
  amount?: number;
  kind?: CardKind;
  tag?: string;
  threshold?: number;
}

export interface RelicDefinition {
  id: string;
  name: string;
  description: string;
  build: BuildArchetype;
  rarity?: ContentRarity;
  effects?: RelicEffect[];
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
  maxEnergy: number;
  goBonus: number;
}
