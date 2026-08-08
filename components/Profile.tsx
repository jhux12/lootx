import React, { useEffect, useMemo, useState } from 'react';
import { getStripe } from '../utils/stripeClient';
import { Check, ChevronDown, ChevronLeft, ChevronRight, Clock, Coins, Copy, CreditCard, Edit3, ExternalLink, Filter, Info, MapPin, Package, PackageCheck, Plus, Search, ShieldCheck, Truck, X } from 'lucide-react';
import { useGame } from '../context/GameContext';
import { auth } from '../firebase';
import { EmailAuthProvider, reauthenticateWithCredential, updateEmail as updateFirebaseEmail, updatePassword as updateFirebasePassword } from 'firebase/auth';
import { toast } from '../src/ui/toast/toast';
import { getSellBackValue } from '../utils/sellBack';
import { PRICE_UNIT_MODE, toCoins } from '../utils/coins';
import { formatShippingAddOnPrice, formatShippingTierSummary, getShipmentShippingRate, getShippingProtectionRate } from '../utils/shippingRates';
import { hasUserMadeDeposit } from '../utils/depositEligibility';
import { CoinAmount } from './CoinAmount';
import { resolveUserDisplayName } from '../utils/userIdentity';
import { AddressValidationResult, InventoryItem, Shipment, ShippingAddress } from '../types';
import { emptyShippingAddress, normalizeStoredShippingAddress, validateShippingAddress } from '../src/lib/shippingAddress';
import { AccountView } from './profile/AccountView';
import { InventoryView } from './profile/InventoryView';
import { MobileBottomNav } from './profile/MobileBottomNav';
import { UserAvatar } from './UserAvatar';
import { COIN_ICON, XP_ICON } from '../constants';
import { AnimatedNumber } from '../src/ui/numbers/AnimatedNumber';
import { coinsToUsd, trackShippingRequested, trackShippingStart } from '../services/analytics';

const SHIPPING_BATCH_STORAGE_KEY = 'pullzgg_shipping_batch';




type MobileTab = 'inventory' | 'orders' | 'account';
type AccountPanel = 'overview' | 'security' | 'settings';

const getProfileUsername = (profile: { provider?: string; username?: string; name?: string; email?: string }) => resolveUserDisplayName(profile);


