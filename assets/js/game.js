// ═══════════════════════════════════════════════
// PVZ Lite: Chaos Awakening — 主遊戲協調器
// ═══════════════════════════════════════════════

import { rows, cols, PLANTS, ZOMBIES, SPELLS, XP_LEVELS, DIFFICULTY, BOSS_WAVES } from './config.js';
import {
 boardEl, shopEl, mobileShopEl, sunEl, killsEl, waveEl, mowerEl,
 pauseBtn, overlayEl, endTitleEl, endTextEl, battleStatusEl, statusTitleEl, statusTextEl, modifierTagEl,
 draftOverlayEl, draftCardsEl, draftWaveEl, spellBarEl, chaosAlertEl,
 deckCountEl, bossHpBarEl, bossHpTextEl, runInfoEl,
 relicOverlayEl, relicCardsEl, relicTitleEl, frontlineInfoEl, conquestBtnEl,
 battleLogEl,
} from './dom.js';
import { cellKey, flash } from './core/helpers.js';
import { makeBoard } from './render/board.js';
import { createRunState, initCooldowns, getPlantLevel, addPlantXP } from './core/state.js';
import { applyRelicBuffs, loadRelics, RELICS } from './systems/relics.js';
import { startWaveSpawns, updateSpawning } from './systems/spawn.js';
import { updatePlantsCombat, updatePeasCombat, updateZombieCombat } from './systems/combat.js';
import { cleanupState } from './systems/cleanup.js';
import { addSun, collectSun, updateSkyDrops } from './systems/economy.js';
import { checkChaosTrigger, isChaosActive } from './systems/chaos.js';
import { generateDraftCards, applyDraftCard } from './systems/draft.js';
import { renderEntities } from './render/entities.js';
import {
 initTerritory, tryConquest, territoryWaveReward, autoConquestCheck,
 getPlayableCols, isCellPlayable, getCellTerrain, TERRAIN_TYPES,
 conquestCost, TERRITORY, updateConquestProgress,
} from './systems/territory.js';
import { actualPlantCost } from './systems/shop.js';
import { sfx, audioState } from './audio.js';
import { applyEvolutionToPlant, getEvolutionBonus } from './systems/evolution.js';
import { bindPauseControl, bindKeyboardShortcuts } from './ui/controls.js';

let state, loopId, lastTime = 0, isPaused = false, territoryDirty = true;

// ═══════════════════════════════════════════════
// 啟動
// ═══════════════════════════════════════════════

export function startGame() {
 cancelAnimationFrame(loopId);
 state = createRunState();
 state.difficulty = state.difficulty || 'normal';
 initCooldowns(state);

 applyRelicBuffs(state);
 const relicSunBonus = state.relicBuffs.startSunBonus || 0;
 const diff = DIFFICULTY[state.difficulty] || DIFFICULTY.normal;
 state.sun = diff.startSun + relicSunBonus;
 state.sunMultiplier = diff.sunMultiplier;

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
 for (const p of state.plants.values()) {
 p.xp = (p.xp || 0) + 15;
 applyEvolutionToPlant(p);
 }
 }

 const isBoss = !!(state.wave % 5 === 0);
 if (isBoss) {
 const bossKey = Object.keys(PLANTS).find(k => k.startsWith('boss'));
 showWaveToast(`⚠️ BOSS 來襲！`, true);
 const bossConfig = BOSS_WAVES[Math.min(state.wave, 20)] || BOSS_WAVES[20];
 battleLog(`👾 BOSS：${bossConfig?.name || '殭屍首領'} 來襲！`, 'boss');
 sfx('boss');
 } else {
 showWaveToast(`第 ${state.wave} 波`, false);
 battleLog(`🌊 第 ${state.wave} 波開始`);
 }

 territoryDirty = true;
}

