import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Loader2, Trash2, TriangleAlert } from 'lucide-react';
import { Input } from '../ui/Input';
import { HomepageImagePlaceholder } from './HomepageImagePlaceholder';
import { isSafeImageUrl } from '../../utils/homepageContent';

type Props = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  altValue?: string;
  onAltChange?: (value: string) => void;
  recommendedDimensions: string;
  acceptedFormats: string;
  aspectRatio: '1:1' | '4:5' | '3:2' | '16:9' | string;
  usage: string;
  saveState?: 'idle' | 'dirty' | 'saving' | 'saved' | 'error';
  placeholder?: string;
};

export const ImageUrlField: React.FC<Props> = ({ label, value, onChange, altValue, onAltChange, recommendedDimensions, acceptedFormats, aspectRatio, usage, saveState = 'idle', placeholder = 'https://cdn.example.com/image.webp' }) => {
  const [previewState, setPreviewState] = useState<'empty' | 'loading' | 'loaded' | 'error'>('empty');
  const trimmed = useMemo(() => value.trim(), [value]);
  const protocolValid = isSafeImageUrl(trimmed);
  const generatedAlt = altValue?.trim() || `${label} image`;

  useEffect(() => {
    if (!trimmed) {
      setPreviewState('empty');
      return;
    }
    if (!protocolValid) {
      setPreviewState('error');
      return;
    }
    setPreviewState('loading');
    const image = new Image();
    image.onload = () => setPreviewState('loaded');
    image.onerror = () => setPreviewState('error');
    image.src = trimmed;
    return () => {
      image.onload = null;
      image.onerror = null;
    };
  }, [trimmed, protocolValid]);

  const validationMessage = !protocolValid
    ? 'Use a full http:// or https:// image URL. Unsafe protocols are blocked.'
    : previewState === 'error' && trimmed
      ? 'Image preview failed. Confirm the URL before saving.'
      : previewState === 'loaded'
        ? 'Image preview loaded successfully.'
        : trimmed
          ? 'Checking image preview…'
          : 'No image configured. The homepage will use its fallback behavior.';

  return (
    <div className="rounded-2xl border border-gray-800 bg-[#0b0e14] p-4">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <label className="text-sm font-black text-white" htmlFor={`${label.replace(/[^a-z0-9]/gi, '-')}-url`}>{label}</label>
          <p className="mt-1 text-xs text-gray-400">Recommended: {recommendedDimensions} • {acceptedFormats}</p>
        </div>
        <span className={`mt-2 rounded-full px-2 py-1 text-[10px] font-bold uppercase sm:mt-0 ${saveState === 'dirty' ? 'bg-amber-500/10 text-amber-200' : saveState === 'saving' ? 'bg-blue-500/10 text-blue-200' : saveState === 'saved' ? 'bg-emerald-500/10 text-emerald-200' : saveState === 'error' ? 'bg-red-500/10 text-red-200' : 'bg-gray-700 text-gray-300'}`}>{saveState}</span>
      </div>
      <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px]">
        <div className="space-y-3">
          <Input id={`${label.replace(/[^a-z0-9]/gi, '-')}-url`} type="url" value={value} onChange={(event) => onChange(event.target.value.trimStart())} placeholder={placeholder} className="w-full bg-[#111827] border border-gray-700 rounded-lg px-3 py-2 text-sm text-white" />
          {onAltChange ? (
            <Input type="text" value={altValue ?? ''} onChange={(event) => onAltChange(event.target.value)} placeholder={`Alt text, defaults to “${generatedAlt}”`} className="w-full bg-[#111827] border border-gray-700 rounded-lg px-3 py-2 text-sm text-white" />
          ) : null}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className={`flex items-center gap-2 text-xs ${previewState === 'error' || !protocolValid ? 'text-red-300' : previewState === 'loaded' ? 'text-emerald-300' : 'text-gray-400'}`} id={`${label.replace(/[^a-z0-9]/gi, '-')}-hint`}>
              {previewState === 'loading' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : previewState === 'loaded' ? <CheckCircle2 className="h-3.5 w-3.5" /> : previewState === 'error' ? <TriangleAlert className="h-3.5 w-3.5" /> : null}
              {validationMessage}
            </p>
            <button type="button" onClick={() => { onChange(''); onAltChange?.(''); }} className="inline-flex min-h-9 items-center justify-center gap-2 rounded-lg border border-red-500/25 px-3 text-xs font-bold text-red-200 hover:bg-red-500/10">
              <Trash2 className="h-3.5 w-3.5" /> Clear image
            </button>
          </div>
        </div>
        <div className="relative">
          {trimmed && protocolValid ? (
            <div className="grid aspect-square place-items-center overflow-hidden rounded-2xl border border-gray-700 bg-black/30 p-2">
              {previewState === 'loading' ? <Loader2 className="h-8 w-8 animate-spin text-purple-300" /> : <img src={trimmed} alt={generatedAlt} className="h-full w-full object-contain" loading="lazy" decoding="async" />}
            </div>
          ) : (
            <HomepageImagePlaceholder assetName={label} dimensions={recommendedDimensions} format={acceptedFormats} aspectRatio={aspectRatio} usage={usage} />
          )}
        </div>
      </div>
    </div>
  );
};
