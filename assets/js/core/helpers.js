export function cellKey(r, c) {
  return `${r}-${c}`;
}

export function flash(el) {
  el.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.12)' }, { transform: 'scale(1)' }], { duration: 320 });
}
