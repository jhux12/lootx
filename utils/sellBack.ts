export const getSellBackValue = (price: number, rate: number) => {
  const rawValue = price * rate;
  if (rawValue <= 0) {
    return 0;
  }
  const roundedValue = Math.round(rawValue);
  const minValue = Math.max(1, roundedValue);
  if (rate < 1 && minValue >= price) {
    return Math.max(1, price - 1);
  }
  return Math.min(price, minValue);
};
