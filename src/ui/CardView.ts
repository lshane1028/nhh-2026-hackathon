import Phaser from 'phaser';
import { MONTH_NAMES } from '../game/data';
import type { HwatuCard } from '../game/types';

const KIND_COLOR: Record<HwatuCard['kind'], string> = {
  광: '#e2b95f',
  열끗: '#c85f3e',
  띠: '#4f988a',
  피: '#9c8a70',
};

export class CardView extends Phaser.GameObjects.Container {
  readonly card: HwatuCard;
  private readonly border: Phaser.GameObjects.Rectangle;
  private enabled = true;

  constructor(scene: Phaser.Scene, x: number, y: number, card: HwatuCard, scale = 1) {
    super(scene, x, y);
    this.card = card;
    scene.add.existing(this);

    const shadow = scene.add.rectangle(5, 7, 100, 144, 0x000000, 0.42).setOrigin(0.5);
    this.border = scene.add.rectangle(0, 0, 100, 144, 0xf1e4c7, 1).setStrokeStyle(3, 0x24170f);
    const artwork = scene.add.image(0, -11, 'months', card.month - 1).setDisplaySize(88, 112);
    const bottom = scene.add.rectangle(0, 55, 92, 25, 0x17120f, 0.96);
    const month = scene.add
      .text(-39, 54, `${card.month}월`, {
        fontFamily: '"Noto Sans KR", sans-serif',
        fontSize: '14px',
        color: '#f4e7cd',
        fontStyle: 'bold',
      })
      .setOrigin(0, 0.5);
    const kind = scene.add
      .text(38, 54, card.kind, {
        fontFamily: '"Noto Sans KR", sans-serif',
        fontSize: '14px',
        color: KIND_COLOR[card.kind],
        fontStyle: 'bold',
      })
      .setOrigin(1, 0.5);
    const name = scene.add
      .text(0, -57, MONTH_NAMES[card.month - 1], {
        fontFamily: '"Gowun Batang", serif',
        fontSize: '13px',
        color: '#1b130e',
        backgroundColor: '#f1e4c7cc',
        padding: { x: 4, y: 1 },
      })
      .setOrigin(0.5);

    this.add([shadow, this.border, artwork, bottom, month, kind, name]);
    this.setSize(106, 150).setScale(scale);
    this.setInteractive({ useHandCursor: true });
    this.on('pointerover', () => {
      if (!this.enabled) return;
      scene.tweens.add({ targets: this, y: this.y - 12, scaleX: scale * 1.05, scaleY: scale * 1.05, duration: 110 });
    });
    this.on('pointerout', () => {
      if (!this.enabled) return;
      scene.tweens.add({ targets: this, y: this.y + (this.scaleY > scale ? 12 : 0), scaleX: scale, scaleY: scale, duration: 110 });
    });
  }

  setPlayable(playable: boolean): this {
    this.enabled = playable;
    this.disableInteractive();
    if (playable) this.setInteractive({ useHandCursor: true });
    this.setAlpha(playable ? 1 : 0.68);
    return this;
  }

  setMatchHint(active: boolean): this {
    this.border.setStrokeStyle(active ? 5 : 3, active ? 0xc74f3b : 0x24170f);
    if (active) {
      this.scene.tweens.add({
        targets: this.border,
        alpha: { from: 0.58, to: 1 },
        duration: 520,
        yoyo: true,
        repeat: -1,
      });
    }
    return this;
  }
}

