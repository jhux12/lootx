import React, { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, Bot, Loader2, Sparkles } from 'lucide-react';
import { GoogleGenAI, Chat } from "@google/genai";

interface Message {
  id: string;
  role: 'user' | 'model';
  text: string;
}

export const AIChatBot: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
      { id: 'welcome', role: 'model', text: "Hi! I'm the LootX AI Assistant. How can I help you today?" }
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
        if (!process.env.API_KEY) {
            console.warn("Gemini API Key is missing");
            return;
        }
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const chat = ai.chats.create({
            model: 'gemini-3-pro-preview',
            config: {
                systemInstruction: "You are the AI Support Assistant for LootX, a premier mystery box and case battle platform. Your tone is professional, helpful, and slightly gamer-centric. \n\nKey Knowledge:\n- LootX allows users to open mystery boxes containing real-world items (simulated).\n- Case Battles: Users compete against each other. The highest total value wins everything.\n- Case Lab: Users can create custom cases with specific odds.\n- Provably Fair: All outcomes are random and verifiable.\n- Currency: Users use site balance (simulated USD).\n\nDo not answer questions unrelated to LootX, gaming, or general support. Keep answers concise."
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

  return (
      <>
        {/* Floating Button */}
        <button 
            onClick={() => setIsOpen(!isOpen)}
            className={`fixed bottom-6 right-6 z-50 p-4 rounded-full shadow-2xl transition-all hover:scale-110 active:scale-95 flex items-center justify-center border border-white/10 ${isOpen ? 'bg-red-500 rotate-90' : 'bg-gradient-to-r from-brand-purple to-blue-600'}`}
        >
            {isOpen ? <X className="w-6 h-6 text-white" /> : <Bot className="w-6 h-6 text-white" />}
        </button>

        {/* Chat Window */}
        {isOpen && (
            <div className="fixed bottom-24 right-6 w-[350px] h-[500px] bg-[#131720] border border-gray-700 rounded-2xl shadow-2xl z-50 flex flex-col overflow-hidden animate-in slide-in-from-bottom-10 fade-in duration-300">
                {/* Header */}
                <div className="p-4 bg-[#0b0e14] border-b border-gray-800 flex items-center gap-3">
                    <div className="p-2 bg-brand-purple/20 rounded-lg">
                        <Sparkles className="w-5 h-5 text-brand-purple" />
                    </div>
                    <div>
                        <h3 className="font-bold text-white text-sm">LootX Assistant</h3>
                        <p className="text-[10px] text-green-400 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse"></span>
                            Online
                        </p>
                    </div>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar bg-[#0f1219]">
                    {messages.map((msg) => (
                        <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[85%] p-3 rounded-2xl text-sm ${msg.role === 'user' ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-[#1a2130] text-gray-200 rounded-tl-none border border-gray-700'}`}>
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
        )}
      </>
  );
};