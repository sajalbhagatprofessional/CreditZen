import React, { useState, useEffect } from 'react';
import { loginUser, registerUser, isBiometricEnabled, verifyBiometric, restoreSession } from '../services/authService';
import { ShieldCheck, Lock, Mail, Loader2, AlertTriangle, Fingerprint } from 'lucide-react';

interface AuthProps {
  onLoginSuccess: () => void;
}

export const Auth: React.FC<AuthProps> = ({ onLoginSuccess }) => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [showBiometric, setShowBiometric] = useState(false);

  useEffect(() => {
    if (isBiometricEnabled()) {
      setShowBiometric(true);
    }
  }, []);

  const handleBiometricLogin = async () => {
    setLoading(true);
    try {
      const verified = await verifyBiometric();
      if (verified) {
        const restored = await restoreSession(true); // Skip check since we just verified
        if (restored) {
          onLoginSuccess();
        } else {
          setError("Session expired. Please login with password.");
          setShowBiometric(false);
        }
      } else {
        setError("Biometric verification failed.");
      }
    } catch (e) {
      setError("Biometric error.");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
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
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
      <div className="mb-8 text-center animate-fade-in">
        <div className="bg-emerald-500/10 p-4 rounded-2xl inline-flex mb-4">
          <ShieldCheck className="w-12 h-12 text-emerald-400" />
        </div>
        <h1 className="text-3xl font-bold bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
          CreditZen
        </h1>
        <p className="text-slate-500 mt-2">Secure. Cloud-Synced. Intelligent.</p>
      </div>

      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl">
        <div className="flex justify-between items-center mb-6">
           <h2 className="text-xl font-bold text-white">
             {mode === 'login' ? 'Welcome Back' : 'Create Account'}
           </h2>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg text-sm text-rose-400 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" /> {error}
          </div>
        )}

        {message && (
          <div className="mb-4 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-sm text-emerald-400">
            {message}
          </div>
        )}

        {showBiometric && mode === 'login' && (
          <div className="mb-6">
            <button
              onClick={handleBiometricLogin}
              disabled={loading}
              className="w-full bg-slate-800 hover:bg-slate-700 border border-emerald-500/30 text-emerald-400 font-bold py-4 rounded-xl shadow-lg transition-all flex flex-col items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="w-8 h-8 animate-spin"/> : <Fingerprint className="w-8 h-8" />}
              <span>Unlock with Biometrics</span>
            </button>
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-800"></div>
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-slate-900 px-2 text-slate-500">Or use password</span>
              </div>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-10 pr-4 py-3 text-white focus:ring-2 focus:ring-emerald-500 outline-none"
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
                className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-10 pr-4 py-3 text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                placeholder="Enter password"
                minLength={6}
              />
            </div>
          </div>
          
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold py-3 rounded-lg shadow-lg shadow-emerald-900/20 transition-all flex justify-center items-center gap-2"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin"/> : (mode === 'login' ? 'Login' : 'Sign Up')}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            onClick={() => { setError(''); setMessage(''); setMode(mode === 'login' ? 'register' : 'login'); }}
            className="text-sm text-slate-400 hover:text-white transition-colors"
          >
            {mode === 'login' ? (
              <>New here? <span className="text-emerald-400">Create an account</span></>
            ) : (
              <>Already have an account? <span className="text-emerald-400">Login</span></>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};