import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react';
import spinSoundUrl from '../assets/spinsound.mp3';

type SoundType = 'click' | 'hover' | 'spin-start' | 'spin-tick' | 'win-common' | 'win-rare' | 'win-gold' | 'gold-mode' | 'coins';

interface SoundContextType {
  muted: boolean;
  toggleMute: () => void;
  playSound: (type: SoundType) => void;
}

const SoundContext = createContext<SoundContextType | undefined>(undefined);

const SOUND_URLS: Partial<Record<SoundType, string>> = {
  'spin-start': spinSoundUrl
};

const SOUND_VOLUMES: Partial<Record<SoundType, number>> = {
  'spin-start': 0.2,
  hover: 0.05
};

export const SoundProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [muted, setMuted] = useState(false);
  const audioRefs = useRef<Partial<Record<SoundType, HTMLAudioElement>>>({});
  const audioContextRef = useRef<AudioContext | null>(null);
  const lastTickAtRef = useRef(0);
  const didInitRef = useRef(false);

  const initializeAudio = useCallback(() => {
    if (didInitRef.current || typeof window === 'undefined') return;
    didInitRef.current = true;

    (Object.entries(SOUND_URLS) as [SoundType, string][]).forEach(([key, url]) => {
      if (!url) return;
      try {
        const audio = new Audio(url);
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

    if (type === 'spin-tick') {
      const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
      if (now - lastTickAtRef.current < 28) return;
      lastTickAtRef.current = now;

      try {
        const AudioContextCtor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!AudioContextCtor) return;

        if (!audioContextRef.current) {
          audioContextRef.current = new AudioContextCtor();
        }

        const audioContext = audioContextRef.current;
        if (audioContext.state === 'suspended') {
          void audioContext.resume().catch(() => undefined);
        }

        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        oscillator.type = 'square';
        oscillator.frequency.setValueAtTime(1320, audioContext.currentTime);
        gainNode.gain.setValueAtTime(0.0001, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.07, audioContext.currentTime + 0.004);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + 0.04);

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.045);
      } catch {
        // ignore playback errors
      }
      return;
    }

    if (type !== 'spin-start') return;


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
