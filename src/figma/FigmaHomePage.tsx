import React, { useMemo, useState } from 'react';
import { Boxes, ChevronRight, CircleEllipsis, Flame, Gift, Search, Sparkles, Trophy, WalletCards } from 'lucide-react';
import type { MysteryBox } from '../../types';
import { CoinAmount } from '../../components/CoinAmount';
import { PRICE_UNIT_MODE, toCoins } from '../../utils/coins';
import { useAuth } from '../../context/GameContext';

type FigmaHomePageProps = {
  boxes: MysteryBox[];
  onOpenBox: (boxId: string, isFree?: boolean) => void;
  onViewAllBoxes: () => void;
};

const categoryItems = [
  { id: 'all', label: 'All cases', icon: Boxes },
  { id: 'free', label: 'Free', icon: Gift },
  { id: 'popular', label: 'Popular', icon: Flame },
  { id: 'premium', label: 'Premium', icon: Trophy },
] as const;

const CaseEventCard: React.FC<{ box: MysteryBox; onOpen: () => void; live?: boolean }> = ({ box, onOpen, live }) => (
  <article className="bet-case-card">
    <div className="bet-case-card-head"><span>{live ? 'Live case' : 'Featured case'}</span>{live ? <em><i /> LIVE</em> : null}</div>
    <div className="bet-case-matchup">
      <div><img src={box.image} alt="" loading="lazy" decoding="async" /><strong>Open</strong></div>
      <div className="bet-case-score"><small>LootX</small><strong>1 : 1</strong><span><i /> Ready now</span></div>
      <div><img src={box.image} alt="" loading="lazy" decoding="async" /><strong>Win</strong></div>
    </div>
    <div className="bet-case-actions">
      <button type="button" onClick={onOpen}><span>Price</span><CoinAmount amount={toCoins(box.price, PRICE_UNIT_MODE)} animated={false} iconClassName="h-3.5 w-3.5" /></button>
      <button type="button" onClick={onOpen}><span>Items</span><strong>{box.items?.length ?? 0}</strong></button>
      <button type="button" className="bet-case-open" onClick={onOpen}>Open</button>
    </div>
  </article>
);

export const FigmaHomePage: React.FC<FigmaHomePageProps> = ({ boxes, onOpenBox, onViewAllBoxes }) => {
  const { user, isAuthenticated } = useAuth();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<(typeof categoryItems)[number]['id']>('all');
  const displayName = isAuthenticated ? (user.username || user.displayName || user.name || 'Player') : 'Player';
  const filteredBoxes = useMemo(() => boxes.filter((box) => {
    if (query && !box.name.toLowerCase().includes(query.toLowerCase())) return false;
    if (category === 'free') return Boolean(box.isDaily);
    if (category === 'premium') return Number(box.price) >= Math.max(...boxes.map((entry) => Number(entry.price) || 0)) * 0.6;
    return true;
  }), [boxes, category, query]);
  const promoBoxes = boxes.slice(0, 3);

  return (
    <main className="bet-home">
      <header className="bet-home-header">
        <div><span>Hello,</span><h1>{displayName}</h1></div>
        <button type="button" onClick={onViewAllBoxes} aria-label="Browse all cases">+</button>
      </header>
      <label className="bet-home-search"><Search aria-hidden="true" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by cases, items" /></label>
      <section className="bet-home-tournaments">
        <h2>Collections</h2>
        <div className="bet-home-promos">
          {promoBoxes.map((box, index) => (
            <button type="button" key={box.id} className={index === 0 ? 'is-orange' : 'is-black'} onClick={() => onOpenBox(box.id)}>
              <span><i><ChevronRight /></i><small>{index === 0 ? 'All cases' : 'Hot collection'}</small><strong>{box.name}</strong></span>
              {box.image ? <img src={box.image} alt="" /> : null}
            </button>
          ))}
        </div>
      </section>
      <section className="bet-home-events">
        <div className="bet-home-events-title"><h2>Top Cases</h2><span>LIVE <i /></span></div>
        <div className="bet-home-categories">
          {categoryItems.map(({ id, label, icon: Icon }) => <button type="button" key={id} className={category === id ? 'is-active' : ''} onClick={() => setCategory(id)}><Icon aria-hidden="true" />{label}</button>)}
        </div>
        <div className="bet-home-event-list">
          {filteredBoxes.slice(0, 8).map((box, index) => <CaseEventCard key={box.id} box={box} live={index < 2} onOpen={() => onOpenBox(box.id, Boolean(box.isDaily))} />)}
          {!filteredBoxes.length ? <div className="bet-home-empty"><Sparkles /><strong>No cases found</strong><span>Try another search or category.</span></div> : null}
        </div>
      </section>
      <nav className="bet-home-dock" aria-label="Homepage navigation">
        <button type="button" className="is-active"><Flame /><span>Home</span></button>
        <button type="button" onClick={onViewAllBoxes}><Boxes /><span>Cases</span></button>
        <button type="button"><WalletCards /><span>Wallet</span></button>
        <button type="button"><CircleEllipsis /><span>More</span></button>
      </nav>
    </main>
  );
};
