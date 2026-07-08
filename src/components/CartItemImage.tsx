import { useState, useEffect } from 'react';
import { getImageUrl } from '../utils/api';

// Product images can be plain URL strings OR objects like { url }. Normalize both.
function resolveImg(im: any): string | null {
  if (!im) return null;
  if (typeof im === 'string') return getImageUrl(im);
  if (typeof im === 'object' && im.url) return getImageUrl(im.url);
  return null;
}

interface CartItemImageProps {
  images?: any[];
  name?: string;
}

/**
 * Thumbnail for a cart line. Shows the product photo and, when there are
 * several, auto-rotates through them every 3 seconds, looping back to the
 * first. Fixes the previous bug where object-shaped images rendered blank.
 */
export default function CartItemImage({ images, name }: CartItemImageProps) {
  const urls = (images || []).map(resolveImg).filter(Boolean) as string[];
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (urls.length <= 1) return;
    const timer = setInterval(() => setIdx((i) => (i + 1) % urls.length), 3000);
    return () => clearInterval(timer);
  }, [urls.length]);

  if (urls.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center text-gray-400 text-[10px]">
        Нет фото
      </div>
    );
  }

  return (
    <img
      src={urls[idx % urls.length]}
      alt={name || ''}
      className="w-full h-full object-cover transition-opacity duration-500"
    />
  );
}
