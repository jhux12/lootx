import React from 'react';
import { CaseItem } from '../../types';
import { X } from 'lucide-react';

export const SelectedItemChips: React.FC<{
  items: CaseItem[];
  onRemove: (id: string) => void;
}> = ({ items, onRemove }) => (
  <div className="flex flex-wrap gap-2">
    {items.map((item) => (
      <div
        key={item.id}
        className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-gray-200"
      >
        <span className="max-w-[120px] truncate">{item.name}</span>
        <button
          type="button"
          onClick={() => onRemove(item.id)}
          className="rounded-full border border-white/10 p-1 text-gray-400 transition hover:text-white"
          aria-label={`Remove ${item.name}`}
        >
          <X className="h-3 w-3" />
        </button>
      </div>
    ))}
  </div>
);
