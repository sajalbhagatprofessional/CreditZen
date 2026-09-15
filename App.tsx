import React, { useState, useEffect, useRef } from 'react';
import { Layout } from './components/Layout';
import { CardList } from './components/CardList';
import { CardForm } from './components/CardForm';
import { BenefitOptimizer } from './components/BenefitOptimizer';
import { Dashboard } from './components/Dashboard';
import { AICoach } from './components/AICoach';
import { Settings } from './components/Settings';
import { Auth } from './components/Auth';
import { CreditCard, NotificationSettings } from './types';
import { getCards, saveCards, syncData, getSettings } from './services/storageService';
import { isAuthenticated, logoutUser, checkSession } from './services/authService';
import { evaluateCardAlerts, processDailyReminders, UrgentAlert } from './services/notificationService';
import { DEFAULT_NOTIFICATION_SETTINGS } from './constants';
import { Plus } from 'lucide-react';

/**
 * Main Application Component
 * 
 * Orchestrates the entire application lifecycle:
 * - 100% offline-first local encrypted vault execution
 * - PWA installation handling & update checks
 * - Background reminder processing & deadline tracking
 * - Biometric & local vault authentication
 */
const App: React.FC = () => {
  // Navigation & Cards State
  const [activeTab, setActiveTab] = useState('dashboard');
  const [cards, setCards] = useState<CreditCard[]>([]);
  const [alerts, setAlerts] = useState<UrgentAlert[]>([]);
  const [notificationConfig, setNotificationConfig] = useState<NotificationSettings>(DEFAULT_NOTIFICATION_SETTINGS);
  const [showForm, setShowForm] = useState(false);
  const [editingCard, setEditingCard] = useState<CreditCard | undefined>(undefined);
  
  // Auth State
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // PWA & Service Worker State
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const swRegistrationRef = useRef<ServiceWorkerRegistration | null>(null);

  // --- Background Processing & Notification Loop ---
  const runBackgroundTasks = async (currentCards: CreditCard[]) => {
    try {
      const { notifications } = await getSettings();
      const settings = notifications || DEFAULT_NOTIFICATION_SETTINGS;
      setNotificationConfig(settings);

      // 1. Evaluate current deadlines
      const currentAlerts = evaluateCardAlerts(currentCards, settings);
      setAlerts(currentAlerts);

      // 2. Dispatch daily reminder if due
      await processDailyReminders(currentCards, settings);

      // 3. Check for app updates if Service Worker is active
      if (swRegistrationRef.current) {
        try {
          await swRegistrationRef.current.update();
          if (swRegistrationRef.current.waiting) {
            setUpdateAvailable(true);
          }
        } catch (e) {
          // offline check ignored
        }
      }

      // 4. Background sync if online
      if (navigator.onLine && isAuthenticated()) {
        syncData().catch(() => {});
      }
    } catch (e) {
      console.warn('Background processing task warning:', e);
    }
  };

  // --- Initialization & Auth Check ---
  useEffect(() => {
    // 1. PWA Install Prompt Listener
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    
    // 2. Standalone Mode Detection
    if (window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone) {
      setIsInstalled(true);
    }
    
    // 3. Service Worker Lifecycle & Update Detection
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then(registration => {
        swRegistrationRef.current = registration;

        // Check if there is already a waiting worker
        if (registration.waiting) {
          setUpdateAvailable(true);
        }

        // Listen for new worker updates
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                // New content available!
                setUpdateAvailable(true);
              }
            });
          }
        });
      });

      // Reload smoothly when new SW takes control
      let refreshing = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!refreshing) {
          refreshing = true;
          window.location.reload();
        }
      });
    }
    
    // 4. Auth & Vault Initialization
    const initAuth = async () => {
      const hasSession = await checkSession();
      
      if (hasSession && isAuthenticated()) {
        setIsLoggedIn(true);
        const loadedCards = await getCards();
        setCards(loadedCards);
        runBackgroundTasks(loadedCards);
      } else {
        setIsLoggedIn(false);
      }
      setIsLoading(false);
    };
    initAuth();

    // 5. Network restoration sync
    const handleOnline = () => {
      if (isAuthenticated()) {
        syncData().then(() => getCards().then(loaded => {
          setCards(loaded);
          runBackgroundTasks(loaded);
        }));
      }
    };
    window.addEventListener('online', handleOnline);

    // 6. App Visibility / Focus Lifecycle Check (Background wake-up)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && isAuthenticated()) {
        getCards().then(loaded => {
          setCards(loaded);
          runBackgroundTasks(loaded);
        });
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleVisibilityChange);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleVisibilityChange);
    };
  }, []);

  // Apply service worker update
  const handleApplyUpdate = () => {
    if (swRegistrationRef.current?.waiting) {
      swRegistrationRef.current.waiting.postMessage({ type: 'SKIP_WAITING' });
    }
    setTimeout(() => {
      window.location.reload();
    }, 500);
  };

  // --- Event Handlers ---

  const handleLoginSuccess = async () => {
    setIsLoggedIn(true);
    const loadedCards = await getCards();
    setCards(loadedCards);
    runBackgroundTasks(loadedCards);
  };

  const handleLogout = async () => {
    await logoutUser();
    setIsLoggedIn(false);
    setCards([]);
    setAlerts([]);
    setActiveTab('dashboard');
  };

  // --- Deep Linking & Shortcuts ---
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const action = params.get('action');
    const tab = params.get('tab');

    if (tab) {
      setActiveTab(tab);
    }
    if (action === 'add-card') {
      setActiveTab('wallet');
      setTimeout(() => setShowForm(true), 150);
    }
  }, []);

  // Reset form state when tab changes
  useEffect(() => {
    setShowForm(false);
    setEditingCard(undefined);
  }, [activeTab]);

  // --- CRUD Operations ---

  const handleSaveCard = async (card: CreditCard) => {
    let newCards: CreditCard[];
    if (editingCard) {
      newCards = cards.map(c => c.id === card.id ? card : c);
    } else {
      newCards = [...cards, card];
    }
    setCards(newCards);
    await saveCards(newCards);
    runBackgroundTasks(newCards);
    setShowForm(false);
    setEditingCard(undefined);
  };

  const handleDeleteCard = async (id: string) => {
    const newCards = cards.filter(c => c.id !== id);
    setCards(newCards);
    await saveCards(newCards);
    runBackgroundTasks(newCards);
  };

  const openEdit = (card: CreditCard) => {
    setEditingCard(card);
    setShowForm(true);
  };

  // --- Render ---

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-3">
        <div className="w-12 h-12 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin"></div>
        <p className="text-xs text-slate-400 font-medium">Opening secure vault...</p>
      </div>
    );
  }

  if (!isLoggedIn) {
    return <Auth onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <>
      <Layout 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        onLogout={handleLogout}
        alerts={alerts}
        updateAvailable={updateAvailable}
        onApplyUpdate={handleApplyUpdate}
        deferredPrompt={deferredPrompt}
      >
        {/* Dashboard View */}
        {activeTab === 'dashboard' && <Dashboard cards={cards} setActiveTab={setActiveTab} />}
        
        {/* Wallet View */}
        {activeTab === 'wallet' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h2 className="text-xl font-bold text-white">Your Wallet</h2>
                <p className="text-xs text-slate-400">Encrypted on device • {cards.length} card{cards.length !== 1 ? 's' : ''}</p>
              </div>
              <button 
                onClick={() => { setEditingCard(undefined); setShowForm(true); }}
                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-3.5 py-2 rounded-xl text-xs font-bold transition-all shadow-lg shadow-emerald-900/30 active:scale-95"
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
        {activeTab === 'settings' && (
          <Settings 
            onLogout={handleLogout} 
            deferredPrompt={deferredPrompt} 
            isInstalled={isInstalled} 
          />
        )}
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
