import { rows, cols, LEVELS, ZOMBIES } from '../config.js';

export function zombieKindForWave(w) {
  const pool = ['normal'];
  if (w >= 2) pool.push('cone');
  if (w >= 3) pool.push('paper');
  if (w >= 4) pool.push('fast');
  if (w >= 5) pool.push('flag');
  if (w >= 6) pool.push('bucket');
  if (w >= 7) pool.push('splitter');
  if (w >= 8) pool.push('digger');
  if (w >= 9) pool.push('giant');
  return pool[Math.floor(Math.random() * pool.length)];
}

export function spawnZombie(state) {
  const level = LEVELS[state.levelKey];
  const row = Math.floor(Math.random() * rows);
  const kind = zombieKindForWave(state.wave);
  const base = ZOMBIES[kind];
  const hpScale = (1 + (state.wave - 1) * 0.14) * level.hpScale;
  const shield = kind === 'bucket' && state.wave >= 7;
  const digger = kind === 'digger';
  state.zombies.push({
    id: state.nextZombieId++, kind, row,
    x: digger ? -0.5 : cols - 0.1,  // Diggers start from the left!
    hp: Math.round(base.hp * hpScale), maxHp: Math.round(base.hp * hpScale),
    speed: base.speed * level.speedScale, biteTimer: 0, slowTimer: 0,
    angry: false, shield, digger,
    digTimer: digger ? (3 + Math.random() * 2) : 0,  // Time before surfacing
    digSurfaceCol: digger ? Math.floor(Math.random() * 3) + 1 : 0, // Surface column
  });
}

/** Flag zombie triggers extra spawns when it appears */
export function spawnFlagWave(state) {
  const extra = 1 + Math.floor(state.wave / 5);
  for (let i = 0; i < extra; i++) {
    spawnZombie(state);
  }
}
