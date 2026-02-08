const clampValue = (value: number) => Math.min(100, Math.max(0, value));

export const mapRiskLabelToValue = (label?: string) => {
  if (!label) return undefined;
  const normalized = label.trim().toLowerCase();
  if (!normalized) return undefined;
  if (normalized.includes('safe')) return 20;
  if (normalized.includes('balanced')) return 50;
  if (normalized.includes('high')) return 80;
  return undefined;
};

export const resolveRiskValue = (riskLevel?: number | null, riskLabel?: string) => {
  const numeric = typeof riskLevel === 'number' && Number.isFinite(riskLevel) ? riskLevel : undefined;
  const mapped = mapRiskLabelToValue(riskLabel);
  return clampValue(numeric ?? mapped ?? 50);
};
