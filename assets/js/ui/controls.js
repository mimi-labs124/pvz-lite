export function bindPauseControl(pauseBtn, statusTitleEl, statusTextEl, getPaused, setPaused) {
  pauseBtn.addEventListener('click', () => {
    const next = !getPaused();
    setPaused(next);
    pauseBtn.textContent = next ? '繼續' : '暫停';
    statusTitleEl.textContent = next ? '已暫停' : statusTitleEl.textContent;
    statusTextEl.textContent = next ? '喘口氣，想好再繼續種。' : statusTextEl.textContent;
  });
}
