import React, { useEffect, useRef, useState } from 'react';
import { BarChart3, Cookie, Megaphone, ShieldCheck, SlidersHorizontal, X } from 'lucide-react';
import { getConsentPreferences, loadMarketingScripts, setConsentPreferences } from '../utils/cookieConsent';
import { initializeAnalytics, updateAnalyticsConsent } from '../services/analytics';

type Props = { onAnalyticsConsent?: () => void; isPromoVisible?: boolean };

const Choice = ({ icon, title, text, checked, disabled, onChange }: { icon: React.ReactNode; title: string; text: string; checked: boolean; disabled?: boolean; onChange?: (value: boolean) => void }) => (
  <div className="flex gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.035] p-4 sm:p-5">
    <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-violet-300/15 bg-violet-500/10 text-violet-200">{icon}</div>
    <div className="min-w-0 flex-1"><div className="flex min-h-10 items-center justify-between gap-3"><h3 className="font-bold text-white">{title}</h3>
      <button type="button" role="switch" aria-checked={checked} disabled={disabled} aria-label={`${title}: ${checked ? 'enabled' : 'disabled'}`} onClick={() => onChange?.(!checked)} className={`relative h-7 w-12 shrink-0 rounded-full border transition focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-300 ${checked ? 'border-violet-400 bg-violet-600' : 'border-white/20 bg-white/10'} disabled:cursor-not-allowed disabled:opacity-80`}><span className={`absolute top-1 h-[18px] w-[18px] rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-[24px]' : 'translate-x-1'}`} /></button>
    </div><p className="mt-1 text-sm leading-6 text-slate-400">{text}</p></div>
  </div>
);

