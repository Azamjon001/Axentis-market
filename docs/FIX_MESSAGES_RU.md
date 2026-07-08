# Quick Fix - Company Messages (Русский)

## Проблема:
Когда отправляешь сообщение всем компаниям, показывает "0 компаний"

## Решение (2 минуты):

### Шаг 1: Подключись к серверу
Открой PowerShell и выполни:
```powershell
ssh root@109.123.253.238
```
Введи пароль от сервера

### Шаг 2: Создай таблицу
Скопируй и вставь эту команду полностью:
```bash
cd /root/onlineshop2 && docker-compose exec -T db psql -U postgres -d azaton -c "CREATE TABLE IF NOT EXISTS company_messages (id SERIAL PRIMARY KEY, company_id BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE, title VARCHAR(255) NOT NULL, message TEXT NOT NULL, sender_name VARCHAR(100) DEFAULT 'Axis', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, is_read BOOLEAN DEFAULT FALSE); CREATE INDEX IF NOT EXISTS idx_company_messages_company_id ON company_messages(company_id); CREATE INDEX IF NOT EXISTS idx_company_messages_created_at ON company_messages(created_at DESC); CREATE INDEX IF NOT EXISTS idx_company_messages_is_read ON company_messages(is_read);"
```

### Шаг 3: Проверь
```bash
docker-compose exec -T db psql -U postgres -d azaton -c "SELECT COUNT(*) FROM company_messages;"
```
Должно показать "count: 0" (это нормально, таблица пустая)

### Шаг 4: Тест
- Выйди из SSH: `exit`
- Открой админ-панель в браузере
- Попробуй отправить сообщение всем компаниям
- Теперь должно показать "Отправлено 2 компаниям!"

---

## Если SSH спрашивает "Are you sure you want to continue connecting?"
Напиши `yes` и нажми Enter

## Если не помнишь пароль от сервера
Проверь где у тебя сохранен пароль или спроси у того кто настраивал сервер.
