// Main application controller
(function () {
  const socket = io();
  let gameMode = null; // 'ai' or 'multiplayer'
  let shipPlacement = null;
  let gameUI = new GameUI();
  let mySocketId = null;

  socket.on('connect', () => {
    mySocketId = socket.id;
  });

  // ---------- SCREEN MANAGEMENT ----------
  function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(screenId).classList.add('active');
  }

  // ---------- MAIN MENU ----------
  document.getElementById('btn-vs-ai').addEventListener('click', () => {
    gameMode = 'ai';
    socket.emit('ai:start');
    showScreen('placement-screen');
    initPlacement();
  });

  document.getElementById('btn-multiplayer').addEventListener('click', () => {
    gameMode = 'multiplayer';
    showScreen('lobby-screen');
  });

  // ---------- MULTIPLAYER LOBBY ----------
  document.getElementById('btn-create-room').addEventListener('click', () => {
    socket.emit('mp:create');
  });

  document.getElementById('btn-join-room').addEventListener('click', () => {
    const code = document.getElementById('room-code-input').value.trim();
    if (code.length < 4) {
      document.getElementById('lobby-status').textContent = 'Please enter a valid room code';
      return;
    }
    socket.emit('mp:join', { code });
  });

  document.getElementById('btn-lobby-back').addEventListener('click', () => {
    showScreen('menu-screen');
  });

  socket.on('mp:created', ({ code }) => {
    document.getElementById('lobby-status').textContent = `Room created! Code: ${code} — Waiting for opponent...`;
  });

  socket.on('mp:joined', ({ players }) => {
    if (players.length === 2) {
      document.getElementById('lobby-status').textContent = 'Opponent joined! Preparing fleet...';
      setTimeout(() => {
        showScreen('placement-screen');
        initPlacement();
      }, 1000);
    }
  });

  socket.on('mp:error', ({ message }) => {
    document.getElementById('lobby-status').textContent = message;
  });

  // ---------- SHIP PLACEMENT ----------
  function initPlacement() {
    const readyBtn = document.getElementById('btn-ready');
    readyBtn.disabled = true;

    if (shipPlacement) shipPlacement.destroy();

    shipPlacement = new ShipPlacement('placement-board', 'dock-ships', (allPlaced) => {
      readyBtn.disabled = !allPlaced;
    });

    document.getElementById('btn-random-placement').onclick = () => shipPlacement.randomize();
    document.getElementById('btn-reset-placement').onclick = () => shipPlacement.reset();
  }

  document.getElementById('btn-ready').addEventListener('click', () => {
    const placement = shipPlacement.getPlacement();
    if (placement.length !== 5) return;

    if (gameMode === 'ai') {
      socket.emit('ai:placeShips', placement);
      document.getElementById('placement-status').textContent = 'Ships deployed! Starting battle...';
    } else {
      socket.emit('mp:placeShips', { ships: placement });
      document.getElementById('placement-status').textContent = 'Ships deployed! Waiting for opponent...';
    }
  });

  // ---------- AI GAME ----------
  socket.on('ai:ready', () => {
    // Placement screen already shown
  });

  socket.on('ai:gameStart', ({ turn }) => {
    const placement = shipPlacement.getPlacement();
    showScreen('game-screen');
    gameUI = new GameUI();
    gameUI.initGameBoards(placement, (row, col) => {
      socket.emit('ai:attack', { row, col });
      gameUI.setTurn(false);
    });
    gameUI.setTurn(true);
  });

  socket.on('ai:attackResult', (result) => {
    const isPlayerAttack = result.attacker === 'player';
    gameUI.handleAttackResult(result, isPlayerAttack);

    if (!result.gameOver) {
      if (isPlayerAttack) {
        gameUI.setTurn(false);
      } else {
        gameUI.setTurn(true);
      }
    }
  });

  socket.on('ai:gameOver', ({ winner }) => {
    gameUI.showGameOver(winner === 'player');
    showScreen('gameover-screen');
  });

  // ---------- MULTIPLAYER GAME ----------
  socket.on('mp:shipsPlaced', () => {
    document.getElementById('placement-status').textContent = 'Waiting for opponent to deploy fleet...';
  });

  socket.on('mp:gameStart', ({ turn }) => {
    const placement = shipPlacement.getPlacement();
    showScreen('game-screen');
    gameUI = new GameUI();
    gameUI.initGameBoards(placement, (row, col) => {
      socket.emit('mp:attack', { row, col });
    });
    gameUI.setTurn(turn === mySocketId);
  });

  socket.on('mp:attackResult', (result) => {
    const isPlayerAttack = result.attacker === mySocketId;
    gameUI.handleAttackResult(result, isPlayerAttack);
  });

  socket.on('mp:turnChange', ({ turn }) => {
    gameUI.setTurn(turn === mySocketId);
  });

  socket.on('mp:gameOver', ({ winner }) => {
    gameUI.showGameOver(winner === mySocketId);
    showScreen('gameover-screen');
  });

  socket.on('mp:opponentLeft', () => {
    gameUI.addLog('Opponent disconnected!', 'sunk');
    gameUI.showGameOver(true);
    showScreen('gameover-screen');
    document.getElementById('gameover-message').textContent = 'Your opponent left the battle. Victory by default!';
  });

  // ---------- GAME OVER ----------
  document.getElementById('btn-play-again').addEventListener('click', () => {
    showScreen('menu-screen');
  });

  document.getElementById('btn-main-menu').addEventListener('click', () => {
    showScreen('menu-screen');
  });
})();
