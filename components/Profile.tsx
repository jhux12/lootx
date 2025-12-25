import React, { useState, useEffect } from 'react';
import { useGame } from '../context/GameContext';
import { useSound } from '../context/SoundContext';
import { User, Package, Wallet, Clock, History, MapPin, Truck, Save, Check, Settings, Shield, Lock, LogOut, Key, Mail, AlertTriangle } from 'lucide-react';

const AVATAR_PRESETS = [
    'https://api.dicebear.com/7.x/avataaars/svg?seed=Felix',
    'https://api.dicebear.com/7.x/avataaars/svg?seed=Aneka',
    'https://api.dicebear.com/7.x/avataaars/svg?seed=Preston',
    'https://api.dicebear.com/7.x/bottts/svg?seed=Cyber',
    'https://api.dicebear.com/7.x/bottts/svg?seed=Robo',
    'https://api.dicebear.com/7.x/bottts/svg?seed=Gamer',
    'https://api.dicebear.com/7.x/adventurer/svg?seed=Midnight',
    'https://api.dicebear.com/7.x/adventurer/svg?seed=Dusty',
    'https://api.dicebear.com/7.x/fun-emoji/svg?seed=Happy',
    'https://api.dicebear.com/7.x/lorelei/svg?seed=Loot',
    'https://picsum.photos/id/64/200/200',
    'https://picsum.photos/id/237/200/200',
];

