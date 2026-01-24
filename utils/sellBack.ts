export const getSellBackValue = (price: number, rate: number) => {
  const rawValue = price * rate;
  if (rawValue <= 0) {
    return 0;
  }
  return Math.max(1, Math.round(rawValue));
};
