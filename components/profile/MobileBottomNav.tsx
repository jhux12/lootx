import React from 'react';
import { Gift, Package, PackageCheck, User, Gamepad2 } from 'lucide-react';

interface MobileBottomNavProps {
  activeTab: 'inventory' | 'orders' | 'account';
  onTabChange: (tab: 'inventory' | 'orders' | 'account') => void;
  onGames: () => void;
  onRewards: () => void;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({ activeTab, onTabChange, onGames, onRewards }) => {
  const tabClass = (tab: 'inventory' | 'orders' | 'account') => activeTab === tab ? 'text-white' : 'text-gray-500';

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-white/10 bg-[#2a323b]/95 p-2 backdrop-blur md:hidden">
      <div className="grid grid-cols-5 gap-1">
        <button className="flex flex-col items-center py-1 text-xs text-gray-400" onClick={onGames}><Gamepad2 className="h-4 w-4" />Games</button>
        <button className="flex flex-col items-center py-1 text-xs text-gray-400" onClick={onRewards}><Gift className="h-4 w-4" />Rewards</button>
        <button className={`flex flex-col items-center py-1 text-xs ${tabClass('inventory')}`} onClick={() => onTabChange('inventory')}><Package className="h-4 w-4" />Inventory</button>
        <button className={`flex flex-col items-center py-1 text-xs ${tabClass('orders')}`} onClick={() => onTabChange('orders')}><PackageCheck className="h-4 w-4" />Orders</button>
        <button className={`flex flex-col items-center py-1 text-xs ${tabClass('account')}`} onClick={() => onTabChange('account')}><User className="h-4 w-4" />Account</button>
      </div>
    </nav>
  );
};
