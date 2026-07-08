import { useState, useEffect } from 'react';
import {
  Truck, Plus, Trash2, Wifi, WifiOff, MapPin, Package,
  User, Phone, CreditCard, RefreshCw, X, Eye, EyeOff,
} from 'lucide-react';
import { couriers } from '../utils/api';

interface Courier {
  id: number;
  name: string;
  surname: string;
  phone: string;
  passport_id: string;
  company_id: number | null;
  company_name: string;
  is_online: boolean;
  last_lat: number;
  last_lng: number;
  location_updated_at: string | null;
  current_order_id: number | null;
  created_at: string;
}

interface CouriersManagementPanelProps {
  companyId?: number | null; // null/undefined = admin mode (sees all couriers)
}

export default function CouriersManagementPanel({ companyId }: CouriersManagementPanelProps) {
  const [list, setList] = useState<Courier[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [form, setForm] = useState({
    name: '', surname: '', phone: '', password: '', passport_id: '',
  });
  const [formError, setFormError] = useState('');

  const isAdmin = !companyId;

  const load = async () => {
    setLoading(true);
    try {
      const data = await couriers.list(companyId ?? undefined);
      setList(Array.isArray(data) ? data : []);
    } catch {
      setList([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [companyId]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (!form.name.trim() || !form.surname.trim() || !form.phone.trim() || !form.password.trim()) {
      setFormError('Заполните обязательные поля (имя, фамилия, телефон, пароль)');
      return;
    }
    if (form.password.length < 4) {
      setFormError('Пароль должен быть не менее 4 символов');
      return;
    }
    setSaving(true);
    try {
      await couriers.create({
        company_id: companyId ?? null,
        name: form.name.trim(),
        surname: form.surname.trim(),
        phone: form.phone.trim(),
        password: form.password,
        passport_id: form.passport_id.trim(),
      });
      setForm({ name: '', surname: '', phone: '', password: '', passport_id: '' });
      setShowForm(false);
      await load();
    } catch (err: any) {
      setFormError(err?.response?.data?.error || err?.message || 'Ошибка создания курьера');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Удалить курьера?')) return;
    setDeleteId(id);
    try {
      await couriers.delete(id);
      await load();
    } catch {
      alert('Ошибка удаления');
    } finally {
      setDeleteId(null);
    }
  };

  const formatTime = (iso: string | null) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('ru-RU', {
      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
    });
  };

  const onlineCount = list.filter((c) => c.is_online).length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            <Truck className="w-5 h-5 text-orange-500" />
            Курьеры
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Всего: {list.length} · Онлайн: {onlineCount}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} className="p-2 rounded-xl hover:bg-gray-100 text-gray-500">
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 bg-orange-500 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-orange-600 transition-colors"
          >
            {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            {showForm ? 'Отмена' : 'Добавить'}
          </button>
        </div>
      </div>

      {/* Create form */}
      {showForm && (
        <form onSubmit={handleCreate} className="bg-white rounded-2xl p-5 border border-orange-100 shadow-sm space-y-4">
          <h3 className="font-semibold text-gray-800">Новый курьер</h3>
          {formError && (
            <div className="bg-red-50 text-red-700 rounded-xl px-4 py-2.5 text-sm border border-red-200">
              {formError}
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Имя *</label>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Алишер"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Фамилия *</label>
              <input
                value={form.surname}
                onChange={(e) => setForm({ ...form, surname: e.target.value })}
                placeholder="Каримов"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Телефон * (логин)</label>
            <input
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="+998901234567"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Пароль *</label>
            <div className="relative">
              <input
                type={showPw ? 'text' : 'password'}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="Минимум 4 символа"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm pr-10 focus:outline-none focus:ring-2 focus:ring-orange-300"
              />
              <button
                type="button"
                onClick={() => setShowPw(!showPw)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
              >
                {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Серия паспорта (необязательно)</label>
            <input
              value={form.passport_id}
              onChange={(e) => setForm({ ...form, passport_id: e.target.value })}
              placeholder="AA1234567"
              maxLength={9}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
            />
          </div>
          <button
            type="submit"
            disabled={saving}
            className="w-full bg-orange-500 text-white py-3 rounded-xl font-semibold text-sm hover:bg-orange-600 transition-colors disabled:opacity-50"
          >
            {saving ? 'Создание...' : 'Создать курьера'}
          </button>
        </form>
      )}

      {/* Courier list */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <RefreshCw className="w-6 h-6 text-gray-300 animate-spin" />
        </div>
      ) : list.length === 0 ? (
        <div className="bg-white rounded-2xl p-8 text-center border border-gray-100">
          <Truck className="w-10 h-10 text-gray-200 mx-auto mb-3" />
          <div className="text-gray-500 font-medium">Нет курьеров</div>
          <div className="text-gray-400 text-sm mt-1">Добавьте первого курьера</div>
        </div>
      ) : (
        <div className="space-y-3">
          {list.map((courier) => (
            <div
              key={courier.id}
              className={`bg-white rounded-2xl p-4 border shadow-sm transition-all ${
                courier.is_online ? 'border-green-200' : 'border-gray-100'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  {/* Avatar */}
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                    courier.is_online ? 'bg-green-100' : 'bg-gray-100'
                  }`}>
                    <User className={`w-5 h-5 ${courier.is_online ? 'text-green-600' : 'text-gray-400'}`} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-gray-800 text-sm">
                        {courier.name} {courier.surname}
                      </span>
                      <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
                        courier.is_online
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-500'
                      }`}>
                        {courier.is_online
                          ? <><Wifi className="w-3 h-3" />Онлайн</>
                          : <><WifiOff className="w-3 h-3" />Офлайн</>
                        }
                      </span>
                    </div>

                    <div className="flex items-center gap-1 mt-1">
                      <Phone className="w-3 h-3 text-gray-400" />
                      <span className="text-xs text-gray-500">{courier.phone}</span>
                    </div>

                    {courier.passport_id && (
                      <div className="flex items-center gap-1 mt-0.5">
                        <CreditCard className="w-3 h-3 text-gray-400" />
                        <span className="text-xs text-gray-400">{courier.passport_id}</span>
                      </div>
                    )}

                    {/* Company (admin view) */}
                    {isAdmin && (
                      <div className="flex items-center gap-1 mt-0.5">
                        <Truck className="w-3 h-3 text-gray-400" />
                        <span className="text-xs text-gray-400">
                          {courier.company_name || 'Администрация (все заказы)'}
                        </span>
                      </div>
                    )}

                    {/* Current order */}
                    {courier.current_order_id && (
                      <div className="flex items-center gap-1 mt-1">
                        <Package className="w-3 h-3 text-orange-400" />
                        <span className="text-xs text-orange-600 font-medium">
                          Заказ #{courier.current_order_id}
                        </span>
                      </div>
                    )}

                    {/* Location */}
                    {courier.is_online && courier.last_lat !== 0 && (
                      <div className="flex items-center gap-1 mt-1">
                        <MapPin className="w-3 h-3 text-blue-400" />
                        <span className="text-xs text-blue-500">
                          {courier.last_lat.toFixed(4)}, {courier.last_lng.toFixed(4)}
                          <span className="text-gray-400 ml-1">· {formatTime(courier.location_updated_at)}</span>
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => handleDelete(courier.id)}
                  disabled={deleteId === courier.id}
                  className="p-2 rounded-xl hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors flex-shrink-0"
                >
                  {deleteId === courier.id
                    ? <RefreshCw className="w-4 h-4 animate-spin" />
                    : <Trash2 className="w-4 h-4" />
                  }
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
