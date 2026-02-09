import React, { useMemo } from 'react';
import { renderMarkdownToHtml } from '../../utils/markdown';

type MarkdownEditorWithPreviewProps = {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
};

export const MarkdownEditorWithPreview: React.FC<MarkdownEditorWithPreviewProps> = ({
  value,
  onChange,
  label = 'Draft Markdown',
  placeholder = 'Write markdown content...'
}) => {
  const previewHtml = useMemo(() => renderMarkdownToHtml(value), [value]);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="flex flex-col gap-3">
        <div className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">{label}</div>
        <textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className="min-h-[320px] w-full rounded-2xl border border-white/10 bg-[#0b0f1a] p-4 text-sm text-gray-100 shadow-[0_0_20px_rgba(99,102,241,0.08)] outline-none transition focus:border-purple-400/60 focus:ring-2 focus:ring-purple-500/30"
        />
      </div>
      <div className="flex flex-col gap-3">
        <div className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">Live preview</div>
        <div className="min-h-[320px] w-full rounded-2xl border border-white/10 bg-white/5 p-4 md:p-6 text-gray-200">
          <div
            className="space-y-3"
            dangerouslySetInnerHTML={{ __html: previewHtml }}
          />
        </div>
      </div>
    </div>
  );
};
