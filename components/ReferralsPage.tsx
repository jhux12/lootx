import React, { useEffect, useMemo, useState } from 'react';
import {
  ChevronDown,
  ChevronLeft,
  CheckCircle2,
  Clock,
  Copy,
  Crown,
  Facebook,
  Gift,
  Link2,
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
  { key: 'pending', label: 'Pending', icon: Clock }
] as const;

const CANONICAL_REFERRAL_BASE_URL = 'https://pullz.gg';

const CoinValue: React.FC<{ amount: number; className?: string; iconClassName?: string }> = ({ amount, className, iconClassName }) => (
  <span className={`inline-flex items-center gap-1.5 ${className ?? ''}`}>
    <span>{amount.toLocaleString()}</span>
    <img src={COIN_ICON} alt="Coin" className={iconClassName ?? 'h-4 w-4'} loading="lazy" decoding="async" width={16} height={16} />
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

const GlowBackdrop: React.FC = () => (
  <div className="pointer-events-none absolute inset-0">
    <div className="absolute -top-24 left-4 h-52 w-52 rounded-full bg-cyan-500/20 blur-3xl sm:h-72 sm:w-72" />
    <div className="absolute -bottom-24 right-0 h-56 w-56 rounded-full bg-blue-500/20 blur-3xl sm:h-80 sm:w-80" />
  </div>
);

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

  const howItWorks: Array<{ title: string; description: React.ReactNode }> = [
    { title: 'Share Your Link', description: 'Copy your referral link and share it on social, text, email, or Discord.' },
    {
      title: 'Friend Joins with Your Code',
      description: (
        <>
          They sign up through your link, deposit at least{' '}
          <CoinValue amount={settings.requiredDepositCoins} className="align-middle font-semibold text-white" iconClassName="h-3.5 w-3.5" />,
          {settings.requireFirstQualifyingGame ? ' and play their first qualifying game.' : ' then become eligible for reward review.'}
        </>
      )
    },
    {
      title: 'You Both Get Rewarded',
      description: (
        <>
          You receive <CoinValue amount={settings.referrerRewardCoins} className="align-middle font-semibold text-white" iconClassName="h-3.5 w-3.5" /> and
          your friend receives <CoinValue amount={settings.friendRewardCoins} className="align-middle font-semibold text-white" iconClassName="h-3.5 w-3.5" />.
        </>
      )
    }
  ];

  const faqSection = (
    <section className="space-y-3">
      <h2 className="text-2xl font-black text-white">FAQ</h2>
      {settings.faqItems.map((faq) => {
        const open = faqOpenId === faq.id;
        return (
          <div key={faq.id} className="overflow-hidden rounded-2xl border border-white/10 bg-[#161b1f] transition-colors hover:border-white/20">
            <button
              onClick={() => setFaqOpenId((prev) => (prev === faq.id ? null : faq.id))}
              className="flex w-full items-center justify-between gap-3 px-4 py-4 text-left"
            >
              <span className="font-semibold text-white">{faq.question}</span>
              <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
            </button>
            {open && <p className="border-t border-white/10 px-4 py-4 text-sm leading-6 text-slate-300">{faq.answer}</p>}
          </div>
        );
      })}
    </section>
  );

  const howItWorksSection = (
    <section className="space-y-4">
      <h2 className="text-2xl font-black text-white">How It Works</h2>
      <div className="grid gap-3 md:grid-cols-3">
        {howItWorks.map((step, index) => (
          <div key={step.title} className="rounded-2xl border border-white/10 bg-[#161b1f] p-5">
            <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-[#205DD7] to-sky-400 text-sm font-black text-white">
              {index + 1}
            </div>
            <h3 className="text-base font-bold text-white">{step.title}</h3>
            <p className="mt-2 text-sm leading-6 text-slate-300">{step.description}</p>
          </div>
        ))}
      </div>
    </section>
  );

  if (!isAuthenticated) {
    return (
      <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <section className="relative overflow-hidden rounded-[28px] border border-white/10 bg-gradient-to-br from-[#0f1727] via-[#121a2d] to-[#111a2f] p-8 text-center sm:p-12">
          <GlowBackdrop />
          <div className="relative z-10">
            <p className="mx-auto mb-4 inline-flex w-fit items-center gap-2 rounded-full border border-cyan-300/30 bg-cyan-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-100">
              <Gift className="h-3.5 w-3.5" />
              {settings.heroBadge}
            </p>
            <h1 className="mb-3 flex flex-wrap items-center justify-center gap-3 text-3xl font-black tracking-tight text-white sm:text-5xl">
              <span>Give</span>
              <CoinValue amount={settings.friendRewardCoins} className="text-3xl sm:text-5xl" iconClassName="h-7 w-7 sm:h-9 sm:w-9" />
              <span>Get</span>
              <CoinValue amount={settings.referrerRewardCoins} className="text-3xl sm:text-5xl" iconClassName="h-7 w-7 sm:h-9 sm:w-9" />
            </h1>
            <p className="mx-auto mb-8 max-w-2xl text-sm text-slate-300 sm:text-base">{settings.heroDescription}</p>
            <button
              onClick={() => openAuthModal('register')}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#205DD7] via-blue-500 to-sky-400 px-7 text-sm font-bold text-white shadow-[0_16px_45px_-20px_rgba(32,93,215,0.9)] transition duration-300 hover:brightness-110"
            >
              Sign in to start referring
            </button>
          </div>
        </section>

        {howItWorksSection}
        {faqSection}
      </div>
    );
  }

  const visibleStatCards = statCards.filter((card) => settings.leaderboardPointsEnabled || card.key !== 'leaderboardPts');
  const hasRecords = (data?.records?.length ?? 0) > 0;

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <button
        type="button"
        onClick={() => window.history.back()}
        className="inline-flex min-h-10 items-center gap-2 rounded-md px-2.5 py-1.5 text-sm font-medium text-gray-300 transition-colors hover:text-white"
      >
        <ChevronLeft className="h-4 w-4" /> Back
      </button>

      <section className="relative overflow-hidden rounded-[28px] border border-white/10 bg-gradient-to-br from-[#0f1727] via-[#121a2d] to-[#111a2f] p-6 sm:p-10">
        <GlowBackdrop />
        <div className="relative z-10">
          <p className="mb-3 inline-flex w-fit items-center gap-2 rounded-full border border-cyan-300/30 bg-cyan-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-100">
            <Gift className="h-3.5 w-3.5" />
            {settings.heroBadge}
          </p>
          <h1 className="flex flex-wrap items-center gap-3 text-3xl font-black tracking-tight text-white sm:text-5xl">
            <span>Give</span>
            <CoinValue amount={settings.friendRewardCoins} className="text-3xl sm:text-5xl" iconClassName="h-7 w-7 sm:h-9 sm:w-9" />
            <span>Get</span>
            <CoinValue amount={settings.referrerRewardCoins} className="text-3xl sm:text-5xl" iconClassName="h-7 w-7 sm:h-9 sm:w-9" />
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">{settings.heroDescription}</p>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <div className="flex items-center gap-3 rounded-2xl border border-cyan-400/20 bg-cyan-500/5 px-4 py-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cyan-500/15 text-cyan-300">
                <Wallet className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-cyan-200">You Get</p>
                <CoinValue amount={settings.referrerRewardCoins} className="text-lg font-black text-white" iconClassName="h-4 w-4" />
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-2xl border border-blue-400/20 bg-blue-500/5 px-4 py-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-500/15 text-blue-300">
                <Gift className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-blue-200">Friend Gets</p>
                <CoinValue amount={settings.friendRewardCoins} className="text-lg font-black text-white" iconClassName="h-4 w-4" />
              </div>
            </div>
          </div>

          <div className="mt-5 flex flex-col gap-3 rounded-2xl border border-white/10 bg-black/20 p-3 backdrop-blur sm:flex-row sm:items-center sm:p-4">
            <div className="flex flex-1 items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3">
              <Link2 className="h-4 w-4 shrink-0 text-slate-400" />
              <span className="truncate text-sm text-slate-200">{referralLink || 'Loading your link…'}</span>
            </div>
            <button
              onClick={copyLink}
              className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#205DD7] via-blue-500 to-sky-400 px-6 text-sm font-bold text-white shadow-[0_12px_30px_-14px_rgba(32,93,215,0.9)] transition duration-300 hover:brightness-110"
            >
              {copied ? <CheckCircle2 className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? 'Copied!' : 'Copy Link'}
            </button>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
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
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-white/15 bg-white/5 px-3 text-xs font-semibold text-slate-200 transition hover:border-cyan-300/50 hover:text-cyan-200"
            >
              <Share2 className="h-4 w-4" />
              Copy Share Link
            </button>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {visibleStatCards.map((card) => {
          const Icon = card.icon;
          const value = data?.stats?.[card.key] ?? 0;
          return (
            <div key={card.key} className="rounded-2xl border border-white/10 bg-[#161b1f] p-4 transition-colors hover:border-cyan-400/30">
              <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-white/5 text-cyan-300">
                <Icon className="h-4 w-4" />
              </div>
              <p className="text-xs uppercase tracking-[0.14em] text-slate-400">{card.label}</p>
              {card.key === 'creditsEarned' ? (
                <CoinValue amount={Number(value)} className="mt-1 text-2xl font-black leading-none text-white sm:text-3xl" iconClassName="h-5 w-5 sm:h-6 sm:w-6" />
              ) : (
                <p className="mt-1 text-2xl font-black leading-none text-white sm:text-3xl">{Number(value).toLocaleString()}</p>
              )}
            </div>
          );
        })}
      </section>

      {howItWorksSection}

      <section className="rounded-3xl border border-white/10 bg-[#161b1f] p-4 sm:p-6">
        <h2 className="text-xl font-bold text-white">Your Referrals</h2>
        {loading ? (
          <p className="mt-3 text-sm text-slate-400">Loading referrals…</p>
        ) : !hasRecords ? (
          <div className="mt-4 flex flex-col items-center gap-2 rounded-xl border border-dashed border-white/10 py-10 text-center">
            <Users className="h-8 w-8 text-slate-600" />
            <p className="text-sm text-slate-400">No referrals yet. Share your link to start earning.</p>
          </div>
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

      {faqSection}

      <section className="relative overflow-hidden rounded-3xl border border-cyan-500/20 bg-gradient-to-br from-[#0f1727] via-[#121a2d] to-[#111a2f] p-8 text-center sm:p-12">
        <GlowBackdrop />
        <div className="relative z-10">
          <h2 className="text-3xl font-black text-white sm:text-4xl">{settings.ctaTitle}</h2>
          <p className="mx-auto mt-3 max-w-2xl text-sm text-slate-300 sm:text-base">{settings.ctaDescription}</p>
          <button
            onClick={copyLink}
            className="mt-6 inline-flex h-12 items-center gap-2 rounded-xl bg-gradient-to-r from-[#205DD7] via-blue-500 to-sky-400 px-6 text-sm font-bold text-white shadow-[0_16px_45px_-20px_rgba(32,93,215,0.9)] transition duration-300 hover:brightness-110"
          >
            {copied ? <CheckCircle2 className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? 'Copied!' : 'Copy Referral Link'}
          </button>
        </div>
      </section>
    </div>
  );
};
