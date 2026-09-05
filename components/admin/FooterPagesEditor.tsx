import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Timestamp, doc, onSnapshot, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { MarkdownEditorWithPreview } from './MarkdownEditorWithPreview';
import { DEFAULT_FOOTER_PAGE_CONTENT, FOOTER_PAGE_KEYS, FOOTER_PAGE_META, FooterPageKey, FooterPageSection, buildDefaultFooterPagesDoc, normalizeFooterPageBranding } from '../../utils/footerPagesContent';

type FooterPagesDoc = Record<FooterPageKey, FooterPageSection>;
type ToastState = { tone: 'success' | 'error'; message: string };

const normalizeSection = (section: Partial<FooterPageSection> | undefined, key: FooterPageKey): FooterPageSection => {
  const defaults = DEFAULT_FOOTER_PAGE_CONTENT[key];
  return {
    title: normalizeFooterPageBranding(section?.title ?? defaults.title),
    lastUpdated: section?.lastUpdated,
    published: {
      content: normalizeFooterPageBranding(section?.published?.content ?? defaults.content),
      version: section?.published?.version ?? 1
    },
    draft: {
      content: normalizeFooterPageBranding(section?.draft?.content ?? section?.published?.content ?? defaults.content),
      version: section?.draft?.version ?? section?.published?.version ?? 1,
      updatedAt: section?.draft?.updatedAt
    }
  };
};

const formatTimestamp = (timestamp?: Timestamp) => timestamp ? timestamp.toDate().toLocaleString() : '--';

