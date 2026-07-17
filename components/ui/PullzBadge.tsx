import React from 'react';

type PullzBadgeVariant = 'neutral' | 'primary' | 'success' | 'gold' | 'danger';

const variantClasses: Record<PullzBadgeVariant, string> = {
  neutral: 'border-pullz-border-strong bg-pullz-overlay text-pullz-text-secondary',
  primary: 'border-pullz-primary/30 bg-pullz-primary-soft text-pullz-primary-hover',
  success: 'border-pullz-success/30 bg-pullz-success-soft text-pullz-success',
  gold: 'border-pullz-gold/35 bg-pullz-gold-soft text-pullz-gold',
  danger: 'border-pullz-danger/30 bg-pullz-danger-soft text-pullz-danger'
};

export type PullzBadgeProps = React.HTMLAttributes<HTMLSpanElement> & {
  variant?: PullzBadgeVariant;
};

export const PullzBadge = React.forwardRef<HTMLSpanElement, PullzBadgeProps>(
  ({ variant = 'neutral', className = '', ...props }, ref) => (
    <span
      ref={ref}
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] ${variantClasses[variant]} ${className}`}
      {...props}
    />
  )
);

PullzBadge.displayName = 'PullzBadge';
