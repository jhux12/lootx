import React, { useState, useRef, useEffect } from 'react';
import { X, Send, Loader2, Sparkles } from 'lucide-react';
import { Input } from './ui/Input';
import { buildSiteSearchContext } from '../utils/siteSearch';
import { auth } from '../firebase';

interface Message {
  id: string;
  role: 'user' | 'model';
  text: string;
}

const SITE_CONTEXT = `
Ripza is a mystery pack and pack battle experience. The site includes:
- Mystery packs with real-world items shown in each pack.
- Pack Battles where players open the same packs and the highest total wins.
- Pack Lab for creating custom packs.
- Provably fair outcomes that can be verified.
- Site coins used for gameplay.
`.trim();

const MAX_PAGE_CONTEXT_CHARS = 3000;

const getPageContentSummary = () => {
  if (typeof document === 'undefined') return '';
  const sections = [
    document.querySelector('header'),
    document.querySelector('main'),
    document.querySelector('footer')
  ];
  const text = sections
    .map((section) => section?.textContent?.trim())
    .filter(Boolean)
    .join('\n\n')
    .replace(/\s+/g, ' ')
    .trim();

  if (!text) return '';
  return text.length > MAX_PAGE_CONTEXT_CHARS
    ? `${text.slice(0, MAX_PAGE_CONTEXT_CHARS)}…`
    : text;
};

type ChatVariant = 'sidebar' | 'modal';

interface AIChatBotProps {
  isOpen: boolean;
  onClose?: () => void;
  variant?: ChatVariant;
  storageKey?: string;
}

const DEFAULT_MESSAGES: Message[] = [
  { id: 'welcome', role: 'model', text: "Hi! I'm the Ripza Assistant from Ripza. I can only answer using information available on the site. How can I help you today?" }
];

