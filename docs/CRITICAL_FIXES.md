# 🔧 CRITICAL FIXES NEEDED - Изображения и Сообщения

## ❗ Проблема 1: Сообщения компаниям показывают "0 компаний"

**Причина:** Таблица `company_messages` не существует на сервере (миграция №124 не применена)

**Решение:**

1. Подключись к серверу через SSH:
   ```bash
   ssh root@109.123.253.238
   ```

2. Выполни скрипт создания таблицы:
   ```bash
   cd /root/onlineshop2
   docker-compose exec -T db psql -U postgres -d azaton -c "
   CREATE TABLE IF NOT EXISTS company_messages (
       id SERIAL PRIMARY KEY,
       company_id BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
       title VARCHAR(255) NOT NULL,
       message TEXT NOT NULL,
       sender_name VARCHAR(100) DEFAULT 'Axis',
       created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
       is_read BOOLEAN DEFAULT FALSE
   );
   CREATE INDEX IF NOT EXISTS idx_company_messages_company_id ON company_messages(company_id);
   CREATE INDEX IF NOT EXISTS idx_company_messages_created_at ON company_messages(created_at DESC);
   CREATE INDEX IF NOT EXISTS idx_company_messages_is_read ON company_messages(is_read);"
   ```

3. Проверь что таблица создана:
   ```bash
   docker-compose exec -T db psql -U postgres -d azaton -c "\d company_messages"
   ```

4. Теперь протестируй отправку через админ-панель!

**Альтернатива (если SSH недоступен):** Загрузи файл `fix-company-messages.sh` на сервер и запусти:
```bash
chmod +x fix-company-messages.sh
./fix-company-messages.sh
```

---

## ❗ Проблема 2: Изображения показывают "No image"

**Статус:** ИЗОБРАЖЕНИЯ УЖЕ РАБОТАЮТ! ✅

Проверено:
- ✅ API возвращает правильные пути: `uploads/product_1_xxx.png`
- ✅ Файлы доступны: http://109.123.253.238:3000/uploads/product_1_1773128002870774947.png
- ✅ Frontend правильно строит URL через `getImageUrl()`

**Если все еще видишь "No image":**

1. **Открой DevTools в браузере (F12)**
2. **Перейди на вкладку Console**
3. **Загрузи/обнови страницу с продуктами**
4. **Скопируй сюда все ошибки связанные с изображениями**

Возможные причины:
- CORS (Cross-Origin) ошибки
- Cache браузера (нажми Ctrl+F5)
- Firewall блокирует загрузку изображений

**Быстрый тест:** Открой в браузере:
```
http://109.123.253.238:3000/uploads/product_1_1773128002870774947.png
```

Если изображение загружается - проблема в frontend коде и нужно логи из DevTools.

---

## 🎯 Следующие шаги:

1. **Сначала исправь таблицу company_messages (выше)**
2. **Протестируй отправку сообщений в админ-панели**
3. **Проверь изображения в DevTools и пришли логи если не работают**

---

## 📊 Статус системы:

✅ Backend server доступен: http://109.123.253.238:3000
✅ API companies работает: 2 компании в базе
✅ API products работает: 1 продукт с изображением
✅ Статические файлы доступны: /uploads работает
❌ Таблица company_messages: НЕ СУЩЕСТВУЕТ
❓ Frontend отображение изображений: НУЖНА ПРОВЕРКА В DEVTOOLS
