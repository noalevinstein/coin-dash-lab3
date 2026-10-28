/* global Phaser, COIN_DASH, ACHIEVEMENTS, loadAchievementProgress, loadHighScore, drawBadge */
// Start menu and Trophies screen.

function drawArena(scene) {
  const c = COIN_DASH;
  scene.add.grid(c.width / 2, c.height / 2, c.width, c.height, 40, 40,
    c.colors.background, 1, 0x24334b, 0.45);
}

// A text line that also works with the mouse, highlighting on hover.
function addMenuOption(scene, y, label, onSelect) {
  const option = scene.add.text(COIN_DASH.width / 2, y, label,
    { font: '24px monospace', color: '#ffffff' }).setOrigin(0.5)
    .setInteractive({ useHandCursor: true });
  option.on('pointerover', () => option.setColor('#ffd166'));
  option.on('pointerout', () => option.setColor('#ffffff'));
  option.on('pointerdown', onSelect);
  return option;
}

class MenuScene extends Phaser.Scene {
  constructor() { super('Menu'); }

  create() {
    const c = COIN_DASH;
    const { unlocked } = loadAchievementProgress();
    const earned = ACHIEVEMENTS.filter(a => unlocked[a.id]).length;
    const play = () => this.scene.start('CoinDash');
    const trophies = () => this.scene.start('Trophies');
    drawArena(this);
    this.add.text(c.width / 2, 130, 'COIN DASH',
      { font: 'bold 64px monospace', color: '#ffd166' }).setOrigin(0.5);
    this.add.text(c.width / 2, 185, `Best: ${loadHighScore()} coins`,
      { font: '18px monospace', color: '#8ea0c0' }).setOrigin(0.5);
    addMenuOption(this, 270, '▶ Play   (Enter / Space)', play);
    addMenuOption(this, 320, `★ Trophies   (T)   ${earned}/${ACHIEVEMENTS.length}`, trophies);
    this.input.keyboard.on('keydown-ENTER', play);
    this.input.keyboard.on('keydown-SPACE', play);
    this.input.keyboard.on('keydown-T', trophies);
  }
}

class TrophiesScene extends Phaser.Scene {
  constructor() { super('Trophies'); }

  create() {
    const c = COIN_DASH;
    const { stats, unlocked } = loadAchievementProgress();
    const earned = ACHIEVEMENTS.filter(a => unlocked[a.id]).length;
    const back = () => this.scene.start('Menu');
    drawArena(this);
    this.add.text(c.width / 2, 36, `TROPHIES   ${earned}/${ACHIEVEMENTS.length}`,
      { font: 'bold 30px monospace', color: '#ffd166' }).setOrigin(0.5);
    this.add.text(c.width / 2, 74,
      `Coins: ${stats.totalCoins}   Games: ${stats.gamesPlayed}   Deaths: ${stats.deaths}   Time alive: ${Math.floor(stats.secondsSurvived)}s`,
      { font: '14px monospace', color: '#8ea0c0' }).setOrigin(0.5);
    // Shrink the rows if more achievements are added than fit at the default spacing.
    const top = 120;
    const spacing = Math.min(56, (c.height - top - 50) / ACHIEVEMENTS.length);
    ACHIEVEMENTS.forEach((achievement, i) => this.drawRow(achievement, unlocked[achievement.id], top + i * spacing));
    addMenuOption(this, c.height - 26, '◀ Back   (Esc / T)', back).setFontSize(18);
    this.input.keyboard.on('keydown-ESC', back);
    this.input.keyboard.on('keydown-T', back);
  }

  drawRow(achievement, unlockedAt, y) {
    const c = COIN_DASH;
    const left = 80;
    const right = c.width - 80;
    this.add.rectangle(c.width / 2, y, right - left, 48, 0x0a1120, unlockedAt ? 0.9 : 0.6);
    drawBadge(this, left + 28, y, Boolean(unlockedAt));
    this.add.text(left + 56, y - 10, achievement.name,
      { font: 'bold 18px monospace', color: unlockedAt ? '#ffffff' : '#8ea0c0' }).setOrigin(0, 0.5);
    this.add.text(left + 56, y + 11, achievement.description,
      { font: '13px monospace', color: '#8ea0c0' }).setOrigin(0, 0.5);
    this.add.text(right - 14, y, unlockedAt ? new Date(unlockedAt).toLocaleDateString() : 'Locked',
      { font: '14px monospace', color: unlockedAt ? '#71e8ce' : '#56688a' }).setOrigin(1, 0.5);
  }
}
