// ═══════════════════════════════════════════════
// Relic System — 遺物系統 (跨局持久化)
// ═══════════════════════════════════════════════
// 遺物是跨局永久增益，死亡後可選擇一個遺物帶入下一輪。
// 使用 localStorage 持久化。

const RELIC_STORAGE_KEY = 'pvz_chaos_relics';
const RUN_HISTORY_KEY = 'pvz_chaos_runs';

// ── 遺物定義 ──────────────────────────────────
export const RELICS = {
  // ── 通用遺物 ──
  green_thumb: {
    id: 'green_thumb', name: '綠手指', emoji: '🌿',
    desc: '所有植物起始 XP +15',
    rarity: 'common',
    effect: (state) => { state.relicBuffs.startXpBonus = (state.relicBuffs.startXpBonus || 0) + 15; },
  },
  sun_charm: {
    id: 'sun_charm', name: '陽光護符', emoji: '☀️',
    desc: '起始陽光 +30',
    rarity: 'common',
    effect: (state) => { state.relicBuffs.startSunBonus = (state.relicBuffs.startSunBonus || 0) + 30; },
  },
  iron_root: {
    id: 'iron_root', name: '鐵根', emoji: '🦴',
    desc: '所有植物 HP +8%',
    rarity: 'common',
    effect: (state) => { state.relicBuffs.hpPercent = (state.relicBuffs.hpPercent || 0) + 0.08; },
  },
  swift_seed: {
    id: 'swift_seed', name: '疾風籽', emoji: '💨',
    desc: '植物冷卻 -10%',
    rarity: 'common',
    effect: (state) => { state.relicBuffs.cooldownReduction = (state.relicBuffs.cooldownReduction || 0) + 0.10; },
  },
  lucky_clover: {
    id: 'lucky_clover', name: '四葉草', emoji: '🍀',
    desc: '混沌事件觸發間隔 +20%（更少壞事）',
    rarity: 'common',
    effect: (state) => { state.relicBuffs.chaosDelay = (state.relicBuffs.chaosDelay || 0) + 0.20; },
  },

  // ── 稀有遺物 ──
  chaos_pearl: {
    id: 'chaos_pearl', name: '混沌珍珠', emoji: '🔮',
    desc: '混沌事件有 25% 機率反轉為正面效果',
    rarity: 'rare',
    effect: (state) => { state.relicBuffs.chaosInvertChance = (state.relicBuffs.chaosInvertChance || 0) + 0.25; },
  },
  blood_pact: {
    id: 'blood_pact', name: '血之契約', emoji: '🩸',
    desc: '每波開始 +50 陽光，但植物 HP -5%',
    rarity: 'rare',
    effect: (state) => { state.relicBuffs.waveSunBonus = (state.relicBuffs.waveSunBonus || 0) + 50; state.relicBuffs.hpPercent = (state.relicBuffs.hpPercent || 0) - 0.05; },
  },
  echo_crystal: {
    id: 'echo_crystal', name: '迴響水晶', emoji: '💎',
    desc: '每局保留一張上次跑局最後抽到的牌', // TODO: 需接上 draft 系統
    rarity: 'rare',
    effect: (state) => { state.relicBuffs.keepOneCard = true; },
  },
  war_drum: {
    id: 'war_drum', name: '戰鼓', emoji: '🥁',
    desc: '植物攻速 +15%，殭屍攻速 +8%',
    rarity: 'rare',
    effect: (state) => { state.relicBuffs.attackSpeed = (state.relicBuffs.attackSpeed || 0) + 0.15; state.relicBuffs.zombieSpeedBoost = (state.relicBuffs.zombieSpeedBoost || 0) + 0.08; },
  },

  // ── 傳說遺物 ──
  world_seed: {
    id: 'world_seed', name: '世界樹種子', emoji: '🌳',
    desc: '所有植物每 3 波自動進化一級（上限 Lv.3）',
    rarity: 'legendary',
    effect: (state) => { state.relicBuffs.autoEvolveInterval = 3; },
  },
  void_mirror: {
    id: 'void_mirror', name: '虛空之鏡', emoji: '🪞',
    desc: '混沌馴服率 +30%（更易馴服混沌事件）',
    rarity: 'legendary',
    effect: (state) => { state.relicBuffs.harnessBonus = (state.relicBuffs.harnessBonus || 0) + 0.30; },
  },
  phoenix_feather: {
    id: 'phoenix_feather', name: '鳳凰羽毛', emoji: '🪶',
    desc: '首次死亡時自動復活（每局一次），HP 恢復 50%',
    rarity: 'legendary',
    effect: (state) => { state.relicBuffs.phoenixRevive = true; },
  },
  titan_shard: {
    id: 'titan_shard', name: '泰坦碎片', emoji: '⚔️',
    desc: '領土推進費用 -30%，佔領獎勵 +50%',
    rarity: 'legendary',
    effect: (state) => { state.relicBuffs.territoryCostReduction = (state.relicBuffs.territoryCostReduction || 0) + 0.30; state.relicBuffs.territoryRewardBonus = (state.relicBuffs.territoryRewardBonus || 0) + 0.50; },
  },
};

