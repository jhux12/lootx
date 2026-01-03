import React, { useState, useEffect, useRef } from 'react';
import { useGame } from '../context/GameContext';
import { useSound } from '../context/SoundContext';
import { User, Package, Wallet, Clock, History, MapPin, Truck, Save, Check, Settings, Shield, Lock, LogOut, Mail, AlertTriangle, UserPlus, UserCheck, Users as UsersIcon, Sparkles, Upload, Image as ImageIcon, Trash2, ExternalLink } from 'lucide-react';

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
  const { user, users, inventory, balance, sellItem, updateAddress, updateUserInfo, shipItem, logout, view, setView, followUser, unfollowUser } = useGame();
  const { playSound } = useSound();
  
  const [activeTab, setActiveTab] = useState<'inventory' | 'community' | 'settings'>('inventory');
  const [inventorySubTab, setInventorySubTab] = useState<'available' | 'shipped'>('available');
  const [activePeopleTab, setActivePeopleTab] = useState<'followers' | 'following'>('followers');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedUserId = view.type === 'PROFILE' ? view.userId : undefined;
  const profileUser = selectedUserId ? users.find((u) => u.id === selectedUserId) : user;
  const isOwnProfile = !selectedUserId || selectedUserId === user.id;
  const displayUser = profileUser || user;
  
  const viewedFollowerIds = Array.isArray(displayUser.followers) ? displayUser.followers : [];
  const viewedFollowers = users.filter((u) => viewedFollowerIds.includes(u.id));
  const viewedFollowing = users.filter((u) => Array.isArray(u.followers) && u.followers.includes(displayUser.id));
  
  const isFollowing = !!(!isOwnProfile && profileUser && Array.isArray(profileUser.followers) && profileUser.followers.includes(user.id));
  
  const activePeople = activePeopleTab === 'followers' ? viewedFollowers : viewedFollowing;
  const activePeopleLabel = activePeopleTab === 'followers' ? 'Followers' : 'Following';
  const activePeopleEmptyMessage =
    activePeopleTab === 'followers'
      ? isOwnProfile ? 'You have no followers yet.' : 'No followers yet. Be the first to follow!'
      : isOwnProfile
        ? 'You are not following anyone yet. Browse the leaderboard to start following players.'
        : 'Not following anyone yet.';

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
      if (!isOwnProfile) return;
      setProfileForm({
          name: user.name,
          avatar: user.avatar
      });
      if (user.shippingAddress) {
          setAddressForm(user.shippingAddress);
      }
  }, [user, isOwnProfile]);

  useEffect(() => {
      setActivePeopleTab('followers');
  }, [displayUser.id]);

  const normalizedInventory = inventory
    .map((item, index) => ({
      ...item,
      instanceId: item.instanceId || `${item.id}-${index}`,
      status: item.status ?? 'available',
      obtainedAt: item.obtainedAt ?? 0
    }))
    .sort((a, b) => b.obtainedAt - a.obtainedAt);

  const availableItems = normalizedInventory.filter(item => item.status === 'available');
  const shippedItems = normalizedInventory.filter(item => item.status === 'shipping' || item.status === 'shipped');
  const displayInventory = inventorySubTab === 'available' ? availableItems : shippedItems;

  const totalInventoryValue = isOwnProfile 
    ? availableItems.reduce((sum, item) => sum + item.price, 0)
    : 0;
  const profileBalance = isOwnProfile ? balance : displayUser.balance ?? 0;

  const handleSell = (id: string, price: number) => {
      if(confirm('Are you sure you want to sell this item for balance?')) {
          playSound('coins');
          sellItem(id, price);
      }
  }

  const handleShip = (id: string) => {
      if (!user.shippingAddress || !user.shippingAddress.fullName) {
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
      
      playSound('success');
      alert("Password updated successfully!");
      setPasswordForm({ current: '', new: '', confirm: '' });
  };

  const handleFollowClick = async () => {
      if (!profileUser || isFollowing) return;
      await followUser(profileUser.id);
      alert("Now following this player!");
  };

  const handleUnfollowClick = async () => {
      if (!profileUser || !isFollowing) return;
      await unfollowUser(profileUser.id);
      alert("You unfollowed this player.");
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          if (file.size > 2 * 1024 * 1024) {
              alert("File is too large. Please choose an image under 2MB.");
              return;
          }
          const reader = new FileReader();
          reader.onloadend = () => {
              setProfileForm(prev => ({ ...prev, avatar: reader.result as string }));
              playSound('click');
          };
          reader.readAsDataURL(file);
      }
  };

  if (selectedUserId && !profileUser) {
      return (
        <div className="max-w-4xl mx-auto p-6">
            <div className="bg-[#131720] border border-gray-800 rounded-2xl p-10 text-center">
                <h2 className="text-2xl font-bold text-white mb-2">Profile not found</h2>
                <p className="text-gray-500 mb-6">The player you are trying to view does not exist or has been removed.</p>
                <div className="flex justify-center gap-3">
                    <button 
                        onClick={() => setView({ type: 'PROFILE' })}
                        className="px-5 py-2 bg-brand-purple text-white rounded-lg font-bold hover:bg-purple-600 transition-colors"
                    >
                        Back to my profile
                    </button>
                    <button 
                        onClick={() => setView({ type: 'LEADERBOARD' })}
                        className="px-5 py-2 bg-[#0b0e14] text-gray-300 rounded-lg font-bold border border-gray-700 hover:border-gray-500 transition-colors"
                    >
                        Open leaderboard
                    </button>
                </div>
            </div>
        </div>
      );
  }

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* Profile Header */}
      <div className="bg-[#131720] border border-gray-800 rounded-2xl p-6 md:p-8 mb-8">
         <div className="flex flex-col md:flex-row items-center gap-8 mb-8">
            <div className="relative group">
                <img src={displayUser.avatar} alt={displayUser.name} className="w-32 h-32 rounded-2xl border-4 border-[#1a2130] shadow-2xl object-cover bg-[#0b0e14]" />
                <div className="absolute -bottom-3 -right-3 bg-blue-600 text-white text-xs font-bold px-3 py-1 rounded-full border-4 border-[#131720]">
                    Lvl {displayUser.level}
                </div>
            </div>
            
            <div className="flex-1 text-center md:text-left w-full">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div>
                        <h2 className="text-3xl font-black text-white mb-2">{displayUser.name}</h2>
                        <div className="flex flex-wrap justify-center md:justify-start gap-4 text-sm text-gray-400">
                            <span className="flex items-center gap-1.5"><UsersIcon className="w-4 h-4" /> {viewedFollowerIds.length} Followers</span>
                            <span className="flex items-center gap-1.5"><UserPlus className="w-4 h-4" /> {viewedFollowing.length} Following</span>
                            <span className="flex items-center gap-1.5"><Clock className="w-4 h-4" /> Joined {new Date(displayUser.joinedAt).toLocaleDateString()}</span>
                        </div>
                    </div>
                    
                    {!isOwnProfile && (
                        <div className="flex items-center gap-3 justify-center md:justify-end">
                            {isFollowing ? (
                                <button 
                                    onClick={handleUnfollowClick}
                                    className="flex items-center gap-2 bg-[#0b0e14] text-gray-200 px-4 py-2 rounded-lg font-bold text-sm border border-gray-700 hover:border-red-500 hover:text-white transition-colors"
                                >
                                    <UserCheck className="w-4 h-4" /> Following
                                </button>
                            ) : (
                                <button 
                                    onClick={handleFollowClick}
                                    className="flex items-center gap-2 bg-brand-purple text-white px-6 py-2 rounded-lg font-bold text-sm hover:bg-purple-600 transition-colors shadow-lg shadow-purple-500/20"
                                >
                                    <UserPlus className="w-4 h-4" /> Follow
                                </button>
                            )}
                        </div>
                    )}
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
                    <div className="bg-[#0b0e14] p-4 rounded-xl border border-gray-800/50">
                        <div className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-1">Balance</div>
                        <div className="text-xl font-black text-green-500">${profileBalance.toLocaleString()}</div>
                    </div>
                    <div className="bg-[#0b0e14] p-4 rounded-xl border border-gray-800/50">
                        <div className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-1">Inventory</div>
                        <div className="text-xl font-black text-white">{isOwnProfile ? availableItems.length : '?'} Items</div>
                    </div>
                    <div className="bg-[#0b0e14] p-4 rounded-xl border border-gray-800/50">
                        <div className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-1">Total Value</div>
                        <div className="text-xl font-black text-brand-purple">${isOwnProfile ? totalInventoryValue.toLocaleString() : '?'}</div>
                    </div>
                    <div className="bg-[#0b0e14] p-4 rounded-xl border border-gray-800/50">
                        <div className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-1">XP Points</div>
                        <div className="text-xl font-black text-blue-500">{displayUser.xp.toLocaleString()}</div>
                    </div>
                </div>
            </div>
         </div>

         {/* Main Tabs */}
         <div className="flex flex-wrap md:flex-nowrap items-center gap-2 bg-[#0b0e14] p-1 rounded-xl border border-gray-800 w-full max-w-full overflow-x-auto">
            <button 
                onClick={() => setActiveTab('inventory')}
                className={`flex items-center gap-2 px-5 md:px-6 py-2.5 rounded-lg font-bold text-sm whitespace-nowrap transition-all ${activeTab === 'inventory' ? 'bg-[#1a2130] text-white shadow-sm' : 'text-gray-500 hover:text-gray-300'}`}
            >
                <Package className="w-4 h-4" /> Inventory
            </button>
            <button 
                onClick={() => setActiveTab('community')}
                className={`flex items-center gap-2 px-5 md:px-6 py-2.5 rounded-lg font-bold text-sm whitespace-nowrap transition-all ${activeTab === 'community' ? 'bg-[#1a2130] text-white shadow-sm' : 'text-gray-500 hover:text-gray-300'}`}
            >
                <UsersIcon className="w-4 h-4" /> Community
            </button>
            {isOwnProfile && (
                <button 
                    onClick={() => setActiveTab('settings')}
                    className={`flex items-center gap-2 px-5 md:px-6 py-2.5 rounded-lg font-bold text-sm whitespace-nowrap transition-all ${activeTab === 'settings' ? 'bg-[#1a2130] text-white shadow-sm' : 'text-gray-500 hover:text-gray-300'}`}
                >
                    <Settings className="w-4 h-4" /> Settings
                </button>
            )}
         </div>
      </div>

      {/* Tab Content */}
      <div className="min-h-[400px]">
          {activeTab === 'inventory' && (
              <div className="space-y-6">
                  {/* Inventory Sub-Tabs */}
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-gray-800 pb-4">
                      <div className="flex flex-wrap gap-2">
                          <button 
                            onClick={() => setInventorySubTab('available')}
                            className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${inventorySubTab === 'available' ? 'bg-brand-purple/10 text-brand-purple border border-brand-purple/20' : 'text-gray-500 hover:text-gray-300'}`}
                          >
                              Available Items ({availableItems.length})
                          </button>
                          <button 
                            onClick={() => setInventorySubTab('shipped')}
                            className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${inventorySubTab === 'shipped' ? 'bg-brand-purple/10 text-brand-purple border border-brand-purple/20' : 'text-gray-500 hover:text-gray-300'}`}
                          >
                              Shipped & Processing ({shippedItems.length})
                          </button>
                      </div>
                      
                      {isOwnProfile && inventorySubTab === 'available' && availableItems.length > 0 && (
                          <div className="text-xs text-gray-500 font-medium">
                              Total Value: <span className="text-green-500 font-bold">${totalInventoryValue.toLocaleString()}</span>
                          </div>
                      )}
                  </div>

                  {!isOwnProfile ? (
                      <div className="bg-[#131720] border border-gray-800 rounded-2xl p-12 text-center">
                          <Lock className="w-12 h-12 text-gray-700 mx-auto mb-4" />
                          <h3 className="text-xl font-bold text-white mb-2">Private Inventory</h3>
                          <p className="text-gray-500">This player's inventory is set to private.</p>
                      </div>
                  ) : displayInventory.length === 0 ? (
                      <div className="bg-[#131720] border border-gray-800 rounded-2xl p-12 text-center">
                          <Package className="w-12 h-12 text-gray-700 mx-auto mb-4" />
                          <h3 className="text-xl font-bold text-white mb-2">
                              {inventorySubTab === 'available' ? 'Your inventory is empty' : 'No shipped items yet'}
                          </h3>
                          <p className="text-gray-500 mb-6">
                              {inventorySubTab === 'available' 
                                ? 'Open some boxes to start collecting items!' 
                                : 'Items you choose to ship will appear here.'}
                          </p>
                          {inventorySubTab === 'available' && (
                              <button 
                                onClick={() => setView({ type: 'BOXES' })}
                                className="px-6 py-2 bg-brand-purple text-white rounded-lg font-bold hover:bg-purple-600 transition-colors"
                              >
                                Browse Boxes
                              </button>
                          )}
                      </div>
                  ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                          {displayInventory.map((item) => (
                              <div key={item.instanceId} className="bg-[#131720] border border-gray-800 rounded-xl p-4 group hover:border-brand-purple/50 transition-all">
                                  <div className="relative aspect-square mb-4 bg-[#0b0e14] rounded-lg p-4 flex items-center justify-center overflow-hidden">
                                      <img src={item.image} alt={item.name} className="w-full h-full object-contain group-hover:scale-110 transition-transform duration-500" />
                                      <div className={`absolute inset-0 opacity-10 bg-gradient-to-br ${
                                          item.rarity === 'legendary' ? 'from-yellow-500' :
                                          item.rarity === 'epic' ? 'from-purple-500' :
                                          item.rarity === 'rare' ? 'from-blue-500' : 'from-gray-500'
                                      }`} />
                                  </div>
                                  <div className="text-xs font-bold text-gray-500 uppercase mb-1 tracking-wider">{item.rarity}</div>
                                  <h4 className="text-white font-bold text-sm mb-2 line-clamp-1">{item.name}</h4>
                                  <div className="text-green-500 font-black mb-4">${item.price.toLocaleString()}</div>
                                  
                                  {inventorySubTab === 'available' ? (
                                      <div className="grid grid-cols-2 gap-2">
                                          <button 
                                              onClick={() => handleSell(item.instanceId, item.price)}
                                              className="py-2 bg-green-500/10 text-green-500 rounded-lg text-xs font-bold hover:bg-green-500 hover:text-white transition-all"
                                          >
                                              Sell
                                          </button>
                                          <button 
                                              onClick={() => handleShip(item.instanceId)}
                                              className="py-2 bg-blue-500/10 text-blue-500 rounded-lg text-xs font-bold hover:bg-blue-500 hover:text-white transition-all"
                                          >
                                              Ship
                                          </button>
                                      </div>
                                  ) : (
                                      <div className="flex items-center gap-2 text-xs font-bold py-2 px-3 bg-[#0b0e14] rounded-lg text-gray-400">
                                          {item.status === 'shipping' ? (
                                              <><Clock className="w-3 h-3 text-yellow-500" /> Processing</>
                                          ) : (
                                              <><Truck className="w-3 h-3 text-green-500" /> Shipped</>
                                          )}
                                      </div>
                                  )}
                              </div>
                          ))}
                      </div>
                  )}
              </div>
          )}

          {activeTab === 'community' && (
              <div className="bg-[#131720] border border-gray-800 rounded-2xl overflow-hidden">
                  <div className="flex border-b border-gray-800">
                      <button 
                        onClick={() => setActivePeopleTab('followers')}
                        className={`flex-1 py-4 font-bold text-sm transition-colors ${activePeopleTab === 'followers' ? 'text-white bg-[#1a2130]' : 'text-gray-500 hover:text-gray-300'}`}
                      >
                          Followers ({viewedFollowerIds.length})
                      </button>
                      <button 
                        onClick={() => setActivePeopleTab('following')}
                        className={`flex-1 py-4 font-bold text-sm transition-colors ${activePeopleTab === 'following' ? 'text-white bg-[#1a2130]' : 'text-gray-500 hover:text-gray-300'}`}
                      >
                          Following ({viewedFollowing.length})
                      </button>
                  </div>
                  
                  <div className="p-6">
                      {activePeople.length === 0 ? (
                          <div className="py-12 text-center">
                              <UsersIcon className="w-12 h-12 text-gray-800 mx-auto mb-4" />
                              <p className="text-gray-500">{activePeopleEmptyMessage}</p>
                          </div>
                      ) : (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {activePeople.map((p) => (
                                  <div key={p.id} className="flex items-center justify-between p-4 bg-[#0b0e14] rounded-xl border border-gray-800 hover:border-gray-700 transition-colors">
                                      <div 
                                        className="flex items-center gap-4 cursor-pointer"
                                        onClick={() => setView({ type: 'PROFILE', userId: p.id })}
                                      >
                                          <img src={p.avatar} alt={p.name} className="w-12 h-12 rounded-lg object-cover bg-gray-800" />
                                          <div>
                                              <div className="text-white font-bold">{p.name}</div>
                                              <div className="text-xs text-gray-500">Level {p.level} • ${(p.balance ?? 0).toLocaleString()}</div>
                                          </div>
                                      </div>
                                      <button 
                                        onClick={() => setView({ type: 'PROFILE', userId: p.id })}
                                        className="p-2 text-gray-500 hover:text-white transition-colors"
                                      >
                                          <ExternalLink className="w-5 h-5" />
                                      </button>
                                  </div>
                              ))}
                          </div>
                      )}
                  </div>
              </div>
          )}

          {activeTab === 'settings' && isOwnProfile && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  {/* Profile Settings */}
                  <div className="lg:col-span-2 space-y-8">
                      <div className="bg-[#131720] border border-gray-800 rounded-2xl p-6">
                          <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                              <User className="w-5 h-5 text-brand-purple" /> Profile Information
                          </h3>
                          
                          <div className="space-y-6">
                              <div>
                                  <label className="block text-sm font-bold text-gray-400 mb-2">Display Name</label>
                                  <input 
                                      type="text" 
                                      value={profileForm.name}
                                      onChange={(e) => setProfileForm({...profileForm, name: e.target.value})}
                                      className="w-full bg-[#0b0e14] border border-gray-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-brand-purple transition-colors"
                                  />
                              </div>
                              
                              <div>
                                  <label className="block text-sm font-bold text-gray-400 mb-4">Choose Avatar</label>
                                  <div className="grid grid-cols-4 sm:grid-cols-6 gap-3 mb-4">
                                      {AVATAR_PRESETS.map((url, idx) => (
                                          <button 
                                              key={idx}
                                              onClick={() => setProfileForm({...profileForm, avatar: url})}
                                              className={`relative aspect-square rounded-xl overflow-hidden border-2 transition-all ${profileForm.avatar === url ? 'border-brand-purple scale-95' : 'border-transparent hover:border-gray-700'}`}
                                          >
                                              <img src={url} alt="preset" className="w-full h-full object-cover" />
                                              {profileForm.avatar === url && (
                                                  <div className="absolute inset-0 bg-brand-purple/20 flex items-center justify-center">
                                                      <Check className="w-6 h-6 text-white" />
                                                  </div>
                                              )}
                                          </button>
                                      ))}
                                      <button 
                                          onClick={() => fileInputRef.current?.click()}
                                          className="aspect-square rounded-xl border-2 border-dashed border-gray-800 flex flex-col items-center justify-center gap-1 text-gray-500 hover:border-gray-600 hover:text-gray-400 transition-all"
                                      >
                                          <Upload className="w-5 h-5" />
                                          <span className="text-[10px] font-bold">Upload</span>
                                      </button>
                                      <input 
                                          type="file" 
                                          ref={fileInputRef} 
                                          onChange={handleFileUpload} 
                                          accept="image/*" 
                                          className="hidden" 
                                      />
                                  </div>
                              </div>
                              
                              <button 
                                  onClick={handleSaveProfile}
                                  className="w-full py-3 bg-brand-purple text-white rounded-xl font-bold hover:bg-purple-600 transition-all shadow-lg shadow-purple-500/20 flex items-center justify-center gap-2"
                              >
                                  <Save className="w-5 h-5" /> Save Profile Changes
                              </button>
                          </div>
                      </div>

                      <div className="bg-[#131720] border border-gray-800 rounded-2xl p-6">
                          <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                              <MapPin className="w-5 h-5 text-brand-purple" /> Shipping Address
                          </h3>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              <div className="md:col-span-2">
                                  <label className="block text-sm font-bold text-gray-400 mb-2">Full Name</label>
                                  <input 
                                      type="text" 
                                      value={addressForm.fullName}
                                      onChange={(e) => setAddressForm({...addressForm, fullName: e.target.value})}
                                      className="w-full bg-[#0b0e14] border border-gray-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-brand-purple transition-colors"
                                      placeholder="John Doe"
                                  />
                              </div>
                              <div className="md:col-span-2">
                                  <label className="block text-sm font-bold text-gray-400 mb-2">Street Address</label>
                                  <input 
                                      type="text" 
                                      value={addressForm.street}
                                      onChange={(e) => setAddressForm({...addressForm, street: e.target.value})}
                                      className="w-full bg-[#0b0e14] border border-gray-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-brand-purple transition-colors"
                                      placeholder="123 Gaming Ave"
                                  />
                              </div>
                              <div>
                                  <label className="block text-sm font-bold text-gray-400 mb-2">City</label>
                                  <input 
                                      type="text" 
                                      value={addressForm.city}
                                      onChange={(e) => setAddressForm({...addressForm, city: e.target.value})}
                                      className="w-full bg-[#0b0e14] border border-gray-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-brand-purple transition-colors"
                                  />
                              </div>
                              <div>
                                  <label className="block text-sm font-bold text-gray-400 mb-2">State / Province</label>
                                  <input 
                                      type="text" 
                                      value={addressForm.state}
                                      onChange={(e) => setAddressForm({...addressForm, state: e.target.value})}
                                      className="w-full bg-[#0b0e14] border border-gray-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-brand-purple transition-colors"
                                  />
                              </div>
                              <div>
                                  <label className="block text-sm font-bold text-gray-400 mb-2">Zip / Postal Code</label>
                                  <input 
                                      type="text" 
                                      value={addressForm.zipCode}
                                      onChange={(e) => setAddressForm({...addressForm, zipCode: e.target.value})}
                                      className="w-full bg-[#0b0e14] border border-gray-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-brand-purple transition-colors"
                                  />
                              </div>
                              <div>
                                  <label className="block text-sm font-bold text-gray-400 mb-2">Country</label>
                                  <input 
                                      type="text" 
                                      value={addressForm.country}
                                      onChange={(e) => setAddressForm({...addressForm, country: e.target.value})}
                                      className="w-full bg-[#0b0e14] border border-gray-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-brand-purple transition-colors"
                                  />
                              </div>
                          </div>
                          
                          <button 
                              onClick={handleSaveAddress}
                              className="w-full mt-8 py-3 bg-[#1a2130] text-white rounded-xl font-bold hover:bg-gray-800 transition-all border border-gray-700 flex items-center justify-center gap-2"
                          >
                              <Save className="w-5 h-5" /> Save Shipping Address
                          </button>
                      </div>
                  </div>

                  {/* Security & Account */}
                  <div className="space-y-8">
                      <div className="bg-[#131720] border border-gray-800 rounded-2xl p-6">
                          <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                              <Shield className="w-5 h-5 text-brand-purple" /> Security
                          </h3>
                          
                          <div className="space-y-4">
                              <div>
                                  <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Current Password</label>
                                  <input 
                                      type="password" 
                                      value={passwordForm.current}
                                      onChange={(e) => setPasswordForm({...passwordForm, current: e.target.value})}
                                      className="w-full bg-[#0b0e14] border border-gray-800 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-brand-purple transition-colors"
                                  />
                              </div>
                              <div>
                                  <label className="block text-xs font-bold text-gray-500 uppercase mb-2">New Password</label>
                                  <input 
                                      type="password" 
                                      value={passwordForm.new}
                                      onChange={(e) => setPasswordForm({...passwordForm, new: e.target.value})}
                                      className="w-full bg-[#0b0e14] border border-gray-800 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-brand-purple transition-colors"
                                  />
                              </div>
                              <div>
                                  <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Confirm New Password</label>
                                  <input 
                                      type="password" 
                                      value={passwordForm.confirm}
                                      onChange={(e) => setPasswordForm({...passwordForm, confirm: e.target.value})}
                                      className="w-full bg-[#0b0e14] border border-gray-800 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-brand-purple transition-colors"
                                  />
                              </div>
                              <button 
                                  onClick={handleUpdatePassword}
                                  className="w-full py-2 bg-[#0b0e14] text-gray-300 rounded-lg font-bold border border-gray-800 hover:border-gray-600 transition-all text-sm"
                              >
                                  Update Password
                              </button>
                          </div>
                      </div>

                      <div className="bg-[#131720] border border-gray-800 rounded-2xl p-6">
                          <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                              <AlertTriangle className="w-5 h-5 text-red-500" /> Danger Zone
                          </h3>
                          <p className="text-sm text-gray-500 mb-6">Once you delete your account, there is no going back. Please be certain.</p>
                          <button 
                              onClick={() => {
                                  if(confirm('Are you absolutely sure? This will permanently delete your account and all items.')) {
                                      logout();
                                  }
                              }}
                              className="w-full py-3 bg-red-500/10 text-red-500 rounded-xl font-bold hover:bg-red-500 hover:text-white transition-all border border-red-500/20 flex items-center justify-center gap-2"
                          >
                              <Trash2 className="w-5 h-5" /> Delete Account
                          </button>
                      </div>

                      <button 
                          onClick={logout}
                          className="w-full py-4 bg-[#0b0e14] text-gray-400 rounded-2xl font-bold hover:text-white hover:bg-gray-900 transition-all border border-gray-800 flex items-center justify-center gap-2"
                      >
                          <LogOut className="w-5 h-5" /> Sign Out
                      </button>
                  </div>
              </div>
          )}
      </div>
    </div>
  );
};
