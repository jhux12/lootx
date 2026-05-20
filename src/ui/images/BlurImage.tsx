import React, { useEffect, useRef, useState } from 'react';
import './blurImage.css';

type BlurImageProps = React.ImgHTMLAttributes<HTMLImageElement> & {
  placeholderSrc?: string;
  ratioClassName?: string;
  priority?: boolean;
  showPlaceholder?: boolean;
};

const BlurImageComponent: React.FC<BlurImageProps> = ({
  src,
  alt,
  className,
  placeholderSrc,
  ratioClassName,
  priority = false,
  showPlaceholder = true,
  loading,
  width,
  height,
  decoding,
  style,
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

  const intrinsicWidth = width ?? 320;
  const intrinsicHeight = height ?? intrinsicWidth;

  const handleLoad: React.ReactEventHandler<HTMLImageElement> = (event) => {
    setLoaded(true);
    rest.onLoad?.(event);
  };

  return (
    <div className={`pullz-blur-wrap ${ratioClassName ?? ''}`}>
      {showPlaceholder ? (
        placeholderSrc ? (
          <img src={placeholderSrc} alt="" aria-hidden="true" className={`pullz-blur-placeholder ${loaded ? 'is-hidden' : ''}`} width={intrinsicWidth} height={intrinsicHeight} decoding="async" />
        ) : (
          <div className={`pullz-blur-placeholder pullz-blur-fallback ${loaded ? 'is-hidden' : ''}`} aria-hidden="true" />
        )
      ) : null}
      <img
        ref={imageRef}
        src={src}
        alt={alt}
        className={`pullz-blur-full ${loaded ? 'is-loaded' : ''} ${className ?? ''}`}
        loading={priority ? 'eager' : (loading ?? 'lazy')}
        decoding={decoding ?? 'async'}
        width={intrinsicWidth}
        height={intrinsicHeight}
        style={style}
        {...rest}
        onLoad={handleLoad}
      />
    </div>
  );
};

export const BlurImage = React.memo(BlurImageComponent);
BlurImage.displayName = 'BlurImage';
