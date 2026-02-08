const RISK_LABEL_VALUES: Record<string, number> = {
  safe: 20,
  balanced: 50,
  'high risk': 80,
  high: 80,
};

const clampValue = (value: number) => Math.min(100, Math.max(0, value));

export const getRiskIndicatorValue = (value?: number | string) => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    const normalized = value <= 1 ? value * 100 : value;
    return clampValue(normalized);
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized in RISK_LABEL_VALUES) {
      return RISK_LABEL_VALUES[normalized];
    }
  }

  return 50;
};
