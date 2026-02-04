import { Timestamp, doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../firebase';

export type BoxesPageTabId = 'official' | 'community' | 'category';

export type BoxesPageTabItem = {
  id: BoxesPageTabId;
  label: string;
  enabled: boolean;
};

export type BoxesPageTabsConfig = {
  enabled: boolean;
  items: BoxesPageTabItem[];
  defaultTabId: BoxesPageTabId;
};

export type BoxesPageFiltersConfig = {
  search: { enabled: boolean; placeholder?: string };
  category: { enabled: boolean; default?: string; options?: string[] };
  sort: { enabled: boolean; default?: string; options?: string[] };
  tagChips: { enabled: boolean; label?: string; popularTags?: string[] };
  mobile: {
    compactTop: boolean;
    collapseTagChips: boolean;
    minimalTopRow: boolean;
  };
};

export type BoxesPageCuratedRow = {
  id: string;
  title: string;
  subtitle?: string;
  enabled: boolean;
  mode: 'byIds' | 'byFilter';
  layout: 'grid' | 'carousel';
  maxDesktop?: number;
  maxMobile?: number;
  boxIds?: string[];
  filter?: {
    tag?: string;
    category?: string;
    minPrice?: number;
    maxPrice?: number;
    sort?: string;
  };
};

export type BoxesPageConfig = {
  updatedAt?: Timestamp;
  tabs: BoxesPageTabsConfig;
  filters: BoxesPageFiltersConfig;
  curatedRows: BoxesPageCuratedRow[];
};

export const DEFAULT_BOXES_PAGE_CONFIG: BoxesPageConfig = {
  tabs: {
    enabled: true,
    items: [
      { id: 'official', label: 'Our Mystery Boxes', enabled: true },
      { id: 'community', label: 'Community Mystery Boxes', enabled: true },
      { id: 'category', label: 'Browse by Category', enabled: true }
    ],
    defaultTabId: 'official'
  },
  filters: {
    search: { enabled: true, placeholder: 'Search boxes' },
    category: { enabled: true, default: 'All' },
    sort: { enabled: true, default: 'Popular' },
    tagChips: { enabled: true, label: 'Popular tags' },
    mobile: {
      compactTop: true,
      collapseTagChips: true,
      minimalTopRow: true
    }
  },
  curatedRows: []
};

const BOXES_PAGE_DOC_REF = doc(db, 'site', 'boxesPage');

const generateRowId = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `row_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
};

const normalizeTabs = (tabs?: Partial<BoxesPageTabsConfig> | null): BoxesPageTabsConfig => {
  const items = (tabs?.items ?? DEFAULT_BOXES_PAGE_CONFIG.tabs.items).map((item) => ({
    id: item.id,
    label: item.label ?? DEFAULT_BOXES_PAGE_CONFIG.tabs.items.find((tab) => tab.id === item.id)?.label ?? item.id,
    enabled: item.enabled ?? true
  }));
  return {
    enabled: tabs?.enabled ?? DEFAULT_BOXES_PAGE_CONFIG.tabs.enabled,
    items,
    defaultTabId: tabs?.defaultTabId ?? DEFAULT_BOXES_PAGE_CONFIG.tabs.defaultTabId
  };
};

const normalizeFilters = (filters?: Partial<BoxesPageFiltersConfig> | null): BoxesPageFiltersConfig => ({
  search: {
    enabled: filters?.search?.enabled ?? DEFAULT_BOXES_PAGE_CONFIG.filters.search.enabled,
    placeholder: filters?.search?.placeholder ?? DEFAULT_BOXES_PAGE_CONFIG.filters.search.placeholder
  },
  category: {
    enabled: filters?.category?.enabled ?? DEFAULT_BOXES_PAGE_CONFIG.filters.category.enabled,
    default: filters?.category?.default ?? DEFAULT_BOXES_PAGE_CONFIG.filters.category.default,
    options: filters?.category?.options ?? DEFAULT_BOXES_PAGE_CONFIG.filters.category.options
  },
  sort: {
    enabled: filters?.sort?.enabled ?? DEFAULT_BOXES_PAGE_CONFIG.filters.sort.enabled,
    default: filters?.sort?.default ?? DEFAULT_BOXES_PAGE_CONFIG.filters.sort.default,
    options: filters?.sort?.options ?? DEFAULT_BOXES_PAGE_CONFIG.filters.sort.options
  },
  tagChips: {
    enabled: filters?.tagChips?.enabled ?? DEFAULT_BOXES_PAGE_CONFIG.filters.tagChips.enabled,
    label: filters?.tagChips?.label ?? DEFAULT_BOXES_PAGE_CONFIG.filters.tagChips.label,
    popularTags: filters?.tagChips?.popularTags ?? DEFAULT_BOXES_PAGE_CONFIG.filters.tagChips.popularTags
  },
  mobile: {
    compactTop: filters?.mobile?.compactTop ?? DEFAULT_BOXES_PAGE_CONFIG.filters.mobile.compactTop,
    collapseTagChips: filters?.mobile?.collapseTagChips ?? DEFAULT_BOXES_PAGE_CONFIG.filters.mobile.collapseTagChips,
    minimalTopRow: filters?.mobile?.minimalTopRow ?? DEFAULT_BOXES_PAGE_CONFIG.filters.mobile.minimalTopRow
  }
});

export const buildBoxesPageConfig = (data?: Partial<BoxesPageConfig> | null): BoxesPageConfig => ({
  updatedAt: data?.updatedAt,
  tabs: normalizeTabs(data?.tabs),
  filters: normalizeFilters(data?.filters),
  curatedRows: Array.isArray(data?.curatedRows) ? data?.curatedRows ?? [] : DEFAULT_BOXES_PAGE_CONFIG.curatedRows
});

export const subscribeBoxesPageConfig = (
  onData: (config: BoxesPageConfig) => void,
  onError?: (error: Error) => void
) =>
  onSnapshot(
    BOXES_PAGE_DOC_REF,
    (snapshot) => {
      if (!snapshot.exists()) {
        onData(DEFAULT_BOXES_PAGE_CONFIG);
        return;
      }
      const data = snapshot.data() as BoxesPageConfig;
      onData(buildBoxesPageConfig(data));
    },
    (error) => {
      if (onError) onError(error as Error);
    }
  );

export const saveBoxesPageConfig = async (config: BoxesPageConfig) => {
  await setDoc(BOXES_PAGE_DOC_REF, { ...config, updatedAt: Timestamp.now() }, { merge: true });
};

export const addCuratedRow = (rows: BoxesPageCuratedRow[]) => {
  const newRow: BoxesPageCuratedRow = {
    id: generateRowId(),
    title: 'New Curated Row',
    enabled: true,
    mode: 'byIds',
    layout: 'grid',
    maxDesktop: 4,
    maxMobile: 2,
    boxIds: [],
    filter: {}
  };
  return [...rows, newRow];
};

export const updateCuratedRow = (
  rows: BoxesPageCuratedRow[],
  rowId: string,
  patch: Partial<BoxesPageCuratedRow>
) =>
  rows.map((row) =>
    row.id === rowId
      ? {
          ...row,
          ...patch
        }
      : row
  );

export const deleteCuratedRow = (rows: BoxesPageCuratedRow[], rowId: string) =>
  rows.filter((row) => row.id !== rowId);

const moveItem = <T,>(items: T[], from: number, to: number) => {
  const next = [...items];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
};

export const moveCuratedRow = (
  rows: BoxesPageCuratedRow[],
  rowId: string,
  direction: 'up' | 'down'
) => {
  const index = rows.findIndex((row) => row.id === rowId);
  if (index === -1) return rows;
  const nextIndex = direction === 'up' ? index - 1 : index + 1;
  if (nextIndex < 0 || nextIndex >= rows.length) return rows;
  return moveItem(rows, index, nextIndex);
};

export const moveCuratedBox = (
  rows: BoxesPageCuratedRow[],
  rowId: string,
  boxId: string,
  direction: 'left' | 'right'
) =>
  rows.map((row) => {
    if (row.id !== rowId) return row;
    const list = row.boxIds ?? [];
    const index = list.indexOf(boxId);
    if (index === -1) return row;
    const nextIndex = direction === 'left' ? index - 1 : index + 1;
    if (nextIndex < 0 || nextIndex >= list.length) return row;
    return {
      ...row,
      boxIds: moveItem(list, index, nextIndex)
    };
  });
