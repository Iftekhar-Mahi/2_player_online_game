import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../hooks/useAuth';
import { useRealtimeGame } from '../../../hooks/useRealtimeGame';
import { useGameStore } from '../../../store/gameStore';
import {
  CHECKERS_SIZE,
  applyMove,
  createInitialBoard,
  getCaptureMoves,
  getLegalMovesForPiece,
  getPieceOwner,
  getWinnerByElimination,
  inBounds,
  isKing,
  sideHasAnyCapture
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
  const flipBoard = mySide === 'guest';

  const toModelCoords = (viewR, viewC) => {
    if (!flipBoard) return { r: viewR, c: viewC };
    return { r: CHECKERS_SIZE - 1 - viewR, c: CHECKERS_SIZE - 1 - viewC };
  };

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

  const statusText = (() => {
    if (gameState.winner_id) {
      return gameState.winner_id === user.id ? 'YOU WIN!' : 'OPPONENT WINS!';
    }
    if (room.status === 'finished') return 'GAME OVER';
    return isMyTurn ? 'Your turn' : "Opponent's turn";
  })();

  const moveHistory = Array.isArray(gameState.move_history) ? gameState.move_history : [];

  const opponentLastMove = (() => {
    for (let i = moveHistory.length - 1; i >= 0; i--) {
      const move = moveHistory[i];
      if (move?.mover_id && move.mover_id !== user.id) return move;
    }
    return null;
  })();

  const mustContinueFrom = (() => {
    if (!isMyTurn) return null;
    const last = moveHistory[moveHistory.length - 1];
    if (!last || last.mover_id !== user.id) return null;
    if (!last.was_capture) return null;
    if (last.kinged) return null;
    if (!last?.to) return null;
    const { r, c } = last.to;
    const nextCaptures = getCaptureMoves(board, r, c);
    if (nextCaptures.length === 0) return null;
    return { r, c };
  })();

  const captureIsForced = isMyTurn && !mustContinueFrom && sideHasAnyCapture(board, mySide);

  const legalMoves = (() => {
    if (!selected) return [];
    const { r, c } = selected;
    if (!inBounds(r, c)) return [];

    // If a multi-jump is in progress, only that piece may move and only by capturing.
    if (mustContinueFrom) {
      if (r !== mustContinueFrom.r || c !== mustContinueFrom.c) return [];
      return getLegalMovesForPiece(board, r, c, { captureOnly: true });
    }

    if (captureIsForced) {
      return getLegalMovesForPiece(board, r, c, { captureOnly: true });
    }

    return getLegalMovesForPiece(board, r, c);
  })();

  const isMyPiece = (piece) => {
    if (!piece) return false;
    const owner = getPieceOwner(piece);
    return owner === mySide;
  };

  const handleSquareClick = async (viewR, viewC) => {
    if (isFinished) return;

    const { r, c } = toModelCoords(viewR, viewC);

    const piece = board[r][c];

    // Selecting
    if (!selected) {
      if (!isMyTurn) return;
      if (!isMyPiece(piece)) return;

      if (mustContinueFrom) {
        // Only the forced piece may be selected mid-combo.
        setSelected({ r: mustContinueFrom.r, c: mustContinueFrom.c });
        return;
      }

      setSelected({ r, c });
      return;
    }

    const fromR = selected.r;
    const fromC = selected.c;

    // Re-select
    if (fromR === r && fromC === c) {
      if (mustContinueFrom) return;
      setSelected(null);
      return;
    }

    // Switch selection to another of my pieces (unless a multi-jump is in progress)
    if (isMyTurn && isMyPiece(piece)) {
      if (mustContinueFrom) return;
      setSelected({ r, c });
      return;
    }

    // Attempt a move
    if (!isMyTurn) return;

    const allowed = legalMoves.find((m) => m.toR === r && m.toC === c);
    if (!allowed) return;

    const { board: nextBoard, capture, kinged } = applyMove(board, fromR, fromC, r, c);

    // Determine winner (simple elimination only for now)
    const eliminated = getWinnerByElimination(nextBoard);
    const winnerId = eliminated
      ? (eliminated === 'draw'
          ? null
          : (eliminated === 'host' ? room.host_id : room.guest_id))
      : null;

    const nextCaptures = capture && !kinged ? getCaptureMoves(nextBoard, r, c) : [];
    const continuesCombo = Boolean(capture) && !kinged && nextCaptures.length > 0;

    const nextTurn = winnerId
      ? null
      : (continuesCombo ? user.id : (user.id === room.host_id ? room.guest_id : room.host_id));

    const moveRecord = {
      mover_id: user.id,
      from: { r: fromR, c: fromC },
      to: { r, c },
      was_capture: Boolean(capture),
      captured: capture ? [capture] : [],
      kinged,
      at: new Date().toISOString()
    };

    const nextMoveHistory = Array.isArray(gameState.move_history)
      ? [...gameState.move_history, moveRecord]
      : moveHistory.concat(moveRecord);

    let roomStatus = room.status;
    if (winnerId) roomStatus = 'finished';

    try {
      setSelected(continuesCombo ? { r, c } : null);
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

  const isDestination = (modelR, modelC) => legalMoves.some((m) => m.toR === modelR && m.toC === modelC);

  const isOpponentLastMoveSquare = (modelR, modelC) => {
    if (!opponentLastMove) return false;
    const from = opponentLastMove.from;
    const to = opponentLastMove.to;
    if (!from || !to) return false;
    return (from.r === modelR && from.c === modelC) || (to.r === modelR && to.c === modelC);
  };

  return (
    <div className="flex w-full max-w-5xl flex-col items-center gap-5 sm:gap-8">
      <div className="flex w-full max-w-3xl items-center justify-between gap-3 rounded-2xl border border-gray-700 bg-gray-800 p-4 shadow-xl sm:p-6">
        <div className={`flex min-w-0 flex-col items-center gap-2 transition-opacity ${isMyTurn ? 'opacity-100 scale-110' : 'opacity-60'}`}>
          <span className="text-xs font-bold text-gray-400 capitalize sm:text-sm">You</span>
          <div className={`h-6 w-6 rounded-full shadow-lg sm:h-8 sm:w-8 ${isHost ? 'bg-black' : 'bg-white'}`} />
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
          <div className={`h-6 w-6 rounded-full shadow-lg sm:h-8 sm:w-8 ${isHost ? 'bg-white' : 'bg-black'}`} />
        </div>
      </div>

      <div className="w-full max-w-3xl">
        <div className="relative mx-auto aspect-square w-full overflow-hidden rounded-2xl border border-gray-700 bg-gray-900 shadow-2xl">
          <div className="grid h-full w-full grid-cols-8 grid-rows-8">
            {Array.from({ length: CHECKERS_SIZE }).map((_, viewR) =>
              Array.from({ length: CHECKERS_SIZE }).map((__, viewC) => {
                const { r, c } = toModelCoords(viewR, viewC);
                const cell = board[r][c];

                const dark = (r + c) % 2 === 1;
                const selectedHere = selected && selected.r === r && selected.c === c;
                const dest = isDestination(r, c);
                const lastMoveHere = isOpponentLastMoveSquare(r, c);

                const squareBg = dark ? 'bg-amber-900' : 'bg-stone-100';

                const piece = cell;
                const owner = getPieceOwner(piece);
                const mine = owner === mySide;

                const pieceStyle =
                  owner === 'host'
                    ? 'bg-black border border-white/20'
                    : owner === 'guest'
                      ? 'bg-white border border-black/20'
                      : '';

                const kingMarker = (() => {
                  if (!piece || !isKing(piece)) return null;
                  // Opposite-color dot to indicate king: black on white, white on black.
                  const dot = owner === 'guest' ? 'bg-black' : 'bg-white';
                  return <span className={`absolute h-3 w-3 rounded-full ${dot}`} />;
                })();

                return (
                  <button
                    key={`${viewR}-${viewC}`}
                    type="button"
                    onClick={() => handleSquareClick(viewR, viewC)}
                    className={
                      `relative flex h-full w-full items-center justify-center border border-black/20 ${squareBg} ` +
                      `${selectedHere ? 'ring-2 ring-blue-400 ring-inset' : ''} ` +
                      `${lastMoveHere ? 'ring-2 ring-yellow-400/80 ring-inset' : ''}`
                    }
                    aria-label={`Square ${r}, ${c}`}
                  >
                    {dest && <span className="absolute h-3 w-3 rounded-full bg-blue-500/70" />}

                    {piece && (
                      <span
                        className={
                          `relative flex h-8 w-8 items-center justify-center rounded-full shadow-md sm:h-10 sm:w-10 ${pieceStyle} ` +
                          `${mine && isMyTurn ? 'ring-2 ring-white/20' : ''}`
                        }
                      >
                        {kingMarker}
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
