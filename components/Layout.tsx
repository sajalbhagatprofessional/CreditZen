import React, { useState, useEffect } from 'react';
import { 
  CreditCard as CardIcon, 
  LayoutDashboard, 
  Zap, 
  Settings as SettingsIcon, 
  ShieldCheck, 
  WifiOff, 
  Download, 
  LogOut, 
  Bell, 
  X, 
  ExternalLink, 
  Calendar, 
  AlertCircle, 
  Sparkles 
} from 'lucide-react';
import { UrgentAlert } from '../services/notificationService';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onLogout?: () => void;
  alerts?: UrgentAlert[];
  updateAvailable?: boolean;
  onApplyUpdate?: () => void;
  deferredPrompt?: any;
}

export const Layout: React.FC<LayoutProps> = ({ 
  children, 
  activeTab, 
  setActiveTab, 
  onLogout,
  alerts = [],
  updateAvailable = false,
  onApplyUpdate,
  deferredPrompt
}) => {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [showNotifications, setShowNotifications] = useState(false);
  const [dismissedUpdate, setDismissedUpdate] = useState(false);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const triggerHaptic = () => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(8);
    }
  };

  const handleTabChange = (tabId: string) => {
    triggerHaptic();
    setActiveTab(tabId);
  };

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      triggerHaptic();
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
      
      {/* Ambient Atmospheric Canvas */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-emerald-600/10 rounded-full mix-blend-screen filter blur-3xl opacity-40 animate-blob"></div>
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-purple-600/10 rounded-full mix-blend-screen filter blur-3xl opacity-40 animate-blob animation-delay-2000"></div>
        <div className="absolute -bottom-32 left-1/3 w-96 h-96 bg-blue-600/10 rounded-full mix-blend-screen filter blur-3xl opacity-40 animate-blob animation-delay-4000"></div>
      </div>

      {/* Header */}
      <header className="sticky top-0 z-50 bg-slate-950/80 backdrop-blur-xl border-b border-slate-800/80">
        <div className="max-w-3xl mx-auto px-4 h-16 flex items-center justify-between">
          <div 
            onClick={() => handleTabChange('dashboard')} 
            className="flex items-center space-x-3 group cursor-pointer"
          >
            <div className="relative">
               <div className="absolute inset-0 bg-emerald-500 rounded-xl blur opacity-30 group-hover:opacity-50 transition-opacity"></div>
               <div className="bg-slate-900/90 backdrop-blur-sm p-2 rounded-xl relative border border-emerald-500/30">
                 <ShieldCheck className="w-5 h-5 text-emerald-400" />
               </div>
            </div>
            <div>
               <h1 className="text-lg font-black bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent leading-tight tracking-tight">
                CreditZen
              </h1>
              <span className="text-[9px] uppercase tracking-wider text-slate-500 font-bold block">
                {isOffline ? 'Offline Vault' : 'Vault Active'}
              </span>
            </div>
          </div>
          
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Install Button if browser supports it */}
            {deferredPrompt && (
              <button
                onClick={handleInstallClick}
                className="flex items-center gap-1.5 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white px-3 py-1.5 rounded-full text-xs font-bold transition-all shadow-lg shadow-emerald-500/20"
              >
                <Download className="w-3.5 h-3.5" /> 
                <span className="hidden sm:inline">Install</span>
              </button>
            )}

            {/* In-app Notification Bell */}
            <div className="relative">
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className="relative p-2 text-slate-400 hover:text-white hover:bg-slate-800/60 rounded-xl transition-colors"
                title="Notifications"
              >
                <Bell className="w-5 h-5" />
                {alerts.length > 0 && (
                  <span className="absolute top-1 right-1 w-4 h-4 bg-amber-500 text-slate-950 font-black text-[9px] rounded-full flex items-center justify-center animate-pulse">
                    {alerts.length}
                  </span>
                )}
              </button>

              {/* Notification Overlay Panel */}
              {showNotifications && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-4 z-50 animate-fade-in">
                  <div className="flex justify-between items-center mb-3 pb-2 border-b border-slate-800">
                    <div className="flex items-center gap-2">
                      <Bell className="w-4 h-4 text-emerald-400" />
                      <h3 className="text-xs font-bold text-white uppercase tracking-wider">Alert Center</h3>
                    </div>
                    <button 
                      onClick={() => setShowNotifications(false)}
                      className="text-slate-500 hover:text-white p-1"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {alerts.length === 0 ? (
                    <div className="py-6 text-center text-xs text-slate-400">
                      <p className="font-semibold text-slate-300">All Clear!</p>
                      <p className="text-[11px] text-slate-500 mt-1">No imminent payment due dates or statement closings.</p>
                    </div>
                  ) : (
                    <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
                      {alerts.map((alert) => (
                        <div 
                          key={alert.id}
                          className={`p-3 rounded-xl border text-xs ${
                            alert.type === 'due' 
                              ? 'bg-rose-950/30 border-rose-900/40 text-rose-200' 
                              : alert.type === 'statement'
                              ? 'bg-amber-950/30 border-amber-900/40 text-amber-200'
                              : 'bg-indigo-950/30 border-indigo-900/40 text-indigo-200'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-bold flex items-center gap-1.5">
                              <AlertCircle className="w-3.5 h-3.5" />
                              {alert.issuer}
                            </span>
                            <span className="text-[10px] font-semibold opacity-80">
                              {alert.daysRemaining === 0 ? 'Today' : `${alert.daysRemaining}d left`}
                            </span>
                          </div>
                          <p className="text-[11px] opacity-90">{alert.message}</p>
                          {alert.actionUrl && (
                            <a 
                              href={alert.actionUrl} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-[10px] font-bold mt-2 text-emerald-400 hover:underline"
                            >
                              <span>Pay Now</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Logout / Lock Button */}
            {onLogout && (
              <button
                onClick={onLogout}
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-800/60 rounded-xl transition-colors"
                title="Lock Vault"
              >
                <LogOut className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        {/* Offline Notification Pill */}
        {isOffline && (
          <div className="bg-amber-500/90 py-1 px-4 text-slate-950 text-xs font-bold flex items-center justify-center gap-2">
            <WifiOff className="w-3.5 h-3.5" />
            <span>OFFLINE MODE: Running 100% locally from device storage</span>
          </div>
        )}

        {/* New App Version Update Banner */}
        {updateAvailable && !dismissedUpdate && (
          <div className="bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-2 text-white text-xs flex items-center justify-between shadow-lg">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 shrink-0" />
              <span>A new update is available with the latest features!</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={onApplyUpdate}
                className="bg-white text-emerald-900 font-bold px-3 py-1 rounded-lg text-xs hover:bg-slate-100 transition-all shadow"
              >
                Update Now
              </button>
              <button
                onClick={() => setDismissedUpdate(true)}
                className="text-white/80 hover:text-white p-1"
                title="Dismiss"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-3xl mx-auto w-full p-4 pb-28 relative z-10">
        {children}
      </main>

      {/* Floating Bottom Navigation */}
      <nav className="fixed bottom-4 left-4 right-4 z-50">
        <div className="max-w-md mx-auto">
            <div className="bg-slate-900/90 backdrop-blur-xl rounded-2xl px-2 py-2 flex justify-around items-center shadow-2xl shadow-black/60 border border-slate-800/80">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleTabChange(item.id)}
                    className="relative flex flex-col items-center justify-center w-14 h-12 group transition-all"
                  >
                    {isActive && (
                      <div className="absolute inset-0 bg-emerald-500/10 rounded-xl transition-all duration-300"></div>
                    )}
                    <div className={`relative z-10 transition-all duration-200 ${isActive ? '-translate-y-0.5' : ''}`}>
                       <Icon 
                         className={`w-5 h-5 transition-all duration-200 ${
                           isActive 
                             ? 'text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.6)]' 
                             : 'text-slate-400 group-hover:text-slate-200'
                         }`} 
                         strokeWidth={isActive ? 2.5 : 2} 
                       />
                    </div>
                    <span className={`text-[9px] font-bold mt-1 transition-all duration-200 ${
                      isActive ? 'text-emerald-400 opacity-100' : 'text-slate-500 opacity-80'
                    }`}>
                      {item.label}
                    </span>
                    
                    {/* Active Indicator Dot */}
                    {isActive && (
                      <div className="absolute bottom-0.5 w-1 h-1 bg-emerald-400 rounded-full shadow-[0_0_5px_#34d399]"></div>
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
