import { ZOMBIES, POWERUPS } from '../config.js';

/** Chance of a zombie dropping a power-up on death */
const POWERUP_DROP_CHANCE = 0.12;

export function cleanupState(state, dt) {
  for (const k of Object.keys(state.cooldowns)) state.cooldowns[k] = Math.max(0, state.cooldowns[k] - dt);

  // Shield timer
  if (state.shieldTimer > 0) state.shieldTimer -= dt;

  const dead = state.zombies.filter(z => z.hp <= 0);
  let comboKills = 0;
  for (const z of dead) {
    // Splitter zombie splits
    if (z.kind === 'splitter' && !z.splitDone) {
      z.splitDone = true;
      state.zombies.push({ id: state.nextZombieId++, kind: 'mini', row: z.row, x: Math.max(0, z.x - 0.08), hp: ZOMBIES.mini.hp, maxHp: ZOMBIES.mini.hp, speed: ZOMBIES.mini.speed, biteTimer: 0, slowTimer: 0, angry: false, shield: false, mini: true, digger: false, digTimer: 0, digSurfaceCol: 0, hasImp: false });
      state.zombies.push({ id: state.nextZombieId++, kind: 'mini', row: z.row, x: Math.max(0, z.x + 0.14), hp: ZOMBIES.mini.hp, maxHp: ZOMBIES.mini.hp, speed: ZOMBIES.mini.speed, biteTimer: 0, slowTimer: 0, angry: false, shield: false, mini: true, digger: false, digTimer: 0, digSurfaceCol: 0, hasImp: false });
    }
    if (!z.digger || z.digTimer <= 0) {
      comboKills++;
    }
  }

  const before = state.zombies.length;
  state.zombies = state.zombies.filter(z => z.hp > 0);
  const killed = before - state.zombies.length;

  // Combo tracking
  if (comboKills > 0) {
    state.combo += comboKills;
    state.comboTimer = 3.0;
    if (state.combo > state.maxCombo) state.maxCombo = state.combo;
  }
  if (state.comboTimer > 0) {
    state.comboTimer -= dt;
    if (state.comboTimer <= 0) state.combo = 0;
  }

  // Sun physics
  state.suns.forEach(s => { if (s.y < s.targetY) s.y += s.fall; s.life -= dt; });
  state.suns = state.suns.filter(s => s.life > 0);
  state.booms.forEach(b => b.life -= dt);
  state.booms = state.booms.filter(b => b.life > 0);

  // Power-up drop lifetime
  state.powerups.forEach(p => { p.life -= dt; });
  state.powerups = state.powerups.filter(p => p.life > 0);

  return { killed, comboKills };
}

/** Maybe drop a power-up at a zombie's death position */
export function maybeDropPowerup(state, row, x) {
  if (Math.random() > POWERUP_DROP_CHANCE) return;
  const keys = Object.keys(POWERUPS);
  const key = keys[Math.floor(Math.random() * keys.length)];
  const def = POWERUPS[key];
  state.powerups.push({
    id: state.nextPowerupId++,
    type: key,
    row, x: x * 95 + 10,
    y: row * 100 + 20,
    emoji: def.emoji,
    life: 8,
  });
}

/** Collect a power-up and apply its effect */
export function collectPowerup(state, powerupId) {
  const idx = state.powerups.findIndex(p => p.id === powerupId);
  if (idx === -1) return false;
  const pu = state.powerups[idx];
  state.powerups.splice(idx, 1);
  state.powerupsCollected++;

  switch (pu.type) {
    case 'sunburst':
      state.sun += 50;
      break;
    case 'cooldown':
      for (const k of Object.keys(state.cooldowns)) state.cooldowns[k] = 0;
      break;
    case 'heal':
      for (const p of state.plants.values()) {
        p.hp = Math.min(p.maxHp, p.hp + p.maxHp * 0.3);
      }
      break;
    case 'shield':
      state.shieldTimer = 3;
      break;
  }
  return true;
}
