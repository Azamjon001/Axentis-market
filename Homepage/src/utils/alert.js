// Кросс-платформенный Alert. В react-native-web Alert.alert НЕ реализован —
// вызов молча ничего не делает, из-за чего на сайте не работали выход из
// аккаунта, подтверждения и даже сообщения об ошибках. Здесь на вебе диалоги
// отображаются через window.alert/window.confirm, на iOS/Android — нативный
// Alert без изменений. Импортируйте Alert отсюда, а не из 'react-native'.
import { Platform, Alert as NativeAlert } from 'react-native';

const webAlert = (title, message, buttons) => {
  const text = [title, message].filter(Boolean).join('\n\n');

  // Без кнопок или с одной кнопкой — простое уведомление
  if (!buttons || buttons.length === 0) {
    window.alert(text);
    return;
  }
  if (buttons.length === 1) {
    window.alert(text);
    buttons[0].onPress?.();
    return;
  }

  // Две и более кнопок — confirm: «ОК» = основное действие (не-cancel),
  // «Отмена» = кнопка со style: 'cancel' (если есть)
  const confirmBtn = buttons.find((b) => b.style !== 'cancel') || buttons[buttons.length - 1];
  const cancelBtn = buttons.find((b) => b.style === 'cancel');
  if (window.confirm(text)) {
    confirmBtn.onPress?.();
  } else {
    cancelBtn?.onPress?.();
  }
};

export const Alert = Platform.OS === 'web' ? { alert: webAlert } : NativeAlert;
export default Alert;
