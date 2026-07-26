import Phaser from 'phaser';
import {
  buildAffinities,
  currentSeason,
  encounterChoices,
  RELICS,
  runStore,
  selectEncounter,
  TOTAL_STAGES,
} from '../game/runState';
import { TACTIC_BY_ID } from '../game/data';

export class MapScene extends Phaser.Scene {
  constructor() {
    super('map');
  }

  create(): void {
    const { width, height } = this.scale;
    this.add.image(width / 2, height / 2, 'room').setDisplaySize(width, height).setTint(0x746f63);
    this.add.rectangle(width / 2, height / 2, width, height, 0x070605, 0.68);

    const season = currentSeason();
    this.add
      .text(width / 2, 70, `${season} · ${runStore.stage + 1}/${TOTAL_STAGES}번째 달문`, {
        fontFamily: '"Gowun Batang", serif',
        fontSize: '46px',
        color: '#ecdbb9',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);
    this.add
      .text(width / 2, 122, '어느 판에 앉을지 고른다. 위험한 판일수록 노리개가 자주 나온다.', {
        fontFamily: '"Noto Sans KR", sans-serif',
        fontSize: '17px',
        color: '#ad9f88',
      })
      .setOrigin(0.5);

    this.drawRunHud();
    const deckButton = this.add
      .text(width - 55, 55, `판술덱 보기 · 정리 ${runStore.purgeTokens}회`, {
        fontFamily: '"Noto Sans KR", sans-serif',
        fontSize: '15px',
        color: '#d2b978',
        backgroundColor: '#17100ddd',
        padding: { x: 16, y: 10 },
      })
      .setOrigin(1, 0)
      .setInteractive({ useHandCursor: true });
    deckButton.on('pointerup', () => this.scene.start('deck'));
    const choices = encounterChoices();
    const gap = choices.length === 1 ? 0 : 410;
    const startX = width / 2 - ((choices.length - 1) * gap) / 2;
    choices.forEach((encounter, index) => {
      const x = startX + index * gap;
      const group = this.add.container(x, 440);
      const risky = encounter.rewardLevel === 2;
      const plate = this.add
        .rectangle(0, 0, 350, 420, 0x15110e, 0.98)
        .setStrokeStyle(3, risky ? 0xb74a35 : 0x4f8878, 0.95);
      const seasonText = this.add
        .text(0, -164, encounter.season, {
          fontFamily: '"Noto Sans KR", sans-serif',
          fontSize: '15px',
          color: risky ? '#dc7967' : '#79ae9f',
          letterSpacing: 5,
        })
        .setOrigin(0.5);
      const name = this.add
        .text(0, -112, encounter.name, {
          fontFamily: '"Gowun Batang", serif',
          fontSize: '28px',
          color: '#eddbb8',
          fontStyle: 'bold',
        })
        .setOrigin(0.5);
      const rule = this.add
        .text(0, -50, encounter.ruleName, {
          fontFamily: '"Gowun Batang", serif',
          fontSize: '22px',
          color: '#d1ad60',
          backgroundColor: '#2a1b13',
          padding: { x: 14, y: 7 },
        })
        .setOrigin(0.5);
      const description = this.add
        .text(0, 18, encounter.description, {
          fontFamily: '"Noto Sans KR", sans-serif',
          fontSize: '16px',
          color: '#b9ac96',
          align: 'center',
          wordWrap: { width: 280 },
          lineSpacing: 6,
        })
        .setOrigin(0.5);
      const numbers = this.add
        .text(0, 104, `목표 +${encounter.targetBonus} · 판주 +${encounter.opponentBonus}`, {
          fontFamily: '"Noto Sans KR", sans-serif',
          fontSize: '15px',
          color: '#a89a83',
        })
        .setOrigin(0.5);
      const reward = this.add
        .text(0, 156, risky ? '희귀 노리개 확률 상승' : '안정적인 판술 보상', {
          fontFamily: '"Noto Sans KR", sans-serif',
          fontSize: '16px',
          color: risky ? '#dc7967' : '#79ae9f',
          fontStyle: 'bold',
        })
        .setOrigin(0.5);
      group.add([plate, seasonText, name, rule, description, numbers, reward]);
      group.setSize(350, 420).setInteractive({ useHandCursor: true });
      group.on('pointerover', () => {
        group.setScale(1.025);
        plate.setFillStyle(risky ? 0x2d1511 : 0x14241f, 1);
      });
      group.on('pointerout', () => {
        group.setScale(1);
        plate.setFillStyle(0x15110e, 0.98);
      });
      group.on('pointerup', () => {
        selectEncounter(encounter);
        this.scene.start('game');
      });
    });

    const abandon = this.add
      .text(48, height - 36, '런 포기', {
        fontFamily: '"Noto Sans KR", sans-serif',
        fontSize: '15px',
        color: '#766c5d',
      })
      .setOrigin(0, 1)
      .setInteractive({ useHandCursor: true });
    abandon.on('pointerup', () => this.scene.start('title'));
  }

  private drawRunHud(): void {
    const relicNames = runStore.relics
      .map((id) => RELICS.find((relic) => relic.id === id)?.name)
      .filter(Boolean)
      .join(' · ');
    const tacticCounts = new Map<string, number>();
    runStore.tacticDeck.forEach((id) => tacticCounts.set(id, (tacticCounts.get(id) ?? 0) + 1));
    const tacticNames = [...tacticCounts.entries()]
      .map(([id, count]) => `${TACTIC_BY_ID.get(id)?.name ?? id}${count > 1 ? `×${count}` : ''}`)
      .join(' · ');
    const builds = [...buildAffinities().entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([build, score]) => `${build} ${score}`)
      .join(' · ');

    this.add.rectangle(800, 805, 1420, 116, 0x0d0a08, 0.94).setStrokeStyle(1, 0x796143, 0.7);
    this.add
      .text(120, 775, `체력 ${'●'.repeat(runStore.hp)}${'○'.repeat(runStore.maxHp - runStore.hp)}   명성 ${runStore.fame}   빌드 ${builds || '미정'}`, {
        fontFamily: '"Noto Sans KR", sans-serif',
        fontSize: '19px',
        color: '#decba7',
        fontStyle: 'bold',
      });
    this.add
      .text(120, 812, `판술덱 ${runStore.tacticDeck.length}장  ${tacticNames}`, {
        fontFamily: '"Noto Sans KR", sans-serif',
        fontSize: '14px',
        color: '#9fbdb4',
        wordWrap: { width: 1320 },
      });
    this.add
      .text(120, 844, `노리개 ${runStore.relics.length}개  ${relicNames || '아직 없다'}`, {
        fontFamily: '"Noto Sans KR", sans-serif',
        fontSize: '14px',
        color: '#b9a278',
      });
  }
}
