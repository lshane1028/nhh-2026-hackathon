export interface RngState {
  seed: string;
  cursor: number;
}

export interface RngResult<T> {
  value: T;
  state: RngState;
}

function hashSeed(seed: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function mix32(value: number): number {
  let mixed = value >>> 0;
  mixed ^= mixed >>> 16;
  mixed = Math.imul(mixed, 0x7feb352d);
  mixed ^= mixed >>> 15;
  mixed = Math.imul(mixed, 0x846ca68b);
  mixed ^= mixed >>> 16;
  return mixed >>> 0;
}

export function createRngState(seed: string, cursor = 0): RngState {
  if (!Number.isSafeInteger(cursor) || cursor < 0) throw new RangeError("RNG cursor must be a non-negative safe integer");
  return { seed, cursor };
}

export function randomAt(seed: string, cursor: number): number {
  if (!Number.isSafeInteger(cursor) || cursor < 0) throw new RangeError("RNG cursor must be a non-negative safe integer");
  const counter = Math.imul((cursor + 1) >>> 0, 0x9e3779b9);
  return mix32(hashSeed(seed) ^ counter) / 0x1_0000_0000;
}

export function nextRandom(state: RngState): RngResult<number> {
  return {
    value: randomAt(state.seed, state.cursor),
    state: { seed: state.seed, cursor: state.cursor + 1 },
  };
}

export function randomInt(state: RngState, maxExclusive: number): RngResult<number> {
  if (!Number.isSafeInteger(maxExclusive) || maxExclusive <= 0) {
    throw new RangeError("maxExclusive must be a positive safe integer");
  }
  const next = nextRandom(state);
  return { value: Math.floor(next.value * maxExclusive), state: next.state };
}

export function shuffleDeterministic<T>(items: readonly T[], initialState: RngState): RngResult<T[]> {
  const shuffled = [...items];
  let state = initialState;
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const roll = randomInt(state, index + 1);
    state = roll.state;
    [shuffled[index], shuffled[roll.value]] = [shuffled[roll.value], shuffled[index]];
  }
  return { value: shuffled, state };
}

