# 🎮 Список всех команд

## NPM Scripts

### Основные команды

```bash
# Запуск в production режиме
npm start

# Запуск в development режиме (с hot-reload)
npm run dev

# Запуск миграций базы данных
npm run migrate

# Запуск тестов
npm test
```

### Линтинг и форматирование

```bash
# Проверка кода (ESLint)
npm run lint

# Автоматическое исправление ошибок
npm run lint:fix

# Форматирование кода (Prettier)
npm run format
```

### Docker команды

```bash
# Собрать Docker образ
npm run docker:build

# Запустить контейнеры
npm run docker:up

# Остановить контейнеры
npm run docker:down

# Просмотр логов
npm run docker:logs
```

### Бэкапы

```bash
# Бэкап PostgreSQL
npm run backup:db

# Бэкап Redis
npm run backup:redis
```

## Docker Compose

### Основные команды

```bash
# Запустить все сервисы
docker-compose up -d

# Остановить все сервисы
docker-compose down

# Перезапустить сервисы
docker-compose restart

# Просмотр логов всех сервисов
docker-compose logs -f

# Просмотр логов конкретного сервиса
docker-compose logs -f bot
docker-compose logs -f postgres
docker-compose logs -f redis

# Проверка статуса
docker-compose ps

# Пересборка образов
docker-compose build

# Пересборка и запуск
docker-compose up -d --build

# Остановка и удаление всех данных
docker-compose down -v
```

### Управление контейнерами

```bash
# Войти в контейнер бота
docker-compose exec bot sh

# Войти в PostgreSQL
docker-compose exec postgres psql -U postgres -d chatroulette_bot

# Войти в Redis
docker-compose exec redis redis-cli

# Просмотр использования ресурсов
docker-compose stats
```

## PostgreSQL

### Подключение

```bash
# Локальное подключение
psql -U postgres -d chatroulette_bot

# Подключение к Docker контейнеру
docker-compose exec postgres psql -U postgres -d chatroulette_bot

# Подключение с хоста к Docker
psql -h localhost -p 5432 -U postgres -d chatroulette_bot
```

### Управление базой данных

```bash
# Создать базу данных
createdb chatroulette_bot

# Удалить базу данных
dropdb chatroulette_bot

# Бэкап базы данных
pg_dump -U postgres chatroulette_bot > backup.sql

# Восстановление из бэкапа
psql -U postgres -d chatroulette_bot < backup.sql

# Экспорт в CSV
psql -U postgres -d chatroulette_bot -c "COPY users TO '/tmp/users.csv' CSV HEADER"
```

### SQL команды

```sql
-- Просмотр всех таблиц
\dt

-- Описание таблицы
\d users

-- Просмотр индексов
\di

-- Просмотр размера таблиц
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Количество пользователей
SELECT COUNT(*) FROM users;

-- Активные чаты
SELECT COUNT(*) FROM chats WHERE status = 'active';

-- Статистика по сообщениям
SELECT 
  message_type,
  COUNT(*) as count
FROM messages
GROUP BY message_type;

-- Топ пользователей по репутации
SELECT username, reputation, total_chats
FROM users
ORDER BY reputation DESC
LIMIT 10;
```

## Redis

### Подключение

```bash
# Локальное подключение
redis-cli

# С паролем
redis-cli -a your_password

# Подключение к Docker контейнеру
docker-compose exec redis redis-cli

# Подключение с хоста к Docker
redis-cli -h localhost -p 6379
```

### Основные команды

```bash
# Проверка подключения
PING

# Просмотр всех ключей
KEYS *

# Просмотр ключей по паттерну
KEYS user:*
KEYS active:*

# Получить значение
GET user:123456789

# Удалить ключ
DEL user:123456789

# Очистить всю базу (ОСТОРОЖНО!)
FLUSHALL

# Информация о Redis
INFO

# Использование памяти
INFO memory

# Статистика
INFO stats

# Сохранить на диск
SAVE

# Фоновое сохранение
BGSAVE
```

### Мониторинг

```bash
# Мониторинг команд в реальном времени
MONITOR

# Просмотр медленных запросов
SLOWLOG GET 10

# Статистика по командам
INFO commandstats
```

## PM2 (Process Manager)

### Установка

```bash
npm install -g pm2
```

### Основные команды

```bash
# Запустить приложение
pm2 start src/index.js --name chatroulette-bot

# Остановить
pm2 stop chatroulette-bot

# Перезапустить
pm2 restart chatroulette-bot

# Удалить из списка
pm2 delete chatroulette-bot

# Просмотр логов
pm2 logs chatroulette-bot

# Мониторинг
pm2 monit

# Список процессов
pm2 list

# Информация о процессе
pm2 info chatroulette-bot

# Автозапуск при перезагрузке
pm2 startup
pm2 save

# Обновление PM2
pm2 update
```

