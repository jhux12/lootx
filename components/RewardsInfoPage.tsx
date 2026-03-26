import React from 'react';
import { LucideIcon } from 'lucide-react';

type RewardsInfoPageProps = {
  title: string;
  subtitle: string;
  description: string;
  Icon: LucideIcon;
};

export const RewardsInfoPage: React.FC<RewardsInfoPageProps> = ({ title, subtitle, description, Icon }) => (
  <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
    <section className="relative overflow-hidden rounded-[28px] border border-white/10 bg-gradient-to-br from-[#0f1727] via-[#121a2d] to-[#111a2f] px-5 py-8 sm:px-8 sm:py-10">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-24 left-4 h-52 w-52 rounded-full bg-cyan-500/20 blur-3xl sm:h-72 sm:w-72" />
        <div className="absolute -bottom-24 right-0 h-56 w-56 rounded-full bg-violet-500/20 blur-3xl sm:h-80 sm:w-80" />
      </div>
      <div className="relative z-10 flex flex-col gap-4">
        <div className="inline-flex w-fit items-center gap-2 rounded-full border border-cyan-300/30 bg-cyan-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-100 sm:text-xs">
          <Icon className="h-3.5 w-3.5" />
          {subtitle}
        </div>
        <h1 className="text-3xl font-black tracking-tight text-white sm:text-4xl">{title}</h1>
        <p className="max-w-3xl text-sm leading-6 text-slate-200 sm:text-base">{description}</p>
      </div>
    </section>
  </div>
);
