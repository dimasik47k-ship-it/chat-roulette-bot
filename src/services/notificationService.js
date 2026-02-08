const { subscribeToChannel } = require('./redis');
const logger = require('../utils/logger');

class NotificationService {
  constructor(bot) {
    this.bot = bot;
  }

  async init() {
    // Подписываемся на события чатов
    await subscribeToChannel('chat:*', async (data) => {
      await this.handleChatMessage(data);
    });

    // Подписываемся на события матчмейкинга
    await subscribeToChannel('match:found', async (data) => {
      await this.handleMatchFound(data);
    });

    logger.info('Notification service initialized');
  }

  async handleChatMessage(data) {
    try {
      const { receiverId, message } = data;
      // Сообщение уже отправлено в messageHandler
    } catch (error) {
      logger.error('Error handling chat message', { error: error.message });
    }
  }

  async handleMatchFound(data) {
    try {
      const { user1Id, user2Id, chatId } = data;

      // Уведомляем обоих пользователей
      await this.bot.sendMessage(
        user1Id,
        '✅ Собеседник найден! Начинайте общение.',
        {
          reply_markup: {
            inline_keyboard: [
              [
                { text: '➡️ Следующий', callback_data: 'next_chat' },
                { text: '❌ Завершить', callback_data: 'end_chat' }
              ],
              [
                { text: '❤️ Нравится', callback_data: 'like_user' },
                { text: '🚫 Пожаловаться', callback_data: 'report_user' }
              ]
            ]
          }
        }
      );

      await this.bot.sendMessage(
        user2Id,
        '✅ Собеседник найден! Начинайте общение.',
        {
          reply_markup: {
            inline_keyboard: [
              [
                { text: '➡️ Следующий', callback_data: 'next_chat' },
                { text: '❌ Завершить', callback_data: 'end_chat' }
              ],
              [
                { text: '❤️ Нравится', callback_data: 'like_user' },
                { text: '🚫 Пожаловаться', callback_data: 'report_user' }
              ]
            ]
          }
        }
      );
    } catch (error) {
      logger.error('Error handling match found', { error: error.message });
    }
  }

  async notifyPremiumExpiring(userId, daysLeft) {
    await this.bot.sendMessage(
      userId,
      `💎 Ваша Premium подписка истекает через ${daysLeft} дней.\n\nПродлите подписку, чтобы не потерять преимущества!`,
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: '💎 Продлить Premium', callback_data: 'premium' }]
          ]
        }
      }
    );
  }

  async notifyBan(userId, reason, duration) {
    const message = duration
      ? `🚫 Вы временно заблокированы на ${Math.round(duration / 3600)} часов.\n\nПричина: ${reason}`
      : `🚫 Вы заблокированы.\n\nПричина: ${reason}`;

    await this.bot.sendMessage(userId, message);
  }
}

module.exports = NotificationService;
