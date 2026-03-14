export const rows = 5;
export const cols = 9;

export const LEVELS = {
  easy: { sunStart: 200, sunDrop: 4.2, spawnBase: 3.8, spawnMin: 1.2, spawnBurstWave: 99, winKills: 60, hpScale: 1, speedScale: 0.95 },
  normal: { sunStart: 150, sunDrop: 5.2, spawnBase: 3.2, spawnMin: 0.8, spawnBurstWave: 8, winKills: 80, hpScale: 1.08, speedScale: 1 },
  hard: { sunStart: 125, sunDrop: 6.2, spawnBase: 2.6, spawnMin: 0.55, spawnBurstWave: 6, winKills: 100, hpScale: 1.18, speedScale: 1.08 },
  survival: { sunStart: 150, sunDrop: 5.5, spawnBase: 2.8, spawnMin: 0.42, spawnBurstWave: 4, winKills: 140, hpScale: 1.22, speedScale: 1.1 },
};

export const PLANTS = {
  peashooter: { name: '豌豆射手', emoji: '🌱', cost: 100, hp: 100, cooldown: 4, desc: '穩定輸出' },
  sunflower: { name: '向日葵', emoji: '🌻', cost: 50, hp: 80, cooldown: 5, desc: '生產陽光' },
  wallnut: { name: '堅果牆', emoji: '🥔', cost: 75, hp: 360, cooldown: 10, desc: '厚血擋線' },
  repeater: { name: '雙發射手', emoji: '🌿', cost: 175, hp: 100, cooldown: 7, desc: '一次兩發' },
  icepea: { name: '冰豆射手', emoji: '🧊', cost: 150, hp: 95, cooldown: 7, desc: '附帶緩速' },
  bomb: { name: '櫻桃炸彈', emoji: '🍒', cost: 125, hp: 999, cooldown: 14, desc: '範圍爆炸' },
  prism: { name: '稜鏡花', emoji: '💠', cost: 160, hp: 90, cooldown: 9, desc: '會打兩排的折射花' },
  gambler: { name: '賭徒花', emoji: '🎲', cost: 140, hp: 85, cooldown: 8, desc: '傷害亂跳，偶爾打出離譜暴擊' },
};

export const ZOMBIES = {
  normal: { emoji: '🧟', hp: 100, speed: 0.16, reward: 15, bite: 18, className: 'normal' },
  cone: { emoji: '🚧', hp: 180, speed: 0.15, reward: 22, bite: 20, className: 'cone' },
  bucket: { emoji: '🪣', hp: 320, speed: 0.13, reward: 30, bite: 24, className: 'bucket' },
  fast: { emoji: '🏃', hp: 80, speed: 0.25, reward: 18, bite: 16, className: 'fast' },
  paper: { emoji: '📰', hp: 150, speed: 0.18, reward: 24, bite: 18, className: 'paper' },
  giant: { emoji: '🧌', hp: 750, speed: 0.10, reward: 60, bite: 42, className: 'giant' },
  splitter: { emoji: '🪓', hp: 170, speed: 0.17, reward: 26, bite: 18, className: 'splitter' },
  mini: { emoji: '🧟', hp: 45, speed: 0.30, reward: 6, bite: 10, className: 'mini' },
};
