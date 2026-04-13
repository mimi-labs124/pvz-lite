import { ZOMBIES } from '../config.js';

export function cleanupState(state, dt) {
  for (const k of Object.keys(state.cooldowns)) state.cooldowns[k] = Math.max(0, state.cooldowns[k] - dt);

  const dead = state.zombies.filter(z => z.hp <= 0);
  let comboKills = 0;
  for (const z of dead) {
    // Don't split if already split or if digger still underground
    if (z.kind === 'splitter' && !z.splitDone) {
      z.splitDone = true;
      state.zombies.push({ id: state.nextZombieId++, kind: 'mini', row: z.row, x: Math.max(0, z.x - 0.08), hp: ZOMBIES.mini.hp, maxHp: ZOMBIES.mini.hp, speed: ZOMBIES.mini.speed, biteTimer: 0, slowTimer: 0, angry: false, shield: false, mini: true, digger: false, digTimer: 0, digSurfaceCol: 0 });
      state.zombies.push({ id: state.nextZombieId++, kind: 'mini', row: z.row, x: Math.max(0, z.x + 0.14), hp: ZOMBIES.mini.hp, maxHp: ZOMBIES.mini.hp, speed: ZOMBIES.mini.speed, biteTimer: 0, slowTimer: 0, angry: false, shield: false, mini: true, digger: false, digTimer: 0, digSurfaceCol: 0 });
    }
    // Only count non-digger-underground kills for combo
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
    state.comboTimer = 3.0; // Reset combo timeout
    if (state.combo > state.maxCombo) state.maxCombo = state.combo;
  }
  if (state.comboTimer > 0) {
    state.comboTimer -= dt;
    if (state.comboTimer <= 0) state.combo = 0;
  }

  state.suns.forEach(s => { if (s.y < s.targetY) s.y += s.fall; s.life -= dt; });
  state.suns = state.suns.filter(s => s.life > 0);
  state.booms.forEach(b => b.life -= dt);
  state.booms = state.booms.filter(b => b.life > 0);

  return { killed, comboKills };
}
