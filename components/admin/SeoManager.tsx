import React, { useEffect, useMemo, useState } from 'react';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import {
  AlertTriangle, CheckCircle2, Clock3, ExternalLink, FileText, Globe2,
  Image as ImageIcon, Pencil, Plus, Save, Trash2
} from 'lucide-react';
import { db } from '../../firebase';
import {
  DEFAULT_SEO_SETTINGS, PageSeoSettings, SeoPageKey, SeoSettings,
  normalizeSeoSettings, validateSeoSettings
} from '../../utils/seoSettings';

type Tab = 'global' | 'pages' | 'social' | 'advanced';
const PAGE_KEYS: SeoPageKey[] = ['home', 'boxes', 'faq', 'about', 'provablyFair'];

const Panel = ({ title, children, className = '' }: { title?: string; children: React.ReactNode; className?: string }) => (
  <section className={`overflow-hidden rounded-xl border border-[#26374a] bg-[#0d1a29]/90 shadow-[0_16px_60px_rgba(0,0,0,.18)] ${className}`}>
    {title && <div className="border-b border-[#26374a] px-5 py-4"><h2 className="text-base font-bold text-white">{title}</h2></div>}
    <div className="p-5">{children}</div>
  </section>
);

const Field = ({ label, value, onChange, multiline = false, hint, type = 'text', placeholder }: {
  label: string; value: string; onChange: (value: string) => void; multiline?: boolean; hint?: string; type?: string; placeholder?: string;
}) => (
  <label className="block">
    <span className="mb-2 block text-sm font-medium text-slate-200">{label}</span>
    {multiline ? (
      <textarea value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder}
        className="min-h-24 w-full resize-y rounded-lg border border-[#33475d] bg-[#071321] px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/10" />
    ) : (
      <input type={type} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder}
        className="w-full rounded-lg border border-[#33475d] bg-[#071321] px-4 py-2.5 text-sm text-white outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/10" />
    )}
    {hint && <span className="mt-1.5 block text-right text-xs text-slate-400">{hint}</span>}
  </label>
);

const Toggle = ({ value, onChange, label }: { value: boolean; onChange: (value: boolean) => void; label?: string }) => (
  <label className="inline-flex cursor-pointer items-center gap-3 text-sm text-slate-200">
    <span className="relative inline-flex h-6 w-11 items-center rounded-full bg-slate-700 transition-colors has-[:checked]:bg-blue-500">
      <input className="peer sr-only" type="checkbox" checked={value} onChange={(event) => onChange(event.target.checked)} />
      <span className="ml-1 h-4 w-4 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5" />
    </span>
    {label}
  </label>
);

