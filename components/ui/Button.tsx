import React from 'react';

const variants = {
  primary: 'border-pullz-primary bg-pullz-primary text-white shadow-pullz-primary hover:bg-pullz-primary-hover hover:border-pullz-primary-hover',
  secondary: 'border-pullz-border-strong bg-pullz-elevated text-pullz-text hover:border-pullz-primary/35 hover:bg-pullz-overlay',
  ghost: 'border-transparent bg-transparent text-pullz-text-secondary hover:bg-pullz-primary-soft hover:text-pullz-text',
  danger: 'border-pullz-danger bg-pullz-danger text-white hover:bg-pullz-danger/90'
} as const;

export type ButtonVariant = keyof typeof variants;
export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant };

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({ variant = 'primary', className = '', type = 'button', ...props }, ref) => (
  <button
    ref={ref}
    type={type}
    className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-pullz-md border px-5 py-2.5 text-sm font-semibold transition duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pullz-primary focus-visible:ring-offset-2 focus-visible:ring-offset-pullz-canvas disabled:cursor-not-allowed disabled:opacity-60 ${variants[variant]} ${className}`}
    {...props}
  />
));
Button.displayName = 'Button';
