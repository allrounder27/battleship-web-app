// Game UI manager
class GameUI {
  constructor() {
    this.playerSunkShips = [];
    this.enemySunkShips = [];
    this.myTurn = false;
    this.gameActive = false;
    this.playerShipPlacements = [];
    this.stats = { shots: 0, hits: 0 };
    this.timerInterval = null;
  }

  initGameBoards(shipPlacements, onTargetClick) {
    this.playerSunkShips = [];
    this.enemySunkShips = [];
    this.gameActive = true;
    this.playerShipPlacements = shipPlacements;
    this.stats = { shots: 0, hits: 0 };

    // Player board with ship silhouettes
    createBoardDOM('player-board');
    for (const ship of shipPlacements) {
      for (let i = 0; i < ship.size; i++) {
        const r = ship.horizontal ? ship.row : ship.row + i;
        const c = ship.horizontal ? ship.col + i : ship.col;
        const cell = getCell('player-board', r, c);
        if (cell) {
          cell.classList.add('ship', 'ship-silhouette');
          cell.dataset.shipName = ship.name;
          // Mark first cell of ship with a subtle label
          if (i === 0) cell.dataset.shipFirst = ship.name[0];
        }
      }
    }

    // Target board
    createBoardDOM('target-board', (row, col) => {
      if (!this.myTurn || !this.gameActive) return;
      onTargetClick(row, col);
    });

    renderShipStatus('player-ship-status', SHIPS_CONFIG, this.playerSunkShips);
    renderShipStatus('enemy-ship-status', SHIPS_CONFIG, this.enemySunkShips);
    this.updateScoreboard();

    document.getElementById('game-log').innerHTML = '';
  }

