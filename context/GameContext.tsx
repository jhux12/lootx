import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, InventoryItem, CaseItem, ViewState, Battle, MysteryBox, ShippingAddress } from '../types';
import { BATTLES as INITIAL_BATTLES, MYSTERY_BOXES, CASE_ITEMS, MOCK_USERS } from '../constants';
import { auth, db } from '../firebase';
// Firebase imports removed due to environment issues
// Local Storage Mock Mode enabled

// Storage Keys (Fallback)
const STORAGE_KEY_DB = 'lootx_users_db';
const STORAGE_KEY_SESSION = 'lootx_session_user';
const STORAGE_KEY_BOXES = 'lootx_boxes';
const STORAGE_KEY_ITEMS = 'lootx_items'; // New key for items

interface GameContextType {
  user: User;
  isAuthenticated: boolean;
  balance: number;
  inventory: InventoryItem[];
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
  sellItem: (instanceId: string, value: number) => void;
  shipItem: (instanceId: string) => void;
  updateAddress: (address: ShippingAddress) => void;
  updateUserInfo: (name: string, avatar: string) => Promise<void>;
  createBattle: (boxIds: string[], maxPlayers: number) => void;
  joinBattle: (battleId: string) => void;
  updateBattle: (updatedBattle: Battle) => void;
  createItem: (item: CaseItem) => void;
  updateItem: (item: CaseItem) => void;
  deleteItem: (itemId: string) => void;
  createBox: (box: MysteryBox) => void; // Admin
  createUserBox: (box: MysteryBox) => void; // User Custom
  updateBox: (box: MysteryBox) => void;
  deleteBox: (boxId: string) => Promise<void>;
  claimDaily: () => void;
}

const GameContext = createContext<GameContextType | undefined>(undefined);

// Guest / Loading User
const GUEST_USER: User = {
  id: 'guest',
  name: 'Guest',
  avatar: 'https://picsum.photos/id/64/100/100',
  level: 0,
  xp: 0,
  isAdmin: false
};

