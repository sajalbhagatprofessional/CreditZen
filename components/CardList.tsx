import React, { useState } from 'react';
import { CreditCard } from '../types';
import { ExternalLink, Edit2, Trash2, Calendar, AlertTriangle, ShieldCheck, Key, Info, CreditCard as CardIcon, Wallet, AlertCircle } from 'lucide-react';
import { differenceInDays, addMonths, setDate, startOfDay, isBefore } from 'date-fns';
import { SecureCardModal } from './SecureCardModal';
import { motion, AnimatePresence } from 'motion/react';

interface CardListProps {
  cards: CreditCard[];
  onEdit: (card: CreditCard) => void;
  onDelete: (id: string) => void;
}

export const CardList: React.FC<CardListProps> = ({ cards, onEdit, onDelete }) => {
  const [viewingCard, setViewingCard] = useState<CreditCard | null>(null);
  const [expandedNotes, setExpandedNotes] = useState<Set<string>>(new Set());
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const toggleNotes = (id: string) => {
    const newSet = new Set(expandedNotes);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setExpandedNotes(newSet);
  };

  const handleOpenWallet = () => {
    const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera;
    if (/android/i.test(userAgent)) {
      window.open('https://wallet.google.com', '_blank');
    } else if (/iPad|iPhone|iPod/.test(userAgent) && !(window as any).MSStream) {
      window.location.href = 'shoebox://';
    } else {
      window.open('https://wallet.google.com', '_blank');
    }
  };

  const getNextDate = (day?: number) => {
    if (!day) return null;
    const today = startOfDay(new Date());
    let target = setDate(today, day);
    if (isBefore(target, today)) {
      target = addMonths(target, 1);
    }
    return target;
  };

  // Dynamic Gradients based on Issuer/Name
  const getCardStyle = (card: CreditCard) => {
    const name = (card.issuer + card.name).toLowerCase();
    
    // Premium / Specific Brands
    if (name.includes('sapphire') || name.includes('preferred')) 
      return 'bg-gradient-to-br from-[#0a192f] via-[#112240] to-[#0a192f] border-blue-500/30 shadow-[0_0_20px_rgba(59,130,246,0.2)]';
    if (name.includes('freedom') || name.includes('cash')) 
      return 'bg-gradient-to-br from-[#1e293b] via-[#334155] to-[#1e293b] border-slate-500/30';
    if (name.includes('gold') || name.includes('amex')) 
      return 'bg-gradient-to-br from-[#b8860b] via-[#ffd700] to-[#b8860b] border-yellow-400/30 text-slate-900 shadow-[0_0_20px_rgba(251,191,36,0.3)]';
    if (name.includes('platinum')) 
      return 'bg-gradient-to-br from-[#e5e7eb] via-[#f9fafb] to-[#d1d5db] border-slate-300/40 text-slate-900 shadow-[0_0_20px_rgba(255,255,255,0.2)]';
    if (name.includes('red') || name.includes('target') || name.includes('apple')) 
      return 'bg-gradient-to-br from-[#7f1d1d] via-[#b91c1c] to-[#7f1d1d] border-red-500/30 shadow-[0_0_20px_rgba(239,68,68,0.2)]';
    if (name.includes('green') || name.includes('eco') || name.includes('fidelity')) 
      return 'bg-gradient-to-br from-[#064e3b] via-[#059669] to-[#064e3b] border-emerald-500/30 shadow-[0_0_20px_rgba(16,185,129,0.2)]';
    if (name.includes('venture') || name.includes('capital one'))
      return 'bg-gradient-to-br from-[#1e1b4b] via-[#312e81] to-[#1e1b4b] border-indigo-500/30 shadow-[0_0_20px_rgba(99,102,241,0.2)]';
    if (name.includes('quicksilver'))
      return 'bg-gradient-to-br from-[#4b5563] via-[#9ca3af] to-[#4b5563] border-slate-400/30 shadow-[0_0_20px_rgba(156,163,175,0.2)]';

    // Fallback based on ID to ensure uniqueness
    const colors = [
      'from-purple-900 via-fuchsia-800 to-purple-950 border-purple-500/30 shadow-[0_0_20px_rgba(168,85,247,0.2)]',
      'from-cyan-900 via-sky-800 to-cyan-950 border-cyan-500/30 shadow-[0_0_20px_rgba(6,182,212,0.2)]',
      'from-orange-900 via-amber-800 to-orange-950 border-orange-500/30 shadow-[0_0_20px_rgba(245,158,11,0.2)]',
      'from-pink-900 via-rose-800 to-pink-950 border-pink-500/30 shadow-[0_0_20px_rgba(244,63,94,0.2)]',
      'from-teal-900 via-emerald-800 to-teal-950 border-teal-500/30 shadow-[0_0_20px_rgba(20,184,166,0.2)]'
    ];
    const hash = card.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[hash % colors.length];
  };

  if (cards.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-500 animate-float">
        <div className="bg-slate-900/50 p-6 rounded-full mb-4 border border-slate-800 shadow-[0_0_30px_rgba(16,185,129,0.1)]">
          <CardIcon className="w-10 h-10 opacity-50 text-emerald-500" />
        </div>
        <p className="text-lg font-medium text-slate-300">Your wallet is empty.</p>
        <p className="text-sm">Add a card to unlock the financial matrix.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 perspective-1000">
      {viewingCard && (
        <SecureCardModal card={viewingCard} onClose={() => setViewingCard(null)} />
      )}

      <AnimatePresence>
        {deletingId && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-slate-900 border border-slate-800 p-6 rounded-2xl max-w-sm w-full shadow-2xl"
            >
              <div className="flex items-center gap-3 text-rose-500 mb-4">
                <AlertCircle className="w-6 h-6" />
                <h3 className="text-lg font-bold">Delete Card?</h3>
              </div>
              <p className="text-slate-400 text-sm mb-6">
                This action cannot be undone. All encrypted data for this card will be permanently removed.
              </p>
              <div className="flex gap-3">
                <button 
                  onClick={() => setDeletingId(null)}
                  className="flex-1 bg-slate-800 hover:bg-slate-700 text-white py-2 rounded-lg font-medium transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={() => { onDelete(deletingId); setDeletingId(null); }}
                  className="flex-1 bg-rose-600 hover:bg-rose-500 text-white py-2 rounded-lg font-medium transition-colors"
                >
                  Delete
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {cards.map((card, idx) => {
        const nextDue = getNextDate(card.dueDay);
        const nextStatement = getNextDate(card.statementDay);
        const daysToDue = nextDue ? differenceInDays(nextDue, startOfDay(new Date())) : -1;
        const daysToStatement = nextStatement ? differenceInDays(nextStatement, startOfDay(new Date())) : -1;
        const isStatementUrgent = daysToStatement <= 5 && daysToStatement >= 0 && card.type === 'Credit';
        const cardStyle = getCardStyle(card);
        const isLightCard = cardStyle.includes('text-slate-900');

        return (
          <motion.div 
            key={card.id} 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
            className="group relative"
          >
            {/* 3D Card Face */}
            <motion.div 
              whileHover={{ 
                rotateX: 5, 
                rotateY: -5, 
                scale: 1.02,
                z: 50
              }}
              className={`relative overflow-hidden rounded-2xl border p-6 shadow-2xl transition-all duration-500 ${cardStyle} ${isLightCard ? 'text-slate-900' : 'text-white'}`}
              style={{ transformStyle: 'preserve-3d' }}
            >
                
                {/* Holographic Glare Effect */}
                <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/10 to-white/0 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none transform translate-x-[-100%] group-hover:translate-x-[100%] transition-transform ease-in-out" style={{ transitionDuration: '1.5s' }}></div>
                <div className="absolute -top-24 -right-24 w-48 h-48 bg-white/10 rounded-full blur-3xl group-hover:bg-white/20 transition-all"></div>

                <div className="relative z-10 flex justify-between items-start mb-8" style={{ transform: 'translateZ(30px)' }}>
                  <div className="flex flex-col">
                    <span className={`text-[10px] font-bold tracking-[0.2em] uppercase mb-1 opacity-70`}>{card.issuer}</span>
                    <h3 className="text-xl font-bold tracking-wide drop-shadow-md">{card.name}</h3>
                  </div>
                  <div className="flex gap-2">
                     <span className={`px-2 py-1 rounded text-[10px] font-bold border backdrop-blur-md uppercase tracking-wider ${isLightCard ? 'border-slate-900/20 bg-slate-900/5' : 'border-white/20 bg-white/5'}`}>
                        {card.type}
                     </span>
                  </div>
                </div>

                <div className="relative z-10 flex justify-between items-end" style={{ transform: 'translateZ(20px)' }}>
                    <div className="flex flex-col gap-1">
                        <span className="text-[9px] uppercase tracking-widest opacity-60">Card Number</span>
                        <div className="font-mono text-lg tracking-widest flex gap-2 items-center opacity-90">
                           <span className="text-xs">••••</span> <span className="text-xs">••••</span> <span className="text-xs">••••</span>
                           <span>{card.lastFour || '????'}</span>
                        </div>
                    </div>
                    {/* Chip Icon */}
                    <div className={`w-10 h-8 rounded-md border bg-gradient-to-br from-yellow-200 to-yellow-500 opacity-80 shadow-inner ${isLightCard ? 'border-slate-500/30' : 'border-white/30'}`}></div>
                </div>
            </motion.div>

            {/* Floating Action Bar (Appears below card) */}
            <div className="mt-3 flex items-center justify-between px-2">
                {/* Stats */}
                <div className="flex gap-4">
                   {(card.dueDay || card.statementDay) && (
                     <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${daysToDue <= 3 && daysToDue >= 0 ? 'bg-rose-500 animate-pulse' : 'bg-emerald-500'}`}></div>
                        <span className="text-xs text-slate-400">
                          Due: <span className="text-slate-200 font-medium">{daysToDue === 0 ? 'Today' : `${daysToDue}d`}</span>
                        </span>
                     </div>
                   )}
                   {isStatementUrgent && (
                     <div className="flex items-center gap-2">
                        <AlertTriangle className="w-3 h-3 text-amber-500" />
                        <span className="text-xs text-amber-500 font-bold">AZEO Alert</span>
                     </div>
                   )}
                </div>

                {/* Buttons */}
                <div className="flex gap-1">
                    <button onClick={handleOpenWallet} className="p-2 bg-slate-800/50 hover:bg-emerald-500/20 hover:text-emerald-400 rounded-full transition-colors border border-slate-700/50" title="Open Wallet App">
                       <Wallet className="w-4 h-4" />
                    </button>
                    {card.paymentUrl && (
                      <a href={card.paymentUrl} target="_blank" rel="noopener noreferrer" className="p-2 bg-slate-800/50 hover:bg-emerald-500/20 hover:text-emerald-400 rounded-full transition-colors border border-slate-700/50">
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    )}
                    <button onClick={() => setViewingCard(card)} className="p-2 bg-slate-800/50 hover:bg-amber-500/20 hover:text-amber-400 rounded-full transition-colors border border-slate-700/50">
                       <Key className="w-4 h-4" />
                    </button>
                    <button onClick={() => onEdit(card)} className="p-2 bg-slate-800/50 hover:bg-blue-500/20 hover:text-blue-400 rounded-full transition-colors border border-slate-700/50">
                       <Edit2 className="w-4 h-4" />
                    </button>
                    <button onClick={() => setDeletingId(card.id)} className="p-2 bg-slate-800/50 hover:bg-rose-500/20 hover:text-rose-400 rounded-full transition-colors border border-slate-700/50">
                       <Trash2 className="w-4 h-4" />
                    </button>
                    {card.notes && (
                      <button onClick={() => toggleNotes(card.id)} className={`p-2 bg-slate-800/50 rounded-full transition-colors border border-slate-700/50 ${expandedNotes.has(card.id) ? 'text-white bg-slate-700' : 'hover:text-white'}`}>
                        <Info className="w-4 h-4" />
                      </button>
                    )}
                </div>
            </div>

            {/* Expandable Notes Panel */}
            <div className={`overflow-hidden transition-all duration-300 ease-in-out ${expandedNotes.has(card.id) ? 'max-h-32 opacity-100 mt-2' : 'max-h-0 opacity-0'}`}>
               <div className="glass-panel p-3 rounded-xl text-xs text-slate-300 border-l-2 border-emerald-500">
                  {card.notes}
               </div>
            </div>
            
            {/* Divider for aesthetic spacing */}
            <div className="h-px w-full bg-gradient-to-r from-transparent via-slate-800 to-transparent mt-6 mb-2"></div>
          </motion.div>
        );
      })}
    </div>
  );
};
