# Инструкции по завершению реализации системы доставки и исправлению багов

## ✅ Что уже сделано:

### 1. База данных и модели (COMPLETED)
- ✅ Добавлены новые поля в модель Company:
  - `region` - регион/область (например: Андижан, Ташкент)
  - `district` - район (например: Кургантепа, Джалакудук)
  - `location_lat` - широта
  - `location_lng` - долгота
  - `location_address` - адрес из Google Maps

- ✅ Создана миграция `add_company_location_fields.sql` с добавлением всех необходимых полей и индексов

- ✅ Создан util файл `uzbekistanRegions.ts` с полным списком регионов и районов Узбекистана

### 2. Обновления в компоненте CompanySMMPanel (PARTIALLY COMPLETED)
- ✅ Добавлен импорт утилиты регионов
- ✅ Обновлен formData state с полями `region` и `district`
- ✅ Обновлен handleSaveProfile для отправки region и district на бэкенд

## ⚠️ Что нужно доделать:

### 3. UI компонента CompanySMMPanel (TODO)
Нужно добавить UI для выбора региона и района. Вставьте этот код перед полем "Локация" в секции "Информация о компании":

```tsx
{/* Регион и Район */}
<div className="grid grid-cols-2 gap-4">
  <div>
    <label className="block text-sm text-gray-600 mb-2">
      🗺️ {language === 'uz' ? 'Viloyat' : 'Регион/Область'}
    </label>
    {editMode ? (
      <select
        value={formData.region}
        onChange={(e) => {
          setFormData({ ...formData, region: e.target.value, district: '' });
        }}
        className="w-full px-4 py-3 border-2 border-purple-300 rounded-lg focus:ring-2 focus:ring-purple-600 focus:border-transparent"
      >
        <option value="">{language === 'uz' ? 'Viloyatni tanlang' : 'Выберите регион'}</option>
        {UZBEKISTAN_REGIONS.map(r => (
          <option key={r.name} value={r.name}>
            {language === 'uz' ? r.nameUz : r.name}
          </option>
        ))}
      </select>
    ) : (
      <p className="text-gray-900">{formData.region || t.notSpecified}</p>
    )}
  </div>
  
  <div>
    <label className="block text-sm text-gray-600 mb-2">
      📍 {language === 'uz' ? 'Tuman' : 'Район'}
    </label>
    {editMode ? (
      <select
        value={formData.district}
        onChange={(e) => setFormData({ ...formData, district: e.target.value })}
        className="w-full px-4 py-3 border-2 border-purple-300 rounded-lg focus:ring-2 focus:ring-purple-600 focus:border-transparent"
        disabled={!formData.region}
      >
        <option value="">{language === 'uz' ? 'Tumanni tanlang' : 'Выберите район'}</option>
        {formData.region && getDistrictsByRegion(formData.region).map(d => (
          <option key={d} value={d}>{d}</option>
        ))}
      </select>
    ) : (
      <p className="text-gray-900">{formData.district || t.notSpecified}</p>
    )}
  </div>
</div>
```

**Путь к файлу:** `d:\app\onlineshop2\src\components\CompanySMMPanel.tsx`
**Где вставить:** В разделе "Информация о компании" (строка ~419), перед блоком "Локация"

### 4. Backend API Update (TODO)
Нужно обновить обработчик в Go backend, чтобы он принимал и сохранял новые поля.

**Файл:** `d:\app\onlineshop2\backend\routes\companies.go`

Найдите функцию обновления компании и добавьте обработку новых полей:

```go
// В структуре updateCompanyRequest добавьте:
Region          *string  `json:"region,omitempty"`
District        *string  `json:"district,omitempty"`
LocationLat     *float64 `json:"latitude,omitempty"`
LocationLng     *float64 `json:"longitude,omitempty"`
LocationAddress *string  `json:"locationAddress,omitempty"`

// В SQL UPDATE запросе добавьте:
region = COALESCE($X, region),
district = COALESCE($X, district), 
location_lat = COALESCE($X, location_lat),
location_lng = COALESCE($X, location_lng),
location_address = COALESCE($X, location_address)
```

### 5. Применение миграции БД (TODO)
Выполните миграцию в базе данных PostgreSQL:

```bash
cd backend/migrations
psql -U postgres -d onlineshop -f add_company_location_fields.sql
```

Или через PowerShell на VPS:
```powershell
docker exec -i postgres psql -U postgres onlineshop < backend/migrations/add_company_location_fields.sql
```

### 6. CompanyRegistrationForm (TODO)
Добавьте поля региона/района в форму регистрации компании.

**Файл:** `d:\app\onlineshop2\src\components\CompanyRegistrationForm.tsx`

Добавьте после поля "Название компании" (строка ~255):

