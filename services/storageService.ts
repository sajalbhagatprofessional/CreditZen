import { CreditCard, NotificationSettings, UserData, EncryptedPayload, AISettings } from '../types';
import { DEFAULT_NOTIFICATIONS, DEFAULT_AI_SETTINGS } from '../constants';
import { encryptData, decryptData } from './cryptoUtils';
import { getSessionKey, getCurrentUser } from './authService';
import { supabase } from './supabaseClient';
import { isBefore, startOfDay, parseISO } from 'date-fns';

// --- Storage Service ---
// Manages all data persistence operations.
// It implements an "Offline-First" strategy:
// 1. Writes to LocalStorage immediately for speed and offline availability.
// 2. Syncs encrypted blobs to Supabase in the background.
// 3. Handles Guest Mode (LocalStorage only) vs Authenticated Mode (Encrypted Sync).

// Legacy keys
const OLD_CARDS_KEY = 'creditzen_cards';
const OLD_SETTINGS_KEY = 'creditzen_settings';

// New keys
export const USERS_KEY = 'creditzen_users';
const GUEST_DATA_KEY = 'creditzen_guest_data';

// --- Low Level Storage Helpers ---

/**
 * Saves encrypted user data to both LocalStorage (cache) and Supabase (cloud).
 * If offline, Supabase sync is skipped without error, relying on LocalStorage.
 */
export const saveUserData = async (userId: string, data: EncryptedPayload) => {
  // 1. Always save locally first (Offline First)
  try {
    localStorage.setItem(`creditzen_user_data_${userId}`, JSON.stringify(data));
  } catch (e) {
    console.error("Local Storage Save Error:", e);
  }

  // 2. Try to sync to Supabase (Backup)
  // We don't throw error if this fails, so the app continues working offline
  if (navigator.onLine) {
      try {
        const { error } = await supabase
          .from('user_data')
          .upsert({ 
            user_id: userId, 
            iv: data.iv, 
            ciphertext: data.ciphertext,
            updated_at: new Date().toISOString()
          });
        
        if (error) {
          console.warn("Supabase Sync Error (Offline?):", error);
        }
      } catch (err) {
        console.warn("Supabase Network Error:", err);
      }
  }
};

/**
 * Retrieves encrypted user data.
 * Tries to fetch fresh data from Supabase first (if online).
 * Falls back to LocalStorage if offline or if Supabase fails.
 */
export const getUserDataRaw = async (userId: string): Promise<EncryptedPayload | null> => {
  const localKey = `creditzen_user_data_${userId}`;
  
  // 1. Try to fetch from Supabase first to ensure we have latest data (Sync)
  if (navigator.onLine) {
      try {
        const { data, error } = await supabase
          .from('user_data')
          .select('iv, ciphertext')
          .eq('user_id', userId)
          .single();

        if (data && !error) {
            // Update local cache
            localStorage.setItem(localKey, JSON.stringify(data));
            return data as EncryptedPayload;
        }
      } catch (err) {
        console.warn("Supabase Load Error (Network):", err);
        // Fallthrough to local storage
      }
  }

  // 2. Fallback to Local Storage (Offline or Supabase Error)
  const local = localStorage.getItem(localKey);
  if (local) {
      return JSON.parse(local) as EncryptedPayload;
  }
  
  return null;
};

const getGuestData = (): UserData => {
  const item = localStorage.getItem(GUEST_DATA_KEY);
  return item ? JSON.parse(item) : { cards: [], settings: DEFAULT_NOTIFICATIONS, aiSettings: DEFAULT_AI_SETTINGS };
};

const saveGuestData = (data: UserData) => {
  localStorage.setItem(GUEST_DATA_KEY, JSON.stringify(data));
};

// --- Application Logic ---

