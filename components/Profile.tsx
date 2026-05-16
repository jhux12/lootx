import React, { useEffect, useMemo, useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Check, Coins, CreditCard, Package, Tag, Truck, X } from 'lucide-react';
import { useGame } from '../context/GameContext';
import { auth } from '../firebase';
import { EmailAuthProvider, reauthenticateWithCredential, updateEmail as updateFirebaseEmail, updatePassword as updateFirebasePassword } from 'firebase/auth';
import { toast } from '../src/ui/toast/toast';
import { getSellBackValue } from '../utils/sellBack';
import { PRICE_UNIT_MODE, toCoins } from '../utils/coins';
import { CoinAmount } from './CoinAmount';
import { resolveUserDisplayName } from '../utils/userIdentity';
import { InventoryItem, ShippingAddress } from '../types';
import { AccountSidebar } from './profile/AccountSidebar';
import { AccountView } from './profile/AccountView';
import { InventoryView } from './profile/InventoryView';
import { MobileBottomNav } from './profile/MobileBottomNav';

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);
const SHIPPING_BATCH_STORAGE_KEY = 'pullzgg_shipping_batch';


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
  'https://api.dicebear.com/7.x/lorelei/svg?seed=Loot'
];

type MobileTab = 'inventory' | 'account';
type AccountPanel = 'overview' | 'security' | 'settings';

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
  const { user, inventory, boxes, sellItem, shipItem, stripeSettings, openAuthModal, setView, updateAddress, updateUserInfo } = useGame();

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
  const [isSavingAddress, setIsSavingAddress] = useState(false);

  const [activeAccountPanel, setActiveAccountPanel] = useState<AccountPanel>('overview');
  const [isSavingUsername, setIsSavingUsername] = useState(false);
  const [isSavingEmail, setIsSavingEmail] = useState(false);
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [isSavingAvatar, setIsSavingAvatar] = useState(false);
  const [securityForm, setSecurityForm] = useState({
    username: user.name ?? '',
    email: user.email ?? auth.currentUser?.email ?? '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
    avatar: user.avatar
  });

  const [addressForm, setAddressForm] = useState<ShippingAddress>(
    user.shippingAddress || { fullName: '', street: '', city: '', state: '', zipCode: '', country: '' }
  );

  useEffect(() => {
    if (user.shippingAddress) {
      setAddressForm(user.shippingAddress);
    }
  }, [user.shippingAddress]);


  useEffect(() => {
    setSecurityForm((prev) => ({
      ...prev,
      username: user.name ?? '',
      email: user.email ?? auth.currentUser?.email ?? '',
      avatar: user.avatar
    }));
  }, [user.name, user.email]);

  const displayUsername = getProfileUsername(user);
  const dailyFreeBox = useMemo(() => boxes.find((box) => box.isDaily) ?? null, [boxes]);
  const hasDailyFreeBoxAvailable = Boolean(dailyFreeBox) && !user.lastFreeBoxClaim;

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

  const normalizedInventory = useMemo(() => normalizeItems(inventory as InventoryItem[]).sort((a, b) => b.obtainedAt - a.obtainedAt), [inventory]);
  const activeInventory = useMemo(
    () => normalizedInventory.filter((item) => item.status !== 'sold'),
    [normalizedInventory]
  );

  const filteredInventory = useMemo(() => {
    const term = search.trim().toLowerCase();
    const byFilters = activeInventory.filter((item) => {
      const itemType = item.status === 'shipping' || item.status === 'shipping_requested' ? 'shipping' : item.status === 'shipped' ? 'shipped' : 'available';
      return (!term || item.name.toLowerCase().includes(term))
        && (rarity === 'all' || item.rarity === rarity)
        && (type === 'all' || itemType === type);
    });

    return byFilters.sort((a, b) => {
      if (sort === 'valueDesc') return toCoins(b.price, PRICE_UNIT_MODE) - toCoins(a.price, PRICE_UNIT_MODE);
      if (sort === 'valueAsc') return toCoins(a.price, PRICE_UNIT_MODE) - toCoins(b.price, PRICE_UNIT_MODE);
      if (sort === 'nameAsc') return a.name.localeCompare(b.name);
      return b.obtainedAt - a.obtainedAt;
    });
  }, [activeInventory, search, rarity, type, sort]);

  const shippingCoinEnabled = stripeSettings.shippingCoinEnabled;
  const shippingCoinCostCoins = Math.max(0, stripeSettings.shippingCoinCostCoins);
  const shippingCashEnabled = stripeSettings.shippingCashEnabled && stripeSettings.shippingFlatRateCents > 0;
  const shippingFlatRateCents = Math.max(0, stripeSettings.shippingFlatRateCents);

  const isFreeShippingItem = (item: InventoryItem) => item.freeShipping === true || Number(item.shippingCostOverrideCoins ?? NaN) === 0 || Number(item.shippingCostOverrideCents ?? NaN) === 0 || isXpPurchasedItem(item);
  const getCoinShippingCostForItem = (item: InventoryItem) => (isFreeShippingItem(item) ? 0 : shippingCoinCostCoins);
  const getCashShippingCostForItemCents = (item: InventoryItem) => (isFreeShippingItem(item) ? 0 : shippingFlatRateCents);

  const isItemShippable = (item: InventoryItem) => item.status === 'available' && !item.locked && item.shippable !== false;
  const canSelectShipment = (item: InventoryItem) => isItemShippable(item);

  useEffect(() => {
    const selectableIds = new Set(activeInventory.filter((item) => canSelectShipment(item)).map((item) => item.instanceId));
    setSelectedShipments((prev) => prev.filter((id) => selectableIds.has(id)));
  }, [activeInventory, user.shippingAddress]);


  useEffect(() => {
    if (!auth.currentUser) return;

    void (async () => {
      try {
        const token = await auth.currentUser?.getIdToken();
        if (!token) return;

        const response = await fetch('/api/cancel-shipping-checkout-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({})
        });

        if (!response.ok) return;
        const payload = await response.json().catch(() => null) as { released?: boolean; releasedCount?: number } | null;
      } catch {
        // Silent best-effort recovery.
      }
    })();
  }, [auth.currentUser?.uid]);

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

  const selectedShipmentItems = activeInventory.filter((item) => selectedShipments.includes(item.instanceId));
  const shippingCoinTotal = selectedShipmentItems.reduce((sum, item) => sum + getCoinShippingCostForItem(item), 0);
  const shippingCashTotalCents = selectedShipmentItems.reduce((sum, item) => sum + getCashShippingCostForItemCents(item), 0);
  const freeShippingItemCount = selectedShipmentItems.filter((item) => isFreeShippingItem(item)).length;
  const paidShippingItemCount = Math.max(0, selectedShipmentItems.length - freeShippingItemCount);
  const isFreeOnlySelection = selectedShipmentItems.length > 0 && paidShippingItemCount === 0;

  const canUseCoinShipping = !isFreeOnlySelection && shippingCoinEnabled;
  const canUseCashShipping = !isFreeOnlySelection && shippingCashEnabled;
  const hasShippingMethodToggle = canUseCoinShipping && canUseCashShipping;
  const activeShippingMethod = hasShippingMethodToggle ? shippingPaymentMethod : canUseCashShipping ? 'cash' : 'coins';
  const hasMadeDeposit = Number(user.totalSpent ?? 0) > 0;
  const selectedShippingCostLabel = activeShippingMethod === 'cash'
    ? `$${(shippingCashTotalCents / 100).toFixed(2)}`
    : shippingCoinTotal.toLocaleString();
  useEffect(() => {
    if (canUseCoinShipping && canUseCashShipping) return;
    setShippingPaymentMethod(canUseCashShipping ? 'cash' : 'coins');
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

  const handleOpenShippingReview = (instanceIds: string[]) => {
    setSelectedShipments(instanceIds);
    setShippingPaymentMethod(shippingCoinEnabled ? 'coins' : 'cash');
    setShowShippingReview(true);
  };

  const handleSaveAddress = async () => {
    setIsSavingAddress(true);
    try {
      await updateAddress(addressForm);
      toast.success('Shipping address saved!');
    } catch {
      toast.error('Could not save your shipping address.');
    } finally {
      setIsSavingAddress(false);
    }
  };



  const handleSaveAvatar = async () => {
    setIsSavingAvatar(true);
    try {
      await updateUserInfo(user.name, securityForm.avatar || user.avatar);
      toast.success('Profile picture updated.');
    } catch {
      toast.error('Could not update profile picture.');
    } finally {
      setIsSavingAvatar(false);
    }
  };

  const handleSaveUsername = async () => {
    const nextUsername = securityForm.username.trim();
    if (!nextUsername || nextUsername === user.name) {
      toast.info('Enter a new username to update.');
      return;
    }
    setIsSavingUsername(true);
    try {
      await updateUserInfo(nextUsername, securityForm.avatar || user.avatar);
      toast.success('Username updated.');
    } catch (error) {
      console.error('Failed to update username', error);
      toast.error('Could not update username.');
    } finally {
      setIsSavingUsername(false);
    }
  };

  const handleSaveEmail = async () => {
    if (!auth.currentUser) return toast.error('Please sign in again to update your email.');
    const nextEmail = securityForm.email.trim();
    if (!nextEmail || nextEmail === (auth.currentUser.email ?? user.email ?? '')) return toast.info('Enter a different email to update.');
    if (!securityForm.currentPassword.trim()) return toast.error('Current password is required to update email.');
    if (!auth.currentUser.email) return toast.error('Email updates are unavailable for this account type.');
    setIsSavingEmail(true);
    try {
      const credential = EmailAuthProvider.credential(auth.currentUser.email, securityForm.currentPassword.trim());
      await reauthenticateWithCredential(auth.currentUser, credential);
      await updateFirebaseEmail(auth.currentUser, nextEmail);
      setSecurityForm((prev) => ({ ...prev, currentPassword: '' }));
      toast.success('Email updated.');
    } catch (error) {
      console.error('Failed to update email', error);
      toast.error('Could not update email. Please verify your current password.');
    } finally {
      setIsSavingEmail(false);
    }
  };

  const handleSavePassword = async () => {
    if (!auth.currentUser) return toast.error('Please sign in again to update your password.');
    if (!securityForm.newPassword.trim()) return toast.error('Enter a new password.');
    if (securityForm.newPassword !== securityForm.confirmPassword) return toast.error('New passwords do not match.');
    if (!securityForm.currentPassword.trim()) return toast.error('Current password is required to update password.');
    if (!auth.currentUser.email) return toast.error('Password updates are unavailable for this account type.');
    setIsSavingPassword(true);
    try {
      const credential = EmailAuthProvider.credential(auth.currentUser.email, securityForm.currentPassword.trim());
      await reauthenticateWithCredential(auth.currentUser, credential);
      await updateFirebasePassword(auth.currentUser, securityForm.newPassword.trim());
      setSecurityForm((prev) => ({ ...prev, currentPassword: '', newPassword: '', confirmPassword: '' }));
      toast.success('Password updated.');
    } catch (error) {
      console.error('Failed to update password', error);
      toast.error('Could not update password. Please verify your current password.');
    } finally {
      setIsSavingPassword(false);
    }
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
    if (!hasMadeDeposit) {
      toast.info('Make your first deposit to unlock shipping.');
      return;
    }
    if (!user.shippingAddress) {
      toast.info('Please add a shipping address before requesting shipment.');
      setActiveTab('account');
      setActiveAccountPanel('settings');
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
    if (!hasMadeDeposit) {
      toast.info('Make your first deposit to unlock shipping.');
      return;
    }
    if (!auth.currentUser) {
      openAuthModal('login');
      return;
    }
    if (!user.shippingAddress) {
      toast.info('Please add a shipping address before requesting shipment.');
      setActiveTab('account');
      setActiveAccountPanel('settings');
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

  const joinedDate = user.createdAt ? new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric' }).format(user.createdAt) : 'Recently';
  const xp = Number(user.xpBalance ?? user.xp ?? 0);
  const balance = Number(user.balance ?? 0);

  const quickActions = [
    { label: 'Overview', active: activeTab === 'account' && activeAccountPanel === 'overview', onClick: () => { setActiveTab('account'); setActiveAccountPanel('overview'); } },
    { label: 'Inventory', active: activeTab === 'inventory', onClick: () => { setActiveTab('inventory'); } },
    { label: 'Settings', active: activeTab === 'account' && activeAccountPanel === 'settings', onClick: () => { setActiveTab('account'); setActiveAccountPanel('settings'); } },
    { label: 'Security', active: activeTab === 'account' && activeAccountPanel === 'security', onClick: () => { setActiveTab('account'); setActiveAccountPanel('security'); } },
    { label: 'Rewards', onClick: () => setView({ type: 'BONUSES' as const }) },
    { label: 'Referrals', onClick: () => setView({ type: 'REFERRALS' as const }), isNew: true }
  ];

  const inventoryTotalValue = filteredInventory.reduce((sum, item) => sum + toCoins(item.price, PRICE_UNIT_MODE), 0);
  const availableToShip = filteredInventory.filter((item) => canSelectShipment(item)).length;

  const getActionForItem = (item: InventoryItem) => {
    const isAvailable = item.status === 'available';
    const isLocked = !!item.locked;
    const canShip = isItemShippable(item);
    const canSell = isAvailable && !isLocked && item.redeemable !== false && !isXpPurchasedItem(item);

    if (canShip) {
      return {
        label: 'Ship Item',
        disabled: false,
        onClick: () => {
          if (!hasMadeDeposit) {
            setWithdrawLockedModalOpen(true);
            return;
          }
          handleOpenShippingReview([item.instanceId]);
        },
        secondaryLabel: canSell ? 'Trade In' : undefined,
        secondaryDisabled: canSell ? !!isSellingItems[item.instanceId] : undefined,
        onSecondaryClick: canSell ? () => setTradeInModalItemId(item.instanceId) : undefined
      };
    }
    if (canSell) return { label: 'Trade In', disabled: !!isSellingItems[item.instanceId], onClick: () => setTradeInModalItemId(item.instanceId) };
    return { label: 'Not Tradable', disabled: true, onClick: () => undefined };
  };

  const tradeInModalItem = normalizedInventory.find((item) => item.instanceId === tradeInModalItemId) ?? null;

  return (
    <div className="min-h-screen bg-[#1b2024] px-4 py-4 md:px-6 md:py-6">
      <div className="mx-auto flex max-w-[1280px] gap-6 pb-20 md:pb-4">
        <AccountSidebar
          user={user}
          username={displayUsername}
          memberSince={joinedDate}
          xp={xp}
          balance={balance}
          quickActions={quickActions}
          activePanel={activeAccountPanel}
          onSelectPanel={(panel) => {
            setActiveTab('account');
            setActiveAccountPanel(panel);
          }}
        />

        <div className="flex-1">
          <div
            className={`mb-4 grid gap-2 rounded-2xl border border-white/10 bg-[#1f252c] p-1 md:max-w-md ${
              hasDailyFreeBoxAvailable ? 'grid-cols-3' : 'grid-cols-2'
            }`}
          >
            <button className={`rounded-xl py-2 text-sm font-semibold ${activeTab === 'inventory' ? 'bg-purple-600 text-white' : 'text-gray-400'}`} onClick={() => setActiveTab('inventory')}>Inventory</button>
            <button className={`rounded-xl py-2 text-sm font-semibold ${activeTab === 'account' ? 'bg-purple-600 text-white' : 'text-gray-400'}`} onClick={() => { setActiveTab('account'); setActiveAccountPanel('overview'); }}>Profile</button>
            {hasDailyFreeBoxAvailable ? (
              <button
                className="rounded-xl bg-emerald-500/20 px-1 py-2 text-xs font-semibold text-emerald-200"
                onClick={() => {
                  if (!dailyFreeBox) return;
                  setView({ type: 'CASE_OPENING', boxId: dailyFreeBox.id, isFree: true });
                }}
              >
                Free Box
              </button>
            ) : null}
          </div>

          {activeTab === 'inventory' ? (
            <InventoryView
              items={filteredInventory}
              selectedIds={selectedShipments}
              onToggleSelect={(id) => setSelectedShipments((prev) => (prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id]))}
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
              isSelectable={canSelectShipment}
              totalValue={inventoryTotalValue}
              availableToShip={availableToShip}
              selectedValue={selectedShipmentValue}
            />
          ) : (
            <AccountView
              user={user}
              username={displayUsername}
              memberSince={joinedDate}
              xp={xp}
              balance={balance}
              quickActions={quickActions}
              activePanel={activeAccountPanel}
              onSelectPanel={setActiveAccountPanel}
              addressForm={addressForm}
              setAddressForm={setAddressForm}
              onSaveAddress={handleSaveAddress}
              isSavingAddress={isSavingAddress}
              securityForm={securityForm}
              setSecurityForm={setSecurityForm}
              onSaveUsername={handleSaveUsername}
              onSaveEmail={handleSaveEmail}
              onSavePassword={handleSavePassword}
              isSavingUsername={isSavingUsername}
              isSavingEmail={isSavingEmail}
              isSavingPassword={isSavingPassword}
              avatarOptions={AVATAR_PRESETS}
              onSaveAvatar={handleSaveAvatar}
              isSavingAvatar={isSavingAvatar}
            />
          )}
        </div>
      </div>

      <MobileBottomNav activeTab={activeTab} onTabChange={setActiveTab} onGames={() => setView({ type: 'BOXES' })} onRewards={() => setView({ type: 'BONUSES' })} />

      {tradeInModalItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#1f252c] p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">Trade In Item</h3>
              <button onClick={() => setTradeInModalItemId(null)}><X className="h-5 w-5 text-gray-400" /></button>
            </div>
            <p className="text-sm text-gray-300">{tradeInModalItem.name}</p>
            <p className="mt-2 text-sm text-gray-400">You receive:</p>
            <CoinAmount amount={getSellBackValue(toCoins(tradeInModalItem.price, PRICE_UNIT_MODE), getSellBackRate(tradeInModalItem))} formatOptions={{ maximumFractionDigits: 0 }} className="text-xl font-bold text-emerald-400" iconClassName="h-5 w-5" />
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button className="rounded-xl border border-white/10 py-2 text-sm text-gray-200" onClick={() => setTradeInModalItemId(null)}>Cancel</button>
              <button className="rounded-xl bg-gradient-to-r from-purple-600 to-violet-500 py-2 text-sm font-bold text-white" onClick={handleConfirmTradeIn}>{isSellingItems[tradeInModalItem.instanceId] ? 'Trading In...' : 'Trade In'}</button>
            </div>
          </div>
        </div>
      )}

      {showShippingReview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-3 backdrop-blur-sm">
          <div className="max-h-[calc(100dvh-1.5rem)] w-full max-w-[21.5rem] overflow-y-auto rounded-[1.4rem] border border-white/15 bg-[#11131a]/95 p-4 shadow-2xl shadow-purple-950/40 ring-1 ring-white/5 sm:max-w-[23rem] sm:p-5">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-500/25 to-slate-800/80 text-purple-300 shadow-lg shadow-purple-900/20">
                  <Truck className="h-6 w-6" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-2xl font-black leading-tight text-white sm:text-3xl">Review Shipping</h3>
                  <p className="mt-0.5 text-sm font-medium text-slate-400">{selectedShipmentItems.length} {selectedShipmentItems.length === 1 ? 'item' : 'items'} selected</p>
                </div>
              </div>
              <button
                aria-label="Close shipping review"
                className="-mr-1 rounded-full p-1 text-slate-400 transition hover:bg-white/5 hover:text-white"
                onClick={() => setShowShippingReview(false)}
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#141821]/90">
              <div className="flex items-center justify-between gap-3 px-3 py-3 sm:px-4">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-700/25 text-slate-300">
                    <Package className="h-4 w-4" />
                  </span>
                  <span className="truncate text-sm font-semibold text-slate-300 sm:text-base">Free shipping items</span>
                </div>
                <span className="text-sm font-bold text-slate-300 sm:text-base">{freeShippingItemCount}</span>
              </div>
              <div className="h-px bg-white/10" />
              <div className="flex items-center justify-between gap-3 px-3 py-3 sm:px-4">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-purple-500/15 text-purple-300">
                    <Tag className="h-4 w-4" />
                  </span>
                  <span className="truncate text-sm font-semibold text-slate-300 sm:text-base">Paid shipping items</span>
                </div>
                <span className="text-sm font-bold text-slate-300 sm:text-base">{paidShippingItemCount}</span>
              </div>
              <div className="flex items-center justify-between gap-3 bg-gradient-to-r from-purple-500/25 via-purple-500/15 to-transparent px-3 py-3 sm:px-4">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-purple-500/25 text-purple-300 shadow-lg shadow-purple-500/20">
                    {activeShippingMethod === 'cash' ? <CreditCard className="h-5 w-5" /> : <Coins className="h-5 w-5" />}
                  </span>
                  <span className="truncate text-sm font-black text-purple-100 sm:text-base">{activeShippingMethod === 'cash' ? 'Cash due now' : 'Coins due now'}</span>
                </div>
                <span className="text-base font-black text-purple-400 sm:text-lg">{isFreeOnlySelection ? 'Free' : selectedShippingCostLabel}</span>
              </div>
            </div>

            {(canUseCoinShipping || canUseCashShipping) && !isFreeOnlySelection && (
              <div className="mt-4">
                <p className="mb-2 text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Pay with</p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    className={`flex min-h-12 items-center justify-between gap-2 rounded-xl border px-3 text-left transition disabled:cursor-not-allowed disabled:opacity-40 ${activeShippingMethod === 'coins' ? 'border-purple-500 bg-purple-500/10 text-white shadow-[0_0_18px_rgba(168,85,247,0.3)]' : 'border-white/10 bg-transparent text-slate-400 hover:border-white/20'}`}
                    onClick={() => setShippingPaymentMethod('coins')}
                    disabled={!canUseCoinShipping}
                  >
                    <span className="flex items-center gap-2">
                      <Coins className="h-5 w-5 text-purple-400" />
                      <span className="text-sm font-bold sm:text-base">Coins</span>
                    </span>
                    {activeShippingMethod === 'coins' && <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-purple-500 text-white"><Check className="h-4 w-4" /></span>}
                  </button>
                  <button
                    className={`flex min-h-12 items-center justify-center gap-2 rounded-xl border px-3 text-left transition disabled:cursor-not-allowed disabled:opacity-40 ${activeShippingMethod === 'cash' ? 'border-purple-500 bg-purple-500/10 text-white shadow-[0_0_18px_rgba(168,85,247,0.3)]' : 'border-white/10 bg-transparent text-slate-400 hover:border-white/20'}`}
                    onClick={() => setShippingPaymentMethod('cash')}
                    disabled={!canUseCashShipping}
                  >
                    <CreditCard className="h-5 w-5" />
                    <span className="text-sm font-bold sm:text-base">Cash</span>
                    {activeShippingMethod === 'cash' && <span className="ml-auto flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-purple-500 text-white"><Check className="h-4 w-4" /></span>}
                  </button>
                </div>
              </div>
            )}

            <div className="mt-4 space-y-2">
              {activeShippingMethod === 'cash' && canUseCashShipping ? (
                <button className="w-full rounded-xl bg-gradient-to-r from-purple-700 via-purple-600 to-fuchsia-500 px-4 py-3 text-base font-black text-white shadow-lg shadow-purple-950/40 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50" onClick={handleCashShipping} disabled={isSubmittingCashShipping || !hasMadeDeposit}>{isSubmittingCashShipping ? 'Redirecting...' : 'Continue to Checkout'}</button>
              ) : (
                <button className="w-full rounded-xl bg-gradient-to-r from-purple-700 via-purple-600 to-fuchsia-500 px-4 py-3 text-base font-black text-white shadow-lg shadow-purple-950/40 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50" onClick={handleConfirmShipping} disabled={isSubmittingShipment || !hasMadeDeposit}>{isSubmittingShipment ? 'Submitting...' : isFreeOnlySelection ? 'Confirm Free Shipping' : 'Confirm Shipping'}</button>
              )}
              <button className="w-full rounded-xl border border-white/10 px-4 py-3 text-base font-bold text-slate-300 transition hover:bg-white/5 hover:text-white" onClick={() => setShowShippingReview(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {withdrawLockedModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#1f252c] p-4">
            <h3 className="text-lg font-bold text-white">Withdrawals Locked</h3>
            <p className="mt-2 text-sm text-gray-300">Make your first deposit to unlock withdrawals.</p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button className="rounded-xl border border-white/10 py-2 text-sm text-gray-200" onClick={() => setWithdrawLockedModalOpen(false)}>Not now</button>
              <button className="rounded-xl bg-gradient-to-r from-purple-600 to-violet-500 py-2 text-sm font-bold text-white" onClick={() => { setWithdrawLockedModalOpen(false); setView({ type: 'BONUSES' }); }}>Add Coins</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
