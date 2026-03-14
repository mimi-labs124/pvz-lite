import { PLANTS, ZOMBIES } from '../config.js';
import { getCellEl } from './board.js';

export function renderEntities(boardEl, state) {
  boardEl.querySelectorAll('.plant,.zombie,.pea,.sun,.mower,.boom').forEach(e => e.remove());

  for (const p of state.plants.values()) {
    const cell = getCellEl(boardEl, p.row, p.col);
    if (!cell) continue;
    const el = document.createElement('div');
    el.className = `plant ${p.type}`;
    el.innerHTML = `${PLANTS[p.type].emoji}<div class="hp"><i style="width:${Math.max(0, p.hp / p.maxHp * 100)}%"></i></div>`;
    cell.appendChild(el);
  }

  for (const z of state.zombies) {
    const el = document.createElement('div');
    el.className = `zombie ${ZOMBIES[z.kind].className}${z.angry ? ' angry' : ''}`;
    el.style.left = `${z.x * 95 + 4}px`;
    el.style.top = `${z.row * 100 + (z.kind === 'giant' ? 2 : 10)}px`;
    const icon = z.kind === 'splitter' ? '🪓' : z.mini ? '🧟‍♂️' : z.shield ? `${ZOMBIES[z.kind].emoji}🛡️` : ZOMBIES[z.kind].emoji;
    el.innerHTML = `${icon}<div class="hp"><i style="width:${Math.max(0, z.hp / z.maxHp * 100)}%"></i></div>`;
    if (z.slowTimer > 0) el.style.outline = '2px solid rgba(56,189,248,.55)';
    boardEl.appendChild(el);
  }

  for (const p of state.peas) {
    const el = document.createElement('div');
    el.className = `pea${p.ice ? ' ice' : ''}${p.prism ? ' prism' : ''}${p.gambler ? ' prism' : ''}`;
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
}