// Helper to clean expired temporary benefits
const cleanCards = (cards: CreditCard[]): CreditCard[] => {
    const today = startOfDay(new Date());
    return cards.map(card => {
      if (!card.temporaryBenefits || card.temporaryBenefits.length === 0) return card;
      const validTempBenefits = card.temporaryBenefits.filter(benefit => {
        if (!benefit.expiryDate) return true; 
        const expiry = parseISO(benefit.expiryDate);
        return !isBefore(expiry, today);
      });
      return { ...card, temporaryBenefits: validTempBenefits };
    });
};

/**
 * Manually triggers a synchronization.
 * Pushes local changes to remote if they exist, then pulls latest remote data.
 * Useful for "Pull to Refresh" or re-connection events.
 */
export const syncData = async () => {
  if (!navigator.onLine) return;
  
  const user = getCurrentUser();
  if (!user) return;

  const localKey = `creditzen_user_data_${user.id}`;
  const local = localStorage.getItem(localKey);
  
  if (local) {
      // Push local to remote
      try {
          const data = JSON.parse(local);
          await saveUserData(user.id, data);
      } catch (e) {
          console.error("Sync Push Failed", e);
      }
  }

  // Pull remote to local
  await getUserDataRaw(user.id);
};

export const getCards = async (): Promise<CreditCard[]> => {
  try {
    const user = getCurrentUser();
    
    // Guest Mode
    if (!user) {
      const data = getGuestData();
      return cleanCards(data.cards || []);
    }

    const key = getSessionKey();
    if (!key) return [];

    const encryptedData = await getUserDataRaw(user.id);
    if (!encryptedData) return [];

    const decrypted: UserData = await decryptData(encryptedData.iv, encryptedData.ciphertext, key);
    
    // Auto-cleanup expiration logic
    const cleanedCards = cleanCards(decrypted.cards || []);
    
    return cleanedCards;
  } catch (e) {
    console.error("Failed to load cards", e);
    return [];
  }
};

export const saveCards = async (cards: CreditCard[]) => {
  const user = getCurrentUser();
  
  // Guest Mode
  if (!user) {
    const data = getGuestData();
    saveGuestData({ ...data, cards });
    return;
  }

  const key = getSessionKey();
  if (!key) return;

  // We need to preserve current settings while saving cards
  const encryptedData = await getUserDataRaw(user.id);
  let currentSettings = DEFAULT_NOTIFICATIONS;
  let currentAISettings = DEFAULT_AI_SETTINGS;
  
  if (encryptedData) {
      try {
          const decrypted: UserData = await decryptData(encryptedData.iv, encryptedData.ciphertext, key);
          currentSettings = decrypted.settings || DEFAULT_NOTIFICATIONS;
          currentAISettings = decrypted.aiSettings || DEFAULT_AI_SETTINGS;
      } catch (e) { /* ignore */ }
  }

  const payload: UserData = {
      cards,
      settings: currentSettings,
      aiSettings: currentAISettings
  };

  const encrypted = await encryptData(payload, key);
  await saveUserData(user.id, encrypted);
};

export const getSettings = async (): Promise<{notifications: NotificationSettings, ai: AISettings}> => {
  try {
    const user = getCurrentUser();
    
    // Guest Mode
    if (!user) {
      const data = getGuestData();
      return {
        notifications: data.settings || DEFAULT_NOTIFICATIONS,
        ai: data.aiSettings || DEFAULT_AI_SETTINGS
      };
    }

    const key = getSessionKey();
    if (!key) return { notifications: DEFAULT_NOTIFICATIONS, ai: DEFAULT_AI_SETTINGS };

    const encryptedData = await getUserDataRaw(user.id);
    if (!encryptedData) return { notifications: DEFAULT_NOTIFICATIONS, ai: DEFAULT_AI_SETTINGS };

    const decrypted: UserData = await decryptData(encryptedData.iv, encryptedData.ciphertext, key);
    return {
      notifications: decrypted.settings || DEFAULT_NOTIFICATIONS,
      ai: decrypted.aiSettings || DEFAULT_AI_SETTINGS
    };
  } catch (e) {
    return { notifications: DEFAULT_NOTIFICATIONS, ai: DEFAULT_AI_SETTINGS };
  }
};

