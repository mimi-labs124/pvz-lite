import { rows, cols, ZOMBIES, PLANTS, POWERUPS } from '../config.js';

export function triggerBomb(state, plant, sfx) {
  sfx('boom');
  state.booms.push({ row: plant.row, col: plant.col, life: 0.22 });
  state.zombies.forEach(z => {
    if (Math.abs(z.row - plant.row) <= 1 && Math.abs(z.x - plant.col) <= 1.35) z.hp -= 230;
  });
}

/** Chomper: instantly kills the nearest zombie in its row */
function triggerChomp(state, plant, sfx) {
  const targets = state.zombies
    .filter(z => z.row === plant.row && z.x >= plant.col - 0.1 && !z.digger)
    .sort((a, b) => a.x - b.x);
  if (targets.length === 0) return;
  const victim = targets[0];
  if (victim.kind === 'giant') {
    victim.hp -= 300;
  } else {
    victim.hp = -999;
  }
  sfx('chomp');
  const chewTime = plant.level >= 2 ? 6 : 8; // Upgrade: chew faster
  plant.chompTimer = chewTime;
  state.booms.push({ row: plant.row, col: plant.col, life: 0.3 });
}

export function updatePlantsCombat(state, dt, sfx, addSun, removePlant) {
  for (const p of [...state.plants.values()]) {
    // Sunflower
    if (p.type === 'sunflower') {
      p.sunTimer += dt;
      const sunInterval = p.level >= 2 ? 5.2 : 6.2; // Upgrade: faster
      if (p.sunTimer >= sunInterval) {
        p.sunTimer = 0;
        const bloomValue = state.modifier === 'solar' ? 35 : (p.level >= 2 ? 35 : 25); // Upgrade: more sun
        addSun(state, p.col * 95 + 18, p.row * 100 + 10, bloomValue, 0.45);
      }
    }

    // Shooters: peashooter, repeater, icepea, gambler
    if (['peashooter', 'repeater', 'icepea', 'gambler'].includes(p.type)) {
      const has = state.zombies.some(z => z.row === p.row && z.x >= p.col - 0.1 && !z.digger);
      p.attackTimer += dt;
      let rate = p.type === 'repeater' ? 0.9 : p.type === 'gambler' ? 1.35 : 1.1;
      if (p.type === 'peashooter' && p.level >= 2) rate *= 0.7; // Upgrade: faster
      if (has && p.attackTimer >= rate) {
        p.attackTimer = 0;
        if (p.type === 'gambler') {
          const roll = Math.random();
          const critChance = p.level >= 2 ? 0.25 : 0.1; // Upgrade: higher crit
          const damage = roll > (1 - critChance) ? 55 : roll < 0.2 ? 6 : 24 + Math.floor(Math.random() * 14);
          state.peas.push({ row: p.row, x: p.col + 0.72, damage, speed: 4.8, ice: false, gambler: true, crit: roll > (1 - critChance), weak: roll < 0.2, fire: false });
        } else {
          const shots = (p.type === 'repeater' && p.level >= 2) ? 3 : p.type === 'repeater' ? 2 : 1; // Upgrade: triple shot
          for (let i = 0; i < shots; i++) {
            state.peas.push({ row: p.row, x: p.col + 0.72 - i * 0.12, damage: p.type === 'icepea' ? 18 : 20, speed: 4.8, ice: p.type === 'icepea', fire: false });
          }
        }
        sfx(p.type === 'icepea' ? 'ice' : 'pea');
      }
    }

    // Bomb
    if (p.type === 'bomb') {
      p.explodeTimer -= dt;
      if (p.explodeTimer <= 0) {
        triggerBomb(state, p, sfx);
        removePlant(p.row, p.col);
      }
    }

    // Prism
    if (p.type === 'prism') {
      const targetRows = [p.row, Math.max(0, p.row - 1), Math.min(rows - 1, p.row + 1)];
      const hasTarget = state.zombies.some(z => targetRows.includes(z.row) && z.x >= p.col - 0.1 && !z.digger);
      p.attackTimer += dt;
      if (hasTarget && p.attackTimer >= 1.25) {
        p.attackTimer = 0;
        const splashDmg = p.level >= 2 ? 15 : 10; // Upgrade: more splash
        targetRows.forEach((row, idx) => {
          state.peas.push({ row, x: p.col + 0.72, damage: idx === 0 ? 16 : splashDmg, speed: 4.6, ice: false, prism: true, fire: false });
        });
        sfx('pea');
      }
    }

    // Chomper
    if (p.type === 'chomper') {
      if (p.chompTimer > 0) { p.chompTimer -= dt; continue; }
      const has = state.zombies.some(z => z.row === p.row && z.x >= p.col - 0.1 && z.x < p.col + 1.5 && !z.digger);
      p.attackTimer += dt;
      if (has && p.attackTimer >= 1.5) { p.attackTimer = 0; triggerChomp(state, p, sfx); }
    }

    // Cactus — piercing shot, hits underground diggers too
    if (p.type === 'cactus') {
      const has = state.zombies.some(z => z.row === p.row && z.x >= p.col - 0.1);
      p.attackTimer += dt;
      if (has && p.attackTimer >= 1.4) {
        p.attackTimer = 0;
        const pierceCount = p.level >= 2 ? 3 : 2; // Upgrade: pierce more
        state.peas.push({ row: p.row, x: p.col + 0.72, damage: 18, speed: 5.2, ice: false, cactus: true, pierceLeft: pierceCount, fire: false });
        sfx('pea');
      }
    }
  }
}

