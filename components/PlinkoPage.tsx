import React, { useEffect, useMemo, useState } from 'react';
import { Loader2, Volume2, VolumeX } from 'lucide-react';
import { useGame } from '../context/GameContext';
import { attemptPlinko, getPlinkoBoard, getPlinkoSettings } from '../services/plinkoService';
import { formatMultiplier, PlinkoBoard, PlinkoSettings } from '../utils/plinko';
import { InventoryItem } from '../types';

const sleep = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

export const PlinkoPage: React.FC = () => {
  const { isAuthenticated, openAuthModal, addInventoryItemFromServer, sellItem, syncBalance } = useGame();
  const [settings, setSettings] = useState<PlinkoSettings | null>(null);
  const [board, setBoard] = useState<PlinkoBoard | null>(null);
  const [bet, setBet] = useState(100);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [ballRow, setBallRow] = useState(-1);
  const [ballX, setBallX] = useState(0);
  const [result, setResult] = useState<any | null>(null);
  const [wonInventoryItem, setWonInventoryItem] = useState<InventoryItem | null>(null);
  const [isSelling, setIsSelling] = useState(false);

  useEffect(() => {
    void (async () => {
      const nextSettings = await getPlinkoSettings();
      const nextBoard = await getPlinkoBoard(nextSettings.activeBoardId);
      setSettings(nextSettings);
      setBoard(nextBoard);
      setBet(Math.max(nextSettings.minBet, Math.min(nextSettings.maxBet, 1000)));
    })();
  }, []);

  const pegs = useMemo(() => {
    if (!board) return [] as Array<{ row: number; col: number; x: number; y: number }>;
    const out: Array<{ row: number; col: number; x: number; y: number }> = [];
    for (let row = 0; row < board.rows; row += 1) {
      const cols = row + 1;
      for (let col = 0; col < cols; col += 1) {
        out.push({ row, col, x: (col - row / 2) * 18, y: row * 18 });
      }
    }
    return out;
  }, [board]);

  const slotWidthPx = 34;

  const runDrop = async () => {
    if (!isAuthenticated) {
      openAuthModal('login');
      return;
    }
    if (!board || !settings) return;

    setError(null);
    setIsLoading(true);
    setResult(null);
    setWonInventoryItem(null);

    try {
      const payload = await attemptPlinko({ bet, clientSeed: `${Date.now()}` });
      const pathBits = Array.isArray(payload.pathBits)
        ? payload.pathBits.map((bit: any) => Number(bit))
        : String(payload.pathBits ?? '').split('').map((bit) => Number(bit));

      let offset = 0;
      setBallRow(0);
      setBallX(0);
      for (let i = 0; i < pathBits.length; i += 1) {
        await sleep(85);
        offset += pathBits[i] === 1 ? 1 : -1;
        setBallRow(i + 1);
        setBallX(offset * 9);
      }

      await sleep(220);
      const awarded = payload.awardedItem;
      const inventoryItem: InventoryItem = {
        id: awarded.itemId ?? awarded.id ?? payload.inventoryId,
        instanceId: payload.inventoryId,
        name: awarded.name,
        image: awarded.imageUrl,
        rarity: awarded.rarity ?? 'common',
        price: Number(awarded.coinValue ?? 0),
        chance: 0,
        color: '#22c55e',
        obtainedAt: Date.now(),
        status: 'available',
        category: awarded.category ?? '',
        sellBackRate: Number(awarded.sellBackRate ?? 0.82),
        source: 'plinko'
      };
      addInventoryItemFromServer(inventoryItem);
      if (Number.isFinite(Number(payload.newCoins))) {
        syncBalance(Number(payload.newCoins));
      }
      setWonInventoryItem(inventoryItem);
      setResult(payload);
    } catch (dropError) {
      setError(dropError instanceof Error ? dropError.message : 'Drop failed.');
    } finally {
      setIsLoading(false);
    }
  };

  const quickBets = useMemo(() => {
    if (!settings) return [100, 500, 1000, 5000];
    return [settings.minBet, Math.max(settings.minBet, 500), 1000, Math.min(settings.maxBet, 5000)];
  }, [settings]);

  if (!isAuthenticated) {
    return <div className="mx-auto max-w-xl p-6 text-center"><h1 className="text-2xl font-black">Plinko (Items)</h1><p className="mt-2 text-gray-400">Sign in to drop and win real items.</p><button onClick={() => openAuthModal('login')} className="mt-4 rounded-xl bg-emerald-600 px-4 py-2 font-bold text-white">Sign in</button></div>;
  }

  return (
    <div className="mx-auto w-full max-w-6xl p-3 sm:p-6">
      <div className="rounded-2xl border border-emerald-500/30 bg-[#071016] p-4 shadow-[0_0_80px_rgba(34,197,94,0.08)] sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-black text-white sm:text-3xl">Plinko (Items)</h1>
            <p className="text-sm text-gray-400">Dark neon board. Provably fair path, real item rewards.</p>
          </div>
          <button onClick={() => setSoundEnabled((prev) => !prev)} className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs font-semibold text-white">
            {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
          </button>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {quickBets.map((quickBet) => (
            <button key={quickBet} onClick={() => setBet(quickBet)} className="rounded-xl border border-white/10 bg-[#0b131c] px-3 py-2 text-sm font-semibold text-gray-100">
              {quickBet.toLocaleString()} coins
            </button>
          ))}
          <input
            type="number"
            value={bet}
            onChange={(event) => setBet(Number(event.target.value || 0))}
            min={settings?.minBet ?? 100}
            max={settings?.maxBet ?? 50000}
            className="rounded-xl border border-white/10 bg-[#0b131c] px-3 py-2 text-sm text-white sm:col-span-2 lg:col-span-4"
            placeholder="Bet amount"
          />
        </div>

        <div className="mt-6 overflow-x-auto pb-2">
          <div className="relative mx-auto min-h-[420px] min-w-[360px] max-w-[700px] rounded-2xl border border-white/5 bg-[#02060a] p-4">
            <div className="relative mx-auto" style={{ width: `${(board?.rows ?? 16) * 18 + 64}px`, height: `${(board?.rows ?? 16) * 18 + 120}px` }}>
              {pegs.map((peg) => (
                <div key={`${peg.row}-${peg.col}`} className="absolute h-2.5 w-2.5 rounded-full bg-white/90" style={{ left: `calc(50% + ${peg.x}px)`, top: `${peg.y + 30}px`, transform: 'translate(-50%, -50%)' }} />
              ))}
              {ballRow >= 0 && (
                <div className="absolute h-4 w-4 rounded-full bg-emerald-400 shadow-[0_0_14px_rgba(16,185,129,0.9)] transition-all duration-75" style={{ left: `calc(50% + ${ballX}px)`, top: `${ballRow * 18 + 12}px`, transform: 'translate(-50%, -50%)' }} />
              )}

              <div className="absolute inset-x-0 bottom-0 flex items-end justify-center gap-1">
                {board?.slots.map((slot, index) => (
                  <div
                    key={`${slot.poolId}-${index}`}
                    className={`flex h-[62px] w-[${slotWidthPx}px] flex-col items-center justify-center rounded-lg border px-1 text-center text-[9px] leading-tight sm:text-[10px] ${index === result?.slotIndex ? 'border-emerald-300 bg-emerald-500/25 text-emerald-100' : 'border-emerald-500/40 bg-emerald-500/15 text-emerald-200'}`}
                    style={{ width: `${slotWidthPx}px` }}
                  >
                    <span className="font-bold">{slot.label}</span>
                    <span>{formatMultiplier(slot.minMult)}-{formatMultiplier(slot.maxMult)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <button
          onClick={() => { void runDrop(); }}
          disabled={!settings?.enabled || isLoading || !board || bet < (settings?.minBet ?? 100) || bet > (settings?.maxBet ?? 50000)}
          className="mt-4 h-12 w-full rounded-xl bg-gradient-to-r from-emerald-500 to-lime-400 text-base font-black text-black disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isLoading ? <span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Dropping…</span> : 'Drop Ball'}
        </button>
        {error && <div className="mt-3 rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-sm text-rose-200">{error}</div>}
      </div>

      {result && wonInventoryItem && (
        <div className="fixed inset-0 z-[130] flex items-end justify-center bg-black/70 p-3 sm:items-center">
          <div className="w-full max-w-md rounded-2xl border border-emerald-400/40 bg-[#0a1018] p-5">
            <h2 className="text-xl font-black text-white">You won: {wonInventoryItem.name}</h2>
            <p className="mt-1 text-sm text-emerald-300">Slot {result.slotIndex + 1} · {result.slotLabel}</p>
            <img src={wonInventoryItem.image} alt={wonInventoryItem.name} className="mt-4 h-40 w-full rounded-xl object-contain bg-black/20" />
            <p className="mt-3 text-sm text-gray-300">Value band: {Math.round(result.minValue).toLocaleString()} - {Math.round(result.maxValue).toLocaleString()} coins</p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button onClick={() => { setResult(null); setWonInventoryItem(null); }} className="rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-bold text-white">Keep</button>
              <button
                onClick={async () => {
                  if (!wonInventoryItem) return;
                  setIsSelling(true);
                  try {
                    await sellItem(wonInventoryItem.instanceId);
                    setResult(null);
                    setWonInventoryItem(null);
                  } finally {
                    setIsSelling(false);
                  }
                }}
                disabled={isSelling}
                className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-black text-black disabled:opacity-50"
              >
                {isSelling ? 'Selling…' : 'Sell Back'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
