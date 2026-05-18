import React, { useEffect, useMemo, useState } from 'react';
import {
  ChevronLeft,
  CheckCircle2,
  Copy,
  Crown,
  Facebook,
  HelpCircle,
  Mail,
  MessageCircle,
  Globe,
  Share2,
  Twitter,
  Users,
  Wallet
} from 'lucide-react';
import { useGame } from '../context/GameContext';
import { authedFetch } from '../utils/authedFetch';
import { COIN_ICON } from '../constants';

type ReferralSettings = {
  enabled: boolean;
  referrerRewardCoins: number;
  friendRewardCoins: number;
  requiredDepositCoins: number;
  requireFirstQualifyingGame: boolean;
  leaderboardPointsEnabled: boolean;
  referrerLeaderboardPoints: number;
  friendLeaderboardPoints: number;
  heroBadge: string;
  heroTitle: string;
  heroDescription: string;
  ctaTitle: string;
  ctaDescription: string;
  faqItems: Array<{ id: string; question: string; answer: string }>;
};

type ReferralRecord = {
  id: string;
  friendLabel: string;
  joinedAt: number | null;
  status: string;
  youEarned: number;
  depositQualified?: boolean;
  firstGameQualified?: boolean;
};

type ReferralData = {
  referralCode: string;
  stats: {
    referrals: number;
    creditsEarned: number;
    leaderboardPts: number;
    pending: number;
  };
  settings: ReferralSettings;
  records: ReferralRecord[];
};

const DEFAULT_SETTINGS: ReferralSettings = {
  enabled: true,
  referrerRewardCoins: 1000,
  friendRewardCoins: 1000,
  requiredDepositCoins: 1000,
  requireFirstQualifyingGame: true,
  leaderboardPointsEnabled: false,
  referrerLeaderboardPoints: 0,
  friendLeaderboardPoints: 0,
  heroBadge: 'REFER A FRIEND',
  heroTitle: 'Give 1,000. Get 1,000.',
  heroDescription:
    'Share your referral link. When a friend signs up and qualifies with your code, you both get rewarded.',
  ctaTitle: 'Keep Sharing, Keep Earning',
  ctaDescription: 'Invite more friends and stack up referral rewards as they qualify.',
  faqItems: [
    { id: 'limit', question: 'How many friends can I refer?', answer: 'You can refer unlimited eligible new users.' },
    {
      id: 'completed',
      question: 'What counts as a completed referral?',
      answer: 'A referral completes once signup and qualification requirements are satisfied.'
    },
    { id: 'timing', question: 'When are rewards added?', answer: 'Rewards are added automatically after qualification.' },
    {
      id: 'existing',
      question: 'Can I refer someone who already has an account?',
      answer: 'No. Existing accounts are not eligible for referral rewards.'
    }
  ]
};

const statCards = [
  { key: 'referrals', label: 'Referrals', icon: Users },
  { key: 'creditsEarned', label: 'Coins Earned', icon: Wallet },
  { key: 'leaderboardPts', label: 'Leaderboard Pts', icon: Crown },
  { key: 'pending', label: 'Pending', icon: HelpCircle }
] as const;

const CANONICAL_REFERRAL_BASE_URL = 'https://pullz.gg';

const CoinValue: React.FC<{ amount: number; className?: string; iconClassName?: string }> = ({ amount, className, iconClassName }) => (
  <span className={`inline-flex items-center gap-1.5 ${className ?? ''}`}>
    <span>{amount.toLocaleString()}</span>
    <img src={COIN_ICON} alt="Coin" className={iconClassName ?? 'h-4 w-4'} />
  </span>
);

const formatDate = (value: number | null) => {
  if (!value) return '—';
  return new Date(value).toLocaleDateString();
};

const getReferralStatusLabel = (record: ReferralRecord) => {
  const normalizedStatus = String(record.status || '').trim().toLowerCase();
  if ((normalizedStatus === 'signed_up' || normalizedStatus === 'pending_qualification') && !record.depositQualified) {
    return 'Pending';
  }
  if (normalizedStatus === 'rewarded') return 'Rewarded';
  if (normalizedStatus === 'completed') return 'Completed';
  if (normalizedStatus === 'invalid' || normalizedStatus === 'rejected') return 'Invalid';
  if (!normalizedStatus) return 'Pending';
  return normalizedStatus.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
};

