import Phaser from 'phaser';
import { createDeck, MONTH_NAMES, shuffle, TACTICS } from '../game/data';
import { calculateScore, chooseBestDeckCard, matchesMonth } from '../game/rules';
import type { HwatuCard, RunState, Tactic } from '../game/types';
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

  private handLayer!: Phaser.GameObjects.Container;
  private fieldLayer!: Phaser.GameObjects.Container;
  private capturedLayer!: Phaser.GameObjects.Container;
  private tacticLayer!: Phaser.GameObjects.Container;
  private modalLayer!: Phaser.GameObjects.Container;
  private scoreText!: Phaser.GameObjects.Text;
  private targetText!: Phaser.GameObjects.Text;
  private turnText!: Phaser.GameObjects.Text;
  private energyText!: Phaser.GameObjects.Text;
  private goText!: Phaser.GameObjects.Text;
  private messageText!: Phaser.GameObjects.Text;
  private yakuText!: Phaser.GameObjects.Text;
  private deckText!: Phaser.GameObjects.Text;
  private bossImage!: Phaser.GameObjects.Image;

  constructor() {
    super('game');
  }

  create(): void {
    this.deck = shuffle(createDeck());
    this.hand = this.deck.splice(0, 6);
    this.field = this.deck.splice(0, 6);
    this.captured = [];
    this.state = this.freshState();
    this.bonusScore = 0;
    this.busy = false;
    this.usedTactics.clear();
    this.knownYaku.clear();

    this.createRoom();
    this.createHud();
    this.handLayer = this.add.container(0, 0);
    this.fieldLayer = this.add.container(0, 0);
    this.capturedLayer = this.add.container(0, 0);
    this.tacticLayer = this.add.container(0, 0);
    this.modalLayer = this.add.container(0, 0).setDepth(100);

    this.renderAll();
    this.setMessage('손패를 골라 같은 달의 패를 먹는다.');
  }

  private freshState(): RunState {
    return {
      turn: 0,
      maxTurns: 6,
      goCount: 0,
      energy: 3,
      target: 100,
      comboMultiplier: 1,
      doubledTurn: false,
      wildMonth: false,
    };
  }

  private createRoom(): void {
    const { width, height } = this.scale;
    const room = this.add.image(width / 2, height / 2, 'room').setDisplaySize(width, height);
    room.setTint(0xb9ad9b);
    this.add.rectangle(width / 2, height / 2, width, height, 0x050403, 0.22);
    this.add.rectangle(width / 2, 505, 1100, 525, 0x140c08, 0.2).setStrokeStyle(2, 0x5a3526, 0.38);

    this.bossImage = this.add.image(width / 2, 174, 'bosses', 0).setDisplaySize(250, 250);
    this.bossImage.setCrop(80, 25, 467, 430).setAlpha(0.72);
    this.bossImage.setTint(0xb8a588);

    this.add
      .text(width / 2, 54, '봄의 판주 · 매화 선비', {
        fontFamily: '"Gowun Batang", serif',
        fontSize: '28px',
        color: '#dfcfad',
        fontStyle: 'bold',
        backgroundColor: '#0b0806cc',
        padding: { x: 22, y: 8 },
      })
      .setOrigin(0.5);
    this.add
      .text(width / 2, 94, '규칙: 붉은 띠가 모이면 판주의 목표 점수도 오른다.', {
        fontFamily: '"Noto Sans KR", sans-serif',
        fontSize: '15px',
        color: '#b4a68d',
        backgroundColor: '#0b0806b8',
        padding: { x: 12, y: 5 },
      })
      .setOrigin(0.5);

    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      const offset = Phaser.Math.Clamp((pointer.x / width - 0.5) * 12, -6, 6);
      this.bossImage.x = width / 2 + offset * 0.8;
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

  private renderAll(): void {
    this.renderHand();
    this.renderField();
    this.renderCaptured();
    this.renderTactics();
    this.updateHud();
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
    TACTICS.forEach((tactic, index) => {
      const y = 242 + index * 122;
      const used = this.usedTactics.has(tactic.id);
      const affordable = this.state.energy >= tactic.cost;
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
        .text(101, -28, `기력 ${tactic.cost}`, {
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
      child.setMatchHint(matchesMonth(card, fieldCard, this.state.wildMonth));
    });
  }

  private clearMatchHints(): void {
    this.renderField();
  }

  private useTactic(tactic: Tactic): void {
    if (this.busy || this.usedTactics.has(tactic.id) || this.state.energy < tactic.cost) return;
    this.state.energy -= tactic.cost;
    this.usedTactics.add(tactic.id);

    if (tactic.id === 'peek') {
      const best = chooseBestDeckCard(this.deck, this.field);
      const [chosen] = this.deck.splice(best, 1);
      if (chosen) this.deck.unshift(chosen);
      this.setMessage('산패 셋을 훑었다. 맞는 달을 맨 위로 올렸다.');
    } else if (tactic.id === 'moonstep') {
      this.state.wildMonth = true;
      this.setMessage('달넘기. 이번 패는 앞뒤 달과도 맞는다.');
    } else {
      this.state.doubledTurn = true;
      this.setMessage('휘몰이. 이번에 먹는 패의 값이 두 배가 된다.');
    }
    this.renderAll();
  }

  private async playCard(card: HwatuCard): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    this.clearMatchHints();
    this.renderHand();
    this.renderTactics();

    const handIndex = this.hand.findIndex((item) => item.id === card.id);
    if (handIndex < 0) return;
    this.hand.splice(handIndex, 1);
    const capturedThisTurn: HwatuCard[] = [];

    this.setMessage(`${card.month}월 ${MONTH_NAMES[card.month - 1]}을 냈다.`);
    this.cameras.main.shake(90, 0.002);
    await this.delay(260);

    const fieldMatch = this.field.findIndex((item) => matchesMonth(card, item, this.state.wildMonth));
    if (fieldMatch >= 0) {
      const [matched] = this.field.splice(fieldMatch, 1);
      capturedThisTurn.push(card, matched);
      this.setMessage(`${card.month}월 패를 맞춰 먹었다.`);
    } else {
      this.field.push(card);
      this.setMessage('맞는 달이 없다. 패를 바닥에 남겼다.');
    }
    this.renderField();
    await this.delay(330);

    const flipped = this.deck.shift();
    if (flipped) {
      this.setMessage(`산패에서 ${flipped.month}월이 뒤집혔다.`);
      await this.delay(380);
      const deckMatch = this.field.findIndex((item) => item.month === flipped.month);
      if (deckMatch >= 0) {
        const [matched] = this.field.splice(deckMatch, 1);
        capturedThisTurn.push(flipped, matched);
        this.setMessage(`뒤집은 패까지 맞았다. ${capturedThisTurn.length}장을 갈무리했다.`);
        this.cameras.main.shake(130, 0.0035);
      } else {
        this.field.push(flipped);
      }
    }

    if (capturedThisTurn.length > 0) {
      this.captured.push(...capturedThisTurn);
      if (this.state.doubledTurn) {
        this.bonusScore += capturedThisTurn.reduce((sum, item) => {
          const values = { 광: 40, 열끗: 18, 띠: 12, 피: 5 };
          return sum + values[item.kind];
        }, 0);
        this.showStamp('휘몰이');
      }
    }

    this.state.turn += 1;
    this.state.wildMonth = false;
    this.state.doubledTurn = false;
    this.state.energy = Math.min(3, this.state.energy + (capturedThisTurn.length >= 4 ? 1 : 0));
    this.checkNewYaku();
    this.renderAll();
    await this.delay(500);

    const score = this.currentScore();
    if (score >= this.effectiveTarget()) {
      this.showDecision();
      return;
    }
    if (this.hand.length === 0 || this.state.turn >= this.state.maxTurns) {
      this.showResult(false);
      return;
    }

    this.busy = false;
    this.renderHand();
    this.renderTactics();
  }

  private currentScore(): number {
    return calculateScore(this.captured, this.state.goCount, this.state.comboMultiplier).total + this.bonusScore;
  }

  private effectiveTarget(): number {
    const redRibbonIds = new Set(['1-1', '2-1', '3-1']);
    const redRibbons = this.captured.filter((card) => redRibbonIds.has(card.id)).length;
    return this.state.target + redRibbons * 15;
  }

  private checkNewYaku(): void {
    const breakdown = calculateScore(this.captured, this.state.goCount, this.state.comboMultiplier);
    const newest = breakdown.yaku.find((item) => !this.knownYaku.has(item.name));
    breakdown.yaku.forEach((item) => this.knownYaku.add(item.name));
    if (newest) this.showStamp(newest.name);
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
      .text(width / 2, height / 2 - 18, '지금 갈무리할 것인가, 석 장을 더 받을 것인가.', {
        fontFamily: '"Noto Sans KR", sans-serif',
        fontSize: '18px',
        color: '#b9ac94',
      })
      .setOrigin(0.5);

    const stop = this.makeModalButton(650, 540, '스톱', '점수를 확정한다', COLORS.jade);
    stop.on('pointerup', () => this.showResult(true));
    this.modalLayer.add([shade, panel, title, score, prompt, stop]);

    if (this.state.goCount < 3 && this.deck.length >= 3) {
      const go = this.makeModalButton(950, 540, '고', `목표 상승 · 배수 ×${(1 + (this.state.goCount + 1) * 0.55).toFixed(2)}`, COLORS.red);
      go.on('pointerup', () => this.chooseGo());
      this.modalLayer.add(go);
    }
  }

  private chooseGo(): void {
    this.modalLayer.removeAll(true);
    this.state.goCount += 1;
    this.state.target = Math.ceil((this.currentScore() + 80) * 1.2);
    this.state.maxTurns += 3;
    this.hand.push(...this.deck.splice(0, 3));
    this.state.energy = Math.min(3, this.state.energy + 1);
    this.usedTactics.clear();
    this.busy = false;
    this.showStamp(`${this.state.goCount}고`);
    this.setMessage(`${this.state.goCount}고. 새 약조가 걸렸다. 목표 ${this.effectiveTarget()}점.`);
    this.renderAll();
  }

  private showResult(won: boolean): void {
    this.busy = true;
    const { width, height } = this.scale;
    this.modalLayer.removeAll(true);
    const shade = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.79);
    const panel = this.add.rectangle(width / 2, height / 2, 850, 560, 0x130f0c, 0.99).setStrokeStyle(3, won ? COLORS.brass : COLORS.red);
    const title = this.add
      .text(width / 2, 260, won ? '판을 갈무리했다' : '계절을 되찾지 못했다', {
        fontFamily: '"Gowun Batang", serif',
        fontSize: '48px',
        color: won ? '#ead7af' : '#d58a7c',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);
    const breakdown = calculateScore(this.captured, this.state.goCount, this.state.comboMultiplier);
    const details = [
      `먹은 패 ${this.captured.length}장`,
      `기본 ${breakdown.base}점`,
      `족보 ${breakdown.yaku.map((item) => item.name).join(' · ') || '없음'}`,
      `고 배수 ×${breakdown.multiplier}`,
      this.bonusScore > 0 ? `판술 추가 +${this.bonusScore}` : '',
    ]
      .filter(Boolean)
      .join('\n');
    const detailText = this.add
      .text(width / 2, 367, details, {
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
    const retry = this.makeModalButton(680, 620, '다시 친다', '새로운 패로 시작', COLORS.red);
    retry.on('pointerup', () => this.scene.restart());
    const home = this.makeModalButton(920, 620, '방을 나선다', '제목으로', COLORS.jade);
    home.on('pointerup', () => this.scene.start('title'));
    this.modalLayer.add([shade, panel, title, detailText, final, retry, home]);
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
    this.scoreText.setText(`현재 ${this.currentScore()}점`);
    this.targetText.setText(`목표 ${this.effectiveTarget()}점`);
    this.turnText.setText(`남은 패 ${this.hand.length}`);
    this.energyText.setText(`기력 ${this.state.energy}/3`);
    this.goText.setText(this.state.goCount > 0 ? `${this.state.goCount}고` : '첫 판');
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
