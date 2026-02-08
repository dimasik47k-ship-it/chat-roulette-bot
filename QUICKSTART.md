# 🚀 Быстрый старт

Запустите Telegram Chat Roulette Bot за 5 минут!

## Предварительные требования

- Node.js 18+ ([скачать](https://nodejs.org/))
- PostgreSQL 15+ ([скачать](https://www.postgresql.org/download/))
- Redis 7+ ([скачать](https://redis.io/download))
- Telegram Bot Token ([получить](https://t.me/BotFather))

## Шаг 1: Клонирование

```bash
git clone https://github.com/your-username/telegram-chatroulette-bot.git
cd telegram-chatroulette-bot
```

## Шаг 2: Установка зависимостей

```bash
npm install
```

## Шаг 3: Настройка окружения

```bash
cp .env.example .env
```

Отредактируйте `.env`:

```env
# Обязательные параметры
TELEGRAM_BOT_TOKEN=your_bot_token_here
DB_HOST=localhost
DB_PORT=5432
DB_NAME=chatroulette_bot
DB_USER=postgres
DB_PASSWORD=your_password
REDIS_HOST=localhost
REDIS_PORT=6379

# Опциональные
NODE_ENV=development
PORT=3000
```

## Шаг 4: Создание базы данных

```bash
# PostgreSQL
createdb chatroulette_bot

# Или через psql
psql -U postgres
CREATE DATABASE chatroulette_bot;
\q
```

## Шаг 5: Миграции

```bash
npm run migrate
```

## Шаг 6: Запуск

```bash
npm run dev
```

Готово! 🎉 Бот запущен и готов к работе.

## Проверка

1. Откройте Telegram
2. Найдите вашего бота
3. Отправьте `/start`
4. Следуйте инструкциям

## Альтернатива: Docker

Если у вас установлен Docker:

```bash
# Настройте .env
cp .env.example .env

# Запустите
docker-compose up -d

# Проверьте логи
docker-compose logs -f bot
```

## Что дальше?

- 📖 Прочитайте [README.md](README.md)
- 🏗️ Изучите [ARCHITECTURE.md](ARCHITECTURE.md)
- 🌟 Посмотрите [FEATURES.md](FEATURES.md)
- 🚀 Разверните на [production](DEPLOYMENT.md)

## Возникли проблемы?

### Бот не запускается

**Проблема**: `Error: ECONNREFUSED`
**Решение**: Проверьте, запущены ли PostgreSQL и Redis

```bash
# PostgreSQL
sudo service postgresql status
sudo service postgresql start

# Redis
sudo service redis status
sudo service redis start
```

**Проблема**: `Invalid bot token`
**Решение**: Проверьте токен в .env файле

### База данных

**Проблема**: `database "chatroulette_bot" does not exist`
**Решение**: Создайте базу данных

```bash
createdb chatroulette_bot
```

**Проблема**: `password authentication failed`
**Решение**: Проверьте пароль в .env

### Redis

**Проблема**: `Redis connection refused`
**Решение**: Запустите Redis

```bash
redis-server
```

## Полезные команды

```bash
# Разработка
npm run dev          # Запуск с hot-reload

# Production
npm start            # Обычный запуск

# База данных
npm run migrate      # Запуск миграций

# Docker
docker-compose up    # Запуск всех сервисов
docker-compose down  # Остановка
docker-compose logs  # Просмотр логов

# Тестирование
npm test             # Запуск тестов
npm run lint         # Проверка кода
```

## Поддержка

- 📧 Email: support@example.com
- 💬 Telegram: @support_bot
- 🐛 Issues: [GitHub Issues](https://github.com/your-username/telegram-chatroulette-bot/issues)

## Лицензия

MIT License - используйте свободно!

---

Удачи с вашим ботом! 🚀
