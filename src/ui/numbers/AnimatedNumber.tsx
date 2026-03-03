import React, { useEffect, useRef, useState } from 'react';

type AnimatedNumberProps = {
  value: number;
  duration?: number;
  className?: string;
  format?: 'compact' | ((value: number) => string);
};

export const AnimatedNumber: React.FC<AnimatedNumberProps> = ({ value, duration = 550, className, format }) => {
  const [displayValue, setDisplayValue] = useState(value);
  const previousRef = useRef(value);

  useEffect(() => {
    const start = previousRef.current;
    if (!Number.isFinite(value) || start === value) {
      setDisplayValue(value);
      previousRef.current = value;
      return;
    }

    const startTime = performance.now();
    let rafId = 0;

    const animate = (now: number) => {
      const progress = Math.min((now - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayValue(start + (value - start) * eased);
      if (progress < 1) {
        rafId = requestAnimationFrame(animate);
      } else {
        previousRef.current = value;
        setDisplayValue(value);
      }
    };

    rafId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafId);
  }, [duration, value]);

  const text = typeof format === 'function'
    ? format(displayValue)
    : format === 'compact'
      ? Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 }).format(displayValue)
      : Math.floor(displayValue).toLocaleString();

  return <span className={`tabular-nums ${className ?? ''}`}>{text}</span>;
};
