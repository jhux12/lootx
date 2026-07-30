import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Timestamp, doc, onSnapshot, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { MarkdownEditorWithPreview } from './MarkdownEditorWithPreview';

type LegalSection = {
  title: string;
  lastUpdated?: Timestamp;
  published: {
    content: string;
    version: number;
  };
  draft: {
    content: string;
    version: number;
    updatedAt?: Timestamp;
  };
};

type LegalDoc = {
  terms: LegalSection;
  privacy: LegalSection;
};

type LegalKey = 'terms' | 'privacy';

type ToastState = {
  tone: 'success' | 'error';
  message: string;
};

const DEFAULT_TERMS_CONTENT = `# Terms of Service

Welcome to Pullz.gg! These terms outline the rules for using our platform.

## Eligibility
- You must be at least 18 years old.
- You are responsible for complying with local laws.

## Accounts
- Keep your login credentials secure.
- We may suspend accounts for policy violations.

## Fair Play
- Automated abuse is prohibited.
- We reserve the right to investigate suspicious activity.

## Contact
If you have questions, reach us at support@pullz.gg.
`;

const DEFAULT_PRIVACY_CONTENT = `# Privacy Policy

We value your privacy and explain how your data is handled.

## Information we collect
- Account details (email, username).
- Gameplay and transaction history.

## How we use data
- To provide and improve the service.
- To communicate important updates.

## Your choices
- You can request account deletion.
- Update marketing preferences anytime.

## Contact
Questions? Email support@pullz.gg.
`;

const buildDefaultLegalDoc = () => ({
  terms: {
    title: 'Terms of Service',
    lastUpdated: serverTimestamp(),
    published: {
      content: DEFAULT_TERMS_CONTENT,
      version: 1
    },
    draft: {
      content: DEFAULT_TERMS_CONTENT,
      version: 1,
      updatedAt: serverTimestamp()
    }
  },
  privacy: {
    title: 'Privacy Policy',
    lastUpdated: serverTimestamp(),
    published: {
      content: DEFAULT_PRIVACY_CONTENT,
      version: 1
    },
    draft: {
      content: DEFAULT_PRIVACY_CONTENT,
      version: 1,
      updatedAt: serverTimestamp()
    }
  }
});

const normalizeSection = (section: Partial<LegalSection> | undefined, defaults: LegalSection): LegalSection => ({
  title: section?.title ?? defaults.title,
  lastUpdated: section?.lastUpdated ?? defaults.lastUpdated,
  published: {
    content: section?.published?.content ?? defaults.published.content,
    version: section?.published?.version ?? defaults.published.version
  },
  draft: {
    content: section?.draft?.content ?? defaults.draft.content,
    version: section?.draft?.version ?? defaults.draft.version,
    updatedAt: section?.draft?.updatedAt ?? defaults.draft.updatedAt
  }
});

const formatTimestamp = (timestamp?: Timestamp) => {
  if (!timestamp) return '--';
  return timestamp.toDate().toLocaleString();
};

