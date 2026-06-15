import React, { useEffect, useMemo, useState } from 'react';
import { Trophy } from 'lucide-react';
import { collection, doc, limit, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db } from '../firebase';
import { MysteryBox } from '../types';
import { CoinAmount } from './CoinAmount';
import { useGame } from '../context/GameContext';

type HomeReplicaBelowFoldProps = {
  boxes: MysteryBox[];
  showSignupCta: boolean;
  onSignUp: () => void;
};

const faqs = [
  {
    id: 'how-pullz-works',
    question: 'How does Pullz.gg work?',
    answer: 'Choose a box, open it instantly, and reveal a random collectible. Keep your item and ship it to your door, or sell it back for coins to continue opening boxes.'
  },
  {
    id: 'real-cards',
    question: 'Are these real cards?',
    answer: 'Yes. All cards and collectibles featured on Pullz.gg are authentic physical items that can be shipped directly to you.'
  },
  {
    id: 'shipping',
    question: 'How does shipping work?',
    answer: "Add items from your inventory to a shipment request, and we'll carefully package and ship them with tracking information once processed."
  },
  {
    id: 'sell-items-back',
    question: 'Can I sell items back?',
    answer: "Yes. If you don't want to ship an item, you can instantly sell it back for coins and use those coins to open more boxes."
  },
  {
    id: 'random-results',
    question: 'Are the box results random?',
    answer: 'Yes. Pullz.gg uses a provably fair system so box outcomes cannot be manipulated. You can verify each result using the provided fairness information.'
  },
  {
    id: 'what-can-i-win',
    question: 'What can I win?',
    answer: 'Boxes may contain Pokémon cards, graded cards, sealed products, collectibles, and other featured items depending on the box you choose.'
  }
];

const rarityGlowClass: Record<string, string> = {
  legendary: 'bg-amber-300/35',
  epic: 'bg-purple-400/30',
  rare: 'bg-blue-300/28',
  uncommon: 'bg-green-300/24',
  common: 'bg-gray-300/18'
};

type LeaderboardPreviewEntry = {
  id: string;
  name: string;
  avatar: string;
  points: number;
};

type LeaderboardPreviewSettings = {
  enabled: boolean;
  seasonEndsAt: number | null;
  seasonId: string;
};

const normalizeLeaderboardSettings = (raw: Record<string, any> | undefined): LeaderboardPreviewSettings => {
  const seasonEndsAt = typeof raw?.seasonEndsAt?.toMillis === 'function'
    ? raw.seasonEndsAt.toMillis()
    : (Number.isFinite(Number(raw?.seasonEndsAt)) ? Number(raw?.seasonEndsAt) : null);
  return {
    enabled: raw?.enabled !== false,
    seasonEndsAt,
    seasonId: seasonEndsAt ? `season_${new Date(seasonEndsAt).toISOString().slice(0, 10)}` : 'season_open'
  };
};

const defaultLeaderboardSettings: LeaderboardPreviewSettings = {
  enabled: true,
  seasonEndsAt: null,
  seasonId: 'season_open'
};

