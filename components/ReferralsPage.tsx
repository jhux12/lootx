import React, { useEffect, useMemo, useState } from 'react';
import { Check, ChevronLeft, Copy, Gift, Users, Wallet } from 'lucide-react';
import { useGame } from '../context/GameContext';
import { authedFetch } from '../utils/authedFetch';
import { COIN_ICON } from '../constants';
import { PUBLIC_BRAND } from '../config/publicBrand';

type ReferralSettings = { enabled: boolean; referrerRewardCoins: number; friendRewardCoins: number };
type ReferralRecord = { id: string; friendLabel: string; joinedAt: number | null; status: string; youEarned: number; depositQualified?: boolean };
type ReferralData = {
  referralCode: string;
  stats: { referrals: number; creditsEarned: number; pending: number };
  settings: ReferralSettings;
  records: ReferralRecord[];
};

const DEFAULT_SETTINGS: ReferralSettings = { enabled: true, referrerRewardCoins: 1000, friendRewardCoins: 1000 };
const CANONICAL_REFERRAL_BASE_URL = PUBLIC_BRAND.canonicalOrigin;

const CoinValue = ({ amount }: { amount: number }) => (
  <span className="inline-flex items-center gap-1.5">
    {amount.toLocaleString()}
    <img src={COIN_ICON} alt="coins" className="h-5 w-5" width={20} height={20} />
  </span>
);

const statusLabel = (record: ReferralRecord) => record.status === 'rewarded' ? 'Rewarded' : record.depositQualified ? 'Processing' : 'Awaiting deposit';

export const ReferralsPage: React.FC = () => {
  const { isAuthenticated, openAuthModal } = useGame();
  const [data, setData] = useState<ReferralData | null>(null);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<'code' | 'link' | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      try {
        const response = await fetch('/api/referrals/settings');
        const payload = await response.json();
        if (active && payload?.settings) setSettings({ ...DEFAULT_SETTINGS, ...payload.settings });
        if (isAuthenticated) {
          const mine = await authedFetch<{ ok: boolean } & ReferralData>('/api/referrals/me');
          if (active) {
            setData(mine);
            setSettings({ ...DEFAULT_SETTINGS, ...mine.settings });
          }
        }
      } catch (error) {
        console.error('Failed to load referrals', error);
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => { active = false; };
  }, [isAuthenticated]);

  const referralLink = useMemo(() => data?.referralCode ? `${CANONICAL_REFERRAL_BASE_URL}/join?ref=${encodeURIComponent(data.referralCode)}` : '', [data?.referralCode]);
  const copy = async (value: string, kind: 'code' | 'link') => {
    if (!value) return;
    await navigator.clipboard.writeText(value);
    setCopied(kind);
    window.setTimeout(() => setCopied(null), 1600);
  };

  if (!isAuthenticated) return (
    <main className="referrals-page mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-14">
      <section className="referral-card p-6 text-center sm:p-10">
        <Gift className="mx-auto h-9 w-9 text-[var(--bet-orange)]" />
        <h1 className="mt-4 text-3xl font-black sm:text-4xl">Give 1,000. Get 1,000.</h1>
        <p className="referral-muted mx-auto mt-3 max-w-lg text-sm sm:text-base">Invite a friend with your code. After their first deposit, you both receive 1,000 coins.</p>
        <button onClick={() => openAuthModal('register')} className="mt-6 min-h-12 rounded-xl bg-[var(--bet-orange)] px-6 font-bold text-white">Create an account</button>
      </section>
    </main>
  );

  const stats = [
    { label: 'Referred', value: data?.stats.referrals ?? 0, icon: Users },
    { label: 'Pending', value: data?.stats.pending ?? 0, icon: Gift },
    { label: 'Coins earned', value: data?.stats.creditsEarned ?? 0, icon: Wallet }
  ];

  return (
    <main className="referrals-page mx-auto w-full max-w-4xl px-4 py-5 sm:px-6 sm:py-8">
      <button type="button" onClick={() => window.history.back()} className="referral-muted mb-4 inline-flex min-h-10 items-center gap-1 text-sm hover:opacity-80"><ChevronLeft className="h-4 w-4" /> Back</button>

      <section className="referral-card p-5 sm:p-7">
        <div className="max-w-xl">
          <p className="text-xs font-bold uppercase tracking-[.18em] text-[var(--bet-orange)]">Refer a friend</p>
          <h1 className="mt-2 text-3xl font-black sm:text-4xl">You both get 1,000 coins</h1>
          <p className="referral-muted mt-2 text-sm leading-6">They enter your code at sign up. Rewards arrive automatically after their first deposit.</p>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-[1fr_auto]">
          <div className="referral-code min-w-0 rounded-xl p-3">
            <p className="referral-muted text-[10px] font-bold uppercase tracking-widest">Your code</p>
            <p className="mt-1 truncate font-mono text-xl font-black tracking-wider">{loading ? 'Loading…' : data?.referralCode}</p>
          </div>
          <button onClick={() => copy(data?.referralCode ?? '', 'code')} disabled={!data?.referralCode} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[var(--bet-orange)] px-5 text-sm font-bold text-white disabled:opacity-50">
            {copied === 'code' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}{copied === 'code' ? 'Copied' : 'Copy code'}
          </button>
        </div>
        <button onClick={() => copy(referralLink, 'link')} disabled={!referralLink} className="referral-muted mt-3 inline-flex min-h-10 items-center gap-2 text-xs font-semibold hover:opacity-80 disabled:opacity-50">
          {copied === 'link' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}{copied === 'link' ? 'Link copied' : 'Copy share link'}
        </button>
      </section>

      <section className="mt-4 grid grid-cols-3 gap-2 sm:gap-3">
        {stats.map(({ label, value, icon: Icon }) => <div key={label} className="referral-card min-w-0 p-3 sm:p-4"><Icon className="h-4 w-4 text-[var(--bet-orange)]" /><p className="mt-3 text-xl font-black sm:text-2xl">{value.toLocaleString()}</p><p className="referral-muted mt-1 truncate text-[10px] sm:text-xs">{label}</p></div>)}
      </section>

      <section className="referral-card mt-4 p-4 sm:p-6">
        <div className="flex items-center justify-between gap-3"><h2 className="text-lg font-black">Your referrals</h2><span className="referral-muted text-xs">First deposit unlocks rewards</span></div>
        {loading ? <p className="referral-muted py-8 text-center text-sm">Loading referrals…</p> : !data?.records.length ? <p className="referral-muted py-8 text-center text-sm">No referrals yet. Copy your code to invite someone.</p> : (
          <div className="mt-3 divide-y divide-[var(--ref-border)]">
            {data.records.map(record => <div key={record.id} className="grid grid-cols-[1fr_auto] items-center gap-3 py-3"><div className="min-w-0"><p className="truncate text-sm font-semibold">{record.friendLabel}</p><p className="referral-muted mt-0.5 text-xs">{record.joinedAt ? new Date(record.joinedAt).toLocaleDateString() : 'Recently joined'}</p></div><div className="text-right"><p className="text-xs font-semibold text-[var(--bet-orange)]">{statusLabel(record)}</p>{record.youEarned > 0 && <p className="mt-1 text-xs font-bold"><CoinValue amount={record.youEarned} /></p>}</div></div>)}
          </div>
        )}
      </section>
    </main>
  );
};
