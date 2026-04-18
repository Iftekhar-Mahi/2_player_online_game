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
