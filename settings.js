// Keep tuning separate from game behaviour so features can be developed independently.
window.COIN_DASH = {
  width: 800,
  height: 500,
  roundSeconds: 45,
  playerSpeed: 240,
  droneSpeed: 105,
  droneCount: 3,
  hunterSpeed: 85,
  hunterCount: 1,
  sound: { volume: 0.15, coinNotes: [988, 1319] },
  colors: { background: 0x101c31, player: 0x71e8ce, coin: 0xffd166, drone: 0xff657a, hunter: 0x4d8dff }
};
