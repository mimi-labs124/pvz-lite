import { PLANTS, ZOMBIES, POWERUPS } from '../config.js';
import { getCellEl } from './board.js';

export function renderEntities(boardEl, state) {
  boardEl.querySelectorAll('.plant,.zombie,.pea,.sun,.mower,.boom,.powerup,.row-danger').forEach(e => e.remove());

  for (const p of state.plants.values()) {
    const cell = getCellEl(boardEl, p.row, p.col);
    if (!cell) continue;
    const el = document.createElement('div');
    const isChomping = p.type === 'chomper' && p.chompTimer > 0;
    const isTorch = p.type === 'torchwood';
    const isUpgraded = p.level >= 2;
    el.className = `plant ${p.type}${isChomping ? ' chewing' : ''}${isTorch ? ' torch-glow' : ''}${isUpgraded ? ' upgraded' : ''}`;
    el.innerHTML = `${PLANTS[p.type].emoji}${isUpgraded ? '<span class="lvl">★</span>' : ''}<div class="hp"><i style="width:${Math.max(0, p.hp / p.maxHp * 100)}%"></i></div>`;
    // Tooltip data
    el.dataset.plantType = p.type;
    el.dataset.plantLevel = p.level;
    el.dataset.plantHp = `${Math.round(p.hp)}/${p.maxHp}`;
    cell.appendChild(el);
  }

  for (const z of state.zombies) {
    const el = document.createElement('div');
    const isUnderground = z.digger && z.digTimer > 0;
    el.className = `zombie ${ZOMBIES[z.kind].className}${z.angry ? ' angry' : ''}${isUnderground ? ' underground' : ''}`;
    el.style.left = `${z.x * 95 + 4}px`;
    el.style.top = `${z.row * 100 + (z.kind === 'giant' ? 2 : z.kind === 'imp' ? 22 : 10)}px`;
    if (isUnderground) { el.style.opacity = '0.3'; el.style.filter = 'blur(2px)'; }
    const icon = z.kind === 'digger' && !isUnderground ? '⛏️🧟' : z.kind === 'splitter' ? '🪓' : z.kind === 'imp' ? '👺' : z.mini ? '🧟‍♂️' : z.shield ? `${ZOMBIES[z.kind].emoji}🛡️` : ZOMBIES[z.kind].emoji;
    el.innerHTML = `${icon}<div class="hp"><i style="width:${Math.max(0, z.hp / z.maxHp * 100)}%"></i></div>`;
    if (z.slowTimer > 0) el.style.outline = '2px solid rgba(56,189,248,.55)';
    boardEl.appendChild(el);
  }

  for (const p of state.peas) {
    const el = document.createElement('div');
    el.className = `pea${p.ice ? ' ice' : ''}${p.prism ? ' prism' : ''}${p.gambler ? ' prism' : ''}${p.fire ? ' fire' : ''}${p.cactus ? ' cactus-pea' : ''}`;
    el.style.left = `${p.x * 95 + 20}px`;
    el.style.top = `${p.row * 100 + 10}px`;
    boardEl.appendChild(el);
  }

  for (const s of state.suns) {
    const el = document.createElement('div');
    el.className = 'sun';
    el.textContent = '☀';
    el.style.left = `${s.x}px`;
    el.style.top = `${s.y}px`;
    el.dataset.sunId = s.id;
    boardEl.appendChild(el);
  }

  // Power-ups
  for (const p of state.powerups) {
    const el = document.createElement('div');
    el.className = 'powerup';
    el.textContent = p.emoji;
    el.style.left = `${p.x}px`;
    el.style.top = `${p.y}px`;
    el.dataset.powerupId = p.id;
    boardEl.appendChild(el);
  }

  for (const m of state.lawnmowers) {
    if (m.used && !m.active) continue;
    const el = document.createElement('div');
    el.className = 'mower';
    el.textContent = '🚜';
    el.style.left = `${m.x * 95 + 2}px`;
    el.style.top = `${m.row * 100 + 28}px`;
    boardEl.appendChild(el);
  }

  for (const b of state.booms) {
    const el = document.createElement('div');
    el.className = 'boom';
    el.style.left = `${b.col * 95 - 34}px`;
    el.style.top = `${b.row * 100 - 6}px`;
    el.style.width = '220px';
    el.style.height = '220px';
    boardEl.appendChild(el);
  }

  // Row danger indicators
  for (let r = 0; r < 5; r++) {
    const count = state.zombies.filter(z => z.row === r && (!z.digger || z.digTimer <= 0)).length;
    if (count >= 3) {
      const indicator = document.createElement('div');
      indicator.className = `row-danger ${count >= 5 ? 'critical' : 'warning'}`;
      indicator.style.top = `${r * 100 + 2}px`;
      boardEl.appendChild(indicator);
    }
  }
}
