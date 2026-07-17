import React from 'react';

const variants = {
  base: 'border-pullz-border-soft bg-pullz-surface shadow-pullz-sm',
  card: 'border-pullz-border-soft bg-pullz-card shadow-pullz-sm',
  elevated: 'border-pullz-border-strong bg-pullz-elevated shadow-pullz-md',
  featured: 'border-pullz-primary/30 bg-pullz-card shadow-pullz-lg'
} as const;

export type SurfaceProps = React.HTMLAttributes<HTMLDivElement> & { variant?: keyof typeof variants };
export const Surface = React.forwardRef<HTMLDivElement, SurfaceProps>(({ variant = 'card', className = '', ...props }, ref) => (
  <div ref={ref} className={`rounded-pullz-lg border ${variants[variant]} ${className}`} {...props} />
));
Surface.displayName = 'Surface';
