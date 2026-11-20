import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

/**
 * Connection to the backend (Supabase: accounts + Postgres + live updates).
 * Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_KEY in .env.local
 * (see .env.example). The key is the *publishable* (anon) key: it is safe in the
 * app because row-level security only lets people reach their own rows.
 * Without them the app still works for reading; accounts and notes are off.
 */
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_KEY;

const REQUEST_TIMEOUT_MS = 20_000;

/**
 * fetch that gives up after 20 s. On a bad connection a request can hang
 * forever instead of failing; this turns it into an error so the sync code
 * marks itself offline and retries later.
 */
const fetchWithTimeout: typeof fetch = (input, init) => {
  if (init?.signal) return fetch(input, init); // caller manages its own cancelling
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  return fetch(input, { ...init, signal: controller.signal }).finally(() => clearTimeout(timer));
};

export const supabase =
  url && key
    ? createClient(url, key, {
        global: { fetch: fetchWithTimeout },
        auth: {
          storage: AsyncStorage,
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: false,
        },
      })
    : null;

// Phones: only refresh the sign-in token while the app is open.
if (supabase && Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}
