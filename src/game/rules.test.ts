import { describe, expect, it } from 'vitest';
import { createDeck } from './data';
import { calculateScore, matchesMonth } from './rules';

describe('flower-card rules', () => {
  it('creates a 48 card deck with four cards per month', () => {
    const deck = createDeck();
    expect(deck).toHaveLength(48);
    for (let month = 1; month <= 12; month += 1) {
      expect(deck.filter((card) => card.month === month)).toHaveLength(4);
    }
  });

  it('matches adjacent months only while moonstep is active', () => {
    const deck = createDeck();
    expect(matchesMonth(deck[0], deck[4], false)).toBe(false);
    expect(matchesMonth(deck[0], deck[4], true)).toBe(true);
  });

  it('adds a go multiplier after scoring', () => {
    const deck = createDeck().slice(0, 20);
    expect(calculateScore(deck, 1).total).toBeGreaterThan(calculateScore(deck, 0).total);
  });
});

