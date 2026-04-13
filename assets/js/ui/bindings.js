/**
 * UI Bindings — Centralized event wiring
 *
 * All UI event bindings are consolidated here so that:
 * - main.js is a pure bootstrap entry
 * - game.js focuses on runtime orchestration
 */

import { ensureAudio, audioState } from '../audio.js';
import { sfxVolumeEl, sfxValueEl, restartBtn, playAgainBtn, levelSelect, boardEl, pauseBtn } from '../dom.js';
import { startGame } from '../game.js';
import { collectSun } from '../systems/economy.js';
import { bindPauseControl } from './controls.js';

/** Sync audio volume label to current state */
function syncAudioUI() {
  sfxValueEl.textContent = `${Math.round(audioState.sfxVolume * 100)}%`;
}

/** Wire audio volume slider */
export function bindAudioControls() {
  sfxVolumeEl.addEventListener('input', () => {
    audioState.sfxVolume = Number(sfxVolumeEl.value) / 100;
    syncAudioUI();
    ensureAudio();
  });
  syncAudioUI();
}

/** Wire restart / play-again / level-change */
export function bindGameButtons() {
  restartBtn.addEventListener('click', () => { ensureAudio(); startGame(); });
  playAgainBtn.addEventListener('click', () => { ensureAudio(); startGame(); });
  levelSelect.addEventListener('change', startGame);
}

/** Wire pause control */
export function bindPause(pauseBtn, statusTitleEl, statusTextEl, getPaused, setPaused) {
  bindPauseControl(pauseBtn, statusTitleEl, statusTextEl, getPaused, setPaused);
}

/** Wire board-level pointer events (sun collection) */
export function bindBoardInteraction(getState, onSync) {
  boardEl.addEventListener('pointerdown', e => {
    const t = e.target.closest('.sun');
    if (t) {
      e.preventDefault();
      e.stopPropagation();
      ensureAudio();
      const state = getState();
      if (collectSun(state, Number(t.dataset.sunId))) {
        onSync();
      }
    }
  });
}

/** Unlock audio context on first user interaction */
export function bindAudioUnlock() {
  document.addEventListener('pointerdown', ensureAudio, { once: true });
}
