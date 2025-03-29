import Phaser from 'phaser';
import { SpeedScene } from './SpeedScene';

export class SpeedGame {
  private game: Phaser.Game | null = null;

  constructor(containerId: string) {
    // Game configuration
    const config: Phaser.Types.Core.GameConfig = {
      type: Phaser.AUTO,
      parent: containerId,
      width: 800,
      height: 600,
      backgroundColor: '#2d572c',
      scene: [SpeedScene],
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH
      }
    };

    // Create the game instance
    this.game = new Phaser.Game(config);
  }

  public destroy(): void {
    if (this.game) {
      this.game.destroy(true);
      this.game = null;
    }
  }
}
