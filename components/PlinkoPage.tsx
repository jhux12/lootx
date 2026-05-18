import React, { useEffect, useMemo, useState } from 'react';
import { Loader2, Volume2, VolumeX } from 'lucide-react';
import { useGame } from '../context/GameContext';
import { attemptPlinko, getPlinkoBoard, getPlinkoSettings, listPlinkoPoolItems } from '../services/plinkoService';
import { PlinkoBoard as PlinkoBoardType, PlinkoSettings } from '../utils/plinko';
import { InventoryItem } from '../types';

const sleep = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));


const getRarityColor = (rarity?: string) => {
  const key = String(rarity ?? '').toLowerCase();
  if (key.includes('legend')) return '#fbbf24';
  if (key.includes('epic')) return '#a855f7';
  if (key.includes('uncommon')) return '#22c55e';
  if (key.includes('rare')) return '#3b82f6';
  return '#9ca3af';
};

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

type BallMotion = {
  x: number;
  y: number;
  ms: number;
  ease: string;
  scale: number;
};

type BoardLayout = {
  rows: number;
  slotCount: number;
  pegSpacing: number;
  rowHeight: number;
  topOffset: number;
  boardWidth: number;
  boardHeight: number;
  centerX: number;
  binsTop: number;
  binHeight: number;
  slotsStartX: number;
  pegs: Array<{ x: number; y: number; row: number; col: number }>;
  binCenters: number[];
};

const getSlotTone = (label: string): SlotTone => {
  const key = label.trim().toLowerCase();
  if (key.includes('jackpot')) return { border: '#ff5a1f', bg: 'rgba(43,16,7,0.94)', glow: 'rgba(255,84,26,0.7)' };
  if (key.includes('legendary')) return { border: '#fbbf24', bg: 'rgba(39,28,8,0.94)', glow: 'rgba(251,191,36,0.55)' };
  if (key.includes('epic')) return { border: '#a855f7', bg: 'rgba(31,18,45,0.94)', glow: 'rgba(168,85,247,0.5)' };
  if (key.includes('uncommon')) return { border: '#22c55e', bg: 'rgba(9,32,20,0.94)', glow: 'rgba(34,197,94,0.45)' };
  if (key.includes('rare')) return { border: '#3b82f6', bg: 'rgba(10,25,45,0.94)', glow: 'rgba(59,130,246,0.45)' };
  return { border: '#9ca3af', bg: 'rgba(20,24,31,0.94)', glow: 'rgba(156,163,175,0.22)' };
};

const formatCompactValue = (value: number) => {
  if (!Number.isFinite(value) || value <= 0) return '0';
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return `${Math.round(value)}`;
};

const createBoardLayout = (rows: number, pegSpacing: number): BoardLayout => {
  const slotCount = rows + 1;
  const rowHeight = pegSpacing * 0.94;
  const topOffset = 38;
  const boardWidth = Math.max(340, (rows + 2.5) * pegSpacing);
  const centerX = boardWidth / 2;
  const binsTop = topOffset + (rows - 1) * rowHeight + rowHeight * 0.8;
  const binHeight = Math.max(84, Math.min(98, pegSpacing * 4.1));
  const boardHeight = binsTop + binHeight + 18;
  const slotsStartX = centerX - (rows * pegSpacing) / 2;

  const pegs: Array<{ x: number; y: number; row: number; col: number }> = [];
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < row + 1; col += 1) {
      pegs.push({
        row,
        col,
        x: centerX + (col - row / 2) * pegSpacing,
        y: topOffset + row * rowHeight
      });
    }
  }

  const binCenters = Array.from({ length: slotCount }, (_, index) => slotsStartX + (index + 0.5) * pegSpacing);

  return {
    rows,
    slotCount,
    pegSpacing,
    rowHeight,
    topOffset,
    boardWidth,
    boardHeight,
    centerX,
    binsTop,
    binHeight,
    slotsStartX,
    pegs,
    binCenters
  };
};

const PegBoardSvg: React.FC<{ layout: BoardLayout }> = ({ layout }) => {
  const finalRowY = layout.topOffset + (layout.rows - 1) * layout.rowHeight;

  return (
    <svg className="h-full w-full" viewBox={`0 0 ${layout.boardWidth} ${layout.boardHeight}`} preserveAspectRatio="xMidYMid meet" aria-hidden>
      <defs>
        <radialGradient id="pegGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="rgba(255,255,255,0.95)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0.35)" />
        </radialGradient>
      </defs>

      {layout.binCenters.map((x, index) => (
        <line
          key={`channel-${index}`}
          x1={x}
          y1={finalRowY + 6}
          x2={x}
          y2={layout.binsTop - 2}
          stroke="rgba(140,176,230,0.2)"
          strokeWidth="1"
        />
      ))}

      {layout.pegs.map((peg) => (
        <g key={`${peg.row}-${peg.col}`}>
          <circle cx={peg.x} cy={peg.y} r="7" fill="rgba(255,255,255,0.09)" />
          <circle cx={peg.x} cy={peg.y} r="3.2" fill="url(#pegGlow)" />
        </g>
      ))}
    </svg>
  );
};

