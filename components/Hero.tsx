import React, { useMemo, useState } from 'react';
import { useGame } from '../context/GameContext';

export const Hero: React.FC = () => {
  const { boxes } = useGame();
  const [isAgeConfirmed, setIsAgeConfirmed] = useState(false);
  const [wantsEmailAlerts, setWantsEmailAlerts] = useState(false);

  const [topLeftImage, bottomRightImage] = useMemo(() => {
    const availableImages = boxes
      .map((box) => box.image)
      .filter(Boolean);

    const fallbackImages = [
      'https://firebasestorage.googleapis.com/v0/b/lootie-production.appspot.com/o/cases%2Fcyber-case-v2.png?alt=media',
      'https://firebasestorage.googleapis.com/v0/b/lootie-production.appspot.com/o/cases%2Fneon-dream-case.png?alt=media',
      'https://firebasestorage.googleapis.com/v0/b/lootie-production.appspot.com/o/cases%2Fstealth-storm-case.png?alt=media'
    ];

    const images = availableImages.length > 0 ? availableImages : fallbackImages;

    const first = images[Math.floor(Math.random() * images.length)];
    let second = images[Math.floor(Math.random() * images.length)];

    if (second === first && images.length > 1) {
      second = images.find((img) => img !== first) || second;
    }

    return [first, second];
  }, [boxes]);

  return (
    <div className="relative w-full h-[450px] bg-brand-dark overflow-hidden rounded-2xl mx-auto max-w-7xl mt-6 group">
      {/* Background Gradient & Effects */}
      <div className="absolute inset-0 bg-gradient-to-br from-brand-purple/20 via-brand-bg to-brand-green/10 z-0"></div>
      <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-5 z-0"></div>
      
      {/* Content */}
      <div className="relative z-10 h-full flex flex-col items-center justify-center text-center px-4">
        
        {/* Floating elements simulation */}
        <img 
          src={topLeftImage}
          className="absolute top-10 left-[10%] w-24 h-24 rounded-lg shadow-lg rotate-[-15deg] opacity-60 animate-pulse hidden md:block"
          alt="Mystery box spotlight"
        />
        <img 
          src={bottomRightImage}
          className="absolute bottom-10 right-[10%] w-32 h-32 rounded-lg shadow-lg rotate-[10deg] opacity-60 animate-bounce hidden md:block"
          alt="Mystery box highlight"
        />

        <h2 className="text-4xl md:text-6xl font-black text-white mb-4 tracking-tight drop-shadow-2xl">
          Create Mystery Boxes.
          <br />
          Battle Players.
          <br />
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
            Win Big.
          </span>
        </h2>
        
        <p className="text-gray-400 max-w-2xl mb-8 text-sm md:text-base font-medium">
          The platform where players design boxes, compete in real-time battles, and chase rare rewards.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 w-full items-center justify-center">
          <button
            className="px-8 py-3 bg-green-500 hover:bg-green-400 text-black font-extrabold rounded-lg shadow-[0_0_20px_rgba(34,197,94,0.4)] transition-all transform hover:-translate-y-1 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
            disabled={!isAgeConfirmed}
          >
            Sign up
          </button>
          <button className="px-8 py-3 bg-gray-800 hover:bg-gray-700 text-white font-bold rounded-lg border border-gray-700 transition-all">
            Sign in
          </button>
        </div>

        <div className="mt-4 w-full max-w-md text-left space-y-3 text-sm text-gray-300">
          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 rounded border-gray-600 bg-gray-900 text-green-500 focus:ring-green-400"
              checked={isAgeConfirmed}
              onChange={(event) => setIsAgeConfirmed(event.target.checked)}
            />
            <span>
              I am 18+ and have read the{' '}
              <a href="/terms-of-use" className="text-white underline hover:text-gray-200">
                Terms of Use
              </a>
              .
            </span>
          </label>
          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 rounded border-gray-600 bg-gray-900 text-green-500 focus:ring-green-400"
              checked={wantsEmailAlerts}
              onChange={(event) => setWantsEmailAlerts(event.target.checked)}
            />
            <span>Send me valuable email alerts about new drops and battles.</span>
          </label>
        </div>

        {/* 3D Box Illustration (CSS only) */}
        <div className="absolute bottom-[-40px] left-[15%] w-48 h-48 bg-gray-900 border-4 border-white rounded-xl transform rotate-[-5deg] z-[-1] opacity-50 blur-[2px]"></div>
      </div>
    </div>
  );
};
