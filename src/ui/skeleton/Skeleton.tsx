import React from 'react';
import './skeleton.css';

export const SkeletonText: React.FC<{ className?: string }> = ({ className }) => (
  <div className={`pullz-skeleton h-3 rounded ${className ?? ''}`} />
);

export const SkeletonTile: React.FC<{ compact?: boolean; className?: string }> = ({ compact = false, className }) => (
  <div className={`rounded-xl border border-white/10 bg-[#121823] p-3 ${className ?? ''}`}>
    <div className={`pullz-skeleton mx-auto rounded-xl ${compact ? 'h-20 w-20' : 'h-28 w-28 sm:h-36 sm:w-36'}`} />
    <div className="mt-4 space-y-2">
      <SkeletonText className="h-3 w-3/4 mx-auto" />
      <SkeletonText className="h-3 w-1/2 mx-auto" />
    </div>
  </div>
);

export const SkeletonRow: React.FC = () => (
  <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-[#121823] p-3">
    <div className="pullz-skeleton h-12 w-12 rounded-lg" />
    <div className="flex-1 space-y-2">
      <SkeletonText className="w-2/3" />
      <SkeletonText className="w-1/3" />
    </div>
  </div>
);
