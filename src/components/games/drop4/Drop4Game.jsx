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
      <div className="flex flex-col items-center justify-center bg-gray-800 p-8 rounded-xl shadow-2xl border border-gray-700 text-center">
        <div className="animate-pulse mb-2">
          <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mx-auto opacity-80">
            <div className="w-12 h-12 bg-gray-800 rounded-full" />
          </div>
        </div>
        <h2 className="text-3xl font-bold mb-4 text-white">Waiting for opponent...</h2>
        <p className="text-gray-400 mb-6">Share this code with your friend to connect</p>
        <div className="text-6xl font-mono bg-black/50 px-8 py-5 rounded-lg tracking-[0.25em] text-blue-400 shadow-inner border border-gray-900">
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
    <div className="flex flex-col items-center space-y-8 w-full">
      {/* Player header / Status Bar */}
      <div className="flex justify-between w-full max-w-3xl bg-gray-800 p-6 rounded-2xl items-center shadow-xl border border-gray-700">
        {/* You */}
        <div className={`flex flex-col items-center gap-2 transition-opacity ${isMyTurn ? 'opacity-100 scale-110' : 'opacity-50'}`}>
          <span className="text-sm font-bold text-gray-400 capitalize">You</span>
          <div className={`w-8 h-8 rounded-full shadow-lg ${playerColor} ${isMyTurn ? 'ring-4 ring-offset-2 ring-offset-gray-800 ring-white' : ''}`} /> 
        </div>

        {/* Center Status */}
        <div className="text-center flex-grow">
          <div className="text-3xl font-extrabold tracking-wide mb-1">
            {gameState.winner_id || gameState.current_turn === null
              ? (!gameState.winner_id ? 'DRAW!' : (gameState.winner_id === user.id ? 'YOU WIN!' : 'OPPONENT WINS!'))
              : (isMyTurn ? <span className="text-green-400 animate-pulse">Your Turn</span> : <span className="text-gray-400">Opponent's Turn</span>)
            }
          </div>
          {(gameState.winner_id || gameState.current_turn === null) && (
            <button 
              onClick={handleRematch}
              className="mt-2 px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg shadow-lg transition-transform active:scale-95"
            >
              Play Again
            </button>
          )}
        </div>

        {/* Opponent */}
        <div className={`flex flex-col items-center gap-2 transition-opacity ${!isMyTurn && !gameState.winner_id ? 'opacity-100 scale-110' : 'opacity-50'}`}>
          <span className="text-sm font-bold text-gray-400 capitalize">Opponent</span>
          <div className={`w-8 h-8 rounded-full shadow-lg ${opponentColor} ${!isMyTurn && !gameState.winner_id ? 'ring-4 ring-offset-2 ring-offset-gray-800 ring-white' : ''}`} /> 
        </div>
      </div>

      {/* Game Board */}
      <div className="bg-blue-600 p-3 sm:p-5 rounded-2xl shadow-[0_20px_0_0_rgb(30,58,138)] border-t-4 border-blue-500 relative">
        {/* Invisible columns for hover effect */}
        <div className="absolute inset-0 flex p-3 sm:p-5 z-0 pointer-events-none">
          {Array(7).fill(null).map((_, i) => (
             <div key={i} className={`flex-1 mx-1 sm:mx-2 rounded-xl transition-colors duration-200 ${isMyTurn && isValidMove(board, i) && !gameState.winner_id ? 'hover:bg-white/10' : ''}`} />
          ))}
        </div>

        {/* Actual grid */}
        <div className="relative z-10 flex flex-col gap-2">
          {board.map((row, rowIndex) => (
            <div key={rowIndex} className="flex gap-2">
              {row.map((cell, colIndex) => {
                const isP1 = cell === room.host_id;
                const isP2 = cell === room.guest_id;
                const winning = isWinningCell(rowIndex, colIndex);
                
                return (
                  <button 
                    key={colIndex} 
                    onClick={() => handleColumnClick(colIndex)}
                    className={`
                      relative w-12 h-12 sm:w-16 sm:h-16 rounded-full overflow-hidden 
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
  );
}
