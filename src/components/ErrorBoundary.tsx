import React from 'react';

interface State {
  hasError: boolean;
}

/**
 * Глобальный предохранитель: любая необработанная ошибка рендера показывает
 * аккуратный экран «Что-то пошло не так» вместо белого экрана. Ошибка
 * логируется в консоль, пользователь может перезагрузить страницу одной кнопкой.
 */
export default class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('💥 Uncaught render error:', error, info.componentStack);
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 16,
        background: '#0F0F1E', color: '#fff', padding: 24, textAlign: 'center',
      }}>
        <div style={{ fontSize: 56 }}>😔</div>
        <div style={{ fontSize: 22, fontWeight: 700 }}>Что-то пошло не так</div>
        <div style={{ fontSize: 14, color: '#8B8BAA', maxWidth: 420, lineHeight: 1.5 }}>
          Произошла непредвиденная ошибка. Мы уже знаем о проблеме —
          попробуйте перезагрузить страницу.
        </div>
        <button
          onClick={() => window.location.reload()}
          style={{
            marginTop: 8, padding: '12px 32px', borderRadius: 14, border: 'none',
            background: '#7C5CF0', color: '#fff', fontSize: 15, fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Перезагрузить
        </button>
      </div>
    );
  }
}
