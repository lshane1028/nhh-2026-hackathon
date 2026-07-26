import Phaser from 'phaser';
import { TACTICS } from '../game/data';
import { applyReward, makeRewardChoices, RELICS, runIsComplete, runStore } from '../game/runState';

export class RewardScene extends Phaser.Scene {
  constructor() {
    super('reward');
  }

  create(): void {
    const { width, height } = this.scale;
    this.add.image(width / 2, height / 2, 'room').setDisplaySize(width, height).setTint(0x8c7a64);
    this.add.rectangle(width / 2, height / 2, width, height, 0x070504, 0.72);
    this.add
      .text(width / 2, 90, '판이 남긴 것', {
        fontFamily: '"Gowun Batang", serif',
        fontSize: '50px',
        color: '#eddab5',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);
    this.add
      .text(width / 2, 142, '하나만 가져간다. 선택은 이번 런이 끝날 때까지 남는다.', {
        fontFamily: '"Noto Sans KR", sans-serif',
        fontSize: '18px',
        color: '#b2a48e',
      })
      .setOrigin(0.5);

    const rewards = makeRewardChoices();
    rewards.forEach((reward, index) => {
      const x = 430 + index * 370;
      const group = this.add.container(x, 445);
      const color = reward.type === 'relic' ? 0xc39b4e : reward.type === 'heal' ? 0x9a4d45 : 0x4e8d7b;
      const plate = this.add.rectangle(0, 0, 320, 430, 0x15110e, 0.98).setStrokeStyle(3, color, 0.95);
      const type = this.add
        .text(
          0,
          -164,
          `${reward.type === 'relic' ? '노리개' : reward.type === 'tactic' ? '판술패' : '회복'}${reward.archetype ? ` · ${reward.archetype}` : ''}`,
          {
          fontFamily: '"Noto Sans KR", sans-serif',
          fontSize: '15px',
          color: Phaser.Display.Color.IntegerToColor(color).rgba,
          letterSpacing: 5,
          },
        )
        .setOrigin(0.5);
      const name = this.add
        .text(0, -92, reward.name, {
          fontFamily: '"Gowun Batang", serif',
          fontSize: '30px',
          color: '#ecd9b6',
          fontStyle: 'bold',
        })
        .setOrigin(0.5);
      const mark = this.add
        .text(0, -24, reward.type === 'relic' ? '◆' : reward.type === 'tactic' ? '札' : '杯', {
          fontFamily: '"Gowun Batang", serif',
          fontSize: '52px',
          color: Phaser.Display.Color.IntegerToColor(color).rgba,
        })
        .setOrigin(0.5);
      const description = this.add
        .text(0, 66, reward.description, {
          fontFamily: '"Noto Sans KR", sans-serif',
          fontSize: '17px',
          color: '#b9ac96',
          align: 'center',
          wordWrap: { width: 250 },
          lineSpacing: 6,
        })
        .setOrigin(0.5);
      const detail = this.add
        .text(0, 158, reward.detail, {
          fontFamily: '"Noto Sans KR", sans-serif',
          fontSize: '14px',
          color: '#8f826f',
        })
        .setOrigin(0.5);
      group.add([plate, type, name, mark, description, detail]);
      group.setSize(320, 430).setInteractive({ useHandCursor: true });
      group.on('pointerover', () => {
        group.setScale(1.035);
        plate.setFillStyle(0x2a2118, 1);
      });
      group.on('pointerout', () => {
        group.setScale(1);
        plate.setFillStyle(0x15110e, 0.98);
      });
      group.on('pointerup', () => {
        applyReward(reward);
        this.scene.start(runIsComplete() ? 'run-end' : 'map');
      });
    });

    this.add
      .text(width / 2, 720, `체력 ${runStore.hp}/${runStore.maxHp} · 명성 ${runStore.fame} · 판술덱 ${runStore.tacticDeck.length}장`, {
        fontFamily: '"Noto Sans KR", sans-serif',
        fontSize: '16px',
        color: '#958976',
      })
      .setOrigin(0.5);
    this.add
      .text(width / 2, 756, `전체 풀: 판술 ${TACTICS.length}종 · 노리개 ${RELICS.length}종 · 보상은 현재 빌드와 맞는 계열이 더 자주 등장`, {
        fontFamily: '"Noto Sans KR", sans-serif',
        fontSize: '14px',
        color: '#756c5e',
      })
      .setOrigin(0.5);
  }
}
