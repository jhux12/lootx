import React, { useState, useRef, useEffect } from 'react';
import { X, Send, Loader2, Sparkles } from 'lucide-react';
import { GoogleGenAI, Chat } from "@google/genai";

interface Message {
  id: string;
  role: 'user' | 'model';
  text: string;
}

const GEMINI_API_KEY = "AIzaSyCB04Pk1auWCF-hU6Gnmm3gRDxhpZOylwU";

type ChatVariant = 'sidebar' | 'modal';

interface AIChatBotProps {
  isOpen: boolean;
  onClose?: () => void;
  variant?: ChatVariant;
}

export const AIChatBot: React.FC<AIChatBotProps> = ({ 
  isOpen, 
  onClose, 
  variant = 'sidebar' 
}) => {
  const [messages, setMessages] = useState<Message[]>([
      { id: 'welcome', role: 'model', text: "Hi! I'm the Pullz Assistant. How can I help you today?" }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [chatSession, setChatSession] = useState<Chat | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isOpen]);

  useEffect(() => {
      // Initialize Gemini Chat
      try {
        const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
        const chat = ai.chats.create({
            model: 'gemini-2.0-flash',
            config: {
                systemInstruction: "You are the Pullz Assistant for LootX, a premier mystery box and case battle platform. Your tone is professional, helpful, and slightly gamer-centric. \n\nKey Knowledge:\n- LootX allows users to open mystery boxes containing real-world items (simulated).\n- Case Battles: Users compete against each other. The highest total value wins everything.\n- Case Lab: Users can create custom cases with specific odds.\n- Provably Fair: All outcomes are random and verifiable.\n- Currency: Users use site coins (simulated).\n\nDo not answer questions unrelated to LootX, gaming, or general support. Keep answers concise."
            }
        });
        setChatSession(chat);
      } catch (error) {
          console.error("Failed to init AI", error);
      }
  }, []);

  const handleSend = async () => {
      if (!input.trim() || !chatSession) return;

      const userMsg: Message = { id: Date.now().toString(), role: 'user', text: input };
      setMessages(prev => [...prev, userMsg]);
      setInput('');
      setIsLoading(true);

      try {
          const result = await chatSession.sendMessage({ message: userMsg.text });
          const text = result.text; // Access .text property directly
          
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
            <div className="p-2 bg-brand-purple/20 rounded-lg">
                <Sparkles className="w-5 h-5 text-brand-purple" />
            </div>
            <div className="flex-1">
                <h3 className="font-bold text-white text-sm flex items-center gap-2">
                  Pullz Assistant
                  <span className="px-2 py-0.5 text-[10px] font-bold bg-brand-purple/20 text-brand-purple rounded-full border border-brand-purple/30">
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
                         <Loader2 className="w-4 h-4 text-brand-purple animate-spin" />
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
                <input 
                    type="text" 
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Ask about battles, cases..."
                    className="w-full bg-[#151a23] border border-gray-700 text-white text-sm rounded-xl pl-4 pr-12 py-3 focus:outline-none focus:border-brand-purple transition-colors"
                />
                <button 
                    type="submit"
                    disabled={isLoading || !input.trim()}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-brand-purple hover:bg-purple-600 rounded-lg text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <Send className="w-4 h-4" />
                </button>
            </form>
        </div>
      </div>
    </div>
  );
};
