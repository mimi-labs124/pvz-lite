// ═══════════════════════════════════════════════
// Territory System — 領土推進系統 v2
// ═══════════════════════════════════════════════
// 特殊格位：日光井、防禦塔、加速帶
// 佔領策略決定你的增益方向

import { cellKey } from '../core/helpers.js';

// ── 特殊格位類型 ──────────────────────────────
export const TERRAIN_TYPES = {
  sun_well: {
    id: 'sun_well', name: '日光井', emoji: '☀️',
    desc: '每波 +30 陽光',
    color: 'rgba(250, 204, 21, .2)',
    borderColor: 'rgba(250, 204, 21, .5)',
    waveBonus: 30,    // 每波陽光獎勵
    defenseBonus: 0,
    attackSpeedBonus: 0,
  },
  watchtower: {
    id: 'watchtower', name: '防禦塔', emoji: '🗼',
    desc: '該格植物 HP +20%，攻速 +15%',
    color: 'rgba(59, 130, 246, .2)',
    borderColor: 'rgba(59, 130, 246, .5)',
    waveBonus: 0,
    defenseBonus: 0.20,   // HP 加成
    attackSpeedBonus: 0.15, // 攻速加成
  },
  speed_lane: {
    id: 'speed_lane', name: '加速帶', emoji: '⚡',
    desc: '該排所有植物攻速 +10%',
    color: 'rgba(34, 211, 238, .2)',
    borderColor: 'rgba(34, 211, 238, .5)',
    waveBonus: 0,
    defenseBonus: 0,
    attackSpeedBonus: 0,     // 自身不加
    rowAttackSpeedBonus: 0.10, // 整排加成
  },
 fortress: {
 id: 'fortress', name: '堡壘', emoji: '🏰',
 desc: '該格植物 HP +40%，反傷 +5',
 color: 'rgba(168, 85, 247, .2)',
 borderColor: 'rgba(168, 85, 247, .5)',
 waveBonus: 0,
 defenseBonus: 0.40,
 attackSpeedBonus: 0,
 reflectBonus: 5,
 },
 poison_swamp: {
 id: 'poison_swamp', name: '毒沼', emoji: '☠️',
 desc: '佔領後殭屍經過減速且每秒受傷',
 color: 'rgba(132, 204, 22, .22)',
 borderColor: 'rgba(132, 204, 22, .5)',
 waveBonus: 0,
 defenseBonus: 0,
 attackSpeedBonus: 0,
 poisonSlow: 0.4,
 poisonDps: 6,
 },
 altar: {
 id: 'altar', name: '聖壇', emoji: '🛐',
 desc: '佔領後該格植物 XP 獲取翻倍',
 color: 'rgba(250, 204, 21, .18)',
 borderColor: 'rgba(250, 204, 21, .5)',
 waveBonus: 15,
 defenseBonus: 0,
 attackSpeedBonus: 0,
 xpMulti: 1.0,
 },
};

// ── 地形生成 ──────────────────────────────────
// 每局隨機生成地形，讓每次領土佈局不同
export function generateTerrain(rows, cols, startPlayableCols) {
  const terrain = {}; // cellKey → terrain type id
  for (let r = 0; r < rows; r++) {
    for (let c = startPlayableCols; c < cols - 1; c++) {
      // 35% 機率有特殊地形
      if (Math.random() < 0.35) {
 const types = Object.keys(TERRAIN_TYPES);
 const weights = [30, 20, 15, 10, 15, 10]; // sun_well > poison > speed > altar > watchtower > fortress
        const total = weights.reduce((a, b) => a + b, 0);
        let roll = Math.random() * total;
        let chosen = types[0];
        for (let i = 0; i < types.length; i++) {
          roll -= weights[i];
          if (roll <= 0) { chosen = types[i]; break; }
        }
        terrain[cellKey(r, c)] = chosen;
      }
    }
  }
  return terrain;
}

