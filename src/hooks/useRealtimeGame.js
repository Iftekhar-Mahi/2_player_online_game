import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useGameStore } from '../store/gameStore';
import { createInitialBoard as createInitialCheckersBoard } from '../components/games/checkers/checkersLogic';

const TERMINAL_STATUSES = new Set(['CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED']);

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

  if (gameType === 'checkers') {
    return createInitialCheckersBoard();
  }

  return [];
};

export function useRealtimeGame(roomId) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [roomChannelStatus, setRoomChannelStatus] = useState('INIT');
  const [stateChannelStatus, setStateChannelStatus] = useState('INIT');
  const [lastEventAt, setLastEventAt] = useState(null);

  const { setRoom, setGameState } = useGameStore();

  const debugLabel = useMemo(() => `realtime(room:${roomId || 'none'})`, [roomId]);

  const fetchInFlightRef = useRef(false);
  const pollTimerRef = useRef(null);

  // Refs used inside timers/callbacks to avoid stale closure issues.
  const roomStatusRef = useRef('INIT');
  const stateStatusRef = useRef('INIT');

  useEffect(() => {
    if (!roomId) return;

    let roomSub;
    let stateSub;
    let isMounted = true;

    const stopPolling = () => {
      if (pollTimerRef.current) {
        window.clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };

    const maybeStopPolling = () => {
      if (roomStatusRef.current === 'SUBSCRIBED' && stateStatusRef.current === 'SUBSCRIBED') {
        stopPolling();
      }
    };

    const startPolling = () => {
      if (pollTimerRef.current) return;

      // Fetch immediately so the UI updates without waiting for the first interval tick.
      fetchSnapshot();

      pollTimerRef.current = window.setInterval(() => {
        fetchSnapshot();
      }, 2000);

      console.warn(`${debugLabel}: falling back to polling (2s) because realtime is not subscribed.`);
    };

    const fetchSnapshot = async () => {
      if (fetchInFlightRef.current) return;
      fetchInFlightRef.current = true;

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
            .insert([
              {
                room_id: roomId,
                current_board: getInitialBoardForGame(roomData.game_type, roomData.host_id, roomData.guest_id),
                current_turn: roomData.host_id
              }
            ])
            .select()
            .single();

          // Unique constraint race (someone else inserted first)
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
          setError(err?.message || String(err));
        }
      } finally {
        fetchInFlightRef.current = false;
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    const onRoomChange = async (payload) => {
      setLastEventAt(new Date().toISOString());
      if (payload?.new && Object.keys(payload.new).length > 0) {
        setRoom(payload.new);
      }
      await fetchSnapshot();
    };

    const onStateChange = async (payload) => {
      setLastEventAt(new Date().toISOString());
      if (payload?.new && Object.keys(payload.new).length > 0) {
        setGameState(payload.new);
      }
      await fetchSnapshot();
    };

    roomSub = supabase
      .channel(`room_changes_${roomId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'game_rooms',
          filter: `id=eq.${roomId}`
        },
        onRoomChange
      )
      .subscribe((status) => {
        if (!isMounted) return;
        roomStatusRef.current = status;
        setRoomChannelStatus(status);
        console.log(`${debugLabel}: room channel -> ${status}`);

        if (status === 'SUBSCRIBED') {
          maybeStopPolling();
          fetchSnapshot();
        } else if (TERMINAL_STATUSES.has(status)) {
          startPolling();
        }
      });

    stateSub = supabase
      .channel(`state_changes_${roomId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'game_states',
          filter: `room_id=eq.${roomId}`
        },
        onStateChange
      )
      .subscribe((status) => {
        if (!isMounted) return;
        stateStatusRef.current = status;
        setStateChannelStatus(status);
        console.log(`${debugLabel}: state channel -> ${status}`);

        if (status === 'SUBSCRIBED') {
          maybeStopPolling();
          fetchSnapshot();
        } else if (TERMINAL_STATUSES.has(status)) {
          startPolling();
        }
      });

    // Initial snapshot, and also refresh when tab becomes active (mobile browsers suspend websockets).
    fetchSnapshot();
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        fetchSnapshot();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    // If we never manage to subscribe within ~8s, start polling.
    const subscribeGuard = window.setTimeout(() => {
      if (!isMounted) return;
      if (roomStatusRef.current !== 'SUBSCRIBED' || stateStatusRef.current !== 'SUBSCRIBED') {
        startPolling();
      }
    }, 8000);

    return () => {
      isMounted = false;
      window.clearTimeout(subscribeGuard);
      document.removeEventListener('visibilitychange', onVisibility);
      stopPolling();

      if (roomSub) supabase.removeChannel(roomSub);
      if (stateSub) supabase.removeChannel(stateSub);
    };
    // Intentionally exclude channel status setters from deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, setRoom, setGameState]);

  return {
    loading,
    error,
    roomChannelStatus,
    stateChannelStatus,
    lastEventAt
  };
}
