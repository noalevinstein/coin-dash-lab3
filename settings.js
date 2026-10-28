// Keep tuning separate from game behaviour so features can be developed independently.
window.COIN_DASH = {
  width: 800,
  height: 500,
  roundSeconds: 45,
  playerSpeed: 240,
  twoPlayer: true,
  droneSpeed: 105,
  droneCount: 3,
  coinsPerLevel: 10,
  droneSpeedUpPerLevel: 15,
  sound: { volume: 0.15, coinNotes: [988, 1319] },
  colors: { background: 0x101c31, player: 0x71e8ce, player2: 0xc77dff, coin: 0xffd166, drone: 0xff657a }
};
