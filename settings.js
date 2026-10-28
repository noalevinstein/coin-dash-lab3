// Keep tuning separate from game behaviour so features can be developed independently.
window.COIN_DASH = {
  width: 800,
  height: 500,
  roundSeconds: 45,
  playerSpeed: 240,
  droneSpeed: 105,
  droneCount: 3,
  // Fading squares dropped behind the player while moving.
  trail: { everyMs: 30, fadeMs: 320, size: 16, alpha: 0.5 },
  sound: { volume: 0.15, coinNotes: [988, 1319] },
  colors: { background: 0x101c31, player: 0x71e8ce, coin: 0xffd166, drone: 0xff657a }
};
