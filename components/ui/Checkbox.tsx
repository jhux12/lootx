import React from 'react';

export type CheckboxProps = React.InputHTMLAttributes<HTMLInputElement>;

export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, ...props }, ref) => {
    const baseClasses =
      'h-4 w-4 !rounded-[6px] border !border-white/20 !bg-[#0b101a] text-cyan-400 shadow-sm transition focus:outline-none focus:ring-2 focus:ring-cyan-400/40 hover:border-white/30 disabled:cursor-not-allowed disabled:opacity-50';

    return (
      <input
        ref={ref}
        type="checkbox"
        className={[baseClasses, className].filter(Boolean).join(' ')}
        {...props}
      />
    );
  }
);

Checkbox.displayName = 'Checkbox';
