import pullzTicketImage from './assets/pullz-p.PNG';
import { Battle, ChatMessage, LiveDrop, MysteryBox, CaseItem, User } from "./types";

export const XP_ICON = 'https://firebasestorage.googleapis.com/v0/b/hyperdrop-6476c.firebasestorage.app/o/WebIcons%2Fsd%20(27).png?alt=media&token=475e5bf6-136e-45ad-9c7f-7fcb88b9fa02';
export const COIN_ICON = 'https://firebasestorage.googleapis.com/v0/b/hyperdrop-6476c.firebasestorage.app/o/Untitled%20design%20(33).png?alt=media&token=11882c1a-5b30-4025-9056-46d4123c5381';

export const MOCK_USERS: User[] = [
  { id: '1', name: 'MarieJane', avatar: 'https://picsum.photos/id/64/100/100', level: 5, xp: 1250 },
  { id: '2', name: 'ZEUS', avatar: 'https://picsum.photos/id/65/100/100', level: 99, xp: 99999 },
  { id: '3', name: 'CryptoKing', avatar: 'https://picsum.photos/id/66/100/100', level: 24, xp: 8500 },
  { id: '4', name: 'LootMaster', avatar: 'https://picsum.photos/id/67/100/100', level: 12, xp: 3200 },
];

export const CHAT_MESSAGES: ChatMessage[] = [
  { id: '1', user: MOCK_USERS[0], message: 'Anybody home?', timestamp: '2s ago' },
  { id: '2', user: MOCK_USERS[0], message: 'still paying?', timestamp: '2s ago' },
  { id: '3', user: MOCK_USERS[0], message: 'hey i reported a bug the other day', timestamp: '25s ago' },
  { id: '4', user: MOCK_USERS[1], message: 'Yep, here I am', timestamp: '2s ago' },
  { id: '5', user: MOCK_USERS[1], message: '@queenlauralou devs are aware', timestamp: '2s ago' },
];

// Items available in the boxes (Shared pool for demo simplicity)
export const CASE_ITEMS: CaseItem[] = [
  { id: 'item-1', name: 'Gold Rolex', price: 15000, image: 'https://picsum.photos/id/175/300/300', rarity: 'legendary', chance: 0.1, color: '#fbbf24', tags: ['holiday', 'hot'] },
  { id: 'item-2', name: 'Gaming PC Ultra', price: 4500, image: 'https://picsum.photos/id/2/300/300', rarity: 'epic', chance: 0.5, color: '#205DD7', tags: ['tech', 'hot'] },
  { id: 'item-3', name: 'MacBook Pro', price: 2500, image: 'https://picsum.photos/id/0/300/300', rarity: 'epic', chance: 1.5, color: '#205DD7', tags: ['tech'] },
  { id: 'item-4', name: 'iPhone 15 Pro', price: 1200, image: 'https://picsum.photos/id/160/300/300', rarity: 'rare', chance: 5.0, color: '#3b82f6', tags: ['tech'] },
  { id: 'item-5', name: 'Jordan 1 High', price: 850, image: 'https://picsum.photos/id/21/300/300', rarity: 'rare', chance: 8.0, color: '#3b82f6', tags: ['holiday', 'hot'] },
  { id: 'item-6', name: 'Supreme Hoodie', price: 450, image: 'https://picsum.photos/id/99/300/300', rarity: 'uncommon', chance: 15.0, color: '#22c55e', tags: ['holiday'] },
  { id: 'item-7', name: 'Gaming Mouse', price: 80, image: 'https://picsum.photos/id/60/300/300', rarity: 'common', chance: 20.0, color: '#9ca3af', tags: ['digital', 'tech'] },
  { id: 'item-8', name: 'Keyboard', price: 120, image: 'https://picsum.photos/id/96/300/300', rarity: 'common', chance: 20.0, color: '#9ca3af', tags: ['digital', 'tech'] },
  { id: 'item-9', name: 'USB Cable', price: 15, image: 'https://picsum.photos/id/1/300/300', rarity: 'common', chance: 29.9, color: '#9ca3af', tags: ['digital'] },
];

