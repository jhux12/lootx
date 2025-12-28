import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, InventoryItem, CaseItem, ViewState, Battle, MysteryBox, ShippingAddress } from '../types';
import { CASE_ITEMS } from '../constants';
import { auth, db } from '../firebase';
import { 
  User as FirebaseUser,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut
} from 'firebase/auth';
import { 
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  setDoc
} from 'firebase/firestore';

const sanitizeData = <T extends Record<string, any>>(data: T): T => {
  return Object.fromEntries(
    Object.entries(data).filter(([, value]) => value !== undefined)
  ) as T;
};

// Leveling Configuration
const BASE_XP_REQUIREMENT = 500;
const XP_GROWTH_RATE = 1.2;

export const calculateLevelProgress = (totalXp: number) => {
  let level = 1;
  let xpRemaining = Math.max(0, totalXp);
  let xpForNextLevel = BASE_XP_REQUIREMENT;

  while (xpRemaining >= xpForNextLevel) {
    xpRemaining -= xpForNextLevel;
    level += 1;
    xpForNextLevel = Math.floor(xpForNextLevel * XP_GROWTH_RATE + 50);
  }

  return {
    level,
    xpIntoLevel: xpRemaining,
    xpForNextLevel,
    xpToNextLevel: xpForNextLevel - xpRemaining
  };
};

// Storage Keys (Fallback)
const STORAGE_KEY_ITEMS = 'lootx_items'; // New key for items

const safeReadLocalStorage = <T,>(key: string, fallback: T): T => {
  try {
    const storedValue = localStorage.getItem(key);
    if (storedValue) {
      return JSON.parse(storedValue) as T;
    }
  } catch (error) {
    console.warn(`Unable to read "${key}" from localStorage`, error);
  }

  return fallback;
};

const safeWriteLocalStorage = (key: string, value: unknown) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.warn(`Unable to write "${key}" to localStorage`, error);
  }
};

type PersistUserData = Partial<{
  balance: number;
  inventory: InventoryItem[];
  xp: number;
  level: number;
  followers: string[];
  shippingAddress: ShippingAddress;
  name: string;
  avatar: string;
  lastDailyClaim: number;
  isAdmin: boolean;
}>;

interface GameContextType {
  user: User;
  isAuthenticated: boolean;
  balance: number;
  inventory: InventoryItem[];
  users: User[];
  view: ViewState;
  battles: Battle[];
  boxes: MysteryBox[];
  items: CaseItem[];
  showLoginModal: boolean;
  showTopUpModal: boolean;
  
  // Actions
  login: (email: string, pass: string) => Promise<void>;
  register: (name: string, email: string, pass: string) => Promise<void>;
  logout: () => void;
  setShowLoginModal: (show: boolean) => void;
  setShowTopUpModal: (show: boolean) => void;
  setView: (view: ViewState) => void;
  addBalance: (amount: number) => void;
  deductBalance: (amount: number) => boolean;
  addToInventory: (item: CaseItem) => void;
  followUser: (targetUserId: string) => Promise<void>;
  unfollowUser: (targetUserId: string) => Promise<void>;
  sellItem: (instanceId: string, value: number) => void;
  shipItem: (instanceId: string) => void;
  updateAddress: (address: ShippingAddress) => void;
  updateUserInfo: (name: string, avatar: string) => Promise<void>;
  createBattle: (boxIds: string[], maxPlayers: number) => void;
  joinBattle: (battleId: string) => void;
  updateBattle: (updatedBattle: Battle) => void;
  createItem: (item: CaseItem) => Promise<void>;
  updateItem: (item: CaseItem) => Promise<void>;
  deleteItem: (itemId: string) => Promise<void>;
  updateUserFlags: (updates: Partial<User>) => Promise<void>;
  createBox: (box: MysteryBox) => void; // Admin
  createUserBox: (box: MysteryBox) => void; // User Custom
  updateBox: (box: MysteryBox) => void;
  deleteBox: (boxId: string) => Promise<void>;
  claimDaily: () => void;
  updateUserProgress: (userId: string, xp: number) => Promise<void>;
}

