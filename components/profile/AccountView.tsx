import React from 'react';
import { User } from '../../types';
import { AccountSidebar } from './AccountSidebar';

interface QuickAction {
  label: string;
  onClick: () => void;
  primary?: boolean;
  isNew?: boolean;
}

interface AccountViewProps {
  user: User;
  username: string;
  memberSince: string;
  xp: number;
  level: number;
  boxesOpened: number;
  totalValueUnboxed: number;
  quickActions: QuickAction[];
  recentActivity: string[];
}

export const AccountView: React.FC<AccountViewProps> = (props) => {
  return (
    <div className="md:hidden">
      <AccountSidebar {...props} />
      <div className="space-y-4">
        <section className="rounded-2xl border border-white/10 bg-[#101523] p-4 text-white">
          <p className="text-sm font-semibold">{props.username}</p>
          <p className="text-xs text-gray-400">Member since {props.memberSince}</p>
        </section>
        <section className="rounded-2xl border border-white/10 bg-[#101523] p-4">
          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <div><p className="text-gray-500">Level</p><p className="font-bold text-white">{props.level}</p></div>
            <div><p className="text-gray-500">Boxes</p><p className="font-bold text-white">{props.boxesOpened}</p></div>
            <div><p className="text-gray-500">Value</p><p className="font-bold text-white">{Math.round(props.totalValueUnboxed)}</p></div>
          </div>
        </section>
        <section className="rounded-2xl border border-white/10 bg-[#101523] p-4">
          <p className="mb-2 text-xs font-semibold uppercase text-gray-400">Quick Actions</p>
          <div className="space-y-2">
            {props.quickActions.map((action) => (
              <button key={action.label} onClick={action.onClick} className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-sm ${action.primary ? 'bg-gradient-to-r from-purple-600 to-violet-500 text-white' : 'border border-white/10 text-gray-200'}`}>
                <span>{action.label}</span>
                {action.isNew && <span className="rounded-full bg-purple-500 px-2 py-0.5 text-[10px] font-bold">NEW</span>}
              </button>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};
