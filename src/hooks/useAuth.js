import { useState, useEffect } from 'react';

// Hardcoded users for prototyping
const HARDCODED_USERS = {
  player1: { id: 'player1', username: 'Player One' },
  player2: { id: 'player2', username: 'Player Two' }
};

export function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check local storage for existing fake session
    const savedUser = localStorage.getItem('mock_user_id');
    if (savedUser && HARDCODED_USERS[savedUser]) {
      setUser(HARDCODED_USERS[savedUser]);
    }
    setLoading(false);
  }, []);

  const signIn = (playerId) => {
    if (HARDCODED_USERS[playerId]) {
      localStorage.setItem('mock_user_id', playerId);
      setUser(HARDCODED_USERS[playerId]);
    }
  };

  const signOut = () => {
    localStorage.removeItem('mock_user_id');
    setUser(null);
  };

  return { user, loading, signIn, signOut };
}
