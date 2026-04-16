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

    const fetchInitialData = async () => {
      try {
        const { data: roomData, error: roomError } = await supabase
          .from('game_rooms')
          .select('*')
          .eq('id', roomId)
          .single();

        if (roomError) throw roomError;
        setRoom(roomData);

        const { data: stateData, error: stateError } = await supabase
          .from('game_states')
          .select('*')
          .eq('room_id', roomId);

        if (stateError) throw stateError;

        // Create game state record if missing (on host creation)
        if (stateData.length === 0 && roomData.host_id) {
          // Additional safety check to prevent duplicated attempts in StrictMode
          const { data: verifyData } = await supabase
            .from('game_states')
            .select('id')
            .eq('room_id', roomId)
            .single();

          if (!verifyData) {
            const { data: newState, error: insertErr } = await supabase
              .from('game_states')
              .insert([{
                room_id: roomId,
                current_board: [], 
                current_turn: roomData.host_id
              }])
              .select()
              .single();

            if (insertErr && insertErr.code !== '23505') throw insertErr; // ignore duplicate key constraint safely
            
            if (newState) {
              setGameState(newState);
            }
          }
        } else if (stateData.length > 0) {
          setGameState(stateData[0]);
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchInitialData();

    // Subscribe to room changes (e.g. guest joining)
    roomSub = supabase.channel(`room_changes_${roomId}`)
      .on('postgres_changes', {
        event: '*', // Listen to all events just in case
        schema: 'public',
        table: 'game_rooms',
        filter: `id=eq.${roomId}`
      }, (payload) => {
        console.log('Room changed!', payload);
        if (payload.new && Object.keys(payload.new).length > 0) {
          setRoom(payload.new);
        }
      }).subscribe((status) => {
        console.log(`Room Channel status:`, status);
      });

    // Subscribe to game state changes (moves, wins, turns)
    stateSub = supabase.channel(`state_changes_${roomId}`)
      .on('postgres_changes', {
        event: '*', // Listen to all events 
        schema: 'public',
        table: 'game_states',
        filter: `room_id=eq.${roomId}`
      }, (payload) => {
        console.log('Game state changed!', payload);
        if (payload.new && Object.keys(payload.new).length > 0) {
          setGameState(payload.new);
        }
      }).subscribe((status) => {
        console.log(`State Channel status:`, status);
      });

    return () => {
      supabase.removeChannel(roomSub);
      supabase.removeChannel(stateSub);
    };
  }, [roomId, setRoom, setGameState]);

  return { loading, error };
}