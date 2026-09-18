import { UserProfile } from '../types';
import { deriveKey, generateSalt, exportKeyToJWK, importKeyFromJWK } from './cryptoUtils';
import { supabase } from './supabaseClient';

// --- Authentication & Vault Service ---
// Handles local encrypted vault, Supabase cloud sync, WebAuthn biometrics, and session persistence.
// Designed for 100% offline-first operation on mobile devices with zero network requirement,
// plus seamless cloud sync when connected.

let currentSessionKey: CryptoKey | null = null;
let currentUser: UserProfile | null = null;

const SESSION_KEY_STORAGE = 'creditzen_session_key';
const SESSION_USER_STORAGE = 'creditzen_session_user';
const SESSION_EXPIRY_STORAGE = 'creditzen_session_expiry';
const SESSION_BIOMETRIC_ENABLED = 'creditzen_biometric_enabled';
const SESSION_BIOMETRIC_CRED_ID = 'creditzen_biometric_cred_id';
const SESSION_BIOMETRIC_VAULT_KEY = 'creditzen_biometric_vault_key';
const LOCAL_VAULT_SALT_KEY = 'creditzen_local_vault_salt';
const LOCAL_VAULT_PIN_HASH_KEY = 'creditzen_local_vault_pin';

const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes of inactivity
const BIOMETRIC_TIMEOUT_MS = 30 * 24 * 60 * 60 * 1000; // 30 days when biometrics enabled

// Helper to convert ArrayBuffer to Base64
const bufferToBase64 = (buffer: ArrayBuffer): string => {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)));
};

// Helper to convert Base64 to Uint8Array
const base64ToUint8Array = (base64: string): Uint8Array => {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
};

/**
 * Checks if Biometric authentication (WebAuthn / Passkeys) is supported.
 */
export const isBiometricAvailable = async (): Promise<boolean> => {
  if (typeof window === 'undefined' || !window.PublicKeyCredential) {
    return false;
  }
  
  // Browsers disallow or restrict WebAuthn inside cross-origin / sandboxed iframes.
  // Querying WebAuthn in an iframe can also cause wallet extensions (like MetaMask) to intercept and fail.
  try {
    if (window.self !== window.top) {
      return false;
    }
    if (typeof PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === 'function') {
      const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
      return Boolean(available);
    }
    return false;
  } catch (e) {
    console.warn("PublicKeyCredential check warning:", e);
    return false;
  }
};

export const isBiometricEnabled = (): boolean => {
  return localStorage.getItem(SESSION_BIOMETRIC_ENABLED) === 'true';
};

/**
 * Enables Biometric unlock on the current device.
 * Configured with resilient fallbacks for Android Chrome, Samsung Internet, and iOS Safari.
 */
export const enableBiometrics = async (): Promise<void> => {
  if (typeof window === 'undefined' || !window.PublicKeyCredential) {
    throw new Error("WebAuthn / Biometrics is not supported on this device.");
  }

  // Ensure an active session key exists
  if (!currentSessionKey) {
    // If not logged in, initialize local vault first
    await initLocalVault();
  }

  const challenge = new Uint8Array(32);
  window.crypto.getRandomValues(challenge);

  const activeUser = currentUser || {
    id: 'local-vault',
    username: 'CreditZen User',
    salt: getOrCreateLocalSalt()
  };

  const userBuffer = new TextEncoder().encode(activeUser.id);
  const rpName = "CreditZen";
  const rpId = window.location.hostname;

  // Clear previous biometric credentials to prevent mismatch
  localStorage.removeItem(SESSION_BIOMETRIC_CRED_ID);

  const supportedAlgs = [
    { alg: -7, type: "public-key" as const },   // ES256
    { alg: -257, type: "public-key" as const }, // RS256
    { alg: -8, type: "public-key" as const },   // Ed25519
    { alg: -37, type: "public-key" as const }   // PS256
  ];

  let credential: PublicKeyCredential | null = null;

  try {
    // First try: with platform authenticator (Fingerprint/Face/Screen Lock)
    credential = (await navigator.credentials.create({
      publicKey: {
        challenge,
        rp: { name: rpName, id: rpId },
        user: {
          id: userBuffer,
          name: activeUser.username,
          displayName: activeUser.username
        },
        pubKeyCredParams: supportedAlgs,
        authenticatorSelection: {
          authenticatorAttachment: "platform",
          userVerification: "preferred",
          residentKey: "preferred"
        },
        timeout: 60000
      }
    })) as PublicKeyCredential;
  } catch (platformErr: any) {
    console.warn("Platform authenticator create failed, trying general authenticator:", platformErr);
    
    // Fallback: without strict platform attachment (supports all Android Passkeys and screen locks)
    try {
      credential = (await navigator.credentials.create({
        publicKey: {
          challenge,
          rp: { name: rpName },
          user: {
            id: userBuffer,
            name: activeUser.username,
            displayName: activeUser.username
          },
          pubKeyCredParams: supportedAlgs,
          authenticatorSelection: {
            userVerification: "preferred",
            residentKey: "preferred"
          },
          timeout: 60000
        }
      })) as PublicKeyCredential;
    } catch (fallbackErr: any) {
      console.error("Fallback credential creation failed:", fallbackErr);
      const errMsg = fallbackErr?.message || '';
      if (/MetaMask|ethereum/i.test(errMsg)) {
        throw new Error("A wallet extension intercepted device authentication. Please unlock with your passcode.");
      }
      if (fallbackErr.name === 'NotAllowedError') {
        throw new Error("Biometric setup was cancelled or timed out.");
      }
      throw new Error(`Device biometric setup error: ${fallbackErr.message || 'Verification failed'}`);
    }
  }

  if (credential) {
    const credId = bufferToBase64(credential.rawId);
    localStorage.setItem(SESSION_BIOMETRIC_CRED_ID, credId);
    localStorage.setItem(SESSION_BIOMETRIC_ENABLED, 'true');

    // Securely cache the vault key for biometric reactivation
    if (currentSessionKey) {
      const jwk = await exportKeyToJWK(currentSessionKey);
      localStorage.setItem(SESSION_BIOMETRIC_VAULT_KEY, JSON.stringify(jwk));
      await persistSession(currentSessionKey, activeUser);
    }
  } else {
    throw new Error("Could not register biometric credential with device.");
  }
};

