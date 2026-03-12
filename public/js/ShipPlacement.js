// Ship placement with drag-and-drop
class ShipPlacement {
  constructor(boardId, dockId, onAllPlaced) {
    this.boardId = boardId;
    this.dockId = dockId;
    this.onAllPlaced = onAllPlaced;
    this.ships = SHIPS_CONFIG.map(s => ({ ...s, placed: false, row: -1, col: -1, horizontal: true }));
    this.boardState = Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(null));
    this.currentDragShip = null;
    this.currentRotation = true; // true = horizontal
    this.init();
  }

  init() {
    this.renderDock();
    createBoardDOM(this.boardId);
    this.setupBoardEvents();
    this.setupKeyboardRotation();
  }

  renderDock() {
    const dock = document.getElementById(this.dockId);
    dock.innerHTML = '';
    for (let i = 0; i < this.ships.length; i++) {
      const ship = this.ships[i];
      const shipEl = document.createElement('div');
      shipEl.className = 'dock-ship' + (ship.placed ? ' placed' : '');
      shipEl.draggable = !ship.placed;
      shipEl.dataset.index = i;

      const label = document.createElement('div');
      label.className = 'dock-ship-label';
      label.textContent = ship.name;
      shipEl.appendChild(label);

      for (let j = 0; j < ship.size; j++) {
        const cell = document.createElement('div');
        cell.className = 'dock-ship-cell';
        shipEl.appendChild(cell);
      }

      shipEl.addEventListener('dragstart', (e) => {
        this.currentDragShip = i;
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', i.toString());
      });

      // Right-click to rotate before placing
      shipEl.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        this.currentRotation = !this.currentRotation;
        this.showRotationHint();
      });

      dock.appendChild(shipEl);
    }
  }

  setupBoardEvents() {
    const board = document.getElementById(this.boardId);

    board.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      const cell = e.target.closest('.cell');
      if (cell && this.currentDragShip !== null) {
        const row = parseInt(cell.dataset.row);
        const col = parseInt(cell.dataset.col);
        this.showPreview(row, col, this.ships[this.currentDragShip].size, this.currentRotation);
      }
    });

    board.addEventListener('dragleave', (e) => {
      this.clearPreview();
    });

    board.addEventListener('drop', (e) => {
      e.preventDefault();
      const cell = e.target.closest('.cell');
      if (cell && this.currentDragShip !== null) {
        const row = parseInt(cell.dataset.row);
        const col = parseInt(cell.dataset.col);
        this.tryPlace(this.currentDragShip, row, col, this.currentRotation);
      }
      this.clearPreview();
      this.currentDragShip = null;
    });

    // Right-click on board to rotate
    board.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      this.currentRotation = !this.currentRotation;
      const cell = e.target.closest('.cell');
      if (cell && this.currentDragShip !== null) {
        const row = parseInt(cell.dataset.row);
        const col = parseInt(cell.dataset.col);
        this.showPreview(row, col, this.ships[this.currentDragShip].size, this.currentRotation);
      }
    });
  }

  setupKeyboardRotation() {
    this._keyHandler = (e) => {
      if (e.key === 'r' || e.key === 'R') {
        this.currentRotation = !this.currentRotation;
        this.showRotationHint();
      }
    };
    document.addEventListener('keydown', this._keyHandler);
  }

  destroy() {
    if (this._keyHandler) {
      document.removeEventListener('keydown', this._keyHandler);
    }
  }

  showRotationHint() {
    const status = document.getElementById('placement-status');
    if (status) {
      status.textContent = `Rotation: ${this.currentRotation ? 'Horizontal →' : 'Vertical ↓'}`;
      setTimeout(() => { if (status.textContent.startsWith('Rotation')) status.textContent = ''; }, 1500);
    }
  }

  showPreview(row, col, size, horizontal) {
    this.clearPreview();
    const valid = this.canPlace(row, col, size, horizontal);
    for (let i = 0; i < size; i++) {
      const r = horizontal ? row : row + i;
      const c = horizontal ? col + i : col;
      if (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE) {
        setCellState(this.boardId, r, c, valid ? 'ship-preview' : 'ship-preview-invalid');
      }
    }
  }

  clearPreview() {
    const container = document.getElementById(this.boardId);
    container.querySelectorAll('.ship-preview, .ship-preview-invalid').forEach(cell => {
      cell.classList.remove('ship-preview', 'ship-preview-invalid');
    });
  }

  canPlace(row, col, size, horizontal, excludeIndex = -1) {
    for (let i = 0; i < size; i++) {
      const r = horizontal ? row : row + i;
      const c = horizontal ? col + i : col;
      if (r < 0 || r >= BOARD_SIZE || c < 0 || c >= BOARD_SIZE) return false;
      if (this.boardState[r][c] !== null && this.boardState[r][c] !== excludeIndex) return false;
    }
    return true;
  }

  tryPlace(shipIndex, row, col, horizontal) {
    const ship = this.ships[shipIndex];

    // Remove previous placement
    if (ship.placed) {
      this.removeShipFromBoard(shipIndex);
    }

    if (!this.canPlace(row, col, ship.size, horizontal)) return false;

    // Place the ship
    for (let i = 0; i < ship.size; i++) {
      const r = horizontal ? row : row + i;
      const c = horizontal ? col + i : col;
      this.boardState[r][c] = shipIndex;
      setCellState(this.boardId, r, c, 'ship');
    }

    ship.placed = true;
    ship.row = row;
    ship.col = col;
    ship.horizontal = horizontal;

    this.renderDock();
    this.checkAllPlaced();
    return true;
  }

  removeShipFromBoard(shipIndex) {
    const ship = this.ships[shipIndex];
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        if (this.boardState[r][c] === shipIndex) {
          this.boardState[r][c] = null;
          setCellState(this.boardId, r, c, null);
        }
      }
    }
    ship.placed = false;
    ship.row = -1;
    ship.col = -1;
  }

  checkAllPlaced() {
    const allPlaced = this.ships.every(s => s.placed);
    this.onAllPlaced(allPlaced);
  }

  randomize() {
    // Clear all
    this.reset();

    for (let i = 0; i < this.ships.length; i++) {
      let placed = false;
      let attempts = 0;
      while (!placed && attempts < 1000) {
        const horizontal = Math.random() < 0.5;
        const row = Math.floor(Math.random() * BOARD_SIZE);
        const col = Math.floor(Math.random() * BOARD_SIZE);
        placed = this.tryPlace(i, row, col, horizontal);
        attempts++;
      }
    }
  }

  reset() {
    for (let i = 0; i < this.ships.length; i++) {
      this.removeShipFromBoard(i);
    }
    this.boardState = Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(null));
    clearBoard(this.boardId);
    this.renderDock();
    this.checkAllPlaced();
  }

  getPlacement() {
    return this.ships.filter(s => s.placed).map(s => ({
      name: s.name,
      size: s.size,
      row: s.row,
      col: s.col,
      horizontal: s.horizontal
    }));
  }
}
