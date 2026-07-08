import { useState, useEffect, useRef } from 'react';
import { Plus, Edit2, Trash2, Save, X, Package, Check, Upload, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import api from '../utils/api';
import CategoryIcon, { CATEGORY_ICON_OPTIONS, DEFAULT_CATEGORY_ICON } from './CategoryIcon';

interface Category {
  id: number;
  name: string;
  icon: string;
  description?: string;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export default function AdminCategoriesPanel() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    icon: DEFAULT_CATEGORY_ICON,
    description: '',
    sortOrder: 0
  });

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      const data = await api.categories.list();
      setCategories(data || []);
    } catch (error) {
      console.error('Error loading categories:', error);
      toast.error('Ошибка загрузки категорий');
    } finally {
      setLoading(false);
    }
  };

  const handleIconUpload = async (file: File) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Файл слишком большой (макс. 5 МБ)');
      return;
    }
    try {
      setUploading(true);
      const { url } = await api.categories.uploadIcon(file);
      setFormData((prev) => ({ ...prev, icon: url }));
      toast.success('Иконка загружена');
    } catch (error: any) {
      console.error('Error uploading icon:', error);
      toast.error(error.message || 'Ошибка загрузки иконки');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      toast.error('Введите название категории');
      return;
    }

    try {
      if (editingId) {
        await api.categories.update(editingId, formData);
      } else {
        await api.categories.create(formData);
      }
      toast.success(editingId ? 'Категория обновлена!' : 'Категория создана!');
      loadCategories();
      resetForm();
    } catch (error: any) {
      console.error('Error saving category:', error);
      toast.error(error.message || 'Ошибка сохранения категории');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Удалить эту категорию?')) return;

    try {
      await api.categories.delete(id);
      toast.success('Категория удалена');
      loadCategories();
    } catch (error: any) {
      toast.error(error.message || 'Ошибка удаления категории');
    }
  };

  const handleToggleActive = async (category: Category) => {
    try {
      await api.categories.update(category.id, { isActive: !category.isActive });
      toast.success(category.isActive ? 'Категория скрыта' : 'Категория активирована');
      loadCategories();
    } catch (error: any) {
      toast.error(error.message || 'Ошибка изменения статуса');
    }
  };

  const startEdit = (category: Category) => {
    setEditingId(category.id);
    setFormData({
      name: category.name,
      icon: category.icon,
      description: category.description || '',
      sortOrder: category.sortOrder
    });
    setIsAdding(true);
  };

  const resetForm = () => {
    setEditingId(null);
    setIsAdding(false);
    setFormData({ name: '', icon: DEFAULT_CATEGORY_ICON, description: '', sortOrder: 0 });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="text-gray-500">Загрузка категорий...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Заголовок */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-lg p-6 text-white">
        <div className="flex items-center gap-3 mb-2">
          <Package className="w-8 h-8" />
          <h2 className="text-xl font-bold">Управление категориями</h2>
        </div>
        <p className="text-blue-100">
          Создавайте категории товаров. Компании смогут выбирать их при добавлении товаров.
        </p>
      </div>

      {/* Форма добавления/редактирования */}
      {isAdding ? (
        <div className="bg-white rounded-lg shadow-sm p-6 border-2 border-blue-500">
          <h3 className="font-semibold mb-4">
            {editingId ? 'Редактирование категории' : 'Новая категория'}
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Название *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Например: Смартфоны"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Иконка категории
              </label>
              <div className="flex items-center gap-3 mb-3">
                {/* Превью текущей иконки */}
                <div className="w-14 h-14 rounded-lg border-2 border-blue-200 flex items-center justify-center bg-blue-50 text-blue-600 overflow-hidden shrink-0">
                  <CategoryIcon icon={formData.icon} className="w-8 h-8" />
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/svg+xml,image/jpeg,image/webp,image/gif"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleIconUpload(file);
                    e.target.value = '';
                  }}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
                >
                  {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  {uploading ? 'Загрузка...' : 'Загрузить свою (PNG/SVG)'}
                </button>
              </div>
              {/* Профессиональные векторные иконки */}
              <p className="text-xs text-gray-500 mb-1">или выберите профессиональную иконку:</p>
              <div className="flex flex-wrap gap-2">
                {CATEGORY_ICON_OPTIONS.map(({ key, Icon, label }) => (
                  <button
                    key={key}
                    type="button"
                    title={label}
                    onClick={() => setFormData({ ...formData, icon: key })}
                    className={`w-10 h-10 flex items-center justify-center rounded-lg border-2 transition ${
                      formData.icon === key
                        ? 'border-blue-500 bg-blue-50 text-blue-600'
                        : 'border-gray-200 text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Описание
              </label>
              <input
                type="text"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="Краткое описание категории"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Порядок сортировки
              </label>
              <input
                type="number"
                value={formData.sortOrder}
                onChange={(e) => setFormData({ ...formData, sortOrder: parseInt(e.target.value) || 0 })}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="0"
              />
            </div>
          </div>

          <div className="flex gap-3 mt-6">
            <button
              onClick={handleSubmit}
              className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              <Save className="w-4 h-4" />
              {editingId ? 'Сохранить' : 'Создать'}
            </button>
            <button
              onClick={resetForm}
              className="flex items-center gap-2 px-6 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition"
            >
              <X className="w-4 h-4" />
              Отмена
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setIsAdding(true)}
          className="w-full py-4 border-2 border-dashed border-blue-300 rounded-lg text-blue-600 hover:bg-blue-50 transition flex items-center justify-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Добавить категорию
        </button>
      )}

      {/* Список категорий */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="p-4 border-b bg-gray-50">
          <h3 className="font-semibold text-gray-800">
            Все категории ({categories.length})
          </h3>
        </div>

        {categories.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <Package className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p>Категорий пока нет</p>
            <p className="text-sm">Создайте первую категорию</p>
          </div>
        ) : (
          <div className="divide-y">
            {categories.map((category) => (
              <div
                key={category.id}
                className={`p-4 flex items-center justify-between hover:bg-gray-50 transition ${
                  !category.isActive ? 'opacity-50 bg-gray-100' : ''
                }`}
              >
                <div className="flex items-center gap-4">
                  <span className="w-11 h-11 flex items-center justify-center rounded-lg bg-blue-50 text-blue-600 shrink-0">
                    <CategoryIcon icon={category.icon} className="w-7 h-7" />
                  </span>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium text-gray-900">{category.name}</h4>
                      {!category.isActive && (
                        <span className="text-xs px-2 py-0.5 bg-gray-200 text-gray-600 rounded">
                          Скрыта
                        </span>
                      )}
                    </div>
                    {category.description && (
                      <p className="text-sm text-gray-500">{category.description}</p>
                    )}
                    <p className="text-xs text-gray-400 mt-1">
                      Порядок: {category.sortOrder}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleToggleActive(category)}
                    className={`p-2 rounded-lg transition ${
                      category.isActive
                        ? 'text-green-600 hover:bg-green-50'
                        : 'text-gray-400 hover:bg-gray-100'
                    }`}
                    title={category.isActive ? 'Скрыть' : 'Активировать'}
                  >
                    <Check className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => startEdit(category)}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                    title="Редактировать"
                  >
                    <Edit2 className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => handleDelete(category.id)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                    title="Удалить"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
