export const SNAKES_AND_LADDERS = {
  // Ladders
  2: 38,
  7: 14,
  8: 31,
  15: 26,
  21: 42,
  28: 84,
  36: 44,
  51: 67,
  71: 91,
  78: 98,
  87: 94,
  // Snakes
  16: 6,
  46: 25,
  49: 11,
  62: 19,
  64: 60,
  74: 53,
  89: 68,
  92: 88,
  95: 75,
  99: 80
};

export const BOARD_SIZE = 10;
export const BOARD_MAX = 100;

// Convert a cell number (1..100) into a grid position (row/col) in a 10x10 grid
// rendered top-to-bottom, left-to-right, with serpentine numbering.
// Row 0 is the TOP row, col 0 is the LEFT column.
export const numberToGridPos = (cellNumber) => {
  const n = Math.min(BOARD_MAX, Math.max(1, Math.floor(cellNumber || 1)));

  const rowFromBottom = Math.floor((n - 1) / BOARD_SIZE); // 0..9
  const colInRow = (n - 1) % BOARD_SIZE; // 0..9
  const reversed = rowFromBottom % 2 === 1;

  const colFromLeft = reversed ? BOARD_SIZE - 1 - colInRow : colInRow;
  const rowFromTop = BOARD_SIZE - 1 - rowFromBottom;

  return { row: rowFromTop, col: colFromLeft };
};

export const getBoardRows = () => {
  // Returns an array of rows, each an array of numbers, to render a 10x10 board.
  const rows = [];
  for (let rowFromTop = 0; rowFromTop < BOARD_SIZE; rowFromTop++) {
    const rowFromBottom = BOARD_SIZE - 1 - rowFromTop;
    const start = rowFromBottom * BOARD_SIZE + 1;
    const end = start + BOARD_SIZE - 1;
    const nums = Array.from({ length: BOARD_SIZE }, (_, i) => start + i);
    const reversed = rowFromBottom % 2 === 1;
    rows.push(reversed ? nums.reverse() : nums);
  }
  return rows;
};

export const getSnakeLadderPairs = () => {
  return Object.entries(SNAKES_AND_LADDERS)
    .map(([from, to]) => ({ from: Number(from), to: Number(to) }))
    .filter((p) => Number.isFinite(p.from) && Number.isFinite(p.to));
};

export const rollDie = () => Math.floor(Math.random() * 6) + 1;

export const clampPosition = (position) => {
  if (typeof position !== 'number' || Number.isNaN(position)) return 0;
  if (position < 0) return 0;
  if (position > 100) return 100;
  return position;
};

export const applySnakesAndLadders = (position) => {
  const next = SNAKES_AND_LADDERS[position];
  if (!next) return { final: position, via: null };
  return { final: next, via: next > position ? 'ladder' : 'snake' };
};

export const computeMove = ({ from, roll }) => {
  const start = clampPosition(from);
  const die = clampPosition(roll);

  // Standard rule: you must land exactly on 100.
  let tentative = start + die;
  if (tentative > 100) tentative = start;

  const { final, via } = applySnakesAndLadders(tentative);
  return { to: final, via };
};
