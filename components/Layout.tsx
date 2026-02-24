import React, { useState, useEffect } from 'react';
import { CreditCard as CardIcon, LayoutDashboard, Zap, Settings as SettingsIcon, ShieldCheck, WifiOff, Download, LogOut } from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onLogout?: () => void;
}

export const Layout: React.FC<LayoutProps> = ({ children, activeTab, setActiveTab, onLogout }) => {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [installPrompt, setInstallPrompt] = useState<any>(null);

  useEffect(() => {
    // Network Listeners
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // PWA Install Prompt Listener (Android/Chrome)
    const handleInstallPrompt = (e: any) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleInstallPrompt);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('beforeinstallprompt', handleInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === 'accepted') {
      setInstallPrompt(null);
    }
  };

  const navItems = [
    { id: 'dashboard', icon: LayoutDashboard, label: 'Dash' },
    { id: 'wallet', icon: CardIcon, label: 'Wallet' },
    { id: 'optimizer', icon: Zap, label: 'Boost' },
    { id: 'coach', icon: ShieldCheck, label: 'Coach' },
    { id: 'settings', icon: SettingsIcon, label: 'Setup' },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 flex flex-col font-sans relative overflow-hidden selection:bg-emerald-500 selection:text-white">
      
      {/* Ambient Background Animations */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-emerald-600/20 rounded-full mix-blend-screen filter blur-3xl opacity-30 animate-blob"></div>
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-purple-600/20 rounded-full mix-blend-screen filter blur-3xl opacity-30 animate-blob animation-delay-2000"></div>
        <div className="absolute -bottom-32 left-1/3 w-96 h-96 bg-blue-600/20 rounded-full mix-blend-screen filter blur-3xl opacity-30 animate-blob animation-delay-4000"></div>
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 brightness-100 contrast-150 mix-blend-overlay"></div>
      </div>

      {/* Header */}
      <header className="sticky top-0 z-50 glass border-b-0">
        <div className="max-w-3xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3 group cursor-pointer">
            <div className="relative">
               <div className="absolute inset-0 bg-emerald-500 rounded-lg blur opacity-40 group-hover:opacity-60 transition-opacity"></div>
               <div className="bg-slate-900/80 backdrop-blur-sm p-2 rounded-lg relative border border-slate-700">
                 <ShieldCheck className="w-6 h-6 text-emerald-400" />
               </div>
            </div>
            <div>
               <h1 className="text-xl font-extrabold bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent leading-tight tracking-tight">
                CreditZen
              </h1>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {installPrompt && (
              <button
                onClick={handleInstallClick}
                className="flex items-center gap-1 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white px-4 py-1.5 rounded-full text-xs font-bold transition-all shadow-lg shadow-emerald-500/20 animate-pulse-slow"
              >
                <Download className="w-3 h-3" /> <span className="hidden sm:inline">Install App</span>
              </button>
            )}
            {onLogout && (
              <button
                onClick={onLogout}
                className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-full transition-colors"
                title="Logout"
              >
                <LogOut className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>
        
        {/* Offline Banner */}
        {isOffline && (
          <div className="bg-rose-500/90 backdrop-blur-md py-1.5 px-4 animate-fade-in absolute w-full top-16 z-40">
            <div className="max-w-3xl mx-auto flex items-center justify-center gap-2 text-white text-xs font-bold tracking-wide">
              <WifiOff className="w-3 h-3" />
              <span>OFFLINE MODE ACTIVE</span>
            </div>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-3xl mx-auto w-full p-4 pb-28 relative z-10">
        {children}
      </main>

      {/* Floating Bottom Navigation */}
      <nav className="fixed bottom-6 left-4 right-4 z-50">
        <div className="max-w-md mx-auto">
            <div className="glass rounded-2xl px-2 py-3 flex justify-around items-center shadow-2xl shadow-black/50 border border-white/10">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    className="relative flex flex-col items-center justify-center w-14 h-14 group"
                  >
                    {isActive && (
                      <div className="absolute inset-0 bg-emerald-500/20 rounded-xl blur-md transition-all duration-300"></div>
                    )}
                    <div className={`relative z-10 transition-all duration-300 ${isActive ? '-translate-y-1' : ''}`}>
                       <Icon 
                         className={`w-6 h-6 transition-all duration-300 ${isActive ? 'text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.5)]' : 'text-slate-400 group-hover:text-slate-200'}`} 
                         strokeWidth={isActive ? 2.5 : 2} 
                       />
                    </div>
                    <span className={`text-[9px] font-bold mt-1 transition-all duration-300 ${isActive ? 'text-emerald-400 opacity-100' : 'text-slate-500 opacity-0 group-hover:opacity-100 -translate-y-2 group-hover:translate-y-0'}`}>
                      {item.label}
                    </span>
                    
                    {/* Active Dot */}
                    {isActive && (
                      <div className="absolute bottom-1 w-1 h-1 bg-emerald-400 rounded-full shadow-[0_0_5px_#34d399]"></div>
                    )}
                  </button>
                );
              })}
            </div>
        </div>
      </nav>
    </div>
  );
};