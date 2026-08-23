import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import packImg from '../assets/slabpacks/pack.png';
import cardImg from '../assets/slabpacks/flareon-card.png';
import { useAuth, useBoxes, useInventory, useWallet } from '../context/GameContext';
import { authedFetch } from '../utils/authedFetch';
import { toast } from '../src/ui/toast/toast';
import { calculateExpectedValue } from '../utils/caseOdds';
import { getSellBackValue } from '../utils/sellBack';
import type { CaseItem } from '../types';

/**
 * Slab Packs
 * ----------
 * A standalone "pack opening" experience: browse three pricing tiers in a
 * 3D coverflow, buy one, pick a physical copy from a fanned-out row, then
 * tear it open for a reveal.
 *
 * REAL ECONOMY: each tier maps 1:1 to a real MysteryBox document (flagged
 * `isSlabPack: true` with `slabPackTier: 'bronze' | 'silver' | 'gold'` --
 * see the "Set as Slab Pack" checkbox in the admin box editor). Buying and
 * opening a pack calls the same `/api/open-case` endpoint every other case
 * on the site uses, so balance deduction, provably-fair RNG, and inventory
 * delivery are all real and already battle-tested -- nothing custom here.
 * The odds panel and "Potential Hits" grid are computed live from that
 * box's real `items` array, so whatever the admin configures shows up
 * automatically.
 */

type Tier = 'bronze' | 'silver' | 'gold';

interface TierVisuals {
  ribbon: string;
  filter: string;
  glow: string;
  ctaGradient: string;
}

const TIER_VISUALS: Record<Tier, TierVisuals> = {
  bronze: {
    ribbon: 'Tier I',
    filter: 'hue-rotate(-32deg) saturate(1.05) brightness(.98)',
    glow: 'radial-gradient(circle, rgba(255,159,110,.5), transparent 70%)',
    ctaGradient: 'linear-gradient(90deg, #ffcf9e, #ff9f6e)'
  },
  silver: {
    ribbon: 'Tier II',
    filter: '',
    glow: 'radial-gradient(circle, rgba(192,132,252,.5), rgba(110,231,255,.2) 45%, transparent 70%)',
    ctaGradient: 'linear-gradient(90deg, #6ee7ff, #c084fc)'
  },
  gold: {
    ribbon: 'Tier III',
    filter: 'hue-rotate(38deg) saturate(1.25) brightness(1.06)',
    glow: 'radial-gradient(circle, rgba(255,209,102,.55), transparent 70%)',
    ctaGradient: 'linear-gradient(90deg, #fff0bd, #ffd166)'
  }
};

// Inline `style.filter` fully replaces (rather than merges with) a CSS class's
// `filter` declaration, so any drop-shadow set in CSS never actually applies
// once a tier tint is also set inline. Combine both into one string instead.
const packImgFilter = (tint: string, shadow: string) => `${tint} drop-shadow(${shadow})`.trim();

const TIER_ORDER: Tier[] = ['bronze', 'silver', 'gold'];
const RARITY_COLOR: Record<string, string> = {
  common: '#9ca3af', uncommon: '#22c55e', rare: '#3b82f6', epic: '#a855f7', legendary: '#fbbf24'
};

const fmtCoins = (n: number) => Math.round(n).toLocaleString('en-US');
// Site economy: 100 coins = $1. Used only for display in the Odds table and
// Potential Hits -- the actual pack price/balance stay in coins.
const coinsToUsd = (coins: number) => coins / 100;
const fmtUsd = (coins: number) =>
  '$' + coinsToUsd(coins).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtUsdWhole = (coins: number) => '$' + Math.round(coinsToUsd(coins)).toLocaleString('en-US');

const TIER_LABEL: Record<Tier, string> = { bronze: 'Bronze', silver: 'Silver', gold: 'Gold' };
const fmtPct = (n: number) => `${parseFloat((Math.round(n * 100) / 100).toFixed(2))}%`;

const PICK_COPIES = 5;

interface OpenCaseResponse {
  ok: boolean;
  prize: CaseItem & { price?: number; value?: number };
  newCoinBalance?: number;
  newCoins?: number;
  inventoryId: string;
}

// ---------------------------------------------------------------------------
// Coverflow: a small drag/flick physics engine shared by the browse row and
// the pick-a-copy row. No native scrolling is used anywhere (deliberately --
// native scroll containers fought with the page's own scroll and with
// browser edge-swipe-navigation gestures during development).
// ---------------------------------------------------------------------------

interface CoverflowController {
  containerRef: React.RefObject<HTMLDivElement>;
  setContainerRef: (el: HTMLDivElement | null) => void;
  setCardRef: (i: number) => (el: HTMLDivElement | null) => void;
  goTo: (i: number) => void;
  current: () => number;
}