export const GameProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showTopUpModal, setShowTopUpModal] = useState(false);
  
  // -- PERSISTENT STATE INITIALIZATION --
  
  // 1. Initialize User State
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
      // Check localStorage as fallback or initial state
      return !!localStorage.getItem(STORAGE_KEY_SESSION);
  });

  const [user, setUser] = useState<User>(() => {
      const sessionEmail = localStorage.getItem(STORAGE_KEY_SESSION);
      if(sessionEmail) {
          const dbLocal = JSON.parse(localStorage.getItem(STORAGE_KEY_DB) || '{}');
          if (dbLocal[sessionEmail]?.user) return dbLocal[sessionEmail].user;
      }
      return GUEST_USER;
  });

  const [balance, setBalance] = useState<number>(() => {
      const sessionEmail = localStorage.getItem(STORAGE_KEY_SESSION);
      if(sessionEmail) {
          const dbLocal = JSON.parse(localStorage.getItem(STORAGE_KEY_DB) || '{}');
          if (dbLocal[sessionEmail]?.balance !== undefined) return dbLocal[sessionEmail].balance;
      }
      return 0;
  });

  const [inventory, setInventory] = useState<InventoryItem[]>(() => {
      const sessionEmail = localStorage.getItem(STORAGE_KEY_SESSION);
      if(sessionEmail) {
          const dbLocal = JSON.parse(localStorage.getItem(STORAGE_KEY_DB) || '{}');
          if (dbLocal[sessionEmail]?.inventory) return dbLocal[sessionEmail].inventory;
      }
      return [];
  });
  
  const [view, setView] = useState<ViewState>({ type: 'HOME' });
  
  // Initialize Items
  const [items, setItems] = useState<CaseItem[]>(() => {
      const storedItems = localStorage.getItem(STORAGE_KEY_ITEMS);
      if (storedItems) {
          return JSON.parse(storedItems);
      }
      return CASE_ITEMS;
  });
  
  // 2. Initialize Boxes
  const [boxes, setBoxes] = useState<MysteryBox[]>(() => {
      const storedBoxes = localStorage.getItem(STORAGE_KEY_BOXES);
      if (storedBoxes) {
          return JSON.parse(storedBoxes);
      }
      return MYSTERY_BOXES.sort((a,b) => a.price - b.price);
  });

  const [battles, setBattles] = useState<Battle[]>(INITIAL_BATTLES);

  // -- FIREBASE SYNC (DISABLED) --
  useEffect(() => {
     // Firebase sync disabled
  }, []);

  // -- PERSISTENCE EFFECTS (LOCAL STORAGE FALLBACK / SYNC) --

  // Save User Data whenever it changes
  useEffect(() => {
    // 1. Save to Local Storage (Always, as backup)
    if (isAuthenticated && user.email) {
      const dbLocal = JSON.parse(localStorage.getItem(STORAGE_KEY_DB) || '{}');
      dbLocal[user.email] = {
        user,
        balance,
        inventory
      };
      localStorage.setItem(STORAGE_KEY_DB, JSON.stringify(dbLocal));
      localStorage.setItem(STORAGE_KEY_SESSION, user.email);
    }
  }, [user, balance, inventory, isAuthenticated]);

  // Save Boxes whenever they change
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_BOXES, JSON.stringify(boxes));
  }, [boxes]);

  // Save Items whenever they change
  useEffect(() => {
      localStorage.setItem(STORAGE_KEY_ITEMS, JSON.stringify(items));
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
      // 1. Simulate Admin Authentication via "Admin SDK"
      if (email === 'admin@lootx.com' && pass === 'admin') {
          await new Promise(resolve => setTimeout(resolve, 800)); // Simulate verifying with secure server
          const adminUser: User = {
              id: 'admin-master',
              name: 'System Admin',
              email: 'admin@lootx.com',
              avatar: 'https://ui-avatars.com/api/?name=System+Admin&background=ef4444&color=fff&bold=true',
              level: 100,
              xp: 0,
              isAdmin: true
          };
          setUser(adminUser);
          setBalance(1000000); // Admin Budget
          setInventory([]);
          setIsAuthenticated(true);
          setShowLoginModal(false);
          return;
      }

      // 2. Standard Fallback: Local Storage Login
      await new Promise(resolve => setTimeout(resolve, 500));
      const dbLocal = JSON.parse(localStorage.getItem(STORAGE_KEY_DB) || '{}');
      const userData = dbLocal[email];

      if (userData) {
          setUser(userData.user);
          setBalance(userData.balance);
          setInventory(userData.inventory || []);
      } else {
          // New "Mock" User
          const mockUser = { ...MOCK_USERS[0] };
          const newUser = {
              ...mockUser,
              id: `user-${Date.now()}`,
              email,
              name: email.split('@')[0], 
              shippingAddress: undefined,
              isAdmin: false
          };
          setUser(newUser);
          setBalance(1500); 
          setInventory([]);
      }
      setIsAuthenticated(true);
      setShowLoginModal(false);
  };

  const register = async (name: string, email: string, pass: string) => {
      // 2. Fallback: Local Storage Register
      await new Promise(resolve => setTimeout(resolve, 500));
      const dbLocal = JSON.parse(localStorage.getItem(STORAGE_KEY_DB) || '{}');
      if (dbLocal[email]) {
          throw new Error("User already exists");
      }

      const newUser: User = {
          id: `user-${Date.now()}`,
          name,
          email,
          avatar: `https://picsum.photos/seed/${Date.now()}/100/100`,
          level: 1,
          xp: 0,
          shippingAddress: undefined,
          isAdmin: false
      };

      setUser(newUser);
      setBalance(500);
      setInventory([]);
      setIsAuthenticated(true);
      setShowLoginModal(false);
  };

  const logout = () => {
      localStorage.removeItem(STORAGE_KEY_SESSION);
      setIsAuthenticated(false);
      setUser(GUEST_USER);
      setBalance(0);
      setInventory([]);
      setView({ type: 'HOME' });
  };

  const addBalance = async (amount: number) => {
    setBalance(prev => prev + amount); 
  };

  const deductBalance = (amount: number): boolean => {
    if (balance >= amount) {
      setBalance(prev => prev - amount);
      if (isAuthenticated) {
          setUser(prev => ({ ...prev, xp: prev.xp + Math.floor(amount) }));
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
    setInventory(prev => [newItem, ...prev]);
  };

  const sellItem = async (instanceId: string, value: number) => {
    const itemToSell = inventory.find(i => i.instanceId === instanceId);
    if (!itemToSell) return;
    setInventory(prev => prev.filter(item => item.instanceId !== instanceId));
    addBalance(value);
  };

  const shipItem = async (instanceId: string) => {
    setInventory(prev => prev.map(item => 
        item.instanceId === instanceId 
        ? { ...item, status: 'shipping' }
        : item
    ));
  };

  const updateAddress = async (address: ShippingAddress) => {
      setUser(prev => ({ ...prev, shippingAddress: address }));
  };

  const updateUserInfo = async (name: string, avatar: string) => {
      setUser(prev => ({ ...prev, name, avatar }));
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

  const createItem = (item: CaseItem) => {
      setItems(prev => [...prev, item]);
  };

  const updateItem = (updatedItem: CaseItem) => {
      setItems(prev => prev.map(i => i.id === updatedItem.id ? updatedItem : i));
  };

  const deleteItem = (itemId: string) => {
      setItems(prev => prev.filter(i => i.id !== itemId));
  };

  const createBox = async (box: MysteryBox) => {
      const { id, ...boxData } = box;
      const newBox = { ...boxData, id: id || `box-${Date.now()}` } as MysteryBox;
      setBoxes(prev => [...prev, newBox]);
  };

  const createUserBox = async (box: MysteryBox) => {
      const userBox = { ...box, isUserCreated: true };
      setBoxes(prev => [...prev, userBox]);
  };

  const updateBox = async (updatedBox: MysteryBox) => {
      setBoxes(prev => prev.map(b => b.id === updatedBox.id ? updatedBox : b));
  };

  const deleteBox = async (boxId: string) => {
      setBoxes(prev => prev.filter(b => b.id !== boxId));
  };

  const claimDaily = async () => {
    setUser(prev => ({ ...prev, lastDailyClaim: Date.now() }));
  };

  return (
    <GameContext.Provider value={{
      user,
      isAuthenticated,
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
      sellItem,
      shipItem,
      updateAddress,
      updateUserInfo,
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
      claimDaily
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