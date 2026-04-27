import React, { useEffect, useMemo, useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Menu, Plus, Search, SlidersHorizontal, MoreVertical, Gift, User as UserIcon, Trophy, History, Settings, Shield, CreditCard, Bell, ArrowRight, Gamepad2, Box, Truck } from 'lucide-react';
import { useGame } from '../context/GameContext';
import { auth } from '../firebase';
import { COIN_ICON, XP_ICON } from '../constants';
import { PRICE_UNIT_MODE, toCoins } from '../utils/coins';
import { CoinAmount } from './CoinAmount';
import { Checkbox } from './ui/Checkbox';
import { Input } from './ui/Input';
import { BlurImage } from '../src/ui/images/BlurImage';
import { UserAvatar } from './UserAvatar';
import { toast } from '../src/ui/toast/toast';
import { resolveUserDisplayName } from '../utils/userIdentity';
import { User } from '../types';

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);
const SHIPPING_BATCH_STORAGE_KEY = 'pullzgg_shipping_batch';

type ProfileTab = 'topPulls' | 'inventory' | 'community' | 'settings';
interface ProfileProps { initialTab?: ProfileTab }
type MobileView = 'inventory' | 'account';
type ValueMode = 'coins' | 'usd';

const getProfileUsername = (profile: { provider?: string; username?: string; name?: string; email?: string }) => resolveUserDisplayName(profile);

