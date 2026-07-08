// 🗺️ Сопоставление геолокации покупателя с регионом (областью) Узбекистана.
//
// Канонические названия ДОЛЖНЫ совпадать с теми, что компании выбирают в SMM-панели
// (src/utils/uzbekistanRegions.ts -> поле name), потому что бэкенд фильтрует товары
// по точному совпадению строки региона. Поэтому здесь используются те же русские
// названия областей.

// Список областей + ключевые слова (lat/uz/ru) для распознавания результата
// обратного геокодирования (expo-location reverseGeocodeAsync).
const REGIONS = [
  { name: 'Андижанская область',        keys: ['andijan', 'andijon', 'андижан', 'asaka', 'асака', 'shahrixon', 'shahrikhan', 'qorgontepa', "qo'rg'ontepa", 'kurgontepa', 'kurgantepa', 'кургантепа', 'qorasuv', 'korasuv', 'karasu', 'карасу'] },
  { name: 'Бухарская область',          keys: ['bukhara', 'buxoro', 'бухар'] },
  { name: 'Джизакская область',         keys: ['jizzakh', 'jizzax', 'jizzakh region', 'джизак'] },
  { name: 'Кашкадарьинская область',    keys: ['kashkadarya', 'qashqadaryo', 'qarshi', 'karshi', 'кашкадар', 'карши'] },
  { name: 'Навоийская область',         keys: ['navoiy', 'navoi', 'навои'] },
  { name: 'Наманганская область',       keys: ['namangan', 'наманган'] },
  { name: 'Самаркандская область',      keys: ['samarkand', 'samarqand', 'самарканд'] },
  { name: 'Сурхандарьинская область',   keys: ['surkhandarya', 'surxondaryo', 'termez', 'termiz', 'сурхандар', 'термез'] },
  { name: 'Сырдарьинская область',      keys: ['syrdarya', 'sirdaryo', 'gulistan', 'guliston', 'сырдар', 'гулистан'] },
  { name: 'Ферганская область',         keys: ['fergana', "farg'ona", 'fargona', 'ферган'] },
  { name: 'Хорезмская область',         keys: ['khorezm', 'xorazm', 'urgench', 'urganch', 'хорезм', 'ургенч'] },
  { name: 'Республика Каракалпакстан',  keys: ['karakalpak', "qoraqalpog", 'nukus', 'каракалпак', 'нукус'] },
];

// Превращаем результат геокодирования в одну строку для поиска ключевых слов.
function buildHaystack(place) {
  if (!place) return '';
  const parts = [place.region, place.subregion, place.city, place.district, place.name]
    .filter(Boolean)
    .join(' ');
  return parts.toLowerCase();
}

// Возвращает каноническое название региона по результату геокодирования, либо null.
export function resolveRegion(place) {
  const hay = buildHaystack(place);
  if (!hay) return null;

  const isTashkent = hay.includes('tashkent') || hay.includes('toshkent') || hay.includes('ташкент');
  // Город Ташкент vs Ташкентская область решаем по наличию слова "регион/область/viloyat".
  if (isTashkent) {
    const isRegion = hay.includes('region') || hay.includes('viloyat') || hay.includes('област');
    return isRegion ? 'Ташкентская область' : 'город Ташкент';
  }

  for (const r of REGIONS) {
    if (r.keys.some((k) => hay.includes(k))) {
      return r.name;
    }
  }
  return null;
}

export const ALL_REGION_NAMES = ['город Ташкент', 'Ташкентская область', ...REGIONS.map((r) => r.name)];
