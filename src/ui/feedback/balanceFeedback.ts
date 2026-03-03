export const getBalanceDeltaTone = (delta: number) => {
  if (delta > 0) return 'up' as const;
  if (delta < 0) return 'down' as const;
  return 'none' as const;
};

export const shouldPlayBalancePing = (muted: boolean, lastPlayAt: number, debounceMs = 450) => {
  if (muted) return false;
  return Date.now() - lastPlayAt > debounceMs;
};
