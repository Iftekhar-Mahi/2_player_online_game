import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useGameStore } from '../../store/gameStore';
import { supabase } from '../../lib/supabase';
import Drop4Game from './drop4/Drop4Game';

export default function GameRouter() {
  const { roomId } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchRoomType = async () => {
      try {
        const { data: roomData, error: roomError } = await supabase
          .from('game_rooms')
          .select('game_type, status, code')
          .eq('id', roomId)
          .single();

        if (roomError) throw roomError;
        
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchRoomType();
  }, [roomId]);

  if (loading) return <div className="text-xl">Locating room...</div>;
  if (error) return <div className="text-xl text-red-500">Error: {error}</div>;

  // We are strictly doing Drop4 according to architecture, but this could be a switch statement or object dictionary later.
  return <Drop4Game />;
}