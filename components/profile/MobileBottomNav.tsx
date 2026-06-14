import React from 'react';
import { Archive, Gift, Home, Swords, User } from 'lucide-react';

interface MobileBottomNavProps {
  activeTab: 'inventory' | 'orders' | 'account';
  onTabChange: (tab: 'inventory' | 'orders' | 'account') => void;
  onGames: () => void;
  onRewards: () => void;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({ activeTab, onTabChange, onGames, onRewards }) => {
  const tabClass = (tab: 'inventory' | 'orders' | 'account') => activeTab === tab ? 'text-white' : 'text-gray-500';

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-white/10 bg-[#02040d]/95 p-2 backdrop-blur md:hidden">
      <div className="grid grid-cols-5 gap-1">
        <button className="flex flex-col items-center py-1 text-xs text-gray-400" onClick={onGames}><Home className="h-5 w-5" />Home</button>
        <button className="flex flex-col items-center py-1 text-xs text-gray-400" onClick={onGames}><Archive className="h-5 w-5" />Boxes</button>
        <button className="flex flex-col items-center py-1 text-xs text-gray-400" onClick={onGames}><Swords className="h-5 w-5" />Battles</button>
        <button className="flex flex-col items-center py-1 text-xs text-gray-400" onClick={onRewards}><Gift className="h-5 w-5" />Rewards</button>
        <button className={`flex flex-col items-center py-1 text-xs ${tabClass('account') === 'text-white' || tabClass('inventory') === 'text-white' ? 'text-purple-400' : 'text-gray-500'}`} onClick={() => onTabChange('inventory')}><User className="h-5 w-5" />Profile</button>
      </div>
    </nav>
  );
};
