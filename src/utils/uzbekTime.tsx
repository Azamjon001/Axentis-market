/**
 * 🇺🇿 Утилиты для работы с узбекским временем
 * Часовой пояс: Asia/Tashkent (UTC+5)
 * Город: Андижан, Узбекистан
 */

const UZBEKISTAN_TIMEZONE = 'Asia/Tashkent';

/**
 * Получить текущую дату и время в Узбекистане в формате ISO
 * Сохраняет в UTC, при отображении конвертируется в GMT+5
 */
export function getUzbekistanISOString(): string {
  // Просто возвращаем текущее UTC время
  // При отображении оно будет конвертировано в Asia/Tashkent
  return new Date().toISOString();
}

/**
 * Получить объект Date для текущего времени в Узбекистане
 */
export function getUzbekistanDate(): Date {
  return new Date();
}

/**
 * Конвертировать строку даты в узбекское время
 */
export function toUzbekistanDate(dateString: string | null | undefined): Date | null {
  if (!dateString) {
    return null;
  }
  
  try {
    // Создаем дату из строки
    const date = new Date(dateString);
    
    // Проверяем валидность даты
    if (isNaN(date.getTime())) {
      console.warn('🕒 [toUzbekistanDate] Invalid date string:', dateString);
      return null;
    }
    
    // Возвращаем дату как есть, потому что она уже содержит правильное время
    // (сервер сохраняет в узбекском времени)
    return date;
  } catch (error) {
    console.error('🕒 [toUzbekistanDate] Error converting date:', error);
    return null;
  }
}

/**
 * Форматировать дату в узбекском формате (ДД.ММ.ГГГГ)
 */
export function formatUzbekistanDate(date: Date | string | null | undefined): string {
  if (!date) {
    return '—';
  }
  
  try {
    // Создаем объект Date из строки если нужно
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    
    if (!dateObj || isNaN(dateObj.getTime())) {
      console.warn('🕒 [formatUzbekistanDate] Invalid date:', date);
      return '—';
    }
    
    // Форматируем дату с учетом узбекской временной зоны (GMT+5)
    const formatter = new Intl.DateTimeFormat('ru-RU', {
      timeZone: UZBEKISTAN_TIMEZONE,
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
    
    return formatter.format(dateObj);
  } catch (error) {
    console.error('🕒 [formatUzbekistanDate] Error formatting date:', error);
    return '—';
  }
}

/**
 * Форматировать время в узбекском формате (ЧЧ:ММ:СС)
 */
export function formatUzbekistanTime(date: Date | string | null | undefined): string {
  if (!date) {
    return '—';
  }
  
  try {
    // Создаем объект Date из строки если нужно
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    
    if (!dateObj || isNaN(dateObj.getTime())) {
      console.warn('🕒 [formatUzbekistanTime] Invalid date:', date);
      return '—';
    }
    
    // Форматируем время с учетом узбекской временной зоны (GMT+5)
    const formatter = new Intl.DateTimeFormat('ru-RU', {
      timeZone: UZBEKISTAN_TIMEZONE,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit', // 🎯 Добавляем секунды!
      hour12: false
    });
    
    return formatter.format(dateObj);
  } catch (error) {
    console.error('🕒 [formatUzbekistanTime] Error formatting time:', error);
    return '—';
  }
}

/**
 * Форматировать дату и время в узбекском формате
 */
export function formatUzbekistanDateTime(date: Date | string | null | undefined): {
  date: string;
  time: string;
} {
  if (!date) {
    return {
      date: '—',
      time: '—'
    };
  }
  
  try {
    const formattedDate = formatUzbekistanDate(date);
    const formattedTime = formatUzbekistanTime(date);
    return {
      date: formattedDate,
      time: formattedTime
    };
  } catch (error) {
    console.error('🕒 [formatUzbekistanDateTime] Error formatting date time:', error);
    return {
      date: '—',
      time: '—'
    };
  }
}

/**
 * Форматировать полную дату и время в одну строку (для отображения)
 */
export function formatUzbekistanFullDateTime(date: Date | string | null | undefined): string {
  if (!date) return '—';
  
  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    
    if (!dateObj || isNaN(dateObj.getTime())) {
      console.warn('🕒 [formatUzbekistanFullDateTime] Invalid date:', date);
      return '—';
    }
    
    const result = dateObj.toLocaleString('ru-RU', {
      timeZone: UZBEKISTAN_TIMEZONE,
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
    
    return result;
  } catch (error) {
    console.error('🕒 [formatUzbekistanFullDateTime] Error formatting full date time:', error);
    return '—';
  }
}

/**
 * Получить начало сегодняшнего дня в Узбекистане (00:00:00)
 */
export function getUzbekistanToday(): Date {
  const now = new Date();
  
  // Получаем строку даты в узбекском часовом поясе
  const uzbekDateString = now.toLocaleString('en-US', {
    timeZone: UZBEKISTAN_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  
  // Парсим дату и устанавливаем время на 00:00:00
  const [month, day, year] = uzbekDateString.split('/');
  const todayStart = new Date(Date.UTC(
    parseInt(year),
    parseInt(month) - 1,
    parseInt(day),
    -5, // Узбекистан UTC+5, поэтому -5 часов от UTC для 00:00 Ташкента
    0,
    0,
    0
  ));
  
  return todayStart;
}

/**
 * Получить начало дня N дней назад в Узбекистане
 */
export function getUzbekistanDayStart(daysAgo: number): Date {
  const today = getUzbekistanToday();
  const targetDate = new Date(today);
  targetDate.setDate(today.getDate() - daysAgo);
  return targetDate;
}

/**
 * Проверить, является ли дата сегодняшним днем в Узбекистане
 */
export function isToday(date: Date | string | null | undefined): boolean {
  if (!date) return false;
  
  try {
    const checkDate = typeof date === 'string' ? toUzbekistanDate(date) : date;
    
    if (!checkDate || isNaN(checkDate.getTime())) {
      return false;
    }
    
    const today = getUzbekistanDate();
    
    return checkDate.toDateString() === today.toDateString();
  } catch (error) {
    console.error('Error checking isToday:', error);
    return false;
  }
}