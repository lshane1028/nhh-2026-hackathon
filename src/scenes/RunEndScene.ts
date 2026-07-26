import Phaser from 'phaser';
import { RELICS, runStore, startNewRun } from '../game/runState';

export class RunEndScene extends Phaser.Scene {
  constructor() {
    super('run-end');
  }

  create(data: { failed?: boolean }): void {
    const { width, height } = this.scale;
    const failed = data.failed === true;
    this.add.image(width / 2, height / 2, 'room').setDisplaySize(width, height);
    this.add.rectangle(width / 2, height / 2, width, height, 0x050403, 0.66);
    this.add.rectangle(width / 2, height / 2, 820, 610, 0x110d0a, 0.98).setStrokeStyle(3, 0xb18a4e);
    this.add
      .text(width / 2, 230, failed ? '달문이 닫혔다' : '열두 달을 되찾았다', {
        fontFamily: '"Gowun Batang", serif',
        fontSize: '54px',
        color: failed ? '#d68c7c' : '#edd9b3',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);
    const relicNames = runStore.relics
      .map((id) => RELICS.find((relic) => relic.id === id)?.name)
      .filter(Boolean)
      .join(' · ');
    this.add
      .text(
        width / 2,
        390,
        [
          failed ? '이번 길은 여기서 끝났다.' : '네 계절의 판주를 모두 눌렀다.',
          `명성 ${runStore.fame}`,
          `통과한 판 ${runStore.clearedEncounters.length}/4`,
          `남은 체력 ${runStore.hp}/${runStore.maxHp}`,
          `완성한 판술덱 ${runStore.tacticDeck.length}장`,
          `노리개 ${relicNames || '없음'}`,
        ].join('\n'),
        {
          fontFamily: '"Noto Sans KR", sans-serif',
          fontSize: '23px',
          color: '#bcae97',
          align: 'center',
          lineSpacing: 14,
          wordWrap: { width: 680 },
        },
      )
      .setOrigin(0.5);
    const again = this.makeButton(width / 2, 620, '새 런을 시작한다');
    again.on('pointerup', () => {
      startNewRun();
      this.scene.start('map');
    });
    const home = this.add
      .text(width / 2, 700, '방을 나선다', {
        fontFamily: '"Noto Sans KR", sans-serif',
        fontSize: '16px',
        color: '#877b69',
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    home.on('pointerup', () => this.scene.start('title'));
  }

  private makeButton(x: number, y: number, label: string): Phaser.GameObjects.Container {
    const group = this.add.container(x, y);
    const plate = this.add.rectangle(0, 0, 300, 70, 0x241510, 1).setStrokeStyle(2, 0xb64936);
    const text = this.add
      .text(0, 0, label, {
        fontFamily: '"Gowun Batang", serif',
        fontSize: '23px',
        color: '#eddbb9',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);
    group.add([plate, text]);
    group.setSize(300, 70).setInteractive({ useHandCursor: true });
    group.on('pointerover', () => group.setScale(1.03));
    group.on('pointerout', () => group.setScale(1));
    return group;
  }
}
