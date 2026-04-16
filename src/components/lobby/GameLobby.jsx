import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';

export default function GameLobby() {
  const [joinCode, setJoinCode] = useState('');
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();

  const createRoom = async () => {
    setLoading(true);
    // Simple 6 char code
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    
    try {
      // Create room in supabase
      const { data, error } = await supabase
        .from('game_rooms')
        .insert([{ code, host_id: user.id }])
        .select()
        .single();
      
      if (error) throw error;

      const { error: stateError } = await supabase
        .from('game_states')
        .insert([{
          room_id: data.id,
          current_board: [],
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

  const joinRoom = async (e) => {
    e.preventDefault();
    if (!joinCode) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('game_rooms')
        .select('id, guest_id, host_id')
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
    <div className="w-full max-w-md bg-gray-800 p-8 rounded-lg shadow-xl text-center">
      <h2 className="text-3xl font-bold mb-8">Game Lobby</h2>
      
      <div className="space-y-6">
        <div>
          <button 
            onClick={createRoom}
            disabled={loading}
            className="w-full py-4 text-xl bg-blue-600 hover:bg-blue-500 rounded-md font-bold transition disabled:opacity-50"
          >
            Create New Game
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
            className="w-full p-4 text-center text-xl bg-gray-900 border border-gray-700 rounded-md focus:outline-none focus:border-blue-500 uppercase tracking-widest"
            maxLength={6}
          />
          <button
            type="submit"
            disabled={loading || joinCode.length < 6}
            className="w-full py-4 text-xl bg-gray-700 hover:bg-gray-600 rounded-md font-bold transition disabled:opacity-50"
          >
            Join Game
          </button>
        </form>
      </div>
    </div>
  );
}