export const HomeReplicaBelowFold: React.FC<HomeReplicaBelowFoldProps> = ({ boxes, showSignupCta, onSignUp }) => {
  const { setView } = useGame();
  const [openFaqId, setOpenFaqId] = useState<string | null>(faqs[0]?.id ?? null);
  const [leaderboardSettings, setLeaderboardSettings] = useState<LeaderboardPreviewSettings>(defaultLeaderboardSettings);
  const [leaderboardPreview, setLeaderboardPreview] = useState<LeaderboardPreviewEntry[]>([]);
  const [leaderboardLoaded, setLeaderboardLoaded] = useState(false);
  const topUpgrades = useMemo(() => {
    const highValueItems = boxes
      .flatMap((box) => box.items.map((item) => ({ ...item, boxId: box.id })))
      .sort((a, b) => b.price - a.price)
      .slice(0, 24);

    return [...highValueItems]
      .sort(() => Math.random() - 0.5)
      .slice(0, 6)
      .map((item) => ({
        ...item,
        multiplier: `${(1.2 + Math.random() * 8.8).toFixed(2)}x`
      }));
  }, [boxes]);
  const topPullCandidates = useMemo(() => {
    return boxes
      .flatMap((box) =>
        box.items.map((item) => ({
          id: `${box.id}-${item.id}`,
          itemName: item.name,
          itemImage: item.image,
          itemPrice: item.price,
          rarity: item.rarity,
          boxImage: box.image,
          boxName: box.name
        }))
      )
      .sort((a, b) => b.itemPrice - a.itemPrice)
      .slice(0, 12);
  }, [boxes]);

  const [topPullOffset] = useState(() => Math.floor(Math.random() * 12));

  const hasRunningLeaderboard = leaderboardSettings.enabled && (!leaderboardSettings.seasonEndsAt || Date.now() < leaderboardSettings.seasonEndsAt);

  useEffect(() => {
    return onSnapshot(doc(db, 'settings', 'rewards'), (snapshot) => {
      setLeaderboardSettings(normalizeLeaderboardSettings(snapshot.data() as Record<string, any> | undefined));
    }, () => {
      setLeaderboardSettings(defaultLeaderboardSettings);
    });
  }, []);

  useEffect(() => {
    setLeaderboardLoaded(false);
    if (!hasRunningLeaderboard) {
      setLeaderboardPreview([]);
      setLeaderboardLoaded(true);
      return;
    }

    const topQuery = query(
      collection(db, 'leaderboards', `rewardsSeason_${leaderboardSettings.seasonId}`, 'users'),
      orderBy('points', 'desc'),
      orderBy('updatedAt', 'asc'),
      limit(25)
    );

    return onSnapshot(topQuery, (snapshot) => {
      const topThree = snapshot.docs
        .map((entry) => ({
          id: entry.id,
          name: String(entry.data().displayName ?? 'Player'),
          avatar: String(entry.data().avatarUrl ?? ''),
          points: Math.max(0, Math.round(Number(entry.data().points ?? 0))),
          hiddenFromLeaderboard: entry.data().hiddenFromLeaderboard === true
        }))
        .filter((entry) => !entry.hiddenFromLeaderboard)
        .slice(0, 3);
      setLeaderboardPreview(topThree);
      setLeaderboardLoaded(true);
    }, () => {
      setLeaderboardPreview([]);
      setLeaderboardLoaded(true);
    });
  }, [hasRunningLeaderboard, leaderboardSettings.seasonId]);

  const topPullz = useMemo(() => {
    if (topPullCandidates.length <= 3) return topPullCandidates;
    return Array.from({ length: 3 }, (_, index) => topPullCandidates[(topPullOffset + index) % topPullCandidates.length]);
  }, [topPullCandidates, topPullOffset]);

  return (
    <div className="grid grid-cols-1 gap-7 lg:grid-cols-[1fr_260px]">
      <div className="space-y-8">
        <section>
          <div className="mb-4 flex items-end justify-between gap-3"><div><p className="text-[11px] font-black uppercase tracking-[0.18em] text-violet-200/80">Upgrade items</p><h2 className="mt-1 text-2xl font-black tracking-tight">Top Upgrades</h2></div></div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            {topUpgrades.map((upgrade) => (
              <div key={upgrade.id} className="group min-h-[156px] rounded-xl border border-white/5 bg-[#22282c] p-3 transition-colors duration-200 ease-out hover:border-slate-400/35">
                <p className="text-xs font-black text-yellow-300">{upgrade.multiplier}</p>
                <div className="my-3 flex h-[80px] items-center justify-center">
                  <img src={upgrade.image} alt={upgrade.name} className="max-h-full max-w-full object-contain transition-transform duration-200 ease-out group-hover:scale-105" loading="lazy" decoding="async" width={160} height={160} />
                </div>
                <p className="truncate text-xs text-slate-400">{upgrade.name}</p>
                <CoinAmount amount={Math.round(upgrade.price)} className="mt-1 text-sm font-black text-white" iconClassName="h-4 w-4" />
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-white/[0.06] bg-[#20262b]/72 p-4 shadow-[0_14px_36px_rgba(5,8,12,0.18)] sm:p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-sky-200/80">Leaderboards</p>
              <h2 className="mt-1 flex items-center gap-2 text-2xl font-black tracking-tight"><Trophy className="h-5 w-5 text-amber-200" />Climb the ranks</h2>
            </div>
            <button type="button" onClick={() => setView({ type: 'LEADERBOARD' })} className="min-h-10 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-xs font-black uppercase tracking-wide text-white/90 transition hover:border-sky-300/40 hover:bg-white/[0.08] hover:text-white active:scale-[0.98]">View</button>
          </div>
          <div className="grid gap-2">
            {!leaderboardLoaded ? (
              Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="h-[66px] overflow-hidden rounded-xl border border-white/[0.06] bg-[#1b2024]/70">
                  <div className="h-full w-full -translate-x-full animate-[shimmer_1.8s_infinite] bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                </div>
              ))
            ) : leaderboardPreview.length ? leaderboardPreview.map((entry, index) => (
              <div key={entry.id} className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-[#1b2024]/70 px-3 py-3">
                <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg text-xs font-black ${index === 0 ? 'bg-amber-300 text-black' : 'bg-white/[0.06] text-slate-200'}`}>#{index + 1}</span>
                <div className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-full bg-gradient-to-br from-[#7C5CFF] to-sky-400 text-sm font-black text-white">
                  {entry.avatar ? <img src={entry.avatar} alt="" className="h-full w-full object-cover" loading="lazy" decoding="async" /> : entry.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-white">{entry.name}</p>
                  <p className="text-xs text-slate-400">Current season points</p>
                </div>
                <div className="shrink-0 text-right text-sm font-black text-slate-100 tabular-nums">{entry.points.toLocaleString()}</div>
              </div>
            )) : (
              <div className="rounded-xl border border-white/[0.06] bg-[#1b2024]/70 px-4 py-5 text-center">
                <p className="text-sm font-bold text-white">No active leaderboard entries yet.</p>
                <p className="mt-1 text-xs leading-5 text-slate-400">Open boxes to be one of the first players on the current board.</p>
              </div>
            )}
          </div>
        </section>

        {showSignupCta && (
          <section className="min-h-[150px] rounded-xl bg-[#22282c] p-5">
            <h2 className="text-xl font-black">Get started with Pullz.gg</h2>
            <p className="mt-2 text-sm text-slate-300">Sign up and open mystery boxes in seconds.</p>
            <button
              onClick={onSignUp}
              className="mt-4 w-full rounded-lg bg-gradient-to-r from-[#205DD7] via-blue-600 to-sky-500 px-4 py-3 text-sm font-black text-white shadow-[0_10px_24px_rgba(32,93,215,0.35)] transition-all duration-200 hover:brightness-110 sm:w-auto"
            >
              Create Account
            </button>
          </section>
        )}

        <section className="space-y-3">
          {faqs.map((faq) => {
            const isOpen = openFaqId === faq.id;
            return (
              <div key={faq.id} className="overflow-hidden rounded-xl bg-[#22282c]">
                <button
                  type="button"
                  onClick={() => setOpenFaqId((prev) => (prev === faq.id ? null : faq.id))}
                  className="flex min-h-[52px] w-full items-start justify-between gap-3 px-4 py-4 text-left text-sm font-bold sm:items-center sm:text-base"
                  aria-expanded={isOpen}
                >
                  <span className="min-w-0 flex-1 leading-6">{faq.question}</span>
                  <span className={`shrink-0 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}>⌄</span>
                </button>
                {isOpen && <p className="border-t border-white/10 px-4 py-4 text-sm leading-6 text-slate-300">{faq.answer}</p>}
              </div>
            );
          })}
        </section>
      </div>

      <aside className="space-y-4 lg:sticky lg:top-20">
        <section>
          <h3 className="mb-2 text-xs font-black uppercase text-slate-300 sm:mb-3 sm:text-sm">Top Pullz</h3>
          <div className="space-y-2">
            {topPullz.map((item) => (
              <div key={item.id} className="group relative min-h-[146px] overflow-hidden rounded-lg bg-[#1f2730]/45 p-2 text-center sm:min-h-[228px] sm:rounded-2xl sm:p-3">
                <div className="pointer-events-none absolute inset-0 hidden bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.06),transparent_62%)] sm:block" />
                <div className="relative z-10 flex min-h-[122px] flex-col items-center justify-center gap-1 transition-transform duration-300 ease-out group-hover:translate-y-[118%] group-focus-within:translate-y-[118%] sm:min-h-[210px] sm:gap-3">
                  <div className="relative flex h-24 w-full items-center justify-center sm:h-52">
                    <div className={`pointer-events-none absolute inset-x-8 top-8 bottom-8 hidden rounded-[40%] blur-2xl opacity-60 sm:block ${rarityGlowClass[item.rarity] ?? rarityGlowClass.common}`} />
                    <img src={item.itemImage} alt={item.itemName} className="relative z-10 max-h-24 w-auto max-w-[92%] object-contain sm:max-h-52" loading="lazy" decoding="async" width={220} height={220} />
                  </div>
                  <p className="max-w-[170px] truncate text-[11px] font-medium text-slate-300/95 sm:max-w-[185px] sm:text-sm">{item.itemName}</p>
                  <CoinAmount amount={Math.round(item.itemPrice)} className="justify-center text-[13px] font-black text-white sm:text-lg" iconClassName="h-4 w-4 sm:h-5 sm:w-5" />
                </div>
                <div className="absolute inset-0 z-20 grid translate-y-[115%] place-items-center opacity-0 transition-all duration-300 ease-out group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:translate-y-0 group-focus-within:opacity-100">
                  <img src={item.boxImage} alt={item.boxName} className="h-28 w-28 object-contain sm:h-32 sm:w-32" loading="lazy" decoding="async" width={144} height={144} />
                </div>
              </div>
            ))}
          </div>
        </section>
      </aside>
    </div>
  );
};
