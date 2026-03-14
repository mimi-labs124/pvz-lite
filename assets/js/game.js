import { rows, cols, LEVELS, PLANTS, ZOMBIES } from './config.js';
import { ensureAudio, sfx } from './audio.js';
import { boardEl, shopEl, mobileShopEl, sunEl, killsEl, waveEl, mowerEl, levelHintEl, levelSelect, overlayEl, endTitleEl, endTextEl, battleStatusEl, statusTitleEl, statusTextEl, modifierTagEl, pauseBtn } from './dom.js';
import { updateLevelHint, updateBattleStatus } from './systems/status.js';
import { spawnZombie } from './systems/spawn.js';
import { updateShop, actualPlantCost } from './systems/shop.js';
import { createGameState, initCooldowns } from './core/state.js';
import { cellKey, flash } from './core/helpers.js';
import { addSun, collectSun } from './systems/economy.js';
import { makeBoard } from './render/board.js';
import { renderEntities } from './render/entities.js';
import { updateModifiers, modifierSpawnPenalty, modifierSunSpeed, killReward } from './systems/modifiers.js';
import { cleanupState } from './systems/cleanup.js';
import { updatePlantsCombat, updatePeasCombat, updateZombieCombat } from './systems/combat.js';
import { bindPauseControl } from './ui/controls.js';

let state;
let loopId;
let lastTime = 0;
let isPaused = false;

function freshState() {
  const level = LEVELS[levelSelect.value];
  return initCooldowns(createGameState(levelSelect.value, level), Object.keys(PLANTS));
}

function buildShop() {
  const html = Object.entries(PLANTS).map(([k, p]) => `<div class="card" data-plant="${k}"><div class="row"><strong>${p.emoji} ${p.name}</strong><span class="cost">${p.cost} ☀️</span></div><div class="muted">${p.desc}</div><div class="cooldown"></div><div class="cooltxt"></div></div>`).join('');
  shopEl.innerHTML = html;
  mobileShopEl.innerHTML = html;
  [...document.querySelectorAll('.card')].forEach(c => c.addEventListener('click', () => { ensureAudio(); selectPlant(c.dataset.plant); }));
}

function selectPlant(name) {
  state.selectedPlant = name;
  [...document.querySelectorAll('.card')].forEach(c => c.classList.toggle('selected', c.dataset.plant === name));
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
  const key = cellKey(r, c);
  const type = state.selectedPlant;
  const def = PLANTS[type];
  const actualCost = actualPlantCost(state, type, def);
  if (state.plants.has(key)) return;
  if (state.cooldowns[type] > 0) return flash(shopEl);
  if (state.sun < actualCost) return flash(sunEl);
  state.sun -= actualCost;
  state.cooldowns[type] = def.cooldown;
  state.plants.set(key, { type, row: r, col: c, hp: def.hp, maxHp: def.hp, attackTimer: 0, sunTimer: 0, explodeTimer: 0.8 });
  syncStats();
  updateShop(state, PLANTS);
  sfx(type === 'bomb' ? 'boom' : 'plant');
  render();
}

function updateMowers(dt) {
  for (const m of state.lawnmowers) {
    if (!m.active) continue;
    m.x += 4.8 * dt;
    state.zombies.forEach(z => { if (z.row === m.row && z.x <= m.x + 0.55 && z.x >= m.x - 0.2) z.hp = -999; });
    if (m.x > cols + 0.6) { m.active = false; m.used = true; }
  }
}

function update(dt) {
  if (state.gameOver) return;
  const level = LEVELS[state.levelKey];
  updateModifiers(state, dt);
  state.spawnTimer += dt;
  state.sunTimer += dt;
  const spawnEvery = Math.max(level.spawnBase - state.wave * 0.18 + modifierSpawnPenalty(state.modifier), level.spawnMin);
  if (state.spawnTimer >= spawnEvery) {
    state.spawnTimer = 0;
    const burst = state.wave >= level.spawnBurstWave ? 2 : 1;
    for (let i = 0; i < burst; i++) spawnZombie(state);
  }
  if (state.sunTimer >= level.sunDrop) {
    state.sunTimer = 0;
    const speed = modifierSunSpeed(state.modifier, state.levelKey);
    addSun(state, Math.random() * (cols * 90 - 50) + 20, 10, 25, speed);
  }
  updatePlantsCombat(state, dt, sfx, addSun, (row, col) => state.plants.delete(cellKey(row, col)));
  updatePeasCombat(state, dt, sfx);
  if (!updateZombieCombat(state, dt, sfx, cellKey)) {
    gameEnd(false);
    return;
  }
  updateMowers(dt);
  const { killed } = cleanupState(state, dt);
  if (killed > 0) {
    state.kills += killed;
    state.sun += killed * killReward(12, state.modifier);
    syncStats();
  }
  updateShop(state, PLANTS);
  updateLevelHint(state, levelHintEl);
  updateBattleStatus(state, { battleStatusEl, statusTitleEl, statusTextEl, modifierTagEl }, state.zombies.length >= 8 ? 'danger' : 'normal');
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

function frame(ts) {
  if (!lastTime) lastTime = ts;
  const dt = Math.min((ts - lastTime) / 1000, 0.033);
  lastTime = ts;
  if (!isPaused) {
    update(dt);
    render();
  }
  loopId = requestAnimationFrame(frame);
}

export function startGame() {
  cancelAnimationFrame(loopId);
  state = freshState();
  isPaused = false;
  pauseBtn.textContent = '暫停';
  lastTime = 0;
  createBoard();
  buildShop();
  syncStats();
  selectPlant('peashooter');
  overlayEl.classList.remove('show');
  updateShop(state, PLANTS);
  updateLevelHint(state, levelHintEl);
  updateBattleStatus(state, { battleStatusEl, statusTitleEl, statusTextEl, modifierTagEl }, 'normal');
  render();
  loopId = requestAnimationFrame(frame);
}

export function bindGameEvents() {
  bindPauseControl(pauseBtn, statusTitleEl, statusTextEl, () => isPaused, v => { isPaused = v; });
  boardEl.addEventListener('pointerdown', e => {
    const t = e.target.closest('.sun');
    if (t) {
      e.preventDefault();
      e.stopPropagation();
      ensureAudio();
      if (collectSun(state, Number(t.dataset.sunId))) {
        syncStats();
        updateShop(state, PLANTS);
        sfx('sun');
        render();
      }
    }
  });
}

