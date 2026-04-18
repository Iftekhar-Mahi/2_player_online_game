export const CHECKERS_SIZE = 8;

// Piece encoding:
// - 'h' host man, 'H' host king
// - 'g' guest man, 'G' guest king
export const isHostPiece = (piece) => piece === 'h' || piece === 'H';
export const isGuestPiece = (piece) => piece === 'g' || piece === 'G';
export const isKing = (piece) => piece === 'H' || piece === 'G';

export const createInitialBoard = () => {
  const board = Array.from({ length: CHECKERS_SIZE }, () => Array(CHECKERS_SIZE).fill(null));

  // Guest on top rows 0..2, Host on bottom rows 5..7
  for (let r = 0; r < CHECKERS_SIZE; r++) {
    for (let c = 0; c < CHECKERS_SIZE; c++) {
      const isDarkSquare = (r + c) % 2 === 1;
      if (!isDarkSquare) continue;

      if (r <= 2) board[r][c] = 'g';
      if (r >= 5) board[r][c] = 'h';
    }
  }

  return board;
};

export const inBounds = (r, c) => r >= 0 && r < CHECKERS_SIZE && c >= 0 && c < CHECKERS_SIZE;

export const cloneBoard = (board) => board.map((row) => row.slice());

export const getPieceOwner = (piece) => {
  if (!piece) return null;
  if (isHostPiece(piece)) return 'host';
  if (isGuestPiece(piece)) return 'guest';
  return null;
};

export const getMoveDirections = (piece) => {
  if (!piece) return [];
  const king = isKing(piece);
  const owner = getPieceOwner(piece);

  if (king) return [-1, 1]; // both ways
  if (owner === 'host') return [-1];
  if (owner === 'guest') return [1];
  return [];
};

export const maybeKing = (piece, toRow) => {
  if (!piece) return piece;
  if (isKing(piece)) return piece;
  if (piece === 'h' && toRow === 0) return 'H';
  if (piece === 'g' && toRow === CHECKERS_SIZE - 1) return 'G';
  return piece;
};

export const getSimpleMoves = (board, fromR, fromC) => {
  const piece = board?.[fromR]?.[fromC] ?? null;
  if (!piece) return [];

  const dirs = getMoveDirections(piece);
  const moves = [];

  for (const dr of dirs) {
    for (const dc of [-1, 1]) {
      const r = fromR + dr;
      const c = fromC + dc;
      if (!inBounds(r, c)) continue;
      if (board[r][c] !== null) continue;
      moves.push({ toR: r, toC: c, capture: null });
    }
  }

  return moves;
};

export const getCaptureMoves = (board, fromR, fromC) => {
  const piece = board?.[fromR]?.[fromC] ?? null;
  if (!piece) return [];

  const owner = getPieceOwner(piece);
  const dirs = getMoveDirections(piece);
  const moves = [];

  for (const dr of dirs) {
    for (const dc of [-1, 1]) {
      const midR = fromR + dr;
      const midC = fromC + dc;
      const toR = fromR + dr * 2;
      const toC = fromC + dc * 2;

      if (!inBounds(midR, midC) || !inBounds(toR, toC)) continue;
      if (board[toR][toC] !== null) continue;

      const midPiece = board[midR][midC];
      if (!midPiece) continue;

      const midOwner = getPieceOwner(midPiece);
      if (!midOwner || midOwner === owner) continue;

      moves.push({ toR, toC, capture: { r: midR, c: midC } });
    }
  }

  return moves;
};

export const getLegalMovesForPiece = (board, fromR, fromC) => {
  // We allow captures and simple moves (no forced capture for now).
  return [...getCaptureMoves(board, fromR, fromC), ...getSimpleMoves(board, fromR, fromC)];
};

export const applyMove = (board, fromR, fromC, toR, toC) => {
  const next = cloneBoard(board);
  const piece = next?.[fromR]?.[fromC] ?? null;
  if (!piece) return { board: next, capture: null, kinged: false };

  const captureMoves = getCaptureMoves(next, fromR, fromC);
  const capture = captureMoves.find((m) => m.toR === toR && m.toC === toC)?.capture ?? null;

  next[fromR][fromC] = null;
  if (capture) next[capture.r][capture.c] = null;

  const crowned = maybeKing(piece, toR);
  next[toR][toC] = crowned;

  return { board: next, capture, kinged: crowned !== piece };
};

export const countPieces = (board) => {
  let host = 0;
  let guest = 0;

  for (const row of board || []) {
    for (const cell of row || []) {
      if (isHostPiece(cell)) host += 1;
      if (isGuestPiece(cell)) guest += 1;
    }
  }

  return { host, guest };
};

export const getWinnerByElimination = (board) => {
  const { host, guest } = countPieces(board);
  if (host === 0 && guest === 0) return 'draw';
  if (host === 0) return 'guest';
  if (guest === 0) return 'host';
  return null;
};
