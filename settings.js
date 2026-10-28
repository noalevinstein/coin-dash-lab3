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
  // Fading squares dropped behind the player while moving.
  trail: { everyMs: 30, fadeMs: 320, size: 16, alpha: 0.5 },
  sound: { volume: 0.15, coinNotes: [988, 1319] },
  colors: {
    background: 0x101c31, player: 0x71e8ce, coin: 0xffd166, powerUp: 0x4ea8ff,
    drone: 0xff657a, hunter: 0x4d8dff
  }
};
