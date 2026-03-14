export function getCellEl(boardEl, r, c) {
  return boardEl.children[r]?.children[c];
}

export function makeBoard(boardEl, rows, cols, onPlace) {
  boardEl.innerHTML = '';
  for (let r = 0; r < rows; r++) {
    const lane = document.createElement('div');
    lane.className = 'lane';
    for (let c = 0; c < cols; c++) {
      const cell = document.createElement('div');
      cell.className = 'cell';
      cell.dataset.row = r;
      cell.dataset.col = c;
      cell.innerHTML = `<div class="coord">${r + 1}-${c + 1}</div>`;
      cell.addEventListener('click', () => onPlace(r, c));
      lane.appendChild(cell);
    }
    boardEl.appendChild(lane);
  }
}
