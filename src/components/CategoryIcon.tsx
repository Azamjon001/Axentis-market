import {
  Smartphone, Laptop, Shirt, Footprints, Gamepad2, Headphones, BookOpen,
  Home, Car, UtensilsCrossed, Sparkles, Watch, Gift, Wrench, Pill, Tv,
  Baby, Dumbbell, ShoppingBag, Sofa, Bike, Camera, Package,
  type LucideIcon,
} from 'lucide-react';
import { getImageUrl } from '../utils/api';

// ============================================================================
// Профессиональные ВЕКТОРНЫЕ иконки категорий (вместо детских эмодзи).
// В поле `icon` категории может храниться:
//   • путь к загруженной картинке  → "/uploads/categories/...png"
//   • ключ векторной иконки         → "smartphone", "laptop", ...
//   • (legacy) эмодзи               → отрисуем профессиональный fallback
// ============================================================================

export const CATEGORY_ICON_OPTIONS: { key: string; Icon: LucideIcon; label: string }[] = [
  { key: 'package', Icon: Package, label: 'Общее' },
  { key: 'smartphone', Icon: Smartphone, label: 'Телефоны' },
  { key: 'laptop', Icon: Laptop, label: 'Ноутбуки' },
  { key: 'tv', Icon: Tv, label: 'Техника' },
  { key: 'shirt', Icon: Shirt, label: 'Одежда' },
  { key: 'footprints', Icon: Footprints, label: 'Обувь' },
  { key: 'gamepad', Icon: Gamepad2, label: 'Игры' },
  { key: 'headphones', Icon: Headphones, label: 'Аудио' },
  { key: 'book', Icon: BookOpen, label: 'Книги' },
  { key: 'home', Icon: Home, label: 'Для дома' },
  { key: 'sofa', Icon: Sofa, label: 'Мебель' },
  { key: 'car', Icon: Car, label: 'Авто' },
  { key: 'bike', Icon: Bike, label: 'Спорт' },
  { key: 'dumbbell', Icon: Dumbbell, label: 'Фитнес' },
  { key: 'food', Icon: UtensilsCrossed, label: 'Продукты' },
  { key: 'beauty', Icon: Sparkles, label: 'Красота' },
  { key: 'watch', Icon: Watch, label: 'Часы' },
  { key: 'gift', Icon: Gift, label: 'Подарки' },
  { key: 'tools', Icon: Wrench, label: 'Инструменты' },
  { key: 'pharmacy', Icon: Pill, label: 'Аптека' },
  { key: 'baby', Icon: Baby, label: 'Детям' },
  { key: 'camera', Icon: Camera, label: 'Фото' },
  { key: 'bag', Icon: ShoppingBag, label: 'Аксессуары' },
];

const ICON_MAP: Record<string, LucideIcon> = Object.fromEntries(
  CATEGORY_ICON_OPTIONS.map((o) => [o.key, o.Icon]),
);

export const isImageIcon = (icon?: string) =>
  !!icon && (icon.startsWith('/') || icon.startsWith('http'));

export const DEFAULT_CATEGORY_ICON = 'package';

interface Props {
  icon?: string;
  className?: string; // размеры: например "w-6 h-6"
}

// Единый рендер иконки категории — только картинка или векторная иконка, без эмодзи.
export default function CategoryIcon({ icon, className = 'w-6 h-6' }: Props) {
  if (isImageIcon(icon)) {
    return <img src={getImageUrl(icon as string) || ''} alt="" className={`object-contain ${className}`} />;
  }
  const Icon = (icon && ICON_MAP[icon]) || Package;
  return <Icon className={className} />;
}

// Подбор ключа иконки по НАЗВАНИЮ категории (ru/uz/en) — как resolveCategoryIonicon
// в приложении Homepage. Используется там, где есть только имя категории.
const NAME_HINTS: [RegExp, string][] = [
  [/телефон|phone|смартфон|smartfon/i, 'smartphone'],
  [/ноут|компьютер|laptop|computer/i, 'laptop'],
  [/телевизор|\btv\b|техник/i, 'tv'],
  [/электрон|electronic|гаджет|gadget/i, 'smartphone'],
  [/одежд|kiyim|clothes|cloth/i, 'shirt'],
  [/обув|shoe|footwear|poyabzal/i, 'footprints'],
  [/игр|game|toy|игрушк|oyin/i, 'gamepad'],
  [/аудио|наушник|headphone|audio|quloqchin/i, 'headphones'],
  [/книг|book|kitob/i, 'book'],
  [/мебел|sofa|furniture|mebel/i, 'sofa'],
  [/дом|home|uy|для дома/i, 'home'],
  [/авто|car|mashina|транспорт/i, 'car'],
  [/велосипед|bike|велик/i, 'bike'],
  [/спорт|sport|фитнес|fitness/i, 'dumbbell'],
  [/прод|food|еда|ovqat|grocery|пит/i, 'food'],
  [/красот|beauty|косметик|go.zallik|parfum/i, 'beauty'],
  [/час|watch|soat/i, 'watch'],
  [/подар|gift|sovga/i, 'gift'],
  [/инструмент|tool|asbob|ремонт/i, 'tools'],
  [/аптек|pharm|медик|dori|здоров/i, 'pharmacy'],
  [/дет|baby|bola|kids|child|для детей/i, 'baby'],
  [/фото|camera|kamera/i, 'camera'],
  [/аксессуар|accessor|сумк|bag|ryukzak/i, 'bag'],
];

export function categoryIconKeyByName(name?: string): string {
  if (!name) return DEFAULT_CATEGORY_ICON;
  for (const [re, key] of NAME_HINTS) {
    if (re.test(name)) return key;
  }
  return DEFAULT_CATEGORY_ICON;
}

// Иконка категории по её названию (когда нет объекта с полем icon).
export function CategoryNameIcon({ name, className = 'w-[18px] h-[18px]' }: { name?: string; className?: string }) {
  return <CategoryIcon icon={categoryIconKeyByName(name)} className={className} />;
}
