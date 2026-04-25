// ═══════════════════════════════════════════════
// UI Controls — 快捷鍵 + 暫停
// ═══════════════════════════════════════════════

export function bindPauseControl(pauseBtn, _statusTitleEl, _statusTextEl, isPaused, setPaused) {
  pauseBtn.addEventListener('click', () => {
    const p = !isPaused();
    setPaused(p);
    pauseBtn.textContent = p ? '繼續' : '暫停';
  });
}

/**
 * 綁定鍵盤快捷鍵
 * @param {Object} handlers - { selectPlant, toggleShovel, togglePause, toggleSpeed, castSpell }
 * @param {Array} deck - 目前牌組
 * @param {Object} spells - 法術列表
 */
export function bindKeyboardShortcuts(handlers) {
  document.addEventListener('keydown', (e) => {
 const key = e.key.toLowerCase();

 // 不要在 overlay 顯示時或輸入框中觸發
 if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
 const shownOverlay = document.querySelector('.overlay.show');
 if (shownOverlay) {
 // 遊戲結束 overlay 完全擋住；draft/relic overlay 只保留暫停鍵
 if (!shownOverlay.classList.contains('draft-overlay') && !shownOverlay.classList.contains('relic-overlay')) return;
 if (key !== ' ') return; // 在 draft/relic overlay 只允許空白鍵暫停
 }

    // 數字鍵 1-9：選擇牌組中的植物
    if (key >= '1' && key <= '9') {
      const idx = parseInt(key) - 1;
	if (handlers.selectPlant && idx < (typeof handlers.deckLength === 'function' ? handlers.deckLength() : handlers.deckLength)) {
        handlers.selectPlant(idx);
      }
      return;
    }

    // S：鏟子
    if (key === 's') {
      handlers.toggleShovel?.();
      return;
    }

    // 空白鍵：暫停/繼續
    if (key === ' ') {
      e.preventDefault();
      handlers.togglePause?.();
      return;
    }

    // F：加速
    if (key === 'f') {
      handlers.toggleSpeed?.();
      return;
    }

    // Q/W/E/R/T：法術快捷鍵
    const spellKeys = ['q', 'w', 'e', 'r', 't'];
    const spellIdx = spellKeys.indexOf(key);
    if (spellIdx >= 0) {
      handlers.castSpell?.(spellIdx);
      return;
    }
  });
}
