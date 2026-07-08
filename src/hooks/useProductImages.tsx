import { useState, useEffect } from 'react';
import { getProductImages } from '../utils/api';

export function useProductImages(productId: number | null) {
  const [images, setImages] = useState<Array<{ url: string; filepath: string; uploaded_at: string }>>([]);
  const [loading, setLoading] = useState(false);

  const fetchImages = async () => {
    if (!productId) {
      setImages([]);
      return;
    }

    setLoading(true);
    try {
      const fetchedImages = await getProductImages(productId);
      setImages(fetchedImages);
    } catch (error) {
      console.error('Error fetching images:', error);
      setImages([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchImages();
  }, [productId]);

  return { images, loading, refetch: fetchImages };
}
