import React, { useMemo, useState } from 'react';
import { Package, Calculator, Check, ArrowRight, ChevronLeft, FlaskConical, Beaker, Search, Info, X, Tag } from 'lucide-react';
import { useGame } from '../context/GameContext';
import { BoxTag, BOX_TAG_OPTIONS, CaseItem, MysteryBox } from '../types';
import { useSound } from '../context/SoundContext';
import { CoinAmount } from './CoinAmount';
import { buildOddsWithRiskAndTargetEV, buildRiskAdjustedOdds, calculateExpectedValue } from '../utils/caseOdds';

export const CustomCaseCreator: React.FC = () => {
  const { createUserBox, items, boxes, stripeSettings, setView } = useGame();
  const { playSound } = useSound();

  const DEFAULT_TARGET_EV = 0.85;
  const FIXED_RISK_LEVEL = 50;
  const [boxName, setBoxName] = useState('');
  const [boxPrice, setBoxPrice] = useState<number>(0);
  const [selectedItems, setSelectedItems] = useState<CaseItem[]>([]);
  const [lastCalculated, setLastCalculated] = useState(false);
  const [selectedBoxImage, setSelectedBoxImage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showLabInfo, setShowLabInfo] = useState(false);
  const [activeTag, setActiveTag] = useState<'All' | BoxTag>('All');
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);

  const toggleItemSelection = (item: CaseItem) => {
      playSound('click');
      const exists = selectedItems.find(i => i.id === item.id);
      if(exists) {
          setSelectedItems(prev => prev.filter(i => i.id !== item.id));
      } else {
          // Add with default properties
          setSelectedItems(prev => [...prev, { ...item }]);
      }
      setLastCalculated(false);
  };

  const calculateConfig = () => {
      if (selectedItems.length === 0) return;

      const baseItems = selectedItems.map(item => ({ ...item, chance: 0 }));

      // Risk only redistributes odds. Target EV stays locked after redistribution.
      const baseOdds = buildRiskAdjustedOdds(baseItems, FIXED_RISK_LEVEL);
      const baseEv = calculateExpectedValue(baseOdds);
      const calculatedPrice = baseEv / DEFAULT_TARGET_EV;
      const updatedItems = buildOddsWithRiskAndTargetEV(
        baseItems,
        FIXED_RISK_LEVEL,
        DEFAULT_TARGET_EV,
        calculatedPrice
      );

      setSelectedItems(updatedItems);
      setBoxPrice(parseFloat(calculatedPrice.toFixed(2)));
      setLastCalculated(true);
      // Removed 'coins' sound on calculate
  };

  const handleCreate = async () => {
      if (!boxName) {
          alert('Please name your box');
          return;
      }
      if (selectedItems.length === 0) {
          alert('Please select items');
          return;
      }
      if (!lastCalculated) {
          alert('Please calculate the box price first');
          return;
      }

      const newBox: MysteryBox = {
          id: `user-box-${Date.now()}`,
          name: boxName,
          price: boxPrice,
          image: selectedBoxImage || 'https://picsum.photos/300', // Default image for custom boxes
          accentColor: '#8b5cf6', // Brand purple for custom
          tag: 'New',
          items: selectedItems,
          targetEV: DEFAULT_TARGET_EV,
          riskLevel: FIXED_RISK_LEVEL,
          sellBackRate: Math.min(1, Math.max(0, stripeSettings.caseLabSellBackPercent / 100))
      };

      try {
        const publishedBoxId = await createUserBox(newBox);
        // Removed 'success' sound on create
        setView({ type: 'CASE_OPENING', boxId: publishedBoxId });
      } catch (error) {
        console.error('Failed to publish Case Lab box', error);
        alert('Unable to publish your Case Lab box right now. Please try again.');
      }
  };

  const tagOptions = useMemo(() => ['All', ...BOX_TAG_OPTIONS], []);
  const imageOptions = useMemo(
    () => boxes.filter((box) => !box.isUserCreated).slice(0, 12),
    [boxes]
  );

  const filteredItems = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    return items.filter(item => {
      const matchesSearch = item.name.toLowerCase().includes(normalizedQuery);
      const matchesTag = activeTag === 'All' ? true : item.tags?.includes(activeTag);
      return matchesSearch && matchesTag;
    });
  }, [items, searchQuery, activeTag]);

  return (
    <div className="max-w-5xl mx-auto p-6 animate-in fade-in slide-in-from-bottom-4">
      <div className="flex items-center gap-4 mb-8">
          <button 
             onClick={() => { playSound('click'); setView({ type: 'HOME' }); }}
             className="flex items-center gap-2 px-3 py-1.5 bg-[#131825] rounded text-gray-400 hover:text-white text-sm font-medium transition-colors"
           >
             <ChevronLeft className="w-4 h-4" /> Back
           </button>
           <div className="flex flex-row items-start gap-3 sm:items-center">
               <div className="shrink-0 p-2 bg-brand-purple/20 rounded-lg border border-brand-purple/40">
                    <FlaskConical className="w-6 h-6 text-brand-purple" />
               </div>
               <div>
                    <h1 className="text-3xl font-black text-white">Case Lab</h1>
                    <p className="text-gray-400 text-sm">Engineer your luck. Tune your risk balance for a custom case.</p>
                    <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-gray-300">
                      <button
                        type="button"
                        onClick={() => setShowLabInfo(true)}
                        className="flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2 py-1 font-semibold text-gray-200 transition hover:border-brand-purple/60 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple/60"
                        aria-label="How Case Lab works"
                      >
                        <Info className="h-3.5 w-3.5" />
                        How it works
                      </button>
                    </div>
               </div>
           </div>
      </div>
      {showLabInfo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
          <button
            type="button"
            onClick={() => setShowLabInfo(false)}
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            aria-label="Close Case Lab info"
          />
          <div className="relative w-full max-w-xl rounded-2xl border border-white/10 bg-gradient-to-br from-[#151a23] via-[#111722] to-[#0b0f18] p-5 text-gray-200 shadow-2xl sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs uppercase tracking-[0.3em] text-purple-300/80">Case Lab Guide</div>
                <h2 className="mt-2 text-xl font-black text-white sm:text-2xl">Design your custom case</h2>
              </div>
              <button
                type="button"
                onClick={() => setShowLabInfo(false)}
                className="rounded-full border border-white/10 bg-white/5 p-2 text-gray-300 transition hover:border-white/30 hover:text-white"
              >
                <span className="sr-only">Close</span>
                <X className="h-4 w-4" />
              </button>
            </div>
            <ol className="mt-4 space-y-3 text-sm text-gray-300">
              <li className="flex gap-3">
                <span className="mt-1 h-6 w-6 shrink-0 rounded-full border border-purple-400/40 bg-purple-500/10 text-center text-xs font-bold leading-6 text-purple-200">1</span>
                <p>Select the items you want included in your case and give it a memorable name.</p>
              </li>
              <li className="flex gap-3">
                <span className="mt-1 h-6 w-6 shrink-0 rounded-full border border-purple-400/40 bg-purple-500/10 text-center text-xs font-bold leading-6 text-purple-200">2</span>
                <p>Tap <span className="font-semibold text-white">Synthesize Odds</span> to balance the odds and calculate the case price.</p>
              </li>
              <li className="flex gap-3">
                <span className="mt-1 h-6 w-6 shrink-0 rounded-full border border-purple-400/40 bg-purple-500/10 text-center text-xs font-bold leading-6 text-purple-200">3</span>
                <p>
                  Create and open your case instantly. Case Lab wins can be sold back for{' '}
                  <span className="font-semibold text-emerald-300">{stripeSettings.caseLabSellBackPercent}% of item value</span>.
                </p>
              </li>
            </ol>
            <div className="mt-5 flex flex-col gap-2 text-xs text-gray-400 sm:flex-row sm:items-center sm:justify-between">
              <span>Case Lab cases are for experimentation and custom odds.</span>
              <button
                type="button"
                onClick={() => setShowLabInfo(false)}
                className="rounded-full border border-white/10 bg-white/5 px-3 py-1 font-semibold text-gray-200 transition hover:border-white/30 hover:text-white"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* LEFT: Item Picker */}
          <div className="lg:col-span-2 space-y-4">
              <div className="bg-[#131720] border border-gray-800 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-4">
                      <h3 className="text-sm font-bold text-gray-400 uppercase flex items-center gap-2">
                          <Package className="w-4 h-4" /> Select Components
                      </h3>
                  </div>

                  {/* Search Bar */}
                  <div className="relative mb-4">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                      <input 
                          type="text" 
                          placeholder="Search items..." 
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="w-full bg-[#0b0e14] border border-gray-700 text-white rounded-lg py-2 pl-9 pr-4 text-sm focus:outline-none focus:border-brand-purple transition-colors"
                      />
                  </div>

                  <div className="mb-4">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-gray-500 mb-2">Filter by tag</div>
                      <div className="flex gap-2 overflow-x-auto pb-2 sm:flex-wrap">
                          {tagOptions.map(tag => {
                              const isSelected = activeTag === tag;
                              return (
                                  <button
                                      key={tag}
                                      type="button"
                                      onClick={() => setActiveTag(tag)}
                                      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide transition ${isSelected ? 'border-brand-purple/70 bg-brand-purple/20 text-purple-200' : 'border-gray-700 bg-[#0b0e14] text-gray-400 hover:border-gray-500'}`}
                                  >
                                      <Tag className="h-3 w-3" />
                                      {tag}
                                  </button>
                              );
                          })}
                      </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 max-h-[300px] md:max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                       {filteredItems.map(item => {
                            const isSelected = selectedItems.some(i => i.id === item.id);
                            const isExpanded = expandedItemId === item.id;
                            return (
                                <div 
                                    key={item.id} 
                                    onClick={() => setExpandedItemId(prev => prev === item.id ? null : item.id)}
                                    className={`relative rounded-lg border cursor-pointer flex flex-col items-center gap-2 text-center transition-all ${isExpanded ? 'p-3 bg-[#101520] border-brand-purple/60 shadow-[0_10px_30px_rgba(15,23,42,0.45)]' : 'p-2 bg-[#0b0e14] border-gray-800 hover:border-gray-600'} ${isSelected ? 'ring-1 ring-brand-purple/40' : ''}`}
                                >
                                    <img src={item.image} className="w-12 h-12 object-contain" />
                                    <div className="w-full">
                                        <div className={`text-[10px] text-gray-300 font-medium ${isExpanded ? 'line-clamp-2 text-[11px]' : 'truncate'}`}>{item.name}</div>
                                        <CoinAmount
                                          amount={item.price}
                                          formatOptions={{ maximumFractionDigits: 0 }}
                                          className="text-[10px] text-green-400 font-bold justify-center"
                                          iconClassName="w-3 h-3"
                                        />
                                    </div>
                                    {isSelected && (
                                        <div className="absolute top-1 right-1 bg-brand-purple rounded-full p-0.5">
                                            <Check className="w-3 h-3 text-white" />
                                        </div>
                                    )}
                                    {isExpanded && (
                                      <div className="mt-2 w-full">
                                          <button
                                              type="button"
                                              onClick={(event) => {
                                                  event.stopPropagation();
                                                  toggleItemSelection(item);
                                              }}
                                              className={`w-full rounded-md px-3 py-2 text-[11px] font-semibold uppercase tracking-wide transition ${isSelected ? 'bg-white/10 text-gray-200 hover:bg-white/20' : 'bg-brand-purple text-white hover:bg-purple-600'}`}
                                          >
                                              {isSelected ? 'Remove from box' : 'Add to box'}
                                          </button>
                                      </div>
                                    )}
                                </div>
                            );
                        })}
                  </div>
              </div>
          </div>

          {/* RIGHT: Config & Summary */}
          <div className="space-y-6">
              <div className="bg-[#131720] border border-gray-800 rounded-xl p-6 sticky top-24">
                  <div className="mb-6">
                      <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Case Name</label>
                      <input 
                        type="text" 
                        placeholder="My Luck Experiment #1" 
                        value={boxName}
                        onChange={(e) => setBoxName(e.target.value)}
                        className="w-full bg-[#0b0e14] border border-gray-700 text-white rounded-lg px-4 py-3 focus:outline-none focus:border-brand-purple focus:ring-1 focus:ring-brand-purple transition-all"
                      />
                  </div>
                  <div className="mb-6">
                      <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Choose a cover image</label>
                      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                          {imageOptions.map((box) => (
                              <button
                                  key={box.id}
                                  type="button"
                                  onClick={() => setSelectedBoxImage(box.image)}
                                  className={`rounded-lg border p-2 transition ${
                                    selectedBoxImage === box.image
                                      ? 'border-brand-purple/70 bg-brand-purple/10'
                                      : 'border-gray-700 bg-[#0b0e14] hover:border-gray-500'
                                  }`}
                                  aria-label={`Use ${box.name} image`}
                              >
                                  <img src={box.image} alt={box.name} className="h-12 w-full object-contain" />
                              </button>
                          ))}
                      </div>
                      {selectedBoxImage && (
                          <p className="mt-2 text-xs text-gray-500">Selected image is ready for your Case Lab box.</p>
                      )}
                  </div>

                  <div className="mb-6">
                      <div className="flex justify-between items-end mb-2">
                          <span className="text-xs font-bold text-gray-500 uppercase">Composition</span>
                          <span className="text-xs font-bold text-white">{selectedItems.length} items</span>
                      </div>
                      <div className="flex flex-col gap-1 max-h-40 overflow-y-auto mb-4 custom-scrollbar">
                          {selectedItems.map((item, idx) => (
                              <div key={idx} className="flex justify-between text-xs p-1.5 bg-[#0b0e14] rounded border border-gray-800/50">
                                  <span className="text-gray-400 truncate w-24">{item.name}</span>
                                  {lastCalculated && <span className="text-brand-purple font-mono">{item.chance}%</span>}
                                  <CoinAmount
                                    amount={item.price}
                                    formatOptions={{ maximumFractionDigits: 0 }}
                                    className="text-green-500"
                                    iconClassName="w-3 h-3"
                                  />
                              </div>
                          ))}
                      </div>
                      
                      <button 
                        onClick={calculateConfig}
                        disabled={selectedItems.length === 0}
                        className="w-full flex items-center justify-center gap-2 py-3 bg-gray-800 hover:bg-gray-700 text-white text-xs font-bold rounded-lg transition-colors disabled:opacity-50 border border-gray-700"
                      >
                         <Beaker className="w-4 h-4" /> Synthesize Odds
                      </button>
                  </div>

                  <div className="border-t border-gray-800 pt-4 mb-6">
                      <div className="flex justify-between items-center mb-1">
                          <span className="text-sm text-gray-400">Total Price</span>
                          <CoinAmount
                            amount={boxPrice}
                            formatOptions={{ maximumFractionDigits: 0 }}
                            className="text-2xl font-black text-green-500"
                            iconClassName="w-4 h-4"
                          />
                      </div>
                      <div className="mt-4 rounded-lg border border-gray-800 bg-[#0b0e14] px-4 py-3">
                          <div className="flex items-center justify-between text-sm text-gray-400">
                              <span>Cost to create</span>
                              <CoinAmount
                                amount={stripeSettings.caseLabPublishFeeCoins}
                                formatOptions={{ maximumFractionDigits: 0 }}
                                className="text-emerald-300 font-semibold"
                                iconClassName="w-4 h-4"
                              />
                          </div>
                          <p className="mt-2 text-xs text-gray-500">
                              One-time fee charged when publishing a Case Lab box.
                          </p>
                      </div>
                  </div>

                  <button 
                    onClick={handleCreate}
                    disabled={!lastCalculated || !boxName}
                    className="w-full py-4 bg-brand-purple hover:bg-purple-600 text-white font-bold rounded-xl shadow-lg shadow-purple-900/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.02] active:scale-[0.98]"
                  >
                      Create & Open <ArrowRight className="w-4 h-4" />
                  </button>
              </div>
          </div>
      </div>
    </div>
  );
};
