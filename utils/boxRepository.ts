import { DocumentData, DocumentSnapshot, QueryDocumentSnapshot, collection, doc, documentId, getDoc, getDocs, limit, orderBy, query, startAfter } from 'firebase/firestore';
import { db } from '../firebase';
import type { CaseItem, MysteryBox } from '../types';

export type BoxSummary = Omit<MysteryBox, 'items'> & { items: CaseItem[]; sortOrder: number; published: boolean };
const detailCache = new Map<string, MysteryBox>();
const detailInFlight = new Map<string, Promise<MysteryBox | null>>();
const summaryCache = new Map<string, BoxSummary>();
const summaryInFlight = new Map<string, Promise<BoxSummary | null>>();
const legacyCursorIds = new Set<string>();
const legacyFallbackEnabled = import.meta.env.VITE_ENABLE_LEGACY_BOX_FALLBACK !== 'false';

const asSummary = (snapshot: DocumentSnapshot<DocumentData>): BoxSummary => {
 const value = snapshot.data() ?? {}; return { id: snapshot.id, name: String(value.name ?? 'Mystery Pack'), price: Number(value.price ?? 0), priceXP: value.priceXP == null ? undefined : Number(value.priceXP), currencyType: value.currencyType === 'XP' ? 'XP' : 'COIN', image: typeof value.image === 'string' ? value.image : '', accentColor: typeof value.accentColor === 'string' ? value.accentColor : '#3b82f6', tag: value.tag, tags: Array.isArray(value.tags) ? value.tags : undefined, isDaily: value.isDaily === true, isPullPassBox: value.isPullPassBox === true, pullPassBoxType: value.pullPassBoxType, isUserCreated: false, items: [], sortOrder: Number(value.sortOrder ?? 0), published: value.published !== false } as BoxSummary;
};
export const getBoxSummaryPage = async (pageSize: number, cursor?: QueryDocumentSnapshot<DocumentData> | null) => {
 const useLegacy = Boolean(cursor && legacyCursorIds.has(cursor.id));
 let snapshot;
 if (useLegacy) {
   snapshot = await getDocs(query(collection(db, 'boxes'), startAfter(cursor!), limit(pageSize)));
 } else {
   const summaryQuery = cursor
     ? query(collection(db, 'boxSummaries'), orderBy('sortOrder', 'asc'), orderBy(documentId(), 'asc'), startAfter(cursor), limit(pageSize))
     : query(collection(db, 'boxSummaries'), orderBy('sortOrder', 'asc'), orderBy(documentId(), 'asc'), limit(pageSize));
   snapshot = await getDocs(summaryQuery);
   // Compatibility only: successful empty summaries during migration. Never fall
   // back after a thrown network, permission, or index error.
   if (snapshot.empty && !cursor && legacyFallbackEnabled) {
     snapshot = await getDocs(query(collection(db, 'boxes'), limit(pageSize)));
     snapshot.docs.forEach((entry) => legacyCursorIds.add(entry.id));
   }
 }
 const boxes = snapshot.docs.map(asSummary).filter((box) => box.published);
 boxes.forEach((box) => summaryCache.set(box.id, box));
 const nextCursor = snapshot.docs.at(-1) ?? null;
 if (useLegacy && nextCursor) legacyCursorIds.add(nextCursor.id);
 return { boxes, cursor: nextCursor, hasMore: snapshot.size === pageSize };
};

const homepageCache = new Map<number, BoxSummary[]>();
const homepageInFlight = new Map<number, Promise<BoxSummary[]>>();
const HOMEPAGE_LOAD_TIMEOUT_MS = 8_000;
const HOMEPAGE_RETRY_DELAYS_MS = [300, 900];

const wait = (delayMs: number) => new Promise((resolve) => setTimeout(resolve, delayMs));

