// Ship placement with click-to-place + drag-and-drop + touch support + undo
class ShipPlacement {
  constructor(boardId, dockId, onAllPlaced) {
    this.boardId = boardId;
    this.dockId = dockId;
    this.onAllPlaced = onAllPlaced;
    this.ships = SHIPS_CONFIG.map(s => ({ ...s, placed: false, row: -1, col: -1, horizontal: true }));
    this.boardState = Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(null));
    this.currentDragShip = null;
    this.selectedShip = null;
    this.currentRotation = true;
    this.dragOffset = 0;
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
      shipEl.className = 'dock-ship' + (ship.placed ? ' placed' : '') + (this.selectedShip === i ? ' selected' : '');
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

      shipEl.addEventListener('dragstart', (e) => {
        this.currentDragShip = i;
        this.selectedShip = null;
        const clickedCell = e.target.closest('.dock-ship-cell');
        this.dragOffset = clickedCell ? (parseInt(clickedCell.dataset.cellIndex) || 0) : Math.floor(ship.size / 2);
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', i.toString());
        const ghost = document.createElement('canvas');
        ghost.width = 1; ghost.height = 1;
        document.body.appendChild(ghost);
        e.dataTransfer.setDragImage(ghost, 0, 0);
        requestAnimationFrame(() => ghost.remove());
      });

      // Click to select
      shipEl.addEventListener('click', (e) => {
        if (ship.placed) return;
        this.selectedShip = (this.selectedShip === i) ? null : i;
        this.dragOffset = Math.floor(ship.size / 2);
        this.renderDock();
      });

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

    // Drag events
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
      const related = e.relatedTarget;
      if (!related || !board.contains(related)) this.clearPreview();
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

    board.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      this.currentRotation = !this.currentRotation;
      this.showRotationHint();
    });

    // Click-to-place on board (works for both mobile and desktop)
    board.addEventListener('click', (e) => {
      const cell = e.target.closest('.cell');
      if (!cell) return;
      const row = parseInt(cell.dataset.row);
      const col = parseInt(cell.dataset.col);

      // If clicking on a placed ship, pick it up (undo)
      const shipIdx = this.boardState[row][col];
      if (shipIdx !== null && this.selectedShip === null) {
        this.pickUpShip(shipIdx);
        return;
      }

      // Place selected ship
      if (this.selectedShip !== null) {
        const ship = this.ships[this.selectedShip];
        const { adjRow, adjCol } = this._adjustForOffset(row, col, ship.size, this.currentRotation);
        if (this.tryPlace(this.selectedShip, adjRow, adjCol, this.currentRotation)) {
          this.selectedShip = null;
          this.renderDock();
        }
      }
    });

    // Hover preview when ship is selected
    board.addEventListener('mousemove', (e) => {
      if (this.selectedShip === null) return;
      const cell = e.target.closest('.cell');
      if (!cell) return;
      const row = parseInt(cell.dataset.row);
      const col = parseInt(cell.dataset.col);
      const ship = this.ships[this.selectedShip];
      const { adjRow, adjCol } = this._adjustForOffset(row, col, ship.size, this.currentRotation);
      this.showPreview(adjRow, adjCol, ship.size, this.currentRotation, this.selectedShip);
    });

    board.addEventListener('mouseleave', () => {
      this.clearPreview();
    });
  }

  pickUpShip(shipIndex) {
    const ship = this.ships[shipIndex];
    if (!ship.placed) return;
    this.removeShipFromBoard(shipIndex);
    this.selectedShip = shipIndex;
    this.dragOffset = Math.floor(ship.size / 2);
    this.renderDock();
    this.showRotationHint();
  }

  _adjustForOffset(row, col, size, horizontal) {
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
    if (this._keyHandler) document.removeEventListener('keydown', this._keyHandler);
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
      setTimeout(() => { if (status.textContent.startsWith('Rotation')) { status.textContent = ''; status.className = 'status-message'; } }, 1500);
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
    if (ship.placed) this.removeShipFromBoard(shipIndex);
    if (!this.canPlace(row, col, ship.size, horizontal, shipIndex)) return false;

    for (let i = 0; i < ship.size; i++) {
      const r = horizontal ? row : row + i;
      const c = horizontal ? col + i : col;
      this.boardState[r][c] = shipIndex;
      setCellState(this.boardId, r, c, 'ship');
      // Set ship name for silhouette labeling
      const cell = getCell(this.boardId, r, c);
      if (cell) cell.dataset.shipName = ship.name;
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
          const cell = getCell(this.boardId, r, c);
          if (cell) delete cell.dataset.shipName;
        }
      }
    }
    this.ships[shipIndex].placed = false;
    this.ships[shipIndex].row = -1;
    this.ships[shipIndex].col = -1;
  }

  checkAllPlaced() {
    this.onAllPlaced(this.ships.every(s => s.placed));
  }

  randomize() {
    this.reset();
    for (let i = 0; i < this.ships.length; i++) {
      let placed = false, attempts = 0;
      while (!placed && attempts < 1000) {
        placed = this.tryPlace(i, Math.floor(Math.random() * BOARD_SIZE), Math.floor(Math.random() * BOARD_SIZE), Math.random() < 0.5);
        attempts++;
      }
    }
  }

  reset() {
    for (let i = 0; i < this.ships.length; i++) this.removeShipFromBoard(i);
    this.boardState = Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(null));
    clearBoard(this.boardId);
    this.selectedShip = null;
    this.renderDock();
    this.checkAllPlaced();
  }

  getPlacement() {
    return this.ships.filter(s => s.placed).map(s => ({ name: s.name, size: s.size, row: s.row, col: s.col, horizontal: s.horizontal }));
  }
}
