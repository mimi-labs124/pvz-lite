import { ensureAudio, audioState } from './audio.js';
import { sfxVolumeEl, sfxValueEl, restartBtn, playAgainBtn } from './dom.js';
import { startGame, bindGameEvents } from './game.js';
import { loadRelics, RELICS } from './systems/relics.js';

function syncAudioUI() {
  sfxValueEl.textContent = `${Math.round(audioState.sfxVolume * 100)}%`;
}

function updateRelicListUI() {
  const relicListEl = document.getElementById('relicList');
  if (!relicListEl) return;
  const owned = loadRelics();
  if (owned.length === 0) {
    relicListEl.innerHTML = '<div class="muted">尚無遺物 — 陣亡後可獲得</div>';
    return;
  }
  relicListEl.innerHTML = owned.map(id => {
    const r = RELICS[id];
    if (!r) return '';
    const rarityClass = r.rarity === 'legendary' ? 'legendary' : r.rarity === 'rare' ? 'rare' : '';
    return `<span class="relic-badge ${rarityClass}" title="${r.desc}">${r.emoji} ${r.name}</span>`;
  }).join('');
}

sfxVolumeEl.addEventListener('input', () => {
  audioState.sfxVolume = Number(sfxVolumeEl.value) / 100;
  syncAudioUI();
  ensureAudio();
});

restartBtn.addEventListener('click', () => {
  ensureAudio();
  startGame();
  updateRelicListUI();
});

playAgainBtn.addEventListener('click', () => {
  ensureAudio();
  startGame();
  updateRelicListUI();
});

document.addEventListener('pointerdown', ensureAudio, { once: true });

bindGameEvents();
syncAudioUI();
updateRelicListUI();
startGame();
