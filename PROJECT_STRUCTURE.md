# 📁 Структура проекта

```
telegram-chatroulette-bot/
│
├── src/                          # Исходный код
│   ├── index.js                  # Точка входа приложения
│   │
│   ├── bot/                      # Telegram Bot логика
│   │   ├── controller.js         # Главный контроллер бота
│   │   ├── keyboards.js          # Интерактивные клавиатуры
│   │   └── handlers/             # Обработчики событий
│   │       ├── commandHandler.js # Обработка команд (/start, /help)
│   │       ├── callbackHandler.js# Обработка кнопок
│   │       └── messageHandler.js # Обработка сообщений
│   │
│   ├── matchmaking/              # Система подбора собеседников
│   │   └── matchmakingService.js # Алгоритмы matchmaking
│   │
│   ├── moderation/               # AI модерация
│   │   └── moderationService.js  # Moder AI - проверка контента
│   │
│   ├── services/                 # Бизнес-логика
│   │   ├── userService.js        # Управление пользователями
│   │   ├── chatService.js        # Управление чатами
│   │   ├── redis.js              # Redis клиент и функции
│   │   ├── achievementService.js # Система достижений
│   │   └── notificationService.js# Уведомления
│   │
│   ├── database/                 # База данных
│   │   ├── init.js               # Инициализация БД
│   │   ├── schema.sql            # SQL схема
│   │   └── migrate.js            # Миграции
│   │
│   ├── config/                   # Конфигурация
│   │   ├── constants.js          # Константы приложения
│   │   └── texts.js              # Текстовые шаблоны
│   │
│   └── utils/                    # Утилиты
│       ├── logger.js             # Логирование
│       ├── helpers.js            # Вспомогательные функции
│       └── i18n.js               # Интернационализация
│
├── docs/                         # Документация
│   ├── README.md                 # Главная документация
│   ├── ARCHITECTURE.md           # Архитектура системы
│   ├── FEATURES.md               # Список функций
│   ├── API.md                    # API документация
│   ├── FAQ.md                    # Часто задаваемые вопросы
│   ├── DEPLOYMENT.md             # Руководство по развертыванию
│   ├── CONTRIBUTING.md           # Руководство для контрибьюторов
│   ├── SECURITY.md               # Политика безопасности
│   └── CHANGELOG.md              # История изменений
│
├── .env.example                  # Пример переменных окружения
├── .gitignore                    # Git ignore файл
├── .dockerignore                 # Docker ignore файл
├── .eslintrc.json                # ESLint конфигурация
├── .prettierrc                   # Prettier конфигурация
│
├── package.json                  # NPM зависимости
├── Dockerfile                    # Docker образ
├── docker-compose.yml            # Docker Compose конфигурация
│
├── LICENSE                       # MIT лицензия
└── PROJECT_STRUCTURE.md          # Этот файл

```

## Описание модулей

### 🤖 Bot Layer
Взаимодействие с Telegram API, обработка команд, сообщений и callback queries.

### 🧠 Matchmaking
Умный алгоритм подбора собеседников на основе множества параметров.

### 🔒 Moderation
AI-модерация контента с использованием NLP и внешних API.

### 💾 Services
Бизнес-логика приложения: пользователи, чаты, достижения.

### 🗄️ Database
PostgreSQL схема и миграции для хранения данных.

### ⚙️ Config
Константы, настройки и текстовые шаблоны.

### 🛠️ Utils
Вспомогательные функции: логирование, форматирование, i18n.

## Потоки данных

### Регистрация пользователя
```
User → /start → CommandHandler → UserService → PostgreSQL
                                              → Redis Cache
```

### Поиск собеседника
```
User → "Найти" → CallbackHandler → MatchmakingService → Redis Queue
                                                       → Process Queue
                                                       → Create Match
                                                       → ChatService
                                                       → Notify Users
```

### Отправка сообщения
```
User → Message → MessageHandler → ModerationService → Check Content
                                                    → Save to DB
                                                    → Send to Partner
                                                    → Add Experience
```

## Технологии

- **Backend**: Node.js 18+
- **Bot Framework**: node-telegram-bot-api
- **Database**: PostgreSQL 15+
- **Cache**: Redis 7+
- **NLP**: Natural.js
- **AI**: HuggingFace API (optional)
- **Server**: Express
- **Container**: Docker

## Масштабирование

### Горизонтальное
- Несколько инстансов бота
- Load balancer
- Redis для синхронизации

### Вертикальное
- Оптимизация запросов
- Индексы БД
- Кэширование

## Безопасность

- Анти-флуд (Redis)
- AI-модерация (NLP)
- Система жалоб
- Автоматические баны
- Черный список
- Шифрование данных

## Мониторинг

- Структурированные логи
- Health check endpoint
- Метрики в БД
- Error tracking

## Развертывание

- Development: `npm run dev`
- Production: Docker Compose
- Cloud: Heroku, Railway, AWS
