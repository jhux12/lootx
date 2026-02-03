import fs from 'node:fs';
import path from 'node:path';
import { siteFacts } from '../content/support/siteFacts';

const SUPPORT_DIR = path.resolve(process.cwd(), 'content/support');

type SupportDoc = {
  id: string;
  title: string;
  content: string;
};

type SupportChunk = {
  id: string;
  title: string;
  content: string;
  source: string;
};

const docManifest: Array<{ id: string; title: string; file: string }> = [
  { id: 'overview', title: 'Overview', file: 'overview.md' },
  { id: 'how-it-works', title: 'How It Works', file: 'how-it-works.md' },
  { id: 'case-battles', title: 'Case Battles', file: 'case-battles.md' },
  { id: 'case-lab', title: 'Case Lab', file: 'case-lab.md' },
  { id: 'provably-fair', title: 'Provably Fair', file: 'provably-fair.md' },
  { id: 'coins-payments', title: 'Coins & Payments', file: 'coins-payments.md' },
  { id: 'shipping-sellback', title: 'Shipping & Sell Back', file: 'shipping-sellback.md' },
  { id: 'account-security', title: 'Account & Security', file: 'account-security.md' }
];

const loadDocs = (): SupportDoc[] => {
  return docManifest.map((doc) => {
    const filePath = path.join(SUPPORT_DIR, doc.file);
    const content = fs.readFileSync(filePath, 'utf8');
    return { id: doc.id, title: doc.title, content };
  });
};

const SUPPORT_DOCS: SupportDoc[] = loadDocs();

const chunkText = (doc: SupportDoc, minSize = 500, maxSize = 1100): SupportChunk[] => {
  const paragraphs = doc.content.split(/\n\n+/);
  const chunks: SupportChunk[] = [];
  let buffer = '';

  const flush = () => {
    if (buffer.trim()) {
      chunks.push({
        id: doc.id,
        title: doc.title,
        content: buffer.trim(),
        source: `${doc.title} (${doc.id})`
      });
    }
    buffer = '';
  };

  paragraphs.forEach((paragraph) => {
    const next = buffer ? `${buffer}\n\n${paragraph}` : paragraph;
    if (next.length > maxSize) {
      flush();
      buffer = paragraph;
      if (buffer.length >= minSize) {
        flush();
      }
    } else {
      buffer = next;
    }
  });

  flush();
  return chunks;
};

const toTokens = (text: string) =>
  text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 2);

const scoreChunk = (chunk: SupportChunk, queryTokens: Set<string>) => {
  const chunkTokens = toTokens(chunk.content);
  let score = 0;
  chunkTokens.forEach((token) => {
    if (queryTokens.has(token)) score += 1;
  });
  return score;
};

const SUPPORT_CHUNKS = SUPPORT_DOCS.flatMap((doc) => chunkText(doc));

const siteFactsText = `Site facts (structured JSON):\n${JSON.stringify(siteFacts, null, 2)}`;

export const getSupportContext = (query: string): { contextText: string; sources: string[] } => {
  const queryTokens = new Set(toTokens(query));
  const scored = SUPPORT_CHUNKS.map((chunk) => ({
    chunk,
    score: scoreChunk(chunk, queryTokens)
  }));

  scored.sort((a, b) => b.score - a.score);

  const topChunks = scored
    .filter((entry) => entry.score > 0)
    .slice(0, 5)
    .map((entry) => entry.chunk);

  const fallbackChunks = topChunks.length
    ? topChunks
    : SUPPORT_CHUNKS.slice(0, 3);

  const contextParts = [
    `SOURCE: Site Facts\n${siteFactsText}`,
    ...fallbackChunks.map((chunk) => `SOURCE: ${chunk.source}\n${chunk.content}`)
  ];

  const sources = ['site-facts', ...fallbackChunks.map((chunk) => chunk.id)];

  return {
    contextText: contextParts.join('\n\n---\n\n'),
    sources
  };
};
