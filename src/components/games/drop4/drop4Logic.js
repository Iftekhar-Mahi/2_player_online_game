export const ROWS = 6;
export const COLS = 7;

// Create an empty 6x7 board
export const createEmptyBoard = () => {
  return Array(ROWS).fill(null).map(() => Array(COLS).fill(null));
};

// Check if a move is valid (column has empty space)
export const isValidMove = (board, colIndex) => {
  return board[0][colIndex] === null;
};

// Get the lowest available row in a column
export const getAvailableRow = (board, colIndex) => {
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r][colIndex] === null) {
      return r;
    }
  }
  return -1;
};

// Update board with a new move
export const makeMove = (board, colIndex, playerId) => {
  const newBoard = board.map(row => [...row]);
  const rowIndex = getAvailableRow(newBoard, colIndex);
  
  if (rowIndex !== -1) {
    newBoard[rowIndex][colIndex] = playerId;
  }
  return newBoard;
};

// Check for a win (4 in a row), returns the winning coordinates or null
export const checkWin = (board, playerId) => {
  // Horizontal
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS - 3; c++) {
      if (
        board[r][c] === playerId &&
        board[r][c + 1] === playerId &&
        board[r][c + 2] === playerId &&
        board[r][c + 3] === playerId
      ) {
        return [[r, c], [r, c + 1], [r, c + 2], [r, c + 3]];
      }
    }
  }

  // Vertical
  for (let r = 0; r < ROWS - 3; r++) {
    for (let c = 0; c < COLS; c++) {
      if (
        board[r][c] === playerId &&
        board[r + 1][c] === playerId &&
        board[r + 2][c] === playerId &&
        board[r + 3][c] === playerId
      ) {
        return [[r, c], [r + 1, c], [r + 2, c], [r + 3, c]];
      }
    }
  }

  // Diagonal (Right-Down)
  for (let r = 0; r < ROWS - 3; r++) {
    for (let c = 0; c < COLS - 3; c++) {
      if (
        board[r][c] === playerId &&
        board[r + 1][c + 1] === playerId &&
        board[r + 2][c + 2] === playerId &&
        board[r + 3][c + 3] === playerId
      ) {
        return [[r, c], [r + 1, c + 1], [r + 2, c + 2], [r + 3, c + 3]];
      }
    }
  }

  // Diagonal (Left-Down)
  for (let r = 0; r < ROWS - 3; r++) {
    for (let c = 3; c < COLS; c++) {
      if (
        board[r][c] === playerId &&
        board[r + 1][c - 1] === playerId &&
        board[r + 2][c - 2] === playerId &&
        board[r + 3][c - 3] === playerId
      ) {
        return [[r, c], [r + 1, c - 1], [r + 2, c - 2], [r + 3, c - 3]];
      }
    }
  }

  return null;
};

// Check for a draw (board is full)
export const checkDraw = (board) => {
  return board[0].every(cell => cell !== null);
};
