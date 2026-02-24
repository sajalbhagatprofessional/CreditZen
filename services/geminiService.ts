import { GoogleGenAI } from "@google/genai";
import { MOCK_ADVICE_PROMPT, DEFAULT_AI_SETTINGS } from '../constants';
import { CreditCard, AISettings } from '../types';
import { getSettings } from './storageService';

// --- Gemini Service ---
// Handles all interactions with AI providers (Google Gemini, OpenAI, Anthropic).
// It abstracts the differences between providers to offer a unified API for the app.

// --- Internal Helper: Fetch AI Configuration ---
// Retrieves the current AI settings, falling back to environment variables if needed.
const getAIConfig = async (): Promise<AISettings> => {
  const { ai } = await getSettings();
  if (!ai.apiKey && ai.provider === 'google' && process.env.API_KEY) {
     return { ...ai, apiKey: process.env.API_KEY };
  }
  return ai;
};

// Helper to check network status
const checkOnline = (): boolean => {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return false;
  }
  return true;
};

// --- API Clients ---

/**
 * Calls the Google Gemini API using the official SDK.
 * Supports text generation, multimodal inputs (images), and tools (Maps).
 */
const callGoogleGemini = async (config: AISettings, prompt: string | any, systemInstruction?: string, tools?: any[]) => {
  if (!config.apiKey) throw new Error("Google API Key missing");
  
  const client = new GoogleGenAI({ apiKey: config.apiKey });
  
  // Construct options
  const options: any = {
     model: config.modelId,
     contents: prompt,
  };
  
  if (tools) {
    options.config = { tools };
    // Add location tool config if present
    if (tools.some(t => t.googleMaps)) {
       // Assuming prompt is the contents object which might contain toolConfig in the caller. 
       // In @google/genai, tools are in config.
    }
  }

  // Handle system instruction if strictly needed, though usually part of contents or config
  if (systemInstruction) {
     options.config = { ...options.config, systemInstruction };
  }
  
  // Thinking config for 3.0 models if no tools are used
  if (!tools && config.modelId.includes('gemini-3')) {
    options.config = { ...options.config, thinkingConfig: { thinkingBudget: 0 } };
  }

  const response = await client.models.generateContent(options);
  return response.text;
};

/**
 * Calls OpenAI-compatible APIs (OpenAI, DeepSeek, Ollama, etc.).
 * Uses standard REST endpoints.
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

  // If using OpenRouter or similar, they might need extra headers, but standard is Bearer.
  
  const body = {
    model: config.modelId,
    messages: messages,
    max_tokens: maxTokens
  };

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
};

/**
 * Calls Anthropic API.
 * Note: Client-side calls to Anthropic often fail CORS unless a proxy is used.
 */
const callAnthropic = async (config: AISettings, messages: any[]) => {
  if (!config.apiKey) throw new Error("Anthropic API Key missing");

  // Note: Direct browser calls to Anthropic often fail CORS.
  // This expects the user to have a CORS proxy or similar setup if using pure PWA.
  // We will try standard endpoint.
  const url = 'https://api.anthropic.com/v1/messages';
  
  const headers: any = {
    'x-api-key': config.apiKey,
    'anthropic-version': '2023-06-01',
    'content-type': 'application/json',
    'dangerously-allow-browser': 'true' // Anthropic specific header for client-side
  };

  const body = {
    model: config.modelId,
    max_tokens: 1024,
    messages: messages
  };

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
};


// --- Exported Services ---

/**
 * Processes a credit card document (PDF/Image) to extract fee/benefit info.
 * Supports multimodal inputs for Gemini, OpenAI Vision, and Anthropic.
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
    Summarize concisely.
  `;

  try {
    if (config.provider === 'google') {
       return await callGoogleGemini(config, {
         parts: [
           { inlineData: { mimeType: file.type, data: base64Data } },
           { text: promptText }
         ]
       });
    } else if (config.provider === 'openai' || config.provider === 'custom') {
       // OpenAI Vision format
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

  const fullPrompt = `${MOCK_ADVICE_PROMPT}\n\nUser Data:\n${cardSummary}\n\nQuestion: ${question}`;

  try {
    if (config.provider === 'google') {
      return await callGoogleGemini(config, fullPrompt);
    } else if (config.provider === 'anthropic') {
      return await callAnthropic(config, [{ role: 'user', content: fullPrompt }]);
    } else {
      // OpenAI / Custom
      return await callOpenAICompatible(config, [{ role: 'user', content: fullPrompt }]);
    }
  } catch (error: any) {
    console.error("AI Coach Error:", error);
    return `Error connecting to ${config.provider} AI: ${error.message}`;
  }
};

/**
 * Uses Google Gemini's Location Grounding (Maps Tool) to recommend cards.
 * This is a provider-exclusive feature.
 */
export const recommendCardAtLocation = async (
  latitude: number,
  longitude: number,
  cards: CreditCard[]
) => {
  if (!checkOnline()) return "Network unavailable.";

  const config = await getAIConfig();

  // Location Grounding is EXCLUSIVE to Gemini Models via the GoogleGenAI SDK tools
  if (config.provider !== 'google') {
    return `⚠️ **Provider Limitation**: Location Intelligence (Google Maps Grounding) is currently only supported when using the **Google Gemini** provider. Please switch providers in Settings to use this feature.`;
  }

  const cardContext = cards.map(c => 
    `ID: ${c.id}, Name: ${c.issuer} ${c.name}, Benefits: ${c.benefits.map(b => `${b.category}:${b.multiplier}x`).join(', ')}`
  ).join('\n');

  const prompt = `
    I am at lat:${latitude}, long:${longitude}.
    1. Use Google Maps to identify the place.
    2. Determine spending category.
    3. Recommend best card from my list:
    ${cardContext}
    
    Output Format:
    ### 📍 [Place Name]
    **Category:** [Category]
    **Recommended:** ✨ [Card Name]
    **Why:** [Reason]
  `;

  try {
     const client = new GoogleGenAI({ apiKey: config.apiKey || process.env.API_KEY || '' });
     const response = await client.models.generateContent({
      model: 'gemini-2.5-flash', // Force 2.5 for Maps Tool compatibility
      contents: prompt,
      config: {
        tools: [{ googleMaps: {} }],
        toolConfig: { retrievalConfig: { latLng: { latitude, longitude } } }
      }
    });
    return response.text;
  } catch (error: any) {
    console.error("Gemini Location Error:", error);
    return `Location Scan Failed: ${error.message}`;
  }
};
