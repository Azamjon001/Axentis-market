import { useState } from 'react';
import { X, Image as ImageIcon, Loader } from 'lucide-react';
import api, { getImageUrl } from '../utils/api';

interface ImageUploaderProps {
  productId: number;
  images: string[]; // Массив путей к файлам из бэкенда
  onImagesChange: () => void;
}

// 🎯 НАСТРОЙКА СЖАТИЯ: Измените это значение для другого целевого размера
// Примеры: 1.0 (1 МБ), 1.5 (1.5 МБ), 2.0 (2 МБ), 3.0 (3 МБ)
const TARGET_SIZE_MB = 1.5;

// 🔧 Функция сжатия изображения до целевого размера
const compressImage = async (file: File, maxSizeMB: number = TARGET_SIZE_MB): Promise<File> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        
        // Уменьшаем размер изображения, если оно слишком большое
        const maxDimension = 2048;
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = (height / width) * maxDimension;
            width = maxDimension;
          } else {
            width = (width / height) * maxDimension;
            height = maxDimension;
          }
        }
        
        canvas.width = width;
        canvas.height = height;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Failed to get canvas context'));
          return;
        }
        
        ctx.drawImage(img, 0, 0, width, height);
        
        // Пробуем разные уровни качества для достижения целевого размера
        let quality = 0.9;
        const tryCompress = () => {
          canvas.toBlob(
            (blob) => {
              if (!blob) {
                reject(new Error('Failed to compress image'));
                return;
              }
              
              const compressedSizeMB = blob.size / 1024 / 1024;
              
              // Если размер подходит или качество уже минимальное
              if (compressedSizeMB <= maxSizeMB || quality <= 0.5) {
                const compressedFile = new File([blob], file.name, {
                  type: 'image/jpeg',
                  lastModified: Date.now()
                });
                console.log(`✅ Изображение сжато: ${(file.size / 1024 / 1024).toFixed(2)}MB → ${compressedSizeMB.toFixed(2)}MB`);
                resolve(compressedFile);
              } else {
                // Уменьшаем качество и пробуем снова
                quality -= 0.1;
                tryCompress();
              }
            },
            'image/jpeg',
            quality
          );
        };
        
        tryCompress();
      };
      img.onerror = () => reject(new Error('Failed to load image'));
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
  });
};

