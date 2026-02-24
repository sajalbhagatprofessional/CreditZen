import React from 'react';
import { CreditCard } from '../types';
import { differenceInDays, addMonths, setDate, startOfDay, isBefore } from 'date-fns';
import { AlertCircle, TrendingUp, CheckCircle, ArrowRight, Zap } from 'lucide-react';

interface DashboardProps {
  cards: CreditCard[];
  setActiveTab: (tab: string) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ cards, setActiveTab }) => {
  const getNextDate = (day?: number) => {
    if (!day) return null;
    const today = startOfDay(new Date());
    let target = setDate(today, day);
    if (isBefore(target, today)) {
      target = addMonths(target, 1);
    }
    return target;
  };

  const today = startOfDay(new Date());
  
  const urgentReports = cards.filter(c => {
    if (c.type !== 'Credit' || !c.statementDay) return false;
    const nextStatement = getNextDate(c.statementDay);
    if (!nextStatement) return false;
    const diff = differenceInDays(nextStatement, today);
    return diff <= 5 && diff >= 0;
  });

  const urgentPayments = cards.filter(c => {
    if (c.type !== 'Credit' || !c.dueDay) return false;
    const nextDue = getNextDate(c.dueDay);
    if (!nextDue) return false;
    const diff = differenceInDays(nextDue, today);
    return diff <= 5 && diff >= 0;
  });

  const creditCards = cards.filter(c => c.type === 'Credit');
  const totalLimit = creditCards.reduce((acc, c) => acc + (c.creditLimit || 0), 0);
  const totalBalance = creditCards.reduce((acc, c) => acc + (c.currentBalance || 0), 0);
  const utilization = totalLimit > 0 ? (totalBalance / totalLimit) * 100 : 0;

  // Visual Helper for Gauge
  const dashOffset = 251.2 - (251.2 * utilization) / 100;

  return (
    <div className="space-y-8 animate-fade-in relative z-10">
      
      {/* HUD Stats */}
      <div className="grid grid-cols-2 gap-4">
        {/* Utilization Gauge */}
        <div className="glass-panel p-5 rounded-3xl relative overflow-hidden group">
           <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
           <div className="flex flex-col items-center justify-center relative z-10">
              <div className="relative w-20 h-20 mb-2">
                 <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="40" stroke="rgba(255,255,255,0.1)" strokeWidth="8" fill="none" />
                    <circle 
                      cx="50" cy="50" r="40" 
                      stroke={utilization > 30 ? '#f59e0b' : '#10b981'} 
                      strokeWidth="8" 
                      fill="none" 
                      strokeDasharray="251.2" 
                      strokeDashoffset={Math.max(0, dashOffset)}
                      strokeLinecap="round"
                      className="transition-all duration-1000 ease-out"
                    />
                 </svg>
                 <div className="absolute inset-0 flex items-center justify-center">
                    <TrendingUp className={`w-6 h-6 ${utilization > 30 ? 'text-amber-500' : 'text-emerald-400'}`} />
                 </div>
              </div>
              <h2 className={`text-2xl font-black ${utilization > 30 ? 'text-amber-500' : 'text-emerald-400'} glow-text`}>
                {utilization.toFixed(0)}%
              </h2>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Utilization</p>
           </div>
        </div>

        {/* Card Count */}
        <div className="glass-panel p-5 rounded-3xl flex flex-col justify-between group relative overflow-hidden">
           <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <Zap className="w-16 h-16 text-white rotate-12" />
           </div>
           <div>
              <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-1">Total Vault</p>
              <h2 className="text-3xl font-black text-white">{cards.length}</h2>
           </div>
           <div className="flex gap-2 mt-4">
              <div className="bg-slate-800/50 px-2 py-1 rounded text-[10px] text-slate-300 border border-slate-700">
                {cards.filter(c => c.type === 'Credit').length} Cr
              </div>
              <div className="bg-slate-800/50 px-2 py-1 rounded text-[10px] text-slate-300 border border-slate-700">
                {cards.filter(c => c.type === 'Debit').length} Db
              </div>
           </div>
        </div>
      </div>

      {/* Holographic Alert Feed */}
      <div>
        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4 px-1 flex items-center gap-2">
           <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
           System Intelligence
        </h3>
        
        {urgentReports.length === 0 && urgentPayments.length === 0 ? (
          <div className="glass p-6 rounded-2xl flex items-center gap-4 border-l-4 border-emerald-500">
            <div className="bg-emerald-500/20 p-3 rounded-full">
               <CheckCircle className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <p className="text-sm font-bold text-emerald-100">System Nominal</p>
              <p className="text-xs text-slate-400">Your credit scores are optimized. No actions required.</p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {urgentReports.map(card => {
               const nextStatement = getNextDate(card.statementDay);
               const diff = nextStatement ? differenceInDays(nextStatement, today) : -1;
               return (
                <div key={card.id} className="bg-gradient-to-r from-amber-500/10 to-transparent border border-amber-500/30 p-4 rounded-xl flex justify-between items-center group hover:bg-amber-500/20 transition-colors">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <AlertCircle className="w-4 h-4 text-amber-500 animate-pulse" />
                      <span className="text-xs font-bold text-amber-400 tracking-wider">REPORTING SOON</span>
                    </div>
                    <p className="text-xs text-slate-200">
                      <span className="font-bold">{card.issuer}</span> closes in {diff === 0 ? 'HOURS' : `${diff} days`}.
                    </p>
                    <p className="text-[10px] text-slate-500 mt-1">Optimization: Pay to $0 balance.</p>
                  </div>
                  {card.paymentUrl && (
                    <a href={card.paymentUrl} target="_blank" rel="noopener noreferrer" className="bg-amber-500/20 hover:bg-amber-500 text-amber-500 hover:text-white p-2 rounded-lg transition-all">
                      <ArrowRight className="w-4 h-4" />
                    </a>
                  )}
                </div>
               );
            })}
             {urgentPayments.map(card => {
               const nextDue = getNextDate(card.dueDay);
               const diff = nextDue ? differenceInDays(nextDue, today) : -1;
               return (
                <div key={card.id + '_due'} className="bg-gradient-to-r from-rose-600/10 to-transparent border border-rose-500/30 p-4 rounded-xl flex justify-between items-center group hover:bg-rose-600/20 transition-colors">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <AlertCircle className="w-4 h-4 text-rose-500 animate-pulse" />
                      <span className="text-xs font-bold text-rose-400 tracking-wider">PAYMENT DUE</span>
                    </div>
                    <p className="text-xs text-slate-200">
                      <span className="font-bold">{card.issuer}</span> is due {diff === 0 ? 'TODAY' : `in ${diff} days`}.
                    </p>
                  </div>
                   {card.paymentUrl && (
                    <a href={card.paymentUrl} target="_blank" rel="noopener noreferrer" className="bg-rose-500/20 hover:bg-rose-500 text-rose-500 hover:text-white p-2 rounded-lg transition-all">
                      <ArrowRight className="w-4 h-4" />
                    </a>
                  )}
                </div>
               );
            })}
          </div>
        )}
      </div>

      {/* Quick Access Matrix */}
      <div className="grid grid-cols-2 gap-4 pt-2">
        <button 
          onClick={() => setActiveTab('wallet')} 
          className="glass-panel p-4 rounded-2xl flex flex-col items-start gap-2 hover:bg-white/5 transition-colors group border-l-4 border-indigo-500"
        >
          <div className="bg-indigo-500/20 p-2 rounded-lg group-hover:scale-110 transition-transform">
            <TrendingUp className="w-5 h-5 text-indigo-400" />
          </div>
          <div>
            <p className="text-sm font-bold text-white">Update Balances</p>
            <p className="text-[10px] text-slate-400">Refresh Data</p>
          </div>
        </button>
        <button 
          onClick={() => setActiveTab('coach')} 
          className="glass-panel p-4 rounded-2xl flex flex-col items-start gap-2 hover:bg-white/5 transition-colors group border-l-4 border-emerald-500"
        >
          <div className="bg-emerald-500/20 p-2 rounded-lg group-hover:scale-110 transition-transform">
            <CheckCircle className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <p className="text-sm font-bold text-white">AI Coach</p>
            <p className="text-[10px] text-slate-400">Ask Strategy</p>
          </div>
        </button>
      </div>
    </div>
  );
};