export const FooterPagesEditor: React.FC = () => {
  const [activePage, setActivePage] = useState<FooterPageKey>('about');
  const [pagesData, setPagesData] = useState<FooterPagesDoc | null>(null);
  const [drafts, setDrafts] = useState<Record<FooterPageKey, string>>(() =>
    FOOTER_PAGE_KEYS.reduce((acc, key) => ({ ...acc, [key]: DEFAULT_FOOTER_PAGE_CONTENT[key].content }), {} as Record<FooterPageKey, string>)
  );
  const [dirty, setDirty] = useState<Record<FooterPageKey, boolean>>(() =>
    FOOTER_PAGE_KEYS.reduce((acc, key) => ({ ...acc, [key]: false }), {} as Record<FooterPageKey, boolean>)
  );
  const [isLoading, setIsLoading] = useState(true);
  const [toast, setToast] = useState<ToastState | null>(null);
  const isInitializingRef = useRef(false);
  const dirtyRef = useRef(dirty);

  useEffect(() => {
    dirtyRef.current = dirty;
  }, [dirty]);

  useEffect(() => {
    const pagesRef = doc(db, 'site', 'footerPages');
    const unsubscribe = onSnapshot(
      pagesRef,
      (snapshot) => {
        if (!snapshot.exists()) {
          if (!isInitializingRef.current) {
            isInitializingRef.current = true;
            void setDoc(pagesRef, buildDefaultFooterPagesDoc()).catch((error) => {
              console.error('Failed to initialize footer pages', error);
              setToast({ tone: 'error', message: 'Unable to initialize footer pages.' });
            });
          }
          setIsLoading(false);
          return;
        }
        const rawData = snapshot.data() as Partial<FooterPagesDoc>;
        const normalized = FOOTER_PAGE_KEYS.reduce((acc, key) => {
          acc[key] = normalizeSection(rawData[key], key);
          return acc;
        }, {} as FooterPagesDoc);
        setPagesData(normalized);
        setDrafts((current) => FOOTER_PAGE_KEYS.reduce((acc, key) => {
          acc[key] = dirtyRef.current[key] ? current[key] : normalized[key].draft.content;
          return acc;
        }, {} as Record<FooterPageKey, string>));
        setIsLoading(false);
      },
      (error) => {
        console.error('Failed to load footer pages', error);
        setToast({ tone: 'error', message: 'Unable to load footer pages.' });
        setIsLoading(false);
      }
    );
    return () => unsubscribe();
  }, []);

  const showToast = (tone: ToastState['tone'], message: string) => {
    setToast({ tone, message });
    window.setTimeout(() => setToast(null), 3200);
  };

  const currentSection = useMemo(() => pagesData?.[activePage], [activePage, pagesData]);
  const currentDraft = drafts[activePage];

  const handleDraftChange = (value: string) => {
    setDrafts((prev) => ({ ...prev, [activePage]: value }));
    setDirty((prev) => ({ ...prev, [activePage]: true }));
  };

  const updateDraft = async () => {
    if (!currentSection) return;
    const pagesRef = doc(db, 'site', 'footerPages');
    const nextVersion = (currentSection.draft.version ?? currentSection.published.version ?? 0) + 1;
    const brandedDraft = normalizeFooterPageBranding(currentDraft);
    try {
      await updateDoc(pagesRef, {
        [`${activePage}.draft.content`]: brandedDraft,
        [`${activePage}.draft.version`]: nextVersion,
        [`${activePage}.draft.updatedAt`]: serverTimestamp()
      });
      setDirty((prev) => ({ ...prev, [activePage]: false }));
      showToast('success', 'Draft saved.');
    } catch (error) {
      console.error('Failed to save footer page draft', error);
      showToast('error', 'Failed to save draft.');
    }
  };

  const publishDraft = async () => {
    if (!currentSection) return;
    const pagesRef = doc(db, 'site', 'footerPages');
    const nextVersion = (currentSection.published.version ?? 0) + 1;
    const brandedDraft = normalizeFooterPageBranding(currentDraft);
    try {
      await updateDoc(pagesRef, {
        [`${activePage}.published.content`]: brandedDraft,
        [`${activePage}.published.version`]: nextVersion,
        [`${activePage}.lastUpdated`]: serverTimestamp(),
        [`${activePage}.draft.content`]: brandedDraft,
        [`${activePage}.draft.version`]: nextVersion,
        [`${activePage}.draft.updatedAt`]: serverTimestamp()
      });
      setDirty((prev) => ({ ...prev, [activePage]: false }));
      showToast('success', 'Footer page published.');
    } catch (error) {
      console.error('Failed to publish footer page', error);
      showToast('error', 'Failed to publish page.');
    }
  };

  const discardChanges = async () => {
    if (!currentSection) return;
    const pagesRef = doc(db, 'site', 'footerPages');
    try {
      await updateDoc(pagesRef, {
        [`${activePage}.draft.content`]: currentSection.published.content,
        [`${activePage}.draft.version`]: currentSection.published.version ?? 1,
        [`${activePage}.draft.updatedAt`]: serverTimestamp()
      });
      setDrafts((prev) => ({ ...prev, [activePage]: currentSection.published.content }));
      setDirty((prev) => ({ ...prev, [activePage]: false }));
      showToast('success', 'Draft reverted.');
    } catch (error) {
      console.error('Failed to discard footer page changes', error);
      showToast('error', 'Failed to discard changes.');
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-white">Footer Pages</h2>
          <p className="text-sm text-gray-400">Edit every content page linked from the site footer.</p>
        </div>
      </div>

      {toast && <div className={`rounded-2xl border px-4 py-3 text-sm ${toast.tone === 'success' ? 'border-green-500/40 bg-green-500/10 text-green-100' : 'border-red-500/40 bg-red-500/10 text-red-100'}`}>{toast.message}</div>}

      <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
        <div className="flex gap-2 overflow-x-auto rounded-2xl border border-white/10 bg-[#0b0f1a] p-2 lg:flex-col lg:overflow-visible">
          {FOOTER_PAGE_KEYS.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setActivePage(key)}
              className={`shrink-0 rounded-xl px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.16em] transition ${activePage === key ? 'bg-blue-500/20 text-blue-100' : 'text-gray-400 hover:bg-white/5 hover:text-white'}`}
            >
              {FOOTER_PAGE_META[key].label}
            </button>
          ))}
        </div>

        <div className="rounded-2xl border border-white/10 bg-[#0b0f1a] p-4 md:p-6">
          {isLoading || !currentSection ? (
            <div className="text-sm text-gray-400">Loading footer pages...</div>
          ) : (
            <div className="flex flex-col gap-6">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-white">{currentSection.title}</h3>
                  <p className="text-xs text-gray-400">Published v{currentSection.published.version} • Last updated {formatTimestamp(currentSection.lastUpdated)}</p>
                  <p className="text-xs text-gray-500">Draft updated {formatTimestamp(currentSection.draft.updatedAt)}</p>
                </div>
                <div className="grid gap-2 sm:flex sm:flex-wrap">
                  <button type="button" onClick={updateDraft} disabled={!dirty[activePage]} className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-gray-200 transition hover:border-blue-400/40 hover:text-white disabled:cursor-not-allowed disabled:opacity-50">Save Draft</button>
                  <button type="button" onClick={publishDraft} className="rounded-lg bg-blue-500/20 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-blue-100 transition hover:bg-blue-500/30">Publish</button>
                  <button type="button" onClick={discardChanges} disabled={!dirty[activePage]} className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-gray-200 transition hover:border-red-400/40 hover:text-white disabled:cursor-not-allowed disabled:opacity-50">Discard Changes</button>
                </div>
              </div>
              <MarkdownEditorWithPreview value={currentDraft} onChange={handleDraftChange} label={`${FOOTER_PAGE_META[activePage].label} Markdown`} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
