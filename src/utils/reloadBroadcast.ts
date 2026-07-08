/**
 * 🔄 Broadcast Channel API для автоматической перезагрузки всех вкладок
 * Используется для синхронизации состояния между устройствами
 */

type ReloadCallback = () => void;

const CHANNEL_NAME = 'app-reload-channel';
let broadcastChannel: BroadcastChannel | null = null;
const callbacks: Set<ReloadCallback> = new Set();

/**
 * Инициализация канала (автоматически вызывается при первой подписке)
 */
function initChannel() {
  if (broadcastChannel) return;
  
  try {
    broadcastChannel = new BroadcastChannel(CHANNEL_NAME);
    
    broadcastChannel.onmessage = (event) => {
      if (event.data?.type === 'RELOAD_ALL_DEVICES') {
        console.log('🔔 [BroadcastChannel] Получен сигнал перезагрузки');
        callbacks.forEach(callback => callback());
      }
    };
    
    console.log('✅ [BroadcastChannel] Канал инициализирован');
  } catch (error) {
    console.error('❌ [BroadcastChannel] Ошибка инициализации:', error);
  }
}

/**
 * Подписка на события перезагрузки
 * @param callback Функция, которая будет вызвана при получении сигнала
 * @returns Функция отписки
 */
export function subscribeToReload(callback: ReloadCallback): () => void {
  if (!broadcastChannel) {
    initChannel();
  }
  
  callbacks.add(callback);
  console.log(`📡 [BroadcastChannel] Подписка добавлена (всего: ${callbacks.size})`);
  
  // Возвращаем функцию отписки
  return () => {
    callbacks.delete(callback);
    console.log(`📡 [BroadcastChannel] Подписка удалена (осталось: ${callbacks.size})`);
  };
}

/**
 * Отправка сигнала перезагрузки всем устройствам
 */
export function broadcastReload() {
  if (!broadcastChannel) {
    initChannel();
  }
  
  try {
    broadcastChannel?.postMessage({ type: 'RELOAD_ALL_DEVICES' });
    console.log('📢 [BroadcastChannel] Сигнал перезагрузки отправлен');
  } catch (error) {
    console.error('❌ [BroadcastChannel] Ошибка отправки сигнала:', error);
  }
}

/**
 * Закрытие канала (вызывается при размонтировании приложения)
 */
export function closeChannel() {
  if (broadcastChannel) {
    broadcastChannel.close();
    broadcastChannel = null;
    callbacks.clear();
    console.log('🔌 [BroadcastChannel] Канал закрыт');
  }
}