export const CookieConsentToast: React.FC<Props> = ({ onAnalyticsConsent }) => {
  const initial = getConsentPreferences();
  const [banner, setBanner] = useState(!initial);
  const [settings, setSettings] = useState(false);
  const [analytics, setAnalytics] = useState(initial?.analytics ?? false);
  const [advertising, setAdvertising] = useState(initial?.advertising ?? false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => { if (initial?.advertising) loadMarketingScripts(); }, []);
  useEffect(() => {
    const open = () => { const current = getConsentPreferences(); setAnalytics(current?.analytics ?? false); setAdvertising(current?.advertising ?? false); setBanner(false); setSettings(true); };
    window.addEventListener('pullz:open-cookie-settings', open); return () => window.removeEventListener('pullz:open-cookie-settings', open);
  }, []);
  useEffect(() => {
    if (!settings) return;
    returnFocusRef.current = document.activeElement as HTMLElement;
    const previousOverflow = document.body.style.overflow; document.body.style.overflow = 'hidden';
    const focusable = (): HTMLElement[] => dialogRef.current
      ? Array.from(dialogRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), [href], input, [tabindex]:not([tabindex="-1"])'))
      : [];
    requestAnimationFrame(() => focusable()[0]?.focus());
    const keydown = (event: KeyboardEvent) => { if (event.key === 'Escape') setSettings(false); if (event.key === 'Tab') { const nodes = focusable(); if (!nodes.length) return; const first = nodes[0], last = nodes[nodes.length - 1]; if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); } else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); } } };
    document.addEventListener('keydown', keydown);
    return () => { document.removeEventListener('keydown', keydown); document.body.style.overflow = previousOverflow; returnFocusRef.current?.focus(); };
  }, [settings]);

  const save = (nextAnalytics: boolean, nextAdvertising: boolean) => {
    setConsentPreferences({ analytics: nextAnalytics, advertising: nextAdvertising });
    updateAnalyticsConsent(nextAnalytics); if (nextAnalytics) { initializeAnalytics(); onAnalyticsConsent?.(); }
    setAnalytics(nextAnalytics); setAdvertising(nextAdvertising); setBanner(false); setSettings(false);
  };

  return <>
    {banner && <section aria-label="Cookie consent" className="fixed inset-x-0 bottom-0 z-[70] border-t border-violet-300/20 bg-[#0b0911] pb-[env(safe-area-inset-bottom)] shadow-[0_-12px_40px_rgba(0,0,0,.45)]">
      <div className="mx-auto w-full max-w-7xl overflow-hidden">
        <div className="h-px bg-gradient-to-r from-transparent via-violet-400/70 to-transparent" />
        <div className="flex flex-col gap-4 px-4 py-4 sm:px-6 sm:py-5 lg:flex-row lg:items-center lg:gap-8"><div className="flex min-w-0 flex-1 gap-3 sm:gap-4"><div className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-violet-300/20 bg-gradient-to-br from-violet-500/25 to-fuchsia-500/10 text-violet-200 shadow-inner sm:flex"><Cookie className="h-6 w-6" /></div><div><h2 className="text-lg font-extrabold tracking-tight text-white sm:text-xl">Your privacy, your choice</h2><p className="mt-1 max-w-2xl text-sm leading-5 text-slate-400 sm:leading-6">We use optional cookies to understand what works and show more relevant ads. Necessary cookies keep Pullz secure and always stay on.</p><button onClick={() => setSettings(true)} className="mt-1 min-h-11 text-sm font-bold text-violet-300 underline decoration-violet-400/40 underline-offset-4 transition hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-300 sm:mt-2">Manage preferences</button></div></div>
          <div className="grid w-full gap-2.5 sm:grid-cols-2 lg:w-auto lg:min-w-[390px]"><button onClick={() => save(false, false)} className="min-h-12 rounded-xl border border-white/15 bg-white/[0.05] px-5 font-bold text-white transition hover:border-white/30 hover:bg-white/[0.09] focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-300">Necessary only</button><button onClick={() => save(true, true)} className="min-h-12 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-6 font-extrabold text-white shadow-[0_10px_30px_rgba(124,58,237,.32)] transition hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-white">Accept all</button></div>
        </div></div></section>}
    {settings && <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/75 p-0 backdrop-blur-sm sm:items-center sm:p-5" onMouseDown={(e) => { if (e.target === e.currentTarget) setSettings(false); }}><div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="cookie-settings-title" className="max-h-[min(92dvh,760px)] w-full overflow-y-auto rounded-t-[28px] border border-white/10 bg-[#0c0a12] shadow-[0_30px_100px_rgba(0,0,0,.8)] sm:max-w-xl sm:rounded-[28px]">
      <div className="sticky top-0 z-10 flex items-start justify-between border-b border-white/[0.08] bg-[#0c0a12]/95 px-5 py-5 backdrop-blur sm:px-7"><div className="flex gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-500/15 text-violet-200"><SlidersHorizontal className="h-5 w-5" /></div><div><h2 id="cookie-settings-title" className="text-xl font-extrabold text-white">Cookie preferences</h2><p className="mt-0.5 text-sm text-slate-400">Choose what you’re comfortable with.</p></div></div><button aria-label="Close cookie preferences" onClick={() => setSettings(false)} className="flex h-11 w-11 items-center justify-center rounded-xl text-slate-400 transition hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-300"><X /></button></div>
      <div className="space-y-3 px-5 py-5 sm:px-7"><Choice icon={<ShieldCheck className="h-5 w-5" />} title="Necessary" text="Required for security, sign-in, saved preferences, and core site features." checked disabled /><Choice icon={<BarChart3 className="h-5 w-5" />} title="Analytics" text="Helps us understand site performance and improve your Pullz experience." checked={analytics} onChange={setAnalytics} /><Choice icon={<Megaphone className="h-5 w-5" />} title="Advertising" text="Allows Meta Pixel to measure campaigns and make advertising more relevant." checked={advertising} onChange={setAdvertising} /></div>
      <div className="sticky bottom-0 grid gap-2 border-t border-white/[0.08] bg-[#0c0a12]/95 px-5 pb-[calc(env(safe-area-inset-bottom)+20px)] pt-4 backdrop-blur sm:grid-cols-2 sm:px-7 sm:pb-5"><button onClick={() => save(false, false)} className="min-h-12 rounded-xl border border-white/15 font-bold text-white hover:bg-white/[0.06] focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-300">Necessary only</button><button onClick={() => save(analytics, advertising)} className="min-h-12 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 font-extrabold text-white shadow-lg hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-white">Save preferences</button></div>
    </div></div>}
  </>;
};
