import express, { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MOCK_ADVICE_PROMPT = `
You are an expert CPA and Credit Card Manager named "CreditZen AI". 
Your goal is to help the user maximize their credit score and rewards.
Focus on:
1. Low Utilization (AZEO method).
2. Paying before the STATEMENT date (not just due date) to report lower balances.
3. Maximizing points based on spending categories.
Keep answers concise, actionable, and formatted with Markdown.
`;

function getGeminiClient(customApiKey?: string): GoogleGenAI {
  const key = customApiKey || process.env.GEMINI_API_KEY;
  if (!key) {
    throw new Error('GEMINI_API_KEY is not set in the environment or request.');
  }
  return new GoogleGenAI({ apiKey: key });
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware for body parsing with support for image/document uploads
  app.use(express.json({ limit: '15mb' }));
  app.use(express.urlencoded({ extended: true, limit: '15mb' }));

  // --- API Routes ---
  app.get('/api/health', (req: Request, res: Response) => {
    res.json({
      status: 'ok',
      time: new Date().toISOString(),
      geminiConfigured: Boolean(process.env.GEMINI_API_KEY)
    });
  });

  // AI Coach Chat
  app.post('/api/gemini/coach', async (req: Request, res: Response) => {
    try {
      const { question, cardSummary, customApiKey } = req.body;
      if (!question) {
        res.status(400).json({ error: 'Question is required' });
        return;
      }

      const client = getGeminiClient(customApiKey);
      const fullPrompt = `${MOCK_ADVICE_PROMPT}\n\nUser Data:\n${cardSummary || 'No cards currently in wallet.'}\n\nQuestion: ${question}`;

      const response = await client.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: fullPrompt,
      });

      res.json({ text: response.text || '' });
    } catch (error: any) {
      console.error('[Gemini Server Error - Coach]:', error);
      res.status(500).json({ error: error.message || 'Failed to generate coach advice' });
    }
  });

  // Document Processing (PDF/Image analysis for fees/rewards)
  app.post('/api/gemini/process-document', async (req: Request, res: Response) => {
    try {
      const { mimeType, base64Data, customApiKey } = req.body;
      if (!base64Data || !mimeType) {
        res.status(400).json({ error: 'base64Data and mimeType are required' });
        return;
      }

      const client = getGeminiClient(customApiKey);
      const promptText = `
        Analyze this credit card document. Extract:
        1. Fees (Annual, Foreign Tx, Late)
        2. APR Rates
        3. Insurance/Protections
        4. Reward Categories & Multipliers
        Summarize concisely in Markdown.
      `;

      const response = await client.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [
          { inlineData: { mimeType, data: base64Data } },
          { text: promptText }
        ]
      });

      res.json({ text: response.text || '' });
    } catch (error: any) {
      console.error('[Gemini Server Error - Document]:', error);
      res.status(500).json({ error: error.message || 'Failed to process card document' });
    }
  });

  // Card OCR / Scan Details
  app.post('/api/gemini/scan-card', async (req: Request, res: Response) => {
    try {
      const { mimeType, base64Data, customApiKey } = req.body;
      if (!base64Data || !mimeType) {
        res.status(400).json({ error: 'base64Data and mimeType are required' });
        return;
      }

      const client = getGeminiClient(customApiKey);
      const promptText = `
        Analyze this credit card image. Extract the following details in JSON format:
        - issuer (e.g., Chase, Amex, Citi, Capital One)
        - name (e.g., Sapphire Preferred, Gold Card, Double Cash)
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

      const response = await client.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [
          { inlineData: { mimeType, data: base64Data } },
          { text: promptText }
        ]
      });

      const raw = response.text || '{}';
      const cleanJson = raw.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleanJson);
      res.json({ details: parsed });
    } catch (error: any) {
      console.error('[Gemini Server Error - Scan]:', error);
      res.status(500).json({ error: error.message || 'Failed to scan card image' });
    }
  });

  // Location-based Card Recommendation (Google Maps tool)
  app.post('/api/gemini/recommend-location', async (req: Request, res: Response) => {
    try {
      const { latitude, longitude, cardContext, customApiKey } = req.body;
      if (latitude === undefined || longitude === undefined) {
        res.status(400).json({ error: 'latitude and longitude are required' });
        return;
      }

      const client = getGeminiClient(customApiKey);
      const prompt = `
        I am at lat:${latitude}, long:${longitude}.
        1. Use Google Maps to identify the place.
        2. Determine spending category (e.g. Dining, Grocery, Travel, Gas, Entertainment).
        3. Recommend best card from my list:
        ${cardContext || 'No cards provided'}
        
        Output Format:
        ### 📍 [Place Name]
        **Category:** [Category]
        **Recommended:** ✨ [Card Name]
        **Why:** [Reason]
      `;

      const response = await client.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          tools: [{ googleMaps: {} }],
          toolConfig: { retrievalConfig: { latLng: { latitude, longitude } } }
        }
      });

      res.json({ text: response.text || '' });
    } catch (error: any) {
      console.error('[Gemini Server Error - Location]:', error);
      res.status(500).json({ error: error.message || 'Failed to get location recommendation' });
    }
  });

  // --- Vite Dev Middleware or Production Static Serving ---
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`CreditZen server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