export const MYSTERY_BOXES: MysteryBox[] = [
  { id: 'supreme', name: 'Box Supreme', price: 50.00, image: 'https://picsum.photos/id/175/300/300', accentColor: '#ef4444', tag: 'Hot', items: CASE_ITEMS, targetEV: 0.85, riskLevel: 50 },
  { id: 'tech', name: 'Tech Beast', price: 150.00, image: 'https://picsum.photos/id/2/300/300', accentColor: '#3b82f6', items: CASE_ITEMS, targetEV: 0.85, riskLevel: 50 },
  { id: 'sneaker', name: 'Sneakerhead', price: 95.00, image: 'https://picsum.photos/id/21/300/300', accentColor: '#22c55e', items: CASE_ITEMS, targetEV: 0.85, riskLevel: 50 },
  { id: 'watch', name: 'Timekeeper', price: 290.00, image: 'https://picsum.photos/id/180/300/300', accentColor: '#eab308', items: CASE_ITEMS, targetEV: 0.85, riskLevel: 50 },
];

export const GOLDEN_TICKET_ITEM: CaseItem = {
  id: 'golden-ticket',
  name: 'GOLDEN UPGRADE',
  price: 0,
  image: pullzTicketImage,
  rarity: 'legendary',
  chance: 0,
  color: '#fbbf24'
};

export const LIVE_DROPS: LiveDrop[] = [
  { id: '1', itemName: 'Yeezy Boost', itemImage: 'https://picsum.photos/id/21/50/50', value: 1500, user: MOCK_USERS[0], rarity: 'legendary' },
  { id: '2', itemName: 'Apple Watch', itemImage: 'https://picsum.photos/id/111/50/50', value: 0.5, user: MOCK_USERS[1], rarity: 'common' },
  { id: '3', itemName: 'Jordan 1', itemImage: 'https://picsum.photos/id/103/50/50', value: 1290, user: MOCK_USERS[2], rarity: 'rare' },
  { id: '4', itemName: 'Gaming PC', itemImage: 'https://picsum.photos/id/2/50/50', value: 5600, user: MOCK_USERS[3], rarity: 'rare' },
  { id: '5', itemName: 'Supreme Tee', itemImage: 'https://picsum.photos/id/99/50/50', value: 100, user: MOCK_USERS[0], rarity: 'uncommon' },
];

export const BATTLES: Battle[] = [
  { 
    id: '1', 
    mode: 'Normal', 
    players: [
      { ...MOCK_USERS[0], totalWin: 0 }, 
      { ...MOCK_USERS[1], totalWin: 0 }
    ], 
    playerCount: 2, 
    maxPlayers: 4, 
    cost: 150.00,
    cases: [MYSTERY_BOXES[0], MYSTERY_BOXES[0], MYSTERY_BOXES[0]],
    rounds: 3,
    currentRound: 0,
    status: 'active',
    history: [],
    createdAt: Date.now() - 100000 
  },
  { 
    id: '2', 
    mode: 'Inverse', 
    players: [
      { ...MOCK_USERS[2], totalWin: 0 }
    ], 
    playerCount: 1, 
    maxPlayers: 2, 
    cost: 285.00,
    cases: [MYSTERY_BOXES[2], MYSTERY_BOXES[2], MYSTERY_BOXES[2]],
    rounds: 3,
    currentRound: 0,
    status: 'waiting',
    history: [],
    createdAt: Date.now() 
  },
  { 
    id: '3', 
    mode: 'Terminal', 
    players: [
      { ...MOCK_USERS[3], totalWin: 0 }, 
      { ...MOCK_USERS[0], totalWin: 0 }
    ], 
    playerCount: 2, 
    maxPlayers: 3, 
    cost: 450.00, 
    cases: [MYSTERY_BOXES[1], MYSTERY_BOXES[1], MYSTERY_BOXES[1]],
    rounds: 3,
    currentRound: 0,
    status: 'active',
    history: [],
    createdAt: Date.now() - 200000
  },
];
