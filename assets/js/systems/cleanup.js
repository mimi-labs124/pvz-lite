import { ZOMBIES } from '../config.js';
import { getPlantLevel, addPlantXP } from '../core/state.js';
import { applyEvolutionToPlant } from './evolution.js';
import { chaosUndeadCheck } from './chaos.js';
import { TERRAIN_TYPES } from './territory.js';

export function cleanupState(state, dt) {
	// 冷卻
	for (const k of Object.keys(state.cooldowns)) {
		state.cooldowns[k] = Math.max(0, state.cooldowns[k] - dt);
	}

	// 法術冷卻
	for (const k of Object.keys(state.spellCooldowns || {})) {
		state.spellCooldowns[k] = Math.max(0, state.spellCooldowns[k] - dt);
	}

	// 死亡殭屍處理
	const dead = state.zombies.filter(z => z.hp <= 0);
	let killed = 0;

	for (const z of dead) {
		// 分裂殭屍
		if (z.kind === 'splitter' && !z.splitDone) {
			z.splitDone = true;
			state.zombies.push({
				id: state.nextZombieId++, kind: 'mini', row: z.row, x: Math.max(0, z.x - 0.08),
				hp: ZOMBIES.mini.hp, maxHp: ZOMBIES.mini.hp, speed: ZOMBIES.mini.speed,
				biteTimer: 0, slowTimer: 0, angry: false, shield: false, mini: true, biteDmg: 10,
			});
			state.zombies.push({
				id: state.nextZombieId++, kind: 'mini', row: z.row, x: Math.max(0, z.x + 0.14),
				hp: ZOMBIES.mini.hp, maxHp: ZOMBIES.mini.hp, speed: ZOMBIES.mini.speed,
				biteTimer: 0, slowTimer: 0, angry: false, shield: false, mini: true, biteDmg: 10,
			});
		}

		// 舞王殭屍死亡 → 召喚伴舞殭屍
		if (z.kind === 'dancer' && !z._danced) {
			z._danced = true;
			const backupBase = ZOMBIES.backup;
			if (backupBase) {
				const biteScale = 1 + Math.max(0, state.wave - 5) * 0.04;
				for (const rowOff of [-1, 0, 1]) {
					const r = z.row + rowOff;
					if (r < 0 || r >= 5) continue;
state.zombies.push({
          id: state.nextZombieId++, kind: 'backup', row: r,
          x: Math.max(0, z.x + (rowOff === 0 ? -0.3 : 0.1)),
          hp: backupBase.hp, maxHp: backupBase.hp, speed: backupBase.speed,
          biteTimer: 0, slowTimer: 0, angry: false, shield: false, biteDmg: Math.round(backupBase.bite * biteScale),
        });
      }
    }
    state.lastCleanupEvent = '💃 舞王倒了！伴舞殭屍出現！';
  }

		// 亡者歸來 — 復活
		if (chaosUndeadCheck(state, z)) {
			z.hp = Math.round(z.maxHp * 0.3);
			z.undead = true;
			continue;
		}

		// 給植物加 XP
		const xpReward = z.kind === 'boss' ? 40 : z.kind === 'giant' ? 15 : 5;
		for (const [key, plant] of state.plants) {
			if (plant.row === z.row) {
				let reward = xpReward;
				// 聖壇 XP 加成
				if (state.territory?.conquered?.has(key)) {
					const terrainId = state.territory.terrain?.[key];
					const terrain = TERRAIN_TYPES[terrainId];
					if (terrain?.xpMulti) reward = Math.round(reward * (1 + terrain.xpMulti));
				}
				const oldLevel = plant.level || 1;
				addPlantXP(state, key, reward);
				const newLevel = getPlantLevel(plant.xp || 0);
				if (newLevel > oldLevel) {
					plant.level = newLevel;
					plant.justEvolved = 1.5;
					applyEvolutionToPlant(plant);
				}
			}
		}

		killed++;
	}

	// 移除死亡殭屍
	state.zombies = state.zombies.filter(z => z.hp > 0);

	// 陽光生命週期 + 收集動畫
	for (let i = state.suns.length - 1; i >= 0; i--) {
		const s = state.suns[i];
		// 已收集的陽光：播放動畫後移除
		if (s.collected) {
			s.collectTime -= dt;
			if (s.collectTime <= 0) {
				state.suns.splice(i, 1);
			}
			continue;
		}
		// 正常掉落
		if (s.y < s.targetY) s.y += s.fall * 90 * dt;
		s.life -= dt;
		if (s.life <= 0) {
			state.suns.splice(i, 1);
		}
	}

	// 爆炸動畫
	state.booms.forEach(b => b.life -= dt);
	state.booms = state.booms.filter(b => b.life > 0);

	// 進化閃光計時遞減
	for (const p of state.plants.values()) {
		if (p.justEvolved > 0) p.justEvolved = Math.max(0, p.justEvolved - dt);
	}

	return { killed };
}
