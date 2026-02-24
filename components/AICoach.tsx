import React, { useState } from 'react';
import { CreditCard } from '../types';
import { askCreditCoach } from '../services/geminiService';
import { Send, Bot, User } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface AICoachProps {
  cards: CreditCard[];
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export const AICoach: React.FC<AICoachProps> = ({ cards }) => {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: 'Hello! I am your AI Credit Manager. Ask me about your utilization, when to pay your bills, or how to optimize your rewards.' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMsg = input;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setLoading(true);

    try {
      const response = await askCreditCoach(userMsg, cards);
      setMessages(prev => [...prev, { role: 'assistant', content: response || "Sorry, I couldn't process that." }]);
    } catch (e) {
      setMessages(prev => [...prev, { role: 'assistant', content: "An error occurred connecting to the financial brain." }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-180px)]">
      <div className="flex-1 overflow-y-auto space-y-4 pr-2 mb-4 scrollbar-thin scrollbar-thumb-slate-800">
        {messages.map((m, i) => (
          <div key={i} className={`flex gap-3 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
            <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center ${m.role === 'assistant' ? 'bg-emerald-600' : 'bg-slate-700'}`}>
              {m.role === 'assistant' ? <Bot className="w-5 h-5 text-white" /> : <User className="w-5 h-5 text-white" />}
            </div>
            <div className={`p-3 rounded-2xl max-w-[85%] text-sm leading-relaxed ${
              m.role === 'user' 
                ? 'bg-emerald-600/20 text-emerald-100 rounded-tr-none border border-emerald-500/20' 
                : 'bg-slate-800/80 text-slate-200 rounded-tl-none border border-slate-700'
            }`}>
              <ReactMarkdown>{m.content}</ReactMarkdown>
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex gap-3">
             <div className="w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center">
               <Bot className="w-5 h-5 text-white" />
             </div>
             <div className="bg-slate-800/80 p-3 rounded-2xl rounded-tl-none border border-slate-700 flex items-center gap-2">
               <div className="w-2 h-2 bg-slate-500 rounded-full animate-bounce" />
               <div className="w-2 h-2 bg-slate-500 rounded-full animate-bounce delay-75" />
               <div className="w-2 h-2 bg-slate-500 rounded-full animate-bounce delay-150" />
             </div>
          </div>
        )}
      </div>

      <div className="relative">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSend()}
          placeholder="Ask about your credit strategy..."
          className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-4 pr-12 py-3 text-sm text-white focus:ring-2 focus:ring-emerald-500 outline-none"
        />
        <button
          onClick={handleSend}
          disabled={loading || !input.trim()}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-emerald-600 text-white rounded-lg disabled:opacity-50 hover:bg-emerald-500 transition-colors"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};