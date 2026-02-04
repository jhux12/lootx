import React from 'react';
import banner1 from '../assets/banner.png';
import banner2 from '../assets/banner2.png';
const HOME_BANNERS = [
  {
    src: banner1,
    alt: 'Promo banner',
    href: '/boxes'
  },
  {
    src: banner2,
    alt: 'Limited drop banner'
  }
];

export const HomeBanners: React.FC = () => {
  if (HOME_BANNERS.length === 0) {
    return null;
  }

  const gridClassName =
    HOME_BANNERS.length === 1 ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2';

  return (
    <section>
      <div className={`grid gap-4 ${gridClassName}`}>
        {HOME_BANNERS.map((banner) => {
          const isExternal = banner.href?.startsWith('http');
          const content = (
            <div className="group relative overflow-hidden rounded-2xl border border-white/10 bg-[#0c111b]">
              <img
                src={banner.src}
                alt={banner.alt}
                className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.01]"
                loading="lazy"
              />
              <div className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-white/10" />
            </div>
          );

          if (banner.href) {
            return (
              <a
                key={banner.src}
                href={banner.href}
                className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/60 rounded-2xl"
                target={isExternal ? '_blank' : undefined}
                rel={isExternal ? 'noreferrer' : undefined}
              >
                {content}
              </a>
            );
          }

          return (
            <div key={banner.src}>
              {content}
            </div>
          );
        })}
      </div>
    </section>
  );
};
