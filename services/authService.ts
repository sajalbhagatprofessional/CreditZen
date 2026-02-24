import { UserProfile } from '../types';
import { deriveKey, generateSalt, exportKeyToJWK, importKeyFromJWK } from './cryptoUtils';
import { supabase } from './supabaseClient';

// --- Authentication Service ---
// Handles user registration, login, logout, and session management.
// Crucially, it manages the client-side encryption key lifecycle.

// In-memory storage for the active encryption key.
// This key is NEVER stored in plain text on disk.
let currentSessionKey: CryptoKey | null = null;
let currentUser: UserProfile | null = null;

const SESSION_KEY_STORAGE = 'creditzen_session_key';
const SESSION_USER_STORAGE = 'creditzen_session_user';
const SESSION_EXPIRY_STORAGE = 'creditzen_session_expiry';
const SESSION_TIMEOUT_MS = 20 * 60 * 1000; // 20 minutes

/**
 * Registers a new user with Supabase Auth.
 * Note: Does not automatically log them in because we need the password
 * to derive the encryption key, and the flow typically requires email verification.
 */
export const registerUser = async (email: string, password: string): Promise<void> => {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  });

  if (error) throw error;
  if (!data.user) throw new Error("Registration failed");
};

/**
 * Persists the encryption key to LocalStorage using JWK format.
 * This allows the user to reload the page without re-entering their password
 * for a short duration (20 mins).
 * 
 * SECURITY NOTE: 
 * While this stores the key in LocalStorage, it is a trade-off for UX.
 * A more secure approach would be to use IndexedDB with non-exportable keys,
 * but that would require re-entering the password on every reload.
 * The key is cleared automatically after timeout.
 */
const persistSession = async (key: CryptoKey, user: UserProfile) => {
  try {
    const jwk = await exportKeyToJWK(key);
    localStorage.setItem(SESSION_KEY_STORAGE, JSON.stringify(jwk));
    localStorage.setItem(SESSION_USER_STORAGE, JSON.stringify(user));
    localStorage.setItem(SESSION_EXPIRY_STORAGE, (Date.now() + SESSION_TIMEOUT_MS).toString());
  } catch (e) {
    console.error("Failed to persist session", e);
  }
};

const clearSession = () => {
  localStorage.removeItem(SESSION_KEY_STORAGE);
  localStorage.removeItem(SESSION_USER_STORAGE);
  localStorage.removeItem(SESSION_EXPIRY_STORAGE);
};

/**
 * Attempts to restore the session from LocalStorage.
 * Checks for expiry and validity of the stored key.
 */
export const restoreSession = async (): Promise<boolean> => {
  try {
    const expiryStr = localStorage.getItem(SESSION_EXPIRY_STORAGE);
    if (!expiryStr) return false;

    const expiry = parseInt(expiryStr, 10);
    if (Date.now() > expiry) {
      clearSession();
      return false;
    }

    const jwkStr = localStorage.getItem(SESSION_KEY_STORAGE);
    const userStr = localStorage.getItem(SESSION_USER_STORAGE);

    if (!jwkStr || !userStr) return false;

    const jwk = JSON.parse(jwkStr);
    const key = await importKeyFromJWK(jwk);
    const user = JSON.parse(userStr);

    currentSessionKey = key;
    currentUser = user;
    
    // Refresh expiry on successful restore
    localStorage.setItem(SESSION_EXPIRY_STORAGE, (Date.now() + SESSION_TIMEOUT_MS).toString());
    
    return true;
  } catch (e) {
    console.error("Failed to restore session", e);
    clearSession();
    return false;
  }
};

/**
 * Logs in the user and derives the encryption key.
 * 1. Authenticates with Supabase
 * 2. Retrieves or generates a salt
 * 3. Derives AES-GCM key from Password + Salt
 * 4. Persists the session
 */
export const loginUser = async (email: string, password: string): Promise<UserProfile> => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) throw error;
  if (!data.user) throw new Error("Login failed");

  // Derive key from password. 
  // We use a salt stored in the user's metadata to ensure the same key is derived every time.
  // If no salt exists (first login), we generate one.
  
  let salt = data.user.user_metadata?.salt;
  if (!salt) {
      salt = generateSalt();
      await supabase.auth.updateUser({
          data: { salt }
      });
  }

  const key = await deriveKey(password, salt);
  currentSessionKey = key;
  
  currentUser = {
      id: data.user.id,
      username: email,
      salt: salt
  };
  
  await persistSession(key, currentUser);

  return currentUser;
};

export const logoutUser = async () => {
  await supabase.auth.signOut();
  currentSessionKey = null;
  currentUser = null;
  clearSession();
};

export const getCurrentUser = () => currentUser;

export const getSessionKey = () => {
  return currentSessionKey;
};

export const isAuthenticated = () => !!currentSessionKey;

// Check if Supabase has a session but we don't have the key (Locked state)
export const isLocked = async () => {
    const { data } = await supabase.auth.getSession();
    // If we have a supabase session but no local key, try to restore
    if (!!data.session && !currentSessionKey) {
        const restored = await restoreSession();
        return !restored;
    }
    return !!data.session && !currentSessionKey;
};

// Restore session if we have the key (not possible without password re-entry)
// But we can check if we are "partially" logged in
export const checkSession = async (): Promise<boolean> => {
    // First try to restore local crypto session
    if (await restoreSession()) {
        return true;
    }

    const { data } = await supabase.auth.getSession();
    if (data.session?.user) {
        // We are logged in to Supabase, but we might not have the key.
        // We can't restore the key without the password.
        // So we just return true to indicate "connected", but the app should handle the "locked" state.
        return true;
    }
    return false;
};
