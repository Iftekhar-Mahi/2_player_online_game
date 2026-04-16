import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../../../hooks/useAuth';
import { useRealtimeGame } from '../../../hooks/useRealtimeGame';
import { useGameStore } from '../../../store/gameStore';
import { createEmptyBoard, makeMove, checkWin, checkDraw, isValidMove } from './drop4Logic';
import { supabase } from '../../../lib/supabase';

export default function Drop4Game() {
  const { roomId } = useParams();
  const { user } = useAuth();
  const { room, gameState, setGameState } = useGameStore();
  const { loading, error } = useRealtimeGame(roomId);

  const isHost = room?.host_id === user?.id;
  const playerColor = isHost ? 'bg-red-500' : 'bg-yellow-400';
  const opponentColor = isHost ? 'bg-yellow-400' : 'bg-red-500';

  if (!user) return <div className="text-xl">Authenticating...</div>;
  if (loading) return <div className="text-xl">Loading room state...</div>;
  if (error) return <div className="text-xl text-red-500">Error: {error}</div>;
  if (!room || !gameState) return <div className="text-xl">Room not found</div>;

  if (room.status === 'waiting') {
    return (
      <div className="flex w-full max-w-md flex-col items-center justify-center rounded-3xl border border-gray-700 bg-gray-800 p-5 text-center shadow-2xl sm:p-8">
        <div className="animate-pulse mb-2">
          <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mx-auto opacity-80">
            <div className="w-12 h-12 bg-gray-800 rounded-full" />
          </div>
        </div>
        <h2 className="mb-3 text-2xl font-bold text-white sm:mb-4 sm:text-3xl">Waiting for opponent...</h2>
        <p className="mb-5 text-sm text-gray-400 sm:mb-6 sm:text-base">Share this code with your friend to connect</p>
        <div className="w-full overflow-hidden rounded-2xl border border-gray-900 bg-black/50 px-4 py-4 font-mono text-4xl tracking-[0.2em] text-blue-400 shadow-inner sm:px-8 sm:py-5 sm:text-6xl sm:tracking-[0.25em]">
          {room.code}
        </div>
      </div>
    );
  }

  const board = gameState.current_board && gameState.current_board.length 
    ? gameState.current_board 
    : createEmptyBoard();

  const isMyTurn = gameState.current_turn === user.id && !gameState.winner_id;
  
  // Calculate winning cells if there's a winner to highlight them
  const winningCells = gameState.winner_id && gameState.winner_id !== 'draw' 
    ? checkWin(board, gameState.winner_id) 
    : null;

  const isWinningCell = (r, c) => {
    if (!winningCells) return false;
    return winningCells.some(([winR, winC]) => winR === r && winC === c);
  };

  const handleColumnClick = async (colIndex) => {
    if (!isMyTurn || !isValidMove(board, colIndex) || gameState.winner_id) return;

    const newBoard = makeMove([...board.map(row => [...row])], colIndex, user.id);
    const winCells = checkWin(newBoard, user.id);
    const draw = checkDraw(newBoard);

    let nextTurn = null;
    let winnerId = null;
    let roomStatus = room.status;

    if (winCells) {
      winnerId = user.id;
      nextTurn = null;
      roomStatus = 'finished';
    } else if (draw) {
      winnerId = null;
      nextTurn = null;
      roomStatus = 'finished';
    } else {
      nextTurn = Object.values([room.host_id, room.guest_id]).find(id => id !== user.id);
    }

    try {
      setGameState({
        ...gameState,
        current_board: newBoard,
        current_turn: nextTurn,
        winner_id: winnerId
      });

      const { error: updateErr } = await supabase
        .from('game_states')
        .update({
          current_board: newBoard,
          current_turn: nextTurn,
          winner_id: winnerId,
          updated_at: new Date().toISOString()
        })
        .eq('room_id', room.id)
        .eq('current_turn', user.id);

      if (updateErr) throw updateErr;

      if (roomStatus !== room.status) {
        const { error: roomUpdateErr } = await supabase
          .from('game_rooms')
          .update({ status: roomStatus })
          .eq('id', room.id);

        if (roomUpdateErr) throw roomUpdateErr;
      }
    } catch (err) {
      console.error('Error updating game state:', err.message);
      alert('Error making move: ' + err.message);
    }
  };

  const handleRematch = async () => {
    const { error: stateResetErr } = await supabase
      .from('game_states')
      .update({
        current_board: [],
        current_turn: room.host_id,
        winner_id: null,
        move_history: [],
        updated_at: new Date().toISOString()
      })
      .eq('room_id', room.id);

    if (stateResetErr) {
      alert('Error starting rematch: ' + stateResetErr.message);
      return;
    }

    const { error: roomResetErr } = await supabase
      .from('game_rooms')
      .update({ status: 'active' })
      .eq('id', room.id);

    if (roomResetErr) {
      alert('Error syncing rematch: ' + roomResetErr.message);
    }
  };

  return (
    <div className="flex w-full flex-col items-center gap-5 sm:gap-8">
      {/* Player header / Status Bar */}
      <div className="flex w-full max-w-3xl items-center justify-between gap-3 rounded-2xl border border-gray-700 bg-gray-800 p-4 shadow-xl sm:p-6">
        {/* You */}
        <div className={`flex min-w-0 flex-col items-center gap-2 transition-opacity ${isMyTurn ? 'opacity-100 scale-110' : 'opacity-50'}`}>
          <span className="text-xs font-bold text-gray-400 capitalize sm:text-sm">You</span>
          <div className={`h-6 w-6 rounded-full shadow-lg sm:h-8 sm:w-8 ${playerColor} ${isMyTurn ? 'ring-4 ring-offset-2 ring-offset-gray-800 ring-white' : ''}`} /> 
        </div>

        {/* Center Status */}
        <div className="min-w-0 flex-grow text-center">
          <div className="mb-1 text-lg font-extrabold tracking-wide sm:text-3xl">
            {gameState.winner_id || gameState.current_turn === null
              ? (!gameState.winner_id ? 'DRAW!' : (gameState.winner_id === user.id ? 'YOU WIN!' : 'OPPONENT WINS!'))
              : (isMyTurn ? <span className="text-green-400 animate-pulse">Your Turn</span> : <span className="text-gray-400">Opponent's Turn</span>)
            }
          </div>
          {(gameState.winner_id || gameState.current_turn === null) && (
            <button 
              onClick={handleRematch}
              className="mt-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white shadow-lg transition-transform active:scale-95 sm:px-6 sm:text-base"
            >
              Play Again
            </button>
          )}
        </div>

        {/* Opponent */}
        <div className={`flex min-w-0 flex-col items-center gap-2 transition-opacity ${!isMyTurn && !gameState.winner_id ? 'opacity-100 scale-110' : 'opacity-50'}`}>
          <span className="text-xs font-bold text-gray-400 capitalize sm:text-sm">Opponent</span>
          <div className={`h-6 w-6 rounded-full shadow-lg sm:h-8 sm:w-8 ${opponentColor} ${!isMyTurn && !gameState.winner_id ? 'ring-4 ring-offset-2 ring-offset-gray-800 ring-white' : ''}`} /> 
        </div>
      </div>

      {/* Game Board */}
      <div className="w-full max-w-3xl overflow-x-auto pb-2">
        <div className="mx-auto w-max rounded-2xl border-t-4 border-blue-500 bg-blue-600 p-2 shadow-[0_14px_0_0_rgb(30,58,138)] relative sm:p-5 sm:shadow-[0_20px_0_0_rgb(30,58,138)]">
        {/* Invisible columns for hover effect */}
        <div className="pointer-events-none absolute inset-0 z-0 flex p-2 sm:p-5">
          {Array(7).fill(null).map((_, i) => (
             <div key={i} className={`mx-0.5 flex-1 rounded-xl transition-colors duration-200 sm:mx-2 ${isMyTurn && isValidMove(board, i) && !gameState.winner_id ? 'hover:bg-white/10' : ''}`} />
          ))}
        </div>

        {/* Actual grid */}
        <div className="relative z-10 flex flex-col gap-1 sm:gap-2">
          {board.map((row, rowIndex) => (
            <div key={rowIndex} className="flex gap-1 sm:gap-2">
              {row.map((cell, colIndex) => {
                const isP1 = cell === room.host_id;
                const isP2 = cell === room.guest_id;
                const winning = isWinningCell(rowIndex, colIndex);
                
                return (
                  <button 
                    key={colIndex} 
                    onClick={() => handleColumnClick(colIndex)}
                    className={`
                      relative h-10 w-10 overflow-hidden rounded-full sm:h-16 sm:w-16
                      ${isMyTurn && isValidMove(board, colIndex) ? 'cursor-pointer' : 'cursor-default'} 
                      outline-none focus:outline-none
                    `}
                    disabled={!isValidMove(board, colIndex) || !isMyTurn || gameState.current_turn === null}
                    aria-label={`Drop token in column ${colIndex + 1}`}
                  >
                    {/* Shadow cutout for empty slot */}
                    <div className="absolute inset-0 bg-gray-900 shadow-[inset_0_4px_8px_rgba(0,0,0,0.6)] rounded-full" />
                    
                    {/* The Chip Inside */}
                    {cell && (
                      <div className={`
                        absolute inset-1 rounded-full animate-chip-drop shadow-md border-b-4 border-black/20
                        ${isP1 ? 'bg-red-500' : 'bg-yellow-400'}
                        ${winning ? 'ring-4 ring-white shadow-[0_0_20px_10px_rgba(255,255,255,0.5)] z-20' : ''}
                      `} />
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
      </div>
    </div>
  );
}
