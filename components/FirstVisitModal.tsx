import React, { useState } from 'react';
import { X, Info, Shield } from 'lucide-react';

type IntroHighlight = {
  title: string;
  description: string;
};

export type IntroContent = {
  key: string;
  title: string;
  subtitle: string;
  icon: React.ElementType;
  accent: string;
  tag: string;
  highlights: IntroHighlight[];
  reminders: string[];
};

interface FirstVisitModalProps {
  isOpen: boolean;
  onClose: (dontShowAgain: boolean) => void;
  content: IntroContent | null;
}

export const FirstVisitModal: React.FC<FirstVisitModalProps> = ({ isOpen, onClose, content }) => {
  const [dontShowAgain, setDontShowAgain] = useState(false);

  if (!isOpen || !content) return null;

  const { icon: Icon } = content;
  const handleClose = () => onClose(dontShowAgain);

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center px-4 py-8 sm:px-6 lg:px-8">
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={handleClose}
        aria-hidden="true"
      ></div>

      <div className="relative w-full max-w-4xl bg-gradient-to-br from-[#0d111a] via-[#0b0f18] to-[#0c1220] border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
        <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_top,_rgba(139,92,246,0.12),_transparent_45%),_radial-gradient(circle_at_bottom,_rgba(34,211,238,0.12),_transparent_40%)]"></div>

        <div className="flex flex-col gap-4 sm:gap-6 p-5 sm:p-7 lg:p-8 relative z-10">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${content.accent} flex items-center justify-center shadow-lg shadow-brand-purple/30`}>
                <Icon className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wide text-gray-400 font-semibold">{content.tag}</p>
                <h2 className="text-2xl sm:text-3xl font-black text-white leading-tight">{content.title}</h2>
                <p className="text-gray-400 text-sm sm:text-base mt-1">{content.subtitle}</p>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="text-gray-500 hover:text-white transition-colors"
              aria-label="Close welcome guide"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            {content.highlights.map((item) => (
              <div
                key={item.title}
                className="rounded-xl border border-white/10 bg-white/5 p-4 sm:p-5 shadow-[0_10px_40px_rgba(0,0,0,0.35)]"
              >
                <h3 className="text-base font-semibold text-white mb-2">{item.title}</h3>
                <p className="text-sm text-gray-300 leading-relaxed">{item.description}</p>
              </div>
            ))}
          </div>

          <div className="rounded-xl border border-white/10 bg-gradient-to-r from-white/5 via-white/3 to-white/5 p-4 sm:p-5 flex flex-col gap-3">
            <div className="flex items-center gap-2 text-white font-semibold">
              <Info className="w-4 h-4 text-blue-300" />
              Quick reminders
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-gray-300">
              {content.reminders.map((item) => (
                <div key={item} className="flex items-start gap-2">
                  <Shield className="w-4 h-4 text-brand-purple mt-0.5 shrink-0" />
                  <p className="leading-relaxed">{item}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={dontShowAgain}
                onChange={(e) => setDontShowAgain(e.target.checked)}
                className="w-4 h-4 rounded border-gray-600 bg-[#0b0e14] text-brand-purple focus:ring-brand-purple/50 focus:ring-2"
              />
              <span className="text-sm text-gray-300">Don&apos;t show this page again</span>
            </label>

            <button
              onClick={handleClose}
              className="px-5 py-2 text-sm font-bold text-white rounded-lg bg-gradient-to-r from-brand-purple to-blue-500 shadow-lg shadow-brand-purple/30 hover:shadow-brand-purple/40 transition-all w-full sm:w-auto text-center"
            >
              Got it
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
