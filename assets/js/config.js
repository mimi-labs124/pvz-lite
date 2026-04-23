// ═══════════════════════════════════════════════
// PVZ Lite: Chaos Garden — 肉鴿塔防 遊戲配置
// ═══════════════════════════════════════════════

export const rows = 5;
export const cols = 9;

// ── 植物定義 ──────────────────────────────────
export const PLANTS = {
  peashooter:  { name: '豌豆射手', emoji: '🌱', cost: 100, hp: 100, cooldown: 4,  desc: '穩定輸出',   tier: 1 },
  sunflower:   { name: '向日葵',   emoji: '🌻', cost: 50,  hp: 80,  cooldown: 5,  desc: '生產陽光',   tier: 1 },
  wallnut:     { name: '堅果牆',   emoji: '🥔', cost: 75,  hp: 360, cooldown: 10, desc: '厚血擋線',   tier: 1 },
  repeater:    { name: '雙發射手', emoji: '🌿', cost: 175, hp: 100, cooldown: 7,  desc: '一次兩發',   tier: 2 },
  icepea:      { name: '冰豆射手', emoji: '🧊', cost: 150, hp: 95,  cooldown: 7,  desc: '附帶緩速',   tier: 2 },
  bomb:        { name: '櫻桃炸彈', emoji: '🍒', cost: 125, hp: 999, cooldown: 14, desc: '範圍爆炸',   tier: 2 },
  prism:       { name: '稜鏡花',   emoji: '💠', cost: 160, hp: 90,  cooldown: 9,  desc: '折射三排',   tier: 2 },
  gambler:     { name: '賭徒花',   emoji: '🎲', cost: 140, hp: 85,  cooldown: 8,  desc: '傷害亂跳',   tier: 2 },
  firepea:     { name: '火焰豌豆', emoji: '🔥', cost: 200, hp: 105, cooldown: 8,  desc: '穿透濺射',   tier: 3 },
  shadowvine:  { name: '暗影藤',   emoji: '🖤', cost: 220, hp: 90,  cooldown: 9,  desc: '偷取殭屍血量', tier: 3 },
  thornwall:   { name: '荊棘牆',   emoji: '🦔', cost: 160, hp: 500, cooldown: 12, desc: '反傷近戰',   tier: 3 },
  oracle:      { name: '預言菇', emoji: '🔮', cost: 250, hp: 70,  cooldown: 15, desc: '凍結全排',   tier: 3 },
 magnet: { name: '磁力菇', emoji: '🧲', cost: 175, hp: 85, cooldown: 10, desc: '吸走殭屍防具', tier: 2 },
 melon: { name: '西瓜投手', emoji: '🍉', cost: 300, hp: 100, cooldown: 10, desc: '拋物線濺射3×3', tier: 3 },
 spikeweed: { name: '地刺', emoji: '🌵', cost: 100, hp: 60, cooldown: 5, desc: '地面持續傷害', tier: 1 },
};

// ── 殭屍定義 ──────────────────────────────────
export const ZOMBIES = {
  normal:   { emoji: '🧟', hp: 130, speed: 0.19, reward: 15, bite: 20, className: 'normal' },
  cone:     { emoji: '🚧', hp: 230, speed: 0.17, reward: 22, bite: 24, className: 'cone' },
  bucket:   { emoji: '🪣', hp: 420, speed: 0.14, reward: 30, bite: 30, className: 'bucket' },
  fast:     { emoji: '🏃', hp: 100, speed: 0.28, reward: 18, bite: 18, className: 'fast' },
  paper:    { emoji: '📰', hp: 190, speed: 0.21, reward: 24, bite: 22, className: 'paper' },
  giant:    { emoji: '🧌', hp: 1000, speed: 0.11, reward: 60, bite: 50, className: 'giant' },
  splitter: { emoji: '🪓', hp: 210, speed: 0.19, reward: 26, bite: 22, className: 'splitter' },
  mini:     { emoji: '🧟', hp: 55,  speed: 0.34, reward: 6,  bite: 12, className: 'mini' },
  healer:   { emoji: '💉', hp: 150, speed: 0.13, reward: 35, bite: 14, className: 'healer' },
  necro:    { emoji: '💀', hp: 260, speed: 0.15, reward: 45, bite: 26, className: 'necro' },
  boss:     { emoji: '👾', hp: 2500,speed: 0.09, reward: 120,bite: 65, className: 'boss' },
 armored: { emoji: '🛡️', hp: 350, speed: 0.13, reward: 40, bite: 28, className: 'armored' },
 dancer: { emoji: '💃', hp: 220, speed: 0.15, reward: 35, bite: 24, className: 'dancer' },
 backup: { emoji: '🕺', hp: 70, speed: 0.22, reward: 12, bite: 14, className: 'backup' },
};

