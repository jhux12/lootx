import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import packImg from '../assets/slabpacks/pack.png';
import cardImg from '../assets/slabpacks/flareon-card.png';
import { useAuth, useBoxes, useWallet } from '../context/GameContext';
import { authedFetch } from '../utils/authedFetch';
import { toast } from '../src/ui/toast/toast';
import { calculateExpectedValue } from '../utils/caseOdds';
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
    filter: 'none',
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

const TIER_ORDER: Tier[] = ['bronze', 'silver', 'gold'];
const RARITY_COLOR: Record<string, string> = {
  common: '#9ca3af', uncommon: '#22c55e', rare: '#3b82f6', epic: '#a855f7', legendary: '#fbbf24'
};

const fmtCoins = (n: number) => Math.round(n).toLocaleString('en-US');

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

  useEffect(() => {
    const viewport = containerRef.current;
    if (!viewport) return;

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
  }, [count]);

  const current = useCallback(() => reportedRef.current, []);

  return { containerRef, setCardRef, goTo, current };
}

// ---------------------------------------------------------------------------
// Small presentational pieces
// ---------------------------------------------------------------------------

const FanCardArt: React.FC<{ visuals: TierVisuals; alt: string; fast?: boolean }> = ({ visuals, alt, fast }) => (
  <div className="sp-fan-card-art">
    <div className="sp-fan-card-glow" style={{ background: visuals.glow }} />
    <img className="sp-fan-card-img" src={packImg} alt={alt} style={{ filter: visuals.filter }} draggable={false} />
    <div className={`sp-foil-shine${fast ? ' sp-fast' : ''}`} style={{ WebkitMaskImage: `url(${packImg})`, maskImage: `url(${packImg})` }} />
  </div>
);

