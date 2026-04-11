// ═══════════════════════════════════════════════
// PVZ Lite: Chaos Garden — 主遊戲協調器
// ═══════════════════════════════════════════════
import { rows, cols, PLANTS, ZOMBIES, SPELLS } from './config.js';
import { ensureAudio, sfx } from './audio.js';
import {
  boardEl, shopEl, mobileShopEl, sunEl, killsEl, waveEl, mowerEl,
  overlayEl, endTitleEl, endTextEl, battleStatusEl, statusTitleEl, statusTextEl, modifierTagEl,
  pauseBtn, draftOverlayEl, draftCardsEl, draftWaveEl, spellBarEl, chaosAlertEl,
  deckCountEl, bossHpBarEl, bossHpTextEl, runInfoEl,
} from './dom.js';
import { updateBattleStatus } from './systems/status.js';
import { startWaveSpawns, updateSpawning } from './systems/spawn.js';
import { updateShop, actualPlantCost } from './systems/shop.js';
import { createRunState, initCooldowns, initSpellCooldowns, getPlantLevel, addPlantXP } from './core/state.js';
import { cellKey, flash } from './core/helpers.js';
import { addSun, collectSun, updateSkyDrops } from './systems/economy.js';
import { makeBoard } from './render/board.js';
import { renderEntities } from './render/entities.js';
import { updateModifiers, killReward } from './systems/modifiers.js';
import { cleanupState } from './systems/cleanup.js';
import { updatePlantsCombat, updatePeasCombat, updateZombieCombat } from './systems/combat.js';
import { bindPauseControl } from './ui/controls.js';
import { generateDraftCards, applyDraftCard } from './systems/draft.js';
import { getEvolutionBonus, applyEvolutionToPlant } from './systems/evolution.js';
import { canCastSpell, castSpell, updateSpellCooldowns, updateSpellEffects } from './systems/spells.js';
import { checkChaosTrigger, isChaosActive } from './systems/chaos.js';

let state;
let loopId;
let lastTime = 0;
let isPaused = false;

// ═══════════════════════════════════════════════
// 遊戲初始化
// ═══════════════════════════════════════════════

export function startGame() {
  cancelAnimationFrame(loopId);
  state = createRunState();
  initCooldowns(state);
  isPaused = false;
  pauseBtn.textContent = '暫停';
  lastTime = 0;

  createBoard();
  buildShop();
  updateSpellBarUI();
  syncStats();
  selectPlant('peashooter');
  overlayEl.classList.remove('show');
  draftOverlayEl.classList.remove('show');
  updateShop(state);
  updateBattleStatus(state, { battleStatusEl, statusTitleEl, statusTextEl, modifierTagEl }, 'normal');
  render();

  // 開始第一波
  startNextWave();
  loopId = requestAnimationFrame(frame);
}

// ═══════════════════════════════════════════════
// 波次管理
// ═══════════════════════════════════════════════

function startNextWave() {
  startWaveSpawns(state);
  state.waveActive = true;
  state.spawnTimer = 0;

  if (state.isBossWave) {
    sfx('boss');
  }

  updateBattleStatus(state, { battleStatusEl, statusTitleEl, statusTextEl, modifierTagEl }, 'normal');
  syncStats();
}

function checkWaveComplete() {
  if (!state.waveActive) return false;

  // 波次完成 = spawnQueue 空了 && 所有殭屍死了
  if (state.spawnQueue.length === 0 && state.zombies.length === 0) {
    state.waveActive = false;
    state.bossActive = false;

    // 進入 Draft 階段
    enterDraftPhase();
    return true;
  }
  return false;
}

// ═══════════════════════════════════════════════
// Draft 階段
// ═══════════════════════════════════════════════

