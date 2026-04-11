import { PLANTS, ZOMBIES } from '../config.js';
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
    const level = p.level || getPlantLevel(p.xp || 0);
    const evo = getEvolutionBonus(p.type, level);
    const evoName = evo.name || PLANTS[p.type]?.name || '';

    el.className = `plant ${p.type}`;
    if (level >= 2) el.classList.add(`evo-${level}`);
    // ── Chaos Awakening: 護盾效果 ──
    if (state.shieldTimer > 0) el.classList.add('shielded');
    el.innerHTML = `
      ${PLANTS[p.type]?.emoji || '?'}
      <div class="evo-indicator" style="color:${LEVEL_COLORS[level]}">${LEVEL_STARS[level]}</div>
      <div class="hp"><i style="width:${Math.max(0, p.hp / p.maxHp * 100)}%"></i></div>
    `;
    el.title = `${evoName} Lv.${level} | HP: ${Math.round(p.hp)}/${p.maxHp} | XP: ${p.xp || 0}`;
    cell.appendChild(el);
  }

  // ── 殭屍渲染 ──
  for (const z of state.zombies) {
    const el = document.createElement('div');
    let className = `zombie ${ZOMBIES[z.kind]?.className || 'normal'}`;
    if (z.angry) className += ' angry';
    if (z.frozen) className += ' frozen';
    if (z.undead) className += ' undead';
    if (z.burning) className += ' burning';
    el.className = className;

    el.style.left = `${z.x * 95 + 4}px`;
    el.style.top = `${z.row * 100 + (z.kind === 'giant' || z.kind === 'boss' ? 2 : 10)}px`;

    let icon = ZOMBIES[z.kind]?.emoji || '🧟';
    if (z.kind === 'boss') icon = z.bossEmoji || '👾';
    if (z.shield) icon += '🛡️';

    el.innerHTML = `${icon}<div class="hp"><i style="width:${Math.max(0, z.hp / z.maxHp * 100)}%"></i></div>`;

    if (z.slowTimer > 0 && !z.frozen) el.style.outline = '2px solid rgba(56,189,248,.55)';
    if (z.frozen) el.style.outline = '2px solid rgba(125,211,252,.85)';
    if (z.burning) el.style.outline = '2px solid rgba(251,146,60,.65)';

    if (z.kind === 'boss') {
      el.style.width = '82px';
      el.style.height = '95px';
      el.style.fontSize = '46px';
      el.style.background = 'rgba(239,68,68,.32)';
      el.style.border = '2px solid rgba(251,146,60,.6)';
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
    el.style.top = `${p.row * 100 + 10}px`;
    if (p.fire) {
      el.style.background = 'radial-gradient(circle at 35% 35%,#fef3c7,#f97316)';
      el.style.boxShadow = '0 0 12px rgba(249,115,22,.6)';
    }
    boardEl.appendChild(el);
  }

  // ── 陽光渲染 ──
  for (const s of state.suns) {
    const el = document.createElement('div');
    el.className = 'sun';
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
    el.style.top = `${m.row * 100 + 28}px`;
    boardEl.appendChild(el);
  }

  // ── 爆炸渲染 ──
  for (const b of state.booms) {
    const el = document.createElement('div');
    el.className = 'boom';
    el.style.left = `${b.col * 95 - 34}px`;
    el.style.top = `${b.row * 100 - 6}px`;
    el.style.width = '220px';
    el.style.height = '220px';
    boardEl.appendChild(el);
  }
}