// ── 領土常數 ──────────────────────────────────
export const TERRITORY = {
  startPlayableCols: 5,
  zombieSpawnCol: 8,
  baseConquestCost: 80,
  territorySunPerWave: 10,
  territoryDefenseBonus: 0.05,
};

// ── 計算佔領費用 ──────────────────────────────
export function conquestCost(state, col) {
  const base = TERRITORY.baseConquestCost;
  const distanceCost = (col - TERRITORY.startPlayableCols) * 30;
  const waveScale = 1 + state.wave * 0.04;
  const total = Math.round((base + distanceCost) * waveScale);
  const reduction = state.relicBuffs?.territoryCostReduction || 0;
  return Math.round(total * (1 - reduction));
}

// ── 佔領獎勵 ────────────────────────────────
export function conquestReward(state) {
  const base = TERRITORY.territorySunPerWave;
  const bonus = state.relicBuffs?.territoryRewardBonus || 0;
  return Math.round(base * (1 + bonus));
}

// ── 初始化領土狀態 ────────────────────────────
export function initTerritory(state) {
 state.territory = {
 frontline: TERRITORY.startPlayableCols,
 conquered: new Set(),
 maxCol: 8,
 terrain: generateTerrain(rows, 9, 3), // 從第3列開始生成地形（更早的地形更豐富）
 };
}

const rows = 5; // 用常數避免循環 import

// ── 取得格位地形 ──────────────────────────────
export function getCellTerrain(state, r, c) {
  const key = cellKey(r, c);
  const terrainId = state.territory?.terrain?.[key];
  if (!terrainId) return null;
  return TERRAIN_TYPES[terrainId] || null;
}

// ── 嘗試開始佔領一格（漸進式） ──────────────────
export function tryConquest(state, row, col) {
 const playableCols = getPlayableCols(state);
 if (col >= playableCols) return { ok: false, msg: '尚未開放！繼續推進波次來解鎖' };
 const key = cellKey(row, col);
 if (state.territory.conquered.has(key)) return { ok: false, msg: '已佔領' };
 // 如果該格正在佔領中
 if (state.territory.conquering?.key === key) return { ok: false, msg: '正在佔領中...' };

 // 如果有特殊地形才需要花陽光佔領
 const terrain = getCellTerrain(state, row, col);
 if (!terrain) return { ok: false, msg: '這格沒有特殊地形，不需要佔領' };

 const cost = conquestCost(state, col);
 if (state.sun < cost) return { ok: false, msg: `陽光不足（需要 ${cost}）` };

 // 開始佔領：扣陽光、設置佔領進度
 state.sun -= cost;
 state.territory.conquering = { key, row, col, progress: 0, total: 3, terrain };

 return { ok: true, msg: `開始佔領 ${terrain.emoji} ${terrain.name}（3 秒）`, started: true };
}

// ── 更新佔領進度 ──────────────────────────────
export function updateConquestProgress(state, dt) {
 const c = state.territory?.conquering;
 if (!c) return;

 c.progress += dt;
 if (c.progress >= c.total) {
 // 佔領完成
 state.territory.conquered.add(c.key);
 const col = c.col;
 const terrain = c.terrain;
 state.territory.conquering = null;

 // 檢查是否整列都佔領了
 let allConquered = true;
 for (let r = 0; r < 5; r++) {
 if (!state.territory.conquered.has(cellKey(r, col))) { allConquered = false; break; }
 }

 if (allConquered) {
 state.territory.frontline = Math.max(state.territory.frontline, col + 1);
 return { completed: true, advanced: true, msg: `🗡️ 前線推進到第 ${col + 1} 列！` };
 }

 return { completed: true, advanced: false, msg: `佔領完成！（${terrain?.emoji} ${terrain?.name}）` };
 }
 return { completed: false, progress: c.progress / c.total };
}

