import React, { useMemo, useState } from 'react';
import { Tag, ChevronLeft } from 'lucide-react';
import { useGame } from '../context/GameContext';
import { useSound } from '../context/SoundContext';
import { MysteryBox } from '../types';
import { BoxCard } from './BoxCard';

const normalizeTag = (tag: string) => tag.trim().toLowerCase();

const getBoxTags = (box: MysteryBox) => {
  const tags = new Set<string>();
  if (box.tag) tags.add(box.tag);
  box.tags?.forEach(tag => tags.add(tag));
  return Array.from(tags);
};

export const BoxCatalog: React.FC = () => {
  const { boxes, setView } = useGame();
  const { playSound } = useSound();
  const [activeTag, setActiveTag] = useState<string>('All');

  const displayBoxes = useMemo(
    () => boxes.filter(box => !box.isDaily),
    [boxes]
  );

  const tagOptions = useMemo(() => {
    const tagSet = new Set<string>();
    displayBoxes.filter(box => !box.isUserCreated).forEach(box => {
      getBoxTags(box).forEach(tag => tagSet.add(tag));
    });
    const options = ['All', ...Array.from(tagSet).sort((a, b) => a.localeCompare(b))];
    if (displayBoxes.some(box => box.isUserCreated)) {
      options.push('User Created');
    }
    return options;
  }, [displayBoxes]);

  const filteredBoxes = useMemo(() => {
    if (activeTag === 'All') return displayBoxes.filter(box => !box.isUserCreated);
    if (activeTag === 'User Created') return displayBoxes.filter(box => box.isUserCreated);
    const target = normalizeTag(activeTag);
    return displayBoxes.filter(box =>
      !box.isUserCreated && getBoxTags(box).some(tag => normalizeTag(tag) === target)
    );
  }, [activeTag, displayBoxes]);

  return (
    <section className="max-w-[1400px] mx-auto p-4 md:p-6 lg:p-8 animate-in fade-in duration-300">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              playSound('click');
              setView({ type: 'HOME' });
            }}
            className="flex items-center gap-2 px-3 py-1.5 bg-[#131825] rounded text-gray-400 hover:text-white text-sm font-medium transition-colors"
          >
            <ChevronLeft className="w-4 h-4" /> Back
          </button>
          <div>
            <h2 className="text-2xl font-bold text-white">All Mystery Boxes</h2>
            <p className="text-sm text-gray-400">Filter by tag to find the box you want.</p>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        {tagOptions.map(tag => {
          const isSelected = activeTag === tag;
          return (
            <button
              key={tag}
              type="button"
              onClick={() => {
                playSound('click');
                setActiveTag(tag);
              }}
              className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full border text-xs font-semibold uppercase tracking-wide transition ${isSelected ? 'bg-blue-600/20 border-blue-500 text-blue-200' : 'bg-[#0b0e14] border-gray-700 text-gray-400 hover:border-gray-500'}`}
            >
              <Tag className="w-3 h-3" />
              {tag}
              {tag !== 'All' && (
                <span className="text-[10px] text-gray-500 font-semibold">
                  ({tag === 'User Created'
                    ? displayBoxes.filter(box => box.isUserCreated).length
                    : displayBoxes.filter(box => !box.isUserCreated && getBoxTags(box).some(boxTag => normalizeTag(boxTag) === normalizeTag(tag))).length})
                </span>
              )}
            </button>
          );
        })}
      </div>

      {filteredBoxes.length > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {filteredBoxes.map(box => (
            <BoxCard
              key={box.id}
              box={box}
              onSelect={(boxId) => {
                playSound('click');
                setView({ type: 'CASE_OPENING', boxId });
              }}
              onHover={() => playSound('hover')}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-gray-800 bg-[#0b0e14] p-6 text-sm text-gray-500">
          No boxes found for this tag yet.
        </div>
      )}
    </section>
  );
};
