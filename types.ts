export enum CardCategory {
  Dining = 'Dining',
  Travel = 'Travel',
  Grocery = 'Grocery',
  Gas = 'Gas',
  OnlineShopping = 'Online Shopping',
  Streaming = 'Streaming',
  Drugstore = 'Drugstore',
  Entertainment = 'Entertainment',
  General = 'General',
  Business = 'Business'
}

export interface Benefit {
  category: string; 
  multiplier: number;
  notes?: string;
  expiryDate?: string; 
}

export interface CardDocument {
  id: string;
  name: string;
  uploadDate: string;
  summary: string;
  type: 'Policy' | 'Fee Schedule' | 'Benefits Guide' | 'Other';
}

export type CardType = 'Credit' | 'Debit';

export interface CreditCard {
  id: string;
  type: CardType;
  issuer: string;
  name: string;
  lastFour: string;
  
  // Make these optional for Debit cards
  statementDay?: number; 
  dueDay?: number;
  creditLimit?: number;
  
  paymentUrl: string;
  benefits: Benefit[]; 
  temporaryBenefits?: Benefit[]; 
  
  documents?: CardDocument[]; 

  notes?: string;
  
  currentBalance?: number; 
  
  // Secure details
  fullCardNumber?: string;
  cvv?: string;
  expiryDate?: string;
  cardHolderName?: string;
}

export interface NotificationSettings {
  daysBeforeStatement: number;
  daysBeforeDue: number;
}

// --- Auth & Security Types ---

export interface UserProfile {
  id: string;
  username: string;
  salt: string; // Base64 encoded salt for key derivation
}

export interface EncryptedPayload {
  iv: string; // Base64 encoded initialization vector
  ciphertext: string; // Base64 encoded encrypted data
}

// --- AI Configuration Types ---

export type AIProvider = 'google' | 'openai' | 'anthropic' | 'custom';

export interface AISettings {
  provider: AIProvider;
  modelId: string;
  apiKey?: string; // Optional (falls back to env for Google)
  baseUrl?: string; // For Custom/OpenAI Compatible
}

export interface UserData {
  cards: CreditCard[];
  settings: NotificationSettings;
  aiSettings?: AISettings;
}