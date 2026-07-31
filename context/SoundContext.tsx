import React, { createContext, useContext, useState, useRef, useCallback } from 'react';
import tickSoundUrl from '../assets/audio/tick.wav';
import commonWinSoundUrl from '../assets/audio/common.wav';
import uncommonWinSoundUrl from '../assets/audio/uncommon.wav';
import rareWinSoundUrl from '../assets/audio/rare.wav';
import epicWinSoundUrl from '../assets/audio/epic.wav';
import legendaryWinSoundUrl from '../assets/audio/legendary.wav';

type SoundType = 'click' | 'hover' | 'spin-start' | 'spin-tick' | 'win-common' | 'win-uncommon' | 'win-rare' | 'win-epic' | 'win-gold' | 'gold-mode' | 'coins';

interface SoundContextType {
  muted: boolean;
  toggleMute: () => void;
  unlockAudio: () => void;
  playSound: (type: SoundType) => void;
}

const SoundContext = createContext<SoundContextType | undefined>(undefined);

const SOUND_URLS: Partial<Record<SoundType, string>> = {
  'spin-tick': tickSoundUrl,
  'win-common': commonWinSoundUrl,
  'win-uncommon': uncommonWinSoundUrl,
  'win-rare': rareWinSoundUrl,
  'win-epic': epicWinSoundUrl,
  'win-gold': legendaryWinSoundUrl
};

const SOUND_VOLUMES: Partial<Record<SoundType, number>> = {
  'spin-start': 0.2,
  'spin-tick': 0.28,
  'win-common': 0.5,
  'win-uncommon': 0.52,
  'win-rare': 0.55,
  'win-epic': 0.58,
  'win-gold': 0.65,
  hover: 0.05
};

export const SoundProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [muted, setMuted] = useState(false);
  const audioRefs = useRef<Partial<Record<SoundType, HTMLAudioElement[]>>>({});
  const roundRobinIndexRef = useRef<Partial<Record<SoundType, number>>>({});
  const lastTickAtRef = useRef(0);
  const hasUserInteractedRef = useRef(false);

  const ensureSoundPool = useCallback((key: SoundType, preload: HTMLAudioElement['preload'] = 'metadata') => {
    if (typeof window === 'undefined' || audioRefs.current[key]) return;
    const url = SOUND_URLS[key];
    if (!url) return;

    try {
      const poolSize = key === 'spin-tick' ? 3 : 1;
      audioRefs.current[key] = Array.from({ length: poolSize }, () => {
        const audio = new Audio(url);
        audio.preload = preload;
        audio.volume = SOUND_VOLUMES[key] ?? 0.4;
        if (preload === 'auto') {
          audio.load();
        }
        return audio;
      });
      roundRobinIndexRef.current[key] = 0;
    } catch (error) {
      console.warn('Sound init failed', key, error);
    }
  }, []);

  const unlockAudio = useCallback(() => {
    if (hasUserInteractedRef.current) return;
    hasUserInteractedRef.current = true;
    ensureSoundPool('spin-tick', 'metadata');
  }, [ensureSoundPool]);

  const toggleMute = useCallback(() => setMuted((prev) => !prev), []);

  const playSound = useCallback((type: SoundType) => {
    if (muted || !hasUserInteractedRef.current) return;
    if (type === 'spin-tick') {
      const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
      if (now - lastTickAtRef.current < 42) return;
      lastTickAtRef.current = now;
    }

    if (!['spin-start', 'spin-tick', 'win-common', 'win-uncommon', 'win-rare', 'win-epic', 'win-gold'].includes(type)) return;

    ensureSoundPool(type, type === 'spin-tick' ? 'auto' : 'metadata');
    const audioPool = audioRefs.current[type];
    if (!audioPool || audioPool.length === 0) return;
    const cursor = roundRobinIndexRef.current[type] ?? 0;
    const audio = audioPool[cursor % audioPool.length];
    roundRobinIndexRef.current[type] = (cursor + 1) % audioPool.length;

    try {
      audio.currentTime = 0;
      const playPromise = audio.play();
      if (playPromise && typeof playPromise.then === 'function') {
        void playPromise.catch(() => {
          try {
            audio.load();
            audio.currentTime = 0;
            void audio.play().catch(() => undefined);
          } catch {
            // ignore playback recovery failures
          }
        });
      }
    } catch {
      // ignore playback errors
    }
  }, [ensureSoundPool, muted]);

  return <SoundContext.Provider value={{ muted, toggleMute, unlockAudio, playSound }}>{children}</SoundContext.Provider>;
};

export const useSound = () => {
  const context = useContext(SoundContext);
  if (!context) {
    throw new Error('useSound must be used within a SoundProvider');
  }
  return context;
};
