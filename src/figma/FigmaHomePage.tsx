import React, { useMemo, useState } from 'react';
import { Boxes, ChevronRight, CircleEllipsis, Flame, ListFilter, Search, Sparkles, WalletCards } from 'lucide-react';
import type { MysteryBox } from '../../types';
import { CoinAmount } from '../../components/CoinAmount';
import { PRICE_UNIT_MODE, toCoins } from '../../utils/coins';
import { useAuth, useBoxes, useUI, useWallet } from '../../context/GameContext';
import { getBoxTags, normalizeBoxTag } from '../../utils/boxTags';
import { LiveTicker } from '../../components/LiveTicker';
import { BOX_SORT_OPTIONS, BoxSortOption, sortBoxes } from '../lib/boxSort';

type FigmaHomePageProps = {
  boxes: MysteryBox[];
  onOpenBox: (boxId: string, isFree?: boolean) => void;
  onViewAllBoxes: () => void;
};

// This page is the isolated Betting Mobile Figma homepage implementation.

const BoxTile: React.FC<{ box: MysteryBox; onOpen: () => void }> = ({ box, onOpen }) => (
  <button type="button" className="bet-box-tile" onClick={onOpen} aria-label={`Open ${box.name}`}>
    <img src={box.image} alt="" loading="lazy" decoding="async" />
    <CoinAmount amount={toCoins(box.price, PRICE_UNIT_MODE)} animated={false} iconClassName="h-4 w-4" />
  </button>
);

export const FigmaHomePage: React.FC<FigmaHomePageProps> = ({ boxes, onOpenBox, onViewAllBoxes }) => {
  const { isAuthenticated, openAuthModal } = useAuth();
  const { stripeSettings } = useBoxes();
  const { balance } = useWallet();
  const { setView } = useUI();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [affordableOnly, setAffordableOnly] = useState(false);
  const [sortOption, setSortOption] = useState<BoxSortOption>('featured');
  const categoryItems = useMemo(() => {
    const counts = new Map<string, number>();
    boxes.forEach((box) => getBoxTags(box).forEach((tag) => counts.set(tag, (counts.get(tag) ?? 0) + 1)));
    return [{ id: 'all', label: 'All boxes' }, ...Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([id]) => ({
        id,
        label: stripeSettings.boxTagLabels[id] || id.split(/[-_\s]+/).map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ')
      }))];
  }, [boxes, stripeSettings.boxTagLabels]);
  const filteredBoxes = useMemo(() => sortBoxes(boxes.filter((box) => {
    if (query && !box.name.toLowerCase().includes(query.toLowerCase())) return false;
    if (category !== 'all' && !getBoxTags(box).includes(normalizeBoxTag(category))) return false;
    if (affordableOnly && (!isAuthenticated || toCoins(box.price, PRICE_UNIT_MODE) > balance)) return false;
    return true;
  }), sortOption), [affordableOnly, balance, boxes, category, isAuthenticated, query, sortOption]);
  const promoBoxes = boxes.slice(0, 3);

  return (
    <main className="bet-home">
      <label className="bet-home-search"><Search aria-hidden="true" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by boxes, items" /></label>
      <section className="bet-home-tournaments">
        <div className="bet-home-promos">
          {promoBoxes.map((box, index) => (
            <button type="button" key={box.id} className={index === 0 ? 'is-orange' : 'is-black'} onClick={() => onOpenBox(box.id)}>
              <span><i><ChevronRight /></i><small>{index === 0 ? 'All boxes' : 'Hot boxes'}</small><strong>{box.name}</strong></span>
              {box.image ? <img src={box.image} alt="" /> : null}
            </button>
          ))}
        </div>
      </section>
      <section className="bet-home-live" aria-label="Recent live pulls"><LiveTicker /></section>
      <section className="bet-home-events">
        <div className="bet-home-events-title"><h2>Top Boxes</h2><button type="button" className={affordableOnly ? 'is-enabled' : ''} onClick={() => setAffordableOnly((value) => !value)} aria-pressed={affordableOnly}><span>Enough coins to open</span><i /></button></div>
        <div className="bet-home-categories">
          <label className="bet-home-sort"><ListFilter aria-hidden="true" /><span>{BOX_SORT_OPTIONS.find((option) => option.id === sortOption)?.label}</span><select value={sortOption} onChange={(event) => setSortOption(event.target.value as BoxSortOption)} aria-label="Sort boxes">{BOX_SORT_OPTIONS.map((option) => <option value={option.id} key={option.id}>{option.label}</option>)}</select></label>
          {categoryItems.map(({ id, label }) => <button type="button" key={id} className={category === id ? 'is-active' : ''} onClick={() => setCategory(id)}><Boxes aria-hidden="true" />{label}</button>)}
        </div>
        <div className="bet-home-event-list">
          {filteredBoxes.slice(0, 12).map((box) => <BoxTile key={box.id} box={box} onOpen={() => onOpenBox(box.id, Boolean(box.isDaily))} />)}
          {!filteredBoxes.length ? <div className="bet-home-empty"><Sparkles /><strong>No boxes found</strong><span>Try another search or category.</span></div> : null}
        </div>
        <a className="bet-trustpilot" href="https://www.trustpilot.com" target="_blank" rel="noreferrer" aria-label="View Trustpilot"><img src="https://a.storyblok.com/f/91079/4000x2000/ea4fb218a1/trustpilot-logo.png" alt="Trustpilot" loading="lazy" decoding="async" /></a>
      </section>
      <nav className="bet-home-dock" aria-label="Homepage navigation">
        <button type="button" className="is-active" onClick={() => setView({ type: 'HOME' })}><Flame /><span>Home</span></button>
        <button type="button" onClick={onViewAllBoxes}><Boxes /><span>Boxes</span></button>
        <button type="button" onClick={() => isAuthenticated ? setView({ type: 'PROFILE' }) : openAuthModal('login')}><WalletCards /><span>{isAuthenticated ? <CoinAmount amount={balance} animated={false} formatOptions={{ maximumFractionDigits: 0 }} iconClassName="h-3 w-3" /> : '— —'}</span></button>
        <button type="button" onClick={() => window.dispatchEvent(new CustomEvent('pullz:toggle-mobile-menu'))}><CircleEllipsis /><span>More</span></button>
      </nav>
    </main>
  );
};
