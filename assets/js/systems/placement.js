/**
 * systems/placement.js — Plant placement logic
 *
 * Pure game-rule validation + state mutation for placing a plant.
 * No DOM manipulation — only state changes.
 */

import { PLANTS } from '../config.js';
import { cellKey, flash } from '../core/helpers.js';
import { actualPlantCost } from './shop.js';

/**
 * Attempt to place a plant on the board.
 * @returns {{ ok: boolean, flashTarget?: string }}  result + hint for flash feedback
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
  });

  return { ok: true, plantType: plantKey };
}
