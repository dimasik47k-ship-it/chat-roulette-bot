// Мультиязычная поддержка

const translations = {
  ru: {
    welcome: '👋 Добро пожаловать в Chat Roulette!',
    search_started: '🔍 Ищем собеседника...',
    match_found: '✅ Собеседник найден!',
    chat_ended: '👋 Чат завершен',
    no_users: '😔 Сейчас нет доступных пользователей',
    banned: '🚫 Вы заблокированы',
    spam_detected: '🚫 Обнаружен спам',
    toxic_message: '⚠️ Сообщение содержит неприемлемый контент',
    report_sent: '✅ Жалоба отправлена',
    added_to_favorites: '⭐ Добавлено в избранное',
    achievement_unlocked: '🏆 Достижение разблокировано!'
  },
  en: {
    welcome: '👋 Welcome to Chat Roulette!',
    search_started: '🔍 Searching for a chat partner...',
    match_found: '✅ Chat partner found!',
    chat_ended: '👋 Chat ended',
    no_users: '😔 No users available right now',
    banned: '🚫 You are banned',
    spam_detected: '🚫 Spam detected',
    toxic_message: '⚠️ Message contains inappropriate content',
    report_sent: '✅ Report sent',
    added_to_favorites: '⭐ Added to favorites',
    achievement_unlocked: '🏆 Achievement unlocked!'
  },
  es: {
    welcome: '👋 ¡Bienvenido a Chat Roulette!',
    search_started: '🔍 Buscando compañero de chat...',
    match_found: '✅ ¡Compañero encontrado!',
    chat_ended: '👋 Chat terminado',
    no_users: '😔 No hay usuarios disponibles ahora',
    banned: '🚫 Estás bloqueado',
    spam_detected: '🚫 Spam detectado',
    toxic_message: '⚠️ El mensaje contiene contenido inapropiado',
    report_sent: '✅ Reporte enviado',
    added_to_favorites: '⭐ Añadido a favoritos',
    achievement_unlocked: '🏆 ¡Logro desbloqueado!'
  }
};

function t(key, lang = 'ru') {
  const langTranslations = translations[lang] || translations.ru;
  return langTranslations[key] || translations.ru[key] || key;
}

module.exports = { t, translations };
