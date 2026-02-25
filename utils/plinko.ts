export type PlinkoSlot = {
  label: string;
  minMult: number;
  maxMult: number;
  poolId: string;
  enabled: boolean;
};

export type PlinkoBoard = {
  id: string;
  name: 'low' | 'medium' | 'high' | string;
  rows: number;
  slots: PlinkoSlot[];
};

export type PlinkoSettings = {
  enabled: boolean;
  rows: number;
  minBet: number;
  maxBet: number;
  cooldownMs: number;
  houseEdgeMultiplier: number;
  activeBoardId: string;
  allowFromFreeBox: boolean;
  allowFromPromo: boolean;
  serverSeedHash?: string;
};

export type PlinkoPoolItem = {
  id: string;
  enabled: boolean;
  weight: number;
  name: string;
  imageUrl: string;
  coinValue: number;
  rarity: string;
  category: string;
};

export const DEFAULT_PLINKO_SETTINGS: PlinkoSettings = {
  enabled: true,
  rows: 16,
  minBet: 100,
  maxBet: 50000,
  cooldownMs: 1200,
  houseEdgeMultiplier: 0.92,
  activeBoardId: 'medium',
  allowFromFreeBox: false,
  allowFromPromo: false,
  serverSeedHash: ''
};

const toNumber = (value: unknown, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const normalizePlinkoSettings = (value: Partial<PlinkoSettings> | null | undefined): PlinkoSettings => ({
  enabled: value?.enabled !== false,
  rows: Math.max(8, Math.min(24, Math.round(toNumber(value?.rows, DEFAULT_PLINKO_SETTINGS.rows)))),
  minBet: Math.max(1, Math.round(toNumber(value?.minBet, DEFAULT_PLINKO_SETTINGS.minBet))),
  maxBet: Math.max(1, Math.round(toNumber(value?.maxBet, DEFAULT_PLINKO_SETTINGS.maxBet))),
  cooldownMs: Math.max(0, Math.round(toNumber(value?.cooldownMs, DEFAULT_PLINKO_SETTINGS.cooldownMs))),
  houseEdgeMultiplier: Math.max(0, Math.min(1.5, toNumber(value?.houseEdgeMultiplier, DEFAULT_PLINKO_SETTINGS.houseEdgeMultiplier))),
  activeBoardId: typeof value?.activeBoardId === 'string' && value.activeBoardId.trim()
    ? value.activeBoardId.trim()
    : DEFAULT_PLINKO_SETTINGS.activeBoardId,
  allowFromFreeBox: value?.allowFromFreeBox === true,
  allowFromPromo: value?.allowFromPromo === true,
  serverSeedHash: typeof value?.serverSeedHash === 'string' ? value.serverSeedHash : ''
});

export const normalizePlinkoSlot = (value: Partial<PlinkoSlot>): PlinkoSlot => ({
  label: typeof value.label === 'string' && value.label.trim() ? value.label.trim() : 'Common',
  minMult: Math.max(0, toNumber(value.minMult, 0.5)),
  maxMult: Math.max(0, toNumber(value.maxMult, 1.2)),
  poolId: typeof value.poolId === 'string' && value.poolId.trim() ? value.poolId.trim() : 'default',
  enabled: value.enabled !== false
});

export const normalizePlinkoBoard = (id: string, value: Partial<PlinkoBoard> | null | undefined, fallbackRows = 16): PlinkoBoard => {
  const rows = Math.max(8, Math.min(24, Math.round(toNumber(value?.rows, fallbackRows))));
  const rawSlots = Array.isArray(value?.slots) ? value?.slots : [];
  const slots = Array.from({ length: rows + 1 }, (_, idx) => normalizePlinkoSlot(rawSlots[idx] ?? {}));

  return {
    id,
    name: typeof value?.name === 'string' ? value.name : 'medium',
    rows,
    slots
  };
};

export const formatMultiplier = (value: number) => `${Number(value).toFixed(2)}x`;
