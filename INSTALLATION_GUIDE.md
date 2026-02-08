# 📖 Полное руководство по установке

## Содержание
1. [Системные требования](#системные-требования)
2. [Установка зависимостей](#установка-зависимостей)
3. [Получение Bot Token](#получение-bot-token)
4. [Настройка PostgreSQL](#настройка-postgresql)
5. [Настройка Redis](#настройка-redis)
6. [Конфигурация бота](#конфигурация-бота)
7. [Запуск](#запуск)
8. [Проверка работы](#проверка-работы)
9. [Troubleshooting](#troubleshooting)

## Системные требования

### Минимальные
- CPU: 1 core
- RAM: 512 MB
- Disk: 1 GB
- OS: Linux, macOS, Windows

### Рекомендуемые
- CPU: 2+ cores
- RAM: 2 GB
- Disk: 5 GB SSD
- OS: Ubuntu 20.04+

## Установка зависимостей

### Node.js

#### Ubuntu/Debian
```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```

#### macOS
```bash
brew install node@18
```

#### Windows
Скачайте установщик с [nodejs.org](https://nodejs.org/)

Проверка:
```bash
node --version  # должно быть >= 18.0.0
npm --version
```

### PostgreSQL

#### Ubuntu/Debian
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

#### macOS
```bash
brew install postgresql@15
brew services start postgresql@15
```

#### Windows
Скачайте установщик с [postgresql.org](https://www.postgresql.org/download/windows/)

Проверка:
```bash
psql --version  # должно быть >= 15.0
```

### Redis

#### Ubuntu/Debian
```bash
sudo apt update
sudo apt install redis-server
sudo systemctl start redis-server
sudo systemctl enable redis-server
```

#### macOS
```bash
brew install redis
brew services start redis
```

#### Windows
Скачайте с [redis.io](https://redis.io/download) или используйте WSL

Проверка:
```bash
redis-cli ping  # должно вернуть PONG
```

## Получение Bot Token

1. Откройте Telegram и найдите [@BotFather](https://t.me/BotFather)
2. Отправьте команду `/newbot`
3. Следуйте инструкциям:
   - Введите имя бота (например: "My Chat Roulette")
   - Введите username (должен заканчиваться на "bot", например: "mychatroulette_bot")
4. Сохраните полученный токен (формат: `123456789:ABCdefGHIjklMNOpqrsTUVwxyz`)

### Настройка бота

Отправьте BotFather следующие команды:

```
/setdescription - Установить описание
/setabouttext - Установить текст "О боте"
/setuserpic - Установить аватар
/setcommands - Установить команды
```

Команды для установки:
```
start - Начать работу с ботом
help - Помощь и инструкции
profile - Мой профиль
settings - Настройки
premium - Premium подписка
stats - Статистика
```

## Настройка PostgreSQL

### Создание пользователя и базы данных

```bash
# Войти в PostgreSQL
sudo -u postgres psql

# Создать пользователя
CREATE USER chatroulette WITH PASSWORD 'your_strong_password';

# Создать базу данных
CREATE DATABASE chatroulette_bot OWNER chatroulette;

# Дать права
GRANT ALL PRIVILEGES ON DATABASE chatroulette_bot TO chatroulette;

# Выйти
\q
```

### Проверка подключения

```bash
psql -U chatroulette -d chatroulette_bot -h localhost
# Введите пароль
# Если подключение успешно, выйдите: \q
```

## Настройка Redis

### Базовая конфигурация

Отредактируйте `/etc/redis/redis.conf`:

```conf
# Установить пароль (опционально)
requirepass your_redis_password

# Максимальная память
maxmemory 256mb
maxmemory-policy allkeys-lru

# Сохранение на диск
save 900 1
save 300 10
save 60 10000
```

Перезапустите Redis:
```bash
sudo systemctl restart redis-server
```

## Конфигурация бота

### 1. Клонирование репозитория

```bash
git clone https://github.com/your-username/telegram-chatroulette-bot.git
cd telegram-chatroulette-bot
```

### 2. Установка зависимостей

```bash
npm install
```

### 3. Настройка .env файла

```bash
cp .env.example .env
nano .env  # или используйте любой редактор
```

Заполните все параметры:

```env
# Telegram Bot
TELEGRAM_BOT_TOKEN=123456789:ABCdefGHIjklMNOpqrsTUVwxyz
WEBHOOK_URL=https://your-domain.com  # для production

# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=chatroulette_bot
DB_USER=chatroulette
DB_PASSWORD=your_strong_password

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your_redis_password  # если установлен

# Server
PORT=3000
NODE_ENV=development

# Security
JWT_SECRET=your_random_jwt_secret_here
ENCRYPTION_KEY=your_random_encryption_key

# AI Moderation (опционально)
HUGGINGFACE_API_KEY=your_huggingface_key

# Limits
MAX_QUEUE_TIME=300
MAX_CHAT_DURATION=3600
FLOOD_LIMIT=5
FLOOD_WINDOW=10
```

### 4. Запуск миграций

```bash
npm run migrate
```

Вы должны увидеть:
```
[INFO] Starting database migration...
[INFO] Database connected successfully
[INFO] Migrations completed successfully!
```

## Запуск

### Development режим

```bash
npm run dev
```

### Production режим

```bash
npm start
```

### С PM2 (рекомендуется для production)

```bash
# Установить PM2
npm install -g pm2

# Запустить
pm2 start src/index.js --name chatroulette-bot

# Автозапуск при перезагрузке
pm2 startup
pm2 save

# Просмотр логов
pm2 logs chatroulette-bot

# Остановка
pm2 stop chatroulette-bot

# Перезапуск
pm2 restart chatroulette-bot
```

### Docker

```bash
# Запуск
docker-compose up -d

# Просмотр логов
docker-compose logs -f bot

# Остановка
docker-compose down

# Перезапуск
docker-compose restart bot
```

## Проверка работы

### 1. Проверка логов

Вы должны увидеть:
```
[INFO] 🚀 Запуск бота...
[INFO] ✅ База данных подключена
[INFO] ✅ Redis подключен
[INFO] ✅ Бот инициализирован
[INFO] ✅ Сервер запущен на порту 3000
[INFO] 🎉 Бот успешно запущен!
```

### 2. Проверка в Telegram

1. Откройте Telegram
2. Найдите вашего бота по username
3. Отправьте `/start`
4. Вы должны получить приветственное сообщение

### 3. Проверка базы данных

```bash
psql -U chatroulette -d chatroulette_bot

# Проверить таблицы
\dt

# Проверить пользователей
SELECT * FROM users;

# Выйти
\q
```

### 4. Проверка Redis

```bash
redis-cli
# Если установлен пароль:
# redis-cli -a your_redis_password

# Проверить ключи
KEYS *

# Выйти
exit
```

### 5. Health check

```bash
curl http://localhost:3000/health
```

Ответ:
```json
{"status":"ok","timestamp":1234567890}
```

## Troubleshooting

### Бот не запускается

**Ошибка**: `Error: ECONNREFUSED connecting to PostgreSQL`

**Решение**:
```bash
# Проверить статус
sudo systemctl status postgresql

# Запустить
sudo systemctl start postgresql

# Проверить подключение
psql -U chatroulette -d chatroulette_bot -h localhost
```

**Ошибка**: `Error: ECONNREFUSED connecting to Redis`

**Решение**:
```bash
# Проверить статус
sudo systemctl status redis-server

# Запустить
sudo systemctl start redis-server

# Проверить
redis-cli ping
```

**Ошибка**: `Error: Unauthorized (401)`

**Решение**: Проверьте токен бота в .env файле

### Миграции не выполняются

**Ошибка**: `database "chatroulette_bot" does not exist`

**Решение**:
```bash
sudo -u postgres psql
CREATE DATABASE chatroulette_bot;
\q
npm run migrate
```

**Ошибка**: `permission denied for schema public`

**Решение**:
```bash
sudo -u postgres psql chatroulette_bot
GRANT ALL ON SCHEMA public TO chatroulette;
\q
```

### Бот не отвечает

1. Проверьте логи: `pm2 logs` или `docker-compose logs`
2. Проверьте токен бота
3. Проверьте подключение к интернету
4. Перезапустите бота

### Высокое использование памяти

1. Увеличьте лимит Redis: `maxmemory 512mb`
2. Настройте очистку кэша
3. Оптимизируйте запросы к БД

### Медленная работа

1. Добавьте индексы в БД
2. Увеличьте connection pool
3. Настройте кэширование
4. Используйте CDN для статики

## Дополнительная настройка

### SSL/HTTPS (для production)

```bash
# Установить Certbot
sudo apt install certbot

# Получить сертификат
sudo certbot certonly --standalone -d your-domain.com

# Настроить Nginx
sudo nano /etc/nginx/sites-available/chatroulette
```

### Мониторинг

```bash
# Установить monitoring tools
npm install -g pm2-logrotate
pm2 install pm2-logrotate

# Настроить логи
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
```

### Бэкапы

```bash
# Создать скрипт бэкапа
nano backup.sh
```

```bash
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
pg_dump -U chatroulette chatroulette_bot > backup_$DATE.sql
redis-cli SAVE
cp /var/lib/redis/dump.rdb backup_redis_$DATE.rdb
```

```bash
chmod +x backup.sh
# Добавить в cron для автоматического бэкапа
crontab -e
# 0 2 * * * /path/to/backup.sh
```

## Следующие шаги

1. ✅ Настройте webhook для production
2. ✅ Настройте мониторинг
3. ✅ Настройте автоматические бэкапы
4. ✅ Добавьте свой домен
5. ✅ Настройте SSL
6. ✅ Оптимизируйте производительность

## Полезные ссылки

- [Telegram Bot API](https://core.telegram.org/bots/api)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Redis Documentation](https://redis.io/documentation)
- [Node.js Best Practices](https://github.com/goldbergyoni/nodebestpractices)

---

Готово! Ваш бот установлен и готов к работе! 🎉
