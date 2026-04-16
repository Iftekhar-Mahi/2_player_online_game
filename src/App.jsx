import { Routes, Route } from 'react-router-dom';
import LoginPage from './components/auth/LoginPage';
import ProtectedRoute from './components/auth/ProtectedRoute';
import { useAuth } from './hooks/useAuth';

import GameLobby from './components/lobby/GameLobby';
import GameRouter from './components/games/GameRouter';

function App() {
  const { user, signOut } = useAuth();
  
  const handleSignOut = () => {
    signOut();
    window.location.href = '/login'; // Force reload to clear state and route properly
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white px-3 py-4 sm:px-4 sm:py-6 safe-bottom">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
        <div className="flex flex-col gap-3 rounded-2xl border border-gray-800 bg-gray-950/60 px-4 py-3 shadow-lg backdrop-blur sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <h1 className="text-lg font-bold leading-tight sm:text-2xl">2-Player Game Platform</h1>
        {user && (
          <button 
            onClick={handleSignOut}
            className="w-full rounded-lg bg-gray-700 px-3 py-2 text-sm font-medium transition hover:bg-red-600 sm:w-auto"
          >
            Sign Out
          </button>
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
