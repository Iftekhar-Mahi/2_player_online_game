import { useEffect, useMemo, useRef, useState } from 'react';
import { Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import LoginPage from './components/auth/LoginPage';
import ProtectedRoute from './components/auth/ProtectedRoute';
import { useAuth } from './hooks/useAuth';

import GameLobby from './components/lobby/GameLobby';
import GameRouter from './components/games/GameRouter';

function App() {
  const { user, profile, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef(null);

  const pathname = location.pathname;
  const isLobbyPage = pathname === '/';
  const isRoomPage = pathname.startsWith('/room/');

  useEffect(() => {
    setIsProfileMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!isProfileMenuOpen) return;

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setIsProfileMenuOpen(false);
    };

    const handlePointerDown = (event) => {
      if (!profileMenuRef.current) return;
      if (!profileMenuRef.current.contains(event.target)) {
        setIsProfileMenuOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('touchstart', handlePointerDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('touchstart', handlePointerDown);
    };
  }, [isProfileMenuOpen]);

  const profileInitials = useMemo(() => {
    const raw = profile?.username || user?.username || user?.email || '';
    const value = raw.trim();
    if (!value) return 'P';

    const parts = value
      .replace(/[^a-zA-Z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(Boolean);

    const first = parts[0]?.[0] || value[0];
    const second = parts[1]?.[0] || value[1] || '';
    return (first + second).toUpperCase();
  }, [profile?.username, user?.username, user?.email]);
  
  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      alert('Failed to sign out: ' + error.message);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white px-3 py-4 sm:px-4 sm:py-6 safe-bottom">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
        <div className={`flex flex-col gap-3 rounded-2xl border border-gray-800 bg-gray-950/60 px-4 py-3 shadow-lg backdrop-blur sm:flex-row sm:items-center sm:px-5 ${isLobbyPage ? 'relative sm:justify-end' : 'sm:justify-between'}`}>
          <div className={isLobbyPage ? 'sm:absolute sm:left-1/2 sm:-translate-x-1/2' : 'min-w-0'}>
            <h1 className="text-lg font-bold leading-tight sm:text-2xl">LinkUp Arcade</h1>
          </div>

          {user && isRoomPage && (
            <button
              type="button"
              onClick={() => navigate('/')}
              className="rounded-lg bg-gray-700 px-3 py-2 text-sm font-medium transition hover:bg-gray-600 whitespace-nowrap"
            >
              Back
            </button>
          )}

          {user && isLobbyPage && (
            <div className="relative sm:ml-auto" ref={profileMenuRef}>
              <button
                type="button"
                aria-label="Open profile menu"
                onClick={() => setIsProfileMenuOpen((prev) => !prev)}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-gray-800 bg-gray-900 text-sm font-semibold text-gray-200 transition hover:bg-gray-800"
              >
                {profileInitials}
              </button>

              {isProfileMenuOpen && (
                <div className="absolute right-0 z-50 mt-2 w-64 overflow-hidden rounded-2xl border border-gray-800 bg-gray-950 shadow-lg">
                  <div className="px-4 py-3">
                    <p className="truncate text-sm font-semibold text-white">
                      {profile?.username || user?.username || 'player'}
                    </p>
                    <p className="truncate text-xs text-gray-400">{user?.email || '—'}</p>
                  </div>
                  <div className="border-t border-gray-800 px-3 py-3">
                    <button
                      type="button"
                      onClick={async () => {
                        setIsProfileMenuOpen(false);
                        await handleSignOut();
                      }}
                      className="w-full rounded-lg bg-gray-700 px-3 py-2 text-sm font-medium transition hover:bg-red-600"
                    >
                      Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <main className="flex min-h-[calc(100vh-7rem)] items-center justify-center sm:min-h-[calc(100vh-8rem)]">
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            
            <Route element={<ProtectedRoute />}>
              <Route path="/" element={<GameLobby />} />
              <Route path="/room/:roomId" element={<GameRouter />} />
            </Route>
          </Routes>
        </main>
      </div>
    </div>
  );
}

export default App;
