import { create } from 'zustand';

export const useGameStore = create((set) => ({
  room: null,
  gameState: null,
  setRoom: (room) => set({ room }),
  setGameState: (gameState) => set({ gameState }),
  reset: () => set({ room: null, gameState: null })
}));