import { PLANTS } from '../config.js';
import { cellKey, flash } from '../core/helpers.js';
import { actualPlantCost } from './shop.js';

/**
 * Attempt to place a plant on the board.
 * @returns {{ ok: boolean, flashTarget?: string, plantType?: string }}
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
  });

  return { ok: true, plantType: plantKey };
}

/**
 * Shovel a plant — remove it and refund partial sun.
 * @returns {{ ok: boolean, refund: number }}
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
