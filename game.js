/* global Phaser, COIN_DASH, AchievementTracker, AchievementToasts, MenuScene, TrophiesScene */
const HIGH_SCORE_KEY = 'coinDash.highScore';

// localStorage can be unavailable (private mode, blocked storage), so fall back to 0.
function loadHighScore() {
  try {
    return Math.max(0, parseInt(localStorage.getItem(HIGH_SCORE_KEY), 10) || 0);
  } catch (e) {
    return 0;
  }
}

function saveHighScore(score) {
  try {
    localStorage.setItem(HIGH_SCORE_KEY, String(score));
  } catch (e) { /* ignore: the high score just won't persist */ }
}

class CoinDash extends Phaser.Scene {
  constructor() { super('CoinDash'); }

  create() {
    const c = COIN_DASH;
    this.score = 0;
    this.level = 1;
    this.highScore = loadHighScore();
    this.finished = false;
    this.paused = false;
    // The clock and tweens stay paused across a restart, so undo a pause from the last round.
    this.time.paused = false;
    this.tweens.resumeAll();
    this.invincibleUntil = 0;
    this.lastTrailAt = 0;
    this.toasts = new AchievementToasts(this);
    this.achievements = new AchievementTracker(achievement => {
      this.playNotes(COIN_DASH.sound.achievementNotes);
      this.toasts.show(achievement);
    });
    this.deadline = this.time.now + c.roundSeconds * 1000;
    this.physics.world.setBounds(0, 44, c.width, c.height - 44);
    this.add.grid(c.width / 2, c.height / 2, c.width, c.height, 40, 40,
      c.colors.background, 1, 0x24334b, 0.45).setDepth(-2);
    this.hud = this.add.text(18, 12, '', { font: '18px monospace', color: '#ffffff' });
    this.player = this.add.rectangle(c.width / 2, c.height / 2, 24, 24, c.colors.player);
    this.physics.add.existing(this.player);
    this.player.body.setCollideWorldBounds(true);
    this.coin = this.add.circle(100, 100, 9, c.colors.coin);
    this.physics.add.existing(this.coin);
    this.coin.body.setCircle(9);
    this.placeCoin();
    this.powerUp = this.add.circle(0, 0, 11, c.colors.powerUp).setStrokeStyle(2, 0xffffff);
    this.physics.add.existing(this.powerUp);
    this.powerUp.body.setCircle(11);
    this.hidePowerUp();
    this.time.addEvent({
      delay: c.powerUp.everySeconds * 1000, loop: true, callback: () => this.spawnPowerUp()
    });
    this.drones = this.physics.add.group();
    for (let i = 0; i < c.droneCount; i++) {
      const drone = this.add.rectangle(90 + i * 270, 100, 26, 26, c.colors.drone);
      this.drones.add(drone);
      drone.body.setCollideWorldBounds(true).setBounce(1, 1);
      const angle = (35 + i * 105) * Math.PI / 180;
      drone.body.setVelocity(Math.cos(angle) * c.droneSpeed, Math.sin(angle) * c.droneSpeed);
    }
    // Hunter drones are slower but steer toward the player every frame.
    // They start in the bottom corners, away from the player's spawn point.
    this.hunters = this.physics.add.group();
    for (let i = 0; i < c.hunterCount; i++) {
      const x = i % 2 === 0 ? c.width - 60 : 60;
      const hunter = this.add.rectangle(x, c.height - 60, 22, 22, c.colors.hunter);
      this.hunters.add(hunter);
      hunter.body.setCollideWorldBounds(true);
    }
    this.physics.add.overlap(this.player, this.coin, () => {
      if (this.finished) return;
      this.score++;
      this.achievements.add('totalCoins');
      this.playCoinSound();
      if (this.score % c.coinsPerLevel === 0) this.levelUp();
      this.placeCoin();
    });
    this.physics.add.overlap(this.player, this.powerUp, () => {
      if (this.finished) return;
      this.hidePowerUp();
      this.achievements.add('powerUps');
      this.playCoinSound();
      this.becomeInvincible();
    });
    this.physics.add.overlap(this.player, this.drones, () => {
      if (!this.isInvincible()) this.finish('A drone caught you!', true);
    });
    this.physics.add.overlap(this.player, this.hunters, () => {
      if (!this.isInvincible()) this.finish('A hunter drone caught you!', true);
    });
    this.cursors = this.input.keyboard.createCursorKeys();
    this.keys = this.input.keyboard.addKeys('W,A,S,D,R,P');
    this.input.keyboard.on('keydown-R', () => this.scene.restart());
    this.input.keyboard.on('keydown-P', () => this.togglePause());
    this.input.keyboard.on('keydown-M', () => this.goToMenu());
    this.pauseOverlay = this.add.container(c.width / 2, c.height / 2, [
      this.add.rectangle(0, 0, 460, 120, 0x0a1120, 0.95),
      this.add.text(0, 0, 'Paused\nP: resume   M: menu',
        { font: '24px monospace', color: '#ffffff', align: 'center', lineSpacing: 12 }).setOrigin(0.5)
    ]).setDepth(10).setVisible(false);
  }

