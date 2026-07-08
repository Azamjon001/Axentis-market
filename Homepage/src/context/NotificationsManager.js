import { useEffect, useRef } from 'react';
import { Platform, AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { useAuth } from './AuthContext';
import { getNotifications, savePushToken } from '../api';
import { navigationRef } from '../navigation';

// 📦 Открыть экран по data-payload push-уведомления. Для заказа «в пути»
// экран заказа сам показывает живую карту курьера.
function handleNotificationData(data) {
  if (!data || !navigationRef.isReady()) return;
  try {
    if (data.type === 'order' && data.orderId) {
      navigationRef.navigate('OrderDetail', { orderId: Number(data.orderId) });
    }
  } catch {
    // навигация могла быть не готова — не критично
  }
}

const LAST_SEEN_KEY = 'last_seen_notif_id';
const POLL_INTERVAL_MS = 25_000;

// Настраиваем Android-канал с максимальной важностью, чтобы уведомление
// приходило как «всплывашка» (heads-up) со звуком и вибрацией — как в обычном
// приложении.
async function ensureAndroidChannel() {
  if (Platform.OS !== 'android') return;
  try {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Уведомления',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      sound: 'default',
      lightColor: '#7B5CF0',
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    });
  } catch {
    // ignore
  }
}

// Получаем Expo push-токен и сохраняем на бэкенде, чтобы сервер мог слать
// настоящие push-уведомления (статус заказа и т.п.).
async function registerPushToken(phone) {
  if (!phone) return;
  try {
    const { status: existing } = await Notifications.getPermissionsAsync();
    let status = existing;
    if (existing !== 'granted') {
      const req = await Notifications.requestPermissionsAsync();
      status = req.status;
    }
    if (status !== 'granted') return;

    const projectId =
      Constants?.expoConfig?.extra?.eas?.projectId ||
      Constants?.easConfig?.projectId;
    const tokenResp = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );
    if (tokenResp?.data) {
      await savePushToken(phone, tokenResp.data);
    }
  } catch {
    // Push может быть недоступен (например, в Expo Go) — не критично.
  }
}

// Показываем локальное уведомление (heads-up + звук) для свежих событий, даже
// когда приложение открыто. Это и даёт «настоящее» ощущение уведомления.
async function fireLocalNotification(title, body) {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: title || 'Axentis Market',
        body: body || '',
        sound: 'default',
      },
      trigger: null,
    });
  } catch {
    // ignore
  }
}

export default function NotificationsManager() {
  const { user } = useAuth();
  const timerRef = useRef(null);
  const seenRef = useRef(null); // максимальный id уже показанного уведомления

  useEffect(() => {
    ensureAndroidChannel();
  }, []);

  // Нажатие на push → открываем связанный экран (в т.ч. если приложение
  // было закрыто и запустилось из уведомления).
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      handleNotificationData(response?.notification?.request?.content?.data);
    });
    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) {
        // Даём навигации смонтироваться после холодного старта
        setTimeout(() => handleNotificationData(response?.notification?.request?.content?.data), 800);
      }
    }).catch(() => {});
    return () => sub.remove();
  }, []);

  useEffect(() => {
    const phone = user?.phone;
    if (!phone) return undefined;

    let cancelled = false;
    registerPushToken(phone);

    const poll = async () => {
      if (cancelled || AppState.currentState !== 'active') return;
      try {
        const list = await getNotifications(phone);
        if (!Array.isArray(list) || list.length === 0) return;

        const ids = list
          .map((n) => Number(n.id))
          .filter((n) => !Number.isNaN(n));
        const maxId = Math.max(...ids);

        // Первый запуск — запоминаем текущий максимум и НЕ спамим старыми.
        if (seenRef.current === null) {
          const stored = await AsyncStorage.getItem(LAST_SEEN_KEY);
          seenRef.current = stored ? Number(stored) : maxId;
          if (!stored) {
            await AsyncStorage.setItem(LAST_SEEN_KEY, String(maxId));
            return;
          }
        }

        const fresh = list
          .filter((n) => Number(n.id) > seenRef.current)
          .sort((a, b) => Number(a.id) - Number(b.id));

        for (const n of fresh) {
          await fireLocalNotification(
            n.title ?? n.titleText,
            n.message ?? n.body ?? n.text,
          );
        }

        if (fresh.length > 0) {
          seenRef.current = maxId;
          await AsyncStorage.setItem(LAST_SEEN_KEY, String(maxId));
        }

        // Бейдж на иконке приложения = число непрочитанных уведомлений.
        try {
          const unread = list.filter((n) => !(n.isRead ?? n.is_read ?? false)).length;
          await Notifications.setBadgeCountAsync(unread);
        } catch {
          // ignore
        }
      } catch {
        // сеть могла отвалиться — попробуем в следующий тик
      }
    };

    poll();
    timerRef.current = setInterval(poll, POLL_INTERVAL_MS);

    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') poll();
    });

    return () => {
      cancelled = true;
      if (timerRef.current) clearInterval(timerRef.current);
      sub.remove();
    };
  }, [user?.phone]);

  return null;
}
