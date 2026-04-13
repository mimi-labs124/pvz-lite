import { rows, cols, LEVELS, PLANTS } from './config.js';
import { ensureAudio, sfx } from './audio.js';
import { boardEl, sunEl, killsEl, waveEl, mowerEl, levelHintEl, levelSelect, overlayEl, endTitleEl, endTextEl, battleStatusEl, statusTitleEl, statusTextEl, modifierTagEl, pauseBtn, shopEl } from './dom.js';
import { updateLevelHint, updateBattleStatus } from './systems/status.js';
import { spawnZombie } from './systems/spawn.js';
import { updateShop } from './systems/shop.js';
import { createGameState, initCooldowns } from './core/state.js';
import { flash } from './core/helpers.js';
import { addSun } from './systems/economy.js';
import { makeBoard } from './render/board.js';
import { renderEntities } from './render/entities.js';
import { updateModifiers, modifierSpawnPenalty, modifierSunSpeed, killReward } from './systems/modifiers.js';
import { cleanupState } from './systems/cleanup.js';
import { updatePlantsCombat, updatePeasCombat, updateZombieCombat } from './systems/combat.js';
import { bindPause, bindBoardInteraction } from './ui/bindings.js';
import { createLoop } from './core/loop.js';
import { buildShop, highlightSelected } from './ui/shop-ui.js';
import { tryPlacePlant } from './systems/placement.js';

let state;
const loop = createLoop(dt => gameTick(dt));

/** Track last wave shown to trigger announcements */
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
  highlightSelected(name);
}

function syncStats() {
  sunEl.textContent = state.sun;
  killsEl.textContent = state.kills;
  waveEl.textContent = state.wave;
  mowerEl.textContent = state.lawnmowers.filter(m => !m.used).length;
}

function createBoard() {
  makeBoard(boardEl, rows, cols, (r, c) => { ensureAudio(); placePlant(r, c); });
}

function placePlant(r, c) {
  if (state.gameOver) return;
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
    for (let i = 0; i < burst; i++) spawnZombie(state);
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
  const { killed } = cleanupState(state, dt);
  if (killed > 0) {
    state.kills += killed;
    state.sun += killed * killReward(12, state.modifier);
    syncStats();
  }
}

function phaseUISync(dt) {
  updateShop(state, PLANTS);
  updateLevelHint(state, levelHintEl);
  updateBattleStatus(state, { battleStatusEl, statusTitleEl, statusTextEl, modifierTagEl }, state.zombies.length >= 8 ? 'danger' : 'normal');

  // Wave announcement
  if (state.wave !== lastAnnouncedWave && state.wave > 1) {
    lastAnnouncedWave = state.wave;
    showWaveToast(state.wave);
  }
  if (waveToastTimer > 0) {
    waveToastTimer -= dt;
    if (waveToastTimer <= 0) {
      const toast = document.getElementById('waveToast');
      if (toast) toast.classList.remove('show', 'big');
    }
  }
}

/** Main tick — called by the loop every frame with capped dt */
function gameTick(dt) {
  if (state.gameOver) return;
  phaseModifiers(dt);
  phaseSpawn(dt);
  phaseEconomy(dt);
  if (!phaseCombat(dt)) return;
  phaseMowers(dt);
  phaseCleanup(dt);
  phaseUISync(dt);
  const level = LEVELS[state.levelKey];
  if (state.kills >= level.winKills) gameEnd(true);
}

function render() {
  renderEntities(boardEl, state);
}

function gameEnd(win) {
  state.gameOver = true;
  overlayEl.classList.add('show');
  endTitleEl.textContent = win ? '你贏了！' : '殭屍進家門了';
  endTextEl.textContent = win ? `通關 ${levelSelect.options[levelSelect.selectedIndex].text}，擊殺 ${state.kills} 隻，打到第 ${state.wave} 波。` : `你撐到第 ${state.wave} 波，擊殺 ${state.kills} 隻。`;
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
}
