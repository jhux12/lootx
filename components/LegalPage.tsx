import React from 'react';
import { useGame } from '../context/GameContext';
import { ManagedFooterContent } from './FooterManagedContent';

type LegalKey = 'terms' | 'privacy';

type LegalPageProps = {
  variant: LegalKey;
};

export const LegalPage: React.FC<LegalPageProps> = ({ variant }) => {
  const { setView } = useGame();

  return (
    <ManagedFooterContent pageKey={variant}>
      <button
        type="button"
        onClick={() => setView({ type: 'CONTACT' })}
        className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-gray-200 transition hover:border-blue-400/40 hover:text-white"
      >
        Contact Support
      </button>
    </ManagedFooterContent>
  );
};
