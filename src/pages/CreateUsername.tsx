import React, { useState } from 'react';
import { doc, runTransaction, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';

type Props = {
  onComplete?: () => void;
};

const USERNAME_REGEX = /^[a-z0-9_]{3,16}$/;

export const CreateUsername: React.FC<Props> = ({ onComplete }) => {
  const [username, setUsername] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const user = auth.currentUser;
    if (!user) {
      setError('Please sign in first.');
      return;
    }

    const trimmed = username.trim();
    const usernameLower = trimmed.toLowerCase();

    if (!USERNAME_REGEX.test(usernameLower)) {
      setError('Username must be 3-16 characters using a-z, 0-9, or underscore.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const userRef = doc(db, 'users', user.uid);
      const usernameRef = doc(db, 'usernames', usernameLower);

      await runTransaction(db, async (tx) => {
        const existingUsername = await tx.get(usernameRef);
        if (existingUsername.exists() && existingUsername.data().uid !== user.uid) {
          throw new Error('Username taken');
        }

        if (!existingUsername.exists()) {
          tx.set(usernameRef, { uid: user.uid, createdAt: serverTimestamp() });
        }

        tx.set(
          userRef,
          {
            uid: user.uid,
            email: auth.currentUser?.email || '',
            username: trimmed,
            usernameLower,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          },
          { merge: true }
        );
      });

      if (onComplete) {
        onComplete();
        return;
      }

      window.history.replaceState({}, '', '/');
      window.location.reload();
    } catch (err: any) {
      if (err?.code === 'permission-denied') {
        setError('Permission denied while saving username. Please sign in again and retry.');
      } else if (err?.message === 'Username taken') {
        setError('That username is already taken. Try another one.');
      } else {
        setError('Unable to save username right now. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050811] px-4 py-10 text-white sm:px-6">
      <div className="mx-auto w-full max-w-md rounded-2xl border border-fuchsia-500/20 bg-[#131720] p-5 shadow-[0_20px_60px_-30px_rgba(217,70,239,0.6)] sm:p-7">
        <h1 className="text-xl font-black sm:text-2xl">Choose your username</h1>
        <p className="mt-2 text-sm text-gray-400">This is shown publicly and can only be claimed once.</p>

        <form onSubmit={handleSubmit} className="mt-5 space-y-3">
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="your_name"
            className="w-full rounded-lg border border-white/10 bg-[#0f1420] px-3 py-2.5 text-sm text-white outline-none ring-fuchsia-400/50 focus:ring"
            autoComplete="off"
          />
          {error && <p className="text-sm text-red-300">{error}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-fuchsia-500 px-4 py-2.5 text-sm font-semibold text-black transition hover:bg-fuchsia-400 disabled:opacity-50"
          >
            {submitting ? 'Saving...' : 'Claim username'}
          </button>
        </form>
      </div>
    </div>
  );
};
