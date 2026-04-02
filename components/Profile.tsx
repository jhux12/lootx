import React, { useState, useEffect, useMemo, useRef } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { useGame } from '../context/GameContext';
import { useSound } from '../context/SoundContext';
import { COIN_ICON, XP_ICON } from '../constants';
import { getSellBackValue } from '../utils/sellBack';
import { PRICE_UNIT_MODE, toCoins } from '../utils/coins';
import { CoinAmount } from './CoinAmount';
import { User, Clock, MapPin, Save, Check, Settings, Shield, Lock, LogOut, AlertTriangle, UserPlus, UserCheck, Users as UsersIcon, Sparkles, Trash2, ExternalLink, Search, Package, ChevronLeft, ChevronRight, CalendarDays, Gem, Boxes, X } from 'lucide-react';
import { auth } from '../firebase';
import { Checkbox } from './ui/Checkbox';
import { Input } from './ui/Input';
import { toast } from '../src/ui/toast/toast';
import { BlurImage } from '../src/ui/images/BlurImage';
import { SkeletonRow, SkeletonTile } from '../src/ui/skeleton/Skeleton';
import { AnimatedNumber } from '../src/ui/numbers/AnimatedNumber';

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
    'https://api.dicebear.com/7.x/lorelei/svg?seed=Loot',
];

type ProfileTab = 'topPulls' | 'inventory' | 'community' | 'settings';

interface ProfileProps {
  initialTab?: ProfileTab;
}

