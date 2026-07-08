# Manual VPS Deployment Instructions
# Копируйте и выполняйте эти команды одну за другой

# 1. Подключитесь к VPS через SSH
ssh root@109.123.253.238
# Пароль: Supreme001

# 2. Перейдите в директорию проекта
cd /root/Axentis-market

# 3. Обновите код с GitHub
git pull origin main

# 4. Остановите контейнеры
docker-compose down

# 5. Пересоберите контейнеры (это займет несколько минут)
docker-compose build --no-cache

# 6. Запустите контейнеры
docker-compose up -d

# 7. Проверьте статус контейнеров
docker ps

# 8. Проверьте логи (если нужно)
docker-compose logs -f --tail=100

# ✅ Готово! Откройте http://109.123.253.238 в браузере
