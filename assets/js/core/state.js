import { rows, XP_LEVELS, TERRITORY_START_COLS } from '../config.js';

export function createRunState() {
  return {
    // ── 跑局狀態 ──
    runActive: true,
    wave: 1,
    maxWaveReached: 1,
    totalKills: 0,

    // ── 經濟 ──
    sun: 100,
    kills: 0,

    // ── 牌組系統 ──
    deck: ['peashooter', 'sunflower', 'wallnut'],
    selectedPlant: 'peashooter',
    unlockedSpells: [],

    // ── 全局 Buff ──
    globalBuffs: {
      attackSpeed: 0,
      hp: 0,
      sunIncome: 0,
      cost: 0,
      killReward: 0,
      regen: 0,
      critChance: 0,
      xpMulti: 0,
    },

    // ── 場上實體 ──
    plants: new Map(),
    zombies: [],
    peas: [],
    suns: [],
    booms: [],

    // ── 割草機 ──
    lawnmowers: Array.from({ length: rows }, (_, row) => ({ row, x: -0.25, active: false, used: false })),

    // ── 計時器 ──
    spawnTimer: 0,
    sunTimer: 0,
    cooldowns: {},

    // ── 波次狀態 ──
    waveActive: false,
    waveZombiesRemaining: 0,
    waveKills: 0,
    waveKillTarget: 0,
    spawnQueue: [],

    // ── Boss ──
    isBossWave: false,
    bossActive: false,

    // ── Draft 階段 ──
    draftPhase: false,
    draftCards: [],
    draftRerolls: 1,

    // ── Combo 系統 ──
    comboCount: 0,
    comboTimer: 0,
    maxCombo: 0,

    // ── 法術 ──
    spellCooldowns: {},

    // ── 混亂事件 ──
    chaosEvent: null,
    chaosTimer: 0,
    chaosCooldown: 0,
    nextChaosAt: 15 + Math.random() * 10,

    // ── 修飾器 ──
    modifier: 'normal',
    modifierTimer: 0,
    modifierWave: 0,

    // ── 遺物系統 (Chaos Awakening) ──
    relicBuffs: {},
    phoenixUsed: false,
    relicPhase: false,
    relicChoices: [],

    // ── 混沌馴服 (Chaos Awakening) ──
    chaosHarnessed: false,
    harnessEffect: null,
    shieldTimer: 0,

    // ── 領土系統 (Chaos Awakening) ──
 territory: {
 frontline: TERRITORY_START_COLS,
 conquered: new Set(),
 maxCol: 8,
 conquering: null, // 當前佔領進度 { key, row, col, progress, total }
 },
    // 佔領模式已移除（改為自動佔領）
 shovelMode: false, // 是否正在鏟子模式
 upgradeCount: 0, // 陽光升級次數
 gameSpeed: 1, // 遊戲速度 1x/1.5x/2x
 difficulty: 'normal', // 難度設定
 sunMultiplier: 1, // 陽光乘數（由難度決定）
 autoSunTimer: 0, // 自動收集計時器

    // ── 遊戲結束 ──
    gameOver: false,
    gameWon: false,

    // ── ID 計數 ──
    nextZombieId: 1,
    nextSunId: 1,
  };
}

export function initCooldowns(state) {
  state.cooldowns = {};
  for (const k of state.deck) {
    state.cooldowns[k] = 0;
  }
  return state;
}

export function initSpellCooldowns(state, spells) {
  state.spellCooldowns = {};
  for (const s of state.unlockedSpells) {
    state.spellCooldowns[s] = 0;
  }
  return state;
}

// 計算植物實際 XP 與等級
export function getPlantLevel(xp) {
  for (let i = XP_LEVELS.length - 1; i >= 0; i--) {
    if (xp >= XP_LEVELS[i]) return i + 1;
  }
  return 1;
}

// 給植物加 XP
export function addPlantXP(state, plantKey, amount) {
  const plant = state.plants.get(plantKey);
  if (!plant) return false;
  const xpMulti = 1 + (state.globalBuffs.xpMulti || 0);
  const oldLevel = getPlantLevel(plant.xp || 0);
  plant.xp = (plant.xp || 0) + Math.round(amount * xpMulti);
  const newLevel = getPlantLevel(plant.xp);
  if (newLevel > oldLevel) {
    plant.level = newLevel;
    return true; // 進化了!
  }
  return false;
}
