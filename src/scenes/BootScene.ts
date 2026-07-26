import Phaser from 'phaser';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('boot');
  }

  preload(): void {
    const width = this.scale.width;
    const height = this.scale.height;
    const barX = width / 2 - 220;
    const barY = height / 2 + 60;

    this.cameras.main.setBackgroundColor('#0c0907');
    this.add
      .text(width / 2, height / 2 - 54, '꽃패도', {
        fontFamily: '"Gowun Batang", serif',
        fontSize: '64px',
        color: '#ead9b1',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);
    this.add
      .text(width / 2, height / 2 + 8, '열두 달의 판을 여는 중', {
        fontFamily: '"Noto Sans KR", sans-serif',
        fontSize: '18px',
        color: '#9f8e70',
        letterSpacing: 5,
      })
      .setOrigin(0.5);

    const rail = this.add.rectangle(barX, barY, 440, 4, 0x493c2b).setOrigin(0, 0.5);
    const fill = this.add.rectangle(barX, barY, 0, 4, 0xb64936).setOrigin(0, 0.5);
    this.load.on('progress', (value: number) => {
      fill.width = 440 * value;
    });
    this.load.once('complete', () => {
      rail.destroy();
      fill.destroy();
    });

    this.load.image('room', 'assets/art/midnight-card-room.png');
    this.load.spritesheet('months', 'assets/art/month-art-atlas.png', {
      frameWidth: 362,
      frameHeight: 362,
    });
    this.load.spritesheet('bosses', 'assets/art/boss-atlas.png', {
      frameWidth: 627,
      frameHeight: 627,
    });
  }

  create(): void {
    this.scene.start('title');
  }
}
