import React, { useEffect, useMemo, useState } from 'react';
import { Calendar, ClipboardList, Copy, Gift, Search, ShieldCheck, TrendingUp, X } from 'lucide-react';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
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
  fulfillmentType: 'DIGITAL' | 'COUPON' | 'PHYSICAL_SHIP' | 'XP_BOX' | 'XP_CASE_ENTRY';
  metadata?: {
    caseId?: string;
    xpPriceOverride?: number;
    unlockRakeback?: boolean;
    rakebackPercent?: number;
    rakebackTier?: string | null;
  };
  resolvedCaseName?: string;
  resolvedBoxOpenXp?: number | null;
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
    generateAffiliateCode,
    bonusSettings
  } = useGame();
  const { playSound } = useSound();

  const [activeTab, setActiveTab] = useState<'bonuses' | 'xp-shop'>('bonuses');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [shopItems, setShopItems] = useState<XpShopItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<XpShopItem | null>(null);
  const [isRedeeming, setIsRedeeming] = useState(false);
  const [lastRedeemedCaseId, setLastRedeemedCaseId] = useState<string | null>(null);

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
  const rakebackUnlocked = user.rakebackUnlocked === true || Number(user.level ?? 0) >= Number(bonusSettings.rakebackUnlockLevel ?? 0);
  const activeRakebackPercent = user.rakebackPercent != null ? Number(user.rakebackPercent) : Number(bonusSettings.rakebackBasePercent ?? 0);

  const lastDailyClaim = Number.isFinite(user.lastDailyClaim ?? NaN) ? Number(user.lastDailyClaim) : 0;
  const dailyCooldownMs = 24 * 60 * 60 * 1000;
  const nextDailyClaimAt = lastDailyClaim + dailyCooldownMs;
  const canClaim = !lastDailyClaim || nextDailyClaimAt <= Date.now();

  useEffect(() => {
    const parseItem = (docSnap: { id: string; data: () => Record<string, unknown> }): XpShopItem => {
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
        fulfillmentType: ((typeof data.fulfillmentType === 'string' ? data.fulfillmentType : 'DIGITAL') as XpShopItem['fulfillmentType']),
        metadata: {
          caseId:
            typeof data?.metadata?.caseId === 'string'
              ? data.metadata.caseId
              : typeof data?.metadata?.boxId === 'string'
                ? data.metadata.boxId
                : typeof data.caseId === 'string'
                  ? data.caseId
                  : typeof data.boxId === 'string'
                    ? data.boxId
                    : undefined,
          xpPriceOverride:
            data?.metadata?.xpPriceOverride != null
              ? Math.max(0, Math.floor(Number(data.metadata.xpPriceOverride)))
              : data?.xpPriceOverride != null
                ? Math.max(0, Math.floor(Number(data.xpPriceOverride)))
                : undefined,
          unlockRakeback: data?.metadata?.unlockRakeback === true,
          rakebackPercent:
            data?.metadata?.rakebackPercent != null
              ? Math.max(0, Number(data.metadata.rakebackPercent))
              : undefined,
          rakebackTier: data?.metadata?.rakebackTier == null ? null : String(data.metadata.rakebackTier)
        },
        enabled: data.enabled !== false,
        sortOrder: Number(data.sortOrder ?? 0)
      } satisfies XpShopItem;
    };

    const applySnapshot = (snapshot: { docs: Array<{ id: string; data: () => Record<string, unknown> }> }) => {
      const items = snapshot.docs
        .map(parseItem)
        .filter((item) => item.enabled)
        .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
      setShopItems(items);
    };

    const indexedQuery = query(collection(db, 'xpShopItems'), orderBy('sortOrder', 'asc'));
    let fallbackUnsub: (() => void) | null = null;

    const unsub = onSnapshot(
      indexedQuery,
      (snapshot) => applySnapshot(snapshot),
      (error) => {
        console.warn('Primary XP shop query failed, falling back to unsorted listener.', error);
        fallbackUnsub?.();
        fallbackUnsub = onSnapshot(collection(db, 'xpShopItems'), (snapshot) => applySnapshot(snapshot));
      }
    );

    return () => {
      unsub();
      fallbackUnsub?.();
    };
  }, []);

  useEffect(() => {
    if (canClaim) {
      setNextClaimCountdown('');
      return;
    }

    const update = () => {
      const remainingMs = Math.max(0, nextDailyClaimAt - Date.now());
      const totalSeconds = Math.floor(remainingMs / 1000);
      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = totalSeconds % 60;
      setNextClaimCountdown(`${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`);
    };

    update();
    const interval = window.setInterval(update, 1000);
    return () => window.clearInterval(interval);
  }, [canClaim, nextDailyClaimAt]);

  const xpBoxById = useMemo(() => {
    const map = new Map<string, { name: string; priceXP: number }>();
    boxes.forEach((box) => {
      if (!(box.currencyType === 'XP' || Number(box.priceXP ?? 0) > 0)) return;
      map.set(box.id, { name: box.name, priceXP: Math.max(0, Math.floor(Number(box.priceXP ?? 0))) });
    });
    return map;
  }, [boxes]);

  const xpMysteryBoxes = useMemo(
    () =>
      boxes
        .filter((box) => !box.isDaily && (box.currencyType === 'XP' || Number(box.priceXP ?? 0) > 0))
        .sort((a, b) => Number(a.priceXP ?? 0) - Number(b.priceXP ?? 0)),
    [boxes]
  );

  const categories = useMemo(() => ['All', ...new Set(shopItems.map((item) => item.category || 'General'))], [shopItems]);
  const filteredShopItems = useMemo(
    () =>
      shopItems.filter((item) => {
        const byCategory = category === 'All' || item.category === category;
        const bySearch =
          !search.trim() ||
          item.title.toLowerCase().includes(search.toLowerCase()) ||
          item.description?.toLowerCase().includes(search.toLowerCase());
        return byCategory && bySearch;
      }),
    [category, search, shopItems]
  );

  const displayShopItems = useMemo(
    () =>
      filteredShopItems
        .map((item) => {
          if (item.fulfillmentType !== 'XP_BOX' && item.fulfillmentType !== 'XP_CASE_ENTRY') return item;
          const linkedBox = item.metadata?.caseId ? xpBoxById.get(item.metadata.caseId) : null;
          if (!linkedBox) return null;
          const resolvedBoxOpenXp = item.metadata?.xpPriceOverride ?? linkedBox.priceXP ?? null;
          return {
            ...item,
            resolvedCaseName: linkedBox.name,
            resolvedBoxOpenXp
          };
        })
        .filter((item): item is XpShopItem => Boolean(item)),
    [filteredShopItems, xpBoxById]
  );

  const redeem = async () => {
    if (!selectedItem || isRedeeming) return;
    if (!isAuthenticated) {
      openAuthModal('login');
      return;
    }

    setIsRedeeming(true);
    try {
      const token = await getAuth().currentUser?.getIdToken();
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
      if (data?.caseId) setLastRedeemedCaseId(String(data.caseId));
      if (data?.rakebackUnlocked === true || data?.rakebackPercent != null || data?.rakebackTier != null) {
        await updateUserFlags({
          rakebackUnlocked: data?.rakebackUnlocked === true,
          rakebackPercent: data?.rakebackPercent == null ? undefined : Number(data.rakebackPercent),
          rakebackTier: data?.rakebackTier == null ? null : String(data.rakebackTier)
        });
      }
      alert(data?.message || 'Reward redeemed successfully.');
      setSelectedItem(null);
    } catch (error) {
      alert((error as Error).message || 'Unable to redeem reward.');
    } finally {
      setIsRedeeming(false);
    }
  };

  const handleClaimDaily = () => {
    if (!isAuthenticated) {
      openAuthModal('login');
      return;
    }

    if (!canClaim) {
      playSound('error');
      return;
    }

    playSound('success');
    setIsClaimingDaily(true);
    if (dailyBox) {
      setView({ type: 'CASE_OPENING', boxId: dailyBox.id, isFree: true });
    } else {
      addBalance(100);
      claimDaily();
      setIsClaimingDaily(false);
    }
  };

  const handleApplyAffiliateCode = async () => {
    if (!isAuthenticated) {
      openAuthModal('login');
      return;
    }
    if (hasReferral) {
      setAffiliateMessage('You are already linked to an affiliate.');
      return;
    }

    const formattedCode = affiliateInput.trim().toUpperCase();
    if (!formattedCode) {
      setAffiliateMessage('Please enter a valid affiliate code.');
      return;
    }

    if (user.affiliateCode && formattedCode === user.affiliateCode.toUpperCase()) {
      setAffiliateMessage('You cannot use your own affiliate code.');
      return;
    }

    const affiliateOwner = users.find((u) => u.affiliateCode?.toUpperCase() === formattedCode);
    if (!affiliateOwner) {
      setAffiliateMessage('Affiliate code not found.');
      return;
    }

    setIsApplyingAffiliate(true);
    try {
      await updateUserFlags({ referredBy: formattedCode });
      setAffiliateMessage('Affiliate linked successfully!');
      setAffiliateInput('');
    } finally {
      setIsApplyingAffiliate(false);
    }
  };

  const handleGenerateCode = async () => {
    if (!isAuthenticated) {
      openAuthModal('login');
      return;
    }

    if (user.affiliateCode) {
      await navigator.clipboard?.writeText(user.affiliateCode);
      setAffiliateMessage('Your code is ready to share!');
      window.setTimeout(() => setAffiliateMessage(''), 2500);
      return;
    }

    setIsGeneratingCode(true);
    try {
      const code = await generateAffiliateCode();
      if (code) {
        setAffiliateMessage('Affiliate code generated!');
        playSound('success');
        window.setTimeout(() => setAffiliateMessage(''), 2500);
      }
    } finally {
      setIsGeneratingCode(false);
    }
  };

  const handleOfferWall = () => {
    playSound('click');
    if (!isAuthenticated) {
      openAuthModal('login');
      return;
    }
    setIsOfferwallOpen(true);
  };

  const handleClaimRakeback = async () => {
    if (availableRakeback <= 0 || isClaimingRakeback) {
      playSound('error');
      return;
    }
    setIsClaimingRakeback(true);
    playSound('coins');
    try {
      await claimRakeback();
    } finally {
      setIsClaimingRakeback(false);
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
              <img src={XP_ICON} alt="XP" className="w-12 h-12 object-contain" />
              <span className="text-xs text-blue-300 uppercase">XP Balance</span>
              <span className="text-xl font-black text-white">{xpBalance.toLocaleString()}</span>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            <button
              onClick={() => setActiveTab('bonuses')}
              className={`px-4 py-2 rounded-lg text-sm font-bold ${activeTab === 'bonuses' ? 'bg-blue-500 text-black' : 'bg-[#0b0e14] border border-gray-700 text-gray-300'}`}
            >
              Bonuses
            </button>
            <button
              onClick={() => setActiveTab('xp-shop')}
              className={`px-4 py-2 rounded-lg text-sm font-bold ${activeTab === 'xp-shop' ? 'bg-blue-500 text-black' : 'bg-[#0b0e14] border border-gray-700 text-gray-300'}`}
            >
              XP Shop
            </button>
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
                  <button
                    key={chip}
                    onClick={() => setCategory(chip)}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold border ${chip === category ? 'bg-blue-500/20 border-blue-500 text-blue-300' : 'bg-[#0b0e14] border-gray-700 text-gray-400'}`}
                  >
                    {chip}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {displayShopItems.map((item) => {
                  const hasStock = item.stock == null || item.stock > 0;
                  const canAfford = xpBalance >= item.xpCost;
                  const needMore = Math.max(0, item.xpCost - xpBalance);
                  return (
                    <div key={item.id} className="bg-[#131720] border border-gray-800 rounded-xl p-4 flex flex-col">
                      {item.imageUrl ? (
                        <img src={item.imageUrl} alt={item.title} className="w-full h-32 rounded-lg object-cover mb-3" />
                      ) : (
                        <div className="w-full h-32 rounded-lg bg-[#0b0e14] border border-gray-800 mb-3" />
                      )}
                      <h3 className="text-white font-bold">{item.title}</h3>
                      <p className="text-sm text-gray-400 mt-1 line-clamp-2 min-h-[40px]">{item.description || 'Exclusive XP reward.'}</p>
                      {(item.fulfillmentType === 'XP_BOX' || item.fulfillmentType === 'XP_CASE_ENTRY') && (
                        <p className="mt-1 text-xs text-blue-300">
                          {item.resolvedCaseName} • Open price: {(item.resolvedBoxOpenXp ?? 0).toLocaleString()} XP
                        </p>
                      )}
                      <div className="mt-3 flex items-center justify-between">
                        <span className="text-xs font-bold bg-blue-500/20 text-blue-300 px-2 py-1 rounded">{item.xpCost.toLocaleString()} XP</span>
                        {item.stock != null ? <span className="text-xs text-gray-500">{Math.max(0, item.stock)} left</span> : <span className="text-xs text-gray-500">Unlimited</span>}
                      </div>
                      <button
                        disabled={!hasStock || !canAfford}
                        onClick={() => setSelectedItem(item)}
                        className={`mt-4 w-full py-2 rounded-lg font-bold text-sm ${hasStock && canAfford ? 'bg-green-500 text-black hover:bg-green-400' : 'bg-gray-800 text-gray-500 cursor-not-allowed'}`}
                      >
                        {hasStock ? (canAfford ? ((item.fulfillmentType === 'XP_BOX' || item.fulfillmentType === 'XP_CASE_ENTRY') ? 'View Box' : 'Redeem') : `Need ${needMore} more XP`) : 'Out of stock'}
                      </button>
                    </div>
                  );
                })}
              </div>

            <div className="bg-[#131720] border border-gray-800 rounded-xl p-4 sm:p-5">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm sm:text-base font-bold text-white">XP Mystery Boxes</h3>
                <span className="text-xs text-gray-400">{xpMysteryBoxes.length} available</span>
              </div>
              {xpMysteryBoxes.length === 0 ? (
                <div className="rounded-lg border border-gray-800 bg-[#0b0e14] p-4 text-center text-sm text-gray-400">
                  No XP mystery boxes available yet.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                  {xpMysteryBoxes.map((box) => (
                    <div key={box.id} className="rounded-lg border border-gray-800 bg-[#0b0e14] p-3 flex flex-col">
                      <div className="h-28 w-full rounded-lg border border-gray-800 bg-[#101522] mb-3 overflow-hidden flex items-center justify-center">
                        <img src={box.image} alt={box.name} className="h-full w-full object-contain" />
                      </div>
                      <div className="text-sm font-bold text-white">{box.name}</div>
                      <div className="mt-1 text-xs text-blue-300">Open price: {Math.max(0, Math.floor(Number(box.priceXP ?? 0))).toLocaleString()} XP</div>
                      <button
                        type="button"
                        onClick={() => setView({ type: 'CASE_OPENING', boxId: box.id })}
                        className="mt-3 w-full rounded-lg bg-blue-500/20 border border-blue-500/30 py-2 text-xs font-bold text-blue-200 hover:bg-blue-500/30"
                      >
                        View Box
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="bg-[#131720] border border-gray-800 rounded-xl p-4">
                <h3 className="font-bold text-white mb-2 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-yellow-500" /> Daily Free Case
                </h3>
                <div className="w-full rounded-lg bg-[#0b0e14] border border-gray-800 p-3 flex items-center justify-center mb-3 h-36">
                  <img
                    src={dailyBox?.image || 'https://picsum.photos/id/175/260/180'}
                    alt={dailyBox?.name || 'Daily Free Case'}
                    className="h-full w-auto max-w-full object-contain"
                  />
                </div>
                <button
                  onClick={handleClaimDaily}
                  disabled={!canClaim || isClaimingDaily}
                  className={`w-full py-2 rounded-lg font-bold ${canClaim ? 'bg-yellow-500 text-black' : 'bg-gray-800 text-gray-500'}`}
                >
                  {canClaim ? (isClaimingDaily ? 'Claiming...' : 'Claim Free Spin') : `Next in ${nextClaimCountdown || '00:00:00'}`}
                </button>
              </div>

              <div className="bg-[#131720] border border-gray-800 rounded-xl p-4">
                <h3 className="font-bold text-white mb-2 flex items-center gap-2">
                  <Gift className="w-4 h-4 text-brand-purple" /> Affiliate Code
                </h3>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Input value={affiliateInput} onChange={(e) => setAffiliateInput(e.target.value)} placeholder="Enter code" disabled={hasReferral} className="flex-1" />
                  <button onClick={handleApplyAffiliateCode} disabled={hasReferral || isApplyingAffiliate} className="px-3 py-2 rounded-lg bg-brand-purple text-white font-bold whitespace-nowrap">
                    {isApplyingAffiliate ? 'Applying...' : hasReferral ? 'Linked' : 'Apply'}
                  </button>
                </div>
                {!!affiliateMessage && <p className="text-xs mt-2 text-gray-400">{affiliateMessage}</p>}

                <div className="mt-4 pt-4 border-t border-gray-800">
                  <button
                    onClick={handleGenerateCode}
                    disabled={isGeneratingCode}
                    className="w-full py-2 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold"
                  >
                    {user.affiliateCode ? 'Copy My Affiliate Code' : isGeneratingCode ? 'Generating...' : 'Generate Affiliate Code'}
                  </button>
                  {user.affiliateCode && (
                    <div className="mt-2 flex items-center justify-between rounded-lg bg-[#0b0e14] border border-gray-700 px-3 py-2">
                      <span className="text-sm text-emerald-300 font-bold">{user.affiliateCode}</span>
                      <button
                        onClick={() => navigator.clipboard?.writeText(user.affiliateCode || '')}
                        className="text-gray-400 hover:text-white"
                        aria-label="Copy affiliate code"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-[#131720] border border-gray-800 rounded-xl p-4">
                <h3 className="font-bold text-white mb-2 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-green-400" /> Rakeback
                </h3>
                <p className="text-sm text-gray-400">Current rakeback rate: <span className="text-white font-semibold">{Math.max(0, activeRakebackPercent).toFixed(2)}%</span></p>
                {!rakebackUnlocked && <p className="text-xs text-yellow-300 mt-1">Unlocks at level {bonusSettings.rakebackUnlockLevel} or via eligible XP Shop reward.</p>}
                <p className="text-sm text-gray-400 mb-3">Available: {availableRakeback.toLocaleString()} coins</p>
                <button
                  onClick={handleClaimRakeback}
                  disabled={availableRakeback <= 0 || isClaimingRakeback}
                  className="w-full py-2 rounded-lg bg-green-500 text-black font-bold disabled:bg-gray-800 disabled:text-gray-500"
                >
                  {isClaimingRakeback ? 'Collecting...' : 'Collect Rakeback'}
                </button>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-[#131720] border border-gray-800 rounded-xl p-4">
                <h3 className="font-bold text-white mb-2 flex items-center gap-2">
                  <ClipboardList className="w-4 h-4 text-orange-500" /> Offer Wall
                </h3>
                <p className="text-sm text-gray-400 mb-3">Complete surveys, install apps, and play games to earn free coins.</p>
                <button onClick={handleOfferWall} className="w-full py-2 rounded-lg bg-[#0b0e14] border border-gray-700 text-gray-200 font-bold hover:border-gray-500">
                  Open Offer Wall
                </button>
              </div>

              <div className="bg-[#131720] border border-gray-800 rounded-xl p-4">
                <h3 className="font-bold text-white mb-2 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-green-400" /> Affiliate Program
                </h3>
                <p className="text-sm text-gray-400">Invite followers and earn a share from their activity. No limits on growth.</p>
              </div>
            </div>
          </>
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
              <button onClick={() => setSelectedItem(null)} className="text-gray-500 hover:text-white">
                <X className="w-5 h-5" />
              </button>
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
