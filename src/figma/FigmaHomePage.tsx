import React from 'react';
import { ChevronRight, CircleDollarSign, Gamepad2, Gift, Headphones, ShieldCheck, Sparkles, Swords, Users } from 'lucide-react';
import type { MysteryBox } from '../../types';
import { CoinAmount } from '../../components/CoinAmount';
import { PRICE_UNIT_MODE, toCoins } from '../../utils/coins';

type FigmaHomePageProps = {
  boxes: MysteryBox[];
  onOpenBox: (boxId: string, isFree?: boolean) => void;
  onViewAllBoxes: () => void;
};

const SectionTitle: React.FC<{ eyebrow?: string; children: React.ReactNode }> = ({ eyebrow, children }) => (
  <div className="lootx-figma-section-title">
    {eyebrow ? <span>{eyebrow}</span> : null}
    <h2>{children}</h2>
  </div>
);

const CaseTile: React.FC<{ box: MysteryBox; onOpen: () => void; badge?: string }> = ({ box, onOpen, badge }) => (
  <button type="button" className="lootx-figma-case" onClick={onOpen}>
    {badge ? <span className="lootx-figma-case-badge">{badge}</span> : null}
    <div className="lootx-figma-case-art">
      {box.image ? <img src={box.image} alt="" loading="lazy" decoding="async" /> : null}
    </div>
    <strong>{box.name}</strong>
    <span className="lootx-figma-price">
      <CoinAmount amount={toCoins(box.price, PRICE_UNIT_MODE)} animated={false} iconClassName="h-3.5 w-3.5" />
    </span>
  </button>
);

export const FigmaHomePage: React.FC<FigmaHomePageProps> = ({ boxes, onOpenBox, onViewAllBoxes }) => {
  const freeCases = boxes.filter((box) => box.isDaily).slice(0, 4);
  const featuredCases = boxes.filter((box) => !box.isDaily).slice(0, 6);
  const moreCases = boxes.filter((box) => !box.isDaily).slice(6, 12);
  const heroBox = featuredCases[0] ?? boxes[0];

  return (
    <main className="lootx-figma-home">
      <section className="lootx-figma-metrics" aria-label="Site activity">
        {[
          [Users, '12,654', 'Players'],
          [Sparkles, '300', 'Online'],
          [Gift, '2,174', 'Cases opened'],
          [ShieldCheck, 'Provably fair', 'Verified results'],
        ].map(([Icon, value, label]) => {
          const MetricIcon = Icon as typeof Users;
          return <div key={String(label)}><MetricIcon aria-hidden="true" /><strong>{String(value)}</strong><span>{String(label)}</span></div>;
        })}
      </section>

      <section className="lootx-figma-live" aria-label="Live drops">
        <button type="button" className="lootx-figma-live-lead" onClick={onViewAllBoxes}><Sparkles aria-hidden="true" /><span>Live<br />drops</span></button>
        <div className="lootx-figma-live-track">
          {boxes.slice(0, 9).map((box) => (
            <button type="button" key={`live-${box.id}`} onClick={() => onOpenBox(box.id)}>
              {box.image ? <img src={box.image} alt="" loading="lazy" decoding="async" /> : null}
              <span>{box.name}</span>
            </button>
          ))}
        </div>
      </section>

      <button type="button" className="lootx-figma-promo" onClick={() => heroBox && onOpenBox(heroBox.id)}>
        <span><small>Weekly reward</small><strong>Get your free case</strong><em>Open now</em></span>
        {heroBox?.image ? <img src={heroBox.image} alt="" /> : null}
        <ChevronRight aria-hidden="true" />
      </button>

      <section className="lootx-figma-stage">
        <div className="lootx-figma-stage-copy">
          <small>LootX cases</small>
          <h1>Open cases.<br />Win real collectibles.</h1>
          <p>Choose a case, reveal your item, then keep it or sell it back using the existing LootX system.</p>
          <button type="button" onClick={onViewAllBoxes}>Explore cases <ChevronRight aria-hidden="true" /></button>
        </div>
        {heroBox?.image ? <img src={heroBox.image} alt={heroBox.name} /> : null}
      </section>

      <nav className="lootx-figma-category-strip" aria-label="Case categories">
        {[
          [Gift, 'Free cases'],
          [Sparkles, 'Rarity cases'],
          [Swords, 'Weapon cases'],
          [Gamepad2, 'Game cases'],
          [CircleDollarSign, 'Farm cases'],
        ].map(([Icon, label]) => {
          const CategoryIcon = Icon as typeof Gift;
          return <button type="button" key={String(label)} onClick={onViewAllBoxes}><CategoryIcon aria-hidden="true" />{String(label)}</button>;
        })}
      </nav>

      {freeCases.length ? (
        <section className="lootx-figma-case-section">
          <SectionTitle eyebrow="Free">Free cases</SectionTitle>
          <div className="lootx-figma-case-grid lootx-figma-case-grid--four">
            {freeCases.map((box, index) => <CaseTile key={box.id} box={box} badge={index === 0 ? 'Free' : undefined} onOpen={() => onOpenBox(box.id, true)} />)}
          </div>
        </section>
      ) : null}

      <section className="lootx-figma-case-section">
        <SectionTitle eyebrow="Popular">Featured cases</SectionTitle>
        <div className="lootx-figma-case-grid">
          {featuredCases.map((box, index) => <CaseTile key={box.id} box={box} badge={index === 0 ? 'Top' : index === 2 ? 'New' : undefined} onOpen={() => onOpenBox(box.id)} />)}
        </div>
        <button type="button" className="lootx-figma-view-all" onClick={onViewAllBoxes}>View all cases <ChevronRight aria-hidden="true" /></button>
      </section>

      {moreCases.length ? (
        <section className="lootx-figma-case-section">
          <SectionTitle eyebrow="More chances">More cases</SectionTitle>
          <div className="lootx-figma-case-grid">
            {moreCases.map((box) => <CaseTile key={box.id} box={box} onOpen={() => onOpenBox(box.id)} />)}
          </div>
        </section>
      ) : null}

      <footer className="lootx-figma-footer">
        <div className="lootx-figma-footer-copy">
          <strong>LOOTX</strong>
          <p>Open cases and manage real collectible rewards through your existing LootX account.</p>
        </div>
        <div><strong>Information</strong><button type="button">FAQ</button><button type="button">Terms of service</button><button type="button">Privacy policy</button></div>
        <div><strong>Account</strong><button type="button" onClick={onViewAllBoxes}>All cases</button><button type="button">Bonuses</button><button type="button">Profile</button></div>
        <div><strong>Support</strong><span><Headphones aria-hidden="true" />Customer support</span><small>Available through your LootX account</small></div>
      </footer>
    </main>
  );
};