function checkWaveComplete() {
 if (!state.waveActive) return false;
 if (state.spawnQueue.length === 0 && state.zombies.length === 0) {
 state.waveActive = false;
 state.bossActive = false;

 battleLog(`✅ 第 ${state.wave} 波完成！`, 'success');

 const terrReward = territoryWaveReward(state);
 if (terrReward > 0) {
 showChaosAlert(`🗡️ 領土收益 +${terrReward} ☀️`);
 battleLog(`☀️ 領土收益 +${terrReward}`);
 }

 const autoResult = autoConquestCheck(state);
 if (autoResult) {
 const msg = autoResult.advanced
 ? `🏰 自動佔領，前線推進！`
 : `🏰 自動佔領一格`;
 showChaosAlert(msg);
 battleLog(msg, 'success');
 territoryDirty = true;
 }

 // Boss 狂暴日誌
 if (state.bossRageTriggered) {
 battleLog(`🤬 Boss 狂暴化！速度+30%、攻擊+50%`, 'danger');
 state.bossRageTriggered = false;
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
 el.addEventListener('click', () => {
 applyDraftCard(state, Number(el.dataset.index));
 draftOverlayEl.classList.remove('show');
 state.draftPhase = false;
 state.wave++;
 isPaused = false;
 startNextWave();
 buildShop();
 syncStats();
 render();
 });
 });

 // 重抽按鈕
 let rerollBtn = draftOverlayEl.querySelector('.draft-reroll-btn');
 if (state.draftRerolls > 0) {
 if (!rerollBtn) {
 rerollBtn = document.createElement('button');
 rerollBtn.className = 'draft-reroll-btn';
 draftOverlayEl.querySelector('.draft-dialog').appendChild(rerollBtn);
 }
 rerollBtn.textContent = `🔄 重抽 (${state.draftRerolls})`;
 rerollBtn.onclick = () => {
 if (state.draftRerolls <= 0) return;
 state.draftRerolls--;
 state.draftCards = generateDraftCards(state);
 sfx('draft');
 renderDraftOverlay();
 };
 } else if (rerollBtn) {
 rerollBtn.remove();
 }
}

// ═══════════════════════════════════════════════
// 遺物選擇
// ═══════════════════════════════════════════════

function showRelicSelection() {
 const owned = loadRelics();
 const available = Object.entries(RELICS).filter(([id]) => !owned.includes(id));
 if (available.length === 0) return;

 const choices = [];
 const pool = [...available];
 for (let i = 0; i < Math.min(3, pool.length); i++) {
 const idx = Math.floor(Math.random() * pool.length);
 choices.push(pool[idx]);
 pool.splice(idx, 1);
 }

 relicOverlayEl.classList.add('show');
 relicTitleEl.textContent = '🏆 選擇遺物';
 relicCardsEl.innerHTML = choices.map(([id, r]) => `
 <div class="relic-card" data-id="${id}">
 <div class="relic-emoji">${r.emoji}</div>
 <div class="relic-name">${r.name}</div>
 <div class="relic-desc">${r.desc}</div>
 </div>`).join('');

 relicCardsEl.querySelectorAll('.relic-card').forEach(el => {
 el.addEventListener('click', () => {
 const id = el.dataset.id;
 owned.push(id);
 localStorage.setItem('pvz_relics', JSON.stringify(owned));
 relicOverlayEl.classList.remove('show');
 });
 });
}

// ═══════════════════════════════════════════════
// 主迴圈
// ═══════════════════════════════════════════════

function frame(now) {
	loopId = requestAnimationFrame(frame);
	if (!lastTime) { lastTime = now; return; }
	const raw = (now - lastTime) / 1000;
	lastTime = now;
	const dt = Math.min(raw, 0.1);

	try {
		if (!isPaused && !state.draftPhase && !state.relicPhase) {
			const gameDt = dt * (state.gameSpeed || 1);
			update(gameDt);
		}
		render();
	} catch (err) {
		console.error('Frame error:', err);
		// 避免循環刷 log，只記錄前 3 次
		if (!window._frameErrCount) window._frameErrCount = 0;
		window._frameErrCount++;
		if (window._frameErrCount <= 3) {
			const d = document.getElementById('battleLog');
			if (d) d.innerHTML = `<div style="color:#ef4444;padding:4px;font-size:11px;">⚠️ ${err.message}</div>` + d.innerHTML;
		}
	}
}

function update(dt) {
 // ── 天空陽光 + 自動收集 ──
 updateSkyDrops(state, dt, cols);
 updateSunDrops(state, dt);

 // 自動收集過期陽光（後期 QoL）
 autoCollectOldSuns(state, dt);

 updateSpawning(state, dt);
 updatePlantsCombat(state, dt, sfx, addSun, (key) => state.plants.delete(key));
 updatePeasCombat(state, dt, sfx);
 updateZombieCombat(state, dt, sfx, cellKey);
 cleanupState(state, dt);
 checkChaosTrigger(state, dt);

 // ── 殭屍佔領地盤 ──
 zombieTerritoryPush(state, dt);

 // ── 佔領進度更新 ──
 const conquestResult = updateConquestProgress(state, dt);
 if (conquestResult?.completed) {
 sfx('plant');
 showChaosAlert(conquestResult.msg);
 territoryDirty = true;
 if (conquestResult.advanced) {
 battleLog(`🗡️ 前線推進！${conquestResult.msg}`, 'success');
 createBoard();
 } else {
 battleLog(conquestResult.msg, 'success');
 }
 }

 checkWaveComplete();
 syncStats();
 updateShop(state);
 updateBattleStatus(state, { battleStatusEl, statusTitleEl, statusTextEl, modifierTagEl }, state.modifier || 'normal');

 if (state.waveActive && !state.gameOver) {
 checkGameEnd();
 }

 if (territoryDirty) {
 updateTerritoryUI();
 territoryDirty = false;
 }
}

