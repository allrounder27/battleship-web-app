const { BOARD_SIZE, CELL } = require('./GameLogic');

class AI {
  constructor() {
    this.huntMode = false;
    this.hitStack = [];
    this.attackedCells = new Set();
  }

  getMove(opponentBoard) {
    let row, col;

    if (this.hitStack.length > 0) {
      // Target mode: try adjacent cells around hits
      while (this.hitStack.length > 0) {
        const target = this.hitStack.pop();
        row = target.row;
        col = target.col;
        const key = `${row},${col}`;
        if (!this.attackedCells.has(key) && row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE) {
          this.attackedCells.add(key);
          return { row, col };
        }
      }
    }

    // Hunt mode: random attack on a checkerboard pattern for efficiency
    let attempts = 0;
    do {
      row = Math.floor(Math.random() * BOARD_SIZE);
      col = Math.floor(Math.random() * BOARD_SIZE);
      attempts++;
      // Checkerboard pattern: only target cells where (row + col) is even
      if (attempts > 50) {
        // Fall back to any untried cell
        for (let r = 0; r < BOARD_SIZE; r++) {
          for (let c = 0; c < BOARD_SIZE; c++) {
            if (!this.attackedCells.has(`${r},${c}`)) {
              this.attackedCells.add(`${r},${c}`);
              return { row: r, col: c };
            }
          }
        }
      }
    } while (this.attackedCells.has(`${row},${col}`) || (row + col) % 2 !== 0);

    this.attackedCells.add(`${row},${col}`);
    return { row, col };
  }

  registerHit(row, col) {
    // Add adjacent cells to hunt stack
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
    // Clear the hit stack when a ship is sunk to go back to hunt mode
    this.hitStack = [];
  }
}

module.exports = { AI };
