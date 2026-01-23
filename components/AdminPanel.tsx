import React, { useEffect, useMemo, useState } from 'react';
import { LayoutDashboard, Users, Settings, Activity, ShieldAlert, Package, Box as BoxIcon, Calculator, Edit2, Trash2, Calendar, BellRing, Truck, PackageCheck, Lock, Unlock, ShieldCheck, ScrollText, UserCog, Sparkles } from 'lucide-react';
import { calculateLevelProgress, useGame } from '../context/GameContext';
import { AdminActionLog, CaseItem, InventoryHistoryEntry, InventoryItem, LedgerEntry, LedgerEntryType, MysteryBox, UserLocks, UserStatus } from '../types';
import { COIN_ICON } from '../constants';
import { CoinAmount } from './CoinAmount';
import { buildOddsWithRiskAndTargetEV, buildRiskAdjustedOdds, calculateExpectedValue, calculateOddsTotal, getRiskLabel } from '../utils/caseOdds';

const rarityColorMap: Record<CaseItem['rarity'], string> = {
    common: '#9ca3af',
    uncommon: '#22c55e',
    rare: '#3b82f6',
    epic: '#a855f7',
    legendary: '#fbbf24'
};

const rarityColorOptions = [
    { value: 'common' as const, label: 'Common', color: rarityColorMap.common },
    { value: 'uncommon' as const, label: 'Uncommon', color: rarityColorMap.uncommon },
    { value: 'rare' as const, label: 'Rare', color: rarityColorMap.rare },
    { value: 'epic' as const, label: 'Epic', color: rarityColorMap.epic },
    { value: 'legendary' as const, label: 'Legendary', color: rarityColorMap.legendary }
];

const DEFAULT_LOCKS: UserLocks = {
    openCases: false,
    deposits: false,
    withdraws: false,
    marketplace: false,
    shipments: false
};

const LOCK_LABELS: Record<keyof UserLocks, string> = {
    openCases: 'Open Cases',
    deposits: 'Deposits',
    withdraws: 'Withdraws',
    marketplace: 'Marketplace',
    shipments: 'Shipments'
};