// ── 陽光掉落物理 ──
function updateSunDrops(state, dt) {
 for (let i = state.suns.length - 1; i >= 0; i--) {
 const s = state.suns[i];
 s.life -= dt;
 if (s.life <= 0) {
 state.suns.splice(i, 1);
 continue;
 }
 if (s.y < s.targetY) {
 s.y += s.fall * 90 * dt;
 }
 }
}

// ── 自動收集：生命 < 3 秒的陽光自動飛向陽光計 ──
function autoCollectOldSuns(state, dt) {
 const autoTimer = state.autoSunTimer || 0;
 state.autoSunTimer = autoTimer + dt;
 // 每 0.5 秒檢查一次
 if (state.autoSunTimer < 0.5) return;
 state.autoSunTimer = 0;

 for (let i = state.suns.length - 1; i >= 0; i--) {
 if (state.suns[i].life < 3) {
 state.sun += state.suns[i].value;
 state.suns.splice(i, 1);
 }
 }
}

// ── 殭屍推進佔領地盤 ──
function zombieTerritoryPush(state, dt) {
 if (!state.territory) return;
 for (const z of state.zombies) {
 const col = Math.floor(z.x);
 if (col >= 0 && col < cols) {
 const key = cellKey(z.row, col);
 if (state.territory.conquered.has(key)) {
 // 殭屍在已佔領格上，逐漸奪回
 if (!z.uncaptureTimer) z.uncaptureTimer = 0;
 z.uncaptureTimer += dt;
 if (z.uncaptureTimer >= 4) {
 z.uncaptureTimer = 0;
 state.territory.conquered.delete(key);
 territoryDirty = true;
 }
 }
 }
 }
}

function checkGameEnd() {
 for (const z of state.zombies) {
 if (z.x <= 0) {
 // 除草機
 const mower = state.lawnmowers.find(m => m.row === z.row && !m.used);
 if (mower) {
 mower.used = true;
 state.zombies = state.zombies.filter(zz => zz.row !== z.row || zz.x > 0.5);
 sfx('mower');
 syncStats();
 return;
 }
 // 遊戲結束
 gameEnd(false);
 return;
 }
 }
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
 const cd = Math.max(1, def.cooldown - cdReduction);
 state.cooldowns[type] = cd;

 const plant = {
 type, row: r, col: c,
 hp: def.hp, maxHp: def.hp,
 xp: 0, level: 1,
 attackTimer: 0, produceTimer: 0, healTimer: 0,
 };
 // 地形加成
 const terrain = getCellTerrain(state, r, c);
 if (terrain?.defenseBonus) {
 plant.maxHp = Math.round(plant.maxHp * (1 + terrain.defenseBonus));
 plant.hp = plant.maxHp;
 }
 if (terrain?.id === 'watchtower') {
 plant.attackSpeedBonus = terrain.attackSpeedBonus;
 }

 state.plants.set(key, plant);
 applyEvolutionToPlant(plant);
 sfx('plant');
 battleLog(`${def.emoji} ${def.name} 種植在 (${r},${c})`);

 // 自動取消選取（避免誤放多個）
 // state.selectedPlant = null;

 syncStats();
 updateShop(state);
 render();
}

// ═══════════════════════════════════════════════
// 鏟子
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
 boardEl.classList.remove('shovel-cursor');
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
 boardEl.classList.add('shovel-cursor');
 } else {
 boardEl.classList.remove('shovel-cursor');
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

	const upgradeCost = Math.floor((PLANTS[plant.type]?.cost || 50) * (currentLevel === 1 ? 0.6 : 1.0) * currentLevel);
 if (state.sun < upgradeCost) {
 flash(sunEl);
 showChaosAlert(`❌ 升級需要 ${upgradeCost} ☀️`);
 return;
 }

	state.sun -= upgradeCost;
	plant.level = currentLevel + 1;
	plant.maxHp = Math.round(plant.maxHp * 1.25);
	plant.hp = Math.min(plant.hp + Math.round(plant.maxHp * 0.2), plant.maxHp);
	plant.justEvolved = 1.5; // 1.5 秒閃光特效
	applyEvolutionToPlant(plant);
 state.upgradeCount = (state.upgradeCount || 0) + 1;

 sfx('evolve');
 const evo = getEvolutionBonus(plant.type, plant.level);
 const evoDesc = evo?.desc ? ` — ${evo.desc}` : '';
 showChaosAlert(`⭐ ${PLANTS[plant.type]?.name} → Lv.${plant.level}${evoDesc} (-${upgradeCost} ☀️)`);
 battleLog(`⭐ ${PLANTS[plant.type]?.emoji} ${PLANTS[plant.type]?.name} 升級到 Lv.${plant.level}`, 'success');
 syncStats();
 updateShop(state);
 render();
}

