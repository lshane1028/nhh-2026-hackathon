import { beforeEach, describe, expect, it } from 'vitest';
import {
  applyReward,
  currentSeason,
  encounterChoices,
  hasRelic,
  registerDefeat,
  registerVictory,
  purgeTactic,
  runStore,
  selectEncounter,
  startNewRun,
  RELICS,
  TOTAL_STAGES,
} from './runState';
import { TACTICS } from './data';

describe('roguelite run state', () => {
  beforeEach(() => startNewRun());

  it('starts in spring with a six-card tactic deck and two routes', () => {
    expect(currentSeason()).toBe('봄');
    expect(runStore.tacticDeck).toHaveLength(6);
    expect(encounterChoices()).toHaveLength(2);
  });

  it('ships a synergy pool of at least fifty unique implemented pieces', () => {
    expect(TACTICS).toHaveLength(40);
    expect(RELICS).toHaveLength(27);
    expect(TACTICS.length + RELICS.length).toBeGreaterThanOrEqual(50);
    expect(new Set(TACTICS.map((item) => item.id)).size).toBe(TACTICS.length);
    expect(new Set(RELICS.map((item) => item.id)).size).toBe(RELICS.length);
    expect(TACTICS.every((item) => item.effect && item.archetype && item.tags?.length)).toBe(true);
    expect(RELICS.every((item) => item.effects?.length && item.build)).toBe(true);
  });

  it('runs two battles per season for an eight-battle build arc', () => {
    expect(TOTAL_STAGES).toBe(8);
    runStore.stage = 1;
    expect(currentSeason()).toBe('봄');
    runStore.stage = 2;
    expect(currentSeason()).toBe('여름');
  });

  it('keeps rewards for later stages', () => {
    const firstRoute = encounterChoices()[0];
    selectEncounter(firstRoute);
    registerVictory(240);
    applyReward({
      id: 'rain-charm',
      type: 'relic',
      name: '비광 부적',
      description: '',
      detail: '',
    });
    expect(runStore.stage).toBe(1);
    expect(runStore.fame).toBe(240);
    expect(hasRelic('rain-charm')).toBe(true);
    expect(currentSeason()).toBe('봄');
  });

  it('uses the broken coin before losing health', () => {
    runStore.relics.push('broken-coin');
    expect(registerDefeat()).toBe(true);
    expect(runStore.hp).toBe(3);
    expect(registerDefeat()).toBe(false);
    expect(runStore.hp).toBe(2);
  });

  it('lets the player remove an exact tactic copy to improve deck consistency', () => {
    const removed = runStore.tacticDeck[1];
    expect(purgeTactic(1)).toBe(true);
    expect(runStore.tacticDeck).toHaveLength(5);
    expect(runStore.purgeTokens).toBe(0);
    expect(runStore.tacticDeck.filter((id) => id === removed)).toHaveLength(0);
    expect(purgeTactic(0)).toBe(false);
  });
});
