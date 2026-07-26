import Phaser from 'phaser';
import { TACTIC_BY_ID } from '../game/data';
import { purgeTactic, runStore } from '../game/runState';

export class DeckScene extends Phaser.Scene {
  constructor() {
    super('deck');
  }

  create(): void {
    const { width, height } = this.scale;
    this.add.image(width / 2, height / 2, 'room').setDisplaySize(width, height).setTint(0x756b5d);
    this.add.rectangle(width / 2, height / 2, width, height, 0x070504, 0.78);

    this.add
      .text(width / 2, 58, '판술덱 정리', {
        fontFamily: '"Gowun Batang", serif',
        fontSize: '46px',
        color: '#ecd9b6',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);
    this.add
      .text(
        width / 2,
        108,
        runStore.purgeTokens > 0
          ? `정리 기회 ${runStore.purgeTokens}회 · 뺄 전술 한 장을 고르세요. 덱은 최소 4장을 유지합니다.`
          : '정리 기회가 없습니다. 계절을 통과하면 한 번씩 추가됩니다.',
        {
          fontFamily: '"Noto Sans KR", sans-serif',
          fontSize: '17px',
          color: '#b7aa94',
        },
      )
      .setOrigin(0.5);

    const columns = 5;
    const cardWidth = 252;
    const cardHeight = 200;
    const gapX = 276;
    const gapY = 224;
    const startX = width / 2 - ((columns - 1) * gapX) / 2;
    const startY = 250;

    runStore.tacticDeck.forEach((id, deckIndex) => {
      const tactic = TACTIC_BY_ID.get(id);
      if (!tactic) return;
      const column = deckIndex % columns;
      const row = Math.floor(deckIndex / columns);
      const group = this.add.container(startX + column * gapX, startY + row * gapY);
      const rarityColor =
        tactic.rarity === '전설' ? 0xd9a441 : tactic.rarity === '희귀' ? 0x5e9b8c : 0x796e5e;
      const plate = this.add
        .rectangle(0, 0, cardWidth, cardHeight, 0x17120f, 0.98)
        .setStrokeStyle(2, rarityColor, 0.95);
      const build = this.add
        .text(0, -72, `${tactic.archetype} · ${tactic.rarity}`, {
          fontFamily: '"Noto Sans KR", sans-serif',
          fontSize: '13px',
          color: Phaser.Display.Color.IntegerToColor(rarityColor).rgba,
        })
        .setOrigin(0.5);
      const name = this.add
        .text(0, -34, tactic.name, {
          fontFamily: '"Gowun Batang", serif',
          fontSize: '23px',
          color: '#ecdbb9',
          fontStyle: 'bold',
        })
        .setOrigin(0.5);
      const description = this.add
        .text(0, 20, tactic.description, {
          fontFamily: '"Noto Sans KR", sans-serif',
          fontSize: '13px',
          color: '#aaa08d',
          align: 'center',
          wordWrap: { width: 216 },
        })
        .setOrigin(0.5);
      const cost = this.add
        .text(0, 76, `기력 ${tactic.cost} · ${(tactic.tags ?? []).join(' / ')}`, {
          fontFamily: '"Noto Sans KR", sans-serif',
          fontSize: '12px',
          color: '#827767',
        })
        .setOrigin(0.5);
      group.add([plate, build, name, description, cost]);
      group.setSize(cardWidth, cardHeight);
      if (runStore.purgeTokens > 0 && runStore.tacticDeck.length > 4) {
        group.setInteractive({ useHandCursor: true });
        group.on('pointerover', () => plate.setFillStyle(0x351813, 1));
        group.on('pointerout', () => plate.setFillStyle(0x17120f, 0.98));
        group.on('pointerup', () => {
          if (purgeTactic(deckIndex)) this.scene.restart();
        });
      }
    });

    const back = this.add
      .text(width / 2, height - 42, '달문으로 돌아가기', {
        fontFamily: '"Noto Sans KR", sans-serif',
        fontSize: '18px',
        color: '#d2b978',
        backgroundColor: '#18110ddd',
        padding: { x: 24, y: 12 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    back.on('pointerup', () => this.scene.start('map'));
  }
}
