import React, { useCallback, useEffect, useRef, useState } from 'react';
import { X, Send, Loader2, Sparkles } from 'lucide-react';
import { GoogleGenAI, Chat } from '@google/genai';

interface Message {
  id: string;
  role: 'user' | 'model';
  text: string;
}

const FALLBACK_GEMINI_API_KEY = 'AIzaSyBcVfnAAfylvjRl60rPCkCSGllwsV_nqi8';

const SYSTEM_INSTRUCTION = `You are the AI Support Assistant for LootX, a premier mystery box and case battle platform. Your tone is professional, helpful, and slightly gamer-centric.

Key Knowledge:
- LootX allows users to open mystery boxes containing real-world items (simulated).
- Case Battles: Users compete against each other. The highest total value wins everything.
- Case Lab: Users can create custom cases with specific odds.
- Provably Fair: All outcomes are random and verifiable.
- Currency: Users use site coins (simulated).

Do not answer questions unrelated to LootX, gaming, or general support. Keep answers concise.`;

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
    { id: 'welcome', role: 'model', text: "Hi! I'm the LootX AI Assistant. How can I help you today?" }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);

  const chatSessionRef = useRef<Chat | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isOpen, scrollToBottom]);

  const initializeChat = useCallback(async () => {
    if (chatSessionRef.current || isInitializing) return chatSessionRef.current;

    const apiKey = import.meta.env.VITE_GEMINI_API_KEY || FALLBACK_GEMINI_API_KEY;
    if (!apiKey) {
      setInitError('Gemini API key is missing. Add VITE_GEMINI_API_KEY to continue.');
      return null;
    }

    setIsInitializing(true);
    setInitError(null);

    try {
      if (!import.meta.env.VITE_GEMINI_API_KEY) {
        console.warn('Gemini API Key is missing from environment; using fallback key');
      }

      const ai = new GoogleGenAI({ apiKey });
      chatSessionRef.current = ai.chats.create({
        model: 'gemini-2.0-flash',
        config: {
          systemInstruction: SYSTEM_INSTRUCTION
        }
      });

      return chatSessionRef.current;
    } catch (error) {
      console.error('Failed to init AI', error);
      setInitError('Unable to connect to Gemini right now. Please try again shortly.');
      chatSessionRef.current = null;
      return null;
    } finally {
      setIsInitializing(false);
    }
  }, [isInitializing]);

  useEffect(() => {
    if (!isOpen) return;
    void initializeChat();
  }, [isOpen, initializeChat]);

  const handleSend = async () => {
    const trimmedInput = input.trim();
    if (!trimmedInput || isLoading) return;

    const chatSession = chatSessionRef.current ?? (await initializeChat());
    if (!chatSession) return;

    const userMsg: Message = { id: Date.now().toString(), role: 'user', text: trimmedInput };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const result = await chatSession.sendMessage({ message: userMsg.text });
      const text = result.text?.trim();

      const aiMsg: Message = {
        id: `${Date.now()}-ai`,
        role: 'model',
        text: text || "I'm having trouble connecting to the mainframe. Try again?"
      };
      setMessages((prev) => [...prev, aiMsg]);
    } catch (error) {
      console.error('Chat error', error);
      setMessages((prev) => [
        ...prev,
        {
          id: `${Date.now()}-error`,
          role: 'model',
          text: 'Sorry, I encountered an error. Please check your connection.'
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  const containerClass = variant === 'sidebar'
    ? 'bg-[#131720] border border-gray-800 rounded-2xl shadow-xl flex flex-col h-full overflow-hidden'
    : 'fixed inset-0 bg-black/80 z-50 flex items-end sm:items-center justify-center p-3 sm:p-4';

  const panelClass = variant === 'sidebar'
    ? 'flex flex-col h-full min-h-0'
    : 'w-full max-w-lg bg-[#131720] border border-gray-800 rounded-2xl shadow-2xl flex flex-col h-[85vh] sm:h-auto sm:max-h-[80vh] min-h-0 animate-in slide-in-from-bottom-10 fade-in duration-200';

  const inputDisabled = isLoading || isInitializing || Boolean(initError);

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
              LootX Assistant
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
              <div
                className={`max-w-[88%] sm:max-w-[85%] p-3 rounded-2xl text-sm whitespace-pre-wrap break-words ${
                  msg.role === 'user'
                    ? 'bg-blue-600 text-white rounded-tr-none'
                    : 'bg-[#1a2130] text-gray-200 rounded-tl-none border border-gray-700'
                }`}
              >
                {msg.text}
              </div>
            </div>
          ))}

          {initError && (
            <div className="flex justify-start">
              <div className="bg-red-500/10 text-red-200 border border-red-400/30 p-3 rounded-2xl rounded-tl-none text-xs">
                {initError}
              </div>
            </div>
          )}

          {(isLoading || isInitializing) && (
            <div className="flex justify-start">
              <div className="bg-[#1a2130] p-3 rounded-2xl rounded-tl-none border border-gray-700 flex items-center gap-2">
                <Loader2 className="w-4 h-4 text-brand-purple animate-spin" />
                <span className="text-xs text-gray-400">{isInitializing ? 'Connecting...' : 'Thinking...'}</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-3 bg-[#0b0e14] border-t border-gray-800 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void handleSend();
            }}
            className="relative"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={initError ? 'Chat unavailable' : 'Ask about battles, cases...'}
              disabled={inputDisabled}
              className="w-full bg-[#151a23] border border-gray-700 text-white text-sm rounded-xl pl-4 pr-12 py-3 min-h-[48px] focus:outline-none focus:border-brand-purple transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            />
            <button
              type="submit"
              disabled={inputDisabled || !input.trim()}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-brand-purple hover:bg-purple-600 rounded-lg text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Send message"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
