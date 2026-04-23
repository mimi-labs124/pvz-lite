// ═══════════════════════════════════════════════
// PVZ Lite: Chaos Awakening — 主遊戲協調器
// ═══════════════════════════════════════════════
import { rows, cols, PLANTS, SPELLS, XP_LEVELS } from './config.js';
import { ensureAudio, sfx } from './audio.js';
import {
 boardEl, shopEl, mobileShopEl, sunEl, killsEl, waveEl, mowerEl,
 overlayEl, endTitleEl, endTextEl, battleStatusEl, statusTitleEl, statusTextEl, modifierTagEl,
 pauseBtn, draftOverlayEl, draftCardsEl, draftWaveEl, spellBarEl, chaosAlertEl, xpBarEl,
 deckCountEl, bossHpBarEl, bossHpTextEl, runInfoEl,
 relicOverlayEl, relicCardsEl, relicTitleEl, frontlineInfoEl, conquestBtnEl,
} from './dom.js';
import { updateBattleStatus } from './systems/status.js';
import { startWaveSpawns, updateSpawning } from './systems/spawn.js';
import { updateShop, actualPlantCost } from './systems/shop.js';
import { createRunState, initCooldowns, getPlantLevel } from './core/state.js';
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
import { castSpell, updateSpellCooldowns, updateSpellEffects } from './systems/spells.js';
import { checkChaosTrigger } from './systems/chaos.js';

// Chaos Awakening 系統
import {
  loadRelics, generateRelicChoices, chooseRelic,
  applyRelicBuffs, checkPhoenixRevive, recordRun,
  RELICS, getRarityColor,
} from './systems/relics.js';
import { tryHarnessChaos } from './systems/harness.js';
import {
 initTerritory, tryConquest, territoryWaveReward,
 isCellPlayable, isConqueredCell, territoryDefenseMultiplier,
 territoryAttackSpeedBonus, territoryRowAttackSpeedBonus, territoryReflectBonus,
 autoConquestCheck, conquestCost, conquestReward,
 getCellTerrain, TERRAIN_TYPES, getPlayableCols,
} from './systems/territory.js';

let state;
let loopId;
let lastTime = 0;
let isPaused = false;
let territoryDirty = true; // 只在狀態變化時更新 DOM

// ═══════════════════════════════════════════════
// 遊戲初始化
// ═══════════════════════════════════════════════

export function startGame() {
  cancelAnimationFrame(loopId);
  state = createRunState();
  initCooldowns(state);

  applyRelicBuffs(state);
  state.sun += (state.relicBuffs.startSunBonus || 0);
  initTerritory(state);

  isPaused = false;
  pauseBtn.textContent = '暫停';
  lastTime = 0;
  territoryDirty = true;

  createBoard();
  buildShop();
  buildSpellBar();
  syncStats();
  selectPlant('peashooter');
  overlayEl.classList.remove('show');
  draftOverlayEl.classList.remove('show');

  const relicOv = relicOverlayEl;
  if (relicOv) relicOv.classList.remove('show');

  updateShop(state);
  updateBattleStatus(state, { battleStatusEl, statusTitleEl, statusTextEl, modifierTagEl }, 'normal');
  render();
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

  if (state.relicBuffs.waveSunBonus) {
    state.sun += state.relicBuffs.waveSunBonus;
  }

  if (state.relicBuffs.autoEvolveInterval && state.wave > 1) {
    if (state.wave % state.relicBuffs.autoEvolveInterval === 0) {
      for (const [key, plant] of state.plants) {
        if ((plant.level || 1) < 3) {
          plant.level = (plant.level || 1) + 1;
          applyEvolutionToPlant(plant);
          showChaosAlert(`🌳 ${PLANTS[plant.type]?.name} 自動進化到 Lv.${plant.level}！`);
        }
      }
    }
  }

 if (state.isBossWave) sfx('boss');

 // Wave toast announcement
 if (state.wave > 1) showWaveToast(state.wave);

 // Wave preview— show upcoming zombie types
  const previewKinds = getWavePreviewKinds(state.wave);
  if (previewKinds.length > 0) {
    showChaosAlert(`👁️ 第 ${state.wave} 波：${previewKinds.join(' ')}`);
  }

  // Bonus reroll every 5 waves
  if (state.wave % 5 === 0 && state.wave > 0) {
    state.draftRerolls = (state.draftRerolls || 0) + 1;
    showChaosAlert(`🎁 每 5 波獎勵：+1 重抽機會！`);
  }

  updateBattleStatus(state, { battleStatusEl, statusTitleEl, statusTextEl, modifierTagEl }, 'normal');
  syncStats();
}

