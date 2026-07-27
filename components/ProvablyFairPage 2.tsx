import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { collection, doc, getDoc, getDocs, orderBy, query } from 'firebase/firestore';
import { authedFetch } from '../utils/authedFetch';
import { db } from '../firebase';
import { useSound } from '../context/SoundContext';
import { ProvablyFairPanel, ProvablyFairRevealData, ProvablyFairRollData } from './ProvablyFairPanel';
import { useManagedFooterPage } from './FooterManagedContent';

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

const getBattleIdFromPath = () => {
  if (typeof window === 'undefined') return null;
  const match = window.location.pathname.match(/^\/provably-fair\/battle\/([^/]+)$/);
  return match?.[1] ?? null;
};

export const ProvablyFairPage: React.FC = () => {
  const { playSound } = useSound();
  const [serverSeedHash, setServerSeedHash] = useState('');
  const [clientSeedInput, setClientSeedInput] = useState('pullzplayer');
  const [nonce, setNonce] = useState(0);
  const [lastRoll, setLastRoll] = useState<ProvablyFairRollData | null>(() => readStoredJson<ProvablyFairRollData>(LAST_ROLL_STORAGE_KEY));
  const [lastReveal, setLastReveal] = useState<ProvablyFairRevealData | null>(() => readStoredJson<ProvablyFairRevealData>(LAST_REVEAL_STORAGE_KEY));
  const [isSyncingFair, setIsSyncingFair] = useState(false);
  const [isUpdatingClientSeed, setIsUpdatingClientSeed] = useState(false);
  const [isRotatingSeed, setIsRotatingSeed] = useState(false);
  const [battleVerify, setBattleVerify] = useState<{ battle: any | null; rounds: any[] }>({ battle: null, rounds: [] });
  const managedContent = useManagedFooterPage('provablyFair');

  const battleId = useMemo(() => getBattleIdFromPath(), []);

  useEffect(() => {
    if (!battleId) return;
    void (async () => {
      const battlePathLabel = `battles/${battleId}`;
      const roundsPathLabel = `battles/${battleId}/rounds`;
      console.log('READING FIRESTORE PATH', battlePathLabel);
      console.log('READING FIRESTORE PATH', roundsPathLabel);
      const [battleSnap, roundsSnap] = await Promise.all([
        getDoc(doc(db, 'battles', battleId)),
        getDocs(query(collection(db, 'battles', battleId, 'rounds'), orderBy('index', 'asc')))
      ]);
      setBattleVerify({
        battle: battleSnap.exists() ? { id: battleSnap.id, ...battleSnap.data() } : null,
        rounds: roundsSnap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
      });
    })().catch((error) => {
      console.error('Failed to load provably fair battle data', error);
    });
  }, [battleId]);

  const loadProvablyFairState = useCallback(async () => {
    if (battleId) return;
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
  }, [battleId]);

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
      const data = await authedFetch<{ serverSeedHash: string; clientSeed: string; nonce: number }>('/api/provably-fair/client-seed', {
        method: 'POST',
        body: JSON.stringify({ clientSeed: normalizedSeed })
      });
      setServerSeedHash(data.serverSeedHash);
      setClientSeedInput(data.clientSeed);
      setNonce(data.nonce);
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
      `Game: ${lastRoll.game ?? 'case'}`,
      `Box / Round ID: ${lastRoll.boxId}`,
      `Target Item ID: ${lastRoll.targetItemId ?? 'N/A'}`,
      `Source Item Instance ID: ${lastRoll.sourceItemInstanceId ?? 'N/A'}`,
      `HMAC Message: ${lastRoll.message}`,
      `Roll Hash (HMAC): ${lastRoll.rollHash}`,
      `Roll Value: ${lastRoll.rollValue}`,
      `Outcome: ${lastRoll.outcome ?? 'N/A'}`
    ];

    try {
      await navigator.clipboard.writeText(proofLines.join('\n'));
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

  if (battleId) {
    const battle = battleVerify.battle;
    return (
      <div className="mx-auto w-full max-w-5xl space-y-6 px-3 pb-12 pt-6 sm:px-6">
        <div className="bg-[#131720] border border-gray-800 rounded-xl p-4 space-y-3">
          <h1 className="text-xl font-bold text-white">Battle Verification</h1>
          {battle ? (
            <>
              <div className="text-sm text-gray-300 break-all">Server Seed Hash: <span className="text-white">{battle.serverSeedHash}</span></div>
              <div className="text-sm text-gray-300 break-all">Server Seed Reveal: <span className="text-white">{battle.serverSeedReveal || 'Hidden until battle completes'}</span></div>
              <div className="space-y-1">
                <h2 className="text-sm font-semibold text-gray-200">Player Seeds</h2>
                {(battle.players || []).map((player: any) => (
                  <div key={player.uid} className="text-xs text-gray-300 break-all">{player.displayName}: <span className="text-white">{player.clientSeed}</span></div>
                ))}
              </div>
            </>
          ) : (
            <div className="text-gray-400 text-sm">Loading battle proof...</div>
          )}
        </div>

        <div className="bg-[#131720] border border-gray-800 rounded-xl p-4">
          <h2 className="text-sm font-semibold text-gray-200 mb-3">Round Proofs</h2>
          <div className="space-y-3">
            {battleVerify.rounds.map((round) => (
              <div key={round.id} className="bg-[#0b0e14] border border-gray-800 rounded-lg p-3">
                <div className="text-xs text-gray-500 mb-2">Round {Number(round.index) + 1}</div>
                {Object.entries(round.resultsByUid || {}).map(([uid, result]: any) => (
                  <div key={`${round.id}-${uid}`} className="text-xs text-gray-300 break-all mb-2">
                    <div className="text-white">{uid}: {result.itemName} (${result.value})</div>
                    <div>roll: {result.roll}</div>
                    <div>nonce: {result.nonce}</div>
                    <div>proof: {result.proof}</div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>

        <div className="bg-[#131720] border border-gray-800 rounded-xl p-4 text-xs sm:text-sm text-gray-300">
          <h2 className="font-semibold text-gray-200 mb-2">How to verify</h2>
          <ol className="list-decimal list-inside space-y-1">
            <li>Compute sha256(serverSeedReveal) and ensure it matches the committed serverSeedHash.</li>
            <li>For each player and round, compute HMAC_SHA256(serverSeedReveal, battleId:uid:clientSeed:roundIndex:nonce).</li>
            <li>Convert hash to roll in [0,1) and verify selected item/value matches recorded result proof.</li>
          </ol>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-8 px-4 pb-12 pt-8 sm:px-6 lg:px-8">
      <header className="rounded-2xl border border-white/10 bg-[#0b0f1a] p-5 sm:p-6 md:p-8">
        <h1 className="text-2xl font-bold text-white sm:text-3xl">{managedContent.title}</h1>
        {managedContent.lastUpdated && <p className="mt-2 text-xs uppercase tracking-[0.3em] text-gray-500">Last updated {managedContent.lastUpdated}</p>}
        <div className="mt-4 space-y-3 text-sm text-gray-300 sm:text-base" dangerouslySetInnerHTML={{ __html: managedContent.html }} />
      </header>

      <section className="grid gap-4 rounded-2xl border border-gray-800 bg-[#0b0e14] p-5 sm:grid-cols-3 sm:gap-5 sm:p-6">
        <div className="rounded-xl border border-blue-500/30 bg-blue-500/10 p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-blue-200">1. Server Seed</h2>
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
