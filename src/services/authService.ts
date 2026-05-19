import type { AuthChangeEvent, Session, Subscription, User } from '@supabase/supabase-js';

import { getSupabaseClient } from './supabaseClient';

type AuthStateChangeCallback = (event: AuthChangeEvent, session: Session | null) => void;

type AuthResult = {
  error: string | null;
  session: Session | null;
  user: User | null;
};

function getAuthUnavailableResult(): AuthResult {
  return {
    error: 'Auth backend is not configured.',
    session: null,
    user: null,
  };
}

export async function getCurrentSession(): Promise<Session | null> {
  const supabase = getSupabaseClient();

  if (!supabase) {
    return null;
  }

  try {
    const { data, error } = await supabase.auth.getSession();

    if (error) {
      console.log('authService getCurrentSession error:', error.message);
      return null;
    }

    return data.session ?? null;
  } catch (error) {
    console.log('authService getCurrentSession unexpected error:', error);
    return null;
  }
}

export async function getCurrentUser(): Promise<User | null> {
  const supabase = getSupabaseClient();

  if (!supabase) {
    return null;
  }

  try {
    const { data, error } = await supabase.auth.getUser();

    if (error) {
      console.log('authService getCurrentUser error:', error.message);
      return null;
    }

    return data.user ?? null;
  } catch (error) {
    console.log('authService getCurrentUser unexpected error:', error);
    return null;
  }
}

export async function signUpWithEmail(email: string, password: string): Promise<AuthResult> {
  const supabase = getSupabaseClient();

  if (!supabase) {
    return getAuthUnavailableResult();
  }

  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    return {
      error: error?.message ?? null,
      session: data.session ?? null,
      user: data.user ?? null,
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Unknown sign up error',
      session: null,
      user: null,
    };
  }
}

export async function signInWithEmail(email: string, password: string): Promise<AuthResult> {
  const supabase = getSupabaseClient();

  if (!supabase) {
    return getAuthUnavailableResult();
  }

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    return {
      error: error?.message ?? null,
      session: data.session ?? null,
      user: data.user ?? null,
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Unknown sign in error',
      session: null,
      user: null,
    };
  }
}

export async function signOut(): Promise<{ error: string | null; success: boolean }> {
  const supabase = getSupabaseClient();

  if (!supabase) {
    return {
      error: null,
      success: true,
    };
  }

  try {
    const { error } = await supabase.auth.signOut();

    return {
      error: error?.message ?? null,
      success: error == null,
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Unknown sign out error',
      success: false,
    };
  }
}

export function onAuthStateChange(callback: AuthStateChangeCallback): () => void {
  const supabase = getSupabaseClient();

  if (!supabase) {
    return () => undefined;
  }

  const {
    data: { subscription },
  }: { data: { subscription: Subscription } } = supabase.auth.onAuthStateChange(callback);

  return () => {
    subscription.unsubscribe();
  };
}
