import React, { useEffect, useMemo, useState } from 'react';
import { Timestamp, doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { renderMarkdownToHtml } from '../utils/markdown';
import { DEFAULT_FOOTER_PAGE_CONTENT, FOOTER_PAGE_META, FooterPageKey } from '../utils/footerPagesContent';

type ManagedFooterPage = {
  title?: string;
  lastUpdated?: Timestamp;
  published?: { content?: string; version?: number };
};

const formatTimestamp = (timestamp?: Timestamp) => timestamp ? timestamp.toDate().toLocaleDateString() : null;

export const useManagedFooterPage = (pageKey: FooterPageKey) => {
  const fallback = DEFAULT_FOOTER_PAGE_CONTENT[pageKey];
  const [title, setTitle] = useState(fallback.title);
  const [content, setContent] = useState(fallback.content);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      doc(db, 'site', 'footerPages'),
      (snapshot) => {
        if (!snapshot.exists()) {
          setTitle(fallback.title);
          setContent(fallback.content);
          setLastUpdated(null);
          return;
        }
        const data = snapshot.data() as Record<string, ManagedFooterPage>;
        const section = data?.[pageKey];
        setTitle(section?.title ?? fallback.title);
        setContent(section?.published?.content || fallback.content);
        setLastUpdated(formatTimestamp(section?.lastUpdated));
      },
      (error) => {
        console.error('Failed to load managed footer page', { pageKey, error });
        setTitle(fallback.title);
        setContent(fallback.content);
        setLastUpdated(null);
      }
    );
    return () => unsubscribe();
  }, [fallback.content, fallback.title, pageKey]);

  const html = useMemo(() => renderMarkdownToHtml(content), [content]);
  return { title, html, lastUpdated };
};

export const ManagedFooterContent: React.FC<{ pageKey: FooterPageKey; children?: React.ReactNode }> = ({ pageKey, children }) => {
  const { title, html, lastUpdated } = useManagedFooterPage(pageKey);

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 px-4 pb-16 pt-10 sm:px-6 lg:px-8">
      <section className="rounded-2xl border border-white/10 bg-[#0b0f1a] p-5 sm:p-6 md:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-300">{FOOTER_PAGE_META[pageKey].eyebrow}</p>
        <h1 className="mt-3 text-3xl font-semibold text-white sm:text-4xl">{title}</h1>
        {lastUpdated && <p className="mt-2 text-xs uppercase tracking-[0.3em] text-gray-500">Last updated {lastUpdated}</p>}
        <div className="mt-6 space-y-3" dangerouslySetInnerHTML={{ __html: html }} />
        {children && <div className="mt-8">{children}</div>}
      </section>
    </div>
  );
};
