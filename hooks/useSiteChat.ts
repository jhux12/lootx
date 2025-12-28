import { useEffect, useMemo, useState } from 'react';
import { GoogleGenAI } from '@google/genai';
import { addDoc, collection, deleteDoc, getDocs, onSnapshot, orderBy, query, serverTimestamp, Timestamp, where } from 'firebase/firestore';
import { db } from '../firebase';
import { ChatMessage, User } from '../types';
import { useGame } from '../context/GameContext';

const FALLBACK_GEMINI_API_KEY = "AIzaSyDHNb6DFcV_72EC2jYlk-F0quunMem9s10";
const CHAT_EXPIRATION_MS = 20 * 60 * 1000;

type ModerationResult = {
  safe: boolean;
  reason?: string;
  sanitizedText: string;
};

type LiveChatMessage = ChatMessage & { createdAt: number };

const PROFANITY_PATTERNS = [
  /fuck/gi,
  /shit/gi,
  /bitch/gi,
  /asshole/gi,
  /bastard/gi,
  /cunt/gi,
  /dick/gi,
  /piss/gi,
  /slut/gi,
  /whore/gi
];

const maskMatch = (match: string) => '*'.repeat(match.length);

const sanitizeProfanity = (message: string) => {
  let found = false;
  let sanitized = message;

  PROFANITY_PATTERNS.forEach((pattern) => {
    sanitized = sanitized.replace(pattern, (match) => {
      found = true;
      return maskMatch(match);
    });
  });

  return { found, sanitizedText: sanitized };
};

const formatRelativeTime = (createdAt: number, now: number) => {
  const diffSeconds = Math.max(1, Math.floor((now - createdAt) / 1000));
  if (diffSeconds < 60) return `${diffSeconds}s ago`;
  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  return `${diffHours}h ago`;
};

const runModeration = async (message: string): Promise<ModerationResult> => {
  try {
    const localCheck = sanitizeProfanity(message);
    if (localCheck.found) {
      return {
        safe: false,
        reason: 'Contains profanity',
        sanitizedText: localCheck.sanitizedText
      };
    }

    const apiKey = import.meta.env.VITE_GEMINI_API_KEY || FALLBACK_GEMINI_API_KEY;
    const genAI = new GoogleGenAI({ apiKey });
    const model = genAI.models.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const response = await model.generateContent({
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: `You are a safety filter that only returns JSON. 
- If the message is acceptable, respond with {"safe":true,"sanitizedText":"original message"}.
- If the message contains profanity, hate speech, harassment, sexual content, violence, self-harm, spam, scams, or unsafe content, respond with {"safe":false,"reason":"brief reason","sanitizedText":"message with unsafe words replaced by asterisks"}.
- Always include the sanitizedText field. Do not add commentary or additional keys.
Message: """${message}"""`
            }
          ]
        }
      ],
      generationConfig: {
        responseMimeType: 'application/json'
      }
    });

    const raw = response.response?.text() ?? '{}';
    const parsed = JSON.parse(raw) as Partial<ModerationResult>;
    return {
      safe: parsed.safe !== false,
      reason: parsed.reason,
      sanitizedText: parsed.sanitizedText?.trim() || message
    };
  } catch (error) {
    console.error('Gemini moderation failed, allowing message by default', error);
    const fallback = sanitizeProfanity(message);
    if (fallback.found) {
      return {
        safe: false,
        reason: 'Contains profanity',
        sanitizedText: fallback.sanitizedText
      };
    }

    return { safe: true, sanitizedText: message };
  }
};

export const useSiteChat = () => {
  const { user, isAuthenticated, setShowLoginModal, updateUserFlags } = useGame();
  const [rawMessages, setRawMessages] = useState<LiveChatMessage[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const messagesRef = collection(db, 'chatMessages');
    const subscription = onSnapshot(query(messagesRef, orderBy('createdAt', 'asc')), (snapshot) => {
      const formatted: LiveChatMessage[] = snapshot.docs.map((docSnap) => {
        const data = docSnap.data() as {
          user?: User;
          message?: string;
          createdAt?: Timestamp;
        };

        const createdAt = data.createdAt?.toMillis() ?? Date.now();
        const author = data.user ?? {
          id: 'unknown',
          name: 'Player',
          avatar: 'https://ui-avatars.com/api/?name=Player&background=111827&color=10b981',
          level: 0,
          xp: 0
        };

        return {
          id: docSnap.id,
          user: author,
          message: data.message ?? '',
          createdAt,
          timestamp: '',
          isSystem: author.id === 'system'
        };
      });

      setRawMessages(formatted);
    });

    return () => subscription();
  }, []);

  const visibleMessages = useMemo(() => {
    return rawMessages
      .filter((msg) => now - msg.createdAt <= CHAT_EXPIRATION_MS)
      .map((msg) => ({
        ...msg,
        timestamp: formatRelativeTime(msg.createdAt, now)
      }));
  }, [rawMessages, now]);

  const purgeExpiredMessages = async () => {
    try {
      const cutoff = Timestamp.fromMillis(Date.now() - CHAT_EXPIRATION_MS);
      const expiredQuery = query(
        collection(db, 'chatMessages'),
        where('createdAt', '<=', cutoff)
      );
      const expired = await getDocs(expiredQuery);
      await Promise.all(expired.docs.map((docSnap) => deleteDoc(docSnap.ref)));
    } catch (error) {
      console.error('Failed to purge expired chat messages', error);
    }
  };

  const sendMessage = async (messageText: string) => {
    const trimmed = messageText.trim();
    if (!trimmed) return;

    if (!isAuthenticated) {
      setShowLoginModal(true);
      return;
    }

    if (user.chatDisabled) {
      setNotice('Your chat privileges are disabled due to repeated policy violations.');
      return;
    }

    setIsSending(true);
    setNotice(null);

    try {
      const moderation = await runModeration(trimmed);
      const censoredMessage = moderation.sanitizedText?.trim() || trimmed;

      if (!censoredMessage) {
        setNotice('Message removed due to safety filters.');
        return;
      }

      if (!moderation.safe) {
        const currentWarnings = user.chatWarnings ?? 0;
        const nextWarnings = Math.min(currentWarnings + 1, 3);
        const shouldDisable = nextWarnings >= 3;

        await updateUserFlags({
          chatWarnings: nextWarnings,
          chatDisabled: shouldDisable,
          chatDisabledAt: shouldDisable ? Date.now() : user.chatDisabledAt,
          termsFlagged: true
        });

        setNotice(
          shouldDisable
            ? 'Your chat access has been disabled after multiple violations.'
            : `Warning ${nextWarnings}/3: ${moderation.reason || 'Message violates chat guidelines.'}`
        );

        if (shouldDisable) {
          return;
        }
      }

      await addDoc(collection(db, 'chatMessages'), {
        user: {
          id: user.id,
          name: user.name,
          avatar: user.avatar,
          level: user.level,
          xp: user.xp
        },
        message: censoredMessage,
        createdAt: serverTimestamp()
      });

      await purgeExpiredMessages();
    } catch (error) {
      console.error('Failed to send chat message', error);
      setNotice('Unable to send message right now. Please try again.');
    } finally {
      setIsSending(false);
    }
  };

  const warningsRemaining = Math.max(0, 3 - (user.chatWarnings ?? 0));

  return {
    messages: visibleMessages,
    notice,
    isSending,
    sendMessage,
    isChatDisabled: user.chatDisabled ?? false,
    warningsRemaining
  };
};
