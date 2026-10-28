// Keep tuning separate from game behaviour so features can be developed independently.
window.COIN_DASH = {
  width: 800,
  height: 500,
  roundSeconds: 45,
  playerSpeed: 240,
  droneSpeed: 105,
  droneCount: 3,
  coinsPerLevel: 10,
  droneSpeedUpPerLevel: 15,
  hunterSpeed: 85,
  hunterCount: 1,
  // A rare blue coin: spawns every `everySeconds`, vanishes after `lifeSeconds` if not taken.
  powerUp: { everySeconds: 15, lifeSeconds: 6, invincibleSeconds: 5 },
  // Day/night cycle over one round. `at` is round progress (0 = start, 1 = time up);
  // the scene blends smoothly between neighbouring keyframes.
  dayNight: {
    weather: 'random', // 'rain', 'snow', 'random' (picked each round) or 'none'
    keyframes: [
      // Day
      { at: 0.00, top: 0x3d8ad6, bottom: 0x9fd4f5, grid: 0xffffff, gridAlpha: 0.22, stars: 0, darkness: 0, weather: 0 },
      { at: 0.22, top: 0x3d8ad6, bottom: 0x9fd4f5, grid: 0xffffff, gridAlpha: 0.22, stars: 0, darkness: 0, weather: 0 },
      // Golden hour
      { at: 0.34, top: 0x5a7fc6, bottom: 0xffc48a, grid: 0xffffff, gridAlpha: 0.2, stars: 0, darkness: 0, weather: 0 },
      // Sunset
      { at: 0.46, top: 0x6a3d8f, bottom: 0xff7a59, grid: 0xffd6c2, gridAlpha: 0.18, stars: 0, darkness: 0.05, weather: 0 },
      // Dusk
      { at: 0.58, top: 0x1d1640, bottom: 0x6b2f5e, grid: 0x3a2c5a, gridAlpha: 0.4, stars: 0.8, darkness: 0.25, weather: 0 },
      // Night, with weather rolling in
      { at: 0.70, top: 0x050a18, bottom: 0x101c31, grid: 0x24334b, gridAlpha: 0.45, stars: 1, darkness: 0.45, weather: 0.35 },
      { at: 0.85, top: 0x03060f, bottom: 0x0b1424, grid: 0x24334b, gridAlpha: 0.45, stars: 1, darkness: 0.6, weather: 1 },
      { at: 1.00, top: 0x03060f, bottom: 0x0b1424, grid: 0x24334b, gridAlpha: 0.45, stars: 1, darkness: 0.6, weather: 1 }
    ]
  },
  sound: { volume: 0.15, coinNotes: [988, 1319] },
  colors: {
    background: 0x101c31, player: 0x71e8ce, coin: 0xffd166, powerUp: 0x4ea8ff,
    drone: 0xff657a, hunter: 0x4d8dff, outline: 0x0a1120
  }
};
