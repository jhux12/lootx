import React from 'react';
import heroImage from '../assets/hero.gif';

export const Hero: React.FC = () => {
  return (
    <div className="relative w-full aspect-video bg-brand-dark overflow-hidden rounded-2xl mx-auto max-w-7xl mt-6 group">
      {/* Background Gradient & Effects */}
      <img
        src={heroImage}
        className="absolute inset-0 h-full w-full rounded-xl object-cover z-0"
        alt="LootX hero animation"
      />
      <div className="absolute inset-0 bg-gradient-to-br from-brand-purple/40 via-brand-bg/70 to-brand-green/20 z-0"></div>
      <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10 z-0"></div>
      
      {/* Content */}
      <div className="relative z-10 h-full flex flex-col items-center justify-center text-center px-4">
        
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

        <div className="flex gap-4">
          <button className="px-8 py-3 bg-green-500 hover:bg-green-400 text-black font-extrabold rounded-lg shadow-[0_0_20px_rgba(34,197,94,0.4)] transition-all transform hover:-translate-y-1">
            Sign up
          </button>
          <button className="px-8 py-3 bg-gray-800 hover:bg-gray-700 text-white font-bold rounded-lg border border-gray-700 transition-all">
            Sign in
          </button>
        </div>

        {/* 3D Box Illustration (CSS only) */}
        <div className="absolute bottom-[-40px] left-[15%] w-48 h-48 bg-gray-900 border-4 border-white rounded-xl transform rotate-[-5deg] z-[-1] opacity-50 blur-[2px]"></div>
      </div>
    </div>
  );
};
