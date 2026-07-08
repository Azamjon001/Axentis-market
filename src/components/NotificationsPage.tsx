import { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Receipt, Bike, Tag, Info, Bell } from 'lucide-react';
import api from '../utils/api';

interface NotificationItem {
  id: number;
  type?: string;
  title: string;
  message?: string;
  isRead?: boolean;
  createdAt?: string;
}

interface NotificationsPageProps {
  userPhone?: string;
  onBack: () => void;
  isNight: boolean;
}

// Иконка + цвет по типу уведомления (как в приложении Homepage)
const NOTIF_ICONS: Record<string, { Icon: any; color: string }> = {
  order: { Icon: Receipt, color: '#7B5CF0' },
  delivery: { Icon: Bike, color: '#2196F3' },
  promotion: { Icon: Tag, color: '#FF9500' },
  system: { Icon: Info, color: '#4CAF50' },
  default: { Icon: Bell, color: '#6D5DFB' },
};

export default function NotificationsPage({ userPhone, onBack, isNight }: NotificationsPageProps) {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);

  const hp = {
    bg: isNight ? '#08090D' : '#FFFFFF',
    surface: isNight ? '#10131F' : '#F6F7F9',
    text: isNight ? '#FFFFFF' : '#0B0E16',
    textSec: isNight ? '#9CA3AF' : '#5B6472',
    textMuted: isNight ? '#6B7280' : '#9AA1AE',
    border: isNight ? 'rgba(255,255,255,0.06)' : 'rgba(11,14,22,0.08)',
    primary: '#6D5DFB',
  };

  const load = useCallback(async () => {
    if (!userPhone) { setNotifications([]); setLoading(false); return; }
    setLoading(true);
    try {
      const data = await api.notifications.list(userPhone);
      const list = Array.isArray(data) ? data : ((data as any)?.notifications || []);
      setNotifications(list);
    } catch {
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  }, [userPhone]);

  useEffect(() => { load(); }, [load]);

  const handleRead = async (n: NotificationItem) => {
    if (n.isRead) return;
    setNotifications(prev => prev.map(x => x.id === n.id ? { ...x, isRead: true } : x));
    try { await api.notifications.markRead(n.id); } catch { /* ignore */ }
  };

  const handleMarkAll = async () => {
    if (!userPhone) return;
    setNotifications(prev => prev.map(x => ({ ...x, isRead: true })));
    try { await api.notifications.markAllRead(userPhone); } catch { /* ignore */ }
  };

  const unreadCount = notifications.filter(n => !n.isRead).length;

  const formatDate = (d?: string) => {
    if (!d) return '';
    try {
      return new Date(d).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    } catch { return ''; }
  };

  return (
    <div className="fixed inset-0 z-[70] flex flex-col" style={{ background: hp.bg }}>
      {/* Header */}
      <header className="flex items-center justify-between px-4 pb-3" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 12px)' }}>
        <button onClick={onBack} className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: hp.surface, border: `1px solid ${hp.border}` }}>
          <ArrowLeft className="w-[22px] h-[22px]" style={{ color: hp.text }} />
        </button>
        <h1 className="text-xl font-extrabold tracking-tight" style={{ color: hp.text }}>Уведомления</h1>
        {unreadCount > 0 ? (
          <button onClick={handleMarkAll} className="text-sm font-semibold" style={{ color: hp.primary }}>
            Прочитать все
          </button>
        ) : (
          <div style={{ width: 40 }} />
        )}
      </header>

      <div className="flex-1 overflow-y-auto px-4 pb-8">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-9 h-9 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: hp.primary, borderTopColor: 'transparent' }} />
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-24 h-24 rounded-full flex items-center justify-center mb-5" style={{ background: hp.primary + '14' }}>
              <Bell className="w-12 h-12" style={{ color: hp.primary }} />
            </div>
            <h3 className="text-lg font-bold mb-1" style={{ color: hp.text }}>Уведомлений пока нет</h3>
            <p className="text-sm" style={{ color: hp.textSec }}>Здесь появятся новости о заказах и акциях</p>
          </div>
        ) : (
          <div className="space-y-2.5 pt-1">
            {notifications.map((n) => {
              const cfg = NOTIF_ICONS[n.type || 'default'] || NOTIF_ICONS.default;
              const Icon = cfg.Icon;
              return (
                <button
                  key={n.id}
                  onClick={() => handleRead(n)}
                  className="w-full flex items-start gap-3 p-3.5 rounded-2xl text-left transition-colors"
                  style={{
                    backgroundColor: n.isRead ? hp.surface : hp.primary + '0D',
                    border: `1px solid ${n.isRead ? hp.border : hp.primary + '30'}`,
                  }}
                >
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: cfg.color + '20' }}>
                    <Icon className="w-[22px] h-[22px]" style={{ color: cfg.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="flex-1 text-[15px] font-bold truncate" style={{ color: hp.text }}>{n.title}</span>
                      {!n.isRead && <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: hp.primary }} />}
                    </div>
                    {n.message && (
                      <p className="text-sm mt-0.5 line-clamp-2" style={{ color: hp.textSec }}>{n.message}</p>
                    )}
                    <p className="text-xs mt-1" style={{ color: hp.textMuted }}>{formatDate(n.createdAt)}</p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
