import React, { useEffect, useMemo, useState } from 'react';
import { Loader2, Volume2, VolumeX } from 'lucide-react';
import { useGame } from '../context/GameContext';
import { attemptPlinko, getPlinkoBoard, getPlinkoSettings, listPlinkoPoolItems } from '../services/plinkoService';
import { PlinkoBoard as PlinkoBoardType, PlinkoSettings } from '../utils/plinko';
import { InventoryItem } from '../types';

const sleep = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

type SlotPrizePreview = {
  name: string;
  imageUrl: string;
  coinValue: number;
};

type SlotTone = {
  border: string;
  bg: string;
  glow: string;
};

const getSlotTone = (label: string): SlotTone => {
  const key = label.trim().toLowerCase();
  if (key.includes('jackpot')) return { border: '#ff5a1f', bg: 'rgba(43,16,7,0.94)', glow: 'rgba(255,84,26,0.7)' };
  if (key.includes('legendary')) return { border: '#f6c453', bg: 'rgba(39,28,8,0.94)', glow: 'rgba(246,196,83,0.55)' };
  if (key.includes('epic')) return { border: '#f472d0', bg: 'rgba(36,8,31,0.94)', glow: 'rgba(244,114,208,0.55)' };
  if (key.includes('rare')) return { border: '#a78bfa', bg: 'rgba(25,14,43,0.94)', glow: 'rgba(167,139,250,0.5)' };
  if (key.includes('uncommon')) return { border: '#60a5fa', bg: 'rgba(10,25,45,0.94)', glow: 'rgba(96,165,250,0.45)' };
  return { border: '#4b5563', bg: 'rgba(20,24,31,0.94)', glow: 'rgba(148,163,184,0.22)' };
};

const formatCompactValue = (value: number) => {
  if (!Number.isFinite(value) || value <= 0) return '0';
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return `${Math.round(value)}`;
};

const PegGrid: React.FC<{
  rows: number;
  pegSpacing: number;
}> = ({ rows, pegSpacing }) => {
  const pegs = useMemo(() => {
    const out: Array<{ row: number; col: number; x: number; y: number }> = [];
    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < row + 1; col += 1) {
        out.push({ row, col, x: (col - row / 2) * pegSpacing, y: row * pegSpacing });
      }
    }
    return out;
  }, [rows, pegSpacing]);

  return (
    <>
      {pegs.map((peg) => (
        <div
          key={`${peg.row}-${peg.col}`}
          className="absolute h-2.5 w-2.5 rounded-full bg-white"
          style={{
            left: `calc(50% + ${peg.x}px)`,
            top: `${peg.y + 34}px`,
            transform: 'translate(-50%, -50%)',
            boxShadow: '0 0 8px rgba(255,255,255,0.38), 0 0 2px rgba(255,255,255,0.9)'
          }}
        />
      ))}
    </>
  );
};