  updateScoreboard() {
    const el = document.getElementById('scoreboard');
    const hitRate = this.stats.shots > 0 ? Math.round((this.stats.hits / this.stats.shots) * 100) : 0;
    const enemyRemaining = 5 - this.enemySunkShips.length;
    const myRemaining = 5 - this.playerSunkShips.length;
    el.innerHTML = `<span>Shots: ${this.stats.shots}</span><span>Accuracy: ${hitRate}%</span><span>Enemy Ships: ${enemyRemaining}/5</span><span>Your Ships: ${myRemaining}/5</span>`;
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

  startTimer(timeLimit) {
    this.stopTimer();
    const bar = document.getElementById('timer-bar');
    const container = document.getElementById('turn-timer');
    container.classList.remove('hidden');

    const startTime = Date.now();
    bar.style.width = '100%';
    bar.className = 'timer-bar';

    this.timerInterval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const pct = Math.max(0, 1 - elapsed / timeLimit) * 100;
      bar.style.width = pct + '%';
      if (pct < 30) bar.className = 'timer-bar timer-danger';
      else if (pct < 60) bar.className = 'timer-bar timer-warning';
      if (pct <= 0) this.stopTimer();
    }, 50);
  }

  stopTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
    const container = document.getElementById('turn-timer');
    if (container) container.classList.add('hidden');
  }

  handleAttackResult(result, isPlayerAttack) {
    const { row, col, hit, hitShipName, sunkShip, sunkCells } = result;

    if (isPlayerAttack) {
      this.stats.shots++;
      if (hit) this.stats.hits++;

      if (sunkShip && sunkCells) {
        sunkCells.forEach(c => {
          setCellState('target-board', c.row, c.col, 'sunk');
          this._addSunkParticle('target-board', c.row, c.col);
        });
        this.enemySunkShips.push(sunkShip);
        renderShipStatus('enemy-ship-status', SHIPS_CONFIG, this.enemySunkShips);
        this.addLog(`💥 You sunk the enemy's ${sunkShip}!`, 'sunk');
        soundManager.playSunk();
      } else if (hit) {
        setCellState('target-board', row, col, 'hit');
        this._addHitParticle('target-board', row, col);
        const shipInfo = hitShipName ? ` (${hitShipName})` : '';
        this.addLog(`🔥 Hit at ${COLS[col]}${row + 1}${shipInfo}!`, 'hit');
        soundManager.playHit();
      } else {
        setCellState('target-board', row, col, 'miss');
        this.addLog(`💨 Miss at ${COLS[col]}${row + 1}`, 'miss');
        soundManager.playMiss();
      }
    } else {
      if (sunkShip && sunkCells) {
        sunkCells.forEach(c => {
          setCellState('player-board', c.row, c.col, 'sunk');
          this._addSunkParticle('player-board', c.row, c.col);
        });
        this.playerSunkShips.push(sunkShip);
        renderShipStatus('player-ship-status', SHIPS_CONFIG, this.playerSunkShips);
        this.addLog(`💀 Enemy sunk your ${sunkShip}!`, 'sunk');
        soundManager.playSunk();
      } else if (hit) {
        setCellState('player-board', row, col, 'hit');
        this._addHitParticle('player-board', row, col);
        const shipInfo = hitShipName ? ` (${hitShipName})` : '';
        this.addLog(`💣 Enemy hit at ${COLS[col]}${row + 1}${shipInfo}!`, 'hit');
        soundManager.playHit();
      } else {
        setCellState('player-board', row, col, 'miss');
        this.addLog(`🌊 Enemy missed at ${COLS[col]}${row + 1}`, 'miss');
        soundManager.playMiss();
      }
    }

    if (result.autoFired) {
      this.addLog('⏰ Time ran out — auto-fired!', 'miss');
    }

    this.updateScoreboard();
  }

  _addHitParticle(boardId, row, col) {
    const cell = getCell(boardId, row, col);
    if (!cell) return;
    const particle = document.createElement('div');
    particle.className = 'hit-particle';
    cell.appendChild(particle);
    setTimeout(() => particle.remove(), 800);
  }

  _addSunkParticle(boardId, row, col) {
    const cell = getCell(boardId, row, col);
    if (!cell) return;
    const particle = document.createElement('div');
    particle.className = 'sunk-particle';
    cell.appendChild(particle);
    setTimeout(() => particle.remove(), 1200);
  }

  addLog(message, type) {
    const log = document.getElementById('game-log');
    const entry = document.createElement('div');
    entry.className = `log-entry log-${type || ''}`;
    entry.textContent = message;
    log.prepend(entry);
  }

  showGameOver(isWinner, data) {
    this.gameActive = false;
    this.stopTimer();

    const title = document.getElementById('gameover-title');
    const message = document.getElementById('gameover-message');
    const icon = document.getElementById('gameover-icon');
    const statsEl = document.getElementById('gameover-stats');

    if (isWinner) {
      icon.textContent = '🏆';
      title.textContent = 'Victory!';
      title.className = 'victory';
      message.textContent = 'You destroyed the enemy fleet!';
      soundManager.playVictory();
      confetti.launch();
    } else {
      icon.textContent = '💀';
      title.textContent = 'Defeat';
      title.className = 'defeat';
      message.textContent = 'Your fleet has been destroyed.';
    }

    // Stats
    const stats = data && data.stats ? data.stats : this.stats;
    const myStats = stats.shots !== undefined ? stats : (data && data.stats && data.stats[Object.keys(data.stats)[0]]) || this.stats;
    const hitRate = myStats.shots > 0 ? Math.round((myStats.hits / myStats.shots) * 100) : 0;
    statsEl.innerHTML = `<div class="stat-item"><span class="stat-val">${myStats.shots || this.stats.shots}</span><span class="stat-label">Shots</span></div><div class="stat-item"><span class="stat-val">${hitRate}%</span><span class="stat-label">Accuracy</span></div>`;

    // Show both boards
    if (data && data.opponentShips) {
      renderGameOverBoard('go-enemy-board', data.opponentShips);
    }
    // Show player board
    renderGameOverBoard('go-player-board', this.playerShipPlacements.map(s => ({
      ...s,
      cells: (() => {
        const cells = [];
        for (let i = 0; i < s.size; i++) {
          cells.push({ row: s.horizontal ? s.row : s.row + i, col: s.horizontal ? s.col + i : s.col });
        }
        return cells;
      })(),
      sunk: this.playerSunkShips.includes(s.name)
    })));
  }
}
