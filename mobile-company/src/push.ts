import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { companies } from './api';

// ============================================================================
// 🔔 Push-уведомления продавца: регистрация Expo Push Token на бэкенде.
//
// Бэкенд шлёт два типа уведомлений:
//   • «Новый заказ» — мгновенно при оформлении заказа покупателем;
//   • «Утренняя сводка» — 08:00 по Ташкенту (вчерашние продажи + остатки).
//
// В Expo Go (Android, SDK 53+) удалённые push не работают — только в
// dev/production сборках; поэтому все ошибки здесь глотаются молча.
// ============================================================================

// Показ уведомлений, когда приложение открыто (foreground)
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export async function registerCompanyPush(
  companyId: number,
  prefs?: { newOrders?: boolean; dailySummary?: boolean }
): Promise<'ok' | 'denied' | 'unavailable'> {
  try {
    if (!Device.isDevice) return 'unavailable';

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Axentis Business',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#7C5CF0',
      });
    }

    const { status: existing } = await Notifications.getPermissionsAsync();
    let status = existing;
    if (existing !== 'granted') {
      const req = await Notifications.requestPermissionsAsync();
      status = req.status;
    }
    if (status !== 'granted') return 'denied';

    const projectId =
      (Constants.expoConfig as any)?.extra?.eas?.projectId ??
      (Constants as any).easConfig?.projectId;
    const tokenResponse = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined
    );
    const token = tokenResponse.data;
    if (!token) return 'unavailable';

    await companies.savePushToken(companyId, token, prefs);
    return 'ok';
  } catch (e) {
    console.log('Push registration skipped:', e);
    return 'unavailable';
  }
}

/** Отвязать устройство от push (при выходе из аккаунта). */
export async function unregisterCompanyPush(companyId: number) {
  try {
    await companies.savePushToken(companyId, '');
  } catch {
    /* не критично */
  }
}
