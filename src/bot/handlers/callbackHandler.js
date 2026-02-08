const keyboards = require('../keyboards');
const { USER_STATUS, AGE_GROUPS } = require('../../config/constants');

class CallbackHandler {
  constructor(controller) {
    this.controller = controller;
    this.bot = controller.bot;
    this.userService = controller.userService;
    this.matchmakingService = controller.matchmakingService;
    this.chatService = controller.chatService;
    this.moderationService = controller.moderationService;
  }

  async handle(query, user) {
    const chatId = query.message.chat.id;
    const messageId = query.message.message_id;
    const data = query.data;

    // Роутинг по callback_data
    if (data === 'main_menu') {
      await this.showMainMenu(chatId, messageId, user);
    } else if (data === 'find_chat') {
      await this.showSearchMenu(chatId, messageId);
    } else if (data === 'quick_search') {
      await this.startQuickSearch(chatId, messageId, user);
    } else if (data === 'filtered_search') {
      await this.showFilterMenu(chatId, messageId);
    } else if (data === 'start_search') {
      await this.startFilteredSearch(chatId, messageId, user);
    } else if (data === 'next_chat') {
      await this.nextChat(chatId, user);
    } else if (data === 'end_chat') {
      await this.endChat(chatId, user);
    } else if (data === 'like_user') {
      await this.likeUser(chatId, user);
    } else if (data === 'report_user') {
      await this.showReportMenu(chatId, messageId);
    } else if (data.startsWith('report_')) {
      await this.handleReport(chatId, user, data);
    } else if (data === 'add_favorite') {
      await this.addToFavorites(chatId, user);
    } else if (data === 'profile') {
      await this.controller.commandHandler.handleProfile(chatId, user);
    } else if (data === 'settings') {
      await this.controller.commandHandler.handleSettings(chatId);
    } else if (data === 'premium') {
      await this.controller.commandHandler.handlePremium(chatId, user);
    } else if (data === 'stats') {
      await this.controller.commandHandler.handleStats(chatId, user);
    } else if (data.startsWith('age_')) {
      await this.setAgeGroup(chatId, messageId, user, data);
    } else if (data.startsWith('rate_')) {
      await this.rateChat(chatId, user, data);
    }
  }

  async showMainMenu(chatId, messageId, user) {
    await this.bot.editMessageText(
      `👋 Главное меню\n\nЧто хотите сделать?`,
      {
        chat_id: chatId,
        message_id: messageId,
        reply_markup: keyboards.mainMenu(user)
      }
    );
  }

  async showSearchMenu(chatId, messageId) {
    await this.bot.editMessageText(
      '🔍 Поиск собеседника\n\nВыберите тип поиска:',
      {
        chat_id: chatId,
        message_id: messageId,
        reply_markup: keyboards.searchMenu()
      }
    );
  }

  async showFilterMenu(chatId, messageId) {
    await this.bot.editMessageText(
      '🎯 Настройка фильтров\n\nВыберите параметры поиска:',
      {
        chat_id: chatId,
        message_id: messageId,
        reply_markup: keyboards.filterMenu()
      }
    );
  }

  async startQuickSearch(chatId, messageId, user) {
    await this.bot.editMessageText(
      '🔍 Ищем собеседника...\n\nПожалуйста, подождите.',
      { chat_id: chatId, message_id: messageId }
    );

    // Обновляем статус
    await this.userService.updateStatus(user.id, USER_STATUS.IN_QUEUE);

    // Добавляем в очередь
    await this.matchmakingService.addToQueue(user.id, {
      match_language: user.language_code
    });

    // Запускаем таймер
    setTimeout(async () => {
      const activeChat = await this.chatService.getActiveChat(user.id);
      if (!activeChat) {
        await this.userService.updateStatus(user.id, USER_STATUS.IDLE);
        await this.matchmakingService.removeFromQueue(user.id);
        await this.bot.sendMessage(
          chatId,
          '⏱️ Не удалось найти собеседника. Попробуйте позже.',
          { reply_markup: keyboards.mainMenu(user) }
        );
      }
    }, 60000); // 1 минута
  }

  async startFilteredSearch(chatId, messageId, user) {
    // Получаем настройки фильтров
    const settings = await this.userService.getUserSettings(user.id);
    
    await this.bot.editMessageText(
      '🔍 Ищем собеседника с учетом фильтров...',
      { chat_id: chatId, message_id: messageId }
    );

    await this.userService.updateStatus(user.id, USER_STATUS.IN_QUEUE);
    await this.matchmakingService.addToQueue(user.id, settings);
  }

