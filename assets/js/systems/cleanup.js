import { ZOMBIES } from '../config.js';

export function cleanupState(state, dt) {
  for (const k of Object.keys(state.cooldowns)) state.cooldowns[k] = Math.max(0, state.cooldowns[k] - dt);

  const dead = state.zombies.filter(z => z.hp <= 0);
  for (const z of dead) {
    if (z.kind === 'splitter' && !z.splitDone) {
      z.splitDone = true;
      state.zombies.push({ id: state.nextZombieId++, kind: 'mini', row: z.row, x: Math.max(0, z.x - 0.08), hp: ZOMBIES.mini.hp, maxHp: ZOMBIES.mini.hp, speed: ZOMBIES.mini.speed, biteTimer: 0, slowTimer: 0, angry: false, shield: false, mini: true });
      state.zombies.push({ id: state.nextZombieId++, kind: 'mini', row: z.row, x: Math.max(0, z.x + 0.14), hp: ZOMBIES.mini.hp, maxHp: ZOMBIES.mini.hp, speed: ZOMBIES.mini.speed, biteTimer: 0, slowTimer: 0, angry: false, shield: false, mini: true });
    }
  }

  const before = state.zombies.length;
  state.zombies = state.zombies.filter(z => z.hp > 0);
  const killed = before - state.zombies.length;

  state.suns.forEach(s => { if (s.y < s.targetY) s.y += s.fall; s.life -= dt; });
  state.suns = state.suns.filter(s => s.life > 0);
  state.booms.forEach(b => b.life -= dt);
  state.booms = state.booms.filter(b => b.life > 0);

  return { killed };
}