export const Profile: React.FC = () => {
  const { user, inventory, balance, sellItem, updateAddress, updateUserInfo, shipItem, logout } = useGame();
  const { playSound } = useSound();
  
  const [activeTab, setActiveTab] = useState<'inventory' | 'settings'>('inventory');

  // --- SETTINGS FORM STATES ---
  const [profileForm, setProfileForm] = useState({
      name: user.name,
      avatar: user.avatar
  });
  
  const [addressForm, setAddressForm] = useState(user.shippingAddress || {
      fullName: '', street: '', city: '', state: '', zipCode: '', country: ''
  });
  
  const [passwordForm, setPasswordForm] = useState({ current: '', new: '', confirm: '' });

  // Sync form with user data when user data loads/changes
  useEffect(() => {
      setProfileForm({
          name: user.name,
          avatar: user.avatar
      });
      if (user.shippingAddress) {
          setAddressForm(user.shippingAddress);
      }
  }, [user]);

  const totalInventoryValue = inventory.reduce((sum, item) => item.status === 'available' ? sum + item.price : sum, 0);

  const handleSell = (id: string, price: number) => {
      if(confirm('Are you sure you want to sell this item for balance?')) {
          playSound('coins');
          sellItem(id, price);
      }
  }

  const handleShip = (id: string) => {
      if (!user.shippingAddress) {
          alert("Please save your shipping address in Settings first!");
          setActiveTab('settings');
          return;
      }
      if(confirm('Ship this item to your saved address?')) {
          playSound('success');
          shipItem(id);
      }
  };

  const handleSaveProfile = async () => {
      await updateUserInfo(profileForm.name, profileForm.avatar);
      playSound('success');
      alert("Profile updated successfully!");
  };

  const handleSaveAddress = async () => {
      await updateAddress(addressForm);
      playSound('success');
      alert("Shipping address saved!");
  };

  const handleUpdatePassword = () => {
      if(passwordForm.new !== passwordForm.confirm) {
          playSound('error');
          alert("New passwords do not match");
          return;
      }
      if(!passwordForm.current || !passwordForm.new) {
        playSound('error');
        alert("Please fill in all password fields");
        return;
      }
      
      // Mock password update
      playSound('success');
      alert("Password updated successfully!");
      setPasswordForm({ current: '', new: '', confirm: '' });
  };

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* Profile Header */}
      <div className="bg-[#131720] border border-gray-800 rounded-2xl p-6 md:p-8 mb-8">
         <div className="flex flex-col md:flex-row items-center gap-8 mb-8">
            <div className="relative group">
                <img src={user.avatar} alt={user.name} className="w-32 h-32 rounded-2xl border-4 border-[#1a2130] shadow-2xl object-cover bg-[#0b0e14]" />
                <div className="absolute -bottom-3 -right-3 bg-blue-600 text-white text-xs font-bold px-3 py-1 rounded-full border-4 border-[#131720]">
                    Lvl {user.level}
                </div>
            </div>
            
            <div className="flex-1 text-center md:text-left">
                <h2 className="text-3xl font-black text-white mb-2">{user.name}</h2>
                <div className="flex flex-wrap justify-center md:justify-start gap-4">
                    <div className="flex items-center gap-2 bg-[#0b0e14] px-4 py-2 rounded-lg border border-gray-800">
                        <Wallet className="w-4 h-4 text-green-500" />
                        <span className="text-gray-400 text-sm">Balance:</span>
                        <span className="text-white font-bold">${balance.toFixed(2)}</span>
                    </div>
                    <div className="flex items-center gap-2 bg-[#0b0e14] px-4 py-2 rounded-lg border border-gray-800">
                        <Package className="w-4 h-4 text-blue-500" />
                        <span className="text-gray-400 text-sm">Value:</span>
                        <span className="text-white font-bold">${totalInventoryValue.toFixed(2)}</span>
                    </div>
                    <div className="flex items-center gap-2 bg-[#0b0e14] px-4 py-2 rounded-lg border border-gray-800">
                        <Clock className="w-4 h-4 text-purple-500" />
                        <span className="text-gray-400 text-sm">Joined:</span>
                        <span className="text-white font-bold">2 days ago</span>
                    </div>
                </div>
            </div>
         </div>

         {/* Navigation Tabs */}
         <div className="flex gap-4 border-b border-gray-800 overflow-x-auto">
             <button 
                onClick={() => { playSound('click'); setActiveTab('inventory'); }}
                className={`flex items-center gap-2 px-6 py-3 text-sm font-bold border-b-2 transition-colors whitespace-nowrap ${activeTab === 'inventory' ? 'border-brand-purple text-white' : 'border-transparent text-gray-500 hover:text-gray-300'}`}
             >
                 <Package className="w-4 h-4" /> Inventory
             </button>
             <button 
                onClick={() => { playSound('click'); setActiveTab('settings'); }}
                className={`flex items-center gap-2 px-6 py-3 text-sm font-bold border-b-2 transition-colors whitespace-nowrap ${activeTab === 'settings' ? 'border-brand-purple text-white' : 'border-transparent text-gray-500 hover:text-gray-300'}`}
             >
                 <Settings className="w-4 h-4" /> Account Settings
             </button>
         </div>
      </div>

      {/* --- INVENTORY TAB --- */}
      {activeTab === 'inventory' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xl font-bold text-white flex items-center gap-2">
                        <Package className="w-5 h-5 text-gray-400" /> Items ({inventory.length})
                    </h3>
                </div>

                {inventory.length === 0 ? (
                    <div className="text-center py-20 border-2 border-dashed border-gray-800 rounded-xl bg-[#131720]">
                        <Package className="w-12 h-12 text-gray-700 mx-auto mb-4" />
                        <p className="text-gray-500">Your inventory is empty.</p>
                        <p className="text-gray-600 text-sm mt-2">Open some cases to get started!</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                        {inventory.map((item) => (
                            <div key={item.instanceId} className={`bg-[#131720] border rounded-xl p-4 flex flex-col items-center group relative overflow-hidden ${item.status === 'shipping' ? 'border-blue-500/50 opacity-75' : 'border-gray-800'}`}>
                                <div className="absolute top-0 left-0 right-0 h-1" style={{ backgroundColor: item.color }}></div>
                                
                                {item.status === 'shipping' && (
                                    <div className="absolute top-2 right-2 bg-blue-500 text-white text-[10px] font-bold px-2 py-0.5 rounded flex items-center gap-1">
                                        <Truck className="w-3 h-3" /> Processing
                                    </div>
                                )}

                                <div className="relative w-24 h-24 mb-4 flex items-center justify-center">
                                    <div className="absolute inset-0 rounded-full opacity-0 group-hover:opacity-20 transition-opacity blur-md" style={{ backgroundColor: item.color }}></div>
                                    <img src={item.image} className="relative z-10 w-full h-full object-contain transform group-hover:scale-110 transition-transform" />
                                </div>
                                
                                <div className="text-center w-full mb-3">
                                    <div className="text-white font-bold text-sm truncate">{item.name}</div>
                                    <div className="text-gray-500 text-xs">${item.price.toFixed(2)}</div>
                                </div>
                                
                                {item.status === 'available' ? (
                                    <div className="flex gap-2 w-full mt-auto">
                                        <button 
                                            onClick={() => handleSell(item.instanceId, item.price)}
                                            className="flex-1 py-1.5 bg-[#1a2130] hover:bg-green-600 hover:text-white text-gray-400 text-xs font-bold rounded transition-colors border border-gray-700 hover:border-green-500"
                                        >
                                            Sell
                                        </button>
                                        <button 
                                            onClick={() => handleShip(item.instanceId)}
                                            className="flex-1 py-1.5 bg-[#1a2130] hover:bg-blue-600 hover:text-white text-gray-400 text-xs font-bold rounded transition-colors border border-gray-700 hover:border-blue-500"
                                        >
                                            Ship
                                        </button>
                                    </div>
                                ) : (
                                    <div className="w-full py-1.5 bg-[#0b0e14] text-blue-400 text-xs font-bold rounded text-center border border-blue-900/30 mt-auto">
                                        Shipped
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="space-y-6">
                 {/* Quick Address View */}
                 <div className="bg-[#131720] border border-gray-800 rounded-xl p-6">
                    <h3 className="font-bold text-white flex items-center gap-2 mb-4">
                        <MapPin className="w-4 h-4 text-brand-purple" /> Shipping To
                    </h3>
                    {user.shippingAddress && user.shippingAddress.fullName ? (
                        <div className="text-sm text-gray-400 bg-[#0b0e14] p-4 rounded-lg border border-gray-800">
                            <div className="font-bold text-white mb-1">{user.shippingAddress.fullName}</div>
                            <div>{user.shippingAddress.street}</div>
                            <div>{user.shippingAddress.city}, {user.shippingAddress.state} {user.shippingAddress.zipCode}</div>
                            <div>{user.shippingAddress.country}</div>
                            <div className="mt-3 text-xs text-green-500 flex items-center gap-1">
                                <Check className="w-3 h-3" /> Verified Address
                            </div>
                        </div>
                    ) : (
                        <div className="text-center py-6 text-gray-500 bg-[#0b0e14] rounded-lg border border-gray-800 border-dashed">
                            <MapPin className="w-8 h-8 mx-auto mb-2 opacity-50" />
                            <div className="text-xs">No address saved.</div>
                            <button onClick={() => setActiveTab('settings')} className="text-blue-400 text-xs font-bold mt-2 hover:underline">Setup in Settings</button>
                        </div>
                    )}
                 </div>

                 {/* Recent Activity */}
                 <div className="bg-[#131720] border border-gray-800 rounded-xl p-6">
                    <h3 className="font-bold text-white mb-4 flex items-center gap-2">
                        <History className="w-4 h-4 text-gray-400" /> Recent Activity
                    </h3>
                    <div className="text-gray-500 text-xs text-center py-8 italic">
                        No recent activity to display.
                    </div>
                 </div>
            </div>
          </div>
      )}

      {/* --- SETTINGS TAB --- */}
      {activeTab === 'settings' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              
              <div className="space-y-8">
                {/* Public Profile Form */}
                <div className="bg-[#131720] border border-gray-800 rounded-xl p-6">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-2 bg-blue-500/10 rounded-lg">
                            <User className="w-5 h-5 text-blue-500" />
                        </div>
                        <h3 className="text-lg font-bold text-white">Public Profile</h3>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Display Name</label>
                            <input 
                                type="text" 
                                value={profileForm.name} 
                                onChange={e => setProfileForm({...profileForm, name: e.target.value})}
                                className="w-full bg-[#0b0e14] border border-gray-700 rounded-lg p-3 text-white focus:outline-none focus:border-blue-500 transition-colors"
                            />
                        </div>
                        
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-3">Choose Avatar</label>
                            <div className="grid grid-cols-4 sm:grid-cols-6 gap-3 mb-4">
                                {AVATAR_PRESETS.map((url, idx) => (
                                <div 
                                    key={idx}
                                    onClick={() => { playSound('click'); setProfileForm({...profileForm, avatar: url}); }}
                                    className={`relative aspect-square rounded-xl overflow-hidden cursor-pointer border-2 transition-all hover:scale-105 ${profileForm.avatar === url ? 'border-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]' : 'border-transparent hover:border-gray-600'}`}
                                >
                                    <img src={url} className="w-full h-full object-cover bg-[#0b0e14]" alt="Avatar option" />
                                    {profileForm.avatar === url && (
                                        <div className="absolute inset-0 bg-blue-500/20 flex items-center justify-center">
                                            <div className="bg-blue-500 rounded-full p-1">
                                                <Check className="w-3 h-3 text-white" />
                                            </div>
                                        </div>
                                    )}
                                </div>
                                ))}
                            </div>
                            
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Or Custom URL</label>
                            <div className="flex gap-4">
                                <div className="flex-1 relative">
                                    <input 
                                        type="text" 
                                        value={profileForm.avatar} 
                                        onChange={e => setProfileForm({...profileForm, avatar: e.target.value})}
                                        className="w-full bg-[#0b0e14] border border-gray-700 rounded-lg p-3 pl-12 text-white focus:outline-none focus:border-blue-500 transition-colors text-sm truncate"
                                        placeholder="https://..."
                                    />
                                    <img src={profileForm.avatar} className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-md border border-gray-700 object-cover bg-black" alt="Current" />
                                </div>
                            </div>
                        </div>
                        
                        <button 
                            onClick={handleSaveProfile}
                            className="w-full sm:w-auto px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg shadow-lg shadow-blue-900/20 transition-colors flex items-center justify-center gap-2"
                        >
                            <Save className="w-4 h-4" /> Save Profile
                        </button>
                    </div>
                </div>

                {/* Security Section */}
                <div className="bg-[#131720] border border-gray-800 rounded-xl p-6">
                     <div className="flex items-center gap-3 mb-6">
                        <div className="p-2 bg-green-500/10 rounded-lg">
                            <Shield className="w-5 h-5 text-green-500" />
                        </div>
                        <h3 className="text-lg font-bold text-white">Security</h3>
                    </div>
                    
                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Email Address</label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                                <input 
                                    type="text" 
                                    value={user.email || 'user@example.com'} 
                                    readOnly
                                    className="w-full bg-[#0b0e14]/50 border border-gray-700 rounded-lg p-3 pl-10 text-gray-400 cursor-not-allowed"
                                />
                            </div>
                        </div>

                        <div className="pt-4 border-t border-gray-800">
                             <h4 className="text-sm font-bold text-white mb-3">Change Password</h4>
                             <div className="space-y-3">
                                 <div className="relative">
                                     <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                                     <input 
                                        type="password" 
                                        placeholder="Current Password"
                                        value={passwordForm.current}
                                        onChange={e => setPasswordForm({...passwordForm, current: e.target.value})}
                                        className="w-full bg-[#0b0e14] border border-gray-700 rounded-lg p-3 pl-10 text-white text-sm focus:border-green-500 focus:outline-none"
                                     />
                                 </div>
                                 <div className="flex gap-3">
                                    <input 
                                        type="password" 
                                        placeholder="New Password"
                                        value={passwordForm.new}
                                        onChange={e => setPasswordForm({...passwordForm, new: e.target.value})}
                                        className="w-full bg-[#0b0e14] border border-gray-700 rounded-lg p-3 text-white text-sm focus:border-green-500 focus:outline-none"
                                     />
                                     <input 
                                        type="password" 
                                        placeholder="Confirm"
                                        value={passwordForm.confirm}
                                        onChange={e => setPasswordForm({...passwordForm, confirm: e.target.value})}
                                        className="w-full bg-[#0b0e14] border border-gray-700 rounded-lg p-3 text-white text-sm focus:border-green-500 focus:outline-none"
                                     />
                                 </div>
                                 <button 
                                    onClick={handleUpdatePassword}
                                    className="px-6 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 font-bold rounded-lg transition-colors text-sm"
                                 >
                                    Update Password
                                 </button>
                             </div>
                        </div>
                    </div>
                </div>
              </div>

              <div className="space-y-8">
                {/* Shipping Address Form */}
                <div className="bg-[#131720] border border-gray-800 rounded-xl p-6">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-2 bg-brand-purple/10 rounded-lg">
                            <Truck className="w-5 h-5 text-brand-purple" />
                        </div>
                        <h3 className="text-lg font-bold text-white">Shipping Address</h3>
                    </div>

                    <div className="space-y-3">
                        <input type="text" placeholder="Full Name" value={addressForm.fullName} onChange={e => setAddressForm({...addressForm, fullName: e.target.value})} className="w-full bg-[#0b0e14] border border-gray-700 rounded-lg p-3 text-sm text-white focus:border-brand-purple focus:outline-none" />
                        <input type="text" placeholder="Street Address" value={addressForm.street} onChange={e => setAddressForm({...addressForm, street: e.target.value})} className="w-full bg-[#0b0e14] border border-gray-700 rounded-lg p-3 text-sm text-white focus:border-brand-purple focus:outline-none" />
                        <div className="flex gap-3">
                            <input type="text" placeholder="City" value={addressForm.city} onChange={e => setAddressForm({...addressForm, city: e.target.value})} className="w-full bg-[#0b0e14] border border-gray-700 rounded-lg p-3 text-sm text-white focus:border-brand-purple focus:outline-none" />
                            <input type="text" placeholder="Zip Code" value={addressForm.zipCode} onChange={e => setAddressForm({...addressForm, zipCode: e.target.value})} className="w-1/3 bg-[#0b0e14] border border-gray-700 rounded-lg p-3 text-sm text-white focus:border-brand-purple focus:outline-none" />
                        </div>
                        <div className="flex gap-3">
                            <input type="text" placeholder="State / Province" value={addressForm.state} onChange={e => setAddressForm({...addressForm, state: e.target.value})} className="w-full bg-[#0b0e14] border border-gray-700 rounded-lg p-3 text-sm text-white focus:border-brand-purple focus:outline-none" />
                            <input type="text" placeholder="Country" value={addressForm.country} onChange={e => setAddressForm({...addressForm, country: e.target.value})} className="w-full bg-[#0b0e14] border border-gray-700 rounded-lg p-3 text-sm text-white focus:border-brand-purple focus:outline-none" />
                        </div>
                        
                        <div className="pt-2">
                             <button 
                                onClick={handleSaveAddress}
                                className="w-full sm:w-auto px-6 py-2.5 bg-brand-purple hover:bg-purple-600 text-white font-bold rounded-lg shadow-lg shadow-purple-900/20 transition-colors flex items-center justify-center gap-2"
                            >
                                <Save className="w-4 h-4" /> Save Address
                            </button>
                        </div>
                    </div>
                </div>

                {/* Account Actions / Danger Zone */}
                <div className="bg-[#131720] border border-red-900/30 rounded-xl p-6">
                     <div className="flex items-center gap-3 mb-6">
                        <div className="p-2 bg-red-500/10 rounded-lg">
                            <AlertTriangle className="w-5 h-5 text-red-500" />
                        </div>
                        <h3 className="text-lg font-bold text-white">Danger Zone</h3>
                    </div>
                    
                    <div className="flex flex-col sm:flex-row gap-4 items-center justify-between p-4 bg-red-500/5 border border-red-500/10 rounded-lg">
                        <div className="text-center sm:text-left">
                            <h4 className="font-bold text-red-400 text-sm">Sign out of session</h4>
                            <p className="text-xs text-red-400/60">You will need to log back in to access your inventory.</p>
                        </div>
                        <button 
                            onClick={logout}
                            className="px-6 py-2 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white border border-red-500/50 rounded-lg text-sm font-bold transition-all flex items-center gap-2"
                        >
                            <LogOut className="w-4 h-4" /> Sign Out
                        </button>
                    </div>
                </div>
              </div>
          </div>
      )}

    </div>
  );
};