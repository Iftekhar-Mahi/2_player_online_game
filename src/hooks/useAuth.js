import { createContext, createElement, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext(null);

const buildFallbackUsername = (authUser) => {
  const metadataName = authUser?.user_metadata?.username?.trim();

  if (metadataName) {
    return metadataName;
  }

  if (authUser?.email) {
    return authUser.email.split('@')[0];
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

  const signUp = async ({ email, password, username }) => {
    setLoading(true);

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          username
        }
      }
    });

    if (error) {
      setLoading(false);
      throw error;
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

  const signIn = async ({ email, password }) => {
    setLoading(true);

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      setLoading(false);
      throw error;
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
        signOut
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