const SlotRow: React.FC<{
  board: PlinkoBoardType;
  layout: BoardLayout;
  slotPrizes: Record<number, SlotPrizePreview>;
  resultSlotIndex: number | null;
  landingSlotIndex: number | null;
}> = ({ board, layout, slotPrizes, resultSlotIndex, landingSlotIndex }) => {
  const centerSlot = Math.floor(layout.slotCount / 2);

  return (
    <div
      className="absolute"
      style={{
        left: `${layout.slotsStartX}px`,
        top: `${layout.binsTop}px`,
        width: `${layout.slotCount * layout.pegSpacing}px`,
        height: `${layout.binHeight}px`
      }}
    >
      <div
        className="pointer-events-none absolute top-[-38px] h-[38px] w-[2px] rounded-full"
        style={{
          left: `${(centerSlot + 0.5) * layout.pegSpacing}px`,
          transform: 'translateX(-50%)',
          background: 'linear-gradient(to bottom, rgba(110,231,183,0.7), rgba(110,231,183,0))',
          boxShadow: '0 0 12px rgba(16,185,129,0.55)'
        }}
      />

      <div className="flex h-full">
        {board.slots.map((slot, index) => {
          const preview = slotPrizes[index];
          const tone = getSlotTone(slot.label);
          const isResult = resultSlotIndex === index;
          const isLanding = landingSlotIndex === index;

          return (
            <div key={`${slot.poolId}-${index}`} className="relative shrink-0" style={{ width: `${layout.pegSpacing}px` }}>
              <div
                className={`plinko-slot-bin h-full w-full ${isLanding ? 'plinko-slot-landing' : ''} ${isResult ? 'plinko-slot-result' : ''}`}
                style={{
                  borderColor: tone.border,
                  background: `linear-gradient(to bottom, rgba(255,255,255,0.12), ${tone.bg} 24%)`,
                  boxShadow: `inset 0 -8px 14px rgba(0,0,0,0.38), inset 0 1px 0 rgba(255,255,255,0.13), 0 0 10px ${tone.glow}`
                }}
              >
                <div className="absolute inset-x-0 top-0 h-[8px]" style={{ background: 'linear-gradient(to bottom, rgba(255,255,255,0.26), rgba(255,255,255,0.02))' }} />
                <div className="pt-3 text-center">
                  <div className="truncate px-0.5 text-[8px] font-bold uppercase tracking-[0.03em] text-white">{slot.label}</div>
                  <div className="mt-1 truncate px-0.5 text-[8px] text-gray-200">{preview?.name ?? 'No item'}</div>
                  <div className="mt-1 text-[8px] font-semibold text-emerald-200">{formatCompactValue(preview?.coinValue ?? 0)}</div>
                </div>
              </div>
              {index < layout.slotCount - 1 && <div className="absolute right-0 top-0 h-full w-px bg-white/20" />}
            </div>
          );
        })}
      </div>
    </div>
  );
};

