import React, { useEffect, useMemo, useState } from 'react';
import { HelpCircle, History, Loader2, Volume2, VolumeX } from 'lucide-react';
import pullzLogo from '../assets/pullz-p.PNG';
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
    <svg className="absolute inset-0 h-full w-full" viewBox={`0 0 ${layout.boardWidth} ${layout.boardHeight}`} preserveAspectRatio="xMidYMid meet" aria-hidden>
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

const BinTilesRow: React.FC<{
  board: PlinkoBoardType;
  slotPrizes: Record<number, SlotPrizePreview>;
  resultSlotIndex: number | null;
  landingSlotIndex: number | null;
}> = ({ board, slotPrizes, resultSlotIndex, landingSlotIndex }) => (
  <div className="flex h-full w-full max-w-[760px] items-end gap-1">
    {board.slots.map((slot, index) => {
      const preview = slotPrizes[index];
      const tone = getSlotTone(slot.label);
      const isResult = resultSlotIndex === index;
      const isLanding = landingSlotIndex === index;

      return (
        <div
          key={`${slot.poolId}-${index}`}
          className={`plinko-slot-bin relative flex h-full min-w-0 flex-1 items-center justify-center rounded-sm px-0.5 md:rounded-md ${isLanding ? 'plinko-slot-landing' : ''} ${isResult ? 'plinko-slot-result' : ''}`}
          style={{
            borderColor: tone.border,
            background: `linear-gradient(to bottom, rgba(255,255,255,0.28), ${tone.bg} 35%)`,
            boxShadow: `inset 0 -5px 10px rgba(0,0,0,0.34), 0 0 8px ${tone.glow}`
          }}
        >
          <span className="truncate text-[7px] font-bold uppercase tracking-[0.02em] text-white lg:text-[9px]">{slot.label}</span>
          <span className="sr-only">{preview?.name ?? 'No item'} {formatCompactValue(preview?.coinValue ?? 0)}</span>
        </div>
      );
    })}
  </div>
);

const PlinkoTopNav: React.FC<{ balance: number }> = ({ balance }) => (
  <nav className="sticky top-0 z-10 w-full bg-gray-700 px-5 drop-shadow-lg">
    <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-3">
      <img className="h-6 sm:h-7" src={pullzLogo} alt="Pullz.gg" />
      <div className="mx-auto">
        <div className="flex overflow-hidden rounded-md">
          <div className="flex gap-2 bg-slate-900 px-3 py-2 text-sm font-semibold tabular-nums text-white sm:text-base">
            <span className="select-none text-gray-500">$</span>
            <span className="min-w-16 text-right">{Math.floor(balance).toLocaleString()}</span>
          </div>
          <button className="bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-500 active:bg-blue-700 sm:text-base">
            Add
          </button>
        </div>
      </div>
    </div>
  </nav>
);

