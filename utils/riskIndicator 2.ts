const DEFAULT_RISK_VALUE = 50;

const labelMap: Record<string, number> = {
  safe: 20,
  balanced: 50,
  'high risk': 80,
  high: 80,
  risky: 80
};

export const resolveRiskValue = (risk?: number | string | null): number => {
  if (typeof risk === 'number' && Number.isFinite(risk)) {
    return Math.min(100, Math.max(0, risk));
  }

  if (typeof risk === 'string') {
    const normalized = risk.trim().toLowerCase();
    if (normalized) {
      const mapped = labelMap[normalized];
      if (mapped !== undefined) {
        return mapped;
      }
    }
  }

  return DEFAULT_RISK_VALUE;
};
