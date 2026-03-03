import React from 'react';
import { ActivityType } from '../../lib/activity/types';

export const ActivityBadge: React.FC<{ type: ActivityType }> = ({ type }) => {
  const label = type.toUpperCase();
  return <span className="rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-gray-300">{label}</span>;
};
