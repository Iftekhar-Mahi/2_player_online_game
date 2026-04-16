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
    <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-4">
      <div className="flex justify-between w-full max-w-4xl absolute top-4 px-4 items-center">
        <h1 className="text-2xl font-bold">2-Player Game Platform</h1>
        {user && (
          <button 
            onClick={handleSignOut}
            className="text-sm bg-gray-700 hover:bg-red-600 px-3 py-1 rounded transition"
          >
            Sign Out
          </button>
        )}
      </div>
      
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        
        <Route element={<ProtectedRoute />}>
          <Route path="/" element={<GameLobby />} />
          <Route path="/room/:roomId" element={<GameRouter />} />
        </Route>
      </Routes>
    </div>
  );
}

export default App;
