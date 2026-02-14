import { Timestamp, doc, getDoc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../firebase';

export type ShowcaseLayout = 'grid' | 'carousel';

export type ShowcaseCategoryCard = {
  id: string;
  label: string;
  categorySlug: string;
  imageUrl: string;
};

type ShowcaseRowBase = {
  id: string;
  title: string;
  subtitle: string;
  maxDesktop: number;
  maxMobile: number;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
};

export type ShowcaseRowBoxes = ShowcaseRowBase & {
  type: 'boxes';
  layout: ShowcaseLayout;
  boxIds: string[];
};

export type ShowcaseRowCategories = ShowcaseRowBase & {
  type: 'categories';
  categories: ShowcaseCategoryCard[];
};

export type ShowcaseRow = ShowcaseRowBoxes | ShowcaseRowCategories;

export type HomepageConfig = {
  showcaseRows: ShowcaseRow[];
  demoSpinnerBoxId?: string;
};

export const MAX_SHOWCASE_BOXES = 12;

const HOMEPAGE_DOC_REF = doc(db, 'site', 'homepage');

const generateRowId = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `row_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
};

const normalizeCount = (value: unknown, fallback: number) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  const rounded = Math.round(value);
  if (rounded < 1) return fallback;
  return rounded;
};

export const normalizeShowcaseRow = (
  row: Partial<ShowcaseRow> & Record<string, unknown>
): ShowcaseRow => {
  const type = row.type === 'categories' ? 'categories' : 'boxes';
  const timestampFields = {
    ...(row.createdAt ? { createdAt: row.createdAt } : {}),
    ...(row.updatedAt ? { updatedAt: row.updatedAt } : {})
  };
  const base = {
    id: typeof row.id === 'string' && row.id.trim() ? row.id : generateRowId(),
    title: typeof row.title === 'string' ? row.title : 'Homepage Row',
    subtitle: typeof row.subtitle === 'string' ? row.subtitle : '',
    maxDesktop: normalizeCount(row.maxDesktop, 4),
    maxMobile: normalizeCount(row.maxMobile, 2),
    ...timestampFields
  };

  if (type === 'categories') {
    const categories = Array.isArray((row as ShowcaseRowCategories).categories)
      ? (row as ShowcaseRowCategories).categories
      : [];
    return {
      ...base,
      type,
      categories: categories.map((category) => ({
        id: typeof category.id === 'string' && category.id.trim() ? category.id : generateRowId(),
        label: typeof category.label === 'string' ? category.label : '',
        categorySlug: typeof category.categorySlug === 'string' ? category.categorySlug : '',
        imageUrl: typeof category.imageUrl === 'string' ? category.imageUrl : ''
      }))
    };
  }

  return {
    ...base,
    type,
    layout: row.layout === 'carousel' ? 'carousel' : 'grid',
    boxIds: Array.isArray((row as ShowcaseRowBoxes).boxIds)
      ? (row as ShowcaseRowBoxes).boxIds.filter((id) => typeof id === 'string' && id.trim())
      : []
  };
};

export const normalizeShowcaseRows = (rows?: ShowcaseRow[] | null) =>
  Array.isArray(rows) ? rows.map((row) => normalizeShowcaseRow(row)) : [];

export const loadHomepageConfig = async () => {
  const snapshot = await getDoc(HOMEPAGE_DOC_REF);
  if (!snapshot.exists()) return null;
  return snapshot.data() as HomepageConfig;
};

export const subscribeHomepageConfig = (
  onData: (config: HomepageConfig | null) => void,
  onError?: (error: Error) => void
) =>
  onSnapshot(
    HOMEPAGE_DOC_REF,
    (snapshot) => {
      if (!snapshot.exists()) {
        onData(null);
        return;
      }
      const data = snapshot.data() as HomepageConfig;
      onData({
        showcaseRows: normalizeShowcaseRows(data.showcaseRows),
        demoSpinnerBoxId:
          typeof data.demoSpinnerBoxId === 'string' && data.demoSpinnerBoxId.trim()
            ? data.demoSpinnerBoxId
            : undefined
      });
    },
    (error) => {
      if (onError) onError(error as Error);
    }
  );

export const saveHomepageConfig = async (
  showcaseRows: ShowcaseRow[],
  options?: { demoSpinnerBoxId?: string }
) => {
  const normalizedRows = normalizeShowcaseRows(showcaseRows);
  const payload: HomepageConfig = {
    showcaseRows: normalizedRows,
    ...(typeof options?.demoSpinnerBoxId === 'string' && options.demoSpinnerBoxId.trim()
      ? { demoSpinnerBoxId: options.demoSpinnerBoxId }
      : {})
  };
  await setDoc(HOMEPAGE_DOC_REF, payload, { merge: true });
};

export const addRow = (rows: ShowcaseRow[]) => {
  const now = Timestamp.now();
  const newRow: ShowcaseRow = {
    id: generateRowId(),
    title: 'New Showcase Row',
    subtitle: '',
    type: 'boxes',
    layout: 'grid',
    boxIds: [],
    maxDesktop: 4,
    maxMobile: 2,
    createdAt: now,
    updatedAt: now
  };
  return [...rows, newRow];
};

export const updateRow = (
  rows: ShowcaseRow[],
  rowId: string,
  patch: Partial<ShowcaseRow>
) =>
  rows.map((row) =>
    row.id === rowId
      ? {
          ...row,
          ...patch,
          updatedAt: Timestamp.now()
        }
      : row
  );

export const changeRowType = (
  rows: ShowcaseRow[],
  rowId: string,
  nextType: ShowcaseRow['type']
) =>
  rows.map((row) => {
    if (row.id !== rowId) return row;
    return normalizeShowcaseRow({
      ...row,
      type: nextType,
      updatedAt: Timestamp.now()
    });
  });

export const deleteRow = (rows: ShowcaseRow[], rowId: string) =>
  rows.filter((row) => row.id !== rowId);

export const addBoxToRow = (rows: ShowcaseRow[], rowId: string, boxId: string) =>
  rows.map((row) => {
    if (row.id !== rowId || row.type !== 'boxes') return row;
    if (row.boxIds.includes(boxId)) return row;
    return {
      ...row,
      boxIds: [...row.boxIds, boxId],
      updatedAt: Timestamp.now()
    };
  });

export const removeBoxFromRow = (rows: ShowcaseRow[], rowId: string, boxId: string) =>
  rows.map((row) => {
    if (row.id !== rowId || row.type !== 'boxes') return row;
    return {
      ...row,
      boxIds: row.boxIds.filter((id) => id !== boxId),
      updatedAt: Timestamp.now()
    };
  });

const moveItem = <T,>(items: T[], from: number, to: number) => {
  const next = [...items];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
};

export const moveRow = (
  rows: ShowcaseRow[],
  rowId: string,
  direction: 'up' | 'down'
) => {
  const index = rows.findIndex((row) => row.id === rowId);
  if (index === -1) return rows;
  const nextIndex = direction === 'up' ? index - 1 : index + 1;
  if (nextIndex < 0 || nextIndex >= rows.length) return rows;
  const nextRows = moveItem(rows, index, nextIndex);
  return nextRows.map((row) =>
    row.id === rowId ? { ...row, updatedAt: Timestamp.now() } : row
  );
};

export const moveBox = (
  rows: ShowcaseRow[],
  rowId: string,
  boxId: string,
  direction: 'left' | 'right'
) =>
  rows.map((row) => {
    if (row.id !== rowId || row.type !== 'boxes') return row;
    const index = row.boxIds.indexOf(boxId);
    if (index === -1) return row;
    const nextIndex = direction === 'left' ? index - 1 : index + 1;
    if (nextIndex < 0 || nextIndex >= row.boxIds.length) return row;
    return {
      ...row,
      boxIds: moveItem(row.boxIds, index, nextIndex),
      updatedAt: Timestamp.now()
    };
  });

export const addCategoryToRow = (rows: ShowcaseRow[], rowId: string) =>
  rows.map((row) => {
    if (row.id !== rowId || row.type !== 'categories') return row;
    return {
      ...row,
      categories: [
        ...row.categories,
        {
          id: generateRowId(),
          label: '',
          categorySlug: '',
          imageUrl: ''
        }
      ],
      updatedAt: Timestamp.now()
    };
  });

export const updateCategoryInRow = (
  rows: ShowcaseRow[],
  rowId: string,
  categoryId: string,
  patch: Partial<ShowcaseCategoryCard>
) =>
  rows.map((row) => {
    if (row.id !== rowId || row.type !== 'categories') return row;
    return {
      ...row,
      categories: row.categories.map((category) =>
        category.id === categoryId
          ? {
              ...category,
              ...patch
            }
          : category
      ),
      updatedAt: Timestamp.now()
    };
  });

export const removeCategoryFromRow = (
  rows: ShowcaseRow[],
  rowId: string,
  categoryId: string
) =>
  rows.map((row) => {
    if (row.id !== rowId || row.type !== 'categories') return row;
    return {
      ...row,
      categories: row.categories.filter((category) => category.id !== categoryId),
      updatedAt: Timestamp.now()
    };
  });

export const moveCategory = (
  rows: ShowcaseRow[],
  rowId: string,
  categoryId: string,
  direction: 'up' | 'down'
) =>
  rows.map((row) => {
    if (row.id !== rowId || row.type !== 'categories') return row;
    const index = row.categories.findIndex((category) => category.id === categoryId);
    if (index === -1) return row;
    const nextIndex = direction === 'up' ? index - 1 : index + 1;
    if (nextIndex < 0 || nextIndex >= row.categories.length) return row;
    return {
      ...row,
      categories: moveItem(row.categories, index, nextIndex),
      updatedAt: Timestamp.now()
    };
  });
