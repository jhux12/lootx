import React from 'react';
import { COIN_ICON } from '../constants';

interface CoinAmountProps {
  amount: number;
  className?: string;
  iconClassName?: string;
  textClassName?: string;
  formatOptions?: Intl.NumberFormatOptions;
  showSign?: boolean;
}

export const CoinAmount: React.FC<CoinAmountProps> = ({
  amount,
  className,
  iconClassName,
  textClassName,
  formatOptions,
  showSign = false
}) => {
  if (process.env.NODE_ENV !== 'production' && !Number.isInteger(amount)) {
    console.warn('[CoinAmount] Non-integer coin amount provided:', amount);
  }

  const absoluteAmount = showSign ? Math.abs(amount) : amount;
  const formatted = absoluteAmount.toLocaleString(undefined, formatOptions ?? { maximumFractionDigits: 0 });
  const sign = showSign ? (amount < 0 ? '-' : '+') : '';

  return (
    <span className={`inline-flex items-center gap-1 ${className ?? ''}`}>
      <img src={COIN_ICON} alt="Coin" className={`w-4 h-4 ${iconClassName ?? ''}`} />
      <span className={textClassName}>{`${sign}${formatted}`}</span>
    </span>
  );
};
