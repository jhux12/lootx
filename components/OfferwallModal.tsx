import React, { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { auth } from '../firebase';
import { useSound } from '../context/SoundContext';

type OfferwallModalProps = {
  open: boolean;
  onClose: () => void;
};

let cachedCpxUrl: string | null = null;

export const OfferwallModal: React.FC<OfferwallModalProps> = ({ open, onClose }) => {
  const { playSound } = useSound();
  const [cpxUrl, setCpxUrl] = useState<string | null>(cachedCpxUrl);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [canCloseBackdrop, setCanCloseBackdrop] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setIframeLoaded(false);
    setCanCloseBackdrop(false);
    const focusTimer = window.setTimeout(() => {
      closeButtonRef.current?.focus();
    }, 50);
    const backdropTimer = window.setTimeout(() => {
      setCanCloseBackdrop(true);
    }, 250);
    return () => {
      window.clearTimeout(focusTimer);
      window.clearTimeout(backdropTimer);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (cachedCpxUrl) {
      setCpxUrl(cachedCpxUrl);
      return;
    }

    const loadOfferwall = async () => {
      setLoading(true);
      setError(null);
      try {
        const currentUser = auth.currentUser;
        if (!currentUser) {
          throw new Error('Please sign in to access the offer wall.');
        }
        const token = await currentUser.getIdToken();
        const response = await fetch('/api/cpx-frame-url', {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(errorText || 'Unable to load offer wall.');
        }
        const data = await response.json();
        if (!data?.url) {
          throw new Error('Offer wall is unavailable.');
        }
        cachedCpxUrl = data.url;
        setCpxUrl(data.url);
      } catch (fetchError) {
        console.error('Failed to load offer wall', fetchError);
        setError(fetchError instanceof Error ? fetchError.message : 'Unable to load offer wall.');
      } finally {
        setLoading(false);
      }
    };

    loadOfferwall();
  }, [open, reloadToken]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        playSound('click');
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose, playSound]);

  const handleBackdropClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!canCloseBackdrop) return;
    if (event.target !== event.currentTarget) return;
    playSound('click');
    onClose();
  };

  const handleRetry = () => {
    cachedCpxUrl = null;
    setCpxUrl(null);
    setIframeLoaded(false);
    setError(null);
    playSound('click');
    setReloadToken((prev) => prev + 1);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Tab') return;
    const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex=\"-1\"])'
    );
    if (!focusable || focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const isShift = event.shiftKey;

    if (isShift && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!isShift && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center px-4 py-5 sm:p-6 animate-in fade-in duration-200"
      aria-hidden={!open}
      onClick={handleBackdropClick}
    >
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-black/70 backdrop-blur-sm pointer-events-none z-0"
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="offerwall-title"
        aria-describedby="offerwall-description"
        className="relative z-10 flex w-full h-full flex-col overflow-hidden rounded-none border border-white/10 bg-[#0f141f]/90 shadow-2xl backdrop-blur-xl sm:h-[80vh] sm:min-h-[60vh] sm:max-h-[80vh] sm:max-w-5xl sm:rounded-2xl animate-in zoom-in-95 duration-200"
        onKeyDown={handleKeyDown}
      >
        <div className="flex items-start justify-between gap-4 border-b border-white/10 px-5 py-4 sm:px-6">
          <div className="space-y-1">
            <h2 id="offerwall-title" className="text-lg font-bold text-white">
              Offer Wall
            </h2>
            <p id="offerwall-description" className="text-xs text-gray-400 sm:text-sm">
              Complete offers to earn coins instantly.
            </p>
            <p className="text-[11px] text-gray-500">
              Coins may take a moment to appear.
            </p>
          </div>
          <button
            ref={closeButtonRef}
            onClick={() => {
              playSound('click');
              onClose();
            }}
            className="rounded-full border border-white/10 bg-white/5 p-2 text-gray-300 transition hover:text-white focus:outline-none focus:ring-2 focus:ring-cyan-400"
            aria-label="Close offer wall"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="relative flex-1 bg-[#0b0e14] p-3 sm:p-4">
          {(loading || error || !cpxUrl) && (
            <div className="flex h-full min-h-[260px] flex-col items-center justify-center gap-3 rounded-xl border border-white/10 bg-[#0d1119] text-center text-sm text-gray-400">
              {loading && (
                <>
                  <span className="h-10 w-10 animate-spin rounded-full border-2 border-cyan-400/60 border-t-transparent" aria-hidden="true" />
                  <span>Fetching offer wall...</span>
                </>
              )}
              {!loading && error && (
                <>
                  <span className="text-sm text-red-400">{error}</span>
                  <button
                    onClick={handleRetry}
                    className="rounded-lg border border-cyan-400/40 bg-cyan-500/10 px-4 py-2 text-xs font-bold uppercase tracking-wide text-cyan-200 transition hover:bg-cyan-500/20"
                  >
                    Retry
                  </button>
                </>
              )}
            </div>
          )}

          {!loading && cpxUrl && !error && (
            <div className="relative h-full min-h-[320px] w-full overflow-hidden rounded-xl border border-white/10 bg-black/30">
              {!iframeLoaded && (
                <div className="absolute inset-0 flex items-center justify-center bg-[#0b0e14]/80">
                  <span className="h-10 w-10 animate-spin rounded-full border-2 border-cyan-400/60 border-t-transparent" aria-hidden="true" />
                </div>
              )}
              <iframe
                title="CPX Offer Wall"
                src={cpxUrl}
                className="h-full w-full rounded-xl"
                allow="clipboard-write"
                onLoad={() => setIframeLoaded(true)}
                onError={() => {
                  setError('Offer wall failed to load. Please try again.');
                  setIframeLoaded(false);
                }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