export const Profile: React.FC<ProfileProps> = () => {
  const { user, users, inventory, boxes, sellItem, shipItem, stripeSettings, openAuthModal, view, setView } = useGame();

  const [inventoryFilter, setInventoryFilter] = useState<'inventory' | 'processing' | 'shipped'>('inventory');
  const [selectedShipments, setSelectedShipments] = useState<string[]>([]);
  const [showShippingReview, setShowShippingReview] = useState(false);
  const [shippingPaymentMethod, setShippingPaymentMethod] = useState<'coins' | 'cash'>('coins');
  const [withdrawLockedModalOpen, setWithdrawLockedModalOpen] = useState(false);
  const [tradeInModalItemId, setTradeInModalItemId] = useState<string | null>(null);
  const [isSubmittingShipment, setIsSubmittingShipment] = useState(false);
  const [isSubmittingCashShipping, setIsSubmittingCashShipping] = useState(false);
  const [isSellingItems, setIsSellingItems] = useState<Record<string, boolean>>({});
  const [mobileView, setMobileView] = useState<MobileView>('inventory');
  const [searchQuery, setSearchQuery] = useState('');
  const [valueMode, setValueMode] = useState<ValueMode>('coins');
  const [rarityFilter, setRarityFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');

  const selectedUserId = view.type === 'PROFILE' ? view.userId : undefined;
  const profileUser = selectedUserId ? users.find((u) => u.id === selectedUserId) : user;
  const isOwnProfile = !selectedUserId || selectedUserId === user.id;
  const displayUser = profileUser || user;
  const displayUsername = getProfileUsername(displayUser);

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

  const xpBoxIds = useMemo(() => new Set(boxes.filter((box) => box.currencyType === 'XP' || Number(box.priceXP ?? 0) > 0).map((box) => box.id)), [boxes]);
  const isXpPurchasedItem = (item: typeof normalizedInventory[number]) =>
    item.source === 'xpShop'
    || Boolean(item.sourceItemId)
    || Boolean(item.sourceRedemptionId)
    || item.acquisitionCurrencyType === 'XP'
    || item.openCurrencyType === 'XP'
    || (item.provenance?.sourceType === 'case_open' && typeof item.provenance.sourceId === 'string' && xpBoxIds.has(item.provenance.sourceId));

  const shippingCoinEnabled = stripeSettings.shippingCoinEnabled;
  const shippingCoinCostCoins = Math.max(0, stripeSettings.shippingCoinCostCoins);
  const shippingCashEnabled = stripeSettings.shippingCashEnabled && stripeSettings.shippingFlatRateCents > 0;
  const shippingFlatRateCents = Math.max(0, stripeSettings.shippingFlatRateCents);

  const filteredInventory = normalizedInventory.filter((item) => {
    const statusMatch = inventoryFilter === 'processing'
      ? item.status === 'shipping' || item.status === 'shipping_requested'
      : inventoryFilter === 'shipped'
        ? item.status === 'shipped'
        : item.status === 'available';
    if (!statusMatch) return false;

    const query = searchQuery.trim().toLowerCase();
    if (query && !item.name.toLowerCase().includes(query)) return false;
    if (rarityFilter !== 'all' && item.rarity !== rarityFilter) return false;
    if (typeFilter === 'tradable' && (item.redeemable === false || isXpPurchasedItem(item))) return false;
    if (typeFilter === 'shippable' && !(item.status === 'available' && !item.locked && !!user.shippingAddress)) return false;
    if (typeFilter === 'restricted' && !(item.redeemable === false || item.locked)) return false;
    return true;
  });

  const selectedShipmentItems = normalizedInventory.filter((item) => selectedShipments.includes(item.instanceId));
  const tradeInModalItem = normalizedInventory.find((item) => item.instanceId === tradeInModalItemId) ?? null;
  const hasMadeDeposit = Number(user.totalSpent ?? 0) > 0;
  const canSelectShipment = (item: typeof normalizedInventory[number]) => item.status === 'available' && !item.locked && !!user.shippingAddress;
  const toShipCount = normalizedInventory.filter((item) => canSelectShipment(item)).length;

  const inventoryValueCoins = filteredInventory.reduce((sum, item) => sum + toCoins(item.price, PRICE_UNIT_MODE), 0);

  const joinedTimestamp = (() => {
    const candidates = [(displayUser as User & { joinedAt?: unknown }).joinedAt, displayUser.createdAt];
    for (const value of candidates) {
      if (typeof value === 'number' && Number.isFinite(value) && value > 0) return value;
      if (typeof value === 'string' && value.trim()) {
        const parsed = Date.parse(value);
        if (Number.isFinite(parsed)) return parsed;
      }
    }
    return undefined;
  })();
  const joinedDateLabel = joinedTimestamp ? new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric' }).format(joinedTimestamp) : 'Recently';

  const recentActivity = (displayUser.ledger ?? []).slice(0, 3).map((entry) => ({
    id: entry.id,
    title: entry.description || entry.type,
    date: entry.createdAt ? new Date(entry.createdAt).toLocaleDateString() : '—',
    amount: entry.amount
  }));

  const isFreeShippingItem = (item: typeof normalizedInventory[number]) => (
    item.freeShipping === true
    || Number(item.shippingCostOverrideCoins ?? NaN) === 0
    || Number(item.shippingCostOverrideCents ?? NaN) === 0
    || isXpPurchasedItem(item)
  );
  const getCoinShippingCostForItem = (item: typeof normalizedInventory[number]) => (isFreeShippingItem(item) ? 0 : shippingCoinCostCoins);
  const getCashShippingCostForItemCents = (item: typeof normalizedInventory[number]) => (isFreeShippingItem(item) ? 0 : shippingFlatRateCents);
  const shippingCoinTotal = selectedShipmentItems.reduce((sum, item) => sum + getCoinShippingCostForItem(item), 0);
  const shippingCashTotalCents = selectedShipmentItems.reduce((sum, item) => sum + getCashShippingCostForItemCents(item), 0);
  const freeShippingItemCount = selectedShipmentItems.filter((item) => isFreeShippingItem(item)).length;
  const paidShippingItemCount = Math.max(0, selectedShipmentItems.length - freeShippingItemCount);
  const isFreeOnlySelection = selectedShipmentItems.length > 0 && paidShippingItemCount === 0;
  const canUseCoinShipping = !isFreeOnlySelection && shippingCoinEnabled;
  const canUseCashShipping = !isFreeOnlySelection && shippingCashEnabled;
  const hasShippingMethodToggle = canUseCoinShipping && canUseCashShipping;
  const activeShippingMethod = hasShippingMethodToggle ? shippingPaymentMethod : canUseCashShipping ? 'cash' : 'coins';

  useEffect(() => {
    const selectableIds = new Set(normalizedInventory.filter((item) => canSelectShipment(item)).map((item) => item.instanceId));
    setSelectedShipments((prev) => prev.filter((id) => selectableIds.has(id)));
  }, [user.shippingAddress, normalizedInventory]);

  useEffect(() => {
    if (canUseCoinShipping && canUseCashShipping) return;
    setShippingPaymentMethod(canUseCashShipping ? 'cash' : 'coins');
  }, [canUseCoinShipping, canUseCashShipping]);

  useEffect(() => {
    if (!isOwnProfile) return;
    const params = new URLSearchParams(window.location.search);
    const shippingStatus = params.get('shipping');
    if (!shippingStatus) return;

    const clearUrlParams = () => {
      params.delete('shipping');
      params.delete('session_id');
      const nextQuery = params.toString();
      const nextUrl = `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ''}${window.location.hash}`;
      window.history.replaceState({}, '', nextUrl);
    };

    const clearStoredBatch = () => {
      window.sessionStorage.removeItem(SHIPPING_BATCH_STORAGE_KEY);
      setSelectedShipments([]);
      setShowShippingReview(false);
    };

    if (shippingStatus === 'cancel') {
      const shipmentBatchId = window.sessionStorage.getItem(SHIPPING_BATCH_STORAGE_KEY);
      if (shipmentBatchId && auth.currentUser) {
        const cancelShipment = async () => {
          try {
            const token = await auth.currentUser?.getIdToken();
            if (!token) return;
            await fetch('/api/cancel-shipping-checkout-session', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ shipmentBatchId }) });
          } catch (error) {
            console.error('Failed to cancel cash shipping checkout', error);
          } finally {
            clearStoredBatch();
            clearUrlParams();
          }
        };
        void cancelShipment();
        return;
      }
      clearStoredBatch();
      clearUrlParams();
      return;
    }

    if (shippingStatus === 'success') {
      clearStoredBatch();
      clearUrlParams();
    }
  }, [isOwnProfile]);

  const handleConfirmTradeIn = async () => {
    if (!tradeInModalItem || isSellingItems[tradeInModalItem.instanceId]) return;
    setIsSellingItems((prev) => ({ ...prev, [tradeInModalItem.instanceId]: true }));
    try {
      await sellItem(tradeInModalItem.instanceId);
      setTradeInModalItemId(null);
    } finally {
      setIsSellingItems((prev) => ({ ...prev, [tradeInModalItem.instanceId]: false }));
    }
  };

  const handleOpenShippingReview = (instanceIds: string[]) => {
    setSelectedShipments(instanceIds);
    setShippingPaymentMethod(shippingCoinEnabled ? 'coins' : 'cash');
    setShowShippingReview(true);
  };

  const handleWithdrawClick = (instanceId: string) => {
    if (!hasMadeDeposit) {
      setWithdrawLockedModalOpen(true);
      return;
    }
    handleOpenShippingReview([instanceId]);
  };

  const handleConfirmShipping = async () => {
    if (!user.shippingAddress) return;
    const itemsToShip = selectedShipmentItems.filter((item) => canSelectShipment(item));
    if (itemsToShip.length === 0) return;
    setIsSubmittingShipment(true);
    try {
      await Promise.all(itemsToShip.map((item) => shipItem(item.instanceId)));
      setSelectedShipments([]);
      setShowShippingReview(false);
    } finally {
      setIsSubmittingShipment(false);
    }
  };

  const handleCashShipping = async () => {
    if (!auth.currentUser) {
      openAuthModal('login');
      return;
    }
    if (!user.shippingAddress) return;

    setIsSubmittingCashShipping(true);
    try {
      const token = await auth.currentUser.getIdToken();
      const response = await fetch('/api/create-shipping-checkout-session', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ inventoryIds: selectedShipmentItems.map((item) => item.instanceId) })
      });
      const data = await response.json();
      if (typeof data.shipmentBatchId === 'string') window.sessionStorage.setItem(SHIPPING_BATCH_STORAGE_KEY, data.shipmentBatchId);
      const stripe = await stripePromise;
      if (stripe && data.sessionId) await stripe.redirectToCheckout({ sessionId: data.sessionId });
    } catch (error) {
      console.error(error);
      toast.error('Unable to start cash checkout.');
    } finally {
      setIsSubmittingCashShipping(false);
    }
  };

  const accountActions = [
    { label: 'Deposit', icon: Plus, onClick: () => setView({ type: 'BONUSES' }) },
    { label: 'Withdraw', icon: Truck, onClick: () => setMobileView('inventory') },
    { label: 'My Rewards', icon: Trophy, onClick: () => setView({ type: 'BONUSES' }) },
    { label: 'Trade History', icon: History, onClick: () => setView({ type: 'PROFILE' }) },
    { label: 'Account Settings', icon: Settings, onClick: () => setView({ type: 'PROFILE' }) },
    { label: 'Security', icon: Shield, onClick: () => setView({ type: 'PROFILE' }) },
    { label: 'Payment Methods', icon: CreditCard, onClick: () => setView({ type: 'BONUSES' }) },
    { label: 'Notifications', icon: Bell, onClick: () => setView({ type: 'PROFILE' }) },
    { label: 'Referrals', icon: Gift, onClick: () => setView({ type: 'BONUSES' }), badge: 'NEW' }
  ];

  const topHeader = (
    <div className="mb-4 flex items-center justify-between rounded-2xl border border-white/10 bg-[#0d1320]/85 px-3 py-3 md:hidden">
      <div className="text-lg font-black tracking-wide text-white">PULLZ.GG</div>
      <div className="flex items-center gap-2">
        <div className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-[#141c2b] px-2.5 py-1.5 text-white">
          <img src={COIN_ICON} alt="coins" className="h-4 w-4" />
          <span className="text-sm font-bold">{Math.round(displayUser.balance ?? 0).toLocaleString()}</span>
        </div>
        <button className="rounded-xl bg-brand-purple p-2 text-white" onClick={() => setView({ type: 'BONUSES' })}><Plus className="h-4 w-4" /></button>
        <button className="rounded-xl border border-white/10 p-2 text-slate-300"><Menu className="h-4 w-4" /></button>
      </div>
    </div>
  );

  const accountPane = (
    <div className="space-y-3">
      <div className="rounded-2xl border border-white/10 bg-gradient-to-b from-[#121a2b] to-[#0a101d] p-4">
        <div className="flex items-center gap-3">
          <UserAvatar user={displayUser} className="h-14 w-14 rounded-xl" initialsClassName="text-lg" />
          <div>
            <div className="text-xl font-bold text-white">{displayUsername}</div>
            <div className="text-xs text-gray-400">Member since {joinedDateLabel}</div>
            <div className="mt-2 inline-flex items-center gap-1 rounded-full border border-violet-400/30 bg-violet-500/15 px-2 py-1 text-xs text-violet-100">
              <img src={XP_ICON} alt="xp" className="h-3.5 w-3.5" /> XP Points {(displayUser.xpBalance ?? displayUser.xp ?? 0).toLocaleString()}
            </div>
          </div>
        </div>
        <div className="mt-4 space-y-2 text-sm">
          <div className="flex justify-between border-t border-white/10 pt-2 text-slate-300"><span>Level</span><span className="font-bold text-white">{displayUser.level ?? 1}</span></div>
          <div className="flex justify-between border-t border-white/10 pt-2 text-slate-300"><span>Total Boxes Opened</span><span className="font-bold text-white">{Number(displayUser.challengeStats?.boxesOpened ?? 0).toLocaleString()}</span></div>
          <div className="flex justify-between border-t border-white/10 pt-2 text-slate-300"><span>Total Value Unboxed</span><span className="font-bold text-white">{Math.round(Number(displayUser.totalSpent ?? 0)).toLocaleString()}</span></div>
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-gradient-to-b from-[#121a2b] to-[#0a101d] p-4">
        <div className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-violet-300">Quick Actions</div>
        <div className="space-y-1">
          {accountActions.map((action) => (
            <button key={action.label} onClick={action.onClick} className="flex w-full items-center justify-between rounded-lg px-2 py-2 text-left text-sm text-slate-200 hover:bg-white/5">
              <span className="inline-flex items-center gap-2"><action.icon className="h-4 w-4 text-violet-300" /> {action.label}</span>
              {action.badge ? <span className="rounded-full bg-violet-500/30 px-2 py-0.5 text-[10px] font-bold text-violet-100">{action.badge}</span> : <ArrowRight className="h-4 w-4 text-slate-500" />}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-gradient-to-b from-[#121a2b] to-[#0a101d] p-4 text-center">
        <Gift className="mx-auto h-12 w-12 text-violet-300" />
        <h3 className="mt-2 text-2xl font-bold text-white">Invite Friends, Earn Rewards</h3>
        <p className="mt-1 text-sm text-slate-400">Get 5% of every deposit made by your friends.</p>
        <button onClick={() => setView({ type: 'BONUSES' })} className="mt-4 w-full rounded-xl bg-brand-purple py-2.5 font-bold text-white">Invite Friends</button>
      </div>

      <div className="rounded-2xl border border-white/10 bg-gradient-to-b from-[#121a2b] to-[#0a101d] p-4">
        <div className="mb-2 flex items-center justify-between"><span className="text-xs font-bold uppercase tracking-[0.2em] text-violet-300">Recent Activity</span></div>
        {recentActivity.length === 0 ? (
          <p className="text-sm text-slate-400">No recent activity yet.</p>
        ) : (
          <div className="space-y-2">
            {recentActivity.map((entry) => (
              <div key={entry.id} className="rounded-xl border border-white/10 bg-[#0f1626] p-3 text-sm">
                <div className="font-semibold text-white">{entry.title}</div>
                <div className="text-xs text-slate-400">{entry.date}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  const inventoryPane = (
    <div>
      <div className="rounded-2xl border border-white/10 bg-gradient-to-b from-[#121a2b] to-[#0a101d] p-4">
        <h1 className="text-3xl font-black text-white">Inventory</h1>
        <p className="text-sm text-slate-400">Manage your items, ship rewards, or sell them back for coins.</p>
        <div className="mt-4 grid grid-cols-3 gap-2">
          <div className="rounded-xl border border-white/10 bg-[#10182a] p-3"><div className="text-2xl font-bold text-white">{filteredInventory.length}</div><div className="text-xs text-slate-400">Items</div></div>
          <div className="rounded-xl border border-white/10 bg-[#10182a] p-3"><div className="text-2xl font-bold text-white">{Math.round(inventoryValueCoins).toLocaleString()}</div><div className="text-xs text-slate-400">Value (Coins)</div></div>
          <div className="rounded-xl border border-white/10 bg-[#10182a] p-3"><div className="text-2xl font-bold text-white">{toShipCount}</div><div className="text-xs text-slate-400">To Ship</div></div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {[
            { id: 'inventory', label: 'My Items' },
            { id: 'processing', label: 'Processing' },
            { id: 'shipped', label: 'Shipped' }
          ].map((tab) => <button key={tab.id} className={`rounded-lg px-3 py-2 text-sm ${inventoryFilter === tab.id ? 'bg-violet-600 text-white' : 'bg-[#0e1524] text-slate-300'}`} onClick={() => setInventoryFilter(tab.id as typeof inventoryFilter)}>{tab.label}</button>)}
        </div>

        <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-[1.4fr_1fr_1fr_auto]">
          <div className="flex items-center rounded-xl border border-white/10 bg-[#0e1524] px-3"><Search className="h-4 w-4 text-slate-400" /><Input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search items" className="border-0 bg-transparent text-white" /></div>
          <select value={rarityFilter} onChange={(e) => setRarityFilter(e.target.value)} className="rounded-xl border border-white/10 bg-[#0e1524] px-3 py-2 text-sm text-white"><option value="all">All Rarities</option><option value="common">Common</option><option value="uncommon">Uncommon</option><option value="rare">Rare</option><option value="epic">Epic</option><option value="legendary">Legendary</option></select>
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="rounded-xl border border-white/10 bg-[#0e1524] px-3 py-2 text-sm text-white"><option value="all">All Types</option><option value="tradable">Tradable</option><option value="shippable">Shippable</option><option value="restricted">Restricted</option></select>
          <button className="rounded-xl border border-white/10 bg-[#0e1524] p-2 text-slate-300"><SlidersHorizontal className="h-4 w-4" /></button>
        </div>

        <button onClick={() => setShowShippingReview(true)} disabled={selectedShipments.length === 0} className="mt-3 w-full rounded-xl bg-brand-purple py-3 font-bold text-white disabled:opacity-50">Review Shipping ({selectedShipments.length})</button>
        <div className="mt-3 inline-flex rounded-full border border-white/10 bg-[#0e1524] p-1 text-sm">
          <button onClick={() => setValueMode('coins')} className={`rounded-full px-4 py-1 ${valueMode === 'coins' ? 'bg-violet-600 text-white' : 'text-slate-300'}`}>Coins</button>
          <button onClick={() => setValueMode('usd')} className={`rounded-full px-4 py-1 ${valueMode === 'usd' ? 'bg-violet-600 text-white' : 'text-slate-300'}`}>USD</button>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4 xl:grid-cols-5">
        {filteredInventory.map((item) => {
          const canShip = canSelectShipment(item);
          const canSell = item.status === 'available' && !item.locked && item.redeemable !== false && !isXpPurchasedItem(item);
          const ctaLabel = canShip ? 'Ship Item' : canSell ? 'Trade In' : 'Not Tradable';
          return (
            <div key={item.instanceId} className="rounded-2xl border border-white/10 bg-gradient-to-b from-[#121a2b] to-[#0a101d] p-2.5">
              <div className="mb-2 flex items-center justify-between">
                <span className="rounded-full border border-yellow-400/30 bg-yellow-500/10 px-2 py-0.5 text-[10px] capitalize text-yellow-200">{item.rarity}</span>
                <MoreVertical className="h-4 w-4 text-slate-500" />
              </div>
              <label className="mb-2 inline-flex items-center gap-1 text-xs text-slate-300">
                <Checkbox checked={selectedShipments.includes(item.instanceId)} onChange={() => setSelectedShipments((prev) => prev.includes(item.instanceId) ? prev.filter((id) => id !== item.instanceId) : [...prev, item.instanceId])} disabled={!canShip} />
                Select
              </label>
              <div className="aspect-square rounded-xl bg-[#0e1524] p-2"><BlurImage src={item.image} alt={item.name} className="h-full w-full object-contain" /></div>
              <div className="mt-2 line-clamp-2 text-sm font-bold text-white">{item.name}</div>
              <div className="mt-1 text-base font-bold text-white">{valueMode === 'coins' ? <CoinAmount amount={toCoins(item.price, PRICE_UNIT_MODE)} formatOptions={{ maximumFractionDigits: 0 }} iconClassName="h-4 w-4" className="text-sm font-bold text-white" /> : `$${(toCoins(item.price, PRICE_UNIT_MODE) / 100).toFixed(2)}`}</div>
              <div className="text-xs text-slate-400">Obtained {new Date(item.obtainedAt).toLocaleDateString()}</div>
              <button onClick={() => (canShip ? handleWithdrawClick(item.instanceId) : canSell ? setTradeInModalItemId(item.instanceId) : null)} disabled={!canShip && !canSell} className="mt-2 w-full rounded-lg border border-violet-500/50 bg-[#11182a] py-2 text-sm font-bold text-violet-200 disabled:opacity-45">{ctaLabel}</button>
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="mx-auto max-w-[1240px] px-3 pb-24 pt-4 md:px-6 md:pb-8">
      {topHeader}
      <div className="hidden md:grid md:grid-cols-[280px_minmax(0,1fr)] md:gap-4">{accountPane}{inventoryPane}</div>

      <div className="md:hidden">
        {mobileView === 'account' ? accountPane : inventoryPane}
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-white/10 bg-[#0b111d]/95 p-2 backdrop-blur md:hidden">
        <div className="mx-auto grid max-w-md grid-cols-4 gap-1">
          <button onClick={() => setView({ type: 'BOXES' })} className="flex flex-col items-center gap-1 rounded-lg py-2 text-xs text-slate-300"><Gamepad2 className="h-4 w-4" />Games</button>
          <button onClick={() => setView({ type: 'BONUSES' })} className="flex flex-col items-center gap-1 rounded-lg py-2 text-xs text-slate-300"><Gift className="h-4 w-4" />Rewards</button>
          <button onClick={() => setMobileView('inventory')} className={`flex flex-col items-center gap-1 rounded-lg py-2 text-xs ${mobileView === 'inventory' ? 'text-violet-300' : 'text-slate-300'}`}><Box className="h-4 w-4" />Inventory</button>
          <button onClick={() => setMobileView('account')} className={`flex flex-col items-center gap-1 rounded-lg py-2 text-xs ${mobileView === 'account' ? 'text-violet-300' : 'text-slate-300'}`}><UserIcon className="h-4 w-4" />Account</button>
        </div>
      </div>

      {tradeInModalItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3">
          <div className="w-full max-w-xl rounded-2xl border border-white/10 bg-[#080d18] p-4">
            <h3 className="text-xl font-black text-white">Trade In Item</h3>
            <div className="mt-3 flex items-center gap-3"><img src={tradeInModalItem.image} alt={tradeInModalItem.name} className="h-20 w-14 rounded-lg border border-white/10 object-cover" /><div><p className="font-bold text-white">{tradeInModalItem.name}</p></div></div>
            <button onClick={handleConfirmTradeIn} disabled={!!isSellingItems[tradeInModalItem.instanceId]} className="mt-4 w-full rounded-xl bg-brand-purple py-2.5 font-bold text-white">{isSellingItems[tradeInModalItem.instanceId] ? 'Trading In...' : 'Trade In'}</button>
          </div>
        </div>
      )}

      {withdrawLockedModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3">
          <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#080d18] p-4">
            <h3 className="text-2xl font-black text-white">Withdrawals Locked</h3>
            <p className="mt-2 text-sm text-slate-300">Make your first deposit to unlock withdrawals.</p>
            <button onClick={() => setView({ type: 'BONUSES' })} className="mt-4 w-full rounded-xl bg-brand-purple py-2.5 font-bold text-white">Add Coins</button>
          </div>
        </div>
      )}

      {showShippingReview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3">
          <div className="w-full max-w-3xl rounded-2xl border border-white/10 bg-[#080d18] p-4">
            <h3 className="text-xl font-black text-white">Confirm shipment</h3>
            <div className="mt-3 space-y-2 max-h-60 overflow-auto">{selectedShipmentItems.map((item) => <div key={item.instanceId} className="flex items-center justify-between rounded-xl border border-white/10 p-2 text-sm text-slate-200"><span>{item.name}</span><span>{getCoinShippingCostForItem(item) === 0 ? 'Free' : `${getCoinShippingCostForItem(item)} coins`}</span></div>)}</div>
            {hasShippingMethodToggle && <div className="mt-3 grid grid-cols-2 gap-2"><button onClick={() => setShippingPaymentMethod('coins')} className={`rounded-lg py-2 ${activeShippingMethod === 'coins' ? 'bg-violet-600 text-white' : 'bg-[#11182a] text-slate-300'}`}>Ship with coins</button><button onClick={() => setShippingPaymentMethod('cash')} className={`rounded-lg py-2 ${activeShippingMethod === 'cash' ? 'bg-violet-600 text-white' : 'bg-[#11182a] text-slate-300'}`}>Ship with cash</button></div>}
            <div className="mt-3 text-sm text-slate-300">Items: {selectedShipmentItems.length} • Free: {freeShippingItemCount} • Paid: {paidShippingItemCount}</div>
            <div className="mt-3 grid grid-cols-1 gap-2">
              {activeShippingMethod === 'coins' && <button onClick={handleConfirmShipping} disabled={isSubmittingShipment || selectedShipmentItems.length === 0} className="rounded-xl bg-blue-600 py-2.5 font-bold text-white disabled:opacity-50">{isSubmittingShipment ? 'Submitting...' : `Ship with coins (${shippingCoinTotal})`}</button>}
              {activeShippingMethod === 'cash' && <button onClick={handleCashShipping} disabled={isSubmittingCashShipping || selectedShipmentItems.length === 0} className="rounded-xl bg-emerald-600 py-2.5 font-bold text-white disabled:opacity-50">{isSubmittingCashShipping ? 'Redirecting...' : `Ship – $${(shippingCashTotalCents / 100).toFixed(2)}`}</button>}
              {isFreeOnlySelection && <button onClick={handleConfirmShipping} disabled={isSubmittingShipment || selectedShipmentItems.length === 0} className="rounded-xl bg-emerald-600 py-2.5 font-bold text-white disabled:opacity-50">Confirm free shipping</button>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