// ── 遺物稀有度權重 ────────────────────────────
const RARITY_WEIGHTS = {
  common: 55,
  rare: 32,
  legendary: 13,
};

const RARITY_COLORS = {
  common: '#94a3b8',
  rare: '#8b5cf6',
  legendary: '#f59e0b',
};

export function getRarityColor(rarity) { return RARITY_COLORS[rarity] || '#94a3b8'; }

// ── localStorage 操作 ─────────────────────────

export function loadRelics() {
  try {
    const data = localStorage.getItem(RELIC_STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch { return []; }
}

export function saveRelics(relics) {
  localStorage.setItem(RELIC_STORAGE_KEY, JSON.stringify(relics));
}

export function loadRunHistory() {
  try {
    const data = localStorage.getItem(RUN_HISTORY_KEY);
    return data ? JSON.parse(data) : [];
  } catch { return []; }
}

export function saveRunHistory(history) {
  localStorage.setItem(RUN_HISTORY_KEY, JSON.stringify(history));
}

export function recordRun(state) {
  const history = loadRunHistory();
  history.push({
    wave: state.wave,
    kills: state.totalKills,
    deckSize: state.deck.length,
    relics: loadRelics().length,
    timestamp: Date.now(),
  });
  // 只保留最近 50 局
  if (history.length > 50) history.splice(0, history.length - 50);
  saveRunHistory(history);
}

// ── 遺物選擇 ──────────────────────────────────

export function generateRelicChoices() {
  const owned = new Set(loadRelics());
  const available = Object.values(RELICS).filter(r => !owned.has(r.id));

  if (available.length === 0) return [];

  // 依稀有度加權抽取
  const weighted = [];
  for (const relic of available) {
    const weight = RARITY_WEIGHTS[relic.rarity] || 30;
    for (let i = 0; i < weight; i++) weighted.push(relic);
  }

  // 隨機選 3 個不重複
  const choices = [];
  const used = new Set();
  while (choices.length < 3 && choices.length < available.length) {
    const pick = weighted[Math.floor(Math.random() * weighted.length)];
    if (!used.has(pick.id)) {
      used.add(pick.id);
      choices.push(pick);
    }
  }

  return choices;
}

export function chooseRelic(relicId) {
  const relics = loadRelics();
  if (!relics.includes(relicId)) {
    relics.push(relicId);
    saveRelics(relics);
  }
}

// ── 遺物效果應用 ──────────────────────────────

export function applyRelicBuffs(state) {
  const relics = loadRelics();
  state.relicBuffs = {
    startXpBonus: 0,
    startSunBonus: 0,
    hpPercent: 0,
    cooldownReduction: 0,
    chaosDelay: 0,
    chaosInvertChance: 0,
    waveSunBonus: 0,
    keepOneCard: false,
    attackSpeed: 0,
    zombieSpeedBoost: 0,
    autoEvolveInterval: 0,
    harnessBonus: 0,
    phoenixRevive: false,
    territoryCostReduction: 0,
    territoryRewardBonus: 0,
  };

  for (const id of relics) {
    const relic = RELICS[id];
    if (relic && relic.effect) relic.effect(state);
  }
}

// ── 鳳凰復活 ──────────────────────────────────

export function checkPhoenixRevive(state) {
  if (state.relicBuffs.phoenixRevive && !state.phoenixUsed) {
    state.phoenixUsed = true;
    // 恢復所有植物 HP 到 50%
    for (const [key, plant] of state.plants) {
      plant.hp = Math.round(plant.maxHp * 0.5);
    }
    // 殺掉場上所有殭屍
    state.zombies = [];
    return true;
  }
  return false;
}