const StatusItem = ({ ok, label, warning = false }: { ok: boolean; label: string; warning?: boolean }) => (
  <div className={`flex items-center gap-3 text-sm ${ok ? 'text-slate-200' : warning ? 'text-amber-400' : 'text-slate-400'}`}>
    {ok ? <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400" /> : <AlertTriangle className="h-5 w-5 shrink-0 text-amber-400" />}
    <span>{label}</span>
  </div>
);

export const SeoManager = () => {
  const [settings, setSettings] = useState<SeoSettings>(DEFAULT_SEO_SETTINGS);
  const [saved, setSaved] = useState<SeoSettings>(DEFAULT_SEO_SETTINGS);
  const [activeTab, setActiveTab] = useState<Tab>('global');
  const [selectedPage, setSelectedPage] = useState<SeoPageKey>('home');
  const [keywordDraft, setKeywordDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);

  useEffect(() => {
    let active = true;
    getDoc(doc(db, 'site', 'seo')).then((snapshot) => {
      if (!active) return;
      const next = normalizeSeoSettings(snapshot.data() as Partial<SeoSettings>);
      setSettings(next); setSaved(next); setLastSavedAt(next.updatedAt?.toDate?.() ?? null); setLoading(false);
    }).catch(() => {
      if (!active) return;
      setError('SEO settings could not be loaded. Safe defaults are shown.'); setLoading(false);
    });
    return () => { active = false; };
  }, []);

  const dirty = JSON.stringify(settings) !== JSON.stringify(saved);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { if (dirty) { event.preventDefault(); event.returnValue = ''; } };
    window.addEventListener('beforeunload', warn); return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const update = <K extends keyof SeoSettings>(key: K, value: SeoSettings[K]) => setSettings((current) => ({ ...current, [key]: value }));
  const updatePage = (key: SeoPageKey, patch: Partial<PageSeoSettings>) => setSettings((current) => ({
    ...current, pages: { ...current.pages, [key]: { ...current.pages[key], ...patch } }
  }));
  const updateDefaultTitle = (title: string) => setSettings((current) => ({ ...current, seoTitle: title, pages: { ...current.pages, home: { ...current.pages.home, title } } }));
  const updateDefaultDescription = (description: string) => setSettings((current) => ({ ...current, metaDescription: description, pages: { ...current.pages, home: { ...current.pages.home, description } } }));

  const checks = useMemo(() => [
    { label: 'Title length', ok: settings.seoTitle.length >= 50 && settings.seoTitle.length <= 60 },
    { label: 'Description length', ok: settings.metaDescription.length >= 140 && settings.metaDescription.length <= 160 },
    { label: 'Canonical URL', ok: /^https?:\/\//.test(settings.canonicalUrl) },
    { label: 'Social image configured', ok: !!(settings.openGraphImage || settings.fallbackOpenGraphImage || settings.homepageShareImage) },
    { label: 'Structured data', ok: settings.enableOrganizationSchema || settings.enableWebsiteSchema },
    { label: 'Sitemap configured', ok: /^https?:\/\//.test(settings.sitemapUrl) },
    { label: 'Favicon configured', ok: !!settings.faviconUrl },
    { label: 'Page titles complete', ok: PAGE_KEYS.every((key) => !!settings.pages[key].title.trim()) }
  ], [settings]);
  const healthScore = Math.round((checks.filter((check) => check.ok).length / checks.length) * 100);
  const issueCount = checks.filter((check) => !check.ok).length;
  const indexedPages = PAGE_KEYS.filter((key) => settings.indexPage && settings.pages[key].index).length;
  const previewBase = settings.canonicalUrl.replace(/\/$/, '') || 'https://www.pullz.gg';
  const page = settings.pages[selectedPage];
  const pageScore = (candidate: PageSeoSettings) => {
    let score = 40;
    if (candidate.title.length >= 40 && candidate.title.length <= 65) score += 25;
    if (candidate.description.length >= 120 && candidate.description.length <= 165) score += 25;
    if (candidate.index) score += 10;
    return score;
  };
  const addKeyword = () => {
    const keyword = keywordDraft.trim();
    if (!keyword || settings.keywords.includes(keyword)) return;
    update('keywords', [...settings.keywords, keyword]); setKeywordDraft('');
  };
  const save = async () => {
    setError(null); setNotice(null);
    const warnings = validateSeoSettings(settings);
    if (warnings.length && !window.confirm(`Please review these SEO warnings before saving:\n\n${warnings.join('\n')}`)) return;
    setSaving(true);
    try {
      await setDoc(doc(db, 'site', 'seo'), { ...settings, updatedAt: serverTimestamp() }, { merge: true });
      const savedAt = new Date(); setSaved(settings); setLastSavedAt(savedAt); setNotice('SEO settings saved successfully.');
    } catch { setError('Unable to save SEO settings. Please try again.'); }
    finally { setSaving(false); }
  };

  if (loading) return <div className="rounded-xl border border-[#26374a] bg-[#0d1a29] p-10 text-center text-slate-400">Loading SEO settings…</div>;
  const lastSavedLabel = lastSavedAt ? lastSavedAt.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'Not saved yet';

  return (
    <div className="-mx-4 -mt-3 min-h-screen bg-[radial-gradient(circle_at_75%_5%,rgba(14,165,233,.08),transparent_28%)] px-4 pb-10 text-slate-100 sm:-mx-6 sm:px-6">
      <div className="mb-6 flex flex-col gap-4 pt-3 lg:flex-row lg:items-start lg:justify-between">
        <div><h1 className="text-2xl font-black tracking-tight text-white sm:text-3xl">SEO Settings</h1><p className="mt-1 text-sm text-slate-400">Control how Pullz.gg appears in search and social.</p></div>
        <div className="flex flex-wrap gap-3">
          <a href={previewBase} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-lg border border-[#40536a] bg-[#0b1725] px-4 py-2.5 text-sm font-semibold text-white transition hover:border-slate-400"><ExternalLink className="h-4 w-4" /> Preview Site</a>
          <button onClick={() => void save()} disabled={saving || !dirty} className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-sky-500 to-cyan-400 px-5 py-2.5 text-sm font-bold text-slate-950 shadow-lg shadow-sky-500/15 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-55"><Save className="h-4 w-4" /> {saving ? 'Saving…' : 'Save Changes'}</button>
        </div>
      </div>

      {(notice || error || dirty) && <div className={`mb-5 flex items-center gap-2 rounded-lg border px-4 py-3 text-sm ${error ? 'border-red-500/40 bg-red-500/10 text-red-200' : notice ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200' : 'border-amber-500/40 bg-amber-500/10 text-amber-100'}`}>{error ? <AlertTriangle className="h-5 w-5" /> : notice ? <CheckCircle2 className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}{error || notice || 'You have unsaved changes.'}</div>}

      <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Panel className="min-h-32"><div className="text-sm font-semibold text-slate-200">SEO Health</div><div className="mt-4 flex items-center gap-4"><div className="grid h-16 w-16 place-items-center rounded-full p-1" style={{ background: `conic-gradient(#2ee67b ${healthScore * 3.6}deg, #213247 0deg)` }}><div className="grid h-full w-full place-items-center rounded-full bg-[#0d1a29] text-xl font-black">{healthScore}</div></div><span className="text-lg text-slate-400">/ 100</span></div></Panel>
        <Panel className="min-h-32"><div className="text-sm font-semibold text-slate-200">Indexed Pages</div><div className="mt-5 flex items-center gap-4"><span className="grid h-12 w-12 place-items-center rounded-lg bg-sky-500/15 text-sky-400"><FileText className="h-6 w-6" /></span><strong className="text-4xl text-white">{indexedPages}</strong></div></Panel>
        <Panel className="min-h-32"><div className="text-sm font-semibold text-slate-200">Issues</div><div className="mt-5 flex items-center gap-4"><span className="grid h-12 w-12 place-items-center rounded-lg bg-amber-400/15 text-amber-400"><AlertTriangle className="h-7 w-7" /></span><strong className="text-4xl text-white">{issueCount}</strong></div></Panel>
        <Panel className="min-h-32"><div className="text-sm font-semibold text-slate-200">Last Saved</div><div className="mt-5 flex items-center gap-4"><span className="grid h-12 w-12 place-items-center rounded-lg bg-emerald-400/10 text-emerald-400"><Clock3 className="h-7 w-7" /></span><strong className="text-base text-white">{lastSavedLabel}</strong></div></Panel>
      </div>

      <div className="mb-5 flex gap-1 overflow-x-auto rounded-t-xl border border-[#26374a] bg-[#0b1725] px-3 pt-1">
        {([['global', 'Global SEO'], ['pages', 'Pages'], ['social', 'Social'], ['advanced', 'Advanced']] as Array<[Tab, string]>).map(([key, label]) => <button key={key} onClick={() => setActiveTab(key)} className={`whitespace-nowrap border-b-2 px-4 py-3 text-sm font-semibold transition ${activeTab === key ? 'border-cyan-400 text-white' : 'border-transparent text-slate-400 hover:text-white'}`}>{label}</button>)}
      </div>

      {activeTab === 'global' && <div className="grid gap-5 xl:grid-cols-[minmax(0,1.75fr)_minmax(320px,1fr)]">
        <div className="space-y-5">
          <Panel title="Default Search Appearance"><div className="grid gap-5">
            <Field label="Website Title" value={settings.seoTitle} onChange={updateDefaultTitle} hint={`${settings.seoTitle.length} / 60`} />
            <Field label="Meta Description" value={settings.metaDescription} onChange={updateDefaultDescription} multiline hint={`${settings.metaDescription.length} / 160`} />
            <div><span className="mb-2 block text-sm font-medium text-slate-200">Keywords</span><div className="flex min-h-11 flex-wrap items-center gap-2 rounded-lg border border-[#33475d] bg-[#071321] p-2">{settings.keywords.map((keyword) => <button key={keyword} onClick={() => update('keywords', settings.keywords.filter((item) => item !== keyword))} className="rounded bg-[#1d3045] px-2.5 py-1 text-xs text-slate-200 hover:bg-red-500/20">{keyword} <span className="ml-1 text-slate-400">×</span></button>)}<input value={keywordDraft} onChange={(event) => setKeywordDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ',') { event.preventDefault(); addKeyword(); } }} onBlur={addKeyword} placeholder="Add keyword" className="min-w-28 flex-1 bg-transparent px-1 text-sm text-white outline-none" /></div></div>
            <Field label="Canonical URL" value={settings.canonicalUrl} onChange={(value) => update('canonicalUrl', value)} type="url" />
            <div className="flex flex-wrap items-center gap-7"><Toggle label="Search indexing" value={settings.indexPage} onChange={(value) => update('indexPage', value)} /><Toggle label="Follow links" value={settings.followLinks} onChange={(value) => update('followLinks', value)} /></div>
          </div></Panel>
          <Panel title="Page SEO"><div className="-m-5 overflow-x-auto"><table className="w-full min-w-[720px] text-left text-sm"><thead className="border-b border-[#26374a] bg-[#0a1623] text-xs text-slate-400"><tr><th className="px-5 py-3 font-medium">Page</th><th className="px-5 py-3 font-medium">Title</th><th className="px-5 py-3 font-medium">Indexing</th><th className="px-5 py-3 font-medium">Score</th><th className="px-5 py-3 font-medium">Action</th></tr></thead><tbody>{PAGE_KEYS.map((key) => { const item = settings.pages[key]; const score = pageScore(item); return <tr key={key} className="border-b border-[#1f3043] last:border-0"><td className="px-5 py-3 font-medium text-white">{item.label}</td><td className="max-w-sm truncate px-5 py-3 text-xs text-slate-300">{item.title}</td><td className="px-5 py-3"><span className={`rounded border px-2 py-1 text-xs ${item.index && settings.indexPage ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300' : 'border-slate-600 bg-slate-700/20 text-slate-400'}`}>{item.index && settings.indexPage ? 'Indexed' : 'Noindex'}</span></td><td className={`px-5 py-3 font-bold ${score >= 90 ? 'text-emerald-400' : score >= 80 ? 'text-amber-300' : 'text-amber-500'}`}>{score}</td><td className="px-5 py-3"><button onClick={() => { setSelectedPage(key); setActiveTab('pages'); }} className="inline-flex items-center gap-1.5 rounded border border-[#40536a] px-3 py-1.5 text-xs text-white hover:border-cyan-400"><Pencil className="h-3.5 w-3.5" /> Edit</button></td></tr>; })}</tbody></table></div></Panel>
        </div>
        <div className="space-y-5">
          <Panel title="Google Preview"><div className="rounded-lg border border-[#26374a] bg-[#0a1725] p-5"><div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-full border border-slate-400 bg-[#071321] font-black text-cyan-400">P</span><div><p className="text-sm font-semibold text-slate-200">Pullz.gg</p><p className="text-xs text-slate-400">{previewBase}</p></div></div><p className="mt-4 text-lg text-blue-400">{settings.seoTitle || settings.siteName}</p><p className="mt-2 text-sm leading-6 text-slate-300">{settings.metaDescription}</p></div></Panel>
          <Panel title="SEO Checklist"><div className="space-y-4">{checks.slice(0, 5).map((check) => <StatusItem key={check.label} ok={check.ok} label={check.label} warning />)}</div></Panel>
          <Panel title="Technical SEO"><div className="divide-y divide-[#26374a]">{[[!!settings.sitemapUrl, 'sitemap.xml'], [true, 'robots.txt'], [previewBase.startsWith('https://'), 'HTTPS'], [settings.enableOrganizationSchema || settings.enableWebsiteSchema, 'Schema markup']].map(([ok, label]) => <div key={String(label)} className="flex items-center justify-between py-3 first:pt-0 last:pb-0"><StatusItem ok={Boolean(ok)} label={String(label)} /><span className={ok ? 'text-sm text-emerald-400' : 'text-sm text-amber-400'}>{ok ? 'OK' : 'Check'}</span></div>)}</div></Panel>
        </div>
      </div>}

      {activeTab === 'pages' && <div className="grid gap-5 lg:grid-cols-[260px_minmax(0,1fr)]">
        <Panel title="Pages"><div className="space-y-2">{PAGE_KEYS.map((key) => <button key={key} onClick={() => setSelectedPage(key)} className={`flex w-full items-center justify-between rounded-lg px-3 py-3 text-left text-sm transition ${selectedPage === key ? 'bg-sky-500/15 text-cyan-300' : 'text-slate-300 hover:bg-white/5'}`}><span className="flex items-center gap-2"><Globe2 className="h-4 w-4" />{settings.pages[key].label}</span><span className={settings.pages[key].index ? 'text-emerald-400' : 'text-slate-500'}>●</span></button>)}</div></Panel>
        <Panel title={`Edit ${page.label}`}><div className="grid gap-5"><div className="grid gap-5 sm:grid-cols-2"><Field label="Page label" value={page.label} onChange={(value) => updatePage(selectedPage, { label: value })} /><Field label="Path" value={page.path} onChange={(value) => updatePage(selectedPage, { path: value.startsWith('/') ? value : `/${value}` })} /></div><Field label="Search title" value={page.title} onChange={(value) => updatePage(selectedPage, { title: value })} hint={`${page.title.length} / 60`} /><Field label="Meta description" value={page.description} onChange={(value) => updatePage(selectedPage, { description: value })} multiline hint={`${page.description.length} / 160`} /><Field label="Page share image URL" value={page.shareImage} onChange={(value) => updatePage(selectedPage, { shareImage: value })} type="url" placeholder="Falls back to the global social image" /><Toggle label="Allow search indexing" value={page.index} onChange={(value) => updatePage(selectedPage, { index: value })} /><div className="rounded-lg border border-[#26374a] bg-[#071321] p-4"><p className="text-xs text-slate-400">Preview</p><p className="mt-2 text-lg text-blue-400">{page.title}</p><p className="mt-1 text-xs text-emerald-400">{previewBase}{page.path === '/' ? '' : page.path}</p><p className="mt-2 text-sm text-slate-300">{page.description}</p></div></div></Panel>
      </div>}

      {activeTab === 'social' && <div className="grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,1fr)]">
        <div className="space-y-5"><Panel title="Social Sharing"><div className="grid gap-5"><Field label="Open Graph Title" value={settings.openGraphTitle} onChange={(value) => update('openGraphTitle', value)} /><Field label="Open Graph Description" value={settings.openGraphDescription} onChange={(value) => update('openGraphDescription', value)} multiline /><Field label="Open Graph Image URL" value={settings.openGraphImage} onChange={(value) => update('openGraphImage', value)} type="url" /><div className="grid gap-5 sm:grid-cols-2"><Field label="Twitter Title" value={settings.twitterTitle} onChange={(value) => update('twitterTitle', value)} /><label className="block"><span className="mb-2 block text-sm font-medium text-slate-200">Twitter Card</span><select value={settings.twitterCard} onChange={(event) => update('twitterCard', event.target.value as SeoSettings['twitterCard'])} className="w-full rounded-lg border border-[#33475d] bg-[#071321] px-4 py-2.5 text-sm text-white"><option value="summary">summary</option><option value="summary_large_image">summary_large_image</option></select></label></div><Field label="Twitter Description" value={settings.twitterDescription} onChange={(value) => update('twitterDescription', value)} multiline /><Field label="Twitter Image URL" value={settings.twitterImage} onChange={(value) => update('twitterImage', value)} type="url" /></div></Panel><Panel title="Favicons & Fallback Images"><div className="grid gap-5 sm:grid-cols-2"><Field label="Favicon URL" value={settings.faviconUrl} onChange={(value) => update('faviconUrl', value)} type="url" /><Field label="Apple Touch Icon" value={settings.appleTouchIcon} onChange={(value) => update('appleTouchIcon', value)} type="url" /><Field label="Business Logo URL" value={settings.businessLogo} onChange={(value) => update('businessLogo', value)} type="url" /><Field label="Homepage Share Image" value={settings.homepageShareImage} onChange={(value) => update('homepageShareImage', value)} type="url" /><Field label="Fallback Open Graph Image" value={settings.fallbackOpenGraphImage} onChange={(value) => update('fallbackOpenGraphImage', value)} type="url" /><Field label="Fallback Twitter Image" value={settings.fallbackTwitterImage} onChange={(value) => update('fallbackTwitterImage', value)} type="url" /></div></Panel></div>
        <Panel title="Social Preview"><div className="overflow-hidden rounded-xl border border-[#33475d] bg-[#071321]">{(settings.openGraphImage || settings.fallbackOpenGraphImage || settings.homepageShareImage) ? <img src={settings.openGraphImage || settings.fallbackOpenGraphImage || settings.homepageShareImage} alt="Social preview" className="aspect-[1.91/1] w-full object-cover" /> : <div className="grid aspect-[1.91/1] place-items-center bg-[#102236] text-slate-500"><ImageIcon className="h-12 w-12" /></div>}<div className="p-4"><p className="text-xs uppercase text-slate-500">pullz.gg</p><p className="mt-1 font-bold text-white">{settings.openGraphTitle || settings.seoTitle}</p><p className="mt-2 text-sm text-slate-400">{settings.openGraphDescription || settings.metaDescription}</p></div></div></Panel>
      </div>}

      {activeTab === 'advanced' && <div className="grid gap-5 xl:grid-cols-2">
        <Panel title="Structured Data"><div className="grid gap-5"><div className="grid gap-3 sm:grid-cols-2"><Toggle label="Organization schema" value={settings.enableOrganizationSchema} onChange={(value) => update('enableOrganizationSchema', value)} /><Toggle label="Website schema" value={settings.enableWebsiteSchema} onChange={(value) => update('enableWebsiteSchema', value)} /><Toggle label="SearchAction schema" value={settings.enableSearchActionSchema} onChange={(value) => update('enableSearchActionSchema', value)} /></div><Field label="Organization Name" value={settings.organizationName} onChange={(value) => update('organizationName', value)} /><Field label="Organization Description" value={settings.organizationDescription} onChange={(value) => update('organizationDescription', value)} multiline /><div className="grid gap-5 sm:grid-cols-2"><Field label="Website URL" value={settings.businessUrl} onChange={(value) => update('businessUrl', value)} type="url" /><Field label="Business Email" value={settings.businessEmail} onChange={(value) => update('businessEmail', value)} type="email" /></div><Field label="Schema Logo URL" value={settings.schemaLogo} onChange={(value) => update('schemaLogo', value)} type="url" /></div></Panel>
        <div className="space-y-5"><Panel title="Search Verification"><div className="grid gap-5 sm:grid-cols-2"><Field label="Google Search Console" value={settings.googleVerification} onChange={(value) => update('googleVerification', value)} /><Field label="Bing Webmaster" value={settings.bingVerification} onChange={(value) => update('bingVerification', value)} /><Field label="Pinterest" value={settings.pinterestVerification} onChange={(value) => update('pinterestVerification', value)} /><Field label="Yandex" value={settings.yandexVerification} onChange={(value) => update('yandexVerification', value)} /></div></Panel><Panel title="Robots & Sitemap"><div className="grid gap-5"><label className="block"><span className="mb-2 block text-sm font-medium text-slate-200">Robots Meta</span><select value={settings.robotsMeta} onChange={(event) => update('robotsMeta', event.target.value as SeoSettings['robotsMeta'])} className="w-full rounded-lg border border-[#33475d] bg-[#071321] px-4 py-2.5 text-sm text-white">{['index,follow', 'index,nofollow', 'noindex,follow', 'noindex,nofollow'].map((value) => <option key={value}>{value}</option>)}</select></label><Field label="Sitemap URL" value={settings.sitemapUrl} onChange={(value) => update('sitemapUrl', value)} type="url" /><Field label="Additional Head Markup" value={settings.additionalHeadMarkup} onChange={(value) => update('additionalHeadMarkup', value)} multiline hint="Only safe meta and link tags are applied; scripts remain blocked." /></div></Panel></div>
        <Panel title="Social Profiles" className="xl:col-span-2"><div className="grid gap-3 sm:grid-cols-2">{settings.socialProfiles.map((url, index) => <div key={index} className="flex gap-2"><input value={url} onChange={(event) => update('socialProfiles', settings.socialProfiles.map((item, itemIndex) => itemIndex === index ? event.target.value : item))} className="w-full rounded-lg border border-[#33475d] bg-[#071321] px-4 py-2.5 text-sm text-white" /><button onClick={() => update('socialProfiles', settings.socialProfiles.filter((_, itemIndex) => itemIndex !== index))} aria-label="Remove profile" className="rounded-lg border border-red-500/30 px-3 text-red-300 hover:bg-red-500/10"><Trash2 className="h-4 w-4" /></button></div>)}</div><button onClick={() => update('socialProfiles', [...settings.socialProfiles, ''])} className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-cyan-300"><Plus className="h-4 w-4" /> Add profile</button></Panel>
      </div>}

      <div className="sticky bottom-3 mt-6 flex justify-end"><button onClick={() => void save()} disabled={saving || !dirty} className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-sky-500 to-cyan-400 px-5 py-3 text-sm font-bold text-slate-950 shadow-xl shadow-black/30 disabled:opacity-50"><Save className="h-4 w-4" /> {saving ? 'Saving…' : 'Save Changes'}</button></div>
    </div>
  );
};
