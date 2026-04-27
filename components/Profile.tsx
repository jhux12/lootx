import React, { useEffect, useMemo, useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { X } from 'lucide-react';
import { useGame } from '../context/GameContext';
import { auth } from '../firebase';
import { toast } from '../src/ui/toast/toast';
import { getSellBackValue } from '../utils/sellBack';
import { PRICE_UNIT_MODE, toCoins } from '../utils/coins';
import { CoinAmount } from './CoinAmount';
import { resolveUserDisplayName } from '../utils/userIdentity';
import { InventoryItem, User } from '../types';
import { AccountSidebar } from './profile/AccountSidebar';
import { AccountView } from './profile/AccountView';
import { InventoryView } from './profile/InventoryView';
import { MobileBottomNav } from './profile/MobileBottomNav';

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);
const SHIPPING_BATCH_STORAGE_KEY = 'pullzgg_shipping_batch';

type MobileTab = 'inventory' | 'account';

const getProfileUsername = (profile: { provider?: string; username?: string; name?: string; email?: string }) => resolveUserDisplayName(profile);

const normalizeItems = (items: InventoryItem[]) =>
  (items ?? []).map((item, index) => {
    const fallbackId = item.id ?? `item-${index}`;
    const fallbackInstanceId = `${fallbackId}-${item.obtainedAt ?? 0}-${item.price ?? 0}-${item.name ?? ''}`;
    return {
      ...item,
      id: fallbackId,
      instanceId: item.instanceId || fallbackInstanceId,
      status: item.status ?? 'available',
      obtainedAt: item.obtainedAt ?? 0,
      rarity: item.rarity ?? 'common'
    };
  });