export function updatePeasCombat(state, dt, sfx) {
  state.peas.forEach(p => p.x += p.speed * dt);

  // Torchwood check
  for (const pea of state.peas) {
    if (pea.fire || pea.ice) continue;
    const peaCol = Math.round(pea.x - 0.72);
    for (const plant of state.plants.values()) {
      if (plant.type === 'torchwood' && plant.row === pea.row && plant.col === peaCol) {
        pea.fire = true;
        pea.damage *= 2;
        sfx('ignite');
        break;
      }
    }
  }

  state.peas = state.peas.filter(p => p.x < cols + 0.4);

  for (const pea of state.peas) {
    // Cactus piercing: can hit underground and pierce through
    const hitCandidates = state.zombies.filter(z =>
      z.row === pea.row && Math.abs(z.x - pea.x) < 0.28
    );
    const hit = pea.cactus
      ? hitCandidates[0]  // Cactus hits anything including underground
      : state.zombies.find(z => z.row === pea.row && Math.abs(z.x - pea.x) < 0.28 && !z.digger);

    if (hit) {
      if (hit.shield) {
        hit.shield = false;
        hit.hp -= Math.max(6, pea.damage * 0.35);
      } else {
        hit.hp -= pea.damage;
      }
      // Fire pea splash
      if (pea.fire) {
        const splashRange = 0.7; // TODO: upgrade could increase this
        state.zombies.forEach(z => {
          if (z !== hit && z.row === pea.row && Math.abs(z.x - pea.x) < splashRange && !z.digger) {
            z.hp -= Math.floor(pea.damage * 0.4);
          }
        });
      }
      // Ice slow
      if (pea.ice) hit.slowTimer = 2.8;

      // Cactus pierce: don't destroy the pea, reduce pierce count
      if (pea.cactus && pea.pierceLeft > 1) {
        pea.pierceLeft--;
        pea.x += 0.35; // Skip past the hit zombie
        sfx('hit');
        continue;
      }

      pea.x = 999;
      sfx(pea.fire ? 'fire_hit' : 'hit');
    }
  }
  state.peas = state.peas.filter(p => p.x < cols + 1);
}

export function updateZombieCombat(state, dt, sfx, cellKey) {
  for (const z of state.zombies) {
    // Digger underground phase
    if (z.digger && z.digTimer > 0) {
      z.digTimer -= dt;
      if (z.digTimer <= 0) { z.x = z.digSurfaceCol + 0.5; z.digTimer = 0; }
      continue;
    }

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
      // Shield power-up: plants take no damage
      if (state.shieldTimer <= 0) {
        z.biteTimer += dt;
        if (z.biteTimer >= 0.7) {
          z.biteTimer = 0;
          plant.hp -= ZOMBIES[z.kind].bite;
          if (plant.hp <= 0) state.plants.delete(key);
        }
      }
    } else {
      z.x -= eff * dt;
    }
    if (z.x <= -0.2 && mower.used) return false;
  }
  return true;
}
