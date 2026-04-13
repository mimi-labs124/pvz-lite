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
  const isDigger = kind === 'digger';
  state.zombies.push({
    id: state.nextZombieId++, kind, row,
    x: isDigger ? -0.5 : cols - 0.1,
    hp: Math.round(base.hp * hpScale), maxHp: Math.round(base.hp * hpScale),
    speed: base.speed * level.speedScale, biteTimer: 0, slowTimer: 0,
    angry: false, shield,
    digger: isDigger,
    digTimer: isDigger ? (3 + Math.random() * 2) : 0,
    digSurfaceCol: isDigger ? Math.floor(Math.random() * 3) + 1 : 0,
    hasImp: kind === 'giant',  // Giant carries an imp
  });
}

/** Spawn an imp that leaps from a dying giant */
export function spawnImp(state, row, x) {
  const base = ZOMBIES.imp;
  const level = LEVELS[state.levelKey];
  const hpScale = (1 + (state.wave - 1) * 0.14) * level.hpScale;
  state.zombies.push({
    id: state.nextZombieId++, kind: 'imp', row,
    x: Math.max(0, x - 0.5),
    hp: Math.round(base.hp * hpScale), maxHp: Math.round(base.hp * hpScale),
    speed: base.speed * level.speedScale, biteTimer: 0, slowTimer: 0,
    angry: false, shield: false,
    digger: false, digTimer: 0, digSurfaceCol: 0,
    hasImp: false,
  });
}

/** Flag zombie triggers extra spawns when it appears */
export function spawnFlagWave(state) {
  const extra = 1 + Math.floor(state.wave / 5);
  for (let i = 0; i < extra; i++) {
    spawnZombie(state);
  }
}
