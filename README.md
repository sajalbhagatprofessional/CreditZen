# CreditZen - AI-Powered Credit Manager PWA

CreditZen is a futuristic, secure, **offline-first** Progressive Web App (PWA) designed to help users manage credit cards, maximize rewards, and optimize credit scores using the **AZEO (All Zero Except One)** method.

It features a **Credit Coach** powered by Google Gemini (or custom AI providers), **Location-Based Card Recommendations**, and **Military-Grade Client-Side Encryption** (AES-GCM) to ensure sensitive financial data never leaves the user's device in plain text.

![CreditZen Screenshot](https://via.placeholder.com/800x400?text=CreditZen+Dashboard+Preview)

## 🚀 Key Features

*   **🔒 Secure Vault**: All data is encrypted locally using AES-GCM derived from your password. Encrypted blobs are synced to Supabase for cross-device access.
*   **📡 Offline-First**: Works completely offline. Data is stored locally and syncs to the cloud automatically when connection is restored.
*   **☁️ Cloud Sync**: Seamlessly access your wallet across devices using Supabase Auth & Database.
*   **🤖 AI Credit Coach**: Chat with an AI financial expert (Gemini, OpenAI, Anthropic, or Local/Custom) about your utilization and strategy.
*   **📍 Location Grounding**: (Gemini Exclusive) Automatically detects your location to recommend the best card for specific stores/restaurants.
*   **📄 Document Intelligence**: Upload policy PDFs or images; AI extracts fee schedules and APR rates.
*   **📱 Native PWA Feel**: Installable on Android/iOS with App Shortcuts, offline support, and 3D haptic UI.
*   **🎨 Glassmorphism UI**: Modern, ambient interface with 3D card tilts, holographic effects, and HUD-style dashboards.

## 🛠️ Tech Stack

*   **Frontend**: React 18, TypeScript
*   **Styling**: Tailwind CSS (with custom animations & glassmorphism)
*   **Backend**: Supabase (Auth & Database)
*   **AI Integration**: Google GenAI SDK (`@google/genai`)
*   **Security**: Web Crypto API (PBKDF2 + AES-GCM)
*   **Offline Support**: Vite PWA Plugin + Service Workers
*   **Icons**: Lucide React
*   **Build/Bundling**: Vite

## 💻 Getting Started

### Prerequisites
*   Node.js (v16 or higher)
*   npm or yarn
*   A Supabase project

### 1. Installation
Clone the repository and install dependencies:

```bash
git clone https://github.com/yourusername/creditzen.git
cd creditzen
npm install
```

### 2. Environment Configuration
Create a `.env` file in the root directory to store your Supabase and Google Gemini API Keys.

```env
# Supabase Configuration (Required for Auth & Sync)
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key

# Google Gemini API Key (Optional - for AI Features)
# Get one here: https://aistudio.google.com/
VITE_GEMINI_API_KEY=your_google_gemini_api_key_here
```

### 3. Database Setup
Run the following SQL in your Supabase SQL Editor to create the necessary table and security policies:

```sql
-- Create a table to store encrypted user data
create table if not exists public.user_data (
  user_id uuid references auth.users not null primary key,
  iv text not null,
  ciphertext text not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable Row Level Security (RLS)
alter table public.user_data enable row level security;

-- Create policies
create policy "Users can view their own data" on public.user_data
  for select using (auth.uid() = user_id);

create policy "Users can insert their own data" on public.user_data
  for insert with check (auth.uid() = user_id);

create policy "Users can update their own data" on public.user_data
  for update using (auth.uid() = user_id);
```

### 4. Run Locally
Start the development server:

```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) to view it in the browser.

## 📦 Deployment

### Build
Create a production-ready build:

```bash
npm run build
```

### Deploy to Vercel / Netlify
1. Connect your repository.
2. Add the environment variables (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_GEMINI_API_KEY`).
3. Deploy!

## 📂 Project Structure

```
/
├── public/              # Static assets (icons, manifest, service-worker)
├── src/
│   ├── components/      # UI Components
│   │   ├── Layout.tsx       # Main shell (Header, Nav, Background)
│   │   ├── CardList.tsx     # 3D Card rendering list
│   │   ├── CardForm.tsx     # Add/Edit Card Modal
│   │   ├── Dashboard.tsx    # HUD Stats & Alerts
│   │   ├── AICoach.tsx      # Chat Interface
│   │   ├── Settings.tsx     # AI Config & Backup/Restore
│   │   ├── Auth.tsx         # Login/Register & Encryption Logic
│   │   └── ...
│   ├── services/        # Logic Layer
│   │   ├── supabaseClient.ts# Supabase client initialization
│   │   ├── geminiService.ts # AI API calls (Google/OpenAI/Anthropic)
│   │   ├── storageService.ts# Data persistence (Supabase + LocalStorage fallback)
│   │   ├── authService.ts   # User session management
│   │   └── cryptoUtils.ts   # Low-level AES-GCM encryption
│   ├── types.ts         # TypeScript interfaces
│   ├── constants.ts     # Global constants & icons
│   ├── App.tsx          # Main Router & State
│   └── index.tsx        # Entry point
└── metadata.json        # Permissions config
```

## 🔐 Security Architecture

CreditZen uses a **Zero-Knowledge Architecture**:

1.  **Registration**: A random `salt` is generated. Your password + salt runs through **PBKDF2** to derive a `CryptoKey`.
2.  **Encryption**: User data (cards, notes, settings) is encrypted with **AES-GCM** using this key.
3.  **Storage**: Only the `ciphertext`, `iv` (initialization vector), and `salt` are stored in Supabase. The server never sees the decrypted data or the key.
4.  **Login**: The app attempts to re-derive the key from your input password. If it successfully decrypts the data, you are logged in.
5.  **Session Persistence**: The derived key is temporarily stored in `localStorage` (as a JWK) to allow page reloads without re-login. It automatically expires after **20 minutes** of inactivity for security.

## 🤖 AI Configuration

Users can customize the AI provider in **Settings > AI Configuration**:

1.  **Google Gemini**: Default. Supports Location Grounding & Thinking models.
2.  **OpenAI / Custom**: Compatible with OpenAI-style endpoints.
    *   *Base URL*: Can be set to `http://localhost:11434/v1` for local **Ollama** models.
3.  **Anthropic**: Direct integration with Claude models (requires CORS proxy if running strictly client-side).

## 📱 Mobile Installation (Android/iOS)

1.  Open the app in Chrome (Android) or Safari (iOS).
2.  **Android**: Tap the "Install" button in the header or "Add to Home Screen" in the menu.
    *   *Try long-pressing the app icon for Quick Actions!*
3.  **iOS**: Tap "Share" -> "Add to Home Screen".

---

**Disclaimer**: This app does not provide financial advice. It is a management tool. Always verify rates and dates with your bank.