// ── 波次結束時的領土獎勵 ──────────────────────
export function territoryWaveReward(state) {
  if (!state.territory || state.territory.conquered.size === 0) return 0;
  let reward = 0;
  for (const key of state.territory.conquered) {
    const baseReward = conquestReward(state);
    // 地形加成
    const [r, c] = key.split('-').map(Number);
    const terrain = getCellTerrain(state, r, c);
    const terrainBonus = terrain?.waveBonus || 0;
    reward += baseReward + terrainBonus;
  }
  state.sun += reward;
  return reward;
}

// ── 檢查格子是否可放置 ──────────────────────
// 隨波次自動開放更多列 + 領土前線推進 + 殭屍壓力收縮
export function getPlayableCols(state) {
 if (!state.territory) return 5;
 const wave = state.wave || 1;
 // 波次基礎開放
 let base = 5;
 if (wave >= 3) base = 6;
 if (wave >= 6) base = 7;
 if (wave >= 10) base = 8;
 // 前線推進加成（佔領推進了前線）
 const frontlineBonus = Math.max(0, (state.territory.frontline || 5) - 5);
 // 殭屍壓力收縮（殭屍深入到哪一列，那一列就不可用）
 const zombiePressure = state.territory.zombiePressureCol || 99;
 const maxFromZombies = zombiePressure;
 return Math.max(5, Math.min(base + frontlineBonus, maxFromZombies, 9));
}

export function isCellPlayable(state, col) {
 return col < getPlayableCols(state);
}

// ── 檢查是否為佔領格 ──────────────────────────
export function isConqueredCell(state, row, col) {
  if (!state.territory) return false;
  return state.territory.conquered.has(cellKey(row, col));
}

// ── 佔領格防禦加成（含地形）──────────────────
export function territoryDefenseMultiplier(state, row, col) {
  if (!isConqueredCell(state, row, col)) return 1.0;
  const terrain = getCellTerrain(state, row, col);
  const base = 1.0 + TERRITORY.territoryDefenseBonus;
  const terrainBonus = terrain?.defenseBonus || 0;
  return base + terrainBonus;
}

// ── 佔領格攻速加成 ──────────────────────────
export function territoryAttackSpeedBonus(state, row, col) {
  if (!isConqueredCell(state, row, col)) return 0;
  const terrain = getCellTerrain(state, row, col);
  return terrain?.attackSpeedBonus || 0;
}

// ── 整排攻速加成（加速帶）────────────────────
export function territoryRowAttackSpeedBonus(state, row) {
  if (!state.territory) return 0;
  let bonus = 0;
  for (const key of state.territory.conquered) {
    const [r, c] = key.split('-').map(Number);
    if (r === row) {
      const terrain = getCellTerrain(state, r, c);
      if (terrain?.rowAttackSpeedBonus) bonus += terrain.rowAttackSpeedBonus;
    }
  }
  return bonus;
}

// ── 反傷加成（堡壘）───────────────────────────
export function territoryReflectBonus(state, row, col) {
  if (!isConqueredCell(state, row, col)) return 0;
  const terrain = getCellTerrain(state, row, col);
  return terrain?.reflectBonus || 0;
}

// ── 自動佔領（每 3 波）──────────────────────
export function autoConquestCheck(state) {
  if (!state.territory) return null;
  if (state.wave % 3 !== 0) return null;
  if (state.territory.frontline >= TERRITORY.zombieSpawnCol) return null;

  const col = state.territory.frontline;
  const available = [];
  for (let r = 0; r < 5; r++) {
    if (!state.territory.conquered.has(cellKey(r, col))) available.push(r);
  }
  if (available.length === 0) return null;

  const row = available[Math.floor(Math.random() * available.length)];
  state.territory.conquered.add(cellKey(row, col));

  let allConquered = true;
  for (let r = 0; r < 5; r++) {
    if (!state.territory.conquered.has(cellKey(r, col))) { allConquered = false; break; }
  }
  if (allConquered) {
    state.territory.frontline = col + 1;
    return { row, col, advanced: true };
  }
  return { row, col, advanced: false };
}
