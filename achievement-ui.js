/* global Phaser, COIN_DASH */
// Shared achievement visuals: the round badge and the in-game "unlocked" popups.

// A gold star when earned, a dim question mark while still locked.
function drawBadge(scene, x, y, unlocked, radius = 16) {
  const c = COIN_DASH;
  return scene.add.container(x, y, [
    scene.add.circle(0, 0, radius, unlocked ? c.colors.coin : 0x3a4a66)
      .setStrokeStyle(2, unlocked ? 0xffffff : 0x56688a),
    scene.add.text(0, 0, unlocked ? '★' : '?', {
      font: `bold ${Math.round(radius * 1.1)}px monospace`,
      color: unlocked ? '#101c31' : '#8ea0c0'
    }).setOrigin(0.5)
  ]);
}

// Shows one popup at a time in the top-right corner; extra unlocks wait their turn.
class AchievementToasts {
  constructor(scene) {
    this.scene = scene;
    this.queue = [];
    this.showing = false;
  }

  show(achievement) {
    this.queue.push(achievement);
    if (!this.showing) this.next();
  }

  next() {
    const achievement = this.queue.shift();
    if (!achievement) {
      this.showing = false;
      return;
    }
    this.showing = true;
    const scene = this.scene;
    const width = 270;
    const height = 56;
    const restX = COIN_DASH.width - width - 12;
    const bg = scene.add.graphics();
    bg.fillStyle(0x0a1120, 0.95).fillRoundedRect(0, 0, width, height, 10);
    bg.lineStyle(2, COIN_DASH.colors.coin, 1).strokeRoundedRect(0, 0, width, height, 10);
    const toast = scene.add.container(COIN_DASH.width + 10, 52, [
      bg,
      drawBadge(scene, 30, height / 2, true),
      scene.add.text(56, 10, 'Achievement unlocked', { font: '13px monospace', color: '#8ea0c0' }),
      scene.add.text(56, 27, achievement.name, { font: 'bold 18px monospace', color: '#ffffff' })
    ]).setDepth(20);
    scene.tweens.chain({
      tweens: [
        { targets: toast, x: restX, duration: 250, ease: 'Back.easeOut' },
        { targets: toast, alpha: 0, delay: 2200, duration: 300 }
      ],
      onComplete: () => {
        toast.destroy();
        this.next();
      }
    });
  }
}
