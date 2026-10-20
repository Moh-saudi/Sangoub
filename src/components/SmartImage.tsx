import React, { useState } from 'react';
import { ProductSvg } from './ProductSvg.tsx';

// Reliable curated fallback photography for each food & supermarket category
const CATEGORY_REAL_FALLBACKS: Record<string, string> = {
  foul: 'https://images.unsplash.com/photo-1541544741938-0af808871cc0?auto=format&fit=crop&w=600&q=80',
  falafel: 'https://images.unsplash.com/photo-1593001874117-c99c800e3eb7?auto=format&fit=crop&w=600&q=80',
  water: 'https://images.unsplash.com/photo-1548839140-29a749e1bc4e?auto=format&fit=crop&w=600&q=80',
  chips: 'https://images.unsplash.com/photo-1566478989037-eec170784d0b?auto=format&fit=crop&w=600&q=80',
  coffee: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=600&q=80',
  croissant: 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?auto=format&fit=crop&w=600&q=80',
  juice: 'https://images.unsplash.com/photo-1613478223719-2ab802602423?auto=format&fit=crop&w=600&q=80',
  hawawshi: 'https://images.unsplash.com/photo-1529006557810-274b9b2fc783?auto=format&fit=crop&w=600&q=80',
  cheddar: 'https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&w=600&q=80',
  tea: 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?auto=format&fit=crop&w=600&q=80',
};

interface SmartImageProps {
  src?: string;
  alt: string;
  fallbackType?: string;
  className?: string;
  aspectRatio?: string;
}

export const SmartImage: React.FC<SmartImageProps> = ({
  src,
  alt,
  fallbackType = 'foul',
  className = 'w-full h-full object-cover',
  aspectRatio = 'aspect-[4/3]',
}) => {
  const [currentSrc, setCurrentSrc] = useState<string>(
    src || CATEGORY_REAL_FALLBACKS[fallbackType] || ''
  );
  const [hasTriedFallback, setHasTriedFallback] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [useSvg, setUseSvg] = useState(false);

  const handleError = () => {
    if (!hasTriedFallback && CATEGORY_REAL_FALLBACKS[fallbackType]) {
      setHasTriedFallback(true);
      setCurrentSrc(CATEGORY_REAL_FALLBACKS[fallbackType]);
    } else {
      setUseSvg(true);
    }
  };

  return (
    <div className={`relative overflow-hidden bg-slate-100 ${aspectRatio}`}>
      {/* Loading Shimmer Skeleton */}
      {!isLoaded && !useSvg && (
        <div className="absolute inset-0 bg-gradient-to-r from-slate-200 via-slate-100 to-slate-200 animate-pulse" />
      )}

      {/* Real Image */}
      {!useSvg && currentSrc ? (
        <img
          src={currentSrc}
          alt={alt}
          referrerPolicy="no-referrer"
          loading="lazy"
          onLoad={() => setIsLoaded(true)}
          onError={handleError}
          className={`${className} transition-transform duration-500 hover:scale-105 ${
            isLoaded ? 'opacity-100' : 'opacity-0'
          }`}
        />
      ) : (
        /* Final styled SVG illustration fallback if network is completely offline */
        <div className="w-full h-full">
          <ProductSvg type={fallbackType} className="w-full h-full object-cover" />
        </div>
      )}
    </div>
  );
};
