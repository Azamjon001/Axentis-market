import React from 'react';

interface State {
  hasError: boolean;
  message: string;
  stack: string;
}

/**
 * Глобальный предохранитель: любая необработанная ошибка рендера показывает
 * аккуратный экран «Что-то пошло не так» вместо белого экрана.
 *
 * Показываем и саму ошибку (мелким шрифтом) — иначе причину невозможно
 * диагностировать по скриншоту пользователя. Вторая кнопка сбрасывает
 * локальные данные (сессию/кэш): чаще всего краш при загрузке вызван
 * устаревшей сессией в localStorage после обновления панели.
 */
export default class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { hasError: false, message: '', stack: '' };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      message: String(error?.message || error),
      stack: String(error?.stack || '').split('\n').slice(0, 6).join('\n'),
    };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('💥 Uncaught render error:', error, info.componentStack);
  }

  private resetAndReload = () => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch { /* ignore */ }
    window.location.reload();
  };

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
          Произошла непредвиденная ошибка. Попробуйте перезагрузить страницу.
          Если ошибка повторяется — нажмите «Сбросить данные и войти заново».
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center', marginTop: 8 }}>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '12px 28px', borderRadius: 14, border: 'none',
              background: '#7C5CF0', color: '#fff', fontSize: 15, fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Перезагрузить
          </button>
          <button
            onClick={this.resetAndReload}
            style={{
              padding: '12px 28px', borderRadius: 14,
              border: '1px solid rgba(248,113,113,0.5)', background: 'transparent',
              color: '#F87171', fontSize: 15, fontWeight: 600, cursor: 'pointer',
            }}
          >
            Сбросить данные и войти заново
          </button>
        </div>
        {this.state.message && (
          <div style={{
            marginTop: 14, maxWidth: 560, width: '100%', textAlign: 'left',
            background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 12, padding: '10px 14px', fontSize: 11.5, lineHeight: 1.5,
            fontFamily: 'ui-monospace, monospace', color: '#B8B8D0',
            whiteSpace: 'pre-wrap', wordBreak: 'break-word', overflowX: 'auto',
          }}>
            {this.state.message}
            {this.state.stack ? '\n' + this.state.stack : ''}
          </div>
        )}
      </div>
    );
  }
}
