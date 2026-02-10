import React, { useEffect, useMemo, useState } from 'react';
import { Calendar, ClipboardList, Copy, Gift, Search, ShieldCheck, TrendingUp, X } from 'lucide-react';
import { collection, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { useGame } from '../context/GameContext';
import { useSound } from '../context/SoundContext';
import { db } from '../firebase';
import { XP_ICON } from '../constants';
import { Input } from './ui/Input';
import { OfferwallModal } from './OfferwallModal';

type XpShopItem = {
  id: string;
  title: string;
  description?: string;
  imageUrl?: string;
  xpCost: number;
  stock?: number | null;
  limitPerUser?: number | null;
  category?: string;
  fulfillmentType: 'DIGITAL' | 'COUPON' | 'PHYSICAL_SHIP' | 'XP_CASE_ENTRY';
  enabled: boolean;
  sortOrder?: number;
};

export const Bonuses: React.FC = () => {
  const {
    user,
    users,
    addBalance,
    claimDaily,
    claimRakeback,
    boxes,
    setView,
    isAuthenticated,
    openAuthModal,
    updateUserFlags,
    generateAffiliateCode
  } = useGame();
  const { playSound } = useSound();

  const [activeTab, setActiveTab] = useState<'bonuses' | 'xp-shop'>('bonuses');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [shopItems, setShopItems] = useState<XpShopItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<XpShopItem | null>(null);
  const [isRedeeming, setIsRedeeming] = useState(false);

  const [affiliateInput, setAffiliateInput] = useState('');
  const [affiliateMessage, setAffiliateMessage] = useState('');
  const [isGeneratingCode, setIsGeneratingCode] = useState(false);
  const [isClaimingDaily, setIsClaimingDaily] = useState(false);
  const [isApplyingAffiliate, setIsApplyingAffiliate] = useState(false);
  const [isClaimingRakeback, setIsClaimingRakeback] = useState(false);
  const [isOfferwallOpen, setIsOfferwallOpen] = useState(false);
  const [nextClaimCountdown, setNextClaimCountdown] = useState('');

  const dailyBox = boxes.find((b) => b.isDaily);
  const xpBalance = Math.floor(user.xpBalance ?? user.xp ?? 0);
  const availableRakeback = Number(user.rakebackBalance ?? 0);
  const hasReferral = Boolean(user.referredBy);

  const lastDailyClaim = Number.isFinite(user.lastDailyClaim ?? NaN) ? Number(user.lastDailyClaim) : 0;
  const dailyCooldownMs = 24 * 60 * 60 * 1000;
  const nextDailyClaimAt = lastDailyClaim + dailyCooldownMs;
  const canClaim = !lastDailyClaim || nextDailyClaimAt <= Date.now();

  useEffect(() => {
    const itemsQuery = query(collection(db, 'xpShopItems'), where('enabled', '==', true), orderBy('sortOrder', 'asc'));
    const unsub = onSnapshot(itemsQuery, (snapshot) => {
      const items = snapshot.docs.map((docSnap) => {
        const data = docSnap.data() as Record<string, unknown>;
        return {
          id: docSnap.id,
          title: String(data.title ?? 'XP Reward'),
          description: String(data.description ?? ''),
          imageUrl: typeof data.imageUrl === 'string' ? data.imageUrl : '',
          xpCost: Math.max(0, Number(data.xpCost ?? 0)),
          stock: data.stock == null ? null : Number(data.stock),
          limitPerUser: data.limitPerUser == null ? null : Number(data.limitPerUser),
          category: typeof data.category === 'string' ? data.category : 'General',
          fulfillmentType: (data.fulfillmentType as XpShopItem['fulfillmentType']) ?? 'DIGITAL',
          enabled: data.enabled !== false,
          sortOrder: Number(data.sortOrder ?? 0)
        } satisfies XpShopItem;
      });
      setShopItems(items);
    });

    return () => unsub();
  }, []);

  useEffect(() => {
    if (canClaim) {
      setNextClaimCountdown('');
      return;
    }
    const interval = window.setInterval(() => {
      const remainingMs = Math.max(0, nextDailyClaimAt - Date.now());
      const totalSeconds = Math.floor(remainingMs / 1000);
      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = totalSeconds % 60;
      setNextClaimCountdown(`${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`);
    }, 1000);

    return () => window.clearInterval(interval);
  }, [canClaim, nextDailyClaimAt]);

  const categories = useMemo(() => ['All', ...new Set(shopItems.map((item) => item.category || 'General'))], [shopItems]);
  const filteredShopItems = useMemo(() => {
    return shopItems.filter((item) => {
      const byCategory = category === 'All' || item.category === category;
      const bySearch = !search.trim() || item.title.toLowerCase().includes(search.toLowerCase()) || item.description?.toLowerCase().includes(search.toLowerCase());
      return byCategory && bySearch;
    });
  }, [category, search, shopItems]);

  const redeem = async () => {
    if (!selectedItem || isRedeeming) return;
    if (!isAuthenticated) {
      openAuthModal('login');
      return;
    }

    setIsRedeeming(true);
    try {
      const token = await (await import('firebase/auth')).getAuth().currentUser?.getIdToken();
      const response = await fetch('/api/xp/redeem', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ itemId: selectedItem.id, redemptionRequestId: crypto.randomUUID() })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || 'Unable to redeem reward');
      alert(data?.message || 'Reward redeemed successfully.');
      setSelectedItem(null);
    } catch (error) {
      alert((error as Error).message || 'Unable to redeem reward.');
    } finally {
      setIsRedeeming(false);
    }
  };

  const handleClaimDaily = () => {
    if (!isAuthenticated) return openAuthModal('login');
    if (!canClaim) return playSound('error');

    setIsClaimingDaily(true);
    playSound('success');
    if (dailyBox) {
      setView({ type: 'CASE_OPENING', boxId: dailyBox.id, isFree: true });
    } else {
      addBalance(100);
      claimDaily();
      setIsClaimingDaily(false);
    }
  };

  const handleApplyAffiliateCode = async () => {
    if (!isAuthenticated) return openAuthModal('login');
    if (hasReferral) return setAffiliateMessage('You are already linked to an affiliate.');

    const formattedCode = affiliateInput.trim().toUpperCase();
    if (!formattedCode) return setAffiliateMessage('Please enter a valid affiliate code.');
    if (user.affiliateCode && formattedCode === user.affiliateCode.toUpperCase()) return setAffiliateMessage('You cannot use your own affiliate code.');

    const affiliateOwner = users.find((u) => u.affiliateCode?.toUpperCase() === formattedCode);
    if (!affiliateOwner) return setAffiliateMessage('Affiliate code not found.');

    setIsApplyingAffiliate(true);
    try {
      await updateUserFlags({ referredBy: formattedCode });
      setAffiliateMessage('Affiliate linked successfully!');
      setAffiliateInput('');
    } finally {
      setIsApplyingAffiliate(false);
    }
  };

  return (
    <>
      <div className="max-w-7xl mx-auto p-4 md:p-6">
        <div className="rounded-2xl border border-blue-800 bg-gradient-to-r from-blue-900 to-brand-bg p-6 md:p-8 mb-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-black text-white uppercase tracking-wide">VIP Club & Rewards</h1>
              <p className="text-blue-200">XP Points are redeemable currency.</p>
            </div>
            <div className="bg-[#0b0e14]/80 border border-blue-700 rounded-xl px-4 py-3 flex items-center gap-2">
              <img src={XP_ICON} alt="XP" className="w-5 h-5" />
              <span className="text-xs text-blue-300 uppercase">XP Balance</span>
              <span className="text-xl font-black text-white">{xpBalance.toLocaleString()}</span>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            <button onClick={() => setActiveTab('bonuses')} className={`px-4 py-2 rounded-lg text-sm font-bold ${activeTab === 'bonuses' ? 'bg-blue-500 text-black' : 'bg-[#0b0e14] border border-gray-700 text-gray-300'}`}>Bonuses</button>
            <button onClick={() => setActiveTab('xp-shop')} className={`px-4 py-2 rounded-lg text-sm font-bold ${activeTab === 'xp-shop' ? 'bg-blue-500 text-black' : 'bg-[#0b0e14] border border-gray-700 text-gray-300'}`}>XP Shop</button>
          </div>
        </div>

        {activeTab === 'xp-shop' ? (
          <div className="space-y-4">
            <div className="bg-[#131720] border border-gray-800 rounded-xl p-4 flex flex-col md:flex-row gap-3 md:items-center">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search rewards" className="pl-9" />
              </div>
              <div className="flex flex-wrap gap-2">
                {categories.map((chip) => (
                  <button key={chip} onClick={() => setCategory(chip)} className={`px-3 py-1.5 rounded-full text-xs font-bold border ${chip === category ? 'bg-blue-500/20 border-blue-500 text-blue-300' : 'bg-[#0b0e14] border-gray-700 text-gray-400'}`}>{chip}</button>
                ))}
              </div>
            </div>

            {filteredShopItems.length === 0 ? (
              <div className="bg-[#131720] border border-gray-800 rounded-xl p-8 text-center text-gray-400">No rewards available right now.</div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {filteredShopItems.map((item) => {
                  const hasStock = item.stock == null || item.stock > 0;
                  const canAfford = xpBalance >= item.xpCost;
                  const needMore = Math.max(0, item.xpCost - xpBalance);
                  return (
                    <div key={item.id} className="bg-[#131720] border border-gray-800 rounded-xl p-4 flex flex-col">
                      {item.imageUrl ? <img src={item.imageUrl} alt={item.title} className="w-full h-32 rounded-lg object-cover mb-3" /> : <div className="w-full h-32 rounded-lg bg-[#0b0e14] border border-gray-800 mb-3" />}
                      <h3 className="text-white font-bold">{item.title}</h3>
                      <p className="text-sm text-gray-400 mt-1 line-clamp-2 min-h-[40px]">{item.description || 'Exclusive XP reward.'}</p>
                      <div className="mt-3 flex items-center justify-between">
                        <span className="text-xs font-bold bg-blue-500/20 text-blue-300 px-2 py-1 rounded">{item.xpCost.toLocaleString()} XP</span>
                        {item.stock != null ? <span className="text-xs text-gray-500">{Math.max(0, item.stock)} left</span> : <span className="text-xs text-gray-500">Unlimited</span>}
                      </div>
                      <button disabled={!hasStock || !canAfford} onClick={() => setSelectedItem(item)} className={`mt-4 w-full py-2 rounded-lg font-bold text-sm ${hasStock && canAfford ? 'bg-green-500 text-black hover:bg-green-400' : 'bg-gray-800 text-gray-500 cursor-not-allowed'}`}>
                        {hasStock ? (canAfford ? 'Redeem' : `Need ${needMore} more XP`) : 'Out of stock'}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="bg-[#131720] border border-gray-800 rounded-xl p-4">
              <h3 className="font-bold text-white mb-2 flex items-center gap-2"><Calendar className="w-4 h-4 text-yellow-500" /> Daily Free Case</h3>
              <button onClick={handleClaimDaily} disabled={!canClaim || isClaimingDaily} className={`w-full py-2 rounded-lg font-bold ${canClaim ? 'bg-yellow-500 text-black' : 'bg-gray-800 text-gray-500'}`}>{canClaim ? 'Claim Free Spin' : `Next in ${nextClaimCountdown || '00:00:00'}`}</button>
            </div>
            <div className="bg-[#131720] border border-gray-800 rounded-xl p-4">
              <h3 className="font-bold text-white mb-2 flex items-center gap-2"><Gift className="w-4 h-4 text-brand-purple" /> Affiliate Code</h3>
              <div className="flex gap-2"><Input value={affiliateInput} onChange={(e) => setAffiliateInput(e.target.value)} placeholder="Enter code" /><button onClick={handleApplyAffiliateCode} disabled={hasReferral || isApplyingAffiliate} className="px-3 py-2 rounded-lg bg-brand-purple text-white font-bold">Apply</button></div>
              {!!affiliateMessage && <p className="text-xs mt-2 text-gray-400">{affiliateMessage}</p>}
            </div>
            <div className="bg-[#131720] border border-gray-800 rounded-xl p-4">
              <h3 className="font-bold text-white mb-2 flex items-center gap-2"><TrendingUp className="w-4 h-4 text-green-400" /> Rakeback</h3>
              <p className="text-sm text-gray-400 mb-2">Available: {availableRakeback.toLocaleString()} coins</p>
              <button onClick={async () => { setIsClaimingRakeback(true); try { await claimRakeback(); } finally { setIsClaimingRakeback(false);} }} disabled={availableRakeback <= 0 || isClaimingRakeback} className="w-full py-2 rounded-lg bg-green-500 text-black font-bold disabled:bg-gray-800 disabled:text-gray-500">Collect Rakeback</button>
            </div>
          </div>
        )}
      </div>

      {selectedItem && (
        <div className="fixed inset-0 z-50 bg-black/70 p-4 flex items-center justify-center">
          <div className="w-full max-w-md bg-[#131720] border border-gray-800 rounded-xl p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold text-white">Confirm Redemption</h3>
                <p className="text-sm text-gray-400">{selectedItem.title}</p>
              </div>
              <button onClick={() => setSelectedItem(null)} className="text-gray-500 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <div className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">Cost</span><span className="text-white font-bold">{selectedItem.xpCost.toLocaleString()} XP</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Your balance</span><span className="text-white font-bold">{xpBalance.toLocaleString()} XP</span></div>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-2">
              <button onClick={() => setSelectedItem(null)} className="py-2 rounded-lg bg-[#0b0e14] border border-gray-700 text-gray-300 font-bold">Cancel</button>
              <button onClick={redeem} disabled={isRedeeming || xpBalance < selectedItem.xpCost} className="py-2 rounded-lg bg-green-500 hover:bg-green-400 text-black font-bold disabled:bg-gray-800 disabled:text-gray-500">{isRedeeming ? 'Redeeming...' : 'Confirm'}</button>
            </div>
          </div>
        </div>
      )}

      <OfferwallModal open={isOfferwallOpen} onClose={() => setIsOfferwallOpen(false)} onRequireAuth={() => openAuthModal('login')} />
    </>
  );
};