function useCoverflow(count: number, onChange?: (index: number) => void): CoverflowController {
  const containerRef = useRef<HTMLDivElement>(null);
  const cardsRef = useRef<(HTMLDivElement | null)[]>([]);
  const positionRef = useRef(0);
  const targetRef = useRef(0);
  const reportedRef = useRef(-1);
  const rafRef = useRef<number | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const clamp = useCallback((i: number) => Math.max(0, Math.min(count - 1, i)), [count]);

  const render = useCallback(() => {
    const cards = cardsRef.current;
    const position = positionRef.current;
    let spacing = 170;
    const first = cards[0];
    if (first) spacing = first.getBoundingClientRect().width * 0.66;

    cards.forEach((card, i) => {
      if (!card) return;
      const rel = i - position;
      const norm = Math.max(-1.5, Math.min(1.5, rel));
      const absNorm = Math.min(1, Math.abs(norm));
      const scale = 1 - absNorm * 0.22;
      const opacity = Math.max(0, 1 - Math.abs(norm) * 0.7);
      const rotateY = norm * -25;
      const translateZ = -Math.abs(norm) * 90;
      const translateX = rel * spacing;
      const lift = (1 - absNorm) * -6;
      card.style.transform =
        `translate(-50%, 0) translateX(${translateX}px) translateY(${lift}px) ` +
        `perspective(1200px) rotateY(${rotateY}deg) translateZ(${translateZ}px) scale(${scale})`;
      card.style.opacity = opacity.toFixed(3);
      card.style.zIndex = String(1000 - Math.round(Math.abs(rel) * 10));
    });

    const nearest = clamp(Math.round(position));
    if (nearest !== reportedRef.current) {
      reportedRef.current = nearest;
      onChangeRef.current?.(nearest);
    }

    const tallest = cards.reduce((max, c) => (c ? Math.max(max, c.getBoundingClientRect().height) : max), 0);
    if (containerRef.current && tallest > 0) {
      containerRef.current.style.height = tallest + 'px';
    }
  }, [clamp]);

  const settle = useCallback(() => {
    positionRef.current += (targetRef.current - positionRef.current) * 0.22;
    if (Math.abs(targetRef.current - positionRef.current) < 0.002) {
      positionRef.current = targetRef.current;
      render();
      rafRef.current = null;
      return;
    }
    render();
    rafRef.current = requestAnimationFrame(settle);
  }, [render]);

  const animateTo = useCallback((i: number) => {
    targetRef.current = clamp(i);
    if (rafRef.current === null) rafRef.current = requestAnimationFrame(settle);
  }, [clamp, settle]);

  const goTo = useCallback((i: number) => animateTo(i), [animateTo]);

  const setCardRef = useCallback((i: number) => (el: HTMLDivElement | null) => {
    cardsRef.current[i] = el;
  }, []);

  // Re-measure and re-render whenever the card count changes (e.g. switching
  // which tier's copies are shown on the pick screen).
  useEffect(() => {
    cardsRef.current = cardsRef.current.slice(0, count);
    positionRef.current = clamp(Math.round(positionRef.current));
    targetRef.current = positionRef.current;
    reportedRef.current = -1;
    requestAnimationFrame(render);
  }, [count, clamp, render]);

  const cleanupRef = useRef<(() => void) | null>(null);

  const attachListeners = useCallback((viewport: HTMLDivElement) => {
    let dragging = false;
    let dragMoved = false;
    let dragStartX = 0;
    let dragStartPos = 0;
    let lastX = 0;
    let lastT = 0;
    let vel = 0;

    const onPointerDown = (e: PointerEvent) => {
      if ((e.target as HTMLElement).closest('button, a')) return;
      dragging = true;
      dragMoved = false;
      dragStartX = e.clientX;
      dragStartPos = positionRef.current;
      lastX = e.clientX;
      lastT = performance.now();
      vel = 0;
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      viewport.classList.add('sp-dragging');
      viewport.setPointerCapture(e.pointerId);
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!dragging) return;
      const dx = e.clientX - dragStartX;
      if (Math.abs(dx) > 4) dragMoved = true;
      if (dragMoved) e.preventDefault();

      const first = cardsRef.current[0];
      const spacing = first ? first.getBoundingClientRect().width * 0.66 : 170;
      let raw = dragStartPos - dx / spacing;
      if (raw < 0) raw = raw * 0.35;
      if (raw > count - 1) raw = (count - 1) + (raw - (count - 1)) * 0.35;
      positionRef.current = raw;
      targetRef.current = raw;
      render();

      const now = performance.now();
      const dt = now - lastT;
      if (dt > 0) vel = (e.clientX - lastX) / dt;
      lastX = e.clientX;
      lastT = now;
    };

    const endDrag = () => {
      if (!dragging) return;
      dragging = false;
      viewport.classList.remove('sp-dragging');
      let base = Math.round(positionRef.current);
      if (Math.abs(vel) > 0.55) base = Math.round(positionRef.current) + (vel < 0 ? 1 : -1);
      animateTo(clamp(base));
    };

    const onClickCapture = (e: MouseEvent) => {
      if (dragMoved) {
        e.preventDefault();
        e.stopPropagation();
        dragMoved = false;
      }
    };

    let resizeRaf: number | null = null;
    const onResize = () => {
      if (resizeRaf !== null) return;
      resizeRaf = requestAnimationFrame(() => {
        resizeRaf = null;
        render();
      });
    };

    viewport.addEventListener('pointerdown', onPointerDown);
    viewport.addEventListener('pointermove', onPointerMove, { passive: false });
    viewport.addEventListener('pointerup', endDrag);
    viewport.addEventListener('pointercancel', endDrag);
    viewport.addEventListener('click', onClickCapture, true);
    window.addEventListener('resize', onResize);

    return () => {
      viewport.removeEventListener('pointerdown', onPointerDown);
      viewport.removeEventListener('pointermove', onPointerMove);
      viewport.removeEventListener('pointerup', endDrag);
      viewport.removeEventListener('pointercancel', endDrag);
      viewport.removeEventListener('click', onClickCapture, true);
      window.removeEventListener('resize', onResize);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count, clamp, animateTo, render]);

  // A plain useRef + a fixed-dependency useEffect isn't enough here: the
  // Pick screen (and its coverflow viewport) only exists in the DOM while
  // pageView === 'pick'. On first mount that DOM node doesn't exist yet, so
  // an effect keyed on `count` (which never changes for a fixed PICK_COPIES)
  // would attach nothing and then never run again. A ref *callback* instead
  // fires exactly when React actually attaches/detaches the DOM node --
  // i.e. every time the Pick screen mounts and unmounts -- so listeners get
  // (re)attached correctly no matter how many times the user navigates
  // to and from this screen.
  const setContainerRef = useCallback((node: HTMLDivElement | null) => {
    if (cleanupRef.current) {
      cleanupRef.current();
      cleanupRef.current = null;
    }
    containerRef.current = node;
    if (node) {
      cleanupRef.current = attachListeners(node);
      requestAnimationFrame(render);
    }
  }, [attachListeners, render]);

  useEffect(() => {
    return () => {
      if (cleanupRef.current) {
        cleanupRef.current();
        cleanupRef.current = null;
      }
    };
  }, []);

  const current = useCallback(() => reportedRef.current, []);

  return { containerRef, setContainerRef, setCardRef, goTo, current };
}

// ---------------------------------------------------------------------------
// Small presentational pieces
// ---------------------------------------------------------------------------

const FanCardArt: React.FC<{ visuals: TierVisuals; alt: string; fast?: boolean }> = ({ visuals, alt, fast }) => (
  <div className="sp-fan-card-art">
    <div className="sp-fan-card-glow" style={{ background: visuals.glow }} />
    <img className="sp-fan-card-img" src={packImg} alt={alt} style={{ filter: packImgFilter(visuals.filter, '0 22px 34px rgba(0,0,0,.6)') }} draggable={false} />
    <div className={`sp-foil-shine${fast ? ' sp-fast' : ''}`} style={{ WebkitMaskImage: `url(${packImg})`, maskImage: `url(${packImg})` }} />
  </div>
);

const FanCardReflect: React.FC<{ visuals: TierVisuals }> = ({ visuals }) => (
  <div className="sp-fan-card-reflect">
    <img src={packImg} alt="" style={{ filter: visuals.filter || undefined }} draggable={false} />
  </div>
);

const Particle: React.FC<{ px: number; py: number; color: string }> = ({ px, py, color }) => {
  const style: React.CSSProperties = {
    ['--px' as any]: px + 'px',
    ['--py' as any]: py + 'px',
    background: color,
    boxShadow: `0 0 8px ${color}`
  };
  return <div className="sp-particle sp-go" style={style} />;
};

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

type PageView = 'browse' | 'pick' | 'open';
type OpenStage = 'idle' | 'shaking' | 'exploding' | 'revealed';

