import { createContext, createElement, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext(null);
const USERNAME_EMAIL_DOMAIN = 'players.local';

const normalizeUsername = (value) => value.trim().toLowerCase();

const isValidUsername = (value) => /^[a-z0-9_]{3,24}$/.test(value);

const usernameToAuthEmail = (username) => `${username}@${USERNAME_EMAIL_DOMAIN}`;

const mapAuthError = (error, normalizedUsername) => {
  const message = error?.message?.toLowerCase() ?? '';

  if (
    message.includes('already registered') ||
    message.includes('user already registered') ||
    message.includes('duplicate key') ||
    message.includes('already been registered')
  ) {
    return new Error(`The username "${normalizedUsername}" is already taken.`);
  }

  if (message.includes('invalid login credentials')) {
    return new Error('Invalid username or password.');
  }

  return error;
};

const buildFallbackUsername = (authUser) => {
  const metadataName = normalizeUsername(authUser?.user_metadata?.username ?? '');

  if (metadataName) {
    return metadataName;
  }

  if (authUser?.email) {
    return normalizeUsername(authUser.email.split('@')[0]);
  }

  return 'player';
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = async (authUser) => {
    if (!authUser) {
      setProfile(null);
      return null;
    }

    const { data: existingProfile, error: fetchError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', authUser.id)
      .maybeSingle();

    if (fetchError) {
      throw fetchError;
    }

    if (existingProfile) {
      setProfile(existingProfile);
      return existingProfile;
    }

    const fallbackProfile = {
      id: authUser.id,
      email: authUser.email,
      username: buildFallbackUsername(authUser)
    };

    const { data: createdProfile, error: upsertError } = await supabase
      .from('profiles')
      .upsert(fallbackProfile, { onConflict: 'id' })
      .select()
      .single();

    if (upsertError) {
      throw upsertError;
    }

    setProfile(createdProfile);
    return createdProfile;
  };

  useEffect(() => {
    let isMounted = true;

    const syncAuthState = async (session) => {
      const authUser = session?.user ?? null;

      if (!isMounted) {
        return;
      }

      setUser(authUser);

      if (!authUser) {
        setProfile(null);
        setLoading(false);
        return;
      }

      setLoading(true);

      try {
        await loadProfile(authUser);
      } catch (error) {
        console.error('Failed to load profile:', error.message);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    supabase.auth.getSession().then(({ data }) => {
      syncAuthState(data.session);
    });

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, session) => {
      syncAuthState(session);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signUp = async ({ username, password }) => {
    setLoading(true);
    const normalizedUsername = normalizeUsername(username);

    if (!isValidUsername(normalizedUsername)) {
      setLoading(false);
      throw new Error('Username must be 3-24 characters and use only letters, numbers, or underscores.');
    }

    const email = usernameToAuthEmail(normalizedUsername);

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          username: normalizedUsername
        }
      }
    });

    if (error) {
      setLoading(false);
      throw mapAuthError(error, normalizedUsername);
    }

    if (data.session?.user) {
      setUser(data.session.user);
      try {
        await loadProfile(data.session.user);
      } finally {
        setLoading(false);
      }
    } else {
      setLoading(false);
    }

    return data;
  };

  const signIn = async ({ username, password }) => {
    setLoading(true);
    const normalizedUsername = normalizeUsername(username);

    if (!isValidUsername(normalizedUsername)) {
      setLoading(false);
      throw new Error('Enter the username you registered with.');
    }

    const email = usernameToAuthEmail(normalizedUsername);

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      setLoading(false);
      throw mapAuthError(error, normalizedUsername);
    }

    setUser(data.user);

    try {
      await loadProfile(data.user);
    } finally {
      setLoading(false);
    }

    return data;
  };

  const signOut = async () => {
    setLoading(true);

    const { error } = await supabase.auth.signOut();

    if (error) {
      setLoading(false);
      throw error;
    }

    setUser(null);
    setProfile(null);
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
