import React, { useState, useEffect } from 'react';
import { Layout } from './components/Layout';
import { CardList } from './components/CardList';
import { CardForm } from './components/CardForm';
import { BenefitOptimizer } from './components/BenefitOptimizer';
import { Dashboard } from './components/Dashboard';
import { AICoach } from './components/AICoach';
import { Settings } from './components/Settings';
import { Auth } from './components/Auth';
import { CreditCard } from './types';
import { getCards, saveCards, syncData } from './services/storageService';
import { isAuthenticated, logoutUser, checkSession } from './services/authService';
import { Plus } from 'lucide-react';

/**
 * Main Application Component
 * 
 * Orchestrates the entire application flow, including:
 * - Authentication state (Login/Logout)
 * - Data loading and synchronization (Supabase <-> LocalStorage)
 * - Routing (Tab navigation)
 * - Global state for Cards
 */
const App: React.FC = () => {
  // --- State Management ---
  const [activeTab, setActiveTab] = useState('dashboard');
  const [cards, setCards] = useState<CreditCard[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingCard, setEditingCard] = useState<CreditCard | undefined>(undefined);
  
  // Auth State
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // --- Initialization & Auth Check ---
  useEffect(() => {
    const initAuth = async () => {
      // checkSession() attempts to restore the encryption key from local storage
      // if the session is still valid (within 20 mins).
      const hasSession = await checkSession();
      
      if (hasSession && isAuthenticated()) {
        setIsLoggedIn(true);
        
        // Load initial data from local cache or decrypted memory
        const loadedCards = await getCards();
        setCards(loadedCards);
        
        // Trigger background sync to fetch latest changes from Supabase
        // This ensures we have the most up-to-date data without blocking the UI
        syncData().then(() => getCards().then(setCards));
      } else {
        setIsLoggedIn(false);
      }
      setIsLoading(false);
    };
    initAuth();

    // --- Online/Offline Sync Handlers ---
    const handleOnline = () => {
      if (isAuthenticated()) {
        console.log("Network restored. Syncing data...");
        syncData().then(() => getCards().then(setCards));
      }
    };
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, []);

  // --- Event Handlers ---

  const handleLoginSuccess = async () => {
    setIsLoggedIn(true);
    const loadedCards = await getCards();
    setCards(loadedCards);
  };

  const handleLogout = async () => {
    await logoutUser();
    setIsLoggedIn(false);
    setCards([]);
    setActiveTab('dashboard');
  };

  const refreshData = async () => {
    const loadedCards = await getCards();
    setCards(loadedCards);
  };

  // --- Deep Linking & Shortcuts ---
  useEffect(() => {
    refreshData();

    // Handle PWA Shortcuts (e.g., long press icon -> Add Card)
    const params = new URLSearchParams(window.location.search);
    const action = params.get('action');
    const tab = params.get('tab');

    if (tab) {
        setActiveTab(tab);
    }
    if (action === 'add-card') {
        setActiveTab('wallet');
        // Small delay to allow tab render before showing modal
        setTimeout(() => setShowForm(true), 100);
    }
  }, []);

  // Reset form state when tab changes
  useEffect(() => {
    setShowForm(false);
    setEditingCard(undefined);
  }, [activeTab]);

  // --- CRUD Operations ---

  const handleSaveCard = async (card: CreditCard) => {
    let newCards;
    if (editingCard) {
      newCards = cards.map(c => c.id === card.id ? card : c);
    } else {
      newCards = [...cards, card];
    }
    setCards(newCards);
    // Saves to local storage AND syncs to Supabase if online
    await saveCards(newCards);
    setShowForm(false);
    setEditingCard(undefined);
  };

  const handleDeleteCard = async (id: string) => {
    if (confirm("Are you sure you want to delete this card?")) {
      const newCards = cards.filter(c => c.id !== id);
      setCards(newCards);
      await saveCards(newCards);
    }
  };

  const openEdit = (card: CreditCard) => {
    setEditingCard(card);
    setShowForm(true);
  };

  // --- Render ---

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  if (!isLoggedIn) {
    return <Auth onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <>
      <Layout activeTab={activeTab} setActiveTab={setActiveTab} onLogout={handleLogout}>
        {/* Dashboard View */}
        {activeTab === 'dashboard' && <Dashboard cards={cards} setActiveTab={setActiveTab} />}
        
        {/* Wallet View */}
        {activeTab === 'wallet' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-white">Your Wallet</h2>
              <button 
                onClick={() => { setEditingCard(undefined); setShowForm(true); }}
                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-2 rounded-lg text-sm font-semibold transition-colors shadow-lg shadow-emerald-900/20"
              >
                <Plus className="w-4 h-4" /> Add Card
              </button>
            </div>
            <CardList cards={cards} onEdit={openEdit} onDelete={handleDeleteCard} />
          </div>
        )}

        {/* Optimizer View */}
        {activeTab === 'optimizer' && <BenefitOptimizer cards={cards} />}
        
        {/* AI Coach View */}
        {activeTab === 'coach' && <AICoach cards={cards} />}

        {/* Settings View */}
        {activeTab === 'settings' && <Settings onLogout={handleLogout} />}
      </Layout>

      {/* Global Card Form Modal */}
      {showForm && (
        <CardForm 
          initialData={editingCard} 
          onSave={handleSaveCard} 
          onCancel={() => { setShowForm(false); setEditingCard(undefined); }} 
        />
      )}
    </>
  );
};

export default App;
