import { useState, useEffect, useCallback } from 'react';
import { ShieldCheck, Save, RefreshCw, Users, Building2, CheckCircle2 } from 'lucide-react';
import api from '../utils/api';

type Audience = 'customer' | 'company';

interface PolicyData {
  contentRu: string;
  contentUz: string;
  version: number;
  updatedAt?: string;
}

/**
 * 📜 Редактор политики конфиденциальности.
 * Два документа: для покупателей и для компаний. Ставки и условия со временем
 * меняются — админ правит тексты здесь, версия растёт автоматически, и все
 * последующие принятия фиксируются уже с новой версией.
 */
export default function AdminPoliciesPanel() {
  const [audience, setAudience] = useState<Audience>('customer');
  const [policies, setPolicies] = useState<Record<Audience, PolicyData | null>>({ customer: null, company: null });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [lang, setLang] = useState<'ru' | 'uz'>('ru');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [cust, comp] = await Promise.all([
        api.policies.get('customer'),
        api.policies.get('company'),
      ]);
      setPolicies({
        customer: { contentRu: cust.contentRu || '', contentUz: cust.contentUz || '', version: cust.version || 1, updatedAt: cust.updatedAt },
        company: { contentRu: comp.contentRu || '', contentUz: comp.contentUz || '', version: comp.version || 1, updatedAt: comp.updatedAt },
      });
    } catch (e) {
      console.error('Load policies failed:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const current = policies[audience];

  const setContent = (value: string) => {
    setPolicies(prev => {
      const p = prev[audience];
      if (!p) return prev;
      return {
        ...prev,
        [audience]: lang === 'ru' ? { ...p, contentRu: value } : { ...p, contentUz: value },
      };
    });
  };

  const save = async () => {
    if (!current || !current.contentRu.trim()) {
      alert('Текст на русском обязателен');
      return;
    }
    setSaving(true);
    try {
      const res = await api.policies.update(audience, {
        contentRu: current.contentRu,
        contentUz: current.contentUz,
      });
      setPolicies(prev => ({
        ...prev,
        [audience]: prev[audience] ? { ...prev[audience]!, version: res.version } : prev[audience],
      }));
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 2500);
    } catch (e) {
      console.error('Save policy failed:', e);
      alert('Не удалось сохранить политику');
    } finally {
      setSaving(false);
    }
  };

  const audienceTabs: Array<{ key: Audience; label: string; icon: typeof Users }> = [
    { key: 'customer', label: 'Для покупателей', icon: Users },
    { key: 'company', label: 'Для компаний', icon: Building2 },
  ];

  return (
    <div className="space-y-5 max-w-4xl">
      {/* Шапка */}
      <div className="flex items-center gap-3">
        <span className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center">
          <ShieldCheck className="w-5 h-5 text-purple-600" />
        </span>
        <div>
          <h2 className="text-lg font-bold text-gray-900">Политика конфиденциальности</h2>
          <p className="text-sm text-gray-500">
            Пользователи принимают эти условия при регистрации/входе. Каждое сохранение повышает версию документа.
          </p>
        </div>
      </div>

      {/* Выбор аудитории */}
      <div className="flex gap-2">
        {audienceTabs.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setAudience(key)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
              audience === key
                ? 'bg-purple-600 text-white shadow'
                : 'bg-white text-gray-600 border border-gray-200 hover:border-purple-300'
            }`}
          >
            <Icon className="w-4 h-4" /> {label}
          </button>
        ))}
      </div>

      {loading || !current ? (
        <div className="flex items-center justify-center gap-2 py-16 text-gray-500 bg-white rounded-xl border border-gray-200">
          <RefreshCw className="w-4 h-4 animate-spin" /> Загрузка...
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {/* Метаданные + язык */}
          <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-b border-gray-200 flex-wrap">
            <div className="text-sm text-gray-500">
              Версия <span className="font-bold text-gray-800">v{current.version}</span>
              {current.updatedAt && (
                <> · обновлено {new Date(current.updatedAt).toLocaleString('ru-RU')}</>
              )}
            </div>
            <div className="flex gap-1.5">
              {(['ru', 'uz'] as const).map((l) => (
                <button
                  key={l}
                  onClick={() => setLang(l)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition-colors ${
                    lang === l ? 'bg-purple-100 text-purple-700' : 'text-gray-500 hover:bg-gray-100'
                  }`}
                >
                  {l === 'ru' ? 'Русский' : 'Oʻzbekcha'}
                </button>
              ))}
            </div>
          </div>

          {/* Текст */}
          <div className="p-5">
            <textarea
              value={lang === 'ru' ? current.contentRu : current.contentUz}
              onChange={(e) => setContent(e.target.value)}
              rows={24}
              spellCheck={false}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-purple-400 font-mono text-[13px] leading-relaxed resize-y"
              placeholder={lang === 'ru' ? 'Текст политики на русском...' : 'Siyosat matni oʻzbek tilida...'}
            />
            <div className="flex items-center justify-between mt-4 flex-wrap gap-3">
              <p className="text-xs text-gray-500">
                💡 После сохранения новая редакция сразу показывается при регистрации и входе.
              </p>
              <div className="flex items-center gap-3">
                {savedFlash && (
                  <span className="flex items-center gap-1.5 text-sm font-medium text-emerald-600">
                    <CheckCircle2 className="w-4 h-4" /> Сохранено (v{current.version})
                  </span>
                )}
                <button
                  onClick={save}
                  disabled={saving}
                  className="flex items-center gap-2 px-5 py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-semibold disabled:opacity-50"
                >
                  {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Сохранить
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
