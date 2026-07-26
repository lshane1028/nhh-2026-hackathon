import Phaser from 'phaser';
import { SfxManager } from '../audio/SfxManager';
import { createDeck, MONTH_NAMES, shuffle } from '../game/data';
import { calculateScore, chooseBestDeckCard, matchesMonth } from '../game/rules';
import {
  activeRelics,
  drawTactics,
  hasRelic,
  registerDefeat,
  registerVictory,
  runStore,
  TOTAL_STAGES,
} from '../game/runState';
import type { CardKind, HwatuCard, RelicEffect, RunState, Tactic } from '../game/types';
import { CardView } from '../ui/CardView';

const COLORS = {
  ink: 0x0e0b09,
  panel: 0x17120f,
  cream: '#eadcbd',
  dim: '#a4957c',
  red: 0xb74735,
  brass: 0xb18a4e,
  jade: 0x477e70,
};

interface OpponentState {
  id: string;
  name: string;
  title: string;
  frame: number;
  hand: HwatuCard[];
  captured: HwatuCard[];
  accent: number;
  seatX: number;
}

export class GameScene extends Phaser.Scene {
  private deck: HwatuCard[] = [];
  private hand: HwatuCard[] = [];
  private field: HwatuCard[] = [];
  private captured: HwatuCard[] = [];
  private state: RunState = this.freshState();
  private bonusScore = 0;
  private busy = false;
  private usedTactics = new Set<string>();
  private knownYaku = new Set<string>();
  private opponents: OpponentState[] = [];
  private readonly sfx = new SfxManager();
  private activeTactics: Tactic[] = [];
  private skipOpponentTurns = 0;
  private pendingCaptureBonuses: Array<{ amount: number; kind?: CardKind }> = [];
  private firstCaptureAwarded = false;
  private tacticUseCount = 0;
  private skippedOpponentCount = 0;

  private handLayer!: Phaser.GameObjects.Container;
  private fieldLayer!: Phaser.GameObjects.Container;
  private capturedLayer!: Phaser.GameObjects.Container;
  private tacticLayer!: Phaser.GameObjects.Container;
  private opponentLayer!: Phaser.GameObjects.Container;
  private fxLayer!: Phaser.GameObjects.Container;
  private modalLayer!: Phaser.GameObjects.Container;
  private scoreText!: Phaser.GameObjects.Text;
  private targetText!: Phaser.GameObjects.Text;
  private turnText!: Phaser.GameObjects.Text;
  private energyText!: Phaser.GameObjects.Text;
  private goText!: Phaser.GameObjects.Text;
  private messageText!: Phaser.GameObjects.Text;
  private yakuText!: Phaser.GameObjects.Text;
  private deckText!: Phaser.GameObjects.Text;

  constructor() {
    super('game');
  }

  create(): void {
    this.deck = shuffle(createDeck());
    this.opponents = [
      {
        id: 'rain',
        name: '비 장수',
        title: '광을 노린다',
        frame: 1,
        hand: [],
        captured: [],
        accent: 0x527c88,
        seatX: 520,
      },
      {
        id: 'scholar',
        name: '매화 선비',
        title: '띠를 먼저 끊는다',
        frame: 0,
        hand: [],
        captured: [],
        accent: 0xb74735,
        seatX: 800,
      },
      {
        id: 'fox',
        name: '월식 여우',
        title: '열끗을 먼저 낚아챈다',
        frame: 2,
        hand: [],
        captured: [],
        accent: 0x8e744b,
        seatX: 1080,
      },
    ];
    this.hand = this.deck.splice(0, 5);
    this.opponents.forEach((opponent) => {
      opponent.hand = this.deck.splice(0, 5);
    });
    this.field = this.deck.splice(0, 8);
    this.captured = [];
    this.state = this.freshState();
    this.bonusScore = 0;
    this.busy = false;
    this.activeTactics = drawTactics(3);
    this.skipOpponentTurns = 0;
    this.pendingCaptureBonuses = [];
    this.firstCaptureAwarded = false;
    this.tacticUseCount = 0;
    this.skippedOpponentCount = 0;
    this.usedTactics.clear();
    this.knownYaku.clear();

    this.createRoom();
    this.createHud();
    this.createFxTexture();
    this.handLayer = this.add.container(0, 0);
    this.fieldLayer = this.add.container(0, 0);
    this.capturedLayer = this.add.container(0, 0);
    this.tacticLayer = this.add.container(0, 0);
    this.opponentLayer = this.add.container(0, 0);
    this.fxLayer = this.add.container(0, 0).setDepth(70);
    this.modalLayer = this.add.container(0, 0).setDepth(100);
    this.input.once('pointerdown', () => this.sfx.unlock());

    this.renderAll();
    this.setMessage('네 자리가 찼다. 손패를 내면 판주 셋이 차례로 응수한다.');
  }

  private freshState(): RunState {
    const encounter = runStore.currentEncounter;
    const maxEnergy = 3 + this.relicEffectTotal('max-energy');
    const targetReduction = this.relicEffectTotal('target-down');
    const startEnergy = (encounter?.rule === 'thin_energy' ? 2 : 3) + this.relicEffectTotal('start-energy');
    return {
      turn: 0,
      maxTurns: 5,
      goCount: 0,
      energy: Math.min(maxEnergy, startEnergy),
      target: 70 + (encounter?.targetBonus ?? 0) - targetReduction,
      comboMultiplier: 1,
      doubledTurn: false,
      wildMonth: false,
      maxEnergy,
      goBonus: 0,
    };
  }

