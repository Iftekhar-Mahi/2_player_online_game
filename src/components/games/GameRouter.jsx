import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import Drop4Game from './drop4/Drop4Game';
import SnakeLadderGame from './snakeLadder/SnakeLadderGame';
import CheckersGame from './checkers/CheckersGame';

export default function GameRouter() {
  const { roomId } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [gameType, setGameType] = useState(null);

  useEffect(() => {
    const fetchRoomType = async () => {
      try {
        const { data: roomData, error: roomError } = await supabase
          .from('game_rooms')
          .select('game_type, status, code')
          .eq('id', roomId)
          .single();

        if (roomError) throw roomError;
        setGameType(roomData?.game_type || 'drop4');
        
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

  if (gameType === 'snake_ladder') return <SnakeLadderGame />;
  if (gameType === 'checkers') return <CheckersGame />;
  return <Drop4Game />;
}