function enterDraftPhase() {
  state.draftPhase = true;
  state.draftCards = generateDraftCards(state);

  sfx('draft');

  // 顯示 Draft UI
  draftOverlayEl.classList.add('show');
  draftWaveEl.textContent = `第 ${state.wave} 波完成！選擇一張牌：`;

  draftCardsEl.innerHTML = state.draftCards.map((card, i) => {
    let badge = '';
    if (card.type === 'plant') badge = card.owned ? '🔄 進化催化' : '🆕 加入牌組';
    else if (card.type === 'mutation') badge = '💪 全局強化';
    else if (card.type === 'spell') badge = '✨ 解鎖法術';

    return `
      <div class="draft-card" data-index="${i}">
        <div class="draft-badge">${badge}</div>
        <div class="draft-emoji">${card.emoji}</div>
        <div class="draft-name">${card.name}</div>
        <div class="draft-desc">${card.desc}</div>
        ${card.cost ? `<div class="draft-cost">${card.cost} ☀️</div>` : ''}
        ${card.cooldown ? `<div class="draft-cd">CD: ${card.cooldown}s</div>` : ''}
      </div>
    `;
  }).join('');

  // 綁定點擊
  draftCardsEl.querySelectorAll('.draft-card').forEach(el => {
    el.addEventListener('click', () => {
      const idx = parseInt(el.dataset.index);
      selectDraftCard(idx);
    });
  });

  // 暫停遊戲
  isPaused = true;
}

function selectDraftCard(idx) {
  const card = state.draftCards[idx];
  if (!card) return;

  applyDraftCard(state, card);
  sfx('evolve');

  // 關閉 Draft UI
  draftOverlayEl.classList.remove('show');
  state.draftPhase = false;

  // 進入下一波
  state.wave++;
  state.maxWaveReached = Math.max(state.maxWaveReached, state.wave);

  // 重建商店（可能有新牌）
  buildShop();
  updateSpellBarUI();

  // 恢復遊戲
  isPaused = false;
  startNextWave();
}

// ═══════════════════════════════════════════════
// 商店 & 牌組
// ═══════════════════════════════════════════════

function buildShop() {
  const html = state.deck.map(k => {
    const p = PLANTS[k];
    if (!p) return '';
    return `<div class="card" data-plant="${k}">
      <div class="row"><strong>${p.emoji} ${p.name}</strong><span class="cost">${p.cost} ☀️</span></div>
      <div class="muted">${p.desc}</div>
      <div class="cooldown"></div><div class="cooltxt"></div>
    </div>`;
  }).join('');

  shopEl.innerHTML = html;
  mobileShopEl.innerHTML = html;

  [...document.querySelectorAll('.card')].forEach(c => {
    c.addEventListener('click', () => { ensureAudio(); selectPlant(c.dataset.plant); });
  });
}

function selectPlant(name) {
  if (!state.deck.includes(name)) return;
  state.selectedPlant = name;
  [...document.querySelectorAll('.card')].forEach(c => c.classList.toggle('selected', c.dataset.plant === name));
}

// ═══════════════════════════════════════════════
// 法術 UI
// ═══════════════════════════════════════════════

function updateSpellBarUI() {
  if (!spellBarEl) return;
  spellBarEl.innerHTML = state.unlockedSpells.map(id => {
    const s = SPELLS[id];
    if (!s) return '';
    const cd = state.spellCooldowns[id] || 0;
    const ready = cd <= 0;
    return `<div class="spell-slot ${ready ? 'ready' : 'cooldown'}" data-spell="${id}" title="${s.desc}">
      <div class="spell-emoji">${s.emoji}</div>
      <div class="spell-name">${s.name}</div>
      <div class="spell-cd">${ready ? '' : Math.ceil(cd) + 's'}</div>
    </div>`;
  }).join('');

  spellBarEl.querySelectorAll('.spell-slot.ready').forEach(el => {
    el.addEventListener('click', () => {
      const result = castSpell(state, el.dataset.spell);
      if (result) {
        sfx('spell');
        showChaosAlert(result.msg);
      }
    });
  });
}

// ═══════════════════════════════════════════════
// 植物放置
// ═══════════════════════════════════════════════

function createBoard() {
  makeBoard(boardEl, rows, cols, (r, c) => { ensureAudio(); placePlant(r, c); });
}

