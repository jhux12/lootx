import React, { useEffect, useMemo, useState } from 'react';
import { addDoc, collection, doc, onSnapshot, orderBy, query, serverTimestamp, updateDoc } from 'firebase/firestore';
import { useGame } from '../../context/GameContext';
import { db } from '../../firebase';
import { Poll, PollOption, normalizePoll } from '../../src/lib/polls';

type PollDraft = {
  id?: string;
  title: string;
  description: string;
  rewardCoins: number;
  active: boolean;
  published: boolean;
  endsAt: string;
  options: PollOption[];
};

const createBlankDraft = (): PollDraft => ({
  title: '',
  description: '',
  rewardCoins: 0,
  active: false,
  published: false,
  endsAt: '',
  options: [
    { id: 'option-1', label: '', voteCount: 0 },
    { id: 'option-2', label: '', voteCount: 0 }
  ]
});

const parseEndsAt = (value: string) => {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export const PollsAdminSection: React.FC = () => {
  const { user } = useGame();
  const [polls, setPolls] = useState<Poll[]>([]);
  const [draft, setDraft] = useState<PollDraft>(createBlankDraft());
  const [status, setStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const pollsQuery = query(collection(db, 'polls'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(pollsQuery, (snapshot) => {
      const next = snapshot.docs
        .map((entry) => normalizePoll(entry.id, entry.data()))
        .filter((entry): entry is Poll => !!entry);
      setPolls(next);
    });
    return () => unsubscribe();
  }, []);

  const selectedPoll = useMemo(() => polls.find((poll) => poll.id === draft.id), [draft.id, polls]);

  const resetDraft = () => {
    setDraft(createBlankDraft());
    setStatus(null);
  };

  const handleSave = async () => {
    const title = draft.title.trim();
    const options = draft.options
      .map((entry, index) => ({ ...entry, id: entry.id || `option-${index + 1}`, label: entry.label.trim() }))
      .filter((entry) => entry.label.length > 0);

    if (!title) {
      setStatus('Title is required.');
      return;
    }
    if (options.length < 2) {
      setStatus('Add at least two options before saving.');
      return;
    }

    setSaving(true);
    setStatus(null);

    try {
      const endsAt = parseEndsAt(draft.endsAt);
      if (draft.id) {
        await updateDoc(doc(db, 'polls', draft.id), {
          title,
          description: draft.description.trim(),
          rewardCoins: Math.max(0, Math.floor(Number(draft.rewardCoins || 0))),
          active: draft.active,
          published: draft.published,
          endsAt,
          options,
          updatedAt: serverTimestamp()
        });
        setStatus('Poll updated.');
      } else {
        await addDoc(collection(db, 'polls'), {
          title,
          description: draft.description.trim(),
          rewardCoins: Math.max(0, Math.floor(Number(draft.rewardCoins || 0))),
          active: draft.active,
          published: draft.published,
          endsAt,
          options,
          totalVotes: 0,
          createdBy: user?.id ?? null,
          createdAt: Date.now(),
          updatedAt: serverTimestamp()
        });
        setStatus('Poll created.');
        resetDraft();
      }
    } catch (error) {
      console.error('Failed to save poll', error);
      setStatus('Failed to save poll.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-gray-800 bg-[#131720] p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-lg font-bold text-white">Poll Manager</h3>
          {draft.id && (
            <button onClick={resetDraft} className="rounded-lg border border-gray-700 px-3 py-2 text-xs font-semibold text-gray-200">
              Create new poll
            </button>
          )}
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <input value={draft.title} onChange={(event) => setDraft((prev) => ({ ...prev, title: event.target.value }))} placeholder="Poll title" className="rounded-lg border border-gray-700 bg-[#0b0e14] px-3 py-2 text-sm text-white" />
          <input type="number" min={0} value={draft.rewardCoins} onChange={(event) => setDraft((prev) => ({ ...prev, rewardCoins: Number(event.target.value || 0) }))} placeholder="Reward coins" className="rounded-lg border border-gray-700 bg-[#0b0e14] px-3 py-2 text-sm text-white" />
          <textarea value={draft.description} onChange={(event) => setDraft((prev) => ({ ...prev, description: event.target.value }))} placeholder="Optional description" className="min-h-[90px] rounded-lg border border-gray-700 bg-[#0b0e14] px-3 py-2 text-sm text-white sm:col-span-2" />
          <label className="text-xs text-gray-400">Ends at (optional)
            <input type="datetime-local" value={draft.endsAt} onChange={(event) => setDraft((prev) => ({ ...prev, endsAt: event.target.value }))} className="mt-1 w-full rounded-lg border border-gray-700 bg-[#0b0e14] px-3 py-2 text-sm text-white" />
          </label>
        </div>

        <div className="mt-4 space-y-2">
          {draft.options.map((option, index) => (
            <div key={option.id} className="flex items-center gap-2">
              <input value={option.label} onChange={(event) => setDraft((prev) => ({ ...prev, options: prev.options.map((entry, optionIndex) => optionIndex === index ? { ...entry, label: event.target.value } : entry) }))} placeholder={`Option ${index + 1}`} className="flex-1 rounded-lg border border-gray-700 bg-[#0b0e14] px-3 py-2 text-sm text-white" />
              <button
                type="button"
                onClick={() => setDraft((prev) => ({ ...prev, options: prev.options.filter((_, optionIndex) => optionIndex !== index) }))}
                disabled={draft.options.length <= 2}
                className="rounded-lg border border-rose-500/40 px-3 py-2 text-xs text-rose-300 disabled:opacity-40"
              >
                Remove
              </button>
            </div>
          ))}
          <button type="button" onClick={() => setDraft((prev) => ({ ...prev, options: [...prev.options, { id: `option-${prev.options.length + 1}`, label: '', voteCount: 0 }] }))} className="rounded-lg border border-gray-700 px-3 py-2 text-xs font-semibold text-gray-200">
            Add option
          </button>
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          <label className="inline-flex items-center gap-2 text-sm text-gray-300">
            <input type="checkbox" checked={draft.published} onChange={(event) => setDraft((prev) => ({ ...prev, published: event.target.checked }))} className="h-4 w-4" /> Published
          </label>
          <label className="inline-flex items-center gap-2 text-sm text-gray-300">
            <input type="checkbox" checked={draft.active} onChange={(event) => setDraft((prev) => ({ ...prev, active: event.target.checked }))} className="h-4 w-4" /> Active
          </label>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button onClick={handleSave} disabled={saving} className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
            {saving ? 'Saving…' : draft.id ? 'Update poll' : 'Create poll'}
          </button>
          {status && <span className="text-xs text-gray-300">{status}</span>}
        </div>

        <div className="mt-4 rounded-lg border border-white/10 bg-[#0b0e14] p-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-gray-400">Preview</div>
          <div className="mt-2 text-sm font-bold text-white">{draft.title || 'Untitled poll'}</div>
          {draft.description && <div className="mt-1 text-xs text-gray-400">{draft.description}</div>}
          <div className="mt-2 space-y-1">
            {draft.options.filter((entry) => entry.label.trim()).map((entry) => (
              <div key={entry.id} className="rounded-md border border-white/10 px-2 py-1 text-xs text-gray-200">{entry.label}</div>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-gray-800 bg-[#131720] p-4 sm:p-6">
        <h4 className="text-base font-bold text-white">Existing polls</h4>
        <div className="mt-3 space-y-3">
          {polls.map((poll) => (
            <div key={poll.id} className="rounded-lg border border-gray-700 bg-[#0b0e14] p-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-white">{poll.title}</p>
                  <p className="text-xs text-gray-400">{poll.totalVotes} votes • reward {poll.rewardCoins} coins</p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setDraft({
                      id: poll.id,
                      title: poll.title,
                      description: poll.description ?? '',
                      rewardCoins: poll.rewardCoins,
                      active: poll.active,
                      published: poll.published,
                      endsAt: poll.endsAt ? new Date(poll.endsAt).toISOString().slice(0, 16) : '',
                      options: poll.options.length > 0 ? poll.options : [{ id: 'option-1', label: '', voteCount: 0 }, { id: 'option-2', label: '', voteCount: 0 }]
                    })}
                    className="rounded-lg border border-cyan-500/50 px-3 py-1.5 text-xs text-cyan-200"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      await updateDoc(doc(db, 'polls', poll.id), { active: false, updatedAt: serverTimestamp() });
                    }}
                    className="rounded-lg border border-amber-500/50 px-3 py-1.5 text-xs text-amber-200"
                  >
                    Deactivate
                  </button>
                </div>
              </div>
              <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-gray-400">
                <span className={`rounded-full px-2 py-1 ${poll.published ? 'bg-emerald-500/10 text-emerald-200' : 'bg-gray-700/40 text-gray-300'}`}>{poll.published ? 'Published' : 'Draft'}</span>
                <span className={`rounded-full px-2 py-1 ${poll.active ? 'bg-cyan-500/10 text-cyan-200' : 'bg-gray-700/40 text-gray-300'}`}>{poll.active ? 'Active' : 'Inactive'}</span>
                {selectedPoll?.id === poll.id && <span className="rounded-full bg-violet-500/10 px-2 py-1 text-violet-200">Currently editing</span>}
              </div>
            </div>
          ))}
          {polls.length === 0 && <div className="rounded-lg border border-dashed border-gray-700 px-3 py-4 text-sm text-gray-400">No polls created yet.</div>}
        </div>
      </div>
    </div>
  );
};
