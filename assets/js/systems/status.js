export function updateLevelHint(state, levelHintEl) {
  const hint = state.levelKey === 'easy' ? '穩定發育' : state.levelKey === 'hard' ? '高壓快節奏' : state.levelKey === 'survival' ? '長線硬仗' : '平衡推進';
  levelHintEl.textContent = hint;
  levelHintEl.parentElement.classList.remove('live', 'warning', 'danger');
  if (state.wave >= 8) levelHintEl.parentElement.classList.add('danger');
  else if (state.wave >= 4) levelHintEl.parentElement.classList.add('warning');
  else levelHintEl.parentElement.classList.add('live');
}

export function updateBattleStatus(state, els, kind = 'normal') {
  const { battleStatusEl, statusTitleEl, statusTextEl, modifierTagEl } = els;
  const wave = state?.wave ?? 1;
  const modifierName = state?.modifier === 'solar' ? 'Solar Flare' : state?.modifier === 'fog' ? 'Iron Fog' : state?.modifier === 'bloodmoon' ? 'Blood Moon' : '普通日';
  modifierTagEl.textContent = modifierName;
  modifierTagEl.className = `modifier-tag ${state?.modifier ?? 'normal'}`;
  battleStatusEl.classList.remove('alert', 'danger', 'solar', 'fog', 'bloodmoon');
  if (state?.modifier === 'solar') battleStatusEl.classList.add('solar');
  if (state?.modifier === 'fog') battleStatusEl.classList.add('fog');
  if (state?.modifier === 'bloodmoon') battleStatusEl.classList.add('bloodmoon');
  if (kind === 'danger') battleStatusEl.classList.add('danger');

  if (kind === 'danger') {
    statusTitleEl.textContent = `第 ${wave} 波：撐住這波`;
    statusTextEl.textContent = state.wave >= 7 ? '高壓波次開始了，晚點會出帶盾硬殭屍。' : '殭屍密度提高了，先保住前排和經濟。';
  } else if (state?.modifier === 'solar') {
    statusTitleEl.textContent = `第 ${wave} 波：Solar Flare`;
    statusTextEl.textContent = '陽光掉落變快，向日葵會多噴一點資源。';
  } else if (state?.modifier === 'fog') {
    statusTitleEl.textContent = `第 ${wave} 波：Iron Fog`;
    statusTextEl.textContent = '陽光變慢，向日葵更貴，重輸出與擋線要算準。';
  } else if (state?.modifier === 'bloodmoon') {
    statusTitleEl.textContent = `第 ${wave} 波：Blood Moon`;
    statusTextEl.textContent = '殭屍加速，但擊殺回更多陽光，撐住就能反打。';
  } else {
    statusTitleEl.textContent = `第 ${wave} 波：穩住節奏`;
    statusTextEl.textContent = wave < 3 ? '先把前兩排經濟和輸出鋪起來。' : '觀察冷卻、補線，不要讓單一路崩掉。';
  }
}
