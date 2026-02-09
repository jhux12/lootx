import React, { useEffect, useMemo, useRef, useState } from 'react';

export type MobileFeatureItem = {
  id: string;
  title: string;
  label?: string;
  description: string;
  icon?: React.ReactNode;
  cta?: {
    label: string;
    href: string;
  };
};

type MobileFeatureStripProps = {
  items: MobileFeatureItem[];
  selectedId?: string;
  onChangeSelected?: (id: string) => void;
  showStepIndex?: boolean;
};

export const MobileFeatureStrip: React.FC<MobileFeatureStripProps> = ({
  items,
  selectedId,
  onChangeSelected,
  showStepIndex = false
}) => {
  const defaultSelected = items[0]?.id ?? '';
  const [activeId, setActiveId] = useState(selectedId ?? defaultSelected);
  const pillRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const hasInteractedRef = useRef(false);

  useEffect(() => {
    if (selectedId && selectedId !== activeId) {
      setActiveId(selectedId);
    }
  }, [selectedId, activeId]);

  useEffect(() => {
    if (!items.find((item) => item.id === activeId) && defaultSelected) {
      setActiveId(defaultSelected);
    }
  }, [items, activeId, defaultSelected]);

  useEffect(() => {
    if (!activeId || !hasInteractedRef.current) return;
    pillRefs.current[activeId]?.scrollIntoView({
      behavior: 'smooth',
      inline: 'center',
      block: 'nearest'
    });
  }, [activeId]);

  const activeItem = useMemo(
    () => items.find((item) => item.id === activeId) ?? items[0],
    [activeId, items]
  );
  const activeIndex = useMemo(
    () => items.findIndex((item) => item.id === activeItem?.id),
    [items, activeItem]
  );

  const handleSelect = (id: string) => {
    hasInteractedRef.current = true;
    setActiveId(id);
    onChangeSelected?.(id);
  };

  if (!items.length || !activeItem) {
    return null;
  }

  return (
    <div className="md:hidden">
      <div
        className="flex gap-3 overflow-x-auto pb-1 pt-1 snap-x snap-mandatory scroll-smooth [&::-webkit-scrollbar]:hidden"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {items.map((item) => {
          const isActive = item.id === activeItem.id;
          return (
            <button
              key={item.id}
              ref={(node) => {
                pillRefs.current[item.id] = node;
              }}
              type="button"
              onClick={() => handleSelect(item.id)}
              className={`flex shrink-0 snap-center items-center gap-2 rounded-full border px-4 py-2 text-xs font-semibold transition ${
                isActive
                  ? 'border-purple-400/60 bg-purple-500/10 text-white shadow-[0_0_18px_rgba(168,85,247,0.35)]'
                  : 'border-white/10 bg-white/5 text-gray-300 hover:border-white/20 hover:text-white'
              }`}
            >
              {item.icon ? (
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-white/5 text-purple-200">
                  {item.icon}
                </span>
              ) : null}
              <span>{item.label ?? item.title}</span>
            </button>
          );
        })}
      </div>
      <div className="mt-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5 text-sm text-gray-300 shadow-[0_20px_60px_-50px_rgba(129,140,248,0.6)]">
          {activeItem.icon ? (
            <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-purple-200">
              {activeItem.icon}
            </div>
          ) : null}
          {showStepIndex && activeIndex >= 0 ? (
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-purple-200/70">
              Step {activeIndex + 1}
            </div>
          ) : null}
          <h3 className="mt-2 text-lg font-semibold text-white">{activeItem.title}</h3>
          <p className="mt-2 text-sm text-gray-400">{activeItem.description}</p>
          {activeItem.cta ? (
            <a
              href={activeItem.cta.href}
              className="mt-4 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-purple-200 transition hover:text-white"
            >
              {activeItem.cta.label}
            </a>
          ) : null}
        </div>
      </div>
    </div>
  );
};