export const SlabPacks: React.FC = () => {
  const { isAuthenticated, openAuthModal } = useAuth();
  const { balance, syncBalance } = useWallet();
  const { boxes } = useBoxes();
  const { sellItem } = useInventory();

  const slabBoxes = useMemo(() => {
    const map: Partial<Record<Tier, ReturnType<typeof boxes.find>>> = {};
    for (const tier of TIER_ORDER) {
      map[tier] = boxes.find((b) => b.isSlabPack && b.slabPackTier === tier);
    }
    return map as Record<Tier, (typeof boxes)[number] | undefined>;
  }, [boxes]);

  const configuredTiers = TIER_ORDER.filter((t) => slabBoxes[t]);

  const [pageView, setPageView] = useState<PageView>('browse');
  const [selectedTier, setSelectedTier] = useState<Tier | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [remainingOpens, setRemainingOpens] = useState(0);
  const [pendingTier, setPendingTier] = useState<Tier | null>(null);
  const [openTier, setOpenTier] = useState<Tier | null>(null);
  const [openStage, setOpenStage] = useState<OpenStage>('idle');
  const [opening, setOpening] = useState(false);
  const [prize, setPrize] = useState<(CaseItem & { price?: number; value?: number }) | null>(null);
  const [wonInventoryId, setWonInventoryId] = useState<string | null>(null);
  const [rewardResolved, setRewardResolved] = useState(false);
  const [isSellingItem, setIsSellingItem] = useState(false);
  const [particles, setParticles] = useState<{ id: number; px: number; py: number; color: string }[]>([]);
  const particleIdRef = useRef(0);
  const [cardTilt, setCardTilt] = useState({ x: 0, y: 0 });

  const pickCF = useCoverflow(PICK_COPIES);

  useEffect(() => {
    if (configuredTiers.length === 0) return;
    if (selectedTier && configuredTiers.includes(selectedTier)) return;
    const preferred: Tier = 'silver';
    setSelectedTier(configuredTiers.includes(preferred) ? preferred : configuredTiers[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configuredTiers.join(',')]);

  const spawnParticles = useCallback((count: number, colors: string[], spread: [number, number], life: number) => {
    const batch = Array.from({ length: count }, () => {
      const angle = Math.random() * Math.PI * 2;
      const dist = spread[0] + Math.random() * spread[1];
      return {
        id: particleIdRef.current++,
        px: Math.cos(angle) * dist,
        py: Math.sin(angle) * dist,
        color: colors[Math.floor(Math.random() * colors.length)]
      };
    });
    setParticles((prev) => [...prev, ...batch]);
    window.setTimeout(() => {
      const ids = new Set(batch.map((p) => p.id));
      setParticles((prev) => prev.filter((p) => !ids.has(p.id)));
    }, life);
  }, []);

  const buyPack = (tier: Tier, qty: number) => {
    if (!isAuthenticated) {
      openAuthModal('login');
      return;
    }
    const box = slabBoxes[tier];
    if (!box) return;
    if (balance < box.price * qty) {
      toast.error("You don't have enough coins for this.");
      return;
    }
    setRemainingOpens(qty);
    setPendingTier(tier);
    setPageView('pick');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    window.setTimeout(() => pickCF.goTo(Math.floor(PICK_COPIES / 2)), 0);
  };

  const openPurchasedPack = () => {
    if (!pendingTier) return;
    setOpenTier(pendingTier);
    setOpenStage('idle');
    setPrize(null);
    setWonInventoryId(null);
    setRewardResolved(false);
    setPageView('open');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const startOpen = async () => {
    if (openStage !== 'idle' || opening) return;
    if (!openTier) return;
    const box = slabBoxes[openTier];
    if (!box) return;
    if (!isAuthenticated) {
      openAuthModal('login');
      return;
    }

    setOpening(true);
    setOpenStage('shaking');
    setRewardResolved(false);

    const minShake = new Promise((resolve) => window.setTimeout(resolve, 650));
    const apiCall = authedFetch<OpenCaseResponse>('/api/open-case', {
      method: 'POST',
      body: JSON.stringify({ boxId: box.id })
    });

    try {
      const [data] = await Promise.all([apiCall, minShake]);
      setPrize(data.prize);
      setWonInventoryId(data.inventoryId ?? null);
      // Get a head start on downloading the real prize image during the
      // burst animation, so it's as likely as possible to already be
      // cached/decoded by the time the reveal actually makes it visible.
      if (data.prize?.image) {
        const preload = new window.Image();
        preload.src = data.prize.image;
      }
      const nextBalance = typeof data.newCoinBalance === 'number' ? data.newCoinBalance : data.newCoins;
      if (typeof nextBalance === 'number') syncBalance(nextBalance);

      setOpenStage('exploding');
      spawnParticles(32, ['#6ee7ff', '#c084fc', '#ffd166', '#ffffff'], [200, 380], 1300);
      window.setTimeout(() => {
        setOpenStage('revealed');
        spawnParticles(46, ['#ffd166', '#ffe9a8', '#c084fc', '#6ee7ff', '#ffffff'], [60, 460], 1500);
      }, 260);
      setRemainingOpens((r) => Math.max(0, r - 1));
    } catch (err) {
      await minShake;
      const message = err instanceof Error ? err.message : 'Unable to open this pack. Please try again.';
      toast.error(message);
      setOpenStage('idle');
    } finally {
      setOpening(false);
    }
  };

  const handleKeepPrize = () => {
    if (rewardResolved) return;
    setRewardResolved(true);
  };

  const handleSellPrize = async () => {
    if (rewardResolved || isSellingItem) return;
    if (!wonInventoryId) {
      // Nothing to sell back yet (e.g. still mid-animation) -- just treat as keep.
      setRewardResolved(true);
      return;
    }
    if (prize?.redeemable === false) {
      toast.error('This item is not redeemable and cannot be sold back.');
      return;
    }
    setIsSellingItem(true);
    try {
      await sellItem(wonInventoryId);
      setRewardResolved(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to sell this item. Please try again.';
      toast.error(message);
    } finally {
      setIsSellingItem(false);
    }
  };

  const resetToOpen = () => {
    if (!rewardResolved) {
      toast.info('Keep or sell your card first.');
      return;
    }
    setOpenStage('idle');
    setPrize(null);
    setWonInventoryId(null);
    setRewardResolved(false);
  };

  const backToBrowse = () => {
    if (openStage === 'revealed' && !rewardResolved) {
      toast.info('Keep or sell your card first.');
      return;
    }
    setPageView('browse');
    setOpenStage('idle');
    setPrize(null);
    setWonInventoryId(null);
    setRewardResolved(false);
    setRemainingOpens(0);
    setQuantity(1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const activeBox = selectedTier ? slabBoxes[selectedTier] : undefined;

  const heroSwipeRef = useRef({ startX: 0, active: false });
  const changeTierByOffset = (offset: number) => {
    if (!selectedTier) return;
    const idx = configuredTiers.indexOf(selectedTier);
    const nextIdx = Math.max(0, Math.min(configuredTiers.length - 1, idx + offset));
    if (nextIdx !== idx) setSelectedTier(configuredTiers[nextIdx]);
  };
  const onHeroPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    heroSwipeRef.current = { startX: e.clientX, active: true };
  };
  const onHeroPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!heroSwipeRef.current.active) return;
    const dx = e.clientX - heroSwipeRef.current.startX;
    heroSwipeRef.current.active = false;
    if (Math.abs(dx) > 40) changeTierByOffset(dx < 0 ? 1 : -1);
  };
  const onHeroPointerCancel = () => { heroSwipeRef.current.active = false; };

  const oddsRows = useMemo(() => {
    if (!activeBox) return [];

    // Admin-configured custom ranges take priority when set. Admins enter
    // these directly in dollars, so convert back to coins here (x100) to
    // match the rest of this computation -- the renderer always expects
    // coin-denominated min/max and converts to dollars for display itself.
    if (activeBox.slabPackOddsRanges && activeBox.slabPackOddsRanges.length > 0) {
      return activeBox.slabPackOddsRanges.map((r, i) => ({
        rarity: `custom-${i}`,
        pct: r.chance,
        min: r.min * 100,
        max: r.max * 100
      }));
    }

    const groups = new Map<string, { chance: number; min: number; max: number }>();
    activeBox.items.forEach((item) => {
      const g = groups.get(item.rarity) ?? { chance: 0, min: Infinity, max: -Infinity };
      g.chance += item.chance;
      g.min = Math.min(g.min, item.price);
      g.max = Math.max(g.max, item.price);
      groups.set(item.rarity, g);
    });
    const order: CaseItem['rarity'][] = ['legendary', 'epic', 'rare', 'uncommon', 'common'];
    return order
      .filter((r) => groups.has(r))
      .map((r) => {
        const g = groups.get(r)!;
        return { rarity: r as string, pct: g.chance, min: g.min, max: g.max };
      });
  }, [activeBox]);

  const expectedValue = useMemo(() => {
    if (!activeBox) return 0;
    if (activeBox.slabPackOddsRanges && activeBox.slabPackOddsRanges.length > 0) {
      const evDollars = activeBox.slabPackOddsRanges.reduce(
        (sum, r) => sum + ((r.min + r.max) / 2) * (r.chance / 100),
        0
      );
      return evDollars * 100; // back to coins so fmtUsd's /100 stays uniform everywhere
    }
    return calculateExpectedValue(activeBox.items);
  }, [activeBox]);

  const potentialHits = useMemo(() => {
    if (!activeBox) return [];
    return activeBox.items
      .filter((item) => item.rarity === 'legendary')
      .sort((a, b) => b.price - a.price);
  }, [activeBox]);

  const handleCardMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    setCardTilt({ x: x * 16, y: -y * 16 });
  };

  const openBox = openTier ? slabBoxes[openTier] : undefined;
  const openVisuals = openTier ? TIER_VISUALS[openTier] : TIER_VISUALS.silver;
  const prizeImage = prize?.image || cardImg;
  const prizeValue = prize ? (prize.value ?? prize.price ?? 0) : 0;
  const prizeRarityColor = prize ? (RARITY_COLOR[prize.rarity] ?? RARITY_COLOR.common) : RARITY_COLOR.common;
  const sellBackRate = openBox?.sellBackRate ?? 0.8;
  const sellBackAmount = prize ? getSellBackValue(prizeValue, sellBackRate) : 0;

  if (configuredTiers.length === 0) {
    return (
      <div className="sp-root">
        <style>{SLAB_PACKS_CSS}</style>
        <div className="sp-view-heading" style={{ padding: '48px 24px' }}>
          <h1>Slab Packs are coming soon</h1>
          <p>An admin needs to configure at least one Bronze, Silver, or Gold pack in the box editor first.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="sp-root">
      <style>{SLAB_PACKS_CSS}</style>

      <div className="sp-stage">
        {pageView === 'browse' && activeBox && selectedTier && (
        <div className="sp-view sp-browse-view">
          <div
            className="sp-hero-pack"
            onPointerDown={onHeroPointerDown}
            onPointerUp={onHeroPointerUp}
            onPointerCancel={onHeroPointerCancel}
          >
            <div className="sp-pack-glow" style={{ background: TIER_VISUALS[selectedTier].glow }} />
            <img className="sp-hero-pack-img" src={packImg} alt={activeBox.name} style={{ filter: packImgFilter(TIER_VISUALS[selectedTier].filter, '0 22px 40px rgba(0,0,0,.55)') }} draggable={false} />
            <div className="sp-foil-shine" style={{ WebkitMaskImage: `url(${packImg})`, maskImage: `url(${packImg})` }} />
          </div>

          <div className="sp-detail-panel">
            <h1 className="sp-detail-title">{activeBox.name}</h1>
            <p className="sp-detail-desc">
              Open a {activeBox.name} and unlock a graded card &mdash; ready to keep, vault, or sell. Every pull holds real value.
            </p>

            <div className="sp-tier-tabs">
              {configuredTiers.map((tier) => {
                const box = slabBoxes[tier]!;
                const visuals = TIER_VISUALS[tier];
                const active = tier === selectedTier;
                return (
                  <button
                    key={tier}
                    type="button"
                    className={`sp-tier-tab${active ? ' sp-tier-tab-active' : ''}`}
                    onClick={() => setSelectedTier(tier)}
                  >
                    <img className="sp-tier-tab-thumb" src={packImg} alt="" style={{ filter: visuals.filter }} draggable={false} />
                    <span className="sp-tier-tab-name">{TIER_LABEL[tier]}</span>
                    <span className="sp-tier-tab-price"><span className="sp-coin-icon sp-coin-icon-sm" />{fmtCoins(box.price)}</span>
                  </button>
                );
              })}
            </div>

            <div className="sp-info-section">
              <div className="sp-info-section-head">
                <h2>Odds <span className="sp-info-icon" title="Odds are computed live from this pack's real prize pool.">&#9432;</span></h2>
                <div className="sp-ev">Expected Value: <b>{fmtUsd(expectedValue)}</b></div>
              </div>
              <div className="sp-odds-grid">
                {oddsRows.map(({ rarity, pct, min, max }) => (
                  <div className="sp-odds-row" key={rarity}>
                    <span className="sp-range">{min === max ? fmtUsdWhole(min) : `${fmtUsdWhole(min)}-${fmtUsdWhole(max)}`}</span>
                    <span className="sp-leader" />
                    <span className="sp-pct">{fmtPct(pct)}</span>
                  </div>
                ))}
                {oddsRows.length === 0 && <p style={{ color: 'var(--sp-text-dim)', fontSize: 13 }}>No items configured for this pack yet.</p>}
              </div>
            </div>

            <div className="sp-info-section">
              <div className="sp-info-section-head">
                <h2>Potential Hits</h2>
              </div>
              <div className="sp-hits-grid-2col">
                {potentialHits.map((item) => (
                  <div className="sp-hit-card-v2" key={item.id}>
                    <div className="sp-hit-card-v2-img"><img src={item.image || cardImg} alt={item.name} loading="lazy" /></div>
                    <div className="sp-hit-card-v2-price">{fmtUsd(item.price)} est.</div>
                  </div>
                ))}
                {potentialHits.length === 0 && <p style={{ color: 'var(--sp-text-dim)', fontSize: 13 }}>No legendary items configured for this pack yet.</p>}
              </div>
            </div>

            <div className="sp-buy-bar">
              <div className="sp-buy-bar-price"><span className="sp-coin-icon" />{fmtCoins(activeBox.price * quantity)}</div>
              <div className="sp-qty-stepper">
                <button type="button" onClick={() => setQuantity((q) => Math.max(1, q - 1))} aria-label="Decrease quantity">&minus;</button>
                <span>{quantity}</span>
                <button type="button" onClick={() => setQuantity((q) => Math.min(10, q + 1))} aria-label="Increase quantity">+</button>
              </div>
              <button type="button" className="sp-buy-now-btn" style={{ background: TIER_VISUALS[selectedTier].ctaGradient }} onClick={() => buyPack(selectedTier, quantity)}>
                Buy Now
              </button>
            </div>
          </div>
        </div>
        )}

        {pageView === 'pick' && (
        <div className="sp-view">
          <button type="button" className="sp-back-btn" onClick={backToBrowse}>&larr; Back to Packs</button>
          <div className="sp-view-heading">
            <h1>Pick a Pack</h1>
            <p>
              {pendingTier ? slabBoxes[pendingTier]?.name : ''} purchased &mdash; every copy holds the same odds
              {remainingOpens > 1 ? ` (${remainingOpens} to open)` : ''}
            </p>
          </div>
          <div className="sp-coverflow-outer">
            <button type="button" className="sp-arrow sp-left" onClick={() => pickCF.goTo(pickCF.current() - 1)} aria-label="Previous copy">&#8249;</button>
            <div className="sp-coverflow-viewport" ref={pickCF.setContainerRef}>
              <div className="sp-coverflow-track">
                {pendingTier && Array.from({ length: PICK_COPIES }).map((_, i) => {
                  const visuals = TIER_VISUALS[pendingTier];
                  return (
                    <div key={i} className="sp-fan-card sp-fan-card-pick" ref={pickCF.setCardRef(i)}>
                      <FanCardArt visuals={visuals} alt={slabBoxes[pendingTier]?.name ?? 'Pack'} />
                      <FanCardReflect visuals={visuals} />
                    </div>
                  );
                })}
              </div>
            </div>
            <button type="button" className="sp-arrow sp-right" onClick={() => pickCF.goTo(pickCF.current() + 1)} aria-label="Next copy">&#8250;</button>
          </div>

          {pendingTier && (
            <button
              type="button"
              className="sp-cta-btn sp-cta-btn-solo"
              style={{ background: TIER_VISUALS[pendingTier].ctaGradient }}
              onClick={openPurchasedPack}
            >
              Open This Pack
            </button>
          )}
        </div>
        )}

        {pageView === 'open' && (
        <div className="sp-view">
          <button type="button" className="sp-back-btn" onClick={backToBrowse}>&larr; Back to Packs</button>

          <div className="sp-reveal-stage">
            <div
              className={`sp-pack-wrap${openStage === 'shaking' ? ' sp-shaking' : ''}${openStage === 'exploding' || openStage === 'revealed' ? ' sp-hidden-pack' : ''}`}
              onClick={startOpen}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); startOpen(); } }}
              aria-label="Open pack"
            >
              <div className="sp-pack-glow" />
              <img className="sp-pack-img" src={packImg} alt={openBox?.name ?? 'Card pack'} style={{ filter: packImgFilter(openVisuals.filter, '0 26px 42px rgba(0,0,0,.6)') }} draggable={false} />
              <div className={`sp-foil-shine${openStage === 'shaking' ? ' sp-fast' : ''}`} style={{ WebkitMaskImage: `url(${packImg})`, maskImage: `url(${packImg})` }} />
              {(openStage === 'exploding') && <div className="sp-pack-flash-out" />}
            </div>

            <div className={`sp-card-wrap${openStage === 'revealed' ? ' sp-reveal' : ''}`}>
              <div className="sp-card-halo" />
              <div className="sp-card-inner" onMouseMove={handleCardMouseMove} onMouseLeave={() => setCardTilt({ x: 0, y: 0 })} style={{ transform: `rotateY(${cardTilt.x}deg) rotateX(${cardTilt.y}deg)` }}>
                {prize && <img className="sp-card-img" src={prizeImage} alt={prize.name} draggable={false} />}
                <div className="sp-holo-sweep" />
              </div>
            </div>

            {openStage === 'exploding' && (
              <>
                <div className="sp-flash sp-go" />
                <div className="sp-rays sp-go"><div className="sp-ray-inner" /></div>
                <div className="sp-shockwave sp-go" />
              </>
            )}
            <div className="sp-particles">
              {particles.map((p) => <Particle key={p.id} px={p.px} py={p.py} color={p.color} />)}
            </div>
          </div>

          <div className={`sp-prompt${openStage !== 'idle' ? ' sp-hidden' : ''}`}>
            <div className="sp-tap">{opening ? 'Opening\u2026' : 'Tap the pack to open'}</div>
          </div>

          <div className="sp-card-slot">
            <div className={`sp-rarity-tag${openStage === 'revealed' ? ' sp-show' : ''}`}>
              <div className="sp-rarity-eyebrow">&#10024; You Pulled &#10024;</div>
              <div className="sp-rarity-name" style={{ backgroundImage: `linear-gradient(90deg, ${prizeRarityColor}, var(--sp-holo-b), ${prizeRarityColor})` }}>{prize?.name ?? ''}</div>
              <div className="sp-rarity-sub">{prize ? `${fmtCoins(prizeValue)} coins \u00b7 ${prize.rarity}` : ''}</div>
            </div>

            {openStage === 'revealed' && !rewardResolved && (
              <div className="sp-keep-sell-row">
                <button type="button" className="sp-keep-btn" onClick={handleKeepPrize}>
                  Keep This Card
                </button>
                {prize?.redeemable !== false && (
                  <button type="button" className="sp-sell-btn" onClick={handleSellPrize} disabled={isSellingItem}>
                    {isSellingItem ? 'Selling\u2026' : `Sell for ${fmtCoins(sellBackAmount)} coins`}
                  </button>
                )}
              </div>
            )}

            <button
              type="button"
              className={`sp-again-btn${openStage === 'revealed' && rewardResolved ? ' sp-show' : ''}`}
              onClick={remainingOpens > 0 ? resetToOpen : backToBrowse}
            >
              {remainingOpens > 0 ? `Open Next Pack (${remainingOpens} left)` : 'Back to Packs'}
            </button>
          </div>
        </div>
        )}
      </div>

      <div className="sp-footer-note">Hold steady &mdash; good luck</div>
    </div>
  );
};