// ═══════════════════════════════════════════════
// 商店 & 牌組
// ═══════════════════════════════════════════════

function buildShop() {
 const html = state.deck.map(k => {
 const p = PLANTS[k];
 if (!p) return '';
 const upgradeHint = p.upgradeDesc ? `<div class="upgrade-hint">↑ ${p.upgradeDesc}</div>` : '';
 return `<div class="card" data-plant="${k}">
 <div class="row"><strong>${p.emoji} ${p.name}</strong><span class="cost">${p.cost} ☀️</span></div>
 <div class="muted">${p.desc}</div>
 ${upgradeHint}
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
 boardEl.classList.remove('shovel-cursor');
 updateShovelBtn();
 [...document.querySelectorAll('.card')].forEach(c => c.classList.toggle('selected', c.dataset.plant === name));
}

// ═══════════════════════════════════════════════
// 法術 UI — 事件委託，不在 update 中重建
// ═══════════════════════════════════════════════

let lastSpellCount = 0;

function buildSpellBar() {
 if (!spellBarEl) return;
 const spells = state.spells || [];
 spellBarEl.innerHTML = spells.map((s, i) => {
 const def = SPELLS[s];
 if (!def) return '';
 return `<div class="spell-slot" data-spell="${s}" data-index="${i}">
 <div class="spell-emoji">${def.emoji}</div>
 <div class="spell-name">${def.name}</div>
 <div class="spell-cd"></div>
 <div class="spell-cooldown-overlay"></div>
 </div>`;
 }).join('');

 spellBarEl.querySelectorAll('.spell-slot').forEach(el => {
 el.addEventListener('click', () => {
 const spellName = el.dataset.spell;
 if (state.gameOver || state.draftPhase) return;
 const cd = state.spellCooldowns?.[spellName] || 0;
 if (cd > 0) return;
 castSpell(spellName);
 });
 });

 lastSpellCount = spells.length;
}

function updateSpellBar() {
 if (!spellBarEl) return;
 const spells = state.spells || [];
 if (spells.length !== lastSpellCount) {
 buildSpellBar();
 return;
 }
 spellBarEl.querySelectorAll('.spell-slot').forEach(el => {
 const spellName = el.dataset.spell;
 const cd = state.spellCooldowns?.[spellName] || 0;
 const def = SPELLS[spellName];
 const maxCd = def?.cooldown || 5;
 el.classList.toggle('ready', cd <= 0);
 const overlay = el.querySelector('.spell-cooldown-overlay');
 if (overlay) {
 overlay.style.transform = cd > 0 ? `scaleY(${cd / maxCd})` : 'scaleY(0)';
 }
 const cdText = el.querySelector('.spell-cd');
 if (cdText) cdText.textContent = cd > 0 ? `${Math.ceil(cd)}s` : '';
 });
}

function castSpell(name) {
 const def = SPELLS[name];
 if (!def) return;
 state.spellCooldowns[name] = def.cooldown;
 def.apply(state);
 sfx('spell');
 showChaosAlert(`✨ ${def.name}！`);
 render();
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

 // Swap
 const first = state.swapFirst;
 const tempRow = first.plant.row;
 const tempCol = first.plant.col;
 first.plant.row = plant.row;
 first.plant.col = plant.col;
 plant.row = tempRow;
 plant.col = tempCol;

 state.plants.delete(first.key);
 state.plants.delete(key);
 state.plants.set(cellKey(first.plant.row, first.plant.col), first.plant);
 state.plants.set(cellKey(plant.row, plant.col), plant);

 state.swapMode = false;
 state.swapFirst = null;
 sfx('spell');
 showChaosAlert('🔄 植物交換完成！');
 render();
 return true;
}

// ═══════════════════════════════════════════════
// 戰鬥狀態 & 混亂警報
// ═══════════════════════════════════════════════

function updateBattleStatus(state, dom, modifier) {
 const { battleStatusEl, statusTitleEl, statusTextEl, modifierTagEl } = dom;
 if (!battleStatusEl) return;
 const isBoss = !!(state.wave % 5 === 0);
 const nextWave = state.wave + 1;
 const nextIsBoss = nextWave % 5 === 0;
 if (isBoss) {
 statusTitleEl.textContent = `👁️ 第 ${state.wave} 波：🧟‍♂️ BOSS`;
 } else {
 statusTitleEl.textContent = `👁️ 第 ${state.wave} 波：🧟`;
 }
 // 下一波預覽
 if (!state.waveActive && !state.draftPhase) {
 const nextBossName = nextIsBoss ? (BOSS_WAVES[Math.min(nextWave, 20)]?.name || 'Boss') : null;
 statusTextEl.textContent = nextIsBoss
 ? `下一波：⚠️ BOSS「${nextBossName}」來襲！`
 : `下一波：第 ${nextWave} 波 — ${getWavePreviewText(nextWave)}`;
 }
 const modifierNames = {
 normal: '普通日', solar: '☀️ 大晴天', fog: '🌫️ 濃霧',
 eclipse: '🌑 日蝕', storm: '⛈️ 風暴', bloodmoon: '🩸 血月',
 };
 modifierTagEl.textContent = modifierNames[modifier] || '普通日';
 modifierTagEl.className = `modifier-tag ${modifier}`;
}

function getWavePreviewText(wave) {
 const newKinds = [];
 if (wave === 2) newKinds.push('🚧 路障');
 if (wave === 3) newKinds.push('📰 報紙');
 if (wave === 4) newKinds.push('🏃 跑者');
 if (wave === 5) newKinds.push('💉 治療師');
 if (wave === 6) newKinds.push('🪣 鐵桶');
 if (wave === 7) newKinds.push('🪓 分裂', '🛡️ 裝甲');
 if (wave === 8) newKinds.push('🐸 跳跳');
 if (wave === 9) newKinds.push('💀 死靈');
 if (wave === 10) newKinds.push('🏹 攻城');
 if (wave === 11) newKinds.push('🧌 巨人');
 if (wave === 13) newKinds.push('💃 舞王');
 if (newKinds.length > 0) return `新殭屍：${newKinds.join(' ')}`;
 return '殭屍持續增強...';
}

function showChaosAlert(msg) {
 chaosAlertEl.textContent = msg;
 chaosAlertEl.classList.add('show');
 setTimeout(() => chaosAlertEl.classList.remove('show'), 2500);
}

function showWaveToast(text, isBig) {
 let toast = document.querySelector('.wave-toast');
 if (!toast) {
 toast = document.createElement('div');
 toast.className = 'wave-toast';
 document.querySelector('.board-wrap').appendChild(toast);
 }
 toast.textContent = text;
 toast.classList.toggle('big', isBig);
 toast.classList.add('show');
 // Auto-remove handled by render timer
}

// ═══════════════════════════════════════════════
// 戰鬥日誌系統
// ═══════════════════════════════════════════════
const LOG_MAX = 6;
let logEntries = [];

function battleLog(text, type = 'info') {
 const now = new Date();
 const ts = `${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
 logEntries.unshift({ ts, text, type });
 if (logEntries.length > LOG_MAX) logEntries.length = LOG_MAX;
 renderBattleLog();
}

function renderBattleLog() {
 if (!battleLogEl) return;
 battleLogEl.innerHTML = logEntries.map(e => {
 const cls = e.type === 'danger' ? 'log-danger' : e.type === 'success' ? 'log-success' : e.type === 'boss' ? 'log-boss' : '';
 return `<div class="log-entry ${cls}"><span class="log-ts">${e.ts}</span> ${e.text}</div>`;
 }).join('');
}

// ═══════════════════════════════════════════════
// 佔領 UI
// ═══════════════════════════════════════════════

function updateTerritoryUI() {
 const playableCols = getPlayableCols(state);
 const conqueredCount = state.territory?.conquered?.size || 0;
 if (frontlineInfoEl) {
 frontlineInfoEl.textContent = `前線：第 ${playableCols} 列 | 佔領：${conqueredCount} 格`;
 }

 if (conquestBtnEl) {
 conquestBtnEl.classList.toggle('active', state.conquestMode);
 }

 // 更新格子視覺
 const cells = boardEl.querySelectorAll('.cell');
 cells.forEach(cell => {
 const r = parseInt(cell.dataset.row);
 const c = parseInt(cell.dataset.col);
 const terrain = getCellTerrain(state, r, c);
 const conquered = state.territory?.conquered?.has(cellKey(r, c));

 cell.classList.remove('unplayable', 'frontline', 'conquered', 'conquering');

 if (!isCellPlayable(state, c)) {
 cell.classList.add('unplayable');
 } else if (c === playableCols - 1) {
 cell.classList.add('frontline');
 }

 if (conquered) {
 cell.classList.add('conquered');
 }

 // 佔領進度中的格子
 const conquering = state.territory?.conquering;
 if (conquering && conquering.key === cellKey(r, c)) {
 cell.classList.add('conquering');
 // 更新佔領進度條
 let progBar = cell.querySelector('.conquest-progress-bar');
 if (!progBar) {
 progBar = document.createElement('div');
 progBar.className = 'conquest-progress-bar';
 cell.appendChild(progBar);
 }
 progBar.style.width = `${(conquering.progress / conquering.total) * 100}%`;
 } else {
 const progBar = cell.querySelector('.conquest-progress-bar');
 if (progBar) progBar.remove();
 }

 // 地形標記
 let terrainMarker = cell.querySelector('.terrain-marker');
 if (terrain && !conquered && c >= TERRITORY.startPlayableCols) {
 if (!terrainMarker) {
 terrainMarker = document.createElement('div');
 terrainMarker.className = 'terrain-marker';
 cell.appendChild(terrainMarker);
 }
 terrainMarker.textContent = terrain.emoji;
 terrainMarker.title = `${terrain.name}: ${terrain.desc}`;
 } else if (terrainMarker && (conquered || c < TERRITORY.startPlayableCols)) {
 terrainMarker.remove();
 }
 });
}

// ═══════════════════════════════════════════════
// 更新商店（冷卻、可購買狀態）
// ═══════════════════════════════════════════════

function updateShop(state) {
 document.querySelectorAll('.card').forEach(el => {
 const name = el.dataset.plant;
 const def = PLANTS[name];
 if (!def) return;
 const cost = actualPlantCost(state, name, def);
 const cd = state.cooldowns[name] || 0;
 const canAfford = state.sun >= cost;

 el.classList.toggle('disabled', !canAfford || cd > 0);

 // 更新費用顯示
 const costEl = el.querySelector('.cost');
 if (costEl) {
 costEl.textContent = `${cost} ☀️`;
 costEl.className = `cost${!canAfford ? ' bad' : ''}`;
 }

 // 冷卻覆蓋
 const cdOverlay = el.querySelector('.cooldown');
 const cdText = el.querySelector('.cooltxt');
 if (cdOverlay && cdText) {
 if (cd > 0) {
 cdOverlay.style.transform = `scaleY(${Math.min(1, cd / def.cooldown)})`;
 cdText.textContent = `${Math.ceil(cd)}s`;
 } else {
 cdOverlay.style.transform = 'scaleY(0)';
 cdText.textContent = '';
 }
 }
 });

 updateSpellBar();
 updateCellHighlights();
}

// ── 前線推進條 ──────────────────────────────────
// 前線 = 佔領格的最遠列 + 可放置列數
// 殭屍前線 = 最左殭屍的平均 x 位置
// gauge 0% = 殭屍到最左邊, 100% = 植物佔領到最右

function updateFrontlineGauge() {
 const gaugeEl = document.getElementById('frontlineGauge');
 if (!gaugeEl) return;

 // 植物推進分數：佔領格數 + 可放置列進展
 const playableCols = getPlayableCols(state);
 const conqueredCount = state.territory?.conquered?.size || 0;
 const maxConquest = rows * (cols - playableCols + 1); // 理論最大佔領格數
 const plantScore = Math.min(1, (conqueredCount + playableCols - 3) / (cols * rows * 0.4));

 // 殭屍威脅分數：殭屍越左越危險
 let zombieThreat = 0;
 if (state.zombies.length > 0) {
 const avgX = state.zombies.reduce((sum, z) => sum + z.x, 0) / state.zombies.length;
 zombieThreat = Math.max(0, 1 - avgX / cols);
 }
 // 殭屍數量加成
 const countThreat = Math.min(1, state.zombies.length / 15);
 zombieThreat = Math.min(1, zombieThreat * 0.6 + countThreat * 0.4);

 // 合併：50% 是均衡狀態
 const gauge = 0.5 + (plantScore - zombieThreat) * 0.5;
 const clampedGauge = Math.max(0.05, Math.min(0.95, gauge));

 const fillEl = document.getElementById('gaugeFill');
 if (fillEl) {
 fillEl.style.width = `${clampedGauge * 100}%`;
 // 顏色：偏綠=安全 偏紅=危險
 if (clampedGauge < 0.3) {
 fillEl.style.background = 'linear-gradient(90deg, rgba(239,68,68,.7), rgba(251,146,60,.5))';
 } else if (clampedGauge < 0.45) {
 fillEl.style.background = 'linear-gradient(90deg, rgba(251,146,60,.6), rgba(250,204,21,.4))';
 } else {
 fillEl.style.background = 'linear-gradient(90deg, rgba(34,197,94,.6), rgba(34,211,238,.4))';
 }
 }

 // 里程碑：殭屍威脅超過閾值時觸發精英波
 const milestoneEl = document.getElementById('gaugeMilestones');
 if (milestoneEl && milestoneEl.children.length === 0) {
 // 建立 3 個里程碑標記
 for (let i = 0; i < 3; i++) {
 const m = document.createElement('div');
 m.className = i === 2 ? 'gauge-milestone boss' : 'gauge-milestone';
 milestoneEl.appendChild(m);
 }
 }

 // 殭屍推到里程碑 → 觸發精英波
 if (zombieThreat > 0.85 && !state._eliteTriggered) {
 state._eliteTriggered = true;
 triggerEliteWave();
 }
 if (zombieThreat < 0.5) {
 state._eliteTriggered = false;
 }
}

function triggerEliteWave() {
 // 精英波：額外 3 隻更強的殭屍
 sfx('boss');
 showChaosAlert('⚠️ 殭屍潮湧！精英殭屍增援！');
 battleLog(`⚠️ 精英殭屍增援！3 隻精英殭屍出現`, 'danger');

 for (let i = 0; i < 3; i++) {
 const row = Math.floor(Math.random() * rows);
 const kind = Math.random() < 0.3 ? 'bucket' : Math.random() < 0.5 ? 'armored' : 'cone';
 const base = ZOMBIES[kind];
 if (!base) continue;
 const hpScale = (1 + (state.wave - 1) * 0.14) * 1.5; // 精英 HP +50%
 state.zombies.push({
 id: state.nextZombieId++, kind, row, x: cols - 0.1,
 hp: Math.round(base.hp * hpScale), maxHp: Math.round(base.hp * hpScale),
 speed: base.speed * 1.1, biteTimer: 0, slowTimer: 0,
 angry: true, shield: kind === 'bucket', biteDmg: Math.round(base.bite * 1.25),
 });
 }
}

// ═══════════════════════════════════════════════
// 同步數據 & Boss HP
// ═══════════════════════════════════════════════

function syncStats() {
 sunEl.textContent = state.sun;
 killsEl.textContent = state.totalKills;
 waveEl.textContent = state.wave;
 mowerEl.textContent = state.lawnmowers.filter(m => !m.used).length;
 if (deckCountEl) deckCountEl.textContent = state.deck.length;
 if (runInfoEl) runInfoEl.textContent = `第 ${state.wave} 波 | 🏛️ ${loadRelics().length} 遺物`;
 updatePlantInfoPanel();
 updateComboDisplay();
 // Speed display — update button text directly instead of creating new pill
 const speedBtn = document.getElementById('speedBtn');
 if (speedBtn) {
 speedBtn.textContent = (state.gameSpeed || 1) > 1 ? `⏩ ${state.gameSpeed}x` : '⏩ 加速';
 speedBtn.classList.toggle('active', (state.gameSpeed || 1) > 1);
 }

	// Boss HP + 護盾 + 狂暴視覺
	const boss = state.zombies.find(z => z.kind === 'boss');
	if (boss) {
		bossHpBarEl?.classList.add('show');
		if (boss.enraged) bossHpBarEl?.classList.add('enraged');
		else bossHpBarEl?.classList.remove('enraged');

		if (bossHpTextEl) {
			let label = `${Math.round(boss.hp)} / ${boss.maxHp}`;
			if (boss.shield && boss.shieldHp > 0) label += ` 🛡️${Math.round(boss.shieldHp)}`;
			bossHpTextEl.textContent = label;
		}
		if (bossHpBarEl) {
			const fill = bossHpBarEl.querySelector('.boss-hp-fill');
			if (fill) fill.style.width = `${Math.max(0, boss.hp / boss.maxHp * 100)}%`;
			// 護盾分段條
			let shieldFill = bossHpBarEl.querySelector('.boss-shield-fill');
			if (boss.shield && boss.shieldHp > 0) {
				if (!shieldFill) {
					shieldFill = document.createElement('div');
					shieldFill.className = 'boss-shield-fill';
					bossHpBarEl.insertBefore(shieldFill, bossHpBarEl.firstChild);
				}
				shieldFill.style.width = `${Math.min(100, boss.shieldHp / boss.maxHp * 100)}%`;
			} else if (shieldFill) {
				shieldFill.remove();
			}
		}
	} else {
		bossHpBarEl?.classList.remove('show', 'enraged');
	}

 // 前線推進條
 updateFrontlineGauge();
}

function updateComboDisplay() {
 // Combo counter
}

// ── 植物資訊面板（取代 XP 進度） ──
function updatePlantInfoPanel() {
 const panel = document.getElementById('plantInfoPanel');
 if (!panel) return;
 const plants = [...state.plants.values()];
 if (plants.length === 0) {
 panel.innerHTML = '<span class="muted" style="font-size:11px;">尚無植物</span>';
 return;
 }
 panel.innerHTML = plants.map(p => {
 const def = PLANTS[p.type];
 const level = p.level || 1;
 const evo = getEvolutionBonus(p.type, level);
 const evoName = evo?.name || def?.name || '';
 const upgradeCost = level < 3 ? Math.floor((def?.cost || 50) * level * 0.6) : null;
 const terrain = getCellTerrain(state, p.row, p.col);
 const terrainTag = terrain && state.territory?.conquered?.has(cellKey(p.row, p.col))
 ? `<span class="terrain-tag">${terrain.emoji}</span>` : '';
 return `<div class="plant-info-item" data-key="${cellKey(p.row, p.col)}">
 <span class="pi-emoji">${def?.emoji || '?'}</span>
 <span class="pi-detail">
 <span class="pi-name">${evoName} <small class="pi-lv">Lv.${level}</small>${terrainTag}</span>
 <span class="pi-hp-bar"><i style="width:${Math.max(0, p.hp / p.maxHp * 100)}%"></i></span>
 <span class="pi-upgrade">${upgradeCost !== null ? `↑ 升級 ${upgradeCost} ☀️` : 'MAX'}</span>
 </span>
 </div>`;
 }).join('');
}

// ═══════════════════════════════════════════════
// 渲染
// ═══════════════════════════════════════════════

function render() {
 renderEntities(boardEl, state);
 updateCellHighlights();
 updateSpellBar();

 if (territoryDirty) {
 updateTerritoryUI();
 territoryDirty = false;
 }
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
 <div><div class="stat-label">難度</div><div class="stat-val">${state.difficulty || '普通'}</div></div>
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

function recordRun(state) {
 // Record best run
 const key = 'pvz_best_wave';
 const prev = Number(localStorage.getItem(key)) || 0;
 if (state.wave > prev) localStorage.setItem(key, state.wave);
}

// ═══════════════════════════════════════════════
// 暫停 & 速度控制
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

 // Speed control — toggle 1x / 1.5x / 2x
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

 // Right-click on cell to upgrade (event delegation on board)
 boardEl.addEventListener('contextmenu', e => {
 const cell = e.target.closest('.cell');
 if (!cell) return;
 e.preventDefault();
 const r = Number(cell.dataset.row);
 const c = Number(cell.dataset.col);
 handleUpgrade(r, c);
 });

 if (conquestBtnEl) {
 conquestBtnEl.addEventListener('click', () => {
 state.conquestMode = !state.conquestMode;
 if (state.conquestMode) {
 state.selectedPlant = null;
 state.shovelMode = false;
 boardEl.classList.remove('shovel-cursor');
 updateShovelBtn();
 [...document.querySelectorAll('.card')].forEach(c => c.classList.remove('selected'));
 }
 updateTerritoryUI();
 });
 }

 // Difficulty selector
 const diffSel = document.getElementById('difficultySelect');
 if (diffSel) {
 diffSel.addEventListener('change', () => {
 state.difficulty = diffSel.value;
 startGame();
 });
 }

 // Hover on cell: show terrain/upgrade tooltip
 boardEl.addEventListener('mouseover', e => {
 const cell = e.target.closest('.cell');
 if (!cell) return;
 const r = parseInt(cell.dataset.row);
 const c = parseInt(cell.dataset.col);
 const terrain = getCellTerrain(state, r, c);
 const plant = state.plants.get(cellKey(r, c));

 let tip = '';
 if (plant) {
 const def = PLANTS[plant.type];
 const evo = getEvolutionBonus(plant.type, plant.level);
 tip = `${def?.emoji} ${def?.name} Lv.${plant.level}`;
 if (evo?.desc) tip += ` — ${evo.desc}`;
 tip += ` | HP: ${Math.round(plant.hp)}/${plant.maxHp}`;
 const upgCost = plant.level < 3 ? Math.floor((def?.cost || 50) * plant.level * 0.6) : null;
 if (upgCost !== null) tip += ` | 升級: ${upgCost} ☀️`;
 } else if (terrain) {
 const conquered = state.territory?.conquered?.has(cellKey(r, c));
 tip = `${terrain.emoji} ${terrain.name}${conquered ? ' (已佔領)' : ''}: ${terrain.desc}`;
 if (!conquered) {
 const cost = conquestCost(state, c);
 tip += ` | 佔領: ${cost} ☀️`;
 }
 }
 if (tip) cell.title = tip;
 });

 // ── 鍵盤快捷鍵 ──
 bindKeyboardShortcuts({
 selectPlant: (idx) => {
 ensureAudio();
 const deckArr = state.deck || [];
 if (idx < deckArr.length) selectPlant(deckArr[idx]);
 },
 toggleShovel: () => { ensureAudio(); toggleShovel(); },
 togglePause: () => {
 isPaused = !isPaused;
 pauseBtn.textContent = isPaused ? '▶ 繼續' : '暫停';
 },
 toggleSpeed: () => {
 ensureAudio();
 state.gameSpeed = state.gameSpeed >= 2 ? 1 : state.gameSpeed + 0.5;
 const speedBtn = document.getElementById('speedBtn');
 if (speedBtn) {
 speedBtn.textContent = state.gameSpeed > 1 ? `⏩ ${state.gameSpeed}x` : '⏩ 加速';
 speedBtn.classList.toggle('active', state.gameSpeed > 1);
 }
 },
 castSpell: (idx) => {
 const spellKeys = Object.keys(SPELLS);
 if (idx < spellKeys.length) castSpell(spellKeys[idx]);
 },
		deckLength: () => (state.deck || []).length,
 });
}

function ensureAudio() {
 if (audioState.ctx?.state === 'suspended') audioState.ctx.resume();
}