  async nextChat(chatId, user) {
    const activeChat = await this.chatService.getActiveChat(user.id);
    if (!activeChat) {
      await this.bot.sendMessage(chatId, '❌ У вас нет активного чата');
      return;
    }

    await this.chatService.endChat(activeChat.chatId, user.id);
    await this.bot.sendMessage(
      chatId,
      '👋 Чат завершен. Ищем нового собеседника...'
    );

    // Сразу начинаем новый поиск
    await this.userService.updateStatus(user.id, USER_STATUS.IN_QUEUE);
    await this.matchmakingService.addToQueue(user.id, {
      match_language: user.language_code
    });
  }

  async endChat(chatId, user) {
    const activeChat = await this.chatService.getActiveChat(user.id);
    if (!activeChat) {
      await this.bot.sendMessage(chatId, '❌ У вас нет активного чата');
      return;
    }

    await this.chatService.endChat(activeChat.chatId, user.id);
    
    // Просим оценить
    await this.bot.sendMessage(
      chatId,
      '⭐ Оцените диалог:',
      { reply_markup: keyboards.ratingMenu() }
    );
  }

  async likeUser(chatId, user) {
    const activeChat = await this.chatService.getActiveChat(user.id);
    if (!activeChat) {
      await this.bot.sendMessage(chatId, '❌ У вас нет активного чата');
      return;
    }

    await this.bot.sendMessage(chatId, '❤️ Вы отметили собеседника!');
    
    // Уведомляем партнера
    const partnerChat = await this.chatService.getActiveChat(activeChat.partnerId);
    if (partnerChat) {
      await this.bot.sendMessage(
        activeChat.partnerId,
        '❤️ Вы понравились собеседнику!'
      );
    }
  }

  async showReportMenu(chatId, messageId) {
    await this.bot.editMessageText(
      '🚫 Пожаловаться\n\nВыберите причину:',
      {
        chat_id: chatId,
        message_id: messageId,
        reply_markup: keyboards.reportMenu()
      }
    );
  }

  async handleReport(chatId, user, reportType) {
    const activeChat = await this.chatService.getActiveChat(user.id);
    if (!activeChat) {
      await this.bot.sendMessage(chatId, '❌ У вас нет активного чата');
      return;
    }

    const type = reportType.replace('report_', '');
    await this.moderationService.createReport(
      user.id,
      activeChat.partnerId,
      activeChat.chatId,
      type
    );

    await this.bot.sendMessage(
      chatId,
      '✅ Жалоба отправлена. Спасибо за помощь в поддержании безопасности!'
    );

    // Завершаем чат
    await this.chatService.endChat(activeChat.chatId, user.id);
    await this.bot.sendMessage(
      chatId,
      'Чат завершен.',
      { reply_markup: keyboards.mainMenu(user) }
    );
  }

  async addToFavorites(chatId, user) {
    const activeChat = await this.chatService.getActiveChat(user.id);
    if (!activeChat) {
      await this.bot.sendMessage(chatId, '❌ У вас нет активного чата');
      return;
    }

    await this.userService.addFavorite(user.id, activeChat.partnerId);
    await this.bot.sendMessage(chatId, '⭐ Собеседник добавлен в избранное!');
  }

  async setAgeGroup(chatId, messageId, user, data) {
    const ageMap = {
      age_teen: AGE_GROUPS.TEEN,
      age_young: AGE_GROUPS.YOUNG,
      age_adult: AGE_GROUPS.ADULT,
      age_mature: AGE_GROUPS.MATURE,
      age_senior: AGE_GROUPS.SENIOR
    };

    const ageGroup = ageMap[data];
    await this.userService.updateUser(user.id, { age_group: ageGroup });

    await this.bot.editMessageText(
      '✅ Возрастная группа установлена!\n\nТеперь вы можете начать общение.',
      { chat_id: chatId, message_id: messageId }
    );

    // Показываем главное меню
    const updatedUser = await this.userService.getUser(user.telegram_id);
    await this.bot.sendMessage(
      chatId,
      'Добро пожаловать!',
      { reply_markup: keyboards.mainMenu(updatedUser) }
    );
  }

  async rateChat(chatId, user, data) {
    const rating = parseInt(data.replace('rate_', ''));
    
    // Находим последний завершенный чат
    const history = await this.chatService.getChatHistory(user.id, 1);
    if (history.length > 0) {
      await this.chatService.rateChat(history[0].id, user.id, rating);
      await this.bot.sendMessage(
        chatId,
        '✅ Спасибо за оценку!',
        { reply_markup: keyboards.mainMenu(user) }
      );
    }
  }
}

module.exports = CallbackHandler;
