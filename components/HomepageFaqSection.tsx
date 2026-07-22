import React, { useState } from 'react';
import { CheckCircle2, Minus, Plus, ExternalLink } from 'lucide-react';
import { useGame } from '../context/GameContext';
import { trackEvent } from '../utils/trackEvent';
import { HOMEPAGE_FAQS, HomepageFaq } from '../utils/faqContent';

const FaqAnswer: React.FC<{ faq: HomepageFaq }> = ({ faq }) => {
  const { setView } = useGame();
  const links = faq.links ?? [];
  const parts = links.length ? faq.answer.split(new RegExp(`(${links.map((link) => link.label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi')) : [faq.answer];
  return <p className="text-sm leading-6 text-slate-300">{parts.map((part, index) => {
    const link = faq.links?.find((entry) => entry.label.toLowerCase() === part.toLowerCase());
    return link ? <button key={`${link.label}-${index}`} type="button" onClick={() => setView({ type: link.view })} className="font-semibold text-sky-200 underline decoration-sky-300/40 underline-offset-4 hover:text-white focus:outline-none focus:ring-2 focus:ring-sky-300/70">{part}</button> : <React.Fragment key={index}>{part}</React.Fragment>;
  })}</p>;
};

const FaqAccordionItem: React.FC<{ faq: HomepageFaq; isOpen: boolean; onToggle: () => void }> = ({ faq, isOpen, onToggle }) => {
  const panelId = `faq-panel-${faq.id}`;
  return <article className="overflow-hidden rounded-xl border border-[#2a3b58] bg-[#101827]/90">
    <button type="button" onClick={onToggle} id={faq.id} aria-expanded={isOpen} aria-controls={panelId} className="flex min-h-14 w-full items-center justify-between gap-4 px-4 py-3 text-left text-sm font-bold text-white transition-colors hover:bg-white/[0.035] focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sky-300/80 sm:px-5 sm:text-[15px]">
      <span>{faq.question}</span>{isOpen ? <Minus className="h-5 w-5 shrink-0 text-sky-200" aria-hidden="true" /> : <Plus className="h-5 w-5 shrink-0 text-slate-400" aria-hidden="true" />}
    </button>
    <div id={panelId} role="region" aria-labelledby={faq.id} className={`grid transition-[grid-template-rows,opacity] duration-200 motion-reduce:transition-none ${isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
      <div className="min-h-0 overflow-hidden"><div className="border-t border-[#2a3b58] px-4 py-4 sm:px-5"><FaqAnswer faq={faq} /></div></div>
    </div>
  </article>;
};

export const HomepageFaqSection: React.FC<{ standalone?: boolean }> = ({ standalone = false }) => {
  const { setView } = useGame();
  const [openId, setOpenId] = useState<string | null>(HOMEPAGE_FAQS[0]?.id ?? null);
  const toggle = (id: string) => { setOpenId((current) => { const next = current === id ? null : id; if (next) trackEvent('HomepageFaqOpened', { question_id: id }); return next; }); };
  const support = () => { trackEvent('HomepageFaqSupportClicked', { placement: standalone ? 'faq_page' : 'homepage' }); setView({ type: 'CONTACT' }); };
  return <section id="faq" aria-labelledby="homepage-faq-title" className={`scroll-mt-24 ${standalone ? 'mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14' : 'px-3 pb-8 pt-2 sm:px-0 sm:pb-10'}`}>
    <div className="grid gap-7 lg:grid-cols-[minmax(0,0.72fr)_minmax(0,1.28fr)] lg:gap-12">
      <div className="lg:sticky lg:top-24 lg:self-start"><p className="text-[10px] font-black uppercase tracking-[0.2em] text-sky-200/80">Frequently asked questions</p><h2 id="homepage-faq-title" className="mt-3 max-w-md text-3xl font-black tracking-tight text-white sm:text-4xl">Questions before your first box?</h2><p className="mt-4 max-w-md text-sm leading-6 text-slate-400">Learn how boxes, collectible ownership, exchanges, shipping, and account options work.</p><button type="button" onClick={support} className="mt-5 inline-flex min-h-11 items-center gap-2 text-sm font-bold text-sky-200 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/80"><ExternalLink className="h-4 w-4" />Still need help? Contact support</button></div>
      <div className="space-y-2.5">{HOMEPAGE_FAQS.map((faq) => <FaqAccordionItem key={faq.id} faq={faq} isOpen={openId === faq.id} onToggle={() => toggle(faq.id)} />)}
        <aside className="mt-5 rounded-2xl border border-violet-400/20 bg-[radial-gradient(circle_at_100%_0%,rgba(124,92,255,0.18),transparent_46%),#111b2d] p-5 shadow-[0_12px_32px_rgba(0,0,0,0.18)]"><CheckCircle2 className="h-5 w-5 text-emerald-400" aria-hidden="true" /><h3 className="mt-3 text-xl font-black text-white">Ready to explore your collection?</h3><p className="mt-2 text-sm leading-6 text-slate-400">Browse the available boxes and choose the one that fits your collection.</p><div className="mt-4 flex flex-col gap-2 sm:flex-row"><button type="button" onClick={() => setView({ type: 'BOXES' })} className="min-h-11 rounded-xl bg-gradient-to-r from-[#205DD7] to-sky-500 px-4 text-xs font-black uppercase tracking-wide text-white shadow-[0_8px_20px_rgba(32,93,215,0.28)] transition hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-200">View all boxes</button><button type="button" onClick={support} className="min-h-11 rounded-xl border border-white/15 px-4 text-xs font-black uppercase tracking-wide text-slate-200 transition hover:border-sky-300/45 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/80">Contact support</button></div></aside>
      </div>
    </div>
  </section>;
};
