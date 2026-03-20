import React, { useEffect, useMemo, useState } from 'react';
import { Timestamp, doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { renderMarkdownToHtml } from '../utils/markdown';
import { useGame } from '../context/GameContext';

type LegalKey = 'terms' | 'privacy';

type LegalSection = {
  title: string;
  lastUpdated?: Timestamp;
  published?: {
    content?: string;
    version?: number;
  };
};

type LegalPageProps = {
  variant: LegalKey;
};

const fallbackTitleMap: Record<LegalKey, string> = {
  terms: 'Terms of Service',
  privacy: 'Privacy Policy'
};

const formatTimestamp = (timestamp?: Timestamp) => {
  if (!timestamp) return null;
  return timestamp.toDate().toLocaleDateString();
};

export const LegalPage: React.FC<LegalPageProps> = ({ variant }) => {
  const { setView } = useGame();
  const [content, setContent] = useState<string | null>(null);
  const [title, setTitle] = useState(fallbackTitleMap[variant]);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    const legalRef = doc(db, 'site', 'legal');
    const pathLabel = 'site/legal';
    console.log('READING FIRESTORE PATH', pathLabel);
    const unsubscribe = onSnapshot(
      legalRef,
      (snapshot) => {
        console.log('SNAPSHOT OK', {
          path: pathLabel,
          size: 'size' in snapshot ? snapshot.size : undefined
        });
        if (!snapshot.exists()) {
          setError(true);
          return;
        }
        const data = snapshot.data() as Record<string, LegalSection>;
        const section = data?.[variant];
        const publishedContent = section?.published?.content;
        if (!publishedContent) {
          setError(true);
          return;
        }
        setTitle(section?.title ?? fallbackTitleMap[variant]);
        setLastUpdated(formatTimestamp(section?.lastUpdated));
        setContent(publishedContent);
        setError(false);
      },
      (error) => {
        console.error('SNAPSHOT FAILED', {
          path: pathLabel,
          code: error?.code,
          message: error?.message,
          error
        });
        setError(true);
      }
    );
    return () => unsubscribe();
  }, [variant]);

  const html = useMemo(() => (content ? renderMarkdownToHtml(content) : ''), [content]);

  if (error || !content) {
    return (
      <div className="mx-auto max-w-3xl px-4 pb-16 pt-10 sm:px-6 lg:px-8">
        <div className="rounded-2xl border border-white/10 bg-[#0b0f1a] p-6 text-center text-gray-200">
          <h1 className="text-2xl font-semibold text-white">{fallbackTitleMap[variant]}</h1>
          <p className="mt-3 text-sm text-gray-400">
            Content unavailable at the moment. Please reach out to support for assistance.
          </p>
          <button
            type="button"
            onClick={() => setView({ type: 'CONTACT' })}
            className="mt-4 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-gray-200 transition hover:border-purple-400/40 hover:text-white"
          >
            Contact Support
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 px-4 pb-16 pt-10 sm:px-6 lg:px-8">
      <div className="rounded-2xl border border-white/10 bg-[#0b0f1a] p-6 md:p-8">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-semibold text-white">{title}</h1>
          {lastUpdated && (
            <p className="text-xs uppercase tracking-[0.3em] text-gray-500">
              Last updated {lastUpdated}
            </p>
          )}
        </div>
        <div
          className="mt-6 space-y-3"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </div>
    </div>
  );
};
