import { rows, cols, ZOMBIES } from '../config.js';

export function triggerBomb(state, plant, sfx) {
  sfx('boom');
  state.booms.push({ row: plant.row, col: plant.col, life: 0.22 });
  state.zombies.forEach(z => {
    if (Math.abs(z.row - plant.row) <= 1 && Math.abs(z.x - plant.col) <= 1.35) z.hp -= 230;
  });
}

/** Chomper: instantly kills the nearest zombie in its row, then chews for a long time */
function triggerChomp(state, plant, sfx) {
  const targets = state.zombies
    .filter(z => z.row === plant.row && z.x >= plant.col - 0.1)
    .sort((a, b) => a.x - b.x);
  if (targets.length === 0) return;
  const victim = targets[0];
  // Instant-kill non-giant zombies; giants take heavy damage instead
  if (victim.kind === 'giant') {
    victim.hp -= 300;
  } else {
    victim.hp = -999;
  }
  sfx('chomp');
  plant.chompTimer = 8; // chewing cooldown (seconds)
  state.booms.push({ row: plant.row, col: plant.col, life: 0.3 }); // visual feedback
}

export function updatePlantsCombat(state, dt, sfx, addSun, removePlant) {
  for (const p of [...state.plants.values()]) {
    if (p.type === 'sunflower') {
      p.sunTimer += dt;
      if (p.sunTimer >= 6.2) {
        p.sunTimer = 0;
        const bloomValue = state.modifier === 'solar' ? 35 : 25;
        addSun(state, p.col * 95 + 18, p.row * 100 + 10, bloomValue, 0.45);
      }
    }
    if (['peashooter', 'repeater', 'icepea', 'gambler'].includes(p.type)) {
      const has = state.zombies.some(z => z.row === p.row && z.x >= p.col - 0.1);
      p.attackTimer += dt;
      const rate = p.type === 'repeater' ? 0.9 : p.type === 'gambler' ? 1.35 : 1.1;
      if (has && p.attackTimer >= rate) {
        p.attackTimer = 0;
        if (p.type === 'gambler') {
          const roll = Math.random();
          const damage = roll > 0.9 ? 55 : roll < 0.2 ? 6 : 24 + Math.floor(Math.random() * 14);
          state.peas.push({ row: p.row, x: p.col + 0.72, damage, speed: 4.8, ice: false, gambler: true, crit: roll > 0.9, weak: roll < 0.2 });
        } else {
          const shots = p.type === 'repeater' ? 2 : 1;
          for (let i = 0; i < shots; i++) state.peas.push({ row: p.row, x: p.col + 0.72 - i * 0.12, damage: p.type === 'icepea' ? 18 : 20, speed: 4.8, ice: p.type === 'icepea' });
        }
        sfx(p.type === 'icepea' ? 'ice' : 'pea');
      }
    }
    if (p.type === 'bomb') {
      p.explodeTimer -= dt;
      if (p.explodeTimer <= 0) {
        triggerBomb(state, p, sfx);
        removePlant(p.row, p.col);
      }
    }
    if (p.type === 'prism') {
      const targetRows = [p.row, Math.max(0, p.row - 1), Math.min(rows - 1, p.row + 1)];
      const hasTarget = state.zombies.some(z => targetRows.includes(z.row) && z.x >= p.col - 0.1);
      p.attackTimer += dt;
      if (hasTarget && p.attackTimer >= 1.25) {
        p.attackTimer = 0;
        targetRows.forEach((row, idx) => {
          state.peas.push({ row, x: p.col + 0.72, damage: idx === 0 ? 16 : 10, speed: 4.6, ice: false, prism: true });
        });
        sfx('pea');
      }
    }
    if (p.type === 'chomper') {
      // Handle chewing state
      if (p.chompTimer > 0) {
        p.chompTimer -= dt;
        continue; // Can't do anything while chewing
      }
      const has = state.zombies.some(z => z.row === p.row && z.x >= p.col - 0.1 && z.x < p.col + 1.5);
      p.attackTimer += dt;
      if (has && p.attackTimer >= 1.5) {
        p.attackTimer = 0;
        triggerChomp(state, p, sfx);
      }
    }
  }
}

export function updatePeasCombat(state, dt, sfx) {
  state.peas.forEach(p => p.x += p.speed * dt);
  state.peas = state.peas.filter(p => p.x < cols + 0.4);
  for (const pea of state.peas) {
    const hit = state.zombies.find(z => z.row === pea.row && Math.abs(z.x - pea.x) < 0.28);
    if (hit) {
      if (hit.shield) {
        hit.shield = false;
        hit.hp -= Math.max(6, pea.damage * 0.35);
      } else {
        hit.hp -= pea.damage;
      }
      if (pea.ice) hit.slowTimer = 2.8;
      pea.x = 999;
      sfx('hit');
    }
  }
  state.peas = state.peas.filter(p => p.x < cols + 1);
}

export function updateZombieCombat(state, dt, sfx, cellKey) {
  for (const z of state.zombies) {
    if (z.kind === 'paper' && !z.angry && z.hp < z.maxHp * 0.45) z.angry = true, z.speed *= 1.9;
    if (z.slowTimer > 0) z.slowTimer -= dt;
    const bloodBoost = state.modifier === 'bloodmoon' ? 1.18 : 1;
    const eff = z.speed * bloodBoost * (z.slowTimer > 0 ? 0.5 : 1);
    const col = Math.floor(z.x);
    const key = cellKey(z.row, Math.max(0, col));
    const plant = state.plants.get(key);
    const mower = state.lawnmowers[z.row];
    if (!mower.used && !mower.active && z.x <= 0.35) {
      mower.active = true;
      sfx('mower');
    }
    if (mower.active) continue;
    if (plant && z.x < plant.col + 0.95) {
      z.biteTimer += dt;
      if (z.biteTimer >= 0.7) {
        z.biteTimer = 0;
        plant.hp -= ZOMBIES[z.kind].bite;
        if (plant.hp <= 0) state.plants.delete(key);
      }
    } else {
      z.x -= eff * dt;
    }
    if (z.x <= -0.2 && mower.used) return false;
  }
  return true;
}
