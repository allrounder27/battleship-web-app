// Board rendering utility
const COLS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];
const BOARD_SIZE = 10;
const SHIPS_CONFIG = [
  { name: 'Carrier', size: 5 },
  { name: 'Battleship', size: 4 },
  { name: 'Cruiser', size: 3 },
  { name: 'Submarine', size: 3 },
  { name: 'Destroyer', size: 2 }
];

function createBoardDOM(containerId, onClick) {
  const container = document.getElementById(containerId);
  container.innerHTML = '';

  // Corner
  const corner = document.createElement('div');
  corner.className = 'board-header corner';
  container.appendChild(corner);

  // Column headers
  for (let c = 0; c < BOARD_SIZE; c++) {
    const header = document.createElement('div');
    header.className = 'board-header';
    header.textContent = COLS[c];
    container.appendChild(header);
  }

  // Rows
  for (let r = 0; r < BOARD_SIZE; r++) {
    const rowHeader = document.createElement('div');
    rowHeader.className = 'board-header';
    rowHeader.textContent = r + 1;
    container.appendChild(rowHeader);

    for (let c = 0; c < BOARD_SIZE; c++) {
      const cell = document.createElement('div');
      cell.className = 'cell';
      cell.dataset.row = r;
      cell.dataset.col = c;
      if (onClick) {
        cell.addEventListener('click', () => onClick(r, c));
      }
      container.appendChild(cell);
    }
  }
}

function getCell(containerId, row, col) {
  const container = document.getElementById(containerId);
  return container.querySelector(`.cell[data-row="${row}"][data-col="${col}"]`);
}

function setCellState(containerId, row, col, state) {
  const cell = getCell(containerId, row, col);
  if (!cell) return;
  cell.classList.remove('ship', 'hit', 'miss', 'sunk', 'ship-preview', 'ship-preview-invalid');
  if (state) cell.classList.add(state);
}

function clearBoard(containerId) {
  const container = document.getElementById(containerId);
  const cells = container.querySelectorAll('.cell');
  cells.forEach(cell => {
    cell.classList.remove('ship', 'hit', 'miss', 'sunk', 'ship-preview', 'ship-preview-invalid');
  });
}

function renderShipStatus(containerId, ships, sunkShips) {
  const container = document.getElementById(containerId);
  container.innerHTML = '';
  for (const ship of ships) {
    const item = document.createElement('div');
    const isSunk = sunkShips.includes(ship.name);
    item.className = 'ship-status-item' + (isSunk ? ' sunk' : '');
    const dots = '■'.repeat(ship.size);
    item.innerHTML = `<span class="dot"></span><span class="ship-name">${ship.name}</span><span class="ship-dots">${dots}</span>`;
    container.appendChild(item);
  }
}
