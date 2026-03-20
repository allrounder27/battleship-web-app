// Game UI manager
class GameUI {
  constructor() {
    this.playerSunkShips = [];
    this.enemySunkShips = [];
    this.myTurn = false;
    this.gameActive = false;
  }

  initGameBoards(shipPlacements, onTargetClick) {
    this.playerSunkShips = [];
    this.enemySunkShips = [];
    this.gameActive = true;

    // Render player board with ships
    createBoardDOM('player-board');
    for (const ship of shipPlacements) {
      for (let i = 0; i < ship.size; i++) {
        const r = ship.horizontal ? ship.row : ship.row + i;
        const c = ship.horizontal ? ship.col + i : ship.col;
        setCellState('player-board', r, c, 'ship');
      }
    }

    // Render target (enemy) board
    createBoardDOM('target-board', (row, col) => {
      if (!this.myTurn || !this.gameActive) return;
      onTargetClick(row, col);
    });

    // Ship status
    renderShipStatus('player-ship-status', SHIPS_CONFIG, this.playerSunkShips);
    renderShipStatus('enemy-ship-status', SHIPS_CONFIG, this.enemySunkShips);

    // Clear log
    document.getElementById('game-log').innerHTML = '';
  }

  setTurn(isMyTurn) {
    this.myTurn = isMyTurn;
    const indicator = document.getElementById('turn-indicator');
    if (isMyTurn) {
      indicator.textContent = '🎯 Your Turn — Fire!';
      indicator.className = 'turn-indicator your-turn';
    } else {
      indicator.textContent = '⏳ Enemy Turn — Brace!';
      indicator.className = 'turn-indicator enemy-turn';
    }
  }

  handleAttackResult(result, isPlayerAttack) {
    const { row, col, hit, sunkShip, sunkCells } = result;

    if (isPlayerAttack) {
      if (sunkShip && sunkCells) {
        sunkCells.forEach(c => setCellState('target-board', c.row, c.col, 'sunk'));
        this.enemySunkShips.push(sunkShip);
        renderShipStatus('enemy-ship-status', SHIPS_CONFIG, this.enemySunkShips);
        this.addLog(`💥 You sunk the enemy's ${sunkShip}!`, 'sunk');
        soundManager.playSunk();
      } else if (hit) {
        setCellState('target-board', row, col, 'hit');
        this.addLog(`🔥 Hit at ${COLS[col]}${row + 1}!`, 'hit');
        soundManager.playHit();
      } else {
        setCellState('target-board', row, col, 'miss');
        this.addLog(`💨 Miss at ${COLS[col]}${row + 1}`, 'miss');
        soundManager.playMiss();
      }
    } else {
      if (sunkShip && sunkCells) {
        sunkCells.forEach(c => setCellState('player-board', c.row, c.col, 'sunk'));
        this.playerSunkShips.push(sunkShip);
        renderShipStatus('player-ship-status', SHIPS_CONFIG, this.playerSunkShips);
        this.addLog(`💀 Enemy sunk your ${sunkShip}!`, 'sunk');
        soundManager.playSunk();
      } else if (hit) {
        setCellState('player-board', row, col, 'hit');
        this.addLog(`💣 Enemy hit at ${COLS[col]}${row + 1}!`, 'hit');
        soundManager.playHit();
      } else {
        setCellState('player-board', row, col, 'miss');
        this.addLog(`🌊 Enemy missed at ${COLS[col]}${row + 1}`, 'miss');
        soundManager.playMiss();
      }
    }
  }

  addLog(message, type) {
    const log = document.getElementById('game-log');
    const entry = document.createElement('div');
    entry.className = `log-entry log-${type || ''}`;
    entry.textContent = message;
    log.prepend(entry);
  }

  showGameOver(isWinner) {
    this.gameActive = false;
    const title = document.getElementById('gameover-title');
    const message = document.getElementById('gameover-message');
    const icon = document.getElementById('gameover-icon');

    if (isWinner) {
      icon.textContent = '🏆';
      title.textContent = 'Victory!';
      title.className = 'victory';
      message.textContent = 'You destroyed the enemy fleet! Admiral worthy performance!';
    } else {
      icon.textContent = '💀';
      title.textContent = 'Defeat';
      title.className = 'defeat';
      message.textContent = 'Your fleet has been destroyed. Better luck next time, sailor.';
    }
  }
}
