import { Timestamp } from 'firebase/firestore';

export type PollOption = {
  id: string;
  label: string;
  voteCount: number;
};

export type Poll = {
  id: string;
  title: string;
  description?: string;
  rewardCoins: number;
  active: boolean;
  published: boolean;
  createdAt: number;
  endsAt?: number | null;
  totalVotes: number;
  createdBy?: string;
  options: PollOption[];
};

export type UserPollVote = {
  pollId: string;
  selectedOptionId: string;
  rewardCoins: number;
  createdAt?: number;
};

const toMillis = (value: unknown, fallback = 0): number => {
  if (value instanceof Timestamp) return value.toMillis();
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
};

export const normalizePollOption = (input: unknown, index: number): PollOption | null => {
  const candidate = input as Partial<PollOption>;
  const label = typeof candidate?.label === 'string' ? candidate.label.trim() : '';
  if (!label) return null;
  return {
    id: typeof candidate?.id === 'string' && candidate.id.trim() ? candidate.id : `option-${index + 1}`,
    label,
    voteCount: Math.max(0, Math.floor(Number(candidate?.voteCount ?? 0)))
  };
};

export const normalizePoll = (id: string, input: unknown): Poll | null => {
  const candidate = (input ?? {}) as Record<string, unknown>;
  const title = typeof candidate.title === 'string' ? candidate.title.trim() : '';
  if (!title) return null;

  const options = Array.isArray(candidate.options)
    ? candidate.options
        .map((entry, index) => normalizePollOption(entry, index))
        .filter((entry): entry is PollOption => !!entry)
    : [];

  return {
    id,
    title,
    description: typeof candidate.description === 'string' ? candidate.description.trim() : '',
    rewardCoins: Math.max(0, Math.floor(Number(candidate.rewardCoins ?? 0))),
    active: candidate.active !== false,
    published: candidate.published !== false,
    createdAt: toMillis(candidate.createdAt, Date.now()),
    endsAt: candidate.endsAt == null ? null : toMillis(candidate.endsAt, 0),
    totalVotes: Math.max(0, Math.floor(Number(candidate.totalVotes ?? 0))),
    createdBy: typeof candidate.createdBy === 'string' ? candidate.createdBy : undefined,
    options
  };
};

export const isPollExpired = (poll: Poll, now = Date.now()): boolean => {
  if (!poll.endsAt) return false;
  return poll.endsAt <= now;
};
