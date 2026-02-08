const UserService = require('../services/userService');
const MatchmakingService = require('../matchmaking/matchmakingService');
const ChatService = require('../services/chatService');
const ModerationService = require('../moderation/moderationService');
const MessageHandler = require('./handlers/messageHandler');
const CommandHandler = require('./handlers/commandHandler');
const CallbackHandler = require('./handlers/callbackHandler');
const { checkFlood } = require('../services/redis');
const logger = require('../utils/logger');
const keyboards = require('./keyboards');

class BotController {
  constructor(bot) {
    this.bot = bot;
    this.userService = new UserService();
    this.matchmakingService = new MatchmakingService();
    this.chatService = new ChatService();
    this.moderationService = new ModerationService();
    this.messageHandler = new MessageHandler(this);
    this.commandHandler = new CommandHandler(this);
    this.callbackHandler = new CallbackHandler(this);
  }

  async init() {
    // Команды
    this.bot.onText(/\/start/, (msg) => this.handleCommand(msg, 'start'));
    this.bot.onText(/\/help/, (msg) => this.handleCommand(msg, 'help'));
    this.bot.onText(/\/profile/, (msg) => this.handleCommand(msg, 'profile'));
    this.bot.onText(/\/settings/, (msg) => this.handleCommand(msg, 'settings'));
    this.bot.onText(/\/premium/, (msg) => this.handleCommand(msg, 'premium'));
    this.bot.onText(/\/stats/, (msg) => this.handleCommand(msg, 'stats'));

    // Callback queries (кнопки)
    this.bot.on('callback_query', (query) => this.handleCallback(query));

    // Сообщения
    this.bot.on('message', (msg) => this.handleMessage(msg));

    logger.info('Bot controller initialized');
  }

  async handleCommand(msg, command) {
    const userId = msg.from.id;

    try {
      // Проверка флуда
      if (await checkFlood(userId)) {
        return this.bot.sendMessage(
          msg.chat.id,
          '⚠️ Слишком много запросов. Подождите немного.'
        );
      }

      // Получение/создание пользователя
      let user = await this.userService.getUser(userId);
      if (!user) {
        user = await this.userService.createUser(msg.from);
      }

      // Проверка бана
      if (user.banned) {
        return this.bot.sendMessage(
          msg.chat.id,
          `🚫 Вы заблокированы.\nПричина: ${user.ban_reason || 'Нарушение правил'}`
        );
      }

      // Обработка команды
      await this.commandHandler.handle(msg, command, user);
    } catch (error) {
      logger.error('Command error:', { command, userId, error: error.message });
      this.bot.sendMessage(
        msg.chat.id,
        '❌ Произошла ошибка. Попробуйте позже.'
      );
    }
  }

  async handleCallback(query) {
    const userId = query.from.id;

    try {
      await this.bot.answerCallbackQuery(query.id);

      const user = await this.userService.getUser(userId);
      if (!user || user.banned) return;

      await this.callbackHandler.handle(query, user);
    } catch (error) {
      logger.error('Callback error:', { userId, error: error.message });
    }
  }

  async handleMessage(msg) {
    // Игнорируем команды (они обрабатываются отдельно)
    if (msg.text && msg.text.startsWith('/')) return;

    const userId = msg.from.id;

    try {
      const user = await this.userService.getUser(userId);
      if (!user || user.banned) return;

      // Проверка флуда
      if (await checkFlood(userId)) {
        return this.bot.sendMessage(
          msg.chat.id,
          '⚠️ Слишком много сообщений. Замедлитесь.'
        );
      }

      await this.messageHandler.handle(msg, user);
    } catch (error) {
      logger.error('Message error:', { userId, error: error.message });
    }
  }
}

module.exports = BotController;