export const Profile: React.FC = () => {
  const { user, users, inventory, boxes, sellItem, shipItem, stripeSettings, openAuthModal, setView } = useGame();

  const [activeTab, setActiveTab] = useState<MobileTab>('inventory');
  const [search, setSearch] = useState('');
  const [rarity, setRarity] = useState('all');
  const [type, setType] = useState('all');
  const [sort, setSort] = useState('newest');
  const [selectedShipments, setSelectedShipments] = useState<string[]>([]);
  const [showShippingReview, setShowShippingReview] = useState(false);
  const [shippingPaymentMethod, setShippingPaymentMethod] = useState<'coins' | 'cash'>('coins');
  const [withdrawLockedModalOpen, setWithdrawLockedModalOpen] = useState(false);
  const [tradeInModalItemId, setTradeInModalItemId] = useState<string | null>(null);
  const [isSellingItems, setIsSellingItems] = useState<Record<string, boolean>>({});
  const [isSubmittingShipment, setIsSubmittingShipment] = useState(false);
  const [isSubmittingCashShipping, setIsSubmittingCashShipping] = useState(false);

  const displayUser = user;
  const displayUsername = getProfileUsername(displayUser);

  const xpBoxIds = useMemo(
    () => new Set(boxes.filter((box) => box.currencyType === 'XP' || Number(box.priceXP ?? 0) > 0).map((box) => box.id)),
    [boxes]
  );

  const isXpPurchasedItem = (item: InventoryItem) =>
    item.source === 'xpShop'
    || Boolean(item.sourceItemId)
    || Boolean(item.sourceRedemptionId)
    || item.acquisitionCurrencyType === 'XP'
    || item.openCurrencyType === 'XP'
    || (item.provenance?.sourceType === 'case_open' && typeof item.provenance.sourceId === 'string' && xpBoxIds.has(item.provenance.sourceId));

  const normalizedInventory = useMemo(
    () => normalizeItems(inventory as InventoryItem[]).sort((a, b) => b.obtainedAt - a.obtainedAt),
    [inventory]
  );

  const filteredInventory = useMemo(() => {
    const term = search.trim().toLowerCase();
    const byFilters = normalizedInventory.filter((item) => {
      const itemType = item.status === 'shipping' || item.status === 'shipping_requested' ? 'shipping' : item.status === 'shipped' ? 'shipped' : 'available';
      const matchesSearch = !term || item.name.toLowerCase().includes(term);
      const matchesRarity = rarity === 'all' || item.rarity === rarity;
      const matchesType = type === 'all' || itemType === type;
      return matchesSearch && matchesRarity && matchesType;
    });

    return byFilters.sort((a, b) => {
      if (sort === 'valueDesc') return toCoins(b.price, PRICE_UNIT_MODE) - toCoins(a.price, PRICE_UNIT_MODE);
      if (sort === 'valueAsc') return toCoins(a.price, PRICE_UNIT_MODE) - toCoins(b.price, PRICE_UNIT_MODE);
      if (sort === 'nameAsc') return a.name.localeCompare(b.name);
      return b.obtainedAt - a.obtainedAt;
    });
  }, [normalizedInventory, search, rarity, type, sort]);

  const hasMadeDeposit = Number(user.totalSpent ?? 0) > 0;
  const shippingCoinEnabled = stripeSettings.shippingCoinEnabled;
  const shippingCoinCostCoins = Math.max(0, stripeSettings.shippingCoinCostCoins);
  const shippingCashEnabled = stripeSettings.shippingCashEnabled && stripeSettings.shippingFlatRateCents > 0;
  const shippingFlatRateCents = Math.max(0, stripeSettings.shippingFlatRateCents);

  const isFreeShippingItem = (item: InventoryItem) => (
    item.freeShipping === true
    || Number(item.shippingCostOverrideCoins ?? NaN) === 0
    || Number(item.shippingCostOverrideCents ?? NaN) === 0
    || isXpPurchasedItem(item)
  );

  const getCoinShippingCostForItem = (item: InventoryItem) => (isFreeShippingItem(item) ? 0 : shippingCoinCostCoins);
  const getCashShippingCostForItemCents = (item: InventoryItem) => (isFreeShippingItem(item) ? 0 : shippingFlatRateCents);

  const canSelectShipment = (item: InventoryItem) => item.status === 'available' && !item.locked && !!user.shippingAddress;

  useEffect(() => {
    const selectableIds = new Set(normalizedInventory.filter((item) => canSelectShipment(item)).map((item) => item.instanceId));
    setSelectedShipments((prev) => prev.filter((id) => selectableIds.has(id)));
  }, [normalizedInventory, user.shippingAddress]);

  useEffect(() => {
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
        void (async () => {
          try {
            const token = await auth.currentUser?.getIdToken();
            if (!token) return;
            await fetch('/api/cancel-shipping-checkout-session', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
              body: JSON.stringify({ shipmentBatchId })
            });
          } finally {
            clearStoredBatch();
            clearUrlParams();
          }
        })();
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
  }, []);

  const selectedShipmentItems = normalizedInventory.filter((item) => selectedShipments.includes(item.instanceId));
  const selectedShipmentValue = selectedShipmentItems.reduce((sum, item) => sum + toCoins(item.price, PRICE_UNIT_MODE), 0);
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
    if (canUseCoinShipping && canUseCashShipping) return;
    if (canUseCashShipping) {
      setShippingPaymentMethod('cash');
      return;
    }
    setShippingPaymentMethod('coins');
  }, [canUseCoinShipping, canUseCashShipping]);

  const getSellBackRate = (item: InventoryItem) => {
    const storedRate = Number(item.sellBackRate);
    if (Number.isFinite(storedRate) && storedRate > 0) return Math.min(1, Math.max(0, storedRate));
    if (item.provenance?.sourceType === 'case_open' && item.provenance?.sourceId) {
      const sourceBox = boxes.find((box) => box.id === item.provenance?.sourceId);
      if (sourceBox?.sellBackRate !== undefined) return Math.min(1, Math.max(0, Number(sourceBox.sellBackRate)));
      if (sourceBox?.isUserCreated) return 0.75;
    }
    return 0.82;
  };

  const handleToggleShipment = (instanceId: string) => {
    setSelectedShipments((prev) => (prev.includes(instanceId) ? prev.filter((id) => id !== instanceId) : [...prev, instanceId]));
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

  const handleConfirmTradeIn = async () => {
    const tradeItem = normalizedInventory.find((item) => item.instanceId === tradeInModalItemId);
    if (!tradeItem || isSellingItems[tradeItem.instanceId]) return;
    setIsSellingItems((prev) => ({ ...prev, [tradeItem.instanceId]: true }));
    try {
      await sellItem(tradeItem.instanceId);
      setTradeInModalItemId(null);
    } finally {
      setIsSellingItems((prev) => ({ ...prev, [tradeItem.instanceId]: false }));
    }
  };

  const handleConfirmShipping = async () => {
    if (!user.shippingAddress) {
      toast.info('Please add a shipping address before requesting shipment.');
      return;
    }
    const itemsToShip = selectedShipmentItems.filter((item) => canSelectShipment(item));
    setIsSubmittingShipment(true);
    try {
      await Promise.all(itemsToShip.map((item) => shipItem(item.instanceId)));
      setSelectedShipments([]);
      setShowShippingReview(false);
    } catch {
      toast.error('Unable to request shipment right now. Please try again.');
    } finally {
      setIsSubmittingShipment(false);
    }
  };

  const handleCashShipping = async () => {
    if (!auth.currentUser) {
      openAuthModal('login');
      return;
    }
    if (!user.shippingAddress) {
      toast.info('Please add a shipping address before requesting shipment.');
      return;
    }
    const itemsToShip = selectedShipmentItems.filter((item) => canSelectShipment(item));
    setIsSubmittingCashShipping(true);
    try {
      const token = await auth.currentUser.getIdToken();
      const response = await fetch('/api/create-shipping-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ inventoryIds: itemsToShip.map((item) => item.instanceId) })
      });
      if (!response.ok) throw new Error('Unable to start checkout.');
      const data = await response.json();
      if (typeof data.shipmentBatchId === 'string') window.sessionStorage.setItem(SHIPPING_BATCH_STORAGE_KEY, data.shipmentBatchId);
      if (!data.sessionId) return;
      const stripe = await stripePromise;
      if (!stripe) throw new Error('Stripe failed to initialize.');
      const result = await stripe.redirectToCheckout({ sessionId: data.sessionId });
      if (result.error) throw result.error;
    } catch {
      toast.error('Unable to start cash checkout. Please try again.');
    } finally {
      setIsSubmittingCashShipping(false);
    }
  };

  const joinedDate = displayUser.createdAt
    ? new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric' }).format(displayUser.createdAt)
    : 'Recently';

  const boxesOpened = Number(displayUser.challengeStats?.boxesOpened ?? 0);
  const totalValueUnboxed = normalizedInventory.reduce((sum, item) => sum + toCoins(item.price, PRICE_UNIT_MODE), 0);
  const level = Number(displayUser.level ?? 1) || 1;
  const xp = Number(displayUser.xpBalance ?? displayUser.xp ?? 0);

  const recentActivity = ((displayUser as User).ledger ?? [])
    .slice(-5)
    .reverse()
    .map((entry) => `${entry.type.replaceAll('_', ' ')} ${Math.round(entry.amount).toLocaleString()}`);

  const quickActions = [
    { label: 'Deposit', primary: true, onClick: () => setView({ type: 'BONUSES' as const }) },
    { label: 'Withdraw', onClick: () => setActiveTab('inventory') },
    { label: 'Rewards', onClick: () => setView({ type: 'BONUSES' as const }) },
    { label: 'Trade History', onClick: () => setType('shipped') },
    { label: 'Settings', onClick: () => toast.info('Settings are managed in your account preferences.') },
    { label: 'Security', onClick: () => toast.info('Security settings are coming soon.') },
    { label: 'Payment Methods', onClick: () => toast.info('Payment methods are managed in checkout.') },
    { label: 'Notifications', onClick: () => toast.info('Notification settings are coming soon.') },
    { label: 'Referrals', onClick: () => setView({ type: 'REFERRALS' as const }), isNew: true }
  ];

  const inventoryTotalValue = filteredInventory.reduce((sum, item) => sum + toCoins(item.price, PRICE_UNIT_MODE), 0);
  const availableToShip = filteredInventory.filter((item) => canSelectShipment(item)).length;

  const getActionForItem = (item: InventoryItem) => {
    const isAvailable = item.status === 'available';
    const isLocked = !!item.locked;
    const canShip = isAvailable && !isLocked && !!user.shippingAddress;
    const canSell = isAvailable && !isLocked && item.redeemable !== false && !isXpPurchasedItem(item);

    if (canShip) {
      return { label: 'Ship Item', disabled: false, onClick: () => handleWithdrawClick(item.instanceId) };
    }
    if (canSell) {
      return { label: 'Trade In', disabled: !!isSellingItems[item.instanceId], onClick: () => setTradeInModalItemId(item.instanceId) };
    }
    return { label: 'Not Tradable', disabled: true, onClick: () => undefined };
  };

  const tradeInModalItem = normalizedInventory.find((item) => item.instanceId === tradeInModalItemId) ?? null;

  return (
    <div className="min-h-screen bg-[#0B0F1A] px-4 py-4 md:px-6 md:py-6">
      <div className="mx-auto flex max-w-[1280px] gap-6 pb-20 md:pb-4">
        <AccountSidebar
          user={displayUser}
          username={displayUsername}
          memberSince={joinedDate}
          xp={xp}
          level={level}
          boxesOpened={boxesOpened}
          totalValueUnboxed={totalValueUnboxed}
          quickActions={quickActions}
          recentActivity={recentActivity}
        />

        <div className="flex-1">
          <div className="md:hidden">
            {activeTab === 'inventory' ? (
              <InventoryView
                items={filteredInventory}
                selectedIds={selectedShipments}
                onToggleSelect={handleToggleShipment}
                onReviewShipping={() => handleOpenShippingReview(selectedShipments)}
                search={search}
                setSearch={setSearch}
                rarity={rarity}
                setRarity={setRarity}
                type={type}
                setType={setType}
                sort={sort}
                setSort={setSort}
                getAction={getActionForItem}
                totalValue={inventoryTotalValue}
                availableToShip={availableToShip}
                selectedValue={selectedShipmentValue}
              />
            ) : (
              <AccountView
                user={displayUser}
                username={displayUsername}
                memberSince={joinedDate}
                xp={xp}
                level={level}
                boxesOpened={boxesOpened}
                totalValueUnboxed={totalValueUnboxed}
                quickActions={quickActions}
                recentActivity={recentActivity}
              />
            )}
          </div>

          <div className="hidden md:block">
            <InventoryView
              items={filteredInventory}
              selectedIds={selectedShipments}
              onToggleSelect={handleToggleShipment}
              onReviewShipping={() => handleOpenShippingReview(selectedShipments)}
              search={search}
              setSearch={setSearch}
              rarity={rarity}
              setRarity={setRarity}
              type={type}
              setType={setType}
              sort={sort}
              setSort={setSort}
              getAction={getActionForItem}
              totalValue={inventoryTotalValue}
              availableToShip={availableToShip}
              selectedValue={selectedShipmentValue}
            />
          </div>
        </div>
      </div>

      <MobileBottomNav
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onGames={() => setView({ type: 'BOXES' })}
        onRewards={() => setView({ type: 'BONUSES' })}
      />

      {tradeInModalItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#101523] p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">Trade In Item</h3>
              <button onClick={() => setTradeInModalItemId(null)}><X className="h-5 w-5 text-gray-400" /></button>
            </div>
            <p className="text-sm text-gray-300">{tradeInModalItem.name}</p>
            <p className="mt-2 text-sm text-gray-400">You receive:</p>
            <CoinAmount amount={getSellBackValue(toCoins(tradeInModalItem.price, PRICE_UNIT_MODE), getSellBackRate(tradeInModalItem))} formatOptions={{ maximumFractionDigits: 0 }} className="text-xl font-bold text-emerald-400" iconClassName="h-5 w-5" />
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button className="rounded-xl border border-white/10 py-2 text-sm text-gray-200" onClick={() => setTradeInModalItemId(null)}>Cancel</button>
              <button className="rounded-xl bg-gradient-to-r from-purple-600 to-violet-500 py-2 text-sm font-bold text-white" onClick={handleConfirmTradeIn}>
                {isSellingItems[tradeInModalItem.instanceId] ? 'Trading In...' : 'Trade In'}
              </button>
            </div>
          </div>
        </div>
      )}

      {withdrawLockedModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#101523] p-4">
            <h3 className="text-lg font-bold text-white">Withdrawals Locked</h3>
            <p className="mt-2 text-sm text-gray-300">Make your first deposit to unlock withdrawals.</p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button className="rounded-xl border border-white/10 py-2 text-sm text-gray-200" onClick={() => setWithdrawLockedModalOpen(false)}>Not now</button>
              <button className="rounded-xl bg-gradient-to-r from-purple-600 to-violet-500 py-2 text-sm font-bold text-white" onClick={() => { setWithdrawLockedModalOpen(false); setView({ type: 'BONUSES' }); }}>Add Coins</button>
            </div>
          </div>
        </div>
      )}

      {showShippingReview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="w-full max-w-2xl rounded-2xl border border-white/10 bg-[#101523] p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">Review Shipping</h3>
              <button onClick={() => setShowShippingReview(false)}><X className="h-5 w-5 text-gray-400" /></button>
            </div>
            <div className="space-y-2 text-sm text-gray-300">
              <p>{selectedShipmentItems.length} items selected</p>
              <p>Free shipping items: {freeShippingItemCount}</p>
              <p>Paid shipping items: {paidShippingItemCount}</p>
              {activeShippingMethod === 'coins' && <p>Coins due now: {shippingCoinTotal.toLocaleString()}</p>}
              {activeShippingMethod === 'cash' && <p>Cash due now: ${(shippingCashTotalCents / 100).toFixed(2)}</p>}
            </div>
            {hasShippingMethodToggle && (
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button className={`rounded-xl border py-2 text-xs ${activeShippingMethod === 'coins' ? 'border-purple-400/50 text-white' : 'border-white/10 text-gray-400'}`} onClick={() => setShippingPaymentMethod('coins')}>Ship with coins</button>
                <button className={`rounded-xl border py-2 text-xs ${activeShippingMethod === 'cash' ? 'border-purple-400/50 text-white' : 'border-white/10 text-gray-400'}`} onClick={() => setShippingPaymentMethod('cash')}>Ship with cash</button>
              </div>
            )}
            <div className="mt-4 grid grid-cols-1 gap-2">
              {activeShippingMethod === 'cash' && canUseCashShipping ? (
                <button className="rounded-xl bg-gradient-to-r from-purple-600 to-violet-500 py-2 text-sm font-bold text-white" onClick={handleCashShipping} disabled={isSubmittingCashShipping}>
                  {isSubmittingCashShipping ? 'Redirecting...' : 'Continue to Checkout'}
                </button>
              ) : (
                <button className="rounded-xl bg-gradient-to-r from-purple-600 to-violet-500 py-2 text-sm font-bold text-white" onClick={handleConfirmShipping} disabled={isSubmittingShipment}>
                  {isSubmittingShipment ? 'Submitting...' : 'Confirm Shipping'}
                </button>
              )}
              <button className="rounded-xl border border-white/10 py-2 text-sm text-gray-300" onClick={() => setShowShippingReview(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
