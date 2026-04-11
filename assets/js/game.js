// ═══════════════════════════════════════════════
// PVZ Lite: Chaos Garden — 主遊戲協調器
// ═══════════════════════════════════════════════
// Chaos Awakening: 遺物 + 混沌馴服 + 領土推進
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
import { cellKey, flash, randomPick } from './core/helpers.js';
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

// ── Chaos Awakening 系統 ──
import {
  loadRelics, generateRelicChoices, chooseRelic,
  applyRelicBuffs, checkPhoenixRevive, recordRun,
  RELICS, getRarityColor,
} from './systems/relics.js';
import { tryHarnessChaos } from './systems/harness.js';
import {
  initTerritory, tryConquest, territoryWaveReward,
  isCellPlayable, isConqueredCell, territoryDefenseMultiplier,
  autoConquestCheck, conquestCost, conquestReward,
  TERRITORY,
} from './systems/territory.js';

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

  // ── Chaos Awakening: 應用遺物效果 ──
  applyRelicBuffs(state);

  // 遺物加成：起始陽光
  state.sun += (state.relicBuffs.startSunBonus || 0);

  // ── Chaos Awakening: 初始化領土 ──
  initTerritory(state);

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

  // 隱藏遺物選擇 overlay
  const relicOv = document.getElementById('relicOverlay');
  if (relicOv) relicOv.classList.remove('show');

  updateShop(state);
  updateBattleStatus(state, { battleStatusEl, statusTitleEl, statusTextEl, modifierTagEl }, 'normal');
  updateTerritoryUI();
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

  // ── Chaos Awakening: 波次開始陽光獎勵（血之契約） ──
  if (state.relicBuffs.waveSunBonus) {
    state.sun += state.relicBuffs.waveSunBonus;
  }

  // ── Chaos Awakening: 世界樹種子 — 自動進化 ──
  if (state.relicBuffs.autoEvolveInterval && state.wave > 1) {
    if (state.wave % state.relicBuffs.autoEvolveInterval === 0) {
      for (const [key, plant] of state.plants) {
        if ((plant.level || 1) < 3) {
          plant.level = (plant.level || 1) + 1;
          applyEvolutionToPlant(plant);
          showChaosAlert(`🌳 世界樹之力：${PLANTS[plant.type]?.name} 自動進化到 Lv.${plant.level}！`);
        }
      }
    }
  }

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

    // ── Chaos Awakening: 領土獎勵 ──
    const terrReward = territoryWaveReward(state);
    if (terrReward > 0) {
      showChaosAlert(`🗡️ 領土收益 +${terrReward} ☀️`);
    }

    // ── Chaos Awakening: 自動佔領 ──
    const autoResult = autoConquestCheck(state);
    if (autoResult) {
      const msg = autoResult.advanced
        ? `🏰 自動佔領 (${autoResult.row},${autoResult.col})，前線推進！`
        : `🏰 自動佔領 (${autoResult.row},${autoResult.col})`;
      showChaosAlert(msg);
      updateTerritoryUI();
    }

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
  state.conquestMode = false; // 離開佔領模式
  [...document.querySelectorAll('.card')].forEach(c => c.classList.toggle('selected', c.dataset.plant === name));
  updateTerritoryUI();
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
  makeBoard(boardEl, rows, cols, (r, c) => { ensureAudio(); handleCellClick(r, c); });
}

function handleCellClick(r, c) {
  if (state.gameOver || state.draftPhase) return;

  // ── 佔領模式 ──
  if (state.conquestMode) {
    const result = tryConquest(state, r, c);
    if (result.ok) {
      sfx('plant');
      showChaosAlert(result.msg);
      if (result.advanced) {
        createBoard(); // 重建棋盤以反映新前線
      }
      updateTerritoryUI();
      syncStats();
      render();
    } else {
      flash(sunEl);
      showChaosAlert(`❌ ${result.msg}`);
    }
    return;
  }

  placePlant(r, c);
}

