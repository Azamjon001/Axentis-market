import React, { useState } from 'react';
// import { supabase } from '../utils/supabase/client'; // ОТКЛЮЧЕНО: Supabase больше не используется

/**
 * 🔧 ПРЯМОЕ ОБНОВЛЕНИЕ ЦЕН - КОМПОНЕНТ ОТКЛЮЧЕН
 * 
 * Этот компонент обновлял цены через Supabase, но теперь мы используем PostgreSQL REST API.
 * Компонент оставлен для истории, но не работает.
 */
export function DirectPriceUpdate({ companyId }: { companyId: string }) {
  const [log, setLog] = useState<string[]>([]);
  const [updating, setUpdating] = useState(false);

  const addLog = (message: string) => {
    setLog(prev => [...prev, `${new Date().toLocaleTimeString()} - ${message}`]);
    console.log(message);
  };

  const updateAllPrices = async () => {
    setLog([]);
    setUpdating(true);
    addLog('⚠️ КОМПОНЕНТ ОТКЛЮЧЕН - Supabase больше не используется');
    addLog('Используйте обновление через панель управления товарами');
    setUpdating(false);
    return;
    // Код ниже отключен - Supabase больше не используется
    /*
    try {
      // Весь старый код с Supabase закомментирован
    } catch (error) {
      console.error('Component disabled');
    } finally {
      setUpdating(false);
    }
    */
  };

  return null;
}