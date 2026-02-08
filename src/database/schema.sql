-- Пользователи
CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  telegram_id BIGINT UNIQUE NOT NULL,
  username VARCHAR(255),
  first_name VARCHAR(255),
  language_code VARCHAR(10) DEFAULT 'ru',
  status VARCHAR(50) DEFAULT 'idle',
  age_group VARCHAR(20),
  gender VARCHAR(20),
  country VARCHAR(100),
  bio TEXT,
  interests TEXT[], -- массив интересов
  premium_tier VARCHAR(20) DEFAULT 'free',
  premium_until TIMESTAMP,
  reputation INTEGER DEFAULT 0,
  level INTEGER DEFAULT 1,
  experience INTEGER DEFAULT 0,
  total_chats INTEGER DEFAULT 0,
  total_messages INTEGER DEFAULT 0,
  reports_received INTEGER DEFAULT 0,
  reports_filed INTEGER DEFAULT 0,
  banned BOOLEAN DEFAULT FALSE,
  shadow_banned BOOLEAN DEFAULT FALSE,
  ban_reason TEXT,
  ban_until TIMESTAMP,
  last_active TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Индексы для users
CREATE INDEX idx_users_telegram_id ON users(telegram_id);
CREATE INDEX idx_users_status ON users(status);
CREATE INDEX idx_users_premium_tier ON users(premium_tier);
CREATE INDEX idx_users_banned ON users(banned);

-- Настройки пользователя
CREATE TABLE IF NOT EXISTS user_settings (
  user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  match_language VARCHAR(10),
  match_age_groups TEXT[],
  match_countries TEXT[],
  match_interests TEXT[],
  match_only_new BOOLEAN DEFAULT FALSE,
  show_typing BOOLEAN DEFAULT TRUE,
  auto_translate BOOLEAN DEFAULT FALSE,
  notifications BOOLEAN DEFAULT TRUE,
  invisible_mode BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Чаты
CREATE TABLE IF NOT EXISTS chats (
  id BIGSERIAL PRIMARY KEY,
  user1_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
  user2_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
  started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  ended_at TIMESTAMP,
  duration INTEGER, -- в секундах
  messages_count INTEGER DEFAULT 0,
  user1_rating INTEGER, -- оценка от user1
  user2_rating INTEGER, -- оценка от user2
  ended_by BIGINT, -- кто завершил
  status VARCHAR(50) DEFAULT 'active'
);

-- Индексы для chats
CREATE INDEX idx_chats_user1 ON chats(user1_id);
CREATE INDEX idx_chats_user2 ON chats(user2_id);
CREATE INDEX idx_chats_status ON chats(status);
CREATE INDEX idx_chats_started_at ON chats(started_at);

-- Сообщения (для истории и модерации)
CREATE TABLE IF NOT EXISTS messages (
  id BIGSERIAL PRIMARY KEY,
  chat_id BIGINT REFERENCES chats(id) ON DELETE CASCADE,
  sender_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
  message_type VARCHAR(50) DEFAULT 'text',
  content TEXT,
  file_id VARCHAR(255),
  toxicity_score FLOAT DEFAULT 0,
  flagged BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Индексы для messages
CREATE INDEX idx_messages_chat_id ON messages(chat_id);
CREATE INDEX idx_messages_sender_id ON messages(sender_id);
CREATE INDEX idx_messages_flagged ON messages(flagged);

-- Жалобы
CREATE TABLE IF NOT EXISTS reports (
  id BIGSERIAL PRIMARY KEY,
  reporter_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
  reported_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
  chat_id BIGINT REFERENCES chats(id) ON DELETE SET NULL,
  report_type VARCHAR(50) NOT NULL,
  description TEXT,
  status VARCHAR(50) DEFAULT 'pending',
  reviewed_by BIGINT,
  reviewed_at TIMESTAMP,
  action_taken VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Индексы для reports
CREATE INDEX idx_reports_reported_id ON reports(reported_id);
CREATE INDEX idx_reports_status ON reports(status);
CREATE INDEX idx_reports_created_at ON reports(created_at);

-- Черный список
CREATE TABLE IF NOT EXISTS blacklist (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
  blocked_user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, blocked_user_id)
);

-- Избранные собеседники
CREATE TABLE IF NOT EXISTS favorites (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
  favorite_user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, favorite_user_id)
);

-- Достижения
CREATE TABLE IF NOT EXISTS achievements (
  id SERIAL PRIMARY KEY,
  code VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  icon VARCHAR(50)
);

-- Достижения пользователей
CREATE TABLE IF NOT EXISTS user_achievements (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
  achievement_id INTEGER REFERENCES achievements(id) ON DELETE CASCADE,
  unlocked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, achievement_id)
);

-- Транзакции (для премиум)
CREATE TABLE IF NOT EXISTS transactions (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
  amount DECIMAL(10, 2) NOT NULL,
  currency VARCHAR(10) DEFAULT 'USD',
  product VARCHAR(100),
  status VARCHAR(50) DEFAULT 'pending',
  payment_provider VARCHAR(50),
  provider_transaction_id VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Статистика
CREATE TABLE IF NOT EXISTS statistics (
  id BIGSERIAL PRIMARY KEY,
  event_type VARCHAR(100) NOT NULL,
  user_id BIGINT,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Индексы для statistics
CREATE INDEX idx_statistics_event_type ON statistics(event_type);
CREATE INDEX idx_statistics_created_at ON statistics(created_at);
CREATE INDEX idx_statistics_user_id ON statistics(user_id);

-- Вставка базовых достижений
INSERT INTO achievements (code, name, description, icon) VALUES
  ('first_chat', 'Первый разговор', 'Завершите свой первый чат', '🎉'),
  ('chat_10', 'Болтун', 'Завершите 10 чатов', '💬'),
  ('chat_50', 'Общительный', 'Завершите 50 чатов', '🗣️'),
  ('chat_100', 'Социальная бабочка', 'Завершите 100 чатов', '🦋'),
  ('chat_500', 'Легенда общения', 'Завершите 500 чатов', '👑'),
  ('popular', 'Популярный', 'Получите 50 лайков', '⭐'),
  ('friendly', 'Дружелюбный', 'Средний рейтинг 4.5+', '😊'),
  ('polyglot', 'Полиглот', 'Общайтесь на 5 языках', '🌍'),
  ('night_owl', 'Сова', 'Чат в 3 часа ночи', '🦉'),
  ('early_bird', 'Жаворонок', 'Чат в 6 утра', '🐦')
ON CONFLICT (code) DO NOTHING;
