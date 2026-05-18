import React, { useEffect, useState } from 'react';
import { RefreshCw, ShieldCheck } from 'lucide-react';
import { Input } from './ui/Input';

export interface ProvablyFairRollData {
  nonce: number;
  rollHash: string;
  rollValue: number;
  message: string;
  boxId: string;
  game?: string;
  targetItemId?: string;
  sourceItemInstanceId?: string;
  serverSeedHash: string;
  clientSeed: string;
  outcome?: string;
}

export interface ProvablyFairRevealData {
  serverSeed: string;
  serverSeedHash: string;
  rotatedAt: number;
}

interface ProvablyFairPanelProps {
  serverSeedHash: string;
  clientSeedInput: string;
  nonce: number;
  lastRoll: ProvablyFairRollData | null;
  lastReveal: ProvablyFairRevealData | null;
  isSyncingFair: boolean;
  isUpdatingClientSeed: boolean;
  isRotatingSeed: boolean;
  onClientSeedInputChange: (value: string) => void;
  onSaveClientSeed: () => Promise<void>;
  onRotateServerSeed: () => Promise<void>;
  onCopyProof: () => Promise<void>;
  initialTab?: 'active' | 'verify';
  showHero?: boolean;
}

export const ProvablyFairPanel: React.FC<ProvablyFairPanelProps> = ({
  serverSeedHash,
  clientSeedInput,
  nonce,
  lastRoll,
  lastReveal,
  isSyncingFair,
  isUpdatingClientSeed,
  isRotatingSeed,
  onClientSeedInputChange,
  onSaveClientSeed,
  onRotateServerSeed,
  onCopyProof,
  initialTab = 'active',
  showHero = false
}) => {
  const [activeTab, setActiveTab] = useState<'active' | 'verify'>(initialTab);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  return (
    <div className="rounded-2xl border border-gray-800 bg-[#0f1219] shadow-2xl shadow-black/50">
      {showHero && (
        <div className="border-b border-gray-800 bg-gradient-to-r from-[#205DD7]/15 via-sky-500/10 to-transparent p-5 sm:p-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-200">
            Pullz.gg Integrity
          </div>
          <h1 className="mt-4 text-2xl font-black text-white sm:text-3xl">Provably Fair</h1>
          <p className="mt-2 max-w-3xl text-sm text-gray-300 sm:text-base">
            Every box opening is generated with a verifiable system. We commit to fairness before you spin,
            and you can audit each result independently.
          </p>
        </div>
      )}

      <div className="border-b border-gray-800 px-4 sm:px-6">
        <div className="flex gap-6">
          <button
            type="button"
            className={`py-3 text-sm font-semibold border-b-2 transition-colors ${activeTab === 'active' ? 'text-white border-green-400' : 'text-gray-500 border-transparent hover:text-white'}`}
            onClick={() => setActiveTab('active')}
          >
            Active Seeds
          </button>
          <button
            type="button"
            className={`py-3 text-sm font-semibold border-b-2 transition-colors ${activeTab === 'verify' ? 'text-white border-blue-400' : 'text-gray-500 border-transparent hover:text-white'}`}
            onClick={() => setActiveTab('verify')}
          >
            Verify Last Spin
          </button>
        </div>
      </div>

      <div className="p-4 sm:p-6">
        {activeTab === 'active' && (
          <div className="space-y-4">
            <div className="rounded-xl border border-green-600/40 bg-green-500/10 p-4 text-sm text-green-200">
              We commit to a hashed server seed before your spin. Rotate your seed to reveal the previous server seed and verify outcomes.
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-xl border border-gray-800 bg-[#0b0e14] p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-white">
                    <ShieldCheck className="h-4 w-4 text-green-400" />
                    Server Seed Commit
                  </div>
                  <button
                    type="button"
                    onClick={onRotateServerSeed}
                    disabled={isRotatingSeed || isSyncingFair}
                    className="inline-flex items-center gap-2 rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-3 py-2 text-xs font-semibold text-cyan-200 transition hover:bg-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${isRotatingSeed ? 'animate-spin' : ''}`} />
                    Rotate Seed
                  </button>
                </div>
                <div className="text-xs text-gray-500">Current server seed hash</div>
                <div className="mt-1 break-all rounded border border-gray-800 bg-black/20 p-2 font-mono text-xs text-gray-300">
                  {serverSeedHash || 'Loading...'}
                </div>

                <div className="mt-4 text-xs text-gray-500">Revealed server seed (after rotation)</div>
                <div className="mt-1 break-all rounded border border-gray-800 bg-black/20 p-2 font-mono text-xs text-gray-300">
                  {lastReveal?.serverSeed ?? 'Rotate to reveal'}
                </div>
              </div>

              <div className="rounded-xl border border-gray-800 bg-[#0b0e14] p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-white">Client Seed</h3>
                  <div className="rounded border border-gray-800 bg-black/20 px-2 py-1 text-[10px] font-semibold uppercase text-gray-500">
                    Nonce {nonce}
                  </div>
                </div>
                <label className="mb-2 block text-xs text-gray-400">Customize your seed to verify rolls independently</label>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Input
                    value={clientSeedInput}
                    onChange={(event) => onClientSeedInputChange(event.target.value)}
                    placeholder="Enter your own client seed"
                    className="h-10 font-mono text-xs"
                  />
                  <button
                    type="button"
                    onClick={onSaveClientSeed}
                    disabled={isUpdatingClientSeed || isSyncingFair}
                    className="h-10 rounded-lg border border-blue-500/40 bg-blue-500/20 px-4 text-sm font-semibold text-blue-100 transition hover:bg-blue-500/30 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Save Seed
                  </button>
                </div>
                <p className="mt-3 text-xs leading-relaxed text-gray-400">
                  Each roll combines the hashed server seed, your client seed, and the nonce to generate a deterministic SHA-256 hash.
                </p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'verify' && (
          <div id="verify" className="space-y-4">
            <div className="rounded-xl border border-blue-500/40 bg-blue-500/10 p-4 text-sm text-blue-200">
              Use the values below to re-hash the combined seed (server + client + nonce) and confirm it matches the roll hash shown.
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-xl border border-gray-800 bg-[#0b0e14] p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-white">Verification Data</h3>
                  <button
                    type="button"
                    onClick={onCopyProof}
                    disabled={!lastRoll}
                    className="rounded-lg border border-blue-500/40 bg-blue-500/20 px-3 py-2 text-xs font-semibold text-blue-100 transition hover:bg-blue-500/30 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Copy Proof
                  </button>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <div className="mb-1 text-xs text-gray-500">Revealed server seed</div>
                    <div className="break-all rounded border border-gray-800 bg-black/20 p-2 font-mono text-xs text-gray-300">{lastReveal?.serverSeed ?? 'Rotate to reveal'}</div>
                  </div>
                  <div>
                    <div className="mb-1 text-xs text-gray-500">Committed server hash</div>
                    <div className="break-all rounded border border-gray-800 bg-black/20 p-2 font-mono text-xs text-gray-300">{lastRoll?.serverSeedHash ?? (serverSeedHash || 'Spin to reveal')}</div>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-gray-800 bg-[#0b0e14] p-4">
                {lastRoll ? (
                  <div className="space-y-2 font-mono text-xs text-gray-300">
                    <div className="flex items-center justify-between"><span className="text-gray-500">Outcome</span><span className="text-white">{lastRoll.outcome}</span></div>
                    <div className="flex items-center justify-between"><span className="text-gray-500">Game</span><span>{lastRoll.game ?? 'case'}</span></div>
                    <div className="flex items-center justify-between"><span className="text-gray-500">Box / Round ID</span><span>{lastRoll.boxId}</span></div>
                    <div className="flex items-center justify-between"><span className="text-gray-500">Nonce</span><span>{lastRoll.nonce}</span></div>
                    <div className="flex items-center justify-between"><span className="text-gray-500">Roll Value</span><span>{lastRoll.rollValue.toFixed(6)}</span></div>
                    <div>
                      <div className="text-gray-500">Roll Hash</div>
                      <div className="break-all text-gray-200">{lastRoll.rollHash}</div>
                    </div>
                    <div>
                      <div className="text-gray-500">HMAC Message</div>
                      <div className="break-all text-gray-400">{lastRoll.message}</div>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">Spin a box or use the upgrader first to generate verifiable proof data for your result.</p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