### Управление логами

```bash
# Очистить логи
pm2 flush

# Ротация логов
pm2 install pm2-logrotate

# Настройка ротации
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
```

## Git

### Основные команды

```bash
# Клонировать репозиторий
git clone https://github.com/your-username/telegram-chatroulette-bot.git

# Проверить статус
git status

# Добавить файлы
git add .

# Коммит
git commit -m "Your message"

# Отправить на GitHub
git push origin main

# Получить изменения
git pull origin main

# Создать ветку
git checkout -b feature/new-feature

# Переключиться на ветку
git checkout main

# Слияние веток
git merge feature/new-feature

# Просмотр истории
git log --oneline
```

## Системные команды

### Linux/macOS

```bash
# Проверка портов
sudo lsof -i :3000
sudo lsof -i :5432
sudo lsof -i :6379

# Убить процесс на порту
sudo kill -9 $(lsof -t -i:3000)

# Проверка использования диска
df -h

# Проверка использования памяти
free -h

# Просмотр процессов
ps aux | grep node

# Просмотр логов системы
tail -f /var/log/syslog

# Проверка сервисов
sudo systemctl status postgresql
sudo systemctl status redis-server
```

### Windows

```powershell
# Проверка портов
netstat -ano | findstr :3000

# Убить процесс
taskkill /PID <PID> /F

# Проверка сервисов
Get-Service postgresql*
Get-Service redis*

# Просмотр процессов
Get-Process node
```

## Telegram Bot Commands

### Команды для пользователей

```
/start - Начать работу с ботом
/help - Помощь и инструкции
/profile - Мой профиль
/settings - Настройки
/premium - Premium подписка
/stats - Статистика
```

### Команды для BotFather

```
/setname - Установить имя бота
/setdescription - Установить описание
/setabouttext - Установить текст "О боте"
/setuserpic - Установить аватар
/setcommands - Установить команды
/deletebot - Удалить бота
```

## Полезные алиасы

Добавьте в `~/.bashrc` или `~/.zshrc`:

```bash
# Алиасы для проекта
alias bot-start="npm start"
alias bot-dev="npm run dev"
alias bot-logs="docker-compose logs -f bot"
alias bot-restart="docker-compose restart bot"
alias bot-db="docker-compose exec postgres psql -U postgres -d chatroulette_bot"
alias bot-redis="docker-compose exec redis redis-cli"
alias bot-backup="npm run backup:db && npm run backup:redis"
```

## Troubleshooting команды

### Проверка подключений

```bash
# Проверка PostgreSQL
pg_isready -h localhost -p 5432

# Проверка Redis
redis-cli ping

# Проверка Node.js
node --version

# Проверка npm
npm --version

# Проверка Docker
docker --version
docker-compose --version
```

### Очистка и перезапуск

```bash
# Очистка npm кэша
npm cache clean --force

# Переустановка зависимостей
rm -rf node_modules package-lock.json
npm install

# Полная очистка Docker
docker-compose down -v
docker system prune -a

# Перезапуск всех сервисов
sudo systemctl restart postgresql
sudo systemctl restart redis-server
pm2 restart all
```

### Диагностика

```bash
# Проверка логов
tail -f logs/bot.log
pm2 logs chatroulette-bot --lines 100

# Проверка ошибок в БД
docker-compose logs postgres | grep ERROR

# Проверка ошибок в Redis
docker-compose logs redis | grep ERROR

# Проверка использования ресурсов
docker stats
htop
```

## Мониторинг

### Health checks

```bash
# Проверка API
curl http://localhost:3000/health

# Проверка PostgreSQL
pg_isready

# Проверка Redis
redis-cli ping

# Проверка всех сервисов
docker-compose ps
```

### Метрики

```bash
# Статистика PostgreSQL
psql -U postgres -d chatroulette_bot -c "SELECT * FROM pg_stat_database WHERE datname = 'chatroulette_bot';"

# Статистика Redis
redis-cli INFO stats

# Статистика PM2
pm2 describe chatroulette-bot
```

---

## 📝 Примечания

- Замените `your_password`, `your-username` на свои значения
- Для Windows используйте PowerShell или Git Bash
- Некоторые команды требуют sudo/admin прав
- Всегда делайте бэкапы перед важными операциями

## 🔗 Полезные ссылки

- [NPM Documentation](https://docs.npmjs.com/)
- [Docker Documentation](https://docs.docker.com/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Redis Documentation](https://redis.io/documentation)
- [PM2 Documentation](https://pm2.keymetrics.io/docs/)
- [Telegram Bot API](https://core.telegram.org/bots/api)

---

*Последнее обновление: 2024-01-15*
