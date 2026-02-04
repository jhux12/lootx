import { Timestamp, doc, getDoc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../firebase';

export type ShowcaseLayout = 'grid' | 'carousel';

export type ShowcaseRow = {
  id: string;
  title: string;
  subtitle?: string;
  layout: ShowcaseLayout;
  boxIds: string[];
  maxDesktop?: number;
  maxMobile?: number;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
};

export type HomepageConfig = {
  showcaseRows: ShowcaseRow[];
};

export const MAX_SHOWCASE_BOXES = 12;

const HOMEPAGE_DOC_REF = doc(db, 'site', 'homepage');

const generateRowId = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `row_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
};

export const normalizeShowcaseRows = (rows?: ShowcaseRow[] | null) =>
  Array.isArray(rows) ? rows : [];

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
      onData({ showcaseRows: normalizeShowcaseRows(data.showcaseRows) });
    },
    (error) => {
      if (onError) onError(error as Error);
    }
  );

export const saveHomepageConfig = async (showcaseRows: ShowcaseRow[]) => {
  await setDoc(HOMEPAGE_DOC_REF, { showcaseRows }, { merge: true });
};

export const addRow = (rows: ShowcaseRow[]) => {
  const now = Timestamp.now();
  const newRow: ShowcaseRow = {
    id: generateRowId(),
    title: 'New Showcase Row',
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

export const deleteRow = (rows: ShowcaseRow[], rowId: string) =>
  rows.filter((row) => row.id !== rowId);

export const addBoxToRow = (rows: ShowcaseRow[], rowId: string, boxId: string) =>
  rows.map((row) => {
    if (row.id !== rowId) return row;
    if (row.boxIds.includes(boxId)) return row;
    return {
      ...row,
      boxIds: [...row.boxIds, boxId],
      updatedAt: Timestamp.now()
    };
  });

export const removeBoxFromRow = (rows: ShowcaseRow[], rowId: string, boxId: string) =>
  rows.map((row) => {
    if (row.id !== rowId) return row;
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
    if (row.id !== rowId) return row;
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