export const AIChatBot: React.FC<AIChatBotProps> = ({ 
  isOpen, 
  onClose, 
  variant = 'sidebar',
  storageKey = 'pullz-ai-support-session'
}) => {
  const [messages, setMessages] = useState<Message[]>(DEFAULT_MESSAGES);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isOpen]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.sessionStorage.getItem(storageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Message[];
      if (!Array.isArray(parsed) || parsed.length === 0) return;
      const sanitized = parsed.filter((entry) => (
        entry &&
        typeof entry.id === 'string' &&
        (entry.role === 'user' || entry.role === 'model') &&
        typeof entry.text === 'string'
      ));
      if (sanitized.length > 0) {
        setMessages(sanitized);
      }
    } catch (error) {
      console.warn('Unable to restore AI support session', error);
    }
  }, [storageKey]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.sessionStorage.setItem(storageKey, JSON.stringify(messages));
    } catch (error) {
      console.warn('Unable to persist AI support session', error);
    }
  }, [messages, storageKey]);

  const handleSend = async () => {
      if (!input.trim()) return;

      const userMsg: Message = { id: Date.now().toString(), role: 'user', text: input };
      setMessages(prev => [...prev, userMsg]);
      setInput('');
      setIsLoading(true);

      try {
          const pageContent = getPageContentSummary();
          const siteSearchContext = buildSiteSearchContext(userMsg.text);
          const promptParts = [
            `CURRENT_PAGE_CONTENT:\n${pageContent || 'No readable page content found.'}`,
            siteSearchContext || 'SITE_SEARCH_RESULTS:\nNo site search matches found.',
            `USER_QUESTION:\n${userMsg.text}`
          ];
          const prompt = promptParts.join('\n\n');
          const token = await auth.currentUser?.getIdToken();
          const result = await fetch('/api/chat', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(token ? { Authorization: `Bearer ${token}` } : {})
            },
            body: JSON.stringify({
              mode: 'assistant',
              prompt,
              systemInstruction: `You are the Ripza Assistant for Ripza. Use ONLY the information in SITE_CONTEXT, CURRENT_PAGE_CONTENT, SITE_SEARCH_RESULTS, and the chat history. If the answer is not in those sources, say you don't have that information on Ripza and suggest checking the site or support. Do not guess or use outside knowledge. Keep answers concise and professional, with a gamer-friendly tone.\n\nSITE_CONTEXT:\n${SITE_CONTEXT}`
            })
          });
          if (!result.ok) throw new Error('Assistant request failed');
          const payload = await result.json();
          const text = typeof payload?.text === 'string' ? payload.text : '';
          
          const aiMsg: Message = { 
              id: (Date.now() + 1).toString(), 
              role: 'model', 
              text: text || "I'm having trouble connecting to the mainframe. Try again?" 
          };
          setMessages(prev => [...prev, aiMsg]);
      } catch (error) {
          console.error("Chat error", error);
          setMessages(prev => [...prev, { id: Date.now().toString(), role: 'model', text: "Sorry, I encountered an error. Please check your connection." }]);
      } finally {
          setIsLoading(false);
      }
  };

  if (!isOpen) return null;

  const containerClass = variant === 'sidebar'
    ? "bg-[#131720] border border-gray-800 rounded-2xl shadow-xl flex flex-col h-full overflow-hidden"
    : "fixed inset-0 bg-black/80 z-50 flex items-end sm:items-center justify-center p-4";

  const panelClass = variant === 'sidebar'
    ? "flex flex-col h-full min-h-0"
    : "w-full sm:w-[420px] bg-[#131720] border border-gray-800 rounded-2xl shadow-2xl flex flex-col max-h-[80vh] min-h-0 animate-in slide-in-from-bottom-10 fade-in duration-200";

  return (
    <div className={containerClass}>
      <div className={panelClass}>
        {/* Header */}
        <div className="p-4 bg-[#0b0e14] border-b border-gray-800 flex items-center gap-3">
            <div className="p-2 bg-brand-blue/20 rounded-lg">
                <Sparkles className="w-5 h-5 text-brand-blue" />
            </div>
            <div className="flex-1">
                <h3 className="font-bold text-white text-sm flex items-center gap-2">
                  Ripza Assistant
                  <span className="px-2 py-0.5 text-[10px] font-bold bg-brand-blue/20 text-brand-blue rounded-full border border-brand-blue/30">
                    AI Support
                  </span>
                </h3>
                <p className="text-[10px] text-green-400 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse"></span>
                    Online
                </p>
            </div>
            {variant === 'modal' && onClose && (
              <button 
                onClick={onClose} 
                className="p-2 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white transition-colors"
                aria-label="Close support chat"
              >
                <X className="w-4 h-4" />
              </button>
            )}
        </div>
        <div className="px-4 py-2 bg-[#0f1219] border-b border-gray-800 text-[10px] sm:text-xs text-gray-400">
          Answers use Ripza info, current page content, and site search results to prevent misinformation.
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar bg-[#0f1219]">
            {messages.map((msg) => (
                <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] p-3 rounded-2xl text-sm whitespace-pre-wrap break-words ${msg.role === 'user' ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-[#1a2130] text-gray-200 rounded-tl-none border border-gray-700'}`}>
                        {msg.text}
                    </div>
                </div>
            ))}
            {isLoading && (
                <div className="flex justify-start">
                     <div className="bg-[#1a2130] p-3 rounded-2xl rounded-tl-none border border-gray-700 flex items-center gap-2">
                         <Loader2 className="w-4 h-4 text-brand-blue animate-spin" />
                         <span className="text-xs text-gray-400">Thinking...</span>
                     </div>
                </div>
            )}
            <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-3 bg-[#0b0e14] border-t border-gray-800">
            <form 
                onSubmit={(e) => { e.preventDefault(); handleSend(); }}
                className="relative"
            >
                <Input 
                    type="text" 
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Ask about battles, packs..."
                    className="pl-4 pr-12 py-3 text-sm"
                />
                <button 
                    type="submit"
                    disabled={isLoading || !input.trim()}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-brand-blue hover:bg-[#205DD7] rounded-lg text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <Send className="w-4 h-4" />
                </button>
            </form>
        </div>
      </div>
    </div>
  );
};
