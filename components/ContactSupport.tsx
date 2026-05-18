import React, { useEffect, useState } from 'react';
import {
  addDoc,
  arrayUnion,
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  Timestamp
} from 'firebase/firestore';
import { auth, db } from '../firebase';
import { useGame } from '../context/GameContext';

type SupportMessage = {
  sender: 'user' | 'admin';
  text: string;
  timestamp?: Timestamp;
};

type SupportCase = {
  id: string;
  uid: string;
  email: string;
  subject: string;
  status: 'Open' | 'Closed' | string;
  createdAt?: Timestamp;
  lastUpdatedAt?: Timestamp;
  messages?: SupportMessage[];
};

const escapeText = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const toSafeHtml = (value: string) => escapeText(value).replace(/\n/g, '<br />');

const formatTimestamp = (timestamp?: Timestamp) => {
  if (!timestamp) return 'Just now';
  return timestamp.toDate().toLocaleString();
};

export const ContactSupport: React.FC = () => {
  const { isAuthenticated, openAuthModal } = useGame();
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [supportCases, setSupportCases] = useState<SupportCase[]>([]);
  const [expandedCases, setExpandedCases] = useState<Set<string>>(new Set());
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [replyStatus, setReplyStatus] = useState<Record<string, { sending: boolean; error?: string; success?: string }>>(
    {}
  );

  const currentUser = auth.currentUser;
  const userEmail = currentUser?.email ?? '';

  useEffect(() => {
    if (!currentUser) {
      setSupportCases([]);
      return undefined;
    }

    const supportQuery = query(
      collection(db, 'supportCases'),
      where('uid', '==', currentUser.uid)
    );

    const pathLabel = 'supportCases';
    console.log('READING FIRESTORE PATH', pathLabel);
    const unsubscribe = onSnapshot(supportQuery, (snapshot) => {
      console.log('SNAPSHOT OK', {
        path: pathLabel,
        size: 'size' in snapshot ? snapshot.size : undefined
      });
      const nextCases = snapshot.docs
        .map((docSnapshot) => {
          const data = docSnapshot.data() as Omit<SupportCase, 'id'>;
          return {
            id: docSnapshot.id,
            ...data
          };
        })
        .sort((a, b) => {
          const aTime = a.lastUpdatedAt?.toMillis() ?? a.createdAt?.toMillis() ?? 0;
          const bTime = b.lastUpdatedAt?.toMillis() ?? b.createdAt?.toMillis() ?? 0;
          return bTime - aTime;
        });
      setSupportCases(nextCases);
    }, (error) => {
      console.error('SNAPSHOT FAILED', {
        path: pathLabel,
        code: error?.code,
        message: error?.message,
        error
      });
    });

    return () => unsubscribe();
  }, [currentUser]);

  const handleToggleCase = (caseId: string) => {
    setExpandedCases((prev) => {
      const next = new Set(prev);
      if (next.has(caseId)) {
        next.delete(caseId);
      } else {
        next.add(caseId);
      }
      return next;
    });
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);
    setStatusMessage(null);

    if (!currentUser || !isAuthenticated) {
      setErrorMessage('Please sign in to submit a support request.');
      return;
    }

    const trimmedSubject = subject.trim();
    const trimmedMessage = message.trim();
    if (!trimmedSubject || !trimmedMessage) {
      setErrorMessage('Please include both a subject and a message.');
      return;
    }

    setIsSending(true);
    try {
      await addDoc(collection(db, 'supportCases'), {
        uid: currentUser.uid,
        email: currentUser.email ?? '',
        subject: trimmedSubject,
        status: 'Open',
        createdAt: serverTimestamp(),
        lastUpdatedAt: serverTimestamp(),
        messages: [
          {
            sender: 'user',
            text: trimmedMessage,
            timestamp: Timestamp.now()
          }
        ]
      });
      setSubject('');
      setMessage('');
      setStatusMessage('Your message has been sent. We will get back to you shortly.');
    } catch (error) {
      console.error('Failed to submit support request', error);
      setErrorMessage('Something went wrong while sending your message. Please try again.');
    } finally {
      setIsSending(false);
    }
  };

  const handleReplyChange = (caseId: string, value: string) => {
    setReplyDrafts((prev) => ({ ...prev, [caseId]: value }));
  };

  const handleReplySubmit = async (caseItem: SupportCase) => {
    const replyText = replyDrafts[caseItem.id]?.trim();
    if (!currentUser || !isAuthenticated) {
      setReplyStatus((prev) => ({
        ...prev,
        [caseItem.id]: { sending: false, error: 'Please sign in to reply to this thread.' }
      }));
      return;
    }
    if (!replyText) {
      setReplyStatus((prev) => ({
        ...prev,
        [caseItem.id]: { sending: false, error: 'Reply text cannot be empty.' }
      }));
      return;
    }

    setReplyStatus((prev) => ({
      ...prev,
      [caseItem.id]: { sending: true }
    }));

    try {
      await updateDoc(doc(db, 'supportCases', caseItem.id), {
        messages: arrayUnion({
          sender: 'user',
          text: replyText,
          timestamp: Timestamp.now()
        }),
        lastUpdatedAt: serverTimestamp()
      });
      setReplyDrafts((prev) => ({ ...prev, [caseItem.id]: '' }));
      setReplyStatus((prev) => ({
        ...prev,
        [caseItem.id]: { sending: false, success: 'Reply sent.' }
      }));
    } catch (error) {
      console.error('Failed to send reply', error);
      setReplyStatus((prev) => ({
        ...prev,
        [caseItem.id]: { sending: false, error: 'Unable to send reply. Please try again.' }
      }));
    }
  };

  return (
    <section className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 pb-16 pt-10 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold text-white sm:text-3xl">Contact Support</h1>
        <p className="text-sm text-gray-400 sm:text-base">
          Send us a message and track your support threads in one place.
        </p>
      </div>

      {!isAuthenticated && (
        <div className="rounded-2xl border border-blue-500/30 bg-blue-500/10 p-4 text-sm text-blue-100">
          <p className="mb-3">You must be signed in to submit support requests or reply to threads.</p>
          <button
            type="button"
            onClick={() => openAuthModal('login')}
            className="rounded-lg bg-blue-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-400"
          >
            Sign in to continue
          </button>
        </div>
      )}

      <div className="grid gap-8 lg:grid-cols-[1.1fr_1fr]">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5 sm:p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">New Message</h2>
            <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-gray-300">
              Support
            </span>
          </div>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wide text-gray-400">Email</label>
              <input
                type="email"
                value={userEmail}
                readOnly
                placeholder="Sign in to view email"
                className="w-full rounded-xl border border-white/10 bg-[#0b0f1a] px-4 py-3 text-sm text-gray-300 placeholder:text-gray-600"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wide text-gray-400">Subject</label>
              <input
                type="text"
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
                placeholder="Tell us what you need help with"
                className="w-full rounded-xl border border-white/10 bg-[#0b0f1a] px-4 py-3 text-sm text-white placeholder:text-gray-600"
                disabled={!isAuthenticated || isSending}
                maxLength={120}
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wide text-gray-400">Message</label>
              <textarea
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                placeholder="Share the details so we can assist faster."
                className="min-h-[140px] w-full resize-none rounded-xl border border-white/10 bg-[#0b0f1a] px-4 py-3 text-sm text-white placeholder:text-gray-600"
                disabled={!isAuthenticated || isSending}
                maxLength={1000}
              />
            </div>

            {errorMessage && <p className="text-sm text-red-400">{errorMessage}</p>}
            {statusMessage && <p className="text-sm text-green-400">{statusMessage}</p>}

            <button
              type="submit"
              disabled={!isAuthenticated || isSending}
              className="w-full rounded-xl bg-blue-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSending ? 'Sending...' : 'Send message'}
            </button>
          </form>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-5 sm:p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">Your Support Threads</h2>
            <span className="text-xs text-gray-400">{isAuthenticated ? `${supportCases.length} threads` : 'Sign in to view'}</span>
          </div>

          {!isAuthenticated && (
            <p className="text-sm text-gray-400">
              Sign in to view your past conversations and reply to existing threads.
            </p>
          )}

          {isAuthenticated && supportCases.length === 0 && (
            <p className="text-sm text-gray-400">No threads yet. Your new messages will appear here.</p>
          )}

          <div className="space-y-4">
            {supportCases.map((caseItem) => {
              const isExpanded = expandedCases.has(caseItem.id);
              const replyInfo = replyStatus[caseItem.id];
              const replyValue = replyDrafts[caseItem.id] ?? '';
              return (
                <div key={caseItem.id} className="rounded-xl border border-white/10 bg-[#0b0f1a]">
                  <button
                    type="button"
                    onClick={() => handleToggleCase(caseItem.id)}
                    className="flex w-full items-center justify-between gap-3 px-4 py-4 text-left sm:px-5"
                  >
                    <div>
                      <p
                        className="text-sm font-semibold text-white"
                        dangerouslySetInnerHTML={{ __html: escapeText(caseItem.subject ?? '') }}
                      />
                      <p className="text-xs text-gray-500">Last updated {formatTimestamp(caseItem.lastUpdatedAt)}</p>
                    </div>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${
                        caseItem.status === 'Closed'
                          ? 'bg-gray-500/20 text-gray-300'
                          : 'bg-green-500/20 text-green-300'
                      }`}
                    >
                      {caseItem.status || 'Open'}
                    </span>
                  </button>

                  {isExpanded && (
                    <div className="border-t border-white/10 px-4 py-4 sm:px-5">
                      <div className="space-y-3">
                        {(caseItem.messages ?? []).map((messageItem, index) => (
                          <div
                            key={`${caseItem.id}-${index}`}
                            className={`rounded-lg border border-white/10 px-3 py-2 text-xs sm:text-sm ${
                              messageItem.sender === 'admin'
                                ? 'bg-blue-500/10 text-blue-100'
                                : 'bg-white/5 text-gray-200'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-3 text-[11px] text-gray-400">
                              <span className="uppercase">{messageItem.sender === 'admin' ? 'Support' : 'You'}</span>
                              <span>{formatTimestamp(messageItem.timestamp)}</span>
                            </div>
                            <p
                              className="mt-2"
                              dangerouslySetInnerHTML={{ __html: toSafeHtml(messageItem.text ?? '') }}
                            />
                          </div>
                        ))}
                      </div>

                      <div className="mt-4 space-y-2">
                        <label className="text-xs font-semibold uppercase tracking-wide text-gray-400">Reply</label>
                        <textarea
                          value={replyValue}
                          onChange={(event) => handleReplyChange(caseItem.id, event.target.value)}
                          placeholder="Add a reply..."
                          className="min-h-[100px] w-full resize-none rounded-xl border border-white/10 bg-[#0b0f1a] px-4 py-3 text-sm text-white placeholder:text-gray-600"
                          disabled={!isAuthenticated || replyInfo?.sending}
                          maxLength={1000}
                        />
                        {replyInfo?.error && <p className="text-xs text-red-400">{replyInfo.error}</p>}
                        {replyInfo?.success && <p className="text-xs text-green-400">{replyInfo.success}</p>}
                        <button
                          type="button"
                          onClick={() => handleReplySubmit(caseItem)}
                          disabled={!isAuthenticated || replyInfo?.sending}
                          className="w-full rounded-xl bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {replyInfo?.sending ? 'Sending...' : 'Send reply'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
};
