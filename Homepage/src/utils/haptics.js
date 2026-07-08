import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

// 📳 Тактильная отдача (вибро-отклик). На вебе Haptics недоступен — тихо
// пропускаем. Любые ошибки глотаем, чтобы отклик никогда не ломал действие.
const safe = (fn) => {
  if (Platform.OS === 'web') return;
  try { fn(); } catch { /* ignore */ }
};

// Лёгкий тап — обычные кнопки, выбор варианта, переключатели.
export const tapLight = () =>
  safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));

// Средний — заметное действие (в корзину, лайк).
export const tapMedium = () =>
  safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium));

// Успех — заказ оформлен, товар добавлен.
export const notifySuccess = () =>
  safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));

// Ошибка — не удалось, нет в наличии.
export const notifyError = () =>
  safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error));
