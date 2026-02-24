import React, { useState } from 'react';
import { CreditCard, CardCategory, Benefit } from '../types';
import { getCategoryIcon, STANDARD_CATEGORIES } from '../constants';
import { Search, MapPin, Loader2, Sparkles, Clock } from 'lucide-react';
import { recommendCardAtLocation } from '../services/geminiService';
import ReactMarkdown from 'react-markdown';

interface BenefitOptimizerProps {
  cards: CreditCard[];
}

export const BenefitOptimizer: React.FC<BenefitOptimizerProps> = ({ cards }) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [locationResult, setLocationResult] = useState<string | null>(null);
  const [isLocating, setIsLocating] = useState(false);

  // Collect all unique categories from cards, plus standard ones
  const allCategories = Array.from(new Set([
    ...STANDARD_CATEGORIES,
    ...cards.flatMap(c => c.benefits.map(b => b.category)),
    ...cards.flatMap(c => c.temporaryBenefits?.map(b => b.category) || [])
  ])).sort();

  const getBestCards = () => {
    if (selectedCategory === 'All') return cards;

    return [...cards].sort((a, b) => {
      const getHighestMultiplier = (card: CreditCard, cat: string) => {
        // Permanent
        const permBenefit = card.benefits.find(b => b.category === cat);
        const permMult = permBenefit ? permBenefit.multiplier : 
          (card.benefits.find(b => b.category === CardCategory.General)?.multiplier || 1);
        
        // Temporary
        const tempBenefit = card.temporaryBenefits?.find(b => b.category === cat);
        const tempMult = tempBenefit ? tempBenefit.multiplier : 0;

        return Math.max(permMult, tempMult);
      };

      return getHighestMultiplier(b, selectedCategory) - getHighestMultiplier(a, selectedCategory);
    });
  };

  const filteredCards = getBestCards();

  const handleLocationScan = () => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser.");
      return;
    }

    setIsLocating(true);
    setLocationResult(null);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;
          const recommendation = await recommendCardAtLocation(latitude, longitude, cards);
          setLocationResult(recommendation || "Could not identify location.");
        } catch (error) {
          console.error(error);
          setLocationResult("Error analyzing location. Please check your API key.");
        } finally {
          setIsLocating(false);
        }
      },
      (error) => {
        setIsLocating(false);
        alert("Unable to retrieve your location.");
        console.error(error);
      }
    );
  };

  return (
    <div className="space-y-6">
      {/* Location Scanner Hero */}
      <div className="bg-gradient-to-br from-emerald-900/40 to-slate-900 border border-emerald-500/30 rounded-xl p-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-emerald-500/20 rounded-full blur-2xl pointer-events-none" />
        
        <div className="flex justify-between items-start mb-4 relative z-10">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-emerald-400" />
              AI Location Scout
            </h2>
            <p className="text-slate-400 text-xs mt-1 max-w-[80%]">
              At a store? Let AI identify the place and pick the best card instantly.
            </p>
          </div>
          <button
            onClick={handleLocationScan}
            disabled={isLocating}
            className={`p-3 rounded-xl transition-all shadow-lg flex items-center justify-center ${
              isLocating 
                ? 'bg-slate-800 text-slate-400 cursor-not-allowed' 
                : 'bg-emerald-500 text-white hover:bg-emerald-400 hover:scale-105 hover:shadow-emerald-500/20'
            }`}
          >
            {isLocating ? <Loader2 className="w-6 h-6 animate-spin" /> : <MapPin className="w-6 h-6" />}
          </button>
        </div>

        {locationResult && (
          <div className="mt-4 bg-slate-950/80 border border-emerald-500/30 rounded-lg p-4 animate-fade-in">
             <div className="prose prose-invert prose-sm max-w-none prose-p:my-1 prose-headings:my-2 prose-strong:text-emerald-400">
                <ReactMarkdown>{locationResult}</ReactMarkdown>
             </div>
          </div>
        )}
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          <Search className="w-5 h-5 text-slate-400" />
          Manual Browse
        </h2>
        
        <div className="flex flex-wrap gap-2 mb-6">
          <button
              onClick={() => setSelectedCategory('All')}
              className={`px-3 py-2 rounded-lg text-xs font-medium transition-all border ${
                selectedCategory === 'All'
                  ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400'
                  : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'
              }`}
            >
              All
          </button>
          {allCategories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-2 rounded-lg text-xs font-medium transition-all border flex items-center gap-1 ${
                selectedCategory === cat
                  ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400'
                  : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'
              }`}
            >
              <span>{getCategoryIcon(cat)}</span>
              <span>{cat}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider px-1">
          Ranked Cards for {selectedCategory}
        </h3>
        
        {filteredCards.map((card, idx) => {
           let multiplier = 0;
           let isTemp = false;
           let expiry = '';

           if (selectedCategory !== 'All') {
             // Check Temp first
             const temp = card.temporaryBenefits?.find(b => b.category === selectedCategory);
             if (temp) {
               multiplier = temp.multiplier;
               isTemp = true;
               expiry = temp.expiryDate || '';
             } else {
                // Check Perm
                const perm = card.benefits.find(b => b.category === selectedCategory);
                if (perm) {
                  multiplier = perm.multiplier;
                } else {
                  // Fallback
                  multiplier = card.benefits.find(b => b.category === CardCategory.General)?.multiplier || 1;
                }
             }
             // If perm is actually higher than temp (unlikely but possible), use perm
             if (isTemp) {
                const perm = card.benefits.find(b => b.category === selectedCategory);
                if (perm && perm.multiplier > multiplier) {
                  multiplier = perm.multiplier;
                  isTemp = false;
                }
             }
           } else {
             multiplier = card.benefits.find(b => b.category === CardCategory.General)?.multiplier || 1;
           }

           return (
            <div key={card.id} className={`bg-slate-900/80 border rounded-xl p-4 flex items-center justify-between ${isTemp ? 'border-amber-500/40 bg-gradient-to-r from-amber-950/20 to-slate-900' : 'border-slate-800'}`}>
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${idx === 0 ? 'bg-amber-400 text-amber-900' : 'bg-slate-700 text-slate-300'}`}>
                  #{idx + 1}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                     <p className="font-bold text-white">{card.name}</p>
                     {card.type === 'Debit' && <span className="text-[9px] bg-blue-500/20 text-blue-400 px-1 rounded uppercase">Debit</span>}
                  </div>
                  <p className="text-xs text-slate-500">{card.issuer}</p>
                </div>
              </div>
              <div className="text-right">
                <span className={`text-xl font-bold ${isTemp ? 'text-amber-400' : 'text-emerald-400'}`}>{multiplier}x</span>
                <p className="text-[10px] text-slate-500">Points/$</p>
                {isTemp && (
                  <div className="text-[9px] text-amber-500 flex items-center justify-end gap-1 mt-1">
                    <Clock className="w-3 h-3" />
                    Expires {expiry}
                  </div>
                )}
              </div>
            </div>
           );
        })}
      </div>
    </div>
  );
};