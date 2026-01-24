import React, { useState, useEffect, useRef } from 'react';
import { MessageSquare, Users, Globe, Send, Bot, Shield } from 'lucide-react';
import { useSound } from '../context/SoundContext';
import { AIChatBot } from './AIChatBot';
import { useSiteChat } from '../hooks/useSiteChat';
import { useGame } from '../context/GameContext';
import { FreeRainBanner } from './FreeRainBanner';

export const ChatSidebar: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'chat' | 'support' | 'users'>('chat');
  const [messageText, setMessageText] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const { playSound } = useSound();
  const { isAuthenticated, setView } = useGame();
  const { messages, sendMessage, isSending, notice, isChatDisabled, warningsRemaining } = useSiteChat();

  // Auto scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length]);

  const handleSend = async () => {
    if (!messageText.trim() || isSending) return;
    playSound('click');
    await sendMessage(messageText);
    setMessageText('');
  };

  const openProfile = (userId: string) => {
    playSound('click');
    setView({ type: 'PROFILE', userId });
  };

  const TabButton: React.FC<{ id: 'chat' | 'support' | 'users'; icon: React.ReactNode; label: string }> = ({ id, icon, label }) => (
    <button
      onClick={() => { setActiveTab(id); playSound('click'); }}
      className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-bold uppercase tracking-wide border-b-2 transition-colors ${activeTab === id ? 'text-white border-brand-purple' : 'text-gray-500 border-transparent hover:text-gray-300'}`}
    >
      {icon}
      {label}
    </button>
  );

  return (
    <div className="w-80 bg-[#11141d] border-l border-gray-800 flex flex-col h-[calc(100vh-64px)] fixed right-0 top-16 hidden xl:flex z-40">
      
      {/* Sidebar Header */}
      <div className="p-4 border-b border-gray-800 flex items-center justify-between">
        <div className="flex items-center gap-2 text-gray-300 font-bold text-sm cursor-pointer hover:text-white" onClick={() => playSound('click')}>
          <Globe className="w-4 h-4" />
          <span>English</span>
        </div>
        <div className="flex gap-2 text-gray-500">
           <div className="h-2 w-2 rounded-full bg-green-500 mt-1.5"></div>
           <span className="text-xs font-mono">1,420 Online</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="grid grid-cols-3 bg-[#0c1019] border-b border-gray-800">
        <TabButton id="chat" icon={<MessageSquare className="w-3 h-3" />} label="Chat" />
        <TabButton id="support" icon={<Bot className="w-3 h-3" />} label="Support" />
        <TabButton id="users" icon={<Users className="w-3 h-3" />} label="Users" />
      </div>

      {activeTab === 'chat' && (
        <>
          {/* Rain Promotion */}
          <FreeRainBanner />

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto scrollbar-thin p-4 space-y-4" ref={scrollRef}>
            {messages.length === 0 && (
              <div className="text-center text-gray-500 text-sm py-6 border border-dashed border-gray-800 rounded-xl">
                No messages yet. Start the conversation!
              </div>
            )}
            {messages.map((msg) => (
              <div key={msg.id} className="group flex gap-3">
                <img 
                    src={msg.user.avatar} 
                    alt={msg.user.name} 
                    className="w-8 h-8 rounded-lg mt-1 border border-gray-700 cursor-pointer" 
                    onClick={() => openProfile(msg.user.id)}
                />
                <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                        <button 
                            onClick={() => openProfile(msg.user.id)}
                            className={`text-xs font-bold ${msg.user.name === 'ZEUS' ? 'text-green-400' : 'text-gray-300'} hover:underline cursor-pointer`}
                        >
                            {msg.user.name}
                        </button>
                        <span className="text-[10px] text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity">
                            {msg.timestamp}
                        </span>
                    </div>
                    <div className={`p-2 rounded-r-lg rounded-bl-lg text-sm font-medium leading-snug break-words ${msg.isSystem ? 'bg-amber-500/10 text-amber-200 border border-amber-500/30' : 'bg-[#1a202c] text-gray-300'}`}>
                       {msg.message.split(' ').map((word, i) => 
                          word.startsWith('@') ? <span key={i} className="text-brand-purple cursor-pointer hover:underline">{word} </span> : word + ' '
                       )}
                    </div>
                </div>
              </div>
            ))}
          </div>

          {/* Chat Input */}
          <div className="p-4 bg-[#11141d] border-t border-gray-800">
            <div className="relative">
                <input 
                    type="text" 
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    placeholder={isChatDisabled ? 'Chat disabled' : isAuthenticated ? 'Your message' : 'Log in to chat'} 
                    className="w-full bg-[#0b0e14] border border-gray-700 text-gray-200 text-sm rounded-lg pl-4 pr-10 py-3 focus:outline-none focus:border-brand-purple transition-colors"
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
            <div className="flex items-center gap-4 mt-3 text-xs font-bold text-gray-500">
                <button className="flex items-center gap-1 hover:text-gray-300 transition-colors" onClick={() => playSound('click')}>
                    <Users className="w-3 h-3" /> Rules
                </button>
                <button className="flex items-center gap-1 hover:text-gray-300 transition-colors" onClick={() => playSound('click')}>
                    <MessageSquare className="w-3 h-3" /> Emojis
                </button>
            </div>
          </div>
        </>
      )}

      {activeTab === 'support' && (
        <div className="flex-1 min-h-0 p-4">
          <AIChatBot isOpen variant="sidebar" />
        </div>
      )}

      {activeTab === 'users' && (
        <div className="flex-1 flex flex-col items-center justify-center text-gray-500 text-sm px-6 text-center">
          <Users className="w-6 h-6 mb-2" />
          <p>View online users and their recent wins coming soon.</p>
        </div>
      )}
    </div>
  );
};
