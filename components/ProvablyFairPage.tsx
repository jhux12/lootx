import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { authedFetch } from '../utils/authedFetch';
import { useSound } from '../context/SoundContext';
import { ProvablyFairPanel, ProvablyFairRevealData, ProvablyFairRollData } from './ProvablyFairPanel';

const LAST_ROLL_STORAGE_KEY = 'pullz:last-provably-fair-roll';
const LAST_REVEAL_STORAGE_KEY = 'pullz:last-provably-fair-reveal';

const readStoredJson = <T,>(key: string): T | null => {
  if (typeof window === 'undefined') return null;
  const raw = window.sessionStorage.getItem(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
};

export const ProvablyFairPage: React.FC = () => {
  const { playSound } = useSound();
  const [serverSeedHash, setServerSeedHash] = useState('');
  const [clientSeedInput, setClientSeedInput] = useState('lootx-player');
  const [nonce, setNonce] = useState(0);
  const [lastRoll, setLastRoll] = useState<ProvablyFairRollData | null>(() => readStoredJson<ProvablyFairRollData>(LAST_ROLL_STORAGE_KEY));
  const [lastReveal, setLastReveal] = useState<ProvablyFairRevealData | null>(() => readStoredJson<ProvablyFairRevealData>(LAST_REVEAL_STORAGE_KEY));
  const [isSyncingFair, setIsSyncingFair] = useState(false);
  const [isUpdatingClientSeed, setIsUpdatingClientSeed] = useState(false);
  const [isRotatingSeed, setIsRotatingSeed] = useState(false);

  const loadProvablyFairState = useCallback(async () => {
    setIsSyncingFair(true);
    try {
      const data = await authedFetch<{ serverSeedHash: string; clientSeed: string; nonce: number }>('/api/provably-fair');
      setServerSeedHash(data.serverSeedHash);
      setClientSeedInput(data.clientSeed);
      setNonce(data.nonce);
    } catch (error) {
      console.error('Failed to load provably fair state', error);
    } finally {
      setIsSyncingFair(false);
    }
  }, []);

  useEffect(() => {
    loadProvablyFairState();
  }, [loadProvablyFairState]);

  const saveClientSeed = useCallback(async () => {
    const normalizedSeed = clientSeedInput.trim();
    if (!normalizedSeed) {
      alert('Client seed cannot be empty.');
      return;
    }

    setIsUpdatingClientSeed(true);
    try {
      const data = await authedFetch<{ serverSeedHash: string; clientSeed: string; nonce: number }>(
        '/api/provably-fair/client-seed',
        {
          method: 'POST',
          body: JSON.stringify({ clientSeed: normalizedSeed })
        }
      );
      setServerSeedHash(data.serverSeedHash);
      setClientSeedInput(data.clientSeed);
      setNonce(data.nonce);
      playSound('success');
    } catch (error) {
      console.error('Failed to update client seed', error);
      alert('Unable to update client seed. Please try again.');
    } finally {
      setIsUpdatingClientSeed(false);
    }
  }, [clientSeedInput, playSound]);

  const rotateServerSeed = useCallback(async () => {
    setIsRotatingSeed(true);
    try {
      const data = await authedFetch<{
        revealed: { serverSeed: string; serverSeedHash: string; rotatedAt: number };
        current: { serverSeedHash: string; clientSeed: string; nonce: number };
      }>('/api/provably-fair/rotate', { method: 'POST' });

      setLastReveal(data.revealed);
      setServerSeedHash(data.current.serverSeedHash);
      setClientSeedInput(data.current.clientSeed);
      setNonce(data.current.nonce);
      if (typeof window !== 'undefined') {
        window.sessionStorage.setItem(LAST_REVEAL_STORAGE_KEY, JSON.stringify(data.revealed));
      }
      playSound('success');
    } catch (error) {
      console.error('Failed to rotate server seed', error);
      alert('Unable to rotate server seed. Please try again.');
    } finally {
      setIsRotatingSeed(false);
    }
  }, [playSound]);

  const copyProof = useCallback(async () => {
    if (!lastRoll) return;
    const proofLines = [
      'Pullz.gg Provably Fair Proof',
      `Server Seed (revealed): ${lastReveal?.serverSeed ?? 'Not revealed yet'}`,
      `Server Seed Hash (committed): ${lastRoll.serverSeedHash}`,
      `Client Seed: ${lastRoll.clientSeed}`,
      `Nonce: ${lastRoll.nonce}`,
      `Box ID: ${lastRoll.boxId}`,
      `HMAC Message (clientSeed:nonce:boxId): ${lastRoll.message}`,
      `Roll Hash (HMAC): ${lastRoll.rollHash}`,
      `Roll Value: ${lastRoll.rollValue}`,
      `Outcome: ${lastRoll.outcome ?? 'N/A'}`
    ];

    try {
      await navigator.clipboard.writeText(proofLines.join('\n'));
      playSound('success');
      alert('Provably fair proof copied to clipboard.');
    } catch (error) {
      console.error('Failed to copy proof', error);
      alert('Unable to copy proof.');
    }
  }, [lastReveal?.serverSeed, lastRoll, playSound]);

  const initialTab = useMemo<'active' | 'verify'>(() => {
    if (typeof window === 'undefined') return 'active';
    return window.location.hash === '#verify' ? 'verify' : 'active';
  }, []);

  return (
    <div className="mx-auto w-full max-w-6xl space-y-8 px-4 pb-12 pt-8 sm:px-6 lg:px-8">
      <section className="grid gap-4 rounded-2xl border border-gray-800 bg-[#0b0e14] p-5 sm:grid-cols-3 sm:gap-5 sm:p-6">
        <div className="rounded-xl border border-purple-500/30 bg-purple-500/10 p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-purple-200">1. Server Seed</h2>
          <p className="mt-2 text-sm text-gray-300">We commit to a hidden server seed hash before any spin happens.</p>
        </div>
        <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/10 p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-cyan-200">2. Client Seed</h2>
          <p className="mt-2 text-sm text-gray-300">Your client seed is mixed into the roll and can be customized by you.</p>
        </div>
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-emerald-200">3. Nonce</h2>
          <p className="mt-2 text-sm text-gray-300">Nonce increments every roll so each outcome is deterministic and unique.</p>
        </div>
      </section>

      <ProvablyFairPanel
        showHero
        initialTab={initialTab}
        serverSeedHash={serverSeedHash}
        clientSeedInput={clientSeedInput}
        nonce={nonce}
        lastRoll={lastRoll}
        lastReveal={lastReveal}
        isSyncingFair={isSyncingFair}
        isUpdatingClientSeed={isUpdatingClientSeed}
        isRotatingSeed={isRotatingSeed}
        onClientSeedInputChange={setClientSeedInput}
        onSaveClientSeed={saveClientSeed}
        onRotateServerSeed={rotateServerSeed}
        onCopyProof={copyProof}
      />
    </div>
  );
};
