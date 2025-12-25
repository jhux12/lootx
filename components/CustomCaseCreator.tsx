import React, { useState } from 'react';
import { Package, Calculator, Check, ArrowRight, ChevronLeft, FlaskConical, Beaker, Search } from 'lucide-react';
import { useGame } from '../context/GameContext';
import { CaseItem, MysteryBox } from '../types';
import { useSound } from '../context/SoundContext';

export const CustomCaseCreator: React.FC = () => {
  const { createItem, createUserBox, items, setView } = useGame();
  const { playSound } = useSound();

  const [boxName, setBoxName] = useState('');
  const [boxPrice, setBoxPrice] = useState<number>(0);
  const [selectedItems, setSelectedItems] = useState<CaseItem[]>([]);
  const [lastCalculated, setLastCalculated] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // House Edge is hardcoded for user created boxes
  const USER_HOUSE_EDGE = 60; 

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

      // 1. Calculate weights (inversely proportional to price)
      const weights = selectedItems.map(item => 1 / Math.max(1, item.price));
      const totalWeight = weights.reduce((sum, w) => sum + w, 0);

      // 2. Distribute chances
      const updatedItems = selectedItems.map((item, index) => {
          const rawChance = weights[index] / totalWeight; 
          const percentChance = rawChance * 100;
          
          let rarity: CaseItem['rarity'] = 'common';
          let color = '#9ca3af';

          if (percentChance < 0.5) { rarity = 'gold'; color = '#fbbf24'; }
          else if (percentChance < 5) { rarity = 'legendary'; color = '#ef4444'; }
          else if (percentChance < 15) { rarity = 'rare'; color = '#a855f7'; }
          else if (percentChance < 40) { rarity = 'uncommon'; color = '#3b82f6'; }
          
          return {
              ...item,
              chance: parseFloat(percentChance.toFixed(4)),
              rarity,
              color
          };
      });

      // 3. Calculate EV + Edge
      const ev = updatedItems.reduce((sum, item) => sum + (item.price * (item.chance / 100)), 0);
      const calculatedPrice = ev * (1 + (USER_HOUSE_EDGE / 100));

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
          items: selectedItems
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
           <div className="flex items-center gap-3">
               <div className="p-2 bg-brand-purple/20 rounded-lg border border-brand-purple/40">
                    <FlaskConical className="w-6 h-6 text-brand-purple" />
               </div>
               <div>
                    <h1 className="text-3xl font-black text-white">Case Lab</h1>
                    <p className="text-gray-400 text-sm">Engineer your luck. Create custom cases with fixed {USER_HOUSE_EDGE}% house edge.</p>
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
                                        <div className="text-[10px] text-green-400 font-bold">${item.price}</div>
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
                                  <span className="text-green-500">${item.price}</span>
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
                          <span className="text-2xl font-black text-green-500">${boxPrice.toFixed(2)}</span>
                      </div>
                      <div className="text-[10px] text-gray-600 text-right">Includes {USER_HOUSE_EDGE}% House Edge</div>
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