import type { Session } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react';

import { supabase } from './supabase';
import { UserStore, type StoreState } from './user-store';

/**
 * Who is signed in, plus their synced data store.
 * `configured` is false when no backend is set up (.env.local missing).
 */
type Account = {
  configured: boolean;
  /** undefined while checking for a saved sign-in. */
  session: Session | null | undefined;
  store: UserStore | null;
  signIn: (email: string, password: string) => Promise<string | null>;
  signUp: (email: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
};

const Context = createContext<Account | null>(null);

export function AccountProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null | undefined>(supabase ? undefined : null);
  const userId = session?.user.id;
  // One store per signed-in user; replaced on sign-in/out.
  const store = useMemo(() => (supabase && userId ? new UserStore(supabase, userId) : null), [userId]);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!store) return;
    void store.start();
    return () => store.stop();
  }, [store]);

  const value = useMemo<Account>(
    () => ({
      configured: !!supabase,
      session,
      store,
      signIn: async (email, password) => {
        if (!supabase) return 'Accounts are not set up yet.';
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        return error ? friendlyError(error.message) : null;
      },
      signUp: async (email, password) => {
        if (!supabase) return 'Accounts are not set up yet.';
        const { data, error } = await supabase.auth.signUp({ email: email.trim(), password });
        if (error) return friendlyError(error.message);
        if (!data.session) return 'Check your email to confirm your account, then sign in.';
        return null;
      },
      signOut: async () => {
        await supabase?.auth.signOut();
      },
    }),
    [session, store],
  );

  return <Context.Provider value={value}>{children}</Context.Provider>;
}

function friendlyError(message: string) {
  if (/invalid login credentials/i.test(message)) return 'That email and password don’t match an account.';
  if (/already registered/i.test(message)) return 'There is already an account with that email. Try signing in.';
  if (/fetch|network/i.test(message)) return 'Can’t reach the server. Check your connection and try again.';
  return message;
}

export function useAccount(): Account {
  const value = useContext(Context);
  if (!value) throw new Error('useAccount must be used inside AccountProvider');
  return value;
}

const EMPTY_STATE: StoreState = {
  notes: {},
  documents: {},
  highlights: {},
  reading: null,
  lastPulled: null,
  outbox: [],
  status: 'loading',
};
const noop = () => () => {};

/** The signed-in user's synced data (empty when signed out). Re-renders on every change. */
export function useStoreState(): StoreState {
  const { store } = useAccount();
  return useSyncExternalStore(
    store?.subscribe ?? noop,
    store?.getState ?? (() => EMPTY_STATE),
    store?.getState ?? (() => EMPTY_STATE),
  );
}
