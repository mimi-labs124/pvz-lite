// ═══════════════════════════════════════════════
// Territory System — 領土推進系統
// ═══════════════════════════════════════════════
// 玩家可以花費陽光佔領前線格子，擴展可放置區域。
// 佔領的領土會產生陽光或提供防禦加成。
// 每成功防禦一波，可以推進前線。

import { cellKey } from '../core/helpers.js';

// ── 領土常數 ──────────────────────────────────
export const TERRITORY = {
  // 起始可放置列數（原本的左邊區域）
  startPlayableCols: 5,   // col 0-4 一開始可以放植物
  // 殭屍出生區域
  zombieSpawnCol: 8,
  // 每次佔領花費
  baseConquestCost: 100,
  // 佔領獎勵：每個佔領格每波結束給予的陽光
  territorySunPerWave: 15,
  // 佔領格防禦加成
  territoryDefenseBonus: 0.05, // HP +5% per territory cell
};

// ── 計算佔領費用 ──────────────────────────────
export function conquestCost(state, col) {
  const base = TERRITORY.baseConquestCost;
  // 越深入越貴
  const distanceCost = (col - TERRITORY.startPlayableCols) * 40;
  // 波次加成
  const waveScale = 1 + state.wave * 0.05;
  const total = Math.round((base + distanceCost) * waveScale);

  // 遺物減免
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
  const maxCol = 8; // 棋盤最大列
  state.territory = {
    // 前線列：當前可放置的最右邊列（不含）
    frontline: TERRITORY.startPlayableCols,
    // 已佔領的格子
    conquered: new Set(),
    // 佔領格子的行（所有行都可以佔）
    maxCol,
  };
}

// ── 嘗試佔領一格 ──────────────────────────────
export function tryConquest(state, row, col) {
  // 只能佔領前線下一列
  if (col !== state.territory.frontline) return { ok: false, msg: '只能佔領前線下一列' };
  // 不能超過殭屍出生區
  if (col >= TERRITORY.zombieSpawnCol) return { ok: false, msg: '無法佔領殭屍出生區' };
  // 已經佔領過
  if (state.territory.conquered.has(cellKey(row, col))) return { ok: false, msg: '已佔領' };

  const cost = conquestCost(state, col);
  if (state.sun < cost) return { ok: false, msg: `陽光不足（需要 ${cost}）` };

  // 執行佔領
  state.sun -= cost;
  state.territory.conquered.add(cellKey(row, col));

  // 檢查是否整列都佔領了（推進前線）
  const allRowConquered = true;
  let allConquered = true;
  for (let r = 0; r < 5; r++) {
    if (!state.territory.conquered.has(cellKey(r, col))) {
      allConquered = false;
      break;
    }
  }

  if (allConquered) {
    state.territory.frontline = col + 1;
    return { ok: true, msg: `🗡️ 前線推進到第 ${col + 1} 列！`, advanced: true };
  }

  return { ok: true, msg: `佔領成功！（${state.territory.conquered.size} 格已佔領）`, advanced: false };
}

// ── 波次結束時的領土獎勵 ──────────────────────
export function territoryWaveReward(state) {
  if (!state.territory || state.territory.conquered.size === 0) return 0;
  const reward = conquestReward(state) * state.territory.conquered.size;
  state.sun += reward;
  return reward;
}

// ── 檢查格子是否可放置 ──────────────────────
export function isCellPlayable(state, col) {
  if (!state.territory) return col < 5; // fallback
  return col < state.territory.frontline;
}

// ── 檢查是否為佔領格 ──────────────────────────
export function isConqueredCell(state, row, col) {
  if (!state.territory) return false;
  return state.territory.conquered.has(cellKey(row, col));
}

// ── 佔領格防禦加成 ──────────────────────────
export function territoryDefenseMultiplier(state, row, col) {
  if (!isConqueredCell(state, row, col)) return 1.0;
  return 1.0 + TERRITORY.territoryDefenseBonus;
}

// ── 自動推進（波次獎勵）──────────────────────
// 每防禦 3 波，自動佔領前線一個隨機格子
export function autoConquestCheck(state) {
  if (!state.territory) return null;
  if (state.wave % 3 !== 0) return null;
  if (state.territory.frontline >= TERRITORY.zombieSpawnCol) return null;

  const col = state.territory.frontline;
  // 找還沒佔領的行
  const available = [];
  for (let r = 0; r < 5; r++) {
    if (!state.territory.conquered.has(cellKey(r, col))) {
      available.push(r);
    }
  }
  if (available.length === 0) return null;

  const row = available[Math.floor(Math.random() * available.length)];
  state.territory.conquered.add(cellKey(row, col));

  // 檢查是否整列完成
  let allConquered = true;
  for (let r = 0; r < 5; r++) {
    if (!state.territory.conquered.has(cellKey(r, col))) {
      allConquered = false;
      break;
    }
  }
  if (allConquered) {
    state.territory.frontline = col + 1;
    return { row, col, advanced: true };
  }

  return { row, col, advanced: false };
}
