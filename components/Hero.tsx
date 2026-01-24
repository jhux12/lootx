import React from 'react';
import heroImage from '../assets/hero.gif';

export const Hero: React.FC = () => {
  return (
    <div className="relative w-full aspect-video lg:aspect-[20/9] bg-brand-dark overflow-hidden rounded-2xl mx-auto max-w-7xl lg:max-w-6xl xl:max-w-5xl 2xl:max-w-4xl mt-6">
      <img
        src={heroImage}
        className="absolute inset-0 h-full w-full rounded-xl object-cover"
        alt="LootX hero animation"
      />
    </div>
  );
};
