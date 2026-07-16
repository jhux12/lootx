import React from 'react';
import { ImageIcon } from 'lucide-react';

type Props = {
  assetName: string;
  dimensions: string;
  format: string;
  aspectRatio: '1:1' | '4:5' | '3:2' | '16:9' | string;
  usage: string;
  className?: string;
};

const ratioClass = (aspectRatio: Props['aspectRatio']) => {
  if (aspectRatio === '1:1') return 'aspect-square';
  if (aspectRatio === '4:5') return 'aspect-[4/5]';
  if (aspectRatio === '3:2') return 'aspect-[3/2]';
  if (aspectRatio === '16:9') return 'aspect-video';
  return 'aspect-[4/3]';
};

export const HomepageImagePlaceholder: React.FC<Props> = ({ assetName, dimensions, format, aspectRatio, usage, className = '' }) => (
  <div className={`relative grid w-full place-items-center overflow-hidden rounded-2xl border border-purple-400/30 bg-[#090712] p-4 text-center text-slate-300 shadow-inner ${ratioClass(aspectRatio)} ${className}`}>
    <div className="absolute inset-0 opacity-[0.08] [background-image:linear-gradient(rgba(255,255,255,.55)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.55)_1px,transparent_1px)] [background-size:28px_28px]" aria-hidden="true" />
    <div className="relative z-10 max-w-xs">
      <ImageIcon className="mx-auto mb-3 h-8 w-8 text-purple-300" aria-hidden="true" />
      <p className="text-xs font-black uppercase tracking-[0.18em] text-purple-200">{assetName}</p>
      <p className="mt-2 text-sm font-bold text-white">{dimensions}</p>
      <p className="text-xs text-slate-300">{aspectRatio} {format}</p>
      <p className="mt-3 text-[11px] leading-5 text-slate-400">{usage}</p>
    </div>
  </div>
);
