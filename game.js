/* global Phaser, COIN_DASH */
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
    this.totalCoins = 0;
    this.level = 1;
    this.highScore = loadHighScore();
    this.finished = false;
    this.paused = false;
    this.deadline = this.time.now + c.roundSeconds * 1000;
    this.physics.world.setBounds(0, 44, c.width, c.height - 44);
    this.add.grid(c.width / 2, c.height / 2, c.width, c.height, 40, 40,
      c.colors.background, 1, 0x24334b, 0.45);
    this.hud = this.add.text(18, 12, '', { font: '18px monospace', color: '#ffffff' });
    this.cursors = this.input.keyboard.createCursorKeys();
    this.keys = this.input.keyboard.addKeys('W,A,S,D,R,P');
    const arrows = { up: [this.cursors.up], down: [this.cursors.down],
      left: [this.cursors.left], right: [this.cursors.right] };
    const wasd = { up: [this.keys.W], down: [this.keys.S], left: [this.keys.A], right: [this.keys.D] };
    if (c.twoPlayer) {
      // Player 1 (arrow keys) starts on the right, Player 2 (WASD) on the left.
      this.players = [
        this.createPlayer('P1', c.width / 2 + 60, c.colors.player, arrows),
        this.createPlayer('P2', c.width / 2 - 60, c.colors.player2, wasd)
      ];
    } else {
      const both = {};
      Object.keys(arrows).forEach(dir => { both[dir] = arrows[dir].concat(wasd[dir]); });
      this.players = [this.createPlayer('P1', c.width / 2, c.colors.player, both)];
    }
    this.coin = this.add.circle(100, 100, 9, c.colors.coin);
    this.physics.add.existing(this.coin);
    this.coin.body.setCircle(9);
    this.placeCoin();
    this.drones = this.physics.add.group();
    for (let i = 0; i < c.droneCount; i++) {
      const drone = this.add.rectangle(90 + i * 270, 100, 26, 26, c.colors.drone);
      this.drones.add(drone);
      drone.body.setCollideWorldBounds(true).setBounce(1, 1);
      const angle = (35 + i * 105) * Math.PI / 180;
      drone.body.setVelocity(Math.cos(angle) * c.droneSpeed, Math.sin(angle) * c.droneSpeed);
    }
    this.players.forEach(player => {
      this.physics.add.overlap(player.sprite, this.coin, () => this.collectCoin(player));
      this.physics.add.overlap(player.sprite, this.drones, () => this.knockOut(player));
    });
    this.input.keyboard.on('keydown-R', () => this.scene.restart());
    this.input.keyboard.on('keydown-P', () => this.togglePause());
    this.pauseOverlay = this.add.container(c.width / 2, c.height / 2, [
      this.add.rectangle(0, 0, 460, 120, 0x0a1120, 0.95),
      this.add.text(0, 0, 'Paused\nPress P to resume',
        { font: '24px monospace', color: '#ffffff', align: 'center', lineSpacing: 12 }).setOrigin(0.5)
    ]).setDepth(10).setVisible(false);
  }

  createPlayer(label, x, color, controls) {
    const sprite = this.add.rectangle(x, COIN_DASH.height / 2, 24, 24, color);
    this.physics.add.existing(sprite);
    sprite.body.setCollideWorldBounds(true);
    return { label, sprite, controls, score: 0, alive: true };
  }

  collectCoin(player) {
    if (this.finished || !player.alive) return;
    player.score++;
    this.totalCoins++;
    this.playCoinSound();
    if (this.totalCoins % COIN_DASH.coinsPerLevel === 0) this.levelUp();
    this.placeCoin();
  }

  // A caught player drops out but keeps their coins; the round ends once nobody is left.
  knockOut(player) {
    if (this.finished || !player.alive) return;
    player.alive = false;
    player.sprite.body.stop();
    player.sprite.body.enable = false;
    player.sprite.setAlpha(0.25);
    if (this.players.some(p => p.alive)) return;
    this.finish(this.players.length > 1 ? 'Both players were caught!' : 'A drone caught you!');
  }

  togglePause() {
    if (this.finished) return;
    this.paused = !this.paused;
    if (this.paused) {
      // Freeze the countdown by remembering how much time was left.
      this.remainingMs = this.deadline - this.time.now;
      this.physics.pause();
    } else {
      this.deadline = this.time.now + this.remainingMs;
      this.physics.resume();
    }
    this.pauseOverlay.setVisible(this.paused);
  }

  levelUp() {
    const c = COIN_DASH;
    this.level++;
    // Keep each drone's direction, just make it a little faster.
    const speed = c.droneSpeed + (this.level - 1) * c.droneSpeedUpPerLevel;
    this.drones.getChildren().forEach(drone => {
      const v = drone.body.velocity.clone().normalize().scale(speed);
      drone.body.setVelocity(v.x, v.y);
    });
  }

  placeCoin() {
    const c = COIN_DASH;
    // Avoid spawning the next coin directly underneath a player.
    const alive = this.players.filter(p => p.alive);
    let x, y;
    do {
      x = Phaser.Math.Between(25, c.width - 25);
      y = Phaser.Math.Between(70, c.height - 25);
    } while (alive.some(p => Phaser.Math.Distance.Between(x, y, p.sprite.x, p.sprite.y) < 60));
    this.coin.setPosition(x, y);
    this.coin.body.reset(x, y);
  }

  playCoinSound() {
    // Synthesize a short two-note chime so no audio assets are needed.
    const ctx = this.sound.context;
    if (!ctx || COIN_DASH.sound.volume <= 0) return;
    const now = ctx.currentTime;
    COIN_DASH.sound.coinNotes.forEach((freq, i) => {
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

  update() {
    if (this.finished || this.paused) return;
    const held = keys => Number(keys.some(k => k.isDown));
    this.players.forEach(p => {
      if (!p.alive) return;
      const dx = held(p.controls.right) - held(p.controls.left);
      const dy = held(p.controls.down) - held(p.controls.up);
      const direction = new Phaser.Math.Vector2(dx, dy).normalize().scale(COIN_DASH.playerSpeed);
      p.sprite.body.setVelocity(direction.x, direction.y);
    });
    const seconds = Math.max(0, Math.ceil((this.deadline - this.time.now) / 1000));
    const scores = this.players.length > 1
      ? this.players.map(p => `${p.label}: ${p.score}${p.alive ? '' : ' (out)'}`).join('   ')
      : `Coins: ${this.players[0].score}`;
    this.hud.setText(`${scores}    Level: ${this.level}    Best: ${Math.max(this.bestScore(), this.highScore)}    Time: ${seconds}s`);
    if (seconds === 0) this.finish('Time is up!');
  }

  bestScore() {
    return Math.max(...this.players.map(p => p.score));
  }

  finish(reason) {
    if (this.finished) return;
    this.finished = true;
    this.physics.pause();
    const best = this.bestScore();
    const newBest = best > this.highScore;
    if (newBest) {
      this.highScore = best;
      saveHighScore(best);
    }
    let result;
    if (this.players.length > 1) {
      const [p1, p2] = this.players;
      const winner = p1.score === p2.score ? "It's a draw!"
        : `${p1.score > p2.score ? 'Player 1' : 'Player 2'} wins!`;
      result = `P1: ${p1.score} · P2: ${p2.score} (level ${this.level})\n${winner}`;
    } else {
      result = `${best} coins collected (level ${this.level})`;
    }
    const c = COIN_DASH;
    this.add.rectangle(c.width / 2, c.height / 2, 460, this.players.length > 1 ? 220 : 180, 0x0a1120, 0.95);
    this.add.text(c.width / 2, c.height / 2,
      `${reason}\n${result}\n${newBest ? 'New high score!' : `High score: ${this.highScore}`}\nPress R to try again`,
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
  scene: CoinDash
});
