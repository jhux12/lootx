import React from 'react';
import { Boxes, Flame, Gem, Gift, Package, ShieldCheck, Sparkles } from 'lucide-react';

type HomeCaseNavigationProps = {
  onNavigate: (query?: string) => void;
};

const categories = [
  { label: 'All boxes', query: '', Icon: Boxes },
  { label: 'Collector picks', query: '?category=collectibles', Icon: Gift },
  { label: 'Pokémon', query: '?category=pokemon', Icon: Sparkles },
  { label: 'Graded slabs', query: '?category=graded', Icon: ShieldCheck },
  { label: 'Sealed products', query: '?category=sealed', Icon: Package },
  { label: 'Trending', query: '?category=trending', Icon: Flame },
  { label: 'Premium', query: '?category=premium', Icon: Gem }
] as const;

export const HomeCaseNavigation: React.FC<HomeCaseNavigationProps> = ({ onNavigate }) => (
  <section className="px-3 sm:px-0" aria-label="Browse box categories">
    <div className="scrollbar-hide flex items-center gap-1.5 overflow-x-auto rounded-xl border border-white/[0.07] bg-[#181c28] p-1.5 shadow-[0_8px_24px_rgba(0,0,0,0.18)] sm:justify-center sm:gap-2 sm:p-2">
      {categories.map(({ label, query, Icon }, index) => (
        <button
          key={label}
          type="button"
          onClick={() => onNavigate(query || undefined)}
          className={`group inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-lg px-3 text-[11px] font-bold text-slate-400 transition-colors hover:bg-white/[0.055] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 sm:px-4 sm:text-xs ${index === 0 ? 'bg-white/[0.055] text-white' : ''}`}
        >
          <Icon className={`h-3.5 w-3.5 ${index === 0 ? 'text-violet-300' : 'text-slate-500 group-hover:text-violet-300'}`} aria-hidden="true" />
          <span>{label}</span>
        </button>
      ))}
    </div>
  </section>
);
