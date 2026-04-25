import { PLANTS, ZOMBIES, XP_LEVELS } from '../config.js';
import { getPlantLevel } from '../core/state.js';
import { getEvolutionBonus } from '../systems/evolution.js';
import { getCellEl } from './board.js';

const LEVEL_COLORS = ['', '#4ade80', '#facc15', '#f87171'];
const LEVEL_STARS = ['', '★', '★★', '★★★'];

export function renderEntities(boardEl, state) {
	boardEl.querySelectorAll('.plant,.zombie,.pea,.sun,.mower,.boom').forEach(e => e.remove());

	// ── 植物渲染 ──
	for (const p of state.plants.values()) {
		const cell = getCellEl(boardEl, p.row, p.col);
		if (!cell) continue;
		const el = document.createElement('div');
		const level = Math.min(p.level || getPlantLevel(p.xp || 0), 3);
		const evo = getEvolutionBonus(p.type, level);
		const evoName = evo.name || PLANTS[p.type]?.name || '';

		el.className = `plant ${p.type}`;
		if (level >= 2) el.classList.add(`evo-${level}`);
		if (p.justEvolved > 0) el.classList.add('evolve-flash');
		if (state.shieldTimer > 0) el.classList.add('shielded');

		// XP bar for non-max plants
		const maxLevel = 3;
		const nextLevelXP = level < maxLevel ? XP_LEVELS[level] : null;
		const currentXP = p.xp || 0;
		let xpBarHTML = '';
		if (level < maxLevel && nextLevelXP !== null) {
			const prevXP = XP_LEVELS[level - 1] || 0;
			const xpProgress = Math.min(1, Math.max(0, (currentXP - prevXP) / (nextLevelXP - prevXP)));
			xpBarHTML = `<div class="xp-bar"><i style="width:${xpProgress * 100}%"></i></div>`;
		}

		// Upgrade hint: show cost when XP is ready
		let upgradeHintHTML = '';
		if (level < maxLevel) {
			const def = PLANTS[p.type];
			const upgradeCost = Math.floor((def?.cost || 50) * (level === 1 ? 0.6 : 1.0) * level);
			const xpReady = currentXP >= nextLevelXP;
			if (xpReady) {
				upgradeHintHTML = `<div class="upgrade-hint ready">↑${upgradeCost}☀️</div>`;
			} else {
				upgradeHintHTML = `<div class="upgrade-hint">↑${currentXP}/${nextLevelXP}</div>`;
			}
		} else {
			upgradeHintHTML = '<div class="upgrade-hint max">MAX</div>';
		}

		el.innerHTML = `
			${PLANTS[p.type]?.emoji || '?'}
			<div class="evo-indicator" style="color:${LEVEL_COLORS[level]}">${LEVEL_STARS[level]}</div>
			<div class="hp"><i style="width:${p.maxHp ? Math.max(0, p.hp / p.maxHp * 100) : 0}%"></i></div>
			${xpBarHTML}
			${upgradeHintHTML}
		`;
		el.title = `${evoName} Lv.${level} | HP: ${Math.round(p.hp)}/${p.maxHp} | XP: ${currentXP}`;
		cell.appendChild(el);
	}

	// ── 殭屍渲染 ──
	for (const z of state.zombies) {
		const el = document.createElement('div');
		let className = `zombie ${ZOMBIES[z.kind]?.className || 'normal'}`;
		if (z.angry) className += ' angry';
		if (z.frozen) className += ' frozen';
if (z.undead) className += ' undead';
 if (z.digging) className += ' digging';
 if (z.burning) className += ' burning';
		// Mark zombies on unconquered land with visual indicator
		const zCol = Math.round(z.x);
		const zKey = `${z.row}-${zCol}`;
		if (state.territory && zCol >= 3 && !state.territory.conquered?.has(zKey)) {
			className += ' unconquered-buff';
		}
		el.className = className;

		el.style.left = `${z.x * 95 + 4}px`;
		el.style.top = `${z.row * 94 + (z.kind === 'giant' || z.kind === 'boss' ? 2 : z.kind === 'dancer' ? 6 : z.kind === 'backup' || z.kind === 'mini' ? 18 : 10)}px`;

		let icon = ZOMBIES[z.kind]?.emoji || '🧟';
		if (z.kind === 'boss') icon = z.bossEmoji || '👾';
		if (z.kind === 'dancer') icon = '💃';
		if (z.kind === 'backup') icon = '🕺';
		if (z.shield) icon += '🛡️';
		if (z.kind === 'armored' && z.armorHp > 0) icon += '🛡️';

		el.innerHTML = `${icon}<div class="hp"><i style="width:${z.maxHp ? Math.max(0, z.hp / z.maxHp * 100) : 0}%"></i></div><span class="hp-text">${Math.max(0, Math.round(z.hp))}</span>`;

		if (z.slowTimer > 0 && !z.frozen) el.style.outline = '2px solid rgba(56,189,248,.55)';
		if (z.frozen) el.style.outline = '2px solid rgba(125,211,252,.85)';
		if (z.burning) el.style.outline = '2px solid rgba(251,146,60,.65)';

		if (z.kind === 'boss') {
			el.style.width = '82px';
			el.style.height = '95px';
			el.style.fontSize = '46px';
			el.style.background = z.enraged
				? 'rgba(220,38,38,.45)'
				: 'rgba(239,68,68,.32)';
			el.style.border = z.enraged
				? '3px solid rgba(239,68,68,.9)'
				: '2px solid rgba(251,146,60,.6)';
			if (z.enraged) {
				el.style.boxShadow = '0 0 18px rgba(239,68,68,.7), inset 0 0 8px rgba(251,146,60,.4)';
				el.style.animation = 'bossRage 0.6s infinite alternate';
			}
			if (z.shield && z.shieldHp > 0) {
				const shieldBar = document.createElement('div');
				shieldBar.className = 'boss-shield-bar';
				shieldBar.innerHTML = `<i style="width:${Math.max(0, z.shieldHp / 200 * 100)}%"></i>`;
				el.appendChild(shieldBar);
			}
			if (z.bossName) {
				const nameTag = document.createElement('div');
				nameTag.className = 'boss-name';
				nameTag.textContent = z.bossName;
				el.appendChild(nameTag);
			}
		}

		boardEl.appendChild(el);
	}

	// ── 豌豆渲染 ──
	for (const p of state.peas) {
		const el = document.createElement('div');
		let cls = 'pea';
		if (p.ice) cls += ' ice';
		if (p.prism) cls += ' prism';
		if (p.fire) cls += ' fire';
		if (p.gambler) cls += ' gambler';
		el.className = cls;
		el.style.left = `${p.x * 95 + 20}px`;
		el.style.top = `${p.row * 94 + 10}px`;
		if (p.fire) {
			el.style.background = 'radial-gradient(circle at 35% 35%,#fef3c7,#f97316)';
			el.style.boxShadow = '0 0 12px rgba(249,115,22,.6)';
		}
		boardEl.appendChild(el);
	}

	// ── 陽光渲染（支援 collected 動畫） ──
	for (const s of state.suns) {
		const el = document.createElement('div');
		el.className = s.collected ? 'sun collected' : 'sun';
		el.textContent = '☀';
		el.style.left = `${s.x}px`;
		el.style.top = `${s.y}px`;
		el.dataset.sunId = s.id;
		boardEl.appendChild(el);
	}

	// ── 割草機渲染 ──
	for (const m of state.lawnmowers) {
		if (m.used && !m.active) continue;
		const el = document.createElement('div');
		el.className = 'mower';
		el.textContent = '🚜';
		el.style.left = `${m.x * 95 + 2}px`;
		el.style.top = `${m.row * 94 + 28}px`;
		boardEl.appendChild(el);
	}

	// ── 爆炸渲染 ──
	for (const b of state.booms) {
		const el = document.createElement('div');
		el.className = 'boom';
		el.style.left = `${b.col * 95 - 34}px`;
		el.style.top = `${b.row * 94 - 6}px`;
		el.style.width = '220px';
		el.style.height = '220px';
		boardEl.appendChild(el);
	}
}