function getWavePreviewKinds(wave) {
  const kinds = [];
  if (wave >= 1) kinds.push('🧟');
  if (wave >= 2) kinds.push('🚧');
  if (wave >= 3) kinds.push('📰');
  if (wave >= 4) kinds.push('🏃');
  if (wave >= 5) kinds.push('💉');
  if (wave >= 6) kinds.push('🪣');
  if (wave >= 7) kinds.push('🪓🛡️');
  if (wave >= 9) kinds.push('💀');
  if (wave >= 11) kinds.push('🧌');
  if (wave % 5 === 0) kinds.push('👾Boss');
  return kinds;
}

function checkWaveComplete() {
  if (!state.waveActive) return false;
  if (state.spawnQueue.length === 0 && state.zombies.length === 0) {
    state.waveActive = false;
    state.bossActive = false;

    const terrReward = territoryWaveReward(state);
    if (terrReward > 0) showChaosAlert(`🗡️ 領土收益 +${terrReward} ☀️`);

    const autoResult = autoConquestCheck(state);
    if (autoResult) {
      const msg = autoResult.advanced
        ? `🏰 自動佔領，前線推進！`
        : `🏰 自動佔領一格`;
      showChaosAlert(msg);
      territoryDirty = true;
    }

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

  renderDraftOverlay();

  isPaused = true;
}

function renderDraftOverlay() {
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
      </div>`;
  }).join('');

  draftCardsEl.querySelectorAll('.draft-card').forEach(el => {
    el.addEventListener('click', () => selectDraftCard(parseInt(el.dataset.index)));
  });

  // Reroll button
  let rerollBtn = draftOverlayEl.querySelector('.draft-reroll-btn');
  if (rerollBtn) rerollBtn.remove();
  if (state.draftRerolls > 0) {
    rerollBtn = document.createElement('button');
    rerollBtn.className = 'draft-reroll-btn';
    rerollBtn.textContent = `🔄 重抽 (${state.draftRerolls})`;
    rerollBtn.addEventListener('click', () => {
      state.draftRerolls--;
      state.draftCards = generateDraftCards(state);
      renderDraftOverlay();
    });
    draftOverlayEl.querySelector('.draft-dialog').appendChild(rerollBtn);
  }
}

function selectDraftCard(idx) {
  const card = state.draftCards[idx];
  if (!card) return;
  applyDraftCard(state, card);
  sfx('evolve');

  draftOverlayEl.classList.remove('show');
  state.draftPhase = false;
  state.wave++;
  state.maxWaveReached = Math.max(state.maxWaveReached, state.wave);

  buildShop();
  buildSpellBar(); // 可能解鎖了新法術
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
 state.conquestMode = false;
 state.shovelMode = false;
 updateShovelBtn();
 [...document.querySelectorAll('.card')].forEach(c => c.classList.toggle('selected', c.dataset.plant === name));
}

// ═══════════════════════════════════════════════
// 法術 UI — 事件委託，不在 update 中重建
// ═══════════════════════════════════════════════

let lastSpellCount = 0;

function buildSpellBar() {
  if (!spellBarEl) return;
  if (state.unlockedSpells.length === lastSpellCount) {
    // 只更新冷卻狀態，不重建 DOM
    refreshSpellCooldowns();
    return;
  }
  lastSpellCount = state.unlockedSpells.length;

  spellBarEl.innerHTML = state.unlockedSpells.map(id => {
    const s = SPELLS[id];
    if (!s) return '';
    return `<div class="spell-slot" data-spell="${id}" title="${s.desc}">
      <div class="spell-emoji">${s.emoji}</div>
      <div class="spell-name">${s.name}</div>
      <div class="spell-cd"></div>
      <div class="spell-cooldown-overlay"></div>
    </div>`;
  }).join('');

  // 事件委託 — 只綁一次
  spellBarEl.onclick = (e) => {
    const slot = e.target.closest('.spell-slot');
    if (!slot) return;
    const spellId = slot.dataset.spell;
    const result = castSpell(state, spellId);
    if (result) {
      sfx('spell');
      showChaosAlert(result.msg);
    }
  };

  refreshSpellCooldowns();
}

function refreshSpellCooldowns() {
  if (!spellBarEl) return;
  spellBarEl.querySelectorAll('.spell-slot').forEach(el => {
    const id = el.dataset.spell;
    const cd = state.spellCooldowns[id] || 0;
    const ready = cd <= 0;
    const maxCd = SPELLS[id]?.cooldown || 1;
    el.classList.toggle('ready', ready);
    el.classList.toggle('cooldown', !ready);
    el.querySelector('.spell-cd').textContent = ready ? '' : Math.ceil(cd) + 's';
    // Overlay-based cooldown
    const overlay = el.querySelector('.spell-cooldown-overlay');
    if (overlay) {
      if (ready) {
        overlay.style.transform = 'scaleY(0)';
      } else {
        const pct = Math.min(1, cd / maxCd);
        overlay.style.transform = `scaleY(${pct})`;
      }
    }
  });
}

// ═══════════════════════════════════════════════
// 植物放置
// ═══════════════════════════════════════════════

function createBoard() {
  makeBoard(boardEl, rows, cols, (r, c) => { ensureAudio(); handleCellClick(r, c); });
  territoryDirty = true;
}

function handleCellClick(r, c) {
 if (state.gameOver || state.draftPhase) return;

 if (state.shovelMode) {
 handleShovel(r, c);
 return;
 }

 if (state.conquestMode) {
 const result = tryConquest(state, r, c);
 if (result.ok) {
 sfx('plant');
 showChaosAlert(result.msg);
 territoryDirty = true;
 if (result.advanced) createBoard();
 syncStats();
 render();
 } else {
 flash(sunEl);
 showChaosAlert(`❌ ${result.msg}`);
 }
 return;
 }

 // 如果該格已有植物 → 升級
 const key = cellKey(r, c);
 if (state.plants.has(key)) {
 handleUpgrade(r, c);
 return;
 }

 placePlant(r, c);
}

function placePlant(r, c) {
  if (state.gameOver || state.draftPhase) return;

 if (!isCellPlayable(state, c)) {
 showChaosAlert('🚫 此列尚未開放！推進更多波次來解鎖');
 flash(boardEl);
 return;
 }

  const key = cellKey(r, c);
  const type = state.selectedPlant;
  const def = PLANTS[type];
  if (!def) return;
  const actualCost = actualPlantCost(state, type, def);
 if (state.cooldowns[type] > 0) return flash(shopEl);
  if (state.sun < actualCost) return flash(sunEl);

  state.sun -= actualCost;
  const cdReduction = state.relicBuffs?.cooldownReduction || 0;
  state.cooldowns[type] = def.cooldown * (1 - cdReduction);

  const level = 1;
  const evo = getEvolutionBonus(type, level);
  let hpWithBuff = Math.round(def.hp * (1 + (state.globalBuffs.hp || 0)) + (evo.bonusHp || 0));
  hpWithBuff = Math.round(hpWithBuff * (1 + (state.relicBuffs.hpPercent || 0)));
  const terrDef = territoryDefenseMultiplier(state, r, c);
  hpWithBuff = Math.round(hpWithBuff * terrDef);

  const startXp = state.relicBuffs.startXpBonus || 0;
  const terrAtkBonus = territoryAttackSpeedBonus(state, r, c) + territoryRowAttackSpeedBonus(state, r);
  const terrReflect = territoryReflectBonus(state, r, c);

  state.plants.set(key, {
    type, row: r, col: c,
    hp: hpWithBuff, maxHp: hpWithBuff,
    attackTimer: 0, sunTimer: 0, explodeTimer: 0.8,
    level: 1, xp: startXp,
    terrAtkBonus, terrReflect,
  });

  syncStats();
  updateShop(state);
  sfx(type === 'bomb' ? 'boom' : 'plant');
  render();
}

// ═══════════════════════════════════════════════
// 鏟子 — 移除植物退回部分陽光
// ═══════════════════════════════════════════════

function handleShovel(r, c) {
 if (state.gameOver) return;
 const key = cellKey(r, c);
 const plant = state.plants.get(key);
 if (!plant) return;
 const def = PLANTS[plant.type];
 const refund = Math.floor((def?.cost || 0) * 0.5);
 state.sun += refund;
 state.plants.delete(key);
 state.shovelMode = false;
 updateShovelBtn();
 sfx('shovel');
 showChaosAlert(`🪏 鏟除 ${def?.name || '植物'}，退回 ${refund} ☀️`);
 syncStats();
 updateShop(state);
 render();
}

function toggleShovel() {
 state.shovelMode = !state.shovelMode;
 if (state.shovelMode) {
 state.selectedPlant = null;
 state.conquestMode = false;
 [...document.querySelectorAll('.card')].forEach(c => c.classList.remove('selected'));
 }
 updateShovelBtn();
}

function updateShovelBtn() {
 const btn = document.getElementById('shovelBtn');
 if (btn) btn.classList.toggle('active', state.shovelMode);
}

// ═══════════════════════════════════════════════
// 陽光升級 — 點擊已種植物花陽光強化
// ═══════════════════════════════════════════════

function handleUpgrade(r, c) {
 if (state.gameOver) return;
 const key = cellKey(r, c);
 const plant = state.plants.get(key);
 if (!plant) return;

 const currentLevel = plant.level || 1;
 if (currentLevel >= 3) {
 showChaosAlert('⭐ 已達最高等級！');
 return;
 }

 const upgradeCost = Math.floor((PLANTS[plant.type]?.cost || 50) * currentLevel * 0.6);
 if (state.sun < upgradeCost) {
 flash(sunEl);
 showChaosAlert(`❌ 升級需要 ${upgradeCost} ☀️`);
 return;
 }

 state.sun -= upgradeCost;
 plant.level = currentLevel + 1;
 plant.maxHp = Math.round(plant.maxHp * 1.25);
 plant.hp = Math.min(plant.hp + Math.round(plant.maxHp * 0.2), plant.maxHp);
 applyEvolutionToPlant(plant);
 state.upgradeCount = (state.upgradeCount || 0) + 1;

 sfx('evolve');
 showChaosAlert(`⭐ ${PLANTS[plant.type]?.name} 升級到 Lv.${plant.level}！(-${upgradeCost} ☀️)`);
 syncStats();
 updateShop(state);
 render();
}

// ═══════════════════════════════════════════════
// 波次公告 toast
// ═══════════════════════════════════════════════

let waveToastTimer = 0;

function showWaveToast(wave) {
 let el = document.getElementById('waveToast');
 if (!el) {
 el = document.createElement('div');
 el.id = 'waveToast';
 el.className = 'wave-toast';
 const wrap = document.querySelector('.board-wrap');
 if (wrap) wrap.appendChild(el);
 }
 const isBig = wave % 5 === 0;
 el.textContent = isBig ? `🌊 第 ${wave} 波 — 大波來襲！` : `🌊 第 ${wave} 波`;
 el.classList.add('show');
 el.classList.toggle('big', isBig);
 waveToastTimer = 2.2;
}

// ═══════════════════════════════════════════════
// Cell 高亮 — 顯示可放/不可放
// ═══════════════════════════════════════════════

function updateCellHighlights() {
 if (!state.selectedPlant || state.shovelMode || state.conquestMode || state.gameOver) {
 boardEl.querySelectorAll('.cell').forEach(c => c.classList.remove('valid', 'invalid'));
 return;
 }
 const def = PLANTS[state.selectedPlant];
 if (!def) return;
 boardEl.querySelectorAll('.cell').forEach(c => {
 const col = parseInt(c.dataset.col);
 const r = parseInt(c.dataset.row);
 const key = cellKey(r, col);
 const hasPlant = state.plants.has(key);
 const canAfford = state.sun >= actualPlantCost(state, state.selectedPlant, def);
 const notOnCooldown = state.cooldowns[state.selectedPlant] <= 0;
 const playable = isCellPlayable(state, col);
 if (hasPlant || !playable) {
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
  }

  const first = state.swapFirst;
  state.plants.delete(first.key);
  state.plants.delete(key);
  const tr = first.plant.row, tc = first.plant.col;
  first.plant.row = plant.row; first.plant.col = plant.col;
  plant.row = tr; plant.col = tc;
  state.plants.set(cellKey(first.plant.row, first.plant.col), first.plant);
  state.plants.set(cellKey(plant.row, plant.col), plant);
  state.swapMode = false;
  state.swapFirst = null;
  sfx('plant');
  render();
  return true;
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
// 混亂警報 — 固定定位不跳動
// ═══════════════════════════════════════════════

let chaosAlertTimer = 0;

function showChaosAlert(msg) {
  if (!chaosAlertEl) return;
  chaosAlertEl.textContent = msg;
  chaosAlertEl.classList.add('show');
  chaosAlertTimer = 3;
}

function updateChaosAlert(dt) {
  if (chaosAlertTimer > 0) {
    chaosAlertTimer -= dt;
    if (chaosAlertTimer <= 0 && chaosAlertEl) {
      chaosAlertEl.classList.remove('show');
    }
  }
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
// 領土 UI — 只在 dirty 時更新
// ═══════════════════════════════════════════════

function updateTerritoryUI() {
 const playableCols = getPlayableCols(state);
 if (frontlineInfoEl) {
 frontlineInfoEl.textContent = `可放：${playableCols} 列 | 佔領：${state.territory.conquered.size} 格（第 ${state.wave} 波）`;
 }

  if (conquestBtnEl) {
    conquestBtnEl.textContent = state.conquestMode ? '⚔️ 佔領中...' : '🗡️ 佔領';
    conquestBtnEl.classList.toggle('active', state.conquestMode);
  }

  territoryDirty = true;
}

function applyTerritoryVisuals() {
  if (!territoryDirty) return;
  territoryDirty = false;

  const cells = boardEl.querySelectorAll('.cell');
  for (const cell of cells) {
    const r = parseInt(cell.dataset.row);
    const c = parseInt(cell.dataset.col);
    cell.classList.toggle('unplayable', !isCellPlayable(state, c));
    cell.classList.toggle('conquered', isConqueredCell(state, r, c));
    cell.classList.toggle('frontline', c === state.territory.frontline);

 // 地形標記
 const terrain = getCellTerrain(state, r, c);
 const oldTerrainEl = cell.querySelector('.terrain-marker');
 if (terrain && !isConqueredCell(state, r, c)) {
 // 未佔領的地形格 — 顯示地形預覽（不論是否已開放）
 if (!oldTerrainEl) {
 const marker = document.createElement('div');
 marker.className = 'terrain-marker';
 marker.textContent = terrain.emoji;
 marker.title = `${terrain.name}：${terrain.desc}`;
 cell.appendChild(marker);
 }
 } else if (terrain && isConqueredCell(state, r, c)) {
      // 已佔領的地形格
      if (oldTerrainEl) oldTerrainEl.remove();
      cell.style.background = terrain.color;
      cell.style.borderColor = terrain.borderColor;
    } else {
      if (oldTerrainEl) oldTerrainEl.remove();
    }
  }
}

// ═══════════════════════════════════════════════
// 遺物選擇 UI
// ═══════════════════════════════════════════════

function showRelicSelection() {
  state.relicPhase = true;
  state.relicChoices = generateRelicChoices();

  if (state.relicChoices.length === 0) {
    state.relicPhase = false;
    return;
  }

  const relicOv = relicOverlayEl;
  const relicCards = relicCardsEl;
  const relicTitle = relicTitleEl;
  if (!relicOv || !relicCards) return;

  relicTitle.textContent = `🏆 你撐到了第 ${state.wave} 波！選擇一個遺物：`;

  relicCards.innerHTML = state.relicChoices.map((relic, i) => {
    const color = getRarityColor(relic.rarity);
    const rarityLabel = { common: '普通', rare: '稀有', legendary: '傳說' }[relic.rarity] || '普通';
    return `
      <div class="relic-card" data-index="${i}" style="border-color: ${color};">
        <div class="relic-rarity" style="color: ${color};">${rarityLabel}</div>
        <div class="relic-emoji">${relic.emoji}</div>
        <div class="relic-name">${relic.name}</div>
        <div class="relic-desc">${relic.desc}</div>
      </div>`;
  }).join('');

  relicOv.classList.add('show');

  relicCards.querySelectorAll('.relic-card').forEach(el => {
    el.addEventListener('click', () => {
      chooseRelic(state.relicChoices[parseInt(el.dataset.index)].id);
      sfx('evolve');
      relicOv.classList.remove('show');
      state.relicPhase = false;
    });
  });
}

// ═══════════════════════════════════════════════
// 主更新迴圈
// ═══════════════════════════════════════════════

function update(dt) {
  if (state.gameOver || state.draftPhase) return;

  // 護盾
  if (state.shieldTimer > 0) state.shieldTimer -= dt;

  // 混沌馴服 — 極光效果
  if (state.chaosHarnessed && state.harnessEffect?.type === 'aurora') {
    state.sun += Math.round(state.harnessEffect.sunPerSec * dt);
  }

  updateModifiers(state, dt);
  updateSpawning(state, dt);
  updateSkyDrops(state, dt, cols);

  updatePlantsCombat(state, dt, sfx, addSun, (row, col) => state.plants.delete(cellKey(row, col)));
  updatePeasCombat(state, dt, sfx);
  if (!updateZombieCombat(state, dt, sfx, cellKey)) {
    if (checkPhoenixRevive(state)) {
      showChaosAlert('🪶 鳳凰羽毛！你從死亡中復活了！');
      sfx('spell');
      return;
    }
    gameEnd(false);
    return;
  }

  updateMowers(dt);

  const { killed } = cleanupState(state, dt);
  if (killed > 0) {
    state.kills += killed;
    state.totalKills += killed;
    state.sun += killed * killReward(12, state);
    syncStats();

    for (const [key, plant] of state.plants) {
      const oldLevel = plant.level || 1;
      const newLevel = getPlantLevel(plant.xp || 0);
      if (newLevel > oldLevel) {
        plant.level = Math.min(newLevel, 3); // Bug fix: 上限 3
        applyEvolutionToPlant(plant);
        sfx('evolve');
        showChaosAlert(`🌟 ${PLANTS[plant.type]?.name} 進化到 Lv.${plant.level}！`);
      }
    }
  }

  updateSpellCooldowns(state, dt);
  updateSpellEffects(state, dt);

  // 混亂事件
  if (state.wave >= 2) {
    const chaosEvent = checkChaosTrigger(state, dt);
    if (chaosEvent) {
      const harnessResult = tryHarnessChaos(state, chaosEvent);
      if (harnessResult) {
        sfx('spell');
        showChaosAlert(`🌀 ${harnessResult.name}：${harnessResult.desc}`);
      } else {
        sfx('chaos');
        showChaosAlert(`🌪️ ${chaosEvent.name}：${chaosEvent.desc}`);
      }
    }
  }

  // 警報倒數
  updateChaosAlert(dt);

  // Combo timer decay
  if (state.comboTimer > 0) {
    state.comboTimer -= dt;
    if (state.comboTimer <= 0) {
      state.comboCount = 0;
      state.comboTimer = 0;
    }
  }

 // UI — 輕量更新
 updateShop(state);
 refreshSpellCooldowns();
 updateBossHpBar();
 updateComboDisplay();
 updateCellHighlights();

 const dangerLevel = state.zombies.length >= 8 ? 'danger' : state.zombies.length >= 4 ? 'alert' : 'normal';
 updateBattleStatus(state, { battleStatusEl, statusTitleEl, statusTextEl, modifierTagEl }, dangerLevel);

 // Wave toast
 if (waveToastTimer > 0) {
 waveToastTimer -= dt;
 if (waveToastTimer <= 0) {
 const toast = document.getElementById('waveToast');
 if (toast) toast.classList.remove('show', 'big');
 }
 }

 checkWaveComplete();
}

function render() {
  renderEntities(boardEl, state);
  applyTerritoryVisuals();
}

// ═══════════════════════════════════════════════
// 遊戲結束
// ═══════════════════════════════════════════════

function gameEnd(win) {
  state.gameOver = true;
  overlayEl.classList.add('show');
  recordRun(state);
  const ownedRelics = loadRelics();

 const statsEl = document.getElementById('endStats');
 const statsHTML = `
 <div><div class="stat-label">擊殺</div><div class="stat-val">${state.totalKills}</div></div>
 <div><div class="stat-label">波次</div><div class="stat-val">${state.wave}</div></div>
 <div><div class="stat-label">升級次數</div><div class="stat-val">${state.upgradeCount || 0}</div></div>
 <div><div class="stat-label">最高連殺</div><div class="stat-val">${state.comboCount || 0}x</div></div>
 <div><div class="stat-label">領土</div><div class="stat-val">${state.territory?.conquered?.size || 0} 格</div></div>
 <div><div class="stat-label">遺物</div><div class="stat-val">${ownedRelics.length} 個</div></div>
 `;

 if (win) {
 endTitleEl.textContent = '🎉 你贏了！';
 endTextEl.textContent = '';
 if (statsEl) statsEl.innerHTML = statsHTML;
 sfx('win');
 } else {
 endTitleEl.textContent = '💀 殭屍突破了防線';
 endTextEl.textContent = '🏆 選擇一個遺物帶入下一局！';
 if (statsEl) statsEl.innerHTML = statsHTML;
 sfx('lose');
 setTimeout(() => showRelicSelection(), 800);
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
 if (runInfoEl) runInfoEl.textContent = `第 ${state.wave} 波 | 🏛️ ${loadRelics().length} 遺物`;
 updateXpBar();
 updateComboDisplay();
 // Speed display
 let speedEl = document.getElementById('speedDisplay');
 if (!speedEl) {
 speedEl = document.createElement('span');
 speedEl.id = 'speedDisplay';
 speedEl.className = 'pill speed-pill';
 const statsEl = document.querySelector('.stats');
 if (statsEl) statsEl.appendChild(speedEl);
 }
 speedEl.textContent = (state.gameSpeed || 1) > 1 ? `⏩ ${state.gameSpeed}x` : '';
}

// ═══════════════════════════════════════════════
// XP Progress Bar — 顯示場上植物 XP 進度
// ═══════════════════════════════════════════════

function updateXpBar() {
  if (!xpBarEl) return;
  const plants = [...state.plants.values()];
  if (plants.length === 0) {
    xpBarEl.innerHTML = '<span style="color:var(--muted);font-size:11px;">尚無植物</span>';
    return;
  }
  xpBarEl.innerHTML = plants.map(p => {
    const level = getPlantLevel(p.xp || 0);
    const nextXp = XP_LEVELS[level] ?? XP_LEVELS[XP_LEVELS.length - 1];
    const prevXp = XP_LEVELS[level - 1] ?? 0;
    const progress = level >= 3 ? 1 : (nextXp > prevXp ? (p.xp - prevXp) / (nextXp - prevXp) : 0);
    const pct = Math.min(100, Math.max(0, progress * 100));
    const def = PLANTS[p.type];
    return `<div class="xp-item">
      <span class="xp-emoji">${def?.emoji || '?'}</span>
      <span class="xp-info">
        <span class="xp-name">${def?.name || p.type} <small>Lv.${Math.min(level, 3)}</small></span>
        <span class="xp-progress"><span class="xp-fill" style="width:${pct}%"></span></span>
      </span>
    </div>`;
  }).join('');
}

// ═══════════════════════════════════════════════
// Combo Display — 顯示連擊計數
// ═══════════════════════════════════════════════

function updateComboDisplay() {
  let comboEl = document.getElementById('comboDisplay');
  const count = state.comboCount || 0;
  if (count < 2) {
    if (comboEl) comboEl.remove();
    return;
  }
  if (!comboEl) {
    comboEl = document.createElement('span');
    comboEl.id = 'comboDisplay';
    comboEl.className = 'pill combo-pill';
    // Insert into stats area
    const statsEl = document.querySelector('.stats');
    if (statsEl) statsEl.appendChild(comboEl);
  }
  const bonus = Math.min(count / 5 * 10, 100);
  comboEl.textContent = `🔥 x${count} +${Math.round(bonus)}%`;
}

// ═══════════════════════════════════════════════
// 主迴圈
// ═══════════════════════════════════════════════

function frame(ts) {
  if (!lastTime) lastTime = ts;
  const dt = Math.min((ts - lastTime) / 1000, 0.033);
  lastTime = ts;
 if (!isPaused && !state.draftPhase && !state.relicPhase) {
 update(dt * (state.gameSpeed || 1));
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
    const sunTarget = e.target.closest('.sun');
    if (sunTarget) {
      e.preventDefault();
      e.stopPropagation();
      ensureAudio();
      if (collectSun(state, Number(sunTarget.dataset.sunId))) {
        syncStats();
        updateShop(state);
        sfx('sun');
        render();
      }
      return;
    }

    const cell = e.target.closest('.cell');
    if (cell && state.swapMode) {
      handleSwapMode(parseInt(cell.dataset.row), parseInt(cell.dataset.col));
    }
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

 // Right-click on cell to upgrade
 boardEl.querySelectorAll('.cell').forEach(cell => {
 cell.addEventListener('contextmenu', e => {
 e.preventDefault();
 const r = Number(cell.dataset.row);
 const c = Number(cell.dataset.col);
 handleUpgrade(r, c);
 });
 });

 if (conquestBtnEl) {
 conquestBtnEl.addEventListener('click', () => {
 state.conquestMode = !state.conquestMode;
 if (state.conquestMode) {
 state.selectedPlant = null;
 state.shovelMode = false;
 updateShovelBtn();
 [...document.querySelectorAll('.card')].forEach(c => c.classList.remove('selected'));
 }
 updateTerritoryUI();
 });
 }
}
