import { rows, cols, LEVELS, PLANTS, POWERUPS } from './config.js';
import { ensureAudio, sfx } from './audio.js';
import { boardEl, sunEl, killsEl, waveEl, mowerEl, levelHintEl, levelSelect, overlayEl, endTitleEl, endTextEl, battleStatusEl, statusTitleEl, statusTextEl, modifierTagEl, pauseBtn, shopEl } from './dom.js';
import { updateLevelHint, updateBattleStatus } from './systems/status.js';
import { spawnZombie, spawnFlagWave, spawnImp } from './systems/spawn.js';
import { updateShop } from './systems/shop.js';
import { createGameState, initCooldowns } from './core/state.js';
import { flash } from './core/helpers.js';
import { addSun } from './systems/economy.js';
import { makeBoard } from './render/board.js';
import { renderEntities } from './render/entities.js';
import { updateModifiers, modifierSpawnPenalty, modifierSunSpeed, killReward } from './systems/modifiers.js';
import { cleanupState, collectPowerup, maybeDropPowerup } from './systems/cleanup.js';
import { updatePlantsCombat, updatePeasCombat, updateZombieCombat } from './systems/combat.js';
import { bindPause, bindBoardInteraction } from './ui/bindings.js';
import { createLoop } from './core/loop.js';
import { buildShop, highlightSelected } from './ui/shop-ui.js';
import { tryPlacePlant, tryShovelPlant, tryUpgradePlant } from './systems/placement.js';
import { checkAchievements, showAchievementToast, loadRecords, saveRecord } from './systems/achievements.js';

let state;
const loop = createLoop(dt => gameTick(dt));
let lastAnnouncedWave = 0;
let waveToastTimer = 0;

function freshState() {
  const level = LEVELS[levelSelect.value];
  lastAnnouncedWave = 0;
  waveToastTimer = 0;
  return initCooldowns(createGameState(levelSelect.value, level), Object.keys(PLANTS));
}

function selectPlant(name) {
  state.selectedPlant = name;
  state.shovelMode = false;
  highlightSelected(name);
  updateShovelBtn();
}

function toggleShovel() {
  state.shovelMode = !state.shovelMode;
  if (state.shovelMode) state.selectedPlant = null;
  highlightSelected('');
  updateShovelBtn();
}

function updateShovelBtn() {
  const btn = document.getElementById('shovelBtn');
  if (btn) btn.classList.toggle('active', state.shovelMode);
}

function syncStats() {
  sunEl.textContent = state.sun;
  killsEl.textContent = state.kills;
  waveEl.textContent = state.wave;
  mowerEl.textContent = state.lawnmowers.filter(m => !m.used).length;
  // Combo display
  let comboEl = document.getElementById('comboDisplay');
  if (!comboEl) {
    comboEl = document.createElement('div');
    comboEl.id = 'comboDisplay';
    comboEl.className = 'combo-display';
    const statsEl = document.querySelector('.stats');
    if (statsEl) statsEl.appendChild(comboEl);
  }
  comboEl.textContent = state.combo >= 2 ? `🔥 ${state.combo}x` : '';
  comboEl.classList.toggle('show', state.combo >= 2);
  // Speed display
  let speedEl = document.getElementById('speedDisplay');
  if (!speedEl) {
    speedEl = document.createElement('div');
    speedEl.id = 'speedDisplay';
    speedEl.className = 'speed-display';
    const statsEl = document.querySelector('.stats');
    if (statsEl) statsEl.appendChild(speedEl);
  }
  speedEl.textContent = state.gameSpeed > 1 ? `⏩ ${state.gameSpeed}x` : '';
}

function createBoard() {
  makeBoard(boardEl, rows, cols, (r, c) => {
    ensureAudio();
    if (state.shovelMode) {
      handleShovel(r, c);
    } else {
      placePlant(r, c);
    }
  });

  // Right-click / long-press on planted cell to upgrade
  boardEl.querySelectorAll('.cell').forEach(cell => {
    cell.addEventListener('contextmenu', e => {
      e.preventDefault();
      const r = Number(cell.dataset.row);
      const c = Number(cell.dataset.col);
      handleUpgrade(r, c);
    });
  });
}

function placePlant(r, c) {
  if (state.gameOver) return;
  const key = `${r}-${c}`;
  // If there's already a plant, try to upgrade it instead
  if (state.plants.has(key)) {
    handleUpgrade(r, c);
    return;
  }
  const result = tryPlacePlant(state, state.selectedPlant, r, c);
  if (!result.ok) {
    if (result.flashTarget === 'sun') flash(sunEl);
    else if (result.flashTarget === 'shop') flash(shopEl);
    return;
  }
  syncStats();
  updateShop(state, PLANTS);
  sfx(result.plantType === 'bomb' ? 'boom' : 'plant');
  render();
}

function handleShovel(r, c) {
  if (state.gameOver) return;
  const result = tryShovelPlant(state, r, c);
  if (!result.ok) return;
  sfx('shovel');
  syncStats();
  updateShop(state, PLANTS);
  render();
}

