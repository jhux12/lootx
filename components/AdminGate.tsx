import React, { useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { ShieldAlert } from 'lucide-react';
import { auth } from '../firebase';

type Props = {
  children: React.ReactNode;
  onDeniedHome?: () => void;
};

export const AdminGate: React.FC<Props> = ({ children, onDeniedHome }) => {
  const [state, setState] = useState<{ loading: boolean; allowed: boolean; signedIn: boolean }>({
    loading: true,
    allowed: false,
    signedIn: false
  });

  useEffect(() => {
    const checkClaims = async (user: User | null) => {
      if (!user) {
        setState({ loading: false, allowed: false, signedIn: false });
        return;
      }

      try {
        const token = await user.getIdTokenResult(true);
        setState({ loading: false, allowed: token.claims.admin === true, signedIn: true });
      } catch {
        setState({ loading: false, allowed: false, signedIn: true });
      }
    };

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setState((prev) => ({ ...prev, loading: true }));
      void checkClaims(user);
    });

    return () => unsubscribe();
  }, []);

  if (state.loading) {
    return <div className="w-full p-6 text-center text-sm text-gray-300">Checking admin access...</div>;
  }

  if (state.allowed) {
    return <>{children}</>;
  }

  return (
    <div className="w-full min-h-[60vh] flex flex-col items-center justify-center text-center p-4">
      <div className="w-full max-w-md rounded-2xl border border-red-500/30 bg-red-500/10 p-6 sm:p-8">
        <ShieldAlert className="mx-auto mb-4 h-14 w-14 text-red-500" />
        <h2 className="mb-2 text-2xl font-bold text-white">Access Denied</h2>
        <p className="mb-6 text-sm text-gray-300">
          {state.signedIn
            ? 'Your account is signed in, but the live token does not include admin:true yet.'
            : 'Please sign in with an authorized admin account to continue.'}
        </p>
        <button
          type="button"
          onClick={onDeniedHome}
          className="rounded-lg border border-gray-700 bg-gray-800 px-6 py-2.5 text-sm font-bold text-white transition hover:bg-gray-700"
        >
          Return Home
        </button>
      </div>
    </div>
  );
};