const PlinkoSidebar: React.FC<{
  board: PlinkoBoardType | null;
  settings: PlinkoSettings | null;
  bet: number;
  setBet: (value: number) => void;
  isLoading: boolean;
  soundEnabled: boolean;
  onToggleSound: () => void;
  onDrop: () => void;
}> = ({ board, settings, bet, setBet, isLoading, soundEnabled, onToggleSound, onDrop }) => {
  const [mode, setMode] = useState<'manual' | 'auto'>('manual');
  const minBet = settings?.minBet ?? 100;
  const maxBet = settings?.maxBet ?? 50000;
  const dropDisabled = !settings?.enabled || isLoading || !board || bet < minBet || bet > maxBet;

  return (
    <div className="flex flex-col gap-5 bg-slate-700 p-3 lg:max-w-80">
      <div className="flex gap-1 rounded-full bg-slate-900 p-1">
        <button
          type="button"
          onClick={() => setMode('manual')}
          className={`flex-1 rounded-full py-2 text-sm font-medium text-white transition disabled:cursor-not-allowed disabled:opacity-50 hover:[&:not(:disabled)]:bg-slate-600 active:[&:not(:disabled)]:bg-slate-500 ${mode === 'manual' ? 'bg-slate-600' : ''}`}
        >
          Manual
        </button>
        <button
          type="button"
          onClick={() => setMode('auto')}
          className={`flex-1 rounded-full py-2 text-sm font-medium text-white transition disabled:cursor-not-allowed disabled:opacity-50 hover:[&:not(:disabled)]:bg-slate-600 active:[&:not(:disabled)]:bg-slate-500 ${mode === 'auto' ? 'bg-slate-600' : ''}`}
        >
          Auto
        </button>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-slate-300">Bet Amount</label>
        <div className="flex">
          <div className="relative flex-1">
            <span className="absolute left-3 top-2 select-none text-slate-500">$</span>
            <input
              type="number"
              value={bet}
              onChange={(event) => setBet(Number(event.target.value || 0))}
              min={minBet}
              max={maxBet}
              className="w-full rounded-l-md border-2 border-slate-600 bg-slate-900 py-2 pl-7 pr-2 text-sm text-white transition-colors hover:cursor-pointer focus:border-slate-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 hover:[&:not(:disabled)]:border-slate-500"
            />
          </div>
          <button type="button" onClick={() => setBet(Math.max(minBet, Math.floor(bet / 2)))} className="touch-manipulation bg-slate-600 px-4 font-bold diagonal-fractions text-white transition-colors disabled:cursor-not-allowed disabled:opacity-50 hover:[&:not(:disabled)]:bg-slate-500 active:[&:not(:disabled)]:bg-slate-400">1/2</button>
          <button type="button" onClick={() => setBet(Math.min(maxBet, Math.floor(bet * 2)))} className="relative touch-manipulation rounded-r-md bg-slate-600 px-4 text-sm font-bold text-white transition-colors after:absolute after:left-0 after:inline-block after:h-1/2 after:w-[2px] after:bg-slate-800 after:content-[''] disabled:cursor-not-allowed disabled:opacity-50 hover:[&:not(:disabled)]:bg-slate-500 active:[&:not(:disabled)]:bg-slate-400">2x</button>
        </div>
      </div>

      <div className="relative space-y-2">
        <label className="text-sm font-medium text-slate-300">Risk</label>
        <select className="block w-full appearance-none rounded-md border-2 border-slate-600 bg-slate-900 py-2 pl-3 pr-8 text-sm text-white transition hover:cursor-pointer focus:border-slate-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 hover:[&:not(:disabled)]:border-slate-500" value={board?.name ?? 'medium'} disabled>
          <option>{board?.name ?? 'medium'}</option>
        </select>
        <svg className="absolute right-3 top-9 text-slate-500" width="14" height="14" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
          <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.51a.75.75 0 01-1.08 0l-4.25-4.51a.75.75 0 01.02-1.06z" clipRule="evenodd" />
        </svg>
      </div>

      <div className="relative space-y-2">
        <label className="text-sm font-medium text-slate-300">Rows</label>
        <select className="block w-full appearance-none rounded-md border-2 border-slate-600 bg-slate-900 py-2 pl-3 pr-8 text-sm text-white transition hover:cursor-pointer focus:border-slate-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 hover:[&:not(:disabled)]:border-slate-500" value={board?.rows ?? settings?.rows ?? 16} disabled>
          <option>{board?.rows ?? settings?.rows ?? 16}</option>
        </select>
        <svg className="absolute right-3 top-9 text-slate-500" width="14" height="14" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
          <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.51a.75.75 0 01-1.08 0l-4.25-4.51a.75.75 0 01.02-1.06z" clipRule="evenodd" />
        </svg>
      </div>

      <button onClick={onDrop} disabled={dropDisabled} className="touch-manipulation rounded-md bg-green-500 py-3 font-semibold text-slate-900 transition-colors hover:bg-green-400 active:bg-green-600 disabled:bg-neutral-600 disabled:text-neutral-400">
        {isLoading ? <span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Dropping…</span> : 'Drop Ball'}
      </button>

      <div className="mt-auto pt-5">
        <div className="flex items-center gap-4 border-t border-slate-600 pt-3">
          <button type="button" onClick={onToggleSound} className="rounded-full p-2 text-slate-300 transition hover:bg-slate-600 active:bg-slate-500">
            {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
          </button>
          <button type="button" className="rounded-full p-2 text-slate-300 transition hover:bg-slate-600 active:bg-slate-500"><History className="h-4 w-4" /></button>
          <button type="button" className="rounded-full p-2 text-slate-300 transition hover:bg-slate-600 active:bg-slate-500"><HelpCircle className="h-4 w-4" /></button>
        </div>
      </div>
    </div>
  );
};

const PlinkoBoardPanel: React.FC<{
  board: PlinkoBoardType;
  layout: BoardLayout;
  ballMotion: BallMotion;
  isBallVisible: boolean;
  slotPrizes: Record<number, SlotPrizePreview>;
  resultSlotIndex: number | null;
  landingSlotIndex: number | null;
  history: string[];
}> = ({ board, layout, ballMotion, isBallVisible, slotPrizes, resultSlotIndex, landingSlotIndex, history }) => (
  <div className="relative bg-gray-900">
    <div className="mx-auto flex h-full flex-col px-4 pb-4" style={{ maxWidth: 760 }}>
      <div className="relative w-full" style={{ aspectRatio: '760 / 570' }}>
        <canvas className="absolute inset-0 h-full w-full" />
        <PegBoardSvg layout={layout} />

        {isBallVisible && (
          <div
            className="plinko-ball absolute h-4 w-4 rounded-full bg-emerald-400"
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

      <div className="flex h-[clamp(10px,0.352px+2.609vw,16px)] w-full justify-center lg:h-7">
        <BinTilesRow
          board={board}
          slotPrizes={slotPrizes}
          resultSlotIndex={resultSlotIndex}
          landingSlotIndex={landingSlotIndex}
        />
      </div>
    </div>

    <div className="absolute right-[5%] top-1/2 -translate-y-1/2">
      <div style={{ aspectRatio: '1 / 4' }} className="flex w-[clamp(1.5rem,0.893rem+2.857vw,2rem)] flex-col overflow-hidden rounded-sm text-[clamp(8px,5.568px+0.714vw,10px)] md:rounded-md lg:w-12 lg:text-sm">
        {history.map((entry, index) => (
          <div key={`${entry}-${index}`} className="flex flex-1 items-center justify-center border-b border-slate-700 bg-slate-800 text-slate-200 last:border-b-0">
            {entry}
          </div>
        ))}
      </div>
    </div>
  </div>
);

export const PlinkoPage: React.FC = () => {
  const { isAuthenticated, openAuthModal, addInventoryItemFromServer, sellItem, syncBalance, balance } = useGame();
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
  const [history, setHistory] = useState<string[]>(['—', '—', '—', '—']);

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
      setHistory((prev) => [formatCompactValue(inventoryItem.price), ...prev].slice(0, 4));
      setLandingSlotIndex(null);
    } catch (dropError) {
      setError(dropError instanceof Error ? dropError.message : 'Drop failed.');
      setLandingSlotIndex(null);
    } finally {
      setIsLoading(false);
      setIsBallVisible(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="relative flex min-h-dvh w-full flex-col">
        <PlinkoTopNav balance={balance} />
        <div className="flex-1 px-5">
          <div className="mx-auto mt-5 min-w-[300px] max-w-xl drop-shadow-xl md:mt-10 lg:max-w-7xl">
            <div className="rounded-lg bg-slate-700 p-6 text-center text-white">Sign in to drop and win real items.</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-dvh w-full flex-col">
      <style>{`
        @keyframes plinkoSlotGlow {
          from { filter: brightness(0.95) saturate(0.95); }
          to { filter: brightness(1.06) saturate(1.12); }
        }
        @keyframes plinkoSlotLand {
          0% { transform: translateY(0) scale(1); }
          50% { transform: translateY(-1px) scale(1.08); }
          100% { transform: translateY(0) scale(1); }
        }
        @keyframes plinkoBallPulse {
          0% { box-shadow: 0 0 10px rgba(16,185,129,0.55); }
          100% { box-shadow: 0 0 16px rgba(110,231,183,0.95); }
        }
        .plinko-slot-bin {
          position: relative;
          border-width: 1px;
          border-radius: 3px;
          animation: plinkoSlotGlow 2.4s ease-in-out infinite alternate;
          overflow: hidden;
          backdrop-filter: blur(1px);
        }
        .plinko-slot-landing {
          animation: plinkoSlotLand 0.5s ease-in-out infinite, plinkoSlotGlow 1.2s ease-in-out infinite alternate;
          box-shadow: inset 0 -10px 16px rgba(0,0,0,0.34), 0 0 20px rgba(52,211,153,0.75) !important;
          z-index: 2;
        }
        .plinko-slot-result {
          box-shadow: inset 0 -10px 14px rgba(0,0,0,0.34), 0 0 18px rgba(110,231,183,0.85) !important;
        }
        .plinko-ball {
          animation: plinkoBallPulse 420ms ease-in-out infinite alternate;
        }
      `}</style>

      <PlinkoTopNav balance={balance} />

      <div className="flex-1 px-5">
        <div className="mx-auto mt-5 min-w-[300px] max-w-xl drop-shadow-xl md:mt-10 lg:max-w-7xl">
          <div className="flex flex-col-reverse overflow-hidden rounded-lg lg:w-full lg:flex-row">
            <PlinkoSidebar
              board={board}
              settings={settings}
              bet={bet}
              setBet={setBet}
              isLoading={isLoading}
              soundEnabled={soundEnabled}
              onToggleSound={() => setSoundEnabled((prev) => !prev)}
              onDrop={() => { void runDrop(); }}
            />
            <div className="flex-1">
              {board && layout && (
                <PlinkoBoardPanel
                  board={board}
                  layout={layout}
                  ballMotion={ballMotion}
                  isBallVisible={isBallVisible}
                  slotPrizes={slotPrizes}
                  resultSlotIndex={result?.slotIndex ?? null}
                  landingSlotIndex={landingSlotIndex}
                  history={history}
                />
              )}
            </div>
          </div>
          {error && <div className="mt-3 rounded-md border border-rose-500/40 bg-rose-500/10 p-3 text-sm text-rose-200">{error}</div>}
        </div>
      </div>

      {result && wonInventoryItem && (
        <div className="fixed inset-0 z-[130] flex items-end justify-center bg-black/70 p-3 sm:items-center">
          <div className="w-full max-w-md rounded-2xl border border-emerald-400/40 bg-[#0a1018] p-5">
            <h2 className="text-xl font-black text-white">You won: {wonInventoryItem.name}</h2>
            <p className="mt-1 text-sm text-emerald-300">Slot {result.slotIndex + 1} · {result.slotLabel}</p>
            <img src={wonInventoryItem.image} alt={wonInventoryItem.name} className="mt-4 h-40 w-full rounded-xl bg-black/20 object-contain" />
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
