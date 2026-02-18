import React, { useMemo, useState } from 'react';
import { Search, Filter, ChevronDown } from 'lucide-react';
import { useGame } from '../context/GameContext';
import { useSound } from '../context/SoundContext';
import { getBoxTags, normalizeBoxTag } from '../utils/boxTags';
import { PRICE_UNIT_MODE, toCoins } from '../utils/coins';
import { CoinAmount } from './CoinAmount';
import { TopDropsSlider } from './TopDropsSlider';

type BoxCatalogProps = {
  isChatCollapsed: boolean;
};

export const BoxCatalog: React.FC<BoxCatalogProps> = () => {
  const { boxes, setView } = useGame();
  const { playSound } = useSound();
  const [activeCategory, setActiveCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const displayBoxes = useMemo(
    () => boxes.filter((box) => !box.isDaily && !(box.currencyType === 'XP' || Number(box.priceXP ?? 0) > 0)),
    [boxes]
  );

  const categories = useMemo(() => {
    const counts = new Map<string, number>();
    displayBoxes
      .filter((box) => !box.isUserCreated)
      .forEach((box) => {
        getBoxTags(box).forEach((tag) => {
          counts.set(tag, (counts.get(tag) ?? 0) + 1);
        });
      });

    return Array.from(counts.entries())
      .map(([id, count]) => ({
        id,
        title: id
          .split(/[-_\s]+/)
          .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
          .join(' '),
        count
      }))
      .sort((a, b) => b.count - a.count || a.title.localeCompare(b.title));
  }, [displayBoxes]);

  const filteredBoxes = useMemo(() => {
    return displayBoxes.filter((box) => {
      if (box.isUserCreated) return false;
      const tags = getBoxTags(box);
      const matchesCategory = activeCategory === 'all' || tags.includes(normalizeBoxTag(activeCategory));
      const matchesSearch = box.name.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [activeCategory, displayBoxes, searchQuery]);

  const groupedBoxes = useMemo(() => {
    if (activeCategory !== 'all') {
      const selected = categories.find((category) => category.id === activeCategory);
      return [
        {
          id: activeCategory,
          title: selected?.title ?? 'Boxes',
          boxes: filteredBoxes
        }
      ];
    }

    return categories
      .map((category) => ({
        id: category.id,
        title: category.title,
        boxes: filteredBoxes.filter((box) => getBoxTags(box).includes(category.id))
      }))
      .filter((group) => group.boxes.length > 0);
  }, [activeCategory, categories, filteredBoxes]);

  const hotPicks = useMemo(
    () => [...displayBoxes].filter((box) => !box.isUserCreated).sort((a, b) => toCoins(b.price, PRICE_UNIT_MODE) - toCoins(a.price, PRICE_UNIT_MODE)).slice(0, 6),
    [displayBoxes]
  );



  return (
    <div className="w-full pb-20">
      <div className="w-full relative z-20">
        <div className="w-full py-0 md:py-6 max-w-screen-2xl mx-auto px-2 md:px-16">
          <TopDropsSlider
            boxes={displayBoxes}
            onOpenBox={(boxId) => {
              playSound('click');
              setView({ type: 'CASE_OPENING', boxId });
            }}
          />
        </div>
      </div>

      <div
        className="w-full bg-cover bg-center border-y border-white/5 relative"
        style={{
          backgroundImage:
            'linear-gradient(to bottom, rgba(10, 10, 10, 0) 0%, rgba(10, 10, 10, 1) 80%), url("https://dlakysukfcsatvazxavf.supabase.co/storage/v1/object/public/cms-assets/events/d9b9dd07-b0b9-4dd9-ab9a-8c6c39ff2573/dc87c8d4a11b30b9a17b26ab68b228a297884306/banner.webp")'
        }}
      >
        <div className="mx-auto flex max-w-[1675px] flex-col items-center px-4 pt-8 pb-12">
          <h1 className="text-3xl md:text-5xl font-black text-white italic tracking-tighter mb-8 drop-shadow-lg">
            Hot <span className="text-indigo-500">Picks</span>
          </h1>

          <div className="flex flex-wrap justify-center gap-4 w-full">
            {hotPicks.map((box) => (
              <button
                key={box.id}
                onClick={() => {
                  playSound('click');
                  setView({ type: 'CASE_OPENING', boxId: box.id });
                }}
                className="group relative flex flex-col items-center w-[150px] sm:w-[165px] md:w-[180px] cursor-pointer transition-transform hover:-translate-y-1"
                type="button"
              >
                <div className="relative w-full h-[170px] sm:h-[180px] flex items-center justify-center">
                  <img
                    src={box.image}
                    alt={box.name}
                    className="h-full w-full object-contain drop-shadow-xl group-hover:scale-105 transition-transform duration-300"
                  />
                </div>
                <div className="mt-2 text-center">
                  <div className="text-xs font-bold text-white truncate max-w-[150px] mb-2">{box.name}</div>
                  <div className="inline-flex items-center gap-1.5 bg-indigo-900/80 border border-indigo-500/50 rounded-md px-3 py-1">
                    <CoinAmount
                      amount={toCoins(box.price, PRICE_UNIT_MODE)}
                      formatOptions={{ maximumFractionDigits: 0 }}
                      className="text-sm font-bold text-white"
                      iconClassName="h-4 w-4"
                    />
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="w-full border-b border-white/5 bg-neutral-950 shadow-xl">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="-mx-1 mb-4 flex items-center gap-2 overflow-x-auto border-b border-white/5 px-1 pb-4 scrollbar-hide md:mx-0 md:border-none md:px-0 md:pb-0 [scrollbar-gutter:stable] [-webkit-overflow-scrolling:touch]">
            <button
              onClick={() => setActiveCategory('all')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold whitespace-nowrap transition-all ${activeCategory === 'all' ? 'bg-white/10 text-white' : 'text-neutral-500 hover:text-neutral-300'}`}
            >
              All
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold whitespace-nowrap transition-all ${activeCategory === cat.id ? 'bg-white/10 text-white' : 'text-neutral-500 hover:text-neutral-300'}`}
              >
                <div className="w-4 h-4 rounded-full bg-indigo-500" />
                {cat.title}
              </button>
            ))}
          </div>

          <div className="flex flex-col items-center gap-4 rounded-xl border border-white/5 bg-neutral-900/50 p-2 md:flex-row">
            <div className="flex w-full flex-1 items-center gap-2 rounded-lg border border-white/5 bg-neutral-950 px-3 py-2.5 md:w-auto">
              <Search className="h-4 w-4 text-neutral-500" />
              <input
                type="text"
                placeholder="Search boxes..."
                className="w-full border-none bg-transparent text-sm text-white placeholder-neutral-600 outline-none"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <div className="hidden items-center gap-3 md:flex">
              <button className="flex items-center gap-2 rounded-lg bg-neutral-800 px-4 py-2.5 text-xs font-bold text-white transition-colors hover:bg-neutral-700">
                <span>Default</span>
                <ChevronDown className="h-3 w-3" />
              </button>
            </div>

            <button className="flex w-full items-center justify-center rounded-lg bg-indigo-600 py-2.5 text-sm font-bold text-white md:hidden" type="button">
              <Filter className="mr-2 h-4 w-4" /> Filters
            </button>
          </div>
        </div>
      </div>

      <div className="w-full max-w-6xl mx-auto px-4 py-8 min-h-[100dvh]">
        <div className="flex flex-col gap-12">
          {groupedBoxes.map((group) => (
            <div key={group.id} className="flex flex-col gap-4">
              {activeCategory === 'all' && (
                <div className="flex items-center gap-3 border-b border-white/5 pb-4">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-white/5">
                    <div className="w-4 h-4 rounded-full bg-indigo-500" />
                  </div>
                  <h2 className="text-xl font-bold text-white">{group.title}</h2>
                </div>
              )}

              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {group.boxes.map((box) => (
                  <button
                    key={box.id}
                    onClick={() => {
                      playSound('click');
                      setView({ type: 'CASE_OPENING', boxId: box.id });
                    }}
                    className="group flex flex-col items-center bg-[#131315] rounded-xl overflow-hidden border border-white/5 cursor-pointer hover:border-indigo-500/50 hover:shadow-lg hover:shadow-indigo-500/10 transition-all duration-300"
                    type="button"
                  >
                    <div className="relative w-full h-[170px] sm:h-[180px] p-4 sm:p-6 flex items-center justify-center bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white/5 to-transparent">
                      <img
                        src={box.image}
                        alt={box.name}
                        className="h-full w-full object-contain drop-shadow-xl group-hover:scale-110 group-hover:-rotate-3 transition-transform duration-300"
                      />
                    </div>

                    <div className="w-full p-4 flex flex-col items-center border-t border-white/5 bg-neutral-900/50">
                      <div className="text-xs font-bold text-white text-center mb-3 line-clamp-1 group-hover:text-indigo-400 transition-colors">
                        {box.name}
                      </div>
                      <div className="inline-flex items-center gap-1.5 bg-indigo-600 px-3 sm:px-4 py-1.5 rounded-lg shadow-md shadow-indigo-900/20 group-hover:bg-indigo-500 transition-colors">
                        <CoinAmount
                          amount={toCoins(box.price, PRICE_UNIT_MODE)}
                          formatOptions={{ maximumFractionDigits: 0 }}
                          className="text-base sm:text-lg font-bold text-white"
                          iconClassName="h-4 w-4 sm:h-5 sm:w-5"
                        />
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))}

          {groupedBoxes.length === 0 && (
            <div className="w-full py-20 text-center text-neutral-500">
              <p>No boxes found matching your search.</p>
            </div>
          )}
        </div>

        <div className="mt-20 pt-8 border-t border-white/5">
          <div className="prose prose-invert prose-sm max-w-none text-neutral-400">
            <h2 className="text-xl font-bold text-white mb-4">Browse by Category</h2>
            <p className="mb-4">
              Pullz mystery boxes are split into category groups. Each box lists every possible item and the exact drop rates before you open.
            </p>
            <h2 className="text-xl font-bold text-white mb-4">How Box Opening Works</h2>
            <p>
              Browse the full catalog and buy a mystery box online in seconds. Pick any box, and before you open, every item inside is visible along with its drop rate. After opening, choose to ship the item or trade it in for Credits and use them on any other box.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
