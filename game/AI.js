const { BOARD_SIZE, CELL, SHIPS } = require('./GameLogic');

class AI {
  constructor(difficulty = 'medium') {
    this.difficulty = difficulty; // 'easy', 'medium', 'hard'
    this.hitStack = [];
    this.attackedCells = new Set();
  }

  getMove(opponentBoard) {
    switch (this.difficulty) {
      case 'easy': return this._easyMove();
      case 'hard': return this._hardMove(opponentBoard);
      default: return this._mediumMove(opponentBoard);
    }
  }

  // Easy: pure random
  _easyMove() {
    const available = [];
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        if (!this.attackedCells.has(`${r},${c}`)) available.push({ row: r, col: c });
      }
    }
    if (available.length === 0) return null;
    const pick = available[Math.floor(Math.random() * available.length)];
    this.attackedCells.add(`${pick.row},${pick.col}`);
    return pick;
  }

  // Medium: hunt-target strategy
  _mediumMove(opponentBoard) {
    // Target mode
    while (this.hitStack.length > 0) {
      const target = this.hitStack.pop();
      const key = `${target.row},${target.col}`;
      if (!this.attackedCells.has(key) && target.row >= 0 && target.row < BOARD_SIZE && target.col >= 0 && target.col < BOARD_SIZE) {
        this.attackedCells.add(key);
        return target;
      }
    }
    // Hunt mode: checkerboard
    let attempts = 0;
    while (attempts < 200) {
      const row = Math.floor(Math.random() * BOARD_SIZE);
      const col = Math.floor(Math.random() * BOARD_SIZE);
      const key = `${row},${col}`;
      if (!this.attackedCells.has(key) && (row + col) % 2 === 0) {
        this.attackedCells.add(key);
        return { row, col };
      }
      attempts++;
    }
    // Fallback
    return this._easyMove();
  }

  // Hard: probability density map
  _hardMove(opponentBoard) {
    // If we have targets from hits, prioritize those
    while (this.hitStack.length > 0) {
      const target = this.hitStack.pop();
      const key = `${target.row},${target.col}`;
      if (!this.attackedCells.has(key) && target.row >= 0 && target.row < BOARD_SIZE && target.col >= 0 && target.col < BOARD_SIZE) {
        this.attackedCells.add(key);
        return target;
      }
    }

    // Build probability density map
    const density = Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(0));

    // Determine remaining ship sizes
    const remainingSizes = [];
    for (const ship of SHIPS) {
      // Check if this ship is NOT fully sunk by looking at the board
      // We don't have direct access to placements, so use ship sizes
      remainingSizes.push(ship.size);
    }

    // For each remaining ship size, count valid placements
    for (const size of remainingSizes) {
      // Horizontal
      for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c <= BOARD_SIZE - size; c++) {
          let valid = true;
          for (let i = 0; i < size; i++) {
            const key = `${r},${c + i}`;
            if (this.attackedCells.has(key)) {
              // Check if it was a miss (we track all attacks)
              if (opponentBoard[r][c + i] === CELL.MISS || opponentBoard[r][c + i] === CELL.SUNK) {
                valid = false;
                break;
              }
            }
          }
          if (valid) {
            for (let i = 0; i < size; i++) {
              if (!this.attackedCells.has(`${r},${c + i}`)) {
                density[r][c + i]++;
              }
            }
          }
        }
      }
      // Vertical
      for (let r = 0; r <= BOARD_SIZE - size; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
          let valid = true;
          for (let i = 0; i < size; i++) {
            const key = `${r + i},${c}`;
            if (this.attackedCells.has(key)) {
              if (opponentBoard[r + i][c] === CELL.MISS || opponentBoard[r + i][c] === CELL.SUNK) {
                valid = false;
                break;
              }
            }
          }
          if (valid) {
            for (let i = 0; i < size; i++) {
              if (!this.attackedCells.has(`${r + i},${c}`)) {
                density[r + i][c]++;
              }
            }
          }
        }
      }
    }

    // Pick cell with highest density
    let maxDensity = 0;
    let bestCells = [];
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        if (this.attackedCells.has(`${r},${c}`)) continue;
        if (density[r][c] > maxDensity) {
          maxDensity = density[r][c];
          bestCells = [{ row: r, col: c }];
        } else if (density[r][c] === maxDensity && maxDensity > 0) {
          bestCells.push({ row: r, col: c });
        }
      }
    }

    if (bestCells.length > 0) {
      const pick = bestCells[Math.floor(Math.random() * bestCells.length)];
      this.attackedCells.add(`${pick.row},${pick.col}`);
      return pick;
    }

    return this._easyMove();
  }

  registerHit(row, col) {
    const adjacents = [
      { row: row - 1, col },
      { row: row + 1, col },
      { row, col: col - 1 },
      { row, col: col + 1 }
    ];
    for (const adj of adjacents) {
      const key = `${adj.row},${adj.col}`;
      if (adj.row >= 0 && adj.row < BOARD_SIZE && adj.col >= 0 && adj.col < BOARD_SIZE && !this.attackedCells.has(key)) {
        this.hitStack.push(adj);
      }
    }
  }

  registerSunk() {
    this.hitStack = [];
  }
}

module.exports = { AI };
