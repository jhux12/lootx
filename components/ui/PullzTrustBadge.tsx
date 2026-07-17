import React from 'react';
import { PullzSurface } from './PullzSurface';

export type PullzTrustBadgeProps = {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  title: string;
  body?: string;
  className?: string;
};

export const PullzTrustBadge: React.FC<PullzTrustBadgeProps> = ({
  icon: Icon,
  title,
  body,
  className = ''
}) => (
  <PullzSurface className={`flex items-center gap-3 p-4 ${className}`}>
    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-pullz-sm bg-pullz-primary-soft text-pullz-primary-hover">
      <Icon className="h-5 w-5" strokeWidth={2.2} />
    </span>
    <span>
      <span className="block text-sm font-semibold text-pullz-text">{title}</span>
      {body ? <span className="mt-0.5 block text-xs text-pullz-text-muted">{body}</span> : null}
    </span>
  </PullzSurface>
);
