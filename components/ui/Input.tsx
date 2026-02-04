import React from 'react';
export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = 'text', ...props }, ref) => {
    const baseClasses =
      'w-full !rounded-[14px] border !border-white/10 !bg-[#0b101a] px-4 py-2.5 text-sm !text-white/90 shadow-sm transition placeholder:text-white/40 focus:border-white/30 focus:outline-none focus:ring-2 focus:ring-cyan-400/40 hover:border-white/20 disabled:cursor-not-allowed disabled:opacity-50 read-only:!text-white/60 read-only:!bg-white/5 read-only:!border-white/10';
    const rangeClasses =
      'h-2 w-full appearance-none rounded-full bg-white/10 accent-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-400/40';

    return (
      <input
        ref={ref}
        type={type}
        className={[type === 'range' ? rangeClasses : baseClasses, className]
          .filter(Boolean)
          .join(' ')}
        {...props}
      />
    );
  }
);

Input.displayName = 'Input';