// ── 植物進化路線 ──────────────────────────────
export const EVOLUTIONS = {
  peashooter:  { 2: { name: '雙管射手', emoji: '🌱', bonusDmg: 8,  bonusHp: 20, bonusSpeed: -0.1 },
                  3: { name: '機關射手', emoji: '🌱', bonusDmg: 15, bonusHp: 40, bonusSpeed: -0.2, extraShot: true } },
  sunflower:   { 2: { name: '雙蕊向日葵', emoji: '🌻', bonusSun: 12, bonusHp: 15 },
                  3: { name: '太陽王向日葵', emoji: '🌻', bonusSun: 25, bonusHp: 30, aoeSun: true } },
  wallnut:     { 2: { name: '鐵壁堅果', emoji: '🥔', bonusHp: 150, regen: 2 },
                  3: { name: '堡壘堅果', emoji: '🥔', bonusHp: 350, regen: 5, reflectDmg: 5 } },
  repeater:    { 2: { name: '三連射手', emoji: '🌿', bonusDmg: 5, extraShot: true },
                  3: { name: '加特林射手', emoji: '🌿', bonusDmg: 10, extraShot: true, firePeas: true } },
  icepea:      { 2: { name: '暴風雪射手', emoji: '🧊', bonusDmg: 8, slowBoost: 0.4 },
                  3: { name: '絕對零度射手', emoji: '🧊', bonusDmg: 15, slowBoost: 0.8, freezeChance: 0.15 } },
  bomb:        { 2: { name: '核彈炸彈', emoji: '🍒', bonusRadius: true, bonusDmg: 100 },
                  3: { name: '超新星炸彈', emoji: '🍒', bonusRadius: true, bonusDmg: 200, leaveFire: true } },
  prism:       { 2: { name: '彩虹稜鏡', emoji: '💠', bonusRows: 2, bonusDmg: 6 },
                  3: { name: '全頻稜鏡', emoji: '💠', hitAllRows: true, bonusDmg: 12 } },
  gambler:     { 2: { name: '老千花', emoji: '🎲', betterCrit: true, critDmg: 80 },
                  3: { name: '命運女神', emoji: '🎲', guaranteedCrit: true, critDmg: 120 } },
  firepea:     { 2: { name: '地獄火豌豆', emoji: '🔥', bonusDmg: 12, splashRadius: 1.5 },
                  3: { name: '煉獄豌豆', emoji: '🔥', bonusDmg: 25, splashRadius: 2.2, burn: true } },
  shadowvine:  { 2: { name: '深淵藤', emoji: '🖤', stealRate: 0.3 },
                  3: { name: '虛空吞噬者', emoji: '🖤', stealRate: 0.5, aoeSteal: true } },
  thornwall:   { 2: { name: '鋼荊棘', emoji: '🦔', bonusReflect: 8, bonusHp: 200 },
                  3: { name: '地獄荊棘', emoji: '🦔', bonusReflect: 18, bonusHp: 400, thornShot: true } },
  oracle:      { 2: { name: '時光菇', emoji: '🔮', freezeDuration: 3.5 },
                  3: { name: '永恆菇', emoji: '🔮', freezeDuration: 5, timeRewind: true } },
 magnet: { 2: { name: '強力磁菇', emoji: '🧲', bonusHp: 20, magnetRange: 2 },
 3: { name: '黑洞磁菇', emoji: '🧲', bonusHp: 40, magnetRange: 3, magnetDamage: true } },
 melon: { 2: { name: '冰西瓜', emoji: '🍉', bonusDmg: 12, splashRows: 2 },
 3: { name: '末日西瓜', emoji: '🍉', bonusDmg: 25, splashRows: 3, freezeSplash: true } },
 spikeweed: { 2: { name: '鐵地刺', emoji: '🌵', bonusDmg: 6, slowOnHit: true },
 3: { name: '毀滅地刺', emoji: '🌵', bonusDmg: 14, slowOnHit: true, armorBreak: true } },
};

