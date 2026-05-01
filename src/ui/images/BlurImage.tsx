import React, { useEffect, useRef, useState } from 'react';
import './blurImage.css';

type BlurImageProps = React.ImgHTMLAttributes<HTMLImageElement> & {
  placeholderSrc?: string;
  ratioClassName?: string;
  priority?: boolean;
};

export const BlurImage: React.FC<BlurImageProps> = ({
  src,
  alt,
  className,
  placeholderSrc,
  ratioClassName,
  priority = false,
  loading,
  ...rest
}) => {
  const [loaded, setLoaded] = useState(false);
  const imageRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    setLoaded(false);
  }, [src]);

  useEffect(() => {
    const imageElement = imageRef.current;
    if (!imageElement || !src) return;
    if (imageElement.complete && imageElement.naturalWidth > 0) {
      setLoaded(true);
    }
  }, [src]);

  const handleLoad: React.ReactEventHandler<HTMLImageElement> = (event) => {
    setLoaded(true);
    rest.onLoad?.(event);
  };

  return (
    <div className={`pullz-blur-wrap ${ratioClassName ?? ''}`}>
      {placeholderSrc ? (
        <img src={placeholderSrc} alt="" aria-hidden="true" className={`pullz-blur-placeholder ${loaded ? 'is-hidden' : ''}`} />
      ) : (
        <div className={`pullz-blur-placeholder pullz-blur-fallback ${loaded ? 'is-hidden' : ''}`} aria-hidden="true" />
      )}
      <img
        ref={imageRef}
        src={src}
        alt={alt}
        className={`pullz-blur-full ${loaded ? 'is-loaded' : ''} ${className ?? ''}`}
        loading={priority ? 'eager' : (loading ?? 'lazy')}
        decoding="async"
        {...rest}
        onLoad={handleLoad}
      />
    </div>
  );
};
