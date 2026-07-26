import Phaser from 'phaser';

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

    const start = this.makeButton(width / 2, 684, '네 자리 판을 연다', 320, 72);
    start.on('pointerup', () => this.scene.start('game'));
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
      '한 판의 규칙',
      '',
      '1. 나와 세 판주가 다섯 장씩 들고 차례로 패를 냅니다.',
      '2. 같은 달의 바닥패를 먹고 산패 한 장을 뒤집습니다.',
      '3. 판주들도 실제로 패와 족보를 가져가며 점수를 올립니다.',
      '4. 판술은 나만 사용할 수 있는 로그라이트 기술입니다.',
      '5. 목표를 넘기면 스톱으로 선두를 굳히거나 고로 배수를 겁니다.',
      '',
      '일반 고스톱과 달리 판주마다 노리는 패가 다릅니다.',
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