// ── XP 需求 (每級所需總 XP) ───────────────────
export const XP_LEVELS = [0, 50, 140, 280]; // level 1=0, level 2=50, level 3=140

// ── 主動法術 ──────────────────────────────────
export const SPELLS = {
  frostwave:  { name: '冰霜之浪', emoji: '❄️', cooldown: 45,  desc: '凍結全場殭屍 3 秒',       unlockWave: 2 },
  sunburst:   { name: '陽光爆發', emoji: '☀️', cooldown: 35,  desc: '獲得 150 陽光',            unlockWave: 1 },
  timewarp:   { name: '時間扭曲', emoji: '⏳', cooldown: 60,  desc: '殭屍減速 50% 持續 8 秒',  unlockWave: 4 },
  plantSwap:  { name: '植物交換', emoji: '🔄', cooldown: 25,  desc: '交換場上兩棵植物位置',     unlockWave: 3 },
  annihilate: { name: '殲滅光束', emoji: '⚡', cooldown: 90,  desc: '消滅血量最低的 3 隻殭屍',  unlockWave: 6 },
};

// ── 混亂事件 ──────────────────────────────────
export const CHAOS_EVENTS = [
  { id: 'meteor',     name: '隕石撞擊',   emoji: '☄️', desc: '隨機 3 格被摧毀',                duration: 0 },
  { id: 'mutation',   name: '殭屍突變',   emoji: '🧬', desc: '場上殭屍隨機獲得 buff',          duration: 12 },
  { id: 'eclipse',    name: '日蝕',       emoji: '🌑', desc: '陽光停止掉落 8 秒',               duration: 8 },
  { id: 'gravity',    name: '重力反轉',   emoji: '🔃', desc: '殭屍移動方向隨機變化',             duration: 6 },
  { id: 'fertile',    name: '肥沃之雨',   emoji: '🌧️', desc: '所有植物攻速 +40% 持續 10 秒',    duration: 10 },
  { id: 'undead',     name: '亡者歸來',   emoji: '👻', desc: '已死的殭屍有 20% 機率復活',       duration: 8 },
  { id: 'sunshower',  name: '陽光暴雨',   emoji: '🌞', desc: '連續降下大量陽光 5 秒',           duration: 5 },
  { id: 'earthquake', name: '大地震',     emoji: '🌋', desc: '隨機兩排的植物被震到旁邊',         duration: 0 },
];

// ── Boss 波次配置 (每 5 波出 Boss) ─────────────
export const BOSS_WAVES = {
  5:  { name: '殭屍隊長',   emoji: '👾', bossHp: 1200, bossSpeed: 0.09, bossBite: 45, adds: ['normal', 'cone'], addCount: 4 },
  10: { name: '殭屍將軍',   emoji: '👹', bossHp: 2200, bossSpeed: 0.10, bossBite: 55, adds: ['bucket', 'splitter'], addCount: 5 },
  15: { name: '殭屍之王',   emoji: '💀', bossHp: 3500, bossSpeed: 0.08, bossBite: 65, adds: ['giant', 'necro'], addCount: 6 },
  20: { name: '世界吞噬者', emoji: '🐉', bossHp: 5000, bossSpeed: 0.07, bossBite: 80, adds: ['giant', 'healer', 'necro'], addCount: 8 },
};

