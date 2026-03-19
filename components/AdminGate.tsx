import React, { useEffect, useState } from 'react';
import { ShieldAlert } from 'lucide-react';
import { auth } from '../firebase';

type AdminGateProps = {
  children: React.ReactNode;
  fallback?: React.ReactNode;
};

const DefaultFallback = () => (
  <div className="w-full h-[60vh] flex flex-col items-center justify-center text-center p-4">
    <div className="bg-red-500/10 p-8 rounded-2xl border border-red-500/30 max-w-md animate-in zoom-in-95">
      <ShieldAlert className="w-16 h-16 text-red-500 mx-auto mb-4" />
      <h2 className="text-2xl font-bold text-white mb-2">Access Denied</h2>
      <p className="text-gray-400 text-sm mb-6">
        This area is restricted to authorized personnel only.
        Verification via Admin SDK failed.
      </p>
    </div>
  </div>
);

export const AdminGate: React.FC<AdminGateProps> = ({ children, fallback }) => {
  const [isAllowed, setIsAllowed] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const checkAdminClaim = async () => {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        if (!cancelled) {
          setIsAllowed(false);
          setIsChecking(false);
        }
        return;
      }

      try {
        const tokenResult = await currentUser.getIdTokenResult(true);
        // Admin is claim-only. Never trust Firestore profile fields for authorization.
        const isAdmin = tokenResult.claims.admin === true;
        if (!cancelled) {
          setIsAllowed(isAdmin);
        }
      } catch (error) {
        console.error('Failed to verify admin claim', error);
        if (!cancelled) {
          setIsAllowed(false);
        }
      } finally {
        if (!cancelled) {
          setIsChecking(false);
        }
      }
    };

    void checkAdminClaim();

    return () => {
      cancelled = true;
    };
  }, []);

  if (isChecking) {
    return null;
  }

  if (!isAllowed) {
    return <>{fallback ?? <DefaultFallback />}</>;
  }

  return <>{children}</>;
};
