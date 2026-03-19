import React, { useEffect, useState } from 'react';
import { getIdTokenResult, onAuthStateChanged } from 'firebase/auth';
import { auth } from '../firebase';

type AdminGateProps = {
  children: React.ReactNode;
  fallback?: React.ReactNode;
};

export const AdminGate: React.FC<AdminGateProps> = ({ children, fallback = null }) => {
  const [isAdmin, setIsAdmin] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        setIsAdmin(false);
        setIsChecking(false);
        return;
      }

      const tokenResult = await getIdTokenResult(firebaseUser);
      // Admin is claim-only; never trust Firestore profile fields for authorization.
      setIsAdmin(tokenResult.claims.admin === true);
      setIsChecking(false);
    });

    return () => unsubscribe();
  }, []);

  if (isChecking) return null;
  return <>{isAdmin ? children : fallback}</>;
};

export default AdminGate;
