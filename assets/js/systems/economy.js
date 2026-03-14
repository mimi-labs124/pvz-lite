export function addSun(state, x, y, val = 25, fall = 0.6) {
  state.suns.push({ id: state.nextSunId++, x, y, targetY: y + Math.random() * 40 + 10, value: val, life: 10, fall });
}

export function collectSun(state, id) {
  const i = state.suns.findIndex(s => s.id === id);
  if (i === -1) return false;
  state.sun += state.suns[i].value;
  state.suns.splice(i, 1);
  return true;
}
