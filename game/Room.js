const { createBoard, placeShip, placeShipsRandom, processAttack, canPlaceShip, SHIPS } = require('./GameLogic');
const { AI } = require('./AI');

class Room {
  constructor(mode) {
    this.mode = mode;
    this.players = [];
    this.boards = {};
    this.shipPlacements = {};
    this.currentTurn = null;
    this.ai = null;
    this.aiDifficulty = 'medium';
    this.lastActivity = Date.now();
    this.turnTimer = null;
    this.turnTimeLimit = 15000; // 15 seconds
    // Stats
    this.stats = {};
  }

  addPlayer(playerId) {
    this.players.push(playerId);
    this.boards[playerId] = createBoard();
    this.shipPlacements[playerId] = [];
    this.stats[playerId] = { shots: 0, hits: 0 };
  }

  setAIDifficulty(difficulty) {
    this.aiDifficulty = difficulty;
    this.ai = new AI(difficulty);
  }

  placeShips(playerId, ships) {
    const board = this.boards[playerId];
    for (let r = 0; r < 10; r++) {
      for (let c = 0; c < 10; c++) {
        board[r][c] = 0;
      }
    }
    this.shipPlacements[playerId] = [];

    for (const ship of ships) {
      if (canPlaceShip(board, ship.row, ship.col, ship.size, ship.horizontal)) {
        const cells = placeShip(board, ship.row, ship.col, ship.size, ship.horizontal);
        this.shipPlacements[playerId].push({
          name: ship.name,
          size: ship.size,
          cells,
          horizontal: ship.horizontal,
          sunk: false
        });
      }
    }
    this.lastActivity = Date.now();
  }

  placeShipsRandom(playerId) {
    const board = this.boards[playerId];
    this.shipPlacements[playerId] = placeShipsRandom(board);
    this.shipPlacements[playerId].forEach(s => s.sunk = false);
  }

  attack(attackerId, defenderId, row, col) {
    const board = this.boards[defenderId];
    const placements = this.shipPlacements[defenderId];
    const result = processAttack(board, placements, row, col);
    if (result) {
      if (this.stats[attackerId]) {
        this.stats[attackerId].shots++;
        if (result.hit) this.stats[attackerId].hits++;
      }
    }
    this.lastActivity = Date.now();
    return result;
  }

  getAIMove(humanPlayerId) {
    if (!this.ai) return null;
    return this.ai.getMove(this.boards[humanPlayerId]);
  }

  registerAIResult(result) {
    if (!this.ai) return;
    if (result.hit) {
      if (result.sunkShip) {
        this.ai.registerSunk();
      } else {
        this.ai.registerHit(result.row, result.col);
      }
    }
  }

  getOpponent(playerId) {
    return this.players.find(p => p !== playerId);
  }

  allShipsPlaced() {
    return this.players.every(p => this.shipPlacements[p] && this.shipPlacements[p].length === 5);
  }

  getShipPlacements(playerId) {
    return (this.shipPlacements[playerId] || []).map(s => ({
      name: s.name,
      size: s.size,
      cells: s.cells,
      horizontal: s.horizontal,
      sunk: s.sunk
    }));
  }

  getStats(playerId) {
    return this.stats[playerId] || { shots: 0, hits: 0 };
  }

  resetForRematch() {
    for (const id of this.players) {
      this.boards[id] = createBoard();
      this.shipPlacements[id] = [];
      this.stats[id] = { shots: 0, hits: 0 };
    }
    this.currentTurn = null;
    if (this.ai) {
      this.ai = new AI(this.aiDifficulty);
    }
    this.lastActivity = Date.now();
  }

  isStale(maxAge = 30 * 60 * 1000) {
    return Date.now() - this.lastActivity > maxAge;
  }
}

module.exports = { Room };