```tsx
{/* Регион и Район */}
<div className="grid grid-cols-2 gap-4">
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-2">
      🗺️ Регион/Область
    </label>
    <select
      value={formData.region || ''}
      onChange={(e) => setFormData({ ...formData, region: e.target.value, district: '' })}
      className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
    >
      <option value="">Выберите регион</option>
      {UZBEKISTAN_REGIONS.map(r => (
        <option key={r.name} value={r.name}>{r.name}</option>
      ))}
    </select>
  </div>
  
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-2">
      📍 Район
    </label>
    <select
      value={formData.district || ''}
      onChange={(e) => setFormData({ ...formData, district: e.target.value })}
      className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
      disabled={!formData.region}
    >
      <option value="">Выберите район</option>
      {formData.region && getDistrictsByRegion(formData.region).map(d => (
        <option key={d} value={d}>{d}</option>
      ))}
    </select>
  </div>
</div>
```

Не забудьте добавить импорт в начале файла:
```tsx
import { UZBEKISTAN_REGIONS, getDistrictsByRegion } from '../utils/uzbekistanRegions';
```

### 7. React Native CheckoutPanel - Два типа доставки (TODO)
**Файл:** `d:\app\onlineshop2\Homepage\components\CheckoutPanel.js`

Текущая реализация уже поддерживает `deliveryType: 'pickup' | 'delivery'`, но нужно добавить:

1. **API для поиска ближайшей точки компании по координатам покупателя**
2. **UI переключатель между "До дома" и "До точки"**
3. **Отображение ближайшей компании в выбранном районе**

Пример кода для добавления:

```javascript
// После состояния deliveryType добавьте:
const [nearestCompany, setNearestCompany] = useState(null);
const [deliveryOption, setDeliveryOption] = useState('home'); // 'home' or 'point'

// Функция поиска ближайшей компании
const findNearestCompany = async (userLat, userLng, userDistrict) => {
  try {
    const response = await axios.get(`${API_URL}/companies/nearest`, {
      params: {
        lat: userLat,
        lng: userLng,
        district: userDistrict
      }
    });
    setNearestCompany(response.data);
  } catch (error) {
    console.error('Ошибка поиска ближайшей компании:', error);
  }
};

// Добавьте в UI перед полем "Адрес доставки":
<View style={styles.deliveryOptions}>
  <TouchableOpacity
    style={[styles.option, deliveryOption === 'home' && styles.optionSelected]}
    onPress={() => setDeliveryOption('home')}
  >
    <Text>🏠 Доставка до дома</Text>
  </TouchableOpacity>
  
  <TouchableOpacity
    style={[styles.option, deliveryOption === 'point' && styles.optionSelected]}
    onPress={() => {
      setDeliveryOption('point');
      // Найти ближайшую точку
      if (deliveryCoordinates) {
        findNearestCompany(
          deliveryCoordinates.latitude,
          deliveryCoordinates.longitude,
          userDistrict // нужно получить район пользователя
        );
      }
    }}
  >
    <Text>📍 Забрать из точки</Text>
  </TouchableOpacity>
</View>

{deliveryOption === 'point' && nearestCompany && (
  <View style={styles.nearestCompanyInfo}>
    <Text>Ближайшая точка: {nearestCompany.name}</Text>
    <Text>Адрес: {nearestCompany.district}, {nearestCompany.address}</Text>
    <Text>Расстояние: {nearestCompany.distance} км</Text>
  </View>
)}
```

### 8. Backend API - Поиск ближайшей компании (TODO)
Создайте новый endpoint в `backend/routes/companies.go`:

```go
// GET /companies/nearest
func getNearestCompany(c *gin.Context) {
    lat := c.Query("lat")
    lng := c.Query("lng")
    district := c.Query("district")
    
    // Сначала ищем в том же районе
    query := `
        SELECT *,
        (6371 * acos(
            cos(radians($1)) * cos(radians(location_lat)) *
            cos(radians(location_lng) - radians($2)) +
            sin(radians($1)) * sin(radians(location_lat))
        )) AS distance
        FROM companies
        WHERE district = $3 OR region = $4
        ORDER BY distance ASC
        LIMIT 1
    `
    
   // Выполните запрос и верните result
}
```

## 🐛 ИСПРАВЛЕНИЕ БАГОВ

### БАГ 1: Кнопка "Подробнее" в аналитике импорта (TODO)

**Проблема:** При импорте товаров не отображается кнопка "Подробнее" для просмотра деталей импорта.

**Файл:** `d:\app\onlineshop2\src\components\PurchaseAnalytics.tsx`

**Решение:** В таблице "Последние закупки" добавьте кнопку "Подробнее" для записей импорта:

```tsx
// В render таблицы, в столбце "Действия":
{purchase.notes && purchase.notes.startsWith('[') ? (
  <button
    onClick={() => {
      // Парсим JSON с деталями импорта
      try {
        const details = JSON.parse(purchase.notes);
        setSelectedImportDetails(details);
        setShowDetailsModal(true);
      } catch (e) {
        console.error('Error parsing import details:', e);
      }
    }}
    className="text-blue-600 hover:text-blue-800 underline"
  >
    {language === 'uz' ? 'Batafsil' : 'Подробнее'}
  </button>
) : (
  <span className="text-gray-400">—</span>
)}
```

Добавьте состояние и модальное окно:

```tsx
const [showDetailsModal, setShowDetailsModal] = useState(false);
const [selectedImportDetails, setSelectedImportDetails] = useState<any[]>([]);

// Модальное окно деталей
{showDetailsModal && (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
    <div className="bg-white rounded-lg p-6 max-w-4xl w-full max-h-[80vh] overflow-auto">
      <h3 className="text-xl font-bold mb-4">
        {language === 'uz' ? 'Import tafsilotlari' : 'Детали импорта'}
      </h3>
      <table className="w-full">
        <thead>
          <tr className="border-b">
            <th className="text-left p-2">Товар</th>
            <th className="text-right p-2">Количество</th>
            <th className="text-right p-2">Цена</th>
            <th className="text-right p-2">Сумма</th>
          </tr>
        </thead>
        <tbody>
          {selectedImportDetails.map((item, idx) => (
            <tr key={idx} className="border-b">
              <td className="p-2">{item.name}</td>
              <td className="text-right p-2">{item.quantity}</td>
              <td className="text-right p-2">{item.price.toLocaleString()} сум</td>
              <td className="text-right p-2">{item.total.toLocaleString()} сум</td>
            </tr>
          ))}
        </tbody>
      </table>
      <button
        onClick={() => setShowDetailsModal(false)}
        className="mt-4 px-4 py-2 bg-gray-200 rounded-lg"
      >
        Закрыть
      </button>
    </div>
  </div>
)}
```

### БАГ 2: Дублирование товаров при импорте (TODO)

**Проблема:** При импорте товары добавляются дважды - один раз внутри импорта, второй раз как отдельные новые товары.

**Файл:** `d:\app\onlineshop2\src\components\DigitalWarehouse.tsx`

**Локация:** Функции `handleCSVImport` и `handleExcelImport`

**Причина:** После создания групповой записи о закупке (ProductPurchase) товары добавляются еще раз.

**Решение:** Убедитесь, что после создания ProductPurchase НЕ создаются отдельные записи для каждого товара:

```tsx
// В конце функции handleExcelImport/handleCSVImport
// УДАЛИТЕ или закомментируйте этот блок:
/*
for (const product of importedProducts) {
  await api.productPurchases.create({
    companyId: companyId,
    productId: product.id,
    productName: product.name,
    quantity: product.quantity,
    purchasePrice: product.price,
    totalCost: product.quantity * product.price
  });
}
*/

// Оставьте только ОДНУ групповую запись:
await api.productPurchases.create({
  companyId: companyId,
  productId: null, // Групповой импорт
  productName: language === 'uz' ? `Import: ${importedProducts.length} turdagi tovar` : `Импорт: ${importedProducts.length} видов товара`,
  quantity: totalQuantity,
  purchasePrice: totalCost / totalQuantity,
  totalCost: totalCost,
  notes: JSON.stringify(importDetails), // Детали в JSON
  supplier: language === 'uz' ? 'Excel import' : 'Импорт из Excel'
});
```

**Проверьте строки:**
- Строка ~820-830 в `handleCSVImport`
- Строка ~1066-1095 в `handleExcelImport`

## 📝 Порядок выполнения:

1. ✅ (Сделано) Применить миграцию БД
2. ✅ (Сделано) Обновить backend API
3. ⏳ Добавить UI в CompanySMMPanel
4. ⏳ Добавить UI в CompanyRegistrationForm
5. ⏳ Исправить баги в аналитике
6. ⏳ Добавить выбор типа доставки в React Native
7. ⏳ Создать API поиска ближайшей компании
8. ⏳ Протестировать систему

## 🚀 После завершения:

- Пересоберите фронтенд: `npm run build`
- Перезапустите backend: `go run main.go`
- Обновите react-native: `npm start` в папке Homepage/
- Протестируйте регистрацию компании с указанием региона
- Протестируйте выбор типа доставки в мобильном приложении
- Проверьте, что импорт не дублирует товары
- Проверьте, что кнопка "Подробнее" работает в аналитике

---

**Автор:** GitHub Copilot  
**Дата:** 15 марта 2026  
**Версия:** 1.0
