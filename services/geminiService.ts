import { MOCK_ADVICE_PROMPT, DEFAULT_AI_SETTINGS } from '../constants';
import { CreditCard, AISettings } from '../types';
import { getSettings } from './storageService';

// --- Gemini Service ---
// Handles all interactions with AI providers (Google Gemini via server-side API, OpenAI, Anthropic).
// Ensures Gemini API calls and credentials remain strictly server-side.

// --- Internal Helper: Fetch AI Configuration ---
const getAIConfig = async (): Promise<AISettings> => {
  const { ai } = await getSettings();
  return ai || DEFAULT_AI_SETTINGS;
};

// Helper to check network status
const checkOnline = (): boolean => {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return false;
  }
  return true;
};

// --- API Clients for 3rd Party Providers ---

/**
 * Calls OpenAI-compatible APIs (OpenAI, DeepSeek, Ollama, etc.).
 */
const callOpenAICompatible = async (config: AISettings, messages: any[], maxTokens = 1024) => {
  const apiKey = config.apiKey;
  if (!apiKey && config.provider !== 'custom') throw new Error(`${config.provider} API Key missing`);

  const baseUrl = config.baseUrl || (config.provider === 'openai' ? 'https://api.openai.com/v1' : '');
  const url = `${baseUrl}/chat/completions`;

  const headers: any = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`
  };

  const body = {
    model: config.modelId || 'gpt-4o',
    messages: messages,
    max_tokens: maxTokens
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`${config.provider} API Error: ${err}`);
    }

    const data = await response.json();
    return data.choices[0]?.message?.content || "";
  } catch (error: any) {
    if (error.message === 'Failed to fetch') {
      throw new Error("Network error. Please check your connection.");
    }
    throw error;
  }
};

/**
 * Calls Anthropic API.
 */
const callAnthropic = async (config: AISettings, messages: any[]) => {
  if (!config.apiKey) throw new Error("Anthropic API Key missing");

  const url = 'https://api.anthropic.com/v1/messages';
  
  const headers: any = {
    'x-api-key': config.apiKey,
    'anthropic-version': '2023-06-01',
    'content-type': 'application/json',
    'dangerously-allow-browser': 'true'
  };

  const body = {
    model: config.modelId || 'claude-3-5-sonnet-20241022',
    max_tokens: 1024,
    messages: messages
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body)
    });

    if (!response.ok) {
       const err = await response.text();
       throw new Error(`Anthropic API Error: ${err}`);
    }
    
    const data = await response.json();
    return data.content[0]?.text || "";
  } catch (error: any) {
    if (error.message === 'Failed to fetch') {
      throw new Error("Network error. Please check your connection.");
    }
    throw error;
  }
};

// --- Exported Services ---

/**
 * Processes a credit card document (PDF/Image) to extract fee/benefit info.
 */
export const processCardDocument = async (file: File): Promise<string> => {
  if (!checkOnline()) throw new Error("Offline. Cannot process documents.");
  
  const config = await getAIConfig();
  const base64Data = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const promptText = `
    Analyze this credit card document. Extract:
    1. Fees (Annual, Foreign Tx, Late)
    2. APR Rates
    3. Insurance/Protections
    4. Reward Categories & Multipliers
    Summarize concisely in Markdown.
  `;

  try {
    if (config.provider === 'google') {
      const res = await fetch('/api/gemini/process-document', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mimeType: file.type || 'image/jpeg',
          base64Data,
          customApiKey: config.apiKey || undefined
        })
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({ error: 'Server processing failed' }));
        throw new Error(errJson.error || 'Server processing error');
      }

      const data = await res.json();
      return data.text;
    } else if (config.provider === 'openai' || config.provider === 'custom') {
      const dataUrl = `data:${file.type};base64,${base64Data}`;
      const messages = [
        {
          role: 'user',
          content: [
            { type: 'text', text: promptText },
            { type: 'image_url', image_url: { url: dataUrl } }
          ]
        }
      ];
      return await callOpenAICompatible(config, messages);
    } else if (config.provider === 'anthropic') {
      const messages = [
        {
          role: 'user',
          content: [
            { 
              type: 'image', 
              source: { 
                type: 'base64', 
                media_type: file.type as any, 
                data: base64Data 
              } 
            },
            { type: 'text', text: promptText }
          ]
        }
      ];
      return await callAnthropic(config, messages);
    }
  } catch (error: any) {
    console.error("AI Document Processing Error:", error);
    throw new Error(`Failed to process document: ${error.message}`);
  }
  return "Provider not supported for Vision.";
};

/**
 * Main Chat Interface for the AI Coach.
 * Summarizes the user's current wallet context and sends it to the AI.
 */
export const askCreditCoach = async (question: string, contextCards: CreditCard[]) => {
  if (!checkOnline()) return "I am currently offline.";

  const config = await getAIConfig();
  
  // Summarize card context
  const cardSummary = contextCards.map(c => {
     const perm = c.benefits.map(b => `${b.category}: ${b.multiplier}x`).join(', ');
     const temp = c.temporaryBenefits?.map(b => `${b.category} (Temp until ${b.expiryDate}): ${b.multiplier}x`).join(', ');
     const docs = c.documents?.map(d => `[Doc: ${d.name}]: ${d.summary}`).join('\n');
     return `CARD: ${c.issuer} ${c.name}\nBENEFITS: ${perm} ${temp ? `| TEMP: ${temp}` : ''}\n${docs || ''}`;
  }).join('\n---\n');

  try {
    if (config.provider === 'google') {
      const res = await fetch('/api/gemini/coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question,
          cardSummary,
          customApiKey: config.apiKey || undefined
        })
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({ error: 'AI Coach request failed' }));
        return `Error from AI Coach: ${errJson.error || 'Request failed'}`;
      }

      const data = await res.json();
      return data.text || "No response received from AI Coach.";
    } else {
      const fullPrompt = `${MOCK_ADVICE_PROMPT}\n\nUser Data:\n${cardSummary}\n\nQuestion: ${question}`;
      if (config.provider === 'anthropic') {
        return await callAnthropic(config, [{ role: 'user', content: fullPrompt }]);
      } else {
        return await callOpenAICompatible(config, [{ role: 'user', content: fullPrompt }]);
      }
    }
  } catch (error: any) {
    console.error("AI Coach Error:", error);
    return `Error connecting to ${config.provider} AI: ${error.message}`;
  }
};

/**
 * Extracts credit card details from an image using Gemini Vision server-side.
 * Returns a partial CreditCard object to populate the form.
 */
export const extractCardDetails = async (file: File): Promise<Partial<CreditCard>> => {
  if (!checkOnline()) throw new Error("Offline. Cannot scan card.");

  const config = await getAIConfig();
  const base64Data = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const promptText = `
    Analyze this credit card image. Extract the following details in JSON format:
    - issuer (e.g., Chase, Amex, Citi)
    - name (e.g., Sapphire Preferred, Gold Card)
    - network (Visa, Mastercard, Amex, Discover)
    - last4 (Last 4 digits of account number)
    - expiryDate (MM/YY format)
    - cardHolderName (Name on card)
    
    If a field is not visible, return null.
    Do NOT invent information.
    
    Response Format:
    {
      "issuer": "string",
      "name": "string",
      "network": "string",
      "last4": "string",
      "expiryDate": "string",
      "cardHolderName": "string"
    }
  `;

  try {
    if (config.provider === 'google') {
      const res = await fetch('/api/gemini/scan-card', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mimeType: file.type || 'image/jpeg',
          base64Data,
          customApiKey: config.apiKey || undefined
        })
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({ error: 'Card scan failed' }));
        throw new Error(errJson.error || 'Card scan failed');
      }

      const data = await res.json();
      return data.details || {};
    } else {
      let jsonStr = "";
      if (config.provider === 'openai' || config.provider === 'custom') {
        const dataUrl = `data:${file.type};base64,${base64Data}`;
        const messages = [
          {
            role: 'user',
            content: [
              { type: 'text', text: promptText },
              { type: 'image_url', image_url: { url: dataUrl } }
            ]
          }
        ];
        jsonStr = await callOpenAICompatible(config, messages);
      } else if (config.provider === 'anthropic') {
        const messages = [
          {
            role: 'user',
            content: [
              { 
                type: 'image', 
                source: { 
                  type: 'base64', 
                  media_type: file.type as any, 
                  data: base64Data 
                } 
              },
              { type: 'text', text: promptText }
            ]
          }
        ];
        jsonStr = await callAnthropic(config, messages);
      }

      const cleanJson = jsonStr.replace(/```json/g, '').replace(/```/g, '').trim();
      return JSON.parse(cleanJson);
    }
  } catch (error: any) {
    console.error("Card Scan Error:", error);
    throw new Error(`Failed to scan card: ${error.message}`);
  }
};

/**
 * Recommends best credit card based on geolocation.
 */
export const recommendCardAtLocation = async (
  latitude: number,
  longitude: number,
  cards: CreditCard[]
) => {
  if (!checkOnline()) return "Network unavailable.";

  const config = await getAIConfig();

  if (config.provider !== 'google') {
    return `⚠️ **Provider Limitation**: Location Intelligence (Google Maps Grounding) is currently only supported when using the **Google Gemini** provider. Please switch providers in Settings to use this feature.`;
  }

  const cardContext = cards.map(c => 
    `ID: ${c.id}, Name: ${c.issuer} ${c.name}, Benefits: ${c.benefits.map(b => `${b.category}:${b.multiplier}x`).join(', ')}`
  ).join('\n');

  try {
    const res = await fetch('/api/gemini/recommend-location', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        latitude,
        longitude,
        cardContext,
        customApiKey: config.apiKey || undefined
      })
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({ error: 'Location recommendation failed' }));
      return `Location recommendation error: ${errJson.error || 'Server error'}`;
    }

    const data = await res.json();
    return data.text || "No recommendation found for this location.";
  } catch (error: any) {
    console.error("Gemini Location Error:", error);
    return `Location Scan Failed: ${error.message}`;
  }
};
