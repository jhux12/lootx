import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Bell, MessageSquare, Send, Shield, ShieldCheck, Truck, X } from 'lucide-react';
import { useSound } from '../context/SoundContext';
import { useSiteChat } from '../hooks/useSiteChat';
import { useGame } from '../context/GameContext';
import { FreeRainBanner } from './FreeRainBanner';
import { Input } from './ui/Input';
import { useNotifications, type UserNotification } from '../hooks/useNotifications';

export type InboxTab = 'messages' | 'notifications';

interface InboxModalProps {
  isOpen: boolean;
  onClose: () => void;
  hasUnseenMessages: boolean;
  unreadChatCount?: number;
  onChatViewed: () => void;
}

const formatRelativeTime = (notification: UserNotification) => {
  const createdMs = notification.createdAt?.toMillis();
  if (!createdMs) return 'Just now';
  const diffSeconds = Math.max(1, Math.floor((Date.now() - createdMs) / 1000));
  if (diffSeconds < 60) return `${diffSeconds}s ago`;
  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
};

const getNotificationIcon = (type: string) => {
  if (type === 'shipping') return Truck;
  if (type === 'admin') return ShieldCheck;
  return Bell;
};

export const InboxModal: React.FC<InboxModalProps> = ({
  isOpen,
  onClose,
  hasUnseenMessages,
  unreadChatCount,
  onChatViewed
}) => {
  const [activeTab, setActiveTab] = useState<InboxTab>('messages');
  const [lastOpenedTab, setLastOpenedTab] = useState<InboxTab>('messages');
  const [messageText, setMessageText] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const { playSound } = useSound();
  const { isAuthenticated, user } = useGame();
  const { messages, sendMessage, isSending, notice, isChatDisabled, warningsRemaining } = useSiteChat();
  const { notifications, unreadCount, isMarkingAllRead, markAllRead, markRead, markVisibleAsSeen } = useNotifications(
    isAuthenticated ? user.id : null
  );

  const resolvedUnreadChatCount = useMemo(() => {
    if (typeof unreadChatCount === 'number') return unreadChatCount;
    // TODO: replace fallback once server-backed chat unread counts are available.
    return hasUnseenMessages ? 1 : 0;
  }, [hasUnseenMessages, unreadChatCount]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [activeTab, messages.length]);

  useEffect(() => {
    if (!isOpen) return;
    const preferred = unreadCount > 0 ? 'notifications' : lastOpenedTab;
    setActiveTab(preferred);
  }, [isOpen, lastOpenedTab, unreadCount]);

  useEffect(() => {
    if (activeTab === 'notifications' && isOpen) {
      void markVisibleAsSeen();
    }
  }, [activeTab, isOpen, markVisibleAsSeen]);

  useEffect(() => {
    if (!isOpen || activeTab !== 'messages' || messages.length === 0) return;
    onChatViewed();
  }, [isOpen, activeTab, messages.length, onChatViewed]);

  const handleSend = async () => {
    if (!messageText.trim() || isSending) return;
    playSound('click');
    await sendMessage(messageText);
    setMessageText('');
  };

  const handleNotificationClick = async (notification: UserNotification) => {
    playSound('click');
    await markRead(notification.id);
    if (notification.link) {
      onClose();
      window.history.pushState({}, '', notification.link);
      window.dispatchEvent(new PopStateEvent('popstate'));
      return;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-end sm:items-center justify-center p-2 sm:p-4 pb-[calc(0.5rem+env(safe-area-inset-bottom))] sm:pb-[calc(1rem+env(safe-area-inset-bottom))]">
      <div className="w-full max-w-[420px] bg-[#0b0e14] border border-gray-800 rounded-2xl shadow-2xl overflow-hidden h-[calc(100dvh-1rem)] sm:h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800 bg-[#111621]">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-brand-purple" />
            <span className="text-sm font-bold text-white">Inbox</span>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white transition-colors"
            aria-label="Close inbox"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-2 border-b border-gray-800">
          <button
            onClick={() => {
              setActiveTab('messages');
              setLastOpenedTab('messages');
              playSound('click');
            }}
            className={`relative flex items-center justify-center gap-2 py-2 text-sm font-semibold transition-colors ${
              activeTab === 'messages' ? 'text-white border-b-2 border-brand-purple' : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            <MessageSquare className="w-4 h-4" /> Messages
            {resolvedUnreadChatCount > 0 && (
              <span className="absolute right-4 top-2 h-2 w-2 rounded-full bg-brand-purple shadow-[0_0_8px_rgba(124,58,237,0.9)]" />
            )}
          </button>
          <button
            onClick={() => {
              setActiveTab('notifications');
              setLastOpenedTab('notifications');
              playSound('click');
            }}
            className={`relative flex items-center justify-center gap-2 py-2 text-sm font-semibold transition-colors ${
              activeTab === 'notifications'
                ? 'text-white border-b-2 border-cyan-400'
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            <Bell className="w-4 h-4" /> Notifications
            {unreadCount > 0 && <span className="absolute right-4 top-2 h-2 w-2 rounded-full bg-cyan-400" />}
          </button>
        </div>

        <div className="flex-1 flex flex-col bg-[#0f1219] min-h-0">
          {activeTab === 'messages' ? (
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
                          <span
                            className={`text-xs font-bold ${
                              msg.user.name === 'ZEUS' ? 'text-green-400' : 'text-gray-300'
                            } hover:underline cursor-pointer`}
                          >
                            {msg.user.name}
                          </span>
                          <span className="text-[10px] text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity">
                            {msg.timestamp}
                          </span>
                        </div>
                        <div
                          className={`p-2 rounded-r-lg rounded-bl-lg text-sm font-medium leading-snug break-words ${
                            msg.isSystem
                              ? 'bg-amber-500/10 text-amber-100 border border-amber-500/30'
                              : 'bg-[#1a202c] text-gray-300'
                          }`}
                        >
                          {msg.message.split(' ').map((word, i) =>
                            word.startsWith('@') ? (
                              <span key={`${msg.id}-${i}`} className="text-brand-purple cursor-pointer hover:underline">
                                {word}{' '}
                              </span>
                            ) : (
                              `${word} `
                            )
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
            <div className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-4">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-white">Notifications</h3>
                <button
                  onClick={() => void markAllRead()}
                  disabled={unreadCount === 0 || isMarkingAllRead}
                  className="text-xs text-cyan-300 hover:text-cyan-200 disabled:opacity-40"
                >
                  {isMarkingAllRead ? 'Marking…' : 'Mark all as read'}
                </button>
              </div>

              {notifications.length === 0 ? (
                <div className="px-4 py-10 text-center text-sm text-gray-500 border border-dashed border-gray-800 rounded-xl">
                  You are all caught up.
                </div>
              ) : (
                <div className="space-y-2">
                  {notifications.map((notification) => {
                    const Icon = getNotificationIcon(notification.type);
                    const isUnread = !notification.readAt;
                    return (
                      <button
                        key={notification.id}
                        onClick={() => void handleNotificationClick(notification)}
                        className={`w-full rounded-xl border px-3 py-3 text-left transition-colors ${
                          isUnread
                            ? 'border-cyan-400/30 bg-cyan-400/5 hover:bg-cyan-400/10'
                            : 'border-gray-800 bg-[#121722] hover:bg-[#1a2030]'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5 rounded-lg border border-gray-700 p-1.5 text-cyan-300">
                            <Icon className="h-4 w-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-3">
                              <p className={`text-sm font-semibold ${isUnread ? 'text-white' : 'text-gray-200'}`}>
                                {notification.title}
                              </p>
                              <span className="shrink-0 text-[11px] text-gray-500">{formatRelativeTime(notification)}</span>
                            </div>
                            <p className="mt-1 text-xs text-gray-400 line-clamp-2">{notification.body}</p>
                          </div>
                          {isUnread && <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-cyan-400" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