const SlotRow: React.FC<{
  board: PlinkoBoardType;
  pegSpacing: number;
  slotPrizes: Record<number, SlotPrizePreview>;
  resultSlotIndex: number | null;
  landingSlotIndex: number | null;
}> = ({ board, pegSpacing, slotPrizes, resultSlotIndex, landingSlotIndex }) => {
  const rows = board.rows;
  const slotCount = rows + 1;
  const laneWidth = slotCount * pegSpacing;
  const finalPegY = (rows - 1) * pegSpacing + 34;
  const slotsTop = finalPegY + pegSpacing * 0.6;
  const slotHeight = Math.max(72, Math.min(96, pegSpacing * 4));

  return (
    <div className="absolute inset-x-0 bottom-0">
      <div
        className="absolute left-1/2 -translate-x-1/2"
        style={{ width: `${laneWidth}px`, top: `${slotsTop - 46}px`, height: `${slotHeight + 46}px` }}
      >
        <div className="absolute inset-x-0 top-0 h-10">
          {Array.from({ length: slotCount }).map((_, index) => (
            <div
              key={`guide-${index}`}
              className="absolute top-0 h-full"
              style={{
                left: `${index * pegSpacing}px`,
                width: `${pegSpacing}px`,
                background: 'linear-gradient(to bottom, rgba(120,160,210,0.12), rgba(120,160,210,0.02))',
                borderLeft: '1px solid rgba(255,255,255,0.04)'
              }}
            />
          ))}
        </div>

        <div className="absolute inset-x-0 bottom-0 flex" style={{ height: `${slotHeight}px` }}>
          {board.slots.map((slot, index) => {
            const preview = slotPrizes[index];
            const tone = getSlotTone(slot.label);
            const isResult = resultSlotIndex === index;
            const isLanding = landingSlotIndex === index;

            return (
              <div
                key={`${slot.poolId}-${index}`}
                className="relative shrink-0"
                style={{ width: `${pegSpacing}px` }}
              >
                <div
                  className={`plinko-slot-bin h-full w-full ${isLanding ? 'plinko-slot-landing' : ''} ${isResult ? 'plinko-slot-result' : ''}`}
                  style={{
                    borderColor: tone.border,
                    background: `linear-gradient(to bottom, rgba(255,255,255,0.08), ${tone.bg} 24%)`,
                    boxShadow: `inset 0 -8px 14px rgba(0,0,0,0.34), inset 0 1px 0 rgba(255,255,255,0.13), 0 0 10px ${tone.glow}`
                  }}
                >
                  <div className="absolute inset-x-0 top-0 h-[7px]" style={{ background: 'linear-gradient(to bottom, rgba(255,255,255,0.24), rgba(255,255,255,0.02))' }} />
                  <div className="pt-3 text-center">
                    <div className="truncate px-0.5 text-[8px] font-bold uppercase tracking-[0.03em] text-white">{slot.label}</div>
                    <div className="mt-1 truncate px-0.5 text-[8px] text-gray-200">{preview?.name ?? 'No item'}</div>
                    <div className="mt-1 text-[8px] font-semibold text-emerald-200">{formatCompactValue(preview?.coinValue ?? 0)}</div>
                  </div>
                </div>
                {index < slotCount - 1 && <div className="absolute right-0 top-0 h-full w-px bg-white/15" />}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

const PlinkoBoard: React.FC<{
  board: PlinkoBoardType;
  pegSpacing: number;
  ballRow: number;
  ballX: number;
  slotPrizes: Record<number, SlotPrizePreview>;
  resultSlotIndex: number | null;
  landingSlotIndex: number | null;
}> = ({ board, pegSpacing, ballRow, ballX, slotPrizes, resultSlotIndex, landingSlotIndex }) => {
  const boardWidth = board.rows * pegSpacing + 80;
  const boardHeight = board.rows * pegSpacing + 220;

  return (
    <div className="mt-6 overflow-x-auto pb-2">
      <div className="relative mx-auto min-h-[500px] min-w-[340px] max-w-[920px] rounded-2xl border border-white/10 bg-[#02060a] p-3 shadow-[0_24px_45px_rgba(0,0,0,0.42)] sm:p-4">
        <div className="relative mx-auto" style={{ width: `${boardWidth}px`, height: `${boardHeight}px` }}>
          <PegGrid rows={board.rows} pegSpacing={pegSpacing} />

          {ballRow >= 0 && (
            <div
              className="absolute h-4 w-4 rounded-full bg-emerald-400 shadow-[0_0_14px_rgba(16,185,129,0.9)] transition-all duration-100"
              style={{ left: `calc(50% + ${ballX}px)`, top: `${ballRow * pegSpacing + 18}px`, transform: 'translate(-50%, -50%)' }}
            />
          )}

          <SlotRow
            board={board}
            pegSpacing={pegSpacing}
            slotPrizes={slotPrizes}
            resultSlotIndex={resultSlotIndex}
            landingSlotIndex={landingSlotIndex}
          />
        </div>
      </div>
    </div>
  );
};

export const PlinkoPage: React.FC = () => {
  const { isAuthenticated, openAuthModal, addInventoryItemFromServer, sellItem, syncBalance } = useGame();
  const [settings, setSettings] = useState<PlinkoSettings | null>(null);
  const [board, setBoard] = useState<PlinkoBoardType | null>(null);
  const [bet, setBet] = useState(100);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [ballRow, setBallRow] = useState(-1);
  const [ballX, setBallX] = useState(0);
  const [result, setResult] = useState<any | null>(null);
  const [landingSlotIndex, setLandingSlotIndex] = useState<number | null>(null);
  const [wonInventoryItem, setWonInventoryItem] = useState<InventoryItem | null>(null);
  const [isSelling, setIsSelling] = useState(false);
  const [slotPrizes, setSlotPrizes] = useState<Record<number, SlotPrizePreview>>({});
  const [pegSpacing, setPegSpacing] = useState(22);

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
    if (!board) return;

    const syncSpacing = () => {
      const viewport = window.innerWidth;
      const available = Math.max(320, Math.min(920, viewport - 64));
      const dynamicSpacing = Math.floor((available - 80) / Math.max(1, board.rows));
      setPegSpacing(Math.max(18, Math.min(30, dynamicSpacing)));
    };

    syncSpacing();
    window.addEventListener('resize', syncSpacing);
    return () => window.removeEventListener('resize', syncSpacing);
  }, [board]);

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
        const outwardRatio = Math.min(1, Math.abs(index - center) / Math.max(1, center));
        const pickIndex = Math.min(candidates.length - 1, Math.round((candidates.length - 1) * (0.35 + outwardRatio * 0.65)));
        previews[index] = candidates[pickIndex];
      });

      setSlotPrizes(previews);
    };

    void loadSlotPreviews();
  }, [board, settings, bet]);

  const runDrop = async () => {
    if (!isAuthenticated) {
      openAuthModal('login');
      return;
    }
    if (!board || !settings) return;

    setError(null);
    setIsLoading(true);
    setResult(null);
    setLandingSlotIndex(null);
    setWonInventoryItem(null);

    try {
      const payload = await attemptPlinko({ bet, clientSeed: `${Date.now()}` });
      const pathBits = Array.isArray(payload.pathBits)
        ? payload.pathBits.map((bit: any) => Number(bit))
        : String(payload.pathBits ?? '').split('').map((bit) => Number(bit));

      const targetSlot = Number(payload.slotIndex);
      setLandingSlotIndex(targetSlot);

      let rights = 0;
      for (let i = 0; i < pathBits.length; i += 1) {
        if (pathBits[i] === 1) rights += 1;
        setBallRow(i + 1);
        setBallX((rights - (i + 1) / 2) * pegSpacing);
        await sleep(90);
      }

      setBallX((targetSlot - board.rows / 2) * pegSpacing);
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

      setSlotPrizes((prev) => ({
        ...prev,
        [targetSlot]: {
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
      setLandingSlotIndex(null);
    } catch (dropError) {
      setError(dropError instanceof Error ? dropError.message : 'Drop failed.');
      setLandingSlotIndex(null);
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

  return (
    <div className="mx-auto w-full max-w-6xl p-3 sm:p-6">
      <style>{`
        @keyframes plinkoSlotGlow {
          from { filter: brightness(0.95); transform: translateZ(0); }
          to { filter: brightness(1.08); transform: translateZ(0); }
        }
        @keyframes plinkoSlotLand {
          0% { transform: scale(1); }
          50% { transform: scale(1.05); }
          100% { transform: scale(1); }
        }
        .plinko-slot-bin {
          position: relative;
          border-width: 1px;
          border-top-width: 0;
          border-radius: 0 0 10px 10px;
          animation: plinkoSlotGlow 2.6s ease-in-out infinite alternate;
          overflow: hidden;
          backdrop-filter: blur(2px);
        }
        .plinko-slot-landing {
          animation: plinkoSlotLand 0.45s ease-in-out infinite, plinkoSlotGlow 1.4s ease-in-out infinite alternate;
          box-shadow: inset 0 -10px 14px rgba(0,0,0,0.34), 0 0 18px rgba(52,211,153,0.55) !important;
          z-index: 2;
        }
        .plinko-slot-result {
          box-shadow: inset 0 -10px 14px rgba(0,0,0,0.34), 0 0 16px rgba(110,231,183,0.75) !important;
        }
      `}</style>

      <div className="rounded-2xl border border-emerald-500/30 bg-[#071016] p-4 shadow-[0_0_90px_rgba(34,197,94,0.1)] sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-black text-white sm:text-3xl">Plinko (Items)</h1>
            <p className="text-sm text-gray-400">Premium arcade board with connected landing bins and tier glow channels.</p>
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
            className="col-span-2 rounded-xl border border-white/10 bg-[#0b131c] px-3 py-2 text-sm text-white sm:col-span-4 lg:col-span-1"
            placeholder="Bet"
          />
        </div>

        {board && (
          <PlinkoBoard
            board={board}
            pegSpacing={pegSpacing}
            ballRow={ballRow}
            ballX={ballX}
            slotPrizes={slotPrizes}
            resultSlotIndex={result?.slotIndex ?? null}
            landingSlotIndex={landingSlotIndex}
          />
        )}

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
