import React, { useMemo, useState } from 'react';
import { Boxes, ChevronRight, CircleEllipsis, Flame, Gift, Search, Sparkles, Trophy, WalletCards } from 'lucide-react';
import type { MysteryBox } from '../../types';
import { CoinAmount } from '../../components/CoinAmount';
import { PRICE_UNIT_MODE, toCoins } from '../../utils/coins';
import { useAuth, useUI } from '../../context/GameContext';

type FigmaHomePageProps = {
  boxes: MysteryBox[];
  onOpenBox: (boxId: string, isFree?: boolean) => void;
  onViewAllBoxes: () => void;
};

// This page is the isolated Betting Mobile Figma homepage implementation.

const categoryItems = [
  { id: 'all', label: 'All boxes', icon: Boxes },
  { id: 'free', label: 'Free', icon: Gift },
  { id: 'popular', label: 'Popular', icon: Flame },
  { id: 'premium', label: 'Premium', icon: Trophy },
] as const;

const BoxTile: React.FC<{ box: MysteryBox; onOpen: () => void }> = ({ box, onOpen }) => (
  <button type="button" className="bet-box-tile" onClick={onOpen} aria-label={`Open ${box.name}`}>
    <img src={box.image} alt="" loading="lazy" decoding="async" />
    <CoinAmount amount={toCoins(box.price, PRICE_UNIT_MODE)} animated={false} iconClassName="h-4 w-4" />
  </button>
);

export const FigmaHomePage: React.FC<FigmaHomePageProps> = ({ boxes, onOpenBox, onViewAllBoxes }) => {
  const { isAuthenticated, openAuthModal } = useAuth();
  const { setView } = useUI();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<(typeof categoryItems)[number]['id']>('all');
  const filteredBoxes = useMemo(() => boxes.filter((box) => {
    if (query && !box.name.toLowerCase().includes(query.toLowerCase())) return false;
    if (category === 'free') return Boolean(box.isDaily);
    if (category === 'premium') return Number(box.price) >= Math.max(...boxes.map((entry) => Number(entry.price) || 0)) * 0.6;
    return true;
  }), [boxes, category, query]);
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
      <section className="bet-home-events">
        <div className="bet-home-events-title"><h2>Top Boxes</h2><span>LIVE <i /></span></div>
        <div className="bet-home-categories">
          {categoryItems.map(({ id, label, icon: Icon }) => <button type="button" key={id} className={category === id ? 'is-active' : ''} onClick={() => setCategory(id)}><Icon aria-hidden="true" />{label}</button>)}
        </div>
        <div className="bet-home-event-list">
          {filteredBoxes.slice(0, 12).map((box) => <BoxTile key={box.id} box={box} onOpen={() => onOpenBox(box.id, Boolean(box.isDaily))} />)}
          {!filteredBoxes.length ? <div className="bet-home-empty"><Sparkles /><strong>No boxes found</strong><span>Try another search or category.</span></div> : null}
        </div>
      </section>
      <nav className="bet-home-dock" aria-label="Homepage navigation">
        <button type="button" className="is-active" onClick={() => setView({ type: 'HOME' })}><Flame /><span>Home</span></button>
        <button type="button" onClick={onViewAllBoxes}><Boxes /><span>Boxes</span></button>
        <button type="button" onClick={() => isAuthenticated ? setView({ type: 'PROFILE' }) : openAuthModal('login')}><WalletCards /><span>Wallet</span></button>
        <button type="button" onClick={() => setView({ type: 'BONUSES' })}><CircleEllipsis /><span>More</span></button>
      </nav>
    </main>
  );
};