const GameContext = createContext<GameContextType | undefined>(undefined);

// Guest / Loading User
const GUEST_USER: User = {
  id: 'guest',
  name: 'Guest',
  avatar: 'https://picsum.photos/id/64/100/100',
  level: 0,
  xp: 0,
  followers: [],
  isAdmin: false,
  chatWarnings: 0,
  chatDisabled: false,
  termsFlagged: false
};

const ADMIN_EMAIL = 'jhuxf12@outlook.com';

const getUserRef = (uid: string) => doc(db, 'users', uid);

const buildUserDocument = (user: User, extras: { balance: number; inventory: InventoryItem[] }) => {
  const payload: Record<string, unknown> = { ...user, ...extras };

  if (payload.shippingAddress === undefined) {
    delete payload.shippingAddress;
  }

  return payload;
};

const loadUserFromFirestore = async (firebaseUser: FirebaseUser) => {
  const userRef = getUserRef(firebaseUser.uid);
  const snapshot = await getDoc(userRef);

  if (!snapshot.exists()) {
    const initialProgress = calculateLevelProgress(0);
    const newUser: User = {
      id: firebaseUser.uid,
      name: firebaseUser.email?.split('@')[0] || 'Player',
      email: firebaseUser.email || '',
      avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(firebaseUser.email || 'Player')}&background=111827&color=10b981`,
      level: initialProgress.level,
      xp: 0,
      followers: [],
      shippingAddress: undefined,
      isAdmin: false,
      chatWarnings: 0,
      chatDisabled: false,
      termsFlagged: false
    };

    await setDoc(userRef, buildUserDocument(newUser, { balance: 0, inventory: [] }));

    return { user: newUser, balance: 0, inventory: [] as InventoryItem[] };
  }

  const data = snapshot.data();
  const xp = Number(data.xp ?? 0);
  const progress = calculateLevelProgress(xp);
  const followerIds = Array.isArray(data.followers)
    ? data.followers
    : Array.isArray(data.friends)
      ? data.friends
      : [];
  const profile: User = {
    id: firebaseUser.uid,
    name: data.name || firebaseUser.email?.split('@')[0] || 'Player',
    email: data.email || firebaseUser.email || '',
    avatar: data.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(firebaseUser.email || 'Player')}&background=111827&color=10b981`,
    level: data.level ?? progress.level,
    xp,
    followers: followerIds,
    shippingAddress: data.shippingAddress,
    isAdmin: data.isAdmin ?? false,
    chatWarnings: data.chatWarnings ?? 0,
    chatDisabled: data.chatDisabled ?? false,
    chatDisabledAt: data.chatDisabledAt,
    termsFlagged: data.termsFlagged ?? false
  };

  const shouldBeAdmin = profile.email?.toLowerCase() === ADMIN_EMAIL;
  const updates: Record<string, unknown> = {};

  if (shouldBeAdmin && !profile.isAdmin) {
    profile.isAdmin = true;
    updates.isAdmin = true;
  }

  if (profile.level !== data.level) {
    updates.level = profile.level;
  }

  if (profile.chatWarnings !== data.chatWarnings) {
    updates.chatWarnings = profile.chatWarnings;
  }

  if (profile.chatDisabled !== data.chatDisabled) {
    updates.chatDisabled = profile.chatDisabled;
  }

  if (profile.termsFlagged !== data.termsFlagged) {
    updates.termsFlagged = profile.termsFlagged;
  }

  if (Object.keys(updates).length > 0) {
    await setDoc(userRef, updates, { merge: true });
  }

  return {
    user: profile,
    balance: data.balance ?? 0,
    inventory: Array.isArray(data.inventory) ? (data.inventory as InventoryItem[]) : []
  };
};

const persistUserData = async (payload: PersistUserData) => {
  const currentUser = auth.currentUser;
  if (!currentUser) return;
  const userRef = getUserRef(currentUser.uid);
  await setDoc(userRef, payload, { merge: true });
};

