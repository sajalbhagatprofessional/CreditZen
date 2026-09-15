import React, { useRef, useState, useEffect } from 'react';
import { 
  Download, 
  Upload, 
  Trash2, 
  AlertTriangle, 
  Check, 
  FileJson, 
  Bot, 
  Save, 
  Key, 
  LogOut, 
  Fingerprint, 
  Loader2, 
  Smartphone, 
  Bell, 
  RefreshCw, 
  ShieldCheck, 
  Send 
} from 'lucide-react';
import { exportWalletJSON, importWalletJSON, getSettings, saveSettings } from '../services/storageService';
import { AISettings, AIProvider, NotificationSettings } from '../types';
import { DEFAULT_AI_SETTINGS, DEFAULT_NOTIFICATION_SETTINGS } from '../constants';
import { 
  isBiometricAvailable, 
  isBiometricEnabled, 
  enableBiometrics, 
  disableBiometrics 
} from '../services/authService';
import { 
  isNotificationSupported, 
  getNotificationPermission, 
  requestNotificationPermission, 
  sendTestNotification 
} from '../services/notificationService';

interface SettingsProps {
  onLogout?: () => void;
  deferredPrompt?: any;
  isInstalled?: boolean;
}

export const Settings: React.FC<SettingsProps> = ({ onLogout, deferredPrompt, isInstalled }) => {
  const [importMode, setImportMode] = useState<'append' | 'replace'>('append');
  const [status, setStatus] = useState<string>('');
  
  // AI Settings State
  const [aiConfig, setAiConfig] = useState<AISettings>(DEFAULT_AI_SETTINGS);
  const [showKey, setShowKey] = useState(false);
  
  // Notification State
  const [notificationConfig, setNotificationConfig] = useState<NotificationSettings>(DEFAULT_NOTIFICATION_SETTINGS);
  const [notifPermission, setNotifPermission] = useState<NotificationPermission>('default');
  const [isSendingTestNotif, setIsSendingTestNotif] = useState(false);

  // Biometric State
  const [biometricsActive, setBiometricsActive] = useState(false);
  const [isBioLoading, setIsBioLoading] = useState(false);
  
  // Update State
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const [updateMessage, setUpdateMessage] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const loadData = async () => {
      const { ai, notifications } = await getSettings();
      setAiConfig(ai);
      if (notifications) {
        setNotificationConfig(notifications);
      }
      
      setBiometricsActive(isBiometricEnabled());
      setNotifPermission(getNotificationPermission());
    };
    loadData();
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) {
      setStatus("Installation prompt not active yet. Follow instructions below.");
      return;
    }
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setStatus("CreditZen installed successfully!");
    }
    setTimeout(() => setStatus(''), 3000);
  };

  const handleToggleBiometrics = async () => {
    setIsBioLoading(true);
    setStatus("");
    try {
      if (biometricsActive) {
        disableBiometrics();
        setBiometricsActive(false);
        setStatus("Biometric unlock has been disabled.");
      } else {
        await enableBiometrics();
        setBiometricsActive(true);
        setStatus("Biometric unlock enabled! You can now use Fingerprint or Face to unlock.");
      }
    } catch (e: any) {
      console.error("Biometric toggle error:", e);
      setStatus(`Biometric error: ${e.message || "Failed to configure biometrics"}`);
    } finally {
      setIsBioLoading(false);
      setTimeout(() => setStatus(''), 6000);
    }
  };

  const handleRequestNotifications = async () => {
    try {
      const perm = await requestNotificationPermission();
      setNotifPermission(perm);
      if (perm === 'granted') {
        setStatus("Notifications enabled! You will receive due date reminders.");
      } else if (perm === 'denied') {
        setStatus("Notifications denied in browser. Please allow them in site settings.");
      }
    } catch (e: any) {
      setStatus(`Notification error: ${e.message}`);
    }
    setTimeout(() => setStatus(''), 4000);
  };

  const handleSendTestNotification = async () => {
    setIsSendingTestNotif(true);
    setStatus("");
    try {
      const success = await sendTestNotification();
      if (success) {
        setStatus("Test notification sent! Check your device notification tray.");
      } else {
        setStatus("Please enable notifications above first.");
      }
    } catch (e: any) {
      setStatus(e.message || "Failed to send test notification");
    } finally {
      setIsSendingTestNotif(false);
      setTimeout(() => setStatus(''), 5000);
    }
  };

  const handleSaveNotifications = async () => {
    await saveSettings(notificationConfig, aiConfig);
    setStatus("Notification preferences saved.");
    setTimeout(() => setStatus(''), 3000);
  };

  const handleCheckForUpdates = async () => {
    setIsCheckingUpdate(true);
    setUpdateMessage('');
    try {
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.getRegistration();
        if (registration) {
          await registration.update();
          if (registration.waiting) {
            setUpdateMessage("New update available! Click reload to apply.");
            registration.waiting.postMessage({ type: 'SKIP_WAITING' });
            setTimeout(() => window.location.reload(), 1500);
            return;
          }
        }
      }
      setUpdateMessage("You are running the latest version of CreditZen (offline-cached).");
    } catch (e: any) {
      setUpdateMessage("Could not check updates. App is operating normally in offline mode.");
    } finally {
      setIsCheckingUpdate(false);
      setTimeout(() => setUpdateMessage(''), 5000);
    }
  };

  const handleSaveAI = async () => {
    await saveSettings(notificationConfig, aiConfig);
    setStatus("AI Configuration saved securely.");
    setTimeout(() => setStatus(''), 3000);
  };

  const handleExport = async () => {
    try {
      const json = await exportWalletJSON();
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `creditzen-backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setStatus('Backup downloaded successfully.');
    } catch (e) {
      setStatus('Failed to export backup.');
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const json = event.target?.result as string;
        await importWalletJSON(json, importMode === 'append');
        setStatus(`Successfully ${importMode === 'append' ? 'appended' : 'replaced'} wallet data.`);
        setTimeout(() => window.location.reload(), 1000);
      } catch (err) {
        setStatus('Error importing file. Format invalid.');
      }
    };
    reader.readAsText(file);
    e.target.value = ''; 
  };

  const handleClearData = () => {
    if (confirm("Are you sure you want to clear all local app data? This action cannot be undone.")) {
       localStorage.clear();
       window.location.reload();
    }
  };

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      
      {/* Status Feedback Toast */}
      {status && (
        <div className={`p-4 border rounded-2xl flex items-center gap-2.5 text-xs font-semibold animate-fade-in ${
          status.toLowerCase().includes('error') || status.toLowerCase().includes('denied')
            ? 'bg-rose-500/10 border-rose-500/20 text-rose-300' 
            : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
        }`}>
          {status.toLowerCase().includes('error') ? <AlertTriangle className="w-4 h-4 shrink-0" /> : <Check className="w-4 h-4 shrink-0" />}
          <span>{status}</span>
        </div>
      )}

      {/* Security & Biometric Section */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <h2 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
          <Fingerprint className="w-5 h-5 text-emerald-400" />
          Biometrics & Security
        </h2>
        <p className="text-xs text-slate-400 mb-5">
          Unlock your vault instantly using your phone's fingerprint sensor or FaceID.
        </p>

        <div className="bg-slate-950/60 border border-slate-800 p-4 rounded-xl flex items-center justify-between gap-3">
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <span>Biometric Unlock</span>
              {biometricsActive && (
                <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full font-bold">
                  Active
                </span>
              )}
            </h3>
            <p className="text-xs text-slate-400">
              {biometricsActive 
                ? 'Your device fingerprint/passkey is enrolled for fast unlock.' 
                : 'Enables TouchID, FaceID or Android fingerprint sensor.'}
            </p>
          </div>

          <button 
            onClick={handleToggleBiometrics}
            disabled={isBioLoading}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all border shrink-0 ${
              biometricsActive 
                ? 'bg-emerald-600/20 border-emerald-500/40 text-emerald-300 hover:bg-emerald-600/30' 
                : 'bg-emerald-600 hover:bg-emerald-500 border-emerald-500 text-white shadow-lg shadow-emerald-900/30'
            }`}
          >
            {isBioLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Confirming...</span>
              </>
            ) : (
              biometricsActive ? 'Disable' : 'Enable Biometrics'
            )}
          </button>
        </div>
      </div>

      {/* Reminders & Notifications Section */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <h2 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
          <Bell className="w-5 h-5 text-emerald-400" />
          Card Reminders & Background Alerts
        </h2>
        <p className="text-xs text-slate-400 mb-5">
          Stay ahead of billing cycles. Get notified before statement closing to optimize credit utilization.
        </p>

        <div className="space-y-4">
          {/* Permission Status & Action */}
          <div className="bg-slate-950/60 border border-slate-800 p-4 rounded-xl flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold text-white">Device Notifications</p>
              <p className="text-[11px] text-slate-400">
                Status: <span className={`font-bold ${notifPermission === 'granted' ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {notifPermission === 'granted' ? 'Allowed' : notifPermission === 'denied' ? 'Blocked in Browser' : 'Not Allowed Yet'}
                </span>
              </p>
            </div>
            
            <div className="flex gap-2">
              {notifPermission !== 'granted' && (
                <button
                  onClick={handleRequestNotifications}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-3 py-2 rounded-xl transition-all"
                >
                  Allow Alerts
                </button>
              )}
              <button
                onClick={handleSendTestNotification}
                disabled={isSendingTestNotif}
                className="bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold px-3 py-2 rounded-xl flex items-center gap-1.5 transition-all"
              >
                {isSendingTestNotif ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                Test Alert
              </button>
            </div>
          </div>

          {/* Threshold Sliders */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-slate-950/40 border border-slate-800 p-3.5 rounded-xl">
              <div className="flex justify-between items-center mb-1">
                <label className="text-xs font-semibold text-white">Statement Closing Alert</label>
                <span className="text-xs font-bold text-emerald-400">{notificationConfig.daysBeforeStatement} days prior</span>
              </div>
              <p className="text-[10px] text-slate-500 mb-2">Notice to pay down balance before reporting</p>
              <input 
                type="range" 
                min={1} 
                max={7} 
                value={notificationConfig.daysBeforeStatement} 
                onChange={e => setNotificationConfig({ ...notificationConfig, daysBeforeStatement: Number(e.target.value) })}
                className="w-full accent-emerald-500"
              />
            </div>

            <div className="bg-slate-950/40 border border-slate-800 p-3.5 rounded-xl">
              <div className="flex justify-between items-center mb-1">
                <label className="text-xs font-semibold text-white">Payment Due Alert</label>
                <span className="text-xs font-bold text-emerald-400">{notificationConfig.daysBeforeDue} days prior</span>
              </div>
              <p className="text-[10px] text-slate-500 mb-2">Notice to avoid late fees and interest</p>
              <input 
                type="range" 
                min={1} 
                max={14} 
                value={notificationConfig.daysBeforeDue} 
                onChange={e => setNotificationConfig({ ...notificationConfig, daysBeforeDue: Number(e.target.value) })}
                className="w-full accent-emerald-500"
              />
            </div>
          </div>

          <button
            onClick={handleSaveNotifications}
            className="w-full bg-slate-800 hover:bg-slate-700 border border-slate-700 text-emerald-400 text-xs font-bold py-2.5 rounded-xl flex items-center justify-center gap-2 transition-all"
          >
            <Save className="w-4 h-4" /> Save Notification Preferences
          </button>
        </div>
      </div>

      {/* App Installation & Offline Updates */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <h2 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
          <Smartphone className="w-5 h-5 text-emerald-400" />
          Mobile Installation & App Updates
        </h2>
        <p className="text-xs text-slate-400 mb-5">
          CreditZen runs 100% locally on your device with Service Worker caching. Check for updates anytime when hosted.
        </p>
        
        <div className="space-y-4">
          {isInstalled ? (
            <div className="bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-xl flex items-center gap-3">
              <div className="bg-emerald-500 p-2 rounded-full text-white">
                <Check className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-emerald-400">Standalone App Installed</p>
                <p className="text-[11px] text-slate-400">Running directly from device storage without server lag.</p>
              </div>
            </div>
          ) : deferredPrompt ? (
            <button 
              onClick={handleInstall}
              className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-emerald-900/30 transition-all flex justify-center items-center gap-2"
            >
              <Smartphone className="w-4 h-4" /> Install CreditZen on Device
            </button>
          ) : (
            <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 text-xs text-slate-300 space-y-2">
              <p className="font-semibold text-white">How to Install on Mobile:</p>
              <p><strong>Android (Chrome):</strong> Tap the <strong>⋮</strong> menu and select <strong>"Install app"</strong> or <strong>"Add to Home screen"</strong>.</p>
              <p><strong>iOS (Safari):</strong> Tap the <strong>Share</strong> button and select <strong>"Add to Home Screen"</strong>.</p>
            </div>
          )}

          {/* Check for Updates button */}
          <div className="bg-slate-950/40 border border-slate-800 p-4 rounded-xl flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold text-white">Check for New Version</p>
              <p className="text-[11px] text-slate-400">Queries host server for updates while preserving all cached data.</p>
            </div>
            <button
              onClick={handleCheckForUpdates}
              disabled={isCheckingUpdate}
              className="bg-slate-800 hover:bg-slate-700 text-emerald-400 text-xs font-bold px-3.5 py-2 rounded-xl flex items-center gap-1.5 transition-all border border-slate-700 shrink-0"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isCheckingUpdate ? 'animate-spin' : ''}`} />
              Check Updates
            </button>
          </div>

          {updateMessage && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs rounded-xl flex items-center gap-2">
              <Check className="w-4 h-4" />
              <span>{updateMessage}</span>
            </div>
          )}
        </div>
      </div>

      {/* AI Configuration Section */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <h2 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
          <Bot className="w-5 h-5 text-emerald-400" />
          AI Configuration
        </h2>
        <p className="text-xs text-slate-400 mb-5">
          Customize the AI intelligence for Credit Coach and card document scanning.
        </p>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">AI Provider</label>
            <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800">
              {(['google', 'openai', 'anthropic', 'custom'] as AIProvider[]).map((p) => (
                <button
                  key={p}
                  onClick={() => setAiConfig({ ...aiConfig, provider: p, modelId: p === 'google' ? 'gemini-2.5-flash' : '' })}
                  className={`flex-1 py-1.5 text-xs font-semibold rounded-lg capitalize transition-all ${
                    aiConfig.provider === p
                      ? 'bg-emerald-600 text-white shadow'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Model ID</label>
                <input
                  type="text"
                  placeholder={aiConfig.provider === 'google' ? 'gemini-2.5-flash' : 'gpt-4o'}
                  value={aiConfig.modelId}
                  onChange={(e) => setAiConfig({ ...aiConfig, modelId: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white text-xs focus:ring-2 focus:ring-emerald-500 outline-none"
                />
             </div>
             
             {(aiConfig.provider === 'custom' || aiConfig.provider === 'openai') && (
               <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Base URL (Optional)</label>
                  <input
                    type="text"
                    placeholder="https://api.openai.com/v1"
                    value={aiConfig.baseUrl || ''}
                    onChange={(e) => setAiConfig({ ...aiConfig, baseUrl: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white text-xs focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
               </div>
             )}
          </div>

          <div>
             <label className="block text-xs font-medium text-slate-400 mb-1">
               {aiConfig.provider === 'google' ? 'Custom API Key (Optional)' : 'API Key (Required)'}
             </label>
             <div className="relative">
                <input
                  type={showKey ? "text" : "password"}
                  placeholder={aiConfig.provider === 'google' ? "Leave empty to use default key" : "sk-..."}
                  value={aiConfig.apiKey || ''}
                  onChange={(e) => setAiConfig({ ...aiConfig, apiKey: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-14 py-2 text-white text-xs focus:ring-2 focus:ring-emerald-500 outline-none font-mono"
                />
                <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                <button 
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-emerald-400"
                >
                  {showKey ? 'Hide' : 'Show'}
                </button>
             </div>
          </div>

          <button
            onClick={handleSaveAI}
            className="w-full bg-slate-800 hover:bg-slate-700 border border-slate-700 text-emerald-400 font-bold py-2.5 rounded-xl flex items-center justify-center gap-2 text-xs transition-all"
          >
            <Save className="w-4 h-4" /> Save AI Configuration
          </button>
        </div>
      </div>

      {/* Backup & Data Management */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <h2 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
          <FileJson className="w-5 h-5 text-emerald-400" />
          Offline Data & Vault Backup
        </h2>
        <p className="text-xs text-slate-400 mb-5">
          Export your encrypted vault to a secure JSON file, or restore onto another device.
        </p>

        <div className="space-y-4">
          <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 flex justify-between items-center">
            <div>
              <h3 className="font-semibold text-white text-xs">Export Backup</h3>
              <p className="text-[11px] text-slate-400">Download a full snapshot of your cards and settings.</p>
            </div>
            <button 
              onClick={handleExport}
              className="bg-emerald-600 hover:bg-emerald-500 text-white px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors"
            >
              <Download className="w-3.5 h-3.5" /> Export JSON
            </button>
          </div>

          <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800">
            <h3 className="font-semibold text-white text-xs mb-2">Import Backup</h3>
            
            <div className="flex gap-4 items-center mb-3">
               <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                 <input 
                   type="radio" 
                   name="importMode" 
                   checked={importMode === 'append'} 
                   onChange={() => setImportMode('append')}
                   className="text-emerald-500 focus:ring-emerald-500" 
                 />
                 Append to Existing
               </label>
               <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                 <input 
                   type="radio" 
                   name="importMode" 
                   checked={importMode === 'replace'} 
                   onChange={() => setImportMode('replace')}
                   className="text-emerald-500 focus:ring-emerald-500" 
                 />
                 Replace All
               </label>
            </div>

            <input 
              type="file" 
              accept=".json" 
              ref={fileInputRef} 
              className="hidden" 
              onChange={handleFileChange}
            />
            
            <button 
              onClick={handleImportClick}
              className="w-full bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
            >
              <Upload className="w-4 h-4" /> Select Backup JSON File
            </button>
          </div>

          {onLogout && (
            <div className="bg-slate-950/60 border border-slate-800 p-4 rounded-xl flex justify-between items-center">
              <div>
                <h3 className="font-semibold text-white text-xs">Lock / Sign Out</h3>
                <p className="text-[11px] text-slate-400">Lock the active vault session.</p>
              </div>
              <button 
                onClick={onLogout}
                className="bg-slate-800 hover:bg-slate-700 text-white px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors border border-slate-700"
              >
                <LogOut className="w-3.5 h-3.5" /> Lock Vault
              </button>
            </div>
          )}

          <div className="bg-rose-950/20 border border-rose-900/30 p-4 rounded-xl flex justify-between items-center">
             <div>
               <h3 className="font-semibold text-rose-400 text-xs">Clear Local Storage</h3>
               <p className="text-[11px] text-slate-400">Permanently deletes all data stored on this device.</p>
             </div>
             <button 
               onClick={handleClearData}
               className="bg-rose-600 hover:bg-rose-500 text-white px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors"
             >
               <Trash2 className="w-3.5 h-3.5" /> Clear All
             </button>
          </div>
        </div>
      </div>

    </div>
  );
};
