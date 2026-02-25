import React, { useEffect, useMemo, useState } from 'react';
import { Loader2, Volume2, VolumeX } from 'lucide-react';
import { useGame } from '../context/GameContext';
import { attemptPlinko, getPlinkoBoard, getPlinkoSettings, listPlinkoPoolItems } from '../services/plinkoService';
import { PlinkoBoard, PlinkoSettings } from '../utils/plinko';
import { InventoryItem } from '../types';

const sleep = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));
const PEG_SPACING = 24;

type SlotPrizePreview = {
  name: string;
  imageUrl: string;
  coinValue: number;
};

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
  const [slotPrizes, setSlotPrizes] = useState<Record<number, SlotPrizePreview>>({});

  useEffect(() => {
    void (async () => {
      const nextSettings = await getPlinkoSettings();
      const nextBoard = await getPlinkoBoard(nextSettings.activeBoardId);
      setSettings(nextSettings);
      setBoard(nextBoard);
      setBet(Math.max(nextSettings.minBet, Math.min(nextSettings.maxBet, 1000)));
    })();
  }, []);

  useEffect(() => {
    if (!board || !settings) return;

    const loadSlotPreviews = async () => {
      const uniquePoolIds = Array.from(new Set(board.slots.map((slot) => slot.poolId).filter(Boolean)));
      const pools = await Promise.all(uniquePoolIds.map(async (poolId) => ({ poolId, items: await listPlinkoPoolItems(poolId) })));
      const poolMap = new Map(pools.map((entry) => [entry.poolId, entry.items]));
      const center = board.rows / 2;

      const previews: Record<number, SlotPrizePreview> = {};
      board.slots.forEach((slot, index) => {
        const items = [...(poolMap.get(slot.poolId) ?? [])]
          .map((item) => ({
            name: String(item.name ?? 'Mystery Item'),
            imageUrl: String(item.imageUrl ?? ''),
            coinValue: Number(item.coinValue ?? 0)
          }))
          .filter((item) => Number.isFinite(item.coinValue) && item.coinValue >= 0)
          .sort((a, b) => a.coinValue - b.coinValue);

        if (!items.length) return;

        const minValue = bet * slot.minMult * settings.houseEdgeMultiplier;
        const maxValue = bet * slot.maxMult * settings.houseEdgeMultiplier;
        const inBand = items.filter((item) => item.coinValue >= minValue && item.coinValue <= maxValue);
        const candidates = inBand.length ? inBand : items;

        // Push higher-value previews toward outside slots for clearer UX expectations.
        const outwardRatio = Math.min(1, Math.abs(index - center) / Math.max(1, center));
        const pickIndex = Math.min(candidates.length - 1, Math.round((candidates.length - 1) * (0.35 + outwardRatio * 0.65)));
        previews[index] = candidates[pickIndex];
      });

      setSlotPrizes(previews);
    };

    void loadSlotPreviews();
  }, [board, settings, bet]);

  const pegs = useMemo(() => {
    if (!board) return [] as Array<{ row: number; col: number; x: number; y: number }>;
    const out: Array<{ row: number; col: number; x: number; y: number }> = [];
    for (let row = 0; row < board.rows; row += 1) {
      const cols = row + 1;
      for (let col = 0; col < cols; col += 1) {
        out.push({ row, col, x: (col - row / 2) * PEG_SPACING, y: row * PEG_SPACING });
      }
    }
    return out;
  }, [board]);

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

      let rights = 0;
      for (let i = 0; i < pathBits.length; i += 1) {
        if (pathBits[i] === 1) rights += 1;
        setBallRow(i + 1);
        setBallX((rights - (i + 1) / 2) * PEG_SPACING);
        await sleep(90);
      }

      // Snap to exact slot center for accurate visual landing.
      setBallX((Number(payload.slotIndex) - board.rows / 2) * PEG_SPACING);
      await sleep(200);

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

      setSlotPrizes((prev) => ({
        ...prev,
        [Number(payload.slotIndex)]: {
          name: inventoryItem.name,
          imageUrl: inventoryItem.image,
          coinValue: inventoryItem.price
        }
      }));

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
      setBallRow(-1);
    }
  };

  const quickBets = useMemo(() => {
    if (!settings) return [100, 500, 1000, 5000];
    return [settings.minBet, Math.max(settings.minBet, 500), 1000, Math.min(settings.maxBet, 5000)];
  }, [settings]);

  if (!isAuthenticated) {
    return <div className="mx-auto max-w-xl p-6 text-center"><h1 className="text-2xl font-black">Plinko (Items)</h1><p className="mt-2 text-gray-400">Sign in to drop and win real items.</p><button onClick={() => openAuthModal('login')} className="mt-4 rounded-xl bg-emerald-600 px-4 py-2 font-bold text-white">Sign in</button></div>;
  }

  const rows = board?.rows ?? 16;
  const boardWidth = rows * PEG_SPACING + 80;
  const boardHeight = rows * PEG_SPACING + 150;

  return (
    <div className="mx-auto w-full max-w-6xl p-3 sm:p-6">
      <div className="rounded-2xl border border-emerald-500/30 bg-[#071016] p-4 shadow-[0_0_80px_rgba(34,197,94,0.08)] sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-black text-white sm:text-3xl">Plinko (Items)</h1>
            <p className="text-sm text-gray-400">Drop to real prizes. Higher-value previews are positioned toward the outside slots.</p>
          </div>
          <button onClick={() => setSoundEnabled((prev) => !prev)} className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs font-semibold text-white">
            {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
          </button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-5">
          {quickBets.map((quickBet) => (
            <button key={quickBet} onClick={() => setBet(quickBet)} className="rounded-xl border border-white/10 bg-[#0b131c] px-3 py-2 text-sm font-semibold text-gray-100">
              {quickBet.toLocaleString()}
            </button>
          ))}
          <input
            type="number"
            value={bet}
            onChange={(event) => setBet(Number(event.target.value || 0))}
            min={settings?.minBet ?? 100}
            max={settings?.maxBet ?? 50000}
            className="rounded-xl border border-white/10 bg-[#0b131c] px-3 py-2 text-sm text-white col-span-2 sm:col-span-4 lg:col-span-1"
            placeholder="Bet"
          />
        </div>

        <div className="mt-6 overflow-x-auto pb-2">
          <div className="relative mx-auto min-h-[460px] min-w-[340px] max-w-[900px] rounded-2xl border border-white/5 bg-[#02060a] p-3 sm:p-4">
            <div className="relative mx-auto" style={{ width: `${boardWidth}px`, height: `${boardHeight}px` }}>
              {pegs.map((peg) => (
                <div key={`${peg.row}-${peg.col}`} className="absolute h-2.5 w-2.5 rounded-full bg-white/90" style={{ left: `calc(50% + ${peg.x}px)`, top: `${peg.y + 34}px`, transform: 'translate(-50%, -50%)' }} />
              ))}

              {ballRow >= 0 && (
                <div
                  className="absolute h-4 w-4 rounded-full bg-emerald-400 shadow-[0_0_14px_rgba(16,185,129,0.9)] transition-all duration-100"
                  style={{ left: `calc(50% + ${ballX}px)`, top: `${ballRow * PEG_SPACING + 18}px`, transform: 'translate(-50%, -50%)' }}
                />
              )}

              <div className="absolute inset-x-0 bottom-0 h-[88px]">
                {board?.slots.map((slot, index) => {
                  const preview = slotPrizes[index];
                  const isHit = index === result?.slotIndex;
                  return (
                    <div
                      key={`${slot.poolId}-${index}`}
                      className={`absolute -translate-x-1/2 rounded-lg border p-1 text-center ${isHit ? 'border-emerald-300 bg-emerald-500/20' : 'border-emerald-500/40 bg-emerald-500/10'}`}
                      style={{ left: `calc(50% + ${(index - rows / 2) * PEG_SPACING}px)`, width: '64px' }}
                    >
                      <div className="h-10 w-full overflow-hidden rounded-md bg-black/30">
                        {preview?.imageUrl ? (
                          <img src={preview.imageUrl} alt={preview.name} className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full items-center justify-center text-[9px] text-gray-400">No item</div>
                        )}
                      </div>
                      <div className="mt-1 truncate text-[9px] font-semibold text-white">{preview?.name ?? slot.label}</div>
                      <div className="text-[9px] text-emerald-200">{Math.round(preview?.coinValue ?? 0).toLocaleString()}</div>
                    </div>
                  );
                })}
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
