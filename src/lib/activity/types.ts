export type ActivityType = 'open' | 'sell' | 'ship' | 'buy';

export interface ProvablyFairActivityData {
  serverSeedHash?: string;
  clientSeed?: string;
  nonce?: number;
  winningItem?: string;
  resultIndex?: number;
  rollHash?: string;
}

export interface ActivityEntry {
  id: string;
  type: ActivityType;
  title: string;
  value?: number;
  meta?: Record<string, unknown>;
  timestamp: number;
  provablyFairData?: ProvablyFairActivityData;
  read?: boolean;
}