type OrderSummary = {
  id: string;
  orderGroupId: string;
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


type OrderGroupSummary = {
  id: string;
  items: OrderSummary[];
  status: OrderSummary['status'];
  trackingNumber?: string;
  createdAt?: number;
  shippedAt?: number;
};

const getRarityBadgeClass = (rarity: InventoryItem['rarity']) => {
  switch (rarity) {
    case 'legendary':
      return 'border-yellow-200/60 bg-yellow-400/20 text-yellow-50 shadow-[0_0_18px_rgba(250,204,21,0.14)]';
    case 'epic':
      return 'border-purple-400/40 bg-purple-500/10 text-purple-200';
    case 'rare':
      return 'border-blue-400/40 bg-blue-500/10 text-blue-200';
    case 'uncommon':
      return 'border-emerald-400/35 bg-emerald-500/10 text-emerald-200';
    default:
      return 'border-white/15 bg-white/5 text-gray-300';
  }
};

const getCompactOrderDate = (timestamp?: number) => {
  if (!timestamp) return 'Date unavailable';
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(timestamp);
};

const OrdersView: React.FC<{ orders: OrderSummary[] }> = ({ orders }) => {
  const orderGroups = useMemo<OrderGroupSummary[]>(() => {
    const groups = new Map<string, OrderSummary[]>();

    orders.forEach((order) => {
      const groupId = order.orderGroupId || order.id;
      groups.set(groupId, [...(groups.get(groupId) ?? []), order]);
    });

    return Array.from(groups.entries())
      .map(([id, items]) => {
        const sortedItems = [...items].sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
        const status: OrderSummary['status'] = sortedItems.every((item) => item.status === 'shipped') ? 'shipped' : 'pending';
        return {
          id,
          items: sortedItems,
          status,
          trackingNumber: sortedItems.find((item) => item.trackingNumber)?.trackingNumber,
          createdAt: Math.min(...sortedItems.map((item) => item.createdAt ?? item.shippedAt ?? Date.now())),
          shippedAt: Math.max(...sortedItems.map((item) => item.shippedAt ?? item.createdAt ?? 0)) || undefined
        };
      })
      .sort((a, b) => (b.createdAt ?? b.shippedAt ?? 0) - (a.createdAt ?? a.shippedAt ?? 0));
  }, [orders]);

  const shippedCount = orderGroups.filter((order) => order.status === 'shipped').length;
  const pendingCount = orderGroups.filter((order) => order.status === 'pending').length;
  const [copiedTrackingId, setCopiedTrackingId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'shipped'>('all');
  const [orderSearch, setOrderSearch] = useState('');
  const [activeItemIndexes, setActiveItemIndexes] = useState<Record<string, number>>({});
  const [expandedOrderIds, setExpandedOrderIds] = useState<Set<string>>(new Set());

  const filteredOrders = useMemo(() => {
    const term = orderSearch.trim().toLowerCase();
    return orderGroups.filter((order) => {
      const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
      const matchesSearch = !term
        || order.id.toLowerCase().includes(term)
        || order.items.some((item) => item.name.toLowerCase().includes(term) || item.id.toLowerCase().includes(term) || (item.trackingNumber ?? '').toLowerCase().includes(term));
      return matchesStatus && matchesSearch;
    });
  }, [orderGroups, orderSearch, statusFilter]);

  const activeFilterCount = (statusFilter === 'all' ? 0 : 1) + (orderSearch.trim() ? 1 : 0);

  const setActiveItemIndex = (orderId: string, itemCount: number, direction: -1 | 1) => {
    setActiveItemIndexes((current) => {
      const currentIndex = current[orderId] ?? 0;
      return { ...current, [orderId]: (currentIndex + direction + itemCount) % itemCount };
    });
  };

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

  const filterTabs: Array<{ id: 'all' | 'pending' | 'shipped'; label: string }> = [
    { id: 'all', label: 'All' },
    { id: 'pending', label: 'Pending' },
    { id: 'shipped', label: 'Shipped' }
  ];

  return (
    <section className="w-full bg-[#08080a] px-5 pb-6 sm:px-10">
      <div className="mb-4 flex items-center justify-between">
        <div><h2 className="text-base font-black text-white">History</h2><p className="mt-1 text-xs text-[#68686f]">Your shipped and pending rewards.</p></div>
        <span className="rounded-full bg-[#1a1a1e] px-3 py-1.5 text-xs font-bold text-[#aaaab0]">{orderGroups.length} orders</span>
      </div>
      {orderGroups.length === 0 ? (
        <div className="rounded-xl border border-white/[0.07] bg-[#111116] px-5 py-12 text-center"><PackageCheck className="mx-auto h-8 w-8 text-[#6c6c74]" /><p className="mt-3 text-sm font-bold text-white">No order history yet</p><p className="mt-1 text-xs text-[#66666d]">Shipped rewards will appear here.</p></div>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {orderGroups.map((orderGroup) => {
            const activeIndex = Math.min(activeItemIndexes[orderGroup.id] ?? 0, orderGroup.items.length - 1);
            const order = orderGroup.items[activeIndex] ?? orderGroup.items[0];
            const isExpanded = expandedOrderIds.has(orderGroup.id);
            const trackingNumber = orderGroup.trackingNumber;
            const toggleExpanded = () => setExpandedOrderIds((current) => {
              const next = new Set(current);
              if (next.has(orderGroup.id)) next.delete(orderGroup.id); else next.add(orderGroup.id);
              return next;
            });
            return <article key={orderGroup.id} className="min-w-0 overflow-hidden rounded-xl border border-white/[0.07] bg-[#111116] transition hover:border-white/15">
              <div className="flex items-center gap-3 p-3">
                <div className="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-[#09090c] p-1.5"><img src={order.image} alt={order.name} className="h-full w-full object-contain" loading="lazy" />{orderGroup.items.length > 1 ? <span className="absolute bottom-1 right-1 rounded bg-black/70 px-1 text-[9px] font-bold">+{orderGroup.items.length - 1}</span> : null}</div>
                <div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-2"><p className="truncate text-sm font-bold text-white">{order.name}</p><span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${orderGroup.status === 'shipped' ? 'bg-emerald-400/10 text-emerald-300' : 'bg-amber-300/10 text-amber-200'}`}>{orderGroup.status === 'shipped' ? 'Shipped' : 'Pending'}</span></div><p className="mt-1 text-xs text-[#6c6c74]">{formatOrderDate(orderGroup.createdAt)}</p><CoinAmount amount={order.value} formatOptions={{ maximumFractionDigits: 0 }} className="mt-2 text-xs font-bold text-white" iconClassName="h-3.5 w-3.5" /></div>
              </div>
              {trackingNumber ? <div className="mx-3 mb-3 flex min-w-0 items-center gap-2 rounded-lg bg-black/20 px-2.5 py-2"><span className="shrink-0 text-[10px] font-bold uppercase tracking-wide text-[#71717a]">Tracking</span><code className="min-w-0 flex-1 truncate text-xs font-semibold text-[#d2d2d8]">{trackingNumber}</code><button type="button" onClick={() => { void handleCopyTracking(orderGroup.id, trackingNumber); }} className="shrink-0 rounded px-1.5 py-1 text-[10px] font-black text-white transition hover:bg-white/10">{copiedTrackingId === orderGroup.id ? 'Copied' : 'Copy'}</button></div> : null}
              {orderGroup.items.length > 1 ? <><button type="button" onClick={toggleExpanded} aria-expanded={isExpanded} className="flex w-full items-center justify-between border-t border-white/[0.06] px-3 py-2.5 text-xs font-bold text-[#b6b6be] transition hover:bg-white/[0.03] hover:text-white"><span>{isExpanded ? 'Hide' : 'Show'} all {orderGroup.items.length} items</span><ChevronDown className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} /></button>{isExpanded ? <div className="space-y-2 border-t border-white/[0.06] bg-black/10 p-3">{orderGroup.items.map((item) => <div key={item.id} className="flex items-center gap-2"><img src={item.image} alt="" className="h-9 w-9 rounded bg-[#09090c] object-contain p-1" loading="lazy" /><p className="min-w-0 flex-1 truncate text-xs font-semibold text-[#d4d4da]">{item.name}</p><CoinAmount amount={item.value} formatOptions={{ maximumFractionDigits: 0 }} className="text-[11px] font-bold text-white" iconClassName="h-3 w-3" /></div>)}</div> : null}</> : null}
            </article>;
          })}
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

export const Profile: React.FC<{ initialTab?: 'inventory' }> = ({ initialTab }) => {
  const { user, inventory, shipments, boxes, sellItem, shipItem, stripeSettings, openAuthModal, setView, setShowTopUpModal, setTopUpModalIntent, updateAddress, updateUserInfo } = useGame();

  const [activeTab, setActiveTab] = useState<MobileTab>(initialTab ?? 'inventory');
  const [showEditProfile, setShowEditProfile] = useState(false);
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
  const [tradeInModalItemId, setTradeInModalItemId] = useState<string | null>(null);
  const [isSellingItems, setIsSellingItems] = useState<Record<string, boolean>>({});
  const [isSubmittingShipment, setIsSubmittingShipment] = useState(false);
  const [isSubmittingCashShipping, setIsSubmittingCashShipping] = useState(false);
  const [shippingRequestConfirmed, setShippingRequestConfirmed] = useState(false);
  const [shippingDepositNotice, setShippingDepositNotice] = useState<string | null>(null);
  const [shippingDepositMessage, setShippingDepositMessage] = useState<string | null>(null);
  const [isSavingAddress, setIsSavingAddress] = useState(false);

  const [activeAccountPanel, setActiveAccountPanel] = useState<AccountPanel>('overview');
  const [isSavingUsername, setIsSavingUsername] = useState(false);
  const [isSavingEmail, setIsSavingEmail] = useState(false);
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [securityForm, setSecurityForm] = useState({
    username: user.name ?? '',
    email: user.email ?? auth.currentUser?.email ?? '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
    avatar: user.avatar
  });

  const [addressForm, setAddressForm] = useState<ShippingAddress>(() => user.shippingAddress ? normalizeStoredShippingAddress(user.shippingAddress) : emptyShippingAddress());
  const [addressValidation, setAddressValidation] = useState<AddressValidationResult | null>(null);

  useEffect(() => {
    if (user.shippingAddress) {
      setAddressForm(normalizeStoredShippingAddress(user.shippingAddress));
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
        orderGroupId: shipment.shippingBatchId || shipment.id,
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
        orderGroupId: item.instanceId,
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

  const isPullPassBoxReward = (item: InventoryItem) => item.source === 'pullPassBoxReward' && Boolean(item.boxId);
  const isItemShippable = (item: InventoryItem) => item.status === 'available' && !item.locked && item.shippable !== false && !isPullPassBoxReward(item);
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
      setShowShippingReview(true);
      setShippingRequestConfirmed(true);
      clearUrlParams();
    }
  }, []);

  const selectedShipmentItems = activeInventory.filter((item) => selectedShipments.includes(item.instanceId));
  const shipmentPreviewItems = selectedShipmentItems.slice(0, 6);
  const hiddenShipmentItemCount = Math.max(0, selectedShipmentItems.length - shipmentPreviewItems.length);
  const selectedShipmentValue = selectedShipmentItems.reduce((sum, item) => sum + toCoins(item.price, PRICE_UNIT_MODE), 0);
  const paidShipmentValue = selectedShipmentItems.reduce((sum, item) => sum + (isFreeShippingItem(item) ? 0 : toCoins(item.price, PRICE_UNIT_MODE)), 0);
  const shippingRateDisplayTiers = stripeSettings.shippingRateTiers.length > 0 ? stripeSettings.shippingRateTiers : [];
  const shipmentRate = getShipmentShippingRate(paidShipmentValue, stripeSettings.shippingRateTiers);
  const protectionRate = getShippingProtectionRate(paidShipmentValue, stripeSettings.shippingProtectionTiers);
  const addOnCashTotalCents = (shippingProtectionSelected ? protectionRate.cashCents : 0) + (signatureRequiredSelected ? stripeSettings.signatureRequiredCents : 0);
  const shippingCoinTotal = shipmentRate.coinCost + addOnCashTotalCents;
  const shippingCashTotalCents = shipmentRate.cashCents + addOnCashTotalCents;
  const freeShippingItemCount = selectedShipmentItems.filter((item) => isFreeShippingItem(item)).length;
  const paidShippingItemCount = Math.max(0, selectedShipmentItems.length - freeShippingItemCount);
  const isFreeOnlySelection = selectedShipmentItems.length > 0 && paidShippingItemCount === 0;

  const canUseCoinShipping = !isFreeOnlySelection && shippingCoinEnabled;
  const canUseCashShipping = !isFreeOnlySelection && shippingCashEnabled;
  const hasShippingMethodToggle = canUseCoinShipping && canUseCashShipping;
  const activeShippingMethod = hasShippingMethodToggle ? shippingPaymentMethod : canUseCashShipping ? 'cash' : 'coins';
  const selectedShippingCostLabel = activeShippingMethod === 'cash'
    ? `$${(shippingCashTotalCents / 100).toFixed(2)}`
    : shippingCoinTotal.toLocaleString();
  const shippingAccent = activeShippingMethod === 'cash' ? 'green' : 'blue';
  const activeShippingBorderClass = shippingAccent === 'green'
    ? 'border-emerald-500 bg-emerald-500/10 shadow-[0_0_18px_rgba(16,185,129,0.28)]'
    : 'border-blue-500 bg-blue-500/10 shadow-[0_0_18px_rgba(32,93,215,0.3)]';
  const activeAddOnClass = shippingAccent === 'green'
    ? 'border-emerald-500 bg-emerald-500/10 shadow-[0_0_14px_rgba(16,185,129,0.18)]'
    : 'border-blue-500 bg-blue-500/10 shadow-[0_0_14px_rgba(32,93,215,0.18)]';
  const activeCheckClass = shippingAccent === 'green' ? 'bg-emerald-500' : 'bg-blue-500';
  const savedShippingAddress = user.shippingAddress;
  const hasCompleteShippingAddress = Boolean(
    savedShippingAddress?.fullName
    && savedShippingAddress?.street1
    && savedShippingAddress?.city
    && savedShippingAddress?.postalCode
    && savedShippingAddress?.countryCode
  );
  const userHasDeposit = hasUserMadeDeposit(user);

  const showShippingDepositText = (message = 'Make your first deposit before requesting shipment.') => {
    setShippingDepositNotice(message);
    setShippingDepositMessage(null);
  };

  const handleOpenFirstDeposit = () => {
    setShippingDepositMessage('Opening first-time deposit packages...');
    setShowShippingReview(false);
    setTopUpModalIntent({
      reason: 'insufficient_balance',
      requiredCoins: 4000,
      currentBalance: Number(user.balance ?? 0),
      missingCoins: Math.max(0, 4000 - Number(user.balance ?? 0)),
      preferredPackageUsd: 20
    });
    setShowTopUpModal(true);
  };

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
    setShippingRequestConfirmed(false);
    setShippingProtectionSelected(false);
    setSignatureRequiredSelected(false);
    setShowShippingProtectionInfo(false);
    setShowSignatureRequiredInfo(false);
    setShippingDepositNotice(null);
    setShippingDepositMessage(null);
    setShowShippingReview(true);
  };

  const handleAddMoreShipmentItems = () => {
    setShowShippingRateTooltip(false);
    setShippingRequestConfirmed(false);
    setShippingDepositNotice(null);
    setShippingDepositMessage(null);
    setShowShippingReview(false);
    setActiveTab('inventory');
  };

  const handleEditShippingAddress = () => {
    setShowShippingRateTooltip(false);
    setShippingRequestConfirmed(false);
    setShowShippingReview(false);
    setActiveTab('account');
    setActiveAccountPanel('settings');
  };

  const handleSaveAddress = async () => {
    const errors = validateShippingAddress(addressForm);
    if (Object.keys(errors).length) { toast.error(Object.values(errors)[0]); setAddressValidation({ status: 'invalid', originalAddress: addressForm, messages: Object.values(errors) }); return; }
    setIsSavingAddress(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      const response = await fetch('/api/shipping/validate-address', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ address: addressForm }) });
      const result = await response.json() as AddressValidationResult;
      if (!response.ok && result.status !== 'unavailable') throw new Error(result.messages?.[0] ?? 'Address could not be checked.');
      setAddressValidation(result);
      if (result.status === 'valid' || result.status === 'unavailable') await saveAddressChoice('original', result);
      else if (result.status === 'invalid') toast.error("We couldn't verify this address. Please edit it and try again.");
    } catch {
      toast.error('Could not save your shipping address.');
    } finally {
      setIsSavingAddress(false);
    }
  };

  async function saveAddressChoice(choice: 'original' | 'suggested', result = addressValidation) {
    if (!result?.attemptId) { toast.error('Please check the address again.'); return; }
    setIsSavingAddress(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      const response = await fetch('/api/shipping/save-address', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ attemptId: result.attemptId, choice }) });
      const payload = await response.json(); if (!response.ok) throw new Error(payload.error);
      await updateAddress(payload.address); setAddressForm(normalizeStoredShippingAddress(payload.address)); setAddressValidation(null);
      toast.success(result.status === 'unavailable' ? 'Address saved. Verification will occur before shipment.' : choice === 'suggested' ? 'Suggested address saved.' : 'Address verified and saved.');
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not save your shipping address.'); }
    finally { setIsSavingAddress(false); }
  }




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
    if (!user.shippingAddress) {
      toast.info('Please add a shipping address before requesting shipment.');
      setActiveTab('account');
      setActiveAccountPanel('settings');
      return;
    }
    const itemsToShip = selectedShipmentItems.filter((item) => canSelectShipment(item));
    const shipmentValueCoins = itemsToShip.reduce((total, item) => total + Number(item.price ?? 0), 0);
    trackShippingStart({ item_count: itemsToShip.length, total_item_value_coins: shipmentValueCoins, total_item_value_usd: coinsToUsd(shipmentValueCoins), shipping_cost_coins: 0, shipping_cost_usd: 0 }, itemsToShip.map((item) => item.instanceId).sort().join(':'));
    setIsSubmittingShipment(true);
    try {
      const shipmentResult = await shipItem(itemsToShip.map((item) => item.instanceId), { shippingProtection: shippingProtectionSelected, signatureRequired: signatureRequiredSelected });
      if (shipmentResult?.requiresDeposit) {
        showShippingDepositText('Make your first deposit before requesting shipment.');
        return;
      }
      if (!shipmentResult) return;
      trackShippingRequested({ shipment_id: shipmentResult.shipmentId ?? shipmentResult.shipmentBatchId, item_count: itemsToShip.length, total_item_value_coins: shipmentValueCoins, total_item_value_usd: coinsToUsd(shipmentValueCoins), shipping_cost_coins: 0, shipping_cost_usd: 0, payment_method: 'coins' }, shipmentResult.shipmentId ?? shipmentResult.shipmentBatchId ?? itemsToShip.map((item) => item.instanceId).sort().join(':'));
      setShippingDepositNotice(null);
      setShippingDepositMessage(null);
      setSelectedShipments([]);
      setShippingRequestConfirmed(true);
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
      setActiveTab('account');
      setActiveAccountPanel('settings');
      return;
    }
    const itemsToShip = selectedShipmentItems.filter((item) => canSelectShipment(item));
    setIsSubmittingCashShipping(true);
    try {
      if (!userHasDeposit) {
        showShippingDepositText('Make your first deposit before requesting shipment.');
        return;
      }
      const token = await auth.currentUser.getIdToken();
      const response = await fetch('/api/create-shipping-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ inventoryIds: itemsToShip.map((item) => item.instanceId), shippingProtection: shippingProtectionSelected, signatureRequired: signatureRequiredSelected })
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        if (payload?.error === 'DEPOSIT_REQUIRED') {
          showShippingDepositText(payload?.message || 'Make your first deposit before requesting shipment.');
          return;
        }
        throw new Error('Unable to start checkout.');
      }
      const data = await response.json();
      if (typeof data.shipmentBatchId === 'string') window.sessionStorage.setItem(SHIPPING_BATCH_STORAGE_KEY, data.shipmentBatchId);
      if (!data.sessionId) {
        setShippingDepositNotice(null);
        setShippingDepositMessage(null);
        setSelectedShipments([]);
        setShippingRequestConfirmed(true);
        return;
      }
      const stripe = await getStripe();
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
  const boxesOpened = Number(user.challengeStats?.boxesOpened ?? normalizedInventory.filter((item) => item.provenance?.sourceType === 'case_open').length);

  const inventoryTotalValue = filteredInventory.reduce((sum, item) => sum + toCoins(item.price, PRICE_UNIT_MODE), 0);
  const availableToShip = filteredInventory.filter((item) => canSelectShipment(item)).length;

  const getActionForItem = (item: InventoryItem) => {
    const isAvailable = item.status === 'available';
    const isLocked = !!item.locked;
    if (isPullPassBoxReward(item)) {
      return {
        label: item.status === 'opened' ? 'Opened' : 'Open Box',
        disabled: item.status !== 'available' || !item.boxId,
        onClick: () => {
          if (item.boxId) {
            setView({ type: 'CASE_OPENING', boxId: item.boxId, inventoryId: item.instanceId });
          }
        }
      };
    }
    const canShip = isItemShippable(item);
    const canSell = isAvailable && !isLocked && item.redeemable !== false && !isXpPurchasedItem(item);

    if (canShip) {
      return {
        label: 'Ship Item',
        disabled: false,
        onClick: () => {
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
    <div className="min-h-screen bg-[#090a0e] px-3 py-4 text-white sm:px-5 sm:py-6">
      <main className="mx-auto w-full max-w-[30rem] overflow-hidden bg-[#08080a] pb-20 sm:max-w-6xl sm:rounded-[2rem] sm:border sm:border-white/10 sm:shadow-[0_30px_100px_rgba(0,0,0,0.38)] md:pb-6">
        <section className="relative overflow-hidden border-b border-white/5 bg-[#08080a] px-5 pb-6 pt-7 sm:px-10 sm:py-9">
          <button type="button" onClick={() => setShowEditProfile(true)} className="absolute right-4 top-4 inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-bold text-[#5e5e64] transition hover:bg-white/5 hover:text-white" aria-label="Edit profile">
            <Edit3 className="h-3.5 w-3.5" /> Edit
          </button>
          <div className="flex flex-col items-center text-center sm:flex-row sm:gap-6 sm:text-left">
            <UserAvatar user={user} className="h-16 w-16 rounded-full bg-[#24242a] sm:h-20 sm:w-20" />
            <div><h1 className="mt-3 max-w-full truncate text-xl font-black tracking-[-0.04em] sm:mt-0 sm:text-3xl">{displayUsername}</h1>
            <p className="mt-1 text-xs font-medium text-[#5f5f65]">Member since {joinedDate}</p></div>
          </div>
          <div className="mt-5 grid sm:mx-auto sm:max-w-2xl grid-cols-3 divide-x divide-white/[0.06]">
            <div className="px-2 text-center"><CoinAmount amount={balance} formatOptions={{ maximumFractionDigits: 0 }} className="justify-center text-base font-black text-white sm:text-lg" iconClassName="h-3.5 w-3.5" /><p className="mt-1 text-[10px] font-semibold text-[#66666d]">Coins</p></div>
            <div className="px-2 text-center"><p className="text-base font-black sm:text-lg">{activeInventory.length}</p><p className="mt-1 text-[10px] font-semibold text-[#66666d]">Items</p></div>
            <div className="px-2 text-center"><p className="text-base font-black sm:text-lg">{boxesOpened}</p><p className="mt-1 text-[10px] font-semibold text-[#66666d]">Boxes Opened</p></div>
          </div>
        </section>

        <div className="bg-[#08080a] px-5 py-4 sm:mx-auto sm:max-w-2xl sm:px-7">
          <button
            type="button"
            onClick={() => setView({ type: 'REFERRALS' })}
            className="group flex min-h-14 w-full items-center gap-3 rounded-xl border border-amber-300/15 bg-gradient-to-r from-amber-300/[0.09] via-[#171719] to-[#111115] px-4 py-3 text-left shadow-[0_10px_28px_rgba(0,0,0,0.2)] transition hover:border-amber-300/30 hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-amber-300/40 sm:px-5"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-amber-200/15 bg-black/25 shadow-inner shadow-black/30">
              <img src={COIN_ICON} alt="" className="h-6 w-6 object-contain" width={24} height={24} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-black text-white sm:text-base">Refer a Friend</span>
              <span className="mt-0.5 block truncate text-[11px] font-medium text-[#929299] sm:text-xs">Invite friends and earn coins together</span>
            </span>
            <ChevronRight className="h-4 w-4 shrink-0 text-amber-200/60 transition-transform group-hover:translate-x-0.5 group-hover:text-amber-100" aria-hidden="true" />
          </button>

          <div className="mt-2 grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setActiveTab('inventory')} className={`rounded-lg px-4 py-2.5 text-sm font-black transition ${activeTab === 'inventory' ? 'bg-[#f1f1f2] text-[#121216]' : 'bg-[#19191d] text-[#77777e] hover:text-white'}`}>Inventory</button>
            <button type="button" onClick={() => setActiveTab('orders')} className={`rounded-lg px-4 py-2.5 text-sm font-black transition ${activeTab === 'orders' ? 'bg-[#f1f1f2] text-[#121216]' : 'bg-[#19191d] text-[#77777e] hover:text-white'}`}>History</button>
          </div>
        </div>

        <div className="mt-5">
          {activeTab === 'orders' ? <OrdersView orders={orders} /> : (
            <InventoryView
              items={filteredInventory}
              selectedIds={selectedShipments}
              onToggleSelect={(id) => setSelectedShipments((prev) => (prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id]))}
              onReviewShipping={() => handleOpenShippingReview(selectedShipments)}
              search={search} setSearch={setSearch} rarity={rarity} setRarity={setRarity} type={type} setType={setType} sort={sort} setSort={setSort}
              getAction={getActionForItem} isSelectable={canSelectShipment} totalValue={inventoryTotalValue} availableToShip={availableToShip} selectedValue={selectedShipmentValue}
            />
          )}
        </div>
      </main>

      {showEditProfile && (
        <AccountView
          user={user} username={displayUsername} memberSince={joinedDate} xp={xp} balance={balance}
          activePanel={activeAccountPanel} onSelectPanel={setActiveAccountPanel}
          addressForm={addressForm} setAddressForm={(next) => { setAddressForm(next); setAddressValidation(null); }} onSaveAddress={handleSaveAddress} validationResult={addressValidation} onAddressChoice={saveAddressChoice} isSavingAddress={isSavingAddress}
          securityForm={securityForm} setSecurityForm={setSecurityForm} onSaveUsername={handleSaveUsername} onSaveEmail={handleSaveEmail} onSavePassword={handleSavePassword}
          isSavingUsername={isSavingUsername} isSavingEmail={isSavingEmail} isSavingPassword={isSavingPassword}
          onClose={() => setShowEditProfile(false)}
        />
      )}

      {!showShippingReview && <MobileBottomNav activeTab={activeTab} onTabChange={(tab) => { if (tab === 'account') setShowEditProfile(true); else setActiveTab(tab); }} onGames={() => setView({ type: 'BOXES' })} onRewards={() => setView({ type: 'BONUSES' })} />}

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
        <div className="fixed inset-0 z-[260] flex items-end justify-center bg-black/85 p-2 backdrop-blur-sm sm:items-center sm:p-3">
          <div className="max-h-[calc(100dvh-1rem)] w-full max-w-[24rem] overflow-y-auto rounded-t-[1.4rem] border border-white/10 bg-[#1f252c] p-4 shadow-2xl shadow-black/40 ring-1 ring-white/5 sm:max-h-[calc(100dvh-1.5rem)] sm:rounded-[1.4rem] sm:p-5">
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
                onClick={() => { setShowShippingRateTooltip(false); setShippingRequestConfirmed(false); setShowShippingReview(false); }}
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            {shippingRequestConfirmed ? (
              <div className="rounded-3xl border border-white/10 bg-[#171d24] px-4 py-7 text-center sm:px-5 sm:py-8">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-emerald-400/30 bg-emerald-500/15 text-emerald-300 shadow-lg shadow-emerald-950/30">
                  <Check className="h-9 w-9" />
                </div>
                <h3 className="mt-4 text-2xl font-black text-white">Shipment Requested</h3>
                <p className="mx-auto mt-2 max-w-[17rem] text-sm leading-6 text-slate-400">We received your request and will prepare your item for shipping.</p>
                <button
                  type="button"
                  className="mt-6 w-full rounded-xl border border-white/10 bg-[#262d35] px-4 py-3 text-base font-black text-white transition hover:border-white/20 hover:bg-[#2d3540] focus:outline-none focus:ring-2 focus:ring-emerald-300/50"
                  onClick={() => {
                    setShowShippingRateTooltip(false);
                    setShippingRequestConfirmed(false);
                    setShowShippingReview(false);
                  }}
                >
                  Close
                </button>
              </div>
            ) : (
              <>
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
                      aria-label={`Shipment cost details. ${formatShippingTierSummary(stripeSettings.shippingRateTiers)}`}
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
                    {shippingRateDisplayTiers.map((tier) => {
                      const isActiveTier = tier.label === shipmentRate.tierLabel;
                      return (
                        <div key={`${tier.label}-${tier.cashCents}-${tier.maxValueCoinsExclusive ?? 'open'}`} className={`rounded-lg px-2.5 py-2 ${isActiveTier ? 'bg-blue-400/15 ring-1 ring-blue-300/30' : 'bg-white/5'}`}>
                          <span className="font-bold text-white">{tier.label}</span>
                          <span className="float-right font-black text-blue-300">{formatShippingAddOnPrice(tier.cashCents, activeShippingMethod)}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            <div className="mt-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 gap-2.5">
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/5 text-slate-300">
                    <MapPin className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Ship to</p>
                    {hasCompleteShippingAddress && savedShippingAddress ? (
                      <div className="mt-1 space-y-0.5 text-sm leading-5 text-slate-300">
                        <p className="truncate font-black text-white">{savedShippingAddress.fullName}</p>
                        <p>{savedShippingAddress.street1}</p>
                        {savedShippingAddress.street2 && <p>{savedShippingAddress.street2}</p>}
                        <p>{savedShippingAddress.city}{savedShippingAddress.state ? `, ${savedShippingAddress.state}` : ''} {savedShippingAddress.postalCode}</p>
                        <p>{savedShippingAddress.countryCode}</p>
                      </div>
                    ) : (
                      <p className="mt-1 text-sm font-semibold text-amber-200">Add a shipping address before confirming.</p>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-white/10 bg-[#262d35] px-3 py-1.5 text-xs font-black text-white transition hover:border-blue-300/40 hover:bg-[#2d3540] focus:outline-none focus:ring-2 focus:ring-blue-300/50"
                  onClick={handleEditShippingAddress}
                >
                  <Edit3 className="h-3.5 w-3.5" />
                  Edit
                </button>
              </div>
            </div>

            {!isFreeOnlySelection && (
              <div className="mt-4 space-y-1.5">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Add-ons</p>
                <div className={`rounded-xl border transition ${shippingProtectionSelected ? activeAddOnClass : 'border-white/10 bg-white/[0.03] hover:border-white/20'}`}>
                  <div className="flex min-h-10 items-center gap-2 px-2.5 py-2">
                    <button
                      id="shipping-protection-addon"
                      type="button"
                      role="switch"
                      aria-checked={shippingProtectionSelected}
                      className={`relative h-6 w-11 shrink-0 rounded-full transition focus:outline-none focus:ring-2 focus:ring-blue-300/60 ${shippingProtectionSelected ? activeCheckClass : 'bg-slate-700'}`}
                      onClick={() => setShippingProtectionSelected((selected) => !selected)}
                    >
                      <span className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition ${shippingProtectionSelected ? 'left-6' : 'left-1'}`} />
                    </button>
                    <label className="min-w-0 flex-1 cursor-pointer text-xs font-black text-white sm:text-sm" onClick={() => setShippingProtectionSelected((selected) => !selected)}>Shipping protection</label>
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
                <div className={`rounded-xl border transition ${signatureRequiredSelected ? activeAddOnClass : 'border-white/10 bg-white/[0.03] hover:border-white/20'}`}>
                  <div className="flex min-h-10 items-center gap-2 px-2.5 py-2">
                    <button
                      id="signature-required-addon"
                      type="button"
                      role="switch"
                      aria-checked={signatureRequiredSelected}
                      className={`relative h-6 w-11 shrink-0 rounded-full transition focus:outline-none focus:ring-2 focus:ring-blue-300/60 ${signatureRequiredSelected ? activeCheckClass : 'bg-slate-700'}`}
                      onClick={() => setSignatureRequiredSelected((selected) => !selected)}
                    >
                      <span className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition ${signatureRequiredSelected ? 'left-6' : 'left-1'}`} />
                    </button>
                    <label className="min-w-0 flex-1 cursor-pointer text-xs font-black text-white sm:text-sm" onClick={() => setSignatureRequiredSelected((selected) => !selected)}>Signature required</label>
                    <span className="shrink-0 rounded-full bg-blue-500/15 px-2 py-0.5 text-[11px] font-black text-blue-200">{formatShippingAddOnPrice(stripeSettings.signatureRequiredCents, activeShippingMethod)}</span>
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
                    className={`flex min-h-12 items-center justify-between gap-2 rounded-xl border px-3 text-left transition disabled:cursor-not-allowed disabled:opacity-40 ${activeShippingMethod === 'coins' ? `${activeShippingBorderClass} text-white` : 'border-white/10 bg-transparent text-slate-400 hover:border-white/20'}`}
                    onClick={() => setShippingPaymentMethod('coins')}
                    disabled={!canUseCoinShipping}
                  >
                    <span className="flex items-center gap-2">
                      <Coins className="h-5 w-5 text-blue-400" />
                      <span className="text-sm font-bold sm:text-base">Coins</span>
                    </span>
                    {activeShippingMethod === 'coins' && <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${activeCheckClass} text-white`}><Check className="h-4 w-4" /></span>}
                  </button>
                  <button
                    className={`flex min-h-12 items-center justify-center gap-2 rounded-xl border px-3 text-left transition disabled:cursor-not-allowed disabled:opacity-40 ${activeShippingMethod === 'cash' ? `${activeShippingBorderClass} text-white` : 'border-white/10 bg-transparent text-slate-400 hover:border-white/20'}`}
                    onClick={() => setShippingPaymentMethod('cash')}
                    disabled={!canUseCashShipping}
                  >
                    <CreditCard className="h-5 w-5" />
                    <span className="text-sm font-bold sm:text-base">Cash</span>
                    {activeShippingMethod === 'cash' && <span className={`ml-auto flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${activeCheckClass} text-white`}><Check className="h-4 w-4" /></span>}
                  </button>
                </div>
              </div>
            )}

            {shippingDepositNotice && (
              <div className="mt-4 rounded-xl border border-amber-400/20 bg-amber-500/5 px-3 py-2 text-xs leading-5 text-amber-100 sm:text-[13px]">
                <p>
                  {shippingDepositNotice} You can keep using Pullz, but shipping unlocks after first deposit.
                </p>
                {shippingDepositMessage && <p className="mt-1 text-amber-200/90">{shippingDepositMessage}</p>}
                <button
                  type="button"
                  onClick={handleOpenFirstDeposit}
                  className="mt-2 inline-flex min-h-10 w-full items-center justify-center rounded-lg bg-amber-400 px-3 py-2 text-xs font-black text-slate-950 transition hover:bg-amber-300 sm:w-auto"
                >
                  Make a deposit
                </button>
              </div>
            )}

            <div className="mt-4 space-y-2">
              {activeShippingMethod === 'cash' && canUseCashShipping ? (
                <button className="w-full rounded-xl bg-gradient-to-r from-[#205DD7] via-blue-600 to-sky-500 px-4 py-3 text-base font-black text-white shadow-lg shadow-blue-950/40 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50" onClick={handleCashShipping} disabled={isSubmittingCashShipping}>{isSubmittingCashShipping ? 'Redirecting...' : 'Continue to Checkout'}</button>
              ) : (
                <button className="w-full rounded-xl bg-gradient-to-r from-[#205DD7] via-blue-600 to-sky-500 px-4 py-3 text-base font-black text-white shadow-lg shadow-blue-950/40 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50" onClick={handleConfirmShipping} disabled={isSubmittingShipment}>{isSubmittingShipment ? 'Submitting...' : isFreeOnlySelection ? 'Confirm Free Shipping' : 'Confirm Shipping'}</button>
              )}
              <button className="w-full rounded-xl border border-white/10 px-4 py-3 text-base font-bold text-slate-300 transition hover:bg-white/5 hover:text-white" onClick={() => { setShowShippingRateTooltip(false); setShippingRequestConfirmed(false); setShowShippingReview(false); }}>Cancel</button>
            </div>

              </>
            )}
          </div>
        </div>
      )}

   </div>
  );
};