  private createRoom(): void {
    const { width, height } = this.scale;
    const encounter = runStore.currentEncounter;
    const room = this.add.image(width / 2, height / 2, 'room').setDisplaySize(width, height);
    room.setTint(0xb9ad9b);
    this.add.rectangle(width / 2, height / 2, width, height, 0x050403, 0.22);
    this.add.rectangle(width / 2, 505, 1100, 525, 0x140c08, 0.2).setStrokeStyle(2, 0x5a3526, 0.38);

    this.add
      .text(width / 2, 54, encounter?.name ?? '네 자리 도깨비 판', {
        fontFamily: '"Gowun Batang", serif',
        fontSize: '28px',
        color: '#dfcfad',
        fontStyle: 'bold',
        backgroundColor: '#0b0806cc',
        padding: { x: 22, y: 8 },
      })
      .setOrigin(0.5);
    this.add
      .text(
        width / 2,
        94,
        encounter
          ? `${encounter.ruleName}: ${encounter.description}`
          : '세 판주가 실제로 패를 먹는다 · 판술로 확률을 꺾는다 · 고로 배수를 건다',
        {
        fontFamily: '"Noto Sans KR", sans-serif',
        fontSize: '15px',
        color: '#b4a68d',
        backgroundColor: '#0b0806b8',
        padding: { x: 12, y: 5 },
        },
      )
      .setOrigin(0.5);

    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      const offset = Phaser.Math.Clamp((pointer.x / width - 0.5) * 12, -6, 6);
      room.x = width / 2 - offset * 0.18;
    });
  }

  private createHud(): void {
    const topPanel = this.add.rectangle(800, 49, 1540, 72, COLORS.ink, 0.9).setStrokeStyle(1, COLORS.brass, 0.6);
    topPanel.setDepth(5);

    const hudStyle: Phaser.Types.GameObjects.Text.TextStyle = {
      fontFamily: '"Noto Sans KR", sans-serif',
      fontSize: '20px',
      color: COLORS.cream,
      fontStyle: 'bold',
    };
    this.scoreText = this.add.text(55, 49, '', hudStyle).setOrigin(0, 0.5).setDepth(6);
    this.targetText = this.add.text(310, 49, '', hudStyle).setOrigin(0, 0.5).setDepth(6);
    this.turnText = this.add.text(1150, 49, '', hudStyle).setOrigin(0, 0.5).setDepth(6);
    this.energyText = this.add.text(1332, 49, '', hudStyle).setOrigin(0, 0.5).setDepth(6);
    this.goText = this.add.text(1518, 49, '', hudStyle).setOrigin(1, 0.5).setDepth(6);

    this.add.rectangle(800, 852, 1520, 58, COLORS.ink, 0.92).setStrokeStyle(1, 0x745c3b, 0.8);
    this.messageText = this.add
      .text(800, 852, '', {
        fontFamily: '"Gowun Batang", serif',
        fontSize: '22px',
        color: '#dfd1b4',
      })
      .setOrigin(0.5);

    this.add
      .text(85, 166, '갈무리', {
        fontFamily: '"Gowun Batang", serif',
        fontSize: '23px',
        color: '#d9c8a8',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);
    this.yakuText = this.add
      .text(32, 192, '', {
        fontFamily: '"Noto Sans KR", sans-serif',
        fontSize: '17px',
        color: '#c6b89e',
        lineSpacing: 8,
      });

    this.add
      .text(1455, 165, '판술', {
        fontFamily: '"Gowun Batang", serif',
        fontSize: '23px',
        color: '#d9c8a8',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);
    this.deckText = this.add
      .text(800, 623, '', {
        fontFamily: '"Noto Sans KR", sans-serif',
        fontSize: '15px',
        color: '#a99a80',
      })
      .setOrigin(0.5);
  }

  private createFxTexture(): void {
    if (this.textures.exists('fx-dot')) return;
    const graphics = this.make.graphics({ x: 0, y: 0 }, false);
    graphics.fillStyle(0xffffff, 1);
    graphics.fillCircle(6, 6, 6);
    graphics.generateTexture('fx-dot', 12, 12);
    graphics.destroy();
  }

  private impactAt(x: number, y: number, color: number, strength: number): void {
    const flash = this.add.circle(x, y, 14, color, 0.48).setDepth(69);
    const ring = this.add.circle(x, y, 10, 0x000000, 0).setStrokeStyle(4, color, 0.95).setDepth(69);
    this.fxLayer.add([flash, ring]);
    this.tweens.add({
      targets: flash,
      scale: 4.8 * strength,
      alpha: 0,
      duration: 210,
      onComplete: () => flash.destroy(),
    });
    this.tweens.add({
      targets: ring,
      scale: 8 * strength,
      alpha: 0,
      duration: 320,
      ease: 'Quad.out',
      onComplete: () => ring.destroy(),
    });

    for (let index = 0; index < 14; index += 1) {
      const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
      const distance = Phaser.Math.Between(36, 105) * strength;
      const particle = this.add
        .image(x, y, 'fx-dot')
        .setTint(index % 3 === 0 ? 0xead7a4 : color)
        .setScale(Phaser.Math.FloatBetween(0.25, 0.75))
        .setDepth(69);
      this.fxLayer.add(particle);
      this.tweens.add({
        targets: particle,
        x: x + Math.cos(angle) * distance,
        y: y + Math.sin(angle) * distance * 0.45 + Phaser.Math.Between(8, 28),
        alpha: 0,
        scale: 0,
        duration: Phaser.Math.Between(260, 430),
        ease: 'Quad.out',
        onComplete: () => particle.destroy(),
      });
    }
  }

  private renderAll(): void {
    this.renderOpponents();
    this.renderHand();
    this.renderField();
    this.renderCaptured();
    this.renderTactics();
    this.updateHud();
  }

  private renderOpponents(activeId?: string): void {
    this.opponentLayer.removeAll(true);
    this.opponents.forEach((opponent) => {
      const score = this.opponentScore(opponent);
      const active = opponent.id === activeId;
      const group = this.add.container(opponent.seatX, 176);
      const halo = this.add
        .circle(0, -12, 67, active ? opponent.accent : 0x100d0a, active ? 0.42 : 0.75)
        .setStrokeStyle(active ? 5 : 2, opponent.accent, active ? 1 : 0.55);
      const portrait = this.add.image(0, -12, 'bosses', opponent.frame).setDisplaySize(122, 122);
      portrait.setCrop(88, 34, 450, 420);
      if (!active) portrait.setTint(0x938777);
      const plate = this.add.rectangle(0, 66, 205, 48, 0x100c09, 0.96).setStrokeStyle(1, opponent.accent, 0.7);
      const name = this.add
        .text(-91, 57, opponent.name, {
          fontFamily: '"Gowun Batang", serif',
          fontSize: '17px',
          color: '#ead9ba',
          fontStyle: 'bold',
        })
        .setOrigin(0, 0.5);
      const status = this.add
        .text(91, 57, `${score}점`, {
          fontFamily: '"Noto Sans KR", sans-serif',
          fontSize: '14px',
          color: active ? '#f0c56a' : '#ad9e85',
          fontStyle: 'bold',
        })
        .setOrigin(1, 0.5);
      const cards = this.add
        .text(0, 77, `${opponent.title} · 손 ${opponent.hand.length}`, {
          fontFamily: '"Noto Sans KR", sans-serif',
          fontSize: '10px',
          color: '#8f826e',
        })
        .setOrigin(0.5);
      group.add([halo, portrait, plate, name, status, cards]);

      const shownBacks = Math.min(opponent.hand.length, 5);
      for (let index = 0; index < shownBacks; index += 1) {
        const back = this.add
          .rectangle((index - (shownBacks - 1) / 2) * 17, 105, 27, 39, 0x3b1712, 1)
          .setStrokeStyle(1, 0xb64b37, 0.8)
          .setAngle((index - (shownBacks - 1) / 2) * 4);
        group.add(back);
      }
      if (active) {
        this.tweens.add({
          targets: halo,
          scale: 1.08,
          alpha: 0.65,
          duration: 260,
          yoyo: true,
          repeat: -1,
        });
      }
      this.opponentLayer.add(group);
    });
  }

  private renderHand(): void {
    this.handLayer.removeAll(true);
    const spacing = Math.min(126, 700 / Math.max(this.hand.length, 1));
    const startX = 800 - ((this.hand.length - 1) * spacing) / 2;
    this.hand.forEach((card, index) => {
      const view = new CardView(this, startX + index * spacing, 754, card, 0.95);
      view.setPlayable(!this.busy);
      view.on('pointerover', () => this.highlightMatches(card));
      view.on('pointerout', () => this.clearMatchHints());
      view.on('pointerup', () => void this.playCard(card));
      this.handLayer.add(view);
    });
  }

  private renderField(): void {
    this.fieldLayer.removeAll(true);
    const maxPerRow = 8;
    this.field.forEach((card, index) => {
      const row = Math.floor(index / maxPerRow);
      const countInRow = Math.min(maxPerRow, this.field.length - row * maxPerRow);
      const column = index % maxPerRow;
      const x = 800 - ((countInRow - 1) * 112) / 2 + column * 112;
      const y = 365 + row * 154;
      const view = new CardView(this, x, y, card, 0.82);
      view.disableInteractive();
      view.setData('fieldCard', card);
      this.fieldLayer.add(view);
    });
  }

  private renderCaptured(): void {
    this.capturedLayer.removeAll(true);
    const kinds = ['광', '열끗', '띠', '피'] as const;
    kinds.forEach((kind, index) => {
      const cards = this.captured.filter((card) => card.kind === kind);
      const y = 410 + index * 70;
      const plate = this.add.rectangle(90, y, 150, 54, 0x0b0907, 0.78).setStrokeStyle(1, 0x6e5b41, 0.55);
      const label = this.add
        .text(28, y, kind, {
          fontFamily: '"Noto Sans KR", sans-serif',
          fontSize: '16px',
          color: '#a99b84',
        })
        .setOrigin(0, 0.5);
      const count = this.add
        .text(145, y, `${cards.length}`, {
          fontFamily: '"Gowun Batang", serif',
          fontSize: '27px',
          color: '#ead9ba',
          fontStyle: 'bold',
        })
        .setOrigin(1, 0.5);
      this.capturedLayer.add([plate, label, count]);
    });

    const breakdown = calculateScore(this.captured, this.state.goCount, this.state.comboMultiplier);
    this.yakuText.setText(
      breakdown.yaku.length > 0
        ? breakdown.yaku.map((item) => `${item.name}  +${item.score}`).join('\n')
        : '아직 완성된\n족보가 없다.',
    );
  }

  private renderTactics(): void {
    this.tacticLayer.removeAll(true);
    this.activeTactics.forEach((tactic, index) => {
      const y = 242 + index * 122;
      const used = this.usedTactics.has(this.tacticKey(tactic));
      const actualCost = this.tacticCost(tactic);
      const affordable = this.state.energy >= actualCost;
      const enabled = !used && affordable && !this.busy;
      const group = this.add.container(1455, y);
      const plate = this.add
        .rectangle(0, 0, 240, 98, enabled ? COLORS.panel : 0x12100e, enabled ? 0.95 : 0.72)
        .setStrokeStyle(2, enabled ? COLORS.jade : 0x4c4438, enabled ? 0.9 : 0.5);
      const name = this.add
        .text(-102, -28, tactic.name, {
          fontFamily: '"Gowun Batang", serif',
          fontSize: '20px',
          color: enabled ? '#ebd9b6' : '#736b5d',
          fontStyle: 'bold',
        })
        .setOrigin(0, 0.5);
      const cost = this.add
        .text(101, -28, actualCost === 0 && tactic.cost > 0 ? '거울 0' : `기력 ${actualCost}`, {
          fontFamily: '"Noto Sans KR", sans-serif',
          fontSize: '13px',
          color: enabled ? '#7fc1ad' : '#625d53',
        })
        .setOrigin(1, 0.5);
      const description = this.add
        .text(-102, 5, used ? '이번 판에 사용함' : tactic.description, {
          fontFamily: '"Noto Sans KR", sans-serif',
          fontSize: '13px',
          color: enabled ? '#b7aa94' : '#6c665c',
          wordWrap: { width: 204 },
          lineSpacing: 3,
        })
        .setOrigin(0, 0);
      group.add([plate, name, cost, description]);
      group.setSize(240, 98);
      if (enabled) {
        group.setInteractive({ useHandCursor: true });
        group.on('pointerover', () => plate.setFillStyle(0x26332b, 0.98));
        group.on('pointerout', () => plate.setFillStyle(COLORS.panel, 0.95));
        group.on('pointerup', () => this.useTactic(tactic));
      }
      this.tacticLayer.add(group);
    });
  }

  private highlightMatches(card: HwatuCard): void {
    this.fieldLayer.each((child: Phaser.GameObjects.GameObject) => {
      if (!(child instanceof CardView)) return;
      const fieldCard = child.getData('fieldCard') as HwatuCard;
      child.setMatchHint(this.cardsMatch(card, fieldCard, this.state.wildMonth));
    });
  }

  private clearMatchHints(): void {
    this.renderField();
  }

  private useTactic(tactic: Tactic): void {
    const actualCost = this.tacticCost(tactic);
    const tacticKey = this.tacticKey(tactic);
    if (this.busy || this.usedTactics.has(tacticKey) || this.state.energy < actualCost) return;
    this.sfx.unlock();
    this.sfx.tactic();
    this.state.energy -= actualCost;
    this.usedTactics.add(tacticKey);
    this.tacticUseCount += 1;

    const effect = tactic.effect;
    if (!effect) return;
    if (effect.type === 'peek') {
      const best = chooseBestDeckCard(this.deck.slice(0, effect.amount ?? 3), this.field);
      const [chosen] = this.deck.splice(best, 1);
      if (chosen) this.deck.unshift(chosen);
    } else if (effect.type === 'wild') {
      this.state.wildMonth = true;
    } else if (effect.type === 'double-capture') {
      this.state.doubledTurn = true;
    } else if (effect.type === 'swap') {
      this.swapDeadCards(effect.amount ?? 1);
    } else if (effect.type === 'snatch') {
      this.snatchFieldCard(effect.kind, effect.highest ?? false);
    } else if (effect.type === 'skip') {
      this.skipOpponentTurns += effect.amount ?? 1;
    } else if (effect.type === 'capture-bonus') {
      this.pendingCaptureBonuses.push({ amount: effect.amount, kind: effect.kind });
    } else if (effect.type === 'energy') {
      this.state.energy = Math.min(this.state.maxEnergy, this.state.energy + effect.amount);
    } else if (effect.type === 'score-kind') {
      const count = this.captured.filter((card) => card.kind === effect.kind).length;
      this.bonusScore += count * effect.amount;
    } else if (effect.type === 'score-flat') {
      this.bonusScore += effect.amount;
    } else if (effect.type === 'target-down') {
      this.state.target = Math.max(30, this.state.target - effect.amount);
    } else if (effect.type === 'reset-tactics') {
      const reusable = [...this.usedTactics].filter((key) => key !== tacticKey);
      reusable.slice(0, effect.amount ?? 1).forEach((key) => this.usedTactics.delete(key));
    } else if (effect.type === 'field-sweep') {
      const targets = this.field.filter((card) => card.kind === effect.kind).slice(0, effect.limit ?? 1);
      targets.forEach((target) => this.field.splice(this.field.findIndex((card) => card.id === target.id), 1));
      this.captured.push(...targets);
      this.applyCaptureSynergies(targets);
    } else if (effect.type === 'go-bonus') {
      this.state.goBonus += effect.amount;
    }
    if (tactic.id === 'red-seal') this.bonusScore += 20;
    if (tactic.id === 'last-gamble') this.state.target += 10;
    if (tactic.id === 'victory-toast') this.bonusScore += this.state.goCount * 30;
    this.setMessage(`${tactic.name}. ${tactic.description}`);
    this.renderAll();
  }

  private tacticCost(tactic: Tactic): number {
    if (this.relicEffects('first-tactic-free').length > 0 && this.tacticUseCount === 0) return 0;
    const tagDiscount = this.relicEffects('tag-cost-down')
      .filter((effect) => effect.tag && tactic.tags?.includes(effect.tag))
      .reduce((sum, effect) => sum + (effect.amount ?? 0), 0);
    return Math.max(0, tactic.cost - tagDiscount);
  }

  private tacticKey(tactic: Tactic): string {
    return tactic.instanceId ?? tactic.id;
  }

  private relicEffects(type: RelicEffect['type']): RelicEffect[] {
    return activeRelics().flatMap((relic) => relic.effects ?? []).filter((effect) => effect.type === type);
  }

  private relicEffectTotal(type: RelicEffect['type']): number {
    return this.relicEffects(type).reduce((sum, effect) => sum + (effect.amount ?? 0), 0);
  }

  private swapDeadCards(amount: number): void {
    for (let index = 0; index < amount; index += 1) {
      const swapIndex = this.hand.findIndex(
        (card) => !this.field.some((fieldCard) => matchesMonth(card, fieldCard, false)),
      );
      const targetIndex = swapIndex >= 0 ? swapIndex : 0;
      const replacement = this.deck.shift();
      const oldCard = this.hand[targetIndex];
      if (!replacement || !oldCard) return;
      this.hand[targetIndex] = replacement;
      this.deck.push(oldCard);
    }
  }

  private snatchFieldCard(kind?: CardKind, highest = false): void {
    const candidates = this.field.filter((card) => !kind || card.kind === kind);
    const target = [...candidates].sort((a, b) =>
      highest ? this.cardValue(b) - this.cardValue(a) : this.cardValue(a) - this.cardValue(b),
    )[0];
    if (!target) return;
    this.field.splice(this.field.findIndex((card) => card.id === target.id), 1);
    this.captured.push(target);
    this.applyCaptureSynergies([target]);
  }

  private applyCaptureSynergies(cards: HwatuCard[]): void {
    if (cards.length === 0) return;
    this.relicEffects('capture-kind-bonus').forEach((effect) => {
      const matches = cards.filter((card) => card.kind === effect.kind).length;
      this.bonusScore += matches * (effect.amount ?? 0);
    });
    this.relicEffects('capture-chain-bonus').forEach((effect) => {
      if (cards.length >= (effect.threshold ?? 2)) this.bonusScore += effect.amount ?? 0;
    });
    this.relicEffects('energy-on-kind').forEach((effect) => {
      if (cards.some((card) => card.kind === effect.kind)) {
        this.state.energy = Math.min(this.state.maxEnergy, this.state.energy + (effect.amount ?? 0));
      }
    });
    this.relicEffects('energy-on-chain').forEach((effect) => {
      if (cards.length >= (effect.threshold ?? 2)) {
        this.state.energy = Math.min(this.state.maxEnergy, this.state.energy + (effect.amount ?? 0));
      }
    });
    this.relicEffects('late-capture-bonus').forEach((effect) => {
      if (this.hand.length <= (effect.threshold ?? 2)) this.bonusScore += effect.amount ?? 0;
    });
  }

  private async playCard(card: HwatuCard): Promise<void> {
    if (this.busy) return;
    this.sfx.unlock();
    this.busy = true;
    this.clearMatchHints();

    const handIndex = this.hand.findIndex((item) => item.id === card.id);
    if (handIndex < 0) {
      this.busy = false;
      return;
    }
    const handSpacing = Math.min(126, 700 / Math.max(this.hand.length, 1));
    const sourceX = 800 - ((this.hand.length - 1) * handSpacing) / 2 + handIndex * handSpacing;
    this.hand.splice(handIndex, 1);
    this.renderHand();
    this.renderTactics();
    const capturedThisTurn: HwatuCard[] = [];

    this.setMessage(`${card.month}월 ${MONTH_NAMES[card.month - 1]}을 냈다.`);
    await this.animateCardStrike(card, sourceX, 754, 800, 440, true);
    capturedThisTurn.push(...this.resolveCard(card, this.state.wildMonth));
    this.renderField();
    await this.delay(180);

    const flipped = this.deck.shift();
    if (flipped) {
      this.setMessage(`산패에서 ${flipped.month}월이 뒤집혔다.`);
      this.sfx.cardFlip();
      await this.animateCardStrike(flipped, 800, 614, 800, 440, false);
      capturedThisTurn.push(...this.resolveCard(flipped, false));
    }

    if (capturedThisTurn.length > 0) {
      this.captured.push(...capturedThisTurn);
      this.applyCaptureSynergies(capturedThisTurn);
      await this.animateCaptureSweep(capturedThisTurn, 132, 478);
      this.sfx.capture();
      if (runStore.currentEncounter?.rule === 'bloom' && !this.firstCaptureAwarded) {
        this.firstCaptureAwarded = true;
        this.bonusScore += 15;
        this.showStamp('첫 꽃 +15');
      }
      if (runStore.currentEncounter?.rule === 'harvest') {
        const harvestCards = capturedThisTurn.filter((item) => item.kind === '띠' || item.kind === '열끗').length;
        if (harvestCards > 0) this.bonusScore += harvestCards * 8;
      }
      if (this.pendingCaptureBonuses.length > 0) {
        const pendingBonus = this.pendingCaptureBonuses.reduce((sum, bonus) => {
          const matches = bonus.kind ? capturedThisTurn.filter((card) => card.kind === bonus.kind).length : 1;
          return sum + bonus.amount * matches;
        }, 0);
        this.bonusScore += pendingBonus;
        if (pendingBonus > 0) this.showStamp(`연쇄 +${pendingBonus}`);
        this.pendingCaptureBonuses = [];
      }
      if (this.state.doubledTurn) {
        this.bonusScore += capturedThisTurn.reduce((sum, item) => {
          const values = { 광: 40, 열끗: 18, 띠: 12, 피: 5 };
          return sum + values[item.kind];
        }, 0);
        this.showStamp('휘몰이');
      }
      this.setMessage(`${capturedThisTurn.length}장을 쓸어왔다.`);
    } else {
      this.setMessage('맞는 달이 없다. 바닥에 패가 쌓인다.');
    }

    this.state.turn += 1;
    this.state.wildMonth = false;
    this.state.doubledTurn = false;
    this.state.energy = Math.min(
      this.state.maxEnergy,
      this.state.energy + (capturedThisTurn.length >= 4 ? 1 : 0),
    );
    this.checkNewYaku();
    this.renderAll();
    await this.delay(300);
    await this.performOpponentTurns();

    const score = this.currentScore();
    if (score >= this.effectiveTarget() && this.hand.length > 0) {
      this.showDecision();
      return;
    }
    if (this.hand.length === 0 || this.state.turn >= this.state.maxTurns) {
      this.showResult(this.playerRank() === 1);
      return;
    }

    this.busy = false;
    this.renderHand();
    this.renderTactics();
  }

  private resolveCard(card: HwatuCard, wildMonth: boolean): HwatuCard[] {
    const matching = this.field
      .map((fieldCard, index) => ({ fieldCard, index }))
      .filter(({ fieldCard }) => this.cardsMatch(card, fieldCard, wildMonth))
      .sort((a, b) => this.cardValue(b.fieldCard) - this.cardValue(a.fieldCard));
    if (matching.length === 0) {
      this.field.push(card);
      return [];
    }
    const [matched] = this.field.splice(matching[0].index, 1);
    return [card, matched];
  }

  private cardsMatch(played: HwatuCard, fieldCard: HwatuCard, wildMonth: boolean): boolean {
    if (matchesMonth(played, fieldCard, wildMonth)) return true;
    return runStore.currentEncounter?.rule === 'rain_wild' && (played.month === 12 || fieldCard.month === 12);
  }

  private async performOpponentTurns(): Promise<void> {
    for (const opponent of this.opponents) {
      if (opponent.hand.length === 0) continue;
      this.renderOpponents(opponent.id);
      await this.delay(240);
      if (this.skipOpponentTurns > 0) {
        this.skipOpponentTurns -= 1;
        this.skippedOpponentCount += 1;
        this.setMessage(`${opponent.name}이 입을 다물었다. 차례를 넘긴다.`);
        this.showStamp('차례 봉인');
        await this.delay(520);
        continue;
      }

      const cardIndex = this.chooseOpponentCard(opponent);
      const [played] = opponent.hand.splice(cardIndex, 1);
      this.setMessage(`${opponent.name}이 ${played.month}월을 내리쳤다.`);
      await this.animateCardStrike(played, opponent.seatX, 284, 800, 440, false);
      const captured = this.resolveCard(played, false);
      this.renderField();

      const flipped = this.deck.shift();
      if (flipped) {
        this.sfx.cardFlip();
        await this.animateCardStrike(flipped, 800, 614, 800, 440, false);
        captured.push(...this.resolveCard(flipped, false));
      }

      if (captured.length > 0) {
        opponent.captured.push(...captured);
        await this.animateCaptureSweep(captured, opponent.seatX, 220);
        this.sfx.capture();
        this.setMessage(`${opponent.name}이 ${captured.length}장을 가져갔다.`);
      } else {
        this.setMessage(`${opponent.name}의 패가 바닥에 남았다.`);
      }
      this.renderField();
      this.renderOpponents(opponent.id);
      this.updateHud();
      await this.delay(280);
    }
    this.renderOpponents();
  }

  private chooseOpponentCard(opponent: OpponentState): number {
    let bestIndex = 0;
    let bestValue = -Infinity;
    opponent.hand.forEach((card, index) => {
      const matching = this.field.filter((fieldCard) => fieldCard.month === card.month);
      const targetValue = matching.length > 0 ? Math.max(...matching.map((item) => this.cardValue(item))) : 0;
      let personalityBonus = 0;
      if (opponent.id === 'rain' && matching.some((item) => item.kind === '광')) personalityBonus = 45;
      if (opponent.id === 'scholar' && matching.some((item) => item.kind === '띠')) personalityBonus = 35;
      if (opponent.id === 'fox' && matching.some((item) => item.kind === '열끗')) personalityBonus = 40;
      const value = matching.length * 80 + targetValue + personalityBonus + Math.random() * 12;
      if (value > bestValue) {
        bestValue = value;
        bestIndex = index;
      }
    });
    return bestIndex;
  }

  private cardValue(card: HwatuCard): number {
    return { 광: 40, 열끗: 18, 띠: 12, 피: 5 }[card.kind];
  }

  private async animateCardStrike(
    card: HwatuCard,
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
    strong: boolean,
  ): Promise<void> {
    const flying = new CardView(this, fromX, fromY, card, strong ? 0.92 : 0.72);
    flying.disableInteractive().setDepth(65).setAngle(Phaser.Math.Between(-9, 9));
    await new Promise<void>((resolve) => {
      this.tweens.add({
        targets: flying,
        x: toX + Phaser.Math.Between(-70, 70),
        y: toY + Phaser.Math.Between(-18, 18),
        angle: Phaser.Math.Between(-4, 4),
        scaleX: strong ? 0.84 : 0.72,
        scaleY: strong ? 0.78 : 0.68,
        duration: strong ? 145 : 190,
        ease: 'Cubic.in',
        onComplete: () => {
          this.sfx.cardSlap(strong ? 1.15 : 0.72);
          this.impactAt(flying.x, flying.y, strong ? COLORS.red : COLORS.brass, strong ? 1.1 : 0.72);
          this.cameras.main.shake(strong ? 105 : 70, strong ? 0.0042 : 0.0022);
          flying.destroy();
          resolve();
        },
      });
    });
    await this.delay(strong ? 75 : 45);
  }

  private async animateCaptureSweep(cards: HwatuCard[], targetX: number, targetY: number): Promise<void> {
    const previews = cards.slice(0, 4).map((card, index) => {
      const view = new CardView(this, 760 + index * 28, 445 - index * 4, card, 0.52);
      view.disableInteractive().setDepth(66).setAngle(index * 3 - 4);
      return view;
    });
    await new Promise<void>((resolve) => {
      let finished = 0;
      previews.forEach((preview, index) => {
        this.tweens.add({
          targets: preview,
          x: targetX + index * 8,
          y: targetY,
          scaleX: 0.22,
          scaleY: 0.22,
          angle: targetX < 300 ? -18 : 18,
          alpha: 0.25,
          delay: index * 35,
          duration: 230,
          ease: 'Cubic.in',
          onComplete: () => {
            preview.destroy();
            finished += 1;
            if (finished === previews.length) resolve();
          },
        });
      });
    });
  }

  private currentScore(): number {
    let total = calculateScore(this.captured, this.state.goCount, this.state.comboMultiplier).total + this.bonusScore;
    this.relicEffects('score-per-kind').forEach((effect) => {
      total += this.captured.filter((card) => card.kind === effect.kind).length * (effect.amount ?? 0);
    });
    total += this.tacticUseCount * this.relicEffectTotal('score-per-tactic');
    total += this.state.goCount * this.relicEffectTotal('score-per-go');
    total += this.skippedOpponentCount * this.relicEffectTotal('score-per-skip');
    if (new Set(this.captured.map((card) => card.kind)).size >= 4) {
      total += this.relicEffectTotal('score-four-kinds');
    }
    if (runStore.hp === 1) {
      const lowHpMultiplier = this.relicEffectTotal('score-low-hp');
      total = Math.round(total * (1 + lowHpMultiplier));
    }
    const goMultiplier = this.relicEffectTotal('go-multiplier') + this.state.goBonus;
    if (this.state.goCount > 0 && goMultiplier > 0) {
      total = Math.round(total * (1 + goMultiplier * this.state.goCount));
    }
    return total;
  }

  private opponentScore(opponent: OpponentState): number {
    return calculateScore(opponent.captured, 0).total + (runStore.currentEncounter?.opponentBonus ?? 0);
  }

  private effectiveTarget(): number {
    if (runStore.currentEncounter?.rule !== 'red_tax') return this.state.target;
    const redRibbonIds = new Set(['1-1', '2-1', '3-1']);
    const redRibbons = this.captured.filter((card) => redRibbonIds.has(card.id)).length;
    return this.state.target + redRibbons * 15;
  }

  private checkNewYaku(): void {
    const breakdown = calculateScore(this.captured, this.state.goCount, this.state.comboMultiplier);
    const newest = breakdown.yaku.find((item) => !this.knownYaku.has(item.name));
    breakdown.yaku.forEach((item) => this.knownYaku.add(item.name));
    if (newest) {
      this.sfx.yaku();
      this.showStamp(newest.name);
    }
  }

  private showStamp(label: string): void {
    const stamp = this.add
      .text(800, 430, label, {
        fontFamily: '"Gowun Batang", serif',
        fontSize: '72px',
        color: '#d8553f',
        fontStyle: 'bold',
        stroke: '#4b130c',
        strokeThickness: 5,
        backgroundColor: '#170806cc',
        padding: { x: 28, y: 12 },
      })
      .setOrigin(0.5)
      .setDepth(80)
      .setAngle(-5)
      .setScale(1.6)
      .setAlpha(0);
    this.tweens.add({
      targets: stamp,
      scale: 1,
      alpha: 1,
      duration: 180,
      ease: 'Back.out',
      yoyo: true,
      hold: 520,
      onComplete: () => stamp.destroy(),
    });
  }

  private showDecision(): void {
    this.busy = true;
    const { width, height } = this.scale;
    const rank = this.playerRank();
    const leaderScore = Math.max(...this.opponents.map((opponent) => this.opponentScore(opponent)));
    this.modalLayer.removeAll(true);
    const shade = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.66);
    const panel = this.add.rectangle(width / 2, height / 2, 760, 420, 0x15100d, 0.99).setStrokeStyle(3, COLORS.brass);
    const title = this.add
      .text(width / 2, height / 2 - 130, '목표를 넘겼다', {
        fontFamily: '"Gowun Batang", serif',
        fontSize: '48px',
        color: '#eddbb7',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);
    const score = this.add
      .text(width / 2, height / 2 - 66, `${this.currentScore()}점`, {
        fontFamily: '"Noto Sans KR", sans-serif',
        fontSize: '28px',
        color: '#d5b25f',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);
    const prompt = this.add
      .text(
        width / 2,
        height / 2 - 18,
        rank === 1
          ? '현재 선두다. 갈무리할 것인가, 남은 판에 배수를 걸 것인가.'
          : `현재 ${rank}위 · 선두 ${leaderScore}점. 따라잡기 위해 고를 걸 수 있다.`,
        {
        fontFamily: '"Noto Sans KR", sans-serif',
        fontSize: '18px',
        color: '#b9ac94',
        },
      )
      .setOrigin(0.5);

    const stop = this.makeModalButton(650, 540, '스톱', rank === 1 ? '현재 순위를 확정한다' : `${rank}위로 판을 닫는다`, COLORS.jade);
    stop.on('pointerup', () => this.showResult(rank === 1));
    this.modalLayer.add([shade, panel, title, score, prompt, stop]);

    if (this.state.goCount < 3 && this.hand.length > 0) {
      const go = this.makeModalButton(
        950,
        540,
        '고',
        `남은 ${this.hand.length}장 · 배수 ×${(1 + (this.state.goCount + 1) * 0.55).toFixed(2)}`,
        COLORS.red,
      );
      go.on('pointerup', () => this.chooseGo());
      this.modalLayer.add(go);
    }
  }

  private chooseGo(): void {
    this.modalLayer.removeAll(true);
    this.state.goCount += 1;
    this.state.target = Math.ceil(this.currentScore() * 1.25 + 20) - this.relicEffectTotal('target-down');
    this.state.energy = Math.min(this.state.maxEnergy, this.state.energy + 1);
    this.usedTactics.clear();
    this.busy = false;
    this.sfx.stamp();
    this.showStamp(`${this.state.goCount}고`);
    this.setMessage(`${this.state.goCount}고. 새 약조가 걸렸다. 목표 ${this.effectiveTarget()}점.`);
    this.renderAll();
  }

  private showResult(won: boolean): void {
    this.busy = true;
    if (won) this.sfx.yaku();
    else this.sfx.lose();
    const { width, height } = this.scale;
    const rank = this.playerRank();
    const standings = [
      { name: '나', score: this.currentScore() },
      ...this.opponents.map((opponent) => ({
        name: opponent.name,
        score: this.opponentScore(opponent),
      })),
    ].sort((a, b) => b.score - a.score);
    this.modalLayer.removeAll(true);
    const shade = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.79);
    const panel = this.add.rectangle(width / 2, height / 2, 850, 560, 0x130f0c, 0.99).setStrokeStyle(3, won ? COLORS.brass : COLORS.red);
    const title = this.add
      .text(width / 2, 250, won ? '네 자리 판을 눌렀다' : `${rank}위로 판을 마쳤다`, {
        fontFamily: '"Gowun Batang", serif',
        fontSize: '48px',
        color: won ? '#ead7af' : '#d58a7c',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);
    const breakdown = calculateScore(this.captured, this.state.goCount, this.state.comboMultiplier);
    const details = [
      `먹은 패 ${this.captured.length}장`,
      `족보 ${breakdown.yaku.map((item) => item.name).join(' · ') || '없음'}`,
      `고 배수 ×${breakdown.multiplier}`,
      this.bonusScore > 0 ? `판술 추가 +${this.bonusScore}` : '',
      '',
      standings.map((item, index) => `${index + 1}위  ${item.name}  ${item.score}점`).join('   '),
    ]
      .filter(Boolean)
      .join('\n');
    const detailText = this.add
      .text(width / 2, 370, details, {
        fontFamily: '"Noto Sans KR", sans-serif',
        fontSize: '20px',
        color: '#bbae96',
        align: 'center',
        lineSpacing: 10,
      })
      .setOrigin(0.5);
    const final = this.add
      .text(width / 2, 488, `${this.currentScore()}점`, {
        fontFamily: '"Gowun Batang", serif',
        fontSize: '62px',
        color: won ? '#d7af56' : '#aa6b60',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);
    const proceed = this.makeModalButton(
      680,
      620,
      won ? '보상 고르기' : '길로 돌아간다',
      won
        ? '판술 또는 노리개 3택1'
        : hasRelic('broken-coin') && !runStore.shieldSpent
          ? '끊어진 엽전이 체력을 지킨다'
          : '체력 1을 잃는다',
      won ? COLORS.brass : COLORS.red,
    );
    proceed.on('pointerup', () => {
      if (won) {
        registerVictory(this.currentScore());
        this.scene.start('reward');
        return;
      }
      registerDefeat();
      this.scene.start(runStore.hp <= 0 ? 'run-end' : 'map', { failed: runStore.hp <= 0 });
    });
    const home = this.makeModalButton(920, 620, '런을 포기한다', '제목으로', COLORS.jade);
    home.on('pointerup', () => this.scene.start('title'));
    this.modalLayer.add([shade, panel, title, detailText, final, proceed, home]);
  }

  private playerRank(): number {
    const playerScore = this.currentScore();
    return 1 + this.opponents.filter(
      (opponent) => this.opponentScore(opponent) > playerScore,
    ).length;
  }

  private makeModalButton(
    x: number,
    y: number,
    title: string,
    subtitle: string,
    color: number,
  ): Phaser.GameObjects.Container {
    const container = this.add.container(x, y);
    const plate = this.add.rectangle(0, 0, 240, 90, 0x201712, 1).setStrokeStyle(3, color, 0.95);
    const titleText = this.add
      .text(0, -16, title, {
        fontFamily: '"Gowun Batang", serif',
        fontSize: '28px',
        color: '#eedcba',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);
    const subtitleText = this.add
      .text(0, 20, subtitle, {
        fontFamily: '"Noto Sans KR", sans-serif',
        fontSize: '13px',
        color: '#a99b84',
      })
      .setOrigin(0.5);
    container.add([plate, titleText, subtitleText]);
    container.setSize(240, 90).setInteractive({ useHandCursor: true });
    container.on('pointerover', () => {
      plate.setFillStyle(color, 0.42);
      container.setScale(1.03);
    });
    container.on('pointerout', () => {
      plate.setFillStyle(0x201712, 1);
      container.setScale(1);
    });
    return container;
  }

  private updateHud(): void {
    this.scoreText.setText(`${runStore.stage + 1}/${TOTAL_STAGES}판 · 현재 ${this.currentScore()}점`);
    this.targetText.setText(`목표 ${this.effectiveTarget()}점`);
    this.turnText.setText(`남은 패 ${this.hand.length}`);
    this.energyText.setText(`기력 ${this.state.energy}/${this.state.maxEnergy}`);
    this.goText.setText(`체력 ${runStore.hp}/${runStore.maxHp} · ${this.state.goCount > 0 ? `${this.state.goCount}고` : '첫 판'}`);
    this.deckText.setText(`산패 ${this.deck.length}장 · 바닥 ${this.field.length}장`);
  }

  private setMessage(message: string): void {
    this.messageText.setText(message);
    this.messageText.setAlpha(0.4);
    this.tweens.add({ targets: this.messageText, alpha: 1, duration: 160 });
  }

  private delay(duration: number): Promise<void> {
    return new Promise((resolve) => {
      this.time.delayedCall(duration, resolve);
    });
  }
}
