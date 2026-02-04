import React from 'react';

type BoxTagPillsProps = {
  tags?: string[];
  maxVisible?: number;
  className?: string;
};

export const BoxTagPills: React.FC<BoxTagPillsProps> = ({ tags = [], maxVisible = 2, className }) => {
  const normalized = tags
    .map((tag) => tag.trim().toLowerCase())
    .filter(Boolean);
  const uniqueTags = Array.from(new Set(normalized));

  if (uniqueTags.length === 0) return null;

  const visibleTags = uniqueTags.slice(0, maxVisible);
  const remaining = uniqueTags.length - visibleTags.length;

  return (
    <div className={`flex flex-wrap items-center justify-center gap-1.5 ${className ?? ''}`}>
      {visibleTags.map((tag) => (
        <span
          key={tag}
          className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-300"
        >
          {tag}
        </span>
      ))}
      {remaining > 0 && (
        <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
          +{remaining}
        </span>
      )}
    </div>
  );
};
