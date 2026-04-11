export function updateModifiers(state, dt) {
  const wave = state.wave;
  if (wave !== state.modifierWave) {
    state.modifierWave = wave;
    if (wave > 0 && wave % 5 === 0) {
      state.modifier = 'fog';
      state.modifierTimer = 14;
    } else if (wave > 0 && wave % 4 === 0) {
      state.modifier = 'bloodmoon';
      state.modifierTimer = 12;
    } else if (wave > 0 && wave % 3 === 0) {
      state.modifier = 'solar';
      state.modifierTimer = 10;
    }
  }
  if (state.modifierTimer > 0) {
    state.modifierTimer -= dt;
    if (state.modifierTimer <= 0) state.modifier = 'normal';
  }
}

export function modifierSpawnPenalty(modifier) {
  return modifier === 'fog' ? -0.18 : modifier === 'solar' ? 0.12 : 0;
}

export function modifierSunSpeed(modifier) {
  return modifier === 'solar' ? 0.35 : modifier === 'fog' ? 0.85 : 0.6;
}

export function killReward(baseReward, state) {
  let reward = baseReward;
  if (state.modifier === 'bloodmoon') reward = Math.max(reward, 20);
  if (state.globalBuffs.killReward) reward = Math.round(reward * (1 + state.globalBuffs.killReward));
  return reward;
}
