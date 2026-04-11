export const audioState = { sfxVolume: 0.7, unlocked: false };
let audioCtx = null;

export function ensureAudio() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  audioState.unlocked = true;
}

function beep(freq = 440, dur = 0.08, type = 'sine', gain = 0.05) {
  try {
    ensureAudio();
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.value = gain * audioState.sfxVolume;
    o.connect(g).connect(audioCtx.destination);
    o.start();
    g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + dur);
    o.stop(audioCtx.currentTime + dur);
  } catch {}
}

export function sfx(name) {
  if (!audioState.unlocked || audioState.sfxVolume <= 0) return;
  if (name === 'sun')       { beep(880, 0.05, 'triangle', 0.08); setTimeout(() => beep(1174, 0.08, 'triangle', 0.06), 40); }
  if (name === 'plant')     beep(420, 0.06, 'square', 0.05);
  if (name === 'pea')       beep(700, 0.03, 'square', 0.03);
  if (name === 'ice')       beep(560, 0.05, 'triangle', 0.04);
  if (name === 'hit')       beep(180, 0.06, 'sawtooth', 0.04);
  if (name === 'boom')      beep(130, 0.16, 'sawtooth', 0.08);
  if (name === 'mower')     beep(260, 0.08, 'square', 0.07);
  if (name === 'lose')      beep(180, 0.18, 'sawtooth', 0.07);
  if (name === 'win')       { beep(523, 0.08, 'triangle', 0.07); setTimeout(() => beep(659, 0.08, 'triangle', 0.07), 90); }
  if (name === 'draft')     { beep(660, 0.06, 'triangle', 0.06); setTimeout(() => beep(880, 0.08, 'triangle', 0.05), 60); }
  if (name === 'evolve')    { beep(440, 0.06, 'sine', 0.07); setTimeout(() => beep(660, 0.06, 'sine', 0.07), 80); setTimeout(() => beep(880, 0.1, 'sine', 0.06), 160); }
  if (name === 'spell')     { beep(880, 0.05, 'triangle', 0.06); setTimeout(() => beep(1320, 0.08, 'triangle', 0.05), 30); }
  if (name === 'chaos')     beep(200, 0.15, 'sawtooth', 0.06);
  if (name === 'boss')      { beep(220, 0.1, 'sawtooth', 0.08); setTimeout(() => beep(165, 0.15, 'sawtooth', 0.07), 100); }
}
