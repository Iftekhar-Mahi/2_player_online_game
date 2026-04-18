import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../hooks/useAuth';
import { useRealtimeGame } from '../../../hooks/useRealtimeGame';
import { useGameStore } from '../../../store/gameStore';
import {
  CHECKERS_SIZE,
  applyMove,
  createInitialBoard,
  getLegalMovesForPiece,
  getPieceOwner,
  getWinnerByElimination,
  inBounds,
  isHostPiece,
  isKing
} from './checkersLogic';

const isBoard = (value) => Array.isArray(value) && value.length === CHECKERS_SIZE;

export default function CheckersGame() {
  const { roomId } = useParams();
  const { user } = useAuth();
  const { room, gameState, setGameState } = useGameStore();
  const { loading, error } = useRealtimeGame(roomId);

  const [selected, setSelected] = useState(null); // { r, c }

  const isHost = room?.host_id === user?.id;
  const mySide = isHost ? 'host' : 'guest';

  if (!user) return <div className="text-xl">Authenticating...</div>;
  if (loading) return <div className="text-xl">Loading room state...</div>;
  if (error) return <div className="text-xl text-red-500">Error: {error}</div>;
  if (!room || !gameState) return <div className="text-xl">Room not found</div>;

  if (room.status === 'waiting') {
    return (
      <div className="flex w-full max-w-md flex-col items-center justify-center rounded-3xl border border-gray-700 bg-gray-800 p-5 text-center shadow-2xl sm:p-8">
        <h2 className="mb-2 text-2xl font-bold sm:text-3xl">Waiting for opponent...</h2>
        <p className="mb-4 text-sm text-gray-400">Share this code with your friend to connect</p>
        <div className="w-full overflow-hidden rounded-2xl border border-gray-900 bg-black/50 px-6 py-5 shadow-inner">
          <div className="font-mono text-5xl tracking-[0.25em] text-blue-400">{room.code}</div>
        </div>
      </div>
    );
  }

  const rawBoard = gameState.current_board;
  const board = isBoard(rawBoard) ? rawBoard : createInitialBoard();

  const isFinished = Boolean(gameState.winner_id) || room.status === 'finished';
  const isMyTurn = gameState.current_turn === user.id && !gameState.winner_id;

  const statusText = useMemo(() => {
    if (gameState.winner_id) {
      return gameState.winner_id === user.id ? 'YOU WIN!' : 'OPPONENT WINS!';
    }
    if (room.status === 'finished') return 'GAME OVER';
    return isMyTurn ? 'Your turn' : "Opponent's turn";
  }, [gameState.winner_id, isMyTurn, room.status, user.id]);

  const legalMoves = useMemo(() => {
    if (!selected) return [];
    const { r, c } = selected;
    if (!inBounds(r, c)) return [];
    return getLegalMovesForPiece(board, r, c);
  }, [board, selected]);

  const isMyPiece = (piece) => {
    if (!piece) return false;
    const owner = getPieceOwner(piece);
    return owner === mySide;
  };

  const handleSquareClick = async (r, c) => {
    if (isFinished) return;

    const piece = board[r][c];

    // Selecting
    if (!selected) {
      if (!isMyTurn) return;
      if (!isMyPiece(piece)) return;
      setSelected({ r, c });
      return;
    }

    const fromR = selected.r;
    const fromC = selected.c;

    // Re-select
    if (fromR === r && fromC === c) {
      setSelected(null);
      return;
    }

    // Switch selection to another of my pieces
    if (isMyTurn && isMyPiece(piece)) {
      setSelected({ r, c });
      return;
    }

    // Attempt a move
    if (!isMyTurn) return;

    const allowed = legalMoves.find((m) => m.toR === r && m.toC === c);
    if (!allowed) return;

    const { board: nextBoard } = applyMove(board, fromR, fromC, r, c);

    // Determine winner (simple elimination only for now)
    const eliminated = getWinnerByElimination(nextBoard);
    const winnerId = eliminated
      ? (eliminated === 'draw'
          ? null
          : (eliminated === 'host' ? room.host_id : room.guest_id))
      : null;

    const nextTurn = winnerId
      ? null
      : (user.id === room.host_id ? room.guest_id : room.host_id);

    const moveRecord = {
      from: { r: fromR, c: fromC },
      to: { r, c },
      at: new Date().toISOString()
    };

    const nextMoveHistory = Array.isArray(gameState.move_history)
      ? [...gameState.move_history, moveRecord]
      : gameState.move_history;

    let roomStatus = room.status;
    if (winnerId) roomStatus = 'finished';

    try {
      setSelected(null);
      setGameState({
        ...gameState,
        current_board: nextBoard,
        current_turn: nextTurn,
        winner_id: winnerId,
        move_history: nextMoveHistory
      });

      const { error: updateErr } = await supabase
        .from('game_states')
        .update({
          current_board: nextBoard,
          current_turn: nextTurn,
          winner_id: winnerId,
          move_history: nextMoveHistory,
          updated_at: new Date().toISOString()
        })
        .eq('room_id', room.id)
        .eq('current_turn', user.id)
        .is('winner_id', null);

      if (updateErr) throw updateErr;

      if (roomStatus !== room.status) {
        const { error: roomUpdateErr } = await supabase
          .from('game_rooms')
          .update({ status: roomStatus })
          .eq('id', room.id);

        if (roomUpdateErr) throw roomUpdateErr;
      }
    } catch (err) {
      console.error('Checkers: error making move:', err.message);
      alert('Error making move: ' + err.message);
    }
  };

  const handleRematch = async () => {
    const resetBoard = createInitialBoard();

    const { error: stateResetErr } = await supabase
      .from('game_states')
      .update({
        current_board: resetBoard,
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

    setSelected(null);
  };

  const isDestination = (r, c) => legalMoves.some((m) => m.toR === r && m.toC === c);

  return (
    <div className="flex w-full max-w-5xl flex-col items-center gap-5 sm:gap-8">
      <div className="flex w-full max-w-3xl items-center justify-between gap-3 rounded-2xl border border-gray-700 bg-gray-800 p-4 shadow-xl sm:p-6">
        <div className={`flex min-w-0 flex-col items-center gap-2 transition-opacity ${isMyTurn ? 'opacity-100 scale-110' : 'opacity-60'}`}>
          <span className="text-xs font-bold text-gray-400 capitalize sm:text-sm">You</span>
          <div className={`h-6 w-6 rounded-full shadow-lg sm:h-8 sm:w-8 ${isHost ? 'bg-red-500' : 'bg-gray-200'}`} />
        </div>

        <div className="min-w-0 flex-grow text-center">
          <div className="text-lg font-extrabold tracking-wide sm:text-3xl">{statusText}</div>
          {isFinished && (
            <button
              onClick={handleRematch}
              className="mt-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white shadow-lg transition-transform active:scale-95 sm:px-6 sm:text-base"
            >
              Play Again
            </button>
          )}
        </div>

        <div className={`flex min-w-0 flex-col items-center gap-2 transition-opacity ${!isMyTurn && !isFinished ? 'opacity-100 scale-110' : 'opacity-60'}`}>
          <span className="text-xs font-bold text-gray-400 capitalize sm:text-sm">Opponent</span>
          <div className={`h-6 w-6 rounded-full shadow-lg sm:h-8 sm:w-8 ${isHost ? 'bg-gray-200' : 'bg-red-500'}`} />
        </div>
      </div>

      <div className="w-full max-w-3xl">
        <div className="relative mx-auto aspect-square w-full overflow-hidden rounded-2xl border border-gray-700 bg-gray-900 shadow-2xl">
          <div className="grid h-full w-full grid-cols-8">
            {board.map((row, r) =>
              row.map((cell, c) => {
                const dark = (r + c) % 2 === 1;
                const selectedHere = selected && selected.r === r && selected.c === c;
                const dest = isDestination(r, c);

                const squareBg = dark ? 'bg-gray-900' : 'bg-gray-800';

                const piece = cell;
                const owner = getPieceOwner(piece);
                const mine = owner === mySide;

                const pieceColor = owner === 'host' ? 'bg-red-500' : owner === 'guest' ? 'bg-gray-200' : '';

                return (
                  <button
                    key={`${r}-${c}`}
                    type="button"
                    onClick={() => handleSquareClick(r, c)}
                    className={`relative flex items-center justify-center border border-gray-800 ${squareBg} ${selectedHere ? 'ring-2 ring-blue-400 ring-inset' : ''}`}
                    aria-label={`Square ${r}, ${c}`}
                  >
                    {dest && (
                      <span className="absolute h-3 w-3 rounded-full bg-blue-400/70" />
                    )}

                    {piece && (
                      <span
                        className={`relative flex h-8 w-8 items-center justify-center rounded-full shadow-md sm:h-10 sm:w-10 ${pieceColor} ${mine && isMyTurn ? 'ring-2 ring-white/30' : ''}`}
                      >
                        {isKing(piece) && (
                          <span className="text-xs font-black text-gray-900">K</span>
                        )}
                        {!isKing(piece) && isHostPiece(piece) && (
                          <span className="sr-only">Host man</span>
                        )}
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>

        <div className="mt-4 text-center text-xs text-gray-400">
          Tip: click a piece, then click a highlighted destination.
        </div>
      </div>
    </div>
  );
}
