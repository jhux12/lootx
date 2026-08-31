import React, { useEffect, useMemo, useState } from 'react';
import { Boxes, ChevronRight, Flame, Sparkles, X } from 'lucide-react';
import type { HomeHeroSlide, MysteryBox } from '../../types';
import { CoinAmount } from '../../components/CoinAmount';
import { COIN_ICON } from '../../constants';
import { PRICE_UNIT_MODE, toCoins } from '../../utils/coins';
import { useAuth, useBoxes, useUI, useWallet } from '../../context/GameContext';
import { CATEGORY_ORDER, getBoxTags, isCategoryIconUrl, normalizeBoxTag, sanitizeFontAwesomeClass } from '../../utils/boxTags';
import { BetLiveWinsTicker } from './BetLiveWinsTicker';

type FigmaHomePageProps = {
  boxes: MysteryBox[];
  onOpenBox: (boxId: string, isFree?: boolean) => void;
  onViewAllBoxes: () => void;
};

// This page is the isolated Betting Mobile Figma homepage implementation.

const TRUSTPILOT_LOGO_URL = 'https://a.storyblok.com/f/91079/4000x2000/ea4fb218a1/trustpilot-logo.png';

const BoxTile: React.FC<{ box: MysteryBox; onOpen: () => void; isFreeSignupBox?: boolean; isPriority?: boolean }> = React.memo(({ box, onOpen, isFreeSignupBox, isPriority }) => (
  <button type="button" className={`bet-box-tile${isFreeSignupBox ? ' is-free-signup' : ''}`} onClick={onOpen} aria-label={`Open ${box.name}`}>
    {isFreeSignupBox && <span className="bet-box-tile-badge">Sign-Up Bonus</span>}
    <img
      src={box.image}
      alt=""
      loading={isPriority ? 'eager' : 'lazy'}
      fetchPriority={isPriority ? 'high' : 'low'}
      decoding="async"
    />
    {isFreeSignupBox ? (
      <span className="bet-box-tile-free">Free</span>
    ) : (
      <CoinAmount amount={toCoins(box.price, PRICE_UNIT_MODE)} animated={false} iconClassName="h-4 w-4" />
    )}
  </button>
));
BoxTile.displayName = 'BoxTile';

