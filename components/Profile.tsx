import React, { useState, useEffect, useRef } from 'react';
import { useGame } from '../context/GameContext';
import { useSound } from '../context/SoundContext';
import { User, Package, Wallet, Clock, History, MapPin, Truck, Save, Check, Settings, Shield, Lock, LogOut, Mail, AlertTriangle, UserPlus, UserCheck, Users as UsersIcon, Sparkles, Upload, Image as ImageIcon } from 'lucide-react';

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

  const availableItems = inventory.filter(item => item.status === 'available');
  const shippedItems = inventory.filter(item => item.status === 'shipping' || item.status === 'shipped');
  const displayInventory = inventorySubTab === 'available' ? availableItems : shippedItems;

  const totalInventoryValue = isOwnProfile 
    ? availableItems.reduce((sum, item) => sum + item.price, 0)
    : 0;

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
                    <h2 className="text-3xl font-black text-white mb-2">{displayUser.name}</h2>
                    {!isOwnProfile && (
                        <div className="flex items-center gap-3 justify-center md:justify-end">
                            {isFollowing ? (
                                <button 
                                    onClick={handleUnfollowClick}
                                    className="flex items-center gap-2 bg-[#0b0e14] text-gray-200 px-4 py-2 rounded-lg font-bold text-sm border border-gray-700 hover:border-red-500 hover:text-white transition-colors"
                                >
                                    <UserCheck className="w