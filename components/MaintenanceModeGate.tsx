import React, { useEffect, useState } from 'react';
import { Wrench } from 'lucide-react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { useGame } from '../context/GameContext';

const MaintenanceScreen = () => (
  <main className="relative grid min-h-[100dvh] place-items-center overflow-hidden bg-[#07090d] px-5 text-white">
    <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,rgba(239,68,68,0.13),transparent_42%)]" />
    <section className="relative w-full max-w-lg text-center" role="status" aria-live="polite">
      <div className="mx-auto mb-7 grid h-16 w-16 place-items-center rounded-2xl border border-red-400/20 bg-red-500/10 shadow-[0_20px_70px_rgba(239,68,68,0.12)]">
        <Wrench className="h-7 w-7 text-red-300" aria-hidden="true" />
      </div>
      <p className="mb-3 text-xs font-black uppercase tracking-[0.32em] text-red-300">Ripza</p>
      <h1 className="text-3xl font-black tracking-tight sm:text-5xl">Site under maintenance</h1>
      <p className="mx-auto mt-5 max-w-md text-sm leading-6 text-slate-400 sm:text-base">
        We’re making a few improvements. Please check back soon.
      </p>
      <div className="mx-auto mt-8 h-px w-24 bg-gradient-to-r from-transparent via-red-400/60 to-transparent" />
    </section>
  </main>
);

export const MaintenanceModeGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { view, authInitialized, user } = useGame();
  const [maintenanceEnabled, setMaintenanceEnabled] = useState<boolean | null>(null);

  useEffect(() => onSnapshot(
    doc(db, 'site', 'maintenance'),
    (snapshot) => setMaintenanceEnabled(snapshot.exists() && snapshot.data()?.enabled === true),
    (error) => {
      console.error('Maintenance status could not be loaded', error);
      // Fail open so a temporary status-read failure cannot lock administrators out.
      setMaintenanceEnabled(false);
    }
  ), []);

  if (maintenanceEnabled === null) {
    return <div className="min-h-[100dvh] bg-[#07090d]" aria-busy="true" aria-label="Loading site status" />;
  }

  const isAdminView = view.type === 'ADMIN'
    || view.type === 'ADMIN_UPGRADER_SETTINGS'
    || view.type === 'ADMIN_UPGRADER_TARGETS';
  const canAccessAdmin = isAdminView && authInitialized && user.isAdmin === true;

  if (maintenanceEnabled && !canAccessAdmin) return <MaintenanceScreen />;
  return <>{children}</>;
};

export default MaintenanceModeGate;
