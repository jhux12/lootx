export const getSellBackValue = (price: number, rate: number) => {
  const rawValue = price * rate;
  if (rawValue <= 0) {
    return 0;
  }
  const roundedValue = Math.round(rawValue);
  return Math.min(price, Math.max(1, roundedValue));
};
