// Main application controller
(function () {
  const socket = io();
  let gameMode = null;
  let aiDifficulty = 'medium';
  let shipPlacement = null;
  let gameUI = new GameUI();
  let mySocketId = null;

  socket.on('connect', () => { mySocketId = socket.id; });

  // ---------- THEME TOGGLE ----------
  const themeBtn = document.getElementById('btn-theme-toggle');
  themeBtn.addEventListener('click', () => {
    const html = document.documentElement;
    const isDark = html.getAttribute('data-theme') === 'dark';
    html.setAttribute('data-theme', isDark ? 'light' : 'dark');
    themeBtn.textContent = isDark ? '☀️' : '🌙';
  });

  // ---------- SCREEN MANAGEMENT ----------
  function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(screenId).classList.add('active');
  }

  // ---------- MAIN MENU ----------
  document.getElementById('btn-vs-ai').addEventListener('click', () => {
    gameMode = 'ai';
    showScreen('difficulty-screen');
  });

  document.getElementById('btn-multiplayer').addEventListener('click', () => {
    gameMode = 'multiplayer';
    showScreen('lobby-screen');
  });

  // ---------- DIFFICULTY SELECT ----------
  document.querySelectorAll('.diff-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      aiDifficulty = btn.dataset.diff;
      socket.emit('ai:start', { difficulty: aiDifficulty });
      showScreen('placement-screen');
      initPlacement();
    });
  });
  document.getElementById('btn-diff-back').addEventListener('click', () => showScreen('menu-screen'));

  // ---------- MULTIPLAYER LOBBY ----------
  document.getElementById('btn-create-room').addEventListener('click', () => socket.emit('mp:create'));

  document.getElementById('btn-join-room').addEventListener('click', () => {
    const code = document.getElementById('room-code-input').value.trim();
    if (code.length < 4) {
      document.getElementById('lobby-status').textContent = 'Please enter a valid room code';
      return;
    }
    socket.emit('mp:join', { code });
  });

  document.getElementById('btn-lobby-back').addEventListener('click', () => showScreen('menu-screen'));

  socket.on('mp:created', ({ code }) => {
    document.getElementById('lobby-status').innerHTML = `Room created! Code: <strong class="room-code">${code}</strong> — Waiting for opponent...`;
  });

  socket.on('mp:joined', ({ players }) => {
    if (players.length === 2) {
      document.getElementById('lobby-status').textContent = 'Opponent joined! Preparing fleet...';
      setTimeout(() => { showScreen('placement-screen'); initPlacement(); }, 1000);
    }
  });

  socket.on('mp:error', ({ message }) => {
    document.getElementById('lobby-status').textContent = message;
  });

  // ---------- SHIP PLACEMENT ----------
  function initPlacement() {
    const readyBtn = document.getElementById('btn-ready');
    readyBtn.disabled = true;
    document.getElementById('placement-status').textContent = '';
    if (shipPlacement) shipPlacement.destroy();
    shipPlacement = new ShipPlacement('placement-board', 'dock-ships', (allPlaced) => { readyBtn.disabled = !allPlaced; });
    document.getElementById('btn-random-placement').onclick = () => shipPlacement.randomize();
    document.getElementById('btn-reset-placement').onclick = () => shipPlacement.reset();
    document.getElementById('btn-rotate').onclick = () => shipPlacement.rotate();
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
  socket.on('ai:ready', () => { });

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
      gameUI.setTurn(!isPlayerAttack ? true : false);
    }
  });

  socket.on('ai:gameOver', (data) => {
    gameUI.showGameOver(data.winner === 'player', data);
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
    gameUI.handleAttackResult(result, result.attacker === mySocketId);
  });

  socket.on('mp:turnChange', ({ turn }) => {
    gameUI.setTurn(turn === mySocketId);
  });

  socket.on('mp:timerStart', ({ timeLimit }) => {
    gameUI.startTimer(timeLimit);
  });

  socket.on('mp:gameOver', (data) => {
    const isWinner = data.winner === mySocketId;
    const opponentId = isWinner ? Object.keys(data.ships).find(k => k !== mySocketId) : data.winner;
    const goData = {
      opponentShips: data.ships ? data.ships[opponentId] : null,
      stats: data.stats ? data.stats[mySocketId] : null
    };
    gameUI.showGameOver(isWinner, goData);
    showScreen('gameover-screen');
  });

  socket.on('mp:opponentLeft', () => {
    gameUI.addLog('Opponent disconnected!', 'sunk');
    gameUI.showGameOver(true, {});
    showScreen('gameover-screen');
    document.getElementById('gameover-message').textContent = 'Your opponent left. Victory by default!';
  });

  // ---------- REMATCH ----------
  socket.on('mp:rematchWaiting', () => {
    document.getElementById('gameover-message').textContent = 'Waiting for opponent to accept rematch...';
  });
  socket.on('mp:rematchRequested', () => {
    document.getElementById('gameover-message').textContent = 'Opponent wants a rematch! Click Play Again.';
  });
  socket.on('mp:rematchReady', () => { showScreen('placement-screen'); initPlacement(); });

  // ---------- GAME OVER BUTTONS ----------
  document.getElementById('btn-play-again').addEventListener('click', () => {
    if (gameMode === 'ai') {
      socket.emit('ai:restart', { difficulty: aiDifficulty });
      showScreen('placement-screen');
      initPlacement();
    } else {
      socket.emit('mp:restart');
    }
  });

  document.getElementById('btn-main-menu').addEventListener('click', () => showScreen('menu-screen'));
})();
