module.exports = {
  // Статусы пользователя
  USER_STATUS: {
    IDLE: 'idle',
    IN_QUEUE: 'in_queue',
    IN_CHAT: 'in_chat',
    BANNED: 'banned',
    SHADOW_BANNED: 'shadow_banned'
  },

  // Возрастные группы
  AGE_GROUPS: {
    TEEN: '13-17',
    YOUNG: '18-24',
    ADULT: '25-34',
    MATURE: '35-44',
    SENIOR: '45+'
  },

  // Языки
  LANGUAGES: {
    RU: 'ru',
    EN: 'en',
    ES: 'es',
    DE: 'de',
    FR: 'fr',
    IT: 'it',
    PT: 'pt',
    UK: 'uk'
  },

  // Типы жалоб
  REPORT_TYPES: {
    SPAM: 'spam',
    HARASSMENT: 'harassment',
    INAPPROPRIATE: 'inappropriate',
    UNDERAGE: 'underage',
    SCAM: 'scam',
    OTHER: 'other'
  },

  // Уровни токсичности
  TOXICITY_LEVELS: {
    SAFE: 0,
    LOW: 1,
    MEDIUM: 2,
    HIGH: 3,
    SEVERE: 4
  },

  // Типы премиум подписок
  PREMIUM_TIERS: {
    FREE: 'free',
    BASIC: 'basic',
    PRO: 'pro',
    VIP: 'vip'
  },

  // Достижения
  ACHIEVEMENTS: {
    FIRST_CHAT: 'first_chat',
    CHAT_10: 'chat_10',
    CHAT_50: 'chat_50',
    CHAT_100: 'chat_100',
    CHAT_500: 'chat_500',
    POPULAR: 'popular',
    FRIENDLY: 'friendly',
    POLYGLOT: 'polyglot',
    NIGHT_OWL: 'night_owl',
    EARLY_BIRD: 'early_bird'
  },

  // Лимиты
  LIMITS: {
    MAX_QUEUE_TIME: 300, // 5 минут
    MAX_CHAT_DURATION: 3600, // 1 час
    FLOOD_LIMIT: 5,
    FLOOD_WINDOW: 10, // секунд
    MAX_REPORTS_BEFORE_BAN: 3,
    MAX_MESSAGE_LENGTH: 4096,
    MAX_BIO_LENGTH: 500,
    MAX_INTERESTS: 10,
    MIN_AGE: 13
  },

  // Приоритеты в очереди
  QUEUE_PRIORITY: {
    LOW: 1,
    NORMAL: 2,
    HIGH: 3,
    PREMIUM: 4,
    VIP: 5
  },

  // Типы сообщений
  MESSAGE_TYPES: {
    TEXT: 'text',
    PHOTO: 'photo',
    VOICE: 'voice',
    STICKER: 'sticker',
    GIF: 'gif',
    VIDEO_NOTE: 'video_note'
  },

  // События для статистики
  EVENTS: {
    USER_REGISTERED: 'user_registered',
    CHAT_STARTED: 'chat_started',
    CHAT_ENDED: 'chat_ended',
    MESSAGE_SENT: 'message_sent',
    REPORT_FILED: 'report_filed',
    USER_BANNED: 'user_banned',
    PREMIUM_PURCHASED: 'premium_purchased'
  }
};
