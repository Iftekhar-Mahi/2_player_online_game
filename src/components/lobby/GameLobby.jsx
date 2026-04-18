import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';

export default function GameLobby() {
  const [joinCode, setJoinCode] = useState('');
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();

  const getInitialBoardForGame = (gameType, hostId, guestId = null) => {
    if (gameType === 'snake_ladder') {
      const positions = {};
      if (hostId) positions[hostId] = 0;
      if (guestId) positions[guestId] = 0;

      return {
        positions,
        last_roll: null,
        last_mover: null,
        last_move: null,
        started_at: new Date().toISOString()
      };
    }

    // drop4
    return [];
  };

  const createRoom = async (gameType) => {
    setLoading(true);
    // Simple 6 char code
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    
    try {
      // Create room in supabase
      const { data, error } = await supabase
        .from('game_rooms')
        .insert([{ code, host_id: user.id, game_type: gameType }])
        .select()
        .single();
      
      if (error) throw error;

      const { error: stateError } = await supabase
        .from('game_states')
        .insert([{
          room_id: data.id,
          current_board: getInitialBoardForGame(gameType, user.id),
          current_turn: user.id,
          winner_id: null,
          move_history: []
        }]);

      if (stateError && stateError.code !== '23505') {
        throw stateError;
      }
      
      navigate(`/room/${data.id}`);
    } catch (err) {
      console.error(err);
      alert('Failed to create room: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const ensureSnakeLadderGuestInitialized = async ({ roomId, hostId, guestId }) => {
    if (!roomId || !hostId || !guestId) return;

    const { data: stateData, error: stateErr } = await supabase
      .from('game_states')
      .select('current_board')
      .eq('room_id', roomId)
      .maybeSingle();

    if (stateErr) throw stateErr;
    if (!stateData) return;

    const board = stateData.current_board;
    const positions = board && typeof board === 'object' && !Array.isArray(board) && board.positions && typeof board.positions === 'object'
      ? board.positions
      : {};

    const hasHost = Object.prototype.hasOwnProperty.call(positions, hostId);
    const hasGuest = Object.prototype.hasOwnProperty.call(positions, guestId);

    if (hasHost && hasGuest) return;

    const nextBoard = {
      ...(board && typeof board === 'object' && !Array.isArray(board) ? board : {}),
      positions: {
        ...positions,
        [hostId]: hasHost ? positions[hostId] : 0,
        [guestId]: hasGuest ? positions[guestId] : 0
      }
    };

    const { error: updateErr } = await supabase
      .from('game_states')
      .update({
        current_board: nextBoard,
        updated_at: new Date().toISOString()
      })
      .eq('room_id', roomId);

    if (updateErr) throw updateErr;
  };

  const joinRoom = async (e) => {
    e.preventDefault();
    if (!joinCode) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('game_rooms')
        .select('id, guest_id, host_id, game_type')
        .eq('code', joinCode.toUpperCase())
        .single();
        
      if (error || !data) throw new Error('Room not found');
      if (data.guest_id && data.guest_id !== user.id && data.host_id !== user.id) {
        throw new Error('Room is full');
      }

      // If we are not host and there's no guest, join as guest
      if (data.host_id !== user.id && !data.guest_id) {
        const { error: updateErr } = await supabase
          .from('game_rooms')
          .update({ guest_id: user.id, status: 'active' })
          .eq('id', data.id);
          
        if (updateErr) throw updateErr;

        if (data.game_type === 'snake_ladder') {
          await ensureSnakeLadderGuestInitialized({
            roomId: data.id,
            hostId: data.host_id,
            guestId: user.id
          });
        }
      }

      navigate(`/room/${data.id}`);
    } catch (err) {
      console.error(err);
      alert('Failed to join room: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md rounded-3xl border border-gray-700 bg-gray-800 p-5 text-center shadow-xl sm:p-8">
      <h2 className="mb-3 text-3xl font-bold sm:mb-8">Game Lobby</h2>
      <p className="mb-6 text-sm text-gray-400 sm:hidden">Create a room or enter a code to join from your phone.</p>
      
      <div className="space-y-6">
        <div className="space-y-3">
          <button 
            onClick={() => createRoom('drop4')}
            disabled={loading}
            className="w-full rounded-xl bg-blue-600 py-3.5 text-lg font-bold transition hover:bg-blue-500 disabled:opacity-50 sm:py-4 sm:text-xl"
          >
            Connect 4
          </button>
          <button 
            onClick={() => createRoom('snake_ladder')}
            disabled={loading}
            className="w-full rounded-xl bg-gray-700 py-3.5 text-lg font-bold transition hover:bg-gray-600 disabled:opacity-50 sm:py-4 sm:text-xl"
          >
            Snake &amp; Ladder
          </button>
        </div>

        <div className="relative flex items-center py-5">
          <div className="flex-grow border-t border-gray-600"></div>
          <span className="flex-shrink-0 mx-4 text-gray-400">OR</span>
          <div className="flex-grow border-t border-gray-600"></div>
        </div>

        <form onSubmit={joinRoom} className="space-y-4">
          <input
            type="text"
            placeholder="Enter Room Code"
            value={joinCode}
            onChange={e => setJoinCode(e.target.value)}
            className="w-full rounded-xl border border-gray-700 bg-gray-900 p-4 text-center text-lg uppercase tracking-[0.35em] focus:border-blue-500 focus:outline-none sm:text-xl"
            maxLength={6}
            inputMode="text"
            autoCapitalize="characters"
            autoCorrect="off"
          />
          <button
            type="submit"
            disabled={loading || joinCode.length < 6}
            className="w-full rounded-xl bg-gray-700 py-3.5 text-lg font-bold transition hover:bg-gray-600 disabled:opacity-50 sm:py-4 sm:text-xl"
          >
            Join Game
          </button>
        </form>
      </div>
    </div>
  );
}
