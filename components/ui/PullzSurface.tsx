import React from 'react';

type PullzSurfaceVariant = 'base' | 'card' | 'elevated' | 'featured';

const variantClasses: Record<PullzSurfaceVariant, string> = {
  base: 'border-pullz-border-soft bg-pullz-surface shadow-pullz-sm',
  card: 'border-pullz-border-soft bg-pullz-card shadow-pullz-sm',
  elevated: 'border-pullz-border-strong bg-pullz-elevated shadow-pullz-md',
  featured: 'border-pullz-primary/30 bg-pullz-card shadow-pullz-lg'
};

export type PullzSurfaceProps = React.HTMLAttributes<HTMLDivElement> & {
  variant?: PullzSurfaceVariant;
};

export const PullzSurface = React.forwardRef<HTMLDivElement, PullzSurfaceProps>(
  ({ variant = 'card', className = '', ...props }, ref) => (
    <div
      ref={ref}
      className={`rounded-pullz-lg border ${variantClasses[variant]} ${className}`}
      {...props}
    />
  )
);

PullzSurface.displayName = 'PullzSurface';
