import React, { useEffect, useMemo, useState } from 'react';
import { Boxes, ChevronRight, Flame, Minus, Plus, Sparkles, X } from 'lucide-react';
import type { CaseItem, HomeHeroSlide, MysteryBox } from '../../types';
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

const HOW_IT_WORKS_STEPS = [
  {
    number: '01',
    title: 'Choose Your Box',
    description: 'Browse boxes and select one based on the collectibles, price, and displayed odds.'
  },
  {
    number: '02',
    title: 'Open & Reveal',
    description: 'Open the box for an animated reveal and instantly discover the real collectible you pulled.'
  },
  {
    number: '03',
    title: 'Keep It or Sell It Back',
    description: 'Keep the item for shipping or instantly sell it back for coins to open another box.'
  }
];

const HOME_FAQ_ITEMS = [
  {
    question: 'What is Ripza?',
    answer: 'Ripza is an online collectible box-opening platform. You choose a box, reveal a real item, and receive ownership of that item in your Ripza inventory. Depending on the item and available account options, you can keep it, sell it back for coins, or request shipping.'
  },
  {
    question: 'How do I open a box?',
    answer: 'Create or sign in to your account, choose a box, review its contents and odds, and select the open button. You can use coins for eligible openings, and some accounts or boxes may also have free, promotional, or reward openings. The revealed item is added to your inventory after the opening is completed.'
  },
  {
    question: 'What are coins?',
    answer: 'Coins are the balance used for eligible box openings, shipping charges where enabled, and other supported features on Ripza. Coin package pricing and any included bonus amount are shown before purchase or use.'
  },
  {
    question: 'Is opening fair?',
    answer: 'Ripza publishes box odds and provides information about how results are generated and verified. Review the box details and the provably fair information before opening.'
  },
  {
    question: 'How long does shipping take?',
    answer: 'Processing and delivery times can vary based on item availability, destination, carrier service, and account review requirements. Tracking information is provided when the shipment is prepared where available.'
  }
];

const RARITY_ORDER: CaseItem['rarity'][] = ['common', 'uncommon', 'rare', 'epic', 'legendary'];

const getBoxRarity = (box: MysteryBox): CaseItem['rarity'] => {
  if (!box.items?.length) return 'common';
  return box.items.reduce<CaseItem['rarity']>((highest, item) => {
    const itemRank = RARITY_ORDER.indexOf(item.rarity);
    const highestRank = RARITY_ORDER.indexOf(highest);
    return itemRank > highestRank ? item.rarity : highest;
  }, 'common');
};

const BoxTile: React.FC<{ box: MysteryBox; onOpen: () => void; isFreeSignupBox?: boolean; isPriority?: boolean }> = React.memo(({ box, onOpen, isFreeSignupBox, isPriority }) => (
  <button type={'button'} className={`bet-box-tile rarity-glow-${getBoxRarity(box)}${isFreeSignupBox ? ' is-free-signup' : ''}`} onClick={onOpen} aria-label={`Open ${box.name}`}>
    {isFreeSignupBox && <span className="bet-box-tile-badge">Sign-Up Bonus</span>}
    <span className="bet-box-tile-glow" aria-hidden="true" />
    <img
      src={box.image}
      alt=""
      loading={isPriority ? 'eager' : 'lazy'}
      fetchPriority={isPriority ? 'high' : 'low'}
      decoding="async"
    />
    <span className="bet-box-tile-name">{box.name}</span>
    {isFreeSignupBox ? (
      <span className="bet-box-tile-free">Free</span>
    ) : (
      <CoinAmount amount={toCoins(box.price, PRICE_UNIT_MODE)} animated={false} iconClassName="h-4 w-4" />
    )}
  </button>
));
BoxTile.displayName = 'BoxTile';

