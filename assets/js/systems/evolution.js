// ═══════════════════════════════════════════════
// Evolution System — 植物進化
// ═══════════════════════════════════════════════
import { EVOLUTIONS, PLANTS } from '../config.js';
import { getPlantLevel } from '../core/state.js';

// 取得植物進化加成
export function getEvolutionBonus(plantType, level) {
  const tree = EVOLUTIONS[plantType];
  if (!tree) return {};
  let bonus = {};
  for (let l = 2; l <= level; l++) {
    if (tree[l]) {
      bonus = { ...bonus, ...tree[l] };
    }
  }
  return bonus;
}

// 計算植物實際屬性 (含進化 + 全局 buff)
export function getPlantStats(plantType, level, globalBuffs) {
  const base = PLANTS[plantType];
  if (!base) return null;
  const evo = getEvolutionBonus(plantType, level);

  return {
    hp: Math.round(base.hp * (1 + (globalBuffs.hp || 0)) + (evo.bonusHp || 0)),
    maxHp: Math.round(base.hp * (1 + (globalBuffs.hp || 0)) + (evo.bonusHp || 0)),
    cost: Math.round(base.cost * (1 + (globalBuffs.cost || 0))),
    damage: 20 + (evo.bonusDmg || 0), // 基礎傷害 + 進化加成
    attackSpeed: base.cooldown * (1 - (globalBuffs.attackSpeed || 0)),
    sunValue: 25 + (evo.bonusSun || 0),
    level,
    evo,
  };
}

// 進化時更新植物屬性
export function applyEvolutionToPlant(plant) {
  const evo = getEvolutionBonus(plant.type, plant.level);
  const base = PLANTS[plant.type];
  if (!evo || !base) return;

  // 更新 maxHp
  const newMaxHp = Math.round(base.hp + (evo.bonusHp || 0));
  const hpDiff = newMaxHp - plant.maxHp;
  plant.maxHp = newMaxHp;
  plant.hp = Math.min(plant.hp + hpDiff, plant.maxHp);
}
