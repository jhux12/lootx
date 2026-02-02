import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import spinSoundUrl from '../assets/spinsound.mp3';

type SoundType = 'click' | 'hover' | 'spin-start' | 'spin-tick' | 'win-common' | 'win-rare' | 'win-gold' | 'gold-mode' | 'coins' | 'error' | 'success';

interface SoundContextType {
  muted: boolean;
  toggleMute: () => void;
  playSound: (type: SoundType) => void;
}

const SoundContext = createContext<SoundContextType | undefined>(undefined);

const SOUND_URLS: Record<SoundType, string> = {
  'click': 'https://cdn.pixabay.com/download/audio/2022/03/15/audio_2769490204.mp3?filename=ui-click-43196.mp3',
  'hover': 'https://cdn.pixabay.com/download/audio/2022/03/24/audio_3f7601614f.mp3?filename=interface-124464.mp3', 
  'spin-start': spinSoundUrl,
  'spin-tick': 'https://cdn.pixabay.com/download/audio/2022/03/15/audio_736a623910.mp3?filename=click-21156.mp3',
  'win-common': 'https://cdn.pixabay.com/download/audio/2021/08/04/audio_0625c153e1.mp3?filename=success-1-6297.mp3',
  'win-rare': 'https://cdn.pixabay.com/download/audio/2022/03/24/audio_804a54df5b.mp3?filename=bell-notification-9336.mp3', // CHANGED: Simple chime
  'win-gold': 'https://cdn.pixabay.com/download/audio/2022/10/16/audio_106275f85b.mp3?filename=win-sfx-38507.mp3',
  'gold-mode': 'https://cdn.pixabay.com/download/audio/2022/01/18/audio_8db1f115a5.mp3?filename=magic-spell-6005.mp3',
  'coins': 'https://cdn.pixabay.com/download/audio/2022/03/25/audio_27613c7a0d.mp3?filename=coins-21160.mp3',
  'error': 'https://cdn.pixabay.com/download/audio/2021/08/04/audio_c6ccf3232f.mp3?filename=error-2-36058.mp3',
  'success': 'https://firebasestorage.googleapis.com/v0/b/hyperdrop-6476c.firebasestorage.app/o/friend-request-14878.mp3?alt=media&token=41e00f87-b353-4b7f-abae-d5eef1d205e5',
};

export const SoundProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [muted, setMuted] = useState(false);
  const audioRefs = useRef<Record<string, HTMLAudioElement>>({});

  useEffect(() => {
    // Preload sounds
    Object.entries(SOUND_URLS).forEach(([key, url]) => {
      const audio = new Audio(url);
      audio.volume = 0.4; // Default volume
      audioRefs.current[key] = audio;
    });
  }, []);

  const toggleMute = () => setMuted(prev => !prev);

  const playSound = (type: SoundType) => {
    if (muted) return;
    
    const audio = audioRefs.current[type];
    if (audio) {
      // Clone node to allow overlapping sounds of same type
      const clone = audio.cloneNode() as HTMLAudioElement;
      clone.volume = audio.volume;
      
      // Adjust volumes for specific sounds
      if (type === 'spin-start') clone.volume = 0.2;
      if (type === 'hover') clone.volume = 0.05;
      if (type === 'error') clone.volume = 0.25;
      
      clone.play().catch(e => {
        // Ignored: Audio play failed (usually due to no user interaction yet)
      });
    }
  };

  return (
    <SoundContext.Provider value={{ muted, toggleMute, playSound }}>
      {children}
    </SoundContext.Provider>
  );
};

export const useSound = () => {
  const context = useContext(SoundContext);
  if (!context) {
    throw new Error('useSound must be used within a SoundProvider');
  }
  return context;
};