function placePlant(r, c) {
  if (state.gameOver || state.draftPhase) return;

  // ── Chaos Awakening: 檢查領土限制 ──
  if (!isCellPlayable(state, c)) {
    showChaosAlert('🚫 此格尚未佔領！切換到佔領模式以推進前線。');
    flash(boardEl);
    return;
  }

  const key = cellKey(r, c);
  const type = state.selectedPlant;
  const def = PLANTS[type];
  if (!def) return;
  const actualCost = actualPlantCost(state, type, def);
  if (state.plants.has(key)) return;
  if (state.cooldowns[type] > 0) return flash(shopEl);
  if (state.sun < actualCost) return flash(sunEl);

  state.sun -= actualCost;
  // ── Chaos Awakening: 遺物冷卻縮短 ──
  const cdReduction = state.relicBuffs?.cooldownReduction || 0;
  state.cooldowns[type] = def.cooldown * (1 - cdReduction);

  // 計算進化後的屬性
  const level = 1;
  const evo = getEvolutionBonus(type, level);
  let hpWithBuff = Math.round(def.hp * (1 + (state.globalBuffs.hp || 0)) + (evo.bonusHp || 0));

  // ── Chaos Awakening: 遺物 HP 加成 ──
  hpWithBuff = Math.round(hpWithBuff * (1 + (state.relicBuffs.hpPercent || 0)));

  // ── Chaos Awakening: 領土防禦加成 ──
  const terrDef = territoryDefenseMultiplier(state, r, c);
  hpWithBuff = Math.round(hpWithBuff * terrDef);

  // ── Chaos Awakening: 遺物起始 XP ──
  const startXp = state.relicBuffs.startXpBonus || 0;

  state.plants.set(key, {
    type, row: r, col: c,
    hp: hpWithBuff, maxHp: hpWithBuff,
    attackTimer: 0, sunTimer: 0, explodeTimer: 0.8,
    level: startXp >= 50 ? 2 : 1, // 如果遺物給的 XP 夠升級
    xp: startXp,
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
// 領土 UI
// ═══════════════════════════════════════════════

function updateTerritoryUI() {
  const frontlineEl = document.getElementById('frontlineInfo');
  if (frontlineEl) {
    frontlineEl.textContent = `前線：第 ${state.territory.frontline} 列 | 佔領：${state.territory.conquered.size} 格`;
  }

  const conquestBtn = document.getElementById('conquestBtn');
  if (conquestBtn) {
    conquestBtn.textContent = state.conquestMode ? '⚔️ 佔領中...' : '🗡️ 佔領';
    conquestBtn.classList.toggle('active', state.conquestMode);
  }

  // 更新棋盤上的領土視覺
  updateBoardTerritoryVisuals();
}

function updateBoardTerritoryVisuals() {
  const cells = boardEl.querySelectorAll('.cell');
  cells.forEach(cell => {
    const r = parseInt(cell.dataset.row);
    const c = parseInt(cell.dataset.col);

    // 清除舊的領土 class
    cell.classList.remove('conquered', 'unplayable', 'frontline');

    if (!isCellPlayable(state, c)) {
      cell.classList.add('unplayable');
    }

    if (isConqueredCell(state, r, c)) {
      cell.classList.add('conquered');
    }

    if (c === state.territory.frontline) {
      cell.classList.add('frontline');
    }
  });
}

// ═══════════════════════════════════════════════
// 遺物選擇 UI
// ═══════════════════════════════════════════════

function showRelicSelection() {
  state.relicPhase = true;
  state.relicChoices = generateRelicChoices();

  if (state.relicChoices.length === 0) {
    // 沒有可選遺物，直接開始
    state.relicPhase = false;
    return;
  }

  const relicOv = document.getElementById('relicOverlay');
  const relicCardsEl = document.getElementById('relicCards');
  const relicTitleEl = document.getElementById('relicTitle');

  if (!relicOv || !relicCardsEl) return;

  relicTitleEl.textContent = `🏆 你撐到了第 ${state.wave} 波！選擇一個遺物帶入下一局：`;

  relicCardsEl.innerHTML = state.relicChoices.map((relic, i) => {
    const color = getRarityColor(relic.rarity);
    const rarityLabel = { common: '普通', rare: '稀有', legendary: '傳說' }[relic.rarity] || '普通';
    return `
      <div class="relic-card" data-index="${i}" style="border-color: ${color};">
        <div class="relic-rarity" style="color: ${color};">${rarityLabel}</div>
        <div class="relic-emoji">${relic.emoji}</div>
        <div class="relic-name">${relic.name}</div>
        <div class="relic-desc">${relic.desc}</div>
      </div>
    `;
  }).join('');

  relicOv.classList.add('show');

  relicCardsEl.querySelectorAll('.relic-card').forEach(el => {
    el.addEventListener('click', () => {
      const idx = parseInt(el.dataset.index);
      selectRelic(idx);
    });
  });
}

function selectRelic(idx) {
  const relic = state.relicChoices[idx];
  if (!relic) return;

  chooseRelic(relic.id);
  sfx('evolve');

  const relicOv = document.getElementById('relicOverlay');
  if (relicOv) relicOv.classList.remove('show');
  state.relicPhase = false;
}

// ═══════════════════════════════════════════════
// 主更新迴圈
// ═══════════════════════════════════════════════

function update(dt) {
  if (state.gameOver || state.draftPhase) return;

  // ── Chaos Awakening: 護盾計時器 ──
  if (state.shieldTimer > 0) {
    state.shieldTimer -= dt;
  }

  // ── Chaos Awakening: 混沌馴服效果 ──
  if (state.chaosHarnessed && state.harnessEffect) {
    // 極光效果：每秒 +8 陽光
    if (state.harnessEffect.type === 'aurora') {
      state.sun += Math.round(state.harnessEffect.sunPerSec * dt);
    }
    // 陽光海嘯：sunshower 產量翻倍（在 economy 中檢查 harnessEffect）
  }

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
    // ── Chaos Awakening: 鳳凰復活 ──
    if (checkPhoenixRevive(state)) {
      showChaosAlert('🪶 鳳凰羽毛！你從死亡中復活了！');
      sfx('spell');
      render();
      return;
    }
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
      // ── Chaos Awakening: 嘗試馴服 ──
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
  // 持續更新領土視覺
  updateBoardTerritoryVisuals();
}

// ═══════════════════════════════════════════════
// 遊戲結束
// ═══════════════════════════════════════════════

function gameEnd(win) {
  state.gameOver = true;
  overlayEl.classList.add('show');

  // ── Chaos Awakening: 記錄跑局 ──
  recordRun(state);

  const ownedRelics = loadRelics();

  if (win) {
    endTitleEl.textContent = '🎉 你贏了！';
    endTextEl.textContent = `通關到第 ${state.wave} 波，擊殺 ${state.totalKills} 隻，牌組 ${state.deck.length} 張！\n領土：${state.territory.conquered.size} 格已佔領\n遺物：${ownedRelics.length} 個`;
    sfx('win');
  } else {
    endTitleEl.textContent = '💀 殭屍突破了防線';
    endTextEl.textContent = `你撐到第 ${state.wave} 波，擊殺 ${state.totalKills} 隻。\n牌組：${state.deck.map(k => PLANTS[k]?.emoji || k).join(' ')}\n領土：${state.territory.conquered.size} 格已佔領\n遺物：${ownedRelics.length} 個\n\n🏆 選擇一個遺物帶入下一局！`;
    sfx('lose');

    // 顯示遺物選擇
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
  if (runInfoEl) runInfoEl.textContent = `跑局：第 ${state.wave} 波 | 🏛️ ${loadRelics().length} 遺物`;
}

// ═══════════════════════════════════════════════
// 主迴圈
// ═══════════════════════════════════════════════

function frame(ts) {
  if (!lastTime) lastTime = ts;
  const dt = Math.min((ts - lastTime) / 1000, 0.033);
  lastTime = ts;
  if (!isPaused && !state.draftPhase && !state.relicPhase) {
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

  // ── 佔領按鈕 ──
  const conquestBtn = document.getElementById('conquestBtn');
  if (conquestBtn) {
    conquestBtn.addEventListener('click', () => {
      state.conquestMode = !state.conquestMode;
      if (state.conquestMode) {
        state.selectedPlant = null;
        [...document.querySelectorAll('.card')].forEach(c => c.classList.remove('selected'));
      }
      updateTerritoryUI();
    });
  }
}
