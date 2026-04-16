import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useGameStore } from '../store/gameStore';

export function useRealtimeGame(roomId) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { setRoom, setGameState } = useGameStore();

  useEffect(() => {
    if (!roomId) return;

    let roomSub;
    let stateSub;
    let isMounted = true;

    const fetchSnapshot = async () => {
      try {
        const { data: roomData, error: roomError } = await supabase
          .from('game_rooms')
          .select('*')
          .eq('id', roomId)
          .single();

        if (roomError) throw roomError;
        if (!isMounted) return;
        setRoom(roomData);

        const { data: stateData, error: stateError } = await supabase
          .from('game_states')
          .select('*')
          .eq('room_id', roomId)
          .maybeSingle();

        if (stateError) throw stateError;

        if (stateData) {
          if (!isMounted) return;
          setGameState(stateData);
        } else if (roomData.host_id) {
          const { data: newState, error: insertErr } = await supabase
            .from('game_states')
            .insert([{
              room_id: roomId,
              current_board: [],
              current_turn: roomData.host_id
            }])
            .select()
            .single();

          if (insertErr && insertErr.code !== '23505') throw insertErr;

          if (newState && isMounted) {
            setGameState(newState);
          }
        }

        if (isMounted) {
          setError(null);
        }
      } catch (err) {
        if (isMounted) {
          setError(err.message);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    // Subscribe to room changes (e.g. guest joining)
    roomSub = supabase.channel(`room_changes_${roomId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'game_rooms',
        filter: `id=eq.${roomId}`
      }, async (payload) => {
        if (payload.new && Object.keys(payload.new).length > 0) {
          setRoom(payload.new);
        }
        await fetchSnapshot();
      }).subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          fetchSnapshot();
        }
      });

    // Subscribe to game state changes (moves, wins, turns)
    stateSub = supabase.channel(`state_changes_${roomId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'game_states',
        filter: `room_id=eq.${roomId}`
      }, async (payload) => {
        if (payload.new && Object.keys(payload.new).length > 0) {
          setGameState(payload.new);
        }
        await fetchSnapshot();
      }).subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          fetchSnapshot();
        }
      });

    fetchSnapshot();

    return () => {
      isMounted = false;
      supabase.removeChannel(roomSub);
      supabase.removeChannel(stateSub);
    };
  }, [roomId, setRoom, setGameState]);

  return { loading, error };
}
