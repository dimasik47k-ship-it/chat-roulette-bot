# 🚀 Руководство по развертыванию

## Локальная разработка

### Требования
- Node.js 18+
- PostgreSQL 15+
- Redis 7+

### Установка

1. Клонируйте репозиторий:
```bash
git clone <repo-url>
cd telegram-chatroulette-bot
```

2. Установите зависимости:
```bash
npm install
```

3. Настройте переменные окружения:
```bash
cp .env.example .env
# Отредактируйте .env файл
```

4. Создайте базу данных:
```bash
createdb chatroulette_bot
```

5. Запустите миграции:
```bash
npm run migrate
```

6. Запустите бота:
```bash
npm run dev
```

## Docker развертывание

### Быстрый старт

1. Настройте .env файл

2. Запустите контейнеры:
```bash
docker-compose up -d
```

3. Проверьте логи:
```bash
docker-compose logs -f bot
```

### Остановка
```bash
docker-compose down
```

### Перезапуск
```bash
docker-compose restart bot
```

## Production развертывание

### VPS/Dedicated Server

1. Установите Docker и Docker Compose

2. Клонируйте репозиторий

3. Настройте .env:
```bash
NODE_ENV=production
TELEGRAM_BOT_TOKEN=your_token
WEBHOOK_URL=https://your-domain.com
DB_PASSWORD=strong_password
REDIS_PASSWORD=strong_password
```

4. Настройте Nginx для webhook:
```nginx
server {
    listen 80;
    server_name your-domain.com;

    location /webhook {
        proxy_pass http://localhost:3000/webhook;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

5. Получите SSL сертификат:
```bash
certbot --nginx -d your-domain.com
```

6. Запустите:
```bash
docker-compose up -d
```

### Heroku

1. Создайте приложение:
```bash
heroku create your-app-name
```

2. Добавьте аддоны:
```bash
heroku addons:create heroku-postgresql:hobby-dev
heroku addons:create heroku-redis:hobby-dev
```

3. Настройте переменные:
```bash
heroku config:set TELEGRAM_BOT_TOKEN=your_token
heroku config:set NODE_ENV=production
```

4. Деплой:
```bash
git push heroku main
```

### Railway

1. Подключите GitHub репозиторий

2. Добавьте PostgreSQL и Redis плагины

3. Настройте переменные окружения

4. Деплой происходит автоматически

## Мониторинг

### Логи
```bash
# Docker
docker-compose logs -f bot

# PM2
pm2 logs chatroulette-bot
```

### Метрики
- Health check: `http://your-domain.com/health`
- Статус: `{"status":"ok","timestamp":1234567890}`

### Бэкапы

PostgreSQL:
```bash
docker exec chatroulette_db pg_dump -U postgres chatroulette_bot > backup.sql
```

Redis:
```bash
docker exec chatroulette_redis redis-cli SAVE
```

## Обновление

1. Остановите бота:
```bash
docker-compose down
```

2. Обновите код:
```bash
git pull
```

3. Пересоберите:
```bash
docker-compose build
```

4. Запустите:
```bash
docker-compose up -d
```

## Troubleshooting

### Бот не отвечает
- Проверьте токен бота
- Проверьте webhook URL
- Проверьте логи

### Ошибки БД
- Проверьте подключение к PostgreSQL
- Проверьте миграции
- Проверьте права доступа

### Ошибки Redis
- Проверьте подключение к Redis
- Проверьте память Redis
- Очистите кэш при необходимости

## Безопасность

1. Используйте сильные пароли
2. Ограничьте доступ к БД
3. Используйте HTTPS
4. Регулярно обновляйте зависимости
5. Настройте firewall
6. Включите логирование
7. Делайте регулярные бэкапы