const PlinkoBoard: React.FC<{
  board: PlinkoBoardType;
  layout: BoardLayout;
  ballMotion: BallMotion;
  isBallVisible: boolean;
  slotPrizes: Record<number, SlotPrizePreview>;
  resultSlotIndex: number | null;
  landingSlotIndex: number | null;
}> = ({ board, layout, ballMotion, isBallVisible, slotPrizes, resultSlotIndex, landingSlotIndex }) => {
  return (
    <div className="mt-6 pb-1">
      <div className="mx-auto w-full max-w-[960px] rounded-2xl border border-white/10 bg-[#02060a] p-2 shadow-[0_24px_45px_rgba(0,0,0,0.42)] sm:p-4">
        <div className="relative mx-auto w-full max-w-[760px]">
          <div className="relative w-full" style={{ aspectRatio: `${layout.boardWidth} / ${layout.boardHeight}` }}>
            <PegBoardSvg layout={layout} />

            <SlotRow
              board={board}
              layout={layout}
              slotPrizes={slotPrizes}
              resultSlotIndex={resultSlotIndex}
              landingSlotIndex={landingSlotIndex}
            />

            {isBallVisible && (
              <div
                className="absolute h-4 w-4 rounded-full bg-emerald-400"
                style={{
                  left: `${(ballMotion.x / layout.boardWidth) * 100}%`,
                  top: `${(ballMotion.y / layout.boardHeight) * 100}%`,
                  transform: `translate(-50%, -50%) scale(${ballMotion.scale})`,
                  boxShadow: '0 0 14px rgba(16,185,129,0.9)',
                  transitionProperty: 'left, top, transform',
                  transitionDuration: `${ballMotion.ms}ms`,
                  transitionTimingFunction: ballMotion.ease,
                  zIndex: 4
                }}
              />
            )}
          </div>
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
  const [ballMotion, setBallMotion] = useState<BallMotion>({ x: 0, y: 0, ms: 120, ease: 'linear', scale: 1 });
  const [isBallVisible, setIsBallVisible] = useState(false);
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
      const available = Math.max(300, Math.min(960, viewport - 44));
      const dynamicSpacing = Math.floor((available - 120) / Math.max(1, board.rows));
      setPegSpacing(Math.max(16, Math.min(28, dynamicSpacing)));
    };

    syncSpacing();
    window.addEventListener('resize', syncSpacing);
    return () => window.removeEventListener('resize', syncSpacing);
  }, [board]);

  const layout = useMemo(() => (board ? createBoardLayout(board.rows, pegSpacing) : null), [board, pegSpacing]);

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
    if (!board || !settings || !layout) return;

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
      let currentX = layout.centerX;
      let currentY = layout.topOffset - layout.rowHeight * 0.6;

      setIsBallVisible(true);
      setBallMotion({ x: currentX, y: currentY, ms: 60, ease: 'linear', scale: 1 });
      await sleep(70);

      for (let i = 0; i < Math.min(pathBits.length, board.rows); i += 1) {
        const bit = pathBits[i] === 1 ? 1 : 0;
        const progress = i / Math.max(1, board.rows - 1);
        const baseDuration = Math.round(72 + progress * 78);
        currentX += bit === 1 ? layout.pegSpacing / 2 : -layout.pegSpacing / 2;
        currentY = layout.topOffset + i * layout.rowHeight;

        setBallMotion({ x: currentX, y: currentY - 3, ms: Math.round(baseDuration * 0.68), ease: 'cubic-bezier(0.24,0.86,0.2,1)', scale: 1.03 });
        await sleep(Math.round(baseDuration * 0.68));
        setBallMotion({ x: currentX, y: currentY, ms: Math.round(baseDuration * 0.32), ease: 'cubic-bezier(0.3,0,0.5,1)', scale: 0.97 });
        await sleep(Math.round(baseDuration * 0.32));
      }

      setLandingSlotIndex(targetSlot);
      await sleep(300);

      const finalX = layout.binCenters[targetSlot] ?? layout.centerX;
      const finalY = layout.binsTop + layout.binHeight * 0.35;
      setBallMotion({ x: finalX, y: finalY, ms: 340, ease: 'cubic-bezier(0.16,0.72,0.22,1)', scale: 1.06 });
      await sleep(340);

      const awarded = payload.awardedItem;
      const inventoryItem: InventoryItem = {
        id: awarded.itemId ?? awarded.id ?? payload.inventoryId,
        instanceId: payload.inventoryId,
        name: awarded.name,
        image: awarded.imageUrl,
        rarity: awarded.rarity ?? 'common',
        price: Number(awarded.coinValue ?? 0),
        chance: 0,
        color: getRarityColor(awarded.rarity),
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
      setIsBallVisible(false);
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
    <div className="mx-auto w-full max-w-6xl p-2 sm:p-6">
      <style>{`
        @keyframes plinkoSlotGlow {
          from { filter: brightness(0.96); }
          to { filter: brightness(1.08); }
        }
        @keyframes plinkoSlotLand {
          0% { transform: translateY(0) scale(1); }
          50% { transform: translateY(-2px) scale(1.05); }
          100% { transform: translateY(0) scale(1); }
        }
        .plinko-slot-bin {
          position: relative;
          border-width: 1px;
          border-top-width: 0;
          border-radius: 0 0 14px 14px;
          animation: plinkoSlotGlow 2.4s ease-in-out infinite alternate;
          overflow: hidden;
          backdrop-filter: blur(2px);
        }
        .plinko-slot-landing {
          animation: plinkoSlotLand 0.5s ease-in-out infinite, plinkoSlotGlow 1.2s ease-in-out infinite alternate;
          box-shadow: inset 0 -10px 16px rgba(0,0,0,0.34), 0 0 20px rgba(52,211,153,0.6) !important;
          z-index: 2;
        }
        .plinko-slot-result {
          box-shadow: inset 0 -10px 14px rgba(0,0,0,0.34), 0 0 18px rgba(110,231,183,0.75) !important;
        }
      `}</style>

      <div className="rounded-2xl border border-emerald-500/30 bg-[#071016] p-3 shadow-[0_0_90px_rgba(34,197,94,0.1)] sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-black text-white sm:text-3xl">Plinko (Items)</h1>
            <p className="text-sm text-gray-400">Arcade-style board with SVG pegs, aligned landing slots, and deterministic path animation.</p>
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

        {board && layout && (
          <PlinkoBoard
            board={board}
            layout={layout}
            ballMotion={ballMotion}
            isBallVisible={isBallVisible}
            slotPrizes={slotPrizes}
            resultSlotIndex={result?.slotIndex ?? null}
            landingSlotIndex={landingSlotIndex}
          />
        )}

        <button
          onClick={() => { void runDrop(); }}
          disabled={!settings?.enabled || isLoading || !board || !layout || bet < (settings?.minBet ?? 100) || bet > (settings?.maxBet ?? 50000)}
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
