import React, { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useGame } from '../../context/GameContext';
import { Input } from '../ui/Input';
import type { HomeHeroSlide } from '../../types';

const createDraftSlide = (): HomeHeroSlide => ({
  id: `hero-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  backgroundColor: '#050505',
  image: '',
  link: '',
  text: ''
});

const isValidHexColor = (value: string) => /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value.trim());

export const HomeHeroSlidesEditor: React.FC = () => {
  const { stripeSettings, updateStripeSettings } = useGame();
  const [draft, setDraft] = useState<HomeHeroSlide[]>(stripeSettings.homeHeroSlides);
  const [notice, setNotice] = useState(false);

  useEffect(() => {
    setDraft(stripeSettings.homeHeroSlides);
  }, [stripeSettings.homeHeroSlides]);

  const updateSlide = (id: string, patch: Partial<HomeHeroSlide>) => {
    setDraft((current) => current.map((slide) => (slide.id === id ? { ...slide, ...patch } : slide)));
  };

  const addSlide = () => {
    setDraft((current) => (current.length >= 6 ? current : [...current, createDraftSlide()]));
  };

  const removeSlide = (id: string) => {
    setDraft((current) => current.filter((slide) => slide.id !== id));
  };

  const handleSave = () => {
    updateStripeSettings({ ...stripeSettings, homeHeroSlides: draft });
    setNotice(true);
    window.setTimeout(() => setNotice(false), 3000);
  };

  return (
    <div className="bg-[#131720] border border-gray-800 rounded-xl p-4 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-lg font-bold text-white">Hero slider</h3>
          <p className="mt-1 text-sm text-gray-400">
            The rotating promo cards at the top of the homepage. Each slide can have its own background color, image, link, and headline text. Up to 6 slides. Leave empty to fall back to the top 3 boxes automatically.
          </p>
        </div>
        <button
          type="button"
          onClick={handleSave}
          className="w-full shrink-0 rounded-lg bg-[#205DD7] px-3 py-2 text-xs font-bold text-white hover:bg-[#1f6bea] sm:w-auto"
        >
          Save hero slides
        </button>
      </div>
      {notice && <p className="mt-3 text-xs text-green-400">Hero slides saved.</p>}

      <div className="mt-4 space-y-3">
        {draft.map((slide, index) => {
          const hasValidColor = isValidHexColor(slide.backgroundColor);
          return (
            <div key={slide.id} className="rounded-lg border border-white/10 bg-[#0b0e14] p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">Slide {index + 1}</span>
                <button
                  type="button"
                  onClick={() => removeSlide(slide.id)}
                  className="rounded p-1 text-gray-500 hover:bg-red-500/10 hover:text-red-400"
                  aria-label={`Remove slide ${index + 1}`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-[10px] font-bold uppercase text-gray-500">Background color</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={hasValidColor ? slide.backgroundColor : '#050505'}
                      onChange={(event) => updateSlide(slide.id, { backgroundColor: event.target.value })}
                      className="h-9 w-9 shrink-0 cursor-pointer rounded border border-gray-700 bg-transparent p-0.5"
                      aria-label={`Slide ${index + 1} background color`}
                    />
                    <Input
                      type="text"
                      value={slide.backgroundColor}
                      onChange={(event) => updateSlide(slide.id, { backgroundColor: event.target.value })}
                      placeholder="#050505"
                      className="min-w-0 flex-1 bg-[#080b10] border border-gray-700 rounded p-2 text-xs text-white"
                    />
                  </div>
                  {!hasValidColor && <p className="mt-1 text-[10px] text-amber-400">Enter a valid hex color, e.g. #ff4b0a</p>}
                </div>
                <div>
                  <label className="mb-1 block text-[10px] font-bold uppercase text-gray-500">Image URL</label>
                  <Input
                    type="text"
                    value={slide.image}
                    onChange={(event) => updateSlide(slide.id, { image: event.target.value })}
                    placeholder="https://.../box-art.png"
                    className="w-full bg-[#080b10] border border-gray-700 rounded p-2 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[10px] font-bold uppercase text-gray-500">Link</label>
                  <Input
                    type="text"
                    value={slide.link}
                    onChange={(event) => updateSlide(slide.id, { link: event.target.value })}
                    placeholder="e.g. a box slug, /boxes, or a full URL"
                    className="w-full bg-[#080b10] border border-gray-700 rounded p-2 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[10px] font-bold uppercase text-gray-500">Text</label>
                  <Input
                    type="text"
                    value={slide.text}
                    onChange={(event) => updateSlide(slide.id, { text: event.target.value })}
                    placeholder="Headline shown on the card"
                    className="w-full bg-[#080b10] border border-gray-700 rounded p-2 text-xs text-white"
                  />
                </div>
              </div>
              {slide.image && (
                <div
                  className="mt-3 flex h-28 items-center justify-center overflow-hidden rounded-lg p-3"
                  style={{ background: hasValidColor ? slide.backgroundColor : '#050505' }}
                >
                  <img src={slide.image} alt="" className="h-full w-auto object-contain" />
                  {slide.text && <span className="ml-3 text-sm font-black uppercase text-white">{slide.text}</span>}
                </div>
              )}
            </div>
          );
        })}

        {draft.length === 0 && (
          <p className="rounded-lg border border-dashed border-gray-700 p-4 text-center text-xs text-gray-500">
            No custom hero slides yet — the homepage will show your top 3 boxes automatically.
          </p>
        )}

        <button
          type="button"
          onClick={addSlide}
          disabled={draft.length >= 6}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-gray-700 py-2 text-xs font-semibold text-gray-300 transition-colors hover:border-blue-400 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Plus className="h-4 w-4" /> Add slide{draft.length >= 6 ? ' (max 6)' : ''}
        </button>
      </div>
    </div>
  );
};
