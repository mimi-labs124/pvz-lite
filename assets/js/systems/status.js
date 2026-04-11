export function updateBattleStatus(state, els, kind = 'normal') {
  const { battleStatusEl, statusTitleEl, statusTextEl, modifierTagEl } = els;
  const wave = state?.wave ?? 1;
  const isBoss = state?.isBossWave;

  // 修飾器名稱
  let modifierName = '普通日';
  if (state?.chaosEvent) modifierName = `${state.chaosEvent.emoji} ${state.chaosEvent.name}`;
  else if (state?.modifier === 'solar') modifierName = '☀️ Solar Flare';
  else if (state?.modifier === 'fog') modifierName = '🌫️ Iron Fog';
  else if (state?.modifier === 'bloodmoon') modifierName = '🌙 Blood Moon';

  modifierTagEl.textContent = modifierName;
  modifierTagEl.className = `modifier-tag ${state?.chaosEvent ? 'chaos' : state?.modifier ?? 'normal'}`;

  battleStatusEl.classList.remove('alert', 'danger', 'solar', 'fog', 'bloodmoon', 'chaos', 'boss');
  if (state?.chaosEvent) battleStatusEl.classList.add('chaos');
  else if (state?.modifier === 'solar') battleStatusEl.classList.add('solar');
  else if (state?.modifier === 'fog') battleStatusEl.classList.add('fog');
  else if (state?.modifier === 'bloodmoon') battleStatusEl.classList.add('bloodmoon');
  if (isBoss) battleStatusEl.classList.add('boss');
  if (kind === 'danger') battleStatusEl.classList.add('danger');

  if (isBoss) {
    statusTitleEl.textContent = `⚠️ BOSS 波：第 ${wave} 波`;
    statusTextEl.textContent = '強大的 Boss 出現了！集中火力！';
  } else if (state?.chaosEvent) {
    statusTitleEl.textContent = `🌪️ ${state.chaosEvent.name}`;
    statusTextEl.textContent = state.chaosEvent.desc;
  } else if (kind === 'danger') {
    statusTitleEl.textContent = `第 ${wave} 波：撐住！`;
    statusTextEl.textContent = '殭屍密度提高了，先保住前排和經濟。';
  } else if (state?.modifier === 'solar') {
    statusTitleEl.textContent = `第 ${wave} 波：Solar Flare`;
    statusTextEl.textContent = '陽光掉落變快，把握經濟優勢！';
  } else if (state?.modifier === 'fog') {
    statusTitleEl.textContent = `第 ${wave} 波：Iron Fog`;
    statusTextEl.textContent = '陽光變慢，算準每一分資源。';
  } else if (state?.modifier === 'bloodmoon') {
    statusTitleEl.textContent = `第 ${wave} 波：Blood Moon`;
    statusTextEl.textContent = '殭屍加速，但擊殺回更多陽光。';
  } else {
    statusTitleEl.textContent = `第 ${wave} 波：穩住節奏`;
    statusTextEl.textContent = wave < 3 ? '先把經濟和輸出鋪起來。' : '觀察冷卻、補線，不要讓單一路崩掉。';
  }
}