function handleUpgrade(r, c) {
  if (state.gameOver) return;
  const result = tryUpgradePlant(state, r, c);
  if (!result.ok) {
    if (result.reason === 'no_sun') flash(sunEl);
    return;
  }
  sfx('upgrade');
  syncStats();
  updateShop(state, PLANTS);
  render();
}

/** Show a wave announcement toast */
function showWaveToast(wave) {
  let existing = document.getElementById('waveToast');
  if (!existing) {
    existing = document.createElement('div');
    existing.id = 'waveToast';
    existing.className = 'wave-toast';
    const wrap = document.querySelector('.board-wrap');
    if (wrap) wrap.appendChild(existing);
  }
  const isBig = wave % 5 === 0;
  existing.textContent = isBig ? `🌊 第 ${wave} 波 — 大波來襲！` : `🌊 第 ${wave} 波`;
  existing.classList.add('show');
  existing.classList.toggle('big', isBig);
  waveToastTimer = 2.2;
}

/* ── Update pipeline (explicit phases) ── */

function phaseModifiers(dt) {
  updateModifiers(state, dt);
}

function phaseSpawn(dt) {
  const level = LEVELS[state.levelKey];
  state.spawnTimer += dt;
  const spawnEvery = Math.max(level.spawnBase - state.wave * 0.18 + modifierSpawnPenalty(state.modifier), level.spawnMin);
  if (state.spawnTimer >= spawnEvery) {
    state.spawnTimer = 0;
    const burst = state.wave >= level.spawnBurstWave ? 2 : 1;
    for (let i = 0; i < burst; i++) {
      spawnZombie(state);
    }
  }
}

function phaseEconomy(dt) {
  const level = LEVELS[state.levelKey];
  state.sunTimer += dt;
  if (state.sunTimer >= level.sunDrop) {
    state.sunTimer = 0;
    const speed = modifierSunSpeed(state.modifier, state.levelKey);
    addSun(state, Math.random() * (cols * 90 - 50) + 20, 10, 25, speed);
  }
}

function phaseCombat(dt) {
  updatePlantsCombat(state, dt, sfx, addSun, (row, col) => state.plants.delete(`${row}-${col}`));
  updatePeasCombat(state, dt, sfx);
  if (!updateZombieCombat(state, dt, sfx, (r, c) => `${r}-${c}`)) {
    gameEnd(false);
    return false;
  }
  return true;
}

function phaseMowers(dt) {
  for (const m of state.lawnmowers) {
    if (!m.active) continue;
    m.x += 4.8 * dt;
    state.zombies.forEach(z => { if (z.row === m.row && z.x <= m.x + 0.55 && z.x >= m.x - 0.2) z.hp = -999; });
    if (m.x > cols + 0.6) { m.active = false; m.used = true; }
  }
}

function phaseCleanup(dt) {
  // Track dead zombies before cleanup for imp spawn + powerup drops
  const deadZombies = state.zombies.filter(z => z.hp <= 0 && !z._processed);
  for (const z of deadZombies) {
    z._processed = true;
    // Giant drops imp
    if (z.kind === 'giant' && z.hasImp) {
      spawnImp(state, z.row, z.x);
    }
    // Maybe drop power-up
    maybeDropPowerup(state, z.row, z.x);
  }

  const { killed } = cleanupState(state, dt);
  if (killed > 0) {
    state.kills += killed;
    const comboBonus = state.combo >= 10 ? 5 : state.combo >= 5 ? 3 : state.combo >= 3 ? 1 : 0;
    state.sun += killed * killReward(12, state.modifier) + comboBonus;
    if (comboBonus > 0) sfx('combo');
    syncStats();
  }
}

function phaseAchievements() {
  const newAch = checkAchievements(state);
  for (const ach of newAch) showAchievementToast(ach);
}

function phaseUISync(dt) {
  updateShop(state, PLANTS);
  updateLevelHint(state, levelHintEl);
  updateBattleStatus(state, { battleStatusEl, statusTitleEl, statusTextEl, modifierTagEl }, state.zombies.length >= 8 ? 'danger' : 'normal');

  // Wave announcement
  if (state.wave !== lastAnnouncedWave && state.wave > 1) {
    lastAnnouncedWave = state.wave;
    showWaveToast(state.wave);
    if (state.wave % 5 === 0) spawnFlagWave(state);
  }
  if (waveToastTimer > 0) {
    waveToastTimer -= dt;
    if (waveToastTimer <= 0) {
      const toast = document.getElementById('waveToast');
      if (toast) toast.classList.remove('show', 'big');
    }
  }

  updateBestRecord();
  updateCellHighlights();
}

function updateBestRecord() {
  let recEl = document.getElementById('bestRecord');
  if (!recEl) {
    recEl = document.createElement('div');
    recEl.id = 'bestRecord';
    recEl.className = 'best-record muted';
    const statsEl = document.querySelector('.stats');
    if (statsEl) statsEl.insertBefore(recEl, statsEl.firstChild);
  }
  const records = loadRecords();
  const key = state.levelKey;
  recEl.textContent = records[key] ? `🏆 ${records[key].kills}殺/${records[key].wave}波` : '';
}