function placePlant(r, c) {
  if (state.gameOver || state.draftPhase) return;
  const key = cellKey(r, c);
  const type = state.selectedPlant;
  const def = PLANTS[type];
  if (!def) return;
  const actualCost = actualPlantCost(state, type, def);
  if (state.plants.has(key)) return;
  if (state.cooldowns[type] > 0) return flash(shopEl);
  if (state.sun < actualCost) return flash(sunEl);

  state.sun -= actualCost;
  state.cooldowns[type] = def.cooldown;

  // 計算進化後的屬性
  const level = 1;
  const evo = getEvolutionBonus(type, level);
  const hpWithBuff = Math.round(def.hp * (1 + (state.globalBuffs.hp || 0)) + (evo.bonusHp || 0));

  state.plants.set(key, {
    type, row: r, col: c,
    hp: hpWithBuff, maxHp: hpWithBuff,
    attackTimer: 0, sunTimer: 0, explodeTimer: 0.8,
    level, xp: 0,
  });

  syncStats();
  updateShop(state);
  sfx(type === 'bomb' ? 'boom' : 'plant');
  render();
}

// ═══════════════════════════════════════════════
// 植物交換法術
// ═══════════════════════════════════════════════

function handleSwapMode(r, c) {
  if (!state.swapMode) return false;
  const key = cellKey(r, c);
  const plant = state.plants.get(key);

  if (!plant) return false;

  if (!state.swapFirst) {
    state.swapFirst = { key, plant };
    return true;
  } else {
    // 交換
    const first = state.swapFirst;
    const firstPlant = first.plant;
    const secondPlant = plant;

    // 交換行列
    state.plants.delete(first.key);
    state.plants.delete(key);

    const tempRow = firstPlant.row, tempCol = firstPlant.col;
    firstPlant.row = secondPlant.row;
    firstPlant.col = secondPlant.col;
    secondPlant.row = tempRow;
    secondPlant.col = tempCol;

    state.plants.set(cellKey(firstPlant.row, firstPlant.col), firstPlant);
    state.plants.set(cellKey(secondPlant.row, secondPlant.col), secondPlant);

    state.swapMode = false;
    state.swapFirst = null;
    sfx('plant');
    render();
    return true;
  }
}

// ═══════════════════════════════════════════════
// 割草機
// ═══════════════════════════════════════════════

function updateMowers(dt) {
  for (const m of state.lawnmowers) {
    if (!m.active) continue;
    m.x += 4.8 * dt;
    state.zombies.forEach(z => { if (z.row === m.row && z.x <= m.x + 0.55 && z.x >= m.x - 0.2) z.hp = -999; });
    if (m.x > cols + 0.6) { m.active = false; m.used = true; }
  }
}

// ═══════════════════════════════════════════════
// 混亂警報
// ═══════════════════════════════════════════════

function showChaosAlert(msg) {
  if (!chaosAlertEl) return;
  chaosAlertEl.textContent = msg;
  chaosAlertEl.classList.add('show');
  setTimeout(() => chaosAlertEl.classList.remove('show'), 3000);
}

// ═══════════════════════════════════════════════
// Boss 血條
// ═══════════════════════════════════════════════

function updateBossHpBar() {
  if (!bossHpBarEl) return;
  const boss = state.zombies.find(z => z.kind === 'boss');
  if (boss) {
    bossHpBarEl.classList.add('show');
    const pct = Math.max(0, boss.hp / boss.maxHp * 100);
    bossHpBarEl.querySelector('.boss-hp-fill').style.width = `${pct}%`;
    if (bossHpTextEl) bossHpTextEl.textContent = `${boss.bossName || 'Boss'} — ${Math.round(boss.hp)}/${boss.maxHp}`;
  } else {
    bossHpBarEl.classList.remove('show');
  }
}

// ═══════════════════════════════════════════════
// 主更新迴圈
// ═══════════════════════════════════════════════

