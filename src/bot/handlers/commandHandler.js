const keyboards = require('../keyboards');
const { PREMIUM_TIERS } = require('../../config/constants');

class CommandHandler {
  constructor(controller) {
    this.controller = controller;
    this.bot = controller.bot;
    this.userService = controller.userService;
  }

  async handle(msg, command, user) {
    const chatId = msg.chat.id;

    switch (command) {
      case 'start':
        await this.handleStart(chatId, user);
        break;
      case 'help':
        await this.handleHelp(chatId);
        break;
      case 'profile':
        await this.handleProfile(chatId, user);
        break;
      case 'settings':
        await this.handleSettings(chatId);
        break;
      case 'premium':
        await this.handlePremium(chatId, user);
        break;
      case 'stats':
        await this.handleStats(chatId, user);
        break;
      default:
        await this.bot.sendMessage(chatId, '❓ Неизвестная команда');
    }
  }

  async handleStart(chatId, user) {
    const isNewUser = !user.age_group;

    if (isNewUser) {
      // Онбординг для новых пользователей
      await this.bot.sendMessage(
        chatId,
        `👋 Добро пожаловать в Chat Roulette!

Здесь вы можете общаться с случайными людьми со всего мира.

🔒 Безопасность - наш приоритет
🌍 Умный подбор собеседников
💬 Поддержка текста, фото, голоса

Давайте настроим ваш профиль!`
      );

      // Запрашиваем возрастную группу
      await this.bot.sendMessage(
        chatId,
        'Выберите вашу возрастную группу:',
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: '13-17', callback_data: 'age_teen' }],
              [{ text: '18-24', callback_data: 'age_young' }],
              [{ text: '25-34', callback_data: 'age_adult' }],
              [{ text: '35-44', callback_data: 'age_mature' }],
              [{ text: '45+', callback_data: 'age_senior' }]
            ]
          }
        }
      );
    } else {
      // Главное меню для существующих пользователей
      await this.bot.sendMessage(
        chatId,
        `👋 С возвращением, ${user.first_name}!

Что хотите сделать?`,
        { reply_markup: keyboards.mainMenu(user) }
      );
    }
  }

  async handleHelp(chatId) {
    const helpText = `❓ Помощь

🎲 Как начать:
1. Нажмите "Найти собеседника"
2. Дождитесь подключения
3. Общайтесь!

⚙️ Фильтры поиска:
• Язык общения
• Возрастная группа
• Страна
• Интересы

🔒 Безопасность:
• Жалоба - если собеседник нарушает правила
• Черный список - заблокировать пользователя
• AI-модерация - автоматическая проверка сообщений

⭐ Функции:
• Избранное - сохраняйте интересных собеседников
• Репутация - оценивайте диалоги
• Достижения - получайте награды
• Premium - дополнительные возможности

📞 Поддержка: @support_bot`;

    await this.bot.sendMessage(chatId, helpText, {
      reply_markup: {
        inline_keyboard: [
          [{ text: '🔙 Главное меню', callback_data: 'main_menu' }]
        ]
      }
    });
  }

  async handleProfile(chatId, user) {
    const achievements = await this.userService.getUserAchievements(user.id);
    const achievementsList = achievements.map(a => `${a.icon} ${a.name}`).join('\n') || 'Пока нет';

    const profileText = `👤 Ваш профиль

📊 Статистика:
• Уровень: ${user.level}
• Опыт: ${user.experience}
• Репутация: ${user.reputation}
• Всего чатов: ${user.total_chats}
• Сообщений: ${user.total_messages}

🎯 Интересы: ${user.interests?.join(', ') || 'Не указаны'}
🌍 Страна: ${user.country || 'Не указана'}
💎 Статус: ${this.getPremiumName(user.premium_tier)}

🏆 Достижения:
${achievementsList}`;

    await this.bot.sendMessage(chatId, profileText, {
      reply_markup: {
        inline_keyboard: [
          [{ text: '✏️ Редактировать', callback_data: 'edit_profile' }],
          [{ text: '🔙 Главное меню', callback_data: 'main_menu' }]
        ]
      }
    });
  }

  async handleSettings(chatId) {
    await this.bot.sendMessage(
      chatId,
      '⚙️ Настройки\n\nВыберите раздел:',
      { reply_markup: keyboards.settingsMenu() }
    );
  }

  async handlePremium(chatId, user) {
    if (user.premium_tier !== PREMIUM_TIERS.FREE) {
      const expiryDate = new Date(user.premium_until).toLocaleDateString('ru-RU');
      await this.bot.sendMessage(
        chatId,
        `💎 У вас активна подписка ${this.getPremiumName(user.premium_tier)}\n\nДействует до: ${expiryDate}`,
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: '🔙 Главное меню', callback_data: 'main_menu' }]
            ]
          }
        }
      );
      return;
    }

    const premiumText = `💎 Premium подписка

🌟 Basic (99₽/мес):
• Приоритет в очереди
• Фильтр по полу
• Без рекламы

⭐ Pro (199₽/мес):
• Все из Basic
• Невидимый режим
• Больше фильтров
• 2x опыта

👑 VIP (399₽/мес):
• Все из Pro
• VIP значок
• Приоритетная поддержка
• Эксклюзивные стикеры`;

    await this.bot.sendMessage(chatId, premiumText, {
      reply_markup: keyboards.premiumMenu()
    });
  }

  async handleStats(chatId, user) {
    const stats = await this.userService.getStats(user.id);
    const memberSince = new Date(stats.created_at).toLocaleDateString('ru-RU');

    const statsText = `📊 Ваша статистика

👥 Общение:
• Всего чатов: ${stats.total_chats}
• Сообщений отправлено: ${stats.total_messages}
• Средняя длина чата: ${stats.total_chats > 0 ? Math.round(stats.total_messages / stats.total_chats) : 0} сообщений

⭐ Репутация:
• Рейтинг: ${stats.reputation}/100
• Уровень: ${stats.level}
• Опыт: ${stats.experience}

📅 Участник с: ${memberSince}`;

    await this.bot.sendMessage(chatId, statsText, {
      reply_markup: {
        inline_keyboard: [
          [{ text: '🔙 Главное меню', callback_data: 'main_menu' }]
        ]
      }
    });
  }

  getPremiumName(tier) {
    const names = {
      free: 'Бесплатный',
      basic: 'Basic',
      pro: 'Pro',
      vip: 'VIP'
    };
    return names[tier] || 'Бесплатный';
  }
}

module.exports = CommandHandler;