export const saveSettings = async (notifications: NotificationSettings, ai: AISettings) => {
  const user = getCurrentUser();
  
  // Guest Mode
  if (!user) {
    const data = getGuestData();
    saveGuestData({ ...data, settings: notifications, aiSettings: ai });
    return;
  }

  const key = getSessionKey();
  if (!key) return;

  // Preserve cards
  let currentCards: CreditCard[] = [];
  const encryptedData = await getUserDataRaw(user.id);
  
  if (encryptedData) {
      try {
          const decrypted: UserData = await decryptData(encryptedData.iv, encryptedData.ciphertext, key);
          currentCards = decrypted.cards || [];
      } catch (e) { /* ignore */ }
  }

  const payload: UserData = {
      cards: currentCards,
      settings: notifications,
      aiSettings: ai
  };

  const encrypted = await encryptData(payload, key);
  await saveUserData(user.id, encrypted);
};

// --- Backup & Restore ---

export const exportWalletJSON = async (): Promise<string> => {
  const cards = await getCards();
  const { notifications, ai } = await getSettings();
  
  // Export plain JSON for portability
  const exportData = {
    version: 2,
    exportDate: new Date().toISOString(),
    cards,
    settings: notifications,
    aiSettings: ai
  };
  
  return JSON.stringify(exportData, null, 2);
};

export const importWalletJSON = async (jsonString: string, append: boolean) => {
  try {
    const data = JSON.parse(jsonString);
    if (!data.cards) throw new Error("Invalid backup file");

    const importedCards: CreditCard[] = data.cards;
    const importedSettings: NotificationSettings = data.settings || DEFAULT_NOTIFICATIONS;
    const importedAI: AISettings = data.aiSettings || DEFAULT_AI_SETTINGS;

    const currentCards = await getCards();
    const { ai: currentAI, notifications: currentNotif } = await getSettings();
    
    let finalCards: CreditCard[];
    let finalSettings = importedSettings;
    let finalAI = importedAI;
    
    if (append) {
      const currentIds = new Set(currentCards.map(c => c.id));
      const newCards = importedCards.filter(c => !currentIds.has(c.id));
      finalCards = [...currentCards, ...newCards];
      // Keep existing settings on append
      finalSettings = currentNotif;
      finalAI = currentAI;
    } else {
      // Replace
      finalCards = importedCards;
    }

    const user = getCurrentUser();
    
    // Guest Mode
    if (!user) {
      saveGuestData({
        cards: finalCards,
        settings: finalSettings,
        aiSettings: finalAI
      });
      return true;
    }

    const key = getSessionKey();
    if (user && key) {
        const payload: UserData = {
            cards: finalCards,
            settings: finalSettings,
            aiSettings: finalAI
        };
        const encrypted = await encryptData(payload, key);
        await saveUserData(user.id, encrypted);
    }
    
    return true;
  } catch (e) {
    console.error("Import failed", e);
    throw new Error("Failed to import backup. File might be corrupted.");
  }
};

// --- Legacy Migration Check ---
export const hasLegacyData = (): boolean => {
    return !!localStorage.getItem(OLD_CARDS_KEY);
};

export const getLegacyData = (): UserData => {
    try {
        const cardsStr = localStorage.getItem(OLD_CARDS_KEY);
        const settingsStr = localStorage.getItem(OLD_SETTINGS_KEY);
        
        const cards = cardsStr ? JSON.parse(cardsStr) : [];
        const settings = settingsStr ? JSON.parse(settingsStr) : DEFAULT_NOTIFICATIONS;
        
        return { cards, settings, aiSettings: DEFAULT_AI_SETTINGS };
    } catch (e) {
        return { cards: [], settings: DEFAULT_NOTIFICATIONS, aiSettings: DEFAULT_AI_SETTINGS };
    }
};

export const clearLegacyData = () => {
    localStorage.removeItem(OLD_CARDS_KEY);
    localStorage.removeItem(OLD_SETTINGS_KEY);
};