const FanCardReflect: React.FC<{ visuals: TierVisuals }> = ({ visuals }) => (
  <div className="sp-fan-card-reflect">
    <img src={packImg} alt="" style={{ filter: visuals.filter }} draggable={false} />
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

  const slabBoxes = useMemo(() => {
    const map: Partial<Record<Tier, ReturnType<typeof boxes.find>>> = {};
    for (const tier of TIER_ORDER) {
      map[tier] = boxes.find((b) => b.isSlabPack && b.slabPackTier === tier);
    }
    return map as Record<Tier, (typeof boxes)[number] | undefined>;
  }, [boxes]);

  const configuredTiers = TIER_ORDER.filter((t) => slabBoxes[t]);

  const [pageView, setPageView] = useState<PageView>('browse');
  const [browseIndex, setBrowseIndex] = useState(0);
  const [pendingTier, setPendingTier] = useState<Tier | null>(null);
  const [openTier, setOpenTier] = useState<Tier | null>(null);
  const [openStage, setOpenStage] = useState<OpenStage>('idle');
  const [opening, setOpening] = useState(false);
  const [prize, setPrize] = useState<(CaseItem & { price?: number; value?: number }) | null>(null);
  const [particles, setParticles] = useState<{ id: number; px: number; py: number; color: string }[]>([]);
  const particleIdRef = useRef(0);
  const [cardTilt, setCardTilt] = useState({ x: 0, y: 0 });
  const [balancePulse, setBalancePulse] = useState(false);
  const prevBalanceRef = useRef(balance);

  const browseCF = useCoverflow(configuredTiers.length, (i) => setBrowseIndex(i));
  const pickCF = useCoverflow(PICK_COPIES);

  useEffect(() => {
    if (configuredTiers.length === 0) return;
    const startAt = Math.min(1, configuredTiers.length - 1);
    browseCF.goTo(startAt);
    setBrowseIndex(startAt);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configuredTiers.length]);

  useEffect(() => {
    if (balance !== prevBalanceRef.current) {
      setBalancePulse(true);
      const t = window.setTimeout(() => setBalancePulse(false), 500);
      prevBalanceRef.current = balance;
      return () => window.clearTimeout(t);
    }
  }, [balance]);

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

  const buyPack = (tier: Tier) => {
    if (!isAuthenticated) {
      openAuthModal('login');
      return;
    }
    const box = slabBoxes[tier];
    if (!box) return;
    if (balance < box.price) {
      toast.error("You don't have enough coins for this pack.");
      return;
    }
    setPendingTier(tier);
    setPageView('pick');
    window.setTimeout(() => pickCF.goTo(Math.floor(PICK_COPIES / 2)), 0);
  };

  const openPurchasedPack = () => {
    if (!pendingTier) return;
    setOpenTier(pendingTier);
    setOpenStage('idle');
    setPrize(null);
    setPageView('open');
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

    const minShake = new Promise((resolve) => window.setTimeout(resolve, 650));
    const apiCall = authedFetch<OpenCaseResponse>('/api/open-case', {
      method: 'POST',
      body: JSON.stringify({ boxId: box.id })
    });

    try {
      const [data] = await Promise.all([apiCall, minShake]);
      setPrize(data.prize);
      const nextBalance = typeof data.newCoinBalance === 'number' ? data.newCoinBalance : data.newCoins;
      if (typeof nextBalance === 'number') syncBalance(nextBalance);

      setOpenStage('exploding');
      spawnParticles(32, ['#6ee7ff', '#c084fc', '#ffd166', '#ffffff'], [200, 380], 1300);
      window.setTimeout(() => {
        setOpenStage('revealed');
        spawnParticles(46, ['#ffd166', '#ffe9a8', '#c084fc', '#6ee7ff', '#ffffff'], [60, 460], 1500);
      }, 260);
    } catch (err) {
      await minShake;
      const message = err instanceof Error ? err.message : 'Unable to open this pack. Please try again.';
      toast.error(message);
      setOpenStage('idle');
    } finally {
      setOpening(false);
    }
  };

  const resetToOpen = () => {
    setOpenStage('idle');
    setPrize(null);
  };

  const backToBrowse = () => {
    setPageView('browse');
    setOpenStage('idle');
    setPrize(null);
  };

  const activeBox = configuredTiers.length > 0 ? slabBoxes[configuredTiers[Math.min(browseIndex, configuredTiers.length - 1)]] : undefined;

  const oddsRows = useMemo(() => {
    if (!activeBox) return [];
    const totals = new Map<string, number>();
    activeBox.items.forEach((item) => {
      totals.set(item.rarity, (totals.get(item.rarity) ?? 0) + item.chance);
    });
    const order: CaseItem['rarity'][] = ['legendary', 'epic', 'rare', 'uncommon', 'common'];
    return order
      .filter((r) => totals.has(r))
      .map((r) => ({ rarity: r, pct: totals.get(r) ?? 0 }));
  }, [activeBox]);

  const expectedValue = useMemo(() => (activeBox ? calculateExpectedValue(activeBox.items) : 0), [activeBox]);

  const potentialHits = useMemo(() => {
    if (!activeBox) return [];
    return [...activeBox.items].sort((a, b) => b.price - a.price).slice(0, 8);
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

  if (configuredTiers.length === 0) {
    return (
      <div className="sp-root">
        <style>{SLAB_PACKS_CSS}</style>
        <div className="sp-app-bar">
          <div className="sp-brand"><span className="sp-brand-mark">P</span>Slab Packs</div>
        </div>
        <div className="sp-stage">
          <div className="sp-view-heading" style={{ padding: '0 24px' }}>
            <h1>Slab Packs are coming soon</h1>
            <p>An admin needs to configure at least one Bronze, Silver, or Gold pack in the box editor first.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="sp-root">
      <style>{SLAB_PACKS_CSS}</style>

      <div className="sp-app-bar">
        <div className="sp-brand"><span className="sp-brand-mark">P</span>Slab Packs</div>
        <div className={`sp-balance-chip${balancePulse ? ' sp-pulse' : ''}`}>
          <span className="sp-coin-icon" />
          <span>{fmtCoins(balance)}</span>
        </div>
      </div>

      <div className="sp-stage">
        {/* ============ BROWSE ============ */}
        <div className={`sp-view${pageView !== 'browse' ? ' sp-hidden' : ' sp-scrollable'}`}>
          <div className="sp-view-heading">
            <h1>Choose Your Pack</h1>
            <p>Swipe to browse, then buy one to open</p>
          </div>

          <div className="sp-coverflow-outer">
            <button type="button" className="sp-arrow sp-left" onClick={() => browseCF.goTo(browseCF.current() - 1)} aria-label="Previous pack">&#8249;</button>
            <div className="sp-coverflow-viewport" ref={browseCF.containerRef}>
              <div className="sp-coverflow-track">
                {configuredTiers.map((tier, i) => {
                  const box = slabBoxes[tier]!;
                  const visuals = TIER_VISUALS[tier];
                  return (
                    <div key={tier} className="sp-fan-card" ref={browseCF.setCardRef(i)}>
                      <div className="sp-tier-ribbon" style={{ color: visuals.ctaGradient.includes('9f6e') ? '#ff9f6e' : visuals.ctaGradient.includes('ffd166') ? '#ffd166' : '#c084fc', background: tier === 'bronze' ? 'rgba(255,159,110,.2)' : tier === 'gold' ? 'rgba(255,209,102,.2)' : 'rgba(192,132,252,.2)' }}>{visuals.ribbon}</div>
                      <FanCardArt visuals={visuals} alt={box.name} />
                      <FanCardReflect visuals={visuals} />
                      <div className="sp-fan-card-name">{box.name}</div>
                      <div className="sp-fan-card-sub">1 Graded Card</div>
                      <div className="sp-price-row"><span className="sp-coin-icon" />{fmtCoins(box.price)}</div>
                      <button type="button" className="sp-cta-btn" style={{ background: visuals.ctaGradient }} onClick={() => buyPack(tier)}>
                        Buy Pack
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
            <button type="button" className="sp-arrow sp-right" onClick={() => browseCF.goTo(browseCF.current() + 1)} aria-label="Next pack">&#8250;</button>
          </div>

          {activeBox && (
            <>
              <div className="sp-info-section">
                <div className="sp-info-section-head">
                  <h2>Odds *</h2>
                  <div className="sp-ev">Expected Value: <b>{fmtCoins(expectedValue)} coins</b></div>
                </div>
                <div className="sp-odds-grid">
                  {oddsRows.map(({ rarity, pct }) => (
                    <div className="sp-odds-row" key={rarity}>
                      <span className="sp-range" style={{ textTransform: 'capitalize', color: RARITY_COLOR[rarity] }}>{rarity}</span>
                      <span className="sp-leader" />
                      <span className="sp-pct">{pct.toFixed(pct < 1 ? 2 : 1)}%</span>
                    </div>
                  ))}
                  {oddsRows.length === 0 && <p style={{ color: 'var(--sp-text-dim)', fontSize: 13 }}>No items configured for this pack yet.</p>}
                </div>
              </div>

              <div className="sp-info-section">
                <div className="sp-info-section-head">
                  <h2>Potential Hits</h2>
                </div>
                <div className="sp-hits-grid">
                  {potentialHits.map((item) => (
                    <div className="sp-hit-card" key={item.id}>
                      <img src={item.image || cardImg} alt={item.name} loading="lazy" />
                      <div className="sp-hit-price">{fmtCoins(item.price)} coins</div>
                    </div>
                  ))}
                  {potentialHits.length === 0 && <p style={{ color: 'var(--sp-text-dim)', fontSize: 13 }}>No items configured for this pack yet.</p>}
                </div>
              </div>
            </>
          )}
        </div>

        {/* ============ PICK A PACK ============ */}
        <div className={`sp-view${pageView !== 'pick' ? ' sp-hidden' : ''}`}>
          <button type="button" className="sp-back-btn" onClick={backToBrowse}>&larr; Back to Packs</button>
          <div className="sp-view-heading">
            <h1>Pick a Pack</h1>
            <p>{pendingTier ? slabBoxes[pendingTier]?.name : ''} purchased &mdash; every copy holds the same odds</p>
          </div>
          <div className="sp-coverflow-outer">
            <button type="button" className="sp-arrow sp-left" onClick={() => pickCF.goTo(pickCF.current() - 1)} aria-label="Previous copy">&#8249;</button>
            <div className="sp-coverflow-viewport" ref={pickCF.containerRef}>
              <div className="sp-coverflow-track">
                {pendingTier && Array.from({ length: PICK_COPIES }).map((_, i) => {
                  const visuals = TIER_VISUALS[pendingTier];
                  return (
                    <div key={i} className="sp-fan-card" ref={pickCF.setCardRef(i)}>
                      <FanCardArt visuals={visuals} alt={slabBoxes[pendingTier]?.name ?? 'Pack'} />
                      <FanCardReflect visuals={visuals} />
                      <button type="button" className="sp-cta-btn" style={{ background: visuals.ctaGradient }} onClick={openPurchasedPack}>
                        Open This Pack
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
            <button type="button" className="sp-arrow sp-right" onClick={() => pickCF.goTo(pickCF.current() + 1)} aria-label="Next copy">&#8250;</button>
          </div>
        </div>

        {/* ============ OPEN ============ */}
        <div className={`sp-view${pageView !== 'open' ? ' sp-hidden' : ''}`}>
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
              <img className="sp-pack-img" src={packImg} alt={openBox?.name ?? 'Card pack'} style={{ filter: openVisuals.filter }} draggable={false} />
              <div className={`sp-foil-shine${openStage === 'shaking' ? ' sp-fast' : ''}`} style={{ WebkitMaskImage: `url(${packImg})`, maskImage: `url(${packImg})` }} />
              {(openStage === 'exploding') && <div className="sp-pack-flash-out" />}
            </div>

            <div className={`sp-card-wrap${openStage === 'revealed' ? ' sp-reveal' : ''}`}>
              <div className="sp-card-halo" />
              <div className="sp-card-inner" onMouseMove={handleCardMouseMove} onMouseLeave={() => setCardTilt({ x: 0, y: 0 })} style={{ transform: `rotateY(${cardTilt.x}deg) rotateX(${cardTilt.y}deg)` }}>
                <img className="sp-card-img" src={prizeImage} alt={prize?.name ?? 'Card pulled'} draggable={false} />
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
            <button type="button" className={`sp-again-btn${openStage === 'revealed' ? ' sp-show' : ''}`} onClick={resetToOpen}>
              Open Another Pack
            </button>
          </div>
        </div>
      </div>

      <div className="sp-footer-note">Hold steady &mdash; good luck</div>
    </div>
  );
};

const SLAB_PACKS_CSS = `
.sp-root{ --sp-void:#08070d; --sp-holo-a:#6ee7ff; --sp-holo-b:#c084fc; --sp-holo-c:#ffd166; --sp-text:#f5f2fc; --sp-text-dim:#a49cc4; --sp-gold:#ffd166;
  position:relative; width:100%; min-height:100vh; display:flex; flex-direction:column; overflow:hidden;
  background: radial-gradient(ellipse 120% 80% at 50% 0%, #1e1836 0%, var(--sp-void) 55%), var(--sp-void);
  color:var(--sp-text); font-family:'Segoe UI', system-ui, -apple-system, sans-serif; border-radius:16px; }
.sp-app-bar{ position:relative; z-index:10; flex-shrink:0; display:flex; align-items:center; justify-content:space-between; padding:18px clamp(18px,4vw,32px) 14px; }
.sp-brand{ display:flex; align-items:center; gap:10px; font-size:clamp(17px,3vw,20px); font-weight:800; }
.sp-brand-mark{ width:30px; height:30px; border-radius:9px; background:linear-gradient(135deg,var(--sp-holo-a),var(--sp-holo-b)); display:flex; align-items:center; justify-content:center; font-size:15px; font-weight:900; color:#0c0a14; }
.sp-balance-chip{ display:flex; align-items:center; gap:8px; background:rgba(255,255,255,.06); padding:8px 16px 8px 10px; border-radius:999px; font-size:clamp(14px,2.6vw,16px); font-weight:700; font-variant-numeric:tabular-nums; }
.sp-balance-chip.sp-pulse{ animation:sp-balancePulse .5s ease; }
@keyframes sp-balancePulse{ 0%{transform:scale(1);} 30%{transform:scale(1.09); color:var(--sp-gold);} 100%{transform:scale(1);} }
.sp-coin-icon{ width:22px; height:22px; border-radius:50%; background:radial-gradient(circle at 35% 30%, #fff6d8, var(--sp-gold) 55%, #b9840f 100%); box-shadow:0 0 0 1px rgba(0,0,0,.25) inset, 0 1px 3px rgba(0,0,0,.4); flex-shrink:0; display:inline-block; }
.sp-stage{ position:relative; flex:1; min-height:640px; display:flex; flex-direction:column; align-items:center; justify-content:center; overflow:hidden; }
.sp-view{ position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center; transition:opacity .4s ease, transform .4s ease; }
.sp-view.sp-hidden{ opacity:0; transform:scale(.94); pointer-events:none; }
.sp-view.sp-scrollable{ overflow-y:auto; overflow-x:hidden; justify-content:flex-start; padding-bottom:28px; touch-action:pan-y; overscroll-behavior-y:contain; }
.sp-view-heading{ text-align:center; margin-bottom:clamp(18px,2.6vh,26px); padding:0 20px; }
.sp-view-heading h1{ margin:0; font-size:clamp(24px,4.6vw,34px); font-weight:800; }
.sp-view-heading p{ margin:9px 0 0; font-size:clamp(13px,2.4vw,15px); color:var(--sp-text-dim); }
.sp-back-btn{ position:absolute; top:14px; left:clamp(18px,4vw,32px); z-index:6; background:transparent; border:none; color:var(--sp-text-dim); font-size:13px; padding:8px 4px; cursor:pointer; }
.sp-back-btn:hover{ color:var(--sp-text); }
.sp-coverflow-outer{ position:relative; width:100%; display:flex; align-items:center; justify-content:center; }
.sp-coverflow-viewport{ position:relative; width:min(96vw,500px); margin:0 auto; overflow:visible; perspective:1200px; padding:10px 0 32px; touch-action:none; cursor:grab; user-select:none; }
.sp-coverflow-viewport.sp-dragging{ cursor:grabbing; }
.sp-coverflow-viewport img{ -webkit-user-drag:none; pointer-events:none; }
.sp-coverflow-track{ position:relative; width:100%; }
.sp-fan-card{ position:absolute; top:0; left:50%; width:60vw; max-width:250px; display:flex; flex-direction:column; align-items:center; padding:0 14px; will-change:transform,opacity; }
.sp-fan-card-art{ position:relative; width:100%; }
.sp-fan-card-glow{ position:absolute; inset:-25%; filter:blur(30px); z-index:-1; opacity:.55; border-radius:50%; }
.sp-fan-card-img{ width:100%; display:block; position:relative; z-index:1; filter:drop-shadow(0 22px 34px rgba(0,0,0,.6)); }
.sp-foil-shine{ position:absolute; inset:0; pointer-events:none; z-index:2; background:linear-gradient(115deg, transparent 25%, rgba(255,255,255,.05) 40%, rgba(255,255,255,.35) 48%, rgba(110,231,255,.3) 51%, rgba(192,132,252,.3) 54%, rgba(255,255,255,.05) 60%, transparent 75%); background-size:220% 220%; mix-blend-mode:overlay; animation:sp-foilSweep 5s ease-in-out infinite; -webkit-mask-size:100% 100%; -webkit-mask-repeat:no-repeat; mask-size:100% 100%; mask-repeat:no-repeat; }
@keyframes sp-foilSweep{ 0%{background-position:15% 0%;} 50%{background-position:85% 100%;} 100%{background-position:15% 0%;} }
.sp-foil-shine.sp-fast{ animation:sp-foilFlicker .5s ease-in-out 2; }
@keyframes sp-foilFlicker{ 0%{background-position:0% 0%;} 100%{background-position:100% 100%;} }
.sp-fan-card-reflect{ width:100%; height:56px; overflow:hidden; pointer-events:none; margin-top:2px; }
.sp-fan-card-reflect img{ display:block; width:100%; transform:scaleY(-1); -webkit-mask-image:linear-gradient(to bottom, rgba(0,0,0,.4), transparent 75%); mask-image:linear-gradient(to bottom, rgba(0,0,0,.4), transparent 75%); opacity:.45; }
.sp-tier-ribbon{ position:absolute; top:14px; left:14px; padding:5px 13px; font-size:11px; font-weight:700; letter-spacing:.1em; text-transform:uppercase; border-radius:999px; backdrop-filter:blur(4px); z-index:3; }
.sp-fan-card-name{ margin-top:18px; font-size:clamp(16px,3.1vw,18px); font-weight:700; }
.sp-fan-card-sub{ margin-top:3px; font-size:12px; color:var(--sp-text-dim); letter-spacing:.06em; text-transform:uppercase; }
.sp-price-row{ display:flex; align-items:center; gap:7px; margin-top:14px; font-size:clamp(17px,3.2vw,19px); font-weight:800; }
.sp-cta-btn{ margin-top:18px; width:100%; max-width:220px; padding:15px 0; border-radius:999px; border:none; font-size:13px; font-weight:700; letter-spacing:.12em; text-transform:uppercase; cursor:pointer; color:#0c0a14; box-shadow:0 10px 26px -8px rgba(192,132,252,.6); }
.sp-arrow{ position:absolute; top:38%; transform:translateY(-50%); width:46px; height:46px; border-radius:50%; border:none; background:rgba(20,17,31,.75); backdrop-filter:blur(6px); box-shadow:0 8px 24px -8px rgba(0,0,0,.6); color:var(--sp-text); display:flex; align-items:center; justify-content:center; cursor:pointer; font-size:19px; z-index:5; }
.sp-arrow.sp-left{ left:clamp(2px,1vw,10px); } .sp-arrow.sp-right{ right:clamp(2px,1vw,10px); }
@media (hover:none){ .sp-arrow{ display:none; } }
.sp-info-section{ width:min(94vw,560px); margin:clamp(22px,4vh,34px) auto 0; padding:clamp(18px,3.4vw,24px) clamp(18px,4vw,26px); border-radius:22px; background:rgba(255,255,255,.035); }
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
.sp-hits-grid{ display:grid; grid-template-columns:repeat(auto-fit, minmax(122px,1fr)); gap:clamp(10px,2.4vw,14px); }
.sp-hit-card{ position:relative; border-radius:14px; overflow:hidden; background:rgba(255,255,255,.03); }
.sp-hit-card img{ width:100%; display:block; aspect-ratio:1/1; object-fit:cover; }
.sp-hit-price{ position:absolute; left:0; right:0; bottom:0; padding:20px 8px 8px; text-align:center; font-size:clamp(11.5px,2.4vw,12.5px); font-weight:800; color:#fff; background:linear-gradient(to top, rgba(0,0,0,.85) 20%, transparent 100%); }
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
.sp-pack-img{ width:100%; display:block; position:relative; z-index:1; filter:drop-shadow(0 26px 42px rgba(0,0,0,.6)); }
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
.sp-footer-note{ flex-shrink:0; text-align:center; padding:10px 0 14px; font-size:10px; letter-spacing:.2em; color:#4c4666; text-transform:uppercase; z-index:3; }
`;

export default SlabPacks;