function update(dt) {
  if (state.gameOver || state.draftPhase) return;

  // 修飾器
  updateModifiers(state, dt);

  // 出怪
  updateSpawning(state, dt);

  // 陽光掉落
  updateSkyDrops(state, dt, cols);

  // 戰鬥
  updatePlantsCombat(state, dt, sfx, addSun, (row, col) => state.plants.delete(cellKey(row, col)));
  updatePeasCombat(state, dt, sfx);
  if (!updateZombieCombat(state, dt, sfx, cellKey)) {
    gameEnd(false);
    return;
  }

  // 割草機
  updateMowers(dt);

  // 清理
  const { killed } = cleanupState(state, dt);
  if (killed > 0) {
    state.kills += killed;
    state.totalKills += killed;
    state.sun += killed * killReward(12, state);
    syncStats();

    // 檢查植物進化
    for (const [key, plant] of state.plants) {
      const oldLevel = plant.level || 1;
      const newLevel = getPlantLevel(plant.xp || 0);
      if (newLevel > oldLevel) {
        plant.level = newLevel;
        applyEvolutionToPlant(plant);
        sfx('evolve');
        showChaosAlert(`🌟 ${PLANTS[plant.type]?.name} 進化到 Lv.${newLevel}！`);
      }
    }
  }

  // 法術冷卻 & 效果
  updateSpellCooldowns(state, dt);
  updateSpellEffects(state, dt);

  // 混亂事件
  if (state.wave >= 2) {
    const chaosEvent = checkChaosTrigger(state, dt);
    if (chaosEvent) {
      sfx('chaos');
      showChaosAlert(`🌪️ ${chaosEvent.name}：${chaosEvent.desc}`);
    }
  }

  // UI 更新
  updateShop(state);
  updateSpellBarUI();
  updateBossHpBar();

  const dangerLevel = state.zombies.length >= 8 ? 'danger' : state.zombies.length >= 4 ? 'alert' : 'normal';
  updateBattleStatus(state, { battleStatusEl, statusTitleEl, statusTextEl, modifierTagEl }, dangerLevel);

  // 波次完成檢查
  checkWaveComplete();
}

function render() {
  renderEntities(boardEl, state);
}

// ═══════════════════════════════════════════════
// 遊戲結束
// ═══════════════════════════════════════════════

function gameEnd(win) {
  state.gameOver = true;
  overlayEl.classList.add('show');

  if (win) {
    endTitleEl.textContent = '🎉 你贏了！';
    endTextEl.textContent = `通關到第 ${state.wave} 波，擊殺 ${state.totalKills} 隻，牌組 ${state.deck.length} 張！`;
    sfx('win');
  } else {
    endTitleEl.textContent = '💀 殭屍突破了防線';
    endTextEl.textContent = `你撐到第 ${state.wave} 波，擊殺 ${state.totalKills} 隻。\n牌組：${state.deck.map(k => PLANTS[k]?.emoji || k).join(' ')}\n\n再來一次，下一次一定更強！`;
    sfx('lose');
  }
}

// ═══════════════════════════════════════════════
// 數據同步
// ═══════════════════════════════════════════════

function syncStats() {
  sunEl.textContent = state.sun;
  killsEl.textContent = state.totalKills;
  waveEl.textContent = state.wave;
  mowerEl.textContent = state.lawnmowers.filter(m => !m.used).length;
  if (deckCountEl) deckCountEl.textContent = state.deck.length;
  if (runInfoEl) runInfoEl.textContent = `跑局：第 ${state.wave} 波`;
}

// ═══════════════════════════════════════════════
// 主迴圈
// ═══════════════════════════════════════════════

function frame(ts) {
  if (!lastTime) lastTime = ts;
  const dt = Math.min((ts - lastTime) / 1000, 0.033);
  lastTime = ts;
  if (!isPaused && !state.draftPhase) {
    update(dt);
    render();
  }
  loopId = requestAnimationFrame(frame);
}

// ═══════════════════════════════════════════════
// 事件綁定
// ═══════════════════════════════════════════════

export function bindGameEvents() {
  bindPauseControl(pauseBtn, statusTitleEl, statusTextEl, () => isPaused, v => { isPaused = v; });

  boardEl.addEventListener('pointerdown', e => {
    const sunEl = e.target.closest('.sun');
    if (sunEl) {
      e.preventDefault();
      e.stopPropagation();
      ensureAudio();
      if (collectSun(state, Number(sunEl.dataset.sunId))) {
        syncStats();
        updateShop(state);
        sfx('sun');
        render();
      }
      return;
    }

    // 植物交換模式
    const cell = e.target.closest('.cell');
    if (cell && state.swapMode) {
      const r = parseInt(cell.dataset.row);
      const c = parseInt(cell.dataset.col);
      handleSwapMode(r, c);
    }
  });
}
