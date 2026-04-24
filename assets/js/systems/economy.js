import { isChaosActive } from './chaos.js';

export function addSun(state, x, y, val = 25, fall = 0.6) {
 const diffMul = state.sunMultiplier || 1;
 const incomeBuff = 1 + (state.globalBuffs.sunIncome || 0);
 const tsunamiMult = (state.chaosHarnessed && state.harnessEffect?.type === 'tsunami') ? (state.harnessEffect.multiplier || 1) : 1;
 // 通脹：超過 500 陽光後收益遞減
 const inflation = state.sun > 500 ? Math.max(0.4, 1 - (state.sun - 500) / 1500) : 1;
 const sunValue = Math.max(5, Math.round(val * incomeBuff * tsunamiMult * diffMul * inflation));
 state.suns.push({ id: state.nextSunId++, x, y, targetY: y + Math.random() * 40 + 10, value: sunValue, life: 10, fall });
}

export function collectSun(state, id) {
  const i = state.suns.findIndex(s => s.id === id);
  if (i === -1) return false;
  state.sun += state.suns[i].value;
  state.suns.splice(i, 1);
  return true;
}

// 天空掉落陽光
export function updateSkyDrops(state, dt, cols) {
  // 日蝕期間不落陽光
  if (isChaosActive(state, 'eclipse')) return;

  const dropInterval = state.modifier === 'solar' ? 3.5 : state.modifier === 'fog' ? 7.5 : 5.2;
  state.sunTimer += dt;

  // 陽光暴雨
  if (isChaosActive(state, 'sunshower')) {
    state.sunShowerTimer = (state.sunShowerTimer || 0) + dt;
    if (state.sunShowerTimer >= 0.3) {
      state.sunShowerTimer = 0;
      addSun(state, Math.random() * (cols * 90 - 50) + 20, Math.random() * 40, 15, 0.8);
    }
  }

  if (state.sunTimer >= dropInterval) {
    state.sunTimer = 0;
    const speed = state.modifier === 'solar' ? 0.35 : state.modifier === 'fog' ? 0.85 : 0.6;
    addSun(state, Math.random() * (cols * 90 - 50) + 20, 10, 25, speed);
  }
}