/**
 * Disables Biometric unlock on this device.
 */
export const disableBiometrics = (): void => {
  localStorage.removeItem(SESSION_BIOMETRIC_ENABLED);
  localStorage.removeItem(SESSION_BIOMETRIC_CRED_ID);
  localStorage.removeItem(SESSION_BIOMETRIC_VAULT_KEY);
  if (currentSessionKey && currentUser) {
    persistSession(currentSessionKey, currentUser);
  }
};

/**
 * Verifies the user's biometrics via WebAuthn.
 */
export const verifyBiometric = async (): Promise<boolean> => {
  if (typeof window === 'undefined' || !navigator.credentials) {
    throw new Error("Biometric verification is not supported on this browser.");
  }

  const challenge = new Uint8Array(32);
  window.crypto.getRandomValues(challenge);

  const credId = localStorage.getItem(SESSION_BIOMETRIC_CRED_ID);
  const rpId = window.location.hostname;

  try {
    let credential: Credential | null = null;

    if (credId) {
      try {
        // Try verification with stored credential id
        credential = await navigator.credentials.get({
          publicKey: {
            challenge,
            rpId,
            allowCredentials: [
              {
                id: base64ToUint8Array(credId),
                type: 'public-key'
              }
            ],
            userVerification: "preferred",
            timeout: 60000
          }
        });
      } catch (idErr) {
        console.warn("Verification with explicit credId failed, attempting discoverable credential:", idErr);
      }
    }

    // Fallback: discoverable credential on current domain
    if (!credential) {
      credential = await navigator.credentials.get({
        publicKey: {
          challenge,
          rpId,
          userVerification: "preferred",
          timeout: 60000
        }
      });
    }

    if (!credential) return false;

    // Biometrics verified: restore the active session key
    const restored = await restoreBiometricSession();
    return restored;
  } catch (e: any) {
    console.error("Biometric verification error:", e);
    const errMsg = e?.message || '';
    if (/MetaMask|ethereum/i.test(errMsg)) {
      throw new Error("A wallet extension intercepted device authentication. Please unlock with your passcode.");
    }
    if (e.name === 'NotAllowedError') {
      throw new Error("Biometric scan cancelled or timed out.");
    }
    throw new Error(`Biometric verification failed: ${e.message || 'Sensor error'}`);
  }
};

/**
 * Restores the encryption key saved for biometric unlock.
 */
const restoreBiometricSession = async (): Promise<boolean> => {
  try {
    const jwkStr = localStorage.getItem(SESSION_BIOMETRIC_VAULT_KEY) || localStorage.getItem(SESSION_KEY_STORAGE);
    const userStr = localStorage.getItem(SESSION_USER_STORAGE);

    if (!jwkStr) return false;

    const jwk = JSON.parse(jwkStr);
    const key = await importKeyFromJWK(jwk);
    const user = userStr ? JSON.parse(userStr) : {
      id: 'local-vault',
      username: 'Local User',
      salt: getOrCreateLocalSalt()
    };

    currentSessionKey = key;
    currentUser = user;

    // Refresh expiry
    await persistSession(key, user);
    return true;
  } catch (e) {
    console.error("Failed to restore biometric session key:", e);
    return false;
  }
};

// --- Local Vault Support (100% Offline, Zero-Hosting Required) ---

const getOrCreateLocalSalt = (): string => {
  let salt = localStorage.getItem(LOCAL_VAULT_SALT_KEY);
  if (!salt) {
    salt = generateSalt();
    localStorage.setItem(LOCAL_VAULT_SALT_KEY, salt);
  }
  return salt;
};

/**
 * Initializes or unlocks a local offline vault.
 * Requires no network connection or hosting account.
 */