export const GameProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showTopUpModal, setShowTopUpModal] = useState(false);
  
  // -- PERSISTENT STATE INITIALIZATION --
  
  // 1. Initialize User State
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [user, setUser] = useState<User>(GUEST_USER);
  const [users, setUsers] = useState<User[]>([]);
  const [balance, setBalance] = useState<number>(0);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  
  const [view, setView] = useState<ViewState>({ type: 'HOME' });
  
  // Initialize Items
  const [items, setItems] = useState<CaseItem[]>(() => {
      return safeReadLocalStorage<CaseItem[]>(STORAGE_KEY_ITEMS, CASE_ITEMS);
  });
  
  // 2. Initialize Boxes
  const [boxes, setBoxes] = useState<MysteryBox[]>([]);
  const upsertAdminBox = (box: MysteryBox) => {
    setBoxes(prev => {
      const userCreated = prev.filter(b => b.isUserCreated);
      const adminBoxes = prev.filter(b => !b.isUserCreated);
      const filtered = adminBoxes.filter(b => b.id !== box.id);
      const nextAdminBoxes = [...filtered, { ...box, isUserCreated: box.isUserCreated ?? false }].sort((a, b) => a.price - b.price);
      return [...userCreated, ...nextAdminBoxes];
    });
  };

  const removeAdminBox = (boxId: string) => {
    setBoxes(prev => {
      const userCreated = prev.filter(b => b.isUserCreated);
      const adminBoxes = prev.filter(b => !b.isUserCreated && b.id !== boxId);
      return [...userCreated, ...adminBoxes];
    });
  };

  const [battles, setBattles] = useState<Battle[]>([]);

  // -- FIREBASE SYNC --
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        setIsAuthenticated(false);
        setUser(GUEST_USER);
        setBalance(0);
        setInventory([]);
        return;
      }

      setIsAuthenticated(true);
      try {
        const profile = await loadUserFromFirestore(firebaseUser);
        setUser(profile.user);
        setBalance(profile.balance);
        setInventory(profile.inventory);
      } catch (error) {
        console.error('Failed to load user from Firebase', error);
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const usersRef = collection(db, 'users');
    const unsubscribe = onSnapshot(usersRef, (snapshot) => {
      const loaded: User[] = snapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        const xp = Number(data.xp ?? 0);
        const progress = calculateLevelProgress(xp);
        const followerIds = Array.isArray(data.followers)
          ? data.followers
          : Array.isArray(data.friends)
            ? data.friends
            : [];
        return {
          id: docSnap.id,
          name: data.name || 'Player',
          email: data.email,
          avatar: data.avatar || 'https://picsum.photos/id/64/100/100',
          level: data.level ?? progress.level,
          xp,
          followers: followerIds,
          shippingAddress: data.shippingAddress,
          isAdmin: data.isAdmin ?? false,
          chatWarnings: data.chatWarnings ?? 0,
          chatDisabled: data.chatDisabled ?? false,
          chatDisabledAt: data.chatDisabledAt,
          termsFlagged: data.termsFlagged ?? false
        } as User;
      });
      setUsers(loaded);
    }, (error) => {
      console.error('Failed to load users from Firebase', error);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const itemsRef = collection(db, 'items');
    const unsubscribe = onSnapshot(itemsRef, (snapshot) => {
      const loaded: CaseItem[] = snapshot.docs
        .map((docSnap, index) => {
          const data = docSnap.data();
          const rarity = (data.rarity ?? 'common') as CaseItem['rarity'];

          return {
            id: docSnap.id || `item-${index}`,
            name: data.name ?? 'Mystery Item',
            price: Number(data.price ?? 0),
            image: data.image ?? 'https://picsum.photos/200',
            rarity,
            chance: Number(data.chance ?? 0),
            color: data.color ?? '#9ca3af'
          } as CaseItem;
        })
        .sort((a, b) => a.price - b.price);

      setItems(loaded.length ? loaded : CASE_ITEMS);
    }, (error) => {
      console.error('Failed to load items from Firebase', error);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const boxesRef = collection(db, 'boxes');
    const unsubscribe = onSnapshot(boxesRef, (snapshot) => {
      const firebaseBoxes = snapshot.docs
        .map((docSnap) => {
          const data = docSnap.data();
          const items = Array.isArray(data.items) ? data.items.map((item: any, index: number) => {
            const rarity = (item.rarity ?? 'common') as CaseItem['rarity'];
            return {
              id: item.id ?? `${docSnap.id}-item-${index}`,
              name: item.name ?? 'Mystery Item',
              price: Number(item.price ?? 0),
              image: item.image ?? 'https://picsum.photos/300',
              rarity,
              chance: Number(item.chance ?? 0),
              color: item.color ?? '#9ca3af'
            };
          }) : [];

          return {
            id: docSnap.id,
            name: data.name ?? 'Mystery Box',
            price: Number(data.price ?? 0),
            image: data.image ?? 'https://picsum.photos/300',
            accentColor: data.accentColor ?? '#3b82f6',
            tag: data.tag as MysteryBox['tag'],
            isDaily: data.isDaily ?? false,
            items
          } as MysteryBox;
        })
        .sort((a, b) => a.price - b.price);

      setBoxes(prev => {
        const userCreated = prev.filter(b => b.isUserCreated);
        return [...userCreated, ...firebaseBoxes];
      });
    }, (error) => {
      console.error('Failed to load boxes from Firebase', error);
    });

    return () => unsubscribe();
  }, []);

  // -- PERSISTENCE EFFECTS (LOCAL STORAGE FALLBACK / SYNC) --

  // Save Items whenever they change
  useEffect(() => {
      safeWriteLocalStorage(STORAGE_KEY_ITEMS, items);
  }, [items]);

  // Battles Simulation Logic (Mocked Realtime)
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      
      setBattles(currentBattles => {
        let hasChanges = false;
        const updatedBattles = currentBattles.map(battle => {
          if (battle.status === 'waiting' && (now - battle.createdAt > 60000)) {
             const needed = battle.maxPlayers - battle.playerCount;
             if (needed > 0) {
                 const newPlayers = [...battle.players];
                 for(let i = 0; i < needed; i++) {
                     const botId = Math.floor(Math.random() * 10000);
                     newPlayers.push({
                         id: `bot-${battle.id}-${botId}`,
                         name: `BotUser${botId}`,
                         avatar: `https://picsum.photos/seed/${botId}/100/100`,
                         level: Math.floor(Math.random() * 50) + 1,
                         xp: Math.floor(Math.random() * 5000),
                         totalWin: 0,
                         isBot: true
                     });
                 }
                 hasChanges = true;
                 return {
                     ...battle,
                     players: newPlayers,
                     playerCount: battle.maxPlayers,
                     status: 'active' as const
                 };
             }
          }
          return battle;
        });
        return hasChanges ? updatedBattles : currentBattles;
      });

    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // --- ACTIONS ---

  const login = async (email: string, pass: string) => {
      await signInWithEmailAndPassword(auth, email, pass);
      setShowLoginModal(false);
  };

  const register = async (name: string, email: string, pass: string) => {
      const credential = await createUserWithEmailAndPassword(auth, email, pass);
      const newUser: User = {
          id: credential.user.uid,
          name,
          email,
          avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=111827&color=10b981`,
          level: 1,
          xp: 0,
          followers: [],
          shippingAddress: undefined,
          isAdmin: email.toLowerCase() === ADMIN_EMAIL,
          chatWarnings: 0,
          chatDisabled: false,
          termsFlagged: false
      };

      await setDoc(doc(db, 'users', newUser.id), buildUserDocument(newUser, { balance: 0, inventory: [] }));

      setUser(newUser);
      setBalance(0);
      setInventory([]);
      setIsAuthenticated(true);
      setShowLoginModal(false);
  };

  const logout = () => {
      signOut(auth);
      setIsAuthenticated(false);
      setUser(GUEST_USER);
      setBalance(0);
      setInventory([]);
      setView({ type: 'HOME' });
  };

  const addBalance = async (amount: number) => {
    setBalance(prev => {
      const updated = prev + amount;
      persistUserData({ balance: updated });
      return updated;
    }); 
  };

  const deductBalance = (amount: number): boolean => {
    if (balance >= amount) {
      setBalance(prev => {
        const updated = prev - amount;
        persistUserData({ balance: updated });
        return updated;
      });
      if (isAuthenticated) {
          setUser(prev => {
            const nextXp = Math.max(0, prev.xp + Math.floor(amount));
            const progress = calculateLevelProgress(nextXp);
            persistUserData({ xp: nextXp, level: progress.level });
            return { ...prev, xp: nextXp, level: progress.level };
          });
      }
      return true;
    }
    return false;
  };

  const addToInventory = async (item: CaseItem) => {
    const newItem: InventoryItem = {
      ...item,
      instanceId: Math.random().toString(36).substr(2, 9),
      obtainedAt: Date.now(),
      status: 'available'
    };
    setInventory(prev => {
      const updated = [newItem, ...prev];
      persistUserData({ inventory: updated });
      return updated;
    });
  };

  const followUser = async (targetUserId: string) => {
    if (!isAuthenticated) {
      setShowLoginModal(true);
      return;
    }

    if (targetUserId === user.id) return;

    const targetUser = users.find((u) => u.id === targetUserId);
    if (!targetUser) {
      console.warn('Attempted to follow unknown user');
      return;
    }

    const targetFollowers = Array.isArray(targetUser.followers)
      ? targetUser.followers
      : Array.isArray(targetUser.friends)
        ? targetUser.friends
        : [];
    if (targetFollowers.includes(user.id)) return;

    const updatedTarget = [...targetFollowers, user.id];

    try {
      await setDoc(getUserRef(targetUserId), { followers: updatedTarget }, { merge: true });
    } catch (error) {
      console.error('Failed to update followers in Firebase', error);
    }

    setUsers((prev) =>
      prev.map((u) => {
        if (u.id === targetUserId) return { ...u, followers: updatedTarget };
        return u;
      })
    );
  };

  const unfollowUser = async (targetUserId: string) => {
    if (!isAuthenticated) {
      setShowLoginModal(true);
      return;
    }

    if (targetUserId === user.id) return;

    const targetUser = users.find((u) => u.id === targetUserId);
    if (!targetUser) {
      console.warn('Attempted to unfollow unknown user');
      return;
    }

    const targetFollowers = Array.isArray(targetUser.followers)
      ? targetUser.followers
      : Array.isArray(targetUser.friends)
        ? targetUser.friends
        : [];
    if (!targetFollowers.includes(user.id)) return;

    const updatedTarget = targetFollowers.filter((id) => id !== user.id);

    try {
      await setDoc(getUserRef(targetUserId), { followers: updatedTarget }, { merge: true });
    } catch (error) {
      console.error('Failed to update followers in Firebase', error);
    }

    setUsers((prev) =>
      prev.map((u) => {
        if (u.id === targetUserId) return { ...u, followers: updatedTarget };
        return u;
      })
    );
  };

  const sellItem = async (instanceId: string, value: number) => {
    const itemToSell = inventory.find(i => i.instanceId === instanceId);
    if (!itemToSell) return;
    setInventory(prev => {
      const updated = prev.filter(item => item.instanceId !== instanceId);
      persistUserData({ inventory: updated });
      return updated;
    });
    addBalance(value);
  };

  const shipItem = async (instanceId: string) => {
    setInventory(prev => {
      const updated = prev.map(item => 
        item.instanceId === instanceId 
        ? { ...item, status: 'shipping' }
        : item
      );
      persistUserData({ inventory: updated });
      return updated;
    });
  };

  const updateAddress = async (address: ShippingAddress) => {
      setUser(prev => {
        const updated = { ...prev, shippingAddress: address };
        persistUserData({ shippingAddress: address });
        return updated;
      });
  };

  const updateUserInfo = async (name: string, avatar: string) => {
      setUser(prev => {
        const updated = { ...prev, name, avatar };
        persistUserData({ name, avatar });
        return updated;
      });
  };

  const updateUserFlags = async (updates: Partial<User>) => {
      if (!isAuthenticated || !auth.currentUser) return;
      const sanitizedUpdates = sanitizeData(updates);

      try {
          await setDoc(getUserRef(auth.currentUser.uid), sanitizedUpdates, { merge: true });
      } catch (error) {
          console.error('Failed to update user flags in Firebase', error);
      }

      setUser(prev => ({ ...prev, ...updates }));
      setUsers(prev => prev.map(u => u.id === auth.currentUser?.uid ? { ...u, ...updates } : u));
  };

  const createBattle = (boxIds: string[], maxPlayers: number) => {
    if (!isAuthenticated) {
        setShowLoginModal(true);
        return;
    }

    const selectedCases = boxIds.map(id => boxes.find(b => b.id === id)).filter(b => b !== undefined) as MysteryBox[];
    const cost = selectedCases.reduce((sum, b) => sum + b.price, 0);

    if (selectedCases.length === 0) {
        alert("Please select at least one box");
        return;
    }

    if (!deductBalance(cost)) {
      alert("Insufficient funds to create battle!");
      return;
    }
    
    const newBattle: Battle = {
      id: Math.random().toString(36).substr(2, 9),
      mode: 'Normal',
      players: [{ ...user, totalWin: 0 }],
      playerCount: 1,
      maxPlayers,
      cost,
      cases: selectedCases,
      rounds: selectedCases.length,
      currentRound: 0,
      status: 'waiting',
      history: [],
      createdAt: Date.now()
    };
    
    setBattles(prev => [newBattle, ...prev]);
    setView({ type: 'BATTLE_ARENA', battleId: newBattle.id });
  };

  const joinBattle = (battleId: string) => {
    if (!isAuthenticated) {
        setShowLoginModal(true);
        return;
    }
    const battle = battles.find(b => b.id === battleId);
    if (!battle) return;
    if (battle.players.some(p => p.id === user.id)) {
      setView({ type: 'BATTLE_ARENA', battleId });
      return;
    }
    if (battle.playerCount >= battle.maxPlayers) {
      alert("Battle is full!");
      return;
    }
    if (!deductBalance(battle.cost)) {
      alert("Insufficient funds to join battle!");
      return;
    }
    setBattles(prev => prev.map(b => {
      if (b.id === battleId) {
        return {
          ...b,
          players: [...b.players, { ...user, totalWin: 0 }],
          playerCount: b.playerCount + 1,
          status: (b.playerCount + 1 === b.maxPlayers ? 'active' : 'waiting') as 'waiting' | 'active' | 'finished'
        };
      }
      return b;
    }));
    setView({ type: 'BATTLE_ARENA', battleId });
  };

  const updateBattle = (updatedBattle: Battle) => {
    setBattles(prev => prev.map(b => b.id === updatedBattle.id ? updatedBattle : b));
  };

  const createItem = async (item: CaseItem) => {
      const { id, ...itemDataRaw } = item;
      const itemData = sanitizeData(itemDataRaw);
      let itemId = id;

      try {
          if (id) {
              await setDoc(doc(db, 'items', id), itemData, { merge: true });
              itemId = id;
          } else {
              const docRef = await addDoc(collection(db, 'items'), itemData);
              itemId = docRef.id;
          }
      } catch (error) {
          console.error('Failed to save item to Firebase', error);
          itemId = itemId || `local-item-${Date.now()}`;
      }

      setItems(prev => {
          const filtered = prev.filter(existing => existing.id !== itemId);
          return [...filtered, { ...itemData, id: itemId }];
      });
  };

  const updateItem = async (updatedItem: CaseItem) => {
      const { id, ...itemDataRaw } = updatedItem;
      if (!id) {
          console.warn('Attempted to update an item without an id');
          return;
      }

      const itemData = sanitizeData(itemDataRaw);

      try {
          await setDoc(doc(db, 'items', id), itemData, { merge: true });
      } catch (error) {
          console.error('Failed to update item in Firebase', error);
      }

      setItems(prev => prev.map(i => i.id === id ? { ...itemData, id } : i));
  };

  const deleteItem = async (itemId: string) => {
      try {
          await deleteDoc(doc(db, 'items', itemId));
      } catch (error) {
          console.error('Failed to delete item from Firebase', error);
      }

      setItems(prev => prev.filter(i => i.id !== itemId));
  };

  const createBox = async (box: MysteryBox) => {
      const { id, ...boxDataRaw } = box;
      const boxData = sanitizeData(boxDataRaw);
      let boxId = id;

      try {
          if (id) {
              await setDoc(doc(db, 'boxes', id), boxData, { merge: true });
              boxId = id;
          } else {
              const docRef = await addDoc(collection(db, 'boxes'), boxData);
              boxId = docRef.id;
          }
      } catch (error) {
          console.error('Failed to save box to Firebase', error);
          boxId = boxId || `local-box-${Date.now()}`;
      }

      upsertAdminBox({ ...boxData, id: boxId });
  };

  const createUserBox = async (box: MysteryBox) => {
      const userBox = { ...box, isUserCreated: true };
      setBoxes(prev => [...prev, userBox]);
  };

  const updateBox = async (updatedBox: MysteryBox) => {
      const { id, ...boxDataRaw } = updatedBox;
      if (!id) {
          console.warn('Attempted to update a box without an id');
          return;
      }

      const boxData = sanitizeData(boxDataRaw);

      try {
          await setDoc(doc(db, 'boxes', id), boxData, { merge: true });
      } catch (error) {
          console.error('Failed to update box in Firebase', error);
      }

      upsertAdminBox({ ...boxData, id });
  };

  const deleteBox = async (boxId: string) => {
      try {
          await deleteDoc(doc(db, 'boxes', boxId));
      } catch (error) {
          console.error('Failed to delete box from Firebase', error);
      }

      removeAdminBox(boxId);
  };

  const claimDaily = async () => {
    const timestamp = Date.now();
    setUser(prev => ({ ...prev, lastDailyClaim: timestamp }));
    persistUserData({ lastDailyClaim: timestamp });
  };

  const updateUserProgress = async (userId: string, xp: number) => {
    const numericXp = Number.isFinite(xp) ? xp : 0;
    const sanitizedXp = Math.max(0, Math.floor(numericXp));
    const progress = calculateLevelProgress(sanitizedXp);
    try {
      await setDoc(getUserRef(userId), { xp: sanitizedXp, level: progress.level }, { merge: true });
    } catch (error) {
      console.error('Failed to update user progress in Firebase', error);
    }

    setUsers(prev => prev.map(u => u.id === userId ? { ...u, xp: sanitizedXp, level: progress.level } : u));
    setUser(prev => prev.id === userId ? { ...prev, xp: sanitizedXp, level: progress.level } : prev);
  };

  return (
    <GameContext.Provider value={{
      user,
      isAuthenticated,
      users,
      showLoginModal,
      showTopUpModal,
      balance,
      inventory,
      view,
      battles,
      boxes,
      items,
      login,
      register,
      logout,
      setShowLoginModal,
      setShowTopUpModal,
      setView,
      addBalance,
      deductBalance,
      addToInventory,
      followUser,
      unfollowUser,
      sellItem,
      shipItem,
      updateAddress,
      updateUserInfo,
      updateUserFlags,
      createBattle,
      joinBattle,
      updateBattle,
      createItem,
      updateItem,
      deleteItem,
      createBox,
      createUserBox,
      updateBox,
      deleteBox,
      claimDaily,
      updateUserProgress
    }}>
      {children}
    </GameContext.Provider>
  );
};

export const useGame = () => {
  const context = useContext(GameContext);
  if (!context) {
    throw new Error('useGame must be used within a GameProvider');
  }
  return context;
};