  togglePause() {
    if (this.finished) return;
    this.paused = !this.paused;
    if (this.paused) {
      // Freeze the countdown and shield by remembering how much time was left.
      this.remainingMs = this.deadline - this.time.now;
      this.shieldRemainingMs = this.invincibleUntil - this.time.now;
      this.physics.pause();
      this.tweens.pauseAll();
    } else {
      this.deadline = this.time.now + this.remainingMs;
      this.invincibleUntil = this.time.now + this.shieldRemainingMs;
      this.physics.resume();
      this.tweens.resumeAll();
    }
    // Stops power-up spawn/expiry timers; time.now itself keeps advancing.
    this.time.paused = this.paused;
    this.pauseOverlay.setVisible(this.paused);
  }

  // Only from the pause or game-over screen, so a stray key press can't end a round.
  goToMenu() {
    if (!this.finished && !this.paused) return;
    this.achievements.save();
    this.scene.start('Menu');
  }

  levelUp() {
    const c = COIN_DASH;
    this.level++;
    this.achievements.raise('bestLevel', this.level);
    // Keep each drone's direction, just make it a little faster.
    const speed = c.droneSpeed + (this.level - 1) * c.droneSpeedUpPerLevel;
    this.drones.getChildren().forEach(drone => {
      const v = drone.body.velocity.clone().normalize().scale(speed);
      drone.body.setVelocity(v.x, v.y);
    });
  }

  randomSpot() {
    const c = COIN_DASH;
    // Avoid spawning directly underneath the player.
    let x, y;
    do {
      x = Phaser.Math.Between(25, c.width - 25);
      y = Phaser.Math.Between(70, c.height - 25);
    } while (Phaser.Math.Distance.Between(x, y, this.player.x, this.player.y) < 60);
    return { x, y };
  }

  placeCoin() {
    const { x, y } = this.randomSpot();
    this.coin.setPosition(x, y);
    this.coin.body.reset(x, y);
  }

  spawnPowerUp() {
    if (this.finished) return;
    const { x, y } = this.randomSpot();
    this.powerUp.setPosition(x, y).setVisible(true);
    this.powerUp.body.reset(x, y);
    this.powerUp.body.enable = true;
    if (this.powerUpExpiry) this.powerUpExpiry.remove();
    this.powerUpExpiry = this.time.delayedCall(
      COIN_DASH.powerUp.lifeSeconds * 1000, () => this.hidePowerUp());
  }

  hidePowerUp() {
    this.powerUp.setVisible(false);
    this.powerUp.body.enable = false;
  }

  isInvincible() {
    return this.time.now < this.invincibleUntil;
  }

