const { createBoard, placeShip, placeShipsRandom, processAttack, canPlaceShip, SHIPS } = require('./GameLogic');
const { AI } = require('./AI');

class Room {
  constructor(mode) {
    this.mode = mode; // 'ai' or 'multiplayer'
    this.players = [];
    this.boards = {};
    this.shipPlacements = {};
    this.currentTurn = null;
    this.ai = mode === 'ai' ? new AI() : null;
  }

  addPlayer(playerId) {
    this.players.push(playerId);
    this.boards[playerId] = createBoard();
    this.shipPlacements[playerId] = [];
  }

  placeShips(playerId, ships) {
    const board = this.boards[playerId];
    // Reset the board
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

    if (result && result.hit && this.ai && attackerId === 'computer') {
      // Don't register AI hits here; AI registers in getAIMove
    }

    return result;
  }

  getAIMove(humanPlayerId) {
    if (!this.ai) return null;
    const move = this.ai.getMove(this.boards[humanPlayerId]);
    return move;
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

  resetForRematch() {
    for (const id of this.players) {
      this.boards[id] = createBoard();
      this.shipPlacements[id] = [];
    }
    this.currentTurn = null;
    if (this.ai) {
      this.ai = new (require('./AI').AI)();
    }
  }
}

module.exports = { Room };
