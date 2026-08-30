import React from 'react';
import { COIN_ICON } from '../constants';
import { AnimatedNumber } from '../src/ui/numbers/AnimatedNumber';

interface CoinAmountProps {
  amount: number;
  className?: string;
  iconClassName?: string;
  textClassName?: string;
  formatOptions?: Intl.NumberFormatOptions;
  formatter?: (value: number) => string;
  showSign?: boolean;
  animated?: boolean;
  /** Render dashes instead of a number, e.g. for a signed-out balance display. */
  placeholder?: boolean;
}

export const CoinAmount: React.FC<CoinAmountProps> = ({
  amount,
  className,
  iconClassName,
  textClassName,
  formatOptions,
  formatter,
  showSign = false,
  animated = true,
  placeholder = false
}) => {
  if (!placeholder && process.env.NODE_ENV !== 'production' && !Number.isInteger(amount)) {
    console.warn('[CoinAmount] Non-integer coin amount provided:', amount);
  }

  if (placeholder) {
    return (
      <span className={`inline-flex items-center gap-1 ${className ?? ''}`}>
        <img src={COIN_ICON} alt="Coin" className={`w-4 h-4 ${iconClassName ?? ''}`} loading="lazy" decoding="async" width={16} height={16} />
        <span className={textClassName} aria-label="Sign in to see your balance">
          &mdash;&mdash;
        </span>
      </span>
    );
  }

  const absoluteAmount = showSign ? Math.abs(amount) : amount;
  const formatValue = formatter ?? ((value: number) => value.toLocaleString(undefined, formatOptions ?? { maximumFractionDigits: 0 }));
  const sign = showSign ? (amount < 0 ? '-' : '+') : '';

  return (
    <span className={`inline-flex items-center gap-1 ${className ?? ''}`}>
      <img src={COIN_ICON} alt="Coin" className={`w-4 h-4 ${iconClassName ?? ''}`} loading="lazy" decoding="async" width={16} height={16} />
      <span className={textClassName}>
        {sign}
        {animated ? <AnimatedNumber value={absoluteAmount} format={formatValue} /> : formatValue(absoluteAmount)}
      </span>
    </span>
  );
};
