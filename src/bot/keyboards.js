const { PREMIUM_TIERS } = require('../config/constants');

// Главное меню
function mainMenu(user) {
  const buttons = [
    [{ text: '🎲 Найти собеседника', callback_data: 'find_chat' }],
    [
      { text: '👤 Профиль', callback_data: 'profile' },
      { text: '⚙️ Настройки', callback_data: 'settings' }
    ],
    [
      { text: '⭐ Избранное', callback_data: 'favorites' },
      { text: '📊 Статистика', callback_data: 'stats' }
    ]
  ];

  if (user.premium_tier === PREMIUM_TIERS.FREE) {
    buttons.push([{ text: '💎 Premium', callback_data: 'premium' }]);
  }

  buttons.push([{ text: '❓ Помощь', callback_data: 'help' }]);

  return {
    inline_keyboard: buttons
  };
}

// Меню во время чата
function chatMenu() {
  return {
    inline_keyboard: [
      [
        { text: '➡️ Следующий', callback_data: 'next_chat' },
        { text: '❌ Завершить', callback_data: 'end_chat' }
      ],
      [
        { text: '❤️ Нравится', callback_data: 'like_user' },
        { text: '🚫 Пожаловаться', callback_data: 'report_user' }
      ],
      [{ text: '⭐ В избранное', callback_data: 'add_favorite' }]
    ]
  };
}

// Меню поиска
function searchMenu() {
  return {
    inline_keyboard: [
      [{ text: '🎲 Быстрый поиск', callback_data: 'quick_search' }],
      [{ text: '🔍 Поиск с фильтрами', callback_data: 'filtered_search' }],
      [{ text: '⭐ Найти из избранного', callback_data: 'search_favorites' }],
      [{ text: '🔙 Назад', callback_data: 'main_menu' }]
    ]
  };
}

// Фильтры поиска
function filterMenu() {
  return {
    inline_keyboard: [
      [{ text: '🌍 Язык', callback_data: 'filter_language' }],
      [{ text: '👥 Возраст', callback_data: 'filter_age' }],
      [{ text: '🏳️ Страна', callback_data: 'filter_country' }],
      [{ text: '🎯 Интересы', callback_data: 'filter_interests' }],
      [{ text: '✅ Начать поиск', callback_data: 'start_search' }],
      [{ text: '🔙 Назад', callback_data: 'search_menu' }]
    ]
  };
}

// Меню настроек
function settingsMenu() {
  return {
    inline_keyboard: [
      [{ text: '🌍 Язык интерфейса', callback_data: 'setting_language' }],
      [{ text: '👤 Редактировать профиль', callback_data: 'edit_profile' }],
      [{ text: '🎯 Мои интересы', callback_data: 'edit_interests' }],
      [{ text: '🔔 Уведомления', callback_data: 'setting_notifications' }],
      [{ text: '🚫 Черный список', callback_data: 'blacklist' }],
      [{ text: '🔙 Назад', callback_data: 'main_menu' }]
    ]
  };
}

// Меню жалобы
function reportMenu() {
  return {
    inline_keyboard: [
      [{ text: '📧 Спам', callback_data: 'report_spam' }],
      [{ text: '😠 Оскорбления', callback_data: 'report_harassment' }],
      [{ text: '🔞 Неприемлемый контент', callback_data: 'report_inappropriate' }],
      [{ text: '👶 Несовершеннолетний', callback_data: 'report_underage' }],
      [{ text: '💰 Мошенничество', callback_data: 'report_scam' }],
      [{ text: '❓ Другое', callback_data: 'report_other' }],
      [{ text: '🔙 Отмена', callback_data: 'chat_menu' }]
    ]
  };
}

// Меню премиум
function premiumMenu() {
  return {
    inline_keyboard: [
      [{ text: '💎 Basic - 99₽/мес', callback_data: 'buy_basic' }],
      [{ text: '💎 Pro - 199₽/мес', callback_data: 'buy_pro' }],
      [{ text: '💎 VIP - 399₽/мес', callback_data: 'buy_vip' }],
      [{ text: '🔙 Назад', callback_data: 'main_menu' }]
    ]
  };
}

// Оценка собеседника
function ratingMenu() {
  return {
    inline_keyboard: [
      [
        { text: '⭐', callback_data: 'rate_1' },
        { text: '⭐⭐', callback_data: 'rate_2' },
        { text: '⭐⭐⭐', callback_data: 'rate_3' }
      ],
      [
        { text: '⭐⭐⭐⭐', callback_data: 'rate_4' },
        { text: '⭐⭐⭐⭐⭐', callback_data: 'rate_5' }
      ],
      [{ text: 'Пропустить', callback_data: 'skip_rating' }]
    ]
  };
}

// Подтверждение
function confirmMenu(action) {
  return {
    inline_keyboard: [
      [
        { text: '✅ Да', callback_data: `confirm_${action}` },
        { text: '❌ Нет', callback_data: `cancel_${action}` }
      ]
    ]
  };
}

// Быстрые фразы
function quickPhrasesMenu() {
  return {
    inline_keyboard: [
      [{ text: '👋 Привет!', callback_data: 'phrase_hello' }],
      [{ text: '😊 Как дела?', callback_data: 'phrase_howru' }],
      [{ text: '👍 Отлично!', callback_data: 'phrase_great' }],
      [{ text: '😂 Ха-ха', callback_data: 'phrase_lol' }],
      [{ text: '👋 Пока!', callback_data: 'phrase_bye' }]
    ]
  };
}

module.exports = {
  mainMenu,
  chatMenu,
  searchMenu,
  filterMenu,
  settingsMenu,
  reportMenu,
  premiumMenu,
  ratingMenu,
  confirmMenu,
  quickPhrasesMenu
};
