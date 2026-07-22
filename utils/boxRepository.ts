import { DocumentData, DocumentSnapshot, QueryDocumentSnapshot, collection, doc, documentId, getDoc, getDocs, limit, orderBy, query, startAfter } from 'firebase/firestore';
import { db } from '../firebase';
import type { CaseItem, MysteryBox } from '../types';

export type BoxSummary = Omit<MysteryBox, 'items'> & { items: CaseItem[]; sortOrder: number; published: boolean };
const detailCache = new Map<string, MysteryBox>();
const detailInFlight = new Map<string, Promise<MysteryBox | null>>();
const summaryCache = new Map<string, BoxSummary>();

const asSummary = (snapshot: DocumentSnapshot<DocumentData>): BoxSummary => {
 const value = snapshot.data() ?? {}; return { id: snapshot.id, name: String(value.name ?? 'Mystery Box'), price: Number(value.price ?? 0), priceXP: value.priceXP == null ? undefined : Number(value.priceXP), currencyType: value.currencyType === 'XP' ? 'XP' : 'COIN', image: typeof value.image === 'string' ? value.image : '', accentColor: typeof value.accentColor === 'string' ? value.accentColor : '#3b82f6', tag: value.tag, tags: Array.isArray(value.tags) ? value.tags : undefined, isDaily: value.isDaily === true, isPullPassBox: value.isPullPassBox === true, pullPassBoxType: value.pullPassBoxType, isUserCreated: false, items: [], sortOrder: Number(value.sortOrder ?? 0), published: value.published !== false } as BoxSummary;
};
export const getBoxSummaryPage = async (pageSize: number, cursor?: QueryDocumentSnapshot<DocumentData> | null) => {
 let q = query(collection(db, 'boxSummaries'), orderBy('sortOrder', 'asc'), orderBy(documentId(), 'asc'), limit(pageSize));
 if (cursor) q = query(collection(db, 'boxSummaries'), orderBy('sortOrder', 'asc'), orderBy(documentId(), 'asc'), startAfter(cursor), limit(pageSize));
 const snapshot = await getDocs(q); const boxes = snapshot.docs.map(asSummary).filter((box) => box.published);
 boxes.forEach((box) => summaryCache.set(box.id, box));
 return { boxes, cursor: snapshot.docs.at(-1) ?? null, hasMore: snapshot.size === pageSize };
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
