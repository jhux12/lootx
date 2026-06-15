import React, { useEffect, useMemo, useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Check, ChevronDown, Coins, Copy, CreditCard, Info, PackageCheck, Plus, Truck, X } from 'lucide-react';
import { useGame } from '../context/GameContext';
import { auth } from '../firebase';
import { EmailAuthProvider, reauthenticateWithCredential, updateEmail as updateFirebaseEmail, updatePassword as updateFirebasePassword } from 'firebase/auth';
import { toast } from '../src/ui/toast/toast';
import { getSellBackValue } from '../utils/sellBack';
import { PRICE_UNIT_MODE, toCoins } from '../utils/coins';
import { SIGNATURE_REQUIRED_CENTS, formatShippingAddOnPrice, formatShippingTierSummary, getShipmentShippingRate, getShippingProtectionRate } from '../utils/shippingRates';
import { CoinAmount } from './CoinAmount';
import { resolveUserDisplayName } from '../utils/userIdentity';
import { InventoryItem, Shipment, ShippingAddress } from '../types';
import { hasUserMadeDeposit } from '../utils/depositEligibility';
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

type MobileTab = 'inventory' | 'orders' | 'account';
type AccountPanel = 'overview' | 'security' | 'settings';

const getProfileUsername = (profile: { provider?: string; username?: string; name?: string; email?: string }) => resolveUserDisplayName(profile);


type OrderSummary = {
  id: string;
  inventoryId?: string;
  name: string;
  image: string;
  rarity: InventoryItem['rarity'];
  value: number;
  status: 'pending' | 'shipped';
  trackingNumber?: string;
  createdAt?: number;
  shippedAt?: number;
  size?: string | null;
};

const formatOrderDate = (timestamp?: number) => {
  if (!timestamp) return 'Date unavailable';
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(timestamp);
};

