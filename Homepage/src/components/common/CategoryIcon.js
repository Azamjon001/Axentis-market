import React, { useState } from 'react';
import { Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getImageUrl } from '../../utils/imageUrl';

// ============================================================================
// Иконка категории. Источником может быть:
//   • загруженная картинка (PNG/SVG)  → "/uploads/categories/...png" или http
//   • ключ векторной иконки            → "smartphone", "laptop", ...
//   • имя категории (legacy)           → подбираем иконку по названию
// Никаких "четырёх квадратиков" (grid) — всегда осмысленная иконка/картинка.
// ============================================================================

// Ключи из админ-панели (CategoryIcon.tsx) → имена Ionicons.
const KEY_TO_IONICON = {
  package: 'cube-outline',
  smartphone: 'phone-portrait-outline',
  laptop: 'laptop-outline',
  tv: 'tv-outline',
  shirt: 'shirt-outline',
  footprints: 'footsteps-outline',
  gamepad: 'game-controller-outline',
  headphones: 'headset-outline',
  book: 'book-outline',
  home: 'home-outline',
  sofa: 'bed-outline',
  car: 'car-outline',
  bike: 'bicycle-outline',
  dumbbell: 'barbell-outline',
  food: 'fast-food-outline',
  beauty: 'sparkles-outline',
  watch: 'watch-outline',
  gift: 'gift-outline',
  tools: 'construct-outline',
  pharmacy: 'medkit-outline',
  baby: 'happy-outline',
  camera: 'camera-outline',
  bag: 'bag-handle-outline',
};

// Подбор иконки по названию категории (русский / узбекский / английский).
const NAME_HINTS = [
  [/электрон|electronic|техник|гаджет|gadget/i, 'phone-portrait-outline'],
  [/телефон|phone|смартфон/i, 'phone-portrait-outline'],
  [/ноут|компьютер|laptop|computer/i, 'laptop-outline'],
  [/телевизор|\btv\b/i, 'tv-outline'],
  [/одежд|kiyim|clothes|cloth/i, 'shirt-outline'],
  [/обув|shoe|footwear/i, 'footsteps-outline'],
  [/игр|game|toy|игрушк/i, 'game-controller-outline'],
  [/аудио|наушник|headphone|audio/i, 'headset-outline'],
  [/книг|book|kitob/i, 'book-outline'],
  [/дом|home|uy/i, 'home-outline'],
  [/мебел|sofa|furniture/i, 'bed-outline'],
  [/авто|car|mashina/i, 'car-outline'],
  [/спорт|sport|фитнес|fitness/i, 'barbell-outline'],
  [/прод|food|еда|ovqat|grocery/i, 'fast-food-outline'],
  [/красот|beauty|косметик|gozallik/i, 'sparkles-outline'],
  [/час|watch|soat/i, 'watch-outline'],
  [/подар|gift|sovga/i, 'gift-outline'],
  [/инструмент|tool|asbob/i, 'construct-outline'],
  [/аптек|pharm|медик|dori/i, 'medkit-outline'],
  [/дет|baby|bola|kids|child/i, 'happy-outline'],
  [/фото|camera|kamera/i, 'camera-outline'],
  [/аксессуар|accessor|сумк|bag/i, 'bag-handle-outline'],
];

const isImage = (v) => typeof v === 'string' && (v.startsWith('/') || v.startsWith('http'));

export function resolveCategoryIonicon(category) {
  const icon = category?.icon;
  if (icon && !isImage(icon) && KEY_TO_IONICON[icon]) return KEY_TO_IONICON[icon];
  const name = category?.name || '';
  for (const [re, ion] of NAME_HINTS) {
    if (re.test(name)) return ion;
  }
  return 'pricetag-outline'; // осмысленный fallback вместо grid
}

export default function CategoryIcon({ category, size = 24, color = '#000', style }) {
  const [imgError, setImgError] = useState(false);
  const icon = category?.icon;

  if (isImage(icon) && !imgError) {
    return (
      <Image
        source={{ uri: getImageUrl(icon) || '' }}
        style={[{ width: size, height: size, resizeMode: 'contain' }, style]}
        onError={() => setImgError(true)}
      />
    );
  }

  return <Ionicons name={resolveCategoryIonicon(category)} size={size} color={color} style={style} />;
}
