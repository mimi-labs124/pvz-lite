export function bindPauseControl(pauseBtn, statusTitleEl, statusTextEl, isPaused, setPaused) {
  pauseBtn.addEventListener('click', () => {
    const p = !isPaused();
    setPaused(p);
    pauseBtn.textContent = p ? '繼續' : '暫停';
  });
}
