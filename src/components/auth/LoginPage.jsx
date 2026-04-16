import { useAuth } from '../../hooks/useAuth';

export default function LoginPage() {
  const { signIn } = useAuth();
  
  const handleLogin = (playerId) => {
    signIn(playerId);
    window.location.href = '/'; // Force a full page reload so all components pick up the new auth state
  };
  
  return (
    <div className="w-full max-w-md rounded-3xl border border-gray-700 bg-gray-800 p-5 shadow-xl sm:p-8">
      <h2 className="mb-3 text-center text-2xl font-bold sm:text-3xl">Select Player</h2>
      <p className="mx-auto mb-6 max-w-sm text-center text-sm text-gray-400 sm:text-base">
        For prototyping, select your identity to connect to the game system.
      </p>
      
      <div className="flex flex-col gap-4 w-full">
        <button 
          onClick={() => handleLogin('player1')}
          className="rounded-xl bg-blue-600 px-6 py-3.5 text-base font-semibold text-white transition hover:bg-blue-700 active:scale-[0.99]"
        >
          Login as Player 1
        </button>

        <button 
          onClick={() => handleLogin('player2')}
          className="rounded-xl bg-green-600 px-6 py-3.5 text-base font-semibold text-white transition hover:bg-green-700 active:scale-[0.99]"
        >
          Login as Player 2
        </button>
      </div>
    </div>
  );
}
