// ═══════════════════════════════════════════════
// Shop System — 牌組商店 (只有牌組裡的植物能用)
// ═══════════════════════════════════════════════
import { PLANTS } from '../config.js';

export function actualPlantCost(state, key, plant) {
  const costReduction = state.globalBuffs.cost || 0;
  const baseCost = plant.cost * (1 + costReduction);
  // 修飾器影響
  if (state.modifier === 'fog' && key === 'sunflower') return Math.round(baseCost + 10);
  if (state.modifier === 'solar' && key === 'repeater') return Math.round(baseCost - 15);
  return Math.round(baseCost);
}

export function updateShop(state) {
  [...document.querySelectorAll('.card')].forEach(c => {
    const k = c.dataset.plant;
    const p = PLANTS[k];
    if (!p) return;
    const cd = state.cooldowns[k] ?? 0;
    const actualCost = actualPlantCost(state, k, p);
    const disabled = state.sun < actualCost || cd > 0;
    c.classList.toggle('disabled', disabled);

    const ov = c.querySelector('.cooldown');
    const txt = c.querySelector('.cooltxt');
    const costEl = c.querySelector('.cost');

    if (costEl) {
      costEl.textContent = `${actualCost} ☀️`;
      costEl.classList.toggle('bad', actualCost > p.cost);
      costEl.classList.toggle('buff', actualCost < p.cost);
    }

    if (cd > 0) {
      ov.style.transform = `scaleY(${Math.min(1, cd / p.cooldown)})`;
      txt.textContent = `${cd.toFixed(1)}s`;
    } else {
      ov.style.transform = 'scaleY(0)';
      txt.textContent = '';
    }
  });
}
