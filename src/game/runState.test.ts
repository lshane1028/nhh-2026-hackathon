import { beforeEach, describe, expect, it } from 'vitest';
import {
  applyReward,
  currentSeason,
  encounterChoices,
  hasRelic,
  registerDefeat,
  registerVictory,
  runStore,
  selectEncounter,
  startNewRun,
} from './runState';

describe('roguelite run state', () => {
  beforeEach(() => startNewRun());

  it('starts in spring with a five-card tactic deck and two routes', () => {
    expect(currentSeason()).toBe('봄');
    expect(runStore.tacticDeck).toHaveLength(5);
    expect(encounterChoices()).toHaveLength(2);
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
    expect(currentSeason()).toBe('여름');
  });

  it('uses the broken coin before losing health', () => {
    runStore.relics.push('broken-coin');
    expect(registerDefeat()).toBe(true);
    expect(runStore.hp).toBe(3);
    expect(registerDefeat()).toBe(false);
    expect(runStore.hp).toBe(2);
  });
});

