import React, { createContext, useContext, useState, useRef, useCallback } from 'react';
import spinSoundUrl from '../assets/spinsound.mp3';
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
  'spin-start': spinSoundUrl,
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
  const audioContextRef = useRef<AudioContext | null>(null);
  const lastTickAtRef = useRef(0);
  const didInitRef = useRef(false);
  const didWarmupRef = useRef(false);
  const hasUserInteractedRef = useRef(false);

  const ensureAudioContextReady = useCallback(() => {
    if (typeof window === 'undefined') return null;
    const AudioContextCtor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextCtor) return null;

    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContextCtor();
    }

    const audioContext = audioContextRef.current;
    if (audioContext.state === 'suspended') {
      void audioContext.resume().catch(() => undefined);
    }

    if (!didWarmupRef.current) {
      didWarmupRef.current = true;
      try {
        // Prime audio graph on the first allowed gesture so mobile playback starts reliably.
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        gainNode.gain.setValueAtTime(0.00001, audioContext.currentTime);
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.01);
      } catch {
        // ignore warm-up failures
      }
    }

    return audioContext;
  }, []);

  const initializeAudio = useCallback(() => {
    if (didInitRef.current || typeof window === 'undefined') return;
    didInitRef.current = true;
    ensureAudioContextReady();

    (Object.entries(SOUND_URLS) as [SoundType, string][]).forEach(([key, url]) => {
      if (!url) return;
      try {
        const poolSize = key === 'spin-tick' ? 5 : 2;
        const audioPool = Array.from({ length: poolSize }, () => {
          const audio = new Audio(url);
          audio.preload = 'auto';
          audio.volume = SOUND_VOLUMES[key] ?? 0.4;
          return audio;
        });
        audioRefs.current[key] = audioPool;
        roundRobinIndexRef.current[key] = 0;
      } catch (error) {
        console.warn('Sound init failed', key, error);
      }
    });
  }, [ensureAudioContextReady]);

  const unlockAudio = useCallback(() => {
    if (hasUserInteractedRef.current) return;
    hasUserInteractedRef.current = true;
    initializeAudio();
    ensureAudioContextReady();
  }, [ensureAudioContextReady, initializeAudio]);

  const toggleMute = useCallback(() => setMuted((prev) => !prev), []);

  const playSound = useCallback((type: SoundType) => {
    if (muted || !hasUserInteractedRef.current) return;
    ensureAudioContextReady();

    if (type === 'spin-tick') {
      const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
      if (now - lastTickAtRef.current < 42) return;
      lastTickAtRef.current = now;
    }

    if (!['spin-start', 'spin-tick', 'win-common', 'win-uncommon', 'win-rare', 'win-epic', 'win-gold'].includes(type)) return;

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
  }, [ensureAudioContextReady, initializeAudio, muted]);

  return <SoundContext.Provider value={{ muted, toggleMute, unlockAudio, playSound }}>{children}</SoundContext.Provider>;
};

export const useSound = () => {
  const context = useContext(SoundContext);
  if (!context) {
    throw new Error('useSound must be used within a SoundProvider');
  }
  return context;
};
