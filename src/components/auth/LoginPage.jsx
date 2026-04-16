import { useAuth } from '../../hooks/useAuth';

export default function LoginPage() {
  const { signIn } = useAuth();
  
  const handleLogin = (playerId) => {
    signIn(playerId);
    window.location.href = '/'; // Force a full page reload so all components pick up the new auth state
  };
  
  return (
    <div className="flex flex-col items-center justify-center p-8 bg-gray-800 rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold mb-4">Select Player</h2>
      <p className="text-gray-400 mb-6 text-center max-w-sm">
        For prototyping, select your identity to connect to the game system.
      </p>
      
      <div className="flex flex-col gap-4 w-full">
        <button 
          onClick={() => handleLogin('player1')}
          className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-semibold transition"
        >
          Login as Player 1
        </button>

        <button 
          onClick={() => handleLogin('player2')}
          className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-md font-semibold transition"
        >
          Login as Player 2
        </button>
      </div>
    </div>
  );
}
