import Phaser from 'phaser';
import { startNewRun } from '../game/runState';

export class TitleScene extends Phaser.Scene {
  constructor() {
    super('title');
  }

  create(): void {
    const { width, height } = this.scale;
    const room = this.add.image(width / 2, height / 2, 'room');
    room.setDisplaySize(width, height);

    this.add.rectangle(width / 2, height / 2, width, height, 0x050403, 0.44);
    this.add.rectangle(width / 2, 142, 640, 230, 0x090706, 0.72).setStrokeStyle(1, 0xb39057, 0.5);

    this.add
      .text(width / 2, 93, '꽃 패 도', {
        fontFamily: '"Gowun Batang", serif',
        fontSize: '86px',
        color: '#f0dec0',
        fontStyle: 'bold',
        stroke: '#25130f',
        strokeThickness: 8,
        shadow: { color: '#000000', blur: 12, fill: true, offsetY: 5 },
      })
      .setOrigin(0.5);
    this.add
      .text(width / 2, 173, '열 두  달 의  판', {
        fontFamily: '"Noto Sans KR", sans-serif',
        fontSize: '22px',
        color: '#b98a72',
        letterSpacing: 10,
      })
      .setOrigin(0.5);
    this.add
      .text(width / 2, 219, '패를 모으고, 계절을 되찾고, 멈출 때를 선택하라.', {
        fontFamily: '"Gowun Batang", serif',
        fontSize: '20px',
        color: '#c9bda6',
      })
      .setOrigin(0.5);

    const start = this.makeButton(width / 2, 684, '열두 달의 길을 연다', 340, 72);
    start.on('pointerup', () => {
      startNewRun();
      this.scene.start('map');
    });
    this.makeButton(width / 2, 770, '규칙', 180, 52).on('pointerup', () => this.showRules());

    this.add
      .text(width - 32, height - 28, '웹 수직 슬라이스 · v0.1', {
        fontFamily: '"Noto Sans KR", sans-serif',
        fontSize: '14px',
        color: '#887a65',
      })
      .setOrigin(1);

    this.tweens.add({
      targets: room,
      scaleX: room.scaleX * 1.018,
      scaleY: room.scaleY * 1.018,
      duration: 8000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.inOut',
    });
  }

  private makeButton(x: number, y: number, label: string, width: number, height: number): Phaser.GameObjects.Container {
    const container = this.add.container(x, y);
    const plate = this.add
      .rectangle(0, 0, width, height, 0x18120e, 0.94)
      .setStrokeStyle(2, 0xb64b37, 0.85);
    const text = this.add
      .text(0, 0, label, {
        fontFamily: '"Gowun Batang", serif',
        fontSize: `${Math.round(height * 0.35)}px`,
        color: '#f2dfbd',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);
    container.add([plate, text]);
    container.setSize(width, height).setInteractive({ useHandCursor: true });
    container.on('pointerover', () => {
      plate.setFillStyle(0x3d1b16, 0.96);
      container.setScale(1.025);
    });
    container.on('pointerout', () => {
      plate.setFillStyle(0x18120e, 0.94);
      container.setScale(1);
    });
    return container;
  }

  private showRules(): void {
    const { width, height } = this.scale;
    const shade = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.74).setInteractive();
    const panel = this.add.rectangle(width / 2, height / 2, 760, 520, 0x15110d, 0.98).setStrokeStyle(2, 0xad8a55);
    const copy = [
      '열두 달 런의 규칙',
      '',
      '1. 봄부터 겨울까지 계절마다 두 판, 총 여덟 판을 통과합니다.',
      '2. 매 계절 안전한 판과 위험한 큰판 중 하나를 고릅니다.',
      '3. 나와 세 판주가 같은 화투판에서 패와 족보를 다툽니다.',
      '4. 판이 끝나면 판술·노리개·회복 중 하나만 가져갑니다.',
      '5. 판술 사본을 늘리면 다음 판에서 뽑힐 확률이 높아집니다.',
      '6. 계절마다 원하는 판술 사본을 제거해 덱을 압축합니다.',
      '7. 목표를 넘기면 스톱으로 선두를 굳히거나 고로 배수를 겁니다.',
    ].join('\n');
    const text = this.add
      .text(width / 2, height / 2 - 20, copy, {
        fontFamily: '"Noto Sans KR", sans-serif',
        fontSize: '23px',
        color: '#e5d6bb',
        lineSpacing: 14,
        align: 'left',
      })
      .setOrigin(0.5);
    const close = this.makeButton(width / 2, height / 2 + 200, '덮는다', 180, 52);
    close.on('pointerup', () => {
      shade.destroy();
      panel.destroy();
      text.destroy();
      close.destroy();
    });
  }
}
