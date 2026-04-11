import { rows, cols, ZOMBIES, BOSS_WAVES, zombieKindForWave, zombiesPerWave } from '../config.js';

export function startWaveSpawns(state) {
  const wave = state.wave;
  const isBoss = wave % 5 === 0;
  state.isBossWave = isBoss;

  const count = zombiesPerWave(wave, isBoss);
  state.waveKillTarget = count;
  state.waveKills = 0;
  state.waveZombiesRemaining = count;

  // 建立出怪隊列
  state.spawnQueue = [];

  if (isBoss) {
    const bossConfig = BOSS_WAVES[Math.min(wave, 20)] || BOSS_WAVES[20];
    if (bossConfig) {
      // Boss 本體
      state.spawnQueue.push({ delay: 2, kind: 'boss', row: Math.floor(Math.random() * rows), isBoss: true, config: bossConfig });
      // Boss 的小怪
      for (let i = 0; i < bossConfig.addCount; i++) {
        state.spawnQueue.push({ delay: 3 + i * 1.5, kind: bossConfig.adds[Math.floor(Math.random() * bossConfig.adds.length)] });
      }
      state.bossActive = true;
    }
  } else {
    // 普通波次
    for (let i = 0; i < count; i++) {
      const kind = zombieKindForWave(wave);
      const delay = i * (Math.max(1.2, 3.5 - wave * 0.15)) + Math.random() * 0.8;
      state.spawnQueue.push({ delay, kind });
    }
  }

  state.spawnTimer = 0;
}

export function updateSpawning(state, dt) {
  if (!state.spawnQueue || state.spawnQueue.length === 0) return;

  state.spawnTimer += dt;

  while (state.spawnQueue.length > 0 && state.spawnTimer >= state.spawnQueue[0].delay) {
    const spawn = state.spawnQueue.shift();
    spawnZombieFromQueue(state, spawn);
  }
}

function spawnZombieFromQueue(state, spawn) {
  const row = spawn.row ?? Math.floor(Math.random() * rows);
  const kind = spawn.kind;
  const isBoss = spawn.isBoss;

  if (isBoss) {
    const config = spawn.config;
    state.zombies.push({
      id: state.nextZombieId++, kind: 'boss', row, x: cols - 0.1,
      hp: config.bossHp, maxHp: config.bossHp,
      speed: config.bossSpeed, biteTimer: 0, slowTimer: 0,
      angry: false, shield: false,
      bossName: config.name, bossEmoji: config.emoji,
      biteDmg: config.bossBite,
    });
  } else {
    const base = ZOMBIES[kind];
    if (!base) return;
    const hpScale = 1 + (state.wave - 1) * 0.14;
    const shield = kind === 'bucket' && state.wave >= 7;
    state.zombies.push({
      id: state.nextZombieId++, kind, row, x: cols - 0.1,
      hp: Math.round(base.hp * hpScale), maxHp: Math.round(base.hp * hpScale),
      speed: base.speed, biteTimer: 0, slowTimer: 0,
      angry: false, shield, biteDmg: base.bite,
    });
  }
}

// 殘餘殭屍自動出怪（防呆：如果隊列空了但殭屍不夠）
export function spawnFallback(state) {
  if (state.spawnQueue.length === 0 && state.zombies.length < 2 && !state.draftPhase) {
    const kind = zombieKindForWave(state.wave);
    const row = Math.floor(Math.random() * rows);
    const base = ZOMBIES[kind];
    if (base) {
      state.zombies.push({
        id: state.nextZombieId++, kind, row, x: cols - 0.1,
        hp: base.hp, maxHp: base.hp, speed: base.speed,
        biteTimer: 0, slowTimer: 0, angry: false, shield: false, biteDmg: base.bite,
      });
    }
  }
}
