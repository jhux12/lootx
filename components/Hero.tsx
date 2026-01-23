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
      <div className="relative z-10 h-full" />
    </div>
  );
};
