import { CardCategory, AISettings } from './types';

export const CATEGORY_ICONS: Record<string, string> = {
  [CardCategory.Dining]: '🍽️',
  [CardCategory.Travel]: '✈️',
  [CardCategory.Grocery]: '🛒',
  [CardCategory.Gas]: '⛽',
  [CardCategory.OnlineShopping]: '🛍️',
  [CardCategory.Streaming]: '📺',
  [CardCategory.Drugstore]: '💊',
  [CardCategory.Entertainment]: '🎟️',
  [CardCategory.General]: '💳',
  [CardCategory.Business]: '💼'
};

export const getCategoryIcon = (category: string) => {
  return CATEGORY_ICONS[category] || '✨'; // Default sparkle for custom categories
};

export const STANDARD_CATEGORIES = Object.values(CardCategory);

export const DEFAULT_NOTIFICATIONS = {
  daysBeforeStatement: 5,
  daysBeforeDue: 3
};

export const DEFAULT_AI_SETTINGS: AISettings = {
  provider: 'google',
  modelId: 'gemini-3-flash-preview',
  apiKey: '' 
};

export const MOCK_ADVICE_PROMPT = `
You are an expert CPA and Credit Card Manager named "CreditZen AI". 
Your goal is to help the user maximize their credit score and rewards.
Focus on:
1. Low Utilization (AZEO method).
2. Paying before the STATEMENT date (not just due date) to report lower balances.
3. Maximizing points based on spending categories.
Keep answers concise, actionable, and formatted with Markdown.
`;