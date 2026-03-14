export function actualPlantCost(state, key, plant) {
  return state.modifier === 'fog' && key === 'sunflower'
    ? plant.cost + 10
    : state.modifier === 'solar' && key === 'repeater'
      ? plant.cost - 15
      : plant.cost;
}

export function updateShop(state, PLANTS) {
  [...document.querySelectorAll('.card')].forEach(c => {
    const k = c.dataset.plant;
    const p = PLANTS[k];
    const cd = state.cooldowns[k];
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
    c.title = state.modifier === 'fog' && k === 'sunflower' ? 'Iron Fog：向日葵更貴' : state.modifier === 'solar' && k === 'repeater' ? 'Solar Flare：雙發射手折扣' : '';
    if (cd > 0) {
      ov.style.transform = `scaleY(${Math.min(1, cd / p.cooldown)})`;
      txt.textContent = `${cd.toFixed(1)}s`;
    } else {
      ov.style.transform = 'scaleY(0)';
      txt.textContent = '';
    }
  });
}
