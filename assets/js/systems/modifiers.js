export function updateModifiers(state, dt) {
  state.wave = 1 + Math.floor(state.kills / 10);
  if (state.wave !== state.modifierWave) {
    state.modifierWave = state.wave;
    if (state.wave > 0 && state.wave % 5 === 0) {
      state.modifier = 'hailstorm';  // New: every 5th wave is hailstorm
      state.modifierTimer = 16;
    } else if (state.wave > 0 && state.wave % 4 === 0) {
      state.modifier = 'fog';
      state.modifierTimer = 14;
    } else if (state.wave > 0 && state.wave % 3 === 0) {
      state.modifier = 'bloodmoon';
      state.modifierTimer = 12;
    } else if (state.wave > 0 && state.wave % 2 === 0) {
      state.modifier = 'solar';
      state.modifierTimer = 10;
    }
  }
  if (state.modifierTimer > 0) {
    state.modifierTimer -= dt;
    if (state.modifierTimer <= 0) state.modifier = 'normal';
  }

  // Hailstorm: random ice damage to plants
  if (state.modifier === 'hailstorm') {
    state.hailTimer = (state.hailTimer || 0) + dt;
    if (state.hailTimer >= 3.5) {
      state.hailTimer = 0;
      const plants = [...state.plants.values()];
      if (plants.length > 0) {
        const target = plants[Math.floor(Math.random() * plants.length)];
        target.hp -= 15;
        if (target.hp <= 0) {
          const key = `${target.row}-${target.col}`;
          state.plants.delete(key);
        }
      }
    }
  }
}

export function modifierSpawnPenalty(modifier) {
  return modifier === 'fog' ? -0.18 : modifier === 'solar' ? 0.12 : modifier === 'hailstorm' ? -0.08 : 0;
}

export function modifierSunSpeed(modifier, levelKey) {
  const speedBase = levelKey === 'easy' ? 0.35 : levelKey === 'hard' ? 0.85 : levelKey === 'survival' ? 1.05 : 0.6;
  return modifier === 'solar' ? Math.max(0.2, speedBase - 0.18) : modifier === 'fog' ? speedBase + 0.25 : modifier === 'bloodmoon' ? speedBase + 0.08 : speedBase;
}

export function killReward(baseReward, modifier) {
  return modifier === 'bloodmoon' ? Math.max(baseReward, 20) : baseReward;
}
