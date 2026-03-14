import { ensureAudio, audioState } from './audio.js';
import { sfxVolumeEl, sfxValueEl, restartBtn, playAgainBtn, levelSelect } from './dom.js';
import { startGame, bindGameEvents } from './game.js';

function syncAudioUI() {
  sfxValueEl.textContent = `${Math.round(audioState.sfxVolume * 100)}%`;
}

sfxVolumeEl.addEventListener('input', () => {
  audioState.sfxVolume = Number(sfxVolumeEl.value) / 100;
  syncAudioUI();
  ensureAudio();
});

restartBtn.addEventListener('click', () => {
  ensureAudio();
  startGame();
});

playAgainBtn.addEventListener('click', () => {
  ensureAudio();
  startGame();
});

levelSelect.addEventListener('change', startGame);
document.addEventListener('pointerdown', ensureAudio, { once: true });

bindGameEvents();
syncAudioUI();
startGame();
