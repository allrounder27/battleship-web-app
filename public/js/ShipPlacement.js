// Ship placement with drag-and-drop + touch support
class ShipPlacement {
  constructor(boardId, dockId, onAllPlaced) {
    this.boardId = boardId;
    this.dockId = dockId;
    this.onAllPlaced = onAllPlaced;
    this.ships = SHIPS_CONFIG.map(s => ({ ...s, placed: false, row: -1, col: -1, horizontal: true }));
    this.boardState = Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(null));
    this.currentDragShip = null;
    this.selectedShip = null; // For tap-to-place on mobile
    this.currentRotation = true; // true = horizontal
    this.dragOffset = 0; // Offset within the ship for centered preview
    this.init();
  }

  init() {
    this.renderDock();
    createBoardDOM(this.boardId);
    this.setupBoardEvents();
    this.setupKeyboardRotation();
    this.setupTouchPlacement();
  }

  renderDock() {
    const dock = document.getElementById(this.dockId);
    dock.innerHTML = '';
    for (let i = 0; i < this.ships.length; i++) {
      const ship = this.ships[i];
      const shipEl = document.createElement('div');
      shipEl.className = 'dock-ship' + (ship.placed ? ' placed' : '') +
        (this.selectedShip === i ? ' selected' : '');
      shipEl.draggable = !ship.placed;
      shipEl.dataset.index = i;

      const label = document.createElement('div');
      label.className = 'dock-ship-label';
      label.textContent = ship.name;
      shipEl.appendChild(label);

      for (let j = 0; j < ship.size; j++) {
        const cell = document.createElement('div');
        cell.className = 'dock-ship-cell';
        cell.dataset.cellIndex = j;
        shipEl.appendChild(cell);
      }

      // Drag start — calculate offset from mouse position to center the preview
      shipEl.addEventListener('dragstart', (e) => {
        this.currentDragShip = i;
        this.selectedShip = null;

        // Determine which cell within the ship was grabbed
        const clickedCell = e.target.closest('.dock-ship-cell');
        if (clickedCell) {
          this.dragOffset = parseInt(clickedCell.dataset.cellIndex) || 0;
        } else {
          this.dragOffset = Math.floor(ship.size / 2);
        }

        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', i.toString());

        // Create a minimal drag image (1x1 transparent pixel)
        const ghost = document.createElement('canvas');
        ghost.width = 1;
        ghost.height = 1;
        document.body.appendChild(ghost);
        e.dataTransfer.setDragImage(ghost, 0, 0);
        requestAnimationFrame(() => ghost.remove());
      });

      // Tap to select (mobile)
      shipEl.addEventListener('click', (e) => {
        if (ship.placed) return;
        this.selectedShip = (this.selectedShip === i) ? null : i;
        this.dragOffset = Math.floor(ship.size / 2);
        this.renderDock();
      });

      // Right-click to rotate
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
        const ship = this.ships[this.currentDragShip];
        const { adjRow, adjCol } = this._adjustForOffset(row, col, ship.size, this.currentRotation);
        this.showPreview(adjRow, adjCol, ship.size, this.currentRotation, this.currentDragShip);
      }
    });

    board.addEventListener('dragleave', (e) => {
      // Only clear if actually leaving the board
      const related = e.relatedTarget;
      if (!related || !board.contains(related)) {
        this.clearPreview();
      }
    });

    board.addEventListener('drop', (e) => {
      e.preventDefault();
      const cell = e.target.closest('.cell');
      if (cell && this.currentDragShip !== null) {
        const row = parseInt(cell.dataset.row);
        const col = parseInt(cell.dataset.col);
        const ship = this.ships[this.currentDragShip];
        const { adjRow, adjCol } = this._adjustForOffset(row, col, ship.size, this.currentRotation);
        this.tryPlace(this.currentDragShip, adjRow, adjCol, this.currentRotation);
      }
      this.clearPreview();
      this.currentDragShip = null;
    });

    // Right-click on board to rotate during drag
    board.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      this.currentRotation = !this.currentRotation;
      this.showRotationHint();
      const cell = e.target.closest('.cell');
      if (cell && this.currentDragShip !== null) {
        const row = parseInt(cell.dataset.row);
        const col = parseInt(cell.dataset.col);
        const ship = this.ships[this.currentDragShip];
        const { adjRow, adjCol } = this._adjustForOffset(row, col, ship.size, this.currentRotation);
        this.showPreview(adjRow, adjCol, ship.size, this.currentRotation, this.currentDragShip);
      }
    });
  }

  setupTouchPlacement() {
    const board = document.getElementById(this.boardId);

    // Tap on board cell to place selected ship (mobile)
    board.addEventListener('click', (e) => {
      if (this.selectedShip === null) return;
      const cell = e.target.closest('.cell');
      if (!cell) return;
      const row = parseInt(cell.dataset.row);
      const col = parseInt(cell.dataset.col);
      const ship = this.ships[this.selectedShip];
      const { adjRow, adjCol } = this._adjustForOffset(row, col, ship.size, this.currentRotation);
      if (this.tryPlace(this.selectedShip, adjRow, adjCol, this.currentRotation)) {
        this.selectedShip = null;
        this.renderDock();
      }
    });
  }

  _adjustForOffset(row, col, size, horizontal) {
    // Center the placement based on the drag offset
    if (horizontal) {
      return { adjRow: row, adjCol: Math.max(0, Math.min(col - this.dragOffset, BOARD_SIZE - size)) };
    } else {
      return { adjRow: Math.max(0, Math.min(row - this.dragOffset, BOARD_SIZE - size)), adjCol: col };
    }
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

  rotate() {
    this.currentRotation = !this.currentRotation;
    this.showRotationHint();
  }

  showRotationHint() {
    const status = document.getElementById('placement-status');
    if (status) {
      status.textContent = `Rotation: ${this.currentRotation ? 'Horizontal →' : 'Vertical ↓'}`;
      status.className = 'status-message info';
      setTimeout(() => {
        if (status.textContent.startsWith('Rotation')) {
          status.textContent = '';
          status.className = 'status-message';
        }
      }, 1500);
    }
  }

  showPreview(row, col, size, horizontal, shipIndex) {
    this.clearPreview();
    const valid = this.canPlace(row, col, size, horizontal, shipIndex);
    for (let i = 0; i < size; i++) {
      const r = horizontal ? row : row + i;
      const c = horizontal ? col + i : col;
      if (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE) {
        const cell = getCell(this.boardId, r, c);
        if (cell) {
          // Don't overwrite existing ship cells from other ships with preview
          if (!cell.classList.contains('ship')) {
            setCellState(this.boardId, r, c, valid ? 'ship-preview' : 'ship-preview-invalid');
          } else if (!valid) {
            cell.classList.add('ship-preview-invalid');
          }
        }
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

    // Remove previous placement first
    if (ship.placed) {
      this.removeShipFromBoard(shipIndex);
    }

    if (!this.canPlace(row, col, ship.size, horizontal, shipIndex)) return false;

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
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        if (this.boardState[r][c] === shipIndex) {
          this.boardState[r][c] = null;
          setCellState(this.boardId, r, c, null);
        }
      }
    }
    this.ships[shipIndex].placed = false;
    this.ships[shipIndex].row = -1;
    this.ships[shipIndex].col = -1;
  }

  checkAllPlaced() {
    const allPlaced = this.ships.every(s => s.placed);
    this.onAllPlaced(allPlaced);
  }

  randomize() {
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
    this.selectedShip = null;
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
