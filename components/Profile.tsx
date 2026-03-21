import React, { useState, useEffect, useMemo, useRef } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { useGame } from '../context/GameContext';
import { useSound } from '../context/SoundContext';
import { XP_ICON } from '../constants';
import { getSellBackValue } from '../utils/sellBack';
import { PRICE_UNIT_MODE, toCoins } from '../utils/coins';
import { CoinAmount } from './CoinAmount';
import { User, Clock, MapPin, Save, Check, Settings, Shield, Lock, LogOut, AlertTriangle, UserPlus, UserCheck, Users as UsersIcon, Sparkles, Trash2, ExternalLink, Search, Package, ChevronLeft, ChevronRight, CalendarDays, Gem, Boxes } from 'lucide-react';
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
  const [isSubmittingShipment, setIsSubmittingShipment] = useState(false);
  const [isSubmittingCashShipping, setIsSubmittingCashShipping] = useState(false);
  const [isSavingAddress, setIsSavingAddress] = useState(false);
  const [addressSaveMessage, setAddressSaveMessage] = useState<string | null>(null);
  const [addressSaveError, setAddressSaveError] = useState<string | null>(null);
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
      setAddressSaveMessage(null);
      setAddressSaveError(null);
      try {
        await updateAddress(addressForm);
        setAddressSaveMessage('Shipping address saved!');
        toast.success("Shipping address saved!");
      } catch (error) {
        console.error('Failed to save shipping address from profile form', error);
        setAddressSaveError('Could not save your shipping address. Please try again.');
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
      <div className="relative mb-5 overflow-hidden rounded-[30px] border border-white/8 bg-[linear-gradient(160deg,rgba(10,13,20,0.96),rgba(13,18,28,0.88))] shadow-[0_32px_90px_rgba(0,0,0,0.42),0_0_40px_rgba(64,212,255,0.05)] backdrop-blur-[22px]">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(124,58,237,0.2),transparent_34%),radial-gradient(circle_at_85%_20%,rgba(56,189,248,0.12),transparent_28%),linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.01))]" />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
        <div className="relative px-4 py-4 sm:px-6 sm:py-5">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(320px,0.85fr)] xl:items-start">
            <div className="rounded-[26px] border border-white/8 bg-white/[0.045] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_24px_48px_rgba(5,10,20,0.22)] backdrop-blur-xl sm:p-5">
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-center">
                    <div className="relative mx-auto shrink-0 sm:mx-0">
                      <div className="absolute inset-1 rounded-[26px] bg-[radial-gradient(circle,rgba(110,92,255,0.34),rgba(56,189,248,0.12)_58%,transparent_78%)] blur-2xl" />
                      <div className="relative rounded-[26px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.14),rgba(255,255,255,0.04))] p-1.5 shadow-[0_18px_38px_rgba(12,17,29,0.34),inset_0_1px_0_rgba(255,255,255,0.2)]">
                        <img loading="lazy" decoding="async" src={displayUser.avatar} alt={displayUser.name} className="h-24 w-24 rounded-[20px] object-cover bg-[#0b0e14]/90 sm:h-[104px] sm:w-[104px]" />
                      </div>
                    </div>

                    <div className="min-w-0 text-center sm:text-left">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[#8f98b2] sm:text-[11px]">Player Profile</p>
                      <h2 className="mt-2 truncate text-[1.8rem] font-black tracking-[-0.03em] text-white sm:text-[2.15rem]">{displayUser.name}</h2>
                      <div className="mt-3 inline-flex max-w-full items-center gap-2 rounded-full border border-cyan-400/15 bg-[linear-gradient(135deg,rgba(56,189,248,0.12),rgba(124,58,237,0.14))] px-3 py-1.5 text-sm text-gray-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]">
                        <img loading="lazy" decoding="async" src={XP_ICON} alt="XP" className="h-4 w-4 object-contain" />
                        <span className="text-[#9ba3ba]">XP</span>
                        <span className="font-bold text-white"><AnimatedNumber value={xpTotal} /></span>
                      </div>
                      <p className="mt-3 max-w-2xl text-sm leading-6 text-[#98a2ba]">
                        Track your collection, manage shipments, and keep your standout pulls organized in one clean command center.
                      </p>
                    </div>
                  </div>

                  <div className="flex w-full flex-col gap-2 sm:w-auto sm:min-w-[190px]">
                    {!isOwnProfile && (
                      isFollowing ? (
                        <button
                          onClick={handleUnfollowClick}
                          className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-white/12 bg-white/[0.07] px-4 text-sm font-bold text-gray-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.15)] transition-colors hover:bg-white/[0.1]"
                        >
                          <UserCheck className="h-4 w-4" /> Following
                        </button>
                      ) : (
                        <button
                          onClick={handleFollowClick}
                          className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[linear-gradient(135deg,#7c3aed,#2563eb)] px-4 text-sm font-bold text-white shadow-[0_18px_36px_rgba(79,70,229,0.3)] transition-transform hover:-translate-y-0.5"
                        >
                          <UserPlus className="h-4 w-4" /> Follow
                        </button>
                      )
                    )}
                    {isOwnProfile && (
                      <>
                        <button
                          onClick={() => setActiveTab('settings')}
                          className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-white/12 bg-white/[0.07] px-4 text-sm font-bold text-white transition-colors hover:bg-white/[0.1]"
                        >
                          <Settings className="h-4 w-4" /> Edit Profile
                        </button>
                        <button
                          onClick={() => setView({ type: 'BOXES' })}
                          className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[linear-gradient(135deg,#7c3aed,#2563eb)] px-4 text-sm font-bold text-white shadow-[0_18px_36px_rgba(79,70,229,0.3)] transition-transform hover:-translate-y-0.5"
                        >
                          <Sparkles className="h-4 w-4" /> Open Boxes
                        </button>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-x-5 gap-y-3 border-t border-white/8 pt-3">
                  {[
                    { icon: UsersIcon, label: 'Followers', value: viewedFollowerIds.length.toLocaleString() },
                    { icon: UserPlus, label: 'Following', value: viewedFollowing.length.toLocaleString() },
                    { icon: CalendarDays, label: 'Joined', value: joinedDateLabel },
                    { icon: Boxes, label: 'Inventory', value: inventoryCount.toLocaleString() }
                  ].map(({ icon: Icon, label, value }) => (
                    <div key={label} className="inline-flex min-w-[120px] items-center gap-2.5 text-left">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/[0.045] text-cyan-200/80">
                        <Icon className="h-3.5 w-3.5" />
                      </div>
                      <div>
                        <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#7f88a1]">{label}</div>
                        <div className="text-sm font-semibold text-white">{value}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="rounded-[26px] border border-white/8 bg-white/[0.04] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_22px_46px_rgba(5,10,20,0.2)] backdrop-blur-xl sm:p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#7f88a1]">Highlights</p>
                  <h3 className="mt-1 text-xl font-black text-white">{canViewTopPulls ? 'Top Pulls Snapshot' : 'Highlights Private'}</h3>
                  <p className="mt-1 text-sm leading-6 text-gray-400">A calmer overview of the biggest pulls and profile milestones.</p>
                </div>
                <div className="rounded-xl border border-fuchsia-400/15 bg-fuchsia-500/10 p-2 text-fuchsia-100">
                  <Gem className="h-4 w-4" />
                </div>
              </div>

              {canViewTopPulls && topPulls.length > 0 ? (
                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-2">
                  {topPulls.slice(0, 4).map((item, index) => (
                    <div key={item.instanceId} className="rounded-2xl border border-white/8 bg-[#0d121b]/90 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
                      <div className="relative flex aspect-square items-center justify-center overflow-hidden rounded-xl bg-[radial-gradient(circle_at_top,rgba(124,58,237,0.18),transparent_58%),linear-gradient(180deg,#131927,#0e131d)] p-2.5">
                        <span className="absolute left-2 top-2 rounded-full border border-white/10 bg-black/40 px-2 py-0.5 text-[10px] font-black text-white">#{index + 1}</span>
                        <BlurImage src={item.image} alt={item.name} className="h-full w-full object-contain" />
                      </div>
                      <div className="mt-3">
                        <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#7d859d]">{item.rarity}</div>
                        <div className="mt-1 truncate text-sm font-semibold text-white">{item.name}</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-4 rounded-2xl border border-white/8 bg-[#0d121b]/85 px-4 py-4 text-sm text-gray-300">
                  {canViewTopPulls ? 'Your best pulls will show here once you open more boxes.' : 'This player keeps their best pulls private.'}
                </div>
              )}

              <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-3 xl:grid-cols-1">
                {[
                  { icon: Sparkles, label: 'Top Pulls', value: topPulls.length.toLocaleString() },
                  { icon: Boxes, label: 'Inventory', value: inventoryCount.toLocaleString() },
                  { icon: CalendarDays, label: 'Member Since', value: joinedDateLabel }
                ].map(({ icon: Icon, label, value }) => (
                  <div key={label} className="flex items-center justify-between rounded-2xl border border-white/8 bg-white/[0.03] px-3.5 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/[0.05] text-brand-purple">
                        <Icon className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#7f88a1]">{label}</div>
                        <div className="text-sm font-semibold text-white">{value}</div>
                      </div>
                    </div>
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
                  <div className="rounded-[28px] border border-white/8 bg-[linear-gradient(180deg,rgba(17,22,32,0.92),rgba(12,16,24,0.92))] p-5 shadow-[0_24px_56px_rgba(0,0,0,0.28)]">
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#7f88a1]">Highlights</p>
                              <h3 className="mt-1 text-2xl font-black text-white">Top Pulls</h3>
                              <p className="mt-2 text-sm text-gray-400">Your most valuable items, presented with clearer hierarchy and less visual clutter.</p>
                          </div>
                          {isOwnProfile && (
                              <button 
                                onClick={() => setView({ type: 'BOXES' })}
                                className="inline-flex h-11 items-center justify-center rounded-xl bg-[linear-gradient(135deg,#7c3aed,#2563eb)] px-4 text-sm font-bold text-white shadow-[0_18px_36px_rgba(79,70,229,0.28)] transition-transform hover:-translate-y-0.5"
                              >
                                Open Boxes
                              </button>
                          )}
                      </div>
                  </div>

                  {!canViewTopPulls ? (
                      <div className="rounded-[28px] border border-white/8 bg-[linear-gradient(180deg,rgba(17,22,32,0.92),rgba(12,16,24,0.92))] p-12 text-center shadow-[0_24px_56px_rgba(0,0,0,0.22)]">
                          <Lock className="w-12 h-12 text-gray-700 mx-auto mb-4" />
                          <h3 className="text-xl font-bold text-white mb-2">Top Pulls Are Private</h3>
                          <p className="text-gray-500">This player has chosen to keep their top pulls private.</p>
                      </div>
                  ) : (isOwnProfile && inventory.length === 0) ? (
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
                        {Array.from({ length: 6 }).map((_, idx) => <SkeletonTile key={`top-pull-skeleton-${idx}`} />)}
                      </div>
                  ) : topPulls.length === 0 ? (
                      <div className="rounded-[28px] border border-white/8 bg-[linear-gradient(180deg,rgba(17,22,32,0.92),rgba(12,16,24,0.92))] p-12 text-center shadow-[0_24px_56px_rgba(0,0,0,0.22)]">
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
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
                          {topPulls.map((item, index) => (
                              <div key={item.instanceId} className="group rounded-[24px] border border-white/8 bg-[linear-gradient(180deg,rgba(18,24,35,0.96),rgba(11,16,24,0.96))] p-3 sm:p-4 shadow-[0_18px_40px_rgba(0,0,0,0.22)] transition-all hover:-translate-y-0.5 hover:border-brand-purple/30">
                                  <div className="relative mb-3 aspect-square overflow-hidden rounded-[20px] border border-white/6 bg-[#0b0e14] p-3 sm:mb-4 sm:p-4 flex items-center justify-center">
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
                  <div className="rounded-[28px] border border-white/8 bg-[linear-gradient(180deg,rgba(17,22,32,0.92),rgba(12,16,24,0.92))] p-4 shadow-[0_24px_56px_rgba(0,0,0,0.28)] sm:p-5">
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                          <div>
                              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#7f88a1]">Collection</p>
                              <h3 className="mt-1 text-2xl font-black text-white">Inventory</h3>
                              <p className="mt-2 text-sm text-gray-400">Manage your items, review shipment status, and sell eligible rewards without the extra visual noise.</p>
                              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-[#a6b0c7]">
                                  <span><span className="font-semibold text-white">{inventoryStats.totalItems}</span> total items</span>
                                  <span className="hidden sm:inline text-white/20">•</span>
                                  <span><span className="font-semibold text-white">{inventoryStats.visibleItems}</span> in this view</span>
                                  <span className="hidden sm:inline text-white/20">•</span>
                                  <span><span className="font-semibold text-white">{inventoryStats.sellableItems}</span> sellable</span>
                                  <span className="hidden sm:inline text-white/20">•</span>
                                  <span><CoinAmount amount={inventoryStats.currentValue} formatOptions={{ maximumFractionDigits: 0 }} className="font-semibold text-white" iconClassName="w-4 h-4" /> current value</span>
                              </div>
                          </div>
                          <div className="-mx-1 flex items-center gap-2 overflow-x-auto px-1 pb-1 [&::-webkit-scrollbar]:hidden" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                              {(['inventory', 'processing', 'shipped'] as const).map((filter) => (
                                  <button
                                      key={filter}
                                      onClick={() => setInventoryFilter(filter)}
                                      className={`rounded-full px-4 py-2 text-xs font-bold uppercase tracking-[0.16em] transition-all ${
                                          inventoryFilter === filter
                                              ? 'border border-brand-purple/35 bg-brand-purple/18 text-white shadow-[0_10px_24px_rgba(124,58,237,0.2)]'
                                              : 'border border-white/8 bg-white/[0.03] text-gray-400 hover:text-white hover:bg-white/[0.06]'
                                      }`}
                                  >
                                      {filter === 'inventory' ? 'Inventory' : filter === 'processing' ? 'Processing' : 'Shipped'}
                                  </button>
                              ))}
                          </div>
                      </div>
                  </div>

                  {inventoryFilter === 'inventory' && (
                      <div className="sticky top-20 z-10 rounded-2xl border border-cyan-400/15 bg-[linear-gradient(180deg,rgba(13,20,30,0.96),rgba(10,15,24,0.94))] px-4 py-3 shadow-[0_18px_40px_rgba(0,0,0,0.26)] backdrop-blur-xl">
                          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-[#aab4c9]">
                                  <span className="font-semibold text-white">Ship Multiple Items</span>
                                  <span><span className="font-semibold text-white">{selectedShipments.length}</span> selected</span>
                                  {shippingCoinEnabled && (
                                    <span className="flex items-center gap-1.5">
                                      <span>Per item</span>
                                      <CoinAmount
                                        amount={shippingCoinCostCoins}
                                        formatOptions={{ maximumFractionDigits: 0 }}
                                        className="font-semibold text-cyan-100"
                                        iconClassName="w-3 h-3"
                                      />
                                    </span>
                                  )}
                                  {!shippingCoinEnabled && shippingCashEnabled && <span>Cash shipping only</span>}
                              </div>
                              <button
                                  onClick={() => setShowShippingReview(true)}
                                  disabled={!user.shippingAddress || selectedShipments.length === 0}
                                  className={`inline-flex h-10 items-center justify-center rounded-xl border px-4 text-xs font-bold uppercase tracking-[0.16em] transition-colors ${
                                    user.shippingAddress && selectedShipments.length > 0
                                      ? 'border-cyan-300/35 bg-cyan-400/12 text-cyan-100 hover:bg-cyan-400/18'
                                      : 'border-white/8 bg-white/[0.03] text-gray-500 cursor-not-allowed'
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
                      <div className="rounded-[28px] border border-white/8 bg-[linear-gradient(180deg,rgba(17,22,32,0.92),rgba(12,16,24,0.92))] p-12 text-center shadow-[0_24px_56px_rgba(0,0,0,0.22)]">
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
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
                          {filteredInventory.map((item) => {
                              const isAvailable = item.status === 'available';
                              const isLocked = !!item.locked;
                              const isXpItem = isXpPurchasedItem(item);
                              const canShip = isAvailable && !isLocked && !!user.shippingAddress;
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
                                ? 'border-yellow-400/45 shadow-[0_0_0_1px_rgba(250,204,21,0.18),0_0_20px_rgba(250,204,21,0.15)]'
                                : item.rarity === 'epic' || item.rarity === 'ultra-rare'
                                  ? 'border-purple-400/45 shadow-[0_0_0_1px_rgba(168,85,247,0.18),0_0_18px_rgba(168,85,247,0.16)]'
                                  : item.rarity === 'rare'
                                    ? 'border-blue-400/45 shadow-[0_0_0_1px_rgba(59,130,246,0.15),0_0_18px_rgba(59,130,246,0.14)]'
                                    : 'border-slate-600/70 shadow-[0_0_0_1px_rgba(148,163,184,0.1)]';
                              const imageGlow = item.rarity === 'legendary'
                                ? 'from-yellow-400/30 via-yellow-200/10 to-transparent'
                                : item.rarity === 'epic' || item.rarity === 'ultra-rare'
                                  ? 'from-purple-400/30 via-fuchsia-300/10 to-transparent'
                                  : item.rarity === 'rare'
                                    ? 'from-blue-400/30 via-cyan-300/10 to-transparent'
                                    : 'from-slate-300/20 via-slate-200/10 to-transparent';
                              return (
                                  <div key={item.instanceId} className={`relative flex h-full flex-col rounded-[24px] border bg-[linear-gradient(180deg,rgba(20,25,37,0.95),rgba(13,17,26,0.95))] p-3 shadow-[0_18px_36px_rgba(0,0,0,0.22)] transition-all duration-300 hover:-translate-y-0.5 ${rarityTone} ${isSelected ? 'ring-2 ring-cyan-300/50 shadow-[0_0_0_1px_rgba(34,211,238,0.5),0_0_22px_rgba(34,211,238,0.18)]' : ''}`}>
                                      <div className="relative aspect-square rounded-[20px] border border-white/6 bg-[#0b0f17] p-3 flex items-center justify-center overflow-hidden shadow-inner">
                                          <div className={`pointer-events-none absolute -inset-4 bg-[radial-gradient(circle_at_center,rgba(56,189,248,0.22)_0%,rgba(56,189,248,0.08)_35%,transparent_70%)] opacity-80`} />
                                          <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${imageGlow}`} />
                                          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-white/5" />
                                          {isSelectable && (
                                              <label className={`absolute left-2 top-2 z-10 flex h-6 w-6 items-center justify-center rounded-full border backdrop-blur-sm ${isSelected ? 'bg-cyan-500/25 border-cyan-200/60 shadow-[0_0_12px_rgba(34,211,238,0.45)]' : 'bg-black/65 border-white/25'}`}>
                                                  <Checkbox
                                                      checked={selectedShipments.includes(item.instanceId)}
                                                      onChange={() => handleToggleShipment(item.instanceId)}
                                                      className="h-3.5 w-3.5 accent-brand-purple"
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
                                      <div className="mt-3 flex items-start justify-between gap-2">
                                          <div className="min-w-0">
                                            <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-gray-400">{item.rarity}</div>
                                            <h4 className="mt-1 line-clamp-2 min-h-[2.5rem] text-sm font-bold leading-snug text-white">{item.name}</h4>
                                          </div>
                                          <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-bold leading-none ${statusTone}`}>{statusLabel}</span>
                                      </div>
                                      <div className="mt-2 flex items-center justify-between gap-2">
                                        {isXpItem ? (
                                          <div className="inline-flex items-center rounded-full border border-indigo-500/35 bg-indigo-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-indigo-300">
                                            XP reward
                                          </div>
                                        ) : (
                                          <CoinAmount
                                            amount={toCoins(item.price, PRICE_UNIT_MODE)}
                                            formatOptions={{ maximumFractionDigits: 0 }}
                                            className="text-green-300 font-black text-base drop-shadow-[0_0_10px_rgba(74,222,128,0.26)]"
                                            iconClassName="w-4 h-4"
                                          />
                                        )}
                                        <div className="text-[11px] text-right text-gray-500">
                                          {new Date(item.obtainedAt).toLocaleDateString()}
                                        </div>
                                      </div>
                                      {item.redeemable === false && (
                                        <div className="mt-2 text-[10px] font-semibold uppercase tracking-wide text-amber-300">
                                          Not redeemable for coins
                                        </div>
                                      )}
                                      {inventoryFilter === 'shipped' && item.trackingNumber && (
                                          <div className="mt-2 rounded-xl border border-blue-400/15 bg-blue-500/8 px-3 py-2 text-[11px] text-blue-200 break-words">
                                              Tracking: {item.trackingNumber}
                                          </div>
                                      )}

                                      <div className="mt-auto pt-3.5 flex flex-col gap-2">
                                          {inventoryFilter !== 'shipped' && (
                                            <button
                                              onClick={() => handleOpenShippingReview([item.instanceId])}
                                              disabled={!canShip}
                                              className={`w-full rounded-xl border px-3 py-2.5 text-xs font-bold uppercase tracking-[0.14em] transition-colors ${
                                                canShip
                                                  ? 'border-blue-400/30 bg-blue-500/12 text-blue-100 hover:bg-blue-500/18'
                                                  : 'border-white/8 bg-[#0b0e14] text-gray-500 cursor-not-allowed'
                                              }`}
                                            >
                                              Ship item
                                            </button>
                                          )}
                                          {inventoryFilter === 'inventory' && item.redeemable !== false && !isXpItem && (
                                              <button
                                                onClick={async () => {
                                                  if (!canSell || isGeneratingSellOffers[item.instanceId] || isSellingItems[item.instanceId]) return;
                                                  if (!sellOffers[item.instanceId]) {
                                                    setIsGeneratingSellOffers((prev) => ({ ...prev, [item.instanceId]: true }));
                                                    const timerId = window.setTimeout(() => {
                                                      setSellOffers((prev) => ({ ...prev, [item.instanceId]: true }));
                                                      setIsGeneratingSellOffers((prev) => ({ ...prev, [item.instanceId]: false }));
                                                      delete sellOfferTimersRef.current[item.instanceId];
                                                    }, 900);
                                                    sellOfferTimersRef.current[item.instanceId] = timerId;
                                                    return;
                                                  }
                                                  setIsSellingItems((prev) => ({ ...prev, [item.instanceId]: true }));
                                                  try {
                                                    await sellItem(item.instanceId);
                                                  } finally {
                                                    setIsSellingItems((prev) => ({ ...prev, [item.instanceId]: false }));
                                                  }
                                                  if (sellOfferTimersRef.current[item.instanceId]) {
                                                    window.clearTimeout(sellOfferTimersRef.current[item.instanceId]);
                                                    delete sellOfferTimersRef.current[item.instanceId];
                                                  }
                                                  setSellOffers((prev) => ({ ...prev, [item.instanceId]: false }));
                                                  setIsGeneratingSellOffers((prev) => ({ ...prev, [item.instanceId]: false }));
                                                }}
                                                disabled={!canSell || !!isGeneratingSellOffers[item.instanceId] || !!isSellingItems[item.instanceId]}
                                                className={`flex w-full items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-xs font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-80 ${
                                                  canSell
                                                    ? 'bg-[#0b0e14] text-gray-200 border-white/10 hover:border-brand-purple/45'
                                                    : 'bg-[#0b0e14] text-gray-500 border-white/8 cursor-not-allowed'
                                                }`}
                                              >
                                                <span className="flex flex-col items-center gap-1 text-center">
                                                  <span className="flex items-center justify-center gap-2 uppercase tracking-wide text-[10px]">
                                                    {(isGeneratingSellOffers[item.instanceId] || isSellingItems[item.instanceId]) && (
                                                      <span className="h-3 w-3 animate-spin rounded-full border border-gray-400/60 border-t-transparent" aria-hidden="true" />
                                                    )}
                                                    {isSellingItems[item.instanceId]
                                                      ? 'Selling item...'
                                                      : isGeneratingSellOffers[item.instanceId]
                                                        ? 'Generating offer...'
                                                        : sellOffers[item.instanceId]
                                                          ? 'Instant sell now'
                                                          : item.redeemable === false
                                                            ? 'Not redeemable'
                                                            : `Get ${Math.round(getSellBackValue(toCoins(item.price, PRICE_UNIT_MODE), getSellBackRate(item)))} coins`}
                                                  </span>
                                                  {sellOffers[item.instanceId] && !isGeneratingSellOffers[item.instanceId] && !isSellingItems[item.instanceId] && item.redeemable !== false && (
                                                    <CoinAmount
                                                      amount={getSellBackValue(toCoins(item.price, PRICE_UNIT_MODE), getSellBackRate(item))}
                                                      formatOptions={{ maximumFractionDigits: 0 }}
                                                      className="text-gray-100"
                                                      iconClassName="w-3 h-3"
                                                    />
                                                  )}
                                                </span>
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

                  {showShippingReview && (
                      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
                          <div className="w-full max-w-lg rounded-2xl border border-gray-800 bg-[#0b0e14] p-6 shadow-2xl">
                              <div className="flex items-center justify-between">
                                  <h3 className="text-lg font-bold text-white">Confirm shipment</h3>
                                  <button
                                      onClick={() => setShowShippingReview(false)}
                                      className="text-gray-500 hover:text-white transition-colors"
                                      aria-label="Close shipping review"
                                  >
                                      ✕
                                  </button>
                              </div>
                              <p className="mt-2 text-sm text-gray-500">
                                  XP Shop items ship free.
                              </p>

                              <div className="mt-4 space-y-3 max-h-48 overflow-y-auto pr-1">
                                  {selectedShipmentItems.map((item) => (
                                      <div key={item.instanceId} className="flex items-center gap-3 rounded-xl border border-gray-800 bg-[#131720] p-3">
                                          <div className="h-10 w-10 rounded-lg bg-[#0b0e14]"><BlurImage src={item.image} alt={item.name} className="h-10 w-10 rounded-lg object-contain" /></div>
                                          <div className="flex-1">
                                              <div className="text-sm font-semibold text-white">{item.name}</div>
                                              <div className="text-xs text-gray-500">{item.rarity}</div>
                                          </div>
                                          {(shippingCoinEnabled || shippingCashEnabled || isFreeOnlySelection) && (
                                            getCoinShippingCostForItem(item) > 0 ? (
                                              <CoinAmount
                                                amount={getCoinShippingCostForItem(item)}
                                                formatOptions={{ maximumFractionDigits: 0 }}
                                                className="text-blue-200 font-semibold text-xs"
                                                iconClassName="w-3 h-3"
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
                                      <div className="text-sm text-gray-500 text-center py-6">
                                          No shippable items selected.
                                      </div>
                                  )}
                              </div>

                              <div className="mt-4 space-y-2 border-t border-gray-800 pt-4 text-sm">
                                  <div className="flex items-center justify-between text-gray-400">
                                      <span>Items selected</span>
                                      <span>{selectedShipmentItems.length}</span>
                                  </div>
                                  <div className="flex items-center justify-between text-gray-400">
                                      <span>Free shipping items</span>
                                      <span>{freeShippingItemCount}</span>
                                  </div>
                                  <div className="flex items-center justify-between text-gray-400">
                                      <span>Paid shipping items</span>
                                      <span>{paidShippingItemCount}</span>
                                  </div>
                                  {shippingCoinEnabled && (
                                    <>
                                      <div className="flex items-center justify-between text-white font-bold">
                                          <span>Coins due now</span>
                                          <CoinAmount
                                            amount={shippingCoinTotal}
                                            formatOptions={{ maximumFractionDigits: 0 }}
                                            className="text-blue-200"
                                            iconClassName="w-4 h-4"
                                          />
                                      </div>
                                    </>
                                  )}
                              {shippingCashEnabled && (
                                  <div className="flex items-center justify-between text-gray-400">
                                      <span>Cash due now</span>
                                      <span className="text-emerald-300 font-semibold">
                                          {formatUsd(shippingCashTotalCents)}
                                      </span>
                                  </div>
                              )}
                          </div>

                              {shippingCashEnabled && (
                                  <div className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">
                                      Cash shipping uses Stripe Checkout. Your shipment is queued after payment succeeds.
                                  </div>
                              )}

                              {!user.shippingAddress && (
                                  <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
                                      Add a shipping address in Settings to enable shipping.
                                  </div>
                              )}

                              <div className="mt-5 flex flex-col gap-3">
                                  <button
                                      onClick={() => setShowShippingReview(false)}
                                      className="flex-1 rounded-lg border border-gray-700 bg-[#0b0e14] px-4 py-2 text-xs font-bold uppercase tracking-wide text-gray-300 hover:border-gray-500"
                                  >
                                      Cancel
                                  </button>
                                  <div className="flex flex-col gap-3 sm:flex-row">
                                      {!isFreeOnlySelection && shippingCoinEnabled && (
                                          <button
                                              onClick={handleConfirmShipping}
                                              disabled={
                                                isSubmittingShipment ||
                                                selectedShipmentItems.length === 0 ||
                                                !user.shippingAddress
                                              }
                                              className={`flex-1 rounded-lg border px-4 py-2 text-xs font-bold uppercase tracking-wide transition-colors ${
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
                                              className={`flex-1 rounded-lg border px-4 py-2 text-xs font-bold uppercase tracking-wide transition-colors ${
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
                                              className={`flex-1 rounded-lg border px-4 py-2 text-xs font-bold uppercase tracking-wide transition-colors ${
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
                          {addressSaveMessage && (
                            <p className="mt-3 text-sm font-medium text-emerald-400">{addressSaveMessage}</p>
                          )}
                          {addressSaveError && (
                            <p className="mt-3 text-sm font-medium text-red-400">{addressSaveError}</p>
                          )}
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
