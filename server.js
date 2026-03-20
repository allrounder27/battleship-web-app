const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const { Room } = require('./game/Room');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.use(express.static(path.join(__dirname, 'public')));

// Health check endpoint
app.get('/health', (req, res) => res.json({ status: 'ok', uptime: process.uptime() }));

const rooms = new Map();
const TURN_TIME_LIMIT = 15000;

// Room expiry: clean stale rooms every 5 minutes
setInterval(() => {
  for (const [key, room] of rooms) {
    if (room.isStale()) {
      rooms.delete(key);
    }
  }
}, 5 * 60 * 1000);

// Validate attack coordinates
function validCoord(v) {
  return Number.isInteger(v) && v >= 0 && v < 10;
}

io.on('connection', (socket) => {
  // ---------- AI MODE ----------
  socket.on('ai:start', ({ difficulty } = {}) => {
    const d = ['easy', 'medium', 'hard'].includes(difficulty) ? difficulty : 'medium';
    const room = new Room('ai');
    room.addPlayer(socket.id);
    room.addPlayer('computer');
    room.setAIDifficulty(d);
    rooms.set(socket.id, room);
    socket.emit('ai:ready');
  });

  socket.on('ai:placeShips', (ships) => {
    const room = rooms.get(socket.id);
    if (!room || !Array.isArray(ships)) return;
    room.placeShips(socket.id, ships);
    room.placeShipsRandom('computer');
    socket.emit('ai:gameStart', { turn: socket.id });
  });

  socket.on('ai:attack', ({ row, col }) => {
    const room = rooms.get(socket.id);
    if (!room) return;
    if (!validCoord(row) || !validCoord(col)) return;

    const result = room.attack(socket.id, 'computer', row, col);
    if (!result) return;
    socket.emit('ai:attackResult', { ...result, attacker: 'player' });

    if (result.gameOver) {
      const computerShips = room.getShipPlacements('computer');
      const playerStats = room.getStats(socket.id);
      socket.emit('ai:gameOver', { winner: 'player', opponentShips: computerShips, stats: playerStats });
      return;
    }

    setTimeout(() => {
      const aiMove = room.getAIMove(socket.id);
      if (!aiMove) return;
      const aiResult = room.attack('computer', socket.id, aiMove.row, aiMove.col);
      if (!aiResult) return;
      room.registerAIResult(aiResult);
      socket.emit('ai:attackResult', { ...aiResult, attacker: 'computer', row: aiMove.row, col: aiMove.col });

      if (aiResult.gameOver) {
        const computerShips = room.getShipPlacements('computer');
        const playerStats = room.getStats(socket.id);
        socket.emit('ai:gameOver', { winner: 'computer', opponentShips: computerShips, stats: playerStats });
      }
    }, 600);
  });

  // ---------- MULTIPLAYER MODE ----------
  socket.on('mp:create', () => {
    const code = generateRoomCode();
    const room = new Room('multiplayer');
    room.addPlayer(socket.id);
    rooms.set(code, room);
    socket.join(code);
    socket.roomCode = code;
    socket.emit('mp:created', { code });
  });

  socket.on('mp:join', ({ code }) => {
    const normalizedCode = (code || '').toUpperCase().trim();
    const room = rooms.get(normalizedCode);
    if (!room) return socket.emit('mp:error', { message: 'Room not found' });
    if (room.players.length >= 2) return socket.emit('mp:error', { message: 'Room is full' });

    room.addPlayer(socket.id);
    socket.join(normalizedCode);
    socket.roomCode = normalizedCode;
    io.to(normalizedCode).emit('mp:joined', { players: room.players });
  });

  socket.on('mp:placeShips', ({ ships }) => {
    const code = socket.roomCode;
    if (!code) return;
    const room = rooms.get(code);
    if (!room || !Array.isArray(ships)) return;

    room.placeShips(socket.id, ships);
    socket.emit('mp:shipsPlaced');

    if (room.allShipsPlaced()) {
      const firstPlayer = room.players[Math.floor(Math.random() * 2)];
      room.currentTurn = firstPlayer;
      io.to(code).emit('mp:gameStart', { turn: firstPlayer });
      startTurnTimer(code, room);
    }
  });

  socket.on('mp:attack', ({ row, col }) => {
    const code = socket.roomCode;
    if (!code) return;
    const room = rooms.get(code);
    if (!room) return;
    if (room.currentTurn !== socket.id) return;
    if (!validCoord(row) || !validCoord(col)) return;

    clearTurnTimer(room);

    const opponent = room.getOpponent(socket.id);
    const result = room.attack(socket.id, opponent, row, col);
    if (!result) return;

    io.to(code).emit('mp:attackResult', { ...result, attacker: socket.id, row, col });

    if (result.gameOver) {
      const opponentShips = room.getShipPlacements(opponent);
      const attackerShips = room.getShipPlacements(socket.id);
      io.to(code).emit('mp:gameOver', {
        winner: socket.id,
        ships: { [socket.id]: attackerShips, [opponent]: opponentShips },
        stats: { [socket.id]: room.getStats(socket.id), [opponent]: room.getStats(opponent) }
      });
      return;
    }

    room.currentTurn = opponent;
    io.to(code).emit('mp:turnChange', { turn: opponent });
    startTurnTimer(code, room);
  });

  // ---------- REMATCH ----------
  socket.on('ai:restart', ({ difficulty } = {}) => {
    const room = rooms.get(socket.id);
    if (!room) return;
    if (['easy', 'medium', 'hard'].includes(difficulty)) {
      room.aiDifficulty = difficulty;
    }
    room.resetForRematch();
    socket.emit('ai:ready');
  });

  socket.on('mp:restart', () => {
    const code = socket.roomCode;
    if (!code) return;
    const room = rooms.get(code);
    if (!room) return;
    if (!room.rematchVotes) room.rematchVotes = new Set();
    room.rematchVotes.add(socket.id);
    if (room.rematchVotes.size === 2) {
      room.resetForRematch();
      room.rematchVotes = new Set();
      io.to(code).emit('mp:rematchReady');
    } else {
      socket.emit('mp:rematchWaiting');
      const opponent = room.getOpponent(socket.id);
      io.to(opponent).emit('mp:rematchRequested');
    }
  });

  // ---------- DISCONNECT ----------
  socket.on('disconnect', () => {
    // AI rooms
    if (rooms.has(socket.id)) {
      rooms.delete(socket.id);
    }
    // Multiplayer rooms
    if (socket.roomCode) {
      const room = rooms.get(socket.roomCode);
      if (room) {
        clearTurnTimer(room);
        io.to(socket.roomCode).emit('mp:opponentLeft');
        rooms.delete(socket.roomCode);
      }
    }
  });
});

