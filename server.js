const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const { Room } = require('./game/Room');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

app.use(express.static(path.join(__dirname, 'public')));

// Store active rooms
const rooms = new Map();

io.on('connection', (socket) => {
  console.log(`Player connected: ${socket.id}`);

  // ---------- AI MODE ----------
  socket.on('ai:start', () => {
    const room = new Room('ai');
    room.addPlayer(socket.id);
    room.addPlayer('computer');
    rooms.set(socket.id, room);
    socket.emit('ai:ready');
  });

  socket.on('ai:placeShips', (ships) => {
    const room = rooms.get(socket.id);
    if (!room) return;
    room.placeShips(socket.id, ships);
    room.placeShipsRandom('computer');
    socket.emit('ai:gameStart', { turn: socket.id });
  });

  socket.on('ai:attack', ({ row, col }) => {
    const room = rooms.get(socket.id);
    if (!room) return;

    // Player attacks computer
    const result = room.attack(socket.id, 'computer', row, col);
    if (!result) return;
    socket.emit('ai:attackResult', { ...result, attacker: 'player' });

    if (result.gameOver) {
      socket.emit('ai:gameOver', { winner: 'player' });
      rooms.delete(socket.id);
      return;
    }

    // Computer attacks player
    setTimeout(() => {
      const aiMove = room.getAIMove(socket.id);
      if (!aiMove) return;
      const aiResult = room.attack('computer', socket.id, aiMove.row, aiMove.col);
      if (!aiResult) return;
      room.registerAIResult(aiResult);
      socket.emit('ai:attackResult', { ...aiResult, attacker: 'computer', row: aiMove.row, col: aiMove.col });

      if (aiResult.gameOver) {
        socket.emit('ai:gameOver', { winner: 'computer' });
        rooms.delete(socket.id);
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

    if (!room) {
      socket.emit('mp:error', { message: 'Room not found' });
      return;
    }
    if (room.players.length >= 2) {
      socket.emit('mp:error', { message: 'Room is full' });
      return;
    }

    room.addPlayer(socket.id);
    socket.join(normalizedCode);
    socket.roomCode = normalizedCode;
    io.to(normalizedCode).emit('mp:joined', { players: room.players });
  });

  socket.on('mp:placeShips', ({ ships }) => {
    const code = socket.roomCode;
    if (!code) return;
    const room = rooms.get(code);
    if (!room) return;

    room.placeShips(socket.id, ships);
    socket.emit('mp:shipsPlaced');

    if (room.allShipsPlaced()) {
      const firstPlayer = room.players[Math.floor(Math.random() * 2)];
      room.currentTurn = firstPlayer;
      io.to(code).emit('mp:gameStart', { turn: firstPlayer });
    }
  });

  socket.on('mp:attack', ({ row, col }) => {
    const code = socket.roomCode;
    if (!code) return;
    const room = rooms.get(code);
    if (!room) return;

    if (room.currentTurn !== socket.id) {
      socket.emit('mp:error', { message: 'Not your turn' });
      return;
    }

    const opponent = room.getOpponent(socket.id);
    const result = room.attack(socket.id, opponent, row, col);
    if (!result) return;

    io.to(code).emit('mp:attackResult', {
      ...result,
      attacker: socket.id,
      row,
      col
    });

    if (result.gameOver) {
      io.to(code).emit('mp:gameOver', { winner: socket.id });
      rooms.delete(code);
      return;
    }

    room.currentTurn = opponent;
    io.to(code).emit('mp:turnChange', { turn: opponent });
  });

  // ---------- DISCONNECT ----------
  socket.on('disconnect', () => {
    console.log(`Player disconnected: ${socket.id}`);

    // Clean up AI rooms
    if (rooms.has(socket.id)) {
      rooms.delete(socket.id);
    }

    // Clean up multiplayer rooms
    if (socket.roomCode) {
      const room = rooms.get(socket.roomCode);
      if (room) {
        io.to(socket.roomCode).emit('mp:opponentLeft');
        rooms.delete(socket.roomCode);
      }
    }
  });
});

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    const randomBytes = require('crypto').randomBytes(1);
    code += chars[randomBytes[0] % chars.length];
  }
  // Ensure uniqueness
  if (rooms.has(code)) return generateRoomCode();
  return code;
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Battleship server running on port ${PORT}`);
});
