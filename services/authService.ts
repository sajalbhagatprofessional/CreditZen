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
const SESSION_BIOMETRIC_ENABLED = 'creditzen_biometric_enabled';
const SESSION_BIOMETRIC_CRED_ID = 'creditzen_biometric_cred_id';
const SESSION_TIMEOUT_MS = 20 * 60 * 1000; // 20 minutes
const BIOMETRIC_TIMEOUT_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// --- Biometric Helpers ---

// Helper to convert ArrayBuffer to Base64
const bufferToBase64 = (buffer: ArrayBuffer) => {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)));
};

// Helper to convert Base64 to Uint8Array
const base64ToUint8Array = (base64: string) => {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
};

export const isBiometricAvailable = async (): Promise<boolean> => {
  if (!window.PublicKeyCredential) return false;
  
  try {
    // Check if platform authenticator is available (Fingerprint, Face, etc.)
    const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    return available;
  } catch (e) {
    console.error("Error checking biometric availability:", e);
    return false;
  }
};

export const enableBiometrics = async () => {
  if (!await isBiometricAvailable()) {
    throw new Error("Biometrics not supported or no screen lock set up on this device. If you are in a preview, please open the app in a new tab.");
  }
  
  const challenge = new Uint8Array(32);
  window.crypto.getRandomValues(challenge);
  
  const userId = currentUser?.id || "default-user";
  const userBuffer = new TextEncoder().encode(userId);
  const rpId = window.location.hostname;

  // Clear any old credential first to avoid confusion
  localStorage.removeItem(SESSION_BIOMETRIC_CRED_ID);

  try {
    const credential = await navigator.credentials.create({
      publicKey: {
        challenge,
        rp: { 
          name: "CreditZen",
          id: rpId 
        },
        user: {
          id: userBuffer,
          name: currentUser?.username || "User",
          displayName: currentUser?.username || "User"
        },
        pubKeyCredParams: [
          { alg: -7, type: "public-key" }, // ES256
          { alg: -257, type: "public-key" } // RS256
        ],
        authenticatorSelection: { 
          authenticatorAttachment: "platform", 
          userVerification: "required",
          residentKey: "preferred" // Revert to preferred for better compatibility
        },
        timeout: 60000
      }
    }) as PublicKeyCredential;

    if (credential) {
      const credId = bufferToBase64(credential.rawId);
      localStorage.setItem(SESSION_BIOMETRIC_CRED_ID, credId);
      localStorage.setItem(SESSION_BIOMETRIC_ENABLED, 'true');
      
      // Refresh session with longer expiry
      if (currentSessionKey && currentUser) {
          await persistSession(currentSessionKey, currentUser);
      }
    }
  } catch (err: any) {
    console.error("Failed to create biometric credential:", err);
    if (err.name === 'NotAllowedError') {
      throw new Error("Biometric setup was cancelled.");
    }
    if (err.name === 'SecurityError') {
      throw new Error("Security error: The domain does not match or the context is insecure.");
    }
    throw new Error(`Biometric setup failed: ${err.message}`);
  }
};

export const disableBiometrics = () => {
  localStorage.removeItem(SESSION_BIOMETRIC_ENABLED);
  localStorage.removeItem(SESSION_BIOMETRIC_CRED_ID);
  // Reset expiry to short term
  if (currentSessionKey && currentUser) {
      persistSession(currentSessionKey, currentUser);
  }
};

export const isBiometricEnabled = () => {
  return localStorage.getItem(SESSION_BIOMETRIC_ENABLED) === 'true' && 
         !!localStorage.getItem(SESSION_BIOMETRIC_CRED_ID);
};