export const ReferralsPage: React.FC = () => {
  const { isAuthenticated, openAuthModal } = useGame();
  const [data, setData] = useState<ReferralData | null>(null);
  const [settings, setSettings] = useState<ReferralSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [faqOpenId, setFaqOpenId] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      try {
        const settingsRes = await fetch('/api/referrals/settings');
        const settingsPayload = await settingsRes.json();
        if (mounted && settingsPayload?.settings) {
          setSettings({ ...DEFAULT_SETTINGS, ...settingsPayload.settings });
        }
      } catch (error) {
        console.error('Failed to load referral settings', error);
      }

      if (!isAuthenticated) {
        if (mounted) setLoading(false);
        return;
      }

      try {
        const me = await authedFetch<{ ok: boolean } & ReferralData>('/api/referrals/me');
        if (mounted) {
          setData(me);
          if (me.settings) {
            setSettings({ ...DEFAULT_SETTINGS, ...me.settings });
          }
        }
      } catch (error) {
        console.error('Failed to load referral dashboard', error);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void load();
    return () => {
      mounted = false;
    };
  }, [isAuthenticated]);

  const referralLink = useMemo(() => {
    const code = data?.referralCode;
    if (!code) return '';
    return `${CANONICAL_REFERRAL_BASE_URL}/join?ref=${encodeURIComponent(code)}`;
  }, [data?.referralCode]);

  const copyLink = async () => {
    if (!referralLink) return;
    try {
      await navigator.clipboard.writeText(referralLink);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch (error) {
      console.error('Failed to copy referral link', error);
    }
  };

  const shareTargets = [
    {
      id: 'twitter',
      icon: Twitter,
      href: `https://twitter.com/intent/tweet?text=${encodeURIComponent(`Join me with my referral link: ${referralLink}`)}`
    },
    {
      id: 'facebook',
      icon: Facebook,
      href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(referralLink)}`
    },
    {
      id: 'discord',
      icon: MessageCircle,
      href: `https://discord.com/channels/@me`
    },
    {
      id: 'reddit',
      icon: Globe,
      href: `https://www.reddit.com/submit?url=${encodeURIComponent(referralLink)}`
    },
    {
      id: 'email',
      icon: Mail,
      href: `mailto:?subject=${encodeURIComponent('Join me')}&body=${encodeURIComponent(`Use my referral link: ${referralLink}`)}`
    }
  ];

  if (!isAuthenticated) {
    return (
      <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <div className="rounded-3xl border border-white/10 bg-[#161b1f] p-8 text-center sm:p-12">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.24em] text-cyan-300">{settings.heroBadge}</p>
          <h1 className="mb-3 flex flex-wrap items-center justify-center gap-3 text-3xl font-black text-white sm:text-5xl">
            <span>Give</span>
            <CoinValue amount={settings.friendRewardCoins} className="text-3xl sm:text-5xl" iconClassName="h-7 w-7 sm:h-9 sm:w-9" />
            <span>Get</span>
            <CoinValue amount={settings.referrerRewardCoins} className="text-3xl sm:text-5xl" iconClassName="h-7 w-7 sm:h-9 sm:w-9" />
          </h1>
          <p className="mx-auto mb-8 max-w-2xl text-sm text-slate-300 sm:text-base">{settings.heroDescription}</p>
          <button
            onClick={() => openAuthModal('register')}
            className="rounded-xl bg-cyan-500 px-6 py-3 text-sm font-bold text-[#05131d] transition hover:bg-cyan-400"
          >
            Sign in to start referring
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <button
        type="button"
        onClick={() => window.history.back()}
        className="inline-flex min-h-10 items-center gap-2 rounded-md px-2.5 py-1.5 text-sm font-medium text-gray-300 transition-colors hover:text-white"
      >
        <ChevronLeft className="h-4 w-4" /> Back
      </button>
      <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-[#161b1f] p-6 sm:p-10">
        <button className="absolute right-5 top-5 hidden rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-xs font-semibold text-slate-200 md:inline-block">
          How It Works
        </button>
        <p className="mb-3 w-fit rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-xs font-semibold tracking-[0.18em] text-cyan-200">
          {settings.heroBadge}
        </p>
        <h1 className="flex flex-wrap items-center gap-3 text-3xl font-black tracking-tight text-white sm:text-5xl">
          <span>Give</span>
          <CoinValue amount={settings.friendRewardCoins} className="text-3xl sm:text-5xl" iconClassName="h-7 w-7 sm:h-9 sm:w-9" />
          <span>Get</span>
          <CoinValue amount={settings.referrerRewardCoins} className="text-3xl sm:text-5xl" iconClassName="h-7 w-7 sm:h-9 sm:w-9" />
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">{settings.heroDescription}</p>
      </section>

      <section className="rounded-3xl border border-white/10 bg-[#161b1f] p-4 sm:p-6">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Your Referral Link</p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            readOnly
            value={referralLink}
            className="h-12 flex-1 rounded-xl border border-white/15 bg-[#080c16] px-4 text-sm text-white outline-none"
          />
          <button
            onClick={copyLink}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-cyan-500 px-5 text-sm font-semibold text-[#041016]"
          >
            {copied ? <CheckCircle2 className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {shareTargets.map((share) => (
            <a
              key={share.id}
              href={share.href}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-white/15 bg-white/5 text-slate-200 transition hover:border-cyan-300/50 hover:text-cyan-200"
            >
              <share.icon className="h-4 w-4" />
            </a>
          ))}
          <button
            onClick={copyLink}
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-white/15 bg-white/5 px-3 text-xs font-semibold text-slate-200"
          >
            <Share2 className="h-4 w-4" />
            Copy Share Link
          </button>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {statCards
          .filter((card) => settings.leaderboardPointsEnabled || card.key !== 'leaderboardPts')
          .map((card) => {
            const Icon = card.icon;
            const value = data?.stats?.[card.key] ?? 0;
            const valueClassName = 'mt-1 text-2xl font-black leading-none text-white sm:text-3xl';
            return (
              <div key={card.key} className="rounded-2xl border border-white/10 bg-[#161b1f] p-4">
                <p className="mb-2 inline-flex items-center gap-2 text-xs uppercase tracking-[0.14em] text-slate-400">
                  <Icon className="h-3.5 w-3.5" />
                  {card.label}
                </p>
                {card.key === 'creditsEarned' ? (
                  <div className={valueClassName}>
                    <CoinValue amount={Number(value)} className="flex" iconClassName="h-5 w-5 sm:h-6 sm:w-6" />
                  </div>
                ) : (
                  <p className={valueClassName}>{Number(value).toLocaleString()}</p>
                )}
              </div>
            );
          })}
      </section>

      <section className="grid gap-3 md:grid-cols-2">
        <div className="rounded-2xl border border-cyan-500/20 bg-[#161b1f] p-5">
          <p className="text-xs uppercase tracking-[0.16em] text-cyan-200">You Get</p>
          <CoinValue amount={settings.referrerRewardCoins} className="mt-2 text-4xl font-black text-white" iconClassName="h-7 w-7" />
          <p className="mt-1 text-sm text-slate-300">Coins per completed referral</p>
          {settings.leaderboardPointsEnabled && (
            <p className="mt-2 text-xs text-cyan-200">+{settings.referrerLeaderboardPoints} leaderboard pts</p>
          )}
        </div>
        <div className="rounded-2xl border border-blue-500/20 bg-[#161b1f] p-5">
          <p className="text-xs uppercase tracking-[0.16em] text-blue-200">Your Friend Gets</p>
          <CoinValue amount={settings.friendRewardCoins} className="mt-2 text-4xl font-black text-white" iconClassName="h-7 w-7" />
          <p className="mt-1 text-sm text-slate-300">Coins after qualifying</p>
          {settings.leaderboardPointsEnabled && (
            <p className="mt-2 text-xs text-blue-200">+{settings.friendLeaderboardPoints} leaderboard pts</p>
          )}
        </div>
      </section>

      <section className="rounded-3xl border border-white/10 bg-[#161b1f] p-4 sm:p-6">
        <h2 className="text-xl font-bold text-white">Your Referrals</h2>
        {loading ? (
          <p className="mt-3 text-sm text-slate-400">Loading referrals…</p>
        ) : (data?.records?.length ?? 0) === 0 ? (
          <p className="mt-3 text-sm text-slate-400">No referrals yet. Share your link to start earning.</p>
        ) : (
          <>
            <div className="mt-4 hidden overflow-hidden rounded-xl border border-white/10 md:block">
              <table className="w-full text-left text-sm">
                <thead className="bg-white/5 text-xs uppercase tracking-[0.14em] text-slate-400">
                  <tr>
                    <th className="px-4 py-3">Friend</th>
                    <th className="px-4 py-3">Joined</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">You Earned</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.records.map((record) => (
                    <tr key={record.id} className="border-t border-white/10 text-slate-200">
                      <td className="px-4 py-3">{record.friendLabel}</td>
                      <td className="px-4 py-3">{formatDate(record.joinedAt)}</td>
                      <td className="px-4 py-3">{getReferralStatusLabel(record)}</td>
                      <td className="px-4 py-3">{record.youEarned.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 space-y-3 md:hidden">
              {data?.records.map((record) => (
                <article key={record.id} className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm">
                  <p className="font-semibold text-white">{record.friendLabel}</p>
                  <p className="mt-1 text-slate-400">Joined: {formatDate(record.joinedAt)}</p>
                  <p className="mt-1 text-slate-300">Status: {getReferralStatusLabel(record)}</p>
                  <p className="mt-1 text-cyan-200">You earned: {record.youEarned.toLocaleString()}</p>
                </article>
              ))}
            </div>
          </>
        )}
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-black text-white">How It Works</h2>
        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-[#161b1f] p-5">
            <h3 className="text-base font-bold text-white">Share Your Link</h3>
            <p className="mt-2 text-sm text-slate-300">Copy your referral link and share it on social, text, email, or Discord.</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-[#161b1f] p-5">
            <h3 className="text-base font-bold text-white">Friend Joins with Your Code</h3>
            <p className="mt-2 text-sm text-slate-300">
              They sign up through your link, deposit at least <CoinValue amount={settings.requiredDepositCoins} className="align-middle font-semibold text-white" />,
              {settings.requireFirstQualifyingGame ? ' and play their first qualifying game.' : ' then become eligible for reward review.'}
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-[#161b1f] p-5">
            <h3 className="text-base font-bold text-white">You Both Get Rewarded</h3>
            <p className="mt-2 text-sm text-slate-300">
              You receive <CoinValue amount={settings.referrerRewardCoins} className="align-middle font-semibold text-white" /> and your friend receives <CoinValue amount={settings.friendRewardCoins} className="align-middle font-semibold text-white" />.
            </p>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-2xl font-black text-white">FAQ</h2>
        {settings.faqItems.map((faq) => {
          const open = faqOpenId === faq.id;
          return (
            <div key={faq.id} className="overflow-hidden rounded-2xl border border-white/10 bg-[#161b1f]">
              <button
                onClick={() => setFaqOpenId((prev) => (prev === faq.id ? null : faq.id))}
                className="flex w-full items-center justify-between gap-3 px-4 py-4 text-left"
              >
                <span className="font-semibold text-white">{faq.question}</span>
                <span className="text-slate-400">{open ? '−' : '+'}</span>
              </button>
              {open && <p className="border-t border-white/10 px-4 py-4 text-sm text-slate-300">{faq.answer}</p>}
            </div>
          );
        })}
      </section>

      <section className="rounded-3xl border border-cyan-500/20 bg-gradient-to-b from-[#0a1322] to-[#0b101c] p-8 text-center sm:p-12">
        <h2 className="text-3xl font-black text-white sm:text-4xl">{settings.ctaTitle}</h2>
        <p className="mx-auto mt-3 max-w-2xl text-sm text-slate-300 sm:text-base">{settings.ctaDescription}</p>
        <button onClick={copyLink} className="mt-6 inline-flex h-12 items-center gap-2 rounded-xl bg-cyan-500 px-6 text-sm font-bold text-[#05131d]">
          <Copy className="h-4 w-4" />
          Copy Referral Link
        </button>
      </section>
    </div>
  );
};
