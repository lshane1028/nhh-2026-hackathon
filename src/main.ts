import Phaser from 'phaser';
import './style.css';
import { BootScene } from './scenes/BootScene';
import { TitleScene } from './scenes/TitleScene';
import { GameScene } from './scenes/GameScene';
import { MapScene } from './scenes/MapScene';
import { RewardScene } from './scenes/RewardScene';
import { RunEndScene } from './scenes/RunEndScene';
import { DeckScene } from './scenes/DeckScene';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game',
  width: 1600,
  height: 900,
  backgroundColor: '#100c0a',
  render: {
    antialias: true,
    pixelArt: false,
    roundPixels: true,
    powerPreference: 'high-performance',
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  input: {
    activePointers: 3,
  },
    scene: [BootScene, TitleScene, MapScene, DeckScene, GameScene, RewardScene, RunEndScene],
};

new Phaser.Game(config);
