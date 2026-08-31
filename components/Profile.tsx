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
import { AddressValidationResult, InventoryItem, Shipment, ShippingAddress, ShippingRateResponse } from '../types';
import { emptyShippingAddress, normalizeStoredShippingAddress, validateShippingAddress } from '../src/lib/shippingAddress';
import { AccountView } from './profile/AccountView';
import { InventoryView } from './profile/InventoryView';
import { MobileBottomNav } from './profile/MobileBottomNav';
import { UserAvatar } from './UserAvatar';
import { COIN_ICON, XP_ICON } from '../constants';
import { AnimatedNumber } from '../src/ui/numbers/AnimatedNumber';
import { coinsToUsd, trackShippingRequested, trackShippingStart } from '../services/analytics';

const SHIPPING_BATCH_STORAGE_KEY = 'pullzgg_shipping_batch';
const SHIPPING_SESSION_STORAGE_KEY = 'pullzgg_shipping_session';




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
  trackingNumbers?: string[];
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
  trackingNumbers: string[];
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
          trackingNumbers: Array.from(new Set(sortedItems.flatMap((item) =>
            item.trackingNumbers?.length ? item.trackingNumbers : item.trackingNumber ? [item.trackingNumber] : []
          ))),
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
        || order.items.some((item) => item.name.toLowerCase().includes(term) || item.id.toLowerCase().includes(term) || [...(item.trackingNumbers ?? []), item.trackingNumber ?? ''].some((tracking) => tracking.toLowerCase().includes(term)));
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
            const trackingNumbers = orderGroup.trackingNumbers;
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
              {trackingNumbers.length ? <div className="mx-3 mb-3 rounded-lg bg-black/20 px-2.5 py-2"><div className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-[#71717a]">Tracking</div><div className="space-y-1.5">{trackingNumbers.map((trackingNumber, index) => <div key={trackingNumber} className="flex min-w-0 items-center gap-2"><code className="min-w-0 flex-1 break-all text-xs font-semibold text-[#d2d2d8]">{trackingNumber}</code><button type="button" onClick={() => { void handleCopyTracking(`${orderGroup.id}-${index}`, trackingNumber); }} className="min-h-9 shrink-0 rounded px-2 text-[10px] font-black text-white transition hover:bg-white/10">{copiedTrackingId === `${orderGroup.id}-${index}` ? 'Copied' : 'Copy'}</button></div>)}</div></div> : null}
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
  const [pendingCheckoutActionId, setPendingCheckoutActionId] = useState<string | null>(null);
  const [shippingPaymentStatus, setShippingPaymentStatus] = useState<'idle' | 'pending' | 'paid' | 'cancelled'>('idle');
  const [shippingRequestConfirmed, setShippingRequestConfirmed] = useState(false);
  const [shippingDepositNotice, setShippingDepositNotice] = useState<string | null>(null);
  const [shippingDepositMessage, setShippingDepositMessage] = useState<string | null>(null);
  const [isSavingAddress, setIsSavingAddress] = useState(false);
  const [liveRateQuote, setLiveRateQuote] = useState<ShippingRateResponse | null>(null);
  const [selectedRateId, setSelectedRateId] = useState<string | null>(null);
  const [liveRateError, setLiveRateError] = useState<string | null>(null);
  const [isLoadingLiveRates, setIsLoadingLiveRates] = useState(false);
  const [rateRefreshVersion, setRateRefreshVersion] = useState(0);

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
        trackingNumbers: shipment.trackingNumbers,
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
        trackingNumbers: item.trackingNumbers,
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
      params.delete('attempt_id');
      const nextQuery = params.toString();
      const nextUrl = `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ''}${window.location.hash}`;
      window.history.replaceState({}, '', nextUrl);
    };

    const clearStoredBatch = () => {
      window.sessionStorage.removeItem(SHIPPING_BATCH_STORAGE_KEY);
      window.sessionStorage.removeItem(SHIPPING_SESSION_STORAGE_KEY);
      setSelectedShipments([]);
      setShowShippingReview(false);
    };

    if (shippingStatus === 'cancel' || shippingStatus === 'cancelled') {
      setShippingPaymentStatus('cancelled');
      toast.info("Shipping payment wasn't completed. Your items have not been shipped.");
      const shipmentBatchId = window.sessionStorage.getItem(SHIPPING_BATCH_STORAGE_KEY);
      const liveSessionId = window.sessionStorage.getItem(SHIPPING_SESSION_STORAGE_KEY);
      const paymentAttemptId = params.get('attempt_id');
      if ((paymentAttemptId || liveSessionId || shipmentBatchId) && auth.currentUser) {
        void (async () => {
          try {
            const token = await auth.currentUser?.getIdToken();
            if (!token) return;
            const response = await fetch(paymentAttemptId || liveSessionId ? '/api/shipping/cancel-checkout-session' : '/api/cancel-shipping-checkout-session', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
              body: JSON.stringify(paymentAttemptId ? { attemptId: paymentAttemptId } : liveSessionId ? { sessionId: liveSessionId } : { shipmentBatchId })
            });
            if (!response.ok) toast.info('Your shipping payment is still being confirmed. Items will unlock automatically if payment is not completed.');
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
      const sessionId = params.get('session_id');
      setShowShippingReview(true); setShippingPaymentStatus('pending');
      if (sessionId && auth.currentUser) void (async () => {
        for (let attempt = 0; attempt < 12; attempt += 1) {
          const token = await auth.currentUser?.getIdToken(); if (!token) break;
          const response = await fetch(`/api/shipping/payment-status?session_id=${encodeURIComponent(sessionId)}`, { headers: { Authorization: `Bearer ${token}` } });
          const payload = await response.json().catch(() => null);
          if (response.ok && payload?.status === 'paid') { setShippingPaymentStatus('paid'); setShippingRequestConfirmed(true); window.sessionStorage.removeItem(SHIPPING_BATCH_STORAGE_KEY); window.sessionStorage.removeItem(SHIPPING_SESSION_STORAGE_KEY); setSelectedShipments([]); clearUrlParams(); return; }
          if (response.ok && ['expired', 'failed'].includes(payload?.status)) { setShippingPaymentStatus('cancelled'); clearUrlParams(); return; }
          await new Promise((resolve) => window.setTimeout(resolve, 1500));
        }
        toast.info('Payment is still being confirmed. Your shipment will appear shortly.');
      })();
    }
  }, [user.id]);

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
  const selectedShipmentKey = selectedShipmentItems.map((item) => item.instanceId).sort().join(':');
  const selectedLiveRate = liveRateQuote?.rates.find((rate) => rate.id === selectedRateId);
  const destinationKey = user.shippingAddress ? [user.shippingAddress.street1, user.shippingAddress.street2, user.shippingAddress.city, user.shippingAddress.state, user.shippingAddress.postalCode, user.shippingAddress.countryCode, user.shippingAddress.validatedAt].join('|') : '';
  const liveRateErrorMessage = liveRateError === 'DEPOSIT_REQUIRED' ? 'Make your first deposit to unlock shipping and view shipping rates.' : liveRateError === 'ADDRESS_VERIFICATION_REQUIRED' ? 'Please verify your shipping address before requesting rates.' : liveRateError === 'SHIPPING_PROFILE_REQUIRED' ? 'One or more selected items need shipping information before rates can be calculated.' : liveRateError === 'ITEM_WEIGHT_REQUIRED' ? 'One or more selected items need a shipping weight before rates can be calculated.' : liveRateError === 'ITEM_DIMENSIONS_REQUIRED' ? 'One or more large items need individual dimensions before rates can be calculated.' : liveRateError === 'SHIPPING_PACKAGES_NOT_CONFIGURED' ? 'Shipping packages are being configured. Please try again shortly.' : liveRateError === 'NO_PACKAGE_AVAILABLE' ? "These items need a different package setup. Please contact support and we'll help arrange shipping." : liveRateError === 'NO_STANDARD_SHIPPING_RATE' ? 'Standard shipping is temporarily unavailable. Please try again.' : liveRateError === 'NO_SHIPPING_RATES' ? 'No shipping services are currently available for this destination.' : liveRateError === 'CUSTOMS_DATA_REQUIRED' ? 'International shipping needs customs information before rates can be shown.' : liveRateError === 'SHIPPING_ORIGIN_NOT_CONFIGURED' || liveRateError === 'SHIPPO_NOT_CONFIGURED' || liveRateError === 'SHIPPO_AUTH_FAILED' ? 'Live shipping is not fully configured yet. Please contact support.' : liveRateError === 'SHIPPO_RATE_REQUEST_REJECTED' ? 'The carrier could not quote this address and package. Please check your address or contact support.' : liveRateError ? 'Shipping rates are temporarily unavailable. Please try again.' : '';
  useEffect(() => {
    if (!showShippingReview || !selectedShipmentKey) return;
    const controller = new AbortController(); setIsLoadingLiveRates(true); setLiveRateError(null); setLiveRateQuote(null); setSelectedRateId(null);
    const load = async () => {
      try {
        const token = await auth.currentUser?.getIdToken(); if (!token) throw new Error('AUTH_REQUIRED');
        const response = await fetch('/api/shipping/rates', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ itemIds: selectedShipmentKey.split(':') }), signal: controller.signal });
        const payload = await response.json(); if (!response.ok) throw new Error(payload?.error ?? 'SHIPPING_RATES_UNAVAILABLE');
        setLiveRateQuote(payload); setSelectedRateId(null);
      } catch (error) { if ((error as Error).name !== 'AbortError') setLiveRateError((error as Error).message); }
      finally { if (!controller.signal.aborted) setIsLoadingLiveRates(false); }
    };
    // A short debounce collapses React development remounts and rapid item/address
    // updates into one Shippo request instead of producing duplicate 422/network calls.
    const timer = window.setTimeout(() => void load(), 250);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [showShippingReview, selectedShipmentKey, destinationKey, rateRefreshVersion]);
  useEffect(() => {
    if (!showShippingReview || !liveRateQuote) return;
    const delay = Math.max(0, liveRateQuote.expiresAt - Date.now());
    const timer = window.setTimeout(() => setRateRefreshVersion((value) => value + 1), delay + 100);
    return () => window.clearTimeout(timer);
  }, [showShippingReview, liveRateQuote]);

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
    setLiveRateQuote(null); setSelectedRateId(null); setLiveRateError(null);
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
      return false;
    }
    setIsSavingUsername(true);
    try {
      await updateUserInfo(nextUsername, securityForm.avatar || user.avatar);
      toast.success('Username updated.');
      return true;
    } catch (error) {
      console.error('Failed to update username', error);
      toast.error(error instanceof Error ? error.message : 'Could not update username.');
      return false;
    } finally {
      setIsSavingUsername(false);
    }
  };

  const handleSaveEmail = async () => {
    if (!auth.currentUser) { toast.error('Please sign in again to update your email.'); return false; }
    const nextEmail = securityForm.email.trim();
    if (!nextEmail || nextEmail === (auth.currentUser.email ?? user.email ?? '')) { toast.info('Enter a different email to update.'); return false; }
    if (!securityForm.currentPassword.trim()) { toast.error('Current password is required to update email.'); return false; }
    if (!auth.currentUser.email) { toast.error('Email updates are unavailable for this account type.'); return false; }
    setIsSavingEmail(true);
    try {
      const credential = EmailAuthProvider.credential(auth.currentUser.email, securityForm.currentPassword.trim());
      await reauthenticateWithCredential(auth.currentUser, credential);
      await updateFirebaseEmail(auth.currentUser, nextEmail);
      const token = await auth.currentUser.getIdToken(true);
      const response = await fetch('/api/update-account-profile', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ email: nextEmail }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || 'Could not save the new email to your profile.');
      setSecurityForm((prev) => ({ ...prev, currentPassword: prev.newPassword ? prev.currentPassword : '' }));
      toast.success('Email updated.');
      return true;
    } catch (error) {
      console.error('Failed to update email', error);
      toast.error(error instanceof Error ? error.message : 'Could not update email. Please verify your current password.');
      return false;
    } finally {
      setIsSavingEmail(false);
    }
  };

  const handleSavePassword = async () => {
    if (!auth.currentUser) { toast.error('Please sign in again to update your password.'); return false; }
    if (!securityForm.newPassword.trim()) { toast.error('Enter a new password.'); return false; }
    if (securityForm.newPassword !== securityForm.confirmPassword) { toast.error('New passwords do not match.'); return false; }
    if (!securityForm.currentPassword.trim()) { toast.error('Current password is required to update password.'); return false; }
    if (!auth.currentUser.email) { toast.error('Password updates are unavailable for this account type.'); return false; }
    setIsSavingPassword(true);
    try {
      const credential = EmailAuthProvider.credential(auth.currentUser.email, securityForm.currentPassword.trim());
      await reauthenticateWithCredential(auth.currentUser, credential);
      await updateFirebasePassword(auth.currentUser, securityForm.newPassword.trim());
      setSecurityForm((prev) => ({ ...prev, currentPassword: '', newPassword: '', confirmPassword: '' }));
      toast.success('Password updated.');
      return true;
    } catch (error) {
      console.error('Failed to update password', error);
      toast.error('Could not update password. Please verify your current password.');
      return false;
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

  const handleLiveShippingCheckout = async () => {
    const selectedRate = selectedLiveRate;
    if (!auth.currentUser || !liveRateQuote || !selectedRate) return;
    let checkoutSessionId = '';
    setIsSubmittingCashShipping(true);
    try {
      const token = await auth.currentUser.getIdToken();
      const response = await fetch('/api/shipping/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ quoteId: liveRateQuote.quoteId, rateId: selectedRate.id })
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        if (['SHIPPING_QUOTE_EXPIRED', 'SHIPPING_ITEMS_CHANGED', 'SHIPPING_QUOTE_ALREADY_USED'].includes(payload?.error)) setRateRefreshVersion((value) => value + 1);
        throw new Error(payload?.error ?? 'SHIPPING_CHECKOUT_UNAVAILABLE');
      }
      if (payload?.shipmentBatchId) window.sessionStorage.setItem(SHIPPING_BATCH_STORAGE_KEY, payload.shipmentBatchId);
      if (!payload?.sessionId) {
        setShippingPaymentStatus('paid'); setSelectedShipments([]); setShippingRequestConfirmed(true);
        return;
      }
      checkoutSessionId = payload.sessionId;
      window.sessionStorage.setItem(SHIPPING_SESSION_STORAGE_KEY, payload.sessionId);
      const stripe = await getStripe(); if (!stripe) throw new Error('Stripe failed to initialize.');
      const result = await stripe.redirectToCheckout({ sessionId: payload.sessionId }); if (result.error) throw result.error;
    } catch {
      if (checkoutSessionId && auth.currentUser) {
        const token = await auth.currentUser.getIdToken().catch(() => '');
        if (token) await fetch('/api/shipping/cancel-checkout-session', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ sessionId: checkoutSessionId }) }).catch(() => null);
      }
      toast.error('Unable to start secure shipping checkout. Please refresh rates and try again.');
    } finally { setIsSubmittingCashShipping(false); }
  };

  const handlePendingCheckout = async (item: InventoryItem, action: 'resume' | 'cancel') => {
    const attemptId = item.shippingPaymentAttemptId;
    if (!auth.currentUser || !attemptId || pendingCheckoutActionId) return;
    setPendingCheckoutActionId(item.instanceId);
    try {
      const token = await auth.currentUser.getIdToken();
      const response = await fetch(action === 'resume' ? '/api/shipping/resume-checkout-session' : '/api/shipping/cancel-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ attemptId })
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error ?? 'SHIPPING_CHECKOUT_UNAVAILABLE');
      if (action === 'cancel') {
        window.sessionStorage.removeItem(SHIPPING_BATCH_STORAGE_KEY);
        window.sessionStorage.removeItem(SHIPPING_SESSION_STORAGE_KEY);
        toast.success('Shipping payment cancelled. Your item is available again.');
        return;
      }
      if (payload?.status === 'paid' || payload?.status === 'confirming') {
        toast.info('Your payment is being confirmed.');
        return;
      }
      if (!payload?.sessionId) throw new Error('SHIPPING_PAYMENT_NOT_AVAILABLE');
      window.sessionStorage.setItem(SHIPPING_SESSION_STORAGE_KEY, payload.sessionId);
      const stripe = await getStripe();
      if (!stripe) throw new Error('Stripe failed to initialize.');
      const result = await stripe.redirectToCheckout({ sessionId: payload.sessionId });
      if (result.error) throw result.error;
    } catch {
      toast.error(action === 'resume' ? 'Unable to reopen checkout. Cancel this shipment and try again.' : 'Unable to cancel shipping payment. Please try again.');
    } finally {
      setPendingCheckoutActionId(null);
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
    if (item.status === 'shipping_payment_pending' && item.shippingPaymentAttemptId) {
      const isWorking = pendingCheckoutActionId === item.instanceId;
      return {
        label: isWorking ? 'Please wait…' : 'Complete Payment',
        disabled: isWorking,
        onClick: () => void handlePendingCheckout(item, 'resume'),
        secondaryLabel: 'Cancel Shipment',
        secondaryDisabled: isWorking,
        onSecondaryClick: () => void handlePendingCheckout(item, 'cancel')
      };
    }
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
    <div className="pullz-legacy-theme min-h-screen bg-[#090a0e] px-3 py-4 text-white sm:px-5 sm:py-6">
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
              <button className="rounded-xl bg-gradient-to-r from-[#205DD7] to-sky-500 py-2 text-sm font-bold text-[#fff]" onClick={handleConfirmTradeIn}>{isSellingItems[tradeInModalItem.instanceId] ? 'Trading In...' : 'Trade In'}</button>
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

            {shippingPaymentStatus === 'pending' ? (
              <div className="rounded-3xl border border-blue-400/20 bg-[#171d24] px-4 py-10 text-center sm:px-5">
                <span className="mx-auto block h-9 w-9 animate-spin rounded-full border-4 border-blue-300 border-t-transparent" />
                <h3 className="mt-4 text-xl font-black text-white">Confirming payment…</h3>
                <p className="mt-2 text-sm leading-6 text-slate-400">Stripe is confirming your payment. Keep this page open; your items remain securely reserved.</p>
              </div>
            ) : shippingRequestConfirmed ? (
              <div className="rounded-3xl border border-white/10 bg-[#171d24] px-4 py-7 text-center sm:px-5 sm:py-8">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-emerald-400/30 bg-emerald-500/15 text-emerald-300 shadow-lg shadow-emerald-950/30">
                  <Check className="h-9 w-9" />
                </div>
                <h3 className="mt-4 text-2xl font-black text-white">Shipping requested</h3>
                <p className="mt-2 font-bold text-emerald-200">Payment received</p>
                <p className="mx-auto mt-2 max-w-[17rem] text-sm leading-6 text-slate-400">We'll update your order when your shipment is prepared.</p>
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
              {false && <div className="flex items-center justify-between gap-3 bg-gradient-to-r from-[#205DD7]/25 via-blue-500/15 to-transparent px-3 py-3 sm:px-4">
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
              </div>}
            </div>
            {false && !isFreeOnlySelection && showShippingRateTooltip && (
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

            <section className="mt-4 rounded-2xl border border-white/10 bg-[#141821] p-3" aria-live="polite">
              <div className="flex items-center justify-between gap-3"><p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Shipping method</p><button type="button" onClick={() => setRateRefreshVersion((value) => value + 1)} disabled={isLoadingLiveRates} className="min-h-9 rounded-lg border border-white/10 px-3 text-xs font-bold text-blue-200 disabled:opacity-50">Refresh rates</button></div>
              {isLoadingLiveRates && <div className="mt-3 flex min-h-20 items-center justify-center gap-2 text-sm font-bold text-slate-300"><span className="h-4 w-4 animate-spin rounded-full border-2 border-blue-300 border-t-transparent" />Calculating shipping options…</div>}
              {!isLoadingLiveRates && liveRateError && <div className="mt-3 rounded-xl border border-amber-400/25 bg-amber-500/10 p-3 text-sm leading-5 text-amber-100"><p>{liveRateErrorMessage}</p>{liveRateError === 'ADDRESS_VERIFICATION_REQUIRED' && <button type="button" onClick={handleEditShippingAddress} className="mt-2 min-h-10 w-full rounded-lg bg-amber-300 px-3 font-black text-slate-950">Edit Address</button>}</div>}
              {!isLoadingLiveRates && liveRateQuote && <><div className="mt-3 space-y-2">{liveRateQuote.rates.map((rate) => <button type="button" key={rate.id} onClick={() => setSelectedRateId(rate.id)} className={`flex min-h-16 w-full items-center gap-3 rounded-xl border p-3 text-left transition ${selectedRateId === rate.id ? 'border-blue-400 bg-blue-500/10 ring-1 ring-blue-400/30' : 'border-white/10 bg-white/[0.02]'}`}><span className={`h-5 w-5 flex-none rounded-full border-2 p-1 ${selectedRateId === rate.id ? 'border-blue-400 bg-blue-400 bg-clip-content' : 'border-slate-500'}`} /><span className="min-w-0 flex-1"><strong className="block text-sm text-white">{liveRateQuote.destination.countryCode === 'US' ? 'Standard Shipping' : 'International Shipping'}</strong><span className="block text-xs font-semibold text-slate-300">{rate.provider} {rate.service}</span></span><strong className="shrink-0 text-base text-blue-300">${(rate.customerAmountCents / 100).toFixed(2)}</strong></button>)}</div>{liveRateQuote.destination.countryCode !== 'US' && <p className="mt-3 text-xs leading-5 text-amber-200">International shipments may be subject to customs duties, taxes, or import fees charged by the destination country.</p>}<p className="mt-3 text-center text-[11px] text-slate-500">Quote expires {new Date(liveRateQuote.expiresAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}.</p></>}
            </section>

            {false && !isFreeOnlySelection && (
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

            {false && (canUseCoinShipping || canUseCashShipping) && !isFreeOnlySelection && (
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
              <button className="min-h-12 w-full rounded-xl bg-gradient-to-r from-[#205DD7] via-blue-600 to-sky-500 px-4 py-3 text-base font-black text-[#fff] shadow-lg shadow-blue-950/40 disabled:cursor-not-allowed disabled:opacity-50" disabled={!selectedLiveRate || isLoadingLiveRates || isSubmittingCashShipping} onClick={() => void handleLiveShippingCheckout()}>{isSubmittingCashShipping ? 'Creating secure checkout…' : selectedLiveRate ? (selectedLiveRate.customerAmountCents === 0 ? 'Request Free Shipping' : `Pay $${(selectedLiveRate.customerAmountCents / 100).toFixed(2)} & Request Shipping`) : 'Select a Shipping Method'}</button>
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
