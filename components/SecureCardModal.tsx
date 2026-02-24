import React, { useState } from 'react';
import { CreditCard } from '../types';
import { X, Copy, Eye, EyeOff, Check, CreditCard as CardIcon } from 'lucide-react';

interface Props {
  card: CreditCard;
  onClose: () => void;
}

export const SecureCardModal: React.FC<Props> = ({ card, onClose }) => {
  const [showSensitive, setShowSensitive] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const handleCopy = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const FieldRow = ({ label, value, fieldId, isSensitive = false }: { label: string, value?: string, fieldId: string, isSensitive?: boolean }) => {
    if (!value) return null;
    
    // Formatting logic for display
    let displayValue = value;
    if (fieldId === 'number' && !isSensitive) {
       // Format strictly for display if revealed? For now just raw value is better for copying, 
       // but for visuals grouping by 4 is nice. We'll keep it simple: raw text for copy accuracy.
    }

    return (
      <div className="bg-slate-800/50 p-3 rounded-lg border border-slate-700 mb-3 flex items-center justify-between group hover:border-slate-600 transition-colors">
        <div className="overflow-hidden mr-3">
          <p className="text-[10px] text-slate-500 uppercase font-bold mb-1 tracking-wider">{label}</p>
          <p className={`font-mono text-white text-sm truncate ${isSensitive && !showSensitive ? 'blur-[6px] select-none opacity-50' : ''}`}>
             {isSensitive && !showSensitive ? '•'.repeat(Math.min(value.length, 16)) : value}
          </p>
        </div>
        <button
          onClick={() => handleCopy(value, fieldId)}
          className="p-2.5 bg-slate-700 hover:bg-slate-600 active:bg-slate-500 rounded-lg text-slate-300 transition-all flex-shrink-0"
          title="Copy to clipboard"
        >
          {copiedField === fieldId ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
        </button>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-[70] bg-slate-950/90 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden transform transition-all scale-100">
        <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
          <div className="flex items-center gap-2">
            <div className="bg-emerald-500/10 p-1.5 rounded text-emerald-500">
              <CardIcon className="w-4 h-4" />
            </div>
            <h3 className="font-bold text-white">Card Details</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white transition-colors">
            <X className="w-5 h-5"/>
          </button>
        </div>
        
        <div className="p-5">
           <div className="flex justify-between items-center mb-6">
             <span className="text-xs text-slate-500">{card.issuer} {card.name}</span>
             <button 
               onClick={() => setShowSensitive(!showSensitive)}
               className="text-xs flex items-center gap-1.5 text-emerald-400 hover:text-emerald-300 transition-colors bg-emerald-500/10 px-2 py-1 rounded-md"
             >
               {showSensitive ? <EyeOff className="w-3 h-3"/> : <Eye className="w-3 h-3"/>}
               {showSensitive ? 'Hide' : 'Reveal'}
             </button>
           </div>

           <div className="space-y-1">
             <FieldRow label="Card Number" value={card.fullCardNumber} fieldId="number" isSensitive />
             <div className="grid grid-cols-2 gap-3">
               <FieldRow label="Expiry" value={card.expiryDate} fieldId="expiry" />
               <FieldRow label="CVV" value={card.cvv} fieldId="cvv" isSensitive />
             </div>
             <FieldRow label="Cardholder Name" value={card.cardHolderName} fieldId="name" />
           </div>
           
           {!card.fullCardNumber && !card.cvv && !card.expiryDate && (
             <div className="text-center py-6 bg-slate-800/30 rounded-lg border border-slate-800 border-dashed">
               <p className="text-slate-500 text-sm">No secure details saved.</p>
               <p className="text-xs text-slate-600 mt-1">Edit this card to add them.</p>
             </div>
           )}
        </div>
      </div>
    </div>
  );
};