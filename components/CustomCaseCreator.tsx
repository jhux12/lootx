import React, { useState } from 'react';
import { Package, Calculator, Check, ArrowRight, ChevronLeft, FlaskConical, Beaker, Search, Info } from 'lucide-react';
import { useGame } from '../context/GameContext';
import { CaseItem, MysteryBox } from '../types';
import { useSound } from '../context/SoundContext';
import { CoinAmount } from './CoinAmount';
import { buildOddsWithRiskAndTargetEV, buildRiskAdjustedOdds, calculateExpectedValue } from '../utils/caseOdds';

export const CustomCaseCreator: React.FC = () => {
  const { createItem, createUserBox, items, setView } = useGame();
  const { playSound } = useSound();

  const DEFAULT_TARGET_EV = 0.85;
  const FIXED_RISK_LEVEL = 50;
  const [boxName, setBoxName] = useState('');
  const [boxPrice, setBoxPrice] = useState<number>(0);
  const [selectedItems, setSelectedItems] = useState<CaseItem[]>([]);
  const [lastCalculated, setLastCalculated] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

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

  const handleCreate = () => {
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
          image: 'https://picsum.photos/300', // Default image for custom boxes
          accentColor: '#8b5cf6', // Brand purple for custom
          tag: 'New',
          items: selectedItems,
          targetEV: DEFAULT_TARGET_EV,
          riskLevel: FIXED_RISK_LEVEL
      };

      createUserBox(newBox);
      // Removed 'success' sound on create
      setView({ type: 'CASE_OPENING', boxId: newBox.id });
  };

  // Filter items based on search
  const filteredItems = items.filter(item => 
    item.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="max-w-5xl mx-auto p-6 animate-in fade-in slide-in-from-bottom-4">
      <div className="flex items-center gap-4 mb-8">
          <button 
             onClick={() => { playSound('click'); setView({ type: 'HOME' }); }}
             className="flex items-center gap-2 px-3 py-1.5 bg-[#131825] rounded text-gray-400 hover:text-white text-sm font-medium transition-colors"
           >
             <ChevronLeft className="w-4 h-4" /> Back
           </button>
           <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
               <div className="p-2 bg-brand-purple/20 rounded-lg border border-brand-purple/40">
                    <FlaskConical className="w-6 h-6 text-brand-purple" />
               </div>
               <div>
                    <h1 className="text-3xl font-black text-white">Case Lab</h1>
                    <p className="text-gray-400 text-sm">Engineer your luck. Tune your risk balance for a custom case.</p>
                    <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-gray-300">
                      <span className="rounded-full border border-purple-400/30 bg-purple-500/10 px-2 py-1 font-semibold uppercase tracking-wide text-purple-200">
                        Case Lab sell-back
                      </span>
                      <div className="relative group">
                        <button
                          type="button"
                          className="flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2 py-1 font-semibold text-gray-200 transition hover:border-brand-purple/60 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple/60"
                          aria-label="How Case Lab sell-back works"
                        >
                          <Info className="h-3.5 w-3.5" />
                          How it works
                        </button>
                        <div className="pointer-events-none absolute left-1/2 top-full z-20 mt-2 w-72 max-w-[85vw] -translate-x-1/2 translate-y-1 rounded-2xl border border-white/10 bg-[#0f141f] px-4 py-3 text-[11px] text-gray-200 opacity-0 shadow-2xl transition-all duration-200 group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:translate-y-0 group-focus-within:opacity-100">
                          <div className="mb-1 text-xs font-semibold text-white">Case Lab sell-back rates</div>
                          <p className="leading-relaxed text-gray-300">
                            Items won from Case Lab cases can be sold back for <span className="font-semibold text-emerald-300">75% of their value</span>
                            . That 25% fee only applies to Case Lab cases you create.
                          </p>
                        </div>
                      </div>
                    </div>
               </div>
           </div>
      </div>

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

                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3 max-h-[300px] md:max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                       {filteredItems.map(item => {
                            const isSelected = selectedItems.some(i => i.id === item.id);
                            return (
                                <div 
                                    key={item.id} 
                                    onClick={() => toggleItemSelection(item)}
                                    className={`relative p-2 rounded-lg border cursor-pointer flex flex-col items-center gap-2 text-center transition-all ${isSelected ? 'bg-brand-purple/10 border-brand-purple shadow-[0_0_10px_rgba(139,92,246,0.2)]' : 'bg-[#0b0e14] border-gray-800 hover:border-gray-600'}`}
                                >
                                    <img src={item.image} className="w-12 h-12 object-contain" />
                                    <div className="w-full">
                                        <div className="text-[10px] text-gray-300 truncate font-medium">{item.name}</div>
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