export const LegalEditor: React.FC = () => {
  const [activeTab, setActiveTab] = useState<LegalKey>('terms');
  const [legalData, setLegalData] = useState<LegalDoc | null>(null);
  const [drafts, setDrafts] = useState<Record<LegalKey, string>>({
    terms: DEFAULT_TERMS_CONTENT,
    privacy: DEFAULT_PRIVACY_CONTENT
  });
  const [dirty, setDirty] = useState<Record<LegalKey, boolean>>({
    terms: false,
    privacy: false
  });
  const [isLoading, setIsLoading] = useState(true);
  const [toast, setToast] = useState<ToastState | null>(null);
  const isInitializingRef = useRef(false);
  const dirtyRef = useRef(dirty);

  useEffect(() => {
    dirtyRef.current = dirty;
  }, [dirty]);

  useEffect(() => {
    const legalRef = doc(db, 'site', 'legal');
    const unsubscribe = onSnapshot(
      legalRef,
      (snapshot) => {
        if (!snapshot.exists()) {
          if (!isInitializingRef.current) {
            isInitializingRef.current = true;
            void setDoc(legalRef, buildDefaultLegalDoc()).catch((error) => {
              console.error('Failed to initialize legal doc', error);
              setToast({ tone: 'error', message: 'Unable to initialize legal content.' });
            });
          }
          setIsLoading(false);
          return;
        }
        const data = snapshot.data() as Partial<LegalDoc>;
        const defaults = {
          terms: {
            title: 'Terms of Service',
            published: { content: DEFAULT_TERMS_CONTENT, version: 1 },
            draft: { content: DEFAULT_TERMS_CONTENT, version: 1 }
          },
          privacy: {
            title: 'Privacy Policy',
            published: { content: DEFAULT_PRIVACY_CONTENT, version: 1 },
            draft: { content: DEFAULT_PRIVACY_CONTENT, version: 1 }
          }
        } as LegalDoc;
        const normalized: LegalDoc = {
          terms: normalizeSection(data.terms, defaults.terms),
          privacy: normalizeSection(data.privacy, defaults.privacy)
        };
        setLegalData(normalized);
        setDrafts((current) => ({
          terms: dirtyRef.current.terms ? current.terms : normalized.terms.draft.content,
          privacy: dirtyRef.current.privacy ? current.privacy : normalized.privacy.draft.content
        }));
        setIsLoading(false);
      },
      (error) => {
        console.error('Legal doc snapshot failed', error);
        setToast({ tone: 'error', message: 'Unable to load legal content.' });
        setIsLoading(false);
      }
    );
    return () => unsubscribe();
  }, []);

  const showToast = (tone: ToastState['tone'], message: string) => {
    setToast({ tone, message });
    window.setTimeout(() => setToast(null), 3200);
  };

  const handleDraftChange = (value: string) => {
    setDrafts((prev) => ({ ...prev, [activeTab]: value }));
    setDirty((prev) => ({ ...prev, [activeTab]: true }));
  };

  const currentSection = useMemo(() => legalData?.[activeTab], [activeTab, legalData]);
  const currentDraft = drafts[activeTab];

  const updateDraft = async () => {
    if (!currentSection) return;
    const legalRef = doc(db, 'site', 'legal');
    const nextVersion = (currentSection.draft.version ?? currentSection.published.version ?? 0) + 1;
    try {
      await updateDoc(legalRef, {
        [`${activeTab}.draft.content`]: currentDraft,
        [`${activeTab}.draft.version`]: nextVersion,
        [`${activeTab}.draft.updatedAt`]: serverTimestamp()
      });
      setDirty((prev) => ({ ...prev, [activeTab]: false }));
      showToast('success', 'Draft saved.');
    } catch (error) {
      console.error('Failed to save draft', error);
      showToast('error', 'Failed to save draft.');
    }
  };

  const publishDraft = async () => {
    if (!currentSection) return;
    const legalRef = doc(db, 'site', 'legal');
    const nextPublishedVersion = (currentSection.published.version ?? 0) + 1;
    try {
      await updateDoc(legalRef, {
        [`${activeTab}.published.content`]: currentDraft,
        [`${activeTab}.published.version`]: nextPublishedVersion,
        [`${activeTab}.lastUpdated`]: serverTimestamp(),
        [`${activeTab}.draft.content`]: currentDraft,
        [`${activeTab}.draft.version`]: nextPublishedVersion,
        [`${activeTab}.draft.updatedAt`]: serverTimestamp()
      });
      setDirty((prev) => ({ ...prev, [activeTab]: false }));
      showToast('success', 'Content published.');
    } catch (error) {
      console.error('Failed to publish draft', error);
      showToast('error', 'Failed to publish draft.');
    }
  };

  const discardChanges = async () => {
    if (!currentSection) return;
    const legalRef = doc(db, 'site', 'legal');
    try {
      await updateDoc(legalRef, {
        [`${activeTab}.draft.content`]: currentSection.published.content,
        [`${activeTab}.draft.version`]: currentSection.published.version ?? 1,
        [`${activeTab}.draft.updatedAt`]: serverTimestamp()
      });
      setDrafts((prev) => ({ ...prev, [activeTab]: currentSection.published.content }));
      setDirty((prev) => ({ ...prev, [activeTab]: false }));
      showToast('success', 'Draft reverted.');
    } catch (error) {
      console.error('Failed to discard changes', error);
      showToast('error', 'Failed to discard changes.');
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-white">Legal Editor</h2>
          <p className="text-sm text-gray-400">Manage Terms of Service and Privacy Policy copy.</p>
        </div>
        <div className="flex flex-wrap gap-2 rounded-full border border-white/10 bg-white/5 p-1">
          {(['terms', 'privacy'] as LegalKey[]).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] transition ${
                activeTab === tab ? 'bg-blue-500/20 text-blue-100' : 'text-gray-400 hover:text-white'
              }`}
            >
              {tab === 'terms' ? 'Terms' : 'Privacy'}
            </button>
          ))}
        </div>
      </div>

      {toast && (
        <div
          className={`rounded-2xl border px-4 py-3 text-sm ${
            toast.tone === 'success'
              ? 'border-green-500/40 bg-green-500/10 text-green-100'
              : 'border-red-500/40 bg-red-500/10 text-red-100'
          }`}
        >
          {toast.message}
        </div>
      )}

      <div className="rounded-2xl border border-white/10 bg-[#0b0f1a] p-4 md:p-6">
        {isLoading || !currentSection ? (
          <div className="text-sm text-gray-400">Loading legal content...</div>
        ) : (
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <h3 className="text-lg font-semibold text-white">{currentSection.title}</h3>
                <p className="text-xs text-gray-400">
                  Published v{currentSection.published.version} • Last updated {formatTimestamp(currentSection.lastUpdated)}
                </p>
                <p className="text-xs text-gray-500">
                  Draft updated {formatTimestamp(currentSection.draft.updatedAt)}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={updateDraft}
                  disabled={!dirty[activeTab]}
                  className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-gray-200 transition hover:border-blue-400/40 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Save Draft
                </button>
                <button
                  type="button"
                  onClick={publishDraft}
                  className="rounded-lg bg-blue-500/20 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-blue-100 transition hover:bg-blue-500/30"
                >
                  Publish
                </button>
                <button
                  type="button"
                  onClick={discardChanges}
                  disabled={!dirty[activeTab]}
                  className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-gray-200 transition hover:border-red-400/40 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Discard Changes
                </button>
              </div>
            </div>

            <MarkdownEditorWithPreview value={currentDraft} onChange={handleDraftChange} />
          </div>
        )}
      </div>
    </div>
  );
};