export const initLocalVault = async (passcode: string = 'creditzen-device-local'): Promise<UserProfile> => {
  const salt = getOrCreateLocalSalt();
  const key = await deriveKey(passcode, salt);
  
  currentSessionKey = key;
  currentUser = {
    id: 'local-vault',
    username: 'Local Vault (Offline)',
    salt
  };

  await persistSession(key, currentUser);
  return currentUser;
};

/**
 * Checks if the local vault has been initialized.
 */
export const hasLocalVault = (): boolean => {
  return !!localStorage.getItem(LOCAL_VAULT_SALT_KEY);
};

// --- Session Persistence ---

export const persistSession = async (key: CryptoKey, user: UserProfile) => {
  try {
    const jwk = await exportKeyToJWK(key);
    const isBio = isBiometricEnabled();
    const timeout = isBio ? BIOMETRIC_TIMEOUT_MS : SESSION_TIMEOUT_MS;

    localStorage.setItem(SESSION_KEY_STORAGE, JSON.stringify(jwk));
    localStorage.setItem(SESSION_USER_STORAGE, JSON.stringify(user));
    localStorage.setItem(SESSION_EXPIRY_STORAGE, (Date.now() + timeout).toString());
    
    if (isBio) {
      localStorage.setItem(SESSION_BIOMETRIC_VAULT_KEY, JSON.stringify(jwk));
    }
  } catch (e) {
    console.error("Failed to persist session", e);
  }
};

export const clearSession = () => {
  localStorage.removeItem(SESSION_KEY_STORAGE);
  localStorage.removeItem(SESSION_USER_STORAGE);
  localStorage.removeItem(SESSION_EXPIRY_STORAGE);
};

/**
 * Restores the active session.
 */
export const restoreSession = async (skipBiometricCheck = false): Promise<boolean> => {
  try {
    const expiryStr = localStorage.getItem(SESSION_EXPIRY_STORAGE);
    const jwkStr = localStorage.getItem(SESSION_KEY_STORAGE) || localStorage.getItem(SESSION_BIOMETRIC_VAULT_KEY);
    const userStr = localStorage.getItem(SESSION_USER_STORAGE);

    if (!jwkStr) return false;

    // Check expiry
    if (expiryStr) {
      const expiry = parseInt(expiryStr, 10);
      if (Date.now() > expiry && !isBiometricEnabled()) {
        clearSession();
        return false;
      }
    }

    // If biometric unlock is required and not skipped, prompt via UI first
    if (isBiometricEnabled() && !skipBiometricCheck) {
      return false;
    }

    const jwk = JSON.parse(jwkStr);
    const key = await importKeyFromJWK(jwk);
    const user = userStr ? JSON.parse(userStr) : {
      id: 'local-vault',
      username: 'Local Vault (Offline)',
      salt: getOrCreateLocalSalt()
    };

    currentSessionKey = key;
    currentUser = user;

    // Extend timeout
    const isBio = isBiometricEnabled();
    const timeout = isBio ? BIOMETRIC_TIMEOUT_MS : SESSION_TIMEOUT_MS;
    localStorage.setItem(SESSION_EXPIRY_STORAGE, (Date.now() + timeout).toString());

    return true;
  } catch (e) {
    console.error("Failed to restore session", e);
    return false;
  }
};

// --- Supabase Cloud Authentication (Optional for multi-device sync) ---

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
      throw new Error("Network error. Please check your internet connection or use Local Vault.");
    }
    throw error;
  }
};

export const loginUser = async (email: string, password: string): Promise<UserProfile> => {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;
    if (!data.user) throw new Error("Login failed");

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
      salt
    };

    await persistSession(key, currentUser);
    return currentUser;
  } catch (error: any) {
    console.error("Login Error:", error);
    if (error.message === 'Failed to fetch') {
      throw new Error("Network error. Please check your connection or switch to Offline Local Vault.");
    }
    throw error;
  }
};

export const logoutUser = async () => {
  try {
    if (currentUser?.id !== 'local-vault') {
      await supabase.auth.signOut();
    }
  } catch (e) {
    // Ignore offline signOut error
  }
  currentSessionKey = null;
  currentUser = null;
  clearSession();
};

export const getCurrentUser = () => currentUser;
export const getSessionKey = () => currentSessionKey;
export const isAuthenticated = () => !!currentSessionKey;

export const checkSession = async (): Promise<boolean> => {
  if (await restoreSession()) {
    return true;
  }
  
  // If biometric is enabled and we have the vault key stored, return true to show biometric unlock prompt
  if (isBiometricEnabled() && (localStorage.getItem(SESSION_BIOMETRIC_VAULT_KEY) || localStorage.getItem(SESSION_KEY_STORAGE))) {
    return false;
  }

  // Check Supabase session if online
  if (navigator.onLine) {
    try {
      const { data } = await supabase.auth.getSession();
      if (data.session?.user) {
        return true;
      }
    } catch (e) {
      // offline
    }
  }

  return false;
};
