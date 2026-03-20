const BOARD_SIZE = 10;

const SHIPS = [
  { name: 'Carrier', size: 5 },
  { name: 'Battleship', size: 4 },
  { name: 'Cruiser', size: 3 },
  { name: 'Submarine', size: 3 },
  { name: 'Destroyer', size: 2 }
];

const CELL = { EMPTY: 0, SHIP: 1, HIT: 2, MISS: 3, SUNK: 4 };

function createBoard() {
  return Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(CELL.EMPTY));
}

function canPlaceShip(board, row, col, size, horizontal) {
  for (let i = 0; i < size; i++) {
    const r = horizontal ? row : row + i;
    const c = horizontal ? col + i : col;
    if (r < 0 || r >= BOARD_SIZE || c < 0 || c >= BOARD_SIZE) return false;
    if (board[r][c] !== CELL.EMPTY) return false;
  }
  return true;
}

function placeShip(board, row, col, size, horizontal) {
  const cells = [];
  for (let i = 0; i < size; i++) {
    const r = horizontal ? row : row + i;
    const c = horizontal ? col + i : col;
    board[r][c] = CELL.SHIP;
    cells.push({ row: r, col: c });
  }
  return cells;
}

function placeShipsRandom(board) {
  const placements = [];
  for (const ship of SHIPS) {
    let placed = false;
    while (!placed) {
      const horizontal = Math.random() < 0.5;
      const row = Math.floor(Math.random() * BOARD_SIZE);
      const col = Math.floor(Math.random() * BOARD_SIZE);
      if (canPlaceShip(board, row, col, ship.size, horizontal)) {
        const cells = placeShip(board, row, col, ship.size, horizontal);
        placements.push({ name: ship.name, size: ship.size, cells, horizontal });
        placed = true;
      }
    }
  }
  return placements;
}

function processAttack(board, shipPlacements, row, col) {
  if (row < 0 || row >= BOARD_SIZE || col < 0 || col >= BOARD_SIZE) return null;
  if (board[row][col] === CELL.HIT || board[row][col] === CELL.MISS || board[row][col] === CELL.SUNK) return null;

  if (board[row][col] === CELL.SHIP) {
    board[row][col] = CELL.HIT;

    // Find which ship was hit
    let hitShipName = null;
    for (const ship of shipPlacements) {
      if (ship.cells.some(c => c.row === row && c.col === col)) {
        hitShipName = ship.name;
        break;
      }
    }

    const sunkShip = checkSunk(board, shipPlacements);
    const allSunk = shipPlacements.every(s => s.sunk);
    return {
      hit: true,
      row,
      col,
      hitShipName,
      sunkShip: sunkShip ? sunkShip.name : null,
      sunkCells: sunkShip ? sunkShip.cells : null,
      gameOver: allSunk
    };
  } else {
    board[row][col] = CELL.MISS;
    return { hit: false, row, col, hitShipName: null, sunkShip: null, sunkCells: null, gameOver: false };
  }
}

function checkSunk(board, shipPlacements) {
  for (const ship of shipPlacements) {
    if (ship.sunk) continue;
    const allHit = ship.cells.every(c => board[c.row][c.col] === CELL.HIT || board[c.row][c.col] === CELL.SUNK);
    if (allHit) {
      ship.sunk = true;
      ship.cells.forEach(c => { board[c.row][c.col] = CELL.SUNK; });
      return ship;
    }
  }
  return null;
}

module.exports = { BOARD_SIZE, SHIPS, CELL, createBoard, canPlaceShip, placeShip, placeShipsRandom, processAttack };