const withTimeout = <T>(promise: Promise<T>, timeoutMs: number): Promise<T> =>
 new Promise<T>((resolve, reject) => {
   const timeoutId = setTimeout(() => reject(new Error('BOX_SUMMARY_LOAD_TIMEOUT')), timeoutMs);
   promise.then(
     (value) => { clearTimeout(timeoutId); resolve(value); },
     (error) => { clearTimeout(timeoutId); reject(error); }
   );
 });

const loadHomepageSummaryPage = async (pageSize: number) => {
 let lastError: unknown;
 for (let attempt = 0; attempt <= HOMEPAGE_RETRY_DELAYS_MS.length; attempt += 1) {
   try {
     const { boxes } = await withTimeout(getBoxSummaryPage(pageSize), HOMEPAGE_LOAD_TIMEOUT_MS);
     // Retry an empty first response because Firestore may still be establishing
     // its initial network connection and have no local catalog cached yet.
     if (boxes.length > 0 || attempt === HOMEPAGE_RETRY_DELAYS_MS.length) return boxes;
   } catch (error) {
     lastError = error;
     if (attempt === HOMEPAGE_RETRY_DELAYS_MS.length) throw error;
   }
   await wait(HOMEPAGE_RETRY_DELAYS_MS[attempt]);
 }
 throw lastError ?? new Error('BOX_SUMMARY_LOAD_FAILED');
};

/** Homepage-only cache: it never shares a cursor or page state with BoxCatalog. */
export const getHomepageSummaries = (pageSize: number) => {
 const cached = homepageCache.get(pageSize); if (cached) return Promise.resolve(cached);
 const ongoing = homepageInFlight.get(pageSize); if (ongoing) return ongoing;
 const request = loadHomepageSummaryPage(pageSize).then((boxes) => {
   // Do not make a transient empty response sticky for the lifetime of the tab.
   if (boxes.length > 0) homepageCache.set(pageSize, boxes);
   return boxes;
 }).finally(() => homepageInFlight.delete(pageSize));
 homepageInFlight.set(pageSize, request); return request;
};
export const invalidateHomepageSummaries = (pageSize?: number) => { if (pageSize) homepageCache.delete(pageSize); else homepageCache.clear(); };


export const getBoxSummaryById = (id: string) => {
 const cached = summaryCache.get(id); if (cached) return Promise.resolve(cached);
 const running = summaryInFlight.get(id); if (running) return running;
 const request = getDoc(doc(db, 'boxSummaries', id)).then((snapshot) => {
   if (!snapshot.exists()) return null; const summary = asSummary(snapshot);
   if (!summary.published) return null; summaryCache.set(id, summary); return summary;
 }).finally(() => summaryInFlight.delete(id));
 summaryInFlight.set(id, request); return request;
};
/** Resolves only IDs absent from the bounded homepage page and preserves input order. */
export const getConfiguredHomepageSummaries = async (ids: string[], initial: BoxSummary[]) => {
 const unique = [...new Set(ids.filter(Boolean))]; const available = new Map(initial.map((box) => [box.id, box]));
 await Promise.all(unique.filter((id) => !available.has(id)).map(async (id) => { const value = await getBoxSummaryById(id).catch(() => null); if (value) available.set(id, value); }));
 return ids.map((id) => available.get(id)).filter((value): value is BoxSummary => Boolean(value));
};

export const getBoxDetail = (boxId: string, map: (id: string, data: Record<string, any>) => MysteryBox) => {
 if (detailCache.has(boxId)) return Promise.resolve(detailCache.get(boxId)!);
 const ongoing = detailInFlight.get(boxId); if (ongoing) return ongoing;
 const request = getDoc(doc(db, 'boxes', boxId)).then((snapshot) => {
   if (!snapshot.exists()) return null; const value = map(snapshot.id, snapshot.data()); detailCache.set(boxId, value); return value;
 }).finally(() => detailInFlight.delete(boxId));
 detailInFlight.set(boxId, request); return request;
};
export const invalidateBoxDetail = (boxId: string) => { detailCache.delete(boxId); };
