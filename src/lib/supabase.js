import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase URL or Anon Key is missing. Check your .env.local file.')
}

const isDev = import.meta.env.DEV

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-key',
  {
    realtime: {
      params: {
        eventsPerSecond: 10,
      },
    },
    // Enables useful client logs while debugging locally.
    logger: isDev ? (message, ...args) => console.log('SUPABASE:', message, ...args) : undefined,
  }
)

// Optional: enable websocket-level realtime logs in any environment.
// In the browser console: localStorage.DEBUG_REALTIME = '1' (then reload)
try {
  const enableRealtimeDebug = localStorage.getItem('DEBUG_REALTIME') === '1'
  if (enableRealtimeDebug) {
    supabase.realtime.onOpen(() => console.log('SUPABASE: realtime ws open'))
    supabase.realtime.onClose((event) => console.log('SUPABASE: realtime ws close', event))
    supabase.realtime.onError((event) => console.log('SUPABASE: realtime ws error', event))
  }
} catch (_err) {
  // ignore (e.g. storage blocked)
}
