import { Timestamp, doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { sanitizeForFirestore } from './firestoreSanitize';

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
  category: { enabled: boolean; default?: string; options: string[] };
  sort: { enabled: boolean; default?: string; options: string[] };
  tagChips: { enabled: boolean; label?: string; popularTags: string[] };
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

const DEFAULT_CONFIG: BoxesPageConfig = {
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
    category: { enabled: true, default: 'All', options: [] },
    sort: { enabled: true, default: 'Popular', options: [] },
    tagChips: { enabled: true, label: 'Popular tags', popularTags: [] },
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

const normalizeOptions = (value: unknown) =>
  Array.isArray(value)
    ? value
        .map((item) => String(item).trim())
        .filter(Boolean)
    : [];

export const getDefaultBoxesPageConfig = (): BoxesPageConfig => ({
  ...DEFAULT_CONFIG,
  tabs: {
    ...DEFAULT_CONFIG.tabs,
    items: DEFAULT_CONFIG.tabs.items.map((item) => ({ ...item }))
  },
  filters: {
    ...DEFAULT_CONFIG.filters,
    category: { ...DEFAULT_CONFIG.filters.category, options: [] },
    sort: { ...DEFAULT_CONFIG.filters.sort, options: [] },
    tagChips: { ...DEFAULT_CONFIG.filters.tagChips, popularTags: [] },
    mobile: { ...DEFAULT_CONFIG.filters.mobile }
  },
  curatedRows: []
});

export const normalizeBoxesPageConfig = (raw: unknown): BoxesPageConfig => {
  const source = (raw ?? {}) as Partial<BoxesPageConfig>;
  const defaultConfig = getDefaultBoxesPageConfig();

  const tabsItems = Array.isArray(source.tabs?.items)
    ? source.tabs!.items
        .filter((item) => item && typeof item === 'object')
        .map((item) => {
          const id = (item as BoxesPageTabItem).id;
          const defaultLabel = defaultConfig.tabs.items.find((tab) => tab.id === id)?.label ?? 'Tab';
          return {
            id,
            label: String((item as BoxesPageTabItem).label ?? defaultLabel),
            enabled: Boolean((item as BoxesPageTabItem).enabled ?? true)
          } as BoxesPageTabItem;
        })
    : defaultConfig.tabs.items;

  const curatedRows = Array.isArray(source.curatedRows)
    ? source.curatedRows
        .filter((row) => row && typeof row === 'object' && (row as BoxesPageCuratedRow).id)
        .map((row) => {
          const item = row as BoxesPageCuratedRow;
          return {
            id: String(item.id),
            title: String(item.title ?? 'Curated Row'),
            subtitle: item.subtitle ? String(item.subtitle) : undefined,
            enabled: Boolean(item.enabled ?? true),
            mode: item.mode === 'byFilter' ? 'byFilter' : 'byIds',
            layout: item.layout === 'carousel' ? 'carousel' : 'grid',
            maxDesktop: item.maxDesktop,
            maxMobile: item.maxMobile,
            boxIds: Array.isArray(item.boxIds) ? item.boxIds.map(String) : [],
            filter: {
              tag: item.filter?.tag ? String(item.filter.tag) : undefined,
              category: item.filter?.category ? String(item.filter.category) : undefined,
              minPrice: typeof item.filter?.minPrice === 'number' ? item.filter?.minPrice : undefined,
              maxPrice: typeof item.filter?.maxPrice === 'number' ? item.filter?.maxPrice : undefined,
              sort: item.filter?.sort ? String(item.filter.sort) : undefined
            }
          } as BoxesPageCuratedRow;
        })
    : [];

  return {
    updatedAt: source.updatedAt,
    tabs: {
      enabled: source.tabs?.enabled ?? defaultConfig.tabs.enabled,
      items: tabsItems,
      defaultTabId: source.tabs?.defaultTabId ?? defaultConfig.tabs.defaultTabId
    },
    filters: {
      search: {
        enabled: source.filters?.search?.enabled ?? defaultConfig.filters.search.enabled,
        placeholder: source.filters?.search?.placeholder ?? defaultConfig.filters.search.placeholder
      },
      category: {
        enabled: source.filters?.category?.enabled ?? defaultConfig.filters.category.enabled,
        default: source.filters?.category?.default ?? defaultConfig.filters.category.default,
        options: normalizeOptions(source.filters?.category?.options)
      },
      sort: {
        enabled: source.filters?.sort?.enabled ?? defaultConfig.filters.sort.enabled,
        default: source.filters?.sort?.default ?? defaultConfig.filters.sort.default,
        options: normalizeOptions(source.filters?.sort?.options)
      },
      tagChips: {
        enabled: source.filters?.tagChips?.enabled ?? defaultConfig.filters.tagChips.enabled,
        label: source.filters?.tagChips?.label ?? defaultConfig.filters.tagChips.label,
        popularTags: normalizeOptions(source.filters?.tagChips?.popularTags)
      },
      mobile: {
        compactTop: source.filters?.mobile?.compactTop ?? defaultConfig.filters.mobile.compactTop,
        collapseTagChips: source.filters?.mobile?.collapseTagChips ?? defaultConfig.filters.mobile.collapseTagChips,
        minimalTopRow: source.filters?.mobile?.minimalTopRow ?? defaultConfig.filters.mobile.minimalTopRow
      }
    },
    curatedRows
  };
};

export const prepareBoxesPageConfigForSave = (config: BoxesPageConfig) => {
  const normalized = normalizeBoxesPageConfig(config);
  return sanitizeForFirestore({ ...normalized, updatedAt: Timestamp.now() });
};

export const subscribeBoxesPageConfig = (
  onData: (config: BoxesPageConfig) => void,
  onError?: (error: Error) => void
) =>
  onSnapshot(
    BOXES_PAGE_DOC_REF,
    (snapshot) => {
      if (!snapshot.exists()) {
        onData(getDefaultBoxesPageConfig());
        return;
      }
      const data = snapshot.data();
      onData(normalizeBoxesPageConfig(data));
    },
    (error) => {
      if (onError) onError(error as Error);
    }
  );

export const saveBoxesPageConfig = async (config: BoxesPageConfig) => {
  const payload = prepareBoxesPageConfigForSave(config);
  await setDoc(BOXES_PAGE_DOC_REF, payload, { merge: true });
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
