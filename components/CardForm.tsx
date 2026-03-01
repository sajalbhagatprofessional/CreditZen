import React, { useState } from 'react';
import { CreditCard, CardCategory, Benefit, CardType, CardDocument } from '../types';
import { X, Plus, Trash2, Lock, AlignLeft, Clock, FileText, Upload, Loader2, AlertCircle, Camera } from 'lucide-react';
import { getCategoryIcon, STANDARD_CATEGORIES } from '../constants';
import { processCardDocument, extractCardDetails } from '../services/geminiService';

interface CardFormProps {
  initialData?: CreditCard;
  onSave: (card: CreditCard) => void;
  onCancel: () => void;
}

export const CardForm: React.FC<CardFormProps> = ({ initialData, onSave, onCancel }) => {
  const [formData, setFormData] = useState<Partial<CreditCard>>(
    initialData || {
      id: crypto.randomUUID(),
      type: 'Credit',
      benefits: [],
      temporaryBenefits: [],
      documents: []
    }
  );
  
  const [newBenefit, setNewBenefit] = useState<Partial<Benefit>>({ multiplier: 1, category: CardCategory.General });
  const [newTempBenefit, setNewTempBenefit] = useState<Partial<Benefit>>({ multiplier: 1, category: '', expiryDate: '' });
  
  const [isProcessingDoc, setIsProcessingDoc] = useState(false);
  const [isScanningCard, setIsScanningCard] = useState(false);

  const addBenefit = () => {
    if (newBenefit.category && newBenefit.multiplier) {
      setFormData(prev => ({
        ...prev,
        benefits: [...(prev.benefits || []), newBenefit as Benefit]
      }));
      setNewBenefit({ multiplier: 1, category: CardCategory.General });
    }
  };

  const addTempBenefit = () => {
    if (newTempBenefit.category && newTempBenefit.multiplier && newTempBenefit.expiryDate) {
      setFormData(prev => ({
        ...prev,
        temporaryBenefits: [...(prev.temporaryBenefits || []), newTempBenefit as Benefit]
      }));
      setNewTempBenefit({ multiplier: 1, category: '', expiryDate: '' });
    }
  };

  const removeBenefit = (index: number) => {
    setFormData(prev => ({
      ...prev,
      benefits: prev.benefits?.filter((_, i) => i !== index)
    }));
  };

  const removeTempBenefit = (index: number) => {
    setFormData(prev => ({
      ...prev,
      temporaryBenefits: prev.temporaryBenefits?.filter((_, i) => i !== index)
    }));
  };

  const handleCardScan = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert("File is too large. Please upload an image under 5MB.");
      return;
    }

    setIsScanningCard(true);
    try {
      const details = await extractCardDetails(file);
      
      setFormData(prev => ({
        ...prev,
        issuer: details.issuer || prev.issuer,
        name: details.name || prev.name,
        // Map network if needed, or just store it
        lastFour: details.lastFour || prev.lastFour,
        expiryDate: details.expiryDate || prev.expiryDate,
        cardHolderName: details.cardholder || prev.cardHolderName
      }));
      
      // If full number was somehow extracted (unlikely/unsafe via LLM usually, but if user wants)
      // We generally avoid full number extraction for security unless explicitly requested.
      
    } catch (error: any) {
      alert(`Scan failed: ${error.message}`);
    } finally {
      setIsScanningCard(false);
      e.target.value = '';
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Basic validation
    if (file.size > 5 * 1024 * 1024) {
      alert("File is too large. Please upload an image/PDF under 5MB.");
      return;
    }

    setIsProcessingDoc(true);
    try {
      const extractedText = await processCardDocument(file);
      
      const newDoc: CardDocument = {
        id: crypto.randomUUID(),
        name: file.name,
        type: 'Other', // Default, user could theoretically edit this later
        uploadDate: new Date().toISOString().split('T')[0],
        summary: extractedText
      };

      setFormData(prev => ({
        ...prev,
        documents: [...(prev.documents || []), newDoc]
      }));
    } catch (error) {
      alert("Failed to process document. Please try again or check your API key.");
    } finally {
      setIsProcessingDoc(false);
      // Reset input
      e.target.value = '';
    }
  };

  const removeDocument = (id: string) => {
    setFormData(prev => ({
      ...prev,
      documents: prev.documents?.filter(d => d.id !== id)
    }));
  };

  const handleFullNumberChange = (val: string) => {
    const clean = val.replace(/\s/g, '');
    setFormData(prev => ({
      ...prev,
      fullCardNumber: clean,
      lastFour: clean.length >= 4 ? clean.slice(-4) : prev.lastFour
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.issuer || !formData.name) {
      alert("Please fill in Issuer and Name");
      return;
    }
    onSave(formData as CreditCard);
  };

  return (
    <div className="fixed inset-0 z-[100] bg-slate-950/95 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="max-w-lg mx-auto bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-white">
            {initialData ? 'Edit Card' : 'Add New Card'}
          </h2>
          <div className="flex items-center gap-2">
             <div className="relative">
                <input 
                  type="file" 
                  id="card-scan" 
                  accept="image/*" 
                  capture="environment"
                  className="hidden" 
                  onChange={handleCardScan}
                  disabled={isScanningCard}
                />
                <label 
                  htmlFor="card-scan" 
                  className={`p-2 bg-slate-800 hover:bg-slate-700 rounded-full text-emerald-400 cursor-pointer transition-colors flex items-center justify-center ${isScanningCard ? 'opacity-50' : ''}`}
                  title="Scan Card with Camera"
                >
                  {isScanningCard ? <Loader2 className="w-5 h-5 animate-spin" /> : <Camera className="w-5 h-5" />}
                </label>
             </div>
             <button onClick={onCancel} className="p-2 hover:bg-slate-800 rounded-full text-slate-400">
                <X className="w-5 h-5" />
             </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Card Type Selector */}
          <div className="flex bg-slate-800 p-1 rounded-lg mb-4">
            {(['Credit', 'Debit'] as CardType[]).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setFormData({ ...formData, type })}
                className={`flex-1 py-2 text-sm font-semibold rounded-md transition-all ${
                  formData.type === type
                    ? 'bg-slate-700 text-white shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {type} Card
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Issuer</label>
              <input
                type="text"
                required
                placeholder="e.g. Chase"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                value={formData.issuer || ''}
                onChange={e => setFormData({ ...formData, issuer: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Card Name</label>
              <input
                type="text"
                required
                placeholder="e.g. Sapphire"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                value={formData.name || ''}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
          </div>

          {/* Conditional Fields for Credit Cards */}
          {formData.type === 'Credit' && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Credit Limit ($)</label>
                  <input
                    type="number"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                    value={formData.creditLimit || ''}
                    onChange={e => setFormData({ ...formData, creditLimit: parseInt(e.target.value) })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Current Balance ($)</label>
                  <input
                    type="number"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                    value={formData.currentBalance || ''}
                    onChange={e => setFormData({ ...formData, currentBalance: parseInt(e.target.value) })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Statement Day</label>
                  <input
                    type="number"
                    min={1}
                    max={31}
                    placeholder="Day (1-31)"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                    value={formData.statementDay || ''}
                    onChange={e => setFormData({ ...formData, statementDay: parseInt(e.target.value) })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Due Day</label>
                  <input
                    type="number"
                    min={1}
                    max={31}
                    placeholder="Day (1-31)"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                    value={formData.dueDay || ''}
                    onChange={e => setFormData({ ...formData, dueDay: parseInt(e.target.value) })}
                  />
                </div>
              </div>
            </>
          )}
          
          {formData.type === 'Debit' && (
             <div>
               <label className="block text-xs font-medium text-slate-400 mb-1">Current Balance (Optional)</label>
               <input
                 type="number"
                 className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                 value={formData.currentBalance || ''}
                 onChange={e => setFormData({ ...formData, currentBalance: parseInt(e.target.value) })}
                 placeholder="Available Funds"
               />
             </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Payment/Bank URL</label>
            <input
              type="url"
              placeholder="https://..."
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
              value={formData.paymentUrl || ''}
              onChange={e => setFormData({ ...formData, paymentUrl: e.target.value })}
            />
          </div>

          {/* Secure Details Section */}
          <div className="bg-slate-950/50 p-4 rounded-xl border border-slate-800 space-y-3">
             <div className="flex items-center gap-2 mb-2">
               <Lock className="w-3 h-3 text-emerald-400" />
               <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wide">Secure Details (Optional)</h3>
             </div>
             
             <div>
              <label className="block text-[10px] font-medium text-slate-500 mb-1">Full Card Number</label>
              <input
                type="text"
                placeholder="0000 0000 0000 0000"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-emerald-500 outline-none font-mono text-sm"
                value={formData.fullCardNumber || ''}
                onChange={e => handleFullNumberChange(e.target.value)}
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
               <div>
                  <label className="block text-[10px] font-medium text-slate-500 mb-1">Expiry (MM/YY)</label>
                  <input
                    type="text"
                    placeholder="MM/YY"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-emerald-500 outline-none font-mono text-sm"
                    value={formData.expiryDate || ''}
                    onChange={e => setFormData({ ...formData, expiryDate: e.target.value })}
                  />
               </div>
               <div>
                  <label className="block text-[10px] font-medium text-slate-500 mb-1">CVV</label>
                  <input
                    type="text"
                    placeholder="123"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-emerald-500 outline-none font-mono text-sm"
                    value={formData.cvv || ''}
                    onChange={e => setFormData({ ...formData, cvv: e.target.value })}
                  />
               </div>
            </div>
             <div>
              <label className="block text-[10px] font-medium text-slate-500 mb-1">Cardholder Name</label>
              <input
                type="text"
                placeholder="Name on Card"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
                value={formData.cardHolderName || ''}
                onChange={e => setFormData({ ...formData, cardHolderName: e.target.value })}
              />
            </div>
            
            <div>
              <label className="block text-[10px] font-medium text-slate-500 mb-1">Last 4 (Auto-filled or Manual)</label>
              <input
                type="text"
                maxLength={4}
                placeholder="1234"
                className="w-24 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-emerald-500 outline-none font-mono text-sm"
                value={formData.lastFour || ''}
                onChange={e => setFormData({ ...formData, lastFour: e.target.value })}
              />
            </div>
          </div>
          
          {/* Documents Section */}
          <div className="border-t border-slate-800 pt-4 mt-4">
            <h3 className="text-sm font-semibold text-white mb-2 flex items-center gap-2">
              <FileText className="w-4 h-4 text-emerald-400" /> Documents & Policies
            </h3>
            <p className="text-[10px] text-slate-500 mb-3 leading-tight">
              Upload terms, fee schedules, or insurance guides (PDF/Image). 
              AI will extract policy details to better answer your questions.
            </p>

            <div className="space-y-2 mb-3">
              {formData.documents?.map((doc) => (
                <div key={doc.id} className="bg-slate-800/50 p-3 rounded-lg border border-slate-700 flex justify-between items-start group">
                  <div>
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-emerald-500" />
                      <p className="text-sm font-medium text-white truncate max-w-[180px]">{doc.name}</p>
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1">Uploaded: {doc.uploadDate}</p>
                    <div className="mt-2 text-[10px] text-slate-400 bg-slate-900/50 p-2 rounded line-clamp-2">
                      {doc.summary}
                    </div>
                  </div>
                  <button type="button" onClick={() => removeDocument(doc.id)} className="text-slate-500 hover:text-rose-500">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>

            <div className="relative">
               <input 
                 type="file" 
                 id="doc-upload" 
                 accept="image/*,application/pdf" 
                 className="hidden" 
                 onChange={handleFileUpload}
                 disabled={isProcessingDoc}
               />
               <label 
                 htmlFor="doc-upload" 
                 className={`flex items-center justify-center gap-2 w-full border-2 border-dashed border-slate-700 hover:border-emerald-500/50 hover:bg-slate-800/30 rounded-xl p-4 cursor-pointer transition-all ${isProcessingDoc ? 'opacity-50 cursor-wait' : ''}`}
               >
                 {isProcessingDoc ? (
                   <>
                     <Loader2 className="w-5 h-5 text-emerald-400 animate-spin" />
                     <span className="text-sm text-slate-300">AI Processing...</span>
                   </>
                 ) : (
                   <>
                     <Upload className="w-5 h-5 text-slate-400" />
                     <span className="text-sm text-slate-300">Upload Image or PDF</span>
                   </>
                 )}
               </label>
            </div>
          </div>

          {/* Benefits Section with Custom Category Support */}
          <div className="border-t border-slate-800 pt-4 mt-4">
            <h3 className="text-sm font-semibold text-emerald-400 mb-2">Permanent Rewards</h3>
            
            <div className="flex gap-2 mb-3">
              <div className="flex-1 relative">
                 <input
                  list="categories"
                  placeholder="Category (Select or Type)"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-2 text-sm text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                  value={newBenefit.category}
                  onChange={e => setNewBenefit({...newBenefit, category: e.target.value})}
                 />
                 <datalist id="categories">
                   {STANDARD_CATEGORIES.map(c => <option key={c} value={c} />)}
                 </datalist>
              </div>

              <input
                type="number"
                step="0.1"
                placeholder="x"
                className="w-16 bg-slate-800 border border-slate-700 rounded-lg px-2 py-2 text-sm text-white"
                value={newBenefit.multiplier || ''}
                onChange={e => setNewBenefit({...newBenefit, multiplier: parseFloat(e.target.value)})}
              />
              <button
                type="button"
                onClick={addBenefit}
                className="bg-emerald-600 hover:bg-emerald-500 text-white p-2 rounded-lg"
              >
                <Plus className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2 max-h-40 overflow-y-auto mb-4">
              {formData.benefits?.map((benefit, idx) => (
                <div key={idx} className="flex justify-between items-center bg-slate-800/50 p-2 rounded border border-slate-800">
                  <span className="text-sm flex items-center gap-2">
                    {getCategoryIcon(benefit.category)} {benefit.category}
                  </span>
                  <div className="flex items-center gap-3">
                    <span className="text-emerald-400 font-bold">{benefit.multiplier}x</span>
                    <button type="button" onClick={() => removeBenefit(idx)} className="text-rose-500">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Temporary Benefits Section */}
            <div className="border-t border-slate-800 pt-4">
               <div className="flex items-center gap-2 mb-2">
                 <Clock className="w-4 h-4 text-amber-500" />
                 <h3 className="text-sm font-semibold text-amber-400">Temporary / Quarterly Offers</h3>
               </div>
               
               <div className="grid grid-cols-2 gap-2 mb-2">
                 <input
                    type="text"
                    placeholder="Store/Category"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-2 text-sm text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                    value={newTempBenefit.category || ''}
                    onChange={e => setNewTempBenefit({...newTempBenefit, category: e.target.value})}
                  />
                  <input
                    type="number"
                    step="0.1"
                    placeholder="x"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-2 text-sm text-white"
                    value={newTempBenefit.multiplier || ''}
                    onChange={e => setNewTempBenefit({...newTempBenefit, multiplier: parseFloat(e.target.value)})}
                  />
               </div>
               <div className="flex gap-2 mb-3">
                 <input
                    type="date"
                    className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-2 py-2 text-sm text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                    value={newTempBenefit.expiryDate || ''}
                    onChange={e => setNewTempBenefit({...newTempBenefit, expiryDate: e.target.value})}
                  />
                  <button
                    type="button"
                    onClick={addTempBenefit}
                    className="bg-amber-600 hover:bg-amber-500 text-white p-2 rounded-lg"
                  >
                    <Plus className="w-5 h-5" />
                  </button>
               </div>

               <div className="space-y-2 max-h-40 overflow-y-auto">
                {formData.temporaryBenefits?.map((benefit, idx) => (
                  <div key={idx} className="bg-amber-900/10 border border-amber-900/30 p-2 rounded">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-sm font-semibold text-amber-200">{benefit.category}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-amber-400 font-bold">{benefit.multiplier}x</span>
                        <button type="button" onClick={() => removeTempBenefit(idx)} className="text-rose-500">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    <div className="text-[10px] text-slate-500 flex items-center gap-1">
                      <Clock className="w-3 h-3" /> Ends: {benefit.expiryDate}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Notes Section */}
          <div className="border-t border-slate-800 pt-4 mt-4">
             <label className="flex items-center gap-2 text-sm font-semibold text-slate-400 mb-2">
               <AlignLeft className="w-4 h-4" /> Notes
             </label>
             <textarea
               className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-emerald-500 outline-none text-sm min-h-[80px]"
               placeholder="Write down extra benefits, hidden fees, or specific use cases..."
               value={formData.notes || ''}
               onChange={e => setFormData({ ...formData, notes: e.target.value })}
             />
          </div>

          <div className="pt-4 flex gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold py-3 rounded-lg border border-slate-700 transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-3 rounded-lg shadow-lg shadow-emerald-900/20 transition-all"
            >
              Save {formData.type || 'Card'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};