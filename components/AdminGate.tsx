import React from 'react';
import { ShieldAlert } from 'lucide-react';
import { useAuth, useGame } from '../context/GameContext';

type AdminGateProps = {
  children: React.ReactNode;
  fallback?: React.ReactNode;
};

const DefaultAdminFallback = () => {
  const { setView } = useGame();

  return (
    <div className="w-full min-h-[60vh] flex flex-col items-center justify-center px-4 text-center">
      <div className="max-w-md rounded-2xl border border-red-500/30 bg-red-500/10 p-6 sm:p-8">
        <ShieldAlert className="mx-auto mb-4 h-16 w-16 text-red-500" />
        <h2 className="mb-2 text-2xl font-bold text-white">Access Denied</h2>
        <p className="mb-6 text-sm text-gray-400">
          This area is restricted to authorized personnel only.
          Verification via Firebase custom claims failed.
        </p>
        <button
          onClick={() => setView({ type: 'HOME' })}
          className="rounded-lg border border-gray-700 bg-gray-800 px-8 py-3 font-bold text-white transition-colors hover:bg-gray-700"
        >
          Return Home
        </button>
      </div>
    </div>
  );
};

export const AdminGate: React.FC<AdminGateProps> = ({ children, fallback }) => {
  const { authInitialized, isAuthenticated, user } = useAuth();

  if (!authInitialized) {
    return null;
  }

  if (!isAuthenticated || user.isAdmin !== true) {
    return <>{fallback ?? <DefaultAdminFallback />}</>;
  }

  return <>{children}</>;
};

export default AdminGate;
