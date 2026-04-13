import { PLANTS } from '../config.js';
import { cellKey, flash } from '../core/helpers.js';
import { actualPlantCost } from './shop.js';

/**
 * Attempt to place a plant on the board.
 */
export function tryPlacePlant(state, plantKey, row, col) {
  const key = cellKey(row, col);
  const def = PLANTS[plantKey];
  if (!def) return { ok: false };
  const actualCost = actualPlantCost(state, plantKey, def);

  if (state.plants.has(key)) return { ok: false, flashTarget: 'shop' };
  if (state.cooldowns[plantKey] > 0) return { ok: false, flashTarget: 'shop' };
  if (state.sun < actualCost) return { ok: false, flashTarget: 'sun' };

  state.sun -= actualCost;
  state.cooldowns[plantKey] = def.cooldown;
  state.plants.set(key, {
    type: plantKey, row, col,
    hp: def.hp, maxHp: def.hp,
    attackTimer: 0, sunTimer: 0, explodeTimer: 0.8,
    chompTimer: 0,
    level: 1,  // Upgrade level
  });

  return { ok: true, plantType: plantKey };
}

/**
 * Shovel a plant — remove it and refund partial sun.
 */
export function tryShovelPlant(state, row, col) {
  const key = cellKey(row, col);
  const plant = state.plants.get(key);
  if (!plant) return { ok: false, refund: 0 };
  const def = PLANTS[plant.type];
  const refund = Math.floor(def.cost * def.refund);
  state.sun += refund;
  state.plants.delete(key);
  state.shovelUses++;
  return { ok: true, refund };
}

/**
 * Upgrade a plant — spend sun to power it up (max level 2).
 * @returns {{ ok: boolean, cost?: number }}
 */
export function tryUpgradePlant(state, row, col) {
  const key = cellKey(row, col);
  const plant = state.plants.get(key);
  if (!plant) return { ok: false };
  const def = PLANTS[plant.type];
  if (!def.upgradeCost) return { ok: false, reason: 'no_upgrade' };
  if (plant.level >= 2) return { ok: false, reason: 'max_level' };
  if (state.sun < def.upgradeCost) return { ok: false, reason: 'no_sun' };

  state.sun -= def.upgradeCost;
  plant.level = 2;
  state.upgradeCount++;

  // Apply upgrade effects
  if (plant.type === 'wallnut') {
    plant.hp += 120;
    plant.maxHp += 120;
  }

  return { ok: true, cost: def.upgradeCost };
}
