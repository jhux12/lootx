import React from 'react';

type PullzButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

const variantClasses: Record<PullzButtonVariant, string> = {
  primary:
    'border-pullz-primary bg-pullz-primary text-white shadow-pullz-primary hover:border-pullz-primary-hover hover:bg-pullz-primary-hover',
  secondary:
    'border-pullz-border-strong bg-pullz-elevated text-pullz-text hover:border-pullz-primary/35 hover:bg-pullz-overlay',
  ghost:
    'border-transparent bg-transparent text-pullz-text-secondary hover:bg-pullz-primary-soft hover:text-pullz-text',
  danger: 'border-pullz-danger bg-pullz-danger text-white hover:bg-pullz-danger/90'
};

export type PullzButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: PullzButtonVariant;
};

export const PullzButton = React.forwardRef<HTMLButtonElement, PullzButtonProps>(
  ({ variant = 'primary', className = '', type = 'button', ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-pullz-md border px-5 py-2.5 text-sm font-semibold transition duration-220 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pullz-primary focus-visible:ring-offset-2 focus-visible:ring-offset-pullz-canvas disabled:cursor-not-allowed disabled:opacity-60 ${variantClasses[variant]} ${className}`}
      {...props}
    />
  )
);

PullzButton.displayName = 'PullzButton';
