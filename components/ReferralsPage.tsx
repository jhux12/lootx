import React, { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Clock3,
  Coins,
  Copy,
  Crown,
  Gift,
  Facebook,
  HelpCircle,
  Mail,
  MessageCircle,
  Globe,
  Link2,
  Share2,
  Sparkles,
  Twitter,
  Users
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
  { key: 'creditsEarned', label: 'Coins Earned', icon: Coins },
  { key: 'leaderboardPts', label: 'Leaderboard Pts', icon: Crown },
  { key: 'pending', label: 'Pending', icon: Clock3 }
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

  const rewardCards = [
    {
      title: 'You Get',
      amount: settings.referrerRewardCoins,
      description: 'Coins per completed referral',
      glow: 'from-cyan-500/20 via-blue-500/10 to-transparent',
      border: 'border-cyan-400/20',
      text: 'text-cyan-200'
    },
    {
      title: 'Your Friend Gets',
      amount: settings.friendRewardCoins,
      description: 'Coins after qualifying',
      glow: 'from-fuchsia-500/20 via-violet-500/10 to-transparent',
      border: 'border-fuchsia-400/20',
      text: 'text-fuchsia-200'
    }
  ];

  const howItWorks = [
    {
      icon: Share2,
      title: 'Share Your Link',
      body: 'Copy your referral link and share it on social, text, email, or Discord.',
      color: 'text-cyan-200'
    },
    {
      icon: Users,
      title: 'Friend Joins with Your Code',
      body: (
        <>
          They sign up through your link, deposit at least <CoinValue amount={settings.requiredDepositCoins} className="align-middle font-semibold text-white" />
          {settings.requireFirstQualifyingGame ? ' and play their first qualifying game.' : ' then become eligible for reward review.'}
        </>
      ),
      color: 'text-fuchsia-200'
    },
    {
      icon: Gift,
      title: 'You Both Get Rewarded',
      body: (
        <>
          You receive <CoinValue amount={settings.referrerRewardCoins} className="align-middle font-semibold text-white" /> and your friend receives <CoinValue amount={settings.friendRewardCoins} className="align-middle font-semibold text-white" />.
        </>
      ),
      color: 'text-violet-200'
    }
  ];

  return (
    <div className="mx-auto w-full max-w-[720px] space-y-3 px-3 py-3 text-slate-100 sm:px-4 sm:py-5">
      <section className="relative overflow-hidden rounded-2xl border border-cyan-400/20 bg-[#050915] p-4 shadow-[0_0_40px_rgba(89,45,255,0.18)] sm:p-7">
        <div className="absolute inset-y-0 right-0 w-1/2 bg-[radial-gradient(circle_at_58%_42%,rgba(168,85,247,0.7),transparent_17%),radial-gradient(circle_at_72%_65%,rgba(6,182,212,0.5),transparent_15%),linear-gradient(135deg,transparent,rgba(88,28,135,0.45))]" />
        <div className="absolute right-5 top-6 hidden h-36 w-36 rotate-12 rounded-3xl border border-fuchsia-300/20 bg-gradient-to-br from-violet-600/60 via-fuchsia-500/30 to-cyan-400/20 shadow-[0_0_55px_rgba(168,85,247,0.55)] sm:block" />
        <Sparkles className="absolute right-20 top-10 h-5 w-5 text-amber-300/80" />
        <Gift className="absolute bottom-8 right-14 h-24 w-24 text-fuchsia-200/80 drop-shadow-[0_0_24px_rgba(217,70,239,0.9)] sm:h-32 sm:w-32" />
        <div className="relative z-10 max-w-[64%] sm:max-w-md">
          <p className="mb-3 w-fit rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-cyan-200">
            {settings.heroBadge}
          </p>
          <h1 className="text-[2rem] font-black leading-[0.98] tracking-tight text-white sm:text-5xl">
            <span className="block">Give <CoinValue amount={settings.friendRewardCoins} className="inline-flex text-cyan-300" iconClassName="h-7 w-7 sm:h-9 sm:w-9" /></span>
            <span className="block">Get <CoinValue amount={settings.referrerRewardCoins} className="inline-flex text-violet-300" iconClassName="h-7 w-7 sm:h-9 sm:w-9" /></span>
          </h1>
          <p className="mt-4 text-xs leading-5 text-slate-200 sm:text-sm">{settings.heroDescription}</p>
        </div>
      </section>

      <section className="rounded-2xl border border-cyan-400/15 bg-[#070d1a] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] sm:p-4">
        <p className="mb-2 inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.16em] text-slate-300"><Link2 className="h-3.5 w-3.5 text-cyan-300" /> Your Referral Link</p>
        <div className="flex gap-2 rounded-xl border border-white/10 bg-[#050915] p-2">
          <input readOnly value={referralLink} className="min-w-0 flex-1 bg-transparent px-2 text-xs font-semibold text-white outline-none sm:text-sm" />
          <button onClick={copyLink} className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-violet-600 to-cyan-500 px-4 text-xs font-black text-white shadow-[0_0_18px_rgba(124,58,237,0.45)]">
            {copied ? <CheckCircle2 className="h-4 w-4" /> : <Copy className="h-4 w-4" />}{copied ? 'Copied' : 'Copy'}
          </button>
        </div>
        <div className="mt-3 grid grid-cols-6 gap-2">
          {shareTargets.map((share) => <a key={share.id} href={share.href} target="_blank" rel="noreferrer" className="inline-flex h-11 items-center justify-center rounded-lg border border-white/10 bg-white/[0.03] text-slate-200 transition hover:border-cyan-300/50 hover:text-cyan-200"><share.icon className="h-4 w-4" /></a>)}
        </div>
        <button onClick={copyLink} className="mt-2 inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] text-xs font-bold text-slate-200"><Share2 className="h-4 w-4" /> Copy Share Link</button>
      </section>

      <section className="grid grid-cols-3 gap-2">
        {statCards.filter((card) => settings.leaderboardPointsEnabled || card.key !== 'leaderboardPts').map((card) => {
          const Icon = card.icon;
          const value = data?.stats?.[card.key] ?? 0;
          return <div key={card.key} className="rounded-xl border border-cyan-400/10 bg-[#070d1a] p-3"><p className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-slate-400"><Icon className="h-4 w-4 text-cyan-300" />{card.label}</p><div className="mt-1 text-2xl font-black leading-none text-white">{card.key === 'creditsEarned' ? <CoinValue amount={Number(value)} iconClassName="h-5 w-5" /> : Number(value).toLocaleString()}</div></div>;
        })}
      </section>

      <section className="grid gap-2 sm:grid-cols-2">
        {rewardCards.map((card) => <div key={card.title} className={`relative overflow-hidden rounded-2xl border ${card.border} bg-[#071126] p-4`}><div className={`absolute inset-0 bg-gradient-to-br ${card.glow}`} /><HelpCircle className="absolute -right-3 top-2 h-20 w-20 text-white/5" /><div className="relative"><p className={`text-[11px] font-black uppercase tracking-[0.16em] ${card.text}`}>{card.title}</p><CoinValue amount={card.amount} className="mt-2 text-3xl font-black text-white" iconClassName="h-6 w-6" /><p className="mt-1 text-xs text-slate-300">{card.description}</p></div></div>)}
      </section>

      <section className="rounded-2xl border border-cyan-400/15 bg-[#070d1a] p-4">
        <h2 className="inline-flex items-center gap-2 text-base font-black text-white"><Users className="h-5 w-5 text-cyan-300" /> Your Referrals</h2>
        {loading ? <p className="mt-2 text-xs text-slate-400">Loading referrals…</p> : (data?.records?.length ?? 0) === 0 ? <p className="mt-2 text-xs text-slate-400">No referrals yet. Share your link to start earning.</p> : <div className="mt-3 space-y-2">{data?.records.map((record) => <article key={record.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-xs"><p className="font-bold text-white">{record.friendLabel}</p><p className="mt-1 text-slate-400">Joined: {formatDate(record.joinedAt)}</p><p className="mt-1 text-slate-300">Status: {getReferralStatusLabel(record)}</p><p className="mt-1 text-cyan-200">You earned: {record.youEarned.toLocaleString()}</p></article>)}</div>}
      </section>

      <section className="rounded-2xl border border-cyan-400/15 bg-[#070d1a] p-4">
        <h2 className="mb-3 inline-flex items-center gap-2 text-base font-black text-white"><Sparkles className="h-4 w-4 text-cyan-300" /> How It Works</h2>
        <div className="space-y-2">{howItWorks.map((item) => { const Icon = item.icon; return <div key={item.title} className="flex gap-3 rounded-xl border border-white/10 bg-[#050915] p-3"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04]"><Icon className={`h-5 w-5 ${item.color}`} /></div><div><h3 className="text-sm font-black text-white">{item.title}</h3><p className="mt-1 text-xs leading-5 text-slate-300">{item.body}</p></div></div>; })}</div>
      </section>

      <section className="rounded-2xl border border-cyan-400/15 bg-[#070d1a] p-4">
        <h2 className="mb-3 inline-flex items-center gap-2 text-base font-black text-white"><Sparkles className="h-4 w-4 text-cyan-300" /> FAQ</h2>
        <div className="space-y-2">{settings.faqItems.map((faq) => { const open = faqOpenId === faq.id; return <div key={faq.id} className="overflow-hidden rounded-lg border border-white/10 bg-[#050915]"><button onClick={() => setFaqOpenId((prev) => (prev === faq.id ? null : faq.id))} className="flex w-full items-center justify-between gap-3 px-3 py-3 text-left text-xs font-black text-white"><span>{faq.question}</span><span className="text-slate-400">{open ? '−' : '+'}</span></button>{open && <p className="border-t border-white/10 px-3 py-3 text-xs leading-5 text-slate-300">{faq.answer}</p>}</div>; })}</div>
      </section>

      <section className="relative overflow-hidden rounded-2xl border border-violet-300/25 bg-gradient-to-br from-[#11104a] via-[#111033] to-[#061529] p-5 shadow-[0_0_36px_rgba(124,58,237,0.32)] sm:p-7">
        <Gift className="absolute -right-3 bottom-0 h-28 w-28 rotate-12 text-violet-300/30" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div><h2 className="text-2xl font-black leading-tight text-white sm:text-3xl">{settings.ctaTitle}</h2><p className="mt-2 max-w-sm text-xs leading-5 text-slate-200 sm:text-sm">{settings.ctaDescription}</p></div>
          <button onClick={copyLink} className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-cyan-500 px-5 text-xs font-black text-white shadow-[0_0_22px_rgba(124,58,237,0.6)]"><Copy className="h-4 w-4" /> Copy Referral Link</button>
        </div>
      </section>
    </div>
  );
};
