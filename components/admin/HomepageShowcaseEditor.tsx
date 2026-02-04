import React, { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Plus, Trash2, X } from 'lucide-react';
import { useGame } from '../../context/GameContext';
import {
  MAX_SHOWCASE_BOXES,
  ShowcaseLayout,
  ShowcaseRow,
  addBoxToRow,
  addRow,
  deleteRow,
  moveBox,
  moveRow,
  normalizeShowcaseRows,
  removeBoxFromRow,
  saveHomepageConfig,
  subscribeHomepageConfig,
  updateRow
} from '../../utils/homepageShowcase';

const clampValue = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

const parseOptionalNumber = (value: string) => {
  if (value.trim() === '') return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return undefined;
  return clampValue(Math.round(parsed), 1, 6);
};

type ToastState = {
  tone: 'success' | 'error';
  message: string;
};

export const HomepageShowcaseEditor: React.FC = () => {
  const { boxes } = useGame();
  const [showcaseRows, setShowcaseRows] = useState<ShowcaseRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [activeAddRowId, setActiveAddRowId] = useState<string | null>(null);
  const [boxSearch, setBoxSearch] = useState('');

  useEffect(() => {
    const unsubscribe = subscribeHomepageConfig(
      (config) => {
        setShowcaseRows(normalizeShowcaseRows(config?.showcaseRows));
        setIsLoading(false);
      },
      () => {
        setToast({ tone: 'error', message: 'Unable to load homepage showcase rows.' });
        setIsLoading(false);
      }
    );
    return () => unsubscribe();
  }, []);

  const sortedBoxes = useMemo(() => {
    return [...boxes].sort((a, b) => a.name.localeCompare(b.name));
  }, [boxes]);

  const showToast = (tone: ToastState['tone'], message: string) => {
    setToast({ tone, message });
    window.setTimeout(() => setToast(null), 3200);
  };

  const persistRows = async (nextRows: ShowcaseRow[], successMessage?: string) => {
    setShowcaseRows(nextRows);
    try {
      await saveHomepageConfig(nextRows);
      if (successMessage) showToast('success', successMessage);
    } catch (error) {
      showToast('error', 'Something went wrong while saving.');
    }
  };

  const handleAddRow = () => {
    const nextRows = addRow(showcaseRows);
    persistRows(nextRows, 'Row added.');
  };

  const handleDeleteRow = (rowId: string) => {
    const nextRows = deleteRow(showcaseRows, rowId);
    persistRows(nextRows, 'Row removed.');
  };

  const handleMoveRow = (rowId: string, direction: 'up' | 'down') => {
    const nextRows = moveRow(showcaseRows, rowId, direction);
    persistRows(nextRows);
  };

  const handleRowPatch = (rowId: string, patch: Partial<ShowcaseRow>, save = false) => {
    const nextRows = updateRow(showcaseRows, rowId, patch);
    setShowcaseRows(nextRows);
    if (save) {
      persistRows(nextRows, 'Row updated.');
    }
  };

  const handleAddBox = (rowId: string, boxId: string) => {
    const row = showcaseRows.find((entry) => entry.id === rowId);
    if (!row) return;
    if (row.boxIds.includes(boxId)) {
      showToast('error', 'This box is already in the row.');
      return;
    }
    if (row.boxIds.length >= MAX_SHOWCASE_BOXES) {
      showToast('error', `Each row can hold up to ${MAX_SHOWCASE_BOXES} boxes.`);
      return;
    }
    const nextRows = addBoxToRow(showcaseRows, rowId, boxId);
    persistRows(nextRows, 'Box added.');
  };

  const handleRemoveBox = (rowId: string, boxId: string) => {
    const nextRows = removeBoxFromRow(showcaseRows, rowId, boxId);
    persistRows(nextRows, 'Box removed.');
  };

  const handleMoveBox = (rowId: string, boxId: string, direction: 'left' | 'right') => {
    const nextRows = moveBox(showcaseRows, rowId, boxId, direction);
    persistRows(nextRows);
  };

  const availableBoxesForRow = (row: ShowcaseRow) => {
    const filtered = sortedBoxes.filter((box) => !row.boxIds.includes(box.id));
    if (!boxSearch.trim()) return filtered;
    const search = boxSearch.toLowerCase();
    return filtered.filter(
      (box) => box.name.toLowerCase().includes(search) || box.id.toLowerCase().includes(search)
    );
  };

  return (
    <div className="space-y-6">
      {toast && (
        <div
          className={`fixed right-4 top-4 z-50 rounded-lg border px-4 py-3 text-sm font-semibold shadow-lg sm:right-6 ${
            toast.tone === 'success'
              ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-200'
              : 'border-red-500/40 bg-red-500/15 text-red-200'
          }`}
        >
          {toast.message}
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Homepage Showcase</h2>
          <p className="text-sm text-gray-400">
            Curate the rows that appear on the homepage and manage the boxes inside each row.
          </p>
        </div>
        <button
          type="button"
          onClick={handleAddRow}
          className="inline-flex items-center justify-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-gray-200 transition hover:border-white/30 hover:text-white"
        >
          <Plus className="h-4 w-4" /> Add Row
        </button>
      </div>

      {isLoading ? (
        <div className="rounded-xl border border-gray-800 bg-[#131720] p-6 text-sm text-gray-400">
          Loading showcase rows...
        </div>
      ) : (
        <div className="space-y-6">
          {showcaseRows.length === 0 && (
            <div className="rounded-xl border border-gray-800 bg-[#131720] p-6 text-sm text-gray-400">
              No homepage rows configured yet. Add a row to get started.
            </div>
          )}
          {showcaseRows.map((row, index) => {
            const selectedBoxes = row.boxIds
              .map((id) => boxes.find((box) => box.id === id))
              .filter(Boolean);
            const availableBoxes = availableBoxesForRow(row).slice(0, 10);
            return (
              <div key={row.id} className="rounded-2xl border border-gray-800 bg-[#131720] p-5 sm:p-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="flex-1 space-y-4">
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <label className="space-y-2 text-xs font-semibold uppercase tracking-widest text-gray-400">
                        Title
                        <input
                          value={row.title}
                          onChange={(event) => handleRowPatch(row.id, { title: event.target.value })}
                          onBlur={() => handleRowPatch(row.id, { title: row.title }, true)}
                          className="w-full rounded-lg border border-gray-700 bg-[#0b0e14] px-3 py-2 text-sm font-medium text-white focus:border-blue-500 focus:outline-none"
                        />
                      </label>
                      <label className="space-y-2 text-xs font-semibold uppercase tracking-widest text-gray-400">
                        Subtitle (optional)
                        <input
                          value={row.subtitle ?? ''}
                          onChange={(event) => handleRowPatch(row.id, { subtitle: event.target.value })}
                          onBlur={() => handleRowPatch(row.id, { subtitle: row.subtitle ?? '' }, true)}
                          className="w-full rounded-lg border border-gray-700 bg-[#0b0e14] px-3 py-2 text-sm font-medium text-white focus:border-blue-500 focus:outline-none"
                        />
                      </label>
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                      <label className="space-y-2 text-xs font-semibold uppercase tracking-widest text-gray-400">
                        Layout
                        <select
                          value={row.layout}
                          onChange={(event) =>
                            handleRowPatch(row.id, { layout: event.target.value as ShowcaseLayout }, true)
                          }
                          className="w-full rounded-lg border border-gray-700 bg-[#0b0e14] px-3 py-2 text-sm font-medium text-white focus:border-blue-500 focus:outline-none"
                        >
                          <option value="grid">Grid</option>
                          <option value="carousel">Carousel</option>
                        </select>
                      </label>
                      <label className="space-y-2 text-xs font-semibold uppercase tracking-widest text-gray-400">
                        Max desktop
                        <input
                          type="number"
                          min={1}
                          max={6}
                          value={row.maxDesktop ?? ''}
                          onChange={(event) =>
                            handleRowPatch(row.id, { maxDesktop: parseOptionalNumber(event.target.value) })
                          }
                          onBlur={() =>
                            handleRowPatch(row.id, { maxDesktop: row.maxDesktop }, true)
                          }
                          className="w-full rounded-lg border border-gray-700 bg-[#0b0e14] px-3 py-2 text-sm font-medium text-white focus:border-blue-500 focus:outline-none"
                        />
                      </label>
                      <label className="space-y-2 text-xs font-semibold uppercase tracking-widest text-gray-400">
                        Max mobile
                        <input
                          type="number"
                          min={1}
                          max={6}
                          value={row.maxMobile ?? ''}
                          onChange={(event) =>
                            handleRowPatch(row.id, { maxMobile: parseOptionalNumber(event.target.value) })
                          }
                          onBlur={() => handleRowPatch(row.id, { maxMobile: row.maxMobile }, true)}
                          className="w-full rounded-lg border border-gray-700 bg-[#0b0e14] px-3 py-2 text-sm font-medium text-white focus:border-blue-500 focus:outline-none"
                        />
                      </label>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleMoveRow(row.id, 'up')}
                      disabled={index === 0}
                      className="inline-flex items-center gap-1 rounded-lg border border-gray-700 px-2.5 py-1 text-xs font-semibold text-gray-200 transition hover:border-white/30 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <ArrowUp className="h-3.5 w-3.5" /> Move up
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMoveRow(row.id, 'down')}
                      disabled={index === showcaseRows.length - 1}
                      className="inline-flex items-center gap-1 rounded-lg border border-gray-700 px-2.5 py-1 text-xs font-semibold text-gray-200 transition hover:border-white/30 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <ArrowDown className="h-3.5 w-3.5" /> Move down
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteRow(row.id)}
                      className="inline-flex items-center gap-1 rounded-lg border border-red-500/40 px-2.5 py-1 text-xs font-semibold text-red-200 transition hover:border-red-400 hover:text-white"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Delete
                    </button>
                  </div>
                </div>

                <div className="mt-6 space-y-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h4 className="text-sm font-semibold text-white">Selected boxes</h4>
                      <p className="text-xs text-gray-400">
                        {row.boxIds.length} / {MAX_SHOWCASE_BOXES} boxes selected
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveAddRowId((prev) => (prev === row.id ? null : row.id));
                        setBoxSearch('');
                      }}
                      className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-gray-200 transition hover:border-white/30 hover:text-white"
                    >
                      <Plus className="h-3.5 w-3.5" /> Add box
                    </button>
                  </div>

                  {selectedBoxes.length === 0 ? (
                    <div className="rounded-lg border border-gray-800 bg-[#0b0e14] p-4 text-xs text-gray-400">
                      No boxes selected yet. Add boxes to populate this row.
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {selectedBoxes.map((box) => (
                        <div
                          key={box?.id}
                          className="flex items-center gap-2 rounded-full border border-gray-700 bg-[#0b0e14] px-3 py-1 text-xs font-semibold text-gray-200"
                        >
                          <span>{box?.name}</span>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => box?.id && handleMoveBox(row.id, box.id, 'left')}
                              className="rounded-full p-0.5 text-gray-400 transition hover:text-white"
                            >
                              <ChevronLeft className="h-3 w-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => box?.id && handleMoveBox(row.id, box.id, 'right')}
                              className="rounded-full p-0.5 text-gray-400 transition hover:text-white"
                            >
                              <ChevronRight className="h-3 w-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => box?.id && handleRemoveBox(row.id, box.id)}
                              className="rounded-full p-0.5 text-gray-400 transition hover:text-white"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {activeAddRowId === row.id && (
                    <div className="rounded-xl border border-gray-800 bg-[#0b0e14] p-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <input
                          value={boxSearch}
                          onChange={(event) => setBoxSearch(event.target.value)}
                          placeholder="Search boxes..."
                          className="w-full rounded-lg border border-gray-700 bg-[#050811] px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:border-blue-500 focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => setActiveAddRowId(null)}
                          className="inline-flex items-center gap-1 rounded-full border border-gray-700 px-3 py-1 text-xs font-semibold text-gray-200 transition hover:border-white/30 hover:text-white"
                        >
                          Close
                        </button>
                      </div>
                      <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
                        {availableBoxes.length === 0 ? (
                          <div className="rounded-lg border border-gray-800 bg-[#050811] p-3 text-xs text-gray-400 sm:col-span-2">
                            No boxes match this search.
                          </div>
                        ) : (
                          availableBoxes.map((box) => (
                            <button
                              key={box.id}
                              type="button"
                              onClick={() => handleAddBox(row.id, box.id)}
                              className="flex items-center justify-between gap-3 rounded-lg border border-gray-800 bg-[#050811] px-3 py-2 text-left text-xs font-semibold text-gray-200 transition hover:border-white/20 hover:text-white"
                            >
                              <span>{box.name}</span>
                              <Plus className="h-3.5 w-3.5" />
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
