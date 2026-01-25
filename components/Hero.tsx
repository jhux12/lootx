import React from 'react';
import heroImage from '../assets/hero.gif';

export const Hero: React.FC = () => {
  return (
    <div className="relative w-full bg-brand-dark overflow-hidden rounded-2xl mx-auto mt-6 h-[220px] sm:h-[260px] md:h-[320px] lg:h-[360px] xl:h-[400px] max-w-6xl">
      <img
        src={heroImage}
        className="absolute inset-0 h-full w-full rounded-xl object-cover object-center"
        alt="LootX hero animation"
      />
    </div>
  );
};
