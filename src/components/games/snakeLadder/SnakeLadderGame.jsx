import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../hooks/useAuth';
import { useRealtimeGame } from '../../../hooks/useRealtimeGame';
import { useGameStore } from '../../../store/gameStore';
import { computeMove, rollDie } from './snakeLadderLogic';

const isPlainObject = (value) => {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
};

const getPositionsFromBoard = (board) => {
  if (!isPlainObject(board)) return {};
  const positions = board.positions;
  if (!isPlainObject(positions)) return {};
  return positions;
};

export default function SnakeLadderGame() {
  const { roomId } = useParams();
  const { user } = useAuth();
  const { room, gameState, setGameState } = useGameStore();
  const { loading, error } = useRealtimeGame(roomId);
  const [copyState, setCopyState] = useState('idle');

  const isHost = room?.host_id === user?.id;

  const myId = user?.id;
  const hostId = room?.host_id;
  const guestId = room?.guest_id;
  const opponentId = useMemo(() => {
    if (!myId) return null;
    if (!hostId || !guestId) return null;
    return myId === hostId ? guestId : hostId;
  }, [guestId, hostId, myId]);

  useEffect(() => {
    if (!room || !gameState) return;
    if (room.game_type !== 'snake_ladder') return;
    if (!room.host_id) return;

    // Ensure the positions map contains both players once the guest joins.
    if (room.status !== 'active') return;
    if (!room.guest_id) return;

    const board = gameState.current_board;
    const positions = getPositionsFromBoard(board);

    const hasHost = Object.prototype.hasOwnProperty.call(positions, room.host_id);
    const hasGuest = Object.prototype.hasOwnProperty.call(positions, room.guest_id);

    if (hasHost && hasGuest) return;

    const nextBoard = {
      ...(isPlainObject(board) ? board : {}),
      positions: {
        ...positions,
        [room.host_id]: hasHost ? positions[room.host_id] : 0,
        [room.guest_id]: hasGuest ? positions[room.guest_id] : 0
      },
      started_at: isPlainObject(board) && board.started_at ? board.started_at : new Date().toISOString()
    };

    const sync = async () => {
      const { error: updateErr } = await supabase
        .from('game_states')
        .update({ current_board: nextBoard, updated_at: new Date().toISOString() })
        .eq('room_id', room.id);

      if (updateErr) {
        console.warn('SnakeLadder: failed to initialize guest state', updateErr.message);
      }
    };

    sync();
  }, [gameState, room]);

  if (!user) return <div className="text-xl">Authenticating...</div>;
  if (loading) return <div className="text-xl">Loading room state...</div>;
  if (error) return <div className="text-xl text-red-500">Error: {error}</div>;
  if (!room || !gameState) return <div className="text-xl">Room not found</div>;

  const handleCopyCode = async () => {
    if (!room?.code) return;

    try {
      await navigator.clipboard.writeText(room.code);
      setCopyState('copied');
    } catch (_error) {
      setCopyState('failed');
    }

    window.setTimeout(() => {
      setCopyState('idle');
    }, 1800);
  };

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
        <div className="w-full overflow-hidden rounded-2xl border border-gray-900 bg-black/50 px-4 py-4 shadow-inner sm:px-8 sm:py-5">
          <div className="font-mono text-4xl tracking-[0.2em] text-blue-400 sm:text-6xl sm:tracking-[0.25em]">
            {room.code}
          </div>
          <button
            type="button"
            onClick={handleCopyCode}
            className="mt-4 w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-500 active:scale-[0.99] sm:mx-auto sm:w-auto sm:min-w-36"
          >
            {copyState === 'copied'
              ? 'Copied!'
              : copyState === 'failed'
                ? 'Copy failed'
                : 'Copy Code'}
          </button>
        </div>
      </div>
    );
  }

  const board = gameState.current_board;
  const positions = getPositionsFromBoard(board);

  const myPos = myId ? (positions[myId] ?? 0) : 0;
  const oppPos = opponentId ? (positions[opponentId] ?? 0) : 0;

  const isFinished = Boolean(gameState.winner_id) || room.status === 'finished';
  const isMyTurn = gameState.current_turn === myId && !gameState.winner_id;
  const canPlay = Boolean(hostId && guestId) && !isFinished;

  const lastRoll = isPlainObject(board) ? board.last_roll : null;
  const lastMove = isPlainObject(board) ? board.last_move : null;
  const lastVia = isPlainObject(lastMove) ? lastMove.via : null;

  const handleRoll = async () => {
    if (!canPlay || !isMyTurn || !myId) return;

    const roll = rollDie();
    const { to, via } = computeMove({ from: myPos, roll });
    const winnerId = to === 100 ? myId : null;

    const nextTurn = winnerId
      ? null
      : (myId === hostId ? guestId : hostId);

    const nextBoard = {
      ...(isPlainObject(board) ? board : {}),
      positions: {
        ...positions,
        [myId]: to,
        ...(opponentId ? { [opponentId]: oppPos } : {})
      },
      last_roll: roll,
      last_mover: myId,
      last_move: {
        from: myPos,
        to,
        via
      }
    };

    const nextMoveHistory = Array.isArray(gameState.move_history)
      ? [
          ...gameState.move_history,
          {
            player_id: myId,
            roll,
            from: myPos,
            to,
            via,
            at: new Date().toISOString()
          }
        ]
      : gameState.move_history;

    let roomStatus = room.status;
    if (winnerId) roomStatus = 'finished';

    try {
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
        .eq('current_turn', myId)
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
      console.error('SnakeLadder: error rolling dice:', err.message);
      alert('Error making move: ' + err.message);
    }
  };

  const handleRematch = async () => {
    if (!room?.id || !hostId) return;

    const resetBoard = {
      positions: {
        ...(hostId ? { [hostId]: 0 } : {}),
        ...(guestId ? { [guestId]: 0 } : {})
      },
      last_roll: null,
      last_mover: null,
      last_move: null,
      started_at: new Date().toISOString()
    };

    const { error: stateResetErr } = await supabase
      .from('game_states')
      .update({
        current_board: resetBoard,
        current_turn: hostId,
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
    <div className="flex w-full max-w-2xl flex-col gap-5 sm:gap-8">
      <div className="rounded-2xl border border-gray-700 bg-gray-800 p-4 shadow-xl sm:p-6">
        <h2 className="text-xl font-extrabold sm:text-3xl">Snake &amp; Ladder</h2>
        <p className="mt-1 text-sm text-gray-400">
          {isFinished
            ? (gameState.winner_id === myId ? 'You won!' : 'Opponent won!')
            : (isMyTurn ? 'Your turn to roll.' : "Opponent's turn.")}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className={`rounded-2xl border border-gray-700 bg-gray-800 p-4 shadow-xl ${isMyTurn && !isFinished ? 'ring-2 ring-white/60' : ''}`}>
          <div className="text-xs font-bold text-gray-400">You</div>
          <div className="mt-2 text-4xl font-extrabold">{myPos}</div>
          <div className="mt-1 text-xs text-gray-400">Target: 100</div>
        </div>

        <div className={`rounded-2xl border border-gray-700 bg-gray-800 p-4 shadow-xl ${!isMyTurn && !isFinished ? 'ring-2 ring-white/20' : ''}`}>
          <div className="text-xs font-bold text-gray-400">Opponent</div>
          <div className="mt-2 text-4xl font-extrabold">{oppPos}</div>
          <div className="mt-1 text-xs text-gray-400">Target: 100</div>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-700 bg-gray-800 p-4 shadow-xl sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="text-sm font-semibold">Last roll</div>
            <div className="mt-1 text-sm text-gray-300">
              {typeof lastRoll === 'number'
                ? (
                    <span>
                      {lastRoll}
                      {lastVia ? ` (${lastVia})` : ''}
                    </span>
                  )
                : '—'}
            </div>
          </div>

          <button
            type="button"
            onClick={handleRoll}
            disabled={!canPlay || !isMyTurn}
            className="w-full rounded-xl bg-blue-600 px-4 py-3 text-lg font-bold transition hover:bg-blue-500 disabled:opacity-50 sm:w-auto"
          >
            Roll Dice
          </button>
        </div>

        {isFinished && (
          <button
            type="button"
            onClick={handleRematch}
            className="mt-4 w-full rounded-xl bg-gray-700 px-4 py-3 text-lg font-bold transition hover:bg-gray-600"
          >
            Play Again
          </button>
        )}

        {!canPlay && (
          <div className="mt-3 text-xs text-gray-400">
            Waiting for both players to join...
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-gray-700 bg-gray-800 p-4 text-sm text-gray-300 shadow-xl">
        <div className="font-semibold">How to play</div>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-gray-400">
          <li>Roll a die and move forward.</li>
          <li>Land exactly on 100 to win.</li>
          <li>Snakes bring you down; ladders take you up.</li>
        </ul>
      </div>

      <div className="rounded-2xl border border-gray-700 bg-gray-800 p-4 text-center text-xs text-gray-400 shadow-xl">
        Room code: <span className="font-mono text-blue-400">{room.code}</span>
        {isHost && (
          <button
            type="button"
            onClick={handleCopyCode}
            className="ml-3 rounded-lg bg-gray-700 px-3 py-2 text-xs font-semibold text-white transition hover:bg-gray-600"
          >
            {copyState === 'copied'
              ? 'Copied!'
              : copyState === 'failed'
                ? 'Copy failed'
                : 'Copy'}
          </button>
        )}
      </div>
    </div>
  );
}
