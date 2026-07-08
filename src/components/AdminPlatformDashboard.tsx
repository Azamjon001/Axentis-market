import { useState, useEffect } from 'react';
import {
  TrendingUp, ShoppingCart, Users, Building2, Package, Megaphone,
  Clock, RotateCcw, Flag, Tag, AlertTriangle, RefreshCw,
} from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import api from '../utils/api';

// 📊 Дашборд платформы: оборот, заказы, пользователи, топ-магазины, доход
// от рекламы + лента модерации (что ждёт решения) с переходами по разделам.
interface Props { onNavigate?: (tab: string) => void }

const fmt = (n: number) => (n || 0).toLocaleString('ru-RU');

export default function AdminPlatformDashboard({ onNavigate }: Props) {
  const [data, setData] = useState<any>(null);
  const [feed, setFeed] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    Promise.all([
      api.analytics.adminOverview().catch(() => null),
      api.moderation.feed().catch(() => null),
    ]).then(([o, f]) => { setData(o); setFeed(f); }).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const stat = (icon: any, label: string, value: string, color: string) => {
    const Icon = icon;
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-center gap-2 text-gray-500 text-sm mb-1"><Icon className="w-4 h-4" style={{ color }} />{label}</div>
        <div className="text-2xl font-bold text-gray-900 dark:text-white">{value}</div>
      </div>
    );
  };

  const feedItems = feed ? [
    { key: 'companies', label: 'Новые магазины', count: feed.pendingCompanies, icon: Building2, tab: 'companies', color: '#3B82F6' },
    { key: 'promos', label: 'Заявки на рекламу', count: feed.pendingPromotions, icon: Megaphone, tab: 'promotions', color: '#7C5CF0' },
    { key: 'discounts', label: 'Скидки на модерации', count: feed.pendingDiscounts, icon: Tag, tab: 'discounts', color: '#F59E0B' },
    { key: 'ads', label: 'Реклама (баннеры)', count: feed.pendingAds, icon: Megaphone, tab: 'ads', color: '#EC4899' },
    { key: 'returns', label: 'Открытые возвраты', count: feed.openReturns, icon: RotateCcw, tab: 'companies', color: '#EF4444' },
    { key: 'complaints', label: 'Жалобы', count: feed.openComplaints, icon: Flag, tab: 'complaints', color: '#DC2626' },
  ].filter(i => (i.count || 0) > 0) : [];

  if (loading) return <div className="flex items-center justify-center py-24 text-gray-400 gap-2"><RefreshCw className="w-5 h-5 animate-spin" />Загрузка...</div>;
  if (!data) return <div className="text-center py-16 text-red-500">Не удалось загрузить дашборд</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-900 dark:text-white">Обзор платформы</h2>
        <button onClick={load} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500"><RefreshCw className="w-4 h-4" /></button>
      </div>

      {/* Лента модерации */}
      {feedItems.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/40 rounded-xl p-4">
          <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 text-sm font-semibold mb-3">
            <AlertTriangle className="w-4 h-4" /> Требует внимания
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {feedItems.map((i) => {
              const Icon = i.icon;
              return (
                <button key={i.key} onClick={() => onNavigate?.(i.tab)}
                  className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-amber-300 transition-colors">
                  <span className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200"><Icon className="w-4 h-4" style={{ color: i.color }} />{i.label}</span>
                  <span className="text-lg font-bold" style={{ color: i.color }}>{i.count}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Ключевые метрики */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stat(TrendingUp, 'Оборот (GMV)', `${fmt(data.gmvTotal)} сум`, '#22C55E')}
        {stat(TrendingUp, 'Оборот сегодня', `${fmt(data.gmvToday)} сум`, '#10B981')}
        {stat(ShoppingCart, 'Заказов всего', fmt(data.ordersTotal), '#7C5CF0')}
        {stat(Clock, 'Заказов сегодня', fmt(data.ordersToday), '#F59E0B')}
        {stat(Users, 'Пользователи', fmt(data.users), '#3B82F6')}
        {stat(Building2, 'Магазины', fmt(data.companies), '#0EA5E9')}
        {stat(Package, 'Товары', fmt(data.products), '#8B5CF6')}
        {stat(Megaphone, 'Доход с рекламы', `${fmt(data.adRevenue)} сум`, '#EC4899')}
      </div>

      {/* График выручки */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
        <div className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3">Выручка за 14 дней</div>
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={data.revenueChart || []} margin={{ top: 6, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="adminRev" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#7C5CF0" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#7C5CF0" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(120,120,140,0.15)" />
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94A3B8' }} tickFormatter={(d) => String(d).slice(5)} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: '#94A3B8' }} tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v} axisLine={false} tickLine={false} />
            <Tooltip formatter={(v: number) => [`${fmt(v)} сум`, 'Выручка']} />
            <Area type="monotone" dataKey="revenue" stroke="#7C5CF0" strokeWidth={2} fill="url(#adminRev)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Топ-магазины */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 text-sm font-semibold text-gray-700 dark:text-gray-200">
          Топ магазинов (30 дней)
        </div>
        {(data.topShops || []).length === 0 ? (
          <div className="p-6 text-center text-gray-400 text-sm">Нет данных</div>
        ) : (
          (data.topShops || []).map((s: any, i: number) => (
            <div key={s.id} className="flex items-center justify-between px-4 py-2.5 border-b border-gray-50 dark:border-gray-700/50 last:border-0">
              <div className="flex items-center gap-3">
                <span className="w-6 h-6 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-500 text-xs font-bold flex items-center justify-center">{i + 1}</span>
                <span className="text-sm text-gray-800 dark:text-gray-100">{s.name}</span>
              </div>
              <div className="text-right">
                <div className="text-sm font-bold text-gray-900 dark:text-white">{fmt(s.revenue)} сум</div>
                <div className="text-xs text-gray-400">{s.orders} заказов</div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