export const Profile: React.FC<ProfileProps> = ({ initialTab }) => {
  const { user, users, inventory, boxes, updateAddress, updateUserInfo, updateUserFlags, logout, view, setView, followUser, unfollowUser, sellItem, shipItem, stripeSettings, openAuthModal } = useGame();
  const { playSound } = useSound();

  const [inventoryFilter, setInventoryFilter] = useState<'inventory' | 'processing' | 'shipped'>('inventory');
  const [activePeopleTab, setActivePeopleTab] = useState<'followers' | 'following'>('followers');
  const [communitySearch, setCommunitySearch] = useState('');
  const [topPullsPublic, setTopPullsPublic] = useState(user.topPullsPublic ?? false);
  const [sellOffers, setSellOffers] = useState<Record<string, boolean>>({});
  const [isGeneratingSellOffers, setIsGeneratingSellOffers] = useState<Record<string, boolean>>({});
  const [isSellingItems, setIsSellingItems] = useState<Record<string, boolean>>({});
  const [selectedShipments, setSelectedShipments] = useState<string[]>([]);
  const [showShippingReview, setShowShippingReview] = useState(false);
  const [withdrawLockedModalOpen, setWithdrawLockedModalOpen] = useState(false);
  const [tradeInModalItemId, setTradeInModalItemId] = useState<string | null>(null);
  const [isSubmittingShipment, setIsSubmittingShipment] = useState(false);
  const [isSubmittingCashShipping, setIsSubmittingCashShipping] = useState(false);
  const [isSavingAddress, setIsSavingAddress] = useState(false);
  const sellOfferTimersRef = useRef<Record<string, number>>({});
  const tabScrollRef = useRef<HTMLDivElement>(null);
  const [tabScrollState, setTabScrollState] = useState({ canScrollLeft: false, canScrollRight: false });

  const selectedUserId = view.type === 'PROFILE' ? view.userId : undefined;
  const profileUser = selectedUserId ? users.find((u) => u.id === selectedUserId) : user;
  const isOwnProfile = !selectedUserId || selectedUserId === user.id;
  const displayUser = profileUser || user;
  const canViewTopPulls = isOwnProfile || !!displayUser.topPullsPublic;
  const defaultTab = isOwnProfile ? 'inventory' : 'topPulls';

  const [activeTab, setActiveTab] = useState<ProfileTab>(initialTab ?? defaultTab);
  
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
      setActiveTab(initialTab ?? defaultTab);
  }, [initialTab, defaultTab, displayUser.id]);

  useEffect(() => () => {
    Object.values(sellOfferTimersRef.current).forEach((timerId) => window.clearTimeout(timerId));
    sellOfferTimersRef.current = {};
  }, []);

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
            const response = await fetch('/api/cancel-shipping-checkout-session', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`
              },
              body: JSON.stringify({ shipmentBatchId })
            });
            if (!response.ok) {
              const message = await response.text();
              throw new Error(message || 'Unable to cancel shipment.');
            }
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

  const profileTabs = useMemo(
    () => ([
      { id: 'inventory', label: 'Inventory', icon: Package, visible: isOwnProfile },
      { id: 'community', label: 'Community', icon: UsersIcon, visible: true },
      { id: 'topPulls', label: 'Top Pulls', icon: Sparkles, visible: true },
      { id: 'settings', label: 'Settings', icon: Settings, visible: isOwnProfile }
    ] as Array<{ id: ProfileTab; label: string; icon: React.ComponentType<{ className?: string }>; visible: boolean }>),
    [isOwnProfile]
  );

  const visibleProfileTabs = useMemo(() => profileTabs.filter((tab) => tab.visible), [profileTabs]);

  useEffect(() => {
    if (!visibleProfileTabs.some((tab) => tab.id === activeTab)) {
      setActiveTab(visibleProfileTabs[0]?.id ?? defaultTab);
    }
  }, [activeTab, defaultTab, visibleProfileTabs]);

  // Scroll hint logic: show gradient fades + chevrons only when tabs overflow horizontally.
  useEffect(() => {
    const container = tabScrollRef.current;
    if (!container) return;

    const updateScrollState = () => {
      const maxScrollLeft = container.scrollWidth - container.clientWidth;
      setTabScrollState({
        canScrollLeft: container.scrollLeft > 4,
        canScrollRight: maxScrollLeft > 0 && container.scrollLeft < maxScrollLeft - 4
      });
    };

    updateScrollState();
    container.addEventListener('scroll', updateScrollState, { passive: true });
    window.addEventListener('resize', updateScrollState);

    return () => {
      container.removeEventListener('scroll', updateScrollState);
      window.removeEventListener('resize', updateScrollState);
    };
  }, [visibleProfileTabs.length]);

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
  const canClaimDaily = !user.lastFreeBoxClaim;

  const filteredInventory = normalizedInventory.filter((item) => {
    if (inventoryFilter === 'processing') return item.status === 'shipping' || item.status === 'shipping_requested';
    if (inventoryFilter === 'shipped') return item.status === 'shipped';
    return item.status === 'available';
  });

  const shippingCoinEnabled = stripeSettings.shippingCoinEnabled;
  const shippingCoinCostCoins = Math.max(0, stripeSettings.shippingCoinCostCoins);
  const shippingCashEnabled = stripeSettings.shippingCashEnabled && stripeSettings.shippingFlatRateCents > 0;
  const shippingFlatRateCents = Math.max(0, stripeSettings.shippingFlatRateCents);
  const xpBoxIds = useMemo(
    () =>
      new Set(
        boxes
          .filter((box) => box.currencyType === 'XP' || Number(box.priceXP ?? 0) > 0)
          .map((box) => box.id)
      ),
    [boxes]
  );

  const isXpPurchasedItem = (item: typeof normalizedInventory[number]) =>
    item.source === 'xpShop'
    || Boolean(item.sourceItemId)
    || Boolean(item.sourceRedemptionId)
    || item.acquisitionCurrencyType === 'XP'
    || item.openCurrencyType === 'XP'
    || (item.provenance?.sourceType === 'case_open' && typeof item.provenance.sourceId === 'string' && xpBoxIds.has(item.provenance.sourceId));

  const inventoryStats = useMemo(() => {
    const totalItems = normalizedInventory.length;
    const visibleItems = filteredInventory.length;
    const currentValue = filteredInventory.reduce((sum, item) => sum + toCoins(item.price, PRICE_UNIT_MODE), 0);
    const sellableItems = normalizedInventory.filter((item) => {
      const isAvailable = (item.status ?? 'available') === 'available';
      const isLocked = !!item.locked;
      const isXpItem = item.source === 'xpShop'
        || Boolean(item.sourceItemId)
        || Boolean(item.sourceRedemptionId)
        || item.acquisitionCurrencyType === 'XP'
        || item.openCurrencyType === 'XP'
        || (item.provenance?.sourceType === 'case_open' && typeof item.provenance.sourceId === 'string' && xpBoxIds.has(item.provenance.sourceId));
      return isAvailable && !isLocked && item.redeemable !== false && !isXpItem;
    }).length;
    return { totalItems, visibleItems, currentValue, sellableItems };
  }, [filteredInventory, normalizedInventory, xpBoxIds]);


  const selectedShipmentItems = normalizedInventory.filter((item) =>
    selectedShipments.includes(item.instanceId)
  );
  const tradeInModalItem = normalizedInventory.find((item) => item.instanceId === tradeInModalItemId) ?? null;
  const hasMadeDeposit = Number(user.totalSpent ?? 0) > 0;
  const isFreeShippingItem = (item: typeof normalizedInventory[number]) => (
    item.freeShipping === true
    || Number(item.shippingCostOverrideCoins ?? NaN) === 0
    || Number(item.shippingCostOverrideCents ?? NaN) === 0
    || isXpPurchasedItem(item)
    || item.source === 'xpShop'
    || Boolean(item.sourceItemId)
    || Boolean(item.sourceRedemptionId)
  );
  const getCoinShippingCostForItem = (item: typeof normalizedInventory[number]) =>
    isFreeShippingItem(item) ? 0 : shippingCoinCostCoins;
  const getCashShippingCostForItemCents = (item: typeof normalizedInventory[number]) =>
    isFreeShippingItem(item) ? 0 : shippingFlatRateCents;
  const shippingCoinTotal = selectedShipmentItems.reduce((sum, item) => sum + getCoinShippingCostForItem(item), 0);
  const shippingCashTotalCents = selectedShipmentItems.reduce((sum, item) => sum + getCashShippingCostForItemCents(item), 0);
  const freeShippingItemCount = selectedShipmentItems.filter((item) => isFreeShippingItem(item)).length;
  const paidShippingItemCount = Math.max(0, selectedShipmentItems.length - freeShippingItemCount);
  const isFreeOnlySelection = selectedShipmentItems.length > 0 && paidShippingItemCount === 0;
  const formatUsd = (cents: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);

  const canSelectShipment = (item: typeof normalizedInventory[number]) =>
    item.status === 'available' && !item.locked && !!user.shippingAddress;

  useEffect(() => {
    const selectableIds = new Set(
      normalizedInventory.filter((item) => canSelectShipment(item)).map((item) => item.instanceId)
    );
    setSelectedShipments((prev) => prev.filter((id) => selectableIds.has(id)));
  }, [normalizedInventory, user.shippingAddress]);

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
      const priceDiff = toCoins(b.price, PRICE_UNIT_MODE) - toCoins(a.price, PRICE_UNIT_MODE);
      if (priceDiff !== 0) return priceDiff;
      return b.obtainedAt - a.obtainedAt;
    })
    .slice(0, 6);

  const xpTotal = displayUser.xpBalance ?? displayUser.xp ?? 0;
  const inventoryCount = normalizedInventory.length;
  const joinedTimestamp = (() => {
    const candidates = [
      (displayUser as User & { joinedAt?: unknown }).joinedAt,
      displayUser.createdAt
    ];

    for (const value of candidates) {
      if (typeof value === 'number' && Number.isFinite(value) && value > 0) return value;
      if (typeof value === 'string' && value.trim()) {
        const numeric = Number(value);
        if (Number.isFinite(numeric) && numeric > 0) return numeric;
        const parsed = Date.parse(value);
        if (Number.isFinite(parsed)) return parsed;
      }
      if (value && typeof value === 'object' && 'toMillis' in value && typeof (value as { toMillis: () => number }).toMillis === 'function') {
        const millis = (value as { toMillis: () => number }).toMillis();
        if (Number.isFinite(millis) && millis > 0) return millis;
      }
    }

    return undefined;
  })();
  const joinedDateLabel = joinedTimestamp
    ? new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric' }).format(joinedTimestamp)
    : 'Joined Recently';

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
      const previousValue = topPullsPublic;
      setTopPullsPublic(isPublic);
      try {
        await updateUserFlags({ topPullsPublic: isPublic });
      } catch (error) {
        console.error('Failed to update top pulls visibility', error);
        setTopPullsPublic(previousValue);
        toast.error('Could not update top pulls visibility. Please try again.');
      }
  };

  const handleSaveProfile = async () => {
      try {
        await updateUserInfo(profileForm.name, profileForm.avatar);
        toast.success("Profile updated successfully!");
      } catch (error) {
        console.error('Failed to save profile changes', error);
        toast.error(error instanceof Error ? error.message : 'Could not update your profile.');
      }
  };

  const handleSaveAddress = async () => {
      setIsSavingAddress(true);
      try {
        await updateAddress(addressForm);
        toast.success("Shipping address saved!");
      } catch (error) {
        console.error('Failed to save shipping address from profile form', error);
        toast.error("Could not save your shipping address.");
      } finally {
        setIsSavingAddress(false);
      }
  };

  const handleToggleShipment = (instanceId: string) => {
    setSelectedShipments((prev) =>
      prev.includes(instanceId) ? prev.filter((id) => id !== instanceId) : [...prev, instanceId]
    );
  };

  const handleOpenShippingReview = (instanceIds: string[]) => {
    setSelectedShipments(instanceIds);
    setShowShippingReview(true);
  };

  const handleWithdrawClick = (instanceId: string) => {
    if (!hasMadeDeposit) {
      setWithdrawLockedModalOpen(true);
      return;
    }
    handleOpenShippingReview([instanceId]);
  };

  const handleOpenTradeInModal = (instanceId: string) => {
    setTradeInModalItemId(instanceId);
  };

  const handleConfirmTradeIn = async () => {
    if (!tradeInModalItem || isSellingItems[tradeInModalItem.instanceId]) return;
    setIsSellingItems((prev) => ({ ...prev, [tradeInModalItem.instanceId]: true }));
    try {
      await sellItem(tradeInModalItem.instanceId);
      setTradeInModalItemId(null);
      setSellOffers((prev) => ({ ...prev, [tradeInModalItem.instanceId]: false }));
      setIsGeneratingSellOffers((prev) => ({ ...prev, [tradeInModalItem.instanceId]: false }));
    } finally {
      setIsSellingItems((prev) => ({ ...prev, [tradeInModalItem.instanceId]: false }));
    }
  };

  const handleConfirmShipping = async () => {
    if (!shippingCoinEnabled) {
      toast.error('Coin shipping is currently unavailable.');
      return;
    }
    if (!user.shippingAddress) {
      toast.info('Please add a shipping address before requesting shipment.');
      return;
    }

    const itemsToShip = selectedShipmentItems.filter((item) => canSelectShipment(item));
    if (itemsToShip.length === 0) {
      setShowShippingReview(false);
      return;
    }

    setIsSubmittingShipment(true);
    try {
      await Promise.all(itemsToShip.map((item) => shipItem(item.instanceId)));
      setSelectedShipments([]);
      setShowShippingReview(false);
    } catch (error) {
      console.error('Failed to request shipments', error);
      toast.error('Unable to request shipment right now. Please try again.');
    } finally {
      setIsSubmittingShipment(false);
    }
  };

  const handleCashShipping = async () => {
    if (!shippingCashEnabled) {
      toast.error('Cash shipping is currently unavailable.');
      return;
    }

    if (!auth.currentUser) {
      openAuthModal('login');
      return;
    }

    if (!user.shippingAddress) {
      toast.info('Please add a shipping address before requesting shipment.');
      return;
    }

    const itemsToShip = selectedShipmentItems.filter((item) => canSelectShipment(item));
    if (itemsToShip.length === 0) {
      setShowShippingReview(false);
      return;
    }

    setIsSubmittingCashShipping(true);
    try {
      const token = await auth.currentUser.getIdToken();
      const response = await fetch('/api/create-shipping-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ inventoryIds: itemsToShip.map((item) => item.instanceId) })
      });
      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || 'Unable to start checkout.');
      }
      const data = await response.json();
      if (typeof data.shipmentBatchId === 'string') {
        window.sessionStorage.setItem(SHIPPING_BATCH_STORAGE_KEY, data.shipmentBatchId);
      }
      if (!data.sessionId) {
        setSelectedShipments([]);
        setShowShippingReview(false);
        return;
      }
      const stripe = await stripePromise;
      if (!stripe) {
        throw new Error('Stripe failed to initialize.');
      }
      const result = await stripe.redirectToCheckout({ sessionId: data.sessionId });
      if (result.error) {
        throw result.error;
      }
    } catch (error) {
      console.error('Failed to start cash shipping checkout', error);
      toast.error('Unable to start cash checkout. Please try again.');
    } finally {
      setIsSubmittingCashShipping(false);
    }
  };

  const handleConfirmFreeShipping = async () => {
    if (!user.shippingAddress) {
      toast.info('Please add a shipping address before requesting shipment.');
      return;
    }

    const itemsToShip = selectedShipmentItems.filter((item) => canSelectShipment(item));
    if (itemsToShip.length === 0) {
      setShowShippingReview(false);
      return;
    }

    setIsSubmittingShipment(true);
    try {
      await Promise.all(itemsToShip.map((item) => shipItem(item.instanceId)));
      setSelectedShipments([]);
      setShowShippingReview(false);
    } catch (error) {
      console.error('Failed to request free shipping shipments', error);
      toast.error('Unable to request shipment right now. Please try again.');
    } finally {
      setIsSubmittingShipment(false);
    }
  };

  const handleUpdatePassword = () => {
      if(passwordForm.new !== passwordForm.confirm) {
          toast.error("New passwords do not match");
          return;
      }
      if(!passwordForm.current || !passwordForm.new) {
        toast.error("Please fill in all password fields");
        return;
      }
      
      toast.success("Password updated successfully!");
      setPasswordForm({ current: '', new: '', confirm: '' });
  };

  const handleFollowClick = async () => {
      if (!profileUser || isFollowing) return;
      await followUser(profileUser.id);
      toast.success("Now following this player!");
  };

  const handleUnfollowClick = async () => {
      if (!profileUser || !isFollowing) return;
      await unfollowUser(profileUser.id);
      toast.info("You unfollowed this player.");
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
      <div className="relative mb-4 overflow-hidden rounded-[28px] bg-[linear-gradient(160deg,rgba(11,14,20,0.86),rgba(9,12,18,0.74))] shadow-[0_26px_64px_rgba(0,0,0,0.42),0_0_28px_rgba(64,212,255,0.06)] backdrop-blur-[20px]">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(108,92,255,0.2),transparent_38%),radial-gradient(circle_at_bottom_right,rgba(56,189,248,0.14),transparent_30%),linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.01))]" />
        <div className="relative px-4 pb-3.5 pt-3.5 sm:px-5 sm:pb-4 sm:pt-4">
          <div className="flex flex-col gap-3">
            <div className="rounded-[24px] bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.025))] p-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.18),inset_0_-1px_0_rgba(255,255,255,0.02),0_18px_36px_rgba(5,10,20,0.22)] backdrop-blur-xl sm:p-4">
              <div className="flex flex-col gap-3">
                <div className="flex flex-col items-center gap-3 text-center sm:flex-row sm:items-start sm:text-left">
                  <div className="relative shrink-0">
                    <div className="absolute inset-1 rounded-full bg-[radial-gradient(circle,rgba(110,92,255,0.42),rgba(56,189,248,0.14)_55%,transparent_74%)] blur-xl" />
                    <div className="relative rounded-[24px] bg-[linear-gradient(180deg,rgba(255,255,255,0.14),rgba(255,255,255,0.04))] p-1 shadow-[0_16px_34px_rgba(12,17,29,0.34),inset_0_1px_0_rgba(255,255,255,0.28)] backdrop-blur-lg">
                      <img loading="lazy" decoding="async" src={displayUser.avatar} alt={displayUser.name} className="h-24 w-24 rounded-[20px] object-cover bg-[#0b0e14]/90 sm:h-[104px] sm:w-[104px]" />
                    </div>
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#9099b2] sm:text-[11px]">Player Profile</p>
                    <div className="mt-1.5 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <h2 className="truncate text-[1.7rem] font-black tracking-[-0.02em] text-white sm:text-[1.9rem]">{displayUser.name}</h2>
                        <div className="mt-2 inline-flex max-w-full items-center gap-1.5 rounded-full bg-[linear-gradient(135deg,rgba(56,189,248,0.16),rgba(124,58,237,0.12))] px-2.5 py-1 text-[13px] font-medium text-gray-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.16),0_10px_24px_rgba(7,12,22,0.16)] backdrop-blur-md">
                          <img loading="lazy" decoding="async" src={XP_ICON} alt="XP" className="h-4 w-4 object-contain" />
                          <span className="text-[#9ba3ba]">XP Points:</span>
                          <span className="font-bold text-white"><AnimatedNumber value={xpTotal} /></span>
                        </div>
                      </div>

                      {!isOwnProfile && (
                        <div className="flex w-full sm:w-auto sm:pt-0.5">
                          {isFollowing ? (
                            <button
                              onClick={handleUnfollowClick}
                              className="inline-flex h-[42px] w-full items-center justify-center gap-2 rounded-xl bg-[linear-gradient(180deg,rgba(255,255,255,0.12),rgba(255,255,255,0.05))] px-[18px] text-sm font-bold text-gray-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_10px_24px_rgba(7,12,22,0.2)] backdrop-blur-md transition-colors hover:bg-[linear-gradient(180deg,rgba(255,255,255,0.16),rgba(255,255,255,0.06))] hover:text-white sm:w-auto"
                            >
                              <UserCheck className="h-4 w-4" /> Following
                            </button>
                          ) : (
                            <button
                              onClick={handleFollowClick}
                              className="inline-flex h-[42px] w-full items-center justify-center gap-2 rounded-xl bg-[linear-gradient(135deg,#7c3aed,#2563eb)] px-[18px] text-sm font-bold text-white shadow-[0_16px_32px_rgba(79,70,229,0.34)] transition-transform hover:-translate-y-0.5 sm:w-auto"
                            >
                              <UserPlus className="h-4 w-4" /> Follow
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-2 min-[380px]:grid-cols-3 sm:gap-2.5">
                  {[
                    { icon: UsersIcon, label: 'Followers', value: viewedFollowerIds.length.toLocaleString() },
                    { icon: UserPlus, label: 'Following', value: viewedFollowing.length.toLocaleString() },
                    { icon: CalendarDays, label: 'Joined', value: joinedDateLabel }
                  ].map(({ icon: Icon, label, value }) => (
                    <div
                      key={label}
                      className="rounded-2xl bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.03))] px-3 py-2.5 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.15),0_8px_18px_rgba(7,10,19,0.16)] backdrop-blur-md min-[380px]:min-w-0"
                    >
                      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-[#7f88a1] sm:text-[11px] sm:tracking-[0.14em]">
                        <Icon className="h-3.5 w-3.5 text-cyan-300/80" />
                        <span className="leading-tight">{label}</span>
                      </div>
                      <div className="mt-1.5 text-sm font-bold leading-tight text-white break-words sm:text-[15px]">{value}</div>
                    </div>
                  ))}
                </div>

                {isOwnProfile && (
                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      onClick={() => setActiveTab('settings')}
                      className="inline-flex h-[42px] items-center justify-center gap-2 rounded-xl bg-[linear-gradient(180deg,rgba(255,255,255,0.12),rgba(255,255,255,0.05))] px-4 text-sm font-bold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_10px_22px_rgba(7,12,22,0.18)] backdrop-blur-md transition-colors hover:bg-[linear-gradient(180deg,rgba(255,255,255,0.16),rgba(255,255,255,0.07))]"
                    >
                      <Settings className="h-4 w-4" /> Edit Profile
                    </button>
                    <button
                      onClick={() => setView({ type: 'BOXES' })}
                      className="inline-flex h-[42px] items-center justify-center gap-2 rounded-xl bg-[linear-gradient(135deg,#7c3aed,#2563eb)] px-4 text-sm font-bold text-white shadow-[0_16px_32px_rgba(79,70,229,0.34)] transition-transform hover:-translate-y-0.5"
                    >
                      <Sparkles className="h-4 w-4" /> Open Boxes
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-2.5 lg:grid-cols-[minmax(0,1.45fr)_minmax(0,0.9fr)]">
              <div className="overflow-hidden rounded-2xl bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.03))] p-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.16),0_16px_34px_rgba(5,10,20,0.18)] backdrop-blur-xl">
                <div className="flex items-start justify-between gap-2.5">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#7f88a1]">Top Pulls</p>
                    <h3 className="mt-1.5 text-[1.05rem] font-black text-white">{canViewTopPulls ? `${topPulls.length} Highlight${topPulls.length === 1 ? '' : 's'}` : 'Private'}</h3>
                    <p className="mt-1 text-[12px] leading-relaxed text-gray-400">A compact look at your highest-value drops.</p>
                  </div>
                  <div className="rounded-xl bg-[linear-gradient(180deg,rgba(232,121,249,0.16),rgba(168,85,247,0.08))] p-2 text-fuchsia-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.2)] backdrop-blur-md">
                    <Gem className="h-4 w-4" />
                  </div>
                </div>

                {canViewTopPulls && topPulls.length > 0 ? (
                  <div className="-mx-1 mt-3 flex gap-2.5 overflow-x-auto px-1 pb-1 [&::-webkit-scrollbar]:hidden" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                    {topPulls.slice(0, 4).map((item, index) => (
                      <div
                        key={item.instanceId}
                        className="min-w-[110px] flex-1 rounded-2xl bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.03))] p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.14),0_12px_26px_rgba(4,8,17,0.28)] backdrop-blur-lg"
                      >
                        <div className="relative flex aspect-square items-center justify-center overflow-hidden rounded-xl bg-[radial-gradient(circle_at_top,rgba(124,58,237,0.22),transparent_58%),linear-gradient(180deg,#141a28,#101522)] p-2">
                          <span className="absolute left-2 top-2 rounded-full border border-white/10 bg-black/45 px-2 py-0.5 text-[10px] font-black text-white">#{index + 1}</span>
                          <BlurImage src={item.image} alt={item.name} className="h-full w-full object-contain" />
                          <div className={`pointer-events-none absolute inset-0 opacity-30 bg-gradient-to-br ${
                            item.rarity === 'legendary' ? 'from-yellow-400/50 via-transparent to-transparent' :
                            item.rarity === 'epic' ? 'from-purple-400/50 via-transparent to-transparent' :
                            item.rarity === 'rare' ? 'from-blue-400/50 via-transparent to-transparent' :
                            item.rarity === 'uncommon' ? 'from-emerald-400/45 via-transparent to-transparent' :
                            'from-white/10 via-transparent to-transparent'
                          }`} />
                        </div>
                        <div className="mt-2 space-y-0.5">
                          <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#7d859d]">{item.rarity}</div>
                          <div className="truncate text-xs font-semibold text-white">{item.name}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mt-3 rounded-2xl bg-white/[0.045] px-4 py-4 text-sm text-gray-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] backdrop-blur-md">
                    {canViewTopPulls ? 'Your best pulls will show here once you open more boxes.' : 'This player keeps their best pulls private.'}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 gap-2 rounded-2xl bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.03))] p-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.16),0_16px_34px_rgba(5,10,20,0.18)] backdrop-blur-xl min-[420px]:grid-cols-3 lg:grid-cols-1">
                {[
                  { icon: Sparkles, label: 'Top Pulls', value: topPulls.length.toLocaleString() },
                  { icon: Boxes, label: 'Inventory', value: inventoryCount.toLocaleString() },
                  { icon: CalendarDays, label: 'Member Since', value: joinedDateLabel }
                ].map(({ icon: Icon, label, value }) => (
                  <div key={label} className="rounded-2xl bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.025))] px-3 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.14)] backdrop-blur-md">
                    <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-[#7f88a1] sm:tracking-[0.16em]">
                      <Icon className="h-3.5 w-3.5 text-brand-purple" />
                      <span className="leading-tight">{label}</span>
                    </div>
                    <div className="mt-1.5 text-sm font-bold leading-tight text-white break-words">{value}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Main Tabs */}
            <div className="relative w-full max-w-full">
              <div
                ref={tabScrollRef}
                className="flex items-center gap-2 rounded-2xl bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.025))] p-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.16)] backdrop-blur-xl w-full max-w-full overflow-x-auto whitespace-nowrap scroll-smooth snap-x snap-mandatory [&::-webkit-scrollbar]:hidden"
                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
              >
                {visibleProfileTabs.map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold whitespace-nowrap transition-all snap-start ${activeTab === tab.id ? 'bg-[linear-gradient(135deg,rgba(124,58,237,0.32),rgba(37,99,235,0.24))] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_10px_24px_rgba(12,18,30,0.22)] backdrop-blur-md' : 'text-gray-400 hover:bg-white/[0.05] hover:text-gray-200'}`}
                    >
                      <Icon className="w-4 h-4" /> {tab.label}
                    </button>
                  );
                })}
              </div>
              <div
                className={`pointer-events-none absolute inset-y-0 left-0 w-10 bg-gradient-to-r from-[#0b0e14] to-transparent transition-opacity ${
                  tabScrollState.canScrollLeft ? 'opacity-100' : 'opacity-0'
                }`}
              />
              <div
                className={`pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-[#0b0e14] to-transparent transition-opacity ${
                  tabScrollState.canScrollRight ? 'opacity-100' : 'opacity-0'
                }`}
              />
              <ChevronLeft
                className={`pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500 transition-opacity ${
                  tabScrollState.canScrollLeft ? 'opacity-80' : 'opacity-0'
                }`}
              />
              <ChevronRight
                className={`pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500 transition-opacity ${
                  tabScrollState.canScrollRight ? 'opacity-80' : 'opacity-0'
                }`}
              />
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
                  ) : (isOwnProfile && inventory.length === 0) ? (
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4">
                        {Array.from({ length: 6 }).map((_, idx) => <SkeletonTile key={`top-pull-skeleton-${idx}`} />)}
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
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4">
                          {topPulls.map((item, index) => (
                              <div key={item.instanceId} className="bg-[#131720] border border-gray-800 rounded-xl p-3 sm:p-4 group hover:border-brand-purple/50 transition-all">
                                  <div className="relative aspect-square mb-3 sm:mb-4 bg-[#0b0e14] rounded-lg p-3 sm:p-4 flex items-center justify-center overflow-hidden">
                                      <div className="absolute left-2 top-2 z-10 px-2 py-0.5 rounded-full text-[10px] font-black tracking-wide bg-black/70 text-white border border-white/10">
                                        #{index + 1}
                                      </div>
                                      <BlurImage src={item.image} alt={item.name} className="w-full h-full object-contain group-hover:scale-110 transition-transform duration-500" />
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
                                    amount={toCoins(item.price, PRICE_UNIT_MODE)}
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
                              <div className="text-xs font-bold uppercase tracking-[0.2em] text-yellow-400/80 mb-1">Free Signup Box Available</div>
                              <h4 className="text-lg font-bold text-white">Open your free signup box</h4>
                          </div>
                          <button
                              onClick={() => setView({ type: 'CASE_OPENING', boxId: dailyBox.id, isFree: true })}
                              className="w-full sm:w-auto px-5 py-2.5 rounded-lg bg-yellow-500 text-black font-bold text-sm hover:bg-yellow-400 transition-colors"
                          >
                              Open Free Box
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

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      <div className="rounded-xl border border-cyan-500/20 bg-gradient-to-br from-[#131c29] to-[#111521] px-3 py-2.5">
                          <p className="text-[10px] uppercase tracking-[0.2em] text-cyan-300/70">Total items</p>
                          <p className="mt-1 text-lg font-black text-white leading-none">{inventoryStats.totalItems}</p>
                          <p className="mt-1 text-[10px] text-cyan-100/60">{inventoryStats.sellableItems} sellable</p>
                      </div>
                      <div className="rounded-xl border border-purple-500/25 bg-gradient-to-br from-[#1b1728] to-[#121320] px-3 py-2.5">
                          <p className="text-[10px] uppercase tracking-[0.2em] text-purple-300/70">Current value</p>
                          <CoinAmount amount={inventoryStats.currentValue} formatOptions={{ maximumFractionDigits: 0 }} className="mt-1 text-base font-black text-purple-100" iconClassName="w-4 h-4" />
                      </div>
                      <div className="col-span-2 sm:col-span-1 rounded-xl border border-blue-500/20 bg-gradient-to-br from-[#141a27] to-[#10131d] px-3 py-2.5">
                          <p className="text-[10px] uppercase tracking-[0.2em] text-blue-200/70">Showing now</p>
                          <p className="mt-1 text-lg font-black text-white leading-none">{inventoryStats.visibleItems}</p>
                      </div>
                  </div>

                  {inventoryFilter === 'inventory' && (
                      <div className="bg-gradient-to-br from-[#161d2c] to-[#11151f] border border-blue-500/20 rounded-2xl p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between shadow-[0_8px_30px_rgba(0,0,0,0.35)]">
                          <div>
                              <p className="text-sm font-black uppercase tracking-[0.12em] text-white">Ship multiple items</p>
                              <p className="text-xs text-blue-100/70">Select rewards below for a single premium checkout.</p>
                          </div>
                          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                              <div className="flex items-center gap-2 text-xs text-blue-100/80 rounded-full border border-blue-400/20 bg-[#0b0f17]/70 px-3 py-1.5">
                                  <span className="font-semibold">{selectedShipments.length} selected</span>
                                  {shippingCoinEnabled && (
                                    <>
                                      <span className="text-blue-300/40">•</span>
                                      <span>Per item</span>
                                      <CoinAmount
                                        amount={shippingCoinCostCoins}
                                        formatOptions={{ maximumFractionDigits: 0 }}
                                        className="text-blue-100 font-bold"
                                        iconClassName="w-3 h-3"
                                      />
                                    </>
                                  )}
                                  {!shippingCoinEnabled && shippingCashEnabled && (
                                    <>
                                      <span className="text-gray-600">•</span>
                                      <span>Cash shipping only</span>
                                    </>
                                  )}
                              </div>
                              <button
                                  onClick={() => setShowShippingReview(true)}
                                  disabled={!user.shippingAddress || selectedShipments.length === 0}
                                  className={`px-4 py-2 rounded-lg font-bold text-xs uppercase tracking-wide border transition-colors ${
                                    user.shippingAddress && selectedShipments.length > 0
                                      ? 'bg-blue-500/25 text-blue-100 border-blue-300/45 hover:bg-blue-500/35 shadow-[0_0_18px_rgba(56,189,248,0.25)]'
                                      : 'bg-[#0b0e14] text-gray-500 border-gray-800 cursor-not-allowed'
                                  }`}
                              >
                                  Review shipping
                              </button>
                          </div>
                      </div>
                  )}

                  {inventory.length === 0 ? (
                          <div className="space-y-3">
                            {Array.from({ length: 6 }).map((_, idx) => <SkeletonRow key={`inv-skeleton-${idx}`} />)}
                          </div>
                        ) : filteredInventory.length === 0 ? (
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
                                  ? 'Open boxes to collect items you can ship or sell back.'
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
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4">
                          {filteredInventory.map((item) => {
                              const isAvailable = item.status === 'available';
                              const isLocked = !!item.locked;
                              const isXpItem = isXpPurchasedItem(item);
                              const canShip = isAvailable && !isLocked && !!user.shippingAddress;
                              const canWithdraw = isAvailable && !isLocked;
                              const canSell = isAvailable && !isLocked && item.redeemable !== false && !isXpItem;
                              const statusLabel = item.status === 'shipping' || item.status === 'shipping_requested'
                                ? 'Shipping'
                                : item.status === 'shipped'
                                  ? 'Shipped'
                                  : isLocked
                                    ? 'Locked'
                                    : canShip
                                      ? 'Ready to ship'
                                      : 'In inventory';
                              const statusTone = item.status === 'shipping' || item.status === 'shipping_requested'
                                ? 'bg-blue-500/20 text-blue-300 border-blue-500/40'
                                : item.status === 'shipped'
                                  ? 'bg-green-500/20 text-green-300 border-green-500/40'
                                  : isLocked
                                    ? 'bg-red-500/20 text-red-300 border-red-500/40'
                                    : 'bg-gray-700/40 text-gray-300 border-gray-600';

                              const isSelectable = inventoryFilter === 'inventory' && canShip;
                              const isSelected = selectedShipments.includes(item.instanceId);
                              const rarityTone = item.rarity === 'legendary'
                                ? 'border-violet-400/50 shadow-[0_0_0_1px_rgba(167,139,250,0.24),0_0_20px_rgba(167,139,250,0.12)]'
                                : item.rarity === 'epic' || item.rarity === 'ultra-rare'
                                  ? 'border-fuchsia-500/40 shadow-[0_0_0_1px_rgba(217,70,239,0.2),0_0_18px_rgba(217,70,239,0.11)]'
                                  : item.rarity === 'rare'
                                    ? 'border-cyan-400/40 shadow-[0_0_0_1px_rgba(34,211,238,0.18),0_0_18px_rgba(34,211,238,0.1)]'
                                    : 'border-slate-700/80 shadow-[0_0_0_1px_rgba(148,163,184,0.08)]';
                              const rarityTileTone = item.rarity === 'legendary'
                                ? 'from-violet-500/30 via-indigo-900/35 to-violet-950/40'
                                : item.rarity === 'epic' || item.rarity === 'ultra-rare'
                                  ? 'from-fuchsia-500/28 via-purple-900/35 to-indigo-950/40'
                                  : item.rarity === 'rare'
                                    ? 'from-cyan-500/28 via-blue-900/35 to-indigo-950/40'
                                    : 'from-slate-500/24 via-slate-800/35 to-slate-950/45';
                              const imageGlow = item.rarity === 'legendary'
                                ? 'from-yellow-400/30 via-yellow-200/10 to-transparent'
                                : item.rarity === 'epic' || item.rarity === 'ultra-rare'
                                  ? 'from-purple-400/30 via-fuchsia-300/10 to-transparent'
                                  : item.rarity === 'rare'
                                    ? 'from-blue-400/30 via-cyan-300/10 to-transparent'
                                    : 'from-slate-300/20 via-slate-200/10 to-transparent';
                              return (
                                  <div key={item.instanceId} className={`relative bg-gradient-to-b ${rarityTileTone} border rounded-2xl p-2.5 sm:p-4 group transition-all duration-300 flex flex-col hover:-translate-y-0.5 active:scale-[0.99] ${rarityTone} ${isSelected ? 'ring-2 ring-cyan-300/50 shadow-[0_0_0_1px_rgba(34,211,238,0.5),0_0_22px_rgba(34,211,238,0.22)]' : ''}`}>
                                      <div className="relative aspect-[0.74] mb-2.5 sm:mb-4 bg-[#0f1420] rounded-xl sm:rounded-2xl p-2 sm:p-3 flex items-center justify-center overflow-hidden border border-white/5 shadow-inner">
                                          <div className={`pointer-events-none absolute -inset-4 bg-[radial-gradient(circle_at_center,rgba(56,189,248,0.22)_0%,rgba(56,189,248,0.08)_35%,transparent_70%)] opacity-80`} />
                                          <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${imageGlow}`} />
                                          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-white/5" />
                                          {isSelectable && (
                                              <label className={`absolute left-1.5 top-1.5 z-10 flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-xl sm:rounded-2xl border backdrop-blur-sm ${isSelected ? 'bg-cyan-500/25 border-cyan-200/60 shadow-[0_0_12px_rgba(34,211,238,0.45)]' : 'bg-black/50 border-white/25'}`}>
                                                  <Checkbox
                                                      checked={selectedShipments.includes(item.instanceId)}
                                                      onChange={() => handleToggleShipment(item.instanceId)}
                                                      className="h-4 w-4 accent-brand-purple"
                                                      aria-label={`Select ${item.name} for shipping`}
                                                  />
                                              </label>
                                          )}
                                          <button
                                            type="button"
                                            onClick={() => {
                                              if (isSelectable) {
                                                handleToggleShipment(item.instanceId);
                                              }
                                            }}
                                            disabled={!isSelectable}
                                            aria-pressed={selectedShipments.includes(item.instanceId)}
                                            className={`relative h-full w-full rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple/60 ${
                                              isSelectable ? 'cursor-pointer' : 'cursor-default'
                                            }`}
                                          >
                                            <BlurImage src={item.image} alt={item.name} className="w-full h-full object-contain drop-shadow-[0_10px_16px_rgba(0,0,0,0.45)] group-hover:scale-105 transition-transform duration-500" />
                                            <div className={`absolute inset-0 opacity-10 bg-gradient-to-br ${
                                                item.rarity === 'legendary' ? 'from-yellow-500' :
                                                item.rarity === 'epic' ? 'from-purple-500' :
                                                item.rarity === 'rare' ? 'from-blue-500' : 'from-gray-500'
                                            }`} />
                                            {(item.rarity === 'rare' || item.rarity === 'epic' || item.rarity === 'legendary') && (
                                              <div className="pointer-events-none absolute inset-y-0 -left-1/2 w-1/2 bg-gradient-to-r from-transparent via-white/15 to-transparent opacity-0 group-hover:opacity-100 group-hover:left-full transition-all duration-1000" />
                                            )}
                                          </button>
                                      </div>
                                      <div className="flex items-center justify-between gap-1.5">
                                          <h4 className="text-white font-extrabold text-sm mt-0 mb-0 line-clamp-1 leading-tight sm:text-lg">{item.name}</h4>
                                          <span className="text-[10px] sm:text-xs font-bold px-2 py-1 rounded-full border border-cyan-500/35 bg-cyan-500/20 text-cyan-200 leading-none capitalize">{item.rarity}</span>
                                      </div>
                                      {item.redeemable === false && (
                                        <div className="mt-2 text-[10px] font-semibold uppercase tracking-wide text-amber-300">
                                          Not redeemable for coins
                                        </div>
                                      )}
                                      {isXpItem ? (
                                        <div className="inline-flex items-center rounded-full border border-indigo-500/40 bg-indigo-500/10 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-indigo-300">
                                          XP reward
                                        </div>
                                      ) : (
                                        <CoinAmount
                                          amount={toCoins(item.price, PRICE_UNIT_MODE)}
                                          formatOptions={{ maximumFractionDigits: 0 }}
                                          className="text-white font-black text-xl mt-0.5 mb-0.5 drop-shadow-[0_0_10px_rgba(74,222,128,0.32)] sm:text-2xl"
                                          iconClassName="w-5 h-5 sm:w-6 sm:h-6"
                                        />
                                      )}
                                      <div className="text-[11px] text-gray-400 mt-1">
                                        Obtained {new Date(item.obtainedAt).toLocaleDateString()}
                                      </div>
                                      {inventoryFilter === 'shipped' && item.trackingNumber && (
                                          <div className="text-[11px] text-blue-300 mt-2 break-words">
                                              Tracking: {item.trackingNumber}
                                          </div>
                                      )}

                                      <div className="mt-2.5 sm:mt-4 flex flex-col gap-2">
                                          {inventoryFilter !== 'shipped' && (
                                            <button
                                              onClick={() => handleWithdrawClick(item.instanceId)}
                                              disabled={!canWithdraw}
                                              className={`w-full px-2.5 py-2.5 rounded-xl sm:rounded-2xl font-bold text-sm transition-colors border flex items-center justify-center gap-1.5 sm:text-base ${
                                                canWithdraw
                                                  ? 'bg-[#090d18] text-white border-[#7c3aed] hover:bg-[#121936]'
                                                  : 'bg-[#0b0e14] text-gray-500 border-gray-800 cursor-not-allowed'
                                              }`}
                                            >
                                              <Package className="h-4 w-4 text-violet-300" />
                                              Withdraw
                                            </button>
                                          )}
                                          {inventoryFilter === 'inventory' && item.redeemable !== false && !isXpItem && (
                                              <button
                                                onClick={() => handleOpenTradeInModal(item.instanceId)}
                                                disabled={!canSell || !!isGeneratingSellOffers[item.instanceId] || !!isSellingItems[item.instanceId]}
                                                className={`w-full px-2.5 py-2.5 rounded-xl sm:rounded-2xl font-bold text-sm transition-colors border flex items-center justify-center gap-1.5 disabled:cursor-not-allowed disabled:opacity-80 sm:text-base ${
                                                  canSell
                                                    ? 'bg-[#090d18] text-white border-[#7c3aed] hover:bg-[#121936]'
                                                    : 'bg-[#0b0e14] text-gray-500 border-gray-800 cursor-not-allowed'
                                                }`}
                                              >
                                                <img src={COIN_ICON} alt="" className="h-4 w-4 sm:h-5 sm:w-5 object-contain" />
                                                {isSellingItems[item.instanceId] ? 'Trading in...' : 'Trade In'}
                                              </button>
                                          )}
                                          {inventoryFilter === 'shipped' && (
                                              <button
                                                onClick={() => {
                                                  if (item.trackingNumber) {
                                                    window.open(
                                                      `https://track.aftership.com/?tracking-number=${encodeURIComponent(item.trackingNumber)}`,
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

                  {tradeInModalItem && (
                      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3">
                          <div className="w-full max-w-xl overflow-hidden rounded-2xl border border-[#1f2430] bg-[#05070d] shadow-2xl">
                              <div className="flex items-center justify-between border-b border-white/10 px-4 py-3.5 sm:px-5">
                                  <h3 className="text-xl font-extrabold text-white sm:text-2xl">Trade In Item</h3>
                                  <button type="button" onClick={() => setTradeInModalItemId(null)} className="rounded-lg p-1.5 text-gray-400 hover:bg-white/5 hover:text-white" aria-label="Close trade in dialog">
                                      <X className="h-6 w-6" />
                                  </button>
                              </div>
                              <div className="space-y-3.5 px-4 py-4 sm:px-5 sm:py-5">
                                  <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-gradient-to-b from-[#1b2435] to-[#090b11] p-3.5">
                                      <img src={tradeInModalItem.image} alt={tradeInModalItem.name} className="h-20 w-14 rounded-lg border border-white/10 bg-black/30 object-cover sm:h-24 sm:w-16" />
                                      <div>
                                          <p className="text-base font-bold text-white sm:text-xl">{tradeInModalItem.name}</p>
                                          <CoinAmount amount={toCoins(tradeInModalItem.price, PRICE_UNIT_MODE)} formatOptions={{ maximumFractionDigits: 0 }} className="mt-1.5 text-xl font-black text-white sm:text-2xl" iconClassName="h-5 w-5 sm:h-6 sm:w-6" />
                                      </div>
                                  </div>
                                  <div className="rounded-xl bg-[#151822] px-3.5 py-3.5 sm:px-4">
                                      <div className="space-y-1.5 text-sm text-gray-300 sm:text-base">
                                          <div className="flex items-center justify-between">
                                              <span>Item Value</span>
                                              <CoinAmount amount={toCoins(tradeInModalItem.price, PRICE_UNIT_MODE)} formatOptions={{ maximumFractionDigits: 0 }} className="font-black text-white" iconClassName="h-5 w-5" />
                                          </div>
                                          <div className="flex items-center justify-between">
                                              <span>Trade-In Fee ({Math.round((1 - getSellBackRate(tradeInModalItem)) * 100)}%)</span>
                                              <span className="font-black text-red-400">-{Math.round(toCoins(tradeInModalItem.price, PRICE_UNIT_MODE) - getSellBackValue(toCoins(tradeInModalItem.price, PRICE_UNIT_MODE), getSellBackRate(tradeInModalItem)))}</span>
                                          </div>
                                          <div className="my-1 border-t border-white/10" />
                                          <div className="flex items-center justify-between text-lg font-black text-white sm:text-xl">
                                              <span>You Receive</span>
                                              <CoinAmount amount={getSellBackValue(toCoins(tradeInModalItem.price, PRICE_UNIT_MODE), getSellBackRate(tradeInModalItem))} formatOptions={{ maximumFractionDigits: 0 }} className="text-emerald-400" iconClassName="h-6 w-6" />
                                          </div>
                                      </div>
                                  </div>
                                  <p className="px-1 text-center text-xs text-gray-400 sm:text-sm">This action cannot be undone. The item will be removed from your inventory.</p>
                              </div>
                              <div className="grid grid-cols-2 gap-2.5 border-t border-white/10 p-3.5 sm:p-4">
                                  <button type="button" onClick={() => setTradeInModalItemId(null)} className="rounded-xl bg-[#2a2d36] px-3 py-2.5 text-sm font-extrabold text-white sm:text-base">
                                      Cancel
                                  </button>
                                  <button type="button" onClick={handleConfirmTradeIn} disabled={!!isSellingItems[tradeInModalItem.instanceId]} className="rounded-xl bg-gradient-to-r from-[#6d28d9] to-[#2563eb] px-3 py-2.5 text-sm font-extrabold text-white disabled:opacity-70 sm:text-base">
                                      {isSellingItems[tradeInModalItem.instanceId] ? 'Trading In...' : 'Trade In'}
                                  </button>
                              </div>
                          </div>
                      </div>
                  )}

                  {withdrawLockedModalOpen && (
                      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 sm:p-4">
                          <div className="w-full max-w-2xl overflow-hidden rounded-[30px] border border-[#1f2430] bg-[#05070d] shadow-2xl">
                              <div className="flex items-center justify-between border-b border-white/10 px-5 py-5 sm:px-8">
                                  <h3 className="text-3xl font-extrabold text-white sm:text-4xl">Withdrawals Locked</h3>
                                  <button type="button" onClick={() => setWithdrawLockedModalOpen(false)} className="rounded-lg p-2 text-gray-400 hover:bg-white/5 hover:text-white" aria-label="Close withdrawals locked dialog">
                                      <X className="h-8 w-8" />
                                  </button>
                              </div>
                              <div className="px-5 py-6 sm:px-8">
                                  <div className="rounded-2xl border border-violet-500/40 bg-violet-500/10 p-5">
                                      <p className="text-2xl font-extrabold text-white sm:text-3xl">Make your first deposit to unlock withdrawals.</p>
                                      <p className="mt-2 text-base text-gray-300 sm:text-xl">Once you deposit, you can withdraw items from your inventory.</p>
                                  </div>
                              </div>
                              <div className="grid grid-cols-2 gap-3 border-t border-white/10 p-4 sm:p-5">
                                  <button type="button" onClick={() => setWithdrawLockedModalOpen(false)} className="rounded-2xl bg-[#2a2d36] px-4 py-3 text-lg font-extrabold text-white sm:text-xl">
                                      Not now
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setWithdrawLockedModalOpen(false);
                                      setView({ type: 'BONUSES' });
                                    }}
                                    className="rounded-2xl bg-gradient-to-r from-[#6d28d9] to-[#2563eb] px-4 py-3 text-lg font-extrabold text-white sm:text-xl"
                                  >
                                      Add Coins
                                  </button>
                              </div>
                          </div>
                      </div>
                  )}

                  {showShippingReview && (
                      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 sm:p-4">
                          <div className="w-full max-w-5xl overflow-hidden rounded-2xl border border-[#1f2430] bg-[#05070d] shadow-2xl">
                              <div className="flex items-center justify-between border-b border-white/10 px-4 py-3.5 sm:px-5">
                                  <h3 className="text-xl font-extrabold text-white sm:text-2xl">Confirm shipment</h3>
                                  <button
                                      type="button"
                                      onClick={() => setShowShippingReview(false)}
                                      className="rounded-lg p-1.5 text-gray-400 hover:bg-white/5 hover:text-white transition-colors"
                                      aria-label="Close shipping review"
                                  >
                                      <X className="h-6 w-6" />
                                  </button>
                              </div>
                              <div className="space-y-3.5 px-4 py-4 sm:px-5 sm:py-5">
                                  <p className="text-base text-gray-400 sm:text-lg">
                                      XP Shop items ship free.
                                  </p>

                                  <div className="max-h-56 space-y-3 overflow-y-auto pr-1">
                                      {selectedShipmentItems.map((item) => (
                                          <div key={item.instanceId} className="flex items-center gap-3 rounded-xl border border-white/10 bg-gradient-to-b from-[#1b2435] to-[#090b11] p-3.5">
                                              <div className="h-14 w-10 rounded-lg border border-white/10 bg-black/30 sm:h-20 sm:w-14">
                                                  <BlurImage src={item.image} alt={item.name} className="h-full w-full rounded-lg object-contain" />
                                              </div>
                                              <div className="min-w-0 flex-1">
                                                  <div className="truncate text-sm font-bold text-white sm:text-base">{item.name}</div>
                                                  <div className="text-xs text-gray-400 sm:text-sm">{item.rarity}</div>
                                              </div>
                                              {(shippingCoinEnabled || shippingCashEnabled || isFreeOnlySelection) && (
                                                getCoinShippingCostForItem(item) > 0 ? (
                                                  <CoinAmount
                                                    amount={getCoinShippingCostForItem(item)}
                                                    formatOptions={{ maximumFractionDigits: 0 }}
                                                    className="text-blue-200 font-semibold text-sm"
                                                    iconClassName="w-4 h-4"
                                                  />
                                                ) : (
                                                  <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-300">
                                                    Free shipping
                                                  </span>
                                                )
                                              )}
                                          </div>
                                      ))}
                                      {selectedShipmentItems.length === 0 && (
                                          <div className="rounded-xl border border-white/10 bg-[#151822] py-6 text-center text-sm text-gray-500">
                                              No shippable items selected.
                                          </div>
                                      )}
                                  </div>

                                  <div className="rounded-xl bg-[#151822] px-3.5 py-3.5 sm:px-4">
                                      <div className="space-y-1.5 text-sm text-gray-300 sm:text-base">
                                          <div className="flex items-center justify-between">
                                              <span>Items selected</span>
                                              <span>{selectedShipmentItems.length}</span>
                                          </div>
                                          <div className="flex items-center justify-between">
                                              <span>Free shipping items</span>
                                              <span>{freeShippingItemCount}</span>
                                          </div>
                                          <div className="flex items-center justify-between">
                                              <span>Paid shipping items</span>
                                              <span>{paidShippingItemCount}</span>
                                          </div>
                                          {(shippingCoinEnabled || shippingCashEnabled) && <div className="my-1 border-t border-white/10" />}
                                          {shippingCoinEnabled && (
                                            <div className="flex items-center justify-between text-lg font-black text-white sm:text-xl">
                                                <span>Coins due now</span>
                                                <CoinAmount
                                                  amount={shippingCoinTotal}
                                                  formatOptions={{ maximumFractionDigits: 0 }}
                                                  className="text-blue-200"
                                                  iconClassName="w-5 h-5"
                                                />
                                            </div>
                                          )}
                                          {shippingCashEnabled && (
                                              <div className="flex items-center justify-between font-semibold text-gray-300">
                                                  <span>Cash due now</span>
                                                  <span className="text-emerald-300">
                                                      {formatUsd(shippingCashTotalCents)}
                                                  </span>
                                              </div>
                                          )}
                                      </div>
                                  </div>

                                  {shippingCashEnabled && (
                                      <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-3 text-sm text-emerald-200 sm:text-base">
                                          Cash shipping uses Stripe Checkout. Your shipment is queued after payment succeeds.
                                      </div>
                                  )}

                                  {!user.shippingAddress && (
                                      <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3.5 py-3 text-sm text-amber-300 sm:text-base">
                                          Add a shipping address in Settings to enable shipping.
                                      </div>
                                  )}
                              </div>

                              <div className="space-y-3 border-t border-white/10 p-3.5 sm:p-4">
                                  <button
                                      onClick={() => setShowShippingReview(false)}
                                      className="w-full rounded-xl border border-[#31466e] bg-[#040b17] px-4 py-3 text-base font-extrabold uppercase tracking-wide text-gray-300 transition-colors hover:border-[#4b5d86] hover:text-white"
                                  >
                                      Cancel
                                  </button>
                                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                      {!isFreeOnlySelection && shippingCoinEnabled && (
                                          <button
                                              onClick={handleConfirmShipping}
                                              disabled={
                                                isSubmittingShipment ||
                                                selectedShipmentItems.length === 0 ||
                                                !user.shippingAddress
                                              }
                                              className={`rounded-xl border px-4 py-3 text-base font-extrabold uppercase tracking-wide transition-colors ${
                                                !isSubmittingShipment && selectedShipmentItems.length > 0 && user.shippingAddress
                                                  ? 'border-blue-500/40 bg-blue-600/20 text-blue-200 hover:bg-blue-600/30'
                                                  : 'border-gray-800 bg-[#0b0e14] text-gray-500 cursor-not-allowed'
                                              }`}
                                          >
                                              {isSubmittingShipment ? 'Submitting...' : 'Ship with coins'}
                                          </button>
                                      )}
                                      {!isFreeOnlySelection && shippingCashEnabled && (
                                          <button
                                              onClick={handleCashShipping}
                                              disabled={
                                                isSubmittingCashShipping ||
                                                selectedShipmentItems.length === 0 ||
                                                !user.shippingAddress
                                              }
                                              className={`rounded-xl border px-4 py-3 text-base font-extrabold uppercase tracking-wide transition-colors ${
                                                !isSubmittingCashShipping && selectedShipmentItems.length > 0 && user.shippingAddress
                                                  ? 'border-emerald-500/40 bg-emerald-600/20 text-emerald-200 hover:bg-emerald-600/30'
                                                  : 'border-gray-800 bg-[#0b0e14] text-gray-500 cursor-not-allowed'
                                              }`}
                                          >
                                              {isSubmittingCashShipping
                                                ? 'Redirecting...'
                                                : shippingCashTotalCents > 0
                                                  ? `Ship – ${formatUsd(shippingCashTotalCents)}`
                                                  : 'Ship now (no payment)'}
                                          </button>
                                      )}
                                      {isFreeOnlySelection && (
                                          <button
                                              onClick={handleConfirmFreeShipping}
                                              disabled={
                                                isSubmittingShipment ||
                                                selectedShipmentItems.length === 0 ||
                                                !user.shippingAddress
                                              }
                                              className={`rounded-xl border px-4 py-3 text-base font-extrabold uppercase tracking-wide transition-colors ${
                                                !isSubmittingShipment && selectedShipmentItems.length > 0 && user.shippingAddress
                                                  ? 'border-emerald-500/40 bg-emerald-600/20 text-emerald-200 hover:bg-emerald-600/30'
                                                  : 'border-gray-800 bg-[#0b0e14] text-gray-500 cursor-not-allowed'
                                              }`}
                                          >
                                              {isSubmittingShipment ? 'Submitting...' : 'Confirm free shipping'}
                                          </button>
                                      )}
                                  </div>
                              </div>
                          </div>
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
                          <Input 
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
                                              <img loading="lazy" decoding="async" src={p.avatar} alt={p.name} className="w-12 h-12 rounded-lg object-cover bg-gray-800" />
                                              <div>
                                                  <div className="text-white font-bold">{p.name}</div>
                                                  <div className="text-xs text-gray-500">XP {(p.xpBalance ?? p.xp ?? 0).toLocaleString()}</div>
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
                                          <img loading="lazy" decoding="async" src={p.avatar} alt={p.name} className="w-12 h-12 rounded-lg object-cover bg-gray-800" />
                                          <div>
                                              <div className="text-white font-bold">{p.name}</div>
                                              <div className="text-xs text-gray-500">XP {(p.xpBalance ?? p.xp ?? 0).toLocaleString()}</div>
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
                                  <label className="block text-sm font-bold text-gray-400 mb-2">Username</label>
                                  <Input 
                                      type="text" 
                                      value={profileForm.name}
                                      onChange={(e) => setProfileForm({...profileForm, name: e.target.value})}
                                      className="w-full bg-[#0b0e14] border border-gray-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-brand-purple transition-colors"
                                  />
                              </div>
                              
                              <div>
                                  <label className="block text-sm font-bold text-gray-400 mb-4">Choose Profile Picture</label>
                                  <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-3 mb-4">
                                      {AVATAR_PRESETS.map((url, idx) => (
                                          <button 
                                              key={idx}
                                              onClick={() => setProfileForm({...profileForm, avatar: url})}
                                              className={`relative aspect-square rounded-xl overflow-hidden border-2 transition-all ${profileForm.avatar === url ? 'border-brand-purple scale-95' : 'border-transparent hover:border-gray-700'}`}
                                          >
                                              <img loading="lazy" decoding="async" src={url} alt="preset" className="w-full h-full object-cover" />
                                              {profileForm.avatar === url && (
                                                  <div className="absolute inset-0 bg-brand-purple/20 flex items-center justify-center">
                                                      <Check className="w-6 h-6 text-white" />
                                                  </div>
                                              )}
                                          </button>
                                      ))}
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
                                  <Input 
                                      type="text" 
                                      value={addressForm.fullName}
                                      onChange={(e) => setAddressForm({...addressForm, fullName: e.target.value})}
                                      className="w-full bg-[#0b0e14] border border-gray-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-brand-purple transition-colors"
                                      placeholder="John Doe"
                                  />
                              </div>
                              <div className="md:col-span-2">
                                  <label className="block text-sm font-bold text-gray-400 mb-2">Street Address</label>
                                  <Input 
                                      type="text" 
                                      value={addressForm.street}
                                      onChange={(e) => setAddressForm({...addressForm, street: e.target.value})}
                                      className="w-full bg-[#0b0e14] border border-gray-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-brand-purple transition-colors"
                                      placeholder="123 Gaming Ave"
                                  />
                              </div>
                              <div>
                                  <label className="block text-sm font-bold text-gray-400 mb-2">City</label>
                                  <Input 
                                      type="text" 
                                      value={addressForm.city}
                                      onChange={(e) => setAddressForm({...addressForm, city: e.target.value})}
                                      className="w-full bg-[#0b0e14] border border-gray-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-brand-purple transition-colors"
                                  />
                              </div>
                              <div>
                                  <label className="block text-sm font-bold text-gray-400 mb-2">State / Province</label>
                                  <Input 
                                      type="text" 
                                      value={addressForm.state}
                                      onChange={(e) => setAddressForm({...addressForm, state: e.target.value})}
                                      className="w-full bg-[#0b0e14] border border-gray-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-brand-purple transition-colors"
                                  />
                              </div>
                              <div>
                                  <label className="block text-sm font-bold text-gray-400 mb-2">Zip / Postal Code</label>
                                  <Input 
                                      type="text" 
                                      value={addressForm.zipCode}
                                      onChange={(e) => setAddressForm({...addressForm, zipCode: e.target.value})}
                                      className="w-full bg-[#0b0e14] border border-gray-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-brand-purple transition-colors"
                                  />
                              </div>
                              <div>
                                  <label className="block text-sm font-bold text-gray-400 mb-2">Country</label>
                                  <Input 
                                      type="text" 
                                      value={addressForm.country}
                                      onChange={(e) => setAddressForm({...addressForm, country: e.target.value})}
                                      className="w-full bg-[#0b0e14] border border-gray-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-brand-purple transition-colors"
                                  />
                              </div>
                          </div>
                          
                          <button 
                              onClick={handleSaveAddress}
                              disabled={isSavingAddress}
                              className="w-full mt-8 py-3 bg-[#1a2130] text-white rounded-xl font-bold hover:bg-gray-800 transition-all border border-gray-700 flex items-center justify-center gap-2 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                              <Save className="w-5 h-5" /> {isSavingAddress ? 'Saving Address…' : 'Save Shipping Address'}
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
                                  <Input 
                                      type="password" 
                                      value={passwordForm.current}
                                      onChange={(e) => setPasswordForm({...passwordForm, current: e.target.value})}
                                      className="w-full bg-[#0b0e14] border border-gray-800 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-brand-purple transition-colors"
                                  />
                              </div>
                              <div>
                                  <label className="block text-xs font-bold text-gray-500 uppercase mb-2">New Password</label>
                                  <Input 
                                      type="password" 
                                      value={passwordForm.new}
                                      onChange={(e) => setPasswordForm({...passwordForm, new: e.target.value})}
                                      className="w-full bg-[#0b0e14] border border-gray-800 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-brand-purple transition-colors"
                                  />
                              </div>
                              <div>
                                  <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Confirm New Password</label>
                                  <Input 
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
