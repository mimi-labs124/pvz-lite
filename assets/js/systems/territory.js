// ═══════════════════════════════════════════════
// Territory System — 自動佔領 + 殭屍增傷 v3
// ═══════════════════════════════════════════════
// 殭屍在未佔領土地巨額強化
// 交界處沒殭屍 → 自動佔領進度增加
// 有殭屍 → 佔領進度減少（殭屍奪回）
// 前 3 列永遠安全（不會被占走）

import { cellKey } from '../core/helpers.js';

// ── 特殊格位類型 ──────────────────────────────
export const TERRAIN_TYPES = {
	sun_well: {
		id: 'sun_well', name: '日光井', emoji: '☀️',
		desc: '每波 +30 陽光',
		color: 'rgba(250, 204, 21, .2)',
		borderColor: 'rgba(250, 204, 21, .5)',
		waveBonus: 30,
		defenseBonus: 0,
		attackSpeedBonus: 0,
	},
	watchtower: {
		id: 'watchtower', name: '防禦塔', emoji: '🗼',
		desc: '該格植物 HP +20%，攻速 +15%',
		color: 'rgba(59, 130, 246, .2)',
		borderColor: 'rgba(59, 130, 246, .5)',
		waveBonus: 0,
		defenseBonus: 0.20,
		attackSpeedBonus: 0.15,
	},
	speed_lane: {
		id: 'speed_lane', name: '加速帶', emoji: '⚡',
		desc: '該排所有植物攻速 +10%',
		color: 'rgba(34, 211, 238, .2)',
		borderColor: 'rgba(34, 211, 238, .5)',
		waveBonus: 0,
		defenseBonus: 0,
		attackSpeedBonus: 0,
		rowAttackSpeedBonus: 0.10,
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

// ── 領土常數 ──────────────────────────────────
export const TERRITORY = {
	safeCols: 3,            // 前 3 列永遠安全，不可被殭屍佔走
	startPlayableCols: 5,
	zombieSpawnCol: 8,
	baseConquestCost: 80,
	territorySunPerWave: 10,
	territoryDefenseBonus: 0.05,
	conquestSpeed: 12,      // 每秒佔領進度 (%)
	zombiePushSpeed: 8,     // 殭屍每秒奪回進度 (%)
};

// ── 殭屍在未佔領地的增傷倍率 ──────────────────
export const ZOMBIE_UNCONQUERED_BUFFS = {
	hpMult: 2.0,        // HP x2
	speedMult: 1.3,     // 速度 +30%
	biteMult: 1.5,      // 咬傷 +50%
};

const ROWS = 5;

// ── 地形生成 ──────────────────────────────────
export function generateTerrain(rows, cols, startPlayableCols) {
	const terrain = {};
	for (let r = 0; r < rows; r++) {
		for (let c = startPlayableCols; c < cols - 1; c++) {
			if (Math.random() < 0.35) {
				const types = Object.keys(TERRAIN_TYPES);
				const weights = [30, 20, 15, 10, 15, 10];
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

// ── 計算佔領費用（保留給其他系統用）──────────────
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
		terrain: generateTerrain(ROWS, 9, TERRITORY.safeCols),
		columnProgress: {}, // col → progress (0-100)
	};

	// 前 3 列的所有格子初始就是已佔領的
	for (let r = 0; r < ROWS; r++) {
		for (let c = 0; c < TERRITORY.safeCols; c++) {
			state.territory.conquered.add(cellKey(r, c));
		}
	}
}

// ── 取得格位地形 ──────────────────────────────
export function getCellTerrain(state, r, c) {
	const key = cellKey(r, c);
	const terrainId = state.territory?.terrain?.[key];
	if (!terrainId) return null;
	return TERRAIN_TYPES[terrainId] || null;
}

// ── 嘗試佔領（保留但不再手動觸發）──────────────
export function tryConquest(state, row, col) {
	return { ok: false, msg: '佔領現為自動進行' };
}

// ── 自動佔領進度更新（核心新邏輯）──────────────
// 規則：
// 1. 只有前線交界處的列才處理佔領（frontline 和 frontline-1）
// 2. 未佔領的格子：該列「沒有殭屍」且「前一列有已佔領格子」時才推進
// 3. 已佔領的格子：有殭屍在該列時會被奪回（但安全區永不失去）
// 4. 殭屍在未佔領地 HP×2、速度+30%、咬傷+50%
export function updateAutoConquest(state, dt) {
	if (!state.territory) return [];
	const messages = [];
	const frontline = state.territory.frontline || TERRITORY.startPlayableCols;

	// 只處理前線交界列（frontline 列本身）
	const targetCol = frontline;
	if (targetCol >= 9 || targetCol < TERRITORY.safeCols) return messages;

	// 前一列是否有已佔領格子（作為佔領的基礎條件）
	const prevCol = targetCol - 1;
	let prevColHasConquered = false;
	if (prevCol < TERRITORY.safeCols) {
		prevColHasConquered = true; // 安全区算已佔領
	} else {
		for (let r = 0; r < ROWS; r++) {
			if (state.territory.conquered.has(cellKey(r, prevCol))) {
				prevColHasConquered = true;
				break;
			}
		}
	}

	// 該列是否有殭屍
	const zombiesInCol = state.zombies.filter(z => {
		const zCol = Math.round(z.x);
		return zCol === targetCol || zCol === targetCol - 1;
	});
	const hasZombies = zombiesInCol.length > 0;

	for (let r = 0; r < ROWS; r++) {
		const key = cellKey(r, targetCol);
		const isConquered = state.territory.conquered.has(key);

		if (isConquered) {
			// 已佔領：殭屍在附近時可能被奪回（安全區例外）
			if (hasZombies && targetCol >= TERRITORY.safeCols) {
				if (!state.territory.columnProgress[key]) state.territory.columnProgress[key] = 0;
				state.territory.columnProgress[key] -= dt * TERRITORY.zombiePushSpeed;
				if (state.territory.columnProgress[key] <= -100) {
					state.territory.conquered.delete(key);
					state.territory.columnProgress[key] = 0;
					messages.push({ type: 'lost', row: r, col: targetCol, msg: `🧟 第 ${targetCol + 1} 列失去佔領！` });
				}
			} else {
				// 沒殭屍，恢復進度
				state.territory.columnProgress[key] = Math.min(0, (state.territory.columnProgress[key] || 0) + dt * 5);
			}
		} else {
			// 未佔領：需要前一列已佔領 且 該列沒殭屍才能推進
			if (!state.territory.columnProgress[key]) state.territory.columnProgress[key] = 0;

			if (!hasZombies && prevColHasConquered) {
				// 沒殭屍 + 前一列已佔領 → 佔領進度增加（較慢）
				state.territory.columnProgress[key] += dt * TERRITORY.conquestSpeed * 0.6;
				if (state.territory.columnProgress[key] >= 100) {
					state.territory.conquered.add(key);
					state.territory.columnProgress[key] = 0;
					messages.push({ type: 'conquered', row: r, col: targetCol, msg: `🗡️ 第 ${targetCol + 1} 列佔領成功！` });
				}
			} else if (hasZombies) {
				// 有殭屍 → 佔領進度減少
				state.territory.columnProgress[key] = Math.max(0, state.territory.columnProgress[key] - dt * TERRITORY.zombiePushSpeed);
			}
			// 沒殭屍但前一列也沒佔領 → 不推進也不減少（靜止）
		}
	}

	// 檢查該列是否全部佔領 → 推進前線
	let allConquered = true;
	for (let r = 0; r < ROWS; r++) {
		if (!state.territory.conquered.has(cellKey(r, targetCol))) {
			allConquered = false;
			break;
		}
	}
	if (allConquered && targetCol >= state.territory.frontline) {
		state.territory.frontline = Math.max(state.territory.frontline, targetCol + 1);
	}

	return messages;
}

// ── 殭屍佔領地盤推進（保留但簡化）──────────────
export function zombieTerritoryPush(state, dt) {
	// 由 updateAutoConquest 處理，此函數保留為空
}

// ── 波次結束時的領土獎勵 ──────────────────────
export function territoryWaveReward(state) {
	if (!state.territory || state.territory.conquered.size === 0) return 0;
	let reward = 0;
	for (const key of state.territory.conquered) {
		const baseReward = conquestReward(state);
		const [r, c] = key.split('-').map(Number);
		const terrain = getCellTerrain(state, r, c);
		const terrainBonus = terrain?.waveBonus || 0;
		reward += baseReward + terrainBonus;
	}
	state.sun += reward;
	return reward;
}

// ── 檢查格子是否可放置 ──────────────────────
export function getPlayableCols(state) {
	if (!state.territory) return 5;
	const wave = state.wave || 1;
	let base = 5;
	if (wave >= 3) base = 6;
	if (wave >= 6) base = 7;
	if (wave >= 10) base = 8;
	const frontlineBonus = Math.max(0, (state.territory.frontline || 5) - 5);
	const zombiePressure = state.territory.zombiePressureCol || 99;
	return Math.max(5, Math.min(base + frontlineBonus, zombiePressure, 9));
}

export function isCellPlayable(state, col) {
	return col < getPlayableCols(state);
}

// ── 檢查是否為佔領格 ──────────────────────────
export function isConqueredCell(state, row, col) {
	if (!state.territory) return false;
	return state.territory.conquered.has(cellKey(row, col));
}

// ── 佔領格防禦加成 ──────────────────────────
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

// ── 整排攻速加成 ──────────────────────────────
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

// ── 反傷加成 ──────────────────────────────────
export function territoryReflectBonus(state, row, col) {
	if (!isConqueredCell(state, row, col)) return 0;
	const terrain = getCellTerrain(state, row, col);
	return terrain?.reflectBonus || 0;
}

// ── 自動佔領（每 3 波）— 改為由 updateAutoConquest 處理 ──
export function autoConquestCheck(state) {
	return null;
}

// ── 更新佔領進度（保留接口，由 updateAutoConquest 處理）──
export function updateConquestProgress(state, dt) {
	return null;
}