  becomeInvincible() {
    const ms = COIN_DASH.powerUp.invincibleSeconds * 1000;
    this.invincibleUntil = this.time.now + ms;
    // Blink the player while drones can't hurt them; picking up another extends it.
    if (this.blink) this.blink.stop();
    if (this.invincibleEnd) this.invincibleEnd.remove();
    this.blink = this.tweens.add({
      targets: this.player, alpha: 0.25, duration: 120, yoyo: true, repeat: -1
    });
    this.invincibleEnd = this.time.delayedCall(ms, () => {
      this.blink.stop();
      this.player.setAlpha(1);
    });
  }

  playCoinSound() {
    this.playNotes(COIN_DASH.sound.coinNotes);
  }

  playNotes(notes) {
    // Synthesize short chimes so no audio assets are needed.
    const ctx = this.sound.context;
    if (!ctx || COIN_DASH.sound.volume <= 0) return;
    const now = ctx.currentTime;
    notes.forEach((freq, i) => {
      const start = now + i * 0.07;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(COIN_DASH.sound.volume, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.12);
      osc.connect(gain).connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.12);
    });
  }

  update(time, delta) {
    if (this.finished || this.paused) return;
    this.achievements.tick(delta);
    const dx = Number(this.cursors.right.isDown || this.keys.D.isDown)
      - Number(this.cursors.left.isDown || this.keys.A.isDown);
    const dy = Number(this.cursors.down.isDown || this.keys.S.isDown)
      - Number(this.cursors.up.isDown || this.keys.W.isDown);
    const direction = new Phaser.Math.Vector2(dx, dy).normalize().scale(COIN_DASH.playerSpeed);
    this.player.body.setVelocity(direction.x, direction.y);
    if ((dx || dy) && this.time.now - this.lastTrailAt >= COIN_DASH.trail.everyMs) this.dropTrail();
    this.hunters.getChildren().forEach(hunter =>
      this.physics.moveToObject(hunter, this.player, COIN_DASH.hunterSpeed));
    const seconds = Math.max(0, Math.ceil((this.deadline - this.time.now) / 1000));
    const shield = this.isInvincible()
      ? `    Shield: ${Math.ceil((this.invincibleUntil - this.time.now) / 1000)}s` : '';
    this.hud.setText(`Coins: ${this.score}    Level: ${this.level}    Best: ${Math.max(this.score, this.highScore)}    Time: ${seconds}s${shield}`);
    if (seconds === 0) this.finish('Time is up!');
  }

  dropTrail() {
    const t = COIN_DASH.trail;
    this.lastTrailAt = this.time.now;
    // Sit between the grid and everything else so the trail never covers sprites or overlays.
    const dot = this.add.rectangle(this.player.x, this.player.y, t.size, t.size,
      COIN_DASH.colors.player, t.alpha).setDepth(-1);
    this.tweens.add({
      targets: dot, alpha: 0, scale: 0.3, duration: t.fadeMs, onComplete: () => dot.destroy()
    });
  }

  finish(reason, caught = false) {
    if (this.finished) return;
    this.finished = true;
    this.physics.pause();
    this.achievements.endRound({ caught });
    const newBest = this.score > this.highScore;
    if (newBest) {
      this.highScore = this.score;
      saveHighScore(this.score);
    }
    const c = COIN_DASH;
    this.add.rectangle(c.width / 2, c.height / 2, 460, 180, 0x0a1120, 0.95);
    this.add.text(c.width / 2, c.height / 2,
      `${reason}\n${this.score} coins collected (level ${this.level})\n${newBest ? 'New high score!' : `High score: ${this.highScore}`}\nR: try again   M: menu`,
      { font: '24px monospace', color: '#ffffff', align: 'center', lineSpacing: 12 }
    ).setOrigin(0.5);
  }
}
window.coinDashGame = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: COIN_DASH.width,
  height: COIN_DASH.height,
  backgroundColor: COIN_DASH.colors.background,
  physics: { default: 'arcade', arcade: { debug: false } },
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_HORIZONTALLY },
  scene: [MenuScene, CoinDash, TrophiesScene]
});
