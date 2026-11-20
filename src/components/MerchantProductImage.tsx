import { useState } from 'react';
import { Package } from 'lucide-react';
import { getCuratedProductImageSync } from '../utils/productImageFinder';

export function MerchantProductImage({ src, name }: { src?: string; name: string }) {
  const [failed, setFailed] = useState<string | null>(null);

  // If provided src failed or is empty, fall back to curated smart match for the product name
  const effectiveSrc = (src && failed !== src) ? src : getCuratedProductImageSync(name);

  return effectiveSrc ? (
    <img
      src={effectiveSrc}
      alt={name}
      loading="lazy"
      decoding="async"
      onError={() => {
        if (src) setFailed(src);
      }}
      className="merchant-product-image"
    />
  ) : (
    <span className="merchant-product-no-image">
      <Package size={28} aria-hidden="true" />
      <span>الصورة غير متاحة</span>
    </span>
  );
}
