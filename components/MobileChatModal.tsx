import React, { useEffect, useRef, useState } from 'react';
import { X, MessageSquare, Bot, Send, Users, Shield } from 'lucide-react';
import { useSound } from '../context/SoundContext';
import { AIChatBot } from './AIChatBot';
import { useSiteChat } from '../hooks/useSiteChat';
import { useGame } from '../context/GameContext';
import { FreeRainBanner } from './FreeRainBanner';
import { Input } from './ui/Input';

type MobileChatTab = 'chat' | 'support';

interface MobileChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  hasUnseenMessages: boolean;
  onChatViewed: () => void;
}

export const MobileChatModal: React.FC<MobileChatModalProps> = ({ isOpen, onClose, hasUnseenMessages, onChatViewed }) => {
  const [activeTab, setActiveTab] = useState<MobileChatTab>('chat');
  const [messageText, setMessageText] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const { playSound } = useSound();
  const { isAuthenticated } = useGame();
  const { messages, sendMessage, isSending, notice, isChatDisabled, warningsRemaining } = useSiteChat();

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [activeTab, messages.length]);

  useEffect(() => {
    if (!isOpen || activeTab !== 'chat' || messages.length === 0) return;
    onChatViewed();
  }, [isOpen, activeTab, messages.length, onChatViewed]);

  const handleSend = async () => {
    if (!messageText.trim() || isSending) return;
    playSound('click');
    await sendMessage(messageText);
    setMessageText('');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-end sm:items-center justify-center p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
      <div className="w-full sm:w-[420px] bg-[#0b0e14] border border-gray-800 rounded-2xl shadow-2xl overflow-hidden h-[calc(100dvh-2rem)] sm:h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800 bg-[#111621]">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-brand-purple" />
            <span className="text-sm font-bold text-white">Chat</span>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white transition-colors"
            aria-label="Close chat"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="grid grid-cols-2 border-b border-gray-800">
          <button
            onClick={() => { setActiveTab('chat'); playSound('click'); }}
            className={`relative flex items-center justify-center gap-2 py-2 text-sm font-semibold transition-colors ${activeTab === 'chat' ? 'text-white border-b-2 border-brand-purple' : 'text-gray-500 hover:text-gray-300'}`}
          >
            <Users className="w-4 h-4" /> Site Chat
            {hasUnseenMessages && activeTab !== 'chat' && (
              <span className="absolute right-4 top-2 h-2 w-2 rounded-full bg-brand-purple shadow-[0_0_8px_rgba(124,58,237,0.9)]" />
            )}
          </button>
          <button
            onClick={() => { setActiveTab('support'); playSound('click'); }}
            className={`flex items-center justify-center gap-2 py-2 text-sm font-semibold transition-colors ${activeTab === 'support' ? 'text-white border-b-2 border-brand-purple' : 'text-gray-500 hover:text-gray-300'}`}
          >
            <Bot className="w-4 h-4" /> Support
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 flex flex-col bg-[#0f1219] min-h-0">
          {activeTab === 'chat' ? (
            <>
              <div className="flex-1 min-h-0 flex flex-col">
                <FreeRainBanner />
                <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4 scrollbar-thin" ref={scrollRef}>
                  {messages.length === 0 && (
                    <div className="text-center text-gray-500 text-sm py-6 border border-dashed border-gray-800 rounded-xl">
                      No messages yet. Say hello!
                    </div>
                  )}
                  {messages.map((msg) => (
                    <div key={msg.id} className="group flex gap-3">
                      <img
                        src={msg.user.avatar}
                        alt={msg.user.name}
                        className="w-8 h-8 rounded-lg mt-1 border border-gray-700"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-0.5">
                          <span className={`text-xs font-bold ${msg.user.name === 'ZEUS' ? 'text-green-400' : 'text-gray-300'} hover:underline cursor-pointer`}>
                            {msg.user.name}
                          </span>
                          <span className="text-[10px] text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity">
                            {msg.timestamp}
                          </span>
                        </div>
                        <div className={`p-2 rounded-r-lg rounded-bl-lg text-sm font-medium leading-snug break-words ${msg.isSystem ? 'bg-amber-500/10 text-amber-100 border border-amber-500/30' : 'bg-[#1a202c] text-gray-300'}`}>
                          {msg.message.split(' ').map((word, i) =>
                            word.startsWith('@') ? <span key={i} className="text-brand-purple cursor-pointer hover:underline">{word} </span> : word + ' '
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-4 border-t border-gray-800 bg-[#111621]">
                <div className="relative">
                  <Input
                    type="text"
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    placeholder={isChatDisabled ? 'Chat disabled' : isAuthenticated ? 'Your message' : 'Log in to chat'}
                    className="pl-4 pr-10 py-3 text-sm"
                    onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                    disabled={isChatDisabled}
                  />
                  <button 
                    onClick={handleSend} 
                    disabled={isChatDisabled || isSending}
                    className="absolute right-2 top-2 p-1.5 bg-brand-purple rounded-md text-white hover:bg-purple-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
                {notice && (
                  <div className="mt-3 p-3 rounded-lg border border-amber-500/30 bg-amber-500/10 text-xs text-amber-100 flex items-center gap-2">
                    <Shield className="w-4 h-4" /> {notice}
                  </div>
                )}
                {!isChatDisabled && isAuthenticated && warningsRemaining < 3 && (
                  <div className="mt-2 text-[11px] text-gray-500">
                    Warnings remaining before chat lock: <span className="text-white font-semibold">{warningsRemaining}</span>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 min-h-0">
              <AIChatBot isOpen variant="sidebar" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
