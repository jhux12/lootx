import React, { useEffect, useMemo, useState } from 'react';
import { Save, Search } from 'lucide-react';
import { authedFetch } from '../../utils/authedFetch';

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

type ReferralRow = {
  id: string;
  referrerDisplayName: string | null;
  referredDisplayName: string | null;
  referralCode: string | null;
  status: string;
  depositQualified: boolean;
  firstGameQualified: boolean;
  createdAt: number | null;
  notes?: string;
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
  heroDescription: 'Share your referral link. When a friend signs up and qualifies with your code, you both get rewarded.',
  ctaTitle: 'Keep Sharing, Keep Earning',
  ctaDescription: 'Invite more friends and stack up referral rewards every time they qualify.',
  faqItems: [
    { id: 'limit', question: 'How many friends can I refer?', answer: 'You can refer unlimited eligible users.' },
    { id: 'completed', question: 'What counts as a completed referral?', answer: 'Signup + configured qualification requirements.' },
    { id: 'timing', question: 'When are rewards added?', answer: 'Rewards are credited automatically after qualification.' },
    { id: 'existing', question: 'Can I refer someone who already has an account?', answer: 'No. Existing accounts are not eligible.' }
  ]
};

export const ReferralAdminSection: React.FC = () => {
  const [settings, setSettings] = useState<ReferralSettings>(DEFAULT_SETTINGS);
  const [rows, setRows] = useState<ReferralRow[]>([]);
  const [stats, setStats] = useState<{ total: number; rewarded: number; pending: number; invalid: number }>({ total: 0, rewarded: 0, pending: 0, invalid: 0 });
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [settingsRes, rowsRes] = await Promise.all([
        authedFetch<{ settings: ReferralSettings }>('/api/referrals/settings'),
        authedFetch<{ rows: ReferralRow[]; stats: { total: number; rewarded: number; pending: number; invalid: number } }>('/api/admin/referrals')
      ]);
      setSettings((prev) => ({ ...prev, ...settingsRes.settings }));
      setRows(rowsRes.rows || []);
      setStats(rowsRes.stats || { total: 0, rewarded: 0, pending: 0, invalid: 0 });
    } catch (error) {
      console.error('Failed loading referral admin data', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const saveSettings = async () => {
    try {
      await authedFetch('/api/referrals/settings', {
        method: 'PUT',
        body: JSON.stringify({ settings })
      });
      await load();
    } catch (error) {
      console.error('Failed to save referral settings', error);
      alert('Unable to save referral settings right now.');
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) =>
      [row.referrerDisplayName, row.referredDisplayName, row.referralCode, row.status].some((v) =>
        String(v ?? '').toLowerCase().includes(q)
      )
    );
  }, [rows, search]);

  const markInvalid = async (referralId: string) => {
    await authedFetch('/api/admin/referrals', {
      method: 'PATCH',
      body: JSON.stringify({ referralId, action: 'mark_invalid' })
    });
    await load();
  };

  const forceQualify = async (referralId: string) => {
    await authedFetch('/api/admin/referrals', {
      method: 'PATCH',
      body: JSON.stringify({ referralId, action: 'force_qualify' })
    });
    await load();
  };

  return (
    <div className="space-y-6">
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Total', value: stats.total },
          { label: 'Rewarded', value: stats.rewarded },
          { label: 'Pending', value: stats.pending },
          { label: 'Invalid', value: stats.invalid }
        ].map((item) => (
          <div key={item.label} className="rounded-xl border border-gray-700 bg-[#111827] p-4">
            <p className="text-xs uppercase tracking-wide text-gray-400">{item.label}</p>
            <p className="mt-2 text-2xl font-black text-white">{item.value}</p>
          </div>
        ))}
      </section>

      <section className="rounded-2xl border border-gray-700 bg-[#111827] p-4 sm:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-lg font-bold text-white">Referral Settings</h3>
          <button onClick={saveSettings} className="inline-flex items-center gap-2 rounded-lg bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-900">
            <Save className="h-4 w-4" /> Save
          </button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <label className="rounded-lg border border-gray-700 bg-gray-900/50 p-3 text-sm text-gray-300">
            <div className="mb-2">Program Enabled</div>
            <input type="checkbox" checked={settings.enabled} onChange={(e) => setSettings((prev) => ({ ...prev, enabled: e.target.checked }))} />
          </label>
          <label className="rounded-lg border border-gray-700 bg-gray-900/50 p-3 text-sm text-gray-300">Referrer Reward
            <input className="mt-2 w-full rounded bg-gray-800 px-3 py-2 text-white" type="number" value={settings.referrerRewardCoins} onChange={(e) => setSettings((prev) => ({ ...prev, referrerRewardCoins: Number(e.target.value) || 0 }))} />
          </label>
          <label className="rounded-lg border border-gray-700 bg-gray-900/50 p-3 text-sm text-gray-300">Friend Reward
            <input className="mt-2 w-full rounded bg-gray-800 px-3 py-2 text-white" type="number" value={settings.friendRewardCoins} onChange={(e) => setSettings((prev) => ({ ...prev, friendRewardCoins: Number(e.target.value) || 0 }))} />
          </label>
          <label className="rounded-lg border border-gray-700 bg-gray-900/50 p-3 text-sm text-gray-300">Required Deposit
            <input className="mt-2 w-full rounded bg-gray-800 px-3 py-2 text-white" type="number" value={settings.requiredDepositCoins} onChange={(e) => setSettings((prev) => ({ ...prev, requiredDepositCoins: Number(e.target.value) || 0 }))} />
          </label>
          <label className="rounded-lg border border-gray-700 bg-gray-900/50 p-3 text-sm text-gray-300">
            <div className="mb-2">Require First Qualifying Game</div>
            <input type="checkbox" checked={settings.requireFirstQualifyingGame} onChange={(e) => setSettings((prev) => ({ ...prev, requireFirstQualifyingGame: e.target.checked }))} />
          </label>
          <label className="rounded-lg border border-gray-700 bg-gray-900/50 p-3 text-sm text-gray-300">
            <div className="mb-2">Leaderboard Reward Enabled</div>
            <input type="checkbox" checked={settings.leaderboardPointsEnabled} onChange={(e) => setSettings((prev) => ({ ...prev, leaderboardPointsEnabled: e.target.checked }))} />
          </label>
        </div>
      </section>

      <section className="rounded-2xl border border-gray-700 bg-[#111827] p-4 sm:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-lg font-bold text-white">Referral Records</h3>
          <label className="inline-flex items-center gap-2 rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-300">
            <Search className="h-4 w-4" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search referrals"
              className="bg-transparent outline-none"
            />
          </label>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm text-gray-300">
            <thead>
              <tr className="border-b border-gray-700 text-xs uppercase tracking-wide text-gray-400">
                <th className="px-3 py-2">Referrer</th>
                <th className="px-3 py-2">Friend</th>
                <th className="px-3 py-2">Code</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Qualified</th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr key={row.id} className="border-b border-gray-800">
                  <td className="px-3 py-2">{row.referrerDisplayName || row.id}</td>
                  <td className="px-3 py-2">{row.referredDisplayName || '-'}</td>
                  <td className="px-3 py-2">{row.referralCode || '-'}</td>
                  <td className="px-3 py-2 capitalize">{row.status.replace(/_/g, ' ')}</td>
                  <td className="px-3 py-2">{row.depositQualified ? 'Deposit ✓' : 'Deposit ✕'} / {row.firstGameQualified ? 'Game ✓' : 'Game ✕'}</td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-2">
                      <button className="rounded bg-emerald-500/20 px-2 py-1 text-xs text-emerald-200" onClick={() => forceQualify(row.id)}>Force qualify</button>
                      <button className="rounded bg-red-500/20 px-2 py-1 text-xs text-red-200" onClick={() => markInvalid(row.id)}>Mark invalid</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {loading && <p className="mt-3 text-sm text-gray-400">Loading referrals…</p>}
        </div>
      </section>
    </div>
  );
};
