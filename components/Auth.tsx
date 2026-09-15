import React, { useState, useEffect } from 'react';
import { 
  loginUser, 
  registerUser, 
  isBiometricEnabled, 
  isBiometricAvailable, 
  verifyBiometric, 
  restoreSession,
  initLocalVault,
  hasLocalVault
} from '../services/authService';
import { ShieldCheck, Lock, Mail, Loader2, AlertTriangle, Fingerprint, HardDrive, Cloud, ArrowRight, Smartphone } from 'lucide-react';

interface AuthProps {
  onLoginSuccess: () => void;
}

export const Auth: React.FC<AuthProps> = ({ onLoginSuccess }) => {
  const [authType, setAuthType] = useState<'local' | 'cloud'>('local');
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [localPasscode, setLocalPasscode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [showBiometric, setShowBiometric] = useState(false);
  const [isBioChecking, setIsBioChecking] = useState(false);

  useEffect(() => {
    const checkBio = async () => {
      const enabled = isBiometricEnabled();
      const available = await isBiometricAvailable();
      if (enabled && available) {
        setShowBiometric(true);
      }
    };
    checkBio();
  }, []);

  const handleBiometricLogin = async () => {
    setIsBioChecking(true);
    setError("");
    try {
      const verified = await verifyBiometric();
      if (verified) {
        onLoginSuccess();
      } else {
        setError("Biometric verification did not complete. Please enter your passcode or password.");
      }
    } catch (e: any) {
      console.error("Biometric login error:", e);
      setError(e.message || "Biometric unlock failed. Please try again.");
    } finally {
      setIsBioChecking(false);
    }
  };

  const handleLocalVaultAccess = async () => {
    setLoading(true);
    setError('');
    try {
      const passcode = localPasscode.trim() || 'creditzen-device-local';
      await initLocalVault(passcode);
      onLoginSuccess();
    } catch (err: any) {
      setError(err.message || "Failed to initialize local vault");
    } finally {
      setLoading(false);
    }
  };

  const handleCloudSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);

    try {
      if (mode === 'login') {
        await loginUser(email, password);
        onLoginSuccess();
      } else {
        await registerUser(email, password);
        setMessage("Registration successful! Please check your email to confirm your account, then log in.");
        setMode('login');
      }
    } catch (err: any) {
      setError(err.message || "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Background ambient lighting */}
      <div className="absolute top-1/4 -left-20 w-72 h-72 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-1/4 -right-20 w-72 h-72 bg-blue-500/10 rounded-full blur-3xl pointer-events-none"></div>

      <div className="mb-6 text-center animate-fade-in relative z-10">
        <div className="bg-gradient-to-br from-emerald-500/20 to-teal-500/10 p-4 rounded-2xl inline-flex mb-3 border border-emerald-500/30 shadow-lg shadow-emerald-500/10">
          <ShieldCheck className="w-10 h-10 text-emerald-400" />
        </div>
        <h1 className="text-3xl font-black bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
          CreditZen
        </h1>
        <p className="text-slate-400 text-xs mt-1">Private Encrypted Credit Vault & Optimizer</p>
      </div>

      <div className="w-full max-w-md bg-slate-900/90 backdrop-blur-xl border border-slate-800 rounded-3xl p-6 shadow-2xl relative z-10">
        
        {/* Biometric Quick Unlock if enabled */}
        {showBiometric && (
          <div className="mb-6 p-4 bg-gradient-to-b from-emerald-950/40 to-slate-900 border border-emerald-500/30 rounded-2xl">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                <Fingerprint className="w-4 h-4" /> Device Biometrics
              </span>
              <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full font-semibold">
                Fast Unlock
              </span>
            </div>
            
            <button
              onClick={handleBiometricLogin}
              disabled={isBioChecking}
              className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 active:scale-[0.98] text-white font-bold py-3.5 rounded-xl shadow-lg shadow-emerald-600/30 transition-all flex items-center justify-center gap-2.5"
            >
              {isBioChecking ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Scanning Fingerprint / Face...</span>
                </>
              ) : (
                <>
                  <Fingerprint className="w-5 h-5" />
                  <span>Unlock with Biometrics</span>
                </>
              )}
            </button>
            <p className="text-center text-[10px] text-slate-400 mt-2">
              Tap to authenticate using your device fingerprint or face scan
            </p>
          </div>
        )}

        {/* Vault Mode Selection: Local Device vs Cloud Sync */}
        <div className="grid grid-cols-2 p-1 bg-slate-950 rounded-xl mb-5 border border-slate-800">
          <button
            onClick={() => { setAuthType('local'); setError(''); }}
            className={`flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all ${
              authType === 'local'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <HardDrive className="w-3.5 h-3.5" />
            Local Device Vault
          </button>
          <button
            onClick={() => { setAuthType('cloud'); setError(''); }}
            className={`flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all ${
              authType === 'cloud'
                ? 'bg-slate-800 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Cloud className="w-3.5 h-3.5" />
            Cloud Sync
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-300 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {message && (
          <div className="mb-4 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs text-emerald-300">
            {message}
          </div>
        )}

        {/* Local Vault Section (100% Offline & Personal) */}
        {authType === 'local' && (
          <div className="space-y-4">
            <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 text-xs text-slate-300 space-y-2">
              <div className="flex items-center gap-2 text-emerald-400 font-semibold">
                <ShieldCheck className="w-4 h-4" />
                <span>100% Offline & Independent</span>
              </div>
              <p className="text-slate-400 text-[11px] leading-relaxed">
                Your cards, statements, and perks are stored and encrypted exclusively on this device. No hosting or internet connection required.
              </p>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">
                Local Vault Passcode (Optional)
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="password"
                  value={localPasscode}
                  onChange={e => setLocalPasscode(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-white text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                  placeholder="Leave empty for instant open or enter PIN"
                />
              </div>
              <p className="text-[10px] text-slate-500 mt-1">
                You can enable Fingerprint/TouchID unlock inside Settings once open.
              </p>
            </div>

            <button
              onClick={handleLocalVaultAccess}
              disabled={loading}
              className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold py-3 rounded-xl shadow-lg shadow-emerald-900/30 transition-all flex justify-center items-center gap-2"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <span>Open Local Vault</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        )}

        {/* Cloud Sync Section (Supabase) */}
        {authType === 'cloud' && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-sm font-bold text-white">
                {mode === 'login' ? 'Sign in to Cloud Sync' : 'Create Cloud Account'}
              </h2>
            </div>

            <form onSubmit={handleCloudSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-white text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                    placeholder="name@example.com"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-white text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                    placeholder="Enter master password"
                    minLength={6}
                  />
                </div>
              </div>
              
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-emerald-400 font-bold py-3 rounded-xl border border-emerald-500/30 transition-all flex justify-center items-center gap-2"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin"/> : (mode === 'login' ? 'Sign In & Sync' : 'Create Account')}
              </button>
            </form>

            <div className="mt-4 text-center">
              <button
                onClick={() => { setError(''); setMessage(''); setMode(mode === 'login' ? 'register' : 'login'); }}
                className="text-xs text-slate-400 hover:text-white transition-colors"
              >
                {mode === 'login' ? (
                  <>Need a cloud account? <span className="text-emerald-400 font-semibold">Sign Up</span></>
                ) : (
                  <>Already have an account? <span className="text-emerald-400 font-semibold">Sign In</span></>
                )}
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