export default function ImageUploader({ productId, images, onImagesChange }: ImageUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    // Проверяем сколько файлов можно добавить
    const availableSlots = 6 - images.length;
    if (availableSlots === 0) {
      setError('Можно загрузить до 6 фотографий на товар');
      return;
    }

    // Берем только доступное количество файлов
    const filesToUpload = Array.from(files).slice(0, availableSlots);
    
    // Validate all files
    for (const file of filesToUpload) {
      if (!['image/jpeg', 'image/jpg', 'image/png', 'image/webp'].includes(file.type)) {
        setError(`Файл "${file.name}" неподдерживаемый формат. Только JPEG, PNG и WebP`);
        return;
      }
    }

    setError(null);
    setUploading(true);

    try {
      // ⚠️ ВАЖНО: Загружаем файлы ПОСЛЕДОВАТЕЛЬНО для надежности
      for (let i = 0; i < filesToUpload.length; i++) {
        const file = filesToUpload[i];
        const originalSizeMB = file.size / 1024 / 1024;
        
        // Показываем прогресс
        setError(`Обработка ${i + 1} из ${filesToUpload.length}... (${originalSizeMB.toFixed(1)}MB)`);
        
        // 🔧 Сжимаем изображение, если оно больше целевого размера
        let fileToUpload = file;
        if (originalSizeMB > TARGET_SIZE_MB) {
          setError(`Сжатие ${i + 1} из ${filesToUpload.length}... (${originalSizeMB.toFixed(1)}MB → ${TARGET_SIZE_MB}MB)`);
          try {
            fileToUpload = await compressImage(file, TARGET_SIZE_MB);
          } catch (compressError) {
            console.error('Ошибка сжатия:', compressError);
            setError(`Не удалось сжать "${file.name}". Попробуйте другое изображение.`);
            continue;
          }
        }
        
        setError(`Загрузка ${i + 1} из ${filesToUpload.length}...`);
        
        // Create FileList-like object for single file
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(fileToUpload);
        await api.products.uploadImages(productId.toString(), dataTransfer.files);
      }
      
      onImagesChange(); // Refresh images
      
      // Clear input
      e.target.value = '';
      
      // Показываем успешное сообщение
      setError(`✅ Успешно загружено ${filesToUpload.length} фото`);
      setTimeout(() => setError(null), 3000);
    } catch (err) {
      console.error('Error uploading images:', err);
      setError('Ошибка загрузки. Попробуйте снова');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (index: number) => {
    if (!confirm('Удалить это изображение?')) return;

    try {
      const imageToDelete = images[index]; // Это строка-путь к файлу
      await api.products.deleteImage(productId.toString(), imageToDelete);
      onImagesChange(); // Refresh images
    } catch (err) {
      console.error('Error deleting image:', err);
      setError('Ошибка удаления');
    }
  };

  return (
    <div className="space-y-3">
      {/* Images Grid */}
      {images.length > 0 && (
        <div className="grid grid-cols-3 gap-2 mb-3">
          {images.map((imagePath, index) => (
            <div key={index} className="relative group">
              <img
                src={getImageUrl(imagePath) || ''}
                alt={`Product ${index + 1}`}
                className="w-full h-24 object-cover rounded-lg border-2 border-gray-200"
                onError={(e) => {
                  console.error(`Ошибка загрузки изображения: ${imagePath}`);
                  const target = e.target as HTMLImageElement;
                  target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="100"%3E%3Crect fill="%23ddd" width="100" height="100"/%3E%3Ctext fill="%23999" x="50%25" y="50%25" text-anchor="middle" dy=".3em"%3ENo Image%3C/text%3E%3C/svg%3E';
                  // Fallback для битых ссылок
                  e.currentTarget.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0iI2Y3ZjdmNyIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LXNpemU9IjE0IiBmaWxsPSIjOTk5IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSI+Tm8gaW1hZ2U8L3RleHQ+PC9zdmc+';
                }}
              />
              <button
                onClick={() => handleDelete(index)}
                className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                title="Удалить"
              >
                <X className="w-4 h-4" />
              </button>
              <div className="absolute bottom-1 left-1 bg-black bg-opacity-60 text-white text-xs px-2 py-0.5 rounded">
                {index + 1}/6
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Upload Button */}
      {images.length < 6 && (() => {
        const availableSlots = 6 - images.length;
        return (
        <div>
          <label
            className={`flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
              uploading || images.length >= 6
                ? 'border-gray-300 bg-gray-50 cursor-not-allowed opacity-60'
                : 'border-purple-300 hover:border-purple-500 hover:bg-purple-50'
            }`}
          >
            <input
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/webp"
              onChange={handleFileSelect}
              disabled={uploading || images.length >= 6}
              className="hidden"
              multiple
            />
            {uploading ? (
              <>
                <Loader className="w-5 h-5 animate-spin text-purple-600" />
                <span className="text-sm text-gray-600">Загрузка...</span>
              </>
            ) : images.length >= 6 ? (
              <>
                <ImageIcon className="w-5 h-5 text-gray-400" />
                <span className="text-sm text-gray-500">
                  Максимум фото ({images.length}/6)
                </span>
              </>
            ) : (
              <>
                <ImageIcon className="w-5 h-5 text-purple-600" />
                <span className="text-sm text-purple-600">
                  Добавить фото ({images.length}/6)
                </span>
              </>
            )}
          </label>

          {/* Info */}
          <p className="text-xs text-gray-500 mt-1 text-center">
            JPEG, PNG, WebP • Макс 5MB • Можно выбрать до {availableSlots} фото
          </p>
        </div>
        );
      })()}

      {/* Error Message */}
      {error && (
        <div className={`${
          error.startsWith('✅') 
            ? 'bg-green-50 border-green-200 text-green-700' 
            : 'bg-red-50 border-red-200 text-red-700'
        } border px-3 py-2 rounded-lg text-sm`}>
          {error}
        </div>
      )}
    </div>
  );
}