/** Highlight cells to show valid/invalid placement */
function updateCellHighlights() {
  if (!state.selectedPlant || state.shovelMode || state.gameOver) {
    boardEl.querySelectorAll('.cell').forEach(c => c.classList.remove('valid', 'invalid'));
    return;
  }
  const def = PLANTS[state.selectedPlant];
  if (!def) return;
  boardEl.querySelectorAll('.cell').forEach(c => {
    const r = Number(c.dataset.row);
    const col = Number(c.dataset.col);
    const key = `${r}-${col}`;
    const hasPlant = state.plants.has(key);
    const canAfford = state.sun >= def.cost;
    const notOnCooldown = state.cooldowns[state.selectedPlant] <= 0;
    if (hasPlant) {
      c.classList.remove('valid');
      c.classList.add('invalid');
    } else if (canAfford && notOnCooldown) {
      c.classList.add('valid');
      c.classList.remove('invalid');
    } else {
      c.classList.remove('valid');
      c.classList.add('invalid');
    }
  });
}

/** Main tick — called by the loop every frame with capped dt */
function gameTick(dt) {
  if (state.gameOver) return;
  const speedDt = dt * state.gameSpeed;
  phaseModifiers(speedDt);
  phaseSpawn(speedDt);
  phaseEconomy(speedDt);
  if (!phaseCombat(speedDt)) return;
  phaseMowers(speedDt);
  phaseCleanup(speedDt);
  phaseAchievements();
  phaseUISync(dt); // UI sync always at real time
  const level = LEVELS[state.levelKey];
  if (state.kills >= level.winKills) gameEnd(true);
}

function render() {
  renderEntities(boardEl, state);
}

function gameEnd(win) {
  state.gameOver = true;
  if (win) {
    if (state.levelKey === 'normal') state.wonNormal = true;
    if (state.levelKey === 'hard') state.wonHard = true;
    if (state.levelKey === 'survival') state.wonSurvival = true;
  }
  phaseAchievements();
  saveRecord(state.levelKey, state.kills, state.wave, state.maxCombo);

  overlayEl.classList.add('show');
  endTitleEl.textContent = win ? '你贏了！' : '殭屍進家門了';
  const comboStr = state.maxCombo >= 3 ? ` | 最高 ${state.maxCombo}x 連殺` : '';
  const upgradeStr = state.upgradeCount > 0 ? ` | ${state.upgradeCount}次升級` : '';
  endTextEl.textContent = win
    ? `通關 ${levelSelect.options[levelSelect.selectedIndex].text}，擊殺 ${state.kills} 隻，打到第 ${state.wave} 波${comboStr}${upgradeStr}。`
    : `你撐到第 ${state.wave} 波，擊殺 ${state.kills} 隻${comboStr}。`;
  sfx(win ? 'win' : 'lose');
}

export function startGame() {
  loop.stop();
  state = freshState();
  loop.paused = false;
  pauseBtn.textContent = '暫停';
  createBoard();
  buildShop(name => selectPlant(name));
  syncStats();
  selectPlant('peashooter');
  overlayEl.classList.remove('show');
  updateShop(state, PLANTS);
  updateLevelHint(state, levelHintEl);
  updateBattleStatus(state, { battleStatusEl, statusTitleEl, statusTextEl, modifierTagEl }, 'normal');
  render();
  loop.start();
}

export function bindGameEvents() {
  bindPause(pauseBtn, statusTitleEl, statusTextEl, () => loop.paused, v => { loop.paused = v; });
  bindBoardInteraction(() => state, () => {
    syncStats();
    updateShop(state, PLANTS);
    sfx('sun');
    render();
  });

  // Shovel button
  const shovelBtn = document.getElementById('shovelBtn');
  if (shovelBtn) {
    shovelBtn.addEventListener('click', () => { ensureAudio(); toggleShovel(); });
  }

  // Speed control
  const speedBtn = document.getElementById('speedBtn');
  if (speedBtn) {
    speedBtn.addEventListener('click', () => {
      ensureAudio();
      state.gameSpeed = state.gameSpeed >= 2 ? 1 : state.gameSpeed + 0.5;
      speedBtn.textContent = state.gameSpeed > 1 ? `⏩ ${state.gameSpeed}x` : '⏩ 加速';
      speedBtn.classList.toggle('active', state.gameSpeed > 1);
      syncStats();
    });
  }

  // Power-up collection (pointerdown on board)
  boardEl.addEventListener('pointerdown', e => {
    const t = e.target.closest('.powerup');
    if (t) {
      e.preventDefault();
      e.stopPropagation();
      ensureAudio();
      if (collectPowerup(state, Number(t.dataset.powerupId))) {
        sfx('powerup');
        syncStats();
        render();
      }
    }
  });
}
