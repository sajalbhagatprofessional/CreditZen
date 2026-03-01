import React, { useRef, useState, useEffect } from 'react';
import { Download, Upload, Trash2, AlertTriangle, Check, FileJson, Bot, Save, Key, LogOut, Fingerprint, Loader2 } from 'lucide-react';
import { exportWalletJSON, importWalletJSON, getSettings, saveSettings } from '../services/storageService';
import { AISettings, AIProvider } from '../types';
import { DEFAULT_AI_SETTINGS } from '../constants';
import { isBiometricAvailable, isBiometricEnabled, enableBiometrics, disableBiometrics } from '../services/authService';

interface SettingsProps {
  onLogout?: () => void;
}

export const Settings: React.FC<SettingsProps> = ({ onLogout }) => {
  const [importMode, setImportMode] = useState<'append' | 'replace'>('append');
  const [status, setStatus] = useState<string>('');
  
  // AI Settings State
  const [aiConfig, setAiConfig] = useState<AISettings>(DEFAULT_AI_SETTINGS);
  const [showKey, setShowKey] = useState(false);
  
  // Biometric State
  const [canUseBiometrics, setCanUseBiometrics] = useState(false);
  const [biometricsActive, setBiometricsActive] = useState(false);
  const [isBioLoading, setIsBioLoading] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const loadData = async () => {
      const { ai } = await getSettings();
      setAiConfig(ai);
      
      const bioAvailable = await isBiometricAvailable();
      setCanUseBiometrics(bioAvailable);
      setBiometricsActive(isBiometricEnabled());
    };
    loadData();
  }, []);

  const handleToggleBiometrics = async () => {
    setIsBioLoading(true);
    try {
      if (biometricsActive) {
        disableBiometrics();
        setBiometricsActive(false);
        setStatus("Biometric login disabled.");
      } else {
        await enableBiometrics();
        setBiometricsActive(true);
        setStatus("Biometric login enabled.");
      }
    } catch (e: any) {
      setStatus(`Error: ${e.message}`);
    } finally {
      setIsBioLoading(false);
      setTimeout(() => setStatus(''), 3000);
    }
  };

  const handleSaveAI = async () => {
    const { notifications } = await getSettings();
    await saveSettings(notifications, aiConfig);
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
    if (confirm("Are you sure you want to clear all app data? This action cannot be undone.")) {
       localStorage.removeItem('creditzen_guest_data');
       window.location.reload();
    }
  };

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      
      {/* AI Configuration Section */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
          <Bot className="w-6 h-6 text-emerald-400" />
          AI Configuration
        </h2>
        
        <p className="text-sm text-slate-400 mb-6">
          Customize the AI model used for the Credit Coach and Document Scanner. 
          API Keys are encrypted and stored locally.
        </p>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">AI Provider</label>
            <div className="flex bg-slate-800 p-1 rounded-lg">
              {(['google', 'openai', 'anthropic', 'custom'] as AIProvider[]).map((p) => (
                <button
                  key={p}
                  onClick={() => setAiConfig({ ...aiConfig, provider: p, modelId: p === 'google' ? 'gemini-3-flash-preview' : '' })}
                  className={`flex-1 py-2 text-xs font-semibold rounded-md capitalize transition-all ${
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
                  placeholder={aiConfig.provider === 'google' ? 'gemini-3-flash-preview' : 'gpt-4o'}
                  value={aiConfig.modelId}
                  onChange={(e) => setAiConfig({ ...aiConfig, modelId: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
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
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">Required for local models (Ollama) or Proxies.</p>
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
                  placeholder={aiConfig.provider === 'google' ? "Leave empty to use default env key" : "sk-..."}
                  value={aiConfig.apiKey || ''}
                  onChange={(e) => setAiConfig({ ...aiConfig, apiKey: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-10 pr-10 py-2 text-white text-sm focus:ring-2 focus:ring-emerald-500 outline-none font-mono"
                />
                <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <button 
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-emerald-400"
                >
                  {showKey ? 'Hide' : 'Show'}
                </button>
             </div>
          </div>

          <div className="pt-2">
             <button
               onClick={handleSaveAI}
               className="w-full bg-slate-800 hover:bg-slate-700 border border-slate-700 text-emerald-400 font-semibold py-2 rounded-lg flex items-center justify-center gap-2 transition-all"
             >
               <Save className="w-4 h-4" /> Save AI Settings
             </button>
          </div>
        </div>
      </div>

      {status && (
          <div className="mb-4 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg flex items-center gap-2 text-sm text-emerald-400 animate-fade-in">
            <Check className="w-4 h-4" />
            {status}
          </div>
      )}

      {/* Data Management Section */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
          <FileJson className="w-6 h-6 text-emerald-400" />
          Data Management
        </h2>
        
        <p className="text-sm text-slate-400 mb-6">
          Backup or restore your wallet data.
        </p>

        <div className="space-y-4">
          <div className="bg-slate-950/50 p-4 rounded-lg border border-slate-800">
            <div className="flex justify-between items-center mb-2">
              <h3 className="font-semibold text-white">Export Wallet</h3>
              <button 
                onClick={handleExport}
                className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
              >
                <Download className="w-4 h-4" /> Download Backup
              </button>
            </div>
            <p className="text-xs text-slate-500">
              Download a JSON file containing all your cards and settings.
            </p>
          </div>

          <div className="bg-slate-950/50 p-4 rounded-lg border border-slate-800">
            <h3 className="font-semibold text-white mb-2">Import Wallet</h3>
            
            <div className="flex gap-4 items-center mb-4">
               <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
                 <input 
                   type="radio" 
                   name="importMode" 
                   checked={importMode === 'append'} 
                   onChange={() => setImportMode('append')}
                   className="text-emerald-500 focus:ring-emerald-500" 
                 />
                 Append
               </label>
               <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
                 <input 
                   type="radio" 
                   name="importMode" 
                   checked={importMode === 'replace'} 
                   onChange={() => setImportMode('replace')}
                   className="text-emerald-500 focus:ring-emerald-500" 
                 />
                 Replace
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
              className="w-full bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-4 py-3 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-colors"
            >
              <Upload className="w-4 h-4" /> Select Backup File
            </button>
          </div>
        </div>
      </div>

      {/* Account Section */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
           <AlertTriangle className="w-6 h-6 text-rose-500" />
           Account & Security
        </h2>
        
        <div className="space-y-4">
           {canUseBiometrics && (
             <div className="bg-slate-950/50 border border-slate-800 p-4 rounded-lg flex justify-between items-center">
               <div>
                 <h3 className="font-semibold text-white mb-1 flex items-center gap-2">
                   <Fingerprint className="w-4 h-4 text-emerald-400" /> Biometric Unlock
                 </h3>
                 <p className="text-xs text-slate-400">
                   Use FaceID/TouchID to unlock your vault for 7 days.
                 </p>
               </div>
               <button 
                 onClick={handleToggleBiometrics}
                 disabled={isBioLoading}
                 className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors border ${
                   biometricsActive 
                     ? 'bg-emerald-600/20 border-emerald-600/50 text-emerald-400' 
                     : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                 }`}
               >
                 {isBioLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : (biometricsActive ? 'Enabled' : 'Enable')}
               </button>
             </div>
           )}

           {onLogout && (
             <div className="bg-slate-950/50 border border-slate-800 p-4 rounded-lg flex justify-between items-center">
               <div>
                 <h3 className="font-semibold text-white mb-1">Log Out</h3>
                 <p className="text-xs text-slate-400">Lock your vault and sign out.</p>
               </div>
               <button 
                 onClick={onLogout}
                 className="bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors border border-slate-700"
               >
                 <LogOut className="w-4 h-4" /> Log Out
               </button>
             </div>
           )}

           <div className="bg-rose-950/20 border border-rose-900/30 p-4 rounded-lg">
              <h3 className="font-semibold text-rose-400 mb-1">Clear App Data</h3>
              <p className="text-xs text-slate-400 mb-4">
                Permanently delete all data stored on this device.
              </p>
              <button 
                onClick={handleClearData}
                className="bg-rose-600 hover:bg-rose-500 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
              >
                <Trash2 className="w-4 h-4" /> Clear Data
              </button>
           </div>
        </div>
      </div>
    </div>
  );
};