const SLAB_PACKS_CSS = `
.sp-root{ --sp-void:#08070d; --sp-holo-a:#6ee7ff; --sp-holo-b:#c084fc; --sp-holo-c:#ffd166; --sp-text:#f5f2fc; --sp-text-dim:#a49cc4; --sp-gold:#ffd166;
  position:relative; width:100%; display:flex; flex-direction:column; overflow-x:hidden;
  background: radial-gradient(ellipse 120% 60% at 50% 0%, #1e1836 0%, var(--sp-void) 60%), var(--sp-void);
  color:var(--sp-text); font-family:'Segoe UI', system-ui, -apple-system, sans-serif; }
.sp-coin-icon{ width:22px; height:22px; border-radius:50%; background:radial-gradient(circle at 35% 30%, #fff6d8, var(--sp-gold) 55%, #b9840f 100%); box-shadow:0 0 0 1px rgba(0,0,0,.25) inset, 0 1px 3px rgba(0,0,0,.4); flex-shrink:0; display:inline-block; }
.sp-stage{ width:100%; display:flex; flex-direction:column; align-items:center; }
.sp-view{ position:relative; width:100%; display:flex; flex-direction:column; align-items:center; padding:clamp(20px,4vh,32px) 0 clamp(32px,6vh,48px); }
.sp-view-heading{ text-align:center; margin-bottom:clamp(18px,2.6vh,26px); padding:0 20px; }
.sp-view-heading h1{ margin:0; font-size:clamp(24px,4.6vw,34px); font-weight:800; }
.sp-view-heading p{ margin:9px 0 0; font-size:clamp(13px,2.4vw,15px); color:var(--sp-text-dim); }
.sp-browse-view{ padding-top:clamp(24px,4vh,36px); }
.sp-hero-pack{ position:relative; z-index:4; width:min(52vw,260px); margin:0 auto; touch-action:pan-y; cursor:grab; user-select:none; }
.sp-hero-pack-img{ width:100%; display:block; position:relative; z-index:1; aspect-ratio:520/780; transition:filter .25s ease; }
.sp-detail-panel{ width:100%; max-width:560px; margin:clamp(20px,3.5vh,30px) auto 0; padding:0 clamp(18px,4vw,26px) clamp(24px,4vh,32px); padding-bottom:calc(120px + var(--pullz-mobile-bottom-nav-height, 0px)); }
@media (min-width:1024px){ .sp-detail-panel{ padding-bottom:110px; } }
.sp-detail-title{ margin:0; text-align:center; font-size:clamp(22px,4.4vw,30px); font-weight:800; }
.sp-detail-desc{ margin:10px 0 0; text-align:center; font-size:clamp(13px,2.4vw,15px); line-height:1.5; color:var(--sp-text-dim); }
.sp-tier-tabs{ display:flex; gap:10px; margin-top:clamp(18px,3vh,26px); overflow-x:auto; padding-bottom:2px; scrollbar-width:none; }
.sp-tier-tabs::-webkit-scrollbar{ display:none; }
.sp-tier-tab{ flex:1 0 auto; min-width:96px; display:flex; flex-direction:column; align-items:center; gap:4px; padding:12px 14px; border-radius:16px; border:1.5px solid transparent; background:rgba(255,255,255,.035); color:var(--sp-text-dim); cursor:pointer; transition:background .2s ease, border-color .2s ease, color .2s ease; }
.sp-tier-tab-active{ border-color:var(--sp-holo-b); background:rgba(192,132,252,.12); color:var(--sp-text); }
.sp-tier-tab-thumb{ width:34px; height:auto; aspect-ratio:520/780; display:block; }
.sp-tier-tab-name{ font-size:12.5px; font-weight:700; }
.sp-tier-tab-price{ display:flex; align-items:center; gap:4px; font-size:11.5px; font-weight:700; color:var(--sp-text-dim); }
.sp-coin-icon-sm{ width:14px; height:14px; }
.sp-info-icon{ font-size:13px; color:var(--sp-text-dim); cursor:help; vertical-align:middle; }
.sp-hits-grid-2col{ display:grid; grid-template-columns:1fr 1fr; gap:clamp(10px,2.4vw,14px); }
.sp-hit-card-v2{ border-radius:16px; background:#f2f1f6; padding:10px 10px 12px; display:flex; flex-direction:column; align-items:center; }
.sp-hit-card-v2-img{ width:100%; aspect-ratio:1/1; display:flex; align-items:center; justify-content:center; }
.sp-hit-card-v2-img img{ max-width:100%; max-height:100%; object-fit:contain; display:block; }
.sp-hit-card-v2-price{ margin-top:8px; font-size:clamp(12.5px,2.4vw,14px); font-weight:800; color:#14121c; }
.sp-buy-bar{ position:fixed; left:50%; transform:translateX(-50%); width:min(calc(100% - 24px), 560px); bottom:0; z-index:60; display:flex; align-items:center; gap:12px; padding:clamp(14px,2.6vw,18px); border-radius:20px; background:rgba(20,17,31,.92); backdrop-filter:blur(14px); box-shadow:0 -8px 30px rgba(0,0,0,.4); flex-wrap:wrap; margin-bottom:clamp(12px,2.4vh,18px); }
@media (max-width:1023px){ .sp-buy-bar{ bottom:var(--pullz-mobile-bottom-nav-height, 0px); } }
.sp-buy-bar-price{ display:flex; align-items:center; gap:8px; font-size:clamp(16px,3vw,19px); font-weight:800; }
.sp-qty-stepper{ display:flex; align-items:center; gap:10px; background:rgba(255,255,255,.06); border-radius:999px; padding:6px 8px; }
.sp-qty-stepper button{ width:28px; height:28px; border-radius:50%; border:none; background:rgba(255,255,255,.08); color:var(--sp-text); font-size:16px; font-weight:700; cursor:pointer; display:flex; align-items:center; justify-content:center; line-height:1; }
.sp-qty-stepper button:hover{ background:rgba(255,255,255,.16); }
.sp-qty-stepper span{ min-width:18px; text-align:center; font-weight:700; font-variant-numeric:tabular-nums; }
.sp-buy-now-btn{ flex:1 1 160px; padding:15px 0; border-radius:999px; border:none; font-size:13.5px; font-weight:800; letter-spacing:.08em; text-transform:uppercase; color:#0c0a14; cursor:pointer; box-shadow:0 10px 26px -8px rgba(192,132,252,.6); transition:transform .15s ease; }
.sp-buy-now-btn:hover{ transform:translateY(-2px); }
.sp-buy-now-btn:active{ transform:translateY(0) scale(.98); }
.sp-back-btn{ align-self:flex-start; margin:0 0 clamp(10px,2vh,18px) clamp(18px,4vw,32px); background:transparent; border:none; color:var(--sp-text-dim); font-size:13px; padding:8px 10px 8px 0; cursor:pointer; }
.sp-back-btn:hover{ color:var(--sp-text); }
.sp-coverflow-outer{ position:relative; width:100%; display:flex; align-items:center; justify-content:center; }
.sp-coverflow-viewport{ position:relative; width:min(96vw,500px); margin:0 auto; overflow:visible; perspective:1200px; padding:10px 0 32px; touch-action:none; cursor:grab; user-select:none; }
.sp-coverflow-viewport.sp-dragging{ cursor:grabbing; }
.sp-coverflow-viewport img{ -webkit-user-drag:none; pointer-events:none; }
.sp-coverflow-track{ position:relative; width:100%; }
.sp-fan-card{ position:absolute; top:0; left:50%; width:60vw; max-width:250px; display:flex; flex-direction:column; align-items:center; padding:0 14px; will-change:transform,opacity; }
.sp-fan-card-art{ position:relative; width:100%; }
.sp-fan-card-glow{ position:absolute; inset:-25%; filter:blur(30px); z-index:-1; opacity:.55; border-radius:50%; }
.sp-fan-card-img{ width:100%; display:block; position:relative; z-index:1; aspect-ratio:520/780; }
.sp-foil-shine{ position:absolute; inset:0; pointer-events:none; z-index:2; background:linear-gradient(115deg, transparent 25%, rgba(255,255,255,.05) 40%, rgba(255,255,255,.35) 48%, rgba(110,231,255,.3) 51%, rgba(192,132,252,.3) 54%, rgba(255,255,255,.05) 60%, transparent 75%); background-size:220% 220%; mix-blend-mode:overlay; animation:sp-foilSweep 5s ease-in-out infinite; -webkit-mask-size:100% 100%; -webkit-mask-repeat:no-repeat; mask-size:100% 100%; mask-repeat:no-repeat; }
@keyframes sp-foilSweep{ 0%{background-position:15% 0%;} 50%{background-position:85% 100%;} 100%{background-position:15% 0%;} }
.sp-foil-shine.sp-fast{ animation:sp-foilFlicker .5s ease-in-out 2; }
@keyframes sp-foilFlicker{ 0%{background-position:0% 0%;} 100%{background-position:100% 100%;} }
.sp-fan-card-reflect{ width:100%; height:56px; overflow:hidden; pointer-events:none; margin-top:2px; }
.sp-fan-card-reflect img{ display:block; width:100%; aspect-ratio:520/780; transform:scaleY(-1); -webkit-mask-image:linear-gradient(to bottom, rgba(0,0,0,.4), transparent 75%); mask-image:linear-gradient(to bottom, rgba(0,0,0,.4), transparent 75%); opacity:.45; }
.sp-fan-card-name{ margin-top:18px; font-size:clamp(16px,3.1vw,18px); font-weight:700; }
.sp-fan-card-sub{ margin-top:3px; font-size:12px; color:var(--sp-text-dim); letter-spacing:.06em; text-transform:uppercase; }
.sp-price-row{ display:flex; align-items:center; gap:7px; margin-top:14px; font-size:clamp(17px,3.2vw,19px); font-weight:800; }
.sp-cta-btn{ margin-top:18px; width:100%; max-width:220px; padding:15px 0; border-radius:999px; border:none; font-size:13px; font-weight:700; letter-spacing:.12em; text-transform:uppercase; cursor:pointer; color:#0c0a14; box-shadow:0 10px 26px -8px rgba(192,132,252,.6); }
.sp-cta-btn-solo{ position:relative; z-index:10; margin-top:clamp(20px,3.5vh,30px); width:min(80vw,260px); }
.sp-arrow{ position:absolute; top:38%; transform:translateY(-50%); width:46px; height:46px; border-radius:50%; border:none; background:rgba(20,17,31,.75); backdrop-filter:blur(6px); box-shadow:0 8px 24px -8px rgba(0,0,0,.6); color:var(--sp-text); display:flex; align-items:center; justify-content:center; cursor:pointer; font-size:19px; z-index:5; }
.sp-arrow.sp-left{ left:clamp(2px,1vw,10px); } .sp-arrow.sp-right{ right:clamp(2px,1vw,10px); }
@media (hover:none){ .sp-arrow{ display:none; } }
.sp-info-section{ width:100%; margin:clamp(22px,4vh,34px) 0 0; padding:clamp(18px,3.4vw,24px) clamp(18px,4vw,26px); border-radius:22px; background:rgba(255,255,255,.035); }
.sp-info-section-head{ display:flex; align-items:baseline; justify-content:space-between; gap:10px; margin-bottom:clamp(14px,2.6vh,20px); flex-wrap:wrap; }
.sp-info-section-head h2{ margin:0; font-size:clamp(15px,2.8vw,17px); font-weight:800; }
.sp-ev{ font-size:clamp(13px,2.4vw,14px); color:var(--sp-text-dim); white-space:nowrap; }
.sp-ev b{ color:#4ade80; font-weight:800; }
.sp-odds-grid{ display:grid; grid-template-columns:1fr 1fr; column-gap:clamp(16px,4vw,30px); row-gap:11px; }
@media (max-width:380px){ .sp-odds-grid{ grid-template-columns:1fr; } }
.sp-odds-row{ display:flex; align-items:baseline; gap:6px; font-size:clamp(12.5px,2.6vw,13.5px); min-width:0; }
.sp-odds-row .sp-range{ white-space:nowrap; color:var(--sp-text); font-weight:600; }
.sp-odds-row .sp-leader{ flex:1; min-width:10px; border-bottom:2px dotted rgba(255,255,255,.22); margin-bottom:4px; }
.sp-odds-row .sp-pct{ white-space:nowrap; color:var(--sp-text-dim); font-weight:700; }
.sp-reveal-stage{ position:relative; display:grid; place-items:center; width:100%; }
.sp-reveal-stage > .sp-pack-wrap, .sp-reveal-stage > .sp-card-wrap{ grid-area:1/1; }
.sp-pack-wrap{ position:relative; z-index:4; width:min(58vw,380px); cursor:pointer; animation:sp-float 3.4s ease-in-out infinite; transition:opacity .5s ease, transform .5s ease; }
.sp-pack-wrap.sp-hidden-pack{ opacity:0; pointer-events:none; transform:scale(.4); }
@keyframes sp-float{ 0%,100%{transform:translateY(0) rotate(-1.2deg);} 50%{transform:translateY(-16px) rotate(1.2deg);} }
.sp-pack-wrap.sp-shaking{ animation:sp-shake .09s linear infinite, sp-floatShake 3s ease-in-out infinite; }
@keyframes sp-shake{ 0%{transform:translate(0,0) rotate(0deg) scale(1);} 20%{transform:translate(-7px,3px) rotate(-2deg) scale(1.01,.99);} 40%{transform:translate(7px,-3px) rotate(2deg) scale(.99,1.01);} 60%{transform:translate(-6px,3px) rotate(-3deg) scale(1.015,.985);} 80%{transform:translate(6px,-2px) rotate(2deg) scale(.985,1.015);} 100%{transform:translate(0,0) rotate(0deg) scale(1);} }
@keyframes sp-floatShake{ 0%,100%{filter:brightness(1);} 50%{filter:brightness(1.15);} }
.sp-pack-glow{ position:absolute; inset:-30%; background:radial-gradient(circle, rgba(192,132,252,.35), rgba(110,231,255,.15) 45%, transparent 70%); filter:blur(24px); z-index:-1; animation:sp-pulseGlow 2.6s ease-in-out infinite; }
@keyframes sp-pulseGlow{ 0%,100%{opacity:.55; transform:scale(1);} 50%{opacity:1; transform:scale(1.08);} }
.sp-pack-img{ width:100%; display:block; position:relative; z-index:1; aspect-ratio:520/780; }
.sp-pack-flash-out{ position:absolute; inset:0; z-index:2; border-radius:22px; background:#fff; animation:sp-packOut .5s cubic-bezier(.6,0,1,.4) forwards; }
@keyframes sp-packOut{ 0%{opacity:0;} 35%{opacity:.9;} 100%{opacity:0; transform:scale(1.5);} }
.sp-prompt{ margin-top:30px; text-align:center; z-index:4; transition:opacity .3s ease; }
.sp-prompt.sp-hidden{ opacity:0; pointer-events:none; height:0; overflow:hidden; margin-top:0; }
.sp-prompt .sp-tap{ font-size:clamp(14px,2.6vw,16px); letter-spacing:.16em; text-transform:uppercase; color:var(--sp-text-dim); animation:sp-pulseText 1.8s ease-in-out infinite; }
@keyframes sp-pulseText{ 0%,100%{opacity:.55;} 50%{opacity:1;} }
.sp-flash{ position:absolute; inset:0; background:radial-gradient(circle at 50% 50%, #fff 0%, rgba(255,255,255,0) 60%); opacity:0; z-index:8; pointer-events:none; }
.sp-flash.sp-go{ animation:sp-flashPop .7s ease-out forwards; }
@keyframes sp-flashPop{ 0%{opacity:0;} 18%{opacity:1;} 100%{opacity:0;} }
.sp-rays{ position:absolute; top:50%; left:50%; width:10px; height:10px; z-index:7; pointer-events:none; opacity:0; }
.sp-rays.sp-go{ animation:sp-raysGo 1.1s ease-out forwards; }
@keyframes sp-raysGo{ 0%{opacity:0;} 10%{opacity:1;} 100%{opacity:0;} }
.sp-ray-inner{ position:absolute; top:50%; left:50%; width:1600px; height:1600px; margin:-800px 0 0 -800px; background:repeating-conic-gradient(from 0deg, rgba(255,255,255,.9) 0deg 2deg, transparent 2deg 14deg); border-radius:50%; animation:sp-spinRays 1.2s linear; mix-blend-mode:screen; }
@keyframes sp-spinRays{ 0%{transform:scale(0) rotate(0deg);} 100%{transform:scale(1) rotate(90deg);} }
.sp-shockwave{ position:absolute; top:50%; left:50%; width:40px; height:40px; margin:-20px 0 0 -20px; border-radius:50%; border:2px solid rgba(192,132,252,.8); z-index:6; pointer-events:none; opacity:0; }
.sp-shockwave.sp-go{ animation:sp-shockGo .9s cubic-bezier(.2,.7,.3,1) forwards; }
@keyframes sp-shockGo{ 0%{width:40px; height:40px; margin:-20px 0 0 -20px; opacity:.9; border-width:3px;} 100%{width:1400px; height:1400px; margin:-700px 0 0 -700px; opacity:0; border-width:1px;} }
.sp-particles{ position:absolute; inset:0; pointer-events:none; z-index:7; }
.sp-particle{ position:absolute; top:50%; left:50%; width:7px; height:7px; border-radius:50%; opacity:0; }
.sp-particle.sp-go{ animation:sp-particleGo 1.1s cubic-bezier(.15,.6,.3,1) forwards; }
@keyframes sp-particleGo{ 0%{opacity:1; transform:translate(0,0) scale(1);} 100%{opacity:0; transform:translate(var(--px), var(--py)) scale(.2);} }
.sp-card-wrap{ position:relative; z-index:9; width:min(80vw,460px); opacity:0; transform:scale(.15); pointer-events:none; }
.sp-card-wrap.sp-reveal{ animation:sp-cardIn 1.1s cubic-bezier(.2,.9,.3,1.25) forwards; pointer-events:auto; }
@keyframes sp-cardIn{ 0%{opacity:0; transform:scale(.15) rotateY(-50deg) translateY(34px);} 50%{opacity:1;} 70%{transform:scale(1.12) rotateY(10deg) translateY(-8px);} 85%{transform:scale(.97) rotateY(-3deg) translateY(2px);} 100%{opacity:1; transform:scale(1) rotateY(0deg) translateY(0);} }
.sp-card-halo{ position:absolute; inset:-18%; z-index:0; border-radius:50%; background:radial-gradient(circle, rgba(255,209,102,.4) 0%, rgba(192,132,252,.28) 40%, transparent 72%); filter:blur(30px); opacity:0; pointer-events:none; }
.sp-card-wrap.sp-reveal .sp-card-halo{ animation:sp-haloPulse 2.2s ease-in-out .3s infinite; }
@keyframes sp-haloPulse{ 0%,100%{opacity:.55; transform:scale(1);} 50%{opacity:1; transform:scale(1.14);} }
.sp-card-inner{ position:relative; z-index:1; border-radius:24px; overflow:hidden; padding:18px; background:linear-gradient(160deg, #1e1934 0%, #110d1e 100%); box-shadow:0 44px 88px -20px rgba(0,0,0,.75), 0 0 70px rgba(192,132,252,.35); transform-style:preserve-3d; transition:transform .12s ease-out; }
.sp-card-img{ width:100%; height:auto; display:block; position:relative; z-index:1; border-radius:10px; }
.sp-holo-sweep{ position:absolute; inset:18px; z-index:2; border-radius:10px; background:linear-gradient(115deg, transparent 30%, rgba(110,231,255,.22) 45%, rgba(192,132,252,.22) 50%, rgba(255,209,102,.18) 55%, transparent 70%); background-size:250% 250%; mix-blend-mode:overlay; opacity:.85; pointer-events:none; }
.sp-card-wrap.sp-reveal .sp-holo-sweep{ animation:sp-sweep 2.4s ease-in-out infinite; }
@keyframes sp-sweep{ 0%{background-position:0% 0%;} 50%{background-position:100% 100%;} 100%{background-position:0% 0%;} }
.sp-rarity-tag{ margin-top:26px; text-align:center; opacity:0; z-index:9; }
.sp-rarity-tag.sp-show{ animation:sp-tagIn .6s ease-out forwards; animation-delay:.55s; }
@keyframes sp-tagIn{ 0%{opacity:0; transform:translateY(10px);} 100%{opacity:1; transform:translateY(0);} }
.sp-rarity-eyebrow{ font-size:clamp(12px,2.4vw,13px); font-weight:700; letter-spacing:.3em; text-transform:uppercase; color:var(--sp-gold); margin-bottom:6px; }
.sp-rarity-name{ font-size:clamp(26px,5.4vw,36px); font-weight:800; letter-spacing:.04em; background:linear-gradient(90deg, var(--sp-holo-a), var(--sp-holo-b), var(--sp-holo-c), var(--sp-holo-b), var(--sp-holo-a)); background-size:250% 100%; -webkit-background-clip:text; background-clip:text; color:transparent; text-transform:uppercase; animation:sp-rarityShimmer 2.6s linear infinite; }
@keyframes sp-rarityShimmer{ 0%{background-position:0% 50%;} 100%{background-position:250% 50%;} }
.sp-rarity-sub{ margin-top:5px; font-size:clamp(12px,2.4vw,13px); letter-spacing:.18em; text-transform:uppercase; color:var(--sp-text-dim); }
.sp-card-slot{ position:relative; display:flex; flex-direction:column; align-items:center; z-index:9; }
.sp-again-btn{ margin-top:30px; padding:15px 34px; background:rgba(255,255,255,.06); color:var(--sp-text); font-size:13px; letter-spacing:.14em; text-transform:uppercase; border:none; border-radius:999px; cursor:pointer; opacity:0; transition:background .2s ease, opacity .4s ease .3s; }
.sp-again-btn.sp-show{ opacity:1; }
.sp-again-btn:hover{ background:rgba(192,132,252,.16); }
.sp-keep-sell-row{ display:flex; gap:12px; margin-top:26px; width:min(90vw,360px); }
.sp-keep-btn{ flex:1; padding:15px 0; border-radius:999px; border:none; background:linear-gradient(90deg, var(--sp-holo-a), var(--sp-holo-b)); color:#0c0a14; font-size:12.5px; font-weight:800; letter-spacing:.08em; text-transform:uppercase; cursor:pointer; transition:transform .15s ease; }
.sp-keep-btn:hover{ transform:translateY(-2px); }
.sp-sell-btn{ flex:1; padding:15px 0; border-radius:999px; border:1px solid rgba(74,222,128,.4); background:rgba(74,222,128,.12); color:#bbf7d0; font-size:12.5px; font-weight:800; letter-spacing:.04em; cursor:pointer; transition:background .2s ease, transform .15s ease; }
.sp-sell-btn:hover{ background:rgba(74,222,128,.2); transform:translateY(-2px); }
.sp-sell-btn:disabled{ opacity:.6; cursor:not-allowed; transform:none; }
@media (max-width:420px){ .sp-keep-sell-row{ flex-direction:column; width:min(84vw,320px); } }
.sp-footer-note{ flex-shrink:0; text-align:center; padding:10px 0 14px; font-size:10px; letter-spacing:.2em; color:#4c4666; text-transform:uppercase; z-index:3; }
`;

export default SlabPacks;
