export const rows = 5;
export const cols = 9;

export const LEVELS = {
  easy:     { sunStart: 200, sunDrop: 4.2, spawnBase: 3.8, spawnMin: 1.2, spawnBurstWave: 99, winKills: 60,  hpScale: 1,    speedScale: 0.95 },
  normal:   { sunStart: 150, sunDrop: 5.2, spawnBase: 3.2, spawnMin: 0.8, spawnBurstWave: 8,  winKills: 80,  hpScale: 1.08, speedScale: 1 },
  hard:     { sunStart: 125, sunDrop: 6.2, spawnBase: 2.6, spawnMin: 0.55,spawnBurstWave: 6,  winKills: 100, hpScale: 1.18, speedScale: 1.08 },
  survival: { sunStart: 150, sunDrop: 5.5, spawnBase: 2.8, spawnMin: 0.42,spawnBurstWave: 4,  winKills: 140, hpScale: 1.22, speedScale: 1.1 },
};

export const PLANTS = {
  peashooter: { name: '豌豆射手', emoji: '🌱', cost: 100, hp: 100, cooldown: 4,  desc: '穩定輸出', refund: 0.5, upgradeCost: 75,  upgradeDesc: '射速+30%' },
  sunflower:  { name: '向日葵',   emoji: '🌻', cost: 50,  hp: 80,  cooldown: 5,  desc: '生產陽光', refund: 0.5, upgradeCost: 75,  upgradeDesc: '產量+10' },
  wallnut:    { name: '堅果牆',   emoji: '🥔', cost: 75,  hp: 360, cooldown: 10, desc: '厚血擋線', refund: 0.5, upgradeCost: 50,  upgradeDesc: 'HP+120' },
  repeater:   { name: '雙發射手', emoji: '🌿', cost: 175, hp: 100, cooldown: 7,  desc: '一次兩發', refund: 0.5, upgradeCost: 100, upgradeDesc: '三連發' },
  icepea:     { name: '冰豆射手', emoji: '🧊', cost: 150, hp: 95,  cooldown: 7,  desc: '附帶緩速', refund: 0.5, upgradeCost: 100, upgradeDesc: '緩速時間+2s' },
  bomb:       { name: '櫻桃炸彈', emoji: '🍒', cost: 125, hp: 999, cooldown: 14, desc: '範圍爆炸', refund: 0 },
  prism:      { name: '稜鏡花',   emoji: '💠', cost: 160, hp: 90,  cooldown: 9,  desc: '會打兩排的折射花', refund: 0.5, upgradeCost: 120, upgradeDesc: '折射傷害+5' },
  gambler:    { name: '賭徒花',   emoji: '🎲', cost: 140, hp: 85,  cooldown: 8,  desc: '傷害亂跳，偶爾暴擊', refund: 0.5, upgradeCost: 100, upgradeDesc: '暴擊率+15%' },
  chomper:    { name: '大嘴花',   emoji: '🪴', cost: 150, hp: 90,  cooldown: 12, desc: '秒殺一隻殭屍，嚼很久', refund: 0.5, upgradeCost: 125, upgradeDesc: '嚼完-2s' },
  torchwood:  { name: '火炬樹',   emoji: '🔥', cost: 175, hp: 120, cooldown: 8,  desc: '豌豆經過變火球，2x傷害+濺射', refund: 0.5, upgradeCost: 125, upgradeDesc: '濺射範圍+50%' },
  cactus:     { name: '仙人掌',   emoji: '🌵', cost: 125, hp: 110, cooldown: 6,  desc: '穿透射擊，打到地下殭屍', refund: 0.5, upgradeCost: 100, upgradeDesc: '穿透+1目標' },
};

export const ZOMBIES = {
  normal:  { emoji: '🧟', hp: 100, speed: 0.16, reward: 15, bite: 18, className: 'normal' },
  cone:    { emoji: '🚧', hp: 180, speed: 0.15, reward: 22, bite: 20, className: 'cone' },
  bucket:  { emoji: '🪣', hp: 320, speed: 0.13, reward: 30, bite: 24, className: 'bucket' },
  fast:    { emoji: '🏃', hp: 80,  speed: 0.25, reward: 18, bite: 16, className: 'fast' },
  paper:   { emoji: '📰', hp: 150, speed: 0.18, reward: 24, bite: 18, className: 'paper' },
  giant:   { emoji: '🧌', hp: 750, speed: 0.10, reward: 60, bite: 42, className: 'giant' },
  splitter:{ emoji: '🪓', hp: 170, speed: 0.17, reward: 26, bite: 18, className: 'splitter' },
  flag:    { emoji: '🚩', hp: 90,  speed: 0.28, reward: 20, bite: 14, className: 'flag' },
  digger:  { emoji: '⛏️', hp: 130, speed: 0.12, reward: 28, bite: 22, className: 'digger' },
  imp:     { emoji: '👺', hp: 60,  speed: 0.32, reward: 16, bite: 14, className: 'imp' },
  mini:    { emoji: '🧟', hp: 45,  speed: 0.30, reward: 6,  bite: 10, className: 'mini' },
};

/** Power-up definitions — dropped by killed zombies */
export const POWERUPS = {
  sunburst:  { emoji: '✨', name: '陽光爆發', desc: '+50 陽光', duration: 0, className: 'sunburst' },
  cooldown:  { emoji: '⏱️', name: '急速冷卻', desc: '所有冷卻歸零', duration: 0, className: 'cooldown' },
  heal:      { emoji: '💚', name: '全體治療', desc: '所有植物回30%HP', duration: 0, className: 'heal' },
  shield:   { emoji: '🛡️', name: '植物護盾', desc: '所有植物3秒無敵', duration: 3, className: 'shield' },
};

/** Achievement definitions */
export const ACHIEVEMENTS = [
  { id: 'first_blood',  name: '初見血',       desc: '擊殺第 1 隻殭屍',       check: s => s.kills >= 1 },
  { id: 'wave5',        name: '五波達陣',     desc: '存活到第 5 波',          check: s => s.wave >= 5 },
  { id: 'wave10',       name: '十波老手',     desc: '存活到第 10 波',         check: s => s.wave >= 10 },
  { id: 'kill50',       name: '屠殺者',       desc: '累計擊殺 50 隻',         check: s => s.kills >= 50 },
  { id: 'kill100',      name: '殭屍末日',     desc: '累計擊殺 100 隻',        check: s => s.kills >= 100 },
  { id: 'sun500',       name: '陽光大戶',     desc: '同時持有 500 陽光',      check: s => s.sun >= 500 },
  { id: 'combo5',       name: '連殺高手',     desc: '達成 5 連殺',            check: s => s.combo >= 5 },
  { id: 'combo10',      name: '連殺大師',     desc: '達成 10 連殺',           check: s => s.combo >= 10 },
  { id: 'shovel5',      name: '鏟土工',       desc: '使用鏟子 5 次',           check: s => s.shovelUses >= 5 },
  { id: 'upgrade3',     name: '強化新手',     desc: '升級 3 棵植物',          check: s => s.upgradeCount >= 3 },
  { id: 'powerup5',     name: '拾荒者',       desc: '拾取 5 個 Power-up',     check: s => s.powerupsCollected >= 5 },
  { id: 'win_normal',   name: '通關普通',     desc: '在普通難度通關',          check: s => s.wonNormal },
  { id: 'win_hard',     name: '通關困難',     desc: '在困難難度通關',          check: s => s.wonHard },
  { id: 'win_survival', name: '生存王者',     desc: '在生存難度通關',          check: s => s.wonSurvival },
];
