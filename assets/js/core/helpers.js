export function cellKey(r, c) { return `${r}-${c}`; }

export function flash(el) {
  el.style.transition = 'none';
  el.style.outline = '2px solid #ef4444';
  requestAnimationFrame(() => {
    el.style.transition = 'outline 0.5s';
    el.style.outline = '';
  });
}

export function randomPick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
