import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react';
import spinSoundUrl from '../assets/spinsound.mp3';

type SoundType = 'click' | 'hover' | 'spin-start' | 'spin-tick' | 'win-common' | 'win-rare' | 'win-gold' | 'gold-mode' | 'coins';

interface SoundContextType {
  muted: boolean;
  toggleMute: () => void;
  playSound: (type: SoundType) => void;
}

const SoundContext = createContext<SoundContextType | undefined>(undefined);

const SOUND_URLS: Record<SoundType, string> = {
  click: spinSoundUrl,
  hover: spinSoundUrl,
  'spin-start': spinSoundUrl,
  'spin-tick': spinSoundUrl,
  'win-common': spinSoundUrl,
  'win-rare': spinSoundUrl,
  'win-gold': spinSoundUrl,
  'gold-mode': spinSoundUrl,
  coins: spinSoundUrl
};

const SOUND_VOLUMES: Partial<Record<SoundType, number>> = {
  'spin-start': 0.2,
  hover: 0.05
};

export const SoundProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [muted, setMuted] = useState(false);
  const audioRefs = useRef<Partial<Record<SoundType, HTMLAudioElement>>>({});
  const didInitRef = useRef(false);
  const hoverThrottleRef = useRef(0);

  const initializeAudio = useCallback(() => {
    if (didInitRef.current || typeof window === 'undefined') return;
    didInitRef.current = true;

    (Object.keys(SOUND_URLS) as SoundType[]).forEach((key) => {
      try {
        const audio = new Audio(SOUND_URLS[key]);
        audio.preload = 'none';
        audio.volume = SOUND_VOLUMES[key] ?? 0.4;
        audioRefs.current[key] = audio;
      } catch (error) {
        console.warn('Sound init failed', key, error);
      }
    });
  }, []);

  useEffect(() => {
    const bootstrap = () => initializeAudio();
    window.addEventListener('pointerdown', bootstrap, { once: true, passive: true });
    window.addEventListener('keydown', bootstrap, { once: true });
    return () => {
      window.removeEventListener('pointerdown', bootstrap);
      window.removeEventListener('keydown', bootstrap);
    };
  }, [initializeAudio]);

  const toggleMute = useCallback(() => setMuted((prev) => !prev), []);

  const playSound = useCallback((type: SoundType) => {
    if (muted) return;
    initializeAudio();

    if (type === 'hover') {
      const now = Date.now();
      if (now - hoverThrottleRef.current < 250) return;
      hoverThrottleRef.current = now;
    }

    const audio = audioRefs.current[type];
    if (!audio) return;

    try {
      audio.currentTime = 0;
      void audio.play().catch(() => undefined);
    } catch {
      // ignore playback errors
    }
  }, [initializeAudio, muted]);

  return <SoundContext.Provider value={{ muted, toggleMute, playSound }}>{children}</SoundContext.Provider>;
};

export const useSound = () => {
  const context = useContext(SoundContext);
  if (!context) {
    throw new Error('useSound must be used within a SoundProvider');
  }
  return context;
};
