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

const SKY_COLOR_KEYS = ['top', 'bottom', 'grid'];

function mixColor(a, b, t) {
  const channel = shift => {
    const from = (a >> shift) & 0xff;
    return Math.round(from + (((b >> shift) & 0xff) - from) * t) << shift;
  };
  return channel(16) | channel(8) | channel(0);
}

// Blend the two keyframes either side of `progress` with an ease-in-out curve,
// so each change of light starts and settles gently.
function sampleSky(keyframes, progress) {
  let i = 0;
  while (i < keyframes.length - 2 && progress > keyframes[i + 1].at) i++;
  const from = keyframes[i];
  const to = keyframes[i + 1];
  const linear = Phaser.Math.Clamp((progress - from.at) / (to.at - from.at), 0, 1);
  const t = linear * linear * (3 - 2 * linear);
  const sky = {};
  Object.keys(from).forEach(key => {
    sky[key] = SKY_COLOR_KEYS.includes(key)
      ? mixColor(from[key], to[key], t)
      : from[key] + (to[key] - from[key]) * t;
  });
  return sky;
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
    this.deadline = this.time.now + c.roundSeconds * 1000;
    this.physics.world.setBounds(0, 44, c.width, c.height - 44);
    this.createSky();
    this.grid = this.add.grid(c.width / 2, c.height / 2, c.width, c.height, 40, 40)
      .setFillStyle();
    // A dark strip keeps the HUD readable whatever the sky is doing.
    this.add.rectangle(0, 0, c.width, 44, 0x0a1120, 0.6).setOrigin(0).setDepth(8);
    this.hud = this.add.text(18, 12, '', { font: '18px monospace', color: '#ffffff' }).setDepth(8);
    this.player = this.add.rectangle(c.width / 2, c.height / 2, 24, 24, c.colors.player)
      .setStrokeStyle(2, c.colors.outline, 0.8);
    this.physics.add.existing(this.player);
    this.player.body.setCollideWorldBounds(true);
    this.coin = this.add.circle(100, 100, 9, c.colors.coin).setStrokeStyle(2, c.colors.outline, 0.8);
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
      const drone = this.add.rectangle(90 + i * 270, 100, 26, 26, c.colors.drone)
        .setStrokeStyle(2, c.colors.outline, 0.8);
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
      const hunter = this.add.rectangle(x, c.height - 60, 22, 22, c.colors.hunter)
        .setStrokeStyle(2, c.colors.outline, 0.8);
      this.hunters.add(hunter);
      hunter.body.setCollideWorldBounds(true);
    }
    this.physics.add.overlap(this.player, this.coin, () => {
      if (this.finished) return;
      this.score++;
      this.playCoinSound();
      if (this.score % c.coinsPerLevel === 0) this.levelUp();
      this.placeCoin();
    });
    this.physics.add.overlap(this.player, this.powerUp, () => {
      if (this.finished) return;
      this.hidePowerUp();
      this.playCoinSound();
      this.becomeInvincible();
    });
    this.physics.add.overlap(this.player, this.drones, () => {
      if (!this.isInvincible()) this.finish('A drone caught you!');
    });
    this.physics.add.overlap(this.player, this.hunters, () => {
      if (!this.isInvincible()) this.finish('A hunter drone caught you!');
    });
    this.cursors = this.input.keyboard.createCursorKeys();
    this.keys = this.input.keyboard.addKeys('W,A,S,D,R,P');
    this.input.keyboard.on('keydown-R', () => this.scene.restart());
    this.input.keyboard.on('keydown-P', () => this.togglePause());
    this.pauseOverlay = this.add.container(c.width / 2, c.height / 2, [
      this.add.rectangle(0, 0, 460, 120, 0x0a1120, 0.95),
      this.add.text(0, 0, 'Paused\nPress P to resume',
        { font: '24px monospace', color: '#ffffff', align: 'center', lineSpacing: 12 }).setOrigin(0.5)
    ]).setDepth(10).setVisible(false);
    this.createNightShade();
    this.createWeather();
    this.updateSky(0);
  }

  createSky() {
    const c = COIN_DASH;
    this.sky = this.add.graphics();
    this.stars = [];
    for (let i = 0; i < 70; i++) {
      const dot = this.add.circle(Phaser.Math.Between(0, c.width), Phaser.Math.Between(48, c.height),
        Phaser.Math.FloatBetween(0.6, 1.6), 0xffffff).setAlpha(0);
      this.stars.push({ dot, phase: Math.random() * Math.PI * 2, speed: Phaser.Math.FloatBetween(1.5, 4) });
    }
  }

  // Darkness that closes in at night: a dark sheet with a soft clear circle that follows the player.
  createNightShade() {
    const c = COIN_DASH;
    if (!this.textures.exists('nightShade')) {
      // Drawn at half resolution and scaled up 2x; the gradient is soft enough not to show it.
      const texture = this.textures.createCanvas('nightShade', c.width, c.height);
      const ctx = texture.getContext();
      const gradient = ctx.createRadialGradient(c.width / 2, c.height / 2, 45, c.width / 2, c.height / 2, 150);
      gradient.addColorStop(0, 'rgba(3, 6, 16, 0)');
      gradient.addColorStop(0.5, 'rgba(3, 6, 16, 0.6)');
      gradient.addColorStop(1, 'rgba(3, 6, 16, 1)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, c.width, c.height);
      texture.refresh();
    }
    this.nightShade = this.add.image(this.player.x, this.player.y, 'nightShade')
      .setScale(2).setDepth(4).setAlpha(0);
  }

  // Rain or snow that arrives with the night. Purely visual: no physics bodies.
  createWeather() {
    const c = COIN_DASH;
    if (!this.textures.exists('raindrop')) {
      const g = this.make.graphics({}, false);
      g.fillStyle(0xbcd4ff, 1).fillRect(0, 0, 2, 16).generateTexture('raindrop', 2, 16);
      g.clear().lineStyle(1.5, 0xbcd4ff, 1).strokeCircle(12, 12, 10).generateTexture('ripple', 24, 24);
      g.clear().fillStyle(0xffffff, 0.35).fillCircle(4, 4, 4)
        .fillStyle(0xffffff, 1).fillCircle(4, 4, 2.2).generateTexture('snowflake', 8, 8);
      g.destroy();
    }
    const choice = c.dayNight.weather;
    const kind = choice === 'random' ? Phaser.Math.RND.pick(['rain', 'snow']) : choice;
    this.weatherIntensity = 0;
    // `frequency` is the ms between particles at full strength; lighter weather emits less often.
    this.weatherEmitters = [];
    const alpha = (min, max) => ({ onEmit: () => Phaser.Math.FloatBetween(min, max) * this.weatherIntensity });
    if (kind === 'rain') {
      this.weatherEmitters.push({ frequency: 4, emitter: this.add.particles(0, 0, 'raindrop', {
        x: { min: -20, max: c.width + 80 }, y: 20,
        speedX: { min: -75, max: -55 }, speedY: { min: 560, max: 680 },
        rotate: 6, scaleY: { min: 0.7, max: 1.3 }, alpha: alpha(0.35, 0.7),
        lifespan: 900, emitting: false
      }) });
      // Splash rings on the ground.
      this.weatherEmitters.push({ frequency: 45, emitter: this.add.particles(0, 0, 'ripple', {
        x: { min: 10, max: c.width - 10 }, y: { min: 54, max: c.height - 10 },
        scale: { start: 0.15, end: 1 }, alpha: { start: 0.4, end: 0 },
        lifespan: 450, emitting: false
      }) });
    } else if (kind === 'snow') {
      this.weatherEmitters.push({ frequency: 25, emitter: this.add.particles(0, 0, 'snowflake', {
        x: { min: -40, max: c.width + 40 }, y: 30,
        speedX: { min: -30, max: 20 }, speedY: { min: 40, max: 85 },
        scale: { min: 0.35, max: 1 }, alpha: alpha(0.5, 0.95),
        lifespan: 12000, emitting: false
      }) });
    }
    this.weatherEmitters.forEach(w => w.emitter.setDepth(5));
  }

  setWeatherIntensity(amount) {
    this.weatherIntensity = amount;
    this.weatherEmitters.forEach(({ emitter, frequency }) => {
      if (amount < 0.02) {
        emitter.stop();
        return;
      }
      // Assign directly: setFrequency() resets the emit countdown, which would stall it every frame.
      emitter.frequency = frequency / amount;
      emitter.start();
    });
  }

  // progress runs from 0 (round start, daytime) to 1 (time up, deep night).
  updateSky(progress) {
    const c = COIN_DASH;
    const sky = sampleSky(c.dayNight.keyframes, progress);
    this.sky.clear()
      .fillGradientStyle(sky.top, sky.top, sky.bottom, sky.bottom, 1)
      .fillRect(0, 0, c.width, c.height);
    this.grid.setOutlineStyle(sky.grid, sky.gridAlpha);
    // Clouds roll in with the weather, so the stars fade as it gets heavier.
    const starAlpha = sky.stars * (1 - 0.85 * sky.weather);
    const now = this.time.now / 1000;
    this.stars.forEach(star =>
      star.dot.setAlpha(starAlpha * (0.55 + 0.45 * Math.sin(now * star.speed + star.phase))));
    this.nightShade.setPosition(this.player.x, this.player.y).setAlpha(sky.darkness);
    this.setWeatherIntensity(sky.weather);
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
    this.weatherEmitters.forEach(w => (this.paused ? w.emitter.pause() : w.emitter.resume()));
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
    const dx = Number(this.cursors.right.isDown || this.keys.D.isDown)
      - Number(this.cursors.left.isDown || this.keys.A.isDown);
    const dy = Number(this.cursors.down.isDown || this.keys.S.isDown)
      - Number(this.cursors.up.isDown || this.keys.W.isDown);
    const direction = new Phaser.Math.Vector2(dx, dy).normalize().scale(COIN_DASH.playerSpeed);
    this.player.body.setVelocity(direction.x, direction.y);
    this.hunters.getChildren().forEach(hunter =>
      this.physics.moveToObject(hunter, this.player, COIN_DASH.hunterSpeed));
    const remainingMs = this.deadline - this.time.now;
    this.updateSky(Phaser.Math.Clamp(1 - remainingMs / (COIN_DASH.roundSeconds * 1000), 0, 1));
    const seconds = Math.max(0, Math.ceil(remainingMs / 1000));
    const shield = this.isInvincible()
      ? `    Shield: ${Math.ceil((this.invincibleUntil - this.time.now) / 1000)}s` : '';
    this.hud.setText(`Coins: ${this.score}    Level: ${this.level}    Best: ${Math.max(this.score, this.highScore)}    Time: ${seconds}s${shield}`);
    if (seconds === 0) this.finish('Time is up!');
  }

  finish(reason) {
    if (this.finished) return;
    this.finished = true;
    this.physics.pause();
    const newBest = this.score > this.highScore;
    if (newBest) {
      this.highScore = this.score;
      saveHighScore(this.score);
    }
    const c = COIN_DASH;
    this.add.rectangle(c.width / 2, c.height / 2, 460, 180, 0x0a1120, 0.95).setDepth(10);
    this.add.text(c.width / 2, c.height / 2,
      `${reason}\n${this.score} coins collected (level ${this.level})\n${newBest ? 'New high score!' : `High score: ${this.highScore}`}\nPress R to try again`,
      { font: '24px monospace', color: '#ffffff', align: 'center', lineSpacing: 12 }
    ).setOrigin(0.5).setDepth(10);
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