export const FigmaHomePage: React.FC<FigmaHomePageProps> = ({ boxes, onOpenBox, onViewAllBoxes }) => {
  const { isAuthenticated, openAuthModal } = useAuth();
  const { balance } = useWallet();
  const { stripeSettings } = useBoxes();
  const { setView, setShowTopUpModal } = useUI();
  const [category, setCategory] = useState('all');
  const [showAffordableOnly, setShowAffordableOnly] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // The header dispatches this whenever the shared mobile menu opens or
  // closes (including via the backdrop or a nav link), so the dock's
  // "More" button can reflect and control the same state.
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const handleMenuState = (event: Event) => {
      const detail = (event as CustomEvent<{ isOpen: boolean }>).detail;
      setIsMobileMenuOpen(Boolean(detail?.isOpen));
    };
    window.addEventListener('pullz:mobile-menu-state', handleMenuState);
    return () => window.removeEventListener('pullz:mobile-menu-state', handleMenuState);
  }, []);

  // Same tag-derived category tabs shown on the Boxes page, so the two
  // surfaces stay in sync.
  const categoryModels = useMemo(
    () => boxes.map((box) => ({ box, tags: getBoxTags(box) })),
    [boxes],
  );

  const categories = useMemo(() => {
    const counts = new Map<string, number>();
    categoryModels.forEach(({ tags }) => {
      tags.forEach((tag) => counts.set(tag, (counts.get(tag) ?? 0) + 1));
    });

    return Array.from(counts.entries())
      .map(([id, count]) => ({
        id,
        title: stripeSettings.boxTagLabels[id] || id
          .split(/[-_\s]+/)
          .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
          .join(' '),
        iconClass: stripeSettings.boxTagIcons[id] ?? '',
        count,
      }))
      .sort((a, b) => b.count - a.count || a.title.localeCompare(b.title));
  }, [categoryModels, stripeSettings.boxTagIcons, stripeSettings.boxTagLabels]);

  const orderedCategories = useMemo(
    () => [
      ...CATEGORY_ORDER,
      ...categories.map((entry) => entry.id).filter((id) => !CATEGORY_ORDER.includes(id)),
    ]
      .map((id) => (id === 'all' ? { id: 'all', title: 'All boxes', iconClass: '' } : categories.find((entry) => entry.id === id)))
      .filter((entry): entry is { id: string; title: string; iconClass: string } => Boolean(entry)),
    [categories],
  );

  // Signed-in users already have their own claim flows for the free
  // sign-up box (header tooltip, profile, etc.) — keep it out of the
  // general list once they're logged in. Signed-out visitors still see
  // it here, called out as a sign-up bonus rather than a regular box.
  const visibleBoxes = useMemo(
    () => (isAuthenticated ? boxes.filter((box) => !box.isDaily) : boxes),
    [boxes, isAuthenticated],
  );

  const filteredBoxes = useMemo(() => visibleBoxes.filter((box) => {
    if (category !== 'all' && !getBoxTags(box).includes(normalizeBoxTag(category))) return false;
    if (showAffordableOnly && !box.isDaily && toCoins(box.price, PRICE_UNIT_MODE) > balance) return false;
    return true;
  }), [balance, category, showAffordableOnly, visibleBoxes]);

  const promoBoxes = visibleBoxes.slice(0, 3);
  const heroSlides = stripeSettings.homeHeroSlides;
  const hasCustomHeroSlides = heroSlides.length > 0;

  const handleHeroSlideClick = (slide: HomeHeroSlide) => {
    const link = slide.link.trim();
    if (!link) return;

    const matchedBox = boxes.find((box) => box.id === link || box.name.toLowerCase() === link.toLowerCase());
    if (matchedBox) {
      onOpenBox(matchedBox.id);
      return;
    }
    if (/^https?:\/\//i.test(link)) {
      window.open(link, '_blank', 'noopener,noreferrer');
      return;
    }
    if (link === '/boxes' || link.toLowerCase() === 'boxes') {
      onViewAllBoxes();
      return;
    }
    if (typeof window !== 'undefined') {
      window.location.href = link;
    }
  };

  const toggleMobileMenu = () => {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(new CustomEvent('pullz:toggle-mobile-menu'));
  };

  const handleBalanceClick = () => {
    if (!isAuthenticated) {
      openAuthModal('login');
      return;
    }
    setShowTopUpModal(true);
  };

  return (
    <main className="bet-home">
      <section className="bet-home-tournaments">
        <div className="bet-home-promos">
          {hasCustomHeroSlides
            ? heroSlides.map((slide, index) => (
                <button
                  type="button"
                  key={slide.id}
                  style={{ background: slide.backgroundColor, color: '#fff' }}
                  onClick={() => handleHeroSlideClick(slide)}
                >
                  {slide.text ? <span><strong>{slide.text}</strong></span> : null}
                  {slide.image ? (
                    <img src={slide.image} alt="" loading="eager" fetchPriority={index === 0 ? 'high' : 'auto'} decoding="async" />
                  ) : null}
                </button>
              ))
            : promoBoxes.map((box, index) => (
                <button type="button" key={box.id} className={index === 0 ? 'is-orange' : 'is-black'} onClick={() => onOpenBox(box.id)}>
                  <span><i><ChevronRight /></i><small>{index === 0 ? 'All boxes' : 'Hot boxes'}</small><strong>{box.name}</strong></span>
                  {box.image ? <img src={box.image} alt="" loading="eager" fetchPriority={index === 0 ? 'high' : 'auto'} decoding="async" /> : null}
                </button>
              ))}
        </div>
      </section>
      <BetLiveWinsTicker />
      <section className="bet-home-events">
        <div className="bet-home-events-title">
          <h2>Top Boxes</h2>
          <button
            type="button"
            className="bet-home-toggle"
            onClick={() => setShowAffordableOnly((value) => !value)}
            aria-pressed={showAffordableOnly}
          >
            <span>Enough coins to open</span>
            <i className={showAffordableOnly ? 'is-on' : ''} />
          </button>
        </div>
        <div className="bet-home-categories">
          {orderedCategories.map(({ id, title, iconClass }) => (
            <button type="button" key={id} className={category === id ? 'is-active' : ''} onClick={() => setCategory(id)}>
              {id !== 'all' && iconClass && isCategoryIconUrl(iconClass) ? (
                <img src={iconClass} alt="" loading="lazy" decoding="async" />
              ) : id !== 'all' && iconClass ? (
                <i aria-hidden="true" className={sanitizeFontAwesomeClass(iconClass)} />
              ) : (
                <Boxes aria-hidden="true" />
              )}
              {title}
            </button>
          ))}
        </div>
        <div className="bet-home-event-list">
          {filteredBoxes.slice(0, 12).map((box, index) => (
            <BoxTile
              key={box.id}
              box={box}
              isFreeSignupBox={Boolean(box.isDaily)}
              isPriority={index < 4}
              onOpen={() => onOpenBox(box.id, Boolean(box.isDaily))}
            />
          ))}
          {!filteredBoxes.length ? <div className="bet-home-empty"><Sparkles /><strong>No boxes found</strong><span>Try another category.</span></div> : null}
        </div>
        <div className="bet-home-trustpilot">
          <img src={TRUSTPILOT_LOGO_URL} alt="Trustpilot" loading="lazy" decoding="async" />
        </div>
      </section>
      <nav className="bet-home-dock" aria-label="Homepage navigation">
        <button type="button" className="is-active" onClick={() => setView({ type: 'HOME' })}><Flame /><span>Home</span></button>
        <button type="button" onClick={onViewAllBoxes}><Boxes /><span>Boxes</span></button>
        <button
          type="button"
          onClick={handleBalanceClick}
          aria-label={isAuthenticated ? 'Add coins' : 'Sign in to add coins'}
        >
          <img src={COIN_ICON} alt="" className="bet-home-dock-coin" />
          <span>{isAuthenticated ? balance.toLocaleString(undefined, { maximumFractionDigits: 0 }) : '——'}</span>
        </button>
        <button type="button" onClick={toggleMobileMenu} aria-expanded={isMobileMenuOpen}>
          {isMobileMenuOpen ? <X /> : <span className="bet-home-dock-more-dots" aria-hidden="true"><i /><i /><i /></span>}
          <span>{isMobileMenuOpen ? 'Close' : 'More'}</span>
        </button>
      </nav>
    </main>
  );
};
