/**
 * ui/shop-ui.js — Shop card construction & plant selection UI
 */

import { PLANTS } from '../config.js';
import { ensureAudio } from '../audio.js';
import { shopEl, mobileShopEl } from '../dom.js';

/**
 * Build the shop card grid for both desktop and mobile bars.
 */
export function buildShop(onSelect) {
  const html = Object.entries(PLANTS).map(([k, p]) =>
    `<div class="card" data-plant="${k}">
      <div class="row"><strong>${p.emoji} ${p.name}</strong><span class="cost">${p.cost} ☀️</span></div>
      <div class="muted">${p.desc}</div>
      ${p.upgradeCost ? `<div class="upgrade-hint">⭐ 升級: ${p.upgradeCost}☀️ — ${p.upgradeDesc}</div>` : ''}
      <div class="cooldown"></div><div class="cooltxt"></div>
    </div>`
  ).join('');
  shopEl.innerHTML = html;
  mobileShopEl.innerHTML = html;
  [...document.querySelectorAll('.card')].forEach(c =>
    c.addEventListener('click', () => { ensureAudio(); onSelect(c.dataset.plant); })
  );
}

/**
 * Update selection highlight on all card elements.
 */
export function highlightSelected(plantKey) {
  [...document.querySelectorAll('.card')].forEach(c =>
    c.classList.toggle('selected', c.dataset.plant === plantKey)
  );
}
