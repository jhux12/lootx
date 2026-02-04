import React, { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react';
import { MysteryBox } from '../../types';
import { usePreview } from '../../context/PreviewContext';
import { Checkbox } from '../ui/Checkbox';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import {
  BoxesPageConfig,
  BoxesPageCuratedRow,
  addCuratedRow,
  deleteCuratedRow,
  getDefaultBoxesPageConfig,
  moveCuratedBox,
  moveCuratedRow,
  normalizeBoxesPageConfig,
  prepareBoxesPageConfigForSave,
  saveBoxesPageConfig,
  subscribeBoxesPageConfig,
  updateCuratedRow
} from '../../utils/boxesPageConfig';

const optionListFromString = (value: string) =>
  value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

const listToString = (items?: string[]) => (items && items.length > 0 ? items.join(', ') : '');

type BoxesPageConfigEditorProps = {
  boxes: MysteryBox[];
};

export const BoxesPageConfigEditor: React.FC<BoxesPageConfigEditorProps> = ({ boxes }) => {
  const { previewAsUser, setPreviewAsUser } = usePreview();
  const [draft, setDraft] = useState<BoxesPageConfig>(getDefaultBoxesPageConfig());
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveNotice, setSaveNotice] = useState('');
  const [saveError, setSaveError] = useState('');
  const [boxSearch, setBoxSearch] = useState<Record<string, string>>({});

  useEffect(() => {
    const unsubscribe = subscribeBoxesPageConfig((config) => {
      const normalized = normalizeBoxesPageConfig(config);
      if (!isDirty) {
        setDraft(normalized);
      }
    });
    return () => unsubscribe();
  }, [isDirty]);

  const handleDraftChange = (patch: Partial<BoxesPageConfig>) => {
    setDraft((prev) => ({ ...prev, ...patch }));
    setIsDirty(true);
  };

  const updateTabs = (patch: Partial<BoxesPageConfig['tabs']>) => {
    handleDraftChange({ tabs: { ...draft.tabs, ...patch } });
  };

  const updateFilters = (patch: Partial<BoxesPageConfig['filters']>) => {
    handleDraftChange({ filters: { ...draft.filters, ...patch } });
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveError('');
    try {
      await saveBoxesPageConfig(draft);
      setIsDirty(false);
      setSaveNotice('Saved boxes page configuration.');
      window.setTimeout(() => setSaveNotice(''), 3000);
    } catch (error) {
      console.error('Failed to save boxes page config', error);
      if (import.meta.env.DEV) {
        console.debug('Boxes page config payload', prepareBoxesPageConfigForSave(draft));
      }
      setSaveError('Unable to save. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const curatedRows = draft.curatedRows ?? [];

  const updateRow = (rowId: string, patch: Partial<BoxesPageCuratedRow>) => {
    handleDraftChange({ curatedRows: updateCuratedRow(curatedRows, rowId, patch) });
  };

  const moveRow = (rowId: string, direction: 'up' | 'down') => {
    handleDraftChange({ curatedRows: moveCuratedRow(curatedRows, rowId, direction) });
  };

  const removeRow = (rowId: string) => {
    handleDraftChange({ curatedRows: deleteCuratedRow(curatedRows, rowId) });
  };

  const addRow = () => {
    handleDraftChange({ curatedRows: addCuratedRow(curatedRows) });
  };

  const handleBoxAdd = (rowId: string, boxId: string) => {
    const row = curatedRows.find((item) => item.id === rowId);
    if (!row) return;
    const boxIds = row.boxIds ?? [];
    if (boxIds.includes(boxId)) return;
    updateRow(rowId, { boxIds: [...boxIds, boxId] });
  };

  const handleBoxRemove = (rowId: string, boxId: string) => {
    const row = curatedRows.find((item) => item.id === rowId);
    if (!row) return;
    updateRow(rowId, { boxIds: (row.boxIds ?? []).filter((id) => id !== boxId) });
  };

  const handleBoxMove = (rowId: string, boxId: string, direction: 'left' | 'right') => {
    handleDraftChange({ curatedRows: moveCuratedBox(curatedRows, rowId, boxId, direction) });
  };

  const tabOptions = draft.tabs.items;

  const selectedDefaultTab = tabOptions.find((tab) => tab.id === draft.tabs.defaultTabId)?.id ?? 'official';

  return (
    <div className="space-y-8">
      <div className="rounded-2xl border border-gray-800 bg-[#0f131c] p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-white">Boxes Page Configuration</h2>
            <p className="text-sm text-gray-400">Control tabs, filters, curated rows, and mobile layout.</p>
          </div>
          <div className="flex items-center gap-3">
            {saveNotice && <span className="text-xs text-emerald-400">{saveNotice}</span>}
            {saveError && <span className="text-xs text-red-400">{saveError}</span>}
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="rounded-full bg-blue-600 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white transition hover:bg-blue-500 disabled:opacity-60"
            >
              {isSaving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-[#0b0f1a] p-4">
          <div className="flex flex-1 items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-white">Preview as user</p>
              <p className="text-xs text-gray-400">See the Boxes page without admin-only controls.</p>
            </div>
            <button
              type="button"
              onClick={() => setPreviewAsUser(!previewAsUser)}
              className={`rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-wide transition ${
                previewAsUser ? 'bg-emerald-500/20 text-emerald-200 border border-emerald-500/40' : 'bg-[#141826] text-gray-300 border border-white/10'
              }`}
            >
              {previewAsUser ? 'On' : 'Off'}
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-800 bg-[#0f131c] p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Tabs</h3>
        <div className="space-y-3">
          <label className="flex items-center gap-3 text-sm text-gray-300">
            <Checkbox
              checked={draft.tabs.enabled}
              onChange={(event) => updateTabs({ enabled: event.target.checked })}
            />
            Enable tabs row
          </label>
          <div className="grid gap-3 md:grid-cols-3">
            {tabOptions.map((tab) => (
              <div key={tab.id} className="rounded-xl border border-white/10 bg-[#0b0f1a] p-3 space-y-2">
                <label className="flex items-center gap-2 text-xs text-gray-400 uppercase tracking-wide">
                  <Checkbox
                    checked={tab.enabled}
                    onChange={(event) =>
                      updateTabs({
                        items: tabOptions.map((item) =>
                          item.id === tab.id ? { ...item, enabled: event.target.checked } : item
                        )
                      })
                    }
                  />
                  {tab.id}
                </label>
                <Input
                  value={tab.label}
                  onChange={(event) =>
                    updateTabs({
                      items: tabOptions.map((item) =>
                        item.id === tab.id ? { ...item, label: event.target.value } : item
                      )
                    })
                  }
                />
              </div>
            ))}
          </div>
          <div className="max-w-xs">
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Default tab</label>
            <Select
              value={selectedDefaultTab}
              onChange={(event) => updateTabs({ defaultTabId: event.target.value as BoxesPageConfig['tabs']['defaultTabId'] })}
            >
              {tabOptions.map((tab) => (
                <option key={tab.id} value={tab.id}>
                  {tab.label}
                </option>
              ))}
            </Select>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-800 bg-[#0f131c] p-6 space-y-6">
        <h3 className="text-lg font-semibold text-white">Filters</h3>
        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-3 rounded-xl border border-white/10 bg-[#0b0f1a] p-4">
            <label className="flex items-center gap-3 text-sm text-gray-300">
              <Checkbox
                checked={draft.filters.search.enabled}
                onChange={(event) => updateFilters({ search: { ...draft.filters.search, enabled: event.target.checked } })}
              />
              Enable search
            </label>
            <Input
              value={draft.filters.search.placeholder ?? ''}
              onChange={(event) => updateFilters({ search: { ...draft.filters.search, placeholder: event.target.value } })}
              placeholder="Search placeholder"
              className="w-full rounded-lg border border-gray-700 bg-[#0b0e14] px-3 py-2 text-sm text-gray-200 focus:border-brand-purple focus:outline-none"
            />
          </div>

          <div className="space-y-3 rounded-xl border border-white/10 bg-[#0b0f1a] p-4">
            <label className="flex items-center gap-3 text-sm text-gray-300">
              <Checkbox
                checked={draft.filters.category.enabled}
                onChange={(event) => updateFilters({ category: { ...draft.filters.category, enabled: event.target.checked } })}
              />
              Enable category
            </label>
            <Input
              value={draft.filters.category.default ?? ''}
              onChange={(event) => updateFilters({ category: { ...draft.filters.category, default: event.target.value } })}
              placeholder="Default category"
            />
            <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">Options (comma separated)</label>
            <Input
              value={listToString(draft.filters.category.options)}
              onChange={(event) =>
                updateFilters({ category: { ...draft.filters.category, options: optionListFromString(event.target.value) } })
              }
              placeholder="All, Tech, Pokemon"
            />
          </div>

          <div className="space-y-3 rounded-xl border border-white/10 bg-[#0b0f1a] p-4">
            <label className="flex items-center gap-3 text-sm text-gray-300">
              <Checkbox
                checked={draft.filters.sort.enabled}
                onChange={(event) => updateFilters({ sort: { ...draft.filters.sort, enabled: event.target.checked } })}
              />
              Enable sort
            </label>
            <Input
              value={draft.filters.sort.default ?? ''}
              onChange={(event) => updateFilters({ sort: { ...draft.filters.sort, default: event.target.value } })}
              placeholder="Default sort"
            />
            <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">Options (comma separated)</label>
            <Input
              value={listToString(draft.filters.sort.options)}
              onChange={(event) =>
                updateFilters({ sort: { ...draft.filters.sort, options: optionListFromString(event.target.value) } })
              }
              placeholder="Popular, Price Low, Price High"
            />
          </div>

          <div className="space-y-3 rounded-xl border border-white/10 bg-[#0b0f1a] p-4">
            <label className="flex items-center gap-3 text-sm text-gray-300">
              <Checkbox
                checked={draft.filters.tagChips.enabled}
                onChange={(event) => updateFilters({ tagChips: { ...draft.filters.tagChips, enabled: event.target.checked } })}
              />
              Enable tag chips
            </label>
            <Input
              value={draft.filters.tagChips.label ?? ''}
              onChange={(event) => updateFilters({ tagChips: { ...draft.filters.tagChips, label: event.target.value } })}
              placeholder="Label"
            />
            <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">Popular tags (comma separated)</label>
            <Input
              value={listToString(draft.filters.tagChips.popularTags)}
              onChange={(event) =>
                updateFilters({ tagChips: { ...draft.filters.tagChips, popularTags: optionListFromString(event.target.value) } })
              }
              placeholder="pokemon, tech, holiday"
            />
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-[#0b0f1a] p-4">
          <h4 className="text-sm font-semibold text-white mb-3">Mobile layout</h4>
          <div className="flex flex-wrap gap-4 text-sm text-gray-300">
            <label className="flex items-center gap-2">
              <Checkbox
                checked={draft.filters.mobile.compactTop}
                onChange={(event) => updateFilters({ mobile: { ...draft.filters.mobile, compactTop: event.target.checked } })}
              />
              Compact header
            </label>
            <label className="flex items-center gap-2">
              <Checkbox
                checked={draft.filters.mobile.collapseTagChips}
                onChange={(event) => updateFilters({ mobile: { ...draft.filters.mobile, collapseTagChips: event.target.checked } })}
              />
              Collapse tags
            </label>
            <label className="flex items-center gap-2">
              <Checkbox
                checked={draft.filters.mobile.minimalTopRow}
                onChange={(event) => updateFilters({ mobile: { ...draft.filters.mobile, minimalTopRow: event.target.checked } })}
              />
              Minimal top row
            </label>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-800 bg-[#0f131c] p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">Curated Rows</h3>
          <button
            type="button"
            onClick={addRow}
            className="inline-flex items-center gap-2 rounded-full bg-purple-600/20 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-purple-200 transition hover:bg-purple-600/30"
          >
            <Plus className="h-4 w-4" /> Add row
          </button>
        </div>

        {curatedRows.length === 0 && (
          <div className="rounded-xl border border-dashed border-gray-800 bg-[#0b0e14] p-4 text-sm text-gray-500">
            No curated rows yet.
          </div>
        )}

        <div className="space-y-4">
          {curatedRows.map((row, index) => {
            const searchValue = boxSearch[row.id] ?? '';
            const filteredBoxes = boxes
              .filter((box) => box.name.toLowerCase().includes(searchValue.toLowerCase()))
              .slice(0, 12);

            return (
              <div key={row.id} className="rounded-xl border border-white/10 bg-[#0b0f1a] p-4 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 text-sm text-gray-300">
                      <Checkbox
                        checked={row.enabled}
                        onChange={(event) => updateRow(row.id, { enabled: event.target.checked })}
                      />
                      Enabled
                    </label>
                    <span className="text-xs uppercase tracking-wide text-gray-500">Row {index + 1}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => moveRow(row.id, 'up')}
                      className="rounded-full border border-white/10 p-2 text-gray-400 transition hover:text-white"
                      aria-label="Move row up"
                    >
                      <ChevronUp className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveRow(row.id, 'down')}
                      className="rounded-full border border-white/10 p-2 text-gray-400 transition hover:text-white"
                      aria-label="Move row down"
                    >
                      <ChevronDown className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeRow(row.id)}
                      className="rounded-full border border-white/10 p-2 text-gray-400 transition hover:text-white"
                      aria-label="Delete row"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <Input
                    value={row.title}
                    onChange={(event) => updateRow(row.id, { title: event.target.value })}
                    placeholder="Row title"
                  />
                  <Input
                    value={row.subtitle ?? ''}
                    onChange={(event) => updateRow(row.id, { subtitle: event.target.value })}
                    placeholder="Subtitle (optional)"
                  />
                  <Select
                    value={row.layout}
                    onChange={(event) => updateRow(row.id, { layout: event.target.value as BoxesPageCuratedRow['layout'] })}
                  >
                    <option value="grid">Grid</option>
                    <option value="carousel">Carousel</option>
                  </Select>
                  <Select
                    value={row.mode}
                    onChange={(event) => updateRow(row.id, { mode: event.target.value as BoxesPageCuratedRow['mode'] })}
                  >
                    <option value="byIds">By IDs</option>
                    <option value="byFilter">By Filter</option>
                  </Select>
                  <Input
                    type="number"
                    value={row.maxDesktop ?? ''}
                    onChange={(event) => updateRow(row.id, { maxDesktop: Number(event.target.value) || undefined })}
                    placeholder="Max desktop"
                  />
                  <Input
                    type="number"
                    value={row.maxMobile ?? ''}
                    onChange={(event) => updateRow(row.id, { maxMobile: Number(event.target.value) || undefined })}
                    placeholder="Max mobile"
                  />
                </div>

                {row.mode === 'byIds' ? (
                  <div className="space-y-3">
                    <Input
                      value={searchValue}
                      onChange={(event) => setBoxSearch((prev) => ({ ...prev, [row.id]: event.target.value }))}
                      placeholder="Search boxes to add"
                    />
                    <div className="flex flex-wrap gap-2">
                      {filteredBoxes.map((box) => (
                        <button
                          key={box.id}
                          type="button"
                          onClick={() => handleBoxAdd(row.id, box.id)}
                          className="rounded-full border border-white/10 bg-[#141826] px-3 py-1 text-xs text-gray-300 transition hover:text-white"
                        >
                          {box.name}
                        </button>
                      ))}
                    </div>

                    {(row.boxIds ?? []).length > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs uppercase tracking-wide text-gray-500">Selected boxes</p>
                        <div className="flex flex-wrap gap-2">
                          {(row.boxIds ?? []).map((boxId) => {
                            const box = boxes.find((item) => item.id === boxId);
                            if (!box) return null;
                            return (
                              <div key={boxId} className="flex items-center gap-2 rounded-full border border-white/10 bg-[#0f141f] px-3 py-1 text-xs text-gray-300">
                                <span>{box.name}</span>
                                <div className="flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => handleBoxMove(row.id, boxId, 'left')}
                                    className="text-gray-400 transition hover:text-white"
                                    aria-label="Move left"
                                  >
                                    <ChevronUp className="h-3 w-3 -rotate-90" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleBoxMove(row.id, boxId, 'right')}
                                    className="text-gray-400 transition hover:text-white"
                                    aria-label="Move right"
                                  >
                                    <ChevronDown className="h-3 w-3 -rotate-90" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleBoxRemove(row.id, boxId)}
                                    className="text-gray-400 transition hover:text-white"
                                    aria-label="Remove box"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="grid gap-3 md:grid-cols-2">
                    <Input
                      value={row.filter?.tag ?? ''}
                      onChange={(event) => updateRow(row.id, { filter: { ...row.filter, tag: event.target.value } })}
                      placeholder="Tag"
                    />
                    <Input
                      value={row.filter?.category ?? ''}
                      onChange={(event) => updateRow(row.id, { filter: { ...row.filter, category: event.target.value } })}
                      placeholder="Category"
                    />
                    <Input
                      type="number"
                      value={row.filter?.minPrice ?? ''}
                      onChange={(event) => updateRow(row.id, { filter: { ...row.filter, minPrice: Number(event.target.value) || undefined } })}
                      placeholder="Min price"
                    />
                    <Input
                      type="number"
                      value={row.filter?.maxPrice ?? ''}
                      onChange={(event) => updateRow(row.id, { filter: { ...row.filter, maxPrice: Number(event.target.value) || undefined } })}
                      placeholder="Max price"
                    />
                    <Input
                      value={row.filter?.sort ?? ''}
                      onChange={(event) => updateRow(row.id, { filter: { ...row.filter, sort: event.target.value } })}
                      placeholder="Sort (e.g. Popular)"
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
