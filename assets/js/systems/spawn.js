import { rows, cols, ZOMBIES, BOSS_WAVES, zombieKindForWave, zombiesPerWave, DIFFICULTY } from '../config.js';

export function startWaveSpawns(state) {
 const wave = state.wave;
 const isBoss = wave % 5 === 0;
 state.isBossWave = isBoss;

 const diff = DIFFICULTY[state.difficulty] || DIFFICULTY.normal;
 const countScale = diff.zombieCountScale || 1;
 const baseCount = zombiesPerWave(wave, isBoss);
 const count = Math.max(3, Math.round(baseCount * countScale));
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
 bossSkills: config.skills || [],
 bossAddKinds: config.adds || [],
 });
  } else {
 const base = ZOMBIES[kind];
 if (!base) return;
	const diff = DIFFICULTY[state.difficulty] || DIFFICULTY.normal;
	const baseHpScale = 1 + (state.wave - 1) * 0.14;
	const hpScale = baseHpScale * (diff.zombieHpScale || 1);
	const speedScale = diff.zombieSpeedScale || 1;
	const biteScale = 1 + Math.max(0, state.wave - 5) * 0.04; // 波次 5+ 咬傷逐漸增加
	const shield = kind === 'bucket' && state.wave >= 7;
	const zombie = {
		id: state.nextZombieId++, kind, row, x: cols - 0.1,
		hp: Math.round(base.hp * hpScale), maxHp: Math.round(base.hp * hpScale),
		speed: base.speed * speedScale, biteTimer: 0, slowTimer: 0,
		angry: false, shield, biteDmg: Math.round(base.bite * biteScale),
	};
    // Armored zombie gets extra shield HP
    if (kind === 'armored') {
      zombie.armorHp = 150;
    }
    state.zombies.push(zombie);
  }
}

// 殘餘殭屍自動出怪（防呆：如果隊列空了但殭屍不夠）
export function spawnFallback(state) {
  if (state.spawnQueue.length === 0 && state.zombies.length < 2 && !state.draftPhase) {
 const kind = zombieKindForWave(state.wave);
 const row = Math.floor(Math.random() * rows);
 const base = ZOMBIES[kind];
 if (base) {
 const diff = DIFFICULTY[state.difficulty] || DIFFICULTY.normal;
 const hpScale = (1 + (state.wave - 1) * 0.14) * (diff.zombieHpScale || 1);
 const speedScale = diff.zombieSpeedScale || 1;
 state.zombies.push({
 id: state.nextZombieId++, kind, row, x: cols - 0.1,
 hp: Math.round(base.hp * hpScale), maxHp: Math.round(base.hp * hpScale),
 speed: base.speed * speedScale,
 biteTimer: 0, slowTimer: 0, angry: false, shield: false, biteDmg: base.bite,
 });
    }
  }
}
