import React from 'react';
import heroImage from '../assets/hero.gif';

export const Hero: React.FC = () => {
  return (
    <div className="relative w-full aspect-video bg-brand-dark overflow-hidden rounded-2xl mx-auto max-w-7xl mt-6">
      <img
        src={heroImage}
        className="absolute inset-0 h-full w-full rounded-xl object-cover"
        alt="LootX hero animation"
      />
    </div>
  );
};