export const FigmaHomePage: React.FC<FigmaHomePageProps> = ({ boxes, onOpenBox, onViewAllBoxes }) => {
  const { isAuthenticated, openAuthModal, user } = useAuth();
  const { balance } = useWallet();
  const { stripeSettings } = useBoxes();
  const { setView, setShowTopUpModal } = useUI();
  const [category, setCategory] = useState('all');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);

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

  // Show the free sign-up box pinned first whenever it's actually still
  // available to claim — for signed-out visitors (as a sign-up bonus
  // pitch) and for signed-in users who haven't opened it yet. Once a
  // signed-in user has claimed it, it drops out of the list entirely.
  const nonDailyBoxes = useMemo(() => boxes.filter((box) => !box.isDaily), [boxes]);
  const hasUnclaimedFreeBox = !isAuthenticated || !user.lastFreeBoxClaim;

  const visibleBoxes = useMemo(() => {
    if (!hasUnclaimedFreeBox) return nonDailyBoxes;
    const freeBox = boxes.find((box) => box.isDaily);
    return freeBox ? [freeBox, ...nonDailyBoxes] : boxes;
  }, [boxes, hasUnclaimedFreeBox, nonDailyBoxes]);

  const filteredBoxes = useMemo(() => visibleBoxes.filter((box) => {
    if (category !== 'all' && !getBoxTags(box).includes(normalizeBoxTag(category))) return false;
    return true;
  }), [category, visibleBoxes]);

  const promoBoxes = nonDailyBoxes.slice(0, 3);
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

  const getHeroSlideStyle = (slide: HomeHeroSlide): React.CSSProperties => {
    const color = slide.textColor || '#ffffff';
    if (slide.backgroundType === 'gradient') {
      return { background: `linear-gradient(135deg, ${slide.backgroundGradientFrom}, ${slide.backgroundGradientTo})`, color };
    }
    if (slide.backgroundType === 'image' && slide.backgroundImage) {
      return {
        backgroundImage: `url(${slide.backgroundImage})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        color
      };
    }
    return { background: slide.backgroundColor, color };
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
                  style={getHeroSlideStyle(slide)}
                  onClick={() => handleHeroSlideClick(slide)}
                >
                  <span><i><ChevronRight /></i><small>{slide.shopNowText || 'Shop now'}</small>{slide.text ? <strong>{slide.text}</strong> : null}</span>
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
          <button type="button" className="bet-home-view-all" onClick={onViewAllBoxes}>
            <span>View All</span>
            <ChevronRight />
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
          {filteredBoxes.slice(0, 6).map((box, index) => (
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
        <a className="bet-trustpilot" href="https://www.trustpilot.com" target="_blank" rel="noreferrer" aria-label="View Trustpilot"><img src="https://a.storyblok.com/f/91079/4000x2000/ea4fb218a1/trustpilot-logo.png" alt="Trustpilot" loading="lazy" decoding="async" /></a>
      </section>

      <section className="bet-home-how-it-works" aria-labelledby="home-how-it-works-title">
        <h2 id="home-how-it-works-title">How It Works</h2>
        <div className="bet-home-how-it-works-grid">
          {HOW_IT_WORKS_STEPS.map((step, index) => (
            <div className="bet-home-how-it-works-step" key={step.number}>
              {stripeSettings.howItWorksStepImageUrls[index] ? (
                <img src={stripeSettings.howItWorksStepImageUrls[index]} alt="" loading="lazy" decoding="async" />
              ) : (
                <span className="bet-home-how-it-works-number" aria-hidden="true">{step.number}</span>
              )}
              <strong>{step.title}</strong>
              <p>{step.description}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bet-home-faq" aria-labelledby="home-faq-title">
        <h2 id="home-faq-title">Frequently Asked Questions</h2>
        <div className="bet-home-faq-list">
          {HOME_FAQ_ITEMS.map((item, index) => {
            const isOpen = openFaqIndex === index;
            return (
              <div className={`bet-home-faq-item${isOpen ? ' is-open' : ''}`} key={item.question}>
                <button
                  type="button"
                  className="bet-home-faq-question"
                  onClick={() => setOpenFaqIndex(isOpen ? null : index)}
                  aria-expanded={isOpen}
                >
                  <span>{item.question}</span>
                  {isOpen ? <Minus aria-hidden="true" /> : <Plus aria-hidden="true" />}
                </button>
                {isOpen ? <p className="bet-home-faq-answer">{item.answer}</p> : null}
              </div>
            );
          })}
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
