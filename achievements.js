// Achievement definitions, persistent stats and unlock tracking. No Phaser here, just data.
const STATS_KEY = 'coinDash.stats';
const UNLOCKED_KEY = 'coinDash.achievements';

const DEFAULT_STATS = {
  gamesPlayed: 0,
  deaths: 0,
  roundsSurvived: 0,
  totalCoins: 0,
  secondsSurvived: 0,
  powerUps: 0,
  bestLevel: 1
};

// Each `test` receives the lifetime stats and returns true once the badge is earned.
const ACHIEVEMENTS = [
  { id: 'first-blood', name: 'First Blood', description: 'Get caught by a drone for the first time.',
    test: s => s.deaths >= 1 },
  { id: 'coin-collector', name: 'Coin Collector', description: 'Collect 50 coins in total.',
    test: s => s.totalCoins >= 50 },
  { id: 'survivor', name: 'Survivor', description: 'Stay alive for 60 seconds in total.',
    test: s => s.secondsSurvived >= 60 },
  { id: 'untouchable', name: 'Untouchable', description: 'Pick up a blue power-up coin.',
    test: s => s.powerUps >= 1 },
  { id: 'climber', name: 'Climber', description: 'Reach level 3 in a single round.',
    test: s => s.bestLevel >= 3 },
  { id: 'time-keeper', name: 'Time Keeper', description: 'Last until the clock runs out.',
    test: s => s.roundsSurvived >= 1 }
];

// localStorage can be unavailable or hold junk, so every read falls back to a safe default.
function readJson(key, fallback) {
  try {
    const value = JSON.parse(localStorage.getItem(key));
    return value && typeof value === 'object' ? value : fallback;
  } catch (e) {
    return fallback;
  }
}

function writeJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) { /* ignore: progress just won't persist */ }
}

function loadStats() {
  const stored = readJson(STATS_KEY, {});
  const stats = {};
  Object.keys(DEFAULT_STATS).forEach(key => {
    stats[key] = Number.isFinite(stored[key]) ? stored[key] : DEFAULT_STATS[key];
  });
  return stats;
}

// Returns { stats, unlocked } where unlocked maps achievement id -> unlock timestamp.
function loadAchievementProgress() {
  return { stats: loadStats(), unlocked: readJson(UNLOCKED_KEY, {}) };
}

class AchievementTracker {
  constructor(onUnlock) {
    const { stats, unlocked } = loadAchievementProgress();
    this.stats = stats;
    this.unlocked = unlocked;
    this.onUnlock = onUnlock;
  }

  add(stat, amount = 1) {
    this.stats[stat] += amount;
    this.commit();
  }

  raise(stat, value) {
    if (value <= this.stats[stat]) return;
    this.stats[stat] = value;
    this.commit();
  }

  // Called every frame, so it only checks; the time is saved with the next commit.
  tick(deltaMs) {
    this.stats.secondsSurvived += deltaMs / 1000;
    this.check();
  }

  endRound({ caught }) {
    this.stats.gamesPlayed++;
    if (caught) this.stats.deaths++;
    else this.stats.roundsSurvived++;
    this.commit();
  }

  commit() {
    this.save();
    this.check();
  }

  save() {
    writeJson(STATS_KEY, this.stats);
  }

  check() {
    ACHIEVEMENTS.forEach(achievement => {
      if (this.unlocked[achievement.id] || !achievement.test(this.stats)) return;
      this.unlocked[achievement.id] = Date.now();
      writeJson(UNLOCKED_KEY, this.unlocked);
      this.save();
      this.onUnlock(achievement);
    });
  }
}
