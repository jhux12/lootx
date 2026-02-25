import React, { useEffect, useMemo, useState } from 'react';
import {
  deletePlinkoPoolItem,
  getPlinkoSettingsAdmin,
  listPlinkoBoardsAdmin,
  listPlinkoPoolItemsAdmin,
  rotatePlinkoServerSeedHash,
  savePlinkoBoard,
  savePlinkoPoolItem,
  savePlinkoSettings
} from '../../services/plinkoAdminService';
import { DEFAULT_PLINKO_SETTINGS, normalizePlinkoBoard, normalizePlinkoSettings, PlinkoBoard, PlinkoPoolItem, PlinkoSettings } from '../../utils/plinko';

export const PlinkoAdminSection: React.FC = () => {
  const [settingsDraft, setSettingsDraft] = useState<PlinkoSettings>(DEFAULT_PLINKO_SETTINGS);
  const [boards, setBoards] = useState<PlinkoBoard[]>([]);
  const [selectedBoardId, setSelectedBoardId] = useState('medium');
  const [boardDraft, setBoardDraft] = useState<PlinkoBoard>(normalizePlinkoBoard('medium', { name: 'medium', rows: 16 }));
  const [selectedPoolId, setSelectedPoolId] = useState('default');
  const [poolItems, setPoolItems] = useState<PlinkoPoolItem[]>([]);
  const [poolDraft, setPoolDraft] = useState<Partial<PlinkoPoolItem>>({ enabled: true, weight: 1 });
  const [previewBet, setPreviewBet] = useState(1000);
  const [previewSlotIndex, setPreviewSlotIndex] = useState(0);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [settingsStatus, setSettingsStatus] = useState<string | null>(null);

  const reloadSettings = async () => {
    const loaded = await getPlinkoSettingsAdmin();
    setSettingsDraft(loaded);
    setSettingsStatus(null);
  };

  const reloadBoards = async () => {
    const next = await listPlinkoBoardsAdmin();
    setBoards(next);
    const active = next.find((entry) => entry.id === selectedBoardId) ?? next[0];
    if (active) {
      setSelectedBoardId(active.id);
      setBoardDraft(active);
    }
  };

  const reloadPoolItems = async () => {
    const next = await listPlinkoPoolItemsAdmin(selectedPoolId);
    setPoolItems(next);
  };

  useEffect(() => {
    void reloadSettings();
    void reloadBoards();
  }, []);

  useEffect(() => {
    void reloadPoolItems();
  }, [selectedPoolId]);

  const previewBand = useMemo(() => {
    const slot = boardDraft.slots[previewSlotIndex];
    if (!slot) return { minValue: 0, maxValue: 0 };
    return {
      minValue: previewBet * slot.minMult * settingsDraft.houseEdgeMultiplier,
      maxValue: previewBet * slot.maxMult * settingsDraft.houseEdgeMultiplier
    };
  }, [boardDraft.slots, previewSlotIndex, previewBet, settingsDraft.houseEdgeMultiplier]);

  return (
    <div className="rounded-xl border border-emerald-500/20 bg-[#091521] p-4 sm:p-6">
      <h3 className="text-lg font-bold text-white">Plinko Settings</h3>
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ['rows', 'Rows'],
          ['minBet', 'Min Bet'],
          ['maxBet', 'Max Bet'],
          ['cooldownMs', 'Cooldown (ms)'],
          ['houseEdgeMultiplier', 'House Edge'],
          ['activeBoardId', 'Active Board ID']
        ].map(([key, label]) => (
          <label key={key} className="text-xs text-gray-400">{label}
            <input
              type={key === 'activeBoardId' ? 'text' : 'number'}
              value={String((settingsDraft as any)[key] ?? '')}
              onChange={(event) => setSettingsDraft((prev) => normalizePlinkoSettings({ ...prev, [key]: key === 'activeBoardId' ? event.target.value : Number(event.target.value) }))}
              className="mt-1 w-full rounded-lg border border-white/10 bg-[#0b0e14] px-3 py-2 text-sm text-white"
            />
          </label>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button onClick={() => setSettingsDraft((prev) => ({ ...prev, enabled: !prev.enabled }))} className="rounded-lg border border-white/10 px-3 py-2 text-xs text-white">{settingsDraft.enabled ? 'Disable' : 'Enable'} Plinko</button>
        <button
          onClick={async () => {
            setIsSavingSettings(true);
            setSettingsStatus(null);
            try {
              await savePlinkoSettings(settingsDraft);
              await reloadSettings();
              setSettingsStatus('Settings saved.');
            } catch (error) {
              setSettingsStatus(error instanceof Error ? error.message : 'Failed to save settings.');
            } finally {
              setIsSavingSettings(false);
            }
          }}
          disabled={isSavingSettings}
          className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-black disabled:opacity-50"
        >
          {isSavingSettings ? 'Saving…' : 'Save Settings'}
        </button>
        <button onClick={() => { void rotatePlinkoServerSeedHash(); }} className="rounded-lg border border-emerald-500/50 px-3 py-2 text-xs text-emerald-300">Rotate Seed Hash</button>
      </div>
      {settingsStatus && (
        <div className={`mt-2 rounded-lg border px-3 py-2 text-xs ${settingsStatus === 'Settings saved.' ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200' : 'border-rose-500/40 bg-rose-500/10 text-rose-200'}`}>
          {settingsStatus}
        </div>
      )}

      <h4 className="mt-6 text-base font-bold text-white">Boards</h4>
      <div className="mt-2 flex flex-wrap gap-2">
        {boards.map((board) => (
          <button key={board.id} onClick={() => { setSelectedBoardId(board.id); setBoardDraft(board); }} className={`rounded-lg px-3 py-2 text-xs font-semibold ${selectedBoardId === board.id ? 'bg-emerald-600 text-black' : 'bg-[#0b0e14] text-gray-200 border border-white/10'}`}>{board.name}</button>
        ))}
      </div>
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="text-xs text-gray-400">Board Name
          <input value={boardDraft.name} onChange={(event) => setBoardDraft((prev) => ({ ...prev, name: event.target.value }))} className="mt-1 w-full rounded-lg border border-white/10 bg-[#0b0e14] px-3 py-2 text-sm text-white" />
        </label>
        <label className="text-xs text-gray-400">Rows
          <input type="number" value={boardDraft.rows} onChange={(event) => setBoardDraft((prev) => normalizePlinkoBoard(prev.id, { ...prev, rows: Number(event.target.value) }))} className="mt-1 w-full rounded-lg border border-white/10 bg-[#0b0e14] px-3 py-2 text-sm text-white" />
        </label>
      </div>
      <div className="mt-3 max-h-72 space-y-2 overflow-auto rounded-lg border border-white/10 bg-[#0b0e14] p-2">
        {boardDraft.slots.map((slot, index) => (
          <div key={`${slot.poolId}-${index}`} className="grid grid-cols-1 gap-2 rounded-lg border border-white/10 bg-black/20 p-2 sm:grid-cols-5">
            <input value={slot.label} onChange={(event) => setBoardDraft((prev) => ({ ...prev, slots: prev.slots.map((entry, i) => i === index ? { ...entry, label: event.target.value } : entry) }))} className="rounded border border-white/10 bg-black/20 px-2 py-1.5 text-xs text-white" />
            <input type="number" value={slot.minMult} onChange={(event) => setBoardDraft((prev) => ({ ...prev, slots: prev.slots.map((entry, i) => i === index ? { ...entry, minMult: Number(event.target.value) } : entry) }))} className="rounded border border-white/10 bg-black/20 px-2 py-1.5 text-xs text-white" />
            <input type="number" value={slot.maxMult} onChange={(event) => setBoardDraft((prev) => ({ ...prev, slots: prev.slots.map((entry, i) => i === index ? { ...entry, maxMult: Number(event.target.value) } : entry) }))} className="rounded border border-white/10 bg-black/20 px-2 py-1.5 text-xs text-white" />
            <input value={slot.poolId} onChange={(event) => setBoardDraft((prev) => ({ ...prev, slots: prev.slots.map((entry, i) => i === index ? { ...entry, poolId: event.target.value } : entry) }))} className="rounded border border-white/10 bg-black/20 px-2 py-1.5 text-xs text-white" />
            <button onClick={() => setBoardDraft((prev) => ({ ...prev, slots: prev.slots.map((entry, i) => i === index ? { ...entry, enabled: !entry.enabled } : entry) }))} className={`rounded border px-2 py-1 text-xs ${slot.enabled ? 'border-emerald-500/50 text-emerald-300' : 'border-white/20 text-gray-400'}`}>{slot.enabled ? 'Enabled' : 'Disabled'}</button>
          </div>
        ))}
      </div>
      <button onClick={async () => { await savePlinkoBoard(boardDraft); await reloadBoards(); }} className="mt-3 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-black">Save Board</button>

      <h4 className="mt-6 text-base font-bold text-white">Pools</h4>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <input value={selectedPoolId} onChange={(event) => setSelectedPoolId(event.target.value)} className="rounded-lg border border-white/10 bg-[#0b0e14] px-3 py-2 text-sm text-white" />
        <button onClick={() => { void reloadPoolItems(); }} className="rounded-lg border border-white/10 px-3 py-2 text-xs text-white">Reload Pool</button>
      </div>
      <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-6">
        <input placeholder="Name" value={poolDraft.name ?? ''} onChange={(event) => setPoolDraft((prev) => ({ ...prev, name: event.target.value }))} className="rounded border border-white/10 bg-[#0b0e14] px-2 py-2 text-sm text-white" />
        <input placeholder="Image URL" value={poolDraft.imageUrl ?? ''} onChange={(event) => setPoolDraft((prev) => ({ ...prev, imageUrl: event.target.value }))} className="rounded border border-white/10 bg-[#0b0e14] px-2 py-2 text-sm text-white" />
        <input type="number" placeholder="Coin value" value={poolDraft.coinValue ?? ''} onChange={(event) => setPoolDraft((prev) => ({ ...prev, coinValue: Number(event.target.value || 0) }))} className="rounded border border-white/10 bg-[#0b0e14] px-2 py-2 text-sm text-white" />
        <input placeholder="Rarity" value={poolDraft.rarity ?? ''} onChange={(event) => setPoolDraft((prev) => ({ ...prev, rarity: event.target.value }))} className="rounded border border-white/10 bg-[#0b0e14] px-2 py-2 text-sm text-white" />
        <input placeholder="Category" value={poolDraft.category ?? ''} onChange={(event) => setPoolDraft((prev) => ({ ...prev, category: event.target.value }))} className="rounded border border-white/10 bg-[#0b0e14] px-2 py-2 text-sm text-white" />
        <input type="number" placeholder="Weight" value={poolDraft.weight ?? 1} onChange={(event) => setPoolDraft((prev) => ({ ...prev, weight: Number(event.target.value || 1) }))} className="rounded border border-white/10 bg-[#0b0e14] px-2 py-2 text-sm text-white" />
      </div>
      <button onClick={async () => { await savePlinkoPoolItem(selectedPoolId, poolDraft); setPoolDraft({ enabled: true, weight: 1 }); await reloadPoolItems(); }} className="mt-2 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-black">Add to Pool</button>
      <div className="mt-3 space-y-2">
        {poolItems.map((item) => (
          <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/10 bg-[#0b0e14] p-2 text-xs text-gray-200">
            <span>{item.name} · {item.coinValue} · w:{item.weight}</span>
            <button onClick={async () => { await deletePlinkoPoolItem(selectedPoolId, item.id); await reloadPoolItems(); }} className="rounded border border-rose-500/40 px-2 py-1 text-rose-300">Delete</button>
          </div>
        ))}
      </div>

      <div className="mt-5 rounded-lg border border-white/10 bg-[#0b0e14] p-3">
        <div className="text-xs text-gray-400">Preview tool (bet + slot index)</div>
        <div className="mt-2 grid grid-cols-2 gap-2 sm:max-w-md">
          <input type="number" value={previewBet} onChange={(event) => setPreviewBet(Number(event.target.value || 0))} className="rounded border border-white/10 bg-black/20 px-2 py-1.5 text-sm text-white" />
          <input type="number" value={previewSlotIndex} onChange={(event) => setPreviewSlotIndex(Number(event.target.value || 0))} className="rounded border border-white/10 bg-black/20 px-2 py-1.5 text-sm text-white" />
        </div>
        <div className="mt-2 text-sm font-bold text-emerald-300">Band: {previewBand.minValue.toFixed(0)} - {previewBand.maxValue.toFixed(0)} coins</div>
      </div>
    </div>
  );
};