export const AdminPanel: React.FC = () => {
  const {
    user: adminUser,
    createItem,
    updateItem,
    deleteItem,
    createBox,
    updateBox,
    deleteBox,
    items,
    boxes,
    users,
    updateUserProgress,
    sendAdminNotification,
    updateShipmentStatus,
    updateUserAdminData,
    bonusSettings,
    updateBonusSettings
  } = useGame();
  const [activeTab, setActiveTab] = useState<'dashboard' | 'users' | 'settings' | 'items' | 'boxes' | 'shipments' | 'bonuses'>('dashboard');

  // --- ITEM FORM STATE ---
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [newItem, setNewItem] = useState<Partial<CaseItem>>({
      name: '',
      price: 0,
      image: 'https://picsum.photos/200',
      rarity: 'common',
      chance: 10,
      color: '#9ca3af'
  });

  // --- BOX FORM STATE ---
  const [editingBoxId, setEditingBoxId] = useState<string | null>(null);
  const [newBox, setNewBox] = useState<Partial<MysteryBox>>({
      name: '',
      price: 0,
      image: 'https://picsum.photos/300',
      accentColor: '#3b82f6',
      isDaily: false,
      tags: []
  });
  const [riskBalance, setRiskBalance] = useState(50);
  const [targetEV, setTargetEV] = useState(0.85);
  const [selectedItems, setSelectedItems] = useState<CaseItem[]>([]);
  const [deletingBoxId, setDeletingBoxId] = useState<string | null>(null);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [userXpInput, setUserXpInput] = useState<number>(0);
  const [isSavingUser, setIsSavingUser] = useState(false);
  const [adminNotification, setAdminNotification] = useState('');
  const [adminNoticeSent, setAdminNoticeSent] = useState(false);
  const [shipmentFilter, setShipmentFilter] = useState<'all' | 'processing' | 'shipped'>('processing');
  const [shipmentTracking, setShipmentTracking] = useState<Record<string, string>>({});
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [userStatuses, setUserStatuses] = useState<Record<string, UserStatus>>({});
  const [userLocks, setUserLocks] = useState<Record<string, UserLocks>>({});
  const [ledgerEntries, setLedgerEntries] = useState<Record<string, LedgerEntry[]>>({});
  const [adminLogs, setAdminLogs] = useState<Record<string, AdminActionLog[]>>({});
  const [inventoryState, setInventoryState] = useState<Record<string, InventoryItem[]>>({});
  const [reversalAmount, setReversalAmount] = useState('');
  const [reversalReason, setReversalReason] = useState('');
  const [voidSourceId, setVoidSourceId] = useState('');
  const [voidReason, setVoidReason] = useState('');
  const [ledgerFilter, setLedgerFilter] = useState<'all' | LedgerEntryType>('all');
  const [ledgerSearch, setLedgerSearch] = useState('');
  const [timelineFilter, setTimelineFilter] = useState<'all' | 'ledger' | 'inventory' | 'admin'>('all');
  const [timelineSearch, setTimelineSearch] = useState('');
  const [bonusDraft, setBonusDraft] = useState(bonusSettings);
  const [bonusSaveNotice, setBonusSaveNotice] = useState(false);
  const EV_TOLERANCE = 0.01;
  const safeTargetEVInput = Number.isFinite(targetEV) ? targetEV : 0.85;
  const clampedTargetEV = Math.min(1.5, Math.max(0.5, safeTargetEVInput));
  const boxTagOptions = ['Tech Boxes', 'Pokemon', 'Digital Codes', 'Hot', 'Deals'];
  
  // --- DELETE CONFIRMATION STATE ---
  const [boxToDelete, setBoxToDelete] = useState<string | null>(null);

  const makeId = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
  const formatTimestamp = (ts: number) => new Date(ts).toLocaleString();
  const formatCoinText = (amount: number, { showSign = true }: { showSign?: boolean } = {}) => {
      const absoluteAmount = showSign ? Math.abs(amount) : amount;
      const coins = absoluteAmount * 100;
      const formatted = coins.toLocaleString(undefined, { maximumFractionDigits: 0 });
      const sign = showSign ? (amount < 0 ? '-' : '+') : '';
      return `${sign}${formatted} coins`;
  };

  const seedLedgerEntries = (profileId: string, index: number): LedgerEntry[] => {
      const now = Date.now();
      const base = now - (index + 1) * 1000 * 60 * 60 * 6;
      return [
          {
              id: makeId('ledger'),
              userId: profileId,
              type: 'deposit',
              amount: 250,
              createdAt: base - 1000 * 60 * 60,
              sourceId: `stripe-${profileId.slice(0, 6)}`,
              memo: 'Stripe top-up'
          },
          {
              id: makeId('ledger'),
              userId: profileId,
              type: 'case_open',
              amount: -45,
              createdAt: base - 1000 * 60 * 30,
              sourceId: `case-${profileId.slice(0, 6)}-open`,
              memo: 'Opened Neon Nexus Case'
          },
          {
              id: makeId('ledger'),
              userId: profileId,
              type: 'sell_back',
              amount: 82,
              createdAt: base - 1000 * 60 * 12,
              sourceId: `sell-${profileId.slice(0, 6)}`,
              memo: 'Sold inventory item'
          },
          {
              id: makeId('ledger'),
              userId: profileId,
              type: 'bonus',
              amount: 15,
              createdAt: base - 1000 * 60 * 5,
              sourceId: `promo-${profileId.slice(0, 6)}`,
              memo: 'Welcome promo credit'
          }
      ];
  };

  const seedInventory = (inventory: InventoryItem[] = [], profileId: string, index: number) => {
      return inventory.map((item, itemIndex) => {
          const provenance = item.provenance ?? {
              sourceType: itemIndex % 2 === 0 ? 'case_open' : 'promo',
              sourceId: `${itemIndex % 2 === 0 ? 'case' : 'promo'}-${profileId.slice(0, 6)}-${itemIndex + 1}`
          };
          const history: InventoryHistoryEntry[] = item.history ?? [
              {
                  id: makeId('history'),
                  action: 'added',
                  createdAt: item.obtainedAt || Date.now() - (index + 1) * 1000 * 60 * 45,
                  note: 'Item added to inventory'
              }
          ];
          return {
              ...item,
              locked: item.locked ?? false,
              provenance,
              history
          };
      });
  };

  const shipmentRecords = users.flatMap((profile) => {
      const inventory = Array.isArray(profile.inventory) ? profile.inventory : [];
      return inventory
        .map((item, index) => ({
            user: profile,
            item,
            key: `${profile.id}-${item.instanceId || item.id}-${index}`
        }))
        .filter(({ item }) => item.status === 'shipping' || item.status === 'shipped');
  });

  const filteredShipments = shipmentRecords.filter(({ item }) => {
      if (shipmentFilter === 'processing') return item.status === 'shipping';
      if (shipmentFilter === 'shipped') return item.status === 'shipped';
      return true;
  });
  const stats = [
    { title: 'Total Coins', value: 124592, icon: CoinStatIcon, color: 'text-green-500', bg: 'bg-green-500/10', isCoin: true },
    { title: 'Active Users', value: '1,420', icon: Users, color: 'text-blue-500', bg: 'bg-blue-500/10' },
    { title: 'Battles Today', value: '843', icon: SwordsIcon, color: 'text-purple-500', bg: 'bg-purple-500/10' },
    { title: 'Server Load', value: '12%', icon: Activity, color: 'text-yellow-500', bg: 'bg-yellow-500/10' },
  ];

  useEffect(() => {
      if (users.length === 0) return;

      setSelectedUserId((current) => current ?? users[0].id);

      setUserStatuses((prev) => {
          const next = { ...prev };
          users.forEach((profile) => {
              next[profile.id] = profile.status ?? 'active';
          });
          return next;
      });

      setUserLocks((prev) => {
          const next = { ...prev };
          users.forEach((profile) => {
              next[profile.id] = { ...DEFAULT_LOCKS, ...(profile.locks ?? {}) };
          });
          return next;
      });

      setLedgerEntries((prev) => {
          const next = { ...prev };
          users.forEach((profile, index) => {
              next[profile.id] = profile.ledger ?? next[profile.id] ?? seedLedgerEntries(profile.id, index);
          });
          return next;
      });

      setAdminLogs((prev) => {
          const next = { ...prev };
          users.forEach((profile) => {
              next[profile.id] = profile.adminLogs ?? next[profile.id] ?? [];
          });
          return next;
      });

      setInventoryState((prev) => {
          const next = { ...prev };
          users.forEach((profile, index) => {
              next[profile.id] = seedInventory(profile.inventory, profile.id, index);
          });
          return next;
      });
  }, [users]);

  useEffect(() => {
      setBonusDraft(bonusSettings);
  }, [bonusSettings]);

  const handleSaveItem = async () => {
      if(!newItem.name || !newItem.price) return;
      
      const item: CaseItem = {
          id: editingItemId || `custom-item-${Date.now()}`,
          name: newItem.name!,
          price: Number(newItem.price),
          image: newItem.image || 'https://picsum.photos/200',
          rarity: newItem.rarity as any || 'common',
          chance: Number(newItem.chance),
          color: newItem.color || '#9ca3af'
      };

      if (editingItemId) {
          await updateItem(item);
          alert("Item Updated!");
      } else {
          await createItem(item);
          alert("Item Created!");
      }
      resetItemForm();
  };

  const handleEditItem = (item: CaseItem) => {
      setEditingItemId(item.id);
      setNewItem({
          name: item.name,
          price: item.price,
          image: item.image,
          rarity: item.rarity,
          chance: item.chance,
          color: item.color
      });
      window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteItem = async (id: string) => {
      if (confirm("Are you sure you want to delete this item? It will be removed from future box selections, but existing boxes may still reference it.")) {
          await deleteItem(id);
      }
  };

  const resetItemForm = () => {
      setEditingItemId(null);
      setNewItem({ name: '', price: 0, image: 'https://picsum.photos/200', rarity: 'common', chance: 10, color: '#9ca3af' });
  };

  const startEditUser = (userId: string, xp: number) => {
      setEditingUserId(userId);
      setUserXpInput(xp);
  };

  const cancelEditUser = () => {
      setEditingUserId(null);
      setUserXpInput(0);
  };

  const saveUserProgress = async (userId: string) => {
      setIsSavingUser(true);
      const previousXp = users.find((profile) => profile.id === userId)?.xp ?? 0;
      await updateUserProgress(userId, userXpInput);
      logAdminAction(
          userId,
          'xp_update',
          { xp: previousXp },
          { xp: userXpInput },
          'Updated user XP'
      );
      setIsSavingUser(false);
      setEditingUserId(null);
      alert('User progress updated!');
  };

  const handleSendAdminNotification = () => {
      const message = adminNotification.trim();
      if (!message) return;
      sendAdminNotification(message);
      setAdminNotification('');
      setAdminNoticeSent(true);
      setTimeout(() => setAdminNoticeSent(false), 3000);
  };

  const calculateBoxConfig = () => {
      if (selectedItems.length === 0) return;
      const baseSelection = selectedItems.map(item => ({ ...item, chance: 0 }));
      const baseItems = buildRiskAdjustedOdds(baseSelection, riskBalance);
      const baseEv = calculateExpectedValue(baseItems);
      const calculatedPrice = (newBox.price && newBox.price > 0)
        ? newBox.price
        : baseEv / clampedTargetEV;
      const updatedItems = buildOddsWithRiskAndTargetEV(baseSelection, riskBalance, clampedTargetEV, calculatedPrice);

      // Apply updates
      setSelectedItems(updatedItems);
      setNewBox(prev => ({ ...prev, price: parseFloat(calculatedPrice.toFixed(2)) }));
  };

  useEffect(() => {
      setSelectedItems((prev) => {
          if (prev.length === 0) return prev;

          const baseSelection = prev.map(item => ({ ...item, chance: 0 }));
          const baseItems = buildRiskAdjustedOdds(baseSelection, riskBalance);
          const baseEv = calculateExpectedValue(baseItems);
          const calculatedPrice = (newBox.price && newBox.price > 0)
            ? newBox.price
            : baseEv / clampedTargetEV;
          const updatedItems = buildOddsWithRiskAndTargetEV(baseSelection, riskBalance, clampedTargetEV, calculatedPrice);

          if (!newBox.price || newBox.price <= 0) {
              setNewBox((current) => ({ ...current, price: parseFloat(calculatedPrice.toFixed(2)) }));
          }

          return updatedItems;
      });
  }, [clampedTargetEV, newBox.price, riskBalance]);

  const updateAdminLogs = (targetUserId: string, updater: (entries: AdminActionLog[]) => AdminActionLog[]) => {
      setAdminLogs((prev) => {
          const nextEntries = updater(prev[targetUserId] ?? []);
          void updateUserAdminData(targetUserId, { adminLogs: nextEntries });
          return { ...prev, [targetUserId]: nextEntries };
      });
  };

  const updateLedgerRecords = (targetUserId: string, updater: (entries: LedgerEntry[]) => LedgerEntry[]) => {
      setLedgerEntries((prev) => {
          const nextEntries = updater(prev[targetUserId] ?? []);
          void updateUserAdminData(targetUserId, { ledger: nextEntries });
          return { ...prev, [targetUserId]: nextEntries };
      });
  };

  const updateInventoryRecords = (targetUserId: string, updater: (items: InventoryItem[]) => InventoryItem[]) => {
      setInventoryState((prev) => {
          const nextItems = updater(prev[targetUserId] ?? []);
          void updateUserAdminData(targetUserId, { inventory: nextItems });
          return { ...prev, [targetUserId]: nextItems };
      });
  };

  const logAdminAction = (targetUserId: string, actionType: string, before: Record<string, unknown>, after: Record<string, unknown>, reason: string) => {
      const entry: AdminActionLog = {
          id: makeId('admin-log'),
          adminUid: adminUser?.id ?? 'admin',
          targetUserUid: targetUserId,
          actionType,
          before,
          after,
          reason,
          createdAt: Date.now()
      };
      updateAdminLogs(targetUserId, (entries) => [entry, ...entries]);
  };

  const appendLedgerEntry = (targetUserId: string, entry: LedgerEntry) => {
      updateLedgerRecords(targetUserId, (entries) => {
          const currentBalance = entries.reduce((sum, item) => sum + item.amount, 0);
          const entryWithBalance = {
              ...entry,
              balanceAfter: entry.balanceAfter ?? currentBalance + entry.amount
          };
          return [entryWithBalance, ...entries];
      });
  };

  const handleStatusChange = (targetUserId: string, nextStatus: UserStatus) => {
      const previousStatus = userStatuses[targetUserId] ?? 'active';
      setUserStatuses((prev) => ({ ...prev, [targetUserId]: nextStatus }));
      void updateUserAdminData(targetUserId, { status: nextStatus });
      logAdminAction(
          targetUserId,
          'status_update',
          { status: previousStatus },
          { status: nextStatus },
          `Status changed to ${nextStatus}`
      );
  };

  const handleLockToggle = (targetUserId: string, lockKey: keyof UserLocks) => {
      setUserLocks((prev) => {
          const currentLocks = prev[targetUserId] ?? { ...DEFAULT_LOCKS };
          const nextLocks = { ...currentLocks, [lockKey]: !currentLocks[lockKey] };
          void updateUserAdminData(targetUserId, { locks: nextLocks });
          logAdminAction(
              targetUserId,
              'lock_toggle',
              { [lockKey]: currentLocks[lockKey] },
              { [lockKey]: nextLocks[lockKey] },
              `Toggled ${lockKey} lock`
          );
          return { ...prev, [targetUserId]: nextLocks };
      });
  };

  const handleInventoryLockToggle = (targetUserId: string, instanceId: string) => {
      updateInventoryRecords(targetUserId, (items) => {
          const nextItems = items.map((item) => {
              if (item.instanceId !== instanceId) return item;
              const nextLocked = !item.locked;
              const historyEntry: InventoryHistoryEntry = {
                  id: makeId('history'),
                  action: nextLocked ? 'locked' : 'unlocked',
                  createdAt: Date.now(),
                  note: `Item ${nextLocked ? 'locked' : 'unlocked'} by admin`,
                  adminUid: adminUser?.id ?? 'admin'
              };
              return {
                  ...item,
                  locked: nextLocked,
                  history: [historyEntry, ...(item.history ?? [])]
              };
          });
          logAdminAction(
              targetUserId,
              'inventory_lock',
              { instanceId },
              { instanceId, locked: nextItems.find((item) => item.instanceId === instanceId)?.locked },
              'Inventory lock toggled'
          );
          return nextItems;
      });
  };

  const handleCreateReversal = () => {
      if (!selectedUserId) return;
      const amountValue = Number(reversalAmount);
      if (!amountValue || !reversalReason.trim()) return;
      const entry: LedgerEntry = {
          id: makeId('ledger'),
          userId: selectedUserId,
          type: 'reversal',
          amount: -Math.abs(amountValue),
          createdAt: Date.now(),
          sourceId: `reversal-${selectedUserId.slice(0, 6)}`,
          memo: reversalReason.trim()
      };
      appendLedgerEntry(selectedUserId, entry);
      logAdminAction(
          selectedUserId,
          'ledger_reversal',
          { amount: 0 },
          { amount: entry.amount },
          reversalReason.trim()
      );
      setReversalAmount('');
      setReversalReason('');
  };

  const handleVoidOpen = () => {
      if (!selectedUserId || !voidSourceId.trim()) return;
      const items = inventoryState[selectedUserId] ?? [];
      const impactedItems = items.filter((item) => item.provenance?.sourceId === voidSourceId.trim());
      const totalValue = impactedItems.reduce((sum, item) => sum + item.price, 0);
      const entry: LedgerEntry = {
          id: makeId('ledger'),
          userId: selectedUserId,
          type: 'reversal',
          amount: totalValue === 0 ? 0 : -Math.abs(totalValue),
          createdAt: Date.now(),
          sourceId: voidSourceId.trim(),
          memo: voidReason.trim() || 'Voided case open'
      };
      appendLedgerEntry(selectedUserId, entry);
      updateInventoryRecords(selectedUserId, (prevItems) => {
          const nextItems = prevItems.map((item) => {
              if (item.provenance?.sourceId !== voidSourceId.trim()) return item;
              const historyEntry: InventoryHistoryEntry = {
                  id: makeId('history'),
                  action: 'void_open',
                  createdAt: Date.now(),
                  note: voidReason.trim() || 'Case open voided',
                  adminUid: adminUser?.id ?? 'admin'
              };
              return {
                  ...item,
                  locked: true,
                  history: [historyEntry, ...(item.history ?? [])]
              };
          });
          return nextItems;
      });
      logAdminAction(
          selectedUserId,
          'void_case_open',
          { sourceId: voidSourceId.trim(), affectedItems: impactedItems.length },
          { ledgerAmount: entry.amount, affectedItems: impactedItems.length },
          voidReason.trim() || 'Case open voided'
      );
      setVoidSourceId('');
      setVoidReason('');
  };

  const selectedUser = useMemo(() => users.find((profile) => profile.id === selectedUserId), [users, selectedUserId]);
  const selectedLedgerEntries = selectedUserId ? ledgerEntries[selectedUserId] ?? [] : [];
  const selectedInventory = selectedUserId ? inventoryState[selectedUserId] ?? [] : [];
  const selectedAdminLogs = selectedUserId ? adminLogs[selectedUserId] ?? [] : [];
  const ledgerNetChange = selectedLedgerEntries.reduce((sum, entry) => sum + entry.amount, 0);
  const ledgerSearchValue = ledgerSearch.trim().toLowerCase();

  const timelineEntries = useMemo(() => {
      const entries = [
          ...selectedLedgerEntries.map((entry) => ({
              id: entry.id,
              createdAt: entry.createdAt,
              title: `Ledger • ${entry.type.replace('_', ' ')}`,
              description: `${formatCoinText(entry.amount)} ${entry.memo ?? ''}`.trim(),
              meta: entry.sourceId ? `Source: ${entry.sourceId}` : '',
              category: 'ledger' as const
          })),
          ...selectedInventory.flatMap((item) =>
              (item.history ?? []).map((history) => ({
                  id: `${item.instanceId}-${history.id}`,
                  createdAt: history.createdAt,
                  title: `Inventory • ${history.action.replace('_', ' ')}`,
                  description: `${item.name}${history.note ? ` — ${history.note}` : ''}`,
                  meta: item.provenance ? `From ${item.provenance.sourceType} (${item.provenance.sourceId})` : '',
                  category: 'inventory' as const
              }))
          ),
          ...selectedAdminLogs.map((log) => ({
              id: log.id,
              createdAt: log.createdAt,
              title: `Admin • ${log.actionType.replace('_', ' ')}`,
              description: log.reason,
              meta: `Admin: ${log.adminUid}`,
              category: 'admin' as const
          }))
      ];
      return entries.sort((a, b) => b.createdAt - a.createdAt);
  }, [selectedAdminLogs, selectedInventory, selectedLedgerEntries]);

  const filteredLedgerEntries = selectedLedgerEntries.filter((entry) => {
      if (ledgerFilter !== 'all' && entry.type !== ledgerFilter) return false;
      if (!ledgerSearchValue) return true;
      return [
          entry.memo,
          entry.sourceId,
          entry.type
      ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(ledgerSearchValue));
  });

  const timelineSearchValue = timelineSearch.trim().toLowerCase();
  const filteredTimelineEntries = timelineEntries.filter((entry) => {
      if (timelineFilter !== 'all' && entry.category !== timelineFilter) return false;
      if (!timelineSearchValue) return true;
      return [entry.title, entry.description, entry.meta]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(timelineSearchValue));
  });

  const oddsTotal = useMemo(() => calculateOddsTotal(selectedItems), [selectedItems]);
  const expectedValue = useMemo(() => calculateExpectedValue(selectedItems), [selectedItems]);
  const evRatio = useMemo(() => {
      if (!newBox.price || newBox.price <= 0) return 0;
      return expectedValue / Number(newBox.price);
  }, [expectedValue, newBox.price]);
  const marginPercent = newBox.price && newBox.price > 0 ? (1 - evRatio) * 100 : NaN;
  const evOutOfBounds = newBox.price ? Math.abs(evRatio - clampedTargetEV) > EV_TOLERANCE : false;
  const oddsOutOfBounds = Math.abs(oddsTotal - 100) > 0.001;
  const canSaveBox = !!newBox.name && !!newBox.price && selectedItems.length > 0 && !evOutOfBounds && !oddsOutOfBounds;

  const handleSaveBox = () => {
      if(!newBox.name || !newBox.price) {
          alert("Please fill in box details");
          return;
      }
      
      if(selectedItems.length === 0) {
          alert("Select at least one item for the box");
          return;
      }
      const baseSelection = selectedItems.map(item => ({ ...item, chance: 0 }));
      const refreshedItems = buildOddsWithRiskAndTargetEV(
          baseSelection,
          riskBalance,
          clampedTargetEV,
          Number(newBox.price)
      );
      const refreshedOddsTotal = calculateOddsTotal(refreshedItems);
      const refreshedEv = calculateExpectedValue(refreshedItems);
      const refreshedEvRatio = refreshedEv / Number(newBox.price);
      const refreshedOddsOutOfBounds = Math.abs(refreshedOddsTotal - 100) > 0.001;
      const refreshedEvOutOfBounds = Math.abs(refreshedEvRatio - clampedTargetEV) > EV_TOLERANCE;

      setSelectedItems(refreshedItems);

      if (refreshedOddsOutOfBounds) {
          alert("Total odds must equal 100% before saving.");
          return;
      }
      if (refreshedEvOutOfBounds) {
          alert("Expected value is outside the allowed tolerance.");
          return;
      }

      // Clone items to decouple from global pool (ensuring box-specific chances)
      const boxItems = refreshedItems.map(i => ({...i}));
      
      // If setting as daily, unset others first (best effort approach)
      if (newBox.isDaily) {
          boxes.forEach(b => {
              if (b.isDaily && b.id !== (editingBoxId || '')) {
                  updateBox({ ...b, isDaily: false });
              }
          });
      }

      const box: MysteryBox = {
          id: editingBoxId || '', // Empty ID tells createBox to addDoc
          name: newBox.name!,
          price: Number(newBox.price),
          image: newBox.image || 'https://picsum.photos/300',
          accentColor: newBox.accentColor || '#3b82f6',
          tag: newBox.tag,
          tags: newBox.tags ?? [],
          isDaily: newBox.isDaily,
          items: boxItems,
          targetEV: clampedTargetEV,
          riskLevel: riskBalance
      };

      if (editingBoxId) {
          updateBox(box);
          alert("Box Updated!");
      } else {
          createBox(box);
          alert("Box Created in Firebase!");
      }

      resetBoxForm();
  };

  const handleEditBox = (box: MysteryBox) => {
      setEditingBoxId(box.id);
      setNewBox({
          name: box.name,
          price: box.price,
          image: box.image,
          accentColor: box.accentColor,
          tag: box.tag,
          tags: box.tags ?? (box.tag ? [box.tag] : []),
          isDaily: box.isDaily
      });
      setSelectedItems(box.items.map(i => ({...i})));
      setRiskBalance(box.riskLevel ?? 50);
      setTargetEV(box.targetEV ?? 0.85);
      window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const initiateDeleteBox = (id: string) => {
      setBoxToDelete(id);
  };

  const confirmDeleteBox = async () => {
      if (!boxToDelete) return;

      setDeletingBoxId(boxToDelete);
      try {
          await deleteBox(boxToDelete);
      } finally {
          setDeletingBoxId(null);
          setBoxToDelete(null);
      }
  };

  const resetBoxForm = () => {
      setEditingBoxId(null);
      setNewBox({ name: '', price: 0, image: 'https://picsum.photos/300', accentColor: '#3b82f6', isDaily: false, tags: [] });
      setSelectedItems([]);
      setRiskBalance(50);
      setTargetEV(0.85);
  };

  const toggleBoxTag = (tag: string) => {
      setNewBox(prev => {
          const currentTags = prev.tags ?? [];
          const nextTags = currentTags.includes(tag)
              ? currentTags.filter(existing => existing !== tag)
              : [...currentTags, tag];
          return { ...prev, tags: nextTags };
      });
  };

  const toggleItemSelection = (item: CaseItem) => {
      const exists = selectedItems.find(i => i.id === item.id);
      if(exists) {
          setSelectedItems(prev => prev.filter(i => i.id !== item.id));
      } else {
          setSelectedItems(prev => [...prev, { ...item }]);
      }
  };

  const handleSaveBonusSettings = () => {
      updateBonusSettings(bonusDraft);
      setBonusSaveNotice(true);
      window.setTimeout(() => setBonusSaveNotice(false), 3000);
  };

  return (
    <div className="w-full max-w-7xl mx-auto p-6 animate-in fade-in duration-300">
      
      <div className="flex flex-col md:flex-row gap-8">
        
        {/* Sidebar */}
        <div className="w-full md:w-64 flex-shrink-0">
           <div className="bg-[#131720] border border-gray-800 rounded-xl p-4 sticky top-24">
               <h2 className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-4 px-2">Admin Control</h2>
               <nav className="flex flex-col gap-1">
                   <button 
                     onClick={() => setActiveTab('dashboard')}
                     className={`flex items-center gap-3 px-3 py-2 rounded-lg font-medium text-sm transition-colors ${activeTab === 'dashboard' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}
                   >
                       <LayoutDashboard className="w-4 h-4" /> Dashboard
                   </button>
                   <button 
                     onClick={() => setActiveTab('items')}
                     className={`flex items-center gap-3 px-3 py-2 rounded-lg font-medium text-sm transition-colors ${activeTab === 'items' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}
                   >
                       <Package className="w-4 h-4" /> Manage Items
                   </button>
                   <button 
                     onClick={() => setActiveTab('boxes')}
                     className={`flex items-center gap-3 px-3 py-2 rounded-lg font-medium text-sm transition-colors ${activeTab === 'boxes' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}
                   >
                       <BoxIcon className="w-4 h-4" /> Manage Boxes
                   </button>
                   <button 
                     onClick={() => setActiveTab('users')}
                     className={`flex items-center gap-3 px-3 py-2 rounded-lg font-medium text-sm transition-colors ${activeTab === 'users' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}
                   >
                       <Users className="w-4 h-4" /> User Management
                   </button>
                   <button 
                     onClick={() => setActiveTab('shipments')}
                     className={`flex items-center gap-3 px-3 py-2 rounded-lg font-medium text-sm transition-colors ${activeTab === 'shipments' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}
                   >
                       <Truck className="w-4 h-4" /> Shipment Manager
                   </button>
                   <button 
                     onClick={() => setActiveTab('bonuses')}
                     className={`flex items-center gap-3 px-3 py-2 rounded-lg font-medium text-sm transition-colors ${activeTab === 'bonuses' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}
                   >
                       <Sparkles className="w-4 h-4" /> Bonuses
                   </button>
                   <button 
                     onClick={() => setActiveTab('settings')}
                     className={`flex items-center gap-3 px-3 py-2 rounded-lg font-medium text-sm transition-colors ${activeTab === 'settings' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}
                   >
                       <Settings className="w-4 h-4" /> Site Settings
                   </button>
               </nav>
           </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 min-w-0">
            
            {/* Header */}
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-white mb-2">
                    {activeTab === 'dashboard' && 'Overview'}
                    {activeTab === 'users' && 'User Database'}
                    {activeTab === 'settings' && 'System Configuration'}
                    {activeTab === 'items' && 'Item Manager'}
                    {activeTab === 'boxes' && 'Box Manager'}
                    {activeTab === 'shipments' && 'Shipment Manager'}
                    {activeTab === 'bonuses' && 'Bonuses & XP'}
                </h1>
                <p className="text-gray-400 text-sm">Welcome back, Administrator. System is operating normally.</p>
            </div>

            {/* TAB: DASHBOARD */}
            {activeTab === 'dashboard' && (
                <>
                    {/* Stats Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                        {stats.map((stat, idx) => (
                            <div key={idx} className="bg-[#131720] border border-gray-800 rounded-xl p-4">
                                <div className="flex items-start justify-between mb-4">
                                    <div className={`p-2 rounded-lg ${stat.bg}`}>
                                        <stat.icon className={`w-6 h-6 ${stat.color}`} />
                                    </div>
                                    <span className="text-xs font-bold text-green-500 bg-green-500/10 px-1.5 py-0.5 rounded">+4.5%</span>
                                </div>
                                <div className="text-2xl font-bold text-white mb-1">
                                    {stat.isCoin ? (
                                        <CoinAmount
                                          amount={stat.value as number}
                                          formatOptions={{ maximumFractionDigits: 0 }}
                                          className="text-white"
                                          iconClassName="w-5 h-5"
                                        />
                                    ) : (
                                        stat.value
                                    )}
                                </div>
                                <div className="text-xs text-gray-500">{stat.title}</div>
                            </div>
                        ))}
                    </div>

                    {/* Recent Activity Mock */}
                    <div className="bg-[#131720] border border-gray-800 rounded-xl p-6">
                        <h3 className="text-lg font-bold text-white mb-6">Live Transactions</h3>
                        <div className="space-y-4">
                            {[1, 2, 3, 4, 5].map((i) => (
                                <div key={i} className="flex items-center justify-between py-2 border-b border-gray-800 last:border-0">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-2 h-2 rounded-full ${i % 2 === 0 ? 'bg-green-500' : 'bg-blue-500'}`}></div>
                                        <div>
                                            <div className="text-sm font-bold text-gray-200">
                                                {i % 2 === 0 ? 'Deposit' : 'Case Opening'}
                                            </div>
                                            <div className="text-xs text-gray-500">2 minutes ago</div>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <CoinAmount
                                          amount={i % 2 === 0 ? 500 : -50}
                                          formatOptions={{ maximumFractionDigits: 0 }}
                                          showSign
                                          className={`text-sm font-bold ${i % 2 === 0 ? 'text-green-400' : 'text-white'}`}
                                          iconClassName="w-3.5 h-3.5"
                                        />
                                        <div className="text-xs text-gray-500">User_{1000 + i}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </>
            )}

            {/* TAB: ITEMS */}
            {activeTab === 'items' && (
                <div className="space-y-8">
                    {/* Create Item Form */}
                    <div className="bg-[#131720] border border-gray-800 rounded-xl p-6">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-bold text-white">{editingItemId ? 'Edit Item' : 'Create New Item'}</h3>
                            {editingItemId && <button onClick={resetItemForm} className="text-xs text-red-400 hover:text-red-300">Cancel Edit</button>}
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                            <input type="text" placeholder="Item Name" className="bg-[#0b0e14] border border-gray-700 rounded p-2 text-white" value={newItem.name} onChange={e => setNewItem({...newItem, name: e.target.value})} />
                            <input type="number" placeholder="Price (coins)" className="bg-[#0b0e14] border border-gray-700 rounded p-2 text-white" value={newItem.price || ''} onChange={e => setNewItem({...newItem, price: Number(e.target.value)})} />
                          <select className="bg-[#0b0e14] border border-gray-700 rounded p-2 text-gray-300" value={newItem.rarity} onChange={e => setNewItem({...newItem, rarity: e.target.value as any})}>
                                <option value="common">Common</option>
                                <option value="uncommon">Uncommon</option>
                                <option value="rare">Rare</option>
                                <option value="epic">Epic</option>
                                <option value="legendary">Legendary</option>
                            </select>
                            <select
                                className="bg-[#0b0e14] border border-gray-700 rounded p-2 text-gray-300"
                                value={rarityColorOptions.find(option => option.color === newItem.color)?.value || 'custom'}
                                onChange={e => {
                                    const selectedRarity = e.target.value as CaseItem['rarity'];
                                    if (rarityColorMap[selectedRarity]) {
                                        setNewItem(prev => ({ ...prev, color: rarityColorMap[selectedRarity] }));
                                    }
                                }}
                            >
                                {rarityColorOptions.map(option => (
                                    <option key={option.value} value={option.value}>
                                        {option.label} ({option.color})
                                    </option>
                                ))}
                                {!rarityColorOptions.some(option => option.color === newItem.color) && (
                                    <option value="custom" disabled>
                                        Custom Color ({newItem.color})
                                    </option>
                                )}
                            </select>
                            <input type="text" placeholder="Image URL" className="bg-[#0b0e14] border border-gray-700 rounded p-2 text-white" value={newItem.image} onChange={e => setNewItem({...newItem, image: e.target.value})} />
                            <input type="number" placeholder="Chance % (0-100)" className="bg-[#0b0e14] border border-gray-700 rounded p-2 text-white" value={newItem.chance} onChange={e => setNewItem({...newItem, chance: Number(e.target.value)})} />
                        </div>
                        <button onClick={handleSaveItem} className={`px-6 py-2 ${editingItemId ? 'bg-orange-600 hover:bg-orange-500' : 'bg-blue-600 hover:bg-blue-500'} text-white font-bold rounded`}>
                            {editingItemId ? 'Update Item' : 'Add Item'}
                        </button>
                    </div>

                    {/* Item List */}
                    <div className="bg-[#131720] border border-gray-800 rounded-xl overflow-hidden">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-[#0b0e14] text-gray-400 font-medium">
                                <tr>
                                    <th className="px-4 py-3">Item</th>
                                    <th className="px-4 py-3">Rarity</th>
                                    <th className="px-4 py-3">Price</th>
                                    <th className="px-4 py-3 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-800">
                                {items.map((item, i) => (
                                    <tr key={i}>
                                        <td className="px-4 py-3 flex items-center gap-2">
                                            <img src={item.image} className="w-8 h-8 object-contain" />
                                            <span className="text-white">{item.name}</span>
                                        </td>
                                        <td className="px-4 py-3 capitalize text-gray-400">{item.rarity}</td>
                                        <td className="px-4 py-3">
                                            <CoinAmount
                                              amount={item.price}
                                              formatOptions={{ maximumFractionDigits: 0 }}
                                              className="text-green-500 font-semibold"
                                              iconClassName="w-3.5 h-3.5"
                                            />
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <div className="flex justify-end gap-2">
                                                <button onClick={() => handleEditItem(item)} className="p-1.5 hover:bg-blue-500/10 text-blue-400 rounded transition-colors"><Edit2 className="w-4 h-4" /></button>
                                                <button onClick={() => handleDeleteItem(item.id)} className="p-1.5 hover:bg-red-500/10 text-red-400 rounded transition-colors"><Trash2 className="w-4 h-4" /></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* TAB: BOXES */}
            {activeTab === 'boxes' && (
                <div className="space-y-8">
                    {/* Create/Edit Box Form */}
                    <div className="bg-[#131720] border border-gray-800 rounded-xl p-6">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-bold text-white">{editingBoxId ? 'Edit Box' : 'Create New Box'}</h3>
                            {editingBoxId && <button onClick={resetBoxForm} className="text-xs text-red-400 hover:text-red-300">Cancel Edit</button>}
                        </div>

                        {/* Top Config Row */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                            <div className="space-y-3">
                                <input type="text" placeholder="Box Name" className="bg-[#0b0e14] border border-gray-700 rounded p-2 text-white" value={newBox.name} onChange={e => setNewBox({...newBox, name: e.target.value})} />
                                <input type="text" placeholder="Image URL" className="bg-[#0b0e14] border border-gray-700 rounded p-2 text-white" value={newBox.image} onChange={e => setNewBox({...newBox, image: e.target.value})} />
                                <input type="text" placeholder="Accent Color (Hex)" className="bg-[#0b0e14] border border-gray-700 rounded p-2 text-white" value={newBox.accentColor} onChange={e => setNewBox({...newBox, accentColor: e.target.value})} />
                                <div>
                                    <label className="text-[10px] text-gray-500 uppercase font-bold block mb-2">Box Tags</label>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                        {boxTagOptions.map((tag) => {
                                            const isSelected = (newBox.tags ?? []).includes(tag);
                                            return (
                                                <button
                                                    key={tag}
                                                    type="button"
                                                    aria-pressed={isSelected}
                                                    onClick={() => toggleBoxTag(tag)}
                                                    className={`px-2 py-1.5 rounded border text-[11px] font-semibold uppercase tracking-wide transition ${isSelected ? 'bg-blue-600/20 border-blue-500 text-blue-200' : 'bg-[#0b0e14] border-gray-700 text-gray-400 hover:border-gray-500'}`}
                                                >
                                                    {tag}
                                                </button>
                                            );
                                        })}
                                    </div>
                                    <p className="mt-2 text-[10px] text-gray-500">Tags power homepage filters. Select all that apply.</p>
                                </div>
                            </div>

                            <div className="flex flex-col gap-4">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    <div>
                                        <label className="text-[10px] text-gray-500 uppercase font-bold block mb-1">Price (coins)</label>
                                        <input type="number" placeholder="Box Price (coins)" className="w-full bg-[#0b0e14] border border-gray-700 rounded p-2 text-white font-bold text-green-400" value={newBox.price || ''} onChange={e => setNewBox({...newBox, price: Number(e.target.value)})} />
                                        <div className="text-[10px] text-gray-500 mt-1 flex items-center gap-1">
                                            <span>Calculated:</span>
                                            {newBox.price ? (
                                                <CoinAmount
                                                    amount={Number(newBox.price)}
                                                    formatOptions={{ maximumFractionDigits: 0 }}
                                                    className="text-gray-300 font-semibold"
                                                    iconClassName="w-3 h-3"
                                                />
                                            ) : (
                                                <span className="text-gray-600">--</span>
                                            )}
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-[10px] text-gray-500 uppercase font-bold block mb-1">Target EV (ratio)</label>
                                        <input
                                            type="number"
                                            min={0.5}
                                            max={1.5}
                                            step={0.01}
                                            placeholder="0.85"
                                            className="w-full bg-[#0b0e14] border border-gray-700 rounded p-2 text-white font-bold"
                                            value={targetEV}
                                            onChange={e => setTargetEV(Number(e.target.value))}
                                        />
                                        <p className="text-[10px] text-gray-500 mt-1">0.85 = 85% payout target.</p>
                                    </div>
                                </div>
                                <div>
                                    <label className="text-[10px] text-gray-500 uppercase font-bold block mb-1">Risk Balance</label>
                                    <input
                                        type="range"
                                        min={0}
                                        max={100}
                                        value={riskBalance}
                                        onChange={e => setRiskBalance(Number(e.target.value))}
                                        className="w-full accent-brand-purple"
                                    />
                                    <div className="flex justify-between text-[10px] text-gray-500">
                                        <span>Safer</span>
                                        <span className="text-gray-300 font-semibold">{getRiskLabel(riskBalance)}</span>
                                        <span>Riskier</span>
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] text-gray-400">
                                    <div className="bg-[#0b0e14] border border-gray-800 rounded p-2">
                                        <div className="uppercase text-[10px] text-gray-500 font-bold">Live EV</div>
                                        <div className="text-white font-semibold">{expectedValue.toFixed(2)}</div>
                                    </div>
                                    <div className="bg-[#0b0e14] border border-gray-800 rounded p-2">
                                        <div className="uppercase text-[10px] text-gray-500 font-bold">Margin</div>
                                        <div className="text-white font-semibold">{Number.isFinite(marginPercent) ? `${marginPercent.toFixed(2)}%` : '--'}</div>
                                    </div>
                                    <div className="bg-[#0b0e14] border border-gray-800 rounded p-2">
                                        <div className="uppercase text-[10px] text-gray-500 font-bold">Total Odds</div>
                                        <div className="text-white font-semibold">{oddsTotal.toFixed(2)}%</div>
                                    </div>
                                </div>
                                {(evOutOfBounds || oddsOutOfBounds) && (
                                    <div className="text-[11px] text-red-400">
                                        {oddsOutOfBounds && <div>⚠ Total odds must equal 100%.</div>}
                                        {evOutOfBounds && <div>⚠ EV must stay within ±1% of target.</div>}
                                    </div>
                                )}
                                <div className="flex items-center gap-2">
                                    <input 
                                        type="checkbox" 
                                        id="daily-case"
                                        checked={newBox.isDaily || false} 
                                        onChange={e => setNewBox({...newBox, isDaily: e.target.checked})} 
                                        className="w-4 h-4 rounded border-gray-700 bg-[#0b0e14] text-brand-purple focus:ring-brand-purple"
                                    />
                                    <label htmlFor="daily-case" className="text-sm text-gray-400 flex items-center gap-1">
                                        <Calendar className="w-3 h-3 text-yellow-500" /> Set as Daily Free Case
                                    </label>
                                </div>
                            </div>
                        </div>

                        {/* Middle: Item Selector & Auto-Calculator */}
                        <div className="mb-6 p-4 bg-[#0b0e14] rounded-lg border border-gray-800">
                             <div className="flex justify-between items-center mb-4">
                                 <h4 className="text-sm font-bold text-gray-400 uppercase">Available Items</h4>
                                 <button 
                                    onClick={calculateBoxConfig}
                                    disabled={selectedItems.length === 0}
                                    className="flex items-center gap-2 px-3 py-1.5 bg-brand-purple hover:bg-purple-600 disabled:opacity-50 text-white text-xs font-bold rounded shadow-lg shadow-purple-900/20"
                                 >
                                    <Calculator className="w-3 h-3" /> Auto-Calculate Odds & Price
                                 </button>
                             </div>
                             
                             {/* Item Pool */}
                             <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 max-h-48 overflow-y-auto mb-4 pr-1">
                                {items.map(item => {
                                    const isSelected = selectedItems.some(i => i.id === item.id);
                                    return (
                                        <div 
                                            key={item.id} 
                                            onClick={() => toggleItemSelection(item)}
                                            className={`p-2 rounded border cursor-pointer flex flex-col items-center gap-2 text-center transition-all ${isSelected ? 'bg-blue-600/10 border-blue-500' : 'bg-[#131720] border-gray-800 hover:border-gray-600'}`}
                                        >
                                            <img src={item.image} className="w-8 h-8 object-contain" />
                                            <div className="w-full">
                                                <div className="text-[10px] text-gray-300 truncate font-medium">{item.name}</div>
                                                <CoinAmount
                                                  amount={item.price}
                                                  formatOptions={{ maximumFractionDigits: 0 }}
                                                  className="text-[10px] text-green-400 font-bold justify-center"
                                                  iconClassName="w-3 h-3"
                                                />
                                            </div>
                                            {isSelected && <div className="absolute top-1 right-1 w-2 h-2 bg-blue-500 rounded-full"></div>}
                                        </div>
                                    );
                                })}
                             </div>

                             {/* Selected & Configured Items */}
                             {selectedItems.length > 0 && (
                                 <div className="border-t border-gray-800 pt-4">
                                     <h4 className="text-sm font-bold text-gray-400 uppercase mb-2">Box Contents ({selectedItems.length})</h4>
                                     <div className="space-y-1">
                                         {selectedItems.map((item, idx) => (
                                             <div key={idx} className="flex items-center gap-2 text-xs bg-[#131720] p-1.5 rounded border border-gray-700">
                                                 <img src={item.image} className="w-5 h-5 object-contain" />
                                                 <span className="flex-1 text-gray-300 truncate">{item.name}</span>
                                                 <CoinAmount
                                                   amount={item.price}
                                                   formatOptions={{ maximumFractionDigits: 0 }}
                                                   className="text-gray-500"
                                                   iconClassName="w-3 h-3"
                                                 />
                                                 <div className="flex items-center gap-1 bg-black/30 px-2 py-0.5 rounded">
                                                     <span className="text-gray-400">Chance:</span>
                                                     <span className="font-bold text-white">{item.chance}%</span>
                                                 </div>
                                                 <div className="px-2 py-0.5 rounded font-bold uppercase text-[9px]" style={{ color: item.color, backgroundColor: `${item.color}15` }}>
                                                     {item.rarity}
                                                 </div>
                                             </div>
                                         ))}
                                     </div>
                                 </div>
                             )}
                        </div>

                        <button
                            onClick={handleSaveBox}
                            disabled={!canSaveBox}
                            className={`w-full py-3 ${editingBoxId ? 'bg-orange-600 hover:bg-orange-500' : 'bg-blue-600 hover:bg-blue-500'} text-white font-bold rounded shadow-lg disabled:opacity-50 disabled:cursor-not-allowed`}
                        >
                            {editingBoxId ? 'Update Box' : 'Create Box'}
                        </button>
                    </div>

                     {/* Box List */}
                     <div className="bg-[#131720] border border-gray-800 rounded-xl overflow-hidden">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-[#0b0e14] text-gray-400 font-medium">
                                <tr>
                                    <th className="px-4 py-3">Box</th>
                                    <th className="px-4 py-3">Items</th>
                                    <th className="px-4 py-3">Price</th>
                                    <th className="px-4 py-3 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-800">
                                {boxes.map((box, i) => (
                                    <tr key={i}>
                                        <td className="px-4 py-3 flex items-center gap-2">
                                            <img src={box.image} className="w-8 h-8 object-contain" />
                                            <div>
                                                <div className="text-white flex items-center gap-2">
                                                    {box.name}
                                                    {box.isDaily && <span className="text-[10px] bg-yellow-500/20 text-yellow-500 px-1 rounded">DAILY</span>}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-gray-400">{box.items?.length || 0} items</td>
                                        <td className="px-4 py-3">
                                            <CoinAmount
                                              amount={box.price}
                                              formatOptions={{ maximumFractionDigits: 0 }}
                                              className="text-green-500 font-semibold"
                                              iconClassName="w-3.5 h-3.5"
                                            />
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <div className="flex justify-end gap-2">
                                                <button onClick={() => handleEditBox(box)} className="p-1.5 hover:bg-blue-500/10 text-blue-400 rounded transition-colors"><Edit2 className="w-4 h-4" /></button>
                                                <button 
                                                    onClick={() => initiateDeleteBox(box.id)} 
                                                    className={`p-1.5 rounded transition-colors ${deletingBoxId === box.id ? 'bg-red-500 text-white animate-pulse' : 'hover:bg-red-500/10 text-red-400'}`}
                                                    disabled={deletingBoxId === box.id}
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* TAB: USERS */}
            {activeTab === 'users' && (
                <div className="space-y-6">
                    <div className="bg-[#131720] border border-gray-800 rounded-xl overflow-hidden">
                        <div className="hidden md:block overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-[#0b0e14] text-gray-400 font-medium border-b border-gray-800">
                                    <tr>
                                        <th className="px-6 py-4">User</th>
                                        <th className="px-6 py-4">Level</th>
                                        <th className="px-6 py-4">XP</th>
                                        <th className="px-6 py-4">Status</th>
                                        <th className="px-6 py-4 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-800">
                                    {users.length === 0 ? (
                                        <tr>
                                            <td colSpan={5} className="px-6 py-6 text-center text-gray-500">
                                                No users found in Firebase.
                                            </td>
                                        </tr>
                                    ) : (
                                        users.map((profile) => {
                                            const isEditing = editingUserId === profile.id;
                                            const progress = calculateLevelProgress(isEditing ? userXpInput : (profile.xp || 0));
                                            const status = userStatuses[profile.id] ?? 'active';
                                            return (
                                                <tr key={profile.id} className="hover:bg-[#1a2130] transition-colors">
                                                    <td className="px-6 py-4 flex items-center gap-3">
                                                        <img src={profile.avatar} className="w-8 h-8 rounded-full" />
                                                        <span className="font-bold text-white">{profile.name}</span>
                                                    </td>
                                                    <td className="px-6 py-4 text-gray-400">Lvl {progress.level}</td>
                                                    <td className="px-6 py-4 text-gray-400">
                                                        {isEditing ? (
                                                            <div className="space-y-1">
                                                                <input
                                                                    type="number"
                                                                    value={userXpInput}
                                                                    onChange={(e) => setUserXpInput(Number(e.target.value))}
                                                                    className="w-32 bg-[#0b0e14] border border-gray-700 rounded px-3 py-1.5 text-white text-sm"
                                                                />
                                                                <div className="text-[11px] text-gray-500">Lvl after save: {progress.level}</div>
                                                            </div>
                                                        ) : (
                                                            <span className="text-gray-300">{profile.xp ?? 0}</span>
                                                        )}
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <span className={`px-2 py-1 rounded text-xs font-bold ${
                                                            status === 'active'
                                                                ? 'bg-green-500/10 text-green-500'
                                                                : status === 'suspended'
                                                                    ? 'bg-yellow-500/10 text-yellow-400'
                                                                    : 'bg-red-500/10 text-red-400'
                                                        }`}>
                                                            {status}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <div className="flex justify-end gap-3">
                                                            {isEditing ? (
                                                                <>
                                                                    <button
                                                                        onClick={() => saveUserProgress(profile.id)}
                                                                        disabled={isSavingUser}
                                                                        className="text-green-400 hover:text-green-300 font-bold text-xs disabled:opacity-50"
                                                                    >
                                                                        {isSavingUser ? 'Saving...' : 'Save'}
                                                                    </button>
                                                                    <button
                                                                        onClick={cancelEditUser}
                                                                        className="text-gray-400 hover:text-gray-300 font-bold text-xs"
                                                                    >
                                                                        Cancel
                                                                    </button>
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <button
                                                                        className="text-blue-400 hover:text-blue-300 font-bold text-xs"
                                                                        onClick={() => startEditUser(profile.id, profile.xp || 0)}
                                                                    >
                                                                        Edit XP
                                                                    </button>
                                                                    <button
                                                                        className="text-purple-400 hover:text-purple-300 font-bold text-xs"
                                                                        onClick={() => setSelectedUserId(profile.id)}
                                                                    >
                                                                        View
                                                                    </button>
                                                                </>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>

                        <div className="grid grid-cols-1 gap-4 p-4 md:hidden">
                            {users.length === 0 ? (
                                <div className="px-6 py-6 text-center text-gray-500">
                                    No users found in Firebase.
                                </div>
                            ) : (
                                users.map((profile) => {
                                    const status = userStatuses[profile.id] ?? 'active';
                                    const isEditing = editingUserId === profile.id;
                                    return (
                                        <div key={profile.id} className="bg-[#0b0e14] border border-gray-800 rounded-xl p-4 space-y-3">
                                            <div className="flex items-center gap-3">
                                                <img src={profile.avatar} className="w-10 h-10 rounded-full" />
                                                <div className="flex-1">
                                                    <div className="text-white font-bold">{profile.name}</div>
                                                    <div className="text-xs text-gray-400">Lvl {calculateLevelProgress(profile.xp || 0).level}</div>
                                                </div>
                                                <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${
                                                    status === 'active'
                                                        ? 'bg-green-500/10 text-green-500'
                                                        : status === 'suspended'
                                                            ? 'bg-yellow-500/10 text-yellow-400'
                                                            : 'bg-red-500/10 text-red-400'
                                                }`}>
                                                    {status}
                                                </span>
                                            </div>
                                            <div className="text-xs text-gray-400">
                                                XP: <span className="text-gray-200">{profile.xp ?? 0}</span>
                                            </div>
                                            {isEditing && (
                                                <div className="space-y-2">
                                                    <input
                                                        type="number"
                                                        value={userXpInput}
                                                        onChange={(e) => setUserXpInput(Number(e.target.value))}
                                                        className="w-full bg-[#131720] border border-gray-700 rounded px-3 py-2 text-white text-sm"
                                                    />
                                                    <div className="flex gap-3">
                                                        <button
                                                            onClick={() => saveUserProgress(profile.id)}
                                                            disabled={isSavingUser}
                                                            className="text-green-400 text-xs font-bold disabled:opacity-50"
                                                        >
                                                            {isSavingUser ? 'Saving...' : 'Save'}
                                                        </button>
                                                        <button
                                                            onClick={cancelEditUser}
                                                            className="text-gray-400 text-xs font-bold"
                                                        >
                                                            Cancel
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                            {!isEditing && (
                                                <div className="flex flex-wrap gap-2">
                                                    <button
                                                        className="px-3 py-1.5 rounded-lg bg-blue-600/20 text-blue-300 text-xs font-semibold"
                                                        onClick={() => startEditUser(profile.id, profile.xp || 0)}
                                                    >
                                                        Edit XP
                                                    </button>
                                                    <button
                                                        className="px-3 py-1.5 rounded-lg bg-purple-600/20 text-purple-300 text-xs font-semibold"
                                                        onClick={() => setSelectedUserId(profile.id)}
                                                    >
                                                        View
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>

                    {selectedUser ? (
                        <div className="space-y-6">
                            <div className="bg-[#131720] border border-gray-800 rounded-xl p-6">
                                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                                    <div className="flex items-center gap-4">
                                        <img src={selectedUser.avatar} className="w-12 h-12 rounded-full" />
                                        <div>
                                            <div className="text-white text-lg font-bold">{selectedUser.name}</div>
                                            <div className="text-xs text-gray-400">{selectedUser.email || 'No email on file'}</div>
                                        </div>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        <span className="px-3 py-1 rounded-full bg-[#0b0e14] text-xs text-gray-400 inline-flex items-center gap-2">
                                            Coins:
                                            <CoinAmount
                                              amount={selectedUser.balance ?? 0}
                                              formatOptions={{ maximumFractionDigits: 0 }}
                                              className="text-green-400 font-semibold"
                                              iconClassName="w-3 h-3"
                                            />
                                        </span>
                                        <span className="px-3 py-1 rounded-full bg-[#0b0e14] text-xs text-gray-400">
                                            Inventory: <span className="text-gray-200 font-semibold">{selectedInventory.length}</span>
                                        </span>
                                        <span className="px-3 py-1 rounded-full bg-[#0b0e14] text-xs text-gray-400">
                                            Ledger entries: <span className="text-gray-200 font-semibold">{selectedLedgerEntries.length}</span>
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                                <div className="space-y-6">
                                    <div className="bg-[#131720] border border-gray-800 rounded-xl p-5">
                                        <div className="flex items-center gap-2 mb-4">
                                            <UserCog className="w-4 h-4 text-blue-400" />
                                            <h3 className="text-sm font-bold text-white">Status & Locks</h3>
                                        </div>
                                        <div className="space-y-4">
                                            <div>
                                                <label className="block text-[10px] uppercase text-gray-500 font-bold mb-2">Account Status</label>
                                                <select
                                                    value={userStatuses[selectedUser.id] ?? 'active'}
                                                    onChange={(event) => handleStatusChange(selectedUser.id, event.target.value as UserStatus)}
                                                    className="w-full bg-[#0b0e14] border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200"
                                                >
                                                    <option value="active">Active</option>
                                                    <option value="suspended">Suspended</option>
                                                    <option value="banned">Banned</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-[10px] uppercase text-gray-500 font-bold mb-2">Risk Locks</label>
                                                <div className="space-y-2">
                                                    {Object.entries(LOCK_LABELS).map(([key, label]) => {
                                                        const isLocked = userLocks[selectedUser.id]?.[key as keyof UserLocks];
                                                        return (
                                                            <button
                                                                key={key}
                                                                onClick={() => handleLockToggle(selectedUser.id, key as keyof UserLocks)}
                                                                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg border text-sm ${
                                                                    isLocked
                                                                        ? 'bg-red-500/10 border-red-500/40 text-red-300'
                                                                        : 'bg-[#0b0e14] border-gray-700 text-gray-300'
                                                                }`}
                                                            >
                                                                <span>{label}</span>
                                                                {isLocked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="bg-[#131720] border border-gray-800 rounded-xl p-5">
                                        <div className="flex items-center gap-2 mb-4">
                                            <ShieldCheck className="w-4 h-4 text-green-400" />
                                            <h3 className="text-sm font-bold text-white">Fix Tools</h3>
                                        </div>
                                        <div className="space-y-4">
                                            <div className="space-y-2">
                                                <label className="block text-[10px] uppercase text-gray-500 font-bold">Reversal Entry</label>
                                                <input
                                                    type="number"
                                                    value={reversalAmount}
                                                    onChange={(event) => setReversalAmount(event.target.value)}
                                                    placeholder="Amount to reverse"
                                                    className="w-full bg-[#0b0e14] border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200"
                                                />
                                                <textarea
                                                    value={reversalReason}
                                                    onChange={(event) => setReversalReason(event.target.value)}
                                                    rows={2}
                                                    placeholder="Reason for reversal"
                                                    className="w-full bg-[#0b0e14] border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200"
                                                />
                                                <button
                                                    onClick={handleCreateReversal}
                                                    disabled={!reversalAmount || !reversalReason.trim()}
                                                    className="w-full px-3 py-2 rounded-lg bg-red-500/20 text-red-300 text-xs font-bold uppercase disabled:opacity-50"
                                                >
                                                    Create Reversal Entry
                                                </button>
                                            </div>
                                            <div className="border-t border-gray-800 pt-4 space-y-2">
                                                <label className="block text-[10px] uppercase text-gray-500 font-bold">Void Case Open</label>
                                                <input
                                                    type="text"
                                                    value={voidSourceId}
                                                    onChange={(event) => setVoidSourceId(event.target.value)}
                                                    placeholder="Case open ID"
                                                    className="w-full bg-[#0b0e14] border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200"
                                                />
                                                <textarea
                                                    value={voidReason}
                                                    onChange={(event) => setVoidReason(event.target.value)}
                                                    rows={2}
                                                    placeholder="Void reason"
                                                    className="w-full bg-[#0b0e14] border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200"
                                                />
                                                <button
                                                    onClick={handleVoidOpen}
                                                    disabled={!voidSourceId.trim()}
                                                    className="w-full px-3 py-2 rounded-lg bg-yellow-500/20 text-yellow-300 text-xs font-bold uppercase disabled:opacity-50"
                                                >
                                                    Void Open & Compensate
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="xl:col-span-2 space-y-6">
                                    <div className="bg-[#131720] border border-gray-800 rounded-xl p-5">
                                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                                            <div className="flex items-center gap-2">
                                                <ScrollText className="w-4 h-4 text-purple-400" />
                                                <h3 className="text-sm font-bold text-white">Immutable Coin Ledger</h3>
                                            </div>
                                            <div className="flex flex-wrap gap-2 text-[11px]">
                                                <span className="px-2 py-1 rounded-full bg-[#0b0e14] text-gray-400">
                                                    Entries: <span className="text-gray-200 font-semibold">{selectedLedgerEntries.length}</span>
                                                </span>
                                                <span className="px-2 py-1 rounded-full bg-[#0b0e14] text-gray-400">
                                                    Net:{' '}
                                                    <CoinAmount
                                                      amount={ledgerNetChange}
                                                      formatOptions={{ maximumFractionDigits: 0 }}
                                                      showSign
                                                      className={ledgerNetChange >= 0 ? 'text-green-400 font-semibold' : 'text-red-400 font-semibold'}
                                                      iconClassName="w-3.5 h-3.5"
                                                    />
                                                </span>
                                            </div>
                                        </div>
                                        <div className="flex flex-col md:flex-row gap-3 mb-4">
                                            <select
                                                value={ledgerFilter}
                                                onChange={(event) => setLedgerFilter(event.target.value as 'all' | LedgerEntryType)}
                                                className="w-full md:w-48 bg-[#0b0e14] border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200"
                                            >
                                                <option value="all">All entry types</option>
                                                <option value="deposit">Deposit</option>
                                                <option value="case_open">Case open</option>
                                                <option value="sell_back">Sell back</option>
                                                <option value="bonus">Bonus</option>
                                                <option value="admin_adjustment">Admin adjustment</option>
                                                <option value="chargeback_reversal">Chargeback reversal</option>
                                                <option value="reversal">Reversal</option>
                                            </select>
                                            <input
                                                type="text"
                                                value={ledgerSearch}
                                                onChange={(event) => setLedgerSearch(event.target.value)}
                                                placeholder="Search memo or source ID"
                                                className="w-full bg-[#0b0e14] border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200"
                                            />
                                        </div>
                                        <div className="space-y-3">
                                            {filteredLedgerEntries.length === 0 ? (
                                                <div className="text-sm text-gray-500">No ledger entries yet.</div>
                                            ) : (
                                                filteredLedgerEntries.map((entry) => (
                                                    <div key={entry.id} className="bg-[#0b0e14] border border-gray-800 rounded-lg p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                                                        <div>
                                                            <div className="text-xs text-gray-400 uppercase">{entry.type.replace('_', ' ')}</div>
                                                            <div className="text-sm text-gray-200 font-semibold">{entry.memo || 'Balance update'}</div>
                                                            <div className="text-[11px] text-gray-500">
                                                                {entry.sourceId || 'Manual entry'} • {formatTimestamp(entry.createdAt)}
                                                                {entry.balanceAfter !== undefined && (
                                                                    <span className="text-gray-400 inline-flex items-center gap-1">
                                                                      • Balance
                                                                      <CoinAmount
                                                                        amount={entry.balanceAfter}
                                                                        formatOptions={{ maximumFractionDigits: 0 }}
                                                                        className="text-gray-400 font-semibold"
                                                                        iconClassName="w-3 h-3"
                                                                      />
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <CoinAmount
                                                          amount={entry.amount}
                                                          formatOptions={{ maximumFractionDigits: 0 }}
                                                          showSign
                                                          className={`text-sm font-bold ${entry.amount >= 0 ? 'text-green-400' : 'text-red-400'}`}
                                                          iconClassName="w-3.5 h-3.5"
                                                        />
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </div>

                                    <div className="bg-[#131720] border border-gray-800 rounded-xl p-5">
                                        <div className="flex items-center gap-2 mb-4">
                                            <Package className="w-4 h-4 text-blue-400" />
                                            <h3 className="text-sm font-bold text-white">Inventory Locks & Provenance</h3>
                                        </div>
                                        <div className="space-y-3">
                                            {selectedInventory.length === 0 ? (
                                                <div className="text-sm text-gray-500">No inventory items available.</div>
                                            ) : (
                                                selectedInventory.map((item) => (
                                                    <div key={item.instanceId} className="bg-[#0b0e14] border border-gray-800 rounded-lg p-3 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                                                        <div className="flex items-start gap-3">
                                                            <img src={item.image} alt={item.name} className="w-10 h-10 rounded-lg bg-[#131720] object-contain" />
                                                            <div>
                                                                <div className="text-sm text-white font-semibold">{item.name}</div>
                                                                <div className="text-xs text-gray-500">
                                                                    {item.provenance ? `From ${item.provenance.sourceType} (${item.provenance.sourceId})` : 'Provenance unknown'}
                                                                </div>
                                                                <div className="text-[10px] text-gray-500 mt-1">Status: {item.status}</div>
                                                            </div>
                                                        </div>
                                                        <div className="flex flex-col sm:flex-row gap-2">
                                                            <button
                                                                onClick={() => handleInventoryLockToggle(selectedUser.id, item.instanceId)}
                                                                className={`px-3 py-2 rounded-lg text-xs font-bold uppercase ${
                                                                    item.locked
                                                                        ? 'bg-red-500/20 text-red-300'
                                                                        : 'bg-[#131720] text-gray-300 border border-gray-700'
                                                                }`}
                                                            >
                                                                {item.locked ? 'Unlock' : 'Lock'}
                                                            </button>
                                                            <div className="text-[10px] text-gray-500">
                                                                {(item.history ?? []).slice(0, 2).map((history) => (
                                                                    <div key={history.id}>
                                                                        {history.action.replace('_', ' ')} • {formatTimestamp(history.createdAt)}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </div>

                                    <div className="bg-[#131720] border border-gray-800 rounded-xl p-5">
                                        <div className="flex items-center gap-2 mb-4">
                                            <ShieldAlert className="w-4 h-4 text-red-400" />
                                            <h3 className="text-sm font-bold text-white">Admin Action Log</h3>
                                        </div>
                                        <div className="space-y-3">
                                            {selectedAdminLogs.length === 0 ? (
                                                <div className="text-sm text-gray-500">No admin actions recorded.</div>
                                            ) : (
                                                selectedAdminLogs.map((log) => (
                                                    <div key={log.id} className="bg-[#0b0e14] border border-gray-800 rounded-lg p-3">
                                                        <div className="text-xs text-gray-400 uppercase">{log.actionType.replace('_', ' ')}</div>
                                                        <div className="text-sm text-gray-200 font-semibold">{log.reason}</div>
                                                        <div className="text-[11px] text-gray-500">Admin {log.adminUid} • {formatTimestamp(log.createdAt)}</div>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </div>

                                    <div className="bg-[#131720] border border-gray-800 rounded-xl p-5">
                                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                                            <div className="flex items-center gap-2">
                                                <Activity className="w-4 h-4 text-green-400" />
                                                <h3 className="text-sm font-bold text-white">Unified User Timeline</h3>
                                            </div>
                                            <div className="text-[11px] text-gray-500">
                                                Showing <span className="text-gray-200 font-semibold">{Math.min(filteredTimelineEntries.length, 15)}</span> of <span className="text-gray-200 font-semibold">{filteredTimelineEntries.length}</span>
                                            </div>
                                        </div>
                                        <div className="flex flex-col md:flex-row gap-3 mb-4">
                                            <div className="flex flex-wrap gap-2">
                                                {(['all', 'ledger', 'inventory', 'admin'] as const).map((filter) => (
                                                    <button
                                                        key={filter}
                                                        onClick={() => setTimelineFilter(filter)}
                                                        className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition-colors ${
                                                            timelineFilter === filter
                                                                ? 'bg-green-500/20 text-green-300'
                                                                : 'bg-[#0b0e14] text-gray-400 hover:text-white hover:bg-gray-800'
                                                        }`}
                                                    >
                                                        {filter === 'all' ? 'All' : filter}
                                                    </button>
                                                ))}
                                            </div>
                                            <input
                                                type="text"
                                                value={timelineSearch}
                                                onChange={(event) => setTimelineSearch(event.target.value)}
                                                placeholder="Search timeline details"
                                                className="w-full bg-[#0b0e14] border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200"
                                            />
                                        </div>
                                        <div className="space-y-3">
                                            {filteredTimelineEntries.length === 0 ? (
                                                <div className="text-sm text-gray-500">No timeline events available.</div>
                                            ) : (
                                                filteredTimelineEntries.slice(0, 15).map((entry) => (
                                                    <div key={entry.id} className="bg-[#0b0e14] border border-gray-800 rounded-lg p-3">
                                                        <div className="text-sm text-gray-200 font-semibold">{entry.title}</div>
                                                        <div className="text-xs text-gray-400">{entry.description}</div>
                                                        <div className="text-[11px] text-gray-500">
                                                            {entry.meta ? `${entry.meta} • ` : ''}{formatTimestamp(entry.createdAt)}
                                                        </div>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="bg-[#131720] border border-gray-800 rounded-xl p-6 text-sm text-gray-500">
                            Select a user to review ledger activity, locks, and admin actions.
                        </div>
                    )}
                </div>
            )}

            {/* TAB: SHIPMENTS */}
            {activeTab === 'shipments' && (
                <div className="space-y-6">
                    <div className="bg-[#131720] border border-gray-800 rounded-xl p-6">
                        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                            <div>
                                <h3 className="text-lg font-bold text-white">Shipping Requests</h3>
                                <p className="text-sm text-gray-400">Track items that players have requested to ship or already delivered.</p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {(['all', 'processing', 'shipped'] as const).map((filter) => (
                                    <button
                                        key={filter}
                                        onClick={() => setShipmentFilter(filter)}
                                        className={`px-4 py-2 rounded-lg text-xs font-bold uppercase transition-colors ${
                                            shipmentFilter === filter
                                                ? 'bg-blue-600 text-white'
                                                : 'bg-[#0b0e14] text-gray-400 hover:text-white hover:bg-gray-800'
                                        }`}
                                    >
                                        {filter === 'all' ? 'All' : filter === 'processing' ? 'Processing' : 'Shipped'}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {filteredShipments.length === 0 ? (
                        <div className="bg-[#131720] border border-gray-800 rounded-xl p-8 text-center text-gray-500">
                            No shipment requests match this filter.
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            {filteredShipments.map(({ user: shipmentUser, item, key }) => {
                                const address = shipmentUser.shippingAddress;
                                const canUpdate = Boolean(item.instanceId);
                                const trackingKey = `${shipmentUser.id}-${item.instanceId || key}`;
                                const trackingValue = shipmentTracking[trackingKey] ?? item.trackingNumber ?? '';
                                return (
                                    <div key={key} className="bg-[#131720] border border-gray-800 rounded-xl p-5 flex flex-col gap-4">
                                        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                                            <div className="flex items-center gap-3">
                                                <img src={item.image} alt={item.name} className="w-12 h-12 rounded-lg bg-[#0b0e14] object-contain" />
                                                <div>
                                                    <div className="text-white font-bold">{item.name}</div>
                                                    <CoinAmount
                                                      amount={item.price}
                                                      formatOptions={{ maximumFractionDigits: 0 }}
                                                      className="text-xs text-green-400 font-semibold"
                                                      iconClassName="w-3 h-3"
                                                    />
                                                    <div className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full mt-1 ${
                                                        item.status === 'shipped'
                                                            ? 'bg-green-500/10 text-green-400'
                                                            : 'bg-yellow-500/10 text-yellow-400'
                                                    }`}>
                                                        {item.status === 'shipped' ? <PackageCheck className="w-3 h-3" /> : <Truck className="w-3 h-3" />}
                                                        {item.status === 'shipped' ? 'Shipped' : 'Processing'}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="text-sm text-gray-300 sm:text-right">
                                                <div className="font-semibold">{shipmentUser.name}</div>
                                                <div className="text-xs text-gray-500 break-all">{shipmentUser.email || 'No email on file'}</div>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="bg-[#0b0e14] border border-gray-800 rounded-lg p-3 text-xs text-gray-400 space-y-1">
                                                <div className="text-[10px] uppercase font-bold text-gray-500">Shipping Address</div>
                                                {address ? (
                                                    <>
                                                        <div className="text-gray-200 font-semibold">{address.fullName}</div>
                                                        <div>{address.street}</div>
                                                        <div>{address.city}, {address.state} {address.zipCode}</div>
                                                        <div>{address.country}</div>
                                                    </>
                                                ) : (
                                                    <div className="text-yellow-400">No address saved.</div>
                                                )}
                                            </div>
                                            <div className="bg-[#0b0e14] border border-gray-800 rounded-lg p-3 text-xs text-gray-400 flex flex-col gap-3">
                                                <div className="text-[10px] uppercase font-bold text-gray-500">Shipment Actions</div>
                                                <div className="text-gray-500">Instance ID: <span className="text-gray-300">{item.instanceId || 'Unavailable'}</span></div>
                                                <label className="text-[10px] uppercase font-bold text-gray-500">Tracking number</label>
                                                <input
                                                    type="text"
                                                    value={trackingValue}
                                                    onChange={(event) =>
                                                        setShipmentTracking((prev) => ({
                                                            ...prev,
                                                            [trackingKey]: event.target.value
                                                        }))
                                                    }
                                                    placeholder="Enter tracking number"
                                                    className="w-full bg-[#131720] border border-gray-700 rounded-lg px-3 py-2 text-xs text-gray-200"
                                                />
                                                <button
                                                    onClick={() =>
                                                        updateShipmentStatus(
                                                            shipmentUser.id,
                                                            item.instanceId || '',
                                                            'shipped',
                                                            trackingValue
                                                        )
                                                    }
                                                    disabled={item.status === 'shipped' || !canUpdate}
                                                    className="w-full sm:w-auto px-4 py-2 bg-green-600 hover:bg-green-500 text-white text-xs font-bold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                    Mark as shipped
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* TAB: BONUSES */}
            {activeTab === 'bonuses' && (
                <div className="space-y-6">
                    <div className="bg-[#131720] border border-gray-800 rounded-xl p-6">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                            <div>
                                <h3 className="text-lg font-bold text-white">XP Distribution & Leveling</h3>
                                <p className="text-sm text-gray-400">
                                    Tune how players earn XP and how quickly they level up. All coin values are shown in coins.
                                </p>
                            </div>
                            <div className="text-xs text-gray-500 bg-[#0b0e14] border border-gray-800 rounded-lg px-3 py-2">
                                Active XP Curve: Base {bonusDraft.levelBaseXp} XP • Multiplier {bonusDraft.levelXpMultiplier.toFixed(2)}x
                            </div>
                        </div>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-2">XP per 100 coins wagered</label>
                                    <input
                                        type="number"
                                        min={0}
                                        step={1}
                                        value={bonusDraft.xpPer100Coins}
                                        onChange={(event) => setBonusDraft((prev) => ({ ...prev, xpPer100Coins: Number(event.target.value) }))}
                                        className="w-full bg-[#0b0e14] border border-gray-700 rounded-lg px-4 py-2 text-white"
                                    />
                                    <p className="text-xs text-gray-500 mt-2">
                                        Current distribution: {bonusDraft.xpPer100Coins} XP for every 100 coins wagered.
                                    </p>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-2">XP per case opened</label>
                                    <input
                                        type="number"
                                        min={0}
                                        step={1}
                                        value={bonusDraft.xpPerCaseOpen}
                                        onChange={(event) => setBonusDraft((prev) => ({ ...prev, xpPerCaseOpen: Number(event.target.value) }))}
                                        className="w-full bg-[#0b0e14] border border-gray-700 rounded-lg px-4 py-2 text-white"
                                    />
                                    <p className="text-xs text-gray-500 mt-2">
                                        Bonus XP for engagement loops and streaks.
                                    </p>
                                </div>
                            </div>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Base XP to reach level 2</label>
                                    <input
                                        type="number"
                                        min={0}
                                        step={10}
                                        value={bonusDraft.levelBaseXp}
                                        onChange={(event) => setBonusDraft((prev) => ({ ...prev, levelBaseXp: Number(event.target.value) }))}
                                        className="w-full bg-[#0b0e14] border border-gray-700 rounded-lg px-4 py-2 text-white"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Leveling multiplier</label>
                                    <input
                                        type="number"
                                        min={1}
                                        step={0.01}
                                        value={bonusDraft.levelXpMultiplier}
                                        onChange={(event) => setBonusDraft((prev) => ({ ...prev, levelXpMultiplier: Number(event.target.value) }))}
                                        className="w-full bg-[#0b0e14] border border-gray-700 rounded-lg px-4 py-2 text-white"
                                    />
                                    <p className="text-xs text-gray-500 mt-2">
                                        Higher values mean each level needs more XP than the last.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-[#131720] border border-gray-800 rounded-xl p-6">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                            <div>
                                <h3 className="text-lg font-bold text-white">Rakeback Settings</h3>
                                <p className="text-sm text-gray-400">
                                    Configure unlock levels and bonus amounts. Coin values are displayed in coins only.
                                </p>
                            </div>
                            <div className="text-xs text-green-400 bg-green-500/10 border border-green-500/20 rounded-lg px-3 py-2">
                                Unlock at level {bonusDraft.rakebackUnlockLevel}
                            </div>
                        </div>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Level to unlock rakeback</label>
                                    <input
                                        type="number"
                                        min={1}
                                        step={1}
                                        value={bonusDraft.rakebackUnlockLevel}
                                        onChange={(event) => setBonusDraft((prev) => ({ ...prev, rakebackUnlockLevel: Number(event.target.value) }))}
                                        className="w-full bg-[#0b0e14] border border-gray-700 rounded-lg px-4 py-2 text-white"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Base rakeback rate (%)</label>
                                    <input
                                        type="number"
                                        min={0}
                                        step={0.1}
                                        value={bonusDraft.rakebackBasePercent}
                                        onChange={(event) => setBonusDraft((prev) => ({ ...prev, rakebackBasePercent: Number(event.target.value) }))}
                                        className="w-full bg-[#0b0e14] border border-gray-700 rounded-lg px-4 py-2 text-white"
                                    />
                                    <p className="text-xs text-gray-500 mt-2">
                                        Applies to net wagers once the unlock level is reached.
                                    </p>
                                </div>
                            </div>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Weekly bonus payout (coins)</label>
                                    <input
                                        type="number"
                                        min={0}
                                        step={100}
                                        value={bonusDraft.rakebackBonusCoins}
                                        onChange={(event) => setBonusDraft((prev) => ({ ...prev, rakebackBonusCoins: Number(event.target.value) }))}
                                        className="w-full bg-[#0b0e14] border border-gray-700 rounded-lg px-4 py-2 text-white"
                                    />
                                    <p className="text-xs text-gray-500 mt-2">
                                        Boost power users with a fixed coin grant.
                                    </p>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Daily rakeback cap (coins)</label>
                                    <input
                                        type="number"
                                        min={0}
                                        step={100}
                                        value={bonusDraft.rakebackDailyCapCoins}
                                        onChange={(event) => setBonusDraft((prev) => ({ ...prev, rakebackDailyCapCoins: Number(event.target.value) }))}
                                        className="w-full bg-[#0b0e14] border border-gray-700 rounded-lg px-4 py-2 text-white"
                                    />
                                    <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500 mt-2">
                                        <span>Cap preview:</span>
                                        <span className="text-gray-200 font-semibold">{bonusDraft.rakebackDailyCapCoins.toLocaleString()} coins</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-t border-gray-800 mt-6 pt-4">
                            <div className="text-xs text-gray-500">
                                Rakeback bonus: {bonusDraft.rakebackBonusCoins.toLocaleString()} coins • Base rate: {bonusDraft.rakebackBasePercent}%
                            </div>
                            <button
                                onClick={handleSaveBonusSettings}
                                className="w-full sm:w-auto px-5 py-2 bg-brand-purple/20 text-brand-purple border border-brand-purple/40 rounded-lg text-sm font-bold hover:bg-brand-purple hover:text-white transition-colors"
                            >
                                Save bonus settings
                            </button>
                            {bonusSaveNotice && (
                                <div className="text-xs text-green-400 bg-green-500/10 border border-green-500/20 rounded-lg px-3 py-2">
                                    Bonus settings saved.
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
            
            {/* TAB: SETTINGS */}
            {activeTab === 'settings' && (
                <div className="space-y-6">
                    <div className="bg-[#131720] border border-gray-800 rounded-xl p-6">
                        <h3 className="text-lg font-bold text-white mb-4">General Configuration</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Site Name</label>
                                <input type="text" value="LootX" className="w-full bg-[#0b0e14] border border-gray-700 rounded-lg px-4 py-2 text-white" readOnly />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Maintenance Mode</label>
                                <div className="flex items-center gap-3">
                                    <div className="w-12 h-6 bg-gray-700 rounded-full relative cursor-pointer">
                                        <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full"></div>
                                    </div>
                                    <span className="text-sm text-gray-400">Disabled</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="bg-[#131720] border border-gray-800 rounded-xl p-6">
                        <div className="flex items-center gap-2 mb-4">
                            <BellRing className="w-5 h-5 text-brand-purple" />
                            <h3 className="text-lg font-bold text-white">Send Notification</h3>
                        </div>
                        <p className="text-sm text-gray-400 mb-4">
                            Broadcast a notification to users. Messages appear in the notification bell.
                        </p>
                        <div className="space-y-4">
                            <textarea
                                value={adminNotification}
                                onChange={(event) => setAdminNotification(event.target.value)}
                                rows={3}
                                placeholder="Enter a notification message..."
                                className="w-full bg-[#0b0e14] border border-gray-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-brand-purple transition-colors"
                            />
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                                <span className="text-xs text-gray-500">
                                    Keep it short and actionable for mobile users.
                                </span>
                                <button
                                    onClick={handleSendAdminNotification}
                                    disabled={!adminNotification.trim()}
                                    className="px-5 py-2 bg-brand-purple/20 text-brand-purple border border-brand-purple/40 rounded-lg text-sm font-bold hover:bg-brand-purple hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Send notification
                                </button>
                            </div>
                            {adminNoticeSent && (
                                <div className="text-xs text-green-400 bg-green-500/10 border border-green-500/20 rounded-lg px-3 py-2">
                                    Notification sent.
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {boxToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-black/80 backdrop-blur-sm animate-in fade-in" onClick={() => setBoxToDelete(null)}></div>
              <div className="relative w-full max-w-sm bg-[#131720] border border-gray-700 rounded-2xl shadow-2xl p-6 animate-in zoom-in-95">
                  <h3 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
                      <ShieldAlert className="w-6 h-6 text-red-500" /> Confirm Deletion
                  </h3>
                  <p className="text-gray-400 text-sm mb-6">
                      Are you sure you want to delete this box permanently? This action cannot be undone.
                  </p>
                  <div className="flex gap-3">
                      <button 
                          onClick={() => setBoxToDelete(null)}
                          className="flex-1 py-2.5 bg-gray-800 hover:bg-gray-700 text-white text-sm font-bold rounded-lg transition-colors"
                      >
                          Cancel
                      </button>
                      <button 
                          onClick={confirmDeleteBox}
                          className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 text-white text-sm font-bold rounded-lg shadow-lg shadow-red-900/20 transition-colors"
                      >
                          Delete Box
                      </button>
                  </div>
              </div>
          </div>
      )}

    </div>
  );
};

const SwordsIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="14.5 17.5 3 6 3 3 6 3 17.5 14.5"></polyline><line x1="13" y1="19" x2="19" y2="13"></line><line x1="16" y1="16" x2="20" y2="20"></line><line x1="19" y1="21" x2="21" y2="19"></line><polyline points="14.5 6.5 18 3 21 3 21 6 17.5 9.5"></polyline><line x1="5" y1="14" x2="9" y2="18"></line><line x1="7" y1="17" x2="4" y2="20"></line><line x1="3" y1="19" x2="5" y2="21"></line></svg>
);

const CoinStatIcon = () => (
    <img src={COIN_ICON} alt="Coin" className="w-6 h-6" />
);