const OrdersView: React.FC<{ orders: OrderSummary[] }> = ({ orders }) => {
  const shippedCount = orders.filter((order) => order.status === 'shipped').length;
  const pendingCount = orders.filter((order) => order.status === 'pending').length;
  const [copiedTrackingId, setCopiedTrackingId] = useState<string | null>(null);

  const handleCopyTracking = async (orderId: string, trackingNumber: string) => {
    try {
      await navigator.clipboard.writeText(trackingNumber);
      setCopiedTrackingId(orderId);
      window.setTimeout(() => {
        setCopiedTrackingId((currentId) => (currentId === orderId ? null : currentId));
      }, 1400);
      toast.success('Tracking copied.');
    } catch (error) {
      console.error('Unable to copy tracking number', error);
      toast.error('Could not copy tracking number.');
    }
  };

  return (
    <section className="mx-auto w-full max-w-3xl space-y-4">
      <header className="flex flex-col gap-3 min-[420px]:flex-row min-[420px]:items-end min-[420px]:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Orders</h2>
          <p className="text-sm text-gray-400">Pending and shipped rewards, with tracking details when available.</p>
        </div>
        <div className="w-fit rounded-2xl border border-white/10 bg-[#1f252c] px-3 py-2 text-sm text-gray-300 sm:px-4 sm:py-3">
          <span className="font-bold text-white">{pendingCount}</span> pending • <span className="font-bold text-white">{shippedCount}</span> shipped
        </div>
      </header>

      {orders.length === 0 ? (
        <div className="rounded-3xl border border-white/10 bg-[#1f252c] p-8 text-center sm:p-10">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white/5 text-blue-300">
            <PackageCheck className="h-7 w-7" />
          </div>
          <h3 className="mt-4 text-lg font-bold text-white">No orders yet</h3>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-gray-400">
            Once your physical rewards ship, they will appear here with tracking when available.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => (
            <article
              key={order.id}
              className="rounded-2xl border border-white/10 bg-[#1f252c] p-3 shadow-[0_16px_40px_rgba(0,0,0,0.18)] transition hover:border-white/15 sm:rounded-3xl sm:p-4"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-[#111720] p-2 min-[420px]:h-16 min-[420px]:w-16 sm:h-20 sm:w-20">
                    <img src={order.image} alt={order.name} className="h-full w-full object-contain" loading="lazy" decoding="async" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full border border-emerald-400/25 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-emerald-200">
                        {order.status === 'pending' ? 'Pending' : 'Shipped'}
                      </span>
                      <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-gray-300">
                        {order.rarity}
                      </span>
                    </div>
                    <h3 className="mt-2 line-clamp-2 text-base font-bold leading-snug text-white sm:truncate sm:text-lg">{order.name}</h3>
                    <p className="mt-1 text-xs text-gray-500">Order #{order.id.slice(0, 8)}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-2 sm:w-[21rem]">
                  <div className="rounded-2xl border border-white/10 bg-[#171d24] px-3 py-2">
                    <p className="text-[11px] font-bold uppercase tracking-wide text-gray-500">{order.status === 'pending' ? 'Requested' : 'Shipped'}</p>
                    <p className="mt-1 text-sm font-semibold text-white">{formatOrderDate(order.status === 'pending' ? order.createdAt : (order.shippedAt ?? order.createdAt))}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-[#171d24] px-3 py-2">
                    <p className="text-[11px] font-bold uppercase tracking-wide text-gray-500">Tracking</p>
                    {order.trackingNumber ? (
                      <div className="mt-1 flex items-start gap-2">
                        <p className="min-w-0 break-all pr-1 text-sm font-semibold text-blue-200">{order.trackingNumber}</p>
                        {order.status === 'shipped' ? (
                          <button
                            type="button"
                            onClick={() => { void handleCopyTracking(order.id, order.trackingNumber as string); }}
                            className="shrink-0 rounded-md border border-blue-300/25 bg-blue-500/10 p-1.5 text-blue-100 transition hover:bg-blue-500/20 focus:outline-none focus:ring-2 focus:ring-blue-300/50"
                            aria-label={copiedTrackingId === order.id ? 'Tracking number copied' : 'Copy tracking number'}
                          >
                            {copiedTrackingId === order.id ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                          </button>
                        ) : null}
                      </div>
                    ) : (
                      <p className="mt-1 text-sm font-semibold text-gray-400">Not available</p>
                    )}
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
};

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
  const { user, inventory, shipments, boxes, sellItem, shipItem, stripeSettings, openAuthModal, setView, updateAddress, updateUserInfo } = useGame();

  const [activeTab, setActiveTab] = useState<MobileTab>('inventory');
  const [search, setSearch] = useState('');
  const [rarity, setRarity] = useState('all');
  const [type, setType] = useState('all');
  const [sort, setSort] = useState('newest');
  const [selectedShipments, setSelectedShipments] = useState<string[]>([]);
  const [showShippingReview, setShowShippingReview] = useState(false);
  const [showShippingRateTooltip, setShowShippingRateTooltip] = useState(false);
  const [shippingPaymentMethod, setShippingPaymentMethod] = useState<'coins' | 'cash'>('coins');
  const [shippingProtectionSelected, setShippingProtectionSelected] = useState(false);
  const [signatureRequiredSelected, setSignatureRequiredSelected] = useState(false);
  const [showShippingProtectionInfo, setShowShippingProtectionInfo] = useState(false);
  const [showSignatureRequiredInfo, setShowSignatureRequiredInfo] = useState(false);
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
    () => normalizedInventory.filter((item) => item.status !== 'sold' && item.status !== 'shipping' && item.status !== 'shipping_requested' && item.status !== 'shipped'),
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

  const orders = useMemo<OrderSummary[]>(() => {
    const pendingStatuses = new Set(['shipping', 'shipping_requested']);
    const shipmentOrders = (shipments as Shipment[])
      .filter((shipment) => shipment.uid === user.id && (shipment.status === 'shipped' || pendingStatuses.has(shipment.status)))
      .map((shipment) => ({
        id: shipment.id,
        inventoryId: shipment.inventoryId,
        name: shipment.item.name,
        image: shipment.item.image,
        rarity: shipment.item.rarity,
        value: shipment.item.value,
        status: shipment.status === 'shipped' ? 'shipped' as const : 'pending' as const,
        trackingNumber: shipment.trackingNumber,
        createdAt: shipment.createdAt,
        shippedAt: shipment.updatedAt,
        size: shipment.item.size
      } as OrderSummary));

    const shipmentInventoryIds = new Set(shipmentOrders.map((order) => order.inventoryId).filter(Boolean));
    const inventoryOrders = normalizedInventory
      .filter((item) => (item.status === 'shipped' || item.status === 'shipping' || item.status === 'shipping_requested') && !shipmentInventoryIds.has(item.instanceId))
      .map((item) => ({
        id: item.instanceId,
        inventoryId: item.instanceId,
        name: item.name,
        image: item.image,
        rarity: item.rarity,
        value: toCoins(item.price, PRICE_UNIT_MODE),
        status: item.status === 'shipped' ? 'shipped' as const : 'pending' as const,
        trackingNumber: item.trackingNumber,
        createdAt: item.obtainedAt,
        shippedAt: item.history?.find((entry) => entry.action === 'shipped')?.createdAt ?? item.obtainedAt,
        size: item.size ?? null
      }));

    return [...shipmentOrders, ...inventoryOrders].sort((a, b) => (b.createdAt ?? b.shippedAt ?? 0) - (a.createdAt ?? a.shippedAt ?? 0));
  }, [normalizedInventory, shipments, user.id]);

  const shippingCoinEnabled = stripeSettings.shippingCoinEnabled;
  const shippingCashEnabled = stripeSettings.shippingCashEnabled;

  const isFreeShippingItem = (item: InventoryItem) => item.freeShipping === true || Number(item.shippingCostOverrideCoins ?? NaN) === 0 || Number(item.shippingCostOverrideCents ?? NaN) === 0 || isXpPurchasedItem(item);

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
  const shipmentPreviewItems = selectedShipmentItems.slice(0, 6);
  const hiddenShipmentItemCount = Math.max(0, selectedShipmentItems.length - shipmentPreviewItems.length);
  const selectedShipmentValue = selectedShipmentItems.reduce((sum, item) => sum + toCoins(item.price, PRICE_UNIT_MODE), 0);
  const paidShipmentValue = selectedShipmentItems.reduce((sum, item) => sum + (isFreeShippingItem(item) ? 0 : toCoins(item.price, PRICE_UNIT_MODE)), 0);
  const shipmentRate = getShipmentShippingRate(paidShipmentValue);
  const protectionRate = getShippingProtectionRate(paidShipmentValue);
  const addOnCashTotalCents = (shippingProtectionSelected ? protectionRate.cashCents : 0) + (signatureRequiredSelected ? SIGNATURE_REQUIRED_CENTS : 0);
  const shippingCoinTotal = shipmentRate.coinCost + addOnCashTotalCents;
  const shippingCashTotalCents = shipmentRate.cashCents + addOnCashTotalCents;
  const freeShippingItemCount = selectedShipmentItems.filter((item) => isFreeShippingItem(item)).length;
  const paidShippingItemCount = Math.max(0, selectedShipmentItems.length - freeShippingItemCount);
  const isFreeOnlySelection = selectedShipmentItems.length > 0 && paidShippingItemCount === 0;

  const canUseCoinShipping = !isFreeOnlySelection && shippingCoinEnabled;
  const canUseCashShipping = !isFreeOnlySelection && shippingCashEnabled;
  const hasShippingMethodToggle = canUseCoinShipping && canUseCashShipping;
  const activeShippingMethod = hasShippingMethodToggle ? shippingPaymentMethod : canUseCashShipping ? 'cash' : 'coins';
  const hasMadeDeposit = hasUserMadeDeposit(user);
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

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    window.dispatchEvent(new CustomEvent('pullz:header-visibility', { detail: { hidden: showShippingReview } }));
    window.dispatchEvent(new CustomEvent('pullz:mobile-bottom-nav-visibility', { detail: { hidden: showShippingReview } }));

    return () => {
      window.dispatchEvent(new CustomEvent('pullz:header-visibility', { detail: { hidden: false } }));
      window.dispatchEvent(new CustomEvent('pullz:mobile-bottom-nav-visibility', { detail: { hidden: false } }));
    };
  }, [showShippingReview]);

  const handleOpenShippingReview = (instanceIds: string[]) => {
    setSelectedShipments(instanceIds);
    setShippingPaymentMethod(shippingCoinEnabled ? 'coins' : 'cash');
    setShowShippingRateTooltip(false);
    setShippingProtectionSelected(false);
    setSignatureRequiredSelected(false);
    setShowShippingProtectionInfo(false);
    setShowSignatureRequiredInfo(false);
    setShowShippingReview(true);
  };

  const handleAddMoreShipmentItems = () => {
    setShowShippingRateTooltip(false);
    setShowShippingReview(false);
    setActiveTab('inventory');
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
      await shipItem(itemsToShip.map((item) => item.instanceId), { shippingProtection: shippingProtectionSelected, signatureRequired: signatureRequiredSelected });
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
        body: JSON.stringify({ inventoryIds: itemsToShip.map((item) => item.instanceId), shippingProtection: shippingProtectionSelected, signatureRequired: signatureRequiredSelected })
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
    { label: 'Orders', active: activeTab === 'orders', onClick: () => { setActiveTab('orders'); } },
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
          <div className="mb-4 flex w-fit max-w-full gap-1 overflow-x-auto rounded-2xl border border-white/10 bg-[#1f252c] p-1 [scrollbar-width:none] md:max-w-md [&::-webkit-scrollbar]:hidden">
            <button className={`shrink-0 rounded-xl px-4 py-2 text-sm font-semibold ${activeTab === 'inventory' ? 'bg-[#205DD7] text-white' : 'text-gray-400'}`} onClick={() => setActiveTab('inventory')}>Inventory</button>
            <button className={`shrink-0 rounded-xl px-4 py-2 text-sm font-semibold ${activeTab === 'orders' ? 'bg-[#205DD7] text-white' : 'text-gray-400'}`} onClick={() => setActiveTab('orders')}>Orders</button>
            <button className={`shrink-0 rounded-xl px-4 py-2 text-sm font-semibold ${activeTab === 'account' ? 'bg-[#205DD7] text-white' : 'text-gray-400'}`} onClick={() => { setActiveTab('account'); setActiveAccountPanel('overview'); }}>Profile</button>
            {hasDailyFreeBoxAvailable ? (
              <button
                className="shrink-0 rounded-xl bg-emerald-500/20 px-3 py-2 text-xs font-semibold text-emerald-200"
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
          ) : activeTab === 'orders' ? (
            <OrdersView orders={orders} />
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

      {!showShippingReview && <MobileBottomNav activeTab={activeTab} onTabChange={setActiveTab} onGames={() => setView({ type: 'BOXES' })} onRewards={() => setView({ type: 'BONUSES' })} />}

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
              <button className="rounded-xl bg-gradient-to-r from-[#205DD7] to-sky-500 py-2 text-sm font-bold text-white" onClick={handleConfirmTradeIn}>{isSellingItems[tradeInModalItem.instanceId] ? 'Trading In...' : 'Trade In'}</button>
            </div>
          </div>
        </div>
      )}

      {showShippingReview && (
        <div className="fixed inset-0 z-[260] flex items-center justify-center bg-black/85 p-3 backdrop-blur-sm">
          <div className="max-h-[calc(100dvh-1.5rem)] w-full max-w-[21.5rem] overflow-y-auto rounded-[1.4rem] border border-white/15 bg-[#11131a]/95 p-4 shadow-2xl shadow-blue-950/40 ring-1 ring-white/5 sm:max-w-[23rem] sm:p-5">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#205DD7]/25 to-slate-800/80 text-blue-300 shadow-lg shadow-blue-900/20">
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
                onClick={() => { setShowShippingRateTooltip(false); setShowShippingReview(false); }}
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#141821]/90">
              <div className="px-3 py-3 sm:px-4" aria-label={`${selectedShipmentItems.length} shipment items selected`}>
                <div className="flex items-center gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  <button
                    type="button"
                    aria-label="Go back to inventory to add more shipment items"
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-dashed border-blue-300/45 bg-blue-500/5 text-blue-100 transition hover:border-blue-200/70 hover:bg-blue-500/15 focus:outline-none focus:ring-2 focus:ring-blue-300/60 sm:h-14 sm:w-14"
                    onClick={handleAddMoreShipmentItems}
                  >
                    <Plus className="h-5 w-5 sm:h-6 sm:w-6" />
                  </button>
                  {shipmentPreviewItems.map((item) => (
                    <div
                      key={item.instanceId}
                      className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-[#0b0e14] p-1 shadow-inner shadow-black/20 sm:h-14 sm:w-14"
                      title={item.name}
                    >
                      <img src={item.image} alt={item.name} className="h-full w-full object-contain" />
                    </div>
                  ))}
                  {hiddenShipmentItemCount > 0 && (
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-dashed border-white/15 bg-white/5 text-sm font-black text-blue-100 sm:h-14 sm:w-14">
                      +{hiddenShipmentItemCount}
                    </div>
                  )}
                </div>
              </div>
              <div className="h-px bg-white/10" />
              <div className="flex items-center justify-between gap-3 bg-gradient-to-r from-[#205DD7]/25 via-blue-500/15 to-transparent px-3 py-3 sm:px-4">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-500/25 text-blue-300 shadow-lg shadow-blue-500/20">
                    {activeShippingMethod === 'cash' ? <CreditCard className="h-5 w-5" /> : <Coins className="h-5 w-5" />}
                  </span>
                  <span className="truncate text-sm font-black text-blue-100 sm:text-base">{activeShippingMethod === 'cash' ? 'Cash due now' : 'Coins due now'}</span>
                  {!isFreeOnlySelection && (
                    <button
                      type="button"
                      aria-label={`Shipment cost details. ${formatShippingTierSummary()}`}
                      aria-expanded={showShippingRateTooltip}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-blue-300/20 bg-blue-400/10 text-blue-100 transition hover:bg-blue-400/20 focus:outline-none focus:ring-2 focus:ring-blue-300/60"
                      onClick={() => setShowShippingRateTooltip((open) => !open)}
                    >
                      <Info className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <span className="text-base font-black text-blue-400 sm:text-lg">{isFreeOnlySelection ? 'Free' : selectedShippingCostLabel}</span>
              </div>
            </div>
            {!isFreeOnlySelection && showShippingRateTooltip && (
              <div className="relative mt-3 rounded-2xl border border-blue-400/25 bg-[#0d1b34] px-3 py-3 text-xs shadow-xl shadow-blue-950/30 sm:px-4 sm:text-sm">
                <div className="absolute -top-2 left-8 h-4 w-4 rotate-45 border-l border-t border-blue-400/25 bg-[#0d1b34]" />
                <div className="relative space-y-2">
                  <div className="font-black text-blue-100">Shipment rate for {shipmentRate.tierLabel}</div>
                  <div className="grid grid-cols-1 gap-1.5 text-slate-300 sm:grid-cols-3">
                    <div className="rounded-lg bg-white/5 px-2.5 py-2"><span className="font-bold text-white">&lt;$20</span><span className="float-right font-black text-blue-300">$3.99</span></div>
                    <div className="rounded-lg bg-white/5 px-2.5 py-2"><span className="font-bold text-white">$20–$75</span><span className="float-right font-black text-blue-300">$6.99</span></div>
                    <div className="rounded-lg bg-white/5 px-2.5 py-2"><span className="font-bold text-white">$75+</span><span className="float-right font-black text-blue-300">$12.99</span></div>
                  </div>
                </div>
              </div>
            )}

            {!isFreeOnlySelection && (
              <div className="mt-4 space-y-1.5">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Add-ons</p>
                <div className={`rounded-xl border transition ${shippingProtectionSelected ? 'border-blue-500 bg-blue-500/10 shadow-[0_0_14px_rgba(32,93,215,0.18)]' : 'border-white/10 bg-white/[0.03] hover:border-white/20'}`}>
                  <div className="flex min-h-10 items-center gap-2 px-2.5 py-2">
                    <input id="shipping-protection-addon" type="checkbox" className="h-4 w-4 shrink-0 accent-blue-500" checked={shippingProtectionSelected} onChange={(event) => setShippingProtectionSelected(event.target.checked)} />
                    <label htmlFor="shipping-protection-addon" className="min-w-0 flex-1 cursor-pointer text-xs font-black text-white sm:text-sm">Shipping protection</label>
                    <span className="shrink-0 rounded-full bg-blue-500/15 px-2 py-0.5 text-[11px] font-black text-blue-200">{formatShippingAddOnPrice(protectionRate.cashCents, activeShippingMethod)}</span>
                    <button type="button" className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-slate-400 transition hover:bg-white/5 hover:text-white" aria-label="Toggle shipping protection details" aria-expanded={showShippingProtectionInfo} onClick={() => setShowShippingProtectionInfo((open) => !open)}>
                      <ChevronDown className={`h-4 w-4 transition-transform ${showShippingProtectionInfo ? 'rotate-180' : ''}`} />
                    </button>
                  </div>
                  {showShippingProtectionInfo && (
                    <div className="border-t border-white/10 px-2.5 pb-2 pt-1.5 text-xs leading-relaxed text-slate-400">
                      <span className="flex items-start gap-1.5"><Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blue-300" />Covers lost packages and damage in transit.</span>
                    </div>
                  )}
                </div>
                <div className={`rounded-xl border transition ${signatureRequiredSelected ? 'border-blue-500 bg-blue-500/10 shadow-[0_0_14px_rgba(32,93,215,0.18)]' : 'border-white/10 bg-white/[0.03] hover:border-white/20'}`}>
                  <div className="flex min-h-10 items-center gap-2 px-2.5 py-2">
                    <input id="signature-required-addon" type="checkbox" className="h-4 w-4 shrink-0 accent-blue-500" checked={signatureRequiredSelected} onChange={(event) => setSignatureRequiredSelected(event.target.checked)} />
                    <label htmlFor="signature-required-addon" className="min-w-0 flex-1 cursor-pointer text-xs font-black text-white sm:text-sm">Signature required</label>
                    <span className="shrink-0 rounded-full bg-blue-500/15 px-2 py-0.5 text-[11px] font-black text-blue-200">{formatShippingAddOnPrice(SIGNATURE_REQUIRED_CENTS, activeShippingMethod)}</span>
                    <button type="button" className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-slate-400 transition hover:bg-white/5 hover:text-white" aria-label="Toggle signature required details" aria-expanded={showSignatureRequiredInfo} onClick={() => setShowSignatureRequiredInfo((open) => !open)}>
                      <ChevronDown className={`h-4 w-4 transition-transform ${showSignatureRequiredInfo ? 'rotate-180' : ''}`} />
                    </button>
                  </div>
                  {showSignatureRequiredInfo && (
                    <div className="border-t border-white/10 px-2.5 pb-2 pt-1.5 text-xs leading-relaxed text-slate-400">
                      <span className="flex items-start gap-1.5"><Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blue-300" />Requires a delivery signature for extra handoff security.</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {(canUseCoinShipping || canUseCashShipping) && !isFreeOnlySelection && (
              <div className="mt-4">
                <p className="mb-2 text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Pay with</p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    className={`flex min-h-12 items-center justify-between gap-2 rounded-xl border px-3 text-left transition disabled:cursor-not-allowed disabled:opacity-40 ${activeShippingMethod === 'coins' ? 'border-blue-500 bg-blue-500/10 text-white shadow-[0_0_18px_rgba(32,93,215,0.3)]' : 'border-white/10 bg-transparent text-slate-400 hover:border-white/20'}`}
                    onClick={() => setShippingPaymentMethod('coins')}
                    disabled={!canUseCoinShipping}
                  >
                    <span className="flex items-center gap-2">
                      <Coins className="h-5 w-5 text-blue-400" />
                      <span className="text-sm font-bold sm:text-base">Coins</span>
                    </span>
                    {activeShippingMethod === 'coins' && <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-500 text-white"><Check className="h-4 w-4" /></span>}
                  </button>
                  <button
                    className={`flex min-h-12 items-center justify-center gap-2 rounded-xl border px-3 text-left transition disabled:cursor-not-allowed disabled:opacity-40 ${activeShippingMethod === 'cash' ? 'border-blue-500 bg-blue-500/10 text-white shadow-[0_0_18px_rgba(32,93,215,0.3)]' : 'border-white/10 bg-transparent text-slate-400 hover:border-white/20'}`}
                    onClick={() => setShippingPaymentMethod('cash')}
                    disabled={!canUseCashShipping}
                  >
                    <CreditCard className="h-5 w-5" />
                    <span className="text-sm font-bold sm:text-base">Cash</span>
                    {activeShippingMethod === 'cash' && <span className="ml-auto flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-500 text-white"><Check className="h-4 w-4" /></span>}
                  </button>
                </div>
              </div>
            )}

            <div className="mt-4 space-y-2">
              {activeShippingMethod === 'cash' && canUseCashShipping ? (
                <button className="w-full rounded-xl bg-gradient-to-r from-[#205DD7] via-blue-600 to-sky-500 px-4 py-3 text-base font-black text-white shadow-lg shadow-blue-950/40 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50" onClick={handleCashShipping} disabled={isSubmittingCashShipping || !hasMadeDeposit}>{isSubmittingCashShipping ? 'Redirecting...' : 'Continue to Checkout'}</button>
              ) : (
                <button className="w-full rounded-xl bg-gradient-to-r from-[#205DD7] via-blue-600 to-sky-500 px-4 py-3 text-base font-black text-white shadow-lg shadow-blue-950/40 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50" onClick={handleConfirmShipping} disabled={isSubmittingShipment || !hasMadeDeposit}>{isSubmittingShipment ? 'Submitting...' : isFreeOnlySelection ? 'Confirm Free Shipping' : 'Confirm Shipping'}</button>
              )}
              <button className="w-full rounded-xl border border-white/10 px-4 py-3 text-base font-bold text-slate-300 transition hover:bg-white/5 hover:text-white" onClick={() => { setShowShippingRateTooltip(false); setShowShippingReview(false); }}>Cancel</button>
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
              <button className="rounded-xl bg-gradient-to-r from-[#205DD7] to-sky-500 py-2 text-sm font-bold text-white" onClick={() => { setWithdrawLockedModalOpen(false); setView({ type: 'BONUSES' }); }}>Add Coins</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
