import React, { useState, useEffect, useRef } from 'react';
import { useGame } from '../context/GameContext';
import { useSound } from '../context/SoundContext';
import { XP_ICON } from '../constants';
import { getSellBackValue } from '../utils/sellBack';
import { CoinAmount } from './CoinAmount';
import { User, Clock, MapPin, Save, Check, Settings, Shield, Lock, LogOut, AlertTriangle, UserPlus, UserCheck, Users as UsersIcon, Sparkles, Upload, Trash2, ExternalLink, Search, Package } from 'lucide-react';

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
];

type ProfileTab = 'topPulls' | 'inventory' | 'community' | 'settings';

interface ProfileProps {
  initialTab?: ProfileTab;
}

export const Profile: React.FC<ProfileProps> = ({ initialTab = 'topPulls' }) => {
  const { user, users, inventory, boxes, updateAddress, updateUserInfo, updateUserFlags, logout, view, setView, followUser, unfollowUser, sellItem, shipItem } = useGame();
  const { playSound } = useSound();
  
  const [activeTab, setActiveTab] = useState<ProfileTab>(initialTab);
  const [inventoryFilter, setInventoryFilter] = useState<'inventory' | 'processing' | 'shipped'>('inventory');
  const [activePeopleTab, setActivePeopleTab] = useState<'followers' | 'following'>('followers');
  const [communitySearch, setCommunitySearch] = useState('');
  const [topPullsPublic, setTopPullsPublic] = useState(user.topPullsPublic ?? false);
  const [sellOffers, setSellOffers] = useState<Record<string, boolean>>({});
  const [isGeneratingSellOffers, setIsGeneratingSellOffers] = useState<Record<string, boolean>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const sellOfferTimersRef = useRef<Record<string, number>>({});

  const selectedUserId = view.type === 'PROFILE' ? view.userId : undefined;
  const profileUser = selectedUserId ? users.find((u) => u.id === selectedUserId) : user;
  const isOwnProfile = !selectedUserId || selectedUserId === user.id;
  const displayUser = profileUser || user;
  const canViewTopPulls = isOwnProfile || !!displayUser.topPullsPublic;
  
  const viewedFollowerIds = Array.isArray(displayUser.followers) ? displayUser.followers : [];
  const viewedFollowers = users.filter((u) => viewedFollowerIds.includes(u.id));
  const viewedFollowing = users.filter((u) => Array.isArray(u.followers) && u.followers.includes(displayUser.id));
  
  const isFollowing = !!(!isOwnProfile && profileUser && Array.isArray(profileUser.followers) && profileUser.followers.includes(user.id));
  
  const activePeople = activePeopleTab === 'followers' ? viewedFollowers : viewedFollowing;
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
      setTopPullsPublic(user.topPullsPublic ?? false);
      if (user.shippingAddress) {
          setAddressForm(user.shippingAddress);
      }
  }, [user, isOwnProfile]);

  useEffect(() => {
      setActivePeopleTab('followers');
  }, [displayUser.id]);

  useEffect(() => {
      setActiveTab(initialTab);
  }, [initialTab, displayUser.id]);

  useEffect(() => () => {
    Object.values(sellOfferTimersRef.current).forEach((timerId) => window.clearTimeout(timerId));
    sellOfferTimersRef.current = {};
  }, []);

  const normalizeItems = (items: typeof inventory) =>
    (items ?? []).map((item, index) => {
      const fallbackId = item.id ?? `item-${index}`;
      const fallbackInstanceId = `${fallbackId}-${item.obtainedAt ?? 0}-${item.price ?? 0}-${item.name ?? ''}`;
      return {
        ...item,
        instanceId: item.instanceId || fallbackInstanceId,
        status: item.status ?? 'available',
        obtainedAt: item.obtainedAt ?? 0,
        rarity: item.rarity ?? 'common'
      };
    });

  const inventorySource = isOwnProfile ? inventory : displayUser.inventory ?? [];
  const normalizedInventory = normalizeItems(inventorySource).sort((a, b) => b.obtainedAt - a.obtainedAt);

  const dailyBox = boxes.find((box) => box.isDaily);
  const canClaimDaily = !user.lastDailyClaim || (Date.now() - user.lastDailyClaim > 24 * 60 * 60 * 1000);

  const filteredInventory = normalizedInventory.filter((item) => {
    if (inventoryFilter === 'processing') return item.status === 'shipping' || item.status === 'shipping_requested';
    if (inventoryFilter === 'shipped') return item.status === 'shipped';
    return item.status === 'available';
  });

  useEffect(() => {
    setSellOffers((prev) => {
      const next: Record<string, boolean> = {};
      normalizedInventory.forEach((item) => {
        if (prev[item.instanceId]) {
          next[item.instanceId] = true;
        }
      });
      return next;
    });
    setIsGeneratingSellOffers((prev) => {
      const next: Record<string, boolean> = {};
      normalizedInventory.forEach((item) => {
        if (prev[item.instanceId]) {
          next[item.instanceId] = true;
        }
      });
      return next;
    });
    const validIds = new Set(normalizedInventory.map((item) => item.instanceId));
    Object.entries(sellOfferTimersRef.current).forEach(([instanceId, timerId]) => {
      if (!validIds.has(instanceId)) {
        window.clearTimeout(timerId);
        delete sellOfferTimersRef.current[instanceId];
      }
    });
  }, [normalizedInventory]);

  const topPullsSource = isOwnProfile ? user.topPulls : displayUser.topPulls;
  const topPulls = normalizeItems(topPullsSource ?? [])
    .sort((a, b) => {
      const priceDiff = b.price - a.price;
      if (priceDiff !== 0) return priceDiff;
      return b.obtainedAt - a.obtainedAt;
    })
    .slice(0, 6);

  const trimmedSearch = communitySearch.trim().toLowerCase();
  const communitySearchResults = trimmedSearch
    ? users.filter((u) => u.name.toLowerCase().includes(trimmedSearch))
    : [];

  const getSellBackRate = (item: typeof normalizedInventory[number]) => {
    const storedRate = Number(item.sellBackRate);
    if (Number.isFinite(storedRate) && storedRate > 0) {
      return Math.min(1, Math.max(0, storedRate));
    }
    if (item.provenance?.sourceType === 'case_open' && item.provenance?.sourceId) {
      const sourceBox = boxes.find((box) => box.id === item.provenance?.sourceId);
      if (sourceBox?.sellBackRate !== undefined) {
        return Math.min(1, Math.max(0, Number(sourceBox.sellBackRate)));
      }
      if (sourceBox?.isUserCreated) {
        return 0.75;
      }
    }
    return 0.82;
  };

  const handleTopPullsVisibility = async (isPublic: boolean) => {
      setTopPullsPublic(isPublic);
      await updateUserFlags({ topPullsPublic: isPublic });
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
      <div className="bg-[#131720] border border-gray-800 rounded-2xl overflow-hidden mb-8">
        <div className="relative h-36 sm:h-44 md:h-48 bg-gradient-to-r from-[#1d2333] via-[#1a2130] to-[#0b0e14]">
          <div className="absolute inset-0 opacity-60 bg-[radial-gradient(circle_at_top,_rgba(120,87,255,0.45),_transparent_60%)]" />
        </div>

        <div className="px-4 pb-6 sm:px-6 md:px-8">
          <div className="flex flex-col gap-6 -mt-12 sm:-mt-14">
            <div className="flex flex-col lg:flex-row lg:items-end gap-6">
              <div className="flex flex-col sm:flex-row sm:items-end gap-4 w-full">
                <div className="relative group self-center sm:self-auto">
                  <img src={displayUser.avatar} alt={displayUser.name} className="w-28 h-28 sm:w-32 sm:h-32 rounded-2xl border-4 border-[#131720] shadow-2xl object-cover bg-[#0b0e14]" />
                  <div className="absolute -bottom-3 -right-3 bg-blue-600 text-white text-xs font-bold px-3 py-1 rounded-full border-4 border-[#131720]">
                      Lvl {displayUser.level}
                  </div>
                </div>

                <div className="flex-1 text-center sm:text-left">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.3em] text-gray-500">Player profile</p>
                      <h2 className="text-3xl sm:text-4xl font-black text-white mt-2">{displayUser.name}</h2>
                      <div className="flex flex-wrap justify-center sm:justify-start gap-3 text-sm text-gray-400 mt-3">
                        <span className="flex items-center gap-1.5 bg-[#0b0e14] px-3 py-1 rounded-full border border-gray-800">
                          <UsersIcon className="w-4 h-4" /> {viewedFollowerIds.length} Followers
                        </span>
                        <span className="flex items-center gap-1.5 bg-[#0b0e14] px-3 py-1 rounded-full border border-gray-800">
                          <UserPlus className="w-4 h-4" /> {viewedFollowing.length} Following
                        </span>
                        <span className="flex items-center gap-1.5 bg-[#0b0e14] px-3 py-1 rounded-full border border-gray-800">
                          <Clock className="w-4 h-4" /> Joined {new Date(displayUser.joinedAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-center sm:justify-end gap-3">
                      {!isOwnProfile && (
                        <>
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
                        </>
                      )}
                      {isOwnProfile && (
                        <button
                          onClick={() => setActiveTab('settings')}
                          className="flex items-center gap-2 bg-[#0b0e14] text-gray-200 px-4 py-2 rounded-lg font-bold text-sm border border-gray-700 hover:border-brand-purple/60 transition-colors"
                        >
                          <Settings className="w-4 h-4" /> Edit Profile
                        </button>
                      )}
                      {isOwnProfile && (
                        <button
                          onClick={() => setView({ type: 'BOXES' })}
                          className="flex items-center gap-2 bg-brand-purple text-white px-4 py-2 rounded-lg font-bold text-sm hover:bg-purple-600 transition-colors shadow-lg shadow-purple-500/20"
                        >
                          <Sparkles className="w-4 h-4" /> Open Boxes
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full lg:max-w-md">
                <div className="bg-[#0b0e14] p-4 rounded-xl border border-gray-800/50">
                  <div className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-1">Top Pulls</div>
                  <div className="text-xl font-black text-white">
                    {canViewTopPulls ? `${topPulls.length} Items` : 'Private'}
                  </div>
                </div>
                <div className="bg-[#0b0e14] p-4 rounded-xl border border-gray-800/50">
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <div className="text-gray-500 text-xs font-bold uppercase tracking-wider">XP Points</div>
                    <img src={XP_ICON} alt="XP" className="w-5 h-5 object-contain drop-shadow" />
                  </div>
                  <div className="text-xl font-black text-blue-500 flex items-center gap-2">
                    <img src={XP_ICON} alt="XP" className="w-6 h-6 object-contain" />
                    <span>{displayUser.xp.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Main Tabs */}
            <div className="flex flex-wrap md:flex-nowrap items-center gap-2 bg-[#0b0e14] p-1 rounded-xl border border-gray-800 w-full max-w-full overflow-x-auto">
              <button
                onClick={() => setActiveTab('topPulls')}
                className={`flex items-center gap-2 px-5 md:px-6 py-2.5 rounded-lg font-bold text-sm whitespace-nowrap transition-all ${activeTab === 'topPulls' ? 'bg-[#1a2130] text-white shadow-sm' : 'text-gray-500 hover:text-gray-300'}`}
              >
                <Sparkles className="w-4 h-4" /> Top Pulls
              </button>
              {isOwnProfile && (
                <button
                  onClick={() => setActiveTab('inventory')}
                  className={`flex items-center gap-2 px-5 md:px-6 py-2.5 rounded-lg font-bold text-sm whitespace-nowrap transition-all ${activeTab === 'inventory' ? 'bg-[#1a2130] text-white shadow-sm' : 'text-gray-500 hover:text-gray-300'}`}
                >
                  <Package className="w-4 h-4" /> Inventory
                </button>
              )}
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
        </div>
      </div>

      {/* Tab Content */}
      <div className="min-h-[400px]">
          {activeTab === 'topPulls' && (
              <div className="space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-gray-800 pb-4">
                      <div>
                          <h3 className="text-lg font-bold text-white">Top Pulls</h3>
                          <p className="text-sm text-gray-500">Your most valuable items, ranked by rarity and value.</p>
                      </div>
                      {isOwnProfile && (
                          <button 
                            onClick={() => setView({ type: 'BOXES' })}
                            className="inline-flex items-center justify-center px-4 py-2 bg-brand-purple text-white rounded-lg font-bold text-sm hover:bg-purple-600 transition-colors"
                          >
                            Open Boxes
                          </button>
                      )}
                  </div>

                  {!canViewTopPulls ? (
                      <div className="bg-[#131720] border border-gray-800 rounded-2xl p-12 text-center">
                          <Lock className="w-12 h-12 text-gray-700 mx-auto mb-4" />
                          <h3 className="text-xl font-bold text-white mb-2">Top Pulls Are Private</h3>
                          <p className="text-gray-500">This player has chosen to keep their top pulls private.</p>
                      </div>
                  ) : topPulls.length === 0 ? (
                      <div className="bg-[#131720] border border-gray-800 rounded-2xl p-12 text-center">
                          <Sparkles className="w-12 h-12 text-gray-700 mx-auto mb-4" />
                          <h3 className="text-xl font-bold text-white mb-2">No top pulls yet</h3>
                          <p className="text-gray-500 mb-6">
                            {isOwnProfile ? 'Open a few boxes to showcase your top pulls.' : 'Check back once they start opening boxes.'}
                          </p>
                          {isOwnProfile && (
                              <button 
                                onClick={() => setView({ type: 'BOXES' })}
                                className="px-6 py-2 bg-brand-purple text-white rounded-lg font-bold hover:bg-purple-600 transition-colors"
                              >
                                Browse Boxes
                              </button>
                          )}
                      </div>
                  ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                          {topPulls.map((item, index) => (
                              <div key={item.instanceId} className="bg-[#131720] border border-gray-800 rounded-xl p-3 sm:p-4 group hover:border-brand-purple/50 transition-all">
                                  <div className="relative aspect-square mb-3 sm:mb-4 bg-[#0b0e14] rounded-lg p-3 sm:p-4 flex items-center justify-center overflow-hidden">
                                      <div className="absolute left-2 top-2 z-10 px-2 py-0.5 rounded-full text-[10px] font-black tracking-wide bg-black/70 text-white border border-white/10">
                                        #{index + 1}
                                      </div>
                                      <img src={item.image} alt={item.name} className="w-full h-full object-contain group-hover:scale-110 transition-transform duration-500" />
                                      <div className={`absolute inset-0 opacity-15 bg-gradient-to-br ${
                                          item.rarity === 'legendary' ? 'from-yellow-500' :
                                          item.rarity === 'epic' ? 'from-purple-500' :
                                          item.rarity === 'rare' ? 'from-blue-500' :
                                          item.rarity === 'uncommon' ? 'from-emerald-500' :
                                          'from-gray-500'
                                      }`} />
                                  </div>
                                  <div className="text-[11px] font-bold text-gray-500 uppercase mb-1 tracking-wider">{item.rarity}</div>
                                  <h4 className="text-white font-bold text-sm mb-2 line-clamp-1">{item.name}</h4>
                                  <CoinAmount
                                    amount={item.price}
                                    formatOptions={{ maximumFractionDigits: 0 }}
                                    className="text-green-500 font-black"
                                    iconClassName="w-3.5 h-3.5"
                                  />
                              </div>
                          ))}
                      </div>
                  )}
              </div>
          )}

          {activeTab === 'inventory' && isOwnProfile && (
              <div className="space-y-6">
                  {dailyBox && canClaimDaily && (
                      <div className="bg-gradient-to-br from-[#1a2130] to-[#131720] border border-yellow-500/30 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                          <div>
                              <div className="text-xs font-bold uppercase tracking-[0.2em] text-yellow-400/80 mb-1">Daily Free Case Available</div>
                              <h4 className="text-lg font-bold text-white">Open your daily case</h4>
                          </div>
                          <button
                              onClick={() => setView({ type: 'CASE_OPENING', boxId: dailyBox.id, isFree: true })}
                              className="w-full sm:w-auto px-5 py-2.5 rounded-lg bg-yellow-500 text-black font-bold text-sm hover:bg-yellow-400 transition-colors"
                          >
                              Open Daily Case
                          </button>
                      </div>
                  )}
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-gray-800 pb-4">
                      <div>
                          <h3 className="text-lg font-bold text-white">Inventory</h3>
                          <p className="text-sm text-gray-500">Manage your items, ship rewards, or sell them back for coins.</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                          {(['inventory', 'processing', 'shipped'] as const).map((filter) => (
                              <button
                                  key={filter}
                                  onClick={() => setInventoryFilter(filter)}
                                  className={`px-4 py-2 rounded-lg text-xs font-bold uppercase transition-colors ${
                                      inventoryFilter === filter
                                          ? 'bg-brand-purple text-white'
                                          : 'bg-[#0b0e14] text-gray-400 hover:text-white hover:bg-gray-800'
                                  }`}
                              >
                                  {filter === 'inventory' ? 'Inventory' : filter === 'processing' ? 'Processing' : 'Shipped'}
                              </button>
                          ))}
                      </div>
                  </div>

                  {filteredInventory.length === 0 ? (
                      <div className="bg-[#131720] border border-gray-800 rounded-2xl p-12 text-center">
                          <Package className="w-12 h-12 text-gray-700 mx-auto mb-4" />
                          <h3 className="text-xl font-bold text-white mb-2">
                              {inventoryFilter === 'inventory'
                                  ? 'Your inventory is empty'
                                  : inventoryFilter === 'processing'
                                    ? 'No items are processing'
                                    : 'No items have shipped yet'}
                          </h3>
                          <p className="text-gray-500 mb-6">
                              {inventoryFilter === 'inventory'
                                  ? 'Open cases to collect items you can ship or sell back.'
                                  : inventoryFilter === 'processing'
                                    ? 'Ship an item to start tracking its progress here.'
                                    : 'Once items are shipped, tracking details will appear here.'}
                          </p>
                          <button 
                            onClick={() => setView({ type: 'BOXES' })}
                            className="px-6 py-2 bg-brand-purple text-white rounded-lg font-bold hover:bg-purple-600 transition-colors"
                          >
                            Browse Boxes
                          </button>
                      </div>
                  ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                          {filteredInventory.map((item) => {
                              const isAvailable = item.status === 'available';
                              const isLocked = !!item.locked;
                              const canShip = isAvailable && !isLocked && !!user.shippingAddress;
                              const canSell = isAvailable && !isLocked && item.redeemable !== false;
                              const statusLabel = item.status === 'shipping' || item.status === 'shipping_requested'
                                ? 'Shipping'
                                : item.status === 'shipped'
                                  ? 'Shipped'
                                  : isLocked
                                    ? 'Locked'
                                    : 'Available';
                              const statusTone = item.status === 'shipping' || item.status === 'shipping_requested'
                                ? 'bg-blue-500/20 text-blue-300 border-blue-500/40'
                                : item.status === 'shipped'
                                  ? 'bg-green-500/20 text-green-300 border-green-500/40'
                                  : isLocked
                                    ? 'bg-red-500/20 text-red-300 border-red-500/40'
                                    : 'bg-gray-700/40 text-gray-300 border-gray-600';

                              return (
                                  <div key={item.instanceId} className="bg-[#131720] border border-gray-800 rounded-xl p-4 group hover:border-brand-purple/50 transition-all flex flex-col">
                                      <div className="relative aspect-square mb-4 bg-[#0b0e14] rounded-lg p-4 flex items-center justify-center overflow-hidden">
                                          <img src={item.image} alt={item.name} className="w-full h-full object-contain group-hover:scale-110 transition-transform duration-500" />
                                          <div className={`absolute inset-0 opacity-10 bg-gradient-to-br ${
                                              item.rarity === 'legendary' ? 'from-yellow-500' :
                                              item.rarity === 'epic' ? 'from-purple-500' :
                                              item.rarity === 'rare' ? 'from-blue-500' : 'from-gray-500'
                                          }`} />
                                      </div>
                                      <div className="flex items-start justify-between gap-2">
                                          <div className="text-xs font-bold text-gray-500 uppercase tracking-wider">{item.rarity}</div>
                                          <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${statusTone}`}>{statusLabel}</span>
                                      </div>
                                      {item.redeemable === false && (
                                        <div className="mt-2 text-[10px] font-semibold uppercase tracking-wide text-amber-300">
                                          Not redeemable
                                        </div>
                                      )}
                                      <h4 className="text-white font-bold text-sm mt-2 mb-2 line-clamp-2 min-h-[2.5rem]">{item.name}</h4>
                                      <CoinAmount
                                        amount={item.price}
                                        formatOptions={{ maximumFractionDigits: 0 }}
                                        className="text-green-500 font-black"
                                        iconClassName="w-3.5 h-3.5"
                                      />
                                      <div className="text-[11px] text-gray-500 mt-2">
                                        Obtained {new Date(item.obtainedAt).toLocaleDateString()}
                                      </div>
                                      {inventoryFilter === 'shipped' && item.trackingNumber && (
                                          <div className="text-[11px] text-blue-300 mt-2 break-words">
                                              Tracking: {item.trackingNumber}
                                          </div>
                                      )}

                                      <div className="mt-4 flex flex-col gap-2">
                                          <button
                                            onClick={() => shipItem(item.instanceId)}
                                            disabled={!canShip}
                                            className={`w-full px-3 py-2 rounded-lg font-bold text-xs transition-colors border ${
                                              canShip
                                                ? 'bg-blue-600/20 text-blue-200 border-blue-500/40 hover:bg-blue-600/30'
                                                : 'bg-[#0b0e14] text-gray-500 border-gray-800 cursor-not-allowed'
                                            }`}
                                          >
                                            Ship item
                                          </button>
                                          {inventoryFilter === 'inventory' && (
                                              <button
                                                onClick={() => {
                                                  if (!canSell || isGeneratingSellOffers[item.instanceId]) return;
                                                  if (!sellOffers[item.instanceId]) {
                                                    setIsGeneratingSellOffers((prev) => ({ ...prev, [item.instanceId]: true }));
                                                    const timerId = window.setTimeout(() => {
                                                      setSellOffers((prev) => ({ ...prev, [item.instanceId]: true }));
                                                      setIsGeneratingSellOffers((prev) => ({ ...prev, [item.instanceId]: false }));
                                                      delete sellOfferTimersRef.current[item.instanceId];
                                                    }, 900);
                                                    sellOfferTimersRef.current[item.instanceId] = timerId;
                                                    return;
                                                  }
                                                  sellItem(item.instanceId);
                                                  if (sellOfferTimersRef.current[item.instanceId]) {
                                                    window.clearTimeout(sellOfferTimersRef.current[item.instanceId]);
                                                    delete sellOfferTimersRef.current[item.instanceId];
                                                  }
                                                  setSellOffers((prev) => ({ ...prev, [item.instanceId]: false }));
                                                  setIsGeneratingSellOffers((prev) => ({ ...prev, [item.instanceId]: false }));
                                                }}
                                                disabled={!canSell || !!isGeneratingSellOffers[item.instanceId]}
                                                className={`w-full px-3 py-2 rounded-lg font-bold text-xs transition-colors border flex items-center justify-center gap-2 disabled:cursor-not-allowed disabled:opacity-80 ${
                                                  canSell
                                                    ? 'bg-[#0b0e14] text-gray-200 border-gray-700 hover:border-brand-purple/60'
                                                    : 'bg-[#0b0e14] text-gray-500 border-gray-800 cursor-not-allowed'
                                                }`}
                                              >
                                                <span className="flex flex-col items-center gap-1 text-center">
                                                  <span className="flex items-center justify-center gap-2 uppercase tracking-wide text-[10px]">
                                                    {isGeneratingSellOffers[item.instanceId] && (
                                                      <span className="h-3 w-3 animate-spin rounded-full border border-gray-400/60 border-t-transparent" aria-hidden="true" />
                                                    )}
                                                    {isGeneratingSellOffers[item.instanceId]
                                                      ? 'Generating offer...'
                                                      : sellOffers[item.instanceId]
                                                        ? 'Accept buy back offer'
                                                        : item.redeemable === false
                                                          ? 'Not redeemable'
                                                          : 'Generate buy back offer'}
                                                  </span>
                                                  {sellOffers[item.instanceId] && !isGeneratingSellOffers[item.instanceId] && item.redeemable !== false && (
                                                    <CoinAmount
                                                      amount={getSellBackValue(item.price, getSellBackRate(item))}
                                                      formatOptions={{ maximumFractionDigits: 0 }}
                                                      className="text-gray-100"
                                                      iconClassName="w-3 h-3"
                                                    />
                                                  )}
                                                </span>
                                              </button>
                                          )}
                                          {inventoryFilter === 'shipped' && (
                                              <button
                                                onClick={() => {
                                                  if (item.trackingNumber) {
                                                    window.open(
                                                      `https://track.aftership.com/${encodeURIComponent(item.trackingNumber)}`,
                                                      '_blank',
                                                      'noopener,noreferrer'
                                                    );
                                                  }
                                                }}
                                                disabled={!item.trackingNumber}
                                                className={`w-full px-3 py-2 rounded-lg font-bold text-xs transition-colors border ${
                                                  item.trackingNumber
                                                    ? 'bg-[#0b0e14] text-gray-200 border-gray-700 hover:border-brand-purple/60'
                                                    : 'bg-[#0b0e14] text-gray-500 border-gray-800 cursor-not-allowed'
                                                }`}
                                              >
                                                Track package
                                              </button>
                                          )}
                                      </div>

                                      {!user.shippingAddress && (
                                          <div className="text-[11px] text-amber-400 mt-2">
                                              Add a shipping address in Settings to enable shipping.
                                          </div>
                                      )}
                                  </div>
                              );
                          })}
                      </div>
                  )}
              </div>
          )}

          {activeTab === 'community' && (
              <div className="bg-[#131720] border border-gray-800 rounded-2xl overflow-hidden">
                  <div className="p-4 border-b border-gray-800">
                      <label className="text-xs font-bold uppercase tracking-wider text-gray-500">Search players</label>
                      <div className="mt-2 flex items-center gap-3 bg-[#0b0e14] border border-gray-800 rounded-xl px-3 py-2">
                          <Search className="w-4 h-4 text-gray-500" />
                          <input 
                            type="text"
                            value={communitySearch}
                            onChange={(e) => setCommunitySearch(e.target.value)}
                            placeholder="Search by username"
                            className="w-full bg-transparent text-sm text-white focus:outline-none"
                          />
                      </div>
                  </div>

                  {trimmedSearch && (
                      <div className="p-6 border-b border-gray-800">
                          <div className="flex items-center justify-between mb-4">
                              <h4 className="text-sm font-bold text-white">Search Results</h4>
                              <span className="text-xs text-gray-500">{communitySearchResults.length} matches</span>
                          </div>
                          {communitySearchResults.length === 0 ? (
                              <div className="py-6 text-center text-gray-500 text-sm">
                                  No players found for that search.
                              </div>
                          ) : (
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  {communitySearchResults.map((p) => (
                                      <div key={p.id} className="flex items-center justify-between p-4 bg-[#0b0e14] rounded-xl border border-gray-800 hover:border-gray-700 transition-colors">
                                          <div 
                                            className="flex items-center gap-4 cursor-pointer"
                                            onClick={() => setView({ type: 'PROFILE', userId: p.id })}
                                          >
                                              <img src={p.avatar} alt={p.name} className="w-12 h-12 rounded-lg object-cover bg-gray-800" />
                                              <div>
                                                  <div className="text-white font-bold">{p.name}</div>
                                                  <div className="text-xs text-gray-500">Level {p.level}</div>
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
                  )}

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
                                              <div className="text-xs text-gray-500">Level {p.level}</div>
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
                              <Lock className="w-5 h-5 text-brand-purple" /> Privacy
                          </h3>

                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                              <div>
                                  <p className="text-sm font-bold text-white">Show top pulls publicly</p>
                                  <p className="text-xs text-gray-500">When enabled, anyone viewing your profile can see your top pulls.</p>
                              </div>
                              <button
                                  type="button"
                                  onClick={() => handleTopPullsVisibility(!topPullsPublic)}
                                  className={`relative inline-flex h-10 w-20 items-center rounded-full border transition-colors ${
                                    topPullsPublic ? 'bg-brand-purple/30 border-brand-purple' : 'bg-[#0b0e14] border-gray-700'
                                  }`}
                              >
                                  <span
                                      className={`inline-flex h-8 w-8 items-center justify-center rounded-full bg-white text-xs font-bold transition-transform ${
                                        topPullsPublic ? 'translate-x-10 text-brand-purple' : 'translate-x-1 text-gray-600'
                                      }`}
                                  >
                                      {topPullsPublic ? 'On' : 'Off'}
                                  </span>
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