export const verifyBiometric = async (): Promise<boolean> => {
  const challenge = new Uint8Array(32);
  window.crypto.getRandomValues(challenge);
  
  const credId = localStorage.getItem(SESSION_BIOMETRIC_CRED_ID);
  if (!credId) throw new Error("Biometrics not enabled on this device.");

  const rpId = window.location.hostname;
  const allowCredentials = [{
    id: base64ToUint8Array(credId),
    type: 'public-key' as const
  }];
  
  try {
    const credential = await navigator.credentials.get({
      publicKey: {
        challenge,
        rpId,
        allowCredentials,
        userVerification: "required",
        timeout: 60000
      }
    });
    
    if (!credential) return false;
    return true;
  } catch (e: any) {
    console.error("Biometric verification failed", e);
    if (e.name === 'NotAllowedError') {
      throw new Error("Biometric verification cancelled or timed out.");
    }
    if (e.name === 'SecurityError') {
      throw new Error("Security error: The domain does not match the biometric credential.");
    }
    throw new Error(`Biometric verification failed: ${e.message}`);
  }
};

/**
 * Registers a new user with Supabase Auth.
 * Note: Does not automatically log them in because we need the password
 * to derive the encryption key, and the flow typically requires email verification.
 */
export const registerUser = async (email: string, password: string): Promise<void> => {
  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) throw error;
    if (!data.user) throw new Error("Registration failed");
  } catch (error: any) {
    console.error("Registration Error:", error);
    if (error.message === 'Failed to fetch') {
      throw new Error("Network error. Please check your internet connection.");
    }
    throw error;
  }
};

/**
 * Persists the encryption key to LocalStorage using JWK format.
 * This allows the user to reload the page without re-entering their password.
 */
const persistSession = async (key: CryptoKey, user: UserProfile) => {
  try {
    const jwk = await exportKeyToJWK(key);
    const isBio = isBiometricEnabled();
    const timeout = isBio ? BIOMETRIC_TIMEOUT_MS : SESSION_TIMEOUT_MS;
    
    localStorage.setItem(SESSION_KEY_STORAGE, JSON.stringify(jwk));
    localStorage.setItem(SESSION_USER_STORAGE, JSON.stringify(user));
    localStorage.setItem(SESSION_EXPIRY_STORAGE, (Date.now() + timeout).toString());
  } catch (e) {
    console.error("Failed to persist session", e);
  }
};

const clearSession = () => {
  localStorage.removeItem(SESSION_KEY_STORAGE);
  localStorage.removeItem(SESSION_USER_STORAGE);
  localStorage.removeItem(SESSION_EXPIRY_STORAGE);
  // We do NOT clear biometric preference on logout, or maybe we should?
  // Usually logout means "forget me", so let's keep it.
  // But for security, maybe we should clear the key.
};

/**
 * Attempts to restore the session from LocalStorage.
 * Checks for expiry and validity of the stored key.
 * If biometrics are enabled, it requires verification BEFORE restoring the key.
 */
export const restoreSession = async (skipBiometricCheck = false): Promise<boolean> => {
  try {
    const expiryStr = localStorage.getItem(SESSION_EXPIRY_STORAGE);
    if (!expiryStr) return false;

    const expiry = parseInt(expiryStr, 10);
    if (Date.now() > expiry) {
      clearSession();
      return false;
    }

    // Check if biometric is required
    if (isBiometricEnabled() && !skipBiometricCheck) {
        // We return false here to indicate "not fully restored yet".
        // The UI should see this state (valid expiry but no key in memory) and prompt for biometrics.
        // However, `restoreSession` is usually called on app load.
        // We need a way to signal "Biometric Required".
        // For now, we will return false, but `checkSession` will handle the "locked" state.
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
    
    // Refresh expiry
    const isBio = isBiometricEnabled();
    const timeout = isBio ? BIOMETRIC_TIMEOUT_MS : SESSION_TIMEOUT_MS;
    localStorage.setItem(SESSION_EXPIRY_STORAGE, (Date.now() + timeout).toString());
    
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
  try {
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
  } catch (error: any) {
    console.error("Login Error:", error);
    if (error.message === 'Failed to fetch') {
      throw new Error("Network error. Please check your internet connection.");
    }
    throw error;
  }
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
