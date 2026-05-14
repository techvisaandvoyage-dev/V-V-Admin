import { useEffect, useMemo, useState } from 'react';

const loadedImageCache = new Set();

/**
 * Rewrite an Unsplash CDN url with size + WebP params. Other CDNs are returned untouched.
 * Unsplash supports w/h/q/fm/auto/fit query params — using them shrinks 1MB+ JPEG photos
 * to ~30–80 KB WebPs on the typical card.
 */
function optimizeImageUrl(url, { width, quality = 70 } = {}) {
  if (!url) return url;
  if (!url.includes('images.unsplash.com')) return url;
  try {
    const u = new URL(url);
    if (width) u.searchParams.set('w', String(width));
    u.searchParams.set('q', String(quality));
    u.searchParams.set('auto', 'format');
    u.searchParams.set('fit', 'crop');
    if (!u.searchParams.has('fm')) u.searchParams.set('fm', 'webp');
    return u.toString();
  } catch {
    return url;
  }
}

function buildSrcSet(url, width) {
  if (!url || !width) return undefined;
  if (!url.includes('images.unsplash.com')) return undefined;
  return [width, Math.round(width * 1.5), width * 2]
    .map((w) => `${optimizeImageUrl(url, { width: w })} ${w}w`)
    .join(', ');
}

/**
 * @param {object} props
 * @param {string} props.src
 * @param {string} [props.alt]
 * @param {string} [props.className]
 * @param {boolean} [props.priority] - true for above-the-fold images (hero / first row of cards).
 * @param {number} [props.width] - target rendered width in CSS pixels; used for Unsplash resize + srcSet.
 * @param {string} [props.sizes] - <img sizes> hint for responsive selection (defaults to width).
 * @param {boolean} [props.interactiveOverlay] - lets clickable children receive pointer events.
 */
const ImageWithShimmer = ({
  src,
  alt,
  className,
  children,
  interactiveOverlay = false,
  priority = false,
  width = 600,
  sizes,
}) => {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  const optimizedSrc = useMemo(() => optimizeImageUrl(src, { width }), [src, width]);
  const srcSet = useMemo(() => buildSrcSet(src, width), [src, width]);

  useEffect(() => {
    setLoaded(Boolean(optimizedSrc) && loadedImageCache.has(optimizedSrc));
    setError(false);
  }, [optimizedSrc]);

  return (
    <div className={`relative overflow-hidden bg-slate-200 ${className}`}>
      {(!loaded || !optimizedSrc || error) && (
        <div className="absolute inset-0 z-10 glass-shimmer" />
      )}

      {optimizedSrc && !error && (
        <img
          src={optimizedSrc}
          srcSet={srcSet}
          sizes={sizes || (width ? `${width}px` : undefined)}
          alt={alt || 'Image'}
          loading={priority ? 'eager' : 'lazy'}
          decoding="async"
          fetchpriority={priority ? 'high' : 'auto'}
          onLoad={(event) => {
            loadedImageCache.add(optimizedSrc);
            if (event.currentTarget.complete) {
              setLoaded(true);
            }
          }}
          onError={() => setError(true)}
          ref={(node) => {
            if (!node || !optimizedSrc) return;
            if (node.complete && node.naturalWidth > 0) {
              loadedImageCache.add(optimizedSrc);
              setLoaded(true);
            }
          }}
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ${loaded ? 'opacity-100' : 'opacity-0'}`}
        />
      )}

      <div className={`absolute inset-0 z-20 ${interactiveOverlay ? 'pointer-events-auto' : 'pointer-events-none'} flex flex-col transition-opacity duration-500 ${loaded ? 'opacity-100' : 'opacity-0'}`}>
        {children}
      </div>
    </div>
  );
};

export default ImageWithShimmer;
