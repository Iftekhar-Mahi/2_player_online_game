import { createContext, createElement, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext(null);
const SESSION_TOKEN_KEY = 'app_session_token';

const normalizeUsername = (value) => value.trim().toLowerCase();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const setAuthUser = (authRow) => {
    if (!authRow) {
      setUser(null);
      setProfile(null);
      return;
    }

    const nextUser = {
      id: authRow.user_id,
      email: authRow.email,
      username: authRow.username
    };

    setUser(nextUser);
    setProfile(nextUser);
  };

  useEffect(() => {
    let isMounted = true;

    const restoreSession = async () => {
      const token = localStorage.getItem(SESSION_TOKEN_KEY);

      if (!token) {
        if (isMounted) setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .rpc('app_validate_session', { p_token: token })
        .maybeSingle();

      if (!isMounted) return;

      if (error || !data) {
        localStorage.removeItem(SESSION_TOKEN_KEY);
        setAuthUser(null);
        setLoading(false);
        return;
      }

      setAuthUser(data);
      setLoading(false);
    };

    restoreSession();

    return () => {
      isMounted = false;
    };
  }, []);

  const signUp = async ({ email, username, password }) => {
    setLoading(true);

    const normalizedUsername = normalizeUsername(username);

    const { error: registerError } = await supabase.rpc('app_register', {
      p_email: email.trim().toLowerCase(),
      p_username: normalizedUsername,
      p_password: password
    });

    if (registerError) {
      setLoading(false);
      throw new Error(registerError.message);
    }

    const loginData = await signIn({ email, password });
    return { session: true, user: loginData.user };
  };

  const signIn = async ({ email, password }) => {
    setLoading(true);

    const { data, error } = await supabase
      .rpc('app_login', {
        p_email: email.trim().toLowerCase(),
        p_password: password
      })
      .single();

    if (error || !data) {
      setLoading(false);
      throw new Error(error?.message || 'Invalid email or password.');
    }

    localStorage.setItem(SESSION_TOKEN_KEY, data.token);
    setAuthUser(data);
    setLoading(false);

    return {
      user: {
        id: data.user_id,
        email: data.email,
        username: data.username
      }
    };
  };

  const signOut = async () => {
    setLoading(true);
    const token = localStorage.getItem(SESSION_TOKEN_KEY);

    if (token) {
      await supabase.rpc('app_logout', { p_token: token });
    }

    localStorage.removeItem(SESSION_TOKEN_KEY);
    setAuthUser(null);
    setLoading(false);
  };

  return createElement(
    AuthContext.Provider,
    {
      value: {
        user,
        profile,
        loading,
        signIn,
        signUp,
        signOut,
        normalizeUsername
      }
    },
    children
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  return context;
}
