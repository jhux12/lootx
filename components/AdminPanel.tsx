import React, { useState } from 'react';
import { LayoutDashboard, Users, Settings, Activity, DollarSign, ShieldAlert, Package, Box as BoxIcon, Plus, Check, Calculator, Edit2, Trash2, Calendar } from 'lucide-react';
import { useGame } from '../context/GameContext';
import { CaseItem, MysteryBox } from '../types';

const rarityColorMap: Record<CaseItem['rarity'], string> = {
    common: '#9ca3af',
    uncommon: '#3b82f6',
    rare: '#a855f7',
    legendary: '#ef4444',
    gold: '#fbbf24'
};

const rarityColorOptions = [
    { value: 'common' as const, label: 'Common', color: rarityColorMap.common },
    { value: 'uncommon' as const, label: 'Uncommon', color: rarityColorMap.uncommon },
    { value: 'rare' as const, label: 'Rare', color: rarityColorMap.rare },
    { value: 'legendary' as const, label: 'Legendary', color: rarityColorMap.legendary },
    { value: 'gold' as const, label: 'Gold', color: rarityColorMap.gold }
];

export const AdminPanel: React.FC = () => {
  const { createItem, updateItem, deleteItem, createBox, updateBox, deleteBox, items, boxes, users } = useGame();
  const [activeTab, setActiveTab] = useState<'dashboard' | 'users' | 'settings' | 'items' | 'boxes'>('dashboard');

  // --- ITEM FORM STATE ---
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [newItem, setNewItem] = useState<Partial<CaseItem>>({
      name: '',
      price: 0,
      image: 'https://picsum.photos/200',
      rarity: 'common',
      chance: 10,
      color: '#9ca3af'
  });

  // --- BOX FORM STATE ---
  const [editingBoxId, setEditingBoxId] = useState<string | null>(null);
  const [newBox, setNewBox] = useState<Partial<MysteryBox>>({
      name: '',
      price: 0,
      image: 'https://picsum.photos/300',
      accentColor: '#3b82f6',
      tag: undefined,
      isDaily: false
  });
  const [houseEdge, setHouseEdge] = useState(5); // Default 5%
  const [selectedItems, setSelectedItems] = useState<CaseItem[]>([]);
  const [deletingBoxId, setDeletingBoxId] = useState<string | null>(null);
  
  // --- DELETE CONFIRMATION STATE ---
  const [boxToDelete, setBoxToDelete] = useState<string | null>(null);

  const stats = [
    { title: 'Total Revenue', value: '$124,592.00', icon: DollarSign, color: 'text-green-500', bg: 'bg-green-500/10' },
    { title: 'Active Users', value: '1,420', icon: Users, color: 'text-blue-500', bg: 'bg-blue-500/10' },
    { title: 'Battles Today', value: '843', icon: SwordsIcon, color: 'text-purple-500', bg: 'bg-purple-500/10' },
    { title: 'Server Load', value: '12%', icon: Activity, color: 'text-yellow-500', bg: 'bg-yellow-500/10' },
  ];

  const handleSaveItem = () => {
      if(!newItem.name || !newItem.price) return;
      
      const item: CaseItem = {
          id: editingItemId || `custom-item-${Date.now()}`,
          name: newItem.name!,
          price: Number(newItem.price),
          image: newItem.image || 'https://picsum.photos/200',
          rarity: newItem.rarity as any || 'common',
          chance: Number(newItem.chance),
          color: newItem.color || '#9ca3af'
      };

      try {
          if (editingItemId) {
              updateItem(item);
              alert("Item Updated!");
          } else {
              createItem(item);
              alert("Item Created!");
          }
      } catch (error) {
          console.error('Failed to save item', error);
          alert("Failed to save item. Please try again.");
          return;
      }
      resetItemForm();
  };

  const handleEditItem = (item: CaseItem) => {
      setEditingItemId(item.id);
      setNewItem({
          name: item.name,
          price: item.price,
          image: item.image,
          rarity: item.rarity,
          chance: item.chance,
          color: item.color
      });
      window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteItem = (id: string) => {
      if (!confirm("Are you sure you want to delete this item? It will be removed from future box selections, but existing boxes may still reference it.")) {
          return;
      }

      try {
          deleteItem(id);
      } catch (error) {
          console.error('Failed to delete item', error);
          alert("Failed to delete item. Please try again.");
      }
  };

  const resetItemForm = () => {
      setEditingItemId(null);
      setNewItem({ name: '', price: 0, image: 'https://picsum.photos/200', rarity: 'common', chance: 10, color: '#9ca3af' });
  };

  const calculateBoxConfig = () => {
      if (selectedItems.length === 0) return;

      // 1. Calculate weights (inversely proportional to price)
      const weights = selectedItems.map(item => 1 / Math.max(1, item.price));
      const totalWeight = weights.reduce((sum, w) => sum + w, 0);

      // 2. Distribute chances
      const updatedItems = selectedItems.map((item, index) => {
          const rawChance = weights[index] / totalWeight; // 0 to 1
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

      // 3. Calculate Expected Value (EV)
      const ev = updatedItems.reduce((sum, item) => sum + (item.price * (item.chance / 100)), 0);

      // 4. Set Box Price based on EV + House Edge
      const calculatedPrice = ev * (1 + (houseEdge / 100));

      // Apply updates
      setSelectedItems(updatedItems);
      setNewBox(prev => ({ ...prev, price: parseFloat(calculatedPrice.toFixed(2)) }));
  };

  const handleSaveBox = async () => {
      if(!newBox.name || !newBox.price) {
          alert("Please fill in box details");
          return;
      }
      
      if(selectedItems.length === 0) {
          alert("Select at least one item for the box");
          return;
      }

      // Clone items to decouple from global pool (ensuring box-specific chances)
      const boxItems = selectedItems.map(i => ({...i}));
      
      // If setting as daily, unset others first (best effort approach)
      if (newBox.isDaily) {
          boxes.forEach(b => {
              if (b.isDaily && b.id !== (editingBoxId || '')) {
                  updateBox({ ...b, isDaily: false });
              }
          });
      }

      const box: MysteryBox = {
          id: editingBoxId || '', // Empty ID tells createBox to addDoc
          name: newBox.name!,
          price: Number(newBox.price),
          image: newBox.image || 'https://picsum.photos/300',
          accentColor: newBox.accentColor || '#3b82f6',
          tag: newBox.tag,
          isDaily: newBox.isDaily,
          items: boxItems
      };

      try {
          if (editingBoxId) {
              await updateBox(box);
              alert("Box Updated!");
          } else {
              await createBox(box);
              alert("Box Created in Firebase!");
          }
      } catch (error) {
          console.error('Failed to save box', error);
          alert("Failed to save box. Please try again.");
          return;
      }

      resetBoxForm();
  };

  const handleEditBox = (box: MysteryBox) => {
      setEditingBoxId(box.id);
      setNewBox({
          name: box.name,
          price: box.price,
          image: box.image,
          accentColor: box.accentColor,
          tag: box.tag,
          isDaily: box.isDaily
      });
      setSelectedItems(box.items.map(i => ({...i})));
      window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const initiateDeleteBox = (id: string) => {
      setBoxToDelete(id);
  };

  const confirmDeleteBox = async () => {
      if (!boxToDelete) return;

      setDeletingBoxId(boxToDelete);
      try {
          await deleteBox(boxToDelete);
      } finally {
          setDeletingBoxId(null);
          setBoxToDelete(null);
      }
  };

  const resetBoxForm = () => {
      setEditingBoxId(null);
      setNewBox({ name: '', price: 0, image: 'https://picsum.photos/300', accentColor: '#3b82f6', tag: undefined, isDaily: false });
      setSelectedItems([]);
      setHouseEdge(5);
  };

  const toggleItemSelection = (item: CaseItem) => {
      const exists = selectedItems.find(i => i.id === item.id);
      if(exists) {
          setSelectedItems(prev => prev.filter(i => i.id !== item.id));
      } else {
          setSelectedItems(prev => [...prev, { ...item }]);
      }
  };

  return (
    <div className="w-full max-w-7xl mx-auto p-6 animate-in fade-in duration-300">
      
      <div className="flex flex-col md:flex-row gap-8">
        
        {/* Sidebar */}
        <div className="w-full md:w-64 flex-shrink-0">
           <div className="bg-[#131720] border border-gray-800 rounded-xl p-4 sticky top-24">
               <h2 className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-4 px-2">Admin Control</h2>
               <nav className="flex flex-col gap-1">
                   <button 
                     onClick={() => setActiveTab('dashboard')}
                     className={`flex items-center gap-3 px-3 py-2 rounded-lg font-medium text-sm transition-colors ${activeTab === 'dashboard' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}
                   >
                       <LayoutDashboard className="w-4 h-4" /> Dashboard
                   </button>
                   <button 
                     onClick={() => setActiveTab('items')}
                     className={`flex items-center gap-3 px-3 py-2 rounded-lg font-medium text-sm transition-colors ${activeTab === 'items' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}
                   >
                       <Package className="w-4 h-4" /> Manage Items
                   </button>
                   <button 
                     onClick={() => setActiveTab('boxes')}
                     className={`flex items-center gap-3 px-3 py-2 rounded-lg font-medium text-sm transition-colors ${activeTab === 'boxes' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}
                   >
                       <BoxIcon className="w-4 h-4" /> Manage Boxes
                   </button>
                   <button 
                     onClick={() => setActiveTab('users')}
                     className={`flex items-center gap-3 px-3 py-2 rounded-lg font-medium text-sm transition-colors ${activeTab === 'users' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}
                   >
                       <Users className="w-4 h-4" /> User Management
                   </button>
                   <button 
                     onClick={() => setActiveTab('settings')}
                     className={`flex items-center gap-3 px-3 py-2 rounded-lg font-medium text-sm transition-colors ${activeTab === 'settings' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}
                   >
                       <Settings className="w-4 h-4" /> Site Settings
                   </button>
               </nav>
           </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 min-w-0">
            
            {/* Header */}
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-white mb-2">
                    {activeTab === 'dashboard' && 'Overview'}
                    {activeTab === 'users' && 'User Database'}
                    {activeTab === 'settings' && 'System Configuration'}
                    {activeTab === 'items' && 'Item Manager'}
                    {activeTab === 'boxes' && 'Box Manager'}
                </h1>
                <p className="text-gray-400 text-sm">Welcome back, Administrator. System is operating normally.</p>
            </div>

            {/* TAB: DASHBOARD */}
            {activeTab === 'dashboard' && (
                <>
                    {/* Stats Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                        {stats.map((stat, idx) => (
                            <div key={idx} className="bg-[#131720] border border-gray-800 rounded-xl p-4">
                                <div className="flex items-start justify-between mb-4">
                                    <div className={`p-2 rounded-lg ${stat.bg}`}>
                                        <stat.icon className={`w-6 h-6 ${stat.color}`} />
                                    </div>
                                    <span className="text-xs font-bold text-green-500 bg-green-500/10 px-1.5 py-0.5 rounded">+4.5%</span>
                                </div>
                                <div className="text-2xl font-bold text-white mb-1">{stat.value}</div>
                                <div className="text-xs text-gray-500">{stat.title}</div>
                            </div>
                        ))}
                    </div>

                    {/* Recent Activity Mock */}
                    <div className="bg-[#131720] border border-gray-800 rounded-xl p-6">
                        <h3 className="text-lg font-bold text-white mb-6">Live Transactions</h3>
                        <div className="space-y-4">
                            {[1, 2, 3, 4, 5].map((i) => (
                                <div key={i} className="flex items-center justify-between py-2 border-b border-gray-800 last:border-0">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-2 h-2 rounded-full ${i % 2 === 0 ? 'bg-green-500' : 'bg-blue-500'}`}></div>
                                        <div>
                                            <div className="text-sm font-bold text-gray-200">
                                                {i % 2 === 0 ? 'Deposit' : 'Case Opening'}
                                            </div>
                                            <div className="text-xs text-gray-500">2 minutes ago</div>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className={`text-sm font-bold ${i % 2 === 0 ? 'text-green-400' : 'text-white'}`}>
                                            {i % 2 === 0 ? '+$500.00' : '-$50.00'}
                                        </div>
                                        <div className="text-xs text-gray-500">User_{1000 + i}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </>
            )}

            {/* TAB: ITEMS */}
            {activeTab === 'items' && (
                <div className="space-y-8">
                    {/* Create Item Form */}
                    <div className="bg-[#131720] border border-gray-800 rounded-xl p-6">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-bold text-white">{editingItemId ? 'Edit Item' : 'Create New Item'}</h3>
                            {editingItemId && <button onClick={resetItemForm} className="text-xs text-red-400 hover:text-red-300">Cancel Edit</button>}
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                            <input type="text" placeholder="Item Name" className="bg-[#0b0e14] border border-gray-700 rounded p-2 text-white" value={newItem.name} onChange={e => setNewItem({...newItem, name: e.target.value})} />
                            <input type="number" placeholder="Price ($)" className="bg-[#0b0e14] border border-gray-700 rounded p-2 text-white" value={newItem.price || ''} onChange={e => setNewItem({...newItem, price: Number(e.target.value)})} />
                          <select className="bg-[#0b0e14] border border-gray-700 rounded p-2 text-gray-300" value={newItem.rarity} onChange={e => setNewItem({...newItem, rarity: e.target.value as any})}>
                                <option value="common">Common</option>
                                <option value="uncommon">Uncommon</option>
                                <option value="rare">Rare</option>
                                <option value="legendary">Legendary</option>
                                <option value="gold">Gold</option>
                            </select>
                            <select
                                className="bg-[#0b0e14] border border-gray-700 rounded p-2 text-gray-300"
                                value={rarityColorOptions.find(option => option.color === newItem.color)?.value || 'custom'}
                                onChange={e => {
                                    const selectedRarity = e.target.value as CaseItem['rarity'];
                                    if (rarityColorMap[selectedRarity]) {
                                        setNewItem(prev => ({ ...prev, color: rarityColorMap[selectedRarity] }));
                                    }
                                }}
                            >
                                {rarityColorOptions.map(option => (
                                    <option key={option.value} value={option.value}>
                                        {option.label} ({option.color})
                                    </option>
                                ))}
                                {!rarityColorOptions.some(option => option.color === newItem.color) && (
                                    <option value="custom" disabled>
                                        Custom Color ({newItem.color})
                                    </option>
                                )}
                            </select>
                            <input type="text" placeholder="Image URL" className="bg-[#0b0e14] border border-gray-700 rounded p-2 text-white" value={newItem.image} onChange={e => setNewItem({...newItem, image: e.target.value})} />
                            <input type="number" placeholder="Chance % (0-100)" className="bg-[#0b0e14] border border-gray-700 rounded p-2 text-white" value={newItem.chance} onChange={e => setNewItem({...newItem, chance: Number(e.target.value)})} />
                        </div>
                        <button onClick={handleSaveItem} className={`px-6 py-2 ${editingItemId ? 'bg-orange-600 hover:bg-orange-500' : 'bg-blue-600 hover:bg-blue-500'} text-white font-bold rounded`}>
                            {editingItemId ? 'Update Item' : 'Add Item'}
                        </button>
                    </div>

                    {/* Item List */}
                    <div className="bg-[#131720] border border-gray-800 rounded-xl overflow-hidden">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-[#0b0e14] text-gray-400 font-medium">
                                <tr>
                                    <th className="px-4 py-3">Item</th>
                                    <th className="px-4 py-3">Rarity</th>
                                    <th className="px-4 py-3">Price</th>
                                    <th className="px-4 py-3 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-800">
                                {items.map((item, i) => (
                                    <tr key={i}>
                                        <td className="px-4 py-3 flex items-center gap-2">
                                            <img src={item.image} className="w-8 h-8 object-contain" />
                                            <span className="text-white">{item.name}</span>
                                        </td>
                                        <td className="px-4 py-3 capitalize text-gray-400">{item.rarity}</td>
                                        <td className="px-4 py-3 text-green-500">${item.price}</td>
                                        <td className="px-4 py-3 text-right">
                                            <div className="flex justify-end gap-2">
                                                <button onClick={() => handleEditItem(item)} className="p-1.5 hover:bg-blue-500/10 text-blue-400 rounded transition-colors"><Edit2 className="w-4 h-4" /></button>
                                                <button onClick={() => handleDeleteItem(item.id)} className="p-1.5 hover:bg-red-500/10 text-red-400 rounded transition-colors"><Trash2 className="w-4 h-4" /></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* TAB: BOXES */}
            {activeTab === 'boxes' && (
                <div className="space-y-8">
                    {/* Create/Edit Box Form */}
                    <div className="bg-[#131720] border border-gray-800 rounded-xl p-6">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-bold text-white">{editingBoxId ? 'Edit Box' : 'Create New Box'}</h3>
                            {editingBoxId && <button onClick={resetBoxForm} className="text-xs text-red-400 hover:text-red-300">Cancel Edit</button>}
                        </div>

                        {/* Top Config Row */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                            <input type="text" placeholder="Box Name" className="bg-[#0b0e14] border border-gray-700 rounded p-2 text-white" value={newBox.name} onChange={e => setNewBox({...newBox, name: e.target.value})} />
                            <input type="text" placeholder="Image URL" className="bg-[#0b0e14] border border-gray-700 rounded p-2 text-white" value={newBox.image} onChange={e => setNewBox({...newBox, image: e.target.value})} />
                            <input type="text" placeholder="Accent Color (Hex)" className="bg-[#0b0e14] border border-gray-700 rounded p-2 text-white" value={newBox.accentColor} onChange={e => setNewBox({...newBox, accentColor: e.target.value})} />
                            
                            <div className="flex flex-col gap-3">
                                <div className="flex gap-2">
                                    <div className="flex-1">
                                        <label className="text-[10px] text-gray-500 uppercase font-bold block mb-1">Price ($)</label>
                                        <input type="number" placeholder="Box Price" className="w-full bg-[#0b0e14] border border-gray-700 rounded p-2 text-white font-bold text-green-400" value={newBox.price || ''} onChange={e => setNewBox({...newBox, price: Number(e.target.value)})} />
                                    </div>
                                    <div className="flex-1">
                                        <label className="text-[10px] text-gray-500 uppercase font-bold block mb-1">House Edge (%)</label>
                                        <input type="number" placeholder="Edge %" className="w-full bg-[#0b0e14] border border-gray-700 rounded p-2 text-white font-bold" value={houseEdge} onChange={e => setHouseEdge(Number(e.target.value))} />
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <input 
                                        type="checkbox" 
                                        id="daily-case"
                                        checked={newBox.isDaily || false} 
                                        onChange={e => setNewBox({...newBox, isDaily: e.target.checked})} 
                                        className="w-4 h-4 rounded border-gray-700 bg-[#0b0e14] text-brand-purple focus:ring-brand-purple"
                                    />
                                    <label htmlFor="daily-case" className="text-sm text-gray-400 flex items-center gap-1">
                                        <Calendar className="w-3 h-3 text-yellow-500" /> Set as Daily Free Case
                                    </label>
                                </div>
                            </div>
                        </div>

                        {/* Middle: Item Selector & Auto-Calculator */}
                        <div className="mb-6 p-4 bg-[#0b0e14] rounded-lg border border-gray-800">
                             <div className="flex justify-between items-center mb-4">
                                 <h4 className="text-sm font-bold text-gray-400 uppercase">Available Items</h4>
                                 <button 
                                    onClick={calculateBoxConfig}
                                    disabled={selectedItems.length === 0}
                                    className="flex items-center gap-2 px-3 py-1.5 bg-brand-purple hover:bg-purple-600 disabled:opacity-50 text-white text-xs font-bold rounded shadow-lg shadow-purple-900/20"
                                 >
                                    <Calculator className="w-3 h-3" /> Auto-Calculate Odds & Price
                                 </button>
                             </div>
                             
                             {/* Item Pool */}
                             <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 max-h-48 overflow-y-auto mb-4 pr-1">
                                {items.map(item => {
                                    const isSelected = selectedItems.some(i => i.id === item.id);
                                    return (
                                        <div 
                                            key={item.id} 
                                            onClick={() => toggleItemSelection(item)}
                                            className={`p-2 rounded border cursor-pointer flex flex-col items-center gap-2 text-center transition-all ${isSelected ? 'bg-blue-600/10 border-blue-500' : 'bg-[#131720] border-gray-800 hover:border-gray-600'}`}
                                        >
                                            <img src={item.image} className="w-8 h-8 object-contain" />
                                            <div className="w-full">
                                                <div className="text-[10px] text-gray-300 truncate font-medium">{item.name}</div>
                                                <div className="text-[10px] text-green-400 font-bold">${item.price}</div>
                                            </div>
                                            {isSelected && <div className="absolute top-1 right-1 w-2 h-2 bg-blue-500 rounded-full"></div>}
                                        </div>
                                    );
                                })}
                             </div>

                             {/* Selected & Configured Items */}
                             {selectedItems.length > 0 && (
                                 <div className="border-t border-gray-800 pt-4">
                                     <h4 className="text-sm font-bold text-gray-400 uppercase mb-2">Box Contents ({selectedItems.length})</h4>
                                     <div className="space-y-1">
                                         {selectedItems.map((item, idx) => (
                                             <div key={idx} className="flex items-center gap-2 text-xs bg-[#131720] p-1.5 rounded border border-gray-700">
                                                 <img src={item.image} className="w-5 h-5 object-contain" />
                                                 <span className="flex-1 text-gray-300 truncate">{item.name}</span>
                                                 <span className="text-gray-500">${item.price}</span>
                                                 <div className="flex items-center gap-1 bg-black/30 px-2 py-0.5 rounded">
                                                     <span className="text-gray-400">Chance:</span>
                                                     <span className="font-bold text-white">{item.chance}%</span>
                                                 </div>
                                                 <div className="px-2 py-0.5 rounded font-bold uppercase text-[9px]" style={{ color: item.color, backgroundColor: `${item.color}15` }}>
                                                     {item.rarity}
                                                 </div>
                                             </div>
                                         ))}
                                     </div>
                                 </div>
                             )}
                        </div>

                        <button onClick={handleSaveBox} className={`w-full py-3 ${editingBoxId ? 'bg-orange-600 hover:bg-orange-500' : 'bg-blue-600 hover:bg-blue-500'} text-white font-bold rounded shadow-lg`}>
                            {editingBoxId ? 'Update Box' : 'Create Box'}
                        </button>
                    </div>

                     {/* Box List */}
                     <div className="bg-[#131720] border border-gray-800 rounded-xl overflow-hidden">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-[#0b0e14] text-gray-400 font-medium">
                                <tr>
                                    <th className="px-4 py-3">Box</th>
                                    <th className="px-4 py-3">Items</th>
                                    <th className="px-4 py-3">Price</th>
                                    <th className="px-4 py-3 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-800">
                                {boxes.map((box, i) => (
                                    <tr key={i}>
                                        <td className="px-4 py-3 flex items-center gap-2">
                                            <img src={box.image} className="w-8 h-8 object-contain" />
                                            <div>
                                                <div className="text-white flex items-center gap-2">
                                                    {box.name}
                                                    {box.isDaily && <span className="text-[10px] bg-yellow-500/20 text-yellow-500 px-1 rounded">DAILY</span>}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-gray-400">{box.items?.length || 0} items</td>
                                        <td className="px-4 py-3 text-green-500">${box.price.toFixed(2)}</td>
                                        <td className="px-4 py-3 text-right">
                                            <div className="flex justify-end gap-2">
                                                <button onClick={() => handleEditBox(box)} className="p-1.5 hover:bg-blue-500/10 text-blue-400 rounded transition-colors"><Edit2 className="w-4 h-4" /></button>
                                                <button 
                                                    onClick={() => initiateDeleteBox(box.id)} 
                                                    className={`p-1.5 rounded transition-colors ${deletingBoxId === box.id ? 'bg-red-500 text-white animate-pulse' : 'hover:bg-red-500/10 text-red-400'}`}
                                                    disabled={deletingBoxId === box.id}
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* TAB: USERS */}
            {activeTab === 'users' && (
                <div className="bg-[#131720] border border-gray-800 rounded-xl overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-[#0b0e14] text-gray-400 font-medium border-b border-gray-800">
                                <tr>
                                    <th className="px-6 py-4">User</th>
                                    <th className="px-6 py-4">Level</th>
                                    <th className="px-6 py-4">Status</th>
                                    <th className="px-6 py-4">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-800">
                                {users.length === 0 ? (
                                    <tr>
                                        <td colSpan={4} className="px-6 py-6 text-center text-gray-500">
                                            No users found in Firebase.
                                        </td>
                                    </tr>
                                ) : (
                                    users.map((user) => (
                                        <tr key={user.id} className="hover:bg-[#1a2130] transition-colors">
                                            <td className="px-6 py-4 flex items-center gap-3">
                                                <img src={user.avatar} className="w-8 h-8 rounded-full" />
                                                <span className="font-bold text-white">{user.name}</span>
                                            </td>
                                            <td className="px-6 py-4 text-gray-400">{user.level}</td>
                                            <td className="px-6 py-4">
                                                <span className="bg-green-500/10 text-green-500 px-2 py-1 rounded text-xs font-bold">Active</span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <button className="text-blue-400 hover:text-blue-300 font-bold text-xs">Edit</button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
            
            {/* TAB: SETTINGS */}
            {activeTab === 'settings' && (
                <div className="space-y-6">
                    <div className="bg-[#131720] border border-gray-800 rounded-xl p-6">
                        <h3 className="text-lg font-bold text-white mb-4">General Configuration</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Site Name</label>
                                <input type="text" value="LootX" className="w-full bg-[#0b0e14] border border-gray-700 rounded-lg px-4 py-2 text-white" readOnly />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Maintenance Mode</label>
                                <div className="flex items-center gap-3">
                                    <div className="w-12 h-6 bg-gray-700 rounded-full relative cursor-pointer">
                                        <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full"></div>
                                    </div>
                                    <span className="text-sm text-gray-400">Disabled</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {boxToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-black/80 backdrop-blur-sm animate-in fade-in" onClick={() => setBoxToDelete(null)}></div>
              <div className="relative w-full max-w-sm bg-[#131720] border border-gray-700 rounded-2xl shadow-2xl p-6 animate-in zoom-in-95">
                  <h3 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
                      <ShieldAlert className="w-6 h-6 text-red-500" /> Confirm Deletion
                  </h3>
                  <p className="text-gray-400 text-sm mb-6">
                      Are you sure you want to delete this box permanently? This action cannot be undone.
                  </p>
                  <div className="flex gap-3">
                      <button 
                          onClick={() => setBoxToDelete(null)}
                          className="flex-1 py-2.5 bg-gray-800 hover:bg-gray-700 text-white text-sm font-bold rounded-lg transition-colors"
                      >
                          Cancel
                      </button>
                      <button 
                          onClick={confirmDeleteBox}
                          className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 text-white text-sm font-bold rounded-lg shadow-lg shadow-red-900/20 transition-colors"
                      >
                          Delete Box
                      </button>
                  </div>
              </div>
          </div>
      )}

    </div>
  );
};

const SwordsIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="14.5 17.5 3 6 3 3 6 3 17.5 14.5"></polyline><line x1="13" y1="19" x2="19" y2="13"></line><line x1="16" y1="16" x2="20" y2="20"></line><line x1="19" y1="21" x2="21" y2="19"></line><polyline points="14.5 6.5 18 3 21 3 21 6 17.5 9.5"></polyline><line x1="5" y1="14" x2="9" y2="18"></line><line x1="7" y1="17" x2="4" y2="20"></line><line x1="3" y1="19" x2="5" y2="21"></line></svg>
);