// ---------- TURN TIMER ----------
function startTurnTimer(code, room) {
  clearTurnTimer(room);
  io.to(code).emit('mp:timerStart', { timeLimit: TURN_TIME_LIMIT });

  room.turnTimer = setTimeout(() => {
    if (!room.currentTurn) return;
    // Auto-fire a random valid shot for the timed-out player
    const currentPlayer = room.currentTurn;
    const opponent = room.getOpponent(currentPlayer);
    const board = room.boards[opponent];

    // Find a random untouched cell
    const available = [];
    for (let r = 0; r < 10; r++) {
      for (let c = 0; c < 10; c++) {
        if (board[r][c] === 0 || board[r][c] === 1) available.push({ row: r, col: c });
      }
    }
    if (available.length === 0) return;
    const pick = available[Math.floor(Math.random() * available.length)];
    const result = room.attack(currentPlayer, opponent, pick.row, pick.col);
    if (!result) return;

    io.to(code).emit('mp:attackResult', { ...result, attacker: currentPlayer, row: pick.row, col: pick.col, autoFired: true });

    if (result.gameOver) {
      const opponentShips = room.getShipPlacements(opponent);
      const attackerShips = room.getShipPlacements(currentPlayer);
      io.to(code).emit('mp:gameOver', {
        winner: currentPlayer,
        ships: { [currentPlayer]: attackerShips, [opponent]: opponentShips },
        stats: { [currentPlayer]: room.getStats(currentPlayer), [opponent]: room.getStats(opponent) }
      });
      return;
    }

    room.currentTurn = opponent;
    io.to(code).emit('mp:turnChange', { turn: opponent });
    startTurnTimer(code, room);
  }, TURN_TIME_LIMIT);
}

function clearTurnTimer(room) {
  if (room.turnTimer) {
    clearTimeout(room.turnTimer);
    room.turnTimer = null;
  }
}

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    const randomBytes = require('crypto').randomBytes(1);
    code += chars[randomBytes[0] % chars.length];
  }
  if (rooms.has(code)) return generateRoomCode();
  return code;
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Battleship server running on port ${PORT}`);
});