// ── 牌組抽牌池 ─────────────────────────────────
export const DRAFT_POOL = {
  // Tier 1 植物牌 — 出現機率高
  plants_t1: ['peashooter', 'sunflower', 'wallnut', 'spikeweed'],
  // Tier 2 植物牌 — 出現機率中
  plants_t2: ['repeater', 'icepea', 'bomb', 'prism', 'gambler', 'magnet'],
  // Tier 3 植物牌 — 出現機率低
  plants_t3: ['firepea', 'shadowvine', 'thornwall', 'oracle', 'melon'],
  // 強化牌 — 加強已有植物
  mutations: [
    { id: 'rapid',   name: '急速生長', emoji: '⚡', desc: '所有植物攻速 +20%',  type: 'global_buff', stat: 'attackSpeed', value: 0.2 },
    { id: 'tough',   name: '硬殼強化', emoji: '🛡️', desc: '所有植物 HP +25%',   type: 'global_buff', stat: 'hp', value: 0.25 },
    { id: 'sunny',   name: '陽光親和', emoji: '☀️', desc: '陽光收入 +30%',       type: 'global_buff', stat: 'sunIncome', value: 0.3 },
    { id: 'cheap',   name: '打折卡',   emoji: '🏷️', desc: '所有植物費用 -15%',   type: 'global_buff', stat: 'cost', value: -0.15 },
    { id: 'lucky',   name: '幸運草',   emoji: '🍀', desc: '擊殺獎勵 +25%',      type: 'global_buff', stat: 'killReward', value: 0.25 },
    { id: 'regen',   name: '自癒孢子', emoji: '💚', desc: '植物每秒回復 1 HP',   type: 'global_buff', stat: 'regen', value: 1 },
    { id: 'crit',    name: '暴擊精華', emoji: '💥', desc: '10% 機率雙倍傷害',   type: 'global_buff', stat: 'critChance', value: 0.1 },
    { id: 'xpboost', name: '經驗加倍', emoji: '📚', desc: '植物 XP 獲得 +50%',  type: 'global_buff', stat: 'xpMulti', value: 0.5 },
  ],
  // 法術牌 — 解鎖對應法術
  spell_cards: ['frostwave', 'sunburst', 'timewarp', 'plantSwap', 'annihilate'],
};

// ── 起始牌組 ──────────────────────────────────
export const STARTING_DECK = ['peashooter', 'sunflower', 'wallnut'];

// ── 領土常數 ──────────────────────────────────
export const TERRITORY_START_COLS = 5;       // 起始可放置列數
export const TERRITORY_MAX_COLS = 9;         // 棋盤總列數
export const CONQUEST_BASE_COST = 100;        // 佔領基礎花費
export const CONQUEST_SUN_PER_WAVE = 15;      // 每格佔領每波獎勵
export const CONQUEST_DEFENSE_BONUS = 0.05;   // 佔領格防禦加成

// ── 波次殭屍池 ─────────────────────────────────
export function zombieKindForWave(w) {
  const pool = ['normal'];
  if (w >= 2) pool.push('cone');
  if (w >= 3) pool.push('paper');
  if (w >= 4) pool.push('fast');
  if (w >= 5) pool.push('healer');
  if (w >= 6) pool.push('bucket');
  if (w >= 7) pool.push('splitter', 'armored');
  if (w >= 9) pool.push('necro');
 if (w >= 11) pool.push('giant');
 if (w >= 13) pool.push('dancer');
 return pool[Math.floor(Math.random() * pool.length)];
}

// ── 波次殭屍數量 ───────────────────────────────
export function zombiesPerWave(wave, isBoss) {
  const base = Math.min(4 + Math.floor(wave * 1.0), 18);
  return isBoss ? base + 4 : base;
}

// ── 殺敵目標 (每波需要清完才算過關) ─────────────
export const WAVE_KILL_TARGET_BASE = 8; // 每波基礎目標

// ── 難度設定 ──────────────────────────────────
export const DIFFICULTY = {
 easy: {
 name: '簡單',
 startSun: 200,
 sunMultiplier: 1.3,
 zombieHpScale: 0.7,
 zombieSpeedScale: 0.85,
 zombieCountScale: 0.7,
 biteScale: 0.75,
 },
 normal: {
 name: '普通',
 startSun: 100,
 sunMultiplier: 1.0,
 zombieHpScale: 1.0,
 zombieSpeedScale: 1.0,
 zombieCountScale: 1.0,
 biteScale: 1.0,
 },
 hard: {
 name: '困難',
 startSun: 75,
 sunMultiplier: 0.8,
 zombieHpScale: 1.5,
 zombieSpeedScale: 1.15,
 zombieCountScale: 1.3,
 biteScale: 1.25,
